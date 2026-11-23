// The data folder of Sai Team and the folder of a project (design REQ-009, sections
// 2 and 7.1): where the data lives, the allowed entries of a project folder, the
// modes 0700/0600 and the path of a project by its id.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TeamError, fromOsError, notFoundError } from "./errors.js";
import { PATTERNS } from "./schema.js";

export const EVENTS_FILE = "events.jsonl";
export const FILES_DIR = "files";
export const WORK_DIR = "work";
export const SCENARIO_FILE = "scenario.json";
export const LOCK_FILE = "writer.lock";
// (r13) the channel of the engine of REQ-013 (decisions/0020); only
// engine/channel.js works inside it.
export const INBOX_DIR = "inbox";

// The allowed entries of a project folder (N10). Permanent: events.jsonl, files/,
// work/, scenario.json (scripted only), writer.lock (only while the right to write
// is taken), inbox/ (created by the engine of REQ-013; its taken/ and ack/ and
// their files are checked by engine/channel.js). Temporary leftovers of a crash, removed by the next writer: the
// temporary lock file and the stale lock in the moment of its removal.
export const PROJECT_ENTRIES = Object.freeze([
  Object.freeze({
    name: EVENTS_FILE,
    kind: "file",
    mode: 0o600,
    when: "always",
    temporary: false,
  }),
  Object.freeze({
    name: FILES_DIR,
    kind: "dir",
    mode: 0o700,
    when: "always",
    temporary: false,
  }),
  Object.freeze({
    name: WORK_DIR,
    kind: "dir",
    mode: 0o700,
    when: "always",
    temporary: false,
  }),
  Object.freeze({
    name: SCENARIO_FILE,
    kind: "file",
    mode: 0o600,
    when: "scripted",
    temporary: false,
  }),
  Object.freeze({
    name: LOCK_FILE,
    kind: "file",
    mode: 0o600,
    when: "writer",
    temporary: false,
  }),
  Object.freeze({
    name: INBOX_DIR,
    kind: "dir",
    mode: 0o700,
    when: "engine",
    temporary: false,
  }),
  Object.freeze({
    pattern: /^writer\.lock\.[0-9]+\.new$/,
    kind: "file",
    mode: 0o600,
    when: "crash",
    temporary: true,
  }),
  Object.freeze({
    pattern: /^writer\.lock\.stale-[0-9]+$/,
    kind: "file",
    mode: 0o600,
    when: "crash",
    temporary: true,
  }),
]);

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

function homeError(what) {
  return new TeamError("E_HOME", `Папка данных Sai Team недоступна: ${what}`);
}

function ownUid() {
  return typeof process.getuid === "function" ? process.getuid() : null;
}

function isOwn(st) {
  const uid = ownUid();
  return uid === null || st.uid === uid;
}

function lstatOrNull(p, fsImpl = fs) {
  try {
    return fsImpl.lstatSync(p);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// The data folder: SAI_TEAM_HOME when set (an absolute path only), otherwise
// <home folder>/.sai-team.
export function resolveHome(env = process.env) {
  const value = env.SAI_TEAM_HOME;
  if (value !== undefined) {
    if (typeof value !== "string" || value === "" || !path.isAbsolute(value)) {
      throw homeError("SAI_TEAM_HOME должна быть абсолютным путём");
    }
    if (value.includes("\0")) throw homeError("недопустимый путь");
    return path.resolve(value);
  }
  let dir;
  try {
    dir = os.homedir();
  } catch {
    dir = "";
  }
  if (typeof dir !== "string" || dir === "" || !path.isAbsolute(dir)) {
    throw homeError("домашняя папка не найдена");
  }
  return path.join(dir, ".sai-team");
}

function checkHomeStat(st) {
  if (st.isSymbolicLink()) throw homeError("это символьная ссылка");
  if (!st.isDirectory()) throw homeError("это не папка");
  if (!isOwn(st)) throw homeError("владелец — другой пользователь");
}

function wider(st, allowed) {
  return (st.mode & 0o777 & ~allowed) !== 0;
}

function modeText(mode) {
  return (mode & 0o777).toString(8).padStart(4, "0");
}

// For createProject: creates <HOME> (0700) or narrows its mode. Returns notices.
// After a narrowing the mode is read again; a mode that did not hold is a refusal
// (ISS-0132), never a notice. `fsImpl` gives lstatSync, mkdirSync and chmodSync.
export function ensureHome(home, fsImpl = fs) {
  const notices = [];
  let st;
  try {
    st = lstatOrNull(home, fsImpl);
    if (st === null) {
      fsImpl.mkdirSync(home, { recursive: true, mode: DIR_MODE });
      st = fsImpl.lstatSync(home);
    }
  } catch (err) {
    throw homeError(err && typeof err.code === "string" ? err.code : "EIO");
  }
  checkHomeStat(st);
  if (wider(st, DIR_MODE)) {
    let after;
    try {
      fsImpl.chmodSync(home, DIR_MODE);
      after = fsImpl.lstatSync(home);
    } catch (err) {
      throw fromOsError(err, "write");
    }
    if (wider(after, DIR_MODE)) {
      throw homeError(
        `права 0700 не установились (сейчас ${modeText(after.mode)})`,
      );
    }
    notices.push(
      `Права папки данных сужены до 0700 (были ${modeText(st.mode)})`,
    );
  }
  return notices;
}

// For readers: never changes anything. { exists, warnings }.
export function inspectHome(home) {
  let st;
  try {
    st = lstatOrNull(home);
  } catch (err) {
    throw homeError(err && typeof err.code === "string" ? err.code : "EIO");
  }
  if (st === null) return { exists: false, warnings: [] };
  checkHomeStat(st);
  const warnings = [];
  if (wider(st, DIR_MODE)) {
    warnings.push(`Права папки данных шире 0700: ${modeText(st.mode)}`);
  }
  return { exists: true, warnings };
}

// The folder of a project by its id (section 7.1). The id is checked against the
// pattern before any access to files; every other refusal is the same "not found".
export function resolveProjectDir(home, id) {
  if (typeof id !== "string" || !PATTERNS.project.test(id)) {
    throw notFoundError();
  }
  const dir = path.join(home, id);
  let st;
  let events;
  try {
    st = fs.lstatSync(dir);
    if (!st.isDirectory() || st.isSymbolicLink() || !isOwn(st)) {
      throw notFoundError();
    }
    events = fs.lstatSync(path.join(dir, EVENTS_FILE));
  } catch (err) {
    if (err instanceof TeamError) throw err;
    if (err.code === "ENOENT" || err.code === "ENOTDIR") throw notFoundError();
    throw fromOsError(err, "read");
  }
  if (!events.isFile() || events.size === 0 || !isOwn(events)) {
    throw notFoundError();
  }
  return dir;
}

// The entries of a project folder whose modes the core keeps: [relative, kind].
function ownedEntries(projectDir) {
  const out = [
    [".", "dir"],
    [FILES_DIR, "dir"],
    [WORK_DIR, "dir"],
    [EVENTS_FILE, "file"],
    [SCENARIO_FILE, "file"],
    [LOCK_FILE, "file"],
    [INBOX_DIR, "dir"],
  ];
  let names = [];
  try {
    names = fs.readdirSync(path.join(projectDir, FILES_DIR));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  for (const name of names.sort()) out.push([`${FILES_DIR}/${name}`, "file"]);
  return out;
}

function modeProblems(projectDir) {
  const problems = [];
  const home = path.dirname(projectDir);
  const hs = fs.lstatSync(home);
  if (hs.isDirectory() && wider(hs, DIR_MODE)) {
    problems.push({
      abs: home,
      label: "папка данных",
      mode: hs.mode,
      want: DIR_MODE,
    });
  }
  for (const [rel, kind] of ownedEntries(projectDir)) {
    const abs = path.join(projectDir, rel);
    const st = lstatOrNull(abs);
    if (st === null || st.isSymbolicLink()) continue;
    if (kind === "dir" ? !st.isDirectory() : !st.isFile()) continue;
    const want = kind === "dir" ? DIR_MODE : FILE_MODE;
    if (wider(st, want)) {
      const label =
        rel === "."
          ? "папка проекта"
          : `${kind === "dir" ? "папка" : "файл"} ${rel}`;
      problems.push({ abs, label, mode: st.mode, want });
    }
  }
  return problems;
}

// For the writer, after the lock is taken and the journal checked (F11): narrows
// the modes of <HOME>, the project folder, files/, work/, inbox/ and the files of the core
// (not the content of work/). Returns notices.
export function ensureModes(projectDir) {
  const notices = [];
  try {
    for (const p of modeProblems(projectDir)) {
      fs.chmodSync(p.abs, p.want);
      notices.push(
        `Права сужены до ${modeText(p.want)}: ${p.label} (были ${modeText(p.mode)})`,
      );
    }
  } catch (err) {
    throw fromOsError(err, "write");
  }
  return notices;
}

// For readers: the same check without changes, as warnings.
export function modeWarnings(projectDir) {
  try {
    return modeProblems(projectDir).map((p) =>
      p.label === "папка данных"
        ? `Права папки данных шире 0700: ${modeText(p.mode)}`
        : `Права шире ${modeText(p.want)}: ${p.label} (${modeText(p.mode)})`,
    );
  } catch (err) {
    throw fromOsError(err, "read");
  }
}
