// REQ-011, criterion 6 (design REQ-011, sections 5.2, 5.3, 7): every link the server
// gives for a fixture project leads to an existing object of the same project; the
// card of a role has the title and the description of the catalog and only the
// tasks of this role in this project; no answer holds an internal field of the
// catalog or a code of a role (WEB-6).
import assert from "node:assert/strict";
import { test } from "node:test";
import { replay } from "../src/team/reducer.js";
import { ROLES, ROLE_CODES, publicRole } from "../src/team/roles.js";
import { journal } from "./exec-helpers.js";
import { ROLE_NUMBERS, richProject } from "./team-web-fixtures.js";
import {
  NOT_FOUND_BODY,
  planTask,
  project,
  startServer,
  strings,
  webSandbox,
  withPlan,
  work,
} from "./team-web-helpers.js";

// Every Link object in a value.
function linksIn(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => linksIn(v, out));
  else if (value !== null && typeof value === "object") {
    if (
      typeof value.to === "string" &&
      typeof value.api === "string" &&
      Object.keys(value).length === 2
    ) {
      out.push(value);
    }
    for (const v of Object.values(value)) linksIn(v, out);
  }
  return out;
}

const SHAPE = {
  project: /^\/api\/projects\/(p-[0-9]{8}-[0-9a-f]{6})$/,
  chat: /^\/api\/projects\/(p-[0-9]{8}-[0-9a-f]{6})\/chat$/,
  task: /^\/api\/projects\/(p-[0-9]{8}-[0-9a-f]{6})\/tasks\/(t-[0-9]{4})$/,
  role: /^\/api\/projects\/(p-[0-9]{8}-[0-9a-f]{6})\/roles\/([1-9][0-9]?)$/,
};

test("WEB-6 walking every link of a fixture project (chat → task, task → role and project, card → tasks and project, results → task): each answers 200 and belongs to the same project; the card has the title and description of the catalog and only the tasks of its role here", async (t) => {
  const box = webSandbox(t);
  const p = richProject(t, box);
  // Another project with tasks of the same roles: they must never show up in p.
  const other = project(t, box, { goal: "Чужой проект" });
  const foreignTasks = [];
  for (let i = 1; i <= 9; i += 1) {
    foreignTasks.push(
      planTask(`t-000${i}`, i % 2 === 0 ? "marketer" : "researcher", {
        text: `Чужая задача ${i}`,
      }),
    );
  }
  withPlan(other.w, foreignTasks);
  work(other.w, "t-0001");
  const s = await startServer(t, box);
  const state = replay(journal(p));
  const start = [`/api/projects/${p.id}`, `/api/projects/${p.id}/chat`];
  const seen = new Map();
  const queue = [...start];
  const kinds = new Set();
  while (queue.length > 0) {
    const api = queue.shift();
    if (seen.has(api)) continue;
    const r = await s.get(api);
    assert.equal(r.status, 200, api);
    seen.set(api, r.json);
    for (const link of linksIn(r.json)) {
      const shape = SHAPE[link.to];
      assert.ok(shape !== undefined, link.to);
      const m = shape.exec(link.api);
      assert.ok(m !== null, `${link.to} ${link.api}`);
      assert.equal(m[1], p.id, `a link of another project: ${link.api}`);
      kinds.add(link.to);
      queue.push(link.api);
    }
  }
  assert.deepStrictEqual([...kinds].sort(), [
    "chat",
    "project",
    "role",
    "task",
  ]);
  // every task and every role of a task of the plan was reached
  for (const task of state.tasks) {
    assert.ok(seen.has(`/api/projects/${p.id}/tasks/${task.id}`), task.id);
  }
  for (const [api, body] of seen) {
    const role = SHAPE.role.exec(api);
    if (role !== null) {
      const n = Number(role[2]);
      const pub = publicRole(ROLES[n - 1]);
      assert.deepStrictEqual(body.role, {
        n,
        title: pub.title,
        description: pub.description,
      });
      assert.deepStrictEqual(
        body.tasks.map((x) => x.id),
        state.tasks
          .filter((x) => x.role === ROLES[n - 1].code)
          .map((x) => x.id)
          .sort(),
        api,
      );
      assert.ok(!JSON.stringify(body).includes("Чужая"));
      assert.deepStrictEqual(body.project, {
        id: p.id,
        goal: state.goal,
        link: { to: "project", api: `/api/projects/${p.id}` },
      });
    }
    const task = SHAPE.task.exec(api);
    if (task !== null) {
      const own = state.tasks.find((x) => x.id === task[2]);
      assert.equal(body.task.id, own.id);
      assert.equal(body.task.text, own.text);
      assert.equal(body.task.done_when, own.done_when);
      assert.deepStrictEqual(body.task.files, own.files);
      assert.equal(body.project.id, p.id);
      assert.equal(
        body.task.role.title,
        publicRole(ROLES.find((r) => r.code === own.role)).title,
      );
    }
  }
  // the chat message about a task leads to that task
  const chat = seen.get(`/api/projects/${p.id}/chat`);
  const about = chat.messages.filter((m) => m.task !== null);
  assert.ok(about.length >= 1);
  for (const m of about) assert.ok(seen.has(m.task.link.api));
  // the role card of the other project's role: never the other project's tasks
  const card = (await s.get(`/api/projects/${p.id}/roles/3`)).json;
  assert.equal(card.role.n, 3);
  // a task of the other project is not found here
  const foreign = await s.get(`/api/projects/${p.id}/tasks/t-0009`);
  assert.equal(foreign.status, 404);
  assert.equal(foreign.text, NOT_FOUND_BODY);
});

test("WEB-6 every role card 1…10 answers with the public fields of the catalog; no answer holds a prompt, a tool or a code of a role", async (t) => {
  const box = webSandbox(t);
  const p = richProject(t, box);
  const s = await startServer(t, box);
  const answers = [
    await s.get("/api/projects"),
    await s.get(`/api/projects/${p.id}`),
    await s.get(`/api/projects/${p.id}/chat`),
  ];
  for (const n of ROLE_NUMBERS) {
    const r = await s.get(`/api/projects/${p.id}/roles/${n}`);
    assert.equal(r.status, 200, String(n));
    assert.equal(r.json.role.title, publicRole(ROLES[n - 1]).title);
    assert.equal(r.json.role.description, ROLES[n - 1].description);
    answers.push(r);
  }
  for (const task of replay(journal(p)).tasks) {
    answers.push(await s.get(`/api/projects/${p.id}/tasks/${task.id}`));
  }
  const secrets = [];
  for (const role of ROLES) {
    secrets.push(role.internal.prompt);
    for (const tool of role.internal.tools) secrets.push(tool);
  }
  for (const r of answers) {
    for (const secret of secrets) {
      assert.ok(
        !r.text.includes(secret),
        `internal value in ${r.text.slice(0, 60)}`,
      );
    }
    for (const [at, v] of strings(r.json)) {
      for (const code of ROLE_CODES) {
        assert.doesNotMatch(v, new RegExp(`\\b${code}\\b`), `${at}: ${code}`);
      }
    }
    for (const key of JSON.stringify(r.json).matchAll(/"([a-z_]+)":/g)) {
      assert.ok(!ROLE_CODES.includes(key[1]), key[1]);
      assert.ok(
        ![
          "internal",
          "prompt",
          "tools",
          "scenario_file",
          "run_id",
          "budget_usd",
          "spent_usd",
          "executor",
        ].includes(key[1]),
        key[1],
      );
    }
  }
});
