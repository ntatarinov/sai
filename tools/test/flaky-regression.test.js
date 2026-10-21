// FR-1 ... FR-6: regression tests of ISS-0075 - two tests that failed now and then, not
// because of the code but because of the way they looked at the world. FR-1 to FR-3: the
// listing of the files of a folder in which another process works must not fail when a
// name is gone between the listing and the look at it (EN-62 and the two copies of its
// function). FR-4 and FR-5: the git of the sandbox of the tests of the handoffs has its
// background clean-up switched off, so the hash of the tree does not see a lock file that
// comes and goes (HC-6a). The failures are made at once and the same way every time.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { git, sandbox } from "./fixtures/traces/helpers.js";
import { listFilesLive } from "./team-helpers.js";

function folder(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sai-flaky-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const abs = path.join(dir, name);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (content !== null) fs.writeFileSync(abs, content);
  }
  return dir;
}

test("FR-1: a name that is gone between the listing and the look at it is skipped - a sender that renames its temporary file at that moment does not make the listing fail", (t) => {
  const dir = folder(t, {
    "m-000000000001.json": "{}",
    ".tmp-1-aaaa": "x",
    "ack/m-000000000001.ack": "",
  });
  const real = fs.readdirSync;
  let removed = 0;
  t.mock.method(fs, "readdirSync", (target, ...rest) => {
    const names = real(target, ...rest);
    if (String(target) === dir) {
      fs.rmSync(path.join(dir, ".tmp-1-aaaa"));
      removed += 1;
    }
    return names;
  });
  let list;
  assert.doesNotThrow(() => {
    list = listFilesLive(dir);
  });
  assert.equal(removed, 1);
  assert.deepEqual(list, ["ack/m-000000000001.ack", "m-000000000001.json"]);
});

test("FR-2: a folder that is gone between the listing of its parent and its own listing is empty; a folder that is not there at all is empty", (t) => {
  const dir = folder(t, {
    "a.json": "{}",
    "taken/x.json": "{}",
    "ack/y.ack": "",
  });
  const real = fs.readdirSync;
  t.mock.method(fs, "readdirSync", (target, ...rest) => {
    const names = real(target, ...rest);
    if (String(target) === dir)
      fs.rmSync(path.join(dir, "taken"), { recursive: true });
    return names;
  });
  assert.deepEqual(listFilesLive(dir), ["a.json", "ack/y.ack"]);
  assert.deepEqual(listFilesLive(path.join(dir, "no-such-folder")), []);
});

test("FR-3: any other failure goes up - no right to look at a name, no right to list a folder, a name that is not a folder", (t) => {
  const dir = folder(t, { "a.json": "{}", "b/c.json": "{}" });
  const failure = (code) =>
    Object.assign(new Error(code), { code, syscall: "x" });
  const lstat = fs.lstatSync;
  t.mock.method(fs, "lstatSync", (target, ...rest) => {
    if (String(target).endsWith("a.json")) throw failure("EACCES");
    return lstat(target, ...rest);
  });
  assert.throws(
    () => listFilesLive(dir),
    (err) => err.code === "EACCES",
  );
  t.mock.restoreAll();
  const readdir = fs.readdirSync;
  t.mock.method(fs, "readdirSync", (target, ...rest) => {
    if (String(target).endsWith(`${path.sep}b`)) throw failure("EIO");
    return readdir(target, ...rest);
  });
  assert.throws(
    () => listFilesLive(dir),
    (err) => err.code === "EIO",
  );
  t.mock.restoreAll();
  assert.throws(
    () => listFilesLive(path.join(dir, "a.json")),
    (err) => err.code === "ENOTDIR",
  );
  // the plain case, sorted at every level
  assert.deepEqual(listFilesLive(dir), ["a.json", "b/c.json"]);
});

test("FR-3b: the three files that wait for a file of the inbox take the one function - their inboxNames and inboxFiles hold no listing of their own", () => {
  for (const [file, name] of [
    ["team-channel.test.js", "inboxNames"],
    ["team-web-channel.test.js", "inboxFiles"],
    ["team-web-control.test.js", "inboxFiles"],
  ]) {
    const text = fs.readFileSync(new URL(file, import.meta.url), "utf8");
    const start = text.indexOf(`function ${name}(p) {`);
    assert.ok(start >= 0, `${file}: ${name}`);
    const body = text.slice(start, text.indexOf("\n}\n", start) + 3);
    assert.match(body, /listFilesLive\(/u, file);
    assert.doesNotMatch(body, /readdirSync|lstatSync|existsSync/u, file);
    assert.match(
      text,
      /import \{[^}]*\blistFilesLive\b[^}]*\} from "\.\/team-helpers\.js"/u,
      file,
    );
  }
});

const KEYS = {
  GIT_CONFIG_COUNT: "2",
  GIT_CONFIG_KEY_0: "maintenance.auto",
  GIT_CONFIG_VALUE_0: "false",
  GIT_CONFIG_KEY_1: "gc.auto",
  GIT_CONFIG_VALUE_1: "0",
};

test("FR-4: the environment of the sandbox of the tests of the handoffs has the five keys that switch the background clean-up of git off, with these values and no other config keys", (t) => {
  const { env } = sandbox(t);
  for (const [key, value] of Object.entries(KEYS))
    assert.equal(env[key], value, key);
  assert.deepEqual(
    Object.keys(env)
      .filter((k) => k.startsWith("GIT_CONFIG_"))
      .sort(),
    [...Object.keys(KEYS), "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM"].sort(),
  );
  assert.equal(env.GIT_CONFIG_GLOBAL, "/dev/null");
  assert.equal(env.GIT_CONFIG_NOSYSTEM, "1");
  // a new environment each time
  assert.notEqual(sandbox(t).env, env);
});

test("FR-5: a git started in the sandbox sees maintenance.auto false and gc.auto 0, in a repository too; the five keys are not in the environment of this test process", (t) => {
  const { env, dir } = sandbox(t);
  const root = path.join(dir, "repo");
  fs.mkdirSync(root);
  git(root, env, "init", "-q");
  assert.equal(
    git(root, env, "config", "--get", "maintenance.auto").trim(),
    "false",
  );
  assert.equal(git(root, env, "config", "--get", "gc.auto").trim(), "0");
  assert.equal(
    git(dir, env, "config", "--type=bool", "--get", "maintenance.auto").trim(),
    "false",
  );
  for (const key of Object.keys(KEYS))
    assert.equal(Object.hasOwn(process.env, key), false, key);
  fs.writeFileSync(path.join(root, "f.txt"), "x");
  git(root, env, "add", "-A");
  git(root, env, "commit", "-q", "-m", "c");
  // after a commit there is no lock of the clean-up in the folder of the objects
  assert.equal(
    fs.existsSync(path.join(root, ".git", "objects", "maintenance.lock")),
    false,
  );
});
