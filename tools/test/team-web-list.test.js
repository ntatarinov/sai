// REQ-011, criterion 2 (design REQ-011, sections 5.3 ProjectItem, 5.5, 6): the list
// of projects — the goal as it is, the status in the words of the command
// `project`, the progress counted from the replayed state, the mark «нужно ваше
// решение» only on a project that waits for the user, «тестовый исполнитель» only
// on scripted; no percent; a project the core cannot read is a card without a link
// (WEB-2, WEB-2b).
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { replay } from "../src/team/reducer.js";
import { PROJECT_STATUS_TEXT } from "../src/team/schema.js";
import { listItem } from "../src/web/display.js";
import { installFaults } from "./fault-inject.js";
import { journal, runTeam, snapshot } from "./exec-helpers.js";
import {
  JSON_TYPE,
  T0,
  clockAt,
  doneIn,
  eng,
  planTask,
  project,
  startServer,
  strings,
  webSandbox,
  withPlan,
} from "./team-web-helpers.js";

const GOAL_PCT = "рынок вырос на 12%";

// Three projects in different statuses, through the API of the core:
// A created (claude-cli, the goal with a percent), B waits for the user
// (scripted, one of three tasks done), C running (claude-cli, two tasks).
function threeProjects(t, box) {
  const a = project(t, box, { goal: GOAL_PCT }, { clock: clockAt(T0) });
  a.w.close();
  const cb = clockAt(T0 + 1000);
  const b = project(
    t,
    box,
    { goal: "Вымышленная цель Б", executor: "scripted" },
    { clock: cb },
  );
  withPlan(b.w, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "marketer"),
    planTask("t-0003", "lawyer"),
  ]);
  doneIn(b.w, cb, "t-0001", T0 + 2000, 60_000);
  b.w.append(eng("PROJECT_WAITING", { reason: "budget" }));
  b.w.close();
  const c = project(
    t,
    box,
    { goal: "Вымышленная цель В" },
    { clock: clockAt(T0 + 5000) },
  );
  withPlan(c.w, [
    planTask("t-0001", "developer"),
    planTask("t-0002", "designer"),
  ]);
  c.w.close();
  return [a, b, c];
}

function expectedOf(p) {
  const events = journal(p);
  const state = replay(events);
  const tasks = state.tasks;
  const done = tasks.filter((x) => x.status === "done").length;
  return {
    state,
    created: events[0].ts,
    progress: tasks.length === 0 ? null : { done, total: tasks.length },
  };
}

test("WEB-2 three projects: the goal unchanged, the status in the words of `npm run team -- project`, the progress «N из M задач» counted from the replayed journal, the marks only where they belong, no percent in the texts of Sai", async (t) => {
  const box = webSandbox(t);
  const ps = threeProjects(t, box);
  const s = await startServer(t, box);
  const before = snapshot(box.home);
  const r = await s.get("/api/projects");
  assert.equal(r.status, 200);
  assert.equal(r.headers["content-type"], JSON_TYPE);
  const items = r.json.projects;
  assert.deepStrictEqual(
    items.map((x) => x.id),
    ps.map((p) => p.id),
    "the order of the core: by creation",
  );
  for (const [i, p] of ps.entries()) {
    const item = items[i];
    const exp = expectedOf(p);
    const cli = runTeam(["project", p.id], box.env);
    assert.equal(cli.status, 0, cli.stderr);
    const view = JSON.parse(cli.stdout).project;
    assert.equal(item.goal, exp.state.goal);
    assert.equal(item.status, exp.state.status);
    assert.equal(item.status_text, view.status_text);
    assert.equal(item.status_text, PROJECT_STATUS_TEXT[exp.state.status]);
    assert.deepStrictEqual(item.progress, exp.progress);
    assert.equal(
      item.progress_text,
      exp.progress === null
        ? "Задач пока нет"
        : `${exp.progress.done} из ${exp.progress.total} задач`,
    );
    assert.equal(item.created_at, exp.created);
    const waits = exp.state.status === "waiting_user";
    assert.equal(item.needs_decision, waits);
    assert.equal(item.needs_decision_text, waits ? "нужно ваше решение" : null);
    const scripted = exp.state.executor === "scripted";
    assert.equal(item.test_executor, scripted);
    assert.equal(
      item.test_executor_text,
      scripted ? "тестовый исполнитель" : null,
    );
    assert.equal(item.broken, false);
    assert.deepStrictEqual(item.link, {
      to: "project",
      api: `/api/projects/${p.id}`,
    });
    for (const k of [
      "status_text",
      "progress_text",
      "needs_decision_text",
      "test_executor_text",
    ]) {
      const v = item[k] ?? "";
      assert.doesNotMatch(v, /%|процент/i, `${k}: ${v}`);
    }
    // No field outside the contract.
    assert.deepStrictEqual(Object.keys(item).sort(), [
      "broken",
      "created_at",
      "goal",
      "id",
      "link",
      "needs_decision",
      "needs_decision_text",
      "progress",
      "progress_text",
      "status",
      "status_text",
      "test_executor",
      "test_executor_text",
    ]);
  }
  // The page of each project carries the same marks (B waits for the user on the
  // ceiling without a question in the chat: the mark follows the status).
  for (const item of items) {
    const page = await s.get(item.link.api);
    assert.equal(page.status, 200);
    for (const k of [
      "status_text",
      "progress_text",
      "needs_decision",
      "needs_decision_text",
      "test_executor_text",
      "created_at",
    ]) {
      assert.deepStrictEqual(page.json[k], item[k], k);
    }
  }
  const b = (await s.get(items[1].link.api)).json;
  assert.equal(b.waits.count, 0);
  assert.equal(b.needs_decision, true);
  assert.equal(items[0].goal, GOAL_PCT, "the goal of the user is kept as is");
  assert.equal(items[0].status, "created");
  assert.equal(items[1].status, "waiting_user");
  assert.equal(items[1].progress_text, "1 из 3 задач");
  assert.equal(items[2].progress_text, "0 из 2 задач");
  // Only the goal of the user may hold the percent sign.
  for (const [at, v] of strings(r.json)) {
    if (!at.endsWith(".goal")) assert.doesNotMatch(v, /%/, at);
  }
  assert.deepStrictEqual(snapshot(box.home), before, "the list wrote nothing");
});

test("WEB-2 needs_decision follows the status «waits for the user», not the number of questions (mutant: needs_decision = waits.count > 0)", () => {
  const base = {
    id: "p-20990101-a1b2c3",
    goal: "Вымышленная",
    status: "waiting_user",
    status_text: "ждёт решения пользователя",
    executor: "claude-cli",
    created_at: "2026-01-01T09:00:00.000Z",
    updated_at: "2026-01-01T09:00:00.000Z",
  };
  // A summary has no question count at all: the flag can only come from the status.
  assert.equal(listItem(base).needs_decision, true);
  for (const status of [
    "created",
    "planning",
    "running",
    "paused",
    "stopped",
    "done",
    "failed",
  ]) {
    const item = listItem({ ...base, status });
    assert.equal(item.needs_decision, false, status);
    assert.equal(item.needs_decision_text, null, status);
    assert.equal(item.status_text, PROJECT_STATUS_TEXT[status]);
  }
  const scripted = listItem({ ...base, executor: "scripted" });
  assert.equal(scripted.test_executor_text, "тестовый исполнитель");
  assert.equal(
    listItem({ ...base, progress: { done: 2, total: 5 } }).progress_text,
    "2 из 5 задач",
  );
});

test("WEB-2b a project the core cannot read: a card broken: true with the text of a damaged project and no link; a failure of reading — the text «не удалось прочитать»; the other projects are there; nothing is written", async (t) => {
  const box = webSandbox(t);
  const ps = threeProjects(t, box);
  const s = await startServer(t, box);
  // A broken line in the middle of the journal of B (an injected corruption, the
  // whole lines around it stay).
  const lines = fs.readFileSync(ps[1].events, "utf8").split("\n");
  lines[2] = "{не json";
  fs.writeFileSync(ps[1].events, lines.join("\n"));
  const before = snapshot(box.home);
  const r = await s.get("/api/projects");
  assert.equal(r.status, 200);
  const items = r.json.projects;
  const broken = items.find((x) => x.id === ps[1].id);
  assert.deepStrictEqual(broken, {
    id: ps[1].id,
    broken: true,
    problem_text: "Данные проекта повреждены — проект нельзя показать",
    link: null,
  });
  for (const p of [ps[0], ps[2]]) {
    const ok = items.find((x) => x.id === p.id);
    assert.equal(ok.broken, false);
    assert.equal(ok.goal, journal(p)[0].data.goal);
  }
  assert.deepStrictEqual(snapshot(box.home), before);

  // A failure of the disk while the journal of C is read.
  const faults = installFaults([
    { fn: "openSync", paths: [ps[2].events], effect: "throw", code: "EIO" },
  ]);
  let r2;
  try {
    r2 = await s.get("/api/projects");
  } finally {
    faults.restore();
  }
  assert.deepStrictEqual(faults.fired(), [true]);
  assert.equal(r2.status, 200);
  const c = r2.json.projects.find((x) => x.id === ps[2].id);
  assert.deepStrictEqual(c, {
    id: ps[2].id,
    broken: true,
    problem_text: "Не удалось прочитать данные проекта. Повторите позже",
    link: null,
  });
  assert.equal(r2.json.projects.find((x) => x.id === ps[0].id).broken, false);
  assert.doesNotMatch(r2.text, /EIO|E_DISK|E_CORRUPT|events\.jsonl/);
  // The page of the damaged project: 500 with the same text.
  const page = await s.get(`/api/projects/${ps[1].id}`);
  assert.equal(page.status, 500);
  assert.deepStrictEqual(page.json, {
    error_text: "Данные проекта повреждены — проект нельзя показать",
    field: null,
    reload: false,
  });
  assert.deepStrictEqual(snapshot(box.home), before);
});

test("WEB-2 an empty or missing data folder is an empty list, and the read does not make the folder", async (t) => {
  const box = webSandbox(t);
  fs.rmSync(box.home, { recursive: true });
  const s = await startServer(t, box);
  const r = await s.get("/api/projects");
  assert.equal(r.status, 200);
  assert.deepStrictEqual(r.json, { projects: [] });
  assert.equal(fs.existsSync(box.home), false);
});
