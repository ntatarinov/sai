// The code of the page (tools/src/web/public/app.js) run in Node over the real
// index.html, in the model of the DOM of team-web-dom.js (not a browser, not jsdom —
// see that file), against the real server or against answers the test gives.
// Criteria 5, 8, 9 and 11 of REQ-011 for the logic of the page (design REQ-011,
// sections 4.3, 5.2, 5.7, 8.1 «потолок на странице», 9, 13): the period and the order
// of the polls, the block of the connection, the ceiling as a decimal record only,
// the key in X-Sai-Page, the button «Обновить страницу», the label «сообщение
// сокращено», text only, addresses only from Link.api (WEB-P1…WEB-P12).
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPage, event } from "./team-web-dom.js";
import { richProject } from "./team-web-fixtures.js";
import {
  PUBLIC_DIR,
  request,
  startServer,
  webSandbox,
} from "./team-web-helpers.js";

const ID = "p-20990101-a1b2c3";
const API = `/api/projects/${ID}`;

function item(over = {}) {
  return {
    id: ID,
    goal: "Вымышленная цель",
    created_at: "2026-01-05T09:00:00.000Z",
    status: "running",
    status_text: "в работе",
    progress: { done: 1, total: 3 },
    progress_text: "1 из 3 задач",
    needs_decision: false,
    needs_decision_text: null,
    test_executor: false,
    test_executor_text: null,
    broken: false,
    link: { to: "project", api: API },
    ...over,
  };
}

const roleRef = (n, title) => ({
  n,
  title,
  link: { to: "role", api: `${API}/roles/${n}` },
});

function projectBody(over = {}) {
  return {
    ...item(),
    pause_text: null,
    tail_text: null,
    happening: [
      {
        at: "2026-01-05T09:01:00.000Z",
        text: "Исследователь взял задачу в работу",
      },
    ],
    busy: [roleRef(3, "Исследователь")],
    due_text: "срок пока не оценить",
    problems: { failed: [], waiting_text: null },
    waits: {
      count: 0,
      count_text: "Ничего не нужно",
      note_text: null,
      questions: [],
    },
    results: [],
    tasks: [],
    tasks_empty_text: "Задач нет",
    links: { chat: { to: "chat", api: `${API}/chat` } },
    ...over,
  };
}

function message(n, over = {}) {
  return {
    n,
    at: "2026-01-05T09:02:00.000Z",
    from: "team",
    author_text: "Команда Sai",
    question: false,
    open: false,
    truncated: false,
    labels_text: [],
    text: `Сообщение ${n}`,
    task: null,
    ...over,
  };
}

function chatBody(messages = []) {
  return {
    project: {
      id: ID,
      goal: "Вымышленная цель",
      status_text: "в работе",
      test_executor_text: null,
      link: { to: "project", api: API },
    },
    messages,
  };
}

// Answers by path; a value may be a function (path, init) → reply.
function router(routes) {
  return (p, init) => {
    const r = routes[`${init?.method ?? "GET"} ${p}`] ?? routes[p];
    if (r === undefined)
      return {
        status: 404,
        body: { error_text: "Не найдено", field: null, reload: false },
      };
    return typeof r === "function" ? r(p, init) : r;
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const visible = (el) => el.shown;
const linkState = (page) => page.byId("link").getAttribute("data-state");

// ---- the polling (criterion 8; section 9) ---------------------------------------------------

test("WEB-P1 (crit. 8) the list is polled at once and then every 5000 ms counted from the start of the previous poll; a slow answer delays the next poll until it came, never two at once", async () => {
  let slow = null;
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    fetch: () =>
      slow === null
        ? { status: 200, body: { projects: [item()] } }
        : slow.promise,
  });
  await page.settle();
  assert.deepStrictEqual(
    page.calls.map((c) => [c.path, c.at - page.calls[0].at]),
    [["/api/projects", 0]],
  );
  assert.equal(linkState(page), "live");
  await page.advance(4999);
  assert.equal(page.calls.length, 1);
  await page.advance(1);
  assert.equal(page.calls.length, 2);
  assert.equal(page.calls[1].at - page.calls[0].at, 5000);
  // an answer that takes 7 s: no second request meanwhile, the next one right after
  slow = deferred();
  await page.advance(5000);
  assert.equal(page.calls.length, 3);
  await page.advance(7000);
  assert.equal(page.calls.length, 3, "no request while one is pending");
  const t3 = page.now();
  const answer = slow;
  slow = null;
  answer.resolve({ status: 200, body: { projects: [item()] } });
  await page.settle();
  await page.advance(0);
  assert.equal(
    page.calls.length,
    4,
    "the next poll starts at once after a slow answer",
  );
  assert.equal(page.calls[3].at, t3);
  for (const tm of page.timers.values()) assert.ok(tm.ms <= 5000);
});

test("WEB-P2 (r3, F7) the page of a project: the first poll asks for the project (and the card) at once and for the chat only after the project answered 200; every next poll asks for all at once", async () => {
  const proj = deferred();
  let first = true;
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    hash: `#/projects/${ID}/tasks/t-0001`,
    fetch: router({
      [API]: () =>
        first ? proj.promise : { status: 200, body: projectBody() },
      [`${API}/chat`]: { status: 200, body: chatBody([message(5)]) },
      [`${API}/tasks/t-0001`]: {
        status: 200,
        body: {
          project: {
            id: ID,
            goal: "Вымышленная цель",
            link: { to: "project", api: API },
          },
          task: {
            id: "t-0001",
            text: "Задача",
            status: "running",
            status_text: "в работе",
            reason_text: null,
            role: roleRef(3, "Исследователь"),
            link: { to: "task", api: `${API}/tasks/t-0001` },
            done_when: "Есть итог",
            files: [],
          },
        },
      },
    }),
  });
  await page.settle();
  assert.deepStrictEqual(
    page.calls.map((c) => c.path),
    [API, `${API}/tasks/t-0001`],
    "project and card at once, no chat yet",
  );
  first = false;
  proj.resolve({ status: 200, body: projectBody() });
  await page.settle();
  assert.deepStrictEqual(
    page.calls.map((c) => c.path),
    [API, `${API}/tasks/t-0001`, `${API}/chat`],
  );
  assert.equal(
    page.calls[2].path,
    projectBody().links.chat.api,
    "the chat address comes from the answer",
  );
  const before = page.calls.length;
  await page.advance(5000);
  const next = page.calls
    .slice(before)
    .map((c) => c.path)
    .sort();
  assert.deepStrictEqual(
    next,
    [API, `${API}/chat`, `${API}/tasks/t-0001`].sort(),
  );
  const ats = new Set(page.calls.slice(before).map((c) => c.at));
  assert.equal(ats.size, 1, "all requests of the next poll start together");
  assert.equal(page.byId("card-task-title").textContent, "Задача");
});

test("WEB-P3 (F7) a project not found: on the first poll the chat is not asked at all; on a later poll the answer of the chat is dropped and the screen is «not found»", async () => {
  let status = 404;
  let chat = {
    status: 200,
    body: chatBody([message(7, { text: "Не должно появиться" })]),
  };
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    hash: `#/projects/${ID}`,
    fetch: router({
      [API]: () =>
        status === 404
          ? {
              status: 404,
              body: { error_text: "Не найдено", field: null, reload: false },
            }
          : { status: 200, body: projectBody() },
      [`${API}/chat`]: () => chat,
    }),
  });
  await page.settle();
  assert.deepStrictEqual(
    page.calls.map((c) => c.path),
    [API],
  );
  assert.equal(visible(page.byId("screen-notfound")), true);
  assert.equal(visible(page.byId("screen-project")), false);
  status = 200;
  await page.advance(5000);
  assert.equal(visible(page.byId("screen-project")), true);
  const shown = page.byId("chat-list").textContent;
  assert.ok(shown.includes("Не должно появиться"));
  status = 404;
  await page.advance(5000);
  const last = page.calls
    .slice(-2)
    .map((c) => c.path)
    .sort();
  assert.deepStrictEqual(
    last,
    [API, `${API}/chat`].sort(),
    "both asked together",
  );
  assert.equal(visible(page.byId("screen-notfound")), true);
  assert.equal(visible(page.byId("screen-project")), false);
  // the answer of the chat on a poll where the project is 404 is dropped
  // (TEST-DESIGN-VALIDATOR F2, mutant V38): a refusal of the chat does not reach
  // the error bar, a new message does not reach the list of the chat
  assert.equal(visible(page.byId("error-bar")), false);
  chat = {
    status: 500,
    body: {
      error_text: "Отказ чата, не должен показаться",
      field: null,
      reload: false,
    },
  };
  let n = page.calls.length;
  await page.advance(5000);
  assert.deepStrictEqual(
    page.calls
      .slice(n)
      .map((c) => c.path)
      .sort(),
    [API, `${API}/chat`].sort(),
    "the chat was asked on this poll",
  );
  assert.equal(visible(page.byId("error-bar")), false);
  assert.ok(!page.byId("error-text").textContent.includes("Отказ чата"));
  assert.equal(visible(page.byId("screen-notfound")), true);
  chat = {
    status: 200,
    body: chatBody([
      message(7, { text: "Не должно появиться" }),
      message(8, { text: "Новое после 404" }),
    ]),
  };
  n = page.calls.length;
  await page.advance(5000);
  assert.ok(
    page.calls.slice(n).some((c) => c.path === `${API}/chat`),
    "the chat was asked on this poll",
  );
  assert.equal(page.byId("chat-list").textContent, shown);
  assert.ok(!page.byId("chat-list").textContent.includes("Новое после 404"));
  assert.equal(visible(page.byId("screen-notfound")), true);
  assert.equal(visible(page.byId("screen-project")), false);
});

test("WEB-P4 (r3, F10) no connection, an answer the page cannot read and an unexpected error inside a poll: the block of the connection says «Нет связи с сервером Sai», the data stay, the polling goes on", async () => {
  let mode = "ok";
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    fetch: () => {
      if (mode === "throw") throw new TypeError("Failed to fetch");
      if (mode === "shape") return { status: 200, body: { projects: "нет" } };
      if (mode === "html") return { status: 200, raw: "<html>" };
      if (mode === "bug") {
        return { statusThrows: true, body: { projects: [] } };
      }
      return { status: 200, body: { projects: [item()] } };
    },
  });
  await page.settle();
  assert.equal(linkState(page), "live");
  const down = page.byId("link").querySelector('[data-when="down"]');
  for (const m of ["throw", "shape", "html", "bug"]) {
    mode = m;
    const n = page.calls.length;
    await page.advance(5000);
    assert.equal(page.calls.length, n + 1, m);
    assert.equal(linkState(page), "down", m);
    assert.equal(down.hidden, false, m);
    assert.equal(down.textContent, "Нет связи с сервером Sai");
    assert.ok(
      page.byId("projects").textContent.includes("Вымышленная цель"),
      `${m}: the data stay`,
    );
    assert.equal(page.timers.size, 1, `${m}: the next poll is planned`);
    mode = "ok";
    await page.advance(5000);
    assert.equal(linkState(page), "live", `${m}: back`);
  }
});

// ---- the new project (criterion 3; section 8.1, 5.7) -----------------------------------------

async function submitCreate(page, goal, budget) {
  page.byId("goal").value = goal;
  page.byId("goal").dispatchEvent(event("input"));
  page.byId("budget").value = budget;
  page.byId("budget").dispatchEvent(event("input"));
  page.byId("create-form").dispatchEvent(event("submit"));
  await page.settle();
}

test("WEB-P5 (r3, F8) the ceiling goes as a number only for a decimal record (one comma becomes a point); «0x10», «1e2», «+5», «.5», «5.», «-1» go as null; the write carries Content-Type application/json and the key of the page", async () => {
  const key = "c".repeat(64);
  const posts = [];
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    key,
    fetch: router({
      "/api/projects": { status: 200, body: { projects: [] } },
      "POST /api/projects": (p, init) => {
        posts.push(init);
        return {
          status: 400,
          body: {
            error_text:
              "Потолок расходов — число больше 0 и не больше 100000, не больше 6 знаков после запятой",
            field: "budget_usd",
            reload: false,
          },
        };
      },
    }),
  });
  await page.settle();
  const cases = [
    ["12,5", 12.5],
    [" 20 ", 20],
    ["007", 7],
    ["0.000001", 0.000001],
    ["0", 0],
    ["0x10", null],
    ["0b11", null],
    ["1e2", null],
    ["+5", null],
    [".5", null],
    ["5.", null],
    ["-1", null],
    ["1,000.5", null],
    ["Infinity", null],
    ["5 долларов", null],
  ];
  for (const [text, want] of cases) {
    await submitCreate(page, "Вымышленная цель", text);
    const init = posts.at(-1);
    assert.equal(init.method, "POST");
    // (the objects of the page come from another realm: compared as JSON)
    assert.deepStrictEqual(JSON.parse(JSON.stringify(init.headers)), {
      "Content-Type": "application/json",
      "X-Sai-Page": key,
    });
    assert.deepStrictEqual(
      JSON.parse(init.body),
      { goal: "Вымышленная цель", budget_usd: want },
      text,
    );
    assert.equal(page.calls.at(-1).path, "/api/projects");
  }
  assert.equal(posts.length, cases.length);
  // the refusal of the ceiling: its text, the field marked, the text of the goal kept
  assert.equal(page.byId("budget").getAttribute("aria-invalid"), "true");
  assert.equal(
    page.byId("create-result").querySelector('[data-msg="server"]').textContent,
    "Потолок расходов — число больше 0 и не больше 100000, не больше 6 знаков после запятой",
  );
  assert.equal(page.byId("goal").value, "Вымышленная цель");
});

test('WEB-P6 (5.7) a project created and started: the page goes to "#" + link.api.slice(4); created but not started: it stays on the form, shows result_text as a warning and the link to the project, the fields are cleared', async () => {
  let started = true;
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    fetch: router({
      "/api/projects": { status: 200, body: { projects: [] } },
      "POST /api/projects": () => ({
        status: 201,
        body: {
          project: { id: ID, link: { to: "project", api: API } },
          started,
          result_text: started
            ? "Проект создан, команда начала работу"
            : "Проект создан, но работа не началась: рабочая папка проекта недоступна",
        },
      }),
      [API]: { status: 200, body: projectBody() },
      [`${API}/chat`]: { status: 200, body: chatBody() },
    }),
  });
  await page.settle();
  started = false;
  await submitCreate(page, "Цель без старта", "5");
  assert.equal(page.location.hash, "");
  const result = page.byId("create-result");
  assert.equal(result.getAttribute("data-tone"), "warn");
  assert.equal(
    result.querySelector('[data-msg="server"]').textContent,
    "Проект создан, но работа не началась: рабочая папка проекта недоступна",
  );
  assert.equal(page.byId("create-open").hidden, false);
  assert.equal(
    page.byId("create-open").getAttribute("href"),
    `#/projects/${ID}`,
  );
  assert.equal(page.byId("goal").value, "");
  assert.equal(page.byId("budget").value, "");
  started = true;
  await submitCreate(page, "Цель со стартом", "5");
  assert.equal(page.location.hash, `#/projects/${ID}`);
  await page.settle();
  assert.equal(visible(page.byId("screen-project")), true);
  assert.ok(page.calls.some((c) => c.path === API));
});

test("WEB-P7 (F-3) a write refused with reload: true — the text, the button «Обновить страницу», the text in the field stays; the button reloads the page; nothing is repeated by itself", async () => {
  const stale = {
    status: 403,
    body: {
      error_text:
        "Sai Team был перезапущен, и эта страница устарела. Обновите страницу и повторите — текст в поле пропадёт, скопируйте его, если он нужен",
      field: null,
      reload: true,
    },
  };
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    hash: `#/projects/${ID}`,
    fetch: router({
      [API]: { status: 200, body: projectBody() },
      [`${API}/chat`]: { status: 200, body: chatBody([message(1)]) },
      [`POST ${API}/chat`]: stale,
      "POST /api/projects": stale,
      "/api/projects": { status: 200, body: { projects: [] } },
    }),
  });
  await page.settle();
  page.byId("chat-text").value = "Мой важный текст";
  page.byId("chat-text").dispatchEvent(event("input"));
  page.byId("chat-form").dispatchEvent(event("submit"));
  await page.settle();
  const posts = page.calls.filter((c) => c.init?.method === "POST");
  assert.equal(posts.length, 1);
  assert.equal(page.byId("chat-reload").hidden, false);
  assert.equal(page.byId("chat-text").value, "Мой важный текст");
  assert.equal(
    page.byId("chat-result").querySelector('[data-msg="server"]').textContent,
    stale.body.error_text,
  );
  page.byId("chat-reload").dispatchEvent(event("click"));
  assert.equal(page.location.reloads, 1);
  await page.advance(15_000);
  assert.equal(
    page.calls.filter((c) => c.init?.method === "POST").length,
    1,
    "no repeat",
  );
  // the form of a new project does the same
  await page.go("#/");
  await submitCreate(page, "Цель", "5");
  assert.equal(page.byId("create-reload").hidden, false);
  assert.equal(page.byId("goal").value, "Цель");
  page.byId("create-reload").dispatchEvent(event("click"));
  assert.equal(page.location.reloads, 2);
});

test("WEB-P8 (crit. 5, 10) a refused message keeps its text: 504 is a warning, a refusal with field text marks the field, no connection — the offline line", async () => {
  let reply = {
    status: 504,
    body: {
      error_text:
        "Сообщение не подтверждено, проверьте чат через несколько секунд",
      field: null,
      reload: false,
    },
  };
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    hash: `#/projects/${ID}/chat`,
    fetch: router({
      [API]: { status: 200, body: projectBody() },
      [`${API}/chat`]: { status: 200, body: chatBody([message(1)]) },
      [`POST ${API}/chat`]: () => {
        if (reply === null) throw new TypeError("Failed to fetch");
        return reply;
      },
    }),
  });
  await page.settle();
  const send = async (text) => {
    page.byId("chat-text").value = text;
    page.byId("chat-text").dispatchEvent(event("input"));
    page.byId("chat-form").dispatchEvent(event("submit"));
    await page.settle();
  };
  const result = page.byId("chat-result");
  await send("Первый");
  assert.equal(result.getAttribute("data-tone"), "warn");
  assert.equal(page.byId("chat-text").value, "Первый");
  reply = {
    status: 400,
    body: {
      error_text: "Сообщение длиннее 4000 знаков — сократите его",
      field: "text",
      reload: false,
    },
  };
  await send("Второй");
  assert.equal(result.getAttribute("data-tone"), "err");
  assert.equal(page.byId("chat-text").getAttribute("aria-invalid"), "true");
  assert.equal(page.byId("chat-text").value, "Второй");
  reply = null;
  await send("Третий");
  assert.equal(result.querySelector('[data-msg="offline"]').hidden, false);
  assert.equal(page.byId("chat-text").value, "Третий");
  // sent: the field is cleared and the message is in the list at once
  reply = {
    status: 200,
    body: {
      result_text: "Отправлено",
      message: message(9, {
        from: "user",
        author_text: "Вы",
        text: "Четвёртый",
      }),
    },
  };
  await send("Четвёртый");
  assert.equal(page.byId("chat-text").value, "");
  assert.equal(
    result.querySelector('[data-msg="server"]').textContent,
    "Отправлено",
  );
  assert.ok(page.byId("chat-list").textContent.includes("Четвёртый"));
});

// ---- what the page shows (criteria 4, 5, 6, 7) ----------------------------------------------

test("WEB-P9 (crit. 5, r3 F4) the messages are text, never markup; the muted label only for truncated: true and only the last one; a message about a task links by its Link.api", async () => {
  const msgs = [
    message(1, { text: "<script>alert(1)</script><b>x</b>" }),
    message(2, { truncated: true, labels_text: ["сообщение сокращено"] }),
    message(3, {
      question: true,
      open: true,
      truncated: true,
      labels_text: ["вопрос", "ждёт ответа", "сообщение сокращено"],
    }),
    message(4, {
      question: true,
      open: true,
      labels_text: ["вопрос", "ждёт ответа"],
    }),
    message(5, {
      task: {
        text: "Задача о ценах",
        role_title: "Юрист",
        link: { to: "task", api: `${API}/tasks/t-0002` },
      },
    }),
  ];
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    hash: `#/projects/${ID}`,
    fetch: router({
      [API]: { status: 200, body: projectBody() },
      [`${API}/chat`]: { status: 200, body: chatBody(msgs) },
    }),
  });
  await page.settle();
  const items = page.byId("chat-list").children;
  assert.equal(items.length, 5);
  const text0 = items[0].querySelector('[data-slot="text"]');
  assert.equal(text0.textContent, "<script>alert(1)</script><b>x</b>");
  assert.equal(text0.children.length, 0, "no element made from the text");
  const labels = (li) =>
    li
      .querySelector('[data-slot="labels"]')
      .children.map((s) => [s.textContent, s.getAttribute("data-muted")]);
  assert.deepStrictEqual(labels(items[1]), [["сообщение сокращено", "true"]]);
  assert.deepStrictEqual(labels(items[2]), [
    ["вопрос", "false"],
    ["ждёт ответа", "false"],
    ["сообщение сокращено", "true"],
  ]);
  assert.deepStrictEqual(labels(items[3]), [
    ["вопрос", "false"],
    ["ждёт ответа", "false"],
  ]);
  assert.equal(items[2].getAttribute("data-open"), "true");
  const task = items[4].querySelector('[data-slot="task"]');
  assert.equal(task.hidden, false);
  assert.equal(
    task.getAttribute("href"),
    "#/projects/p-20990101-a1b2c3/tasks/t-0002",
  );
  assert.equal(
    task.querySelector('[data-slot="task-role"]').textContent,
    "Юрист",
  );
  assert.equal(items[0].querySelector('[data-slot="task"]').hidden, true);
});

test("WEB-P10 (crit. 4, 6, r3 F1) the six answers: phrases, busy roles and results link only by Link.api; «и ещё N» is results.length − 10; no results — the empty line; the texts are those of the server, no percent anywhere on the page", async () => {
  const results = [];
  for (let i = 1; i <= 13; i += 1) {
    results.push({
      name: `file-${i}.md`,
      task: "t-0001",
      task_text: "Задача о ценах",
      role: roleRef(3, "Исследователь"),
      link: { to: "task", api: `${API}/tasks/t-0001` },
    });
  }
  const failed = [];
  for (let i = 1; i <= 7; i += 1) {
    failed.push({
      id: `t-000${i}`,
      text: `Сбой ${i}`,
      status: "failed",
      status_text: "не удалось",
      reason_text: `Причина ${i}`,
      role: roleRef(4, "Маркетолог"),
      link: { to: "task", api: `${API}/tasks/t-000${i}` },
    });
  }
  let body = projectBody({
    results,
    problems: { failed, waiting_text: "Проект ждёт вашего решения" },
    waits: {
      count: 1,
      count_text: "Вопросов, ждущих ответа: 1",
      note_text: "Заметка сервера",
      questions: [
        { task: null, chat_n: 1, link: { to: "chat", api: `${API}/chat` } },
      ],
    },
    due_text: "примерно через 12 мин",
  });
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    hash: `#/projects/${ID}`,
    fetch: router({
      [API]: () => ({ status: 200, body }),
      [`${API}/chat`]: { status: 200, body: chatBody([message(1)]) },
    }),
  });
  await page.settle();
  const rows = page.byId("results").children;
  assert.equal(rows.length, 10);
  assert.equal(
    rows[0].querySelector('[data-slot="name"]').textContent,
    "file-1.md",
  );
  assert.equal(
    rows[0].querySelector('[data-slot="task"]').getAttribute("href"),
    "#/projects/p-20990101-a1b2c3/tasks/t-0001",
  );
  assert.equal(
    rows[0].querySelector('[data-slot="role"]').getAttribute("href"),
    "#/projects/p-20990101-a1b2c3/roles/3",
  );
  assert.equal(page.byId("results-more").hidden, false);
  assert.equal(
    page.byId("results-more").querySelector('[data-slot="n"]').textContent,
    "3",
  );
  assert.equal(page.byId("results-empty").hidden, true);
  assert.equal(page.byId("failed").children.length, 5);
  assert.equal(
    page.byId("failed-more").querySelector('[data-slot="n"]').textContent,
    "2",
  );
  assert.equal(page.byId("due").textContent, "примерно через 12 мин");
  assert.equal(
    page.byId("waits-count").textContent,
    "Вопросов, ждущих ответа: 1",
  );
  assert.equal(page.byId("waits-note").textContent, "Заметка сервера");
  assert.equal(
    page.byId("waiting-text").textContent,
    "Проект ждёт вашего решения",
  );
  const busy = page
    .byId("busy")
    .children[0].querySelector('[data-slot="role"]');
  assert.equal(
    busy.getAttribute("href"),
    "#/projects/p-20990101-a1b2c3/roles/3",
  );
  assert.equal(page.byId("project-progress").textContent, "1 из 3 задач");
  assert.equal(
    page.byId("project-bar").getAttribute("aria-valuetext"),
    "1 из 3 задач",
  );
  assert.doesNotMatch(page.doc.body.textContent, /%/);
  // the server sends no results: the page does not invent any
  body = projectBody({ results: [] });
  await page.advance(5000);
  assert.equal(page.byId("results").children.length, 0);
  assert.equal(page.byId("results-empty").hidden, false);
  assert.equal(page.byId("results-more").hidden, true);
});

test('WEB-P11 (5.2) the address of the page and the requests: "/api" + hash.slice(1) only for #/projects/…; any other address is the list; closing a card goes to the project of the answer', async () => {
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    fetch: () => ({ status: 200, body: { projects: [] } }),
  });
  await page.settle();
  const route = (h) => {
    page.location._hash = h;
    return JSON.parse(JSON.stringify(page.eval("readRoute()")));
  };
  assert.deepStrictEqual(route(""), {
    kind: "list",
    project: null,
    chat: false,
    card: null,
  });
  assert.deepStrictEqual(route("#/"), {
    kind: "list",
    project: null,
    chat: false,
    card: null,
  });
  assert.deepStrictEqual(route("#/new"), {
    kind: "list",
    project: null,
    chat: false,
    card: null,
  });
  assert.deepStrictEqual(route("#/p/x"), {
    kind: "list",
    project: null,
    chat: false,
    card: null,
  });
  assert.deepStrictEqual(route(`#/projects/${ID}`), {
    kind: "project",
    project: API,
    chat: false,
    card: null,
  });
  assert.deepStrictEqual(route(`#/projects/${ID}/chat`), {
    kind: "project",
    project: API,
    chat: true,
    card: null,
  });
  assert.deepStrictEqual(route(`#/projects/${ID}/roles/3`), {
    kind: "project",
    project: API,
    chat: false,
    card: `${API}/roles/3`,
  });
  assert.deepStrictEqual(route(`#/projects/${ID}/tasks/t-0002`), {
    kind: "project",
    project: API,
    chat: false,
    card: `${API}/tasks/t-0002`,
  });
  assert.equal(
    page.eval(`linkHash({ to: "task", api: "${API}/tasks/t-0002" })`),
    `#/projects/${ID}/tasks/t-0002`,
  );
});

// ---- against the real server --------------------------------------------------------------------

test("WEB-P12 (crit. 3, 5, 9) the real page against the real server: the key of GET / goes into X-Sai-Page, a project is created and opened, a message is sent and shown; a page of an old start gets «Обновить страницу»", async (t) => {
  const box = webSandbox(t);
  const p = richProject(t, box);
  p.w.close();
  const s = await startServer(t, box);
  const key = await s.key();
  const forward = (port, pageKey) => async (pth, init) => {
    const headers = { ...(init?.headers ?? {}) };
    if (init?.method === "POST") headers.Origin = `http://127.0.0.1:${port}`;
    const r = await request(port, {
      method: init?.method ?? "GET",
      path: pth,
      headers,
      body: init?.body,
    });
    assert.equal(headers["X-Sai-Page"] ?? pageKey, pageKey);
    return { status: r.status, raw: r.text };
  };
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    key,
    fetch: forward(s.port, key),
  });
  await page.settle();
  assert.equal(linkState(page), "live");
  assert.ok(
    page
      .byId("projects")
      .textContent.includes("Вымышленная цель проверки страницы"),
  );
  await submitCreate(page, "Цель со страницы", "12,5");
  await page.settle();
  const created = page.calls.find((c) => c.init?.method === "POST");
  assert.ok(created);
  const list = (await s.get("/api/projects")).json.projects;
  const mine = list.find((x) => x.goal === "Цель со страницы");
  assert.ok(mine, "the project is created by the page");
  assert.equal(page.location.hash, `#/projects/${mine.id}`);
  await page.settle();
  assert.equal(page.byId("project-goal").textContent, "Цель со страницы");
  page.byId("chat-text").value = "Привет со страницы <b>";
  page.byId("chat-text").dispatchEvent(event("input"));
  page.byId("chat-form").dispatchEvent(event("submit"));
  await page.settle();
  const chat = (await s.get(`/api/projects/${mine.id}/chat`)).json.messages;
  assert.equal(chat.at(-1).text, "Привет со страницы <b>");
  assert.ok(
    page.byId("chat-list").textContent.includes("Привет со страницы <b>"),
  );
  // the open page of an old start of the server
  const stalePage = loadPage({
    publicDir: PUBLIC_DIR,
    key: "d".repeat(64),
    fetch: forward(s.port, "d".repeat(64)),
    hash: `#/projects/${mine.id}`,
  });
  await stalePage.settle();
  assert.equal(linkState(stalePage), "live", "reading needs no key");
  stalePage.byId("chat-text").value = "Из старой страницы";
  stalePage.byId("chat-text").dispatchEvent(event("input"));
  stalePage.byId("chat-form").dispatchEvent(event("submit"));
  await stalePage.settle();
  assert.equal(stalePage.byId("chat-reload").hidden, false);
  assert.equal(stalePage.byId("chat-text").value, "Из старой страницы");
});
