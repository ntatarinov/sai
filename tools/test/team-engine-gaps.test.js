// Sai Team engine: gaps that the mutants of the step of the tests (WF-02, step 5) found
// in the tests that came with the code. Only the scripted executor is started, after
// assertSafeEnv (the helpers of team-engine-helpers.js).
//
// EN-60 (exit): the last look at inbox/ before the engine gives the lock back (design
// REQ-013, section 13.8; criterion 9, item 5). The window between the last ordinary
// look and the release of the lock is made by the test itself: the reading of inbox/
// of node:fs is wrapped so that two message files appear right after the last
// ordinary look of a finished project; no hook in the product code.
//
// EN-35 (no draft): a critical task whose work leaves no draft file (design 9.1: the
// draft is obligatory, I19) is not checked and never asks for an approval.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { sendToEngine } from "../src/team/engine/channel.js";
import { openWriter } from "../src/team/store.js";
import {
  describeRun,
  execEnv,
  fakeStarts,
  journal,
  makeProject,
  makeSandbox,
  ofType,
  runTeam,
  sha256,
  snapshot,
  spawnTeam,
  waitUntil,
  withLimit,
} from "./exec-helpers.js";
import {
  GOAL,
  GOAL_OK,
  PASS,
  WORK_OK,
  engineProject,
  engineReady,
  inputs,
  isQuestion,
  item,
  manualEngine,
  ok,
  pauseAndExit,
  planRun,
  runToEnd,
  scenarioRun,
  spawnEngine,
  startEngine,
  until,
} from "./team-engine-helpers.js";

function body(p, kind, args) {
  return {
    v: 1,
    project: p.id,
    nonce: crypto.randomBytes(8).toString("hex"),
    sender_pid: process.pid,
    sent_at: new Date().toISOString(),
    kind,
    args,
  };
}

function put(p, n, message) {
  const name = `m-${String(n).padStart(12, "0")}.json`;
  const file = path.join(p.dir, "inbox", name);
  fs.writeFileSync(file, JSON.stringify(message), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return name;
}

function ackOf(p, nonce) {
  const file = path.join(p.dir, "inbox", "ack", `${nonce}.ack`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

test(
  "EN-60 (exit) messages that appear after the last ordinary look of a finished project are executed (say) or refused with an ack (pause) before the lock is given back: no file is left in inbox/, one event, no event for the refused",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    const inboxDir = path.join(p.dir, "inbox");
    const say = body(p, "say", { text: "Пришло в момент выхода" });
    const pause = body(p, "pause", {});
    const real = fs.readdirSync;
    let planted = false;
    let lockAtPlant = null;
    t.mock.method(fs, "readdirSync", (...args) => {
      const result = real.apply(fs, args);
      if (
        !planted &&
        args[0] === inboxDir &&
        fs.readFileSync(p.events, "utf8").includes('"PROJECT_DONE"')
      ) {
        planted = true;
        lockAtPlant = fs.existsSync(path.join(p.dir, "writer.lock"));
        put(p, 500, say);
        put(p, 501, pause);
      }
      return result;
    });
    const result = await runToEnd(p);
    t.mock.restoreAll();
    assert.equal(result.status, "done");
    assert.equal(planted, true, "the window was made");
    assert.equal(lockAtPlant, true, "the lock was still held at that moment");
    const events = journal(p);
    const said = events.filter(
      (e) => e.type === "CHAT" && e.data.text === "Пришло в момент выхода",
    );
    assert.equal(said.length, 1, "the say is written exactly once");
    assert.equal(said[0].source, "USER");
    assert.equal(said[0].data.msg, "m-000000000500.json");
    assert.equal(
      events.some((e) => e.type === "PROJECT_PAUSED"),
      false,
      "the pause of a finished project is not executed",
    );
    assert.equal(ackOf(p, say.nonce)?.ok, true);
    const refused = ackOf(p, pause.nonce);
    assert.equal(refused?.ok, false);
    assert.equal(refused.code, "E_FINISHED");
    assert.deepStrictEqual(
      fs.readdirSync(inboxDir).filter((n) => /^m-/.test(n)),
      [],
      "no message file is left",
    );
    assert.equal(
      fs.existsSync(path.join(p.dir, "writer.lock")),
      false,
      "the lock is given back",
    );
  },
);

test(
  "EN-35 (no draft) a critical task whose work leaves no draft: no run of the reviewer, no approval, the work is repeated with the note about the draft, then another role, then the question review_failed; no TASK_DONE",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("post", { role: "marketer", critical: true })]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ record_input: "input.md" }]),
      scenarioRun(
        { purpose: "reassign" },
        ok({ role: "researcher", reason: "Нужен черновик" }),
      ),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    const e = startEngine(t, p);
    await until(p, isQuestion, "the question");
    await pauseAndExit(e);
    const events = journal(p);
    const runs = ofType(events, "RUN_STARTED").map((x) => x.data.purpose);
    assert.deepStrictEqual(
      runs,
      ["plan", "work", "work", "work", "reassign", "work", "work", "work"],
      "six runs of the work and one of the choice of a role; the reviewer is never asked",
    );
    assert.equal(ofType(events, "REVIEW_RESULT").length, 0);
    assert.equal(
      ofType(events, "RESULT_FILE").filter((x) => x.data.kind === "draft")
        .length,
      0,
    );
    assert.deepStrictEqual(
      ofType(events, "TASK_WAITING_USER").map((x) => x.data),
      [{ reason: "review_failed", draft: null }],
      "no approval without a draft",
    );
    assert.equal(ofType(events, "TASK_DONE").length, 0);
    const workInputs = inputs(p, "-input.md");
    assert.equal(workInputs.length, 6);
    assert.equal(
      workInputs[0].includes("Нужен черновик файлом с видом draft"),
      false,
      "the first run has only the note of the critical task",
    );
    for (const i of [1, 2, 4, 5]) {
      assert.ok(
        workInputs[i].includes("Нужен черновик файлом с видом draft"),
        `input ${i + 1}`,
      );
    }
  },
);

test(
  "EN-62 (ack of another nonce) an ack with mode 0600 that carries another nonce than the message is not trusted: the sender revokes its message (E_CHANNEL_TIMEOUT), the ack is not removed, no event is written",
  { timeout: 120_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 60_000 }]),
    ]);
    const run = spawnEngine(t, p);
    await engineReady(p);
    await until(
      p,
      (e) => e.type === "RUN_STARTED" && e.task !== null,
      "the work",
    );
    process.kill(run.child.pid, "SIGSTOP");
    t.after(() => {
      try {
        process.kill(run.child.pid, "SIGCONT");
      } catch {
        // gone
      }
    });
    const inbox = path.join(p.dir, "inbox");
    const sender = spawnTeam(["say", p.id, "С чужим nonce"], p.env);
    const isMessage = (n) => /^m-[0-9]{12}\.json$/.test(n);
    await waitUntil(() => fs.readdirSync(inbox).some(isMessage));
    const name = fs.readdirSync(inbox).find(isMessage);
    const { nonce } = JSON.parse(
      fs.readFileSync(path.join(inbox, name), "utf8"),
    );
    const other = nonce
      .split("")
      .map((c) => (c === "0" ? "1" : "0"))
      .join("");
    assert.notEqual(other, nonce);
    const planted = path.join(inbox, "ack", `${nonce}.ack`);
    fs.writeFileSync(
      planted,
      JSON.stringify({
        v: 1,
        nonce: other,
        msg: name,
        ok: true,
        event: {},
        notices: [],
      }),
      { mode: 0o600 },
    );
    fs.chmodSync(planted, 0o600);
    const res = await withLimit(sender.done);
    assert.equal(res.status, 1, describeRun(res));
    assert.match(res.stderr, /^E_CHANNEL_TIMEOUT: /);
    assert.equal(fs.existsSync(planted), true, "the ack is not removed");
    assert.equal(fs.existsSync(path.join(inbox, name)), false, "revoked");
    assert.equal(
      journal(p).filter((e) => e.type === "CHAT" && e.source === "USER").length,
      0,
      "no chat event",
    );
    process.kill(run.child.pid, "SIGCONT");
  },
);

const FROZEN = [
  planRun([item("a")]),
  scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 60_000 }]),
];

function padded(p, n, text, size) {
  const message = body(p, "say", { text });
  const json = JSON.stringify(message);
  const name = `m-${String(n).padStart(12, "0")}.json`;
  const file = path.join(p.dir, "inbox", name);
  fs.writeFileSync(file, json + " ".repeat(size - Buffer.byteLength(json)), {
    mode: 0o600,
  });
  fs.chmodSync(file, 0o600);
  assert.equal(fs.statSync(file).size, size);
  return message;
}

test(
  "EN-62 (size) a valid message file of exactly 65536 bytes is executed, one of 65537 bytes is not executed (no event, no ack) and is removed",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, FROZEN);
    const m = manualEngine(t, p);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    const events = () => journal(p).filter((e) => e.type === "CHAT");
    const edge = padded(p, 1, "Ровно предел", 65_536);
    const over = padded(p, 2, "Выше предела", 65_537);
    m.tick();
    assert.equal(
      events().filter((e) => e.data.text === "Ровно предел").length,
      1,
    );
    assert.equal(
      events().filter((e) => e.data.text === "Выше предела").length,
      0,
    );
    const ack = (nonce) =>
      JSON.parse(
        fs.readFileSync(
          path.join(p.dir, "inbox", "ack", `${nonce}.ack`),
          "utf8",
        ),
      );
    assert.equal(ack(edge.nonce).ok, true);
    assert.equal(
      fs.existsSync(path.join(p.dir, "inbox", "ack", `${over.nonce}.ack`)),
      false,
      "a file above the limit is not read: it has no ack",
    );
    assert.deepStrictEqual(
      fs.readdirSync(path.join(p.dir, "inbox")).filter((n) => /^m-/.test(n)),
      [],
    );
  },
);

test(
  "EN-58 (latency) twelve messages one after another: from the sending to the event of each at most 1 s (the engine reads inbox/ about every 100 ms, a pause between looks of seconds would show here)",
  { timeout: 120_000 },
  async (t) => {
    const p = engineProject(t, FROZEN);
    const engine = spawnEngine(t, p);
    await engineReady(p);
    await until(
      p,
      (e) => e.type === "RUN_STARTED" && e.task !== null,
      "the work",
    );
    const late = [];
    for (let i = 0; i < 12; i += 1) {
      const at = Date.now();
      const ack = await withLimit(
        sendToEngine(
          p.id,
          { kind: "say", args: { text: `Отклик ${i}` } },
          { home: p.sb.home },
        ),
      );
      const took = Date.parse(ack.event.ts) - at;
      if (took > 1000) late.push(`${i}: ${took} ms`);
    }
    assert.deepStrictEqual(late, []);
    engine.child.kill("SIGTERM");
    assert.equal((await withLimit(engine.done)).status, 0);
  },
);

const withFile = (task, name, content) =>
  scenarioRun(
    { purpose: "work", task },
    { ...WORK_OK, files: [{ name, content }] },
  );

test(
  "EN-30 / EN-45 (inputs) the input of the check holds the files of the checked task and its criterion, not the files of another task; the input of the goal check holds the files of every done task and the list of the tasks",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a"), item("b", { depends_on: ["a"] })]),
      withFile("t-0001", "prices.md", "ЦЕНЫ-ПЕРВОЙ-ЗАДАЧИ"),
      withFile("t-0002", "calc.md", "РАСЧЁТ-ВТОРОЙ-ЗАДАЧИ"),
      scenarioRun({ purpose: "review" }, PASS, [{ record_input: "review.md" }]),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK, [
        { record_input: "goal.md" },
      ]),
    ]);
    assert.equal((await runToEnd(p)).status, "done");
    const [first, second] = inputs(p, "-review.md");
    assert.ok(first.includes("ЦЕНЫ-ПЕРВОЙ-ЗАДАЧИ"), "the files of the task");
    assert.ok(first.includes("Вымышленная задача a"), "its text");
    assert.ok(first.includes("Есть итог"), "its criterion");
    assert.equal(first.includes("РАСЧЁТ-ВТОРОЙ-ЗАДАЧИ"), false);
    assert.ok(second.includes("РАСЧЁТ-ВТОРОЙ-ЗАДАЧИ"));
    assert.equal(second.includes("ЦЕНЫ-ПЕРВОЙ-ЗАДАЧИ"), false);
    const [goal] = inputs(p, "-goal.md");
    assert.ok(goal.includes("ЦЕНЫ-ПЕРВОЙ-ЗАДАЧИ"), "the files of a done task");
    assert.ok(
      goal.includes("РАСЧЁТ-ВТОРОЙ-ЗАДАЧИ"),
      "the files of a done task",
    );
    assert.ok(goal.includes("— t-0001, "), "the list of the tasks");
    assert.ok(goal.includes("— t-0002, "), "the list of the tasks");
    assert.ok(goal.includes(GOAL), "the goal");
  },
);

test(
  "EN-31 (reassign input) the choice of another role gets the notes of the reviewer, the criterion, the current role and the catalog",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK),
      scenarioRun(
        { purpose: "review" },
        ok({ passed: false, notes: "ЗАМЕЧАНИЕ-ПРОВЕРЯЮЩЕГО-ОДИН" }),
      ),
      scenarioRun(
        { purpose: "reassign" },
        ok({ role: "financial_analyst", reason: "Нужен расчёт" }),
        [{ record_input: "reassign.md" }],
      ),
    ]);
    const e = startEngine(t, p);
    await until(p, isQuestion, "the question");
    await pauseAndExit(e);
    const [input] = inputs(p, "-reassign.md");
    assert.ok(input.includes("— ЗАМЕЧАНИЕ-ПРОВЕРЯЮЩЕГО-ОДИН"), "the notes");
    assert.ok(input.includes("Критерий готовности: Есть итог"));
    assert.ok(input.includes("(researcher)"), "the current role");
    assert.ok(input.includes("financial_analyst: "), "the catalog");
  },
);

test(
  "EN-13 (nothing before the refusal) resume without SAI_TEAM_REAL_RUNS=1 of a project whose journal ends with a torn line: refused, the journal bytes and the folder are as they were (the torn line is not repaired, no lock is taken), nothing started",
  { timeout: 60_000 },
  (t) => {
    const sb = makeSandbox(t);
    const p = makeProject(sb, { tasks: 0 });
    const w = openWriter(p.id, { home: sb.home });
    try {
      w.append({
        source: "USER",
        type: "PROJECT_STARTED",
        task: null,
        data: { parallel: 2 },
      });
      w.append({
        source: "USER",
        type: "PROJECT_PAUSED",
        task: null,
        data: {},
      });
    } finally {
      w.close();
    }
    fs.appendFileSync(p.events, '{"seq":99,"ty');
    const before = sha256(fs.readFileSync(p.events));
    const tree = snapshot(p.dir);
    const off = execEnv(sb, { SAI_TEAM_REAL_RUNS: undefined });
    const r = runTeam(["resume", p.id], off);
    assert.equal(r.status, 1, describeRun(r));
    assert.match(r.stderr, /^E_REAL_RUNS_OFF: /);
    assert.equal(sha256(fs.readFileSync(p.events)), before, "the journal");
    assert.deepStrictEqual(snapshot(p.dir), tree, "the folder");
    assert.equal(fakeStarts(sb).length, 0);
  },
);
