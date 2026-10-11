// REQ-038, criteria 3, 7 and 9: the five calls of git of tools/src/handoffs/git-history.js
// on temporary repositories and with a git that is not there, that is too slow or that
// answers badly (design 7 and 8; HC-8j). A failure of git is a TraceError with the text of
// traces; nothing is written.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  commitExists,
  fileHistory,
  isAncestorOfHead,
  isShallow,
  readBlobs,
} from "../src/handoffs/git-history.js";
import { TraceError } from "../src/traces/lists.js";
import { REL, T, doc, newSai } from "./handoffs-helpers.js";
import { git, sandbox } from "./fixtures/traces/helpers.js";

// The environment of the process is the one of the fixture while the test runs.
const ORIGINAL_ENV = { ...process.env };
function useEnv(t, env) {
  t.after(() => {
    for (const k of Object.keys(process.env))
      if (!(k in ORIGINAL_ENV)) delete process.env[k];
    Object.assign(process.env, ORIGINAL_ENV);
  });
  Object.assign(process.env, env);
}

const ZERO = "0".repeat(40);
const failure = (code, message) => (err) =>
  err instanceof TraceError &&
  err.code === code &&
  (message === undefined || err.message.includes(message));

test("GH-1 fileHistory: the commits of each file under handoffs/, from the oldest to the newest, with the committer time in seconds of UTC", (t) => {
  const sai = newSai(t);
  useEnv(t, sai.env);
  const a = "handoffs/R-1/a b.json";
  const b = "handoffs/R-1/ёж.json";
  sai.write(a, "1\n");
  sai.write(b, "1\n");
  const c1 = sai.commit("2025-03-01T11:00:00+05:00");
  sai.write(a, "2\n");
  sai.write("docs/x.md", "x\n");
  const c2 = sai.commit(T("07:00:00"));
  fs.rmSync(path.join(sai.root, b));
  const c3 = sai.commit(T("08:00:00"));
  const history = fileHistory(sai.root);
  const sec = (iso) => Date.parse(iso) / 1000;
  assert.deepEqual(history.get(a), [
    { hash: c1, time: sec(T("06:00:00")) },
    { hash: c2, time: sec(T("07:00:00")) },
  ]);
  assert.deepEqual(history.get(b), [
    { hash: c1, time: sec(T("06:00:00")) },
    { hash: c3, time: sec(T("08:00:00")) },
  ]);
  assert.deepEqual([...history.keys()].sort(), [a, b].sort());
  // The tracked file of the base commit is outside handoffs/: not in the map.
  assert.ok(!history.has("README.md"));
});

test("GH-1b a repository without a commit: E_HC_GIT", (t) => {
  const sb = sandbox(t);
  const root = path.join(sb.dir, "fresh");
  fs.mkdirSync(root);
  git(root, sb.env, "init", "-q");
  useEnv(t, sb.env);
  assert.throws(() => fileHistory(root), failure("E_HC_GIT", "нет коммитов"));
  assert.throws(
    () => isAncestorOfHead(root, ZERO),
    failure("E_HC_GIT", "нет коммитов"),
  );
});

test("GH-2 readBlobs: the contents in the order of the specs over several batches; null for a missing object and for a folder", (t) => {
  const sai = newSai(t);
  useEnv(t, sai.env);
  const big = "handoffs/R-1/big.json";
  const spaced = "handoffs/R-1/с пробелом.json";
  sai.writeDoc(REL, doc(REL));
  sai.write(big, `{"a":"${"x".repeat(3 * 1024 * 1024)}"}`);
  sai.write(spaced, "{}\n");
  sai.commit(T("06:00:00"));
  const specs = [];
  const expected = [];
  const same = sai.read(REL);
  for (let i = 0; i < 2500; i++) {
    const k = i % 5;
    if (k === 0) {
      specs.push(`HEAD:${REL}`);
      expected.push(same);
    } else if (k === 1) {
      specs.push("HEAD:handoffs/R-1/no-such.json");
      expected.push(null);
    } else if (k === 2) {
      specs.push("HEAD:handoffs");
      expected.push(null);
    } else if (k === 3) {
      specs.push(`HEAD:${spaced}`);
      expected.push(Buffer.from("{}\n"));
    } else if (i % 500 === 4) {
      specs.push(`HEAD:${big}`);
      expected.push(sai.read(big));
    } else {
      specs.push(`HEAD:${REL}`);
      expected.push(same);
    }
  }
  const got = readBlobs(sai.root, specs);
  assert.equal(got.length, 2500);
  got.forEach((value, i) => {
    if (expected[i] === null) assert.equal(value, null, `spec ${i}`);
    else assert.ok(value.equals(expected[i]), `spec ${i}`);
  });
  assert.deepEqual(readBlobs(sai.root, []), []);
});

test("GH-3 isShallow, commitExists and isAncestorOfHead answer yes and no; a hash that is not 40 hex digits is refused", (t) => {
  const sai = newSai(t);
  useEnv(t, sai.env);
  const first = sai.head();
  sai.write("x.txt", "x\n");
  const second = sai.commit(T("06:00:00"));
  assert.equal(isShallow(sai.root), false);
  assert.equal(commitExists(sai.root, first), true);
  assert.equal(commitExists(sai.root, ZERO), false);
  assert.equal(isAncestorOfHead(sai.root, first), true);
  assert.equal(isAncestorOfHead(sai.root, second), true);
  const branch = sai.git("rev-parse", "--abbrev-ref", "HEAD").trim();
  sai.git("checkout", "-q", "-b", "side");
  sai.write("y.txt", "y\n");
  const side = sai.commit(T("07:00:00"));
  sai.git("checkout", "-q", branch);
  assert.equal(commitExists(sai.root, side), true);
  assert.equal(isAncestorOfHead(sai.root, side), false);
  for (const bad of [
    "",
    "abc",
    ZERO.slice(1),
    `${ZERO.slice(1)}G`,
    "HEAD",
    `${first}\n`,
    null,
    5,
  ]) {
    assert.throws(
      () => commitExists(sai.root, bad),
      failure("E_HC_BASE_COMMIT"),
    );
    assert.throws(
      () => isAncestorOfHead(sai.root, bad),
      failure("E_HC_BASE_COMMIT"),
    );
  }
});

// A folder with a program named git that does what `body` says; PATH is only that folder.
function fakeGit(t, body) {
  const sb = sandbox(t);
  const bin = path.join(sb.dir, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "git"), `#!/bin/sh\n${body}\n`, {
    mode: 0o755,
  });
  const repo = path.join(sb.dir, "repo");
  fs.mkdirSync(repo);
  useEnv(t, { ...sb.env, PATH: bin });
  return { repo, dir: sb.dir };
}

const CALLS = {
  isShallow: (root, ms) => isShallow(root, ms),
  commitExists: (root, ms) => commitExists(root, "a".repeat(40), ms),
  isAncestorOfHead: (root, ms) => isAncestorOfHead(root, "a".repeat(40), ms),
  fileHistory: (root, ms) => fileHistory(root, ms),
  readBlobs: (root, ms) => readBlobs(root, ["HEAD:x"], ms),
};

test("HC-8j a git that does not answer in time (timeoutMs 200): every one of the five functions is E_TRACE_GIT 'git не ответил за 30 с'; nothing is written", (t) => {
  const { repo, dir } = fakeGit(t, "exec /bin/sleep 5");
  for (const [name, call] of Object.entries(CALLS)) {
    const started = Date.now();
    assert.throws(
      () => call(repo, 200),
      failure("E_TRACE_GIT", "git не ответил за 30 с"),
      name,
    );
    assert.ok(
      Date.now() - started < 4000,
      `${name} waited ${Date.now() - started} ms`,
    );
  }
  assert.deepEqual(fs.readdirSync(repo), []);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["bin", "home", "repo"]);
});

test("GH-4 git is not found, answers 128 or another code: the texts of traces", (t) => {
  const none = fakeGit(t, "exit 0");
  fs.rmSync(path.join(none.dir, "bin", "git"));
  for (const [name, call] of Object.entries(CALLS))
    assert.throws(
      () => call(none.repo),
      failure("E_TRACE_GIT", "git не найден"),
      name,
    );

  const notRepo = fakeGit(t, "exit 128");
  for (const name of ["isShallow", "commitExists", "readBlobs"])
    assert.throws(
      () => CALLS[name](notRepo.repo),
      failure("E_TRACE_NOT_GIT", "это не git-репозиторий"),
      name,
    );

  const other = fakeGit(t, "exit 3");
  for (const [name, call] of Object.entries(CALLS))
    assert.throws(
      () => call(other.repo),
      failure("E_TRACE_GIT", "git не смог выполнить команду (код 3)"),
      name,
    );
});

test("GH-5 status 1 of git is the answer 'no' of commitExists and isAncestorOfHead, not a failure", (t) => {
  const { repo } = fakeGit(t, "exit 1");
  assert.equal(commitExists(repo, "a".repeat(40)), false);
  assert.equal(isAncestorOfHead(repo, "a".repeat(40)), false);
});

test("GH-6 an answer of git that cannot be read is E_TRACE_GIT, not a wrong result", (t) => {
  const bad = fakeGit(t, "echo 'not an object header'");
  assert.throws(
    () => readBlobs(bad.repo, ["HEAD:x"]),
    failure("E_TRACE_GIT", "вывод git не разобран"),
  );
  const short = fakeGit(
    t,
    "printf '%s blob 100\\n' aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  assert.throws(
    () => readBlobs(short.repo, ["HEAD:x"]),
    failure("E_TRACE_GIT", "вывод git не разобран"),
  );
  const notUtf8 = fakeGit(t, "printf '\\377\\376'");
  assert.throws(
    () => isShallow(notUtf8.repo),
    failure("E_TRACE_GIT", "не в UTF-8"),
  );
  const badLog = fakeGit(t, "printf '\\001nothash 2025\\0'");
  assert.throws(
    () => fileHistory(badLog.repo),
    failure("E_TRACE_GIT", "вывод git не разобран"),
  );
});
