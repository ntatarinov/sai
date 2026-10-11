// REQ-039, criterion 4 (design 10, HO-30...HO-34, HO-37, HO-38): `npm run handoff --
// close <path> --status COMPLETED|FAILED` puts the two values `status` and `completed_at`
// (the clock) into a file whose `result` the recipient has written, and changes no other
// byte. The file is checked by the rules of REQ-038 before it is written.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HandoffError } from "../src/handoffs/errors.js";
import { spliceTopLevel } from "../src/handoffs/close.js";
import {
  FAKE_RUN,
  assertRefusal,
  describe,
  newArgs,
  newCmdRepo,
  recipientWrites,
} from "./handoffs-helpers.js";

const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const now = () => Math.floor(Date.now() / 1000);
const seconds = (stamp) => Date.parse(stamp) / 1000;

// A file as `new` makes it, then as the recipient leaves it: `result` written, the
// status IN_PROGRESS (or the one in `over`). Returns { sai, rel, before }.
function recipientFile(t, over = {}, { step = "01" } = {}) {
  const sai = newCmdRepo(t);
  const r = sai.cmd(
    newArgs({
      run: FAKE_RUN,
      step,
      role: "BACKEND-DEV",
      workflow: "WF-01",
      task: "t",
    }),
  );
  assert.equal(r.status, 0, describe(r));
  const rel = `handoffs/${FAKE_RUN}/step-${step}-backend-dev.json`;
  recipientWrites(sai, rel, {
    status: "IN_PROGRESS",
    result: { status: "COMPLETED", summary: "сделано", issues: [] },
    ...over,
  });
  return { sai, rel, before: sai.read(rel) };
}

const close = (sai, rel, status) => sai.cmd(["close", rel, "--status", status]);

test("HO-30 close COMPLETED: code 0, status and completed_at set from the clock, every other field and the order of the keys as they were, the file passes handoffs-check", (t) => {
  const { sai, rel, before } = recipientFile(t);
  const was = JSON.parse(before.toString("utf8"));
  const t0 = now();
  const r = close(sai, rel, "COMPLETED");
  const t1 = now();
  assert.equal(r.status, 0, describe(r));
  assert.equal(r.stderr, "");
  const d = sai.json(rel);
  assert.equal(d.status, "COMPLETED");
  assert.match(d.completed_at, TIME);
  assert.ok(seconds(d.completed_at) >= t0 && seconds(d.completed_at) <= t1);
  assert.ok(seconds(d.completed_at) >= seconds(d.started_at));
  assert.deepEqual(Object.keys(d), Object.keys(was));
  assert.deepEqual(
    { ...d, status: null, completed_at: null },
    { ...was, status: null, completed_at: null },
  );
  const check = sai.run([]);
  assert.equal(check.status, 0, describe(check));
  assert.match(check.stdout, /нарушений 0/u);
});

// The text of a handoff with the two places marked; the marks are put into the places of
// the top-level `status` and `completed_at`.
const MARK_S = "@@STATUS@@";
const MARK_C = "@@COMPLETED@@";
function marked(extra = {}) {
  return {
    handoff_id: `step01-${FAKE_RUN}`,
    run_id: FAKE_RUN,
    workflow_id: "WF-01",
    step: "01",
    from_agent: "ORCH",
    to_agent: "BACKEND-DEV",
    file: `handoffs/${FAKE_RUN}/step-01-backend-dev.json`,
    status: MARK_S,
    priority: "NORMAL",
    context: {
      requirement_ids: ["REQ-001"],
      agent_run_id: null,
      status: "kept",
      completed_at: null,
    },
    task: { description: "t", acceptance_criteria: ["a", "b"] },
    created_at: "2026-10-11T10:00:00Z",
    started_at: "2026-10-11T10:00:00Z",
    completed_at: MARK_C,
    result: {
      status: "COMPLETED",
      completed_at: null,
      summary:
        'has "status": "IN_PROGRESS", "completed_at": null, } ] { [ \\ and ёж 😀',
      items: [1, 2, { status: "x" }],
    },
    ...extra,
  };
}

// The forms of a text; each gives the text with the marks as quoted strings.
const STYLES = {
  "two spaces": (d) => `${JSON.stringify(d, null, 2)}\n`,
  "four spaces, CRLF, no line feed at the end": (d) =>
    JSON.stringify(d, null, 4).replace(/\n/gu, "\r\n"),
  tabs: (d) => `${JSON.stringify(d, null, "\t")}\n`,
  "one line": (d) => JSON.stringify(d),
  "spaces around colons": (d) =>
    `${JSON.stringify(d, null, 2).replace(/^(\s*"[a-z_]+"): /gmu, "$1  :   ")}\n`,
  "every top-level value on a line, inner values compact": (d) =>
    `{\n${Object.entries(d)
      .map(([k, v]) => `  "${k}":${JSON.stringify(v)}`)
      .join(",\n")}\n}\n`,
  "blank lines and two line feeds at the end": (d) =>
    `${JSON.stringify(d, null, 2).replace(/,\n/gu, ",\n\n")}\n\n`,
};

test("HO-31 byte precision: in every form of a file all bytes but the two tokens are as they were; the same names inside result and context are not touched", (t) => {
  for (const [name, render] of Object.entries(STYLES)) {
    const sai = newCmdRepo(t);
    const rel = `handoffs/${FAKE_RUN}/step-01-backend-dev.json`;
    const template = render(marked());
    const original = template
      .replace(`"${MARK_S}"`, '"IN_PROGRESS"')
      .replace(`"${MARK_C}"`, "null");
    assert.notEqual(original, template);
    sai.write(rel, original);
    const r = close(sai, rel, "COMPLETED");
    assert.equal(r.status, 0, `${name}: ${describe(r)}`);
    const after = sai.read(rel).toString("utf8");
    const stamp = JSON.parse(after).completed_at;
    assert.match(stamp, TIME, name);
    const expected = template
      .replace(`"${MARK_S}"`, '"COMPLETED"')
      .replace(`"${MARK_C}"`, `"${stamp}"`);
    assert.equal(after, expected, name);
  }
});

test("HO-31b the order of the keys does not matter: completed_at before status, both at the start or at the end", (t) => {
  const variants = [
    { first: ["completed_at", "status"] },
    { last: ["completed_at", "status"] },
    { first: ["status", "completed_at"] },
  ];
  for (const v of variants) {
    const sai = newCmdRepo(t);
    const rel = `handoffs/${FAKE_RUN}/step-01-backend-dev.json`;
    const d = marked();
    const moved = {};
    const pick = (keys) => keys.forEach((k) => (moved[k] = d[k]));
    if (v.first) pick(v.first);
    for (const k of Object.keys(d))
      if (!(v.first ?? []).includes(k) && !(v.last ?? []).includes(k))
        moved[k] = d[k];
    if (v.last) pick(v.last);
    const template = `${JSON.stringify(moved, null, 2)}\n`;
    sai.write(
      rel,
      template
        .replace(`"${MARK_S}"`, '"PENDING"')
        .replace(`"${MARK_C}"`, "null"),
    );
    const r = close(sai, rel, "COMPLETED");
    assert.equal(r.status, 0, describe(r));
    const after = sai.read(rel).toString("utf8");
    const stamp = JSON.parse(after).completed_at;
    assert.equal(
      after,
      template
        .replace(`"${MARK_S}"`, '"COMPLETED"')
        .replace(`"${MARK_C}"`, `"${stamp}"`),
    );
  }
});

test("HO-32 FAILED from PENDING and from IN_PROGRESS, COMPLETED from PENDING", (t) => {
  for (const [from, status] of [
    ["PENDING", "FAILED"],
    ["IN_PROGRESS", "FAILED"],
    ["PENDING", "COMPLETED"],
  ]) {
    const { sai, rel } = recipientFile(t, {
      status: from,
      result: { status, summary: "s" },
    });
    const r = close(sai, rel, status);
    assert.equal(r.status, 0, `${from} -> ${status}: ${describe(r)}`);
    const d = sai.json(rel);
    assert.equal(d.status, status);
    assert.equal(d.result.status, status);
    assert.match(d.completed_at, TIME);
  }
});

test("HO-33 spliceTopLevel: the values at the start, in the middle and at the end of the object, strings with quotes, brackets and Unicode, a repeated key is refused", () => {
  const edit = { status: "FAILED", completed_at: "2099-12-31T10:00:00Z" };
  const place = (keys, mid) => {
    const d = {};
    for (const k of keys)
      d[k] = k === "status" ? MARK_S : k === "completed_at" ? MARK_C : mid;
    return d;
  };
  const strange = 'a "status": "PENDING" \\" } ] [ { ёж 😀 \u0007';
  for (const keys of [
    ["status", "completed_at", "x"],
    ["x", "status", "completed_at"],
    ["completed_at", "x", "status"],
    ["x", "y", "status", "z", "completed_at", "w"],
  ])
    for (const indent of [0, 2]) {
      const template = JSON.stringify(place(keys, strange), null, indent);
      const text = template
        .replace(`"${MARK_S}"`, '"PENDING"')
        .replace(`"${MARK_C}"`, "null");
      assert.equal(
        spliceTopLevel(text, edit),
        template
          .replace(`"${MARK_S}"`, '"FAILED"')
          .replace(`"${MARK_C}"`, '"2099-12-31T10:00:00Z"'),
        keys.join(),
      );
    }
  // Values that are objects and arrays around the keys.
  const nested =
    '{"a":{"status":"A","completed_at":"B"},"status":"PENDING","b":[{"status":1}],"completed_at":null}';
  assert.equal(
    spliceTopLevel(nested, edit),
    '{"a":{"status":"A","completed_at":"B"},"status":"FAILED","b":[{"status":1}],"completed_at":"2099-12-31T10:00:00Z"}',
  );
  // A repeated key on the top level: refused with E_HO_FILE (JSON.parse takes the last).
  assert.throws(
    () =>
      spliceTopLevel(
        '{"status":"PENDING","status":"PENDING","completed_at":null}',
        edit,
      ),
    (e) => e instanceof HandoffError && e.code === "E_HO_FILE" && e.exit === 1,
  );
  assert.throws(
    () =>
      spliceTopLevel(
        '{"status":"PENDING","completed_at":null,"completed_at":null}',
        edit,
      ),
    (e) => e instanceof HandoffError && e.code === "E_HO_FILE" && e.exit === 1,
  );
  // A missing key cannot be put in place: the self-check stops it.
  assert.throws(
    () => spliceTopLevel('{"status":"PENDING"}', edit),
    (e) =>
      e instanceof HandoffError && e.code === "E_HO_INTERNAL" && e.exit === 2,
  );
});

test("HO-34 the output of close: two lines, the path as given, the status and the time that the file holds", (t) => {
  const { sai, rel } = recipientFile(t);
  const r = close(sai, rel, "COMPLETED");
  assert.equal(r.status, 0, describe(r));
  const stamp = sai.json(rel).completed_at;
  assert.equal(r.stdout, `${rel}\nstatus: COMPLETED, completed_at: ${stamp}\n`);
});

test("HO-37 the second close of the same file is refused: the status is already final, the file is as the first close left it", (t) => {
  const { sai, rel } = recipientFile(t);
  assert.equal(close(sai, rel, "COMPLETED").status, 0);
  const done = sai.read(rel);
  const tree = sai.tree();
  const line = assertRefusal(close(sai, rel, "COMPLETED"), 1, "E_HO_STATE");
  assert.ok(line.includes("status сейчас COMPLETED"), line);
  assert.deepEqual(sai.read(rel), done);
  assert.equal(sai.tree(), tree);
});

test("HO-38 the rules of REQ-038 act on what the recipient wrote: H2, H3, H9, H10 and H11 are refused with their lines, the file is as it was", (t) => {
  // Put together from parts, so that this file is not a trace itself.
  const home = ["", "Us" + "ers", "zq", "work"].join("/");
  const temp = ["", "pri" + "vate", "tmp", "zq"].join("/");
  const ok = { status: "COMPLETED", summary: "s" };
  const cases = [
    ["H2", { task: undefined }],
    ["H3", { run_id: "PROD-20991231-99" }],
    ["H9", { orch_correction: { at: "2026-10-11T10:00:00Z" } }],
    ["H10", { result: { ...ok, summary: `see ${home} now` } }],
    ["H11", { result: { ...ok, summary: `cd ${temp}` } }],
    ["H5", { result: { ...ok, issues: [{ at: "yesterday" }] } }],
  ];
  for (const [rule, over] of cases) {
    const { sai, rel } = recipientFile(t, over);
    const edited = sai.read(rel);
    const tree = sai.tree();
    const r = close(sai, rel, "COMPLETED");
    const line = assertRefusal(r, 1, "E_HO_RULES", { stdout: true });
    assert.ok(line.includes("файл не записан"), line);
    const rows = r.stdout.split("\n").filter((l) => l !== "");
    assert.ok(rows.length >= 1, rule);
    for (const row of rows)
      assert.match(row, /^handoffs\/\S+\.json:\d+ — H\d+: /u, row);
    assert.ok(
      rows.some((x) => x.includes(` — ${rule}: `)),
      `${rule}: ${r.stdout}`,
    );
    assert.ok(!r.stdout.includes("zq"), "the value is not printed");
    assert.deepEqual(sai.read(rel), edited, rule);
    assert.equal(sai.tree(), tree, rule);
  }
});
