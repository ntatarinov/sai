// Sai Team core: the form of an event, the time rules, masking of secrets (design
// REQ-009, TM-06 ... TM-10, TM-43, TM-44).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { maskSecrets } from "../src/pixel-office/mask.js";
import { EVENT_TYPES, checkInput } from "../src/team/schema.js";
import { openWriter, readProject } from "../src/team/store.js";
import {
  TEAM_SRC,
  assertAppendRefused,
  assertRefusal,
  buildDone,
  eng,
  journalOf,
  makeClock,
  makeHome,
  ms,
  newProject,
  openTracked,
  planTask,
  snapshot,
  startProject,
  startRun,
  usr,
  withPlan,
} from "./team-helpers.js";

const ENVELOPE = ["seq", "ts", "project", "task", "source", "type", "data"];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// ---- TM-06 ---------------------------------------------------------------------------

test("TM-06 every line of the journal is a JSON object with the keys of the envelope in order", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  buildDone(p.writer);
  const text = fs.readFileSync(p.events, "utf8");
  assert.ok(text.endsWith("\n"));
  const lines = text.slice(0, -1).split("\n");
  assert.ok(lines.length >= 30);
  lines.forEach((line, i) => {
    const event = JSON.parse(line);
    assert.deepStrictEqual(Object.keys(event), ENVELOPE, `line ${i + 1}`);
    assert.equal(event.seq, i + 1);
    assert.match(event.ts, ISO);
    assert.equal(new Date(event.ts).toISOString(), event.ts);
    assert.equal(event.project, p.id);
    assert.ok(["ENGINE", "AGENT", "USER"].includes(event.source));
    assert.ok(Object.hasOwn(EVENT_TYPES, event.type));
    assert.ok(event.task === null || /^t-[0-9]{4}$/.test(event.task));
    assert.equal(typeof event.data, "object");
    assert.notEqual(event.data, null);
  });
  // the ids of the project are made by the core
  assert.match(p.id, /^p-20260101-[0-9a-f]{6}$/);
});

// ---- TM-07 ---------------------------------------------------------------------------

function craft(id, seq, ts, over = {}) {
  return {
    seq,
    ts,
    project: id,
    task: null,
    source: "USER",
    type: "CHAT",
    data: { text: "Привет", kind: "message", truncated: false },
    ...over,
  };
}

function lastTs(p) {
  return p.writer.state.last_ts;
}

test("TM-07 an event without a required field is refused and the file stays byte for byte", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w, dir } = p;
  const chat = () =>
    usr("CHAT", { text: "Привет", kind: "message", truncated: false });
  for (const key of ["source", "type", "data"]) {
    const input = chat();
    delete input[key];
    assertAppendRefused(w, dir, input, "E_EVENT");
  }
  for (const key of ["text", "kind", "truncated"]) {
    const input = chat();
    delete input.data[key];
    assertAppendRefused(w, dir, input, "E_EVENT");
  }
  // a task is required by the type
  assertAppendRefused(w, dir, eng("TASK_STARTED", {}, null), "E_EVENT");
  assertAppendRefused(w, dir, eng("TASK_CREATED", {}, null), "E_EVENT");
  // every required data field of every type that is not written by the core only
  for (const [type, spec] of Object.entries(EVENT_TYPES)) {
    if (spec.coreOnly) continue;
    const source = spec.sources[0];
    const task = ["required", "by_purpose"].includes(spec.task)
      ? "t-0001"
      : null;
    const full = Object.fromEntries(
      Object.entries(spec.fields)
        .filter(([, f]) => !f.optional)
        .map(([key, f]) => [key, sample(f)]),
    );
    // the sample is a good event: only the missing field can be the reason
    checkInput({ source, type, task, data: full });
    for (const key of Object.keys(spec.fields)) {
      if (spec.fields[key].optional) continue;
      const data = { ...full };
      delete data[key];
      assertAppendRefused(w, dir, { source, type, task, data }, "E_EVENT");
    }
  }
  // and the damaged line of a journal that is read
  w.close();
  const before = snapshot(dir);
  const base = craft(p.id, 2, lastTs(p));
  for (const key of ENVELOPE) {
    const line = { ...base };
    delete line[key];
    fs.appendFileSync(p.events, `${JSON.stringify(line)}\n`);
    const withLine = snapshot(dir);
    assertRefusal(dir, () => openWriter(p.id, { home }), "E_CORRUPT");
    assert.equal(
      assertRefusal(dir, () => readProject(p.id, { home }), "E_CORRUPT").details
        .line,
      2,
    );
    assert.deepStrictEqual(snapshot(dir), withLine);
    fs.writeFileSync(
      p.events,
      fs.readFileSync(p.events).subarray(0, before["events.jsonl"].size),
    );
  }
});

// A valid value of a field kind, for the check above.
function sample(field) {
  switch (field.kind) {
    case "text":
      return "Текст";
    case "name":
      return "a.md";
    case "code":
      return field.values[0];
    case "id":
      return field.pattern === "task" ? "t-0001" : "r-00001";
    case "hash":
      return "0".repeat(64);
    case "int":
      return Math.max(field.min, 1);
    case "money":
      return 1;
    case "bool":
      return true;
    case "list":
      return field.min > 0 ? [sample(field.item)] : [];
    case "object":
      return Object.fromEntries(
        Object.entries(field.fields).map(([key, f]) => [key, sample(f)]),
      );
    default:
      throw new Error(`unknown kind ${field.kind}`);
  }
}

// ---- TM-08 ---------------------------------------------------------------------------

test("TM-08 a wrong source, an unknown type, an extra field are refused", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w, dir } = p;
  const chat = {
    source: "USER",
    type: "CHAT",
    task: null,
    data: { text: "Привет", kind: "message", truncated: false },
  };
  assertAppendRefused(w, dir, { ...chat, source: "SYSTEM" }, "E_EVENT");
  assertAppendRefused(w, dir, { ...chat, source: "user" }, "E_EVENT");
  assertAppendRefused(w, dir, { ...chat, type: "NO_SUCH_TYPE" }, "E_EVENT");
  assertAppendRefused(w, dir, { ...chat, type: "__proto__" }, "E_EVENT");
  assertAppendRefused(
    w,
    dir,
    { ...chat, data: { ...chat.data, extra: 1 } },
    "E_EVENT",
  );
  assertAppendRefused(w, dir, { ...chat, seq: 7 }, "E_EVENT");
  assertAppendRefused(
    w,
    dir,
    { ...chat, project: "p-20260101-aaaaaa" },
    "E_EVENT",
  );
  // a type that the source may not write; a question only from the engine
  assertAppendRefused(
    w,
    dir,
    { ...chat, type: "PROJECT_DONE", data: {} },
    "E_EVENT",
  );
  assertAppendRefused(
    w,
    dir,
    { ...chat, data: { ...chat.data, kind: "question" } },
    "E_EVENT",
  );
  assertAppendRefused(
    w,
    dir,
    eng("PROJECT_STARTED", { parallel: 1 }),
    "E_EVENT",
  );
  assertAppendRefused(w, dir, { ...chat, data: "text" }, "E_EVENT");
  assertAppendRefused(w, dir, { ...chat, data: null }, "E_EVENT");
  assertAppendRefused(w, dir, null, "E_EVENT");
  assertAppendRefused(w, dir, [], "E_EVENT");
});

test("TM-08 the types and the values that only the core writes are refused by the public append", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w, dir } = p;
  p.writer.append(usr("PROJECT_STARTED", { parallel: 1 }));
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  w.append(
    eng("PLAN_RECEIVED", {
      round: 0,
      tasks: [planTask("t-0001", "developer")],
    }),
  );
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  const run = startRun(w, "work", "developer", "t-0001");
  const only = (input) => {
    const err = assertAppendRefused(w, dir, input, "E_EVENT");
    assert.match(err.message, /только ядро/);
  };
  only(
    eng("PROJECT_CREATED", {
      goal: "Цель",
      budget_usd: 1,
      executor: "claude-cli",
      scenario_file: null,
    }),
  );
  only(
    eng("PROJECT_RECOVERED", {
      from_status: "running",
      closed_runs: 1,
      interrupted_tasks: 1,
    }),
  );
  only(
    eng("RESULT_FILE", {
      name: "a.md",
      bytes: 1,
      sha256: "0".repeat(64),
      kind: "result",
      from_work: false,
    }),
  );
  only(eng("LOCK_STALE_REMOVED", { pid: 4242 }));
  only(eng("JOURNAL_RECOVERED", { line: 5, dropped_bytes: 10 }));
  only(
    eng(
      "RUN_FINISHED",
      {
        run_id: run,
        outcome: "interrupted",
        summary: null,
        cost_usd: null,
        files: [],
      },
      "t-0001",
    ),
  );
  // the run is still open: the refusal changed nothing; the task is in work
  assert.ok(w.state.runs.open[run]);
  w.append(
    eng(
      "RUN_FINISHED",
      {
        run_id: run,
        outcome: "cancelled",
        summary: null,
        cost_usd: null,
        files: [],
      },
      "t-0001",
    ),
  );
  only(eng("TASK_INTERRUPTED", { cause: "recovery" }, "t-0001"));
  w.append(eng("TASK_INTERRUPTED", { cause: "stop" }, "t-0001"));
  assert.equal(w.state.tasks[0].status, "interrupted");
});

// ---- TM-09 ---------------------------------------------------------------------------

test("TM-09 an event of the engine one millisecond earlier than the previous one is refused; the same time is accepted", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  const { writer: w, dir } = p;
  const last = ms(lastTs(p));
  clock.set(last - 1);
  const err = assertAppendRefused(
    w,
    dir,
    eng("PLANNING_STARTED", { round: 0 }),
    "E_TIME",
  );
  assert.match(err.message, /Часы компьютера/);
  clock.set(last);
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  clock.set(last);
  const planning = w.append(eng("PLANNING_STARTED", { round: 0 }));
  assert.equal(ms(planning.ts), last);
  clock.set(last - 1);
  assertAppendRefused(
    w,
    dir,
    eng("PLAN_REJECTED", {
      round: 0,
      attempt: 1,
      reason: "schema",
      detail: "Нет",
    }),
    "E_TIME",
  );
  // an engine event may not bring its own time
  clock.set(last + 1000);
  assertAppendRefused(
    w,
    dir,
    {
      ...eng("PLAN_REJECTED", {
        round: 0,
        attempt: 1,
        reason: "schema",
        detail: "Нет",
      }),
      ts: new Date(last + 1000).toISOString(),
    },
    "E_EVENT",
  );
});

// ---- TM-10 ---------------------------------------------------------------------------

test("TM-10 USER and AGENT may be 2000 ms earlier than the previous event, not 2001; none may be later than the clock", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  const { writer: w, dir } = p;
  const iso = (n) => new Date(n).toISOString();
  const memory = (source, ts) => ({
    source,
    type: "MEMORY_ADDED",
    task: null,
    ts,
    data:
      source === "AGENT"
        ? { kind: "note", text: "Заметка", executor: "claude-cli" }
        : { kind: "note", text: "Заметка" },
  });
  for (const source of ["USER", "AGENT"]) {
    const base = ms(lastTs(p)) + 10_000;
    clock.set(base + 5000);
    w.append(memory(source, iso(base)));
    assertAppendRefused(w, dir, memory(source, iso(base - 2001)), "E_TIME");
    const ok = w.append(memory(source, iso(base - 2000)));
    assert.equal(ok.ts, iso(base - 2000));
    // later than the clock of the writer
    clock.set(base + 5000);
    assertAppendRefused(w, dir, memory(source, iso(base + 5001)), "E_TIME");
    w.append(memory(source, iso(base + 5000)));
  }
  // without a time the writer takes its own
  clock.set(ms(lastTs(p)) + 1);
  assert.equal(w.say("Привет").ts, iso(ms(lastTs(p))));
  // a time not in the canonical form
  assertAppendRefused(
    w,
    dir,
    { ...memory("USER", "2026-10-06 09:00:00") },
    "E_EVENT",
  );
  assertAppendRefused(w, dir, { ...memory("USER", 1790000000000) }, "E_EVENT");
});

test("TM-10 the rules of the time are checked again when the journal is read", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  p.writer.close();
  const last = ms(lastTs(p));
  const chat = (seq, at) => craft(p.id, seq, new Date(at).toISOString());
  // 2000 ms earlier: fine; the next one 2001 ms earlier than that: broken
  fs.appendFileSync(p.events, `${JSON.stringify(chat(2, last - 2000))}\n`);
  assert.equal(readProject(p.id, { home }).state.last_seq, 2);
  fs.appendFileSync(p.events, `${JSON.stringify(chat(3, last - 4001))}\n`);
  assertRefusal(p.dir, () => readProject(p.id, { home }), "E_CORRUPT");
  assertRefusal(p.dir, () => openWriter(p.id, { home }), "E_CORRUPT");
  // an engine event earlier by 1 ms
  const q = startProject(t, home, makeClock());
  q.writer.close();
  const at = ms(lastTs(q));
  fs.appendFileSync(
    q.events,
    `${JSON.stringify(craft(q.id, 2, new Date(at - 1).toISOString(), { source: "ENGINE", type: "PLANNING_STARTED", data: { round: 0 } }))}\n`,
  );
  assertRefusal(q.dir, () => readProject(q.id, { home }), "E_CORRUPT");
});

// ---- TM-43 ---------------------------------------------------------------------------

// Fictional values shaped like keys (the rules M4-M7 and the label of an assignment).
// Built from parts, so that no key-shaped text stands in the file in one piece.
const SECRETS = [
  ["sk", "-ant-api03-", "FAKEFAKEFAKEFAKE1234567890abcd"].join(""),
  ["gh", "p_", "FAKEFAKEFAKEFAKEFAKE1234567890abcd"].join(""),
  ["AK", "IA", "FAKEFAKEFAKE1234"].join(""),
  [
    ["ey", "JhbGciOiJIUzI1NiJ9"].join(""),
    ["ey", "JzdWIiOiJmYWtlIn0"].join(""),
    "ZmFrZXNpZ25hdHVyZQ",
  ].join("."),
  "hunter2fake",
];
const LABEL = "[скрыто]";

function everyFile(dir) {
  const out = [];
  const walk = (abs) => {
    for (const name of fs.readdirSync(abs)) {
      const p = path.join(abs, name);
      const st = fs.lstatSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile()) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function secretText() {
  return `ключи: ${SECRETS[0]} и ${SECRETS[1]}, ${SECRETS[2]}, токен ${SECRETS[3]}, password=${SECRETS[4]}`;
}

test("TM-43 secrets in text fields and in files never reach a file of the data folder", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const text = secretText();
  const { id } = newProject(home, clock, { goal: `Цель. ${text}` });
  const w = openTracked(t, home, id, clock);
  w.say(text);
  w.append(eng("CHAT", { text, kind: "question", truncated: false }));
  w.addMemory({ kind: "fact", text });
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  w.append(
    eng("PLAN_REJECTED", {
      round: 0,
      attempt: 1,
      reason: "schema",
      detail: text,
    }),
  );
  w.append(eng("PLAN_RETRY", { round: 0, attempt: 2 }));
  w.append(
    eng("PLAN_RECEIVED", {
      round: 0,
      tasks: [planTask("t-0001", "lawyer", { text, done_when: text })],
    }),
  );
  w.addTask({ role: "lawyer", text, done_when: text });
  const dir = path.join(home, id);
  // A result file with any of the five samples is refused (REQ-102): nothing of it
  // reaches the disk, the file is not created, the files and the journal do not change.
  const contents = [
    `ключи: ${SECRETS[0]}`,
    `ключи: ${SECRETS[1]}`,
    SECRETS[2],
    `токен ${SECRETS[3]}`,
    `password=${SECRETS[4]}`,
  ];
  for (const content of contents) {
    const err = assertRefusal(
      dir,
      () => w.writeResultFile({ task: "t-0001", name: "report.md", content }),
      "E_WORK_FILE",
    );
    assert.equal(err.details.reason, "secret", content);
    assert.ok(!fs.existsSync(path.join(dir, "files", "report.md")));
  }
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, "files")), []);
  const all = everyFile(dir)
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  for (const secret of SECRETS) {
    assert.ok(!all.includes(secret), `a secret is in the files: ${secret}`);
  }
  assert.ok(all.includes(LABEL));
  const events = journalOf(path.join(dir, "events.jsonl"));
  // the stored text is what maskSecrets gives
  assert.equal(events[0].data.goal, maskSecrets(`Цель. ${text}`));
  const chat = events.find((e) => e.type === "CHAT" && e.source === "USER");
  assert.equal(chat.data.text, maskSecrets(text));
  assert.ok(chat.data.text.includes(LABEL));
  assert.equal(w.state.chat[0].text, maskSecrets(text));
  const plan = events.find((e) => e.type === "PLAN_RECEIVED");
  assert.equal(plan.data.tasks[0].text, maskSecrets(text));
  assert.equal(plan.data.tasks[0].done_when, maskSecrets(text));
});

test("TM-43 masking does not touch ids, codes, hashes and names", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  withPlan(w, [planTask("t-0001", "researcher")]);
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  startRun(w, "work", "researcher", "t-0001");
  const file = w.writeResultFile({
    task: "t-0001",
    name: "plan.v2.md",
    content: "Версия 1.2.3\n",
  });
  const events = journalOf(p.events);
  assert.equal(events.at(-1).data.name, "plan.v2.md");
  assert.match(file.data.sha256, /^[0-9a-f]{64}$/);
  // the content is the text as written (the rule M7 once made "Версия [скрыто]" of it)
  assert.equal(
    fs.readFileSync(path.join(p.dir, "files", "plan.v2.md"), "utf8"),
    "Версия 1.2.3\n",
  );
  assert.equal(
    file.data.sha256,
    "c01c475efa274f49aebc33b6dea4307fc5400330863115161fc8baf41fac3214",
  );
  const run = events.find((e) => e.type === "RUN_STARTED");
  assert.equal(run.data.run_id, "r-00001");
  assert.equal(run.task, "t-0001");
  assert.equal(events[0].project, p.id);
});

// ---- TM-44 ---------------------------------------------------------------------------

test("TM-44 the core imports maskSecrets from pixel-office and has no rules of its own", () => {
  const files = fs.readdirSync(TEAM_SRC).filter((n) => n.endsWith(".js"));
  const importing = files.filter((n) =>
    /^import .*pixel-office\/mask\.js";$/m.test(
      fs.readFileSync(path.join(TEAM_SRC, n), "utf8"),
    ),
  );
  // the writer of the core masks; a later module may import the same function, never a copy
  assert.ok(importing.includes("store.js"), importing.join(", "));
  for (const name of files) {
    const text = fs.readFileSync(path.join(TEAM_SRC, name), "utf8");
    assert.doesNotMatch(
      text,
      /AKIA|ASIA|github_pat|-----BEGIN|sk-\[|gh\[pos\]/,
      name,
    );
    assert.doesNotMatch(text, /MASK_LABEL|\[скрыто\]/, name);
  }
  assert.ok(typeof maskSecrets === "function");
});

// ---- the size of a line ----------------------------------------------------------------

test("a line of the journal over 1 MiB is E_EVENT_TOO_BIG and nothing changes; a big plan below the limit is fine", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w, dir } = p;
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  // a control character takes six bytes in JSON ("\\u0001"), a text may have 4000 of them
  const heavy = (id) =>
    planTask(id, "researcher", {
      text: "\u0001".repeat(4000),
      done_when: "\u0001".repeat(2000),
    });
  const ids = Array.from(
    { length: 40 },
    (_, i) => `t-${String(i + 1).padStart(4, "0")}`,
  );
  assertAppendRefused(
    w,
    dir,
    eng("PLAN_RECEIVED", { round: 0, tasks: ids.map(heavy) }),
    "E_EVENT_TOO_BIG",
  );
  const small = eng("PLAN_RECEIVED", {
    round: 0,
    tasks: ids.slice(0, 20).map(heavy),
  });
  const event = w.append(small);
  assert.ok(Buffer.byteLength(`${JSON.stringify(event)}\n`) > 500_000);
  assert.ok(Buffer.byteLength(`${JSON.stringify(event)}\n`) < 1024 * 1024);
});
