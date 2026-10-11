// REQ-038, criterion 3: the rules H7 and H9 by the history of git (design 12, HC-3a ...
// HC-3f). Every case has its own temporary repository with the times of the commits
// named in the case (committer time and, when it matters, a different author time).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REL,
  T,
  doc,
  lineOf,
  newSai,
  summaryOf,
  text,
  violationLines,
} from "./handoffs-helpers.js";

const line = (rel, n, rule, field, message) =>
  `${rel}:${n} — ${rule}: ${field}: ${message}`;

// The command: code 1 with exactly these lines, or code 0 with none; the tree is unchanged.
function expectLines(sai, expected) {
  const r = sai.runUnchanged();
  assert.equal(r.status, expected.length > 0 ? 1 : 0, r.stdout + r.stderr);
  assert.equal(r.stderr, "");
  assert.deepEqual(violationLines(r.stdout), expected);
  assert.match(
    summaryOf(r.stdout),
    new RegExp(`нарушений ${expected.length},`, "u"),
  );
}

const short = (hash) => hash.slice(0, 7);

test("HC-3a a value later than the committer time of its first commit is H7; the author time is not used", (t) => {
  const sai = newSai(t);
  const body = text(doc(REL, { completed_at: T("06:05:00") }));
  sai.write(REL, body);
  const hash = sai.commit(T("06:04:50"), { author: T("06:10:00") });
  expectLines(sai, [
    line(
      REL,
      lineOf(body, '"completed_at"'),
      "H7",
      "completed_at",
      `${T("06:05:00")} позже коммита ${short(hash)} (${T("06:04:50")}), в который вошло значение`,
    ),
  ]);
});

test("HC-3a2 a value equal to the committer time of its commit is not a violation (strict comparison)", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL, { completed_at: T("06:04:50") }));
  sai.commit(T("06:04:50"), { author: T("06:10:00") });
  expectLines(sai, []);
  // One second later it is a violation.
  const late = newSai(t);
  const body = text(doc(REL, { completed_at: T("06:04:51") }));
  late.write(REL, body);
  const hash = late.commit(T("06:04:50"));
  expectLines(late, [
    line(
      REL,
      lineOf(body, '"completed_at"'),
      "H7",
      "completed_at",
      `${T("06:04:51")} позже коммита ${short(hash)} (${T("06:04:50")}), в который вошло значение`,
    ),
  ]);
});

test("HC-3a3 the committer time is compared in UTC, whatever offset the commit was made with", (t) => {
  const sai = newSai(t);
  const body = text(doc(REL, { completed_at: T("06:05:00") }));
  sai.write(REL, body);
  // 11:04:50 at +05:00 is 06:04:50Z.
  const hash = sai.commit("2025-03-01T11:04:50+05:00");
  expectLines(sai, [
    line(
      REL,
      lineOf(body, '"completed_at"'),
      "H7",
      "completed_at",
      `${T("06:05:00")} позже коммита ${short(hash)} (${T("06:04:50")}), в который вошло значение`,
    ),
  ]);
  const ok = newSai(t);
  ok.writeDoc(REL, doc(REL, { completed_at: T("06:05:00") }));
  ok.commit("2025-03-01T06:05:00-00:00");
  expectLines(ok, []);
});

test("HC-3b a file that entered a commit without completed_at is not bound by that first commit", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL, { completed_at: "неизвестно: ещё не записано" }));
  sai.commit(T("06:00:00"));
  sai.writeDoc(REL, doc(REL, { completed_at: T("06:10:00") }));
  sai.commit(T("06:20:00"));
  expectLines(sai, []);
});

test("HC-3b2 the earliest commit with the value counts: later commits that keep it do not move the boundary", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL, { completed_at: "неизвестно" }));
  sai.commit(T("06:00:00"));
  const body = text(doc(REL, { completed_at: T("06:30:00") }));
  sai.write(REL, body);
  const first = sai.commit(T("06:10:00"));
  sai.writeDoc(
    REL,
    doc(REL, { completed_at: T("06:30:00"), task: { description: "changed" } }),
  );
  sai.commit(T("07:00:00"));
  sai.write(REL, body);
  sai.commit(T("08:00:00"));
  expectLines(sai, [
    line(
      REL,
      lineOf(body, '"completed_at"'),
      "H7",
      "completed_at",
      `${T("06:30:00")} позже коммита ${short(first)} (${T("06:10:00")}), в который вошло значение`,
    ),
  ]);
});

test("HC-3b3 a value changed in the work tree and not committed has no commit: only the clock bounds it", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL, { completed_at: T("05:30:00") }));
  sai.commit(T("06:00:00"));
  sai.writeDoc(REL, doc(REL, { completed_at: T("07:00:00") }));
  expectLines(sai, []);
});

test("HC-3b4 a version of the file in the history that is not JSON is skipped", (t) => {
  const sai = newSai(t);
  sai.write(REL, '{"truncated": ');
  sai.commit(T("06:00:00"));
  const body = text(doc(REL, { completed_at: T("06:30:00") }));
  sai.write(REL, body);
  const hash = sai.commit(T("06:10:00"));
  expectLines(sai, [
    line(
      REL,
      lineOf(body, '"completed_at"'),
      "H7",
      "completed_at",
      `${T("06:30:00")} позже коммита ${short(hash)} (${T("06:10:00")}), в который вошло значение`,
    ),
  ]);
});

const CORRECTION_AT = T("10:25:00");
const COMMIT_AT = "2025-03-01T10:23:05Z";

test("HC-3c orch_correction.at later than its commit is H7", (t) => {
  const sai = newSai(t);
  const body = text(
    doc(REL, {
      orch_correction: { by: "ORCH", at: CORRECTION_AT, text: "правка" },
    }),
  );
  sai.write(REL, body);
  const hash = sai.commit(COMMIT_AT);
  expectLines(sai, [
    line(
      REL,
      lineOf(body, '"at"'),
      "H7",
      "orch_correction.at",
      `${CORRECTION_AT} позже коммита ${short(hash)} (${T("10:23:05")}), в который вошло значение`,
    ),
  ]);
});

test("HC-3d a time inside at_note is checked like at, quoted or not; a note without a time and a previous value are not", (t) => {
  const quoted = "handoffs/R-1/step-02-b.json";
  const clean = "handoffs/R-1/step-03-c.json";
  const bare = {
    by: "ORCH",
    at: null,
    at_note: `не позже ${CORRECTION_AT} (чтение часов)`,
  };
  const sai = newSai(t);
  const bareBody = text(doc(REL, { orch_correction: bare }));
  const quotedBody = text(
    doc(quoted, {
      orch_note: {
        by: "ORCH",
        at: null,
        at_note: `прежнее значение «${CORRECTION_AT}» заменено`,
      },
    }),
  );
  sai.write(REL, bareBody);
  sai.write(quoted, quotedBody);
  sai.write(
    clean,
    text(
      doc(clean, {
        orch_correction: {
          by: "ORCH",
          at: null,
          at_note: "прежнее значение записано в previous",
          previous: CORRECTION_AT,
        },
      }),
    ),
  );
  const hash = sai.commit(COMMIT_AT);
  const tail = `позже коммита ${short(hash)} (${T("10:23:05")})`;
  expectLines(sai, [
    line(
      REL,
      lineOf(bareBody, '"at_note"'),
      "H9",
      "orch_correction.at_note",
      `время ${CORRECTION_AT} в тексте ${tail}`,
    ),
    line(
      quoted,
      lineOf(quotedBody, '"at_note"'),
      "H9",
      "orch_note.at_note",
      `время ${CORRECTION_AT} в тексте ${tail}`,
    ),
  ]);
});

test("HC-3d2 a time of at_note without seconds counts as :00; equal to the commit is allowed; a date that does not exist is no time", (t) => {
  const sai = newSai(t);
  const a = "handoffs/R-1/step-01-a.json";
  const b = "handoffs/R-1/step-02-b.json";
  const c = "handoffs/R-1/step-03-c.json";
  const note = (at_note) => ({ by: "ORCH", at: null, at_note });
  const aBody = text(doc(a, { orch_note: note("до 2025-03-01T10:25Z") }));
  sai.write(a, aBody);
  sai.write(b, text(doc(b, { orch_note: note("до 2025-03-01T10:23:05Z") })));
  sai.write(c, text(doc(c, { orch_note: note("до 2025-02-30T23:59:00Z") })));
  const hash = sai.commit(COMMIT_AT);
  expectLines(sai, [
    line(
      a,
      lineOf(aBody, '"at_note"'),
      "H9",
      "orch_note.at_note",
      `время 2025-03-01T10:25Z в тексте позже коммита ${short(hash)} (${T("10:23:05")})`,
    ),
  ]);
});

test("HC-3d4 a time of at_note without seconds is :00 (F2 of the gate): 10:23Z at the commit 10:23:30Z is allowed, 10:24Z is H9", (t) => {
  const note = (at_note) => ({ by: "ORCH", at: null, at_note });
  const sai = newSai(t);
  const a = "handoffs/R-1/step-01-a.json";
  const b = "handoffs/R-1/step-02-b.json";
  sai.write(a, text(doc(a, { orch_note: note("до 2025-03-01T10:23Z") })));
  const bBody = text(doc(b, { orch_note: note("до 2025-03-01T10:24Z") }));
  sai.write(b, bBody);
  const hash = sai.commit("2025-03-01T10:23:30Z");
  expectLines(sai, [
    line(
      b,
      lineOf(bBody, '"at_note"'),
      "H9",
      "orch_note.at_note",
      `время 2025-03-01T10:24Z в тексте позже коммита ${short(hash)} (${T("10:23:30")})`,
    ),
  ]);
});

test("HC-3d3 a time of at_note later than the clock is H9 at once; the same text in a new file is bound by the clock only", (t) => {
  const sai = newSai(t);
  const body = text(
    doc(REL, {
      orch_note: {
        by: "ORCH",
        at: null,
        at_note: "ожидается 2999-01-01T00:00:00Z",
      },
    }),
  );
  sai.write(REL, body);
  expectLines(sai, [
    line(
      REL,
      lineOf(body, '"at_note"'),
      "H9",
      "orch_note.at_note",
      "время 2999-01-01T00:00:00Z в тексте позже часов",
    ),
  ]);
  const past = newSai(t);
  past.writeDoc(
    REL,
    doc(REL, {
      orch_note: { by: "ORCH", at: null, at_note: `записано ${CORRECTION_AT}` },
    }),
  );
  expectLines(past, []);
});

test("HC-3e the subtrees was and previous of a correction are not checked; outside a correction they are", (t) => {
  const sai = newSai(t);
  const later = T("11:00:00");
  const body = text(
    doc(REL, {
      orch_correction: {
        by: "ORCH",
        at: T("10:20:00"),
        was: { completed_at: later, at: later },
        previous: { created_at: later },
      },
      orch_note: {
        by: "ORCH",
        at: null,
        at_note: "без времени",
        previous: { at: "не время" },
      },
      result: { status: "COMPLETED", was: { at: "bad" } },
    }),
  );
  sai.write(REL, body);
  sai.commit(COMMIT_AT);
  expectLines(sai, [
    line(
      REL,
      lineOf(body, '"bad"'),
      "H5",
      "result.was.at",
      "значение не вида ГГГГ-ММ-ДДTчч:мм:ссZ",
    ),
  ]);
});

test("HC-3f orch_note as a string, a correction without by, without at, with at null and no at_note, an object in a list: H9", (t) => {
  const sai = newSai(t);
  const files = {
    str: doc("handoffs/R-1/step-01-a.json", { orch_note: "просто текст" }),
    noBy: doc("handoffs/R-1/step-02-b.json", {
      orch_correction: { at: T("05:35:00") },
    }),
    noAt: doc("handoffs/R-1/step-03-c.json", {
      orch_correction: { by: "ORCH" },
    }),
    noNote: doc("handoffs/R-1/step-04-d.json", {
      orch_correction: { by: "ORCH", at: null },
    }),
    list: doc("handoffs/R-1/step-05-e.json", {
      orch_note: [
        { by: "ORCH", at: T("05:35:00") },
        7,
        { by: "", at: T("05:35:00") },
      ],
    }),
    empty: doc("handoffs/R-1/step-06-f.json", { orch_note: [] }),
    ok: doc("handoffs/R-1/step-07-g.json", {
      orch_correction: [{ by: "ORCH", at: T("05:35:00") }],
    }),
    badAt: doc("handoffs/R-1/step-08-h.json", {
      orch_correction: { by: "ORCH", at: "2025-03-01T05:35Z" },
    }),
  };
  const bodies = {};
  for (const [k, d] of Object.entries(files)) {
    bodies[k] = text(d);
    sai.write(d.file, bodies[k]);
  }
  sai.commit(T("06:00:00"));
  const f = (k) => files[k].file;
  expectLines(sai, [
    line(
      f("str"),
      lineOf(bodies.str, '"orch_note"'),
      "H9",
      "orch_note",
      "не объект и не список объектов",
    ),
    line(f("noBy"), 1, "H9", "orch_correction.by", "нет непустой строки by"),
    line(f("noAt"), 1, "H9", "orch_correction.at", "нет поля at"),
    line(
      f("noNote"),
      1,
      "H9",
      "orch_correction.at_note",
      "at null без непустого at_note",
    ),
    line(
      f("list"),
      lineOf(bodies.list, "    7,"),
      "H9",
      "orch_note[1]",
      "не объект и не список объектов",
    ),
    line(
      f("list"),
      lineOf(bodies.list, '"by": ""'),
      "H9",
      "orch_note[2].by",
      "нет непустой строки by",
    ),
    line(
      f("badAt"),
      lineOf(bodies.badAt, '"at"'),
      "H5",
      "orch_correction.at",
      "значение не вида ГГГГ-ММ-ДДTчч:мм:ссZ",
    ),
  ]);
});
