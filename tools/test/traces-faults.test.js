// REQ-014, criterion 6 (Q10): files that cannot be read as text, outside git, no git,
// broken data files (design REQ-014, 7 and 14.1: TF-1 - TF-6).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { readInput } from "../src/traces/add.js";
import {
  MAX_FILE_BYTES,
  checkRepo,
  exitCodeOf,
  formatReport,
} from "../src/traces/check.js";
import { MAX_LINE_CHARS } from "../src/traces/rules.js";
import {
  EXCEPTIONS_REL,
  HASHES_HEADER,
  HASHES_REL,
  LOCK_REL,
  MAC,
  assertLine,
  assertNoStack,
  deadPid,
  git,
  makeRepo,
  runCli,
  sandbox,
} from "./fixtures/traces/helpers.js";

test("TF-1 a binary file is skipped, the others are checked", (t) => {
  const repo = makeRepo(t, {
    "bin.dat": Buffer.concat([Buffer.from(`${MAC}anna/x\n`), Buffer.from([0])]),
    "latin.txt": Buffer.from([0x61, 0xe9, 0x0a]),
    "b.txt": `${MAC}anna/y\n`,
  });
  const r = repo.run();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assertLine(r.stdout, "bin.dat: пропущен: двоичный файл");
  assertLine(r.stdout, "latin.txt: пропущен: двоичный файл");
  assertLine(r.stdout, "b.txt:1: путь домашнего каталога");
  assert.ok(!r.stdout.includes("bin.dat:1"));
  assertLine(r.stdout, "traces: файлов проверено 2, следов 1, пропущено 2");
  // Without a trace a binary file does not make the check fail.
  const clean = makeRepo(t, { "bin.dat": Buffer.from([1, 0, 2]) });
  assert.equal(clean.run().status, 0);
});

function unreadableByChmod(abs) {
  fs.chmodSync(abs, 0o000);
  try {
    fs.accessSync(abs, fs.constants.R_OK);
    return false;
  } catch {
    return true;
  }
}

test("TF-2 a file without read permission: skipped, the others checked, code 1 or 2, no stack", (t) => {
  const repo = makeRepo(t, {
    "locked.txt": `${MAC}anna/x\n`,
    "b.txt": `${MAC}anna/y\n`,
  });
  const locked = path.join(repo.root, "locked.txt");
  if (unreadableByChmod(locked)) {
    const r = repo.run();
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assertLine(r.stdout, "locked.txt: пропущен: не читается");
    assertLine(r.stdout, "b.txt:1: путь домашнего каталога");
    assertNoStack(r.stderr);
    fs.rmSync(path.join(repo.root, "b.txt"));
    const alone = repo.run();
    assert.equal(alone.status, 2, alone.stdout);
    assertLine(alone.stdout, "locked.txt: пропущен: не читается");
    assertNoStack(alone.stderr);
    return;
  }
  // Root reads anything: the same failure injected into the read, in the process.
  fs.chmodSync(locked, 0o600);
  const real = fs.openSync;
  t.mock.method(fs, "openSync", function openSync(p, ...rest) {
    if (String(p) === locked) {
      const err = new Error("EACCES: injected");
      Object.assign(err, { code: "EACCES", syscall: "open", path: p });
      throw err;
    }
    return real.call(fs, p, ...rest);
  });
  const env = { ...process.env, ...repo.env };
  const report = checkRepo({ root: repo.root, env, cwd: repo.root });
  assert.equal(exitCodeOf(report), 1);
  const out = formatReport(report).join("\n");
  assertLine(out, "locked.txt: пропущен: не читается");
  assertLine(out, "b.txt:1: путь домашнего каталога");
});

test("TF-2 in the process: an unreadable file alone gives code 2, not 0", (t) => {
  const repo = makeRepo(t, { "a.txt": "clean\n", "b.txt": "clean\n" });
  const target = path.join(repo.root, "a.txt");
  const real = fs.openSync;
  t.mock.method(fs, "openSync", function openSync(p, ...rest) {
    if (String(p) === target) {
      const err = new Error("EIO: injected");
      Object.assign(err, { code: "EIO", syscall: "open", path: p });
      throw err;
    }
    return real.call(fs, p, ...rest);
  });
  const saved = { ...process.env };
  t.after(() => {
    for (const k of Object.keys(process.env))
      if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  });
  Object.assign(process.env, repo.env);
  const report = checkRepo({ root: repo.root, env: {}, cwd: repo.root });
  assert.deepEqual(report.skipped, [{ path: "a.txt", reason: "unreadable" }]);
  assert.equal(report.filesChecked, 2);
  assert.equal(exitCodeOf(report), 2);
});

test("TF-3 outside a git repository: code 2, a plain text, no absolute path", (t) => {
  const sb = sandbox(t);
  const outside = path.join(sb.dir, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "a.txt"), `${MAC}anna/x\n`);
  for (const args of [
    [],
    ["add"],
    ["hash-line", "--file", "a.txt", "--line", "1"],
  ]) {
    const r = runCli(args, { root: outside, env: sb.env, input: "Qplmzz\n" });
    assert.equal(r.status, 2, args.join(" "));
    assert.match(r.stderr, /^traces: E_TRACE_NOT_GIT: это не git-репозиторий/u);
    assert.equal(r.stdout, "");
    assert.ok(!r.stderr.includes(sb.dir));
    assertNoStack(r.stderr);
  }
  assert.deepEqual(fs.readdirSync(outside), ["a.txt"]);
  const missing = runCli([], { root: path.join(sb.dir, "nope"), env: sb.env });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /^traces: E_TRACE_USAGE: /u);
  assert.ok(!missing.stderr.includes(sb.dir));
});

test("TF-4 a file in the index deleted from the disk; a link is not followed", (t) => {
  const repo = makeRepo(t, { "gone.txt": "x\n", "a.txt": "a\n" });
  fs.rmSync(path.join(repo.root, "gone.txt"));
  const target = path.join(repo.dir, "outside.txt");
  fs.writeFileSync(target, `${MAC}anna/x\n`);
  fs.symlinkSync(target, path.join(repo.root, "link.txt"));
  const r = repo.run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assertLine(r.stdout, "gone.txt: пропущен: удалён в рабочей копии");
  assertLine(r.stdout, "link.txt: пропущен: не обычный файл");
});

test("TF-5 git is not found: E_TRACE_GIT, code 2", (t) => {
  const repo = makeRepo(t, { "a.txt": "a\n" });
  const empty = path.join(repo.dir, "empty-bin");
  fs.mkdirSync(empty);
  const r = repo.run([], { env: { PATH: empty } });
  assert.equal(r.status, 2);
  assert.equal(r.stderr, "traces: E_TRACE_GIT: git не найден\n");
});

test("TF-6 a broken or missing file of hashes: code 2 with the line number", (t) => {
  const h = "b".repeat(64);
  for (const [content, line] of [
    ["# another header\n", 1],
    [`${HASHES_HEADER}\n${h.toUpperCase()}\n`, 2],
    [`${HASHES_HEADER}\n${h}\n${h}\n`, 3],
    [`${HASHES_HEADER}\n${h}\n${"a".repeat(64)}\n`, 3],
    [`${HASHES_HEADER}\n\n`, 2],
    [`${HASHES_HEADER}`, 1],
    ["", 1],
  ]) {
    const repo = makeRepo(t, { "a.txt": "a\n" });
    repo.write(HASHES_REL, content);
    const r = repo.run();
    assert.equal(r.status, 2, JSON.stringify(content));
    assert.match(
      r.stderr,
      new RegExp(`^traces: E_TRACE_HASHES: файл хешей, строка ${line}: `, "u"),
    );
    assert.equal(r.stdout, "");
    // add refuses the broken file too and leaves it as it is.
    const a = repo.run(["add"], { input: "Qplmzz\n" });
    assert.equal(a.status, 2);
    assert.equal(repo.read(HASHES_REL).toString("utf8"), content);
  }
  const none = makeRepo(t, { "a.txt": "a\n" }, { hashes: false });
  const r = none.run();
  assert.equal(r.status, 2);
  assert.equal(
    r.stderr,
    "traces: E_TRACE_HASHES: нет файла хешей; создайте его: npm run traces -- add\n",
  );
});

test("TF-6 a broken file of exceptions: code 2 with the line number", (t) => {
  const h = "c".repeat(64);
  for (const [content, line] of [
    [`a.txt\t${h}\n`, 1],
    [`# c\na.txt\t${h}\tok\textra\n`, 2],
    [`a.txt\t${h.slice(1)}\tok\n`, 1],
    [`a.txt\t${h}\t\n`, 1],
    [`a.txt\t${h}\t   \n`, 1],
    [`a.txt\t${h}\t${"я".repeat(301)}\n`, 1],
    [`../a.txt\t${h}\tok\n`, 1],
    [`/a.txt\t${h}\tok\n`, 1],
    [`a.txt\t${h}\tok\n\na.txt\t${h}\tagain\n`, 3],
  ]) {
    const repo = makeRepo(t, { "a.txt": "a\n" });
    repo.write(EXCEPTIONS_REL, content);
    const r = repo.run();
    assert.equal(r.status, 2, JSON.stringify(content));
    assert.match(
      r.stderr,
      new RegExp(
        `^traces: E_TRACE_EXCEPTIONS: файл исключений, строка ${line}: `,
        "u",
      ),
    );
  }
  // 300 characters is the limit, still good.
  const repo = makeRepo(t, { "a.txt": "a\n" });
  repo.write(EXCEPTIONS_REL, `a.txt\t${h}\t${"я".repeat(300)}\n`);
  const ok = repo.run();
  assert.equal(ok.status, 0, ok.stderr);
  assertLine(
    ok.stdout,
    `traces: исключение не использовано: ${EXCEPTIONS_REL}:1`,
  );
});

function sparse(abs, size) {
  const fd = fs.openSync(abs, "w");
  try {
    fs.ftruncateSync(fd, size);
  } finally {
    fs.closeSync(fd);
  }
}

test("TF-7 a file over 16 MiB is skipped before it is read, like a binary one; no stack", (t) => {
  assert.equal(MAX_FILE_BYTES, 16 * 1024 * 1024);
  const repo = makeRepo(t, { "b.txt": `${MAC}anna/y\n` });
  sparse(path.join(repo.root, "big.txt"), MAX_FILE_BYTES + 1);
  const r = repo.run();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assertLine(r.stdout, "big.txt: пропущен: больше 16 МиБ");
  assertLine(r.stdout, "b.txt:1: путь домашнего каталога");
  assertNoStack(r.stderr);
  fs.rmSync(path.join(repo.root, "b.txt"));
  const alone = repo.run();
  assert.equal(alone.status, 0, alone.stdout + alone.stderr);
  assertLine(alone.stdout, "big.txt: пропущен: больше 16 МиБ");
  // Exactly the limit is still read.
  sparse(path.join(repo.root, "big.txt"), MAX_FILE_BYTES);
  const limit = repo.run();
  assert.ok(!limit.stdout.includes("больше 16 МиБ"), limit.stdout);
  // 3 GiB: the same skip, fast, no stack.
  sparse(path.join(repo.root, "big.txt"), 3 * 1024 ** 3);
  const started = Date.now();
  const huge = repo.run();
  assert.ok(Date.now() - started <= 10_000);
  assert.equal(huge.status, 0, huge.stdout + huge.stderr);
  assertLine(huge.stdout, "big.txt: пропущен: больше 16 МиБ");
  assertNoStack(huge.stderr);
  // hash-line refuses it without reading.
  const h = repo.run(["hash-line", "--file", "big.txt", "--line", "1"]);
  assert.equal(h.status, 2);
  assert.match(h.stderr, /^traces: E_TRACE_USAGE: /u);
  assert.equal(h.stdout, "");
});

test("TF-7 a file over the limit is never opened by check (in the process)", (t) => {
  const repo = makeRepo(t, { "b.txt": "clean\n" });
  const big = path.join(repo.root, "big.txt");
  sparse(big, MAX_FILE_BYTES + 1);
  const opened = [];
  const realOpen = fs.openSync;
  t.mock.method(fs, "openSync", function openSync(p, ...rest) {
    opened.push(String(p));
    return realOpen.call(fs, p, ...rest);
  });
  const report = checkRepo({ root: repo.root, env: {}, cwd: repo.root });
  t.mock.restoreAll();
  assert.deepEqual(
    report.skipped.filter((s) => s.path === "big.txt"),
    [{ path: "big.txt", reason: "too-large" }],
  );
  assert.ok(opened.some((p) => p.endsWith("b.txt")));
  assert.ok(!opened.includes(big), "the big file was opened");
});

test("TF-8 a tracked folder replaced by a link outside: not read by check, hash-line or add", (t) => {
  const repo = makeRepo(t, { "d/b.txt": "clean\n", "a.txt": "a\n" });
  const outside = path.join(repo.dir, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "b.txt"), `${MAC}anna/x\n`);
  fs.rmSync(path.join(repo.root, "d"), { recursive: true });
  fs.symlinkSync(outside, path.join(repo.root, "d"));
  const r = repo.run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assertLine(r.stdout, "d/b.txt: пропущен: вне корня репозитория");
  assert.ok(!r.stdout.includes("d/b.txt:1"));
  const h = repo.run(["hash-line", "--file", "d/b.txt", "--line", "1"]);
  assert.equal(h.status, 2);
  assert.match(h.stderr, /^traces: E_TRACE_USAGE: /u);
  assert.equal(h.stdout, "");

  // add with tools/traces a link outside: E_WRITE, nothing appears outside.
  const other = makeRepo(t, { "a.txt": "a\n" }, { hashes: false });
  const target = path.join(other.dir, "target");
  fs.mkdirSync(target);
  fs.mkdirSync(path.join(other.root, "tools"));
  fs.symlinkSync(target, path.join(other.root, "tools", "traces"));
  // A stale lock there (dead pid): add must not even take it over through the link.
  const stale = `${deadPid()} 2026-10-09T00:00:00Z\n`;
  const lockName = path.basename(LOCK_REL);
  fs.writeFileSync(path.join(target, lockName), stale);
  const a = other.run(["add"], { input: "Qplmzz\n" });
  assert.equal(a.status, 2, a.stdout + a.stderr);
  assert.match(a.stderr, /^traces: E_WRITE: /u);
  assert.deepEqual(fs.readdirSync(target), [lockName]);
  assert.equal(fs.readFileSync(path.join(target, lockName), "utf8"), stale);
  // tools itself a link outside: the same.
  const third = makeRepo(t, { "a.txt": "a\n" }, { hashes: false });
  const target3 = path.join(third.dir, "target3");
  fs.mkdirSync(path.join(target3, "traces"), { recursive: true });
  fs.symlinkSync(target3, path.join(third.root, "tools"));
  const a3 = third.run(["add"], { input: "Qplmzz\n" });
  assert.equal(a3.status, 2);
  assert.match(a3.stderr, /^traces: E_WRITE: /u);
  assert.deepEqual(fs.readdirSync(path.join(target3, "traces")), []);
});

test("TF-9 core.fsmonitor of the repository is not run", (t) => {
  const repo = makeRepo(t, { "a.txt": "a\n" });
  const marker = path.join(repo.dir, "fsmonitor-ran");
  const script = path.join(repo.dir, "fsmonitor.sh");
  fs.writeFileSync(script, `#!/bin/sh\ntouch "${marker}"\nexit 1\n`, {
    mode: 0o755,
  });
  git(repo.root, repo.env, "config", "core.fsmonitor", script);
  // The probe works: git itself runs it.
  git(repo.root, repo.env, "ls-files", "--others", "--exclude-standard");
  assert.ok(fs.existsSync(marker), "git did not run the fsmonitor probe");
  fs.rmSync(marker);
  const r = repo.run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!fs.existsSync(marker));
});

test("TL-1 a long Markdown line: linear time, over the limit the links are not parsed", (t) => {
  assert.equal(MAX_LINE_CHARS, 100_000);
  const repo = makeRepo(t);
  repo.write("a.md", `${"[".repeat(100_000)}\n`);
  const started = Date.now();
  const r = repo.run();
  assert.ok(Date.now() - started <= 5_000, `${Date.now() - started} ms`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // Exactly the limit: parsed.
  const link = "[t](../x.md)";
  repo.write("a.md", `${link}${" ".repeat(MAX_LINE_CHARS - link.length)}\n`);
  assertLine(repo.run().stdout, "a.md:1: ссылка за корень репозитория");
  // One over: not parsed, a note, code 0.
  repo.write(
    "a.md",
    `x\n${link}${" ".repeat(MAX_LINE_CHARS + 1 - link.length)}\n`,
  );
  const over = repo.run();
  assert.equal(over.status, 0, over.stdout);
  assertLine(
    over.stdout,
    "a.md:2: ссылки не разобраны (строка длиннее 100000 знаков)",
  );
  // The other rules still apply to such a line.
  const home = `${MAC}anna/x`;
  repo.write(
    "a.md",
    `${home}${" ".repeat(MAX_LINE_CHARS + 1 - home.length)}\n`,
  );
  const traced = repo.run();
  assert.equal(traced.status, 1);
  assertLine(traced.stdout, "a.md:1: путь домашнего каталога");
});

test(
  "F5 add: a non-blocking input that never ends is refused after the wait limit",
  { timeout: 20_000 },
  (t) => {
    const real = fs.readSync;
    let calls = 0;
    t.mock.method(fs, "readSync", function readSync(fd, ...rest) {
      if (fd !== 0) return real.call(fs, fd, ...rest);
      calls++;
      if (calls === 1) {
        const buf = rest[0];
        buf.write("Qp", 0);
        return 2;
      }
      const err = new Error("EAGAIN: injected");
      Object.assign(err, { code: "EAGAIN", syscall: "read" });
      throw err;
    });
    const started = Date.now();
    assert.throws(
      () => readInput(64 * 1024, 200),
      (err) =>
        err.code === "E_TRACE_NAME" && /ввод не закончился/u.test(err.message),
    );
    assert.ok(Date.now() - started >= 200);
    assert.ok(calls > 2);
  },
);
