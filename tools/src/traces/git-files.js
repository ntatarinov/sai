// The root of the repository and the list of its files, both from git (design REQ-014,
// 4; decisions/0021, D1). The only place of tools/src/traces/ with child_process: two
// calls of git with fixed arguments, no command interpreter, 30 s each, with
// core.fsmonitor off so that no program named in a git configuration runs (r3). The
// stderr of git is never printed: it has absolute paths.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { TraceError, decodeUtf8 } from "./lists.js";

const OPTIONS = {
  timeout: 30_000,
  maxBuffer: 64 * 1024 * 1024,
  stdio: ["ignore", "pipe", "pipe"],
  encoding: "buffer",
};

const NOT_GIT =
  "это не git-репозиторий: команда проверяет файлы, которые отслеживает git; запустите её в клоне Sai";

// A failed call of git into the error of the command; a program error passes through.
function gitFailure(err) {
  if (err === null || typeof err !== "object") return err;
  if (err.code === "ENOENT")
    return new TraceError("E_TRACE_GIT", "git не найден");
  if (err.code === "ETIMEDOUT")
    return new TraceError("E_TRACE_GIT", "git не ответил за 30 с");
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

function utf8(bytes) {
  const text = decodeUtf8(bytes);
  if (text === null)
    throw new TraceError("E_TRACE_GIT", "вывод git не в UTF-8");
  return text;
}

export function repoRoot(startDir) {
  let isDir = false;
  try {
    isDir = fs.statSync(startDir).isDirectory();
  } catch (err) {
    if (typeof err?.code !== "string") throw err;
  }
  if (!isDir) throw new TraceError("E_TRACE_USAGE", "папки --root нет");
  let out;
  try {
    out = execFileSync(
      "git",
      [
        "-c",
        "core.fsmonitor=false",
        "-C",
        startDir,
        "rev-parse",
        "--show-toplevel",
      ],
      OPTIONS,
    );
  } catch (err) {
    throw gitFailure(err);
  }
  const root = utf8(out).replace(/\n$/u, "");
  if (root === "") throw new TraceError("E_TRACE_NOT_GIT", NOT_GIT);
  return root;
}

// Paths from the root, "/"-separated, without repeats, sorted by their UTF-8 bytes.
export function listRepoFiles(root) {
  let out;
  try {
    out = execFileSync(
      "git",
      [
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.quotePath=false",
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
      ],
      { ...OPTIONS, cwd: root },
    );
  } catch (err) {
    throw gitFailure(err);
  }
  const paths = new Set(utf8(out).split("\0"));
  paths.delete("");
  return [...paths].sort((a, b) =>
    Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")),
  );
}
