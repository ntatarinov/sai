// Sai Team: the business page (description of the interface docs/design/REQ-011-ui.md
// r3.1; contract of the fields docs/design/REQ-011-team-web.md, sections 5.2-5.7, 6.3, 9).
//
// Rules this file keeps:
// - every constant caption lives in index.html; this file has no letters of the
//   Russian alphabet and only puts the data of the answers into the page, always as
//   text (textContent), never as markup;
// - the addresses of the page and of the requests come only from Link.api of the
//   answers (section 5.2): "#" + api.slice(4) and "/api" + hash.slice(1);
// - the texts of refusals are Failure.error_text; the field message is never read;
// - one request function with the only call of fetch; reads are GET only; a write
//   carries Content-Type application/json and the key of the page in X-Sai-Page.

const REFRESH_MS = 5000;

const API_PREFIX = "/api";
const API_PROJECTS = "/api/projects";
const PROJECT_HASH = "#/projects/";
const NEAR_BOTTOM_PX = 24;
const FAILED_SHOWN = 5;
const RESULTS_SHOWN = 10;
const GOAL_MAX = 2000;
const TEXT_MAX = 4000;
const WIDE_QUERY = "(min-width: 1240px) and (min-height: 640px)";
// The ceiling the page sends as a number: a decimal record only (section 8.1).
const DECIMAL = /^[0-9]+(\.[0-9]+)?$/;

const byId = (id) => document.getElementById(id);

const pageKey =
  document.querySelector('meta[name="sai-page"]')?.getAttribute("content") ??
  "";

// ---- requests ---------------------------------------------------------------------

// The only network call of the page: its own server, by a relative path. Returns
// { status, body } or null when there is no answer the page can read (no
// connection, a stopped server, not an object).
async function request(path, init) {
  let res;
  try {
    res = await window.fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      ...init,
    });
  } catch {
    return null;
  }
  let body;
  try {
    body = await res.json();
  } catch {
    return null;
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  return { status: res.status, body };
}

function post(path, payload) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Sai-Page": pageKey },
    body: JSON.stringify(payload),
  });
}

function isOk(reply) {
  return reply !== null && reply.status >= 200 && reply.status < 300;
}

function errorTextOf(reply) {
  const text = reply?.body?.error_text;
  return typeof text === "string" ? text : null;
}

// ---- small helpers of the page ----------------------------------------------------

function setText(el, value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (el.textContent !== text) el.textContent = text;
}

function setHidden(el, hidden) {
  if (el.hidden !== hidden) el.hidden = hidden;
}

function setAttr(el, name, value) {
  if (value === null || value === undefined) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else if (el.getAttribute(name) !== String(value)) {
    el.setAttribute(name, String(value));
  }
}

function linkHash(link) {
  return `#${link.api.slice(API_PREFIX.length)}`;
}

function setLink(el, link) {
  setAttr(el, "href", link ? linkHash(link) : null);
}

function slot(el, name) {
  return el.querySelector(`[data-slot="${name}"]`);
}

function maker(templateId) {
  const tpl = byId(templateId);
  return () => tpl.content.firstElementChild.cloneNode(true);
}

function codePoints(text) {
  return [...text].length;
}

const pad = (n) => String(n).padStart(2, "0");

function parseTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clock(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fullTime(d) {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${clock(d)}`;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// kind: "clock" (hh:mm), "full" (dd.mm.yyyy, hh:mm) or "chat" (clock today, else full).
function setTime(el, iso, kind) {
  const d = parseTime(iso);
  setAttr(el, "datetime", d === null ? null : iso);
  if (d === null) {
    setText(el, "");
    return;
  }
  if (kind === "clock") setText(el, clock(d));
  else if (kind === "chat" && sameDay(d, new Date())) setText(el, clock(d));
  else setText(el, fullTime(d));
}

// Keeps the children of a container in the order of items, reusing the element of
// the same key: nothing that did not change is redrawn (description 8.4).
function syncList(container, items, keyOf, make, update) {
  const old = new Map();
  for (const el of [...container.children]) old.set(el.dataset.key, el);
  const used = new Set();
  let prev = null;
  for (const item of items) {
    let key = String(keyOf(item));
    while (used.has(key)) key += "+";
    used.add(key);
    let el = old.get(key);
    if (el === undefined) {
      el = make();
      el.dataset.key = key;
    } else {
      old.delete(key);
    }
    update(el, item);
    const next =
      prev === null ? container.firstElementChild : prev.nextElementSibling;
    if (el !== next) container.insertBefore(el, next);
    prev = el;
  }
  for (const el of old.values()) el.remove();
}

function setStatus(el, code, text) {
  setAttr(el, "data-status", typeof code === "string" ? code : "");
  setText(el, text);
}

// The bar of progress: the share done/total, its name is progress_text of the
// server (no percent anywhere, also not for screen reading).
function setBar(el, progress, text) {
  const total =
    progress && Number.isFinite(progress.total) && progress.total > 0
      ? progress.total
      : 1;
  const done =
    progress && Number.isFinite(progress.done)
      ? Math.min(Math.max(progress.done, 0), total)
      : 0;
  if (el.max !== total) el.max = total;
  if (el.value !== done) el.value = done;
  setAttr(el, "aria-label", text);
  setAttr(el, "aria-valuetext", text);
}

function setMark(el, text) {
  setHidden(el, text === null || text === undefined);
  setText(el, text);
}

// ---- state ------------------------------------------------------------------------

const app = {
  route: { kind: "list", project: null, chat: false, card: null },
  gen: 0,
  timer: null,
  list: null,
  listDown: false,
  project: null,
  projectState: "loading", // loading | ok | down | error | notfound
  chatApi: null,
  chat: null,
  chatDown: false,
  // The project refused with a text before it ever loaded: the chat has no address
  // and shows the caption #chat-off (description 8.1).
  chatOff: false,
  chatBottomCount: 0,
  chatFirst: true,
  focusChat: false,
  card: null, // { api, body }
  cardState: "loading", // loading | ok | down | notfound
  opener: null,
  creating: false,
  sending: false,
};

// Address of the page -> screen (section 5.2): "/api" + hash.slice(1), only for an
// address that starts with "#/projects/"; the path of the project is its first three
// parts. The page checks neither the id nor the task nor the number.
function readRoute() {
  const hash = window.location.hash;
  if (!hash.startsWith(PROJECT_HASH)) {
    return { kind: "list", project: null, chat: false, card: null };
  }
  const api = API_PREFIX + hash.slice(1);
  const parts = api.split("/");
  const project = parts.slice(0, 4).join("/");
  const rest = parts.slice(4);
  if (rest.length === 0 || (rest.length === 1 && rest[0] === "")) {
    return { kind: "project", project, chat: false, card: null };
  }
  if (rest.length === 1 && rest[0] === "chat") {
    return { kind: "project", project, chat: true, card: null };
  }
  return { kind: "project", project, chat: false, card: api };
}

// ---- polling (section 9) ----------------------------------------------------------

// One poll is all requests of the screen; the next starts REFRESH_MS after the start
// of the previous one, and not before all its answers came. A new screen polls at once.
// An unexpected error inside a poll is not swallowed: the block of the connection
// shows no connection for this poll, and the polling goes on (section 9).
function poll() {
  window.clearTimeout(app.timer);
  app.gen += 1;
  const gen = app.gen;
  const started = Date.now();
  refresh(gen)
    .catch(() => {
      if (gen === app.gen) setConnection("down");
    })
    .finally(() => {
      if (gen !== app.gen) return;
      const wait = Math.max(0, started + REFRESH_MS - Date.now());
      app.timer = window.setTimeout(poll, wait);
    });
}

async function refresh(gen) {
  const outcome = { down: false, errors: [] };
  const route = app.route;
  if (route.kind === "list") {
    const reply = await request(API_PROJECTS);
    if (gen !== app.gen) return;
    applyList(reply, outcome);
  } else {
    await Promise.all([
      refreshProject(gen, route, outcome),
      route.card === null ? null : refreshCard(gen, route, outcome),
    ]);
    if (gen !== app.gen) return;
  }
  setConnection(outcome.down ? "down" : "live");
  showErrorBar(outcome.errors.length > 0 ? outcome.errors[0] : null);
}

// "ok", "notfound", "error" (a refusal with its text) or "down".
function classify(reply, outcome) {
  if (reply === null) {
    outcome.down = true;
    return "down";
  }
  if (isOk(reply)) return "ok";
  if (reply.status === 404) return "notfound";
  const text = errorTextOf(reply);
  if (text === null) {
    outcome.down = true;
    return "down";
  }
  outcome.errors.push(text);
  return "error";
}

// Rendering an answer the page cannot read counts as no connection (description 2.1).
function safely(outcome, fn) {
  try {
    fn();
  } catch {
    outcome.down = true;
  }
}

// ---- connection and error bar -------------------------------------------------------

// The state of the connection lives only in the markup of its block (section 13).
function setConnection(state) {
  const box = byId("link");
  setAttr(box, "data-state", state);
  for (const el of box.querySelectorAll("[data-when]")) {
    setHidden(el, el.dataset.when !== state);
  }
}

function showErrorBar(text) {
  setHidden(byId("error-bar"), text === null);
  setText(byId("error-text"), text);
}

// ---- screens ------------------------------------------------------------------------

function renderScreens() {
  const route = app.route;
  const notFound = route.kind === "project" && app.projectState === "notfound";
  setHidden(byId("screen-list"), route.kind !== "list");
  setHidden(byId("screen-project"), route.kind !== "project" || notFound);
  setHidden(byId("screen-notfound"), !notFound);
  setHidden(byId("back"), route.kind !== "project");
}

// ---- list of projects (description 3) ---------------------------------------------

function applyList(reply, outcome) {
  const kind = classify(reply, outcome);
  if (kind === "ok") {
    safely(outcome, () => {
      if (!Array.isArray(reply.body.projects)) throw new Error("shape");
      app.list = reply.body.projects;
      app.listDown = false;
      renderList();
    });
  } else if (kind === "down" && app.list === null) {
    app.listDown = true;
    renderList();
  }
}

const makeProject = maker("tpl-project");
const makeBroken = maker("tpl-project-broken");

function renderList() {
  const list = app.list;
  setHidden(byId("projects-loading"), list !== null || app.listDown);
  setHidden(byId("projects-down"), list !== null || !app.listDown);
  setHidden(byId("projects-empty"), list === null || list.length > 0);
  const count = byId("projects-count");
  setHidden(count, list === null || list.length === 0);
  setText(count, list === null ? "" : list.length);
  const ul = byId("projects");
  syncList(
    ul,
    list ?? [],
    (p) => `${p.broken === true ? "b" : "p"}:${p.id}`,
    () => makeProjectRow(),
    updateProjectRow,
  );
}

// The template is chosen at update time: an element is never reused across kinds,
// because the key holds the kind.
function makeProjectRow() {
  const holder = document.createElement("li");
  holder.className = "pcard-holder";
  return holder;
}

function updateProjectRow(li, p) {
  if (li.firstElementChild === null) {
    const inner = (p.broken === true ? makeBroken : makeProject)();
    while (inner.firstChild) li.appendChild(inner.firstChild);
  }
  if (p.broken === true) {
    setText(slot(li, "id"), p.id);
    setAttr(slot(li, "id"), "title", p.id);
    setText(slot(li, "problem"), p.problem_text);
    return;
  }
  const a = li.querySelector("a.pcard");
  setLink(a, p.link);
  setText(slot(li, "goal"), p.goal);
  setAttr(slot(li, "goal"), "title", p.goal);
  setStatus(slot(li, "status"), p.status, p.status_text);
  setText(slot(li, "progress"), p.progress_text);
  setBar(slot(li, "bar"), p.progress, p.progress_text);
  setMark(slot(li, "decision"), p.needs_decision_text);
  setMark(slot(li, "test"), p.test_executor_text);
  setHidden(
    slot(li, "marks"),
    p.needs_decision_text === null && p.test_executor_text === null,
  );
  setTime(slot(li, "created"), p.created_at, "full");
}

// ---- new project (description 4) ---------------------------------------------------

const goalField = byId("goal");
const budgetField = byId("budget");
const createButton = byId("create");

function updateCreateForm() {
  const n = codePoints(goalField.value);
  const count = byId("goal-count");
  setText(slot(count, "n"), n);
  setAttr(count, "data-over", n > GOAL_MAX ? "true" : "false");
  createButton.disabled =
    app.creating ||
    goalField.value.length === 0 ||
    budgetField.value.trim().length === 0;
  setBusy(createButton, app.creating);
  goalField.readOnly = app.creating;
  budgetField.readOnly = app.creating;
}

function setBusy(button, busy) {
  for (const el of button.querySelectorAll("[data-when]")) {
    setHidden(el, el.dataset.when !== (busy ? "busy" : "idle"));
  }
}

// One result line: which message shows ("server", "offline", "sending" or null),
// the text of the server and the tone of the colour.
function setResult(box, which, text, tone) {
  for (const el of box.querySelectorAll("[data-msg]")) {
    setHidden(el, el.dataset.msg !== which);
    if (el.dataset.msg === "server")
      setText(el, which === "server" ? text : "");
  }
  setAttr(box, "data-tone", which === null ? "none" : tone);
}

function markInvalid(field, invalid, describedBy) {
  setAttr(field, "aria-invalid", invalid ? "true" : null);
  setAttr(field, "aria-describedby", invalid ? describedBy : null);
}

function clearCreateMarks() {
  markInvalid(goalField, false);
  markInvalid(budgetField, false);
}

function resetCreateResult() {
  setResult(byId("create-result"), null, null, null);
  setHidden(byId("create-open"), true);
  setHidden(byId("create-reload"), true);
  clearCreateMarks();
}

async function submitCreate() {
  if (createButton.disabled) return;
  resetCreateResult();
  app.creating = true;
  updateCreateForm();
  // A number only for a decimal record (section 8.1): "0x10", "1e2", "+5", ".5"
  // or "5." go as null, and the server answers with the text of the ceiling.
  const budgetText = budgetField.value.trim().replace(",", ".");
  const reply = await post(API_PROJECTS, {
    goal: goalField.value,
    budget_usd: DECIMAL.test(budgetText) ? Number(budgetText) : null,
  });
  app.creating = false;
  const result = byId("create-result");
  if (isOk(reply) && reply.body.project && reply.body.project.link) {
    goalField.value = "";
    budgetField.value = "";
    updateCreateForm();
    if (reply.body.started === true) {
      window.location.hash = linkHash(reply.body.project.link);
      return;
    }
    setResult(result, "server", reply.body.result_text, "warn");
    const open = byId("create-open");
    setLink(open, reply.body.project.link);
    setHidden(open, false);
    poll();
    return;
  }
  updateCreateForm();
  const text = errorTextOf(reply);
  if (reply === null || text === null) {
    setResult(result, "offline", null, "err");
    goalField.focus();
    return;
  }
  setResult(result, "server", text, "err");
  if (reply.body.reload === true) {
    setHidden(byId("create-reload"), false);
  }
  const field = reply.body.field;
  if (field === "goal") {
    markInvalid(goalField, true, "create-result");
    goalField.focus();
  } else if (field === "budget_usd") {
    markInvalid(budgetField, true, "create-result");
    budgetField.focus();
  } else {
    createButton.focus();
  }
}

// ---- project page (description 5) -------------------------------------------------

// The address of the chat comes only from the answer of the project (section 9):
// the first poll of the screen asks for the chat after the project answered 200;
// every next poll asks for the project and the chat at once, and drops the answer
// of the chat when the project is not found.
async function refreshProject(gen, route, outcome) {
  const knownChat = app.chatApi;
  const [reply, earlyChat] = await Promise.all([
    request(route.project),
    knownChat === null ? null : request(knownChat),
  ]);
  if (gen !== app.gen) return;
  const kind = classify(reply, outcome);
  if (kind === "ok") {
    safely(outcome, () => {
      app.project = reply.body;
      app.projectState = "ok";
      app.chatApi = reply.body.links.chat.api;
      app.chatOff = false;
      renderProject();
    });
  } else if (kind === "notfound") {
    app.projectState = "notfound";
    renderProject();
  } else if (app.project === null) {
    // Nothing loaded yet and the chat is not asked (no address): the chat says what
    // the project got — no connection, or unavailable after a refusal with a text
    // (description 8.1); never the loading caption for ever.
    app.projectState = kind;
    if (app.chat === null) {
      app.chatDown = kind === "down";
      app.chatOff = kind === "error";
    }
    renderProject();
  }
  if (kind === "notfound") return;
  let chatReply = earlyChat;
  if (knownChat === null) {
    if (kind !== "ok" || app.chatApi === null) return;
    chatReply = await request(app.chatApi);
    if (gen !== app.gen) return;
  }
  const chatKind = classify(chatReply, outcome);
  if (chatKind === "ok") {
    safely(outcome, () => {
      if (!Array.isArray(chatReply.body.messages)) throw new Error("shape");
      app.chat = chatReply.body.messages;
      app.chatDown = false;
      renderChat(false);
    });
  } else if (chatKind === "down" && app.chat === null) {
    app.chatDown = true;
    renderChat(false);
  }
}

function resetProject() {
  app.project = null;
  app.projectState = "loading";
  app.chatApi = null;
  app.chat = null;
  app.chatDown = false;
  app.chatOff = false;
  app.chatFirst = true;
  app.chatBottomCount = 0;
  byId("chat-text").value = "";
  setResult(byId("chat-result"), null, null, null);
  setHidden(byId("chat-reload"), true);
  markInvalid(byId("chat-text"), false);
}

const makePhrase = maker("tpl-phrase");
const makeBusy = maker("tpl-busy");
const makeFailed = maker("tpl-failed");
const makeResult = maker("tpl-result");
const makeTask = maker("tpl-task");

function renderProject() {
  renderScreens();
  const state = app.projectState;
  const p = app.project;
  const loading = p === null;
  const body = byId("project-body");
  setHidden(byId("project-down"), !(loading && state === "down"));
  // No project loaded and the first poll failed: only the text of the failure (or
  // the error bar), no empty frame of the head, the six answers and the tasks.
  const blank = loading && (state === "down" || state === "error");
  for (const el of body.querySelectorAll("[data-frame]")) {
    setHidden(el, blank);
  }
  for (const el of body.querySelectorAll("[data-loading]")) {
    setHidden(el, !loading || blank);
  }
  for (const el of body.querySelectorAll("[data-body]")) {
    setHidden(el, loading);
  }
  if (loading) {
    renderChat(false);
    return;
  }
  renderHead(p);
  renderAnswers(p);
  renderTasks(byId("tasks"), p.tasks);
  const tasksEmpty = byId("tasks-empty");
  setHidden(tasksEmpty, p.tasks.length > 0 || p.tasks_empty_text === null);
  setText(tasksEmpty, p.tasks.length > 0 ? null : p.tasks_empty_text);
}

function renderHead(p) {
  setText(byId("project-goal"), p.goal);
  setStatus(byId("project-status"), p.status, p.status_text);
  setText(byId("project-progress"), p.progress_text);
  setBar(byId("project-bar"), p.progress, p.progress_text);
  setTime(byId("project-created"), p.created_at, "full");
  setMark(byId("project-decision"), p.needs_decision_text);
  setMark(byId("project-test"), p.test_executor_text);
  const pause = byId("project-pause");
  setHidden(pause, p.pause_text === null);
  setText(pause, p.pause_text);
  const tail = byId("project-tail");
  setHidden(tail, p.tail_text === null);
  setText(tail, p.tail_text);
}

function renderAnswers(p) {
  // (1) what is going on
  syncList(
    byId("happening"),
    p.happening,
    (ph) => `${ph.at}|${ph.text}`,
    makePhrase,
    (li, ph) => {
      setTime(slot(li, "at"), ph.at, "clock");
      setText(slot(li, "text"), ph.text);
    },
  );
  setHidden(byId("happening-empty"), p.happening.length > 0);

  // (2) who is busy
  syncList(
    byId("busy"),
    p.busy,
    (r) => r.n,
    makeBusy,
    (li, r) => {
      const a = slot(li, "role");
      setLink(a, r.link);
      setText(a, r.title);
    },
  );
  setHidden(byId("busy-empty"), p.busy.length > 0);

  // (3) when it will be ready
  setText(byId("due"), p.due_text);

  // (4) is there a problem
  const failed = p.problems.failed;
  const waitingText = p.problems.waiting_text;
  const waiting = byId("waiting-text");
  setHidden(waiting, waitingText === null);
  setText(waiting, waitingText);
  syncList(
    byId("failed"),
    failed.slice(0, FAILED_SHOWN),
    (t) => t.id,
    makeFailed,
    (li, t) => {
      setLink(slot(li, "link"), t.link);
      setText(slot(li, "role"), t.role.title);
      setText(slot(li, "text"), t.text);
      const reason = slot(li, "reason");
      setHidden(reason, t.reason_text === null);
      setText(reason, t.reason_text);
    },
  );
  setMore(byId("failed-more"), failed.length - FAILED_SHOWN);
  const problem = failed.length > 0 || waitingText !== null;
  setHidden(byId("problems-none"), problem);
  setAttr(byId("answer-problems"), "data-alert", problem ? "err" : "none");

  // (5) is anything needed from me
  const waits = p.waits;
  const some = waits.count > 0;
  const count = byId("waits-count");
  setText(count, waits.count_text);
  setAttr(count, "data-some", some ? "true" : "false");
  setHidden(byId("to-questions"), !some);
  const note = byId("waits-note");
  setHidden(note, !some || waits.note_text === null);
  setText(note, waits.note_text);
  setAttr(byId("answer-waits"), "data-alert", some ? "violet" : "none");

  // (6) result
  const results = p.results;
  syncList(
    byId("results"),
    results.slice(0, RESULTS_SHOWN),
    (r) => `${r.name}|${r.task}`,
    makeResult,
    (li, r) => {
      setText(slot(li, "name"), r.name);
      // The server sends only the files with a task (design REQ-011, section
      // 7.1 (6)): every row has a link and a role.
      setText(slot(li, "task"), r.task_text);
      setAttr(slot(li, "task"), "title", r.task_text);
      setLink(slot(li, "task"), r.link);
      setLink(slot(li, "role"), r.role.link);
      setText(slot(li, "role"), r.role.title);
    },
  );
  setMore(byId("results-more"), results.length - RESULTS_SHOWN);
  setHidden(byId("results-empty"), results.length > 0);
}

function setMore(el, extra) {
  setHidden(el, extra <= 0);
  setText(slot(el, "n"), extra > 0 ? extra : "");
}

function renderTasks(ul, tasks) {
  syncList(
    ul,
    tasks,
    (t) => t.id,
    makeTask,
    (li, t) => {
      setLink(li.querySelector("a.trow"), t.link);
      setText(slot(li, "role"), t.role.title);
      setStatus(slot(li, "status"), t.status, t.status_text);
      setText(slot(li, "text"), t.text);
      setAttr(slot(li, "text"), "title", t.text);
      const reason = slot(li, "reason");
      setHidden(reason, t.reason_text === null);
      setText(reason, t.reason_text);
    },
  );
}

// "Go to the questions": the message of chat_n of the first waiting question, or
// the end of the list when there is none (description 5.7).
function goToQuestions() {
  const list = byId("chat-list");
  const first = app.project?.waits?.questions?.[0];
  const n = first && Number.isInteger(first.chat_n) ? first.chat_n : null;
  const target =
    n === null
      ? null
      : list.querySelector(`li[data-key="${CSS.escape(String(n))}"]`);
  if (target === null) {
    list.scrollTop = list.scrollHeight;
    list.scrollIntoView({ block: "nearest" });
    list.focus();
    return;
  }
  target.scrollIntoView({ block: "nearest" });
  target.focus();
}

// ---- chat (description 6) ----------------------------------------------------------

const makeMessage = maker("tpl-message");
const chatText = byId("chat-text");
const sendButton = byId("chat-send");

function isNearBottom(list) {
  return (
    list.scrollHeight - list.scrollTop - list.clientHeight <= NEAR_BOTTOM_PX
  );
}

function renderChat(forceBottom) {
  const list = byId("chat-list");
  const messages = app.chat;
  const off = messages === null && !app.chatDown && app.chatOff;
  setHidden(
    byId("chat-loading"),
    messages !== null || app.chatDown || app.chatOff,
  );
  setHidden(byId("chat-down"), messages !== null || !app.chatDown);
  setHidden(byId("chat-off"), !off);
  setHidden(byId("chat-form"), off);
  setHidden(byId("chat-empty"), messages === null || messages.length > 0);
  updateChatForm();
  if (messages === null) {
    syncList(
      list,
      [],
      () => "",
      makeMessage,
      () => {},
    );
    setHidden(byId("chat-new"), true);
    return;
  }
  const atBottom = app.chatFirst || forceBottom || isNearBottom(list);
  syncList(list, messages, (m) => m.n, makeMessage, updateMessage);
  if (atBottom) {
    list.scrollTop = list.scrollHeight;
    app.chatBottomCount = messages.length;
  }
  const unseen = messages.length - app.chatBottomCount;
  const newButton = byId("chat-new");
  setHidden(newButton, unseen <= 0);
  setText(slot(newButton, "n"), unseen > 0 ? unseen : "");
  if (app.chatFirst) {
    app.chatFirst = false;
    if (app.focusChat) {
      app.focusChat = false;
      chatText.focus();
    }
  }
}

function updateMessage(li, m) {
  setAttr(li, "data-from", m.from === "user" ? "user" : "team");
  setAttr(li, "data-question", m.question === true ? "true" : "false");
  setAttr(li, "data-open", m.open === true ? "true" : "false");
  setText(slot(li, "author"), m.author_text);
  setTime(slot(li, "at"), m.at, "chat");
  // The label "shortened" is the muted one: only when the message is truncated,
  // and only the last label (section 13); the page does not guess the order.
  const labels = Array.isArray(m.labels_text) ? m.labels_text : [];
  const last = labels.length - 1;
  syncList(
    slot(li, "labels"),
    labels.map((text, i) => ({
      text,
      muted: m.truncated === true && i === last,
    })),
    (l) => l.text,
    () => {
      const span = document.createElement("span");
      span.className = "label";
      return span;
    },
    (span, l) => {
      setText(span, l.text);
      setAttr(span, "data-muted", l.muted ? "true" : "false");
    },
  );
  setText(slot(li, "text"), m.text);
  const task = slot(li, "task");
  setHidden(task, m.task === null || m.task === undefined);
  if (m.task) {
    setLink(task, m.task.link);
    setText(slot(task, "task-role"), m.task.role_title);
    setText(slot(task, "task-text"), m.task.text);
  } else {
    setLink(task, null);
  }
}

function updateChatForm() {
  const n = codePoints(chatText.value);
  const count = byId("chat-count");
  setText(slot(count, "n"), n);
  setAttr(count, "data-over", n > TEXT_MAX ? "true" : "false");
  sendButton.disabled =
    app.sending || app.chat === null || !/\S/u.test(chatText.value);
  setBusy(sendButton, app.sending);
  chatText.readOnly = app.sending;
}

async function submitChat() {
  if (sendButton.disabled || app.chatApi === null) return;
  const api = app.chatApi;
  const result = byId("chat-result");
  setHidden(byId("chat-reload"), true);
  markInvalid(chatText, false);
  app.sending = true;
  updateChatForm();
  setResult(result, "sending", null, "muted");
  const reply = await post(api, { text: chatText.value });
  app.sending = false;
  if (api !== app.chatApi) {
    // The page went to another project meanwhile: nothing to show here.
    updateChatForm();
    return;
  }
  if (isOk(reply)) {
    chatText.value = "";
    updateChatForm();
    setResult(result, "server", reply.body.result_text, "ok");
    const message = reply.body.message;
    if (
      message &&
      app.chat !== null &&
      !app.chat.some((m) => m.n === message.n)
    ) {
      app.chat = [...app.chat, message];
    }
    if (app.chat !== null) renderChat(true);
    return;
  }
  updateChatForm();
  const text = errorTextOf(reply);
  if (reply === null || text === null) {
    setResult(result, "offline", null, "err");
  } else {
    setResult(result, "server", text, reply.status === 504 ? "warn" : "err");
    if (reply.body.reload === true) setHidden(byId("chat-reload"), false);
    if (reply.body.field === "text") markInvalid(chatText, true, "chat-result");
  }
  chatText.focus();
}

// ---- cards over the page (description 7) ------------------------------------------

async function refreshCard(gen, route, outcome) {
  const reply = await request(route.card);
  if (gen !== app.gen || app.route.card !== route.card) return;
  const kind = classify(reply, outcome);
  if (kind === "ok") {
    safely(outcome, () => {
      app.card = { api: route.card, body: reply.body };
      app.cardState = "ok";
      renderCard();
    });
  } else if (kind === "notfound") {
    app.card = null;
    app.cardState = "notfound";
    renderCard();
  } else if (kind === "down" && app.card === null) {
    app.cardState = "down";
    renderCard();
  }
}

const makeFile = maker("tpl-file");

function projectHashOfRoute() {
  return `#${app.route.project.slice(API_PREFIX.length)}`;
}

function renderCard() {
  const open = app.route.kind === "project" && app.route.card !== null;
  const overlay = byId("overlay");
  setHidden(overlay, !open);
  document.body.classList.toggle("locked", open);
  byId("top").inert = open;
  byId("screen-project").inert = open;
  byId("error-bar").inert = open;
  if (!open) return;
  const state = app.cardState;
  const body = app.card?.body ?? null;
  const isTask = state === "ok" && body !== null && body.task !== undefined;
  const isRole = state === "ok" && body !== null && body.role !== undefined;
  setHidden(byId("card-loading"), state !== "loading");
  setHidden(byId("card-down"), state !== "down");
  setHidden(byId("card-task"), !isTask);
  setHidden(byId("card-role"), !isRole);
  setHidden(byId("card-notfound"), state !== "notfound");
  const card = byId("card");
  if (isTask) {
    setAttr(card, "aria-labelledby", "card-task-title");
    renderTaskCard(body);
  } else if (isRole) {
    setAttr(card, "aria-labelledby", "card-role-title");
    renderRoleCard(body);
  } else if (state === "notfound") {
    setAttr(card, "aria-labelledby", "card-notfound-title");
    setAttr(byId("card-notfound-project"), "href", projectHashOfRoute());
  }
}

function renderTaskCard(body) {
  const t = body.task;
  setText(byId("card-task-title"), t.text);
  setStatus(byId("card-task-status"), t.status, t.status_text);
  const reason = byId("card-task-reason");
  setHidden(reason, t.reason_text === null);
  setText(reason, t.reason_text);
  setText(byId("card-task-done"), t.done_when);
  const role = byId("card-task-role");
  setLink(role, t.role.link);
  setText(role, t.role.title);
  const files = Array.isArray(t.files) ? t.files : [];
  syncList(
    byId("card-task-files"),
    files,
    (f) => f,
    makeFile,
    (li, f) => setText(li, f),
  );
  setHidden(byId("card-task-nofiles"), files.length > 0);
  setLink(byId("card-task-project"), body.project.link);
  setText(byId("card-task-goal"), body.project.goal);
  setAttr(byId("card-task-goal"), "title", body.project.goal);
}

function renderRoleCard(body) {
  setText(byId("card-role-title"), body.role.title);
  setText(byId("card-role-description"), body.role.description);
  renderTasks(byId("card-role-tasks"), body.tasks);
  setHidden(byId("card-role-notasks"), body.tasks.length > 0);
  setLink(byId("card-role-project"), body.project.link);
  setText(byId("card-role-goal"), body.project.goal);
  setAttr(byId("card-role-goal"), "title", body.project.goal);
}

function closeCard() {
  const link = app.card?.body?.project?.link;
  window.location.hash = link ? linkHash(link) : projectHashOfRoute();
}

// Tab stays inside the open card.
function trapFocus(event) {
  const card = byId("card");
  const items = [
    ...card.querySelectorAll("a[href], button:not([disabled]), [tabindex='0']"),
  ].filter((el) => el.getClientRects().length > 0);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  } else if (!card.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  }
}

// After the card closes the focus goes back to the link that opened it, or to the
// title of the project.
function restoreFocus() {
  const href = app.opener;
  app.opener = null;
  const panel = byId("screen-project");
  const back =
    href === null ? null : panel.querySelector(`a[href="${CSS.escape(href)}"]`);
  if (back !== null && back.getClientRects().length > 0) back.focus();
  else byId("project-goal").focus();
}

// ---- routing --------------------------------------------------------------------------

function onRoute() {
  const prev = app.route;
  const active = document.activeElement;
  const openerHref =
    active instanceof HTMLAnchorElement ? active.getAttribute("href") : null;
  const next = readRoute();
  app.route = next;
  const projectChanged =
    next.kind !== prev.kind || next.project !== prev.project;
  if (projectChanged && next.kind === "project") resetProject();
  if (next.card !== prev.card || projectChanged) {
    app.card = null;
    app.cardState = "loading";
  }
  if (next.chat) app.focusChat = true;
  if (next.card !== null && prev.card === null) app.opener = openerHref;
  renderScreens();
  if (next.kind === "list") {
    renderList();
  } else {
    renderProject();
    renderChat(false);
  }
  renderCard();
  if (next.card !== null && next.card !== prev.card) {
    byId("card-close").focus();
  } else if (prev.card !== null && next.card === null && !projectChanged) {
    restoreFocus();
  }
  if (next.chat && app.chat !== null) {
    app.focusChat = false;
    chatText.focus();
  }
  poll();
}

// ---- layout ---------------------------------------------------------------------------

// The wide layout keeps the projects left of the form and the chat right of the
// project; the narrow one puts the form first and the chat before "all tasks", so the
// order of Tab follows the screen (description 1.6, 9.4).
function applyLayout(wide) {
  const listScreen = byId("screen-list");
  const create = byId("create-panel");
  const projects = byId("projects-panel");
  if (wide) listScreen.insertBefore(projects, create);
  else listScreen.insertBefore(create, projects);
  const chat = byId("chat-panel");
  if (wide) byId("screen-project").appendChild(chat);
  else byId("project-body").insertBefore(chat, byId("tasks-section"));
  const list = byId("chat-list");
  list.scrollTop = list.scrollHeight;
}

// ---- start ----------------------------------------------------------------------------

function start() {
  const wide = window.matchMedia(WIDE_QUERY);
  applyLayout(wide.matches);
  wide.addEventListener("change", (e) => applyLayout(e.matches));

  byId("create-form").addEventListener("submit", (e) => {
    e.preventDefault();
    submitCreate();
  });
  goalField.addEventListener("input", () => {
    resetCreateResult();
    updateCreateForm();
  });
  budgetField.addEventListener("input", () => {
    markInvalid(budgetField, false);
    updateCreateForm();
  });
  byId("create-open").addEventListener("click", () => resetCreateResult());
  byId("create-reload").addEventListener("click", () =>
    window.location.reload(),
  );

  byId("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    submitChat();
  });
  chatText.addEventListener("input", () => {
    if (!app.sending) {
      setResult(byId("chat-result"), null, null, null);
      markInvalid(chatText, false);
    }
    updateChatForm();
  });
  chatText.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submitChat();
    }
  });
  byId("chat-reload").addEventListener("click", () => window.location.reload());
  const list = byId("chat-list");
  list.addEventListener("scroll", () => {
    if (app.chat !== null && isNearBottom(list)) {
      app.chatBottomCount = app.chat.length;
      setHidden(byId("chat-new"), true);
    }
  });
  byId("chat-new").addEventListener("click", () => {
    list.scrollTop = list.scrollHeight;
    if (app.chat !== null) app.chatBottomCount = app.chat.length;
    setHidden(byId("chat-new"), true);
    list.focus();
  });
  byId("to-questions").addEventListener("click", goToQuestions);

  byId("card-close").addEventListener("click", closeCard);
  byId("overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeCard();
  });
  document.addEventListener("keydown", (e) => {
    if (byId("overlay").hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeCard();
    } else if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  window.addEventListener("hashchange", onRoute);
  app.route = { kind: "list", project: null, chat: false, card: null };
  updateCreateForm();
  onRoute();
}

start();
