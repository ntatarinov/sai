// REQ-011, criterion 15 (design REQ-011, sections 3 BODY_MAX, 8.2, 10, 11): while a
// live engine holds the lock, the server gives the message only to the channel of
// REQ-013 (deliver) and waits for the ack at most 10 s; no ack — «не подтверждено»,
// nothing written by the server, no repeat; a dead lock — the server writes the
// CHAT itself once; a body over 64 KiB is refused before any write; a secret never
// reaches a file (WEB-15 (а)…(д), WEB-15e, the race with the end of the engine).
// The engine is a separate process (scripted), started after assertSafeEnv.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { MSG_BYTES_MAX } from "../src/team/engine/channel.js";
import { BODY_MAX } from "../src/web/config.js";
import { journal, sha256, snapshot, withLimit } from "./exec-helpers.js";
import {
  GOAL_OK,
  PASS,
  WORK_OK,
  engineProject,
  engineReady,
  item,
  planRun,
  scenarioRun,
  spawnEngine,
  until,
} from "./team-engine-helpers.js";
import { request, startServer, within } from "./team-web-helpers.js";

const SECRET = "sk-ant-api03-FAKEFAKEFAKEFAKE1234567890abcd";
const MSG = /^m-[0-9]{12}\.json$/;
const UNCONFIRMED = {
  error_text: "Сообщение не подтверждено, проверьте чат через несколько секунд",
  field: null,
  reload: false,
};

// A project whose work run lasts long: the engine stays alive for the test.
function liveRuns(workMs = 60_000) {
  return [
    planRun([item("a")]),
    scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: workMs }]),
    scenarioRun({ purpose: "review" }, PASS),
    scenarioRun({ purpose: "goal_check" }, GOAL_OK),
  ];
}

function inboxFiles(p) {
  const out = [];
  const walk = (dir, rel) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const r = rel === "" ? name : `${rel}/${name}`;
      if (fs.lstatSync(abs).isDirectory()) walk(abs, r);
      else out.push(r);
    }
  };
  walk(path.join(p.dir, "inbox"), "");
  return out;
}

const messages = (p) => inboxFiles(p).filter((x) => MSG.test(x));
const withText = (p, text) =>
  journal(p).filter((e) => e.type === "CHAT" && e.data.text === text);
const lockOf = (p) =>
  JSON.parse(fs.readFileSync(path.join(p.dir, "writer.lock"), "utf8"));

async function live(t, workMs) {
  const p = engineProject(t, liveRuns(workMs));
  const box = { sb: p.sb, env: p.env, home: p.sb.home };
  const s = await startServer(t, box);
  const run = spawnEngine(t, p);
  const lock = await engineReady(p);
  return { p, s, run, lock };
}

test(
  "WEB-15 (а) (д) a message to a running engine: «Отправлено» only after the ack, exactly one CHAT of USER with this text and the name of its message file, the lock unchanged (holder and pid), no message file left; the bait of a secret is in no file of the project, inbox/ included",
  { timeout: 120_000 },
  async (t) => {
    const { p, s, lock } = await live(t);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    const text = `Ответ владельца, ключ ${SECRET}`;
    const r = await s.post(`/api/projects/${p.id}/chat`, { text });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.result_text, "Отправлено");
    const masked = `Ответ владельца, ключ [скрыто]`;
    const chats = withText(p, masked);
    assert.equal(chats.length, 1);
    assert.equal(chats[0].source, "USER");
    assert.match(chats[0].data.msg, MSG);
    assert.equal(r.json.message.n, chats[0].seq, "the event of the ack");
    assert.equal(r.json.message.text, masked);
    assert.deepStrictEqual(lockOf(p), lock);
    assert.equal(lock.holder, "engine");
    assert.deepStrictEqual(messages(p), [], "the engine took the message");
    assert.equal(
      inboxFiles(p).filter((x) => x.startsWith("ack/") && x.endsWith(".ack"))
        .length,
      0,
      "the server removed its ack",
    );
    // (д) the bait in no file of the project (journal, inbox/, files/)
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const abs = path.join(dir, name);
        const st = fs.lstatSync(abs);
        if (st.isDirectory()) walk(abs);
        else if (st.isFile()) {
          assert.ok(
            !fs.readFileSync(abs).toString("latin1").includes(SECRET),
            abs,
          );
        }
      }
    };
    walk(p.dir);
  },
);

test(
  "WEB-15 (б) the engine under SIGSTOP: the answer comes not before 10 s and not after 12 s, 504 «не подтверждено»; after SIGCONT no event with this text is written, the message is revoked",
  { timeout: 120_000 },
  async (t) => {
    const { p, s, run } = await live(t);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    const key = await s.key();
    const before = sha256(fs.readFileSync(p.events));
    process.kill(run.child.pid, "SIGSTOP");
    t.after(() => {
      try {
        process.kill(run.child.pid, "SIGCONT");
      } catch {
        // gone
      }
    });
    const text = "Сообщение под SIGSTOP";
    const started = Date.now();
    const r = await s.post(`/api/projects/${p.id}/chat`, { text }, { key });
    const took = Date.now() - started;
    assert.equal(r.status, 504, r.text);
    assert.deepStrictEqual(r.json, UNCONFIRMED);
    assert.ok(took >= 10_000 && took <= 12_000, `${took} ms`);
    assert.equal(
      sha256(fs.readFileSync(p.events)),
      before,
      "the server wrote nothing",
    );
    process.kill(run.child.pid, "SIGCONT");
    // the engine runs on: a next message is taken, the revoked one never
    const next = await s.post(
      `/api/projects/${p.id}/chat`,
      { text: "После SIGCONT" },
      { key },
    );
    assert.equal(next.status, 200, next.text);
    assert.equal(withText(p, text).length, 0);
    assert.equal(withText(p, "После SIGCONT").length, 1);
    assert.deepStrictEqual(messages(p), []);
  },
);

test(
  "WEB-15 (в) a body over 64 KiB — by Content-Length and by the bytes actually sent — is refused with 413 before any write: no message file, the journal and inbox/ unchanged; the engine is not asked",
  { timeout: 120_000 },
  async (t) => {
    const { p, s } = await live(t);
    const key = await s.key();
    const before = snapshot(p.dir);
    const big = JSON.stringify({ text: "ж".repeat(40_000) });
    assert.ok(Buffer.byteLength(big) > BODY_MAX);
    const declared = await s.post(`/api/projects/${p.id}/chat`, big, { key });
    assert.equal(declared.status, 413);
    assert.deepStrictEqual(declared.json, {
      error_text: "Сообщение слишком большое",
      field: "text",
      reload: false,
    });
    // chunked, without Content-Length: refused by the bytes read
    const chunked = await request(s.port, {
      method: "POST",
      path: `/api/projects/${p.id}/chat`,
      headers: {
        Origin: `http://127.0.0.1:${s.port}`,
        "Content-Type": "application/json",
        "X-Sai-Page": key,
        "Transfer-Encoding": "chunked",
      },
      parts: [
        [Buffer.from(big.slice(0, 30_000)), 0],
        [Buffer.from(big.slice(30_000)), 0],
      ],
      end: true,
    });
    assert.equal(chunked.status, 413);
    assert.equal(chunked.json.error_text, "Сообщение слишком большое");
    // exactly BODY_MAX bytes are read (and then refused as text over 4000)
    const edge = JSON.stringify({ text: "x".repeat(BODY_MAX - 11) });
    assert.equal(Buffer.byteLength(edge), BODY_MAX);
    const atEdge = await s.post(`/api/projects/${p.id}/chat`, edge, { key });
    assert.equal(
      atEdge.status,
      400,
      "the edge is read, not refused as too big",
    );
    assert.equal(atEdge.json.field, "text");
    assert.deepStrictEqual(messages(p), []);
    // inbox/ (the folder of the channel) is byte for byte the same, and no CHAT of
    // USER was written; the engine itself goes on with its own events.
    const inboxOf = (snap) =>
      Object.fromEntries(
        Object.entries(snap).filter(
          ([k]) => k === "inbox" || k.startsWith("inbox/"),
        ),
      );
    assert.ok(Object.keys(inboxOf(before)).length > 0);
    assert.deepStrictEqual(inboxOf(snapshot(p.dir)), inboxOf(before));
    assert.equal(
      journal(p).filter((e) => e.type === "CHAT" && e.source === "USER").length,
      0,
    );
  },
);

test(
  "WEB-15 (г) after SIGKILL of the engine the message is written by the server exactly once, with the event of the removed stale lock; no new message file",
  { timeout: 120_000 },
  async (t) => {
    const { p, s, run, lock } = await live(t);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    const ended = new Promise((r) => run.child.once("exit", r));
    run.child.kill("SIGKILL");
    await ended;
    const filesBefore = messages(p);
    const text = "Сообщение после гибели движка";
    const r = await s.post(`/api/projects/${p.id}/chat`, { text });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.result_text, "Отправлено");
    const chats = withText(p, text);
    assert.equal(chats.length, 1);
    assert.equal(
      chats[0].data.msg,
      undefined,
      "written by the server, not the channel",
    );
    assert.equal(r.json.message.n, chats[0].seq);
    const stale = journal(p).filter((e) => e.type === "LOCK_STALE_REMOVED");
    assert.equal(stale.length, 1);
    assert.equal(stale[0].data.pid, lock.pid);
    assert.deepStrictEqual(messages(p), filesBefore);
    assert.equal(
      fs.existsSync(path.join(p.dir, "writer.lock")),
      false,
      "the server let the lock go",
    );
  },
);

test(
  "WEB-15 (race) a message at the moment the engine ends: the message is published, the engine dies before taking it — 504 «не подтверждено» at once (not after 10 s), no event with the text, the message revoked",
  { timeout: 120_000 },
  async (t) => {
    const { p, s, run } = await live(t);
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    const key = await s.key();
    process.kill(run.child.pid, "SIGSTOP");
    const text = "Сообщение в момент завершения движка";
    const started = Date.now();
    const pending = s.post(`/api/projects/${p.id}/chat`, { text }, { key });
    // wait until the message is published, then end the engine
    const published = await within(
      (async () => {
        for (;;) {
          if (messages(p).length > 0) return true;
          await new Promise((r) => setTimeout(r, 20));
        }
      })(),
      5000,
      "the publication",
    );
    assert.ok(published);
    const ended = new Promise((r) => run.child.once("exit", r));
    run.child.kill("SIGKILL");
    await ended;
    const r = await withLimit(pending, 15_000);
    const took = Date.now() - started;
    assert.equal(r.status, 504, r.text);
    assert.deepStrictEqual(r.json, UNCONFIRMED);
    assert.ok(took < 9000, `${took} ms`);
    assert.equal(withText(p, text).length, 0);
    assert.deepStrictEqual(messages(p), [], "revoked");
    // the next message goes by the core (the lock is dead)
    const next = await s.post(
      `/api/projects/${p.id}/chat`,
      { text: "Следом" },
      { key },
    );
    assert.equal(next.status, 200);
    assert.equal(withText(p, "Следом").length, 1);
  },
);

test("WEB-15e BODY_MAX equals MSG_BYTES_MAX of the channel", () => {
  assert.equal(BODY_MAX, MSG_BYTES_MAX);
  assert.equal(BODY_MAX, 65_536);
});
