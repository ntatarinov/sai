// REQ-038, criteria 1 and 9: the command as a process - help, keys, the order of the
// output, the codes, the failures (no git, not a git repository, a file that cannot be
// read, an incomplete history) and the promise that nothing is written
// (design 12, HC-01, HC-8a ... HC-8h).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  CLI,
  DECISION_FILE,
  MAC,
  REL,
  T,
  TOOLS,
  assertNoStack,
  assertStop,
  describe,
  doc,
  lineOf,
  newSai,
  runCli,
  text,
  treeHash,
  violationLines,
} from "./handoffs-helpers.js";
import { git, sandbox } from "./fixtures/traces/helpers.js";

const AT = T("06:00:00");
const FAULT_PATH = path.join(TOOLS, "test", "fault-inject.js");

const line = (rel, n, rule, field, message) =>
  `${rel}:${n} — ${rule}: ${field}: ${message}`;

test("HC-01 --help prints the help in Russian with code 0, nothing on stderr, and needs no repository", (t) => {
  const sb = sandbox(t);
  const r = runCli(["--help"], { env: sb.env, cwd: sb.dir });
  assert.equal(r.status, 0, describe(r));
  assert.equal(r.stderr, "");
  const lines = r.stdout.split("\n");
  assert.equal(lines[0], "Использование: npm run handoffs-check [-- <ключи>]");
  assert.match(r.stdout, /--root/u);
  assert.match(r.stdout, /--emit-exceptions/u);
  assert.match(r.stdout, /--help/u);
  assert.match(r.stdout, /Коды выхода/u);
  assert.match(r.stdout, /[А-Яа-я]{6}/u);
});

test("HC-01b a wrong call is code 2 with the one line E_HC_USAGE and the way to the help; nothing is written", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL));
  sai.commit(AT);
  const calls = [
    ["--bogus"],
    ["extra"],
    [""],
    ["-h"],
    ["--root=x"],
    ["--root"],
    ["--emit-exceptions", "--emit-exceptions"],
    ["--root", sai.root, "--root", sai.root],
    ["--constructor"],
    ["--__proto__"],
    ["--toString"],
    ["--hasOwnProperty"],
    ["--emit-exceptions", "stray"],
  ];
  for (const args of calls) {
    const before = sai.tree();
    const r = runCli(args, { env: sai.env, cwd: sai.root });
    assert.equal(sai.tree(), before, JSON.stringify(args));
    assertStop(r, "E_HC_USAGE");
    assert.ok(
      r.stderr.endsWith("; справка: npm run handoffs-check -- --help\n"),
      r.stderr,
    );
  }
});

test("HC-01c --root with a folder that does not exist is code 2; --root with a folder inside the repository works like the root", (t) => {
  const sai = newSai(t);
  const body = text(doc(REL, { created_at: undefined }));
  sai.write(REL, body);
  sai.commit(AT);
  const missing = sai.run([], { root: path.join(sai.dir, "no-such-folder") });
  assertStop(missing, "E_TRACE_USAGE", "папки --root нет");
  const whole = sai.runUnchanged();
  const inner = sai.runUnchanged([], {
    root: path.join(sai.root, "handoffs", "R-1"),
  });
  assert.equal(inner.status, whole.status);
  assert.equal(inner.stdout, whole.stdout);
  // Without --root the folder of the call is used.
  const here = runCli([], {
    env: sai.env,
    cwd: path.join(sai.root, "handoffs"),
  });
  assert.equal(here.stdout, whole.stdout);
  assert.equal(here.status, 1);
});

test("HC-8a the order of the lines: the path by the bytes of UTF-8, then the line as a number, then the path of the field, then the number of the rule", (t) => {
  const sai = newSai(t);
  // UTF-8 order: A, b, é (C3 A9), the full-width A (EF BC A1), the emoji (F0 9F 98 80).
  // The order of UTF-16 would put the emoji before the full-width A.
  const names = ["b", "A", "é", "Ａ", "😀"];
  for (const n of names) {
    const rel = `handoffs/R-1/step-${n}.json`;
    sai.writeDoc(rel, doc(rel, { created_at: undefined }));
  }
  sai.commit(AT);
  const r = sai.runUnchanged();
  assert.equal(r.status, 1);
  const order = violationLines(r.stdout).map(
    (l) => /^handoffs\/R-1\/step-(.+)\.json:/u.exec(l)[1],
  );
  assert.deepEqual(order, ["A", "b", "é", "Ａ", "😀"]);
});

test("HC-8a2 lines of one file are ordered as numbers (3, 8, 22 and not 22, 3, 8)", (t) => {
  const sai = newSai(t);
  const context = {};
  for (let i = 0; i < 12; i++) context[`k${i}`] = i;
  const body = text(
    doc(REL, {
      run_id: "R-9",
      file: "handoffs/R-1/other.json",
      context,
      created_at: "плохо",
    }),
  );
  sai.write(REL, body);
  sai.commit(AT);
  const rows = [
    line(
      REL,
      lineOf(body, '"run_id"'),
      "H3",
      "run_id",
      "run_id не равен имени папки прогона",
    ),
    line(REL, lineOf(body, '"file"'), "H3", "file", "file не равен пути файла"),
    line(
      REL,
      lineOf(body, '"created_at"'),
      "H5",
      "created_at",
      "значение не вида ГГГГ-ММ-ДДTчч:мм:ссZ",
    ),
  ];
  const numbers = rows.map((l) => Number(/:(\d+) —/u.exec(l)[1]));
  assert.ok(numbers[0] < numbers[1] && numbers[1] < 10 && numbers[2] > 10);
  const r = sai.runUnchanged();
  assert.deepEqual(violationLines(r.stdout), rows);
});

test("HC-8a3 on one line the fields are ordered by bytes, not as in the file", (t) => {
  const sai = newSai(t);
  // A compact file: every field is on line 1.
  const compact = JSON.stringify(
    doc(REL, {
      started_at: "плохо",
      created_at: "плохо",
      completed_at: "плохо",
    }),
  );
  sai.write(REL, `${compact}\n`);
  sai.commit(AT);
  const r = sai.runUnchanged();
  const msg = "значение не вида ГГГГ-ММ-ДДTчч:мм:ссZ";
  assert.deepEqual(violationLines(r.stdout), [
    line(REL, 1, "H5", "completed_at", msg),
    line(REL, 1, "H5", "created_at", msg),
    line(REL, 1, "H5", "started_at", msg),
  ]);
});

test("HC-8a4 on one line and one field the rules are ordered by their number (H4 before H11, not as texts)", (t) => {
  const sai = newSai(t);
  const body = text(
    doc(REL, { status: "/tmp/zqwork", result: { status: "COMPLETED" } }),
  );
  sai.write(REL, body);
  sai.commit(AT);
  const n = lineOf(body, '"status": "/tmp');
  const r = sai.runUnchanged();
  assert.deepEqual(violationLines(r.stdout), [
    line(REL, n, "H4", "status", "недопустимое значение значение не из списка"),
    line(REL, n, "H11", "status", "путь временной папки"),
  ]);
});

test("HC-8b the last line is the summary, once, and a newline ends the output; a run without violations prints only it", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL));
  sai.commit(AT);
  const ok = sai.runUnchanged();
  assert.equal(ok.status, 0);
  assert.equal(
    ok.stdout,
    "handoffs-check: файлов проверено 1, нарушений 0, исключений использовано 0 из 0\n",
  );
  sai.writeDoc(
    "handoffs/R-1/step-02-b.json",
    doc("handoffs/R-1/step-02-b.json", { task: undefined }),
  );
  const bad = sai.runUnchanged();
  const lines = bad.stdout.split("\n");
  assert.equal(lines[lines.length - 1], "");
  assert.match(
    lines[lines.length - 2],
    /^handoffs-check: файлов проверено 2, нарушений 1, исключений использовано 0 из 0$/u,
  );
  assert.equal(
    lines.filter((l) => l.startsWith("handoffs-check: файлов")).length,
    1,
  );
});

test("HC-8c outside a git repository: code 2 and the text of traces, nothing on stdout, no stack", (t) => {
  const sb = sandbox(t);
  const plain = path.join(sb.dir, "plain");
  fs.mkdirSync(plain);
  fs.writeFileSync(path.join(plain, "x.txt"), "x\n");
  const r = runCli([], { root: plain, env: sb.env });
  assertStop(r, "E_TRACE_NOT_GIT", "это не git-репозиторий");
  const traces = spawnSync(
    process.execPath,
    [path.join(TOOLS, "src", "traces", "cli.js"), "--root", plain],
    { cwd: TOOLS, env: sb.env, encoding: "utf8" },
  );
  const same = (s) => s.replace(/^[a-z-]+: /u, "");
  assert.equal(same(r.stderr), same(traces.stderr));
  assert.deepEqual(fs.readdirSync(plain), ["x.txt"]);
});

test("HC-8d git not found (PATH without git): code 2, nothing on stdout, no stack, nothing written", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL));
  sai.commit(AT);
  const empty = path.join(sai.dir, "empty-bin");
  fs.mkdirSync(empty);
  const before = sai.tree();
  const r = sai.run([], { env: { PATH: empty } });
  assert.equal(sai.tree(), before);
  assertStop(r, "E_TRACE_GIT", "git не найден");
});

test("HC-8d2 a repository without a commit: code 2 E_HC_GIT", (t) => {
  const sb = sandbox(t);
  const root = path.join(sb.dir, "fresh");
  fs.mkdirSync(path.join(root, "handoffs", "R-1"), { recursive: true });
  git(root, sb.env, "init", "-q");
  fs.writeFileSync(path.join(root, REL), text(doc(REL)));
  const r = runCli([], { root, env: sb.env });
  assertStop(r, "E_HC_GIT", "в репозитории нет коммитов");
});

test("HC-8e a tracked file replaced by a folder cannot be read: code 2 E_HC_READ without the path, nothing on stdout", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL, { created_at: undefined }));
  sai.commit(AT);
  fs.rmSync(path.join(sai.root, REL));
  fs.mkdirSync(path.join(sai.root, REL));
  const r = sai.runUnchanged();
  assertStop(r, "E_HC_READ", "файл не читается (не обычный файл)");
  assert.ok(!r.stderr.includes(sai.dir) && !r.stderr.includes("step-01"));
});

test("HC-8e1 a tracked file deleted in the work tree, and a folder that became a link out of the root: code 2", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL));
  const linked = "handoffs/R-2/step-01-a.json";
  sai.writeDoc(linked, doc(linked));
  sai.commit(AT);
  fs.rmSync(path.join(sai.root, REL));
  assertStop(sai.runUnchanged(), "E_HC_READ", "файл не читается (ENOENT)");
  sai.writeDoc(REL, doc(REL));
  const outside = path.join(sai.dir, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "step-01-a.json"), text(doc(linked)));
  fs.rmSync(path.join(sai.root, "handoffs", "R-2"), { recursive: true });
  fs.symlinkSync(outside, path.join(sai.root, "handoffs", "R-2"));
  const r = sai.runUnchanged();
  assertStop(r, "E_HC_READ", "файл не читается (ссылка за корень)");
  assert.ok(!r.stderr.includes(sai.dir));
});

test("HC-8e2 a file that the system refuses to open (an injected error of openSync): code 2, the text with the code of the system, no stack", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL));
  sai.commit(AT);
  for (const code of ["EACCES", "EIO", "EMFILE"]) {
    const faults = [
      {
        fn: "openSync",
        paths: [path.join(sai.root, REL)],
        effect: "throw",
        code,
      },
    ];
    const before = sai.tree();
    const r = spawnSync(
      process.execPath,
      ["--import", FAULT_PATH, CLI, "--root", sai.root],
      {
        cwd: TOOLS,
        env: { ...sai.env, SAI_TEST_FAULTS: JSON.stringify(faults) },
        encoding: "utf8",
        timeout: 60_000,
      },
    );
    assert.equal(sai.tree(), before);
    assertStop(
      { status: r.status, stdout: r.stdout, stderr: r.stderr },
      "E_HC_READ",
      `файл не читается (${code})`,
    );
    assert.ok(!r.stderr.includes(sai.dir));
  }
});

test("HC-8e3 a file name with a control character stops the check: code 2 E_HC_NAME", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL));
  sai.write("handoffs/R-1/line\nbreak.json", "{}\n");
  sai.commit(AT);
  assertStop(sai.runUnchanged(), "E_HC_NAME", "имя файла с управляющим знаком");
});

test("HC-8f the command writes nothing: no run changes a file, a folder or the history, whatever it ends with", (t) => {
  const sai = newSai(t);
  sai.write(REL, '{"truncated": ');
  sai.writeDoc(
    "handoffs/R-1/step-02-b.json",
    doc("handoffs/R-1/step-02-b.json", { status: "DONE" }),
  );
  sai.commit(AT);
  sai.writeDoc(
    "handoffs/R-1/step-03-c.json",
    doc("handoffs/R-1/step-03-c.json", {
      status: "PENDING",
      completed_at: null,
      result: null,
    }),
  );
  const cases = [
    { args: [], code: 1 },
    { args: ["--emit-exceptions"], code: 0 },
    { args: ["--help"], code: 0, noRoot: true },
    { args: ["--bogus"], code: 2 },
  ];
  for (const c of cases) {
    const before = {
      all: sai.tree(),
      // Without the repository: the folders named by the criterion.
      handoffs: fs.readdirSync(path.join(sai.root, "handoffs", "R-1")).sort(),
      base: fs.readdirSync(path.join(sai.root, "tools", "handoffs")).sort(),
      log: sai.git("log", "--format=%H").trim(),
      status: sai.git("status", "--porcelain=v1", "-uall"),
    };
    const r = sai.run(c.args);
    assert.equal(r.status, c.code, describe(r));
    assert.equal(sai.tree(), before.all, JSON.stringify(c.args));
    assert.deepEqual(
      fs.readdirSync(path.join(sai.root, "handoffs", "R-1")).sort(),
      before.handoffs,
    );
    assert.deepEqual(
      fs.readdirSync(path.join(sai.root, "tools", "handoffs")).sort(),
      before.base,
    );
    assert.equal(sai.git("log", "--format=%H").trim(), before.log);
    assert.equal(sai.git("status", "--porcelain=v1", "-uall"), before.status);
  }
});

test("HC-8g no path of the machine, no value of a field, no text of the parser in the output or in an error", (t) => {
  const sai = newSai(t);
  const mark = "zqmarker";
  const body = text(
    doc(REL, {
      status: `${mark}-status`,
      created_at: `${mark}-time`,
      completed_at: `${mark}-time2`,
      step: `${mark}-step`,
      result: { status: `${mark}-result` },
      task: {
        [`${MAC}${mark}/key`]: "x",
        note: `${MAC}${mark}/value`,
        temp: `/tmp/${mark}/value`,
      },
      orch_note: `${mark}-note`,
    }),
  );
  sai.write(REL, body);
  sai.write("handoffs/R-1/step-02-b.json", `{"${mark}": `);
  sai.commit(AT);
  const r = sai.runUnchanged();
  assert.equal(r.status, 1, describe(r));
  assert.ok(violationLines(r.stdout).length >= 6);
  for (const out of [r.stdout, r.stderr]) {
    assert.ok(!out.includes(mark), out);
    assert.ok(!out.includes(MAC), out);
    assert.ok(!out.includes("/tmp/"), out);
    assert.ok(!out.includes(sai.dir), out);
  }
  // The same for the emitted records: a hash and a fixed reason, never the value.
  const emit = sai.runUnchanged(["--emit-exceptions"]);
  assert.ok(!emit.stdout.includes(mark), emit.stdout);
  assert.ok(!emit.stdout.includes(MAC), emit.stdout);
  // And for an error: a folder in place of a file.
  fs.rmSync(path.join(sai.root, "handoffs/R-1/step-02-b.json"));
  fs.mkdirSync(path.join(sai.root, "handoffs/R-1/step-02-b.json"));
  const err = sai.runUnchanged();
  assert.equal(err.status, 2);
  assert.ok(!err.stderr.includes(mark) && !err.stderr.includes(sai.dir));
  assertNoStack(err.stderr);
});

// A shallow clone: its HEAD has the parent cut off.
function shallowClone(t, depth) {
  const origin = newSai(t, { seal: false });
  origin.writeDoc(REL, doc(REL, { created_at: undefined }));
  const base = origin.commit(AT);
  origin.seal([], base);
  origin.commit(T("06:10:00"));
  const sb = sandbox(t);
  const copy = path.join(sb.dir, "copy");
  git(
    sb.dir,
    sb.env,
    "clone",
    "-q",
    `--depth=${depth}`,
    `file://${origin.root}`,
    "copy",
  );
  return { origin, copy, env: sb.env, base };
}

test("HC-8h an incomplete history: the line about it stands before the summary and the code is that of the violations", (t) => {
  const { origin, copy, env, base } = shallowClone(t, 2);
  assert.equal(
    git(copy, env, "rev-parse", "--is-shallow-repository").trim(),
    "true",
  );
  assert.equal(
    git(copy, env, "cat-file", "-t", base).trim(),
    "commit",
    "the base is within the cut history",
  );
  // The base files and the record are untracked in origin; they come with its last commit.
  assert.ok(origin.read(DECISION_FILE).length > 0);
  const before = treeHash(copy);
  const r = runCli([], { root: copy, env });
  assert.equal(treeHash(copy), before);
  assert.equal(r.status, 1, describe(r));
  const lines = r.stdout.split("\n").filter((l) => l !== "");
  assert.equal(
    lines[lines.length - 2],
    "handoffs-check: история git неполная — сверка с коммитами по доступной истории",
  );
  assert.match(
    lines[lines.length - 1],
    /^handoffs-check: файлов проверено 1, нарушений 1,/u,
  );
  assert.equal(lines.length, 3);
  // A full clone has no such line.
  const full = origin.runUnchanged();
  assert.ok(!full.stdout.includes("история git неполная"));
});

test("HC-8h2 the commit of the base is not in the cut history: code 2", (t) => {
  const { copy, env } = shallowClone(t, 1);
  const r = runCli([], { root: copy, env });
  assertStop(r, "E_HC_BASE_COMMIT", "в неполной истории нет коммита базы");
});
