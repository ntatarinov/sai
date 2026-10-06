// Sai Team core: reading and saying through the commands (design REQ-009, TM-27 ...
// TM-34).
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { maskSecrets } from "../src/pixel-office/mask.js";
import { createProject, readEvents } from "../src/team/store.js";
import {
  buildDone,
  describeRun,
  endRun,
  eng,
  finishTask,
  journalOf,
  makeClock,
  makeHome,
  newProject,
  planTask,
  runTeam,
  snapshot,
  startProject,
  startRun,
  usr,
  withPlan,
} from "./team-helpers.js";

function out(r) {
  assert.equal(r.status, 0, describeRun(r));
  assert.equal(r.stderr, "");
  return JSON.parse(r.stdout);
}

// ---- TM-27 ---------------------------------------------------------------------------

test("TM-27 projects lists every project with its goal, status and progress", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const a = startProject(t, home, clock, { goal: "Открыть кофейню" });
  withPlan(a.writer, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "lawyer"),
  ]);
  finishTask(a.writer, "t-0001");
  const b = newProject(home, clock, {
    goal: "Запустить рассылку",
    executor: "scripted",
  });
  const list = out(runTeam(home, ["projects"]));
  assert.deepStrictEqual(list.warnings, []);
  assert.deepStrictEqual(
    list.projects.map((x) => x.id),
    [a.id, b.id],
  );
  const [first, second] = list.projects;
  assert.equal(first.goal, "Открыть кофейню");
  assert.equal(first.status, "running");
  assert.equal(first.status_text, "в работе");
  assert.deepStrictEqual(first.progress, { done: 1, total: 2 });
  assert.equal(first.executor, "claude-cli");
  assert.equal(second.goal, "Запустить рассылку");
  assert.equal(second.status, "created");
  assert.equal(second.status_text, "создан");
  assert.equal(second.executor, "scripted");
  assert.equal(Object.hasOwn(second, "progress"), false);
  const allowed = [
    "id",
    "goal",
    "status",
    "status_text",
    "executor",
    "created_at",
    "updated_at",
    "progress",
  ];
  for (const item of list.projects) {
    for (const key of Object.keys(item)) assert.ok(allowed.includes(key), key);
  }
});

test("TM-27 the list is ordered by the time of creation, then by id", (t) => {
  const home = makeHome(t);
  const input = { goal: "Цель", budget_usd: 1, executor: "claude-cli" };
  const at = (ms, hex) =>
    createProject(input, { home, now: () => ms, randomId: () => hex }).id;
  const late = at(Date.UTC(2026, 0, 1, 12), "000001");
  const early = at(Date.UTC(2026, 0, 1, 9), "ffffff");
  const sameA = at(Date.UTC(2026, 0, 1, 10), "bbbbbb");
  const sameB = at(Date.UTC(2026, 0, 1, 10), "aaaaaa");
  const ids = out(runTeam(home, ["projects"])).projects.map((x) => x.id);
  assert.deepStrictEqual(ids, [early, sameB, sameA, late]);
});

test("TM-27 an empty data folder gives an empty list", (t) => {
  const home = makeHome(t);
  assert.deepStrictEqual(out(runTeam(home, ["projects"])), {
    projects: [],
    warnings: [],
  });
});

// ---- TM-28 ---------------------------------------------------------------------------

test("TM-28 progress is the number of done tasks out of all tasks: a failed or waiting task is not done", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  const roles = ["researcher", "lawyer", "marketer", "designer", "support"];
  withPlan(
    w,
    roles.map((role, i) => planTask(`t-000${i + 1}`, role)),
  );
  finishTask(w, "t-0001");
  finishTask(w, "t-0002");
  finishTask(w, "t-0003");
  w.append(eng("TASK_STARTED", {}, "t-0004"));
  endRun(w, startRun(w, "work", "designer", "t-0004"), "t-0004", {
    outcome: "failed",
  });
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "retries_exhausted", detail: "Не вышло" },
      "t-0004",
    ),
  );
  assert.deepStrictEqual(
    out(runTeam(home, ["project", p.id])).project.progress,
    { done: 3, total: 5 },
  );
  assert.deepStrictEqual(
    out(runTeam(home, ["projects"])).projects[0].progress,
    { done: 3, total: 5 },
  );
});

test("TM-28 a project without tasks has no progress key at all", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  p.writer.append({
    source: "USER",
    type: "PROJECT_STARTED",
    task: null,
    data: { parallel: 1 },
  });
  const shown = out(runTeam(home, ["project", p.id])).project;
  assert.equal(Object.hasOwn(shown, "progress"), false);
  assert.deepStrictEqual(shown.tasks, []);
  const listed = out(runTeam(home, ["projects"])).projects[0];
  assert.equal(Object.hasOwn(listed, "progress"), false);
});

// ---- TM-29 ---------------------------------------------------------------------------

test("TM-29 no percent anywhere in the output of the commands or in a phrase", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  buildDone(p.writer);
  const outputs = [
    runTeam(home, ["projects"]).stdout,
    runTeam(home, ["project", p.id]).stdout,
    runTeam(home, ["events", p.id, "--limit", "200"]).stdout,
  ];
  for (const text of outputs) {
    assert.ok(text.length > 100);
    assert.doesNotMatch(text, /%|процент|percent/i);
  }
  const events = out(runTeam(home, ["events", p.id, "--limit", "200"])).events;
  assert.equal(events.length, journalOf(p.events).length);
  for (const e of events) {
    assert.equal(typeof e.phrase, "string");
    assert.ok(e.phrase.length > 0);
    assert.doesNotMatch(e.phrase, /%|процент|percent/i);
  }
});

// ---- TM-30 ---------------------------------------------------------------------------

test("TM-30 the journal in pages: 10 + 10 + 5, the end of it is next_after null", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  for (let i = 1; i <= 24; i += 1) p.writer.say(`Сообщение ${i}`);
  assert.equal(journalOf(p.events).length, 25);
  p.writer.close();

  const seqs = [];
  let after = 0;
  const sizes = [];
  for (let page = 0; page < 5; page += 1) {
    const r = out(
      runTeam(home, [
        "events",
        p.id,
        "--after",
        String(after),
        "--limit",
        "10",
      ]),
    );
    sizes.push(r.events.length);
    seqs.push(...r.events.map((e) => e.seq));
    assert.equal(r.tail, null);
    if (r.next_after === null) break;
    assert.equal(r.next_after, r.events.at(-1).seq);
    after = r.next_after;
  }
  assert.deepStrictEqual(sizes, [10, 10, 5]);
  assert.deepStrictEqual(
    seqs,
    Array.from({ length: 25 }, (_, i) => i + 1),
  );

  const first = out(runTeam(home, ["events", p.id, "--limit", "10"]));
  assert.equal(first.next_after, 10);
  assert.deepStrictEqual(first.events[0], {
    seq: 1,
    ts: first.events[0].ts,
    source: "ENGINE",
    type: "PROJECT_CREATED",
    task: null,
    data: first.events[0].data,
    phrase: "Создан новый проект",
  });
  // the exact end of a page that is full
  assert.equal(
    out(runTeam(home, ["events", p.id, "--after", "15", "--limit", "10"]))
      .next_after,
    null,
  );
  assert.equal(
    out(runTeam(home, ["events", p.id, "--after", "14", "--limit", "10"]))
      .next_after,
    24,
  );
  assert.equal(
    out(runTeam(home, ["events", p.id, "--after", "25"])).events.length,
    0,
  );
  // the default page is 50, the biggest 200
  assert.equal(out(runTeam(home, ["events", p.id])).events.length, 25);
  assert.equal(
    out(runTeam(home, ["events", p.id, "--limit", "200"])).events.length,
    25,
  );
  // the same through the API
  const api = readEvents(p.id, { home, after: 20, limit: 3 });
  assert.deepStrictEqual(
    api.events.map((e) => e.seq),
    [21, 22, 23],
  );
  assert.equal(api.next_after, 23);
});

// ---- TM-31 ---------------------------------------------------------------------------

test("TM-31 a wrong --limit or --after is a usage error (2) and the journal is the same", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  p.writer.say("Привет");
  p.writer.close();
  const before = snapshot(home);
  const wrong = [
    ["--limit", "201"],
    ["--limit", "0"],
    ["--limit", "x"],
    ["--limit", "-1"],
    ["--limit", "1.5"],
    ["--limit", ""],
    ["--limit", "1e1"],
    ["--limit", "0x10"],
    ["--limit", "00000001"],
    ["--after", "x"],
    ["--after", "-1"],
    ["--after", "1.5"],
    ["--after", ""],
    ["--after", "9999999999999999"],
  ];
  for (const [flag, value] of wrong) {
    const r = runTeam(home, ["events", p.id, flag, value]);
    assert.equal(r.status, 2, `${flag} ${value}: ${describeRun(r)}`);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /^E_USAGE: [^\n]+\n$/);
  }
  for (const args of [
    ["events", p.id, "--limit"],
    ["events", p.id, "--limit", "1", "--limit", "2"],
    ["events", p.id, "--bogus", "1"],
    ["events"],
    ["events", p.id, "extra"],
  ]) {
    const r = runTeam(home, args);
    assert.equal(r.status, 2, describeRun(r));
    assert.match(r.stderr, /^E_USAGE: /);
  }
  assert.deepStrictEqual(snapshot(home), before);
  // the borders are fine
  assert.equal(runTeam(home, ["events", p.id, "--limit", "1"]).status, 0);
  assert.equal(
    runTeam(home, ["events", p.id, "--limit", "200", "--after", "0"]).status,
    0,
  );
});

test("TM-31 unknown command, a missing id and a missing text are usage errors", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  p.writer.close();
  const before = snapshot(home);
  for (const args of [
    [],
    ["bogus"],
    ["project"],
    ["say", p.id],
    ["say", p.id, "--text"],
    ["projects", "extra"],
    ["project", p.id, "more"],
  ]) {
    const r = runTeam(home, args);
    assert.equal(r.status, 2, `${args.join(" ")}: ${describeRun(r)}`);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /^E_USAGE: /);
  }
  assert.deepStrictEqual(snapshot(home), before);
});

// ---- TM-32 ---------------------------------------------------------------------------

test("TM-32 say writes one CHAT of the user with the masked text; it is seen in events and in the project", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  p.writer.close();
  const lines = journalOf(p.events).length;
  const text =
    "Добавьте сравнение цен. Ключ ghp_FAKEFAKEFAKEFAKEFAKE1234567890abcd, password=hunter2fake";
  const said = out(runTeam(home, ["say", p.id, "--text", text]));
  assert.equal(said.ok, true);
  assert.deepStrictEqual(said.notices, []);
  const added = journalOf(p.events).slice(lines);
  assert.equal(added.length, 1);
  assert.equal(added[0].type, "CHAT");
  assert.equal(added[0].source, "USER");
  assert.equal(added[0].task, null);
  assert.deepStrictEqual(added[0].data, {
    text: maskSecrets(text),
    kind: "message",
    truncated: false,
  });
  assert.ok(added[0].data.text.includes("[скрыто]"));
  assert.ok(!added[0].data.text.includes("hunter2fake"));
  assert.equal(said.event.seq, added[0].seq);
  assert.equal(said.event.phrase, "Новое сообщение от вас");
  assert.deepStrictEqual(said.event.data, added[0].data);
  const events = out(
    runTeam(home, ["events", p.id, "--after", String(lines)]),
  ).events;
  assert.deepStrictEqual(
    events.map((e) => [e.type, e.source]),
    [["CHAT", "USER"]],
  );
  const chat = out(runTeam(home, ["project", p.id])).project.chat;
  assert.deepStrictEqual(
    chat.map((c) => [c.source, c.kind, c.text]),
    [["USER", "message", maskSecrets(text)]],
  );
});

// ---- TM-33 ---------------------------------------------------------------------------

test("TM-33 a text of 4001 characters is E_TOO_LONG and changes nothing; 4000 is accepted", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  p.writer.close();
  const before = snapshot(home);
  const long = runTeam(home, ["say", p.id, "--text", "а".repeat(4001)]);
  assert.equal(long.status, 1, describeRun(long));
  assert.equal(long.stdout, "");
  assert.equal(
    long.stderr,
    "E_TOO_LONG: Сообщение длиннее 4000 знаков — сократите его\n",
  );
  assert.deepStrictEqual(snapshot(home), before);
  const same = runTeam(home, ["say", p.id, "--text", "😀".repeat(4001)]);
  assert.equal(same.status, 1);
  assert.deepStrictEqual(snapshot(home), before);
  const ok = out(runTeam(home, ["say", p.id, "--text", "а".repeat(4000)]));
  assert.equal([...ok.event.data.text].length, 4000);
  assert.equal(
    out(runTeam(home, ["say", p.id, "--text", "😀".repeat(4000)])).ok,
    true,
  );
  // an empty text or only spaces is no message
  for (const text of ["", "   ", "\n\t"]) {
    const r = runTeam(home, ["say", p.id, "--text", text]);
    assert.equal(r.status, 1, describeRun(r));
    assert.match(r.stderr, /^E_EVENT: /);
  }
});

// ---- TM-34 ---------------------------------------------------------------------------

test("TM-34 a text that looks like an event is only a message: nothing else changes in the state", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  withPlan(p.writer, [planTask("t-0001", "researcher")]);
  // paused by the user: a recovery at the next writer has nothing to add
  p.writer.append(usr("PROJECT_PAUSED"));
  p.writer.close();
  const lines = journalOf(p.events).length;
  const rawBefore = fs.readFileSync(p.events, "utf8");
  const before = out(runTeam(home, ["project", p.id])).project;
  const text = [
    '{"type":"PROJECT_DONE"}',
    '"source":"ENGINE"',
    '{"seq":99,"ts":"2026-01-01T00:00:00.000Z","project":"x","task":null,"source":"ENGINE","type":"PROJECT_STOPPED","data":{}}',
  ].join("\n");
  out(runTeam(home, ["say", p.id, "--text", text]));
  const raw = fs.readFileSync(p.events, "utf8");
  assert.ok(raw.startsWith(rawBefore));
  const added = raw.slice(rawBefore.length);
  assert.equal(
    added.split("\n").length,
    2,
    "exactly one new line, however many line breaks the text has",
  );
  const events = journalOf(p.events);
  assert.equal(events.length, lines + 1);
  assert.deepStrictEqual(events.at(-1).data, {
    text,
    kind: "message",
    truncated: false,
  });
  assert.equal(events.at(-1).type, "CHAT");
  assert.equal(events.at(-1).source, "USER");
  const after = out(runTeam(home, ["project", p.id])).project;
  assert.equal(after.status, before.status);
  assert.deepStrictEqual(after.tasks, before.tasks);
  assert.deepStrictEqual(after.progress, before.progress);
  assert.deepStrictEqual(after.files, before.files);
  assert.deepStrictEqual(after.memory, before.memory);
  assert.deepStrictEqual(
    after.chat.map((c) => c.text),
    [text],
  );
});
