// REQ-038, criterion 4: the paths of the machine, H10 (home folders, by the functions of
// traces) and H11 (temporary folders) - design 12, HC-4a ... HC-4e, and the long-line
// test of the review of security (F1). The paths of home folders are put together from
// parts, so that this file is not a trace itself.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { hasHomePath, hasTempPath } from "../src/traces/rules.js";
import {
  CLI,
  MAC,
  REL,
  TOOLS,
  doc,
  lineOf,
  newSai,
  sha256,
  summaryOf,
  text,
  violationLines,
} from "./handoffs-helpers.js";

const line = (rel, n, rule, field, message) =>
  `${rel}:${n} — ${rule}: ${field}: ${message}`;

function expectLines(sai, expected) {
  const r = sai.runUnchanged();
  assert.equal(r.status, expected.length > 0 ? 1 : 0, r.stdout + r.stderr);
  assert.equal(r.stderr, "");
  assert.deepEqual(violationLines(r.stdout), expected);
  return r;
}

const NAME = "zqbobname";
const HOME_VALUE = `смотри ${MAC}${NAME}/работа/файл.txt`;

test("HC-4a a line with a path of a home folder is H10 on the field of that line; the path is not printed", (t) => {
  const sai = newSai(t);
  const body = text(doc(REL, { task: { description: HOME_VALUE } }));
  sai.write(REL, body);
  sai.commit("2025-03-01T06:00:00Z");
  const r = expectLines(sai, [
    line(
      REL,
      lineOf(body, NAME),
      "H10",
      "task.description",
      "путь домашнего каталога",
    ),
  ]);
  assert.ok(!r.stdout.includes(NAME), r.stdout);
  assert.ok(!r.stdout.includes(MAC), r.stdout);
});

test("HC-4a2 a path in a key: the field is written with ?; a path in a file that is not JSON: H10 on $ next to H1", (t) => {
  const sai = newSai(t);
  const body = text(doc(REL, { task: { [`${MAC}${NAME}/x`]: 1 } }));
  sai.write(REL, body);
  const broken = "handoffs/R-1/step-02-b.json";
  sai.write(broken, `{"x": "${MAC}${NAME}/y`);
  sai.commit("2025-03-01T06:00:00Z");
  const r = expectLines(sai, [
    line(REL, lineOf(body, NAME), "H10", "task.?", "путь домашнего каталога"),
    line(
      broken,
      1,
      "H1",
      "$",
      "файл не читается как JSON: ошибка разбора JSON",
    ),
    line(broken, 1, "H10", "$", "путь домашнего каталога"),
  ]);
  assert.ok(!r.stdout.includes(NAME), r.stdout);
});

test("HC-4a3 paths in two fields on two lines are two violations", (t) => {
  const sai = newSai(t);
  const body = text(
    doc(REL, { task: { notes: [`${MAC}${NAME}/a`, `${MAC}${NAME}/b`] } }),
  );
  sai.write(REL, body);
  sai.commit("2025-03-01T06:00:00Z");
  expectLines(sai, [
    line(
      REL,
      lineOf(body, "/a"),
      "H10",
      "task.notes[0]",
      "путь домашнего каталога",
    ),
    line(
      REL,
      lineOf(body, "/b"),
      "H10",
      "task.notes[1]",
      "путь домашнего каталога",
    ),
  ]);
});

test("HC-4a4 two lines that belong to one field (the key on one line, the value on the next) are one violation, on the first line", (t) => {
  const sai = newSai(t);
  const plain = text(
    doc(REL, { task: { [`${MAC}${NAME}/k`]: `${MAC}${NAME}/v` } }),
  );
  const body = plain.replace(`/k": "`, `/k":\n    "`);
  assert.notEqual(body, plain);
  sai.write(REL, body);
  sai.commit("2025-03-01T06:00:00Z");
  expectLines(sai, [
    line(REL, lineOf(body, "/k"), "H10", "task.?", "путь домашнего каталога"),
  ]);
});

// A key outside [A-Za-z0-9_-] is written as "?" in the path of a field, so two such keys
// of one object give the same pair "rule, field": one violation (F1 of the gate).
test("HC-4j two keys outside the grammar with a temporary folder in the values are one H11 on the field with ?", (t) => {
  const sai = newSai(t);
  const tmp = `/${"tm"}p/${TMP_NAME}`;
  const body = text(
    doc(REL, { task: { "ключ один": `cd ${tmp}`, "ключ два": `cd ${tmp}/b` } }),
  );
  sai.write(REL, body);
  sai.commit("2025-03-01T06:00:00Z");
  // Which of the two lines is named is not fixed by the design; one line, on one of them.
  const r = sai.runUnchanged();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const lines = violationLines(r.stdout);
  assert.equal(lines.length, 1, r.stdout);
  assert.match(
    lines[0],
    /^handoffs\/R-1\/step-01-a\.json:\d+ — H11: task\.\?: путь временной папки$/u,
  );
  assert.match(summaryOf(r.stdout), /нарушений 1,/u);
});

test("HC-4k two time keys outside the grammar with wrong values are one H5 on the field with ?", (t) => {
  const sai = newSai(t);
  const body = text(
    doc(REL, { task: { "дата а_at": "плохо", "дата б_at": "тоже плохо" } }),
  );
  sai.write(REL, body);
  sai.commit("2025-03-01T06:00:00Z");
  // Which of the two lines is named is not fixed by the design; one line, on one of them.
  const r = sai.runUnchanged();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const lines = violationLines(r.stdout);
  assert.equal(lines.length, 1, r.stdout);
  assert.match(
    lines[0],
    /^handoffs\/R-1\/step-01-a\.json:\d+ — H5: task\.\?: значение не вида ГГГГ-ММ-ДДTчч:мм:ссZ$/u,
  );
  assert.match(summaryOf(r.stdout), /нарушений 1,/u);
});

test("HC-4b the same line written in tools/traces/exceptions.tsv of the fixture is not a violation; another line of the file still is", (t) => {
  const sai = newSai(t);
  const body = text(
    doc(REL, { task: { notes: [`${MAC}${NAME}/a`, `${MAC}${NAME}/b`] } }),
  );
  sai.write(REL, body);
  const lineText = body.split("\n")[lineOf(body, "/a") - 1];
  sai.write(
    "tools/traces/exceptions.tsv",
    `# fixture\n${REL}\t${sha256(Buffer.from(lineText, "utf8"))}\tстарая запись\n`,
  );
  sai.commit("2025-03-01T06:00:00Z");
  expectLines(sai, [
    line(
      REL,
      lineOf(body, "/b"),
      "H10",
      "task.notes[1]",
      "путь домашнего каталога",
    ),
  ]);
});

test("HC-4b2 the line of an exception is found in a file with CRLF line ends (the hash is of the line without CR)", (t) => {
  const sai = newSai(t);
  const body = text(doc(REL, { task: { note: `${MAC}${NAME}/a` } })).replaceAll(
    "\n",
    "\r\n",
  );
  sai.write(REL, body);
  const lineText = body.split("\n")[lineOf(body, NAME) - 1].replace(/\r$/u, "");
  sai.write(
    "tools/traces/exceptions.tsv",
    `${REL}\t${sha256(Buffer.from(lineText, "utf8"))}\tпричина\n`,
  );
  sai.commit("2025-03-01T06:00:00Z");
  expectLines(sai, []);
});

test("HC-4c the files with H10 are exactly the handoff files about which npm run traces prints a path of a home folder", (t) => {
  const sai = newSai(t);
  const mk = (n, task) => {
    const rel = `handoffs/R-1/step-0${n}-x.json`;
    sai.writeDoc(rel, doc(rel, { task }));
    return rel;
  };
  mk(1, { d: "clean" });
  const two = mk(2, { d: `${MAC}${NAME}/a`, e: `${MAC}${NAME}/b` });
  mk(3, { d: "also clean" });
  const excepted = mk(4, { d: `${MAC}${NAME}/excepted` });
  const encoded = mk(5, { d: "-Us" + `ers-${NAME}-proj` });
  const lineText = sai
    .read(excepted)
    .toString("utf8")
    .split("\n")
    .find((l) => l.includes("excepted"));
  sai.write(
    "tools/traces/exceptions.tsv",
    `${excepted}\t${sha256(Buffer.from(lineText, "utf8"))}\tпричина\n`,
  );
  // A file outside handoffs/**/*.json: traces prints it, handoffs-check does not read it.
  sai.write("docs/note.md", `${MAC}${NAME}/doc\n`);
  sai.write("handoffs/R-1/notes.md", `${MAC}${NAME}/note\n`);
  sai.commit("2025-03-01T06:00:00Z");

  const traces = spawnSync(
    process.execPath,
    [path.join(TOOLS, "src", "traces", "cli.js"), "--root", sai.root],
    { cwd: TOOLS, env: sai.env, encoding: "utf8" },
  );
  assert.equal(traces.status, 1, traces.stdout + traces.stderr);
  const viaTraces = new Set(
    traces.stdout
      .split("\n")
      .map((l) =>
        /^(handoffs\/.+\.json):\d+: путь домашнего каталога$/u.exec(l),
      )
      .filter((m) => m !== null)
      .map((m) => m[1]),
  );
  const mine = sai.runUnchanged();
  const viaHandoffs = new Set(
    violationLines(mine.stdout)
      .map((l) => /^(\S+\.json):\d+ — H10: /u.exec(l))
      .filter((m) => m !== null)
      .map((m) => m[1]),
  );
  assert.deepEqual([...viaHandoffs].sort(), [...viaTraces].sort());
  assert.deepEqual([...viaHandoffs].sort(), [two, encoded].sort());
});

const TMP_NAME = "zqwork";

test("HC-4d a path of a temporary folder with a name after the root is H11 on the field; the path is not printed", (t) => {
  const sai = newSai(t);
  const body = text(
    doc(REL, {
      task: { note: `cd /tmp/${TMP_NAME} && ls` },
      result: {
        status: "COMPLETED",
        changes: [
          "ok",
          "/private/tmp/" + TMP_NAME + "/a",
          "(/var/folders/zz/" + TMP_NAME + "/T)",
          "/private/var/folders/zz/" + TMP_NAME,
        ],
        multi: `первая строка\n/tmp/${TMP_NAME}/b`,
      },
    }),
  );
  sai.write(REL, body);
  sai.commit("2025-03-01T06:00:00Z");
  const msg = "путь временной папки";
  const r = expectLines(sai, [
    line(REL, lineOf(body, "cd /tmp"), "H11", "task.note", msg),
    line(REL, lineOf(body, "private/tmp"), "H11", "result.changes[1]", msg),
    line(REL, lineOf(body, "(/var"), "H11", "result.changes[2]", msg),
    line(REL, lineOf(body, '"/private/var'), "H11", "result.changes[3]", msg),
    line(REL, lineOf(body, "первая строка"), "H11", "result.multi", msg),
  ]);
  assert.ok(!r.stdout.includes(TMP_NAME), r.stdout);
});

test("HC-4d2 H11 looks at the values, not at the keys", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL, { task: { [`/tmp/${TMP_NAME}`]: "value" } }));
  sai.commit("2025-03-01T06:00:00Z");
  expectLines(sai, []);
});

// Strings that are a trace of a temporary folder, and strings that are not (design 5.5).
const TEMP_YES = [
  "/tmp/x",
  "see /tmp/x",
  "(/tmp/x)",
  '"/tmp/x"',
  "'/tmp/x'",
  "a|/tmp/x",
  "<>/tmp/x",
  ">/tmp/x",
  "<a>b>/tmp/x",
  "<a> /tmp/x",
  "/private/tmp/x",
  "/private/var/folders/ab/cd",
  "/var/folders/ab/cd",
  "/tmp/.hidden",
  "/tmp/_x",
  "первый /tmp/x и <scratch>/tmp/y",
  "<scratch>/tmp/ok и потом /tmp/x",
];
const TEMP_NO = [
  "<scratch>/l1/sai",
  "<scratch>/tmp/x",
  "<scratch>/private/tmp/y",
  "<вне проекта>/var/folders/z",
  "<корень репозитория Sai>/tmp/w",
  "<a>/tmp/x",
  "<a><b>/tmp/x",
  "<scratch>/private/var/folders/q",
  `grep -rnE '${MAC}|/private/tmp|/var/folders' handoffs/`,
  "/tmp",
  "/tmp/",
  "/tmp/ x",
  "/tmp//x",
  "/tmpfoo/x",
  "/private/tmpx/y",
  "x/tmp/x",
  "src/tmp/x",
  "-/tmp/x",
  "<a/tmp/x",
  "a.b/tmp/x",
  "",
];

test("HC-4e hasTempPath: a name after the root without a placeholder is a trace; placeholders in angle brackets and the grep command are not", () => {
  for (const s of TEMP_YES) assert.equal(hasTempPath(s), true, s);
  for (const s of TEMP_NO) assert.equal(hasTempPath(s), false, s);
});

test("HC-4e2 the same strings through the command: H11 for exactly the traces, nothing for the placeholders and the grep command", (t) => {
  const sai = newSai(t);
  const body = text(
    doc(REL, {
      result: { status: "COMPLETED", all: [...TEMP_YES, ...TEMP_NO] },
    }),
  );
  sai.write(REL, body);
  sai.commit("2025-03-01T06:00:00Z");
  const expected = TEMP_YES.map(
    (_, i) => `H11: result.all[${i}]: путь временной папки`,
  );
  const r = sai.runUnchanged();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(
    violationLines(r.stdout).map((l) => l.replace(/^\S+:\d+ — /u, "")),
    expected,
  );
});

test("HC-4h hasHomePath answers as before on the table of the rules of traces (the rule is only added to, not changed)", () => {
  const yes = [
    `${MAC}anna/x`,
    `x ${MAC}anna.b`,
    "/ho" + "me/anna/x",
    "-Us" + "ers-anna-proj",
    "-ho" + "me-anna-proj",
  ];
  const no = [
    `${MAC}`,
    `${MAC} x`,
    `x${MAC}anna`,
    "/tmp/anna",
    "/home",
    "Users/anna",
  ];
  for (const s of yes) assert.equal(hasHomePath(s), true, s);
  for (const s of no) assert.equal(hasHomePath(s), false, s);
});

test("HC-4i F1 of the review of security: a long string of 200000 times '<a>/tmp/x' is answered in linear time and right", (t) => {
  const sai = newSai(t);
  const long = "<a>/tmp/x".repeat(200_000);
  const placeholders = "handoffs/R-1/step-01-long.json";
  const bare = "handoffs/R-1/step-02-long-bare.json";
  sai.writeDoc(placeholders, doc(placeholders, { task: { note: long } }));
  sai.writeDoc(bare, doc(bare, { task: { note: `${long} /tmp/x` } }));
  sai.commit("2025-03-01T06:00:00Z");
  const before = sai.tree();
  const started = Date.now();
  const r = spawnSync(process.execPath, [CLI, "--root", sai.root], {
    cwd: TOOLS,
    env: sai.env,
    encoding: "utf8",
    timeout: 20_000,
    killSignal: "SIGKILL",
  });
  const spent = Date.now() - started;
  assert.equal(sai.tree(), before);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const bodyBare = text(doc(bare, { task: { note: `${long} /tmp/x` } }));
  assert.deepEqual(violationLines(r.stdout), [
    line(
      bare,
      lineOf(bodyBare, '"note"'),
      "H11",
      "task.note",
      "путь временной папки",
    ),
  ]);
  assert.match(summaryOf(r.stdout), /файлов проверено 2, нарушений 1,/u);
  // Linear time takes well under a second; a quadratic scan of 1.8 MB with 200000 hits
  // takes minutes. The limit of 20 s is generous for a slow machine and far from that.
  assert.ok(spent < 20_000, `the command took ${spent} ms`);
});
