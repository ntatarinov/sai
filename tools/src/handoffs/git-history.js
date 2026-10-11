// The only place of tools/src/handoffs/ that runs git (design REQ-038, 7;
// decisions/0038): five calls with fixed arguments, no command interpreter, 30 s each,
// with core.fsmonitor off so that no program named in a git configuration runs. The
// stderr of git is never printed. The texts of the failures are copied from
// traces/git-files.js, which does not export them; a test compares the two files.
import { execFileSync } from "node:child_process";
import { TraceError, decodeUtf8 } from "../traces/lists.js";

const TIMEOUT_MS = 30_000;
const MAX_BUFFER = 256 * 1024 * 1024;
const BATCH = 1000;
const FULL_SHA = /^[0-9a-f]{40}$/u;

const NOT_GIT =
  "это не git-репозиторий: команда проверяет файлы, которые отслеживает git; запустите её в клоне Sai";

// A failed call of git into the error of the command; a program error passes through.
function gitFailure(err) {
  if (err === null || typeof err !== "object") return err;
  if (err.code === "ENOENT")
    return new TraceError("E_TRACE_GIT", "git не найден");
  if (err.code === "ETIMEDOUT")
    return new TraceError("E_TRACE_GIT", "git не ответил за 30 с");
  if (err.code === "ENOBUFS")
    return new TraceError("E_TRACE_GIT", "вывод git слишком велик");
  if (err.status === 128) return new TraceError("E_TRACE_NOT_GIT", NOT_GIT);
  if (typeof err.status === "number")
    return new TraceError(
      "E_TRACE_GIT",
      `git не смог выполнить команду (код ${err.status})`,
    );
  if (typeof err.code === "string")
    return new TraceError("E_TRACE_GIT", `git не запустился (${err.code})`);
  return err;
}

function noCommits() {
  return new TraceError("E_HC_GIT", "в репозитории нет коммитов");
}

function utf8(bytes) {
  const text = decodeUtf8(bytes);
  if (text === null)
    throw new TraceError("E_TRACE_GIT", "вывод git не в UTF-8");
  return text;
}

function checkedSha(sha) {
  if (typeof sha !== "string" || !FULL_SHA.test(sha))
    throw new TraceError("E_HC_BASE_COMMIT", "хеш коммита — 40 знаков 0-9a-f");
  return sha;
}

export function isShallow(root, timeoutMs = TIMEOUT_MS) {
  let out;
  try {
    out = execFileSync(
      "git",
      ["-c", "core.fsmonitor=false", "rev-parse", "--is-shallow-repository"],
      {
        cwd: root,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "buffer",
      },
    );
  } catch (err) {
    throw gitFailure(err);
  }
  return utf8(out).trim() === "true";
}

// Status 1 of `rev-parse --verify --quiet` is the answer "no such commit".
export function commitExists(root, sha, timeoutMs = TIMEOUT_MS) {
  checkedSha(sha);
  try {
    execFileSync(
      "git",
      [
        "-c",
        "core.fsmonitor=false",
        "rev-parse",
        "--verify",
        "--quiet",
        sha + "^{commit}",
      ],
      {
        cwd: root,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "buffer",
      },
    );
  } catch (err) {
    if (err?.status === 1) return false;
    throw gitFailure(err);
  }
  return true;
}

// Status 1 of `merge-base --is-ancestor` is the answer "no".
export function isAncestorOfHead(root, sha, timeoutMs = TIMEOUT_MS) {
  checkedSha(sha);
  try {
    execFileSync(
      "git",
      [
        "-c",
        "core.fsmonitor=false",
        "merge-base",
        "--is-ancestor",
        sha,
        "HEAD",
      ],
      {
        cwd: root,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "buffer",
      },
    );
  } catch (err) {
    if (err?.status === 1) return false;
    if (err?.status === 128) throw noCommits();
    throw gitFailure(err);
  }
  return true;
}

// Seconds since the epoch of the committer time `%cI` (an offset is allowed).
function commitSeconds(text) {
  const ms = Date.parse(text);
  if (Number.isNaN(ms))
    throw new TraceError("E_TRACE_GIT", "вывод git не разобран");
  return Math.floor(ms / 1000);
}

// Map: path under handoffs/ -> commits that changed it, from the oldest to the newest,
// each { hash, time } with the committer time in seconds. The output is split at NUL: a
// token with the mark \x01 is a commit, the others are paths; one "\n" stands before the
// first path of a commit.
export function fileHistory(root, timeoutMs = TIMEOUT_MS) {
  let out;
  try {
    out = execFileSync(
      "git",
      [
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.quotePath=false",
        "log",
        "--reverse",
        "--no-renames",
        "-z",
        "--format=%x01%H %cI",
        "--name-only",
        "HEAD",
        "--",
        "handoffs",
      ],
      {
        cwd: root,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "buffer",
      },
    );
  } catch (err) {
    if (err?.status === 128) throw noCommits();
    throw gitFailure(err);
  }
  const history = new Map();
  let commit = null;
  let first = false;
  for (const token of utf8(out).split("\0")) {
    if (token.startsWith("\x01")) {
      const space = token.indexOf(" ");
      const hash = token.slice(1, space);
      if (space < 0 || !FULL_SHA.test(hash))
        throw new TraceError("E_TRACE_GIT", "вывод git не разобран");
      commit = { hash, time: commitSeconds(token.slice(space + 1)) };
      first = true;
      continue;
    }
    const rel = first && token.startsWith("\n") ? token.slice(1) : token;
    first = false;
    if (rel === "" || commit === null) continue;
    if (!history.has(rel)) history.set(rel, []);
    history.get(rel).push(commit);
  }
  return history;
}

// The run identifier as the command `handoff` writes it; a name of a tag is built only
// from a value that fits (design REQ-039, 6.3).
const RUN_ID = /^[A-Z][A-Z0-9]*(-[0-9]{3,4})?-[0-9]{8}-[0-9]{2}$/u;

// Whether the tag base/<RUN-ID> exists and points at a commit (light or annotated).
// Status 1 of `rev-parse --verify --quiet` is the answer "no" (also for a branch of the
// same name: the reference is refs/tags/...).
export function tagExists(root, runId, timeoutMs = TIMEOUT_MS) {
  if (typeof runId !== "string" || !RUN_ID.test(runId))
    throw new TraceError(
      "E_HO_BASE_TAG",
      "RUN-ID: ожидается <МЕТКА>-<ГГГГММДД>-<NN>",
    );
  const ref = "refs/tags/base/" + runId + "^{commit}";
  try {
    execFileSync(
      "git",
      ["-c", "core.fsmonitor=false", "rev-parse", "--verify", "--quiet", ref],
      {
        cwd: root,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "buffer",
      },
    );
  } catch (err) {
    if (err?.status === 1) return false;
    throw gitFailure(err);
  }
  return true;
}

// The answer of `cat-file --batch` for `count` requests: a Buffer for a blob, null for
// anything else (a missing object, a folder).
function parseBatch(out, count) {
  const bad = () => new TraceError("E_TRACE_GIT", "вывод git не разобран");
  const results = [];
  let pos = 0;
  for (let k = 0; k < count; k++) {
    const nl = out.indexOf(0x0a, pos);
    if (nl < 0) throw bad();
    const header = out.toString("utf8", pos, nl);
    pos = nl + 1;
    if (header.endsWith(" missing")) {
      results.push(null);
      continue;
    }
    const m = header.match(/^[0-9a-f]{40,64} (\S+) (\d+)$/u);
    if (m === null) throw bad();
    const size = Number(m[2]);
    if (pos + size > out.length) throw bad();
    results.push(m[1] === "blob" ? out.subarray(pos, pos + size) : null);
    pos += size + 1;
  }
  return results;
}

// The contents of `<rev>:<path>` for every spec, in the order of the specs: a Buffer or
// null. The specs go to the standard input of git, by batches. A name with a control
// character never gets here (the command stops on it before).
export function readBlobs(root, specs, timeoutMs = TIMEOUT_MS) {
  const results = [];
  for (let from = 0; from < specs.length; from += BATCH) {
    const part = specs.slice(from, from + BATCH);
    let out;
    try {
      out = execFileSync(
        "git",
        ["-c", "core.fsmonitor=false", "cat-file", "--batch"],
        {
          cwd: root,
          timeout: timeoutMs,
          maxBuffer: MAX_BUFFER,
          stdio: ["pipe", "pipe", "pipe"],
          input: Buffer.from(`${part.join("\n")}\n`, "utf8"),
          encoding: "buffer",
        },
      );
    } catch (err) {
      throw gitFailure(err);
    }
    results.push(...parseBatch(out, part.length));
  }
  return results;
}
