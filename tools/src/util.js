import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export class UsageError extends Error {}

export class Issues {
  constructor() {
    this.list = [];
  }
  add(code, file, message) {
    this.list.push({ code, file, message });
  }
  get empty() {
    return this.list.length === 0;
  }
  codes() {
    return this.list.map((i) => i.code);
  }
}

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function normalizeWs(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

export function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function readJson(file, issues, label) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    issues.add("E_JSON", label, "file is missing or unreadable");
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    issues.add("E_JSON", label, `invalid JSON: ${err.message}`);
    return undefined;
  }
}

// Missing, not a regular file, or unreadable all mean "no usable text" to the callers.
export function readTextFile(file) {
  try {
    if (!fs.statSync(file).isFile()) return undefined;
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function listFiles(root, skip) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (skip(rel, entry)) continue;
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) out.push(rel);
    }
  };
  walk(root);
  return out.sort();
}

// ---------------------------------------------------------------------------
// Write phase, all or nothing (ISS-0002; design §5.1-§5.7; decisions/0004).
//
// A target is never written in place. The new bytes go to `.<name>.sai-tmp` beside it
// (exclusive create, flushed to disk), the old file is kept as the hard link
// `.<name>.sai-old`, the renames run in the caller's order (the last one is the commit
// point), a failed rename rolls the earlier ones back from the hard links, and the
// links are removed at the end. Every fs call goes through the default `fs` object,
// never a destructured copy: the failure injection of the tests patches its methods
// (design §9.2). Paths are lexical (`path.join(root, rel)`), never `realpath`.
// ---------------------------------------------------------------------------

const TMP_SUFFIX = ".sai-tmp";
const OLD_SUFFIX = ".sai-old";
const LEFTOVER_HINT = "if no other command is running, delete and re-run";

const NOTHING_CHANGED = "nothing was changed";
const LEFTOVERS_LISTED = "no target was changed; leftovers are listed next";
const ROLLBACK_INCOMPLETE = "rollback incomplete; see the next lines";

// Node describes operating-system errors of `fs` with a string `code` and `syscall`.
// Only those become E_WRITE lines. Any other exception is a program error: rollback
// and cleanup run, then it is rethrown unchanged, with its stack trace (design §5.3,
// Q6). No catch in this section turns it into E_WRITE or drops it.
export function isOsError(err) {
  return (
    err !== null &&
    typeof err === "object" &&
    typeof err.code === "string" &&
    typeof err.syscall === "string"
  );
}

// A handled failure; becomes one E_WRITE line (design §5.6). `file` is a path from the
// root, "/"-separated.
class WriteFailure extends Error {
  constructor(file, reason, osCode, leftover = false) {
    super(reason);
    this.file = file;
    this.reason = reason;
    this.osCode = osCode;
    this.leftover = leftover;
  }
}

function addFailure(issues, failure, outcome) {
  const hint = failure.leftover ? `; ${LEFTOVER_HINT}` : "";
  issues.add(
    "E_WRITE",
    failure.file,
    `${failure.reason} (${failure.osCode}); ${outcome}${hint}`,
  );
}

function leftoverFailure(file, found) {
  const reason = `leftover ${found.join(", ")} from an interrupted or concurrent run`;
  return new WriteFailure(file, reason, "EEXIST", true);
}

// An OS error of one fs call becomes the failure `fail(err)` builds; a program error
// passes through unchanged.
function osCall(call, fail) {
  try {
    return call();
  } catch (err) {
    throw isOsError(err) ? fail(err) : err;
  }
}

// An OS error of one fs call is returned instead of thrown; a program error still throws.
function osError(call) {
  try {
    call();
    return undefined;
  } catch (err) {
    if (isOsError(err)) return err;
    throw err;
  }
}

// Failure of an exclusive create (`wx`, `link`, `mkdir`): EEXIST means the name was
// taken by a leftover or a concurrent run, so it is reported as such and left alone.
function refused(err, file, reason, taken) {
  if (!isOsError(err)) return err;
  if (err.code === "EEXIST" && taken !== undefined)
    return leftoverFailure(file, [taken]);
  return new WriteFailure(file, reason, err.code);
}

// `.<name>.sai-tmp` / `.<name>.sai-old` beside `rel` (design §5.5).
function siblingRel(rel, suffix) {
  const dir = path.posix.dirname(rel);
  const name = `.${path.posix.basename(rel)}${suffix}`;
  return dir === "." ? name : `${dir}/${name}`;
}

// lstat without following links. No entry is `undefined`; any other OS error is the
// violation "cannot be checked" (design §5.3: ENOENT means "no entry", nothing else does).
function entryAt(root, rel) {
  try {
    return fs.lstatSync(path.join(root, rel));
  } catch (err) {
    if (isOsError(err) && err.code === "ENOENT") return undefined;
    throw isOsError(err)
      ? new WriteFailure(rel, "cannot be checked", err.code)
      : err;
  }
}

function exists(abs) {
  try {
    fs.lstatSync(abs);
    return true;
  } catch (err) {
    if (isOsError(err)) return err.code !== "ENOENT";
    throw err;
  }
}

// unlink; "already gone" counts as removed. Returns the OS error otherwise.
function removeEntry(abs) {
  const err = osError(() => fs.unlinkSync(abs));
  return err?.code === "ENOENT" ? undefined : err;
}

function planOf(root, target, index) {
  const tmpRel = siblingRel(target.rel, TMP_SUFFIX);
  const oldRel = siblingRel(target.rel, OLD_SUFFIX);
  return {
    index,
    rel: target.rel,
    abs: path.join(root, target.rel),
    content: target.content,
    bytes: Buffer.from(target.content, "utf8"),
    tmpRel,
    tmpAbs: path.join(root, tmpRel),
    oldRel,
    oldAbs: path.join(root, oldRel),
    existed: false,
    mode: 0,
    changes: true,
    tmpEntry: undefined,
    oldEntry: undefined,
  };
}

// What this run created and still holds, in creation order, and the targets whose
// rename already happened. Rollback and cleanup touch only this (design §5.3).
class Journal {
  created = [];
  replaced = [];

  track(kind, plan, rel, abs) {
    const entry = { kind, plan, rel, abs };
    this.created.push(entry);
    return entry;
  }

  forget(entry) {
    this.created = this.created.filter((e) => e !== entry);
  }
}

// W1 (design §5.3): nothing on disk changes. Throws the first violation of the target.
function inspect(root, plan) {
  // W1.1: no symbolic link on the way to the target.
  const folders = plan.rel.split("/").slice(0, -1);
  for (let i = 1; i <= folders.length; i++) {
    const folder = folders.slice(0, i).join("/");
    if (entryAt(root, folder)?.isSymbolicLink()) {
      throw new WriteFailure(
        plan.rel,
        `folder ${folder} is a symbolic link`,
        "ELOOP",
      );
    }
  }
  // W1.2: the target itself, judged before it is read, so a pipe cannot hang the read.
  const stat = entryAt(root, plan.rel);
  if (stat?.isDirectory())
    throw new WriteFailure(plan.rel, "is a folder", "EISDIR");
  if (stat?.isSymbolicLink())
    throw new WriteFailure(plan.rel, "is a symbolic link", "ELOOP");
  if (stat && !stat.isFile())
    throw new WriteFailure(plan.rel, "is not a regular file", "EINVAL");
  // W1.3: no leftover of an interrupted or concurrent run, also beside unchanged targets.
  const leftovers = [plan.tmpRel, plan.oldRel].filter((rel) =>
    entryAt(root, rel),
  );
  if (leftovers.length > 0) throw leftoverFailure(plan.rel, leftovers);
  if (stat === undefined) return;
  plan.existed = true;
  // W1.4: the bytes decide whether the target changes at all.
  const current = osCall(
    () => fs.readFileSync(plan.abs),
    (err) =>
      new WriteFailure(plan.rel, "cannot be read for comparison", err.code),
  );
  // W1.5: an unchanged target takes no further part.
  if (current.equals(plan.bytes)) {
    plan.changes = false;
    return;
  }
  // W1.6: a target that must change has to be writable (replacing it would bypass that).
  osCall(
    () => fs.accessSync(plan.abs, fs.constants.W_OK),
    (err) =>
      new WriteFailure(plan.rel, "is read-only and must change", err.code),
  );
  plan.mode = stat.mode & 0o777;
}

// W2: the new bytes beside the target, then the old file as a hard link.
function stage(plan, journal) {
  plan.tmpEntry = journal.track("tmp", plan, plan.tmpRel, plan.tmpAbs);
  try {
    // No `encoding` in these options, on purpose: with `encoding: "utf8"` Node 22.21.1
    // takes a fast path that ignores `flush`, so fs.fsyncSync is silently not called.
    fs.writeFileSync(plan.tmpAbs, plan.content, { flag: "wx", flush: true });
  } catch (err) {
    // Not ours when the exclusive create met an existing name; otherwise a partial
    // file may be there, and then it is ours to remove.
    const foreign = isOsError(err) && err.code === "EEXIST";
    if (foreign || !exists(plan.tmpAbs)) journal.forget(plan.tmpEntry);
    throw refused(
      err,
      plan.rel,
      `cannot write the temporary file ${plan.tmpRel}`,
      plan.tmpRel,
    );
  }
  if (!plan.existed) return;
  osCall(
    () => fs.chmodSync(plan.tmpAbs, plan.mode),
    (err) =>
      new WriteFailure(
        plan.rel,
        `cannot copy the permissions to ${plan.tmpRel}`,
        err.code,
      ),
  );
  try {
    fs.linkSync(plan.abs, plan.oldAbs);
  } catch (err) {
    throw refused(
      err,
      plan.rel,
      `cannot keep the old version as ${plan.oldRel}`,
      plan.oldRel,
    );
  }
  plan.oldEntry = journal.track("old", plan, plan.oldRel, plan.oldAbs);
}

// W3: the rename that makes the new file the target.
function commit(plan, journal) {
  osCall(
    () => fs.renameSync(plan.tmpAbs, plan.abs),
    (err) => new WriteFailure(plan.rel, "cannot be replaced", err.code),
  );
  journal.forget(plan.tmpEntry);
  journal.replaced.push(plan);
}

const REMOVAL_FAILED = {
  tmp: "could not remove this temporary file",
  old: "could not remove this backup of the old version",
};

// Rolls the replaced targets back, newest first, then removes what this run created.
// What cannot be undone gets an extra line, in target order (design §5.6).
function undo(journal) {
  const extras = [];
  let restored = 0;
  let rollbackFailed = false;
  let cleanupFailed = false;
  for (const plan of [...journal.replaced].reverse()) {
    const err = plan.existed
      ? osError(() => fs.renameSync(plan.oldAbs, plan.abs))
      : removeEntry(plan.abs);
    // The backup is consumed by a rollback; after a failed one it is the only handle
    // on the old content, so cleanup must leave it.
    if (plan.existed) journal.forget(plan.oldEntry);
    if (err === undefined) {
      restored++;
      continue;
    }
    rollbackFailed = true;
    const where = plan.existed
      ? `it holds the new content, the old content is in ${plan.oldRel}`
      : "it was created by this run and is still there";
    extras.push({
      index: plan.index,
      rank: 0,
      file: plan.rel,
      text: `rollback failed (${err.code}); ${where}`,
    });
  }
  for (const entry of [...journal.created].reverse()) {
    const err = removeEntry(entry.abs);
    if (err === undefined) continue;
    cleanupFailed = true;
    extras.push({
      index: entry.plan.index,
      rank: entry.kind === "tmp" ? 1 : 2,
      file: entry.rel,
      text: `${REMOVAL_FAILED[entry.kind]} (${err.code}); delete it by hand`,
    });
  }
  journal.created = [];
  extras.sort((a, b) => a.index - b.index || a.rank - b.rank);
  const outcome = rollbackFailed
    ? ROLLBACK_INCOMPLETE
    : cleanupFailed
      ? LEFTOVERS_LISTED
      : NOTHING_CHANGED;
  return { restored, extras, outcome };
}

// Replaces or creates every target, or none (design §5.3; the order of `targets` is the
// commit order, the last one is the commit point). `targets`: `{ rel, content }` with
// `rel` from `root`, "/"-separated; its folder exists; all targets lie inside `root`.
// A handled failure adds only E_WRITE lines to `issues`. Returns how many targets now
// hold new content (0: nothing changed on disk, also when every target was already
// up to date). Throws only a program error, after rollback and cleanup.
export function writeAllOrNothing(root, targets, issues) {
  const plans = targets.map((target, index) => planOf(root, target, index));

  const violations = [];
  for (const plan of plans) {
    try {
      inspect(root, plan);
    } catch (err) {
      if (!(err instanceof WriteFailure)) throw err;
      violations.push(err);
    }
  }
  if (violations.length > 0) {
    for (const violation of violations)
      addFailure(issues, violation, NOTHING_CHANGED);
    return 0;
  }
  const changing = plans.filter((plan) => plan.changes);
  if (changing.length === 0) return 0;

  const journal = new Journal();
  try {
    for (const plan of changing) stage(plan, journal);
    for (const plan of changing) commit(plan, journal);
  } catch (err) {
    const undone = undo(journal);
    if (!(err instanceof WriteFailure)) throw err;
    addFailure(issues, err, undone.outcome);
    for (const extra of undone.extras)
      issues.add("E_WRITE", extra.file, extra.text);
    return journal.replaced.length - undone.restored;
  }

  // W4: the new state is in place; only the backups are left to remove.
  for (const entry of journal.created) {
    const err = removeEntry(entry.abs);
    if (err !== undefined) {
      issues.add(
        "E_WRITE",
        entry.rel,
        `applied, but this backup of the old version could not be removed (${err.code}); delete it by hand`,
      );
    }
  }
  return changing.length;
}

// Creates the new folder `rel` (from `root`) with `files` (`{ rel, content }` from the
// new folder, in writing order), or nothing: it is built under a temporary name beside
// its topmost missing folder (`runs/<id>`, or `runs` itself when that is missing) and
// moved into place with one rename (design §5.3, P1-P4). Nothing exists at `rel` yet.
// Returns true when the folder was created; false with E_WRITE lines in `issues`.
// Throws only a program error, after cleanup.
export function createFolderAllOrNothing(root, rel, files, issues) {
  const segments = rel.split("/");
  let top = segments.length;
  let topRel;
  let tmpRel;
  try {
    // P1: the folders above `rel` are real folders; the first missing one is the top.
    for (let i = 1; i < segments.length; i++) {
      const folder = segments.slice(0, i).join("/");
      const stat = entryAt(root, folder);
      if (stat === undefined) {
        top = i;
        break;
      }
      if (stat.isSymbolicLink())
        throw new WriteFailure(folder, "is a symbolic link", "ELOOP");
      if (!stat.isDirectory())
        throw new WriteFailure(folder, "is not a folder", "ENOTDIR");
    }
    topRel = segments.slice(0, top).join("/");
    tmpRel = siblingRel(topRel, TMP_SUFFIX);
    if (entryAt(root, tmpRel)) throw leftoverFailure(topRel, [tmpRel]);
  } catch (err) {
    if (!(err instanceof WriteFailure)) throw err;
    addFailure(issues, err, NOTHING_CHANGED);
    return false;
  }

  const tmpAbs = path.join(root, tmpRel);
  const inside = path.join(tmpAbs, ...segments.slice(top));
  let made = false;
  try {
    // P2: the temporary folder (not recursive: a taken name is a leftover), then files.
    try {
      fs.mkdirSync(tmpAbs);
    } catch (err) {
      throw refused(
        err,
        topRel,
        `cannot create the temporary folder ${tmpRel}`,
        tmpRel,
      );
    }
    made = true;
    for (const file of files) {
      const finalRel = `${rel}/${file.rel}`;
      const abs = path.join(inside, file.rel);
      osCall(
        () => fs.mkdirSync(path.dirname(abs), { recursive: true }),
        (err) =>
          new WriteFailure(
            path.posix.dirname(finalRel),
            "cannot create the folder",
            err.code,
          ),
      );
      // No `encoding` here either (see stage()): it would silently turn the fsync of
      // `flush: true` off.
      osCall(
        () => fs.writeFileSync(abs, file.content, { flag: "wx", flush: true }),
        (err) => new WriteFailure(finalRel, "cannot write", err.code),
      );
    }
    // P3: the one rename that makes the folder appear, whole.
    osCall(
      () => fs.renameSync(tmpAbs, path.join(root, topRel)),
      (err) => new WriteFailure(topRel, "cannot be moved into place", err.code),
    );
  } catch (err) {
    // P4
    const stuck = made
      ? osError(() => fs.rmSync(tmpAbs, { recursive: true, force: true }))
      : undefined;
    if (!(err instanceof WriteFailure)) throw err;
    addFailure(issues, err, stuck ? LEFTOVERS_LISTED : NOTHING_CHANGED);
    if (stuck) {
      issues.add(
        "E_WRITE",
        tmpRel,
        `could not remove this temporary folder (${stuck.code}); delete it by hand`,
      );
    }
    return false;
  }
  return true;
}
