// REQ-011, criterion 7 (design REQ-011, section 6): every text «for display» the
// server forms — on fixtures in every status of a project and of a task, the texts
// of every refusal included — and the visible text of public/*.html have no
// technical word, no code of a status, a role or an error and no percent sign; the
// code of the page has no Cyrillic; the text of the user and of the agents is
// given as is (WEB-7a…WEB-7d).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { TeamError } from "../src/team/errors.js";
import { ROLE_CODES } from "../src/team/roles.js";
import { PROJECT_STATUS, TASK_STATUS } from "../src/team/schema.js";
import { replay } from "../src/team/reducer.js";
import { chatFailure } from "../src/web/api.js";
import {
  TEXT,
  WHY_NOT_STARTED,
  WHY_OTHER,
  createdNotStarted,
  dueIn,
  progressOf,
  waitsCount,
} from "../src/web/texts.js";
import { journal } from "./exec-helpers.js";
import {
  AGENT_TEXT,
  ROLE_NUMBERS,
  projectsInEveryStatus,
} from "./team-web-fixtures.js";
import {
  PUBLIC_DIR,
  fakeEngines,
  planTask,
  project,
  startServer,
  technical as technicalWords,
  webSandbox,
  withPlan,
} from "./team-web-helpers.js";

const CODES = [...PROJECT_STATUS, ...TASK_STATUS, ...ROLE_CODES];
const technical = (text) => technicalWords(text, CODES);

// The fields «for display» (section 5.3, marked (п)) of an answer, with their path.
const DISPLAY_KEYS = new Set([
  "status_text",
  "progress_text",
  "needs_decision_text",
  "test_executor_text",
  "problem_text",
  "pause_text",
  // (REQ-035, design section 4) the line of a stopped project; the list is
  // extended, never cut (criterion 9 of REQ-035).
  "stopped_text",
  "tail_text",
  "due_text",
  "waiting_text",
  "count_text",
  "note_text",
  "tasks_empty_text",
  "reason_text",
  "error_text",
  "result_text",
  "author_text",
  "role_title",
  "title",
  "description",
]);

function displayTexts(value, at = "$", out = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => displayTexts(v, `${at}[${i}]`, out));
    return out;
  }
  if (value === null || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value)) {
    const where = `${at}.${k}`;
    if (DISPLAY_KEYS.has(k) && typeof v === "string") out.push([where, v]);
    else if (k === "labels_text")
      v.forEach((x, i) => out.push([`${where}[${i}]`, x]));
    else if (k === "happening")
      v.forEach((x, i) => out.push([`${where}[${i}].text`, x.text]));
    else displayTexts(v, where, out);
  }
  return out;
}

function assertClean(json, what) {
  const texts = displayTexts(json);
  for (const [at, text] of texts) {
    assert.deepStrictEqual(technical(text), [], `${what} ${at}: ${text}`);
  }
  return texts.length;
}

test("WEB-7a the texts «for display» of every answer on projects in every status of a project and of a task, and of every refusal, are plain words", async (t) => {
  const box = webSandbox(t);
  const all = projectsInEveryStatus(t, box);
  assert.deepStrictEqual(
    all.map(([, p]) => replay(journal(p)).status),
    all.map(([status]) => status),
  );
  assert.deepStrictEqual(
    all.map(([s]) => s).sort(),
    [...PROJECT_STATUS].sort(),
  );
  const taskStatuses = new Set(
    all.flatMap(([, p]) => replay(journal(p)).tasks.map((x) => x.status)),
  );
  assert.deepStrictEqual([...taskStatuses].sort(), [...TASK_STATUS].sort());
  const s = await startServer(t, box);
  let count = 0;
  count += assertClean((await s.get("/api/projects")).json, "list");
  for (const [status, p] of all) {
    for (const pth of [`/api/projects/${p.id}`, `/api/projects/${p.id}/chat`]) {
      const r = await s.get(pth);
      assert.equal(r.status, 200);
      count += assertClean(r.json, `${status} ${pth}`);
    }
    for (const task of replay(journal(p)).tasks) {
      const r = await s.get(`/api/projects/${p.id}/tasks/${task.id}`);
      count += assertClean(r.json, `${status} ${task.id}`);
    }
    for (const n of ROLE_NUMBERS) {
      const r = await s.get(`/api/projects/${p.id}/roles/${n}`);
      count += assertClean(r.json, `${status} role ${n}`);
    }
  }
  assert.ok(count > 200, `${count} texts checked`);
  // the refusals over HTTP
  const target = all[0][1];
  const key = await s.key();
  const refusals = [
    await s.request({ path: "/api/projects", headers: { Host: "evil.test" } }),
    await s.post(
      "/api/projects",
      { goal: "x", budget_usd: 1 },
      { key, headers: { Origin: "http://evil.test" } },
    ),
    await s.post(
      "/api/projects",
      { goal: "x", budget_usd: 1 },
      { key: "a".repeat(64) },
    ),
    await s.post("/api/projects", "{", { key }),
    await s.post("/api/projects", { goal: "", budget_usd: 1 }, { key }),
    await s.post(
      "/api/projects",
      { goal: "ж".repeat(2001), budget_usd: 1 },
      { key },
    ),
    await s.post("/api/projects", { goal: "x", budget_usd: 0 }, { key }),
    await s.post(`/api/projects/${target.id}/chat`, { text: "" }, { key }),
    await s.post(
      `/api/projects/${target.id}/chat`,
      { text: "ж".repeat(4001) },
      { key },
    ),
    await s.post(
      `/api/projects/${target.id}/chat`,
      JSON.stringify({ text: "ж".repeat(40000) }),
      { key },
    ),
    await s.get("/api/projects/p-20990101-a1b2c3"),
    await s.request({ method: "PUT", path: "/api/projects" }),
  ];
  for (const r of refusals) {
    assert.ok(r.status >= 400, String(r.status));
    assertClean(r.json, `refusal ${r.status}`);
  }
  // the refusals of the chat (every code of section 10) and of a start
  const ctx = { warn: () => {} };
  for (const code of [
    "E_EVENT",
    "E_TOO_LONG",
    "E_MSG_TOO_BIG",
    "E_USAGE",
    "E_PROJECT_BUSY",
    "E_CHANNEL_TIMEOUT",
    "E_CHANNEL_UNCONFIRMED",
    "E_CHANNEL_STALE",
    "E_ENGINE_STOPPING",
    "E_CHANNEL_DROPPED",
    "E_CHANNEL_FULL",
    "E_CHANNEL",
    "E_CHANNEL_BAD",
    "E_DISK",
    "E_CORRUPT",
    "E_NOT_FOUND",
    "E_SOMETHING_NEW",
  ]) {
    assertClean(chatFailure(ctx, new TeamError(code, "x")).body, code);
  }
  for (const why of [...Object.values(WHY_NOT_STARTED), WHY_OTHER]) {
    assert.deepStrictEqual(technical(createdNotStarted(why)), [], why);
  }
});

test("WEB-7a every constant text and every text function of texts.js is plain words (the source of all texts the server forms)", () => {
  const texts = [
    ...Object.values(TEXT),
    ...Object.values(WHY_NOT_STARTED),
    WHY_OTHER,
    progressOf(2, 5),
    dueIn(12),
    waitsCount(3),
    createdNotStarted(WHY_OTHER),
  ];
  assert.ok(texts.length >= 50);
  for (const text of texts) {
    assert.deepStrictEqual(technical(text), [], text);
  }
  // the checker itself sees each kind of word
  for (const bad of [
    "Ошибка JSON",
    "токен устарел",
    "stdout пуст",
    "статус running",
    "роль researcher",
    "код E_DISK",
    "50%",
    "seq 4",
  ]) {
    assert.notDeepStrictEqual(technical(bad), [], bad);
  }
  assert.deepStrictEqual(technical("Сообщение не подтверждено"), []);
});

function visibleText(html) {
  let body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const attrs = [];
  for (const m of body.matchAll(
    /\s(title|alt|placeholder|aria-label|label|value)="([^"]*)"/g,
  )) {
    attrs.push(m[2]);
  }
  body = body.replace(/<[^>]*>/g, " ");
  return [body, ...attrs].join(" ");
}

test("WEB-7b the visible text of public/*.html (text between tags, title, alt, placeholder, aria-label, label, value) has no technical word and no percent; HTML has no inline style and no % at all", () => {
  const files = fs.readdirSync(PUBLIC_DIR).filter((f) => f.endsWith(".html"));
  assert.ok(files.length >= 1);
  for (const f of files) {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, f), "utf8");
    const visible = visibleText(html);
    assert.ok(visible.includes("Новый проект"), "the captions are found");
    assert.ok(visible.includes("Например: подготовить план открытия кофейни"));
    assert.deepStrictEqual(technical(visible), [], f);
    assert.equal(html.includes("%"), false, f);
    assert.doesNotMatch(html, /\sstyle=/, f);
    assert.doesNotMatch(html, /<style/i, f);
  }
  // the extractor sees an attribute and hides a comment
  assert.deepStrictEqual(technical(visibleText('<p title="JSON">x</p>')), [
    "JSON",
  ]);
  assert.deepStrictEqual(technical(visibleText("<!-- JSON --><p>x</p>")), []);
});

test("WEB-7c the code of the page (public/*.js) has no letter of the Russian alphabet: every caption is in the HTML", () => {
  const files = fs.readdirSync(PUBLIC_DIR).filter((f) => f.endsWith(".js"));
  assert.ok(files.includes("app.js"));
  for (const f of files) {
    const body = fs.readFileSync(path.join(PUBLIC_DIR, f), "utf8");
    assert.doesNotMatch(body, /[Ѐ-ӿ]/u, f);
  }
});

test("WEB-7d the text of an agent «рост на 12% по JSON-выгрузке» and a goal with a percent are given unchanged (they are not texts of Sai)", async (t) => {
  const box = webSandbox(t);
  const all = projectsInEveryStatus(t, box);
  const rich = all.find(([s]) => s === "waiting_user")[1];
  const p = project(t, box, { goal: `Цель: ${AGENT_TEXT}` });
  withPlan(p.w, [planTask("t-0001", "researcher", { text: AGENT_TEXT })]);
  const s = await startServer(t, box, { engines: fakeEngines() });
  const chat = (await s.get(`/api/projects/${rich.id}/chat`)).json;
  assert.ok(chat.messages.some((m) => m.text === AGENT_TEXT));
  const page = (await s.get(`/api/projects/${p.id}`)).json;
  assert.equal(page.goal, `Цель: ${AGENT_TEXT}`);
  assert.equal(page.tasks[0].text, AGENT_TEXT);
  const list = (await s.get("/api/projects")).json.projects;
  assert.equal(list.find((x) => x.id === p.id).goal, `Цель: ${AGENT_TEXT}`);
  const task = (await s.get(`/api/projects/${p.id}/tasks/t-0001`)).json;
  assert.equal(task.task.text, AGENT_TEXT);
});
