// The creation of a handoff file (design REQ-039, 4.5-4.6): the name is taken by a hard
// link of a finished temporary file, so a name that is already used gives EEXIST and the
// older file is never replaced. Every fs call goes through the default `fs` object, so
// that the tests can inject failures.
import fs from "node:fs";
import path from "node:path";
import { isOsError } from "../util.js";
import { HandoffError, osCodeOf } from "./errors.js";

const MAX_JSON_BYTES = 16 * 1024 * 1024;
// The file system cannot make a hard link; there is no other way (decisions/0039).
const NO_LINKS = new Set(["EPERM", "ENOTSUP", "EOPNOTSUPP", "ENOSYS", "EXDEV"]);

const byBytes = (a, b) =>
  Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));

function ioError(operation, rel, err, state) {
  return new HandoffError(
    "E_HO_IO",
    `${operation} не удалась: ${rel} (${osCodeOf(err)}); ${state}`,
    2,
  );
}

function tmpRelOf(rel) {
  const dir = path.posix.dirname(rel);
  return `${dir}/.${path.posix.basename(rel)}.sai-tmp`;
}

// The entry at `rel` (lstat), or null when there is none.
function entryAt(root, rel) {
  try {
    return fs.lstatSync(path.join(root, rel));
  } catch (err) {
    if (!isOsError(err)) throw err;
    if (err.code === "ENOENT") return null;
    throw ioError("проверка", rel, err, "handoff не создан");
  }
}

// The first file (by bytes) of handoffs/ whose top-level `handoff_id` is `handoffId`;
// the file `skip` is not looked at. A file that is not JSON is skipped (handoffs-check
// shows it); a file that cannot be read stops the search (an incomplete search is never
// a "no").
export function findHandoffId(root, handoffId, skip = null) {
  const walk = (rel) => {
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
    } catch (err) {
      if (!isOsError(err)) throw err;
      if (err.code === "ENOENT") return null;
      throw ioError("обход", rel, err, "handoff не создан");
    }
    entries.sort((a, b) => byBytes(a.name, b.name));
    for (const entry of entries) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        const hit = walk(child);
        if (hit !== null) return hit;
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".json") || child === skip)
        continue;
      let text;
      try {
        const abs = path.join(root, child);
        if (fs.lstatSync(abs).size > MAX_JSON_BYTES) continue;
        text = fs.readFileSync(abs, "utf8");
      } catch (err) {
        if (!isOsError(err)) throw err;
        if (err.code === "ENOENT") continue;
        throw ioError("чтение", child, err, "handoff не создан");
      }
      let doc;
      try {
        doc = JSON.parse(text);
      } catch {
        continue;
      }
      if (
        doc !== null &&
        typeof doc === "object" &&
        !Array.isArray(doc) &&
        doc.handoff_id === handoffId
      )
        return child;
    }
    return null;
  };
  return walk("handoffs");
}

// Before the first write: the folders are real folders, the name and the temporary name
// are free, the identifier is new. Nothing is changed.
export function preflight(root, rel, handoffId) {
  const parts = rel.split("/");
  for (const n of [1, 2]) {
    const folder = parts.slice(0, n).join("/");
    const stat = entryAt(root, folder);
    if (stat !== null && !stat.isDirectory())
      throw new HandoffError(
        "E_HO_IO",
        `${folder} не папка (ссылка или файл); handoff не создан`,
        2,
      );
  }
  if (entryAt(root, rel) !== null)
    throw new HandoffError(
      "E_HO_EXISTS",
      `файл уже есть: ${rel}; handoff-ы не перезаписываются`,
      1,
    );
  busyCheck(root, rel);
  const other = findHandoffId(root, handoffId);
  if (other !== null)
    throw new HandoffError(
      "E_HO_EXISTS",
      `handoff_id уже есть в файле ${other}; handoff-ы не повторяются`,
      1,
    );
}

function busyCheck(root, rel) {
  const tmp = tmpRelOf(rel);
  if (entryAt(root, tmp) !== null)
    throw new HandoffError(
      "E_HO_BUSY",
      `остался временный файл ${tmp} от прерванной или параллельной записи; handoff не создан; если параллельной записи нет, удалите его`,
      1,
    );
}

// Creates `rel` with `text`, or leaves nothing of its own. Throws HandoffError.
export function createExclusive(root, rel, text, handoffId) {
  const parts = rel.split("/");
  const tmpRel = tmpRelOf(rel);
  const abs = (r) => path.join(root, r);
  const madeFolders = [];
  let ownTmp = false;

  // The cleanup of every outcome but success: the own temporary file, then the folders
  // made by this run, from the inner one, while they are empty.
  const cleanup = () => {
    const left = [];
    if (ownTmp) {
      try {
        fs.unlinkSync(abs(tmpRel));
      } catch (err) {
        if (!isOsError(err)) throw err;
        if (err.code !== "ENOENT") left.push(tmpRel);
      }
    }
    for (const folder of [...madeFolders].reverse()) {
      try {
        fs.rmdirSync(abs(folder));
      } catch (err) {
        if (!isOsError(err)) throw err;
        if (err.code !== "ENOTEMPTY" && err.code !== "ENOENT")
          left.push(folder);
      }
    }
    return left;
  };
  const fail = (error) => {
    const left = cleanup();
    if (left.length === 0) throw error;
    throw new HandoffError(
      "E_HO_IO",
      `${error.message}; остался ${left.join(", ")}`,
      2,
    );
  };
  const removeFinal = () => {
    try {
      fs.unlinkSync(abs(rel));
      return true;
    } catch (err) {
      if (!isOsError(err)) throw err;
      return err.code === "ENOENT";
    }
  };

  try {
    // 1. The folders: "exists" is a normal course, another run may have made it.
    for (const n of [1, 2]) {
      const folder = parts.slice(0, n).join("/");
      try {
        fs.mkdirSync(abs(folder));
        madeFolders.push(folder);
      } catch (err) {
        if (!isOsError(err)) throw err;
        if (err.code !== "EEXIST")
          throw ioError("создание папки", folder, err, "handoff не создан");
        const stat = entryAt(root, folder);
        if (stat === null || !stat.isDirectory())
          throw new HandoffError(
            "E_HO_IO",
            `${folder} не папка (ссылка или файл); handoff не создан`,
            2,
          );
      }
    }
    // 2. The temporary file, exclusively and flushed.
    try {
      fs.writeFileSync(abs(tmpRel), Buffer.from(text, "utf8"), {
        flag: "wx",
        flush: true,
        mode: 0o644,
      });
      ownTmp = true;
    } catch (err) {
      if (!isOsError(err)) throw err;
      if (err.code === "EEXIST")
        throw new HandoffError(
          "E_HO_BUSY",
          `остался временный файл ${tmpRel} от прерванной или параллельной записи; handoff не создан; если параллельной записи нет, удалите его`,
          1,
        );
      if (err.code === "ENOENT")
        throw new HandoffError(
          "E_HO_IO",
          "папка прогона исчезла во время записи; повторите вызов",
          2,
        );
      ownTmp = true;
      throw ioError(
        "запись временного файла",
        tmpRel,
        err,
        "handoff не создан",
      );
    }
    // 3. The name is taken by a hard link.
    try {
      fs.linkSync(abs(tmpRel), abs(rel));
    } catch (err) {
      if (!isOsError(err)) throw err;
      if (err.code === "EEXIST") {
        try {
          fs.unlinkSync(abs(tmpRel));
          ownTmp = false;
        } catch (inner) {
          if (!isOsError(inner)) throw inner;
          ownTmp = false;
          throw new HandoffError(
            "E_HO_IO",
            `файл уже есть, но временный файл не удалён: ${tmpRel}; удалите его вручную`,
            2,
          );
        }
        throw new HandoffError(
          "E_HO_EXISTS",
          `файл уже есть: ${rel}; handoff-ы не перезаписываются`,
          1,
        );
      }
      if (NO_LINKS.has(err.code))
        throw ioError(
          "жёсткая ссылка",
          rel,
          err,
          "файловая система не умеет жёсткие ссылки; handoff не создан",
        );
      throw ioError("создание файла", rel, err, "handoff не создан");
    }
    // 4. The second search of the identifier: the own link is dropped when it is not the
    // only one, or when the search itself failed.
    let other;
    try {
      other = findHandoffId(root, handoffId, rel);
    } catch (err) {
      if (!(err instanceof HandoffError)) throw err;
      const code =
        /\((E[A-Z0-9]+)\)/u.exec(err.message)?.[1] ?? "код не определён";
      if (!removeFinal())
        throw new HandoffError(
          "E_HO_IO",
          `повторный поиск handoff_id не удался (${code}); файл ${rel} создан, но не подтверждён; удалите его вручную`,
          2,
        );
      throw new HandoffError(
        "E_HO_IO",
        `повторный поиск handoff_id не удался (${code}); handoff не создан`,
        2,
      );
    }
    if (other !== null) {
      if (!removeFinal())
        throw new HandoffError(
          "E_HO_IO",
          `handoff_id уже есть в файле ${other}; файл ${rel} создан, но не подтверждён; удалите его вручную`,
          2,
        );
      throw new HandoffError(
        "E_HO_EXISTS",
        `handoff_id уже есть в файле ${other}; handoff-ы не повторяются`,
        1,
      );
    }
  } catch (err) {
    if (err instanceof HandoffError) return fail(err);
    cleanup();
    throw err;
  }
  // 5. The temporary file goes; if it stays, the file is made but the exit is 2.
  try {
    fs.unlinkSync(abs(tmpRel));
  } catch (err) {
    if (!isOsError(err)) throw err;
    if (err.code !== "ENOENT")
      throw new HandoffError(
        "E_HO_IO",
        `файл создан (${rel}, ${handoffId}), но временный файл не удалён: ${tmpRel}`,
        2,
      );
  }
}
