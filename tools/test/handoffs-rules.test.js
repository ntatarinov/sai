// REQ-038, criterion 2: the rules H1-H6 and H8 on fixtures (design 12, HC-2a ... HC-2i).
// Every case has its own temporary git repository; a refusal ends with code 1 and the
// files of the fixture are as they were (hashes of the whole tree before and after).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NOW,
  REL,
  T,
  doc,
  lineOf,
  newSai,
  summaryOf,
  text,
  violationLines,
} from "./handoffs-helpers.js";

const AT = T("06:00:00");

// Writes the files ({ rel: doc | string | Buffer }) and commits them.
function commitFiles(sai, files, at = AT) {
  for (const [rel, d] of Object.entries(files))
    sai.write(rel, typeof d === "object" && !Buffer.isBuffer(d) ? text(d) : d);
  return sai.commit(at);
}

// The command must stop with code `status` and print exactly these violation lines.
function expectLines(sai, expected, status = expected.length > 0 ? 1 : 0) {
  const r = sai.runUnchanged();
  assert.equal(r.status, status, r.stdout + r.stderr);
  assert.equal(r.stderr, "");
  assert.deepEqual(violationLines(r.stdout), expected);
  assert.match(
    summaryOf(r.stdout),
    new RegExp(`нарушений ${expected.length},`, "u"),
  );
  return r;
}

const at = (rel, line, rule, field, message) =>
  `${rel}:${line} — ${rule}: ${field}: ${message}`;

test("HC-2a a truncated JSON is H1 on line 1 with the field $, code 1; the other files go on", (t) => {
  const sai = newSai(t);
  const good = "handoffs/R-1/step-02-b.json";
  commitFiles(sai, {
    [REL]: '{"handoff_id": "x", "run',
    [good]: doc(good, { created_at: undefined }),
  });
  expectLines(sai, [
    at(REL, 1, "H1", "$", "файл не читается как JSON: ошибка разбора JSON"),
    at(good, 1, "H2", "created_at", "нет поля"),
  ]);
});

test("HC-2a2 every reason of H1: empty, not UTF-8, not an object, BOM, too deep, too large; no text of the parser", (t) => {
  const sai = newSai(t);
  const files = {
    "handoffs/R-1/step-01-empty.json": "",
    "handoffs/R-1/step-02-latin.json": Buffer.from([
      0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d,
    ]),
    "handoffs/R-1/step-03-array.json": "[1, 2]\n",
    "handoffs/R-1/step-04-null.json": "null\n",
    "handoffs/R-1/step-05-bom.json": Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(text(doc("handoffs/R-1/step-05-bom.json"))),
    ]),
    "handoffs/R-1/step-06-deep.json": `${"[".repeat(300)}${"]".repeat(300)}`,
    "handoffs/R-1/step-07-big.json": `{"a":"${"x".repeat(16 * 1024 * 1024)}"}`,
    "handoffs/R-1/step-08-text.json": "not json at all\n",
  };
  commitFiles(sai, files);
  const reason = (rel, why) =>
    at(rel, 1, "H1", "$", `файл не читается как JSON: ${why}`);
  const r = expectLines(sai, [
    reason("handoffs/R-1/step-01-empty.json", "файл пуст"),
    reason("handoffs/R-1/step-02-latin.json", "не UTF-8"),
    reason("handoffs/R-1/step-03-array.json", "верхний уровень — не объект"),
    reason("handoffs/R-1/step-04-null.json", "верхний уровень — не объект"),
    reason("handoffs/R-1/step-05-bom.json", "ошибка разбора JSON"),
    reason("handoffs/R-1/step-06-deep.json", "ошибка разбора JSON"),
    reason("handoffs/R-1/step-07-big.json", "файл больше 16 МиБ"),
    reason("handoffs/R-1/step-08-text.json", "ошибка разбора JSON"),
  ]);
  assert.doesNotMatch(r.stdout, /Unexpected|token|position/iu);
});

test("HC-2b a missing created_at is H2 on line 1; created_at and task missing are two lines", (t) => {
  const sai = newSai(t);
  commitFiles(sai, { [REL]: doc(REL, { created_at: undefined }) });
  expectLines(sai, [at(REL, 1, "H2", "created_at", "нет поля")]);
  commitFiles(sai, {
    [REL]: doc(REL, { created_at: undefined, task: undefined }),
  });
  expectLines(sai, [
    at(REL, 1, "H2", "created_at", "нет поля"),
    at(REL, 1, "H2", "task", "нет поля"),
  ]);
});

test("HC-2b2 H2 asks for the key, not for a value: null counts as present, every missing field is its own line", (t) => {
  const sai = newSai(t);
  const all = Object.keys(doc());
  commitFiles(sai, {
    [REL]: doc(REL, {
      context: null,
      task: null,
      started_at: null,
      step: undefined,
      workflow_id: undefined,
    }),
  });
  assert.equal(all.length, 14);
  expectLines(sai, [
    at(REL, 1, "H2", "step", "нет поля"),
    at(REL, 1, "H2", "workflow_id", "нет поля"),
  ]);
});

test("HC-2c file, run_id and a repeated handoff_id are three lines of H3", (t) => {
  const sai = newSai(t);
  const a = "handoffs/R-1/step-01-a.json";
  const b = "handoffs/R-1/step-02-b.json";
  const docB = doc(b, {
    handoff_id: "dup",
    file: "handoffs/R-1/other.json",
    run_id: "R-2",
  });
  commitFiles(sai, { [a]: doc(a, { handoff_id: "dup" }), [b]: docB });
  const body = text(docB);
  expectLines(sai, [
    at(
      b,
      lineOf(body, '"handoff_id"'),
      "H3",
      "handoff_id",
      `повтор handoff_id, первый — ${a}`,
    ),
    at(
      b,
      lineOf(body, '"run_id"'),
      "H3",
      "run_id",
      "run_id не равен имени папки прогона",
    ),
    at(b, lineOf(body, '"file"'), "H3", "file", "file не равен пути файла"),
  ]);
});

test("HC-2c2 three files with one handoff_id: the second and the third are violations, the first is not", (t) => {
  const sai = newSai(t);
  const names = ["step-01-a", "step-02-b", "step-03-c"].map(
    (n) => `handoffs/R-1/${n}.json`,
  );
  const files = {};
  for (const rel of names) files[rel] = doc(rel, { handoff_id: "same" });
  commitFiles(sai, files);
  const body = text(doc(names[1], { handoff_id: "same" }));
  const line = lineOf(body, '"handoff_id"');
  expectLines(sai, [
    at(
      names[1],
      line,
      "H3",
      "handoff_id",
      `повтор handoff_id, первый — ${names[0]}`,
    ),
    at(
      names[2],
      line,
      "H3",
      "handoff_id",
      `повтор handoff_id, первый — ${names[0]}`,
    ),
  ]);
});

test("HC-2c3 a file without the keys file, run_id and handoff_id gives only H2; a null or a number there is checked by H3", (t) => {
  const sai = newSai(t);
  commitFiles(sai, {
    [REL]: doc(REL, {
      file: undefined,
      run_id: undefined,
      handoff_id: undefined,
    }),
  });
  expectLines(sai, [
    at(REL, 1, "H2", "file", "нет поля"),
    at(REL, 1, "H2", "handoff_id", "нет поля"),
    at(REL, 1, "H2", "run_id", "нет поля"),
  ]);
  const other = "handoffs/R-2/step-01-a.json";
  const body = text(doc(other, { file: null, run_id: 5 }));
  commitFiles(sai, {
    [REL]: doc(REL),
    [other]: body,
  });
  expectLines(sai, [
    at(
      other,
      lineOf(body, '"run_id"'),
      "H3",
      "run_id",
      "run_id не равен имени папки прогона",
    ),
    at(other, lineOf(body, '"file"'), "H3", "file", "file не равен пути файла"),
  ]);
});

test("HC-2c4 a file right in handoffs/ has no folder of a run; a handoff_id that is not a string is no repeat", (t) => {
  const sai = newSai(t);
  const loose = "handoffs/loose.json";
  const body = text(doc(loose, { run_id: "loose", handoff_id: 7 }));
  commitFiles(sai, {
    [loose]: body,
    [REL]: doc(REL, { handoff_id: 7 }),
  });
  expectLines(sai, [
    at(
      loose,
      lineOf(body, '"run_id"'),
      "H3",
      "run_id",
      "у файла нет папки прогона",
    ),
  ]);
});

test("HC-2d DONE in a commit is H4; PENDING in a commit is H4; the same PENDING as a new file is not", (t) => {
  const sai = newSai(t);
  const done = "handoffs/R-1/step-01-a.json";
  const pending = "handoffs/R-1/step-02-b.json";
  const doneBody = text(
    doc(done, { status: "DONE", result: { status: "DONE" } }),
  );
  const pendingDoc = doc(pending, {
    status: "PENDING",
    completed_at: null,
    result: null,
  });
  commitFiles(sai, { [done]: doneBody, [pending]: pendingDoc });
  const pendingBody = text(pendingDoc);
  expectLines(sai, [
    at(
      done,
      lineOf(doneBody, '"status": "DONE"'),
      "H4",
      "status",
      "недопустимое значение DONE",
    ),
    at(
      pending,
      lineOf(pendingBody, '"status": "PENDING"'),
      "H4",
      "status",
      "PENDING в коммите: в коммите только законченные handoff-ы",
    ),
  ]);
  // The same PENDING written as a new file, not committed: no violation.
  const fresh = "handoffs/R-1/step-03-c.json";
  const sai2 = newSai(t);
  sai2.writeDoc(
    fresh,
    doc(fresh, { status: "PENDING", completed_at: null, result: null }),
  );
  expectLines(sai2, []);
});

test("HC-2d2 a committed PENDING or IN_PROGRESS changed in the work tree is work in progress, not a violation", (t) => {
  const sai = newSai(t);
  const p = "handoffs/R-1/step-01-a.json";
  const q = "handoffs/R-1/step-02-b.json";
  const pending = { status: "PENDING", completed_at: null, result: null };
  commitFiles(sai, { [p]: doc(p, pending), [q]: doc(q, pending) });
  // p is changed, q is not.
  sai.writeDoc(p, doc(p, { ...pending, status: "IN_PROGRESS" }));
  const r = expectLines(sai, [
    at(
      q,
      lineOf(text(doc(q, pending)), '"status": "PENDING"'),
      "H4",
      "status",
      "PENDING в коммите: в коммите только законченные handoff-ы",
    ),
  ]);
  assert.doesNotMatch(r.stdout, /step-01-a/u);
});

test("HC-2d3 a status that is not a word is refused and its value is not printed", (t) => {
  const sai = newSai(t);
  const body = text(
    doc(REL, { status: "secret-value-123", result: { status: "x" } }),
  );
  commitFiles(sai, { [REL]: body });
  const r = expectLines(sai, [
    at(
      REL,
      lineOf(body, '"status": "secret'),
      "H4",
      "status",
      "недопустимое значение значение не из списка",
    ),
  ]);
  assert.doesNotMatch(r.stdout, /secret-value/u);
  const sai2 = newSai(t);
  const lower = text(doc(REL, { status: 5 }));
  commitFiles(sai2, { [REL]: lower });
  expectLines(sai2, [
    at(
      REL,
      lineOf(lower, '"status": 5'),
      "H4",
      "status",
      "недопустимое значение значение не из списка",
    ),
  ]);
});

const STOP = {
  status: "IN_PROGRESS",
  completed_at: null,
};

test("HC-2e a stop IN_PROGRESS with the first issue BLOCKED is no violation; without it, or with other faults, it is H4", (t) => {
  const blocked = { kind: "BLOCKED", at: T("05:20:00"), text: "stop" };
  const ok = newSai(t);
  commitFiles(ok, {
    [REL]: doc(REL, {
      ...STOP,
      result: { status: "IN_PROGRESS", issues: [blocked] },
    }),
  });
  expectLines(ok, []);

  const note = newSai(t);
  const noteBody = text(
    doc(REL, {
      ...STOP,
      result: {
        status: "IN_PROGRESS",
        issues: [{ kind: "NOTE", at: T("05:20:00") }, blocked],
      },
    }),
  );
  commitFiles(note, { [REL]: noteBody });
  const msg =
    "у остановки IN_PROGRESS первая запись issues — не «BLOCKED» с at";
  expectLines(note, [
    at(REL, lineOf(noteBody, '"issues"'), "H4", "result.issues", msg),
  ]);

  const noAt = newSai(t);
  const noAtBody = text(
    doc(REL, {
      ...STOP,
      result: { status: "IN_PROGRESS", issues: [{ kind: "BLOCKED" }] },
    }),
  );
  commitFiles(noAt, { [REL]: noAtBody });
  expectLines(noAt, [
    at(REL, lineOf(noAtBody, '"issues"'), "H4", "result.issues", msg),
  ]);

  const done = newSai(t);
  const doneBody = text(
    doc(REL, {
      status: "IN_PROGRESS",
      completed_at: T("05:30:00"),
      result: { status: "IN_PROGRESS", issues: [blocked] },
    }),
  );
  commitFiles(done, { [REL]: doneBody });
  expectLines(done, [
    at(
      REL,
      lineOf(doneBody, '"completed_at"'),
      "H4",
      "completed_at",
      "у остановки IN_PROGRESS completed_at не null",
    ),
  ]);
});

test("HC-2e2 IN_PROGRESS in a commit without a stop result is H4 on status", (t) => {
  const sai = newSai(t);
  const none = "handoffs/R-1/step-01-a.json";
  const other = "handoffs/R-1/step-02-b.json";
  const noneBody = text(doc(none, { ...STOP, result: null }));
  const otherBody = text(
    doc(other, { ...STOP, result: { status: "COMPLETED" } }),
  );
  commitFiles(sai, { [none]: noneBody, [other]: otherBody });
  const msg = "IN_PROGRESS в коммите: в коммите только законченные handoff-ы";
  expectLines(sai, [
    at(none, lineOf(noneBody, '"status": "IN_PROGRESS"'), "H4", "status", msg),
    at(
      other,
      lineOf(otherBody, '"status": "IN_PROGRESS"'),
      "H4",
      "status",
      msg,
    ),
  ]);
});

test("HC-2f COMPLETED with result.status FAILED is H4; a result that is not an object is H4; FAILED is allowed", (t) => {
  const sai = newSai(t);
  const a = "handoffs/R-1/step-01-a.json";
  const b = "handoffs/R-1/step-02-b.json";
  const c = "handoffs/R-1/step-03-c.json";
  const d = "handoffs/R-1/step-04-d.json";
  const aBody = text(doc(a, { result: { status: "FAILED" } }));
  const bBody = text(doc(b, { result: "text" }));
  commitFiles(sai, {
    [a]: aBody,
    [b]: bBody,
    [c]: doc(c, { status: "FAILED", result: { status: "FAILED" } }),
    [d]: doc(d, { result: { summary: "no status" } }),
  });
  expectLines(sai, [
    at(
      a,
      lineOf(aBody, '"status": "FAILED"'),
      "H4",
      "result.status",
      "result.status (FAILED) не равен status (COMPLETED)",
    ),
    at(
      b,
      lineOf(bBody, '"result"'),
      "H4",
      "result",
      "result не объект при COMPLETED",
    ),
    at(
      d,
      1,
      "H4",
      "result.status",
      "result.status (значение не из списка) не равен status (COMPLETED)",
    ),
  ]);
});

test("HC-2f2 CANCELLED without orch_cancellation is H4; with it, and with completed_at and result null, it is not", (t) => {
  const cancelled = { status: "CANCELLED", completed_at: null, result: null };
  const ok = newSai(t);
  commitFiles(ok, {
    [REL]: doc(REL, {
      ...cancelled,
      orch_cancellation: { at: T("05:40:00"), reason: "не нужен" },
    }),
  });
  expectLines(ok, []);

  for (const bad of [
    undefined,
    "text",
    { at: T("05:40:00") },
    { at: T("05:40:00"), reason: "" },
    { reason: "r" },
  ]) {
    const sai = newSai(t);
    const body = text(doc(REL, { ...cancelled, orch_cancellation: bad }));
    commitFiles(sai, { [REL]: body });
    expectLines(sai, [
      at(
        REL,
        bad === undefined ? 1 : lineOf(body, '"orch_cancellation"'),
        "H4",
        "orch_cancellation",
        "нет orch_cancellation с at и reason",
      ),
    ]);
  }
});

test("HC-2g completed_at 2026-10-03T18:00Z is H5; a missing seconds, a wrong date and a number are H5", (t) => {
  const cases = [
    "2026-10-03T18:00Z",
    "2025-02-30T10:00:00Z",
    "2025-03-01T24:00:00Z",
    "2025-03-01 05:30:00Z",
    "2025-03-01T05:30:00+05:00",
    "2025-03-01T05:30:00.000Z",
    "2025-03-01T05:30:00",
    "2025-03-01T05:30:00z",
    "2025-03-01",
    " 2025-03-01T05:30:00Z",
    "2025-03-01T05:30:00Z ",
    "2025-3-1T5:30:00Z",
    5,
    true,
    {},
  ];
  for (const value of cases) {
    const sai = newSai(t);
    const body = text(doc(REL, { completed_at: value }));
    commitFiles(sai, { [REL]: body });
    const r = expectLines(sai, [
      at(
        REL,
        lineOf(body, '"completed_at"'),
        "H5",
        "completed_at",
        "значение не вида ГГГГ-ММ-ДДTчч:мм:ссZ",
      ),
    ]);
    assert.doesNotMatch(r.stdout, /2026-10-03/u);
  }
});

test("HC-2g2 the word 'неизвестно' at the start is a time that is not known; 'неизвестное' is not", (t) => {
  const ok = newSai(t);
  commitFiles(ok, {
    [REL]: doc(REL, {
      created_at: "неизвестно: файла не было",
      started_at: "неизвестно",
      completed_at: "неизвестно, записано позже",
    }),
  });
  expectLines(ok, []);
  for (const word of [
    "неизвестное время",
    "неизвестно2",
    "Неизвестно",
    "x неизвестно",
  ]) {
    const sai = newSai(t);
    const body = text(doc(REL, { created_at: word }));
    commitFiles(sai, { [REL]: body });
    expectLines(sai, [
      at(
        REL,
        lineOf(body, '"created_at"'),
        "H5",
        "created_at",
        "значение не вида ГГГГ-ММ-ДДTчч:мм:ссZ",
      ),
    ]);
  }
});

test("HC-2g3 completed_at null at COMPLETED or FAILED is H5; at CANCELLED it is not", (t) => {
  for (const status of ["COMPLETED", "FAILED"]) {
    const sai = newSai(t);
    const body = text(
      doc(REL, { status, completed_at: null, result: { status } }),
    );
    commitFiles(sai, { [REL]: body });
    expectLines(sai, [
      at(
        REL,
        lineOf(body, '"completed_at"'),
        "H5",
        "completed_at",
        `null при ${status}`,
      ),
    ]);
  }
});

test("HC-2g4 every field with the key at or a key ending with _at is a time, at any depth, and the path of the field is printed", (t) => {
  const sai = newSai(t);
  const body = text(
    doc(REL, {
      context: {
        resumed_at: "bad-1",
        interruptions: [{ at: T("05:15:00") }, { at: "bad-2" }],
        format: "not a time field",
      },
      result: {
        status: "COMPLETED",
        issues: [{ kind: "NOTE", at: "bad-3" }],
        stamp: { checked_by_orch_at: "bad-4" },
      },
    }),
  );
  commitFiles(sai, { [REL]: body });
  const h5 = (needle, field) =>
    at(
      REL,
      lineOf(body, needle),
      "H5",
      field,
      "значение не вида ГГГГ-ММ-ДДTчч:мм:ссZ",
    );
  expectLines(sai, [
    h5('"resumed_at"', "context.resumed_at"),
    h5('"bad-2"', "context.interruptions[1].at"),
    h5('"bad-3"', "result.issues[0].at"),
    h5('"bad-4"', "result.stamp.checked_by_orch_at"),
  ]);
});

test("HC-2h completed_at one hour later than the clock is H6 (the clock of the run)", (t) => {
  const sai = newSai(t);
  const later = new Date(Date.now() + 3600 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/u, "Z");
  const body = text(doc(REL, { completed_at: later }));
  commitFiles(sai, { [REL]: body });
  const r = sai.runUnchanged();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const lines = violationLines(r.stdout);
  assert.equal(lines.length, 1, r.stdout);
  const m = new RegExp(
    `^${REL.replace(/[.]/gu, "\\.")}:${lineOf(body, '"completed_at"')} — H6: completed_at: ${later} позже часов \\((\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z)\\)$`,
    "u",
  ).exec(lines[0]);
  assert.ok(m, lines[0]);
  const shown = Date.parse(m[1]) / 1000;
  assert.ok(Math.abs(shown - Date.now() / 1000) < 120, "the clock printed");
});

test("HC-2h2 H6 is strict: a time equal to the clock is allowed, one second later is H6 (fixed clock)", (t) => {
  const sai = newSai(t);
  const clock = "2030-01-01T00:00:00Z";
  const body = text(
    doc(REL, { created_at: T("05:00:00"), completed_at: clock }),
  );
  sai.write(REL, body);
  assert.deepEqual(sai.check(NOW).lines.slice(0, -1), []);
  sai.write(REL, text(doc(REL, { completed_at: "2030-01-01T00:00:01Z" })));
  assert.deepEqual(sai.check(NOW).lines.slice(0, -1), [
    at(
      REL,
      lineOf(text(doc(REL)), '"completed_at"'),
      "H6",
      "completed_at",
      "2030-01-01T00:00:01Z позже часов (2030-01-01T00:00:00Z)",
    ),
  ]);
});

test("HC-2i completed_at earlier than started_at is H8; equal times are not; an unknown time is not compared", (t) => {
  const sai = newSai(t);
  const body = text(
    doc(REL, { started_at: T("05:10:00"), completed_at: T("05:00:00") }),
  );
  commitFiles(sai, { [REL]: body });
  expectLines(sai, [
    at(
      REL,
      lineOf(body, '"completed_at"'),
      "H8",
      "completed_at",
      `${T("05:00:00")} раньше started_at ${T("05:10:00")}`,
    ),
  ]);
  const same = newSai(t);
  commitFiles(same, {
    [REL]: doc(REL, { started_at: T("05:10:00"), completed_at: T("05:10:00") }),
  });
  expectLines(same, []);
  const unknown = newSai(t);
  commitFiles(unknown, {
    [REL]: doc(REL, { started_at: "неизвестно", completed_at: T("05:00:00") }),
  });
  expectLines(unknown, []);
});

test("HC-2j only handoffs/**/*.json is read: other files and other spellings are not counted", (t) => {
  const sai = newSai(t);
  commitFiles(sai, {
    [REL]: doc(REL),
    "handoffs/parallel-runs.jsonl": "{not json\n",
    "handoffs/R-1/notes.md": "# text\n",
    "handoffs/R-1/upper.JSON": "{not json\n",
    "docs/handoffs/x.json": "{not json\n",
    "tools/handoffs/y.json": "{not json\n",
  });
  const r = expectLines(sai, []);
  assert.match(summaryOf(r.stdout), /файлов проверено 1,/u);
});

test("HC-2k DONE gives one line on status even when result.status differs too", (t) => {
  const sai = newSai(t);
  const body = text(doc(REL, { status: "DONE", result: { status: "other" } }));
  commitFiles(sai, { [REL]: body });
  expectLines(sai, [
    at(
      REL,
      lineOf(body, '"status": "DONE"'),
      "H4",
      "status",
      "недопустимое значение DONE",
    ),
  ]);
});
