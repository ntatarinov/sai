// REQ-011, criterion 10 (design REQ-011, sections 4.1 step 4, 8.2, 10; Q10): a
// failure of a write of the core, a lock held by a writer that is not an engine, a
// missing claude and a damaged line in the middle of a journal each give a plain
// text without a stack, and the next request answers as usual; a body that does
// not come in time is 408 and touches nothing; every code of a refusal of the chat
// has its own text (WEB-10a…WEB-10f).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { TeamError } from "../src/team/errors.js";
import { chatFailure } from "../src/web/api.js";
import { BODY_IDLE_MS } from "../src/web/config.js";
import { installFaults } from "./fault-inject.js";
import { FIXTURES, journal, sha256 } from "./exec-helpers.js";
import { holdWriter } from "./team-helpers.js";
import {
  JSON_TYPE,
  dirs,
  fakeEngines,
  planTask,
  project,
  request,
  snapshot,
  startServer,
  technical,
  webSandbox,
  withPlan,
} from "./team-web-helpers.js";

const NO_STACK = /\n\s+at |Error:|\.js:\d+|E_[A-Z]|EIO|errno|syscall/;
const INTERNAL = {
  error_text: "Что-то пошло не так. Повторите позже",
  field: null,
  reload: false,
};

test("WEB-10a EIO on the write of the core when a message is sent: 500 «диск не принимает записи», no stack; the journal is unchanged; the next requests answer as usual, and the next message is saved without a restart (ISS-0010)", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  p.w.close();
  const s = await startServer(t, box);
  const key = await s.key();
  const hash = sha256(fs.readFileSync(p.events));
  const faults = installFaults([
    { fn: "writeSync", paths: [p.events], effect: "throw", code: "EIO" },
  ]);
  let r;
  try {
    r = await s.post(
      `/api/projects/${p.id}/chat`,
      { text: "При сбое диска" },
      { key },
    );
  } finally {
    faults.restore();
  }
  assert.deepStrictEqual(faults.fired(), [true]);
  assert.equal(r.status, 500);
  assert.deepStrictEqual(r.json, {
    error_text:
      "Диск не принимает записи: сообщение не сохранено. Освободите место и повторите",
    field: null,
    reload: false,
  });
  assert.doesNotMatch(r.text, NO_STACK);
  assert.equal(sha256(fs.readFileSync(p.events)), hash);
  const lines = journal(p).length;
  assert.equal((await s.get(`/api/projects/${p.id}`)).status, 200);
  assert.equal((await s.get("/api/projects")).status, 200);
  // (ISS-0010, decision 0026) The disk takes writes again: the next message is
  // saved without a restart of the server. The process removes the lock its
  // closed broken writer left (LOCK_STALE_REMOVED with its own pid), then writes
  // the message; before the fix this was 409 until a restart.
  const again = await s.post(
    `/api/projects/${p.id}/chat`,
    { text: "После сбоя" },
    { key },
  );
  assert.equal(again.status, 200, again.text);
  assert.equal(again.json.result_text, "Отправлено");
  assert.doesNotMatch(again.text, NO_STACK);
  const added = journal(p).slice(lines);
  assert.deepStrictEqual(
    added.map((e) => [e.type, e.source]),
    [
      ["LOCK_STALE_REMOVED", "ENGINE"],
      ["CHAT", "USER"],
    ],
  );
  assert.deepStrictEqual(added[0].data, { pid: process.pid });
  assert.equal(added[1].data.text, "После сбоя");
  assert.equal(fs.existsSync(path.join(p.dir, "writer.lock")), false);
});

test("WEB-10a EIO while a new project is written (the event file of the folder being made): 500 «проект не создан», no new folder, no stack; the next request answers", async (t) => {
  const box = webSandbox(t);
  const engines = fakeEngines();
  const s = await startServer(t, box, { engines });
  const key = await s.key();
  const before = snapshot(box.home);
  // The folder of a new project has a random name, so the failure is injected by
  // the name of its file: the write of events.jsonl inside .creating-* fails once.
  const real = fs.writeFileSync;
  let fired = 0;
  t.mock.method(fs, "writeFileSync", function (file, ...rest) {
    if (
      fired === 0 &&
      typeof file === "string" &&
      file.includes(`${path.sep}.creating-`) &&
      file.endsWith("events.jsonl")
    ) {
      fired += 1;
      throw Object.assign(new Error("EIO: injected fault, write"), {
        code: "EIO",
        errno: -5,
        syscall: "write",
        path: file,
      });
    }
    return real.call(this, file, ...rest);
  });
  const r = await s.post(
    "/api/projects",
    { goal: "Цель", budget_usd: 1 },
    { key },
  );
  t.mock.restoreAll();
  assert.equal(fired, 1);
  assert.equal(r.status, 500);
  assert.deepStrictEqual(r.json, {
    error_text: "Не удалось записать на диск — проект не создан",
    field: null,
    reload: false,
  });
  assert.doesNotMatch(r.text, NO_STACK);
  assert.deepStrictEqual(snapshot(box.home), before);
  assert.deepStrictEqual(engines.calls, []);
  assert.equal((await s.get("/api/projects")).status, 200);
  const ok = await s.post(
    "/api/projects",
    { goal: "Цель", budget_usd: 1 },
    { key },
  );
  assert.equal(ok.status, 201);
});

test(
  "WEB-10b a project whose lock is held by a writer that is not an engine: a plain text, the journal unchanged, the next request answers",
  { timeout: 60_000 },
  async (t) => {
    const box = webSandbox(t);
    const p = project(t, box);
    p.w.close();
    const holder = await holdWriter(t, box.home, p.id);
    const s = await startServer(t, box);
    const hash = sha256(fs.readFileSync(p.events));
    const r = await s.post(`/api/projects/${p.id}/chat`, { text: "x" });
    assert.equal(r.status, 409);
    assert.equal(
      r.json.error_text,
      "Сообщение не отправлено, повторите через несколько секунд",
    );
    assert.doesNotMatch(r.text, NO_STACK);
    assert.equal(sha256(fs.readFileSync(p.events)), hash);
    assert.equal((await s.get(`/api/projects/${p.id}`)).status, 200);
    await holder.kill();
    const after = await s.post(`/api/projects/${p.id}/chat`, {
      text: "Теперь можно",
    });
    assert.equal(after.status, 200);
  },
);

test(
  "WEB-10c real runs on and claude missing: the project is created, the engine writes its wait; the page of the project tells the wait in words, without a stack or technical words; the server answers on",
  { timeout: 120_000 },
  async (t) => {
    const box = webSandbox(t, {
      SAI_TEAM_CLAUDE_BIN: path.join(FIXTURES, "missing-claude"),
      SAI_TEAM_REAL_RUNS: "1",
    });
    const s = await startServer(t, box, {
      executor: "claude-cli",
      engines: "real",
    });
    const r = await s.post("/api/projects", {
      goal: "Вымышленная цель",
      budget_usd: 1,
    });
    assert.equal(r.status, 201, r.text);
    const id = r.json.project.id;
    const events = path.join(box.home, id, "events.jsonl");
    const deadline = Date.now() + 60_000;
    while (!journal(events).some((e) => e.type === "PROJECT_WAITING")) {
      assert.ok(Date.now() < deadline, "no PROJECT_WAITING");
      await new Promise((x) => setTimeout(x, 50));
    }
    const page = await s.get(`/api/projects/${id}`);
    assert.equal(page.status, 200);
    assert.equal(page.json.status, "waiting_user");
    assert.equal(typeof page.json.problems.waiting_text, "string");
    assert.deepStrictEqual(technical(page.json.problems.waiting_text), []);
    assert.doesNotMatch(page.text, /\n\s+at |stderr|ENOENT|missing-claude/);
    for (const ph of page.json.happening) {
      assert.deepStrictEqual(technical(ph.text), [], ph.text);
    }
    assert.equal((await s.get("/api/projects")).status, 200);
  },
);

test("WEB-10d a damaged line in the middle of a journal: the page of the project says «Данные проекта повреждены», the list and the other projects work, the next request answers", async (t) => {
  const box = webSandbox(t);
  const good = project(t, box);
  good.w.close();
  const bad = project(t, box);
  withPlan(bad.w, [planTask("t-0001", "researcher")]);
  bad.w.close();
  const lines = fs.readFileSync(bad.events, "utf8").split("\n");
  lines[1] = '{"seq":2,"broken"';
  fs.writeFileSync(bad.events, lines.join("\n"));
  const s = await startServer(t, box);
  const before = snapshot(box.home);
  for (const pth of [
    `/api/projects/${bad.id}`,
    `/api/projects/${bad.id}/chat`,
    `/api/projects/${bad.id}/tasks/t-0001`,
    `/api/projects/${bad.id}/roles/1`,
  ]) {
    const r = await s.get(pth);
    assert.equal(r.status, 500, pth);
    assert.deepStrictEqual(r.json, {
      error_text: "Данные проекта повреждены — проект нельзя показать",
      field: null,
      reload: false,
    });
    assert.doesNotMatch(r.text, NO_STACK);
  }
  const list = (await s.get("/api/projects")).json.projects;
  assert.equal(list.find((x) => x.id === bad.id).broken, true);
  assert.equal(list.find((x) => x.id === good.id).broken, false);
  assert.equal((await s.get(`/api/projects/${good.id}`)).status, 200);
  assert.deepStrictEqual(snapshot(box.home), before);
});

test("WEB-10 an unexpected exception of a handler: 500 with the general text and one line for stderr, no stack in the answer; the next request answers as usual", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  p.w.close();
  const s = await startServer(t, box);
  const real = fs.readdirSync;
  t.mock.method(fs, "readdirSync", function (dir, ...rest) {
    if (dir === box.home) throw new TypeError("injected bug in the core");
    return real.call(this, dir, ...rest);
  });
  const r = await s.get("/api/projects");
  t.mock.restoreAll();
  assert.equal(r.status, 500);
  assert.deepStrictEqual(r.json, INTERNAL);
  assert.equal(s.warnings.length, 1);
  assert.doesNotMatch(r.text, /injected|TypeError|\n\s+at /);
  const next = await s.get("/api/projects");
  assert.equal(next.status, 200);
  assert.equal(next.json.projects.length, 1);
});

// A POST with the right headers whose body does not come in full.
function stalled(s, key, pth, parts, length = 100) {
  return request(s.port, {
    method: "POST",
    path: pth,
    headers: {
      Origin: `http://127.0.0.1:${s.port}`,
      "Content-Type": "application/json",
      "X-Sai-Page": key,
      "Content-Length": String(length),
    },
    parts,
  });
}

test("WEB-10e (r3, S-1) a body that stops coming: 408 with the general text, Connection: close; the handler is not called — the journal, the folders and the starts unchanged, nothing for stderr; the rest of the body later changes nothing; the next request answers", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  p.w.close();
  const engines = fakeEngines();
  const s = await startServer(t, box, { engines, bodyIdleMs: 200 });
  const key = await s.key();
  assert.equal(BODY_IDLE_MS, 15_000);
  const before = snapshot(box.home);
  for (const [pth, body] of [
    ["/api/projects", JSON.stringify({ goal: "Цель создания", budget_usd: 1 })],
    [
      `/api/projects/${p.id}/chat`,
      JSON.stringify({ text: "Сообщение по частям" }),
    ],
  ]) {
    const buf = Buffer.from(body);
    const started = Date.now();
    const r = await stalled(
      s,
      key,
      pth,
      [[buf.subarray(0, 10), 0]],
      buf.length,
    );
    const took = Date.now() - started;
    assert.equal(r.status, 408, pth);
    assert.deepStrictEqual(r.json, INTERNAL);
    assert.equal(r.headers["content-type"], JSON_TYPE);
    assert.equal(r.headers.connection, "close");
    assert.ok(took >= 190 && took < 2000, `${took} ms`);
  }
  // the rest of a body sent 300 ms after the answer changes nothing
  const buf = Buffer.from(
    JSON.stringify({ goal: "Поздняя цель", budget_usd: 1 }),
  );
  const late = request(s.port, {
    method: "POST",
    path: "/api/projects",
    headers: {
      Origin: `http://127.0.0.1:${s.port}`,
      "Content-Type": "application/json",
      "X-Sai-Page": key,
      "Content-Length": String(buf.length),
    },
    parts: [
      [buf.subarray(0, 10), 500],
      [buf.subarray(10), 0],
    ],
    end: true,
  }).catch((err) => ({ status: null, err }));
  const lateR = await late;
  assert.equal(lateR.status, 408);
  await new Promise((r) => setTimeout(r, 400));
  assert.deepStrictEqual(snapshot(box.home), before);
  assert.deepStrictEqual(engines.calls, []);
  assert.deepStrictEqual(s.warnings, []);
  assert.deepStrictEqual(dirs(box.home), [p.id]);
  assert.equal((await s.get("/api/projects")).status, 200);
});

test("WEB-10e headers with Content-Length and not one byte of the body: the count starts with the read itself — 408 after bodyIdleMs, nothing written, nothing started", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  p.w.close();
  const engines = fakeEngines();
  const s = await startServer(t, box, { engines, bodyIdleMs: 200 });
  const key = await s.key();
  const before = snapshot(box.home);
  for (const pth of ["/api/projects", `/api/projects/${p.id}/chat`]) {
    const started = Date.now();
    const r = await request(s.port, {
      method: "POST",
      path: pth,
      headers: {
        Origin: `http://127.0.0.1:${s.port}`,
        "Content-Type": "application/json",
        "X-Sai-Page": key,
        "Content-Length": "40",
      },
      parts: [],
      timeoutMs: 3000,
    });
    const took = Date.now() - started;
    assert.equal(r.status, 408, pth);
    assert.deepStrictEqual(r.json, INTERNAL);
    assert.equal(r.headers.connection, "close");
    assert.ok(took >= 190 && took < 2000, `${took} ms`);
  }
  assert.deepStrictEqual(snapshot(box.home), before);
  assert.deepStrictEqual(engines.calls, []);
  assert.deepStrictEqual(s.warnings, []);
});

test("WEB-10e a pause shorter than bodyIdleMs between parts is not 408: the count starts again with every part (four parts 120 ms apart, bodyIdleMs 250)", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  p.w.close();
  const engines = fakeEngines();
  const s = await startServer(t, box, { engines, bodyIdleMs: 250 });
  const key = await s.key();
  const buf = Buffer.from(JSON.stringify({ text: "Медленно, но без простоя" }));
  const q = Math.ceil(buf.length / 4);
  const r = await stalled(
    s,
    key,
    `/api/projects/${p.id}/chat`,
    [
      [buf.subarray(0, q), 120],
      [buf.subarray(q, 2 * q), 120],
      [buf.subarray(2 * q, 3 * q), 120],
      [buf.subarray(3 * q), 0],
    ],
    buf.length,
  );
  assert.equal(r.status, 200, r.text);
  const two = Buffer.from(
    JSON.stringify({ goal: "Цель в две части", budget_usd: 1 }),
  );
  const c = await stalled(
    s,
    key,
    "/api/projects",
    [
      [two.subarray(0, 8), 100],
      [two.subarray(8), 0],
    ],
    two.length,
  );
  assert.equal(c.status, 201, c.text);
  assert.equal(engines.calls.length, 1);
});

const CHAT_ROWS = [
  ["E_EVENT", 400, "Напишите сообщение", "text"],
  ["E_TOO_LONG", 400, "Сообщение длиннее 4000 знаков — сократите его", "text"],
  ["E_MSG_TOO_BIG", 413, "Сообщение слишком большое", "text"],
  [
    "E_PROJECT_BUSY",
    409,
    "Сообщение не отправлено, повторите через несколько секунд",
    null,
  ],
  [
    "E_CHANNEL_TIMEOUT",
    504,
    "Сообщение не подтверждено, проверьте чат через несколько секунд",
    null,
  ],
  [
    "E_CHANNEL_UNCONFIRMED",
    504,
    "Сообщение не подтверждено, проверьте чат через несколько секунд",
    null,
  ],
  [
    "E_CHANNEL_STALE",
    504,
    "Сообщение не подтверждено, проверьте чат через несколько секунд",
    null,
  ],
  ["E_USAGE", 400, "Запрос не понят. Обновите страницу", null],
  [
    "E_CORRUPT",
    500,
    "Данные проекта повреждены — проект нельзя показать",
    null,
  ],
  [
    "E_ENGINE_STOPPING",
    409,
    "Проект останавливается — сообщение не принято",
    null,
  ],
  [
    "E_CHANNEL_DROPPED",
    409,
    "Сообщение не выполнено: проект перезапускался. Отправьте его ещё раз",
    null,
  ],
  [
    "E_CHANNEL_FULL",
    409,
    "Проект не успевает принимать сообщения — повторите через несколько секунд",
    null,
  ],
  [
    "E_CHANNEL",
    500,
    "Связь с работающим проектом недоступна. Перезапустите Sai Team",
    null,
  ],
  [
    "E_CHANNEL_BAD",
    500,
    "Связь с работающим проектом недоступна. Перезапустите Sai Team",
    null,
  ],
  [
    "E_DISK",
    500,
    "Диск не принимает записи: сообщение не сохранено. Освободите место и повторите",
    null,
  ],
];

test("WEB-10f (r3, F6) chatFailure: every code of the rows «чат» of section 10 gives its status, text and field without a warning (E_CHANNEL_STALE — 504 «не подтверждено»); E_NOT_FOUND — «not found»; an unknown code — 500 with the general text and exactly one warning", () => {
  for (const [code, status, text, field] of CHAT_ROWS) {
    const warned = [];
    const r = chatFailure(
      { warn: (l) => warned.push(l) },
      new TeamError(code, "сообщение ядра с pid 4242 и /путь"),
    );
    assert.deepStrictEqual(
      r,
      { status, body: { error_text: text, field, reload: false } },
      code,
    );
    assert.deepStrictEqual(warned, [], code);
  }
  // (ISS-0010, design section 5.2) E_DISK whose rollback failed: the message may
  // be saved; a good rollback or no details — «не сохранено»
  for (const [details, text] of [
    [
      { rollback: "failed" },
      "Диск не принимает записи: сообщение могло сохраниться. Проверьте чат, прежде чем отправлять снова",
    ],
    [
      { rollback: "ok" },
      "Диск не принимает записи: сообщение не сохранено. Освободите место и повторите",
    ],
  ]) {
    const warned = [];
    const r = chatFailure(
      { warn: (l) => warned.push(l) },
      new TeamError("E_DISK", "сообщение ядра", details),
    );
    assert.deepStrictEqual(
      r,
      { status: 500, body: { error_text: text, field: null, reload: false } },
      details.rollback,
    );
    assert.deepStrictEqual(warned, [], details.rollback);
  }
  const warned = [];
  const nf = chatFailure(
    { warn: (l) => warned.push(l) },
    new TeamError("E_NOT_FOUND", "x"),
  );
  assert.deepStrictEqual(nf, {
    status: 404,
    body: { error_text: "Не найдено", field: null, reload: false },
  });
  for (const err of [
    new TeamError("E_SOMETHING_NEW", "детали"),
    new TeamError("E_INTERNAL", "детали"),
    new Error("not a TeamError"),
    "a string",
  ]) {
    const w = [];
    const r = chatFailure({ warn: (l) => w.push(l) }, err);
    assert.deepStrictEqual(r, { status: 500, body: INTERNAL });
    assert.equal(w.length, 1, String(err));
  }
  // a throwing warn does not change the answer
  const r = chatFailure(
    {
      warn: () => {
        throw new Error("stderr closed");
      },
    },
    new TeamError("E_WHATEVER", "x"),
  );
  assert.deepStrictEqual(r, { status: 500, body: INTERNAL });
});
