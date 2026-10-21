// Helpers of the tests of `npm run traces` (design REQ-014, 14.2). Not a test file.
// Every case gets its own temporary git repository; git and the command run with HOME
// and the git configuration inside the temporary folder, so nothing of the machine is
// read. The paths of home folders are put together from parts, so that this file is
// not a trace itself.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HASHES_HEADER } from "../../../src/traces/lists.js";

export const TOOLS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
export const SAI = path.resolve(TOOLS, "..");
export const CLI = path.join(TOOLS, "src", "traces", "cli.js");
export const HASHES_REL = "tools/traces/forbidden-names.sha256";
export const EXCEPTIONS_REL = "tools/traces/exceptions.tsv";
export const LOCK_REL = "tools/traces/.forbidden-names.sha256.lock";
export { HASHES_HEADER };

// "/Users/", "/home/", "-Users-", "-home-" from parts.
export const MAC = "/Us" + "ers/";
export const LINUX = "/ho" + "me/";
export const MAC_ENC = "-Us" + "ers-";
export const LINUX_ENC = "-ho" + "me-";

export const LABEL =
  /^<файл №(\d+), sha256 пути ([0-9a-f]{12})>: название из списка в имени файла$/u;

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

// A temporary folder (real path) removed after the test, with an environment that
// reads no configuration of the machine.
export function sandbox(t) {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "sai-traces-")),
  );
  t.after(() => {
    // A case may leave a file without permissions; give them back inside dir only.
    const walk = (p) => {
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) return;
      fs.chmodSync(p, st.isDirectory() ? 0o700 : 0o600);
      if (st.isDirectory())
        for (const e of fs.readdirSync(p)) walk(path.join(p, e));
    };
    walk(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const home = path.join(dir, "home");
  fs.mkdirSync(path.join(home, "xdg"), { recursive: true });
  const env = {
    PATH: process.env.PATH,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, "xdg"),
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CEILING_DIRECTORIES: dir,
    LANG: "C.UTF-8",
    // A recent git starts a background clean-up after a commit (git maintenance run
    // --auto --detach) that holds a lock file inside .git for a moment; a test that hashes
    // the whole tree would see the lock before and not after. The clean-up is switched off
    // for every git of the sandbox (design ISS-0075).
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "maintenance.auto",
    GIT_CONFIG_VALUE_0: "false",
    GIT_CONFIG_KEY_1: "gc.auto",
    GIT_CONFIG_VALUE_1: "0",
  };
  return { dir, env };
}

export function git(cwd, env, ...args) {
  const r = spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args],
    { cwd, env, encoding: "utf8" },
  );
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

// A temporary repository with the file of hashes (header only) and `files`
// ({ rel: string | Buffer }), all committed unless `untracked` names them.
export function makeRepo(
  t,
  files = {},
  { untracked = [], hashes = true } = {},
) {
  const sb = sandbox(t);
  const root = path.join(sb.dir, "repo");
  fs.mkdirSync(root);
  git(root, sb.env, "init", "-q");
  const repo = {
    root,
    dir: sb.dir,
    env: sb.env,
    write(rel, content) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      return abs;
    },
    commit() {
      git(root, sb.env, "add", "-A");
      git(root, sb.env, "commit", "-q", "--allow-empty", "-m", "c");
    },
    run(args = [], { input, env } = {}) {
      return runCli(args, { root, env: { ...sb.env, ...env }, input });
    },
    read(rel) {
      return fs.readFileSync(path.join(root, rel));
    },
    lsFiles() {
      return git(
        root,
        sb.env,
        "-c",
        "core.quotePath=false",
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
      )
        .split("\0")
        .filter((p) => p !== "");
    },
  };
  if (hashes) repo.write(HASHES_REL, `${HASHES_HEADER}\n`);
  for (const [rel, content] of Object.entries(files)) {
    if (!untracked.includes(rel)) repo.write(rel, content);
  }
  repo.commit();
  for (const rel of untracked) repo.write(rel, files[rel]);
  return repo;
}

// The command as a child process: `node cli.js <args> --root <root>`.
export function runCli(args, { root, env, input, cwd } = {}) {
  const full = root === undefined ? args : [...args, "--root", root];
  const r = spawnSync(process.execPath, [CLI, ...full], {
    cwd: cwd ?? TOOLS,
    env,
    input: input ?? "",
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// No stack trace and no "node:internal" in the error output.
export function assertNoStack(stderr) {
  assert.doesNotMatch(stderr, /\n\s+at /u, stderr);
  assert.doesNotMatch(stderr, /node:internal|Error:/u, stderr);
}

// Asserts one exact line in the output.
export function assertLine(stdout, line) {
  assert.ok(
    stdout.split("\n").includes(line),
    `no line "${line}" in:\n${stdout}`,
  );
}

// A pid that is not running: the pid of a child that has exited.
export function deadPid() {
  const r = spawnSync(
    process.execPath,
    ["-e", "process.stdout.write(String(process.pid))"],
    {
      encoding: "utf8",
    },
  );
  return Number(r.stdout);
}
