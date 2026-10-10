// REQ-011, criterion 5 (design REQ-011, sections 5.5 ChatMessage, 8.2, 10): a
// message from the page is a CHAT of USER with the same text (after masking) and is
// seen in the chat; (а) the engine of the server or of a terminal writes it, no
// «busy»; (б) without an engine the server writes it through the core; (в) another
// writer holds the lock — «повторите через несколько секунд», the journal
// unchanged; the questions of the engine are in the chat; a text over 4000 is
// refused; markup is text (WEB-5a…WEB-5g).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { maskSecrets } from "../src/pixel-office/mask.js";
import { sentMessage } from "../src/web/display.js";
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
  viaChannel,
} from "./team-engine-helpers.js";
import { holdWriter } from "./team-helpers.js";
import {
  JSON_TYPE,
  NOT_FOUND_BODY,
  PUBLIC_DIR,
  ask,
  eng,
  planTask,
  project,
  startServer,
  webSandbox,
  withPlan,
} from "./team-web-helpers.js";

const SECRET = "sk-ant-api03-FAKEFAKEFAKEFAKE1234567890abcd";
const MSG = /^m-[0-9]{12}\.json$/;

function userChats(events, text) {
  return events.filter(
    (e) => e.type === "CHAT" && e.source === "USER" && e.data.text === text,
  );
}

// The scenario of a short real project: a plan of one task, a work run that takes
// `workMs`, a review and the goal check.
function shortRuns(workMs) {
  return [
    planRun([item("a")]),
    scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: workMs }]),
    scenarioRun({ purpose: "review" }, PASS),
    scenarioRun({ purpose: "goal_check" }, GOAL_OK),
  ];
}

test("WEB-5a (б) without an engine: 200 «Отправлено», the server writes one CHAT of USER through the core with the masked text; it is the last message of the chat; nothing in inbox/", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  p.w.close();
  const s = await startServer(t, box);
  const text = `Добавьте сравнение цен, ключ ${SECRET}`;
  const r = await s.post(`/api/projects/${p.id}/chat`, { text });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.headers["content-type"], JSON_TYPE);
  const events = journal(p);
  const chats = userChats(events, maskSecrets(text));
  assert.equal(chats.length, 1);
  assert.equal(chats[0].data.msg, undefined, "not through the channel");
  assert.deepStrictEqual(r.json, {
    result_text: "Отправлено",
    message: {
      n: chats[0].seq,
      at: chats[0].ts,
      from: "user",
      author_text: "Вы",
      question: false,
      open: false,
      truncated: false,
      labels_text: [],
      text: maskSecrets(text),
      task: null,
    },
  });
  const chat = (await s.get(`/api/projects/${p.id}/chat`)).json;
  assert.deepStrictEqual(chat.messages.at(-1), r.json.message);
  assert.equal(fs.existsSync(path.join(p.dir, "inbox")), false);
  assert.ok(!fs.readFileSync(p.events, "utf8").includes(SECRET));
});

test(
  "WEB-5b (а) the engine of the server (scripted with delays) runs the project: the message is «Отправлено», the engine writes the event (it has the name of the message), no 409, the project ends",
  { timeout: 120_000 },
  async (t) => {
    const box = webSandbox(t);
    const s = await startServer(t, box, {
      engines: "real",
      scenario: { version: 1, runs: shortRuns(1500) },
    });
    const c = await s.post("/api/projects", {
      goal: "Вымышленная цель",
      budget_usd: 5,
    });
    assert.equal(c.status, 201, c.text);
    assert.equal(c.json.started, true);
    const id = c.json.project.id;
    const p = {
      dir: path.join(box.home, id),
      events: path.join(box.home, id, "events.jsonl"),
    };
    const lock = await engineReady(p);
    assert.equal(
      lock.pid,
      process.pid,
      "the engine of the server holds the lock",
    );
    await until(p, (e) => e.type === "TASK_STARTED", "the work");
    const text = "Сообщение, пока движок сервера работает";
    const r = await s.post(`/api/projects/${id}/chat`, { text });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.result_text, "Отправлено");
    const chats = userChats(journal(p), text);
    assert.equal(chats.length, 1);
    assert.match(
      chats[0].data.msg,
      MSG,
      "written by the engine from the channel",
    );
    assert.equal(r.json.message.n, chats[0].seq, "the message of the ack");
    assert.equal(r.json.message.text, text);
    await until(
      p,
      (e) => e.type === "PROJECT_DONE",
      "the end of the project",
      60_000,
    );
    assert.equal(userChats(journal(p), text).length, 1);
    const page = (await s.get(`/api/projects/${id}`)).json;
    assert.equal(page.status, "done");
  },
);

test(
  "WEB-5c (а) the engine is a separate process `npm run team -- start`: «Отправлено», one CHAT with the name of the message, the lock unchanged, the project ends",
  { timeout: 120_000 },
  async (t) => {
    const p = engineProject(t, shortRuns(1500));
    const box = { sb: p.sb, env: p.env, home: p.sb.home };
    const s = await startServer(t, box);
    const run = spawnEngine(t, p);
    const lock = await engineReady(p);
    assert.notEqual(lock.pid, process.pid);
    const text = "Сообщение движку из терминала";
    const r = await s.post(`/api/projects/${p.id}/chat`, { text });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.result_text, "Отправлено");
    const chats = viaChannel(journal(p)).filter((e) => e.data.text === text);
    assert.equal(chats.length, 1);
    assert.equal(r.json.message.n, chats[0].seq);
    assert.deepStrictEqual(
      JSON.parse(fs.readFileSync(path.join(p.dir, "writer.lock"), "utf8")),
      lock,
    );
    const end = await withLimit(run.done, 60_000);
    assert.equal(end.status, 0, end.stderr);
    assert.equal(journal(p).at(-1).type, "PROJECT_DONE");
    assert.equal(userChats(journal(p), text).length, 1);
  },
);

test(
  "WEB-5d (в) another writer of the core (not an engine) holds the lock: 409 «Сообщение не отправлено, повторите через несколько секунд», the journal (hash) and the folder unchanged",
  { timeout: 60_000 },
  async (t) => {
    const box = webSandbox(t);
    const p = project(t, box);
    p.w.close();
    const holder = await holdWriter(t, box.home, p.id);
    const s = await startServer(t, box);
    const hash = sha256(fs.readFileSync(p.events));
    const before = snapshot(box.home);
    const r = await s.post(`/api/projects/${p.id}/chat`, { text: "Подождите" });
    assert.equal(r.status, 409);
    assert.deepStrictEqual(r.json, {
      error_text: "Сообщение не отправлено, повторите через несколько секунд",
      field: null,
      reload: false,
    });
    assert.equal(sha256(fs.readFileSync(p.events)), hash);
    assert.deepStrictEqual(snapshot(box.home), before);
    assert.doesNotMatch(r.text, new RegExp(String(holder.pid)));
    await holder.kill();
  },
);

test("WEB-5e the questions of the engine in the chat (question, «вопрос», «ждёт ответа» while open); a message about a task links to that task; truncated: true — the last label «сообщение сокращено», false — no such label", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  const w = p.w;
  withPlan(w, [planTask("t-0001", "researcher"), planTask("t-0002", "lawyer")]);
  const plain = w.say("Обычное сообщение");
  const about = w.append(
    eng(
      "CHAT",
      { text: "Готов черновик", kind: "message", truncated: false },
      "t-0002",
    ),
  );
  const cut = w.append(
    eng("CHAT", { text: "Длинный итог…", kind: "message", truncated: true }),
  );
  w.append(eng("PROJECT_WAITING", { reason: "budget" }));
  const q = w.append(
    eng("CHAT", {
      text: "Поднимите потолок?",
      kind: "question",
      truncated: true,
    }),
  );
  const s = await startServer(t, box);
  const chat = (await s.get(`/api/projects/${p.id}/chat`)).json;
  const byN = new Map(chat.messages.map((m) => [m.n, m]));
  assert.deepStrictEqual(
    chat.messages.map((m) => m.n),
    replayChat(p),
    "all messages in the order of the journal",
  );
  const m0 = byN.get(plain.seq);
  assert.equal(m0.truncated, false);
  assert.deepStrictEqual(m0.labels_text, []);
  assert.equal(m0.from, "user");
  const m1 = byN.get(about.seq);
  assert.equal(m1.from, "team");
  assert.equal(m1.author_text, "Команда Sai");
  assert.deepStrictEqual(m1.task, {
    text: "Вымышленная задача t-0002",
    role_title: "Юрист",
    link: { to: "task", api: `/api/projects/${p.id}/tasks/t-0002` },
  });
  const m2 = byN.get(cut.seq);
  assert.equal(m2.truncated, true);
  assert.deepStrictEqual(m2.labels_text, ["сообщение сокращено"]);
  const m3 = byN.get(q.seq);
  assert.equal(m3.question, true);
  assert.equal(m3.open, true);
  assert.equal(m3.truncated, true);
  assert.deepStrictEqual(m3.labels_text, [
    "вопрос",
    "ждёт ответа",
    "сообщение сокращено",
  ]);
  for (const m of chat.messages) {
    assert.equal(
      m.labels_text.includes("сообщение сокращено"),
      m.truncated,
      `n ${m.n}`,
    );
    if (m.truncated) assert.equal(m.labels_text.at(-1), "сообщение сокращено");
  }
  // Sent.message: the flag comes from event.data.truncated
  for (const flag of [true, false]) {
    const m = sentMessage(p.id, {
      seq: 7,
      ts: "2026-01-05T09:00:00.000Z",
      source: "USER",
      type: "CHAT",
      task: null,
      data: { text: "x", kind: "message", truncated: flag },
    });
    assert.equal(m.truncated, flag);
    assert.deepStrictEqual(m.labels_text, flag ? ["сообщение сокращено"] : []);
    assert.equal(m.open, false);
  }
  assert.equal(sentMessage(p.id, null), null);
  assert.equal(sentMessage(p.id, { type: "BUDGET_SET", data: {} }), null);
  // a question about a task after it waits
  const p2 = project(t, box);
  withPlan(p2.w, [planTask("t-0001", "researcher")]);
  p2.w.append(eng("TASK_STARTED", {}, "t-0001"));
  p2.w.append(eng("TASK_REVIEW", {}, "t-0001"));
  p2.w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "review_failed", draft: null },
      "t-0001",
    ),
  );
  const tq = ask(p2.w, "Изменить задачу или отклонить её?", "t-0001");
  const c2 = (await s.get(`/api/projects/${p2.id}/chat`)).json;
  const mq = c2.messages.find((m) => m.n === tq.seq);
  assert.equal(mq.open, true);
  assert.deepStrictEqual(mq.task.link, {
    to: "task",
    api: `/api/projects/${p2.id}/tasks/t-0001`,
  });
});

function replayChat(p) {
  return journal(p)
    .filter((e) => e.type === "CHAT")
    .map((e) => e.seq);
}

test("WEB-5f a text of 4001 characters: 400 «длиннее 4000», field text, the journal (hash) unchanged; 4000 passes; an empty text and a wrong body are refused", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  p.w.close();
  const s = await startServer(t, box);
  const before = snapshot(box.home);
  const cases = [
    [
      { text: "ж".repeat(4001) },
      400,
      "Сообщение длиннее 4000 знаков — сократите его",
      "text",
    ],
    [
      { text: "😀".repeat(4001) },
      400,
      "Сообщение длиннее 4000 знаков — сократите его",
      "text",
    ],
    [{ text: "" }, 400, "Напишите сообщение", "text"],
    [{ text: 5 }, 400, "Запрос не понят. Обновите страницу", null],
    [
      { text: "x", kind: "say" },
      400,
      "Запрос не понят. Обновите страницу",
      null,
    ],
    [{}, 400, "Запрос не понят. Обновите страницу", null],
    ["[1]", 400, "Запрос не понят. Обновите страницу", null],
  ];
  for (const [body, status, text, field] of cases) {
    const r = await s.post(`/api/projects/${p.id}/chat`, body);
    assert.equal(r.status, status, JSON.stringify(body).slice(0, 30));
    assert.deepStrictEqual(r.json, { error_text: text, field, reload: false });
  }
  assert.deepStrictEqual(snapshot(box.home), before);
  const ok = await s.post(`/api/projects/${p.id}/chat`, {
    text: "😀".repeat(4000),
  });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(userChats(journal(p), "😀".repeat(4000)).length, 1);
});

test("WEB-5g «<script>alert(1)</script>» comes back as the same text; the page has no way to insert markup (no innerHTML, outerHTML, insertAdjacentHTML, document.write in public/)", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  p.w.close();
  const s = await startServer(t, box);
  const text = "<script>alert(1)</script> & <img src=x onerror=alert(2)>";
  const r = await s.post(`/api/projects/${p.id}/chat`, { text });
  assert.equal(r.status, 200);
  assert.equal(r.json.message.text, text);
  const chat = (await s.get(`/api/projects/${p.id}/chat`)).json;
  assert.equal(chat.messages.at(-1).text, text);
  for (const name of fs.readdirSync(PUBLIC_DIR)) {
    const body = fs.readFileSync(path.join(PUBLIC_DIR, name), "utf8");
    assert.doesNotMatch(
      body,
      /innerHTML|outerHTML|insertAdjacentHTML|document\.write/,
      name,
    );
  }
});

test("WEB-5 the chat of a project that is not there is «not found» byte for byte; of a damaged project — «Данные проекта повреждены»; nothing is written", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  p.w.close();
  const s = await startServer(t, box);
  const nf = await s.post("/api/projects/p-20990101-a1b2c3/chat", {
    text: "x",
  });
  assert.equal(nf.status, 404);
  assert.equal(nf.text, NOT_FOUND_BODY);
  const lines = fs.readFileSync(p.events, "utf8").split("\n");
  lines[1] = "{испорчено";
  fs.writeFileSync(p.events, lines.join("\n"));
  const before = snapshot(box.home);
  const r = await s.post(`/api/projects/${p.id}/chat`, { text: "x" });
  assert.equal(r.status, 500);
  assert.deepStrictEqual(r.json, {
    error_text: "Данные проекта повреждены — проект нельзя показать",
    field: null,
    reload: false,
  });
  const g = await s.get(`/api/projects/${p.id}/chat`);
  assert.equal(g.status, 500);
  assert.deepStrictEqual(snapshot(box.home), before);
});
