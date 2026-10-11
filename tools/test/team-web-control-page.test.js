// REQ-035 — the buttons of control on the page (design
// docs/design/REQ-035-team-web-control.md r4, sections 9.2–9.4, 15; description
// docs/design/REQ-035-ui.md r2, sections 4.3, 5, 7, 8, 11): the real index.html and
// app.js in the model of the DOM of team-web-dom.js, with a fake fetch that counts
// the requests of writing — answers given by the test, or the real server behind
// it (CTL-4a, CTL-8d). Criteria 4 and 8 for the logic of the page (CTL-4a, CTL-8d,
// CTL-8f, CTL-8h).
//
// What the model does NOT cover (it is not a browser): the layout, the sizes and
// the colours, a real order of Tab and a real focus ring, the activation of a
// button by Enter and the space (pressKey of the model sends keydown and then
// click, as a browser does), the screen reader. These are checked in a real
// browser by DESIGN-QA-VALIDATOR (design section 14, criterion 10).
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { journal, sha256 } from "./exec-helpers.js";
import { loadPage, event, pressKey } from "./team-web-dom.js";
import {
  PUBLIC_DIR,
  planTask,
  project,
  request,
  startServer,
  webSandbox,
  withPlan,
  writeHeaders,
} from "./team-web-helpers.js";

const A = "p-20990101-a1b2c3";
const B = "p-20990101-d4e5f6";
const api = (id) => `/api/projects/${id}`;

const RUNNING = { pause: true, resume: false, stop: true };
const PAUSED = { pause: false, resume: true, stop: true };
const STOPPED = { pause: false, resume: false, stop: false };

const UNCONFIRMED =
  "Команда не подтверждена, проверьте состояние проекта через несколько секунд";
const CONFIRM_TEXT =
  "Остановить проект? Это нельзя отменить. Начатая работа прервётся, продолжить проект потом нельзя.";

function projectBody(id, controls = RUNNING, over = {}) {
  const status = controls.resume
    ? "paused"
    : controls.pause
      ? "running"
      : "stopped";
  return {
    id,
    goal: `Вымышленная цель ${id}`,
    created_at: "2026-01-05T09:00:00.000Z",
    status,
    status_text: {
      paused: "на паузе",
      running: "в работе",
      stopped: "остановлен",
    }[status],
    progress: { done: 0, total: 1 },
    progress_text: "0 из 1 задач",
    needs_decision: false,
    needs_decision_text: null,
    test_executor: false,
    test_executor_text: null,
    broken: false,
    link: { to: "project", api: api(id) },
    pause_text:
      status === "paused"
        ? "Проект на паузе. Нажмите «Продолжить», чтобы работа пошла дальше"
        : null,
    stopped_text:
      status === "stopped" ? "Проект остановлен. Продолжить его нельзя" : null,
    controls: { ...controls, api: `${api(id)}/control` },
    tail_text: null,
    happening: [],
    busy: [],
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
    links: { chat: { to: "chat", api: `${api(id)}/chat` } },
    ...over,
  };
}

const chatBody = (id) => ({
  project: {
    id,
    goal: `Вымышленная цель ${id}`,
    status_text: "в работе",
    test_executor_text: null,
    link: { to: "project", api: api(id) },
  },
  messages: [],
});

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// A fake server of answers: the project and the chat of A and B; the controls of
// each project and a hold of its GET are set by the test; every POST of control
// waits for the test (held[path]) — the requests of writing are page.calls with
// the method POST.
function fakeServer() {
  const controls = { [A]: RUNNING, [B]: RUNNING };
  const held = {};
  const getHold = {};
  const fetch = (p, init) => {
    const method = init?.method ?? "GET";
    if (method === "POST") {
      const d = deferred();
      (held[p] ??= []).push(d);
      return d.promise;
    }
    for (const id of [A, B]) {
      if (p === api(id)) {
        // the body is made when the answer goes, after a hold
        const body = () => ({
          status: 200,
          body: projectBody(id, controls[id]),
        });
        return getHold[id] ? getHold[id].promise.then(body) : body();
      }
      if (p === `${api(id)}/chat`) return { status: 200, body: chatBody(id) };
    }
    return {
      status: 404,
      body: { error_text: "Не найдено", field: null, reload: false },
    };
  };
  return { fetch, controls, held, getHold };
}

const posts = (page) => page.calls.filter((c) => c.init?.method === "POST");
const btn = (page, id) => page.byId(id);
const THREE = ["ctl-pause", "ctl-resume", "ctl-stop"];
const ariaOff = (page) =>
  THREE.map((id) => btn(page, id).getAttribute("aria-disabled") === "true");
const anyDisabled = (page) =>
  THREE.some((id) => btn(page, id).hasAttribute("disabled"));
const resultOf = (page) => {
  const box = page.byId("control-result");
  const shown = box
    .querySelectorAll("[data-msg]")
    .filter((el) => !el.hidden)
    .map((el) => el.dataset.msg);
  return {
    tone: box.getAttribute("data-tone"),
    shown,
    text: box.querySelector('[data-msg="server"]').textContent,
  };
};
// The id of the element with the focus (an element itself is not compared: on a
// failure assert would print the whole model of the document).
const focused = (page) => page.doc.activeElement?.id ?? null;
const norm = (text) => text.replace(/\s+/g, " ").trim();

async function openOn(id, fake, over = {}) {
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    fetch: fake.fetch,
    hash: `#/projects/${id}`,
    ...over,
  });
  await page.settle();
  assert.equal(page.eval("app.project.id"), id);
  return page;
}

// ---- criterion 4 -----------------------------------------------------------------------

// The page in front of the real server: every request goes to it; the POSTs are
// counted and may be held by the test.
function serverFetch(port) {
  const writes = [];
  let gate = null;
  const fetch = async (pth, init) => {
    const method = init?.method ?? "GET";
    let headers = {};
    if (method === "POST") {
      headers = writeHeaders(port, init.headers["X-Sai-Page"], {
        "Content-Type": init.headers["Content-Type"],
      });
      writes.push(init.body);
      if (gate !== null) await gate.promise;
    }
    const r = await request(port, {
      method,
      path: pth,
      headers,
      body: init?.body,
    });
    return { status: r.status, raw: r.text };
  };
  return {
    fetch,
    writes,
    hold: () => {
      gate = deferred();
    },
    release: () => {
      const g = gate;
      gate = null;
      g.resolve();
    },
  };
}

async function waitFor(fn, what, ms = 10_000) {
  const deadline = Date.now() + ms;
  for (;;) {
    if (fn()) return;
    assert.ok(Date.now() < deadline, `${what}: not within ${ms} ms`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function liveProject(t) {
  const box = webSandbox(t);
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  p.w.close();
  const s = await startServer(t, box);
  const key = await s.key();
  const net = serverFetch(s.port);
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    key,
    fetch: net.fetch,
    hash: `#/projects/${p.id}`,
  });
  await waitFor(
    () => page.eval("app.project !== null && app.project.id") === p.id,
    "the project",
  );
  await page.settle();
  return { box, p, s, net, page };
}

const hashOf = (p) => sha256(fs.readFileSync(p.events));

test('CTL-4a (crit. 4, 12) the real page in front of the real server: a click on «Остановить» sends nothing and shows the confirmation with its text and the buttons «Остановить» and «Не останавливать» (focus on «Не останавливать»); «Не останавливать» and Escape send nothing and hide it, the journal is the same; «Остановить» in it — exactly one request with the body {"action":"stop","confirmed":true}, one PROJECT_STOPPED of USER; the next poll shows «остановлен» without buttons', async (t) => {
  const { p, net, page } = await liveProject(t);
  const confirm = page.byId("stop-confirm");
  assert.equal(confirm.shown, false);
  const hash = hashOf(p);
  // «Остановить» of the row: only the confirmation
  btn(page, "ctl-stop").focus();
  btn(page, "ctl-stop").click();
  await page.settle();
  assert.deepStrictEqual(net.writes, [], "no request before the confirmation");
  assert.equal(confirm.shown, true);
  assert.equal(confirm.getAttribute("role"), "alertdialog");
  assert.equal(norm(page.byId("stop-confirm-text").textContent), CONFIRM_TEXT);
  assert.equal(norm(page.byId("stop-yes").textContent), "Остановить");
  assert.equal(norm(page.byId("stop-no").textContent), "Не останавливать");
  assert.equal(focused(page), "stop-no");
  // a second click on «Остановить» of the row: nothing more
  btn(page, "ctl-stop").click();
  await page.settle();
  assert.deepStrictEqual(net.writes, []);
  // «Не останавливать»
  page.byId("stop-no").click();
  await page.settle();
  assert.equal(confirm.shown, false);
  assert.equal(focused(page), "ctl-stop");
  assert.deepStrictEqual(net.writes, []);
  assert.equal(hashOf(p), hash, "«Не останавливать» changes nothing");
  // Escape
  btn(page, "ctl-stop").click();
  await page.settle();
  assert.equal(confirm.shown, true);
  pressKey(page.doc, page.doc.activeElement, "Escape");
  await page.settle();
  assert.equal(confirm.shown, false);
  assert.equal(focused(page), "ctl-stop");
  assert.deepStrictEqual(net.writes, []);
  assert.equal(hashOf(p), hash, "Escape changes nothing");
  // «Остановить» in the confirmation: one request
  btn(page, "ctl-stop").click();
  await page.settle();
  page.byId("stop-yes").click();
  await waitFor(() => resultOf(page).text === "Отправлено", "the answer");
  assert.deepStrictEqual(net.writes, ['{"action":"stop","confirmed":true}']);
  assert.deepStrictEqual(
    journal(p)
      .filter((e) => e.type === "PROJECT_STOPPED")
      .map((e) => e.source),
    ["USER"],
  );
  await waitFor(
    () => page.byId("project-stopped").shown,
    "the poll after the answer",
  );
  assert.equal(
    page.byId("project-stopped").textContent,
    "Проект остановлен. Продолжить его нельзя",
  );
  assert.deepStrictEqual(
    THREE.map((id) => btn(page, id).shown),
    [false, false, false],
  );
  assert.equal(net.writes.length, 1);
});

test("CTL-4a (variant; section 9.3, M22) the confirmation is open and the next poll says the project can no longer be stopped (controls.stop false — stopped in another tab): the confirmation closes without a request, the focus goes to the goal of the project", async () => {
  const fake = fakeServer();
  const page = await openOn(A, fake);
  btn(page, "ctl-stop").click();
  await page.settle();
  assert.equal(page.byId("stop-confirm").shown, true);
  assert.equal(focused(page), "stop-no");
  // while it is open «Пауза» is not available, and a click on it sends nothing
  assert.equal(btn(page, "ctl-pause").getAttribute("aria-disabled"), "true");
  btn(page, "ctl-pause").click();
  await page.settle();
  assert.equal(posts(page).length, 0);
  fake.controls[A] = STOPPED;
  await page.advance(5000);
  assert.equal(page.byId("stop-confirm").shown, false);
  assert.equal(page.eval("app.confirming"), false);
  assert.equal(focused(page), "project-goal");
  assert.equal(posts(page).length, 0);
});

test('CTL-4 (section 3.2, 9.3) the bodies of the page: «Пауза» sends exactly {"action":"pause"}, «Продолжить» exactly {"action":"resume"}, to ControlSet.api by POST with Content-Type application/json and the key of the page in X-Sai-Page', async () => {
  const fake = fakeServer();
  const key = "e".repeat(64);
  const page = await openOn(A, fake, { key });
  btn(page, "ctl-pause").click();
  await page.settle();
  fake.held[`${api(A)}/control`][0].resolve({
    status: 200,
    body: { result_text: "Отправлено" },
  });
  await page.settle();
  fake.controls[A] = PAUSED;
  await page.advance(5000);
  assert.equal(btn(page, "ctl-resume").shown, true);
  btn(page, "ctl-resume").click();
  await page.settle();
  const sent = posts(page);
  assert.deepStrictEqual(
    sent.map((c) => [c.path, c.init.body]),
    [
      [`${api(A)}/control`, '{"action":"pause"}'],
      [`${api(A)}/control`, '{"action":"resume"}'],
    ],
  );
  for (const c of sent) {
    assert.equal(c.init.headers["Content-Type"], "application/json");
    assert.equal(c.init.headers["X-Sai-Page"], key);
  }
});

// ---- criterion 8 -----------------------------------------------------------------------

test("CTL-8d (crit. 8 (г)) the real page in front of the real server: two clicks on «Пауза» in a row before the answer (and Enter on it) — one request; the server writes one PROJECT_PAUSED", async (t) => {
  const { p, net, page } = await liveProject(t);
  net.hold();
  btn(page, "ctl-pause").focus();
  btn(page, "ctl-pause").click();
  btn(page, "ctl-pause").click();
  pressKey(page.doc, btn(page, "ctl-pause"), "Enter");
  await page.settle();
  assert.equal(net.writes.length, 1, "one request");
  net.release();
  await waitFor(() => resultOf(page).text === "Отправлено", "the answer");
  assert.equal(net.writes.length, 1);
  assert.equal(journal(p).filter((e) => e.type === "PROJECT_PAUSED").length, 1);
});

test('CTL-8f (crit. 8 (а); description 4.3, r4) while the request goes on: aria-disabled="true" on the three buttons, the attribute disabled on none, the focus stays on the pressed «Пауза»; a click, click() and the keys Enter and space on it send nothing more; after the answer 504 aria-disabled is taken off the three (still no disabled), the focus is on the same button, the line of the result is the text of the answer (warn) and a new poll starts at once; when that poll has no «Пауза» the focus goes to the goal of the project', async () => {
  const fake = fakeServer();
  const page = await openOn(A, fake);
  assert.deepStrictEqual(ariaOff(page), [false, false, false]);
  const pause = btn(page, "ctl-pause");
  pause.focus();
  pause.click();
  await page.settle();
  assert.equal(posts(page).length, 1);
  assert.deepStrictEqual(ariaOff(page), [true, true, true]);
  assert.equal(anyDisabled(page), false, "never the attribute disabled");
  assert.equal(focused(page), "ctl-pause");
  assert.deepStrictEqual(resultOf(page).shown, ["sending"]);
  // more presses on the button that is not available
  pause.click();
  pause.dispatchEvent(event("click"));
  pressKey(page.doc, pause, "Enter");
  pressKey(page.doc, pause, " ");
  await page.settle();
  assert.equal(posts(page).length, 1, "the handler leaves at its first line");
  assert.equal(focused(page), "ctl-pause");
  // a poll comes while the request goes on: the same buttons, still not
  // available, the focus stays on the pressed one, «Отправляется…» stays
  await page.advance(5000);
  assert.equal(pause.shown, true);
  assert.deepStrictEqual(ariaOff(page), [true, true, true]);
  assert.equal(focused(page), "ctl-pause");
  assert.deepStrictEqual(resultOf(page).shown, ["sending"]);
  assert.equal(posts(page).length, 1);
  // the next poll is held to look at the moment between the answer and the poll
  fake.getHold[A] = deferred();
  const getsBefore = page.calls.filter((c) => c.path === api(A)).length;
  fake.held[`${api(A)}/control`][0].resolve({
    status: 504,
    body: { error_text: UNCONFIRMED, field: null, reload: false },
  });
  await page.settle();
  assert.deepStrictEqual(ariaOff(page), [false, false, false]);
  assert.equal(anyDisabled(page), false);
  assert.equal(focused(page), "ctl-pause", "the focus stays");
  assert.deepStrictEqual(resultOf(page), {
    tone: "warn",
    shown: ["server"],
    text: UNCONFIRMED,
  });
  assert.equal(
    page.calls.filter((c) => c.path === api(A)).length,
    getsBefore + 1,
    "a poll at once after the answer",
  );
  // the poll comes: «Пауза» went away (the project is paused) → the goal
  fake.controls[A] = PAUSED;
  const hold = fake.getHold[A];
  fake.getHold[A] = null;
  hold.resolve();
  await page.settle();
  assert.equal(pause.shown, false);
  assert.equal(focused(page), "project-goal");
  // the buttons are available again: a click on «Продолжить» sends
  btn(page, "ctl-resume").click();
  await page.settle();
  assert.equal(posts(page).length, 2);
});

test("CTL-8f (Q10; section 9.3) after any answer the buttons are available again: no answer (no connection) — the constant text «Нет связи с сервером Sai…» (err); a refusal with reload true — its text and «Обновить страницу», which reloads; 2xx — result_text (ok); an answer that comes while the page shows the list is not shown", async () => {
  const fake = fakeServer();
  const page = await openOn(A, fake);
  const control = `${api(A)}/control`;
  // no connection: the fetch of the page throws
  btn(page, "ctl-pause").click();
  await page.settle();
  fake.held[control][0].resolve(
    Promise.reject(new TypeError("Failed to fetch")),
  );
  await page.settle();
  assert.deepStrictEqual(resultOf(page).shown, ["offline"]);
  assert.equal(resultOf(page).tone, "err");
  assert.ok(
    norm(page.byId("control-result").textContent).includes(
      "Нет связи с сервером Sai. Проверьте состояние проекта, когда связь вернётся.",
    ),
  );
  assert.deepStrictEqual(ariaOff(page), [false, false, false]);
  // a key of another start
  btn(page, "ctl-pause").click();
  await page.settle();
  fake.held[control][1].resolve({
    status: 403,
    body: {
      error_text:
        "Sai Team был перезапущен, и эта страница устарела. Обновите страницу и повторите",
      field: null,
      reload: true,
    },
  });
  await page.settle();
  assert.equal(resultOf(page).tone, "err");
  assert.equal(page.byId("control-reload").shown, true);
  page.byId("control-reload").click();
  assert.equal(page.location.reloads, 1);
  // a success
  btn(page, "ctl-pause").click();
  await page.settle();
  assert.equal(page.byId("control-reload").shown, false);
  fake.held[control][2].resolve({
    status: 200,
    body: { result_text: "Отправлено" },
  });
  await page.settle();
  assert.deepStrictEqual(resultOf(page), {
    tone: "ok",
    shown: ["server"],
    text: "Отправлено",
  });
  // the answer comes while the list is on the screen
  btn(page, "ctl-pause").click();
  await page.settle();
  await page.go("");
  fake.held[control][3].resolve({
    status: 409,
    body: { error_text: "Проект уже на паузе", field: null, reload: false },
  });
  await page.settle();
  assert.equal(
    page.byId("control-result").textContent.includes("Проект уже на паузе"),
    false,
  );
  assert.equal(posts(page).length, 4);
});

test("CTL-8h (crit. 8; section 9.2, 9.4, r1 L3, r2 N2) the request of A is not answered, the person goes to B and presses there, then back to A: each project has its own request; a click in A or B while its own request goes on sends nothing; the answer of A takes away only the mark of A; the answer of B — that of B", async () => {
  const fake = fakeServer();
  const page = await openOn(A, fake);
  btn(page, "ctl-pause").click();
  await page.settle();
  assert.equal(posts(page).length, 1);
  // to B, press there
  await page.go(`#/projects/${B}`);
  assert.equal(page.eval("app.project.id"), B);
  assert.deepStrictEqual(ariaOff(page), [false, false, false]);
  btn(page, "ctl-pause").click();
  await page.settle();
  assert.equal(posts(page).length, 2);
  assert.deepStrictEqual(
    posts(page).map((c) => c.path),
    [`${api(A)}/control`, `${api(B)}/control`],
  );
  // back to A: its request still goes on
  await page.go(`#/projects/${A}`);
  assert.equal(page.eval("app.project.id"), A);
  assert.deepStrictEqual(ariaOff(page), [true, true, true]);
  assert.deepStrictEqual(resultOf(page).shown, ["sending"]);
  btn(page, "ctl-pause").click();
  await page.settle();
  assert.equal(posts(page).length, 2, "no second request of A");
  // to B; the answer of A comes
  await page.go(`#/projects/${B}`);
  fake.held[`${api(A)}/control`][0].resolve({
    status: 200,
    body: { result_text: "Отправлено" },
  });
  await page.settle();
  assert.deepStrictEqual(ariaOff(page), [true, true, true], "B still waits");
  assert.deepStrictEqual(resultOf(page).shown, ["sending"]);
  // the next poll of B redraws its buttons from the marks of the requests: the
  // answer of A took away only the mark of A
  await page.advance(5000);
  assert.deepStrictEqual(ariaOff(page), [true, true, true], "B still waits");
  assert.deepStrictEqual(resultOf(page).shown, ["sending"]);
  btn(page, "ctl-pause").click();
  await page.settle();
  assert.equal(posts(page).length, 2, "no second request of B");
  // the answer of B
  fake.held[`${api(B)}/control`][0].resolve({
    status: 409,
    body: { error_text: "Проект уже на паузе", field: null, reload: false },
  });
  await page.settle();
  assert.deepStrictEqual(ariaOff(page), [false, false, false]);
  assert.deepStrictEqual(resultOf(page), {
    tone: "err",
    shown: ["server"],
    text: "Проект уже на паузе",
  });
  // back to A: free
  await page.go(`#/projects/${A}`);
  assert.deepStrictEqual(ariaOff(page), [false, false, false]);
  assert.equal(posts(page).length, 2);
});
