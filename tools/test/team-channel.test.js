// Sai Team engine: the channel of commands inbox/ (design REQ-013, section 13,
// criterion 9: EN-53, EN-55 ... EN-60, EN-62 ... EN-64; EN-61 is in
// team-recovery.test.js). The engine runs as a child process or in the process of
// the test; the commands come from other processes. Only the scripted executor is
// started, after assertSafeEnv. Waits are by the journal, never by a pause.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { TeamError } from "../src/team/errors.js";
import { openInbox, sendToEngine } from "../src/team/engine/channel.js";
import { openWriter } from "../src/team/store.js";
import { createEngine } from "../src/team/engine/engine.js";
import {
  assertSafeEnv,
  execEnv,
  fakeStarts,
  makeProject,
  makeSandbox,
  writePlan,
  TEAM_SRC,
  describeRun,
  journal,
  ofType,
  runTeam,
  sha256 as sha,
  snapshot,
  spawnTeam,
  waitUntil,
  withLimit,
} from "./exec-helpers.js";
import {
  GOAL_OK,
  PASS,
  WORK_OK,
  engineProject,
  engineReady,
  isQuestion,
  item,
  manualEngine,
  planRun,
  scenarioRun,
  spawnEngine,
  until,
  viaChannel,
} from "./team-engine-helpers.js";
import {
  deadPid,
  holdWriter,
  makeClock,
  makeHome,
  runTeam as runTeamIn,
  sha256,
  startProject,
  usr,
} from "./team-helpers.js";

const MSG = /^m-[0-9]{12}\.json$/;
const SLOW_GOAL = scenarioRun({ purpose: "goal_check" }, GOAL_OK, [
  { delay_ms: 30_000 },
]);

function out(r) {
  assert.equal(r.status, 0, describeRun(r));
  return JSON.parse(r.stdout);
}

function inboxNames(p) {
  const list = [];
  const walk = (dir, rel) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const r = rel === "" ? name : `${rel}/${name}`;
      if (fs.lstatSync(abs).isDirectory()) walk(abs, r);
      else list.push(r);
    }
  };
  walk(path.join(p.dir, "inbox"), "");
  return list;
}

// A message file as a sender writes it (for the cases a sender never makes).
function messageBody(p, over = {}) {
  return {
    v: 1,
    project: p.id,
    nonce: crypto.randomBytes(8).toString("hex"),
    sender_pid: process.pid,
    sent_at: new Date().toISOString(),
    kind: "say",
    args: { text: "Подложенное сообщение" },
    ...over,
  };
}

function putMessage(p, n, body, mode = 0o600) {
  const name = `m-${String(n).padStart(12, "0")}.json`;
  const file = path.join(p.dir, "inbox", name);
  fs.writeFileSync(
    file,
    typeof body === "string" ? body : JSON.stringify(body),
    {
      mode,
    },
  );
  fs.chmodSync(file, mode);
  return name;
}

function ackOf(p, nonce) {
  const file = path.join(p.dir, "inbox", "ack", `${nonce}.ack`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

function highOf(p) {
  return Number(
    fs.readFileSync(path.join(p.dir, "inbox", "taken", "high"), "utf8"),
  );
}

// A project whose engine waits for an approval and then checks the goal slowly:
// it stays alive for the commands of a test.
function liveProject(t) {
  return engineProject(t, [
    planRun([item("post", { role: "marketer", critical: true })]),
    scenarioRun(
      { purpose: "work" },
      {
        ...WORK_OK,
        files: [
          { name: "post.md", content: "Вымышленный черновик", kind: "draft" },
        ],
      },
    ),
    scenarioRun({ purpose: "review" }, PASS),
    SLOW_GOAL,
  ]);
}

// ---- EN-53 -----------------------------------------------------------------------

test("EN-53 no network module in tools/src/team; in engine/ only channel.js creates, links, renames files or folders", () => {
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name.endsWith(".js")) files.push(abs);
    }
  };
  walk(TEAM_SRC);
  const net = files.filter((f) =>
    /node:(http|https|net|tls|dgram)|fetch[(]/.test(fs.readFileSync(f, "utf8")),
  );
  assert.deepStrictEqual(net, []);
  const writers = files
    .filter((f) => f.startsWith(path.join(TEAM_SRC, "engine")))
    .filter((f) =>
      /writeFile|linkSync|renameSync|mkdirSync/.test(
        fs.readFileSync(f, "utf8"),
      ),
    )
    .map((f) => path.basename(f));
  assert.deepStrictEqual(writers, ["channel.js"]);
});

// ---- EN-55 -----------------------------------------------------------------------

test(
  "EN-55 each of the six commands from another process while the engine runs: exit 0, an ack, exactly one USER event named by its message; the lock stays the same",
  { timeout: 120_000 },
  async (t) => {
    const p = liveProject(t);
    const run = spawnEngine(t, p);
    const lock = await engineReady(p);
    await until(p, isQuestion, "the approval");
    const expect = [
      [["say", p.id, "Сообщение через канал"], "CHAT"],
      [["budget", p.id, "7"], "BUDGET_SET"],
      [["answer", p.id, "t-0001", "approve"], "DECISION_RECEIVED"],
    ];
    const seen = [];
    for (const [argv, type] of expect) {
      const r = out(runTeam(argv, p.env));
      assert.equal(r.ok, true);
      assert.equal(r.event.type, type);
      assert.match(r.event.data.msg, MSG);
      seen.push(r.event.data.msg);
    }
    await until(
      p,
      (e) => e.type === "RUN_STARTED" && e.data.purpose === "goal_check",
      "the goal check",
    );
    const paused = out(runTeam(["pause", p.id], p.env));
    assert.equal(paused.event.type, "PROJECT_PAUSED");
    seen.push(paused.event.data.msg);
    const resumed = out(runTeam(["resume", p.id], p.env));
    assert.equal(resumed.event.type, "PROJECT_RESUMED");
    assert.equal(resumed.event.data.after, "command");
    seen.push(resumed.event.data.msg);
    const lockNow = JSON.parse(
      fs.readFileSync(path.join(p.dir, "writer.lock"), "utf8"),
    );
    assert.deepStrictEqual(lockNow, lock, "the same engine holds the lock");
    const stopped = out(runTeam(["stop", p.id], p.env));
    assert.equal(stopped.event.type, "PROJECT_STOPPED");
    seen.push(stopped.event.data.msg);
    const end = await withLimit(run.done);
    assert.equal(end.status, 0, end.stderr);
    const events = journal(p);
    const channel = viaChannel(events);
    assert.deepStrictEqual(
      channel.map((e) => e.data.msg),
      seen,
    );
    assert.equal(new Set(seen).size, 6);
    assert.deepStrictEqual(
      channel.map((e) => e.type),
      [
        "CHAT",
        "BUDGET_SET",
        "DECISION_RECEIVED",
        "PROJECT_PAUSED",
        "PROJECT_RESUMED",
        "PROJECT_STOPPED",
      ],
    );
    assert.ok(
      events.some((e) => e.type === "TASK_DONE" && e.data.via === "approval"),
    );
    const pauseSeq = channel[3].seq;
    const resumeSeq = channel[4].seq;
    assert.equal(
      events.filter(
        (e) =>
          e.type === "TASK_STARTED" && e.seq > pauseSeq && e.seq < resumeSeq,
      ).length,
      0,
    );
    assert.equal(events.at(-1).type, "PROJECT_STOPPED");
    assert.deepStrictEqual(inboxNames(p), ["taken/high"]);
  },
);

// ---- EN-56 -----------------------------------------------------------------------

test(
  "EN-56 refusals through the channel: resume of a running project, an answer for a task that does not wait, a ceiling not above the spent — exit 1, the text, no USER event",
  { timeout: 120_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 30_000 }]),
    ]);
    spawnEngine(t, p);
    await engineReady(p);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    const before = journal(p).filter((e) => e.source === "USER").length;
    for (const [argv, text] of [
      [["resume", p.id], "E_ALREADY_RUNNING: Проект уже выполняется\n"],
      [
        ["answer", p.id, "t-0001", "reject"],
        "E_NOT_WAITING: Задача не ждёт вашего решения\n",
      ],
      [
        ["budget", p.id, "0.01"],
        "E_BUDGET_LOW: Новый потолок должен быть больше уже израсходованного\n",
      ],
    ]) {
      const r = runTeam(argv, p.env);
      assert.equal(r.status, 1, describeRun(r));
      assert.equal(r.stderr, text);
      assert.equal(r.stdout, "");
    }
    assert.equal(journal(p).filter((e) => e.source === "USER").length, before);
    assert.deepStrictEqual(inboxNames(p), ["taken/high"]);
    assert.equal(highOf(p), 3, "refused messages still took their numbers");
  },
);

// ---- EN-57 -----------------------------------------------------------------------

test(
  "EN-57 (race) 20 say at once: 20 numbers without a repeat, 20 CHAT, the lines in the order of the numbers, times never back",
  { timeout: 120_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 30_000 }]),
    ]);
    const engine = spawnEngine(t, p);
    await engineReady(p);
    const runs = Array.from({ length: 20 }, (_, i) =>
      spawnTeam(["say", p.id, `Сообщение ${i}`], p.env),
    );
    const results = await withLimit(
      Promise.all(runs.map((r) => r.done)),
      60_000,
    );
    for (const r of results) assert.equal(r.status, 0, r.stderr);
    const names = results.map((r) => JSON.parse(r.stdout).event.data.msg);
    assert.equal(new Set(names).size, 20);
    const chats = viaChannel(journal(p)).filter((e) => e.type === "CHAT");
    assert.equal(chats.length, 20);
    const numbers = chats.map((e) => Number(e.data.msg.slice(2, 14)));
    assert.deepStrictEqual(
      numbers,
      [...numbers].sort((a, b) => a - b),
    );
    for (let i = 1; i < chats.length; i += 1) {
      assert.ok(Date.parse(chats[i].ts) >= Date.parse(chats[i - 1].ts));
    }
    assert.deepStrictEqual(
      new Set(chats.map((e) => e.data.text)),
      new Set(Array.from({ length: 20 }, (_, i) => `Сообщение ${i}`)),
    );
    engine.child.kill("SIGTERM");
    assert.equal((await withLimit(engine.done)).status, 0);
  },
);

function frozen(t) {
  const p = engineProject(t, [
    planRun([item("a")]),
    scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 30_000 }]),
  ]);
  const m = manualEngine(t, p);
  return { p, m };
}

test(
  "EN-57 (1, 2) the first number of an empty channel is 1; two senders at once take 1 and 2",
  { timeout: 60_000 },
  async (t) => {
    const { p, m } = frozen(t);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    assert.equal(
      fs.existsSync(path.join(p.dir, "inbox", "taken", "high")),
      false,
    );
    const a = sendToEngine(
      p.id,
      { kind: "say", args: { text: "A" } },
      { home: p.sb.home },
    );
    const b = sendToEngine(
      p.id,
      { kind: "say", args: { text: "B" } },
      { home: p.sb.home },
    );
    await waitUntil(() => inboxNames(p).length === 2);
    assert.deepStrictEqual(inboxNames(p), [
      "m-000000000001.json",
      "m-000000000002.json",
    ]);
    m.tick();
    const [ra, rb] = await withLimit(Promise.all([a, b]));
    assert.equal(ra.event.data.msg, "m-000000000001.json");
    assert.equal(rb.event.data.msg, "m-000000000002.json");
    assert.equal(highOf(p), 2);
  },
);

test(
  "EN-57 (3, 4, 8) a late number at or below high is stale: ack, no event; a message with two hard links is executed; a refusal and a damaged file still take their numbers",
  { timeout: 60_000 },
  async (t) => {
    const { p, m } = frozen(t);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    const first = messageBody(p, { args: { text: "Первое" } });
    putMessage(p, 5, first);
    m.tick();
    assert.equal(highOf(p), 5);
    assert.equal(ackOf(p, first.nonce).ok, true);
    // (3) a number below high (4) and the number equal to high (5, a late sender
    // with the number just taken): stale, no event
    const late = messageBody(p, { args: { text: "Опоздавшее" } });
    putMessage(p, 4, late);
    m.tick();
    assert.equal(ackOf(p, late.nonce).code, "E_CHANNEL_STALE");
    const equal = messageBody(p, {
      args: { text: "Опоздавшее с тем же номером" },
    });
    putMessage(p, 5, equal);
    m.tick();
    assert.equal(ackOf(p, equal.nonce).code, "E_CHANNEL_STALE");
    assert.equal(highOf(p), 5);
    assert.equal(
      journal(p).some((e) => String(e.data.text).startsWith("Опоздавшее")),
      false,
    );
    // (4) two hard links: still executed
    const linked = messageBody(p, { args: { text: "Со ссылкой" } });
    const name = putMessage(p, 6, linked);
    fs.linkSync(
      path.join(p.dir, "inbox", name),
      path.join(p.dir, "inbox", ".tmp-1-aaaa"),
    );
    m.tick();
    assert.equal(ackOf(p, linked.nonce).ok, true);
    // (8) a refused command, then a damaged file: both answered, both take numbers
    const refused = messageBody(p, {
      kind: "budget",
      args: { budget_usd: 0.001 },
    });
    putMessage(p, 7, refused);
    m.tick();
    assert.equal(ackOf(p, refused.nonce).code, "E_BUDGET_LOW");
    const damaged = messageBody(p, { kind: "unknown", args: {} });
    putMessage(p, 8, damaged);
    m.tick();
    assert.equal(ackOf(p, damaged.nonce).code, "E_CHANNEL_BAD");
    assert.equal(highOf(p), 8);
    assert.deepStrictEqual(
      inboxNames(p).filter((x) => !x.startsWith("ack/")),
      [".tmp-1-aaaa", "taken/high"],
    );
    const next = await withLimit(
      (async () => {
        const r = sendToEngine(
          p.id,
          { kind: "say", args: { text: "Следующее" } },
          { home: p.sb.home },
        );
        await waitUntil(() => inboxNames(p).includes("m-000000000009.json"));
        m.tick();
        return r;
      })(),
    );
    assert.equal(next.event.data.msg, "m-000000000009.json");
    const texts = viaChannel(journal(p)).map((e) => e.data.text);
    assert.deepStrictEqual(texts, ["Первое", "Со ссылкой", "Следующее"]);
  },
);

test(
  "EN-57 (5, 6) while a stop goes on, every new message is refused E_ENGINE_STOPPING; one PROJECT_STOPPED",
  { timeout: 60_000 },
  async (t) => {
    const { p, m } = frozen(t);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    const stop = messageBody(p, { kind: "stop", args: {} });
    putMessage(p, 5, stop);
    const after = messageBody(p, { args: { text: "Во время остановки" } });
    putMessage(p, 6, after);
    m.tick();
    assert.equal(ackOf(p, after.nonce).code, "E_ENGINE_STOPPING");
    await withLimit(m.running);
    const stopped = ofType(journal(p), "PROJECT_STOPPED");
    assert.equal(stopped.length, 1);
    assert.equal(stopped[0].data.msg, "m-000000000005.json");
    assert.equal(ackOf(p, stop.nonce).ok, true);
    assert.equal(
      journal(p).some((e) => e.data.text === "Во время остановки"),
      false,
    );
  },
);

// ---- EN-57 (7, 9): the clean-up of inbox/ (section 13.4) ---------------------------

// A project left by a dead engine: the lock of a process that has ended.
function crashedProject(t) {
  const p = engineProject(t, [planRun([item("a")])]);
  const w = openWriter(p.id, { home: p.sb.home });
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  w.close();
  fs.writeFileSync(
    path.join(p.dir, "writer.lock"),
    `${JSON.stringify({ pid: deadPid(), since: new Date().toISOString(), holder: "engine" })}\n`,
    { mode: 0o600 },
  );
  for (const d of ["inbox", "inbox/taken", "inbox/ack"]) {
    fs.mkdirSync(path.join(p.dir, d), { mode: 0o700 });
  }
  return p;
}

function writeHighFile(p, n) {
  fs.writeFileSync(
    path.join(p.dir, "inbox", "taken", "high"),
    `${String(n).padStart(12, "0")}\n`,
    { mode: 0o600 },
  );
}

const cleanupText = (k) =>
  `Сообщения, полученные до готовности проекта, не выполнены: ${k}`;

test(
  "EN-57 (7, 9б, 9е) high was written before the event: after a crash the message is not executed, its nonce dropped, the next number is above it; an executed one is only removed",
  { timeout: 60_000 },
  (t) => {
    const p = crashedProject(t);
    writeHighFile(p, 3);
    const lost = messageBody(p, { args: { text: "Потерянное" } });
    fs.writeFileSync(
      path.join(p.dir, "inbox", "taken", ".taking-m-000000000003.json"),
      JSON.stringify(lost),
      { mode: 0o600 },
    );
    const w = openWriter(p.id, { home: p.sb.home });
    t.after(() => w.close());
    // an executed message whose file stayed (9б)
    const done = messageBody(p, { args: { text: "Исполненное" } });
    w.append(
      usr("CHAT", {
        text: "Исполненное",
        kind: "message",
        truncated: false,
        msg: "m-000000000002.json",
        nonce: done.nonce,
      }),
    );
    putMessage(p, 2, done);
    const inbox = openInbox(p.dir, w, p.id);
    assert.equal(inbox.dropped, 1);
    const chats = ofType(journal(p), "CHAT").filter(
      (e) => e.source === "ENGINE",
    );
    assert.deepStrictEqual(
      chats.map((e) => [e.data.text, e.data.dropped]),
      [[cleanupText(1), [lost.nonce]]],
    );
    assert.equal(highOf(p), 3);
    assert.equal(ackOf(p, lost.nonce).code, "E_CHANNEL_DROPPED");
    assert.deepStrictEqual(inboxNames(p), [
      `ack/${lost.nonce}.ack`,
      "taken/high",
    ]);
    assert.equal(
      journal(p).some(
        (e) => e.source === "USER" && e.data.text === "Потерянное",
      ),
      false,
    );
  },
);

test(
  "EN-57 (9а, 9и) one nonce is one message: a stale duplicate of an executed name is dropped and answered; two files of one nonce count once",
  { timeout: 60_000 },
  (t) => {
    const p = crashedProject(t);
    const w = openWriter(p.id, { home: p.sb.home });
    t.after(() => w.close());
    const a = messageBody(p, { args: { text: "Исполненное A" } });
    w.append(
      usr("CHAT", {
        text: "Исполненное A",
        kind: "message",
        truncated: false,
        msg: "m-000000000007.json",
        nonce: a.nonce,
      }),
    );
    // (9а) the file of A stayed in taken/, a stale duplicate B with the same name
    fs.writeFileSync(
      path.join(p.dir, "inbox", "taken", ".taking-m-000000000007.json"),
      JSON.stringify(a),
      { mode: 0o600 },
    );
    const b = messageBody(p, { args: { text: "Дубль B" } });
    putMessage(p, 7, b);
    // (9и) C published twice: taken 8 after a stale answer and again as 9
    const c = messageBody(p, { args: { text: "Сообщение C" } });
    putMessage(p, 9, c);
    fs.writeFileSync(
      path.join(p.dir, "inbox", "taken", ".taking-m-000000000008.json"),
      JSON.stringify(c),
      { mode: 0o600 },
    );
    openInbox(p.dir, w, p.id);
    const dropped = ofType(journal(p), "CHAT").filter(
      (e) => e.data.dropped !== undefined,
    );
    assert.equal(dropped.length, 1);
    assert.deepStrictEqual(dropped[0].data.dropped, [b.nonce, c.nonce].sort());
    assert.equal(dropped[0].data.text, cleanupText(2));
    assert.equal(ackOf(p, b.nonce).code, "E_CHANNEL_DROPPED");
    assert.equal(
      ackOf(p, a.nonce),
      null,
      "the executed one is not answered again",
    );
    assert.equal(highOf(p), 9);
    // a second opening counts nothing again
    w.close();
    const w2 = openWriter(p.id, { home: p.sb.home });
    t.after(() => w2.close());
    const lines = journal(p).length;
    openInbox(p.dir, w2, p.id);
    assert.equal(journal(p).length, lines);
  },
);

test(
  "EN-57 (9г, 9д) a crash after the events and before the removal counts nothing twice; a crash before the events writes them later",
  { timeout: 60_000 },
  (t) => {
    const p = crashedProject(t);
    const w = openWriter(p.id, { home: p.sb.home });
    t.after(() => w.close());
    const msgs = [1, 2, 3].map((n) => {
      const body = messageBody(p, { args: { text: `Остаток ${n}` } });
      putMessage(p, n, body);
      return body;
    });
    // 9д: the events failed (no write): nothing written, the files stay
    const appendFail = { fail: true };
    const real = w.recordDropped.bind(w);
    w.recordDropped = (...args) => {
      if (appendFail.fail)
        throw new TeamError(
          "E_DISK",
          "Не удалось записать на диск (EIO); данные проекта не изменены",
        );
      return real(...args);
    };
    assert.throws(
      () => openInbox(p.dir, w, p.id),
      (e) => e.code === "E_DISK",
    );
    assert.equal(
      ofType(journal(p), "CHAT").filter((e) => e.data.dropped).length,
      0,
    );
    assert.equal(inboxNames(p).filter((x) => MSG.test(x)).length, 3);
    appendFail.fail = false;
    openInbox(p.dir, w, p.id);
    const after = ofType(journal(p), "CHAT").filter((e) => e.data.dropped);
    assert.equal(after.length, 1);
    assert.deepStrictEqual(
      after[0].data.dropped,
      msgs.map((x) => x.nonce).sort(),
    );
    // 9г: the files put back as if the removal never came: no second event
    for (const [i, body] of msgs.entries()) putMessage(p, i + 1, body);
    openInbox(p.dir, w, p.id);
    assert.equal(
      ofType(journal(p), "CHAT").filter((e) => e.data.dropped).length,
      1,
    );
    assert.equal(inboxNames(p).filter((x) => MSG.test(x)).length, 0);
  },
);

test(
  "EN-57 (9ж) 250 messages left: three events (100, 100, 50) in one batch, the project opens; a failed fsync writes none and keeps the files",
  { timeout: 60_000 },
  async (t) => {
    const { installFaults } = await import("./fault-inject.js");
    const p = crashedProject(t);
    const bodies = [];
    for (let n = 1; n <= 250; n += 1) {
      const body = messageBody(p, { args: { text: `Остаток ${n}` } });
      putMessage(p, n, body);
      bodies.push(body);
    }
    const w = openWriter(p.id, { home: p.sb.home });
    const fault = installFaults([
      { fn: "fsyncSync", paths: [p.events], effect: "throw", code: "EIO" },
    ]);
    try {
      assert.throws(
        () => openInbox(p.dir, w, p.id),
        (e) => e.code === "E_DISK",
      );
    } finally {
      fault.restore();
      w.close();
    }
    assert.equal(
      ofType(journal(p), "CHAT").filter((e) => e.data.dropped).length,
      0,
    );
    assert.equal(inboxNames(p).filter((x) => MSG.test(x)).length, 250);
    // the writer broke and kept its lock (the process is the test): open again
    fs.unlinkSync(path.join(p.dir, "writer.lock"));
    const w2 = openWriter(p.id, { home: p.sb.home });
    t.after(() => w2.close());
    const inbox = openInbox(p.dir, w2, p.id);
    assert.equal(inbox.dropped, 250);
    const parts = ofType(journal(p), "CHAT").filter((e) => e.data.dropped);
    assert.deepStrictEqual(
      parts.map((e) => e.data.dropped.length),
      [100, 100, 50],
    );
    assert.deepStrictEqual(
      parts.map((e) => e.seq),
      [parts[0].seq, parts[0].seq + 1, parts[0].seq + 2],
    );
    assert.equal(new Set(parts.flatMap((e) => e.data.dropped)).size, 250);
    const lines = journal(p).length;
    openInbox(p.dir, w2, p.id);
    assert.equal(journal(p).length, lines, "a second clean-up writes nothing");
  },
);

test(
  "EN-57 (9ж, F3) a failed second fsync does not touch the clean-up: the three portions are one batch with one fsync, the project opens, all 250 are dropped",
  { timeout: 60_000 },
  async (t) => {
    const { installFaults } = await import("./fault-inject.js");
    const p = crashedProject(t);
    for (let n = 1; n <= 250; n += 1) {
      putMessage(p, n, messageBody(p, { args: { text: `Остаток ${n}` } }));
    }
    const w = openWriter(p.id, { home: p.sb.home });
    t.after(() => w.close());
    const fault = installFaults([
      {
        fn: "fsyncSync",
        paths: [p.events],
        nth: 2,
        effect: "throw",
        code: "EIO",
      },
    ]);
    let inbox;
    try {
      // one batch needs one fsync: a fault of the second one is not reached;
      // portions written as separate records would fail after the first
      inbox = openInbox(p.dir, w, p.id);
    } finally {
      fault.restore();
    }
    assert.equal(inbox.dropped, 250);
    const parts = ofType(journal(p), "CHAT").filter((e) => e.data.dropped);
    assert.deepStrictEqual(
      parts.map((e) => e.data.dropped.length),
      [100, 100, 50],
    );
    assert.equal(new Set(parts.flatMap((e) => e.data.dropped)).size, 250);
    assert.equal(inboxNames(p).filter((x) => MSG.test(x)).length, 0);
  },
);

test(
  "EN-57 (9з) a damaged or replaced taken/high never stops the opening: it is written again, also at 0, and the next sender gets 1",
  { timeout: 60_000 },
  async (t) => {
    for (const damage of ["text", "link", "mode"]) {
      const p = crashedProject(t);
      const high = path.join(p.dir, "inbox", "taken", "high");
      if (damage === "text") fs.writeFileSync(high, "garbage", { mode: 0o600 });
      if (damage === "link") fs.symlinkSync("/etc/hosts", high);
      if (damage === "mode")
        fs.writeFileSync(high, "000000000000\n", { mode: 0o644 });
      const w = openWriter(p.id, { home: p.sb.home });
      openInbox(p.dir, w, p.id);
      w.close();
      const st = fs.lstatSync(high);
      assert.ok(st.isFile() && !st.isSymbolicLink(), damage);
      assert.equal(st.mode & 0o777, 0o600, damage);
      assert.equal(fs.readFileSync(high, "utf8"), "000000000000\n", damage);
    }
    const { p, m } = frozen(t);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    const r = sendToEngine(
      p.id,
      { kind: "say", args: { text: "Первое" } },
      { home: p.sb.home },
    );
    await waitUntil(() => inboxNames(p).includes("m-000000000001.json"));
    m.tick();
    assert.equal((await withLimit(r)).event.data.msg, "m-000000000001.json");
  },
);

// ---- EN-58 -----------------------------------------------------------------------

test(
  "EN-58 from the publication to the event within 1 s; an engine under SIGSTOP: say ends with code 1 in 10-12 s, and after SIGCONT nothing of it is written",
  { timeout: 120_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 60_000 }]),
    ]);
    const run = spawnEngine(t, p);
    await engineReady(p);
    const at = Date.now();
    const ack = await withLimit(
      sendToEngine(
        p.id,
        { kind: "say", args: { text: "Быстро" } },
        { home: p.sb.home },
      ),
    );
    assert.ok(
      Date.parse(ack.event.ts) - at <= 1000,
      `${Date.parse(ack.event.ts) - at} ms`,
    );
    process.kill(run.child.pid, "SIGSTOP");
    t.after(() => {
      try {
        process.kill(run.child.pid, "SIGCONT");
      } catch {
        // gone
      }
    });
    const started = Date.now();
    const r = await withLimit(
      spawnTeam(["say", p.id, "Под SIGSTOP"], p.env).done,
      30_000,
    );
    const took = Date.now() - started;
    assert.equal(r.status, 1, r.stderr);
    assert.equal(
      r.stderr,
      "E_CHANNEL_TIMEOUT: Сообщение не подтверждено: проект его не принял. Повторите команду\n",
    );
    assert.ok(took >= 10_000 && took <= 12_500, `${took} ms`);
    process.kill(run.child.pid, "SIGCONT");
    // the engine runs on: one more message is taken, the revoked one never
    const next = await withLimit(
      sendToEngine(
        p.id,
        { kind: "say", args: { text: "После SIGCONT" } },
        { home: p.sb.home },
      ),
    );
    assert.equal(next.ok, true);
    assert.equal(
      journal(p).some((e) => e.data.text === "Под SIGSTOP"),
      false,
    );
    assert.equal(
      inboxNames(p).some((x) => MSG.test(x)),
      false,
    );
  },
);

// ---- EN-59 -----------------------------------------------------------------------

test(
  "EN-59 on pause say and budget are taken (events written), no task begins",
  { timeout: 120_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a"), item("b")]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 30_000 }]),
    ]);
    spawnEngine(t, p, ["start", p.id, "--parallel", "1"]);
    await engineReady(p);
    await until(p, (e) => e.type === "TASK_STARTED", "the first work");
    const paused = out(runTeam(["pause", p.id], p.env)).event;
    const say = out(runTeam(["say", p.id, "На паузе"], p.env)).event;
    const budget = out(runTeam(["budget", p.id, "9"], p.env)).event;
    assert.equal(say.type, "CHAT");
    assert.equal(budget.type, "BUDGET_SET");
    const events = journal(p);
    assert.equal(
      events.filter((e) => e.type === "TASK_STARTED" && e.seq > paused.seq)
        .length,
      0,
    );
  },
);

// ---- EN-60 -----------------------------------------------------------------------

test(
  "EN-60 (race) 30 say while the project ends: code 0 if and only if exactly one event with its text",
  { timeout: 120_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 300 }]),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    const engine = spawnEngine(t, p);
    await engineReady(p);
    const runs = [];
    for (let i = 0; i < 30; i += 1) {
      runs.push(spawnTeam(["say", p.id, `Конец ${i}`], p.env));
      if (i % 5 === 4) await waitUntil(() => false, 40);
    }
    const results = await withLimit(
      Promise.all(runs.map((r) => r.done)),
      90_000,
    );
    assert.equal((await withLimit(engine.done)).status, 0);
    const events = journal(p);
    assert.equal(
      events.some((e) => e.type === "PROJECT_DONE"),
      true,
    );
    results.forEach((r, i) => {
      const n = events.filter(
        (e) => e.type === "CHAT" && e.data.text === `Конец ${i}`,
      ).length;
      if (r.status === 0) assert.equal(n, 1, `${i}: ${r.stdout}`);
      else assert.equal(n, 0, `${i}: ${r.stderr}`);
    });
  },
);

// ---- EN-62 -----------------------------------------------------------------------

test(
  "EN-62 the modes 0700 and 0600; a link, 0644, more than 64 KiB, not JSON, another project or an unknown command — no USER event; the bait of a secret never reaches the disk",
  { timeout: 60_000 },
  async (t) => {
    const { p, m } = frozen(t);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    for (const d of ["inbox", "inbox/taken", "inbox/ack"]) {
      assert.equal(fs.statSync(path.join(p.dir, d)).mode & 0o777, 0o700, d);
    }
    const before = journal(p).filter((e) => e.source === "USER").length;
    const cases = [];
    const link = messageBody(p);
    const target = path.join(p.sb.root, "elsewhere.json");
    fs.writeFileSync(target, JSON.stringify(link), { mode: 0o600 });
    fs.symlinkSync(target, path.join(p.dir, "inbox", "m-000000000001.json"));
    cases.push(link);
    const wide = messageBody(p);
    putMessage(p, 2, wide, 0o644);
    cases.push(wide);
    const big = messageBody(p, { args: { text: "я".repeat(40_000) } });
    putMessage(p, 3, big);
    cases.push(big);
    putMessage(p, 4, "{ not json");
    const foreign = messageBody(p, { project: "p-20260101-abcdef" });
    putMessage(p, 5, foreign);
    cases.push(foreign);
    const unknown = messageBody(p, { kind: "format", args: {} });
    putMessage(p, 6, unknown);
    cases.push(unknown);
    m.tick();
    assert.equal(journal(p).filter((e) => e.source === "USER").length, before);
    for (const c of cases.slice(3))
      assert.equal(ackOf(p, c.nonce).code, "E_CHANNEL_BAD");
    assert.equal(
      fs.readFileSync(target, "utf8"),
      JSON.stringify(link),
      "the target is untouched",
    );
    // the bait of a secret
    const bait = "ghp_FAKEfake0000000000000000000000000000";
    const r = sendToEngine(
      p.id,
      { kind: "say", args: { text: `ключ ${bait}` } },
      { home: p.sb.home },
    );
    await waitUntil(() => inboxNames(p).some((x) => MSG.test(x)));
    const file = inboxNames(p).find((x) => MSG.test(x));
    assert.equal(
      fs.statSync(path.join(p.dir, "inbox", file)).mode & 0o777,
      0o600,
    );
    assert.equal(
      fs.readFileSync(path.join(p.dir, "inbox", file), "utf8").includes(bait),
      false,
    );
    m.tick();
    const ack = await withLimit(r);
    assert.equal(ack.event.data.text.includes(bait), false);
    const all = [];
    const walk = (d) => {
      for (const n of fs.readdirSync(d)) {
        const abs = path.join(d, n);
        const st = fs.lstatSync(abs);
        if (st.isDirectory()) walk(abs);
        else if (st.isFile()) all.push(fs.readFileSync(abs, "latin1"));
      }
    };
    walk(p.dir);
    assert.equal(all.join("\n").includes(bait), false);
  },
);

test(
  "EN-62 inbox/ as a link or with mode 0755: the sender refuses E_CHANNEL and writes nothing; a planted ack that is not trusted is neither taken nor removed",
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
    const inbox = path.join(p.dir, "inbox");
    fs.chmodSync(inbox, 0o755);
    const before = sha(fs.readFileSync(p.events));
    let r = runTeam(["say", p.id, "Широкие права"], p.env);
    assert.equal(r.status, 1, describeRun(r));
    assert.match(r.stderr, /^E_CHANNEL: /);
    assert.equal(
      inboxNames(p).some((x) => MSG.test(x) || x.startsWith(".tmp")),
      false,
    );
    fs.chmodSync(inbox, 0o700);
    fs.renameSync(inbox, `${inbox}-real`);
    fs.symlinkSync(`${inbox}-real`, inbox);
    r = runTeam(["say", p.id, "Ссылка"], p.env);
    assert.equal(r.status, 1, describeRun(r));
    assert.match(r.stderr, /^E_CHANNEL: /);
    assert.equal(sha(fs.readFileSync(p.events)), before);
    fs.unlinkSync(inbox);
    fs.renameSync(`${inbox}-real`, inbox);
    // a planted ack with mode 0644 for a message the engine does not take (SIGSTOP)
    process.kill(run.child.pid, "SIGSTOP");
    t.after(() => {
      try {
        process.kill(run.child.pid, "SIGCONT");
      } catch {
        // gone
      }
    });
    const sender = spawnTeam(["say", p.id, "С подложенным ack"], p.env);
    await waitUntil(() => inboxNames(p).some((x) => MSG.test(x)));
    const name = inboxNames(p).find((x) => MSG.test(x));
    const { nonce } = JSON.parse(
      fs.readFileSync(path.join(inbox, name), "utf8"),
    );
    const planted = path.join(inbox, "ack", `${nonce}.ack`);
    fs.writeFileSync(
      planted,
      JSON.stringify({
        v: 1,
        nonce,
        msg: name,
        ok: true,
        event: {},
        notices: [],
      }),
      { mode: 0o644 },
    );
    fs.chmodSync(planted, 0o644);
    const res = await withLimit(sender.done);
    assert.equal(res.status, 1, res.stderr);
    assert.match(res.stderr, /^E_CHANNEL_TIMEOUT: /);
    assert.equal(
      fs.existsSync(planted),
      true,
      "the untrusted ack is not removed",
    );
    assert.equal(
      fs.existsSync(path.join(inbox, name)),
      false,
      "the message was revoked",
    );
  },
);

// ---- EN-63 -----------------------------------------------------------------------

test(
  "EN-63 the lock held by another writer of the core: say is refused «busy» and inbox/ is not made; without a holder say writes one CHAT without msg",
  { timeout: 60_000 },
  async (t) => {
    const home = makeHome(t);
    const p = startProject(t, home, makeClock());
    p.writer.close();
    const holder = await holdWriter(t, home, p.id);
    const r = runTeamIn(home, ["say", p.id, "Занято"]);
    assert.equal(r.status, 1, r.stderr);
    assert.equal(
      r.stderr,
      `E_PROJECT_BUSY: Проект занят другим процессом (pid ${holder.pid})\n`,
    );
    assert.equal(fs.existsSync(path.join(p.dir, "inbox")), false);
    await holder.kill();
    const ok2 = runTeamIn(home, ["say", p.id, "Свободно"]);
    assert.equal(ok2.status, 0, ok2.stderr);
    const chats = journal(p.events).filter((e) => e.type === "CHAT");
    assert.equal(chats.length, 1);
    assert.equal(chats[0].source, "USER");
    assert.equal(chats[0].data.msg, undefined);
  },
);

// ---- EN-64 -----------------------------------------------------------------------

test(
  "EN-64 M2: add-task, run-task and start while the engine runs — E_ENGINE_RUNNING, the journal, the lock and inbox/ unchanged",
  { timeout: 120_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 60_000 }]),
    ]);
    spawnEngine(t, p);
    const lock = await engineReady(p);
    await until(
      p,
      (e) => e.type === "RUN_STARTED" && e.task !== null,
      "the work",
    );
    const before = sha(fs.readFileSync(p.events));
    const tree = snapshot(path.join(p.dir, "inbox"));
    const text = `E_ENGINE_RUNNING: Проект сейчас ведёт запущенный процесс Sai Team (pid ${lock.pid}): эта команда доступна после его остановки\n`;
    for (const argv of [
      ["add-task", p.id, "--role", "lawyer", "--text", "т", "--done-when", "д"],
      ["run-task", p.id, "t-0001"],
      ["start", p.id],
    ]) {
      const r = runTeam(argv, p.env);
      assert.equal(r.status, 1, describeRun(r));
      assert.equal(r.stderr, text, argv[0]);
    }
    assert.equal(sha(fs.readFileSync(p.events)), before);
    assert.deepStrictEqual(
      JSON.parse(fs.readFileSync(path.join(p.dir, "writer.lock"), "utf8")),
      lock,
    );
    assert.deepStrictEqual(snapshot(path.join(p.dir, "inbox")), tree);
  },
);

test(
  "EN-64 M3: the engine took the message and its ack came too late — the sender E_CHANNEL_UNCONFIRMED, exactly one event of the message, no repeat",
  { timeout: 60_000 },
  async (t) => {
    const { p, m } = frozen(t);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    const r = sendToEngine(
      p.id,
      { kind: "say", args: { text: "Поздний ack" } },
      { home: p.sb.home },
    );
    await waitUntil(() => inboxNames(p).some((x) => MSG.test(x)));
    m.tick();
    // the ack is lost before the sender looks (as if it came after 10 s)
    for (const n of fs.readdirSync(path.join(p.dir, "inbox", "ack"))) {
      fs.unlinkSync(path.join(p.dir, "inbox", "ack", n));
    }
    await assert.rejects(
      withLimit(r, 20_000),
      (err) => err.code === "E_CHANNEL_UNCONFIRMED",
    );
    const events = viaChannel(journal(p));
    assert.equal(events.length, 1);
    assert.equal(events[0].data.text, "Поздний ack");
  },
);

test("EN-64 И24: a second event with the same msg through writer.append is E_TRANSITION before the write; the writer is not broken", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  w.append(usr("PROJECT_STARTED", { parallel: 2 }));
  const first = w.append(
    usr("PROJECT_PAUSED", {
      msg: "m-000000000005.json",
      nonce: "a1b2c3d4e5f60718",
    }),
  );
  assert.equal(first.data.msg, "m-000000000005.json");
  w.append(usr("PROJECT_RESUMED", { parallel: null, after: "command" }));
  const before = sha256(fs.readFileSync(p.events));
  let caught = null;
  try {
    w.append(
      usr("PROJECT_PAUSED", {
        msg: "m-000000000005.json",
        nonce: "0000000000000001",
      }),
    );
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof TeamError);
  assert.equal(caught.code, "E_TRANSITION");
  assert.equal(caught.details.rule, "И24");
  assert.equal(sha256(fs.readFileSync(p.events)), before);
  assert.equal(w.broken, false);
  assert.equal(w.state.status, "running");
  w.append(
    usr("PROJECT_PAUSED", {
      msg: "m-000000000006.json",
      nonce: "0000000000000001",
    }),
  );
  assert.equal(w.state.status, "paused");
});

// ---- after the review of step 25 (F-5) and of security (step 24, F-1, F-2) --------

test(
  "EN-57 (F-5) while a stop is in work its taken file is never replaced: a late duplicate with the same number is refused as stale and the stop goes on",
  { timeout: 60_000 },
  async (t) => {
    const { p, m } = frozen(t);
    await until(
      p,
      (e) => e.type === "RUN_STARTED" && e.task !== null,
      "the work",
    );
    const stop = messageBody(p, { kind: "stop", args: {} });
    putMessage(p, 5, stop);
    m.tick();
    const taking = path.join(
      p.dir,
      "inbox",
      "taken",
      ".taking-m-000000000005.json",
    );
    const before = fs.readFileSync(taking, "utf8");
    // a late sender published the same number 5 (section 13.5, the probe r1)
    const late = messageBody(p, { args: { text: "Опоздавший дубль" } });
    putMessage(p, 5, late);
    m.tick();
    assert.equal(
      fs.readFileSync(taking, "utf8"),
      before,
      "the stop file stays",
    );
    assert.equal(ackOf(p, late.nonce).code, "E_CHANNEL_STALE");
    await withLimit(m.running);
    const stopped = ofType(journal(p), "PROJECT_STOPPED");
    assert.equal(stopped.length, 1);
    assert.equal(stopped[0].data.nonce, stop.nonce);
    assert.equal(ackOf(p, stop.nonce).ok, true);
    assert.equal(
      journal(p).some((e) => e.data.text === "Опоздавший дубль"),
      false,
    );
  },
);

test(
  "security F-2: a sender that would need a number of 13 digits refuses E_CHANNEL_FULL and publishes nothing; the engine refuses a number far above high and keeps high",
  { timeout: 60_000 },
  async (t) => {
    const { p, m } = frozen(t);
    await until(
      p,
      (e) => e.type === "RUN_STARTED" && e.task !== null,
      "the work",
    );
    // the engine: a planted number far above high
    const far = messageBody(p, { args: { text: "Далёкий номер" } });
    putMessage(p, 2_000_000, far);
    m.tick();
    assert.equal(ackOf(p, far.nonce).code, "E_CHANNEL_BAD");
    assert.equal(
      fs.existsSync(path.join(p.dir, "inbox", "taken", "high")),
      false,
    );
    const near = messageBody(p, { args: { text: "Обычный номер" } });
    putMessage(p, 1, near);
    m.tick();
    assert.equal(ackOf(p, near.nonce).ok, true);
    assert.equal(highOf(p), 1);
    // the sender: high at the last number of 12 digits
    writeHighFile(p, 999_999_999_999);
    await assert.rejects(
      sendToEngine(
        p.id,
        { kind: "say", args: { text: "Тринадцать" } },
        { home: p.sb.home },
      ),
      (err) => err.code === "E_CHANNEL_FULL",
    );
    assert.deepStrictEqual(
      inboxNames(p).filter((x) => !x.startsWith("ack/")),
      ["taken/high"],
    );
    assert.equal(
      journal(p).some((e) => e.data.text === "Далёкий номер"),
      false,
    );
  },
);

test(
  "security F-2: the clean-up does not raise high by a planted number far above it",
  { timeout: 60_000 },
  (t) => {
    const p = crashedProject(t);
    writeHighFile(p, 3);
    const far = messageBody(p, { args: { text: "Далёкий" } });
    putMessage(p, 999_999_999_999, far);
    const w = openWriter(p.id, { home: p.sb.home });
    t.after(() => w.close());
    openInbox(p.dir, w, p.id);
    assert.equal(highOf(p), 3);
    const dropped = ofType(journal(p), "CHAT").filter((e) => e.data.dropped);
    assert.deepStrictEqual(dropped[0].data.dropped, [far.nonce]);
  },
);

test(
  "security F-1: a folder in place of taken/high is moved aside inside taken/ (nothing in it is removed) and high is written again",
  { timeout: 60_000 },
  (t) => {
    const p = crashedProject(t);
    const high = path.join(p.dir, "inbox", "taken", "high");
    fs.mkdirSync(high, { mode: 0o700 });
    fs.writeFileSync(path.join(high, "keep.txt"), "не удалять");
    const w = openWriter(p.id, { home: p.sb.home });
    t.after(() => w.close());
    openInbox(p.dir, w, p.id);
    const st = fs.lstatSync(high);
    assert.ok(st.isFile());
    assert.equal(fs.readFileSync(high, "utf8"), "000000000000\n");
    const aside = fs
      .readdirSync(path.join(p.dir, "inbox", "taken"))
      .filter((n) => n.startsWith(".bad-"));
    assert.equal(aside.length, 1);
    assert.equal(
      fs.readFileSync(
        path.join(p.dir, "inbox", "taken", aside[0], "keep.txt"),
        "utf8",
      ),
      "не удалять",
    );
  },
);

// ---- r5.3 of the design (step 29: R-1; step 30) ----------------------------------

test(
  "EN-57 (9к) a planted file with a far number does not lead the number of a real sender: it gets high + 1 and its event, the planted one E_CHANNEL_BAD",
  { timeout: 60_000 },
  async (t) => {
    const { p, m } = frozen(t);
    await until(
      p,
      (e) => e.type === "RUN_STARTED" && e.task !== null,
      "the work",
    );
    const first = messageBody(p, { args: { text: "Первое" } });
    putMessage(p, 1, first);
    m.tick();
    assert.equal(highOf(p), 1);
    const far = messageBody(p, { args: { text: "Подложенное далёкое" } });
    putMessage(p, 1 + 2_000_000, far);
    const r = sendToEngine(
      p.id,
      { kind: "say", args: { text: "Настоящее" } },
      { home: p.sb.home },
    );
    await waitUntil(() => inboxNames(p).includes("m-000000000002.json"));
    m.tick();
    const ack = await withLimit(r);
    assert.equal(ack.ok, true);
    assert.equal(ack.event.data.msg, "m-000000000002.json");
    assert.equal(ackOf(p, far.nonce).code, "E_CHANNEL_BAD");
    assert.deepStrictEqual(
      viaChannel(journal(p)).map((e) => e.data.text),
      ["Первое", "Настоящее"],
    );
  },
);

test(
  "EN-57 (9л) after a signal of the process (Ctrl-C) with runs in work, a stop before the exit gets E_ENGINE_STOPPING through the channel and through command; the journal has PROJECT_PAUSED and no PROJECT_STOPPED; the writer is whole",
  { timeout: 90_000 },
  async (t) => {
    const sb = makeSandbox(t);
    const p = makeProject(sb, { tasks: 1, role: ["researcher"] });
    const env = execEnv(sb);
    assertSafeEnv(env);
    writePlan(sb, {
      default: { stream: "stream-ok.jsonl", hang: true, spawn_child: true },
    });
    const engine = createEngine(p.id, { home: sb.home, env, mode: "start" });
    const running = engine.run();
    t.after(async () => {
      engine.requestStop("signal");
      await running.catch(() => {});
    });
    assert.ok(await waitUntil(() => fakeStarts(sb).length === 1, 20_000));
    engine.requestStop("signal");
    // through the channel: the engine is still stopping its run (the fake hangs)
    const viaInbox = sendToEngine(
      p.id,
      { kind: "stop", args: {} },
      { home: sb.home },
    );
    await assert.rejects(
      engine.command({ kind: "stop", args: {} }),
      (err) => err.code === "E_ENGINE_STOPPING",
    );
    await assert.rejects(
      withLimit(viaInbox),
      (err) => err.code === "E_ENGINE_STOPPING",
    );
    const result = await withLimit(running);
    assert.equal(result.status, "paused");
    const events = journal(p);
    assert.equal(ofType(events, "PROJECT_STOPPED").length, 0);
    assert.equal(ofType(events, "PROJECT_PAUSED").length, 1);
    assert.deepStrictEqual(
      ofType(events, "TASK_INTERRUPTED").map((e) => e.data.cause),
      ["cancel"],
    );
    assert.equal(events.at(-1).type, "PROJECT_PAUSED");
    assert.equal(fs.existsSync(path.join(p.dir, "writer.lock")), false);
  },
);

// ---- EN-57 (9м) (r5.5, F1): the clean-up and a publication going on ----------------

// The writer a clean-up of the test sees: the state of the running engine; no
// message is found in these cases, so nothing is written.
const viewOnly = (engine) => ({
  get state() {
    return engine.state();
  },
  recordDropped: () => {
    throw new Error("the clean-up of this test writes no event");
  },
});

function countTmpWrites(t, p) {
  const real = fs.writeFileSync;
  const counter = { tmp: 0 };
  t.mock.method(fs, "writeFileSync", function (file, ...rest) {
    if (
      typeof file === "string" &&
      path.dirname(file) === path.join(p.dir, "inbox") &&
      path.basename(file).startsWith(`.tmp-${process.pid}-`)
    ) {
      counter.tmp += 1;
    }
    return real.call(fs, file, ...rest);
  });
  return counter;
}

test(
  "EN-57 (9м) a clean-up between the write of the temporary file of a live sender and its linkSync leaves the file: the message is published at the first try",
  { timeout: 60_000 },
  async (t) => {
    const { p, m } = frozen(t);
    await until(
      p,
      (e) => e.type === "RUN_STARTED" && e.task !== null,
      "the work",
    );
    const counter = countTmpWrites(t, p);
    const realLink = fs.linkSync;
    let cleaned = false;
    t.mock.method(fs, "linkSync", function (from, to, ...rest) {
      if (!cleaned && MSG.test(path.basename(String(to)))) {
        cleaned = true;
        // the engine opens (a new one after a crash) and cleans inbox/ right now
        openInbox(p.dir, viewOnly(m.engine), p.id);
      }
      return realLink.call(fs, from, to, ...rest);
    });
    const r = sendToEngine(
      p.id,
      { kind: "say", args: { text: "Во время уборки" } },
      { home: p.sb.home },
    );
    await waitUntil(() => inboxNames(p).some((x) => MSG.test(x)));
    assert.equal(cleaned, true);
    m.tick();
    const ack = await withLimit(r);
    assert.equal(ack.ok, true);
    assert.equal(counter.tmp, 1, "one temporary file, one publication");
    assert.equal(
      viaChannel(journal(p)).filter((e) => e.data.text === "Во время уборки")
        .length,
      1,
    );
  },
);

test(
  "EN-57 (9м) a temporary file removed before linkSync: the sender writes a new one and publishes; a temporary file of a dead pid or of another form is removed by the clean-up",
  { timeout: 60_000 },
  async (t) => {
    const { p, m } = frozen(t);
    await until(
      p,
      (e) => e.type === "RUN_STARTED" && e.task !== null,
      "the work",
    );
    const inbox = path.join(p.dir, "inbox");
    const dead = path.join(inbox, `.tmp-${deadPid()}-0123456789abcdef`);
    const odd = path.join(inbox, ".tmp-junk");
    const live = path.join(inbox, `.tmp-${process.pid}-fedcba9876543210`);
    for (const f of [dead, odd, live])
      fs.writeFileSync(f, "x", { mode: 0o600 });
    openInbox(p.dir, viewOnly(m.engine), p.id);
    assert.equal(fs.existsSync(dead), false, "the file of a dead sender goes");
    assert.equal(fs.existsSync(odd), false, "a file of another form goes");
    assert.equal(fs.existsSync(live), true, "the file of a live sender stays");
    fs.unlinkSync(live);
    const counter = countTmpWrites(t, p);
    const realLink = fs.linkSync;
    let removed = false;
    t.mock.method(fs, "linkSync", function (from, to, ...rest) {
      if (!removed && MSG.test(path.basename(String(to)))) {
        removed = true;
        fs.unlinkSync(from);
      }
      return realLink.call(fs, from, to, ...rest);
    });
    const r = sendToEngine(
      p.id,
      { kind: "say", args: { text: "Файл пропал" } },
      { home: p.sb.home },
    );
    await waitUntil(() => inboxNames(p).some((x) => MSG.test(x)));
    m.tick();
    const ack = await withLimit(r);
    assert.equal(ack.ok, true);
    assert.equal(removed, true);
    assert.equal(counter.tmp, 2, "a new temporary file after the lost one");
    assert.equal(
      inboxNames(p).filter((x) => x.startsWith(".tmp-")).length,
      0,
      "no temporary file is left",
    );
  },
);
