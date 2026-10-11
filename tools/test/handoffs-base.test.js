// REQ-038, criterion 7: the base of exceptions (design 12, HC-6a ... HC-6h, HC-7d).
// A temporary repository: the files of the base commit, a record of decisions/ with the
// line "База handoffs-check: <commit>", and a file of records. Every refusal ends with
// code 2, nothing on stdout, one line on stderr, and the tree as it was.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  BASE_FILE,
  DECISION_FILE,
  EMPTY_HASH,
  REL,
  T,
  assertStop,
  describe,
  doc,
  hashOf,
  lineOf,
  newSai,
  sha256,
  summaryOf,
  text,
  violationLines,
} from "./handoffs-helpers.js";

const BASE_AT = T("06:04:50");

// A repository whose base commit holds `files` ({ rel: doc | string }); the base is not
// pinned yet. Returns { sai, base }.
function withBase(t, files, at = BASE_AT) {
  const sai = newSai(t, { seal: false });
  for (const [rel, d] of Object.entries(files))
    sai.write(rel, typeof d === "string" ? d : text(d));
  return { sai, base: sai.commit(at) };
}

const record = (file, rule, field, hash, reason = "старое нарушение") =>
  [file, rule, field, hash, reason].join("\t");

const line = (rel, n, rule, field, message) =>
  `${rel}:${n} — ${rule}: ${field}: ${message}`;

const doneDoc = (rel = REL, over = {}) =>
  doc(rel, { status: "DONE", result: { status: "DONE" }, ...over });

const UNUSED = (n) =>
  `handoffs-check: исключение не использовано: tools/handoffs/exceptions.tsv:${n}`;

function summary(files, violations, used, total) {
  return `handoffs-check: файлов проверено ${files}, нарушений ${violations}, исключений использовано ${used} из ${total}`;
}

test("HC-6a a record for H4 on status removes that violation and counts it; the H5 of the same file stays", (t) => {
  const body = text(doneDoc(REL, { created_at: "плохо" }));
  const { sai, base } = withBase(t, { [REL]: body });
  sai.seal([record(REL, "H4", "status", hashOf("DONE"))], base);
  const r = sai.runUnchanged();
  assert.equal(r.status, 1, describe(r));
  assert.equal(r.stderr, "");
  assert.deepEqual(r.stdout.split("\n"), [
    line(
      REL,
      lineOf(body, '"created_at"'),
      "H5",
      "created_at",
      "значение не вида ГГГГ-ММ-ДДTчч:мм:ссZ",
    ),
    summary(1, 1, 1, 1),
    "",
  ]);
  // Without the record both are seen.
  sai.seal([], base);
  const bare = sai.runUnchanged();
  assert.equal(bare.status, 1);
  assert.equal(violationLines(bare.stdout).length, 2);
  assert.equal(summaryOf(bare.stdout), summary(1, 2, 0, 0));
  // With a record for each, the code is 0.
  sai.seal(
    [
      record(REL, "H4", "status", hashOf("DONE")),
      record(REL, "H5", "created_at", hashOf("плохо")),
    ],
    base,
  );
  const both = sai.runUnchanged();
  assert.equal(both.status, 0, describe(both));
  assert.equal(both.stdout, `${summary(1, 0, 2, 2)}\n`);
});

test("HC-6a2 a record covers only its own rule: a record for H5 does not remove H4 of the same field set", (t) => {
  const { sai, base } = withBase(t, { [REL]: doneDoc() });
  // A valid record of another rule cannot be written (it is checked against the base
  // commit): H5 on created_at has no value there, so its hash is not the hash of "".
  sai.seal([record(REL, "H5", "created_at", EMPTY_HASH)], base);
  const r = sai.runUnchanged();
  assert.equal(r.status, 2, describe(r));
  assertStop(
    r,
    "E_HC_BASE_ROW",
    "строка 3: значение не совпало с коммитом базы",
  );
  // The record of the right rule but another field (status of result) does not cover it.
  sai.seal([record(REL, "H4", "result.status", hashOf("DONE"))], base);
  const other = sai.runUnchanged();
  assert.equal(other.status, 1, describe(other));
  assert.equal(violationLines(other.stdout).length, 1);
  assert.equal(summaryOf(other.stdout), summary(1, 1, 0, 1));
  assert.ok(other.stdout.includes(UNUSED(3)));
});

test("HC-6b a second time added in a later commit is a new H7; the first, covered by its record, stays removed", (t) => {
  const first = { kind: "NOTE", at: T("06:05:00") };
  const { sai, base } = withBase(t, {
    [REL]: doc(REL, { result: { status: "COMPLETED", issues: [first] } }),
  });
  // The same value, written at a path without a record, in a commit made just after.
  const body = text(
    doc(REL, { result: { status: "COMPLETED", issues: [first, first] } }),
  );
  sai.write(REL, body);
  const second = sai.commit(T("06:04:55"));
  sai.seal([record(REL, "H7", "result.issues[0].at", hashOf(first.at))], base);
  const r = sai.runUnchanged();
  assert.equal(r.status, 1, describe(r));
  const n =
    body
      .split("\n")
      .findIndex(
        (l, i, all) =>
          l.includes(first.at) &&
          all.slice(0, i).some((x) => x.includes(first.at)),
      ) + 1;
  assert.deepEqual(r.stdout.split("\n"), [
    line(
      REL,
      n,
      "H7",
      "result.issues[1].at",
      `${first.at} позже коммита ${second.slice(0, 7)} (${T("06:04:55")}), в который вошло значение`,
    ),
    summary(1, 1, 1, 1),
    "",
  ]);
});

test("HC-6c a changed value of the field with a record: the violation is seen and the record is unused", (t) => {
  const { sai, base } = withBase(t, { [REL]: doneDoc() });
  sai.seal([record(REL, "H4", "status", hashOf("DONE"))], base);
  const body = text(doneDoc(REL, { status: "DONEX" }));
  sai.write(REL, body);
  sai.commit(T("07:00:00"));
  const r = sai.runUnchanged();
  assert.equal(r.status, 1, describe(r));
  assert.deepEqual(r.stdout.split("\n"), [
    line(
      REL,
      lineOf(body, '"status": "DONEX"'),
      "H4",
      "status",
      "недопустимое значение DONEX",
    ),
    UNUSED(3),
    summary(1, 1, 0, 1),
    "",
  ]);
});

test("HC-6d a record with the hash of a new value, not of the file in the base commit, is code 2 with the line of the record", (t) => {
  const { sai, base } = withBase(t, { [REL]: doneDoc() });
  sai.write(REL, text(doneDoc(REL, { status: "DONEX" })));
  sai.commit(T("07:00:00"));
  sai.seal(
    [
      record(REL, "H4", "status", hashOf("DONE")),
      record(REL, "H4", "result.status", hashOf("DONEX")),
    ],
    base,
  );
  const r = sai.runUnchanged();
  assertStop(
    r,
    "E_HC_BASE_ROW",
    "файл базы, строка 4: значение не совпало с коммитом базы",
  );
  assert.ok(!r.stderr.includes(hashOf("DONEX")));
});

test("HC-6d2 a record for a file that is not in the base commit is code 2", (t) => {
  const { sai, base } = withBase(t, { [REL]: doneDoc() });
  const later = "handoffs/R-1/step-02-b.json";
  sai.writeDoc(later, doneDoc(later));
  sai.commit(T("07:00:00"));
  sai.seal([record(later, "H4", "status", hashOf("DONE"))], base);
  assertStop(
    sai.runUnchanged(),
    "E_HC_BASE_ROW",
    "файл базы, строка 3: файла нет в коммите базы",
  );
});

test("HC-6d3 a record for a missing field matches only when the field is missing in the base commit; a record of a whole file ($) only the bytes", (t) => {
  const broken = "handoffs/R-1/step-02-broken.json";
  const brokenBytes = '{"truncated": ';
  const { sai, base } = withBase(t, {
    [REL]: doc(REL, { created_at: undefined }),
    [broken]: brokenBytes,
  });
  sai.seal(
    [
      record(REL, "H2", "created_at", EMPTY_HASH),
      record(broken, "H1", "$", sha256(brokenBytes)),
    ],
    base,
  );
  const ok = sai.runUnchanged();
  assert.equal(ok.status, 0, describe(ok));
  assert.equal(ok.stdout, `${summary(2, 0, 2, 2)}\n`);

  // The field is there in the base commit: the hash of the empty string does not match.
  const present = withBase(t, { [REL]: doc(REL) });
  present.sai.seal([record(REL, "H2", "created_at", EMPTY_HASH)], present.base);
  assertStop(present.sai.runUnchanged(), "E_HC_BASE_ROW", "строка 3");

  // A wrong hash of the whole file.
  sai.seal([record(broken, "H1", "$", sha256("другое"))], base);
  assertStop(sai.runUnchanged(), "E_HC_BASE_ROW", "строка 3");

  // A field of a base file that is not JSON cannot match.
  sai.seal([record(broken, "H2", "task", EMPTY_HASH)], base);
  assertStop(sai.runUnchanged(), "E_HC_BASE_ROW", "строка 3");
});

function otherCommit(sai) {
  sai.write("other.txt", "other\n");
  return sai.commit(T("07:30:00"));
}

test("HC-6e the header of the base differs from the record of decisions/: code 2", (t) => {
  const { sai, base } = withBase(t, { [REL]: doc(REL) });
  const other = otherCommit(sai);
  sai.seal([], base);
  sai.write(BASE_FILE, `# база: ${other}\n`);
  assertStop(
    sai.runUnchanged(),
    "E_HC_BASE_COMMIT",
    "шапка базы не совпала с записью decisions/",
  );
});

test("HC-6e2 a record of decisions/ with a larger number and a new commit while the header is old: code 2; with the header moved too: the base moves", (t) => {
  const { sai, base } = withBase(t, { [REL]: doc(REL) });
  const other = otherCommit(sai);
  sai.seal([], base);
  sai.write("decisions/0099-shift.md", `База handoffs-check: ${other}\n`);
  assertStop(
    sai.runUnchanged(),
    "E_HC_BASE_COMMIT",
    "шапка базы не совпала с записью decisions/",
  );
  sai.write(BASE_FILE, `# база: ${other}\n`);
  const moved = sai.runUnchanged();
  assert.equal(moved.status, 0, describe(moved));
});

test("HC-6e3 a larger-numbered record without the line is passed over; the largest record that has the line counts", (t) => {
  const { sai, base } = withBase(t, { [REL]: doc(REL) });
  const other = otherCommit(sai);
  sai.seal([], base);
  sai.write("decisions/0099-nothing.md", "# no line here\n");
  const r = sai.runUnchanged();
  assert.equal(r.status, 0, describe(r));
  // A record with the line and a number between them: it is the largest that has it.
  sai.write("decisions/0040-middle.md", `База handoffs-check: ${other}\n`);
  assertStop(
    sai.runUnchanged(),
    "E_HC_BASE_COMMIT",
    "шапка базы не совпала с записью decisions/",
  );
});

test("HC-6e4 the commit of the base is not an ancestor of HEAD, or does not exist: code 2", (t) => {
  const { sai } = withBase(t, { [REL]: doc(REL) });
  const mainBranch = sai.git("rev-parse", "--abbrev-ref", "HEAD").trim();
  sai.git("checkout", "-q", "-b", "side");
  sai.write("side.txt", "side\n");
  const side = sai.commit(T("07:00:00"));
  sai.git("checkout", "-q", mainBranch);
  sai.write("main.txt", "main\n");
  sai.commit(T("07:10:00"));
  sai.seal([], side);
  assertStop(
    sai.runUnchanged(),
    "E_HC_BASE_COMMIT",
    "коммит базы — не предок HEAD",
  );
  sai.seal([], "0".repeat(40));
  assertStop(sai.runUnchanged(), "E_HC_BASE_COMMIT", "нет такого коммита базы");
});

test("HC-6e5 the line of the record: none, two different commits in one record, two records of one number, a line that is not whole", (t) => {
  const { sai, base } = withBase(t, { [REL]: doc(REL) });
  const other = otherCommit(sai);
  const reset = () => {
    sai.seal([], base);
    for (const f of fs.readdirSync(path.join(sai.root, "decisions")))
      if (f !== path.basename(DECISION_FILE))
        fs.rmSync(path.join(sai.root, "decisions", f));
  };
  // No line at all.
  reset();
  sai.write(DECISION_FILE, "# no line\n");
  assertStop(sai.runUnchanged(), "E_HC_DECISION", "нет строки");
  // Two different commits in the record of the largest number.
  reset();
  sai.write(
    DECISION_FILE,
    `База handoffs-check: ${base}\nБаза handoffs-check: ${other}\n`,
  );
  assertStop(sai.runUnchanged(), "E_HC_DECISION", "несколько разных коммитов");
  // Two records of one number with different commits.
  reset();
  sai.write("decisions/0036-second.md", `База handoffs-check: ${other}\n`);
  assertStop(sai.runUnchanged(), "E_HC_DECISION", "несколько разных коммитов");
  // The same commit twice, trailing spaces and CRLF are allowed.
  reset();
  sai.write(
    DECISION_FILE,
    `База handoffs-check: ${base}  \r\nБаза handoffs-check: ${base}\n`,
  );
  const ok = sai.runUnchanged();
  assert.equal(ok.status, 0, describe(ok));
  // A line with markup, a full stop, or a short hash is not the line.
  for (const bad of [
    `- База handoffs-check: ${base}`,
    `База handoffs-check: ${base}.`,
    `База handoffs-check: ${base.slice(0, 12)}`,
    `база handoffs-check: ${base}`,
    `База handoffs-check: ${base.toUpperCase()}`,
  ]) {
    reset();
    sai.write(DECISION_FILE, `${bad}\n`);
    assertStop(sai.runUnchanged(), "E_HC_DECISION", "нет строки");
  }
  // No folder decisions/.
  reset();
  fs.rmSync(path.join(sai.root, "decisions"), { recursive: true });
  assertStop(sai.runUnchanged(), "E_HC_DECISION");
});

// A bad record at line 3 of the file of records (two comment lines before it).
const BAD_ROWS = [
  ["only four fields", (h) => `${REL}\tH4\tstatus\t${h}`],
  ["six fields", (h) => `${REL}\tH4\tstatus\t${h}\tr\tx`],
  ["empty reason", (h) => `${REL}\tH4\tstatus\t${h}\t`],
  ["blank reason", (h) => `${REL}\tH4\tstatus\t${h}\t   `],
  [
    "reason of 301 characters",
    (h) => `${REL}\tH4\tstatus\t${h}\t${"я".repeat(301)}`,
  ],
  ["hash of 63 characters", (h) => `${REL}\tH4\tstatus\t${h.slice(1)}\tr`],
  ["hash in capitals", (h) => `${REL}\tH4\tstatus\t${h.toUpperCase()}\tr`],
  ["hash not hex", () => `${REL}\tH4\tstatus\t${"z".repeat(64)}\tr`],
  ["empty field", (h) => `${REL}\tH4\t\t${h}\tr`],
  ["field with a space", (h) => `${REL}\tH4\ta b\t${h}\tr`],
  ["field with two points", (h) => `${REL}\tH4\ta..b\t${h}\tr`],
  ["field that is an index", (h) => `${REL}\tH4\t[0]\t${h}\tr`],
  ["index with a zero", (h) => `${REL}\tH4\ta[01]\t${h}\tr`],
  ["field with a question mark", (h) => `${REL}\tH4\ta.?\t${h}\tr`],
  ["rule H10", (h) => `${REL}\tH10\tstatus\t${h}\tr`],
  ["rule H12", (h) => `${REL}\tH12\tstatus\t${h}\tr`],
  ["rule in lower case", (h) => `${REL}\th4\tstatus\t${h}\tr`],
  ["empty rule", (h) => `${REL}\t\tstatus\t${h}\tr`],
  ["file outside handoffs/", (h) => `docs/x.json\tH4\tstatus\t${h}\tr`],
  ["file that is not json", (h) => `handoffs/R-1/a.md\tH4\tstatus\t${h}\tr`],
  ["file with ..", (h) => `handoffs/../x.json\tH4\tstatus\t${h}\tr`],
  ["file with an empty part", (h) => `handoffs//x.json\tH4\tstatus\t${h}\tr`],
  ["file with a backslash", (h) => `handoffs\\x.json\tH4\tstatus\t${h}\tr`],
  ["file from the root", (h) => `/handoffs/x.json\tH4\tstatus\t${h}\tr`],
];

test("HC-6f a broken record is code 2 with the number of its line; no value of the record is printed", (t) => {
  const { sai, base } = withBase(t, { [REL]: doneDoc() });
  for (const [name, make] of BAD_ROWS) {
    sai.seal([make(hashOf("DONE"))], base);
    const r = sai.runUnchanged();
    assertStop(r, "E_HC_BASE_ROW", "файл базы, строка 3: ");
    assert.ok(!r.stderr.includes(hashOf("DONE")), name);
  }
  // A repeated triple: the line of the second record.
  const good = record(REL, "H4", "status", hashOf("DONE"));
  sai.seal(
    [good, record(REL, "H4", "status", hashOf("DONE"), "другая причина")],
    base,
  );
  assertStop(sai.runUnchanged(), "E_HC_BASE_ROW", "строка 4: повтор записи");
  // A reason of exactly 300 characters (not bytes) is allowed.
  sai.seal(
    [record(REL, "H4", "status", hashOf("DONE"), "я".repeat(300))],
    base,
  );
  const ok = sai.runUnchanged();
  assert.equal(ok.status, 0, describe(ok));
  // Comment lines and empty lines before the records do not move the number.
  sai.write(
    BASE_FILE,
    `# a\n\n# база: ${base}\n\n# b\n${record(REL, "H4", "status", hashOf("DONE"), "я".repeat(301))}\n`,
  );
  assertStop(sai.runUnchanged(), "E_HC_BASE_ROW", "строка 6: ");
});

test("HC-6f2 the header of the base: no file, none, two, a malformed one, a file that is not UTF-8", (t) => {
  const { sai, base } = withBase(t, { [REL]: doneDoc() });
  sai.seal([], base);
  fs.rmSync(path.join(sai.root, BASE_FILE));
  assertStop(sai.runUnchanged(), "E_HC_BASE_HEADER", "нет файла базы");
  sai.write(BASE_FILE, "# only a comment\n");
  assertStop(sai.runUnchanged(), "E_HC_BASE_HEADER", "нет строки");
  sai.write(BASE_FILE, `# база: ${base}\n# база: ${base}\n`);
  assertStop(sai.runUnchanged(), "E_HC_BASE_HEADER", "больше одной");
  for (const bad of [
    `# база: ${base.slice(0, 39)}`,
    `# база: ${base.toUpperCase()}`,
    `# база:${base}`,
    `#база: ${base}`,
    `# база: ${base} `,
  ]) {
    sai.write(BASE_FILE, `${bad}\n`);
    assertStop(sai.runUnchanged(), "E_HC_BASE_HEADER");
  }
  sai.write(
    BASE_FILE,
    Buffer.concat([
      Buffer.from(`# база: ${base}\n`),
      Buffer.from([0xff, 0xfe, 0x0a]),
    ]),
  );
  assertStop(sai.runUnchanged(), "E_HC_BASE_ROW", "строка 1: не UTF-8");
  // A folder instead of the file.
  fs.rmSync(path.join(sai.root, BASE_FILE));
  fs.mkdirSync(path.join(sai.root, BASE_FILE));
  assertStop(sai.runUnchanged(), "E_HC_BASE_HEADER", "не читается");
});

test("HC-6g an extra record is a line 'исключение не использовано' before the summary; the code is that of the other violations", (t) => {
  const files = {};
  const rows = [];
  for (let i = 1; i <= 10; i++) {
    const rel = `handoffs/R-1/step-${String(i).padStart(2, "0")}-a.json`;
    files[rel] = text(doneDoc(rel));
    rows.push(record(rel, "H4", "status", hashOf("DONE")));
  }
  const { sai, base } = withBase(t, files);
  sai.seal(rows, base);
  // All ten files are put right: every record is unused.
  for (const rel of Object.keys(files)) sai.writeDoc(rel, doc(rel));
  sai.commit(T("07:00:00"));
  const r = sai.runUnchanged();
  assert.equal(r.status, 0, describe(r));
  const expected = [];
  for (let n = 3; n <= 12; n++) expected.push(UNUSED(n));
  assert.deepEqual(r.stdout.split("\n"), [
    ...expected,
    summary(10, 0, 0, 10),
    "",
  ]);
  // With a violation not covered the code is 1 and the order is: violation, unused, summary.
  const extra = "handoffs/R-1/step-11-b.json";
  sai.writeDoc(extra, doneDoc(extra));
  const again = sai.runUnchanged();
  assert.equal(again.status, 1, describe(again));
  const lines = again.stdout.split("\n").filter((l) => l !== "");
  assert.ok(lines[0].startsWith(`${extra}:`));
  assert.equal(lines[1], UNUSED(3));
  assert.equal(lines[lines.length - 1], summary(11, 1, 0, 10));
});

// Five (and more) kinds of old violations, all in the base commit.
function oldViolations(t, { home = false } = {}) {
  const files = {};
  const add = (name, d) => {
    const rel = `handoffs/R-1/step-${name}.json`;
    files[rel] = typeof d === "function" ? text(d(rel)) : d;
    return rel;
  };
  add("01-trunc", '{"truncated": ');
  add("02-fields", (rel) =>
    doc(rel, {
      created_at: undefined,
      task: undefined,
      context: { note: "cd /tmp/zqwork" },
    }),
  );
  const done = add("03-done", (rel) => doneDoc(rel));
  add("04-time", (rel) =>
    doc(rel, { created_at: "плохо", completed_at: T("06:05:00") }),
  );
  add("05-corr", (rel) => doc(rel, { orch_note: "текст" }));
  add("06-dup", (rel) =>
    doc(rel, { handoff_id: `h-${done.split("/").slice(1).join("-")}` }),
  );
  add("07-order", (rel) =>
    doc(rel, { started_at: T("05:30:00"), completed_at: T("05:00:00") }),
  );
  add("08-pending", (rel) =>
    doc(rel, { status: "PENDING", completed_at: null, result: null }),
  );
  if (home)
    add("09-home", (rel) =>
      doc(rel, { task: { description: `${"/Us" + "ers/"}zqbob/x` } }),
    );
  return withBase(t, files);
}

test("HC-6h --emit-exceptions prints only records, in order; appended under the header they take every violation off", (t) => {
  const { sai, base } = oldViolations(t);
  sai.seal([], base);
  const normal = sai.runUnchanged();
  assert.equal(normal.status, 1, describe(normal));
  const printed = violationLines(normal.stdout);
  const m = Number(/нарушений (\d+),/u.exec(summaryOf(normal.stdout))[1]);
  assert.equal(printed.length, m);
  assert.ok(m >= 10, `fixture of ${m} violations`);

  const emit = sai.runUnchanged(["--emit-exceptions"]);
  assert.equal(emit.status, 0, describe(emit));
  assert.equal(emit.stderr, "");
  const rows = emit.stdout.split("\n").filter((l) => l !== "");
  assert.equal(rows.length, m);
  assert.ok(rows.every((l) => !l.startsWith("handoffs-check:")));
  assert.ok(rows.every((l) => !l.startsWith("#")));
  const parsed = rows.map((l) => {
    const f = l.split("\t");
    assert.equal(f.length, 5, l);
    assert.match(f[0], /^handoffs\/.+\.json$/u);
    assert.match(f[1], /^H(?:[1-9]|11)$/u);
    assert.match(f[3], /^[0-9a-f]{64}$/u);
    assert.ok(f[4].length > 0 && f[4].length <= 300);
    return { file: f[0], rule: Number(f[1].slice(1)), field: f[2] };
  });
  // The order: path (bytes), number of the rule (as a number), path of the field (bytes).
  const bytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
  for (let i = 1; i < parsed.length; i++) {
    const a = parsed[i - 1];
    const b = parsed[i];
    assert.ok(
      bytes(a.file, b.file) < 0 ||
        (a.file === b.file &&
          (a.rule < b.rule ||
            (a.rule === b.rule && bytes(a.field, b.field) < 0))),
      `${JSON.stringify(a)} before ${JSON.stringify(b)}`,
    );
  }
  const fields = parsed.filter((p) => p.file.includes("02-fields"));
  assert.deepEqual(
    fields.map((p) => `H${p.rule}:${p.field}`),
    ["H2:created_at", "H2:task", "H11:context.note"],
  );

  // Appended under the header: every violation is covered and used.
  const header = fs.readFileSync(path.join(sai.root, BASE_FILE), "utf8");
  sai.write(BASE_FILE, `${header}${emit.stdout}`);
  const after = sai.runUnchanged();
  assert.equal(after.status, 0, describe(after));
  assert.equal(after.stdout, `${summary(8, 0, m, m)}\n`);
});

test("HC-6h2 --emit-exceptions prints no H10, only records not covered by the base, and nothing when there is nothing to print", (t) => {
  const { sai, base } = oldViolations(t, { home: true });
  sai.seal([], base);
  const normal = sai.runUnchanged();
  const h10 = violationLines(normal.stdout).filter((l) =>
    l.includes(" — H10: "),
  );
  assert.equal(h10.length, 1);
  const m = violationLines(normal.stdout).length;
  const emit = sai.runUnchanged(["--emit-exceptions"]);
  assert.equal(emit.status, 0);
  assert.ok(!emit.stdout.includes("\tH10\t"));
  assert.equal(emit.stdout.split("\n").filter((l) => l !== "").length, m - 1);
  // With the records appended only H10 is left, and the code is 1.
  const header = fs.readFileSync(path.join(sai.root, BASE_FILE), "utf8");
  sai.write(BASE_FILE, `${header}${emit.stdout}`);
  const left = sai.runUnchanged();
  assert.equal(left.status, 1);
  assert.deepEqual(violationLines(left.stdout).length, 1);
  assert.ok(left.stdout.includes(" — H10: "));
  // A record already in the base is not printed again.
  const first = emit.stdout.split("\n")[0];
  const f = first.split("\t");
  sai.write(BASE_FILE, `${header}${first}\n`);
  const rest = sai.runUnchanged(["--emit-exceptions"]);
  assert.equal(rest.status, 0);
  assert.ok(
    !rest.stdout
      .split("\n")
      .some((l) => l.startsWith(`${f[0]}\t${f[1]}\t${f[2]}\t`)),
  );
  assert.equal(rest.stdout.split("\n").filter((l) => l !== "").length, m - 2);
  // Nothing to print: empty stdout, code 0.
  const clean = newSai(t);
  clean.writeDoc(REL, doc(REL));
  clean.commit(T("06:00:00"));
  const none = clean.runUnchanged(["--emit-exceptions"]);
  assert.equal(none.status, 0);
  assert.equal(none.stdout, "");
  assert.equal(none.stderr, "");
});

test("HC-6h3 --emit-exceptions on a broken base is code 2 with nothing on stdout", (t) => {
  const { sai, base } = oldViolations(t);
  sai.seal([record(REL, "H4", "status", hashOf("DONE"))], base);
  assertStop(
    sai.runUnchanged(["--emit-exceptions"]),
    "E_HC_BASE_ROW",
    "файла нет в коммите базы",
  );
});

test("HC-7d an empty base on five kinds of violations: M of the summary equals the number of records printed and the number L after they are appended", (t) => {
  const { sai, base } = oldViolations(t);
  sai.seal([], base);
  const normal = sai.runUnchanged();
  assert.equal(normal.status, 1);
  const summaryLine = summaryOf(normal.stdout);
  const m = Number(/нарушений (\d+),/u.exec(summaryLine)[1]);
  assert.match(summaryLine, /исключений использовано 0 из 0$/u);
  const emit = sai.runUnchanged(["--emit-exceptions"]);
  const records = emit.stdout.split("\n").filter((l) => l !== "");
  assert.equal(records.length, m);
  const header = fs.readFileSync(path.join(sai.root, BASE_FILE), "utf8");
  sai.write(BASE_FILE, `${header}${emit.stdout}`);
  const full = sai.runUnchanged();
  assert.equal(full.status, 0);
  const total = fs
    .readFileSync(path.join(sai.root, BASE_FILE), "utf8")
    .split("\n")
    .filter((l) => l !== "" && !l.startsWith("#")).length;
  assert.equal(total, m);
  assert.equal(summaryOf(full.stdout), summary(8, 0, total, total));
});
