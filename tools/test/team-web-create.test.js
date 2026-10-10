// REQ-011, criterion 3 (design REQ-011, sections 8.1, 8.3, 10): a new project in
// one phrase — the event of creation with the same goal (after masking) and the
// start of the engine; every wrong goal or ceiling is a plain text and no new
// folder; claude-cli without real runs starts nothing (WEB-3a…WEB-3g).
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { maskSecrets } from "../src/pixel-office/mask.js";
import { TeamError } from "../src/team/errors.js";
import { postProject } from "../src/web/api.js";
import { createEngines } from "../src/web/engines.js";
import { WHY_NOT_STARTED, WHY_OTHER } from "../src/web/texts.js";
import {
  fakeStarts,
  journal,
  runTeam,
  snapshot,
  waitUntil,
} from "./exec-helpers.js";
import {
  JSON_TYPE,
  dirs,
  fakeEngines,
  startServer,
  webSandbox,
} from "./team-web-helpers.js";

const SECRET = "sk-ant-api03-FAKEFAKEFAKEFAKE1234567890abcd";
const BUDGET_TEXT =
  "Потолок расходов — число больше 0 и не больше 100000, не больше 6 знаков после запятой";
const BAD_REQUEST = "Запрос не понят. Обновите страницу";

// The scripted plan waits long enough for the test: the engine stays in planning.
const SLOW_PLAN = {
  version: 1,
  runs: [
    {
      match: { purpose: "plan" },
      steps: [{ delay_ms: 30_000 }],
      result: { outcome: "failed", cost_usd: 0.01 },
    },
  ],
};

function eventsOf(box, id) {
  return journal(`${box.home}/${id}/events.jsonl`);
}

test("WEB-3a a goal of 1 and of 2000 characters (code points) with a ceiling above 0: 201, the event of creation with the same goal after masking, the engine of the server writes PROJECT_STARTED", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box, {
    engines: "real",
    scenario: SLOW_PLAN,
  });
  const goals = [
    "Я",
    "😀".repeat(2000),
    `Цель с ключом ${SECRET} внутри`,
    "<b>рост 12%</b> & «кавычки»",
  ];
  let secretId = null;
  for (const goal of goals) {
    const r = await s.post("/api/projects", { goal, budget_usd: 0.5 });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.headers["content-type"], JSON_TYPE);
    const id = r.json.project.id;
    assert.match(id, /^p-[0-9]{8}-[0-9a-f]{6}$/);
    assert.deepStrictEqual(r.json, {
      project: { id, link: { to: "project", api: `/api/projects/${id}` } },
      started: true,
      result_text: "Проект создан, команда начала работу",
    });
    if (goal.includes(SECRET)) secretId = id;
    const events = eventsOf(box, id);
    assert.equal(events[0].type, "PROJECT_CREATED");
    assert.equal(events[0].data.goal, maskSecrets(goal));
    assert.equal(events[0].data.budget_usd, 0.5);
    assert.equal(events[0].data.executor, "scripted");
    assert.ok(
      events.some((e) => e.type === "PROJECT_STARTED"),
      events.map((e) => e.type).join(","),
    );
  }
  // the project made with the secret in its goal is found by the id of its answer,
  // not by a place in the sorted list of folders (TEST-DESIGN-VALIDATOR F4)
  assert.ok(secretId !== null);
  assert.ok(dirs(box.home).includes(secretId));
  const secretRaw = fs.readFileSync(
    `${box.home}/${secretId}/events.jsonl`,
    "utf8",
  );
  assert.ok(secretRaw.includes("Цель с ключом"), "this is the right journal");
  assert.ok(!secretRaw.includes(SECRET));
  assert.equal(s.engines.size(), goals.length, "one engine per project");
  // The list shows them, with the same goals as the journal.
  const list = await s.get("/api/projects");
  assert.equal(list.json.projects.length, goals.length);
});

test("WEB-3b a wrong goal, ceiling or body: 400 with the text of section 8.1 and its field, no new folder, no start of an engine", async (t) => {
  const box = webSandbox(t);
  const engines = fakeEngines();
  const s = await startServer(t, box, { engines });
  const cases = [
    [{ goal: "", budget_usd: 1 }, "Напишите цель одной фразой", "goal"],
    [{ goal: "   \t\n ", budget_usd: 1 }, "Напишите цель одной фразой", "goal"],
    [
      { goal: "ж".repeat(2001), budget_usd: 1 },
      "Цель длиннее 2000 знаков — сократите её",
      "goal",
    ],
    [
      { goal: "😀".repeat(2001), budget_usd: 1 },
      "Цель длиннее 2000 знаков — сократите её",
      "goal",
    ],
    [{ goal: "Цель", budget_usd: 0 }, BUDGET_TEXT, "budget_usd"],
    [{ goal: "Цель", budget_usd: -0 }, BUDGET_TEXT, "budget_usd"],
    [{ goal: "Цель", budget_usd: -1 }, BUDGET_TEXT, "budget_usd"],
    [{ goal: "Цель", budget_usd: "5" }, BUDGET_TEXT, "budget_usd"],
    [{ goal: "Цель", budget_usd: null }, BUDGET_TEXT, "budget_usd"],
    [{ goal: "Цель", budget_usd: true }, BUDGET_TEXT, "budget_usd"],
    [{ goal: "Цель", budget_usd: [5] }, BUDGET_TEXT, "budget_usd"],
    [{ goal: "Цель", budget_usd: 100000.5 }, BUDGET_TEXT, "budget_usd"],
    [{ goal: "Цель", budget_usd: 1e308 }, BUDGET_TEXT, "budget_usd"],
    [{ goal: 5, budget_usd: 1 }, BAD_REQUEST, null],
    [{ goal: null, budget_usd: 1 }, BAD_REQUEST, null],
    [{ goal: "Цель" }, BAD_REQUEST, null],
    [{ budget_usd: 1 }, BAD_REQUEST, null],
    [
      { goal: "Цель", budget_usd: 1, executor: "claude-cli" },
      BAD_REQUEST,
      null,
    ],
    [{}, BAD_REQUEST, null],
    [[], BAD_REQUEST, null],
    ["null", BAD_REQUEST, null],
    ['"Цель"', BAD_REQUEST, null],
    ["{", BAD_REQUEST, null],
    ["", BAD_REQUEST, null],
    ['{"goal":"Цель","budget_usd":NaN}', BAD_REQUEST, null],
    ['{"goal":"Цель","budget_usd":Infinity}', BAD_REQUEST, null],
    [Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x7d]), BAD_REQUEST, null],
  ];
  const before = snapshot(box.home);
  for (const [body, text, field] of cases) {
    const raw = Buffer.isBuffer(body) ? body : body;
    const r = await s.post("/api/projects", raw);
    const what = Buffer.isBuffer(body) ? "bytes" : JSON.stringify(body);
    assert.equal(r.status, 400, what);
    assert.equal(r.headers["content-type"], JSON_TYPE, what);
    assert.deepStrictEqual(
      r.json,
      { error_text: text, field, reload: false },
      what,
    );
  }
  assert.deepStrictEqual(snapshot(box.home), before, "no new folder");
  assert.deepStrictEqual(engines.calls, []);
  // The edges that pass: 1 and 2000 characters, the ceiling 100000.
  for (const body of [
    { goal: "Ц", budget_usd: 100000 },
    { goal: "ц".repeat(2000), budget_usd: 0.01 },
  ]) {
    const r = await s.post("/api/projects", body);
    assert.equal(r.status, 201, JSON.stringify(body).slice(0, 40));
  }
  assert.equal(dirs(box.home).length, 2);
  assert.equal(engines.calls.length, 2);
});

test("WEB-3c the goals and ceilings refused by the server are refused by `npm run team -- new` too, and the edges pass in both", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  const goals = ["", "   ", "ж".repeat(2001)];
  const budgets = ["0", "-1"];
  const tries = [
    ...goals.map((g) => [g, "1"]),
    ...budgets.map((b) => ["Вымышленная цель", b]),
  ];
  for (const [goal, budget] of tries) {
    const before = snapshot(box.home);
    const cli = runTeam(["new", "--goal", goal, "--budget", budget], box.env);
    assert.notEqual(cli.status, 0, `${goal.slice(0, 5)} ${budget}`);
    assert.deepStrictEqual(snapshot(box.home), before);
    const r = await s.post("/api/projects", {
      goal,
      budget_usd: Number(budget),
    });
    assert.equal(r.status, 400, `${goal.slice(0, 5)} ${budget}`);
    assert.deepStrictEqual(snapshot(box.home), before);
  }
  for (const [goal, budget] of [
    ["Я", "0.5"],
    ["ж".repeat(2000), "100000"],
  ]) {
    const cli = runTeam(["new", "--goal", goal, "--budget", budget], box.env);
    assert.equal(cli.status, 0, cli.stderr);
    const r = await s.post("/api/projects", {
      goal,
      budget_usd: Number(budget),
    });
    assert.equal(r.status, 201, r.text);
  }
  assert.equal(dirs(box.home).length, 4);
});

test("WEB-3d a server on claude-cli without SAI_TEAM_REAL_RUNS: 400 with the text of the instruction, no folder, the fake claude is started 0 times", async (t) => {
  const box = webSandbox(t, { SAI_TEAM_REAL_RUNS: undefined });
  const s = await startServer(t, box, {
    executor: "claude-cli",
    engines: "real",
  });
  const before = snapshot(box.home);
  const r = await s.post("/api/projects", {
    goal: "Вымышленная цель",
    budget_usd: 1,
  });
  assert.equal(r.status, 400);
  assert.deepStrictEqual(r.json, {
    error_text:
      "Настоящие запуски на этом компьютере выключены — проект не создан. Как включить, написано в инструкции Sai Team",
    field: null,
    reload: false,
  });
  assert.deepStrictEqual(snapshot(box.home), before);
  assert.equal(s.engines.size(), 0);
  // Give a would-be start the time to show itself.
  await new Promise((r2) => setTimeout(r2, 200));
  assert.equal(fakeStarts(box.sb).length, 0);
  assert.equal(fs.existsSync(`${box.sb.user}/log.jsonl`), false);
});

test("WEB-3e the ceiling has at most 6 digits after the point by the rule of the core: 0.0000001 refused with field budget_usd, 0.000001 created; a goal refused is field goal", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  for (const b of [0.0000001, 0.1 + 0.2, 1.0000001, 99999.9999999]) {
    const r = await s.post("/api/projects", { goal: "Цель", budget_usd: b });
    assert.equal(r.status, 400, String(b));
    assert.equal(r.json.field, "budget_usd", String(b));
  }
  assert.deepStrictEqual(dirs(box.home), []);
  for (const b of [0.000001, 0.3, 12.5, 99999.999999]) {
    const r = await s.post("/api/projects", { goal: "Цель", budget_usd: b });
    assert.equal(r.status, 201, String(b));
    const ev = eventsOf(box, r.json.project.id)[0];
    assert.equal(ev.data.budget_usd, b);
  }
  const g = await s.post("/api/projects", { goal: "", budget_usd: 1 });
  assert.equal(g.json.field, "goal");
});

test("WEB-3e a goal that passes 2000 characters only after masking: 400 «проверьте цель», field goal, no folder; a failure of the disk: 500 «проект не создан», no folder", async (t) => {
  const box = webSandbox(t);
  const engines = fakeEngines();
  const s = await startServer(t, box, { engines });
  // "password=a " grows by 7 characters when masked.
  const goal = "password=a ".repeat(181);
  assert.ok([...goal].length <= 2000);
  assert.ok([...maskSecrets(goal)].length > 2000);
  const before = snapshot(box.home);
  const r = await s.post("/api/projects", { goal, budget_usd: 1 });
  assert.equal(r.status, 400);
  assert.deepStrictEqual(r.json, {
    error_text:
      "Проект не создан: проверьте цель — после скрытия секретов она не проходит проверку",
    field: "goal",
    reload: false,
  });
  assert.deepStrictEqual(snapshot(box.home), before);
  fs.chmodSync(box.home, 0o500);
  let d;
  try {
    d = await s.post("/api/projects", { goal: "Цель", budget_usd: 1 });
  } finally {
    fs.chmodSync(box.home, 0o700);
  }
  assert.equal(d.status, 500);
  assert.deepStrictEqual(d.json, {
    error_text: "Не удалось записать на диск — проект не создан",
    field: null,
    reload: false,
  });
  assert.deepStrictEqual(snapshot(box.home), before);
  assert.deepStrictEqual(engines.calls, []);
  assert.doesNotMatch(r.text + d.text, /E_|EACCES|\/|at /);
});

test("WEB-3f the engine did not start: 201 started false and «Проект создан, но работа не началась: …» for each code of section 10; the event of creation is in the journal", async (t) => {
  const box = webSandbox(t);
  const codes = [...Object.keys(WHY_NOT_STARTED), "E_INTERNAL", null];
  for (const code of codes) {
    const error = code === null ? null : new TeamError(code, "детали ядра");
    const engines = fakeEngines({ started: false, error });
    const s = await startServer(t, box, { engines });
    const r = await s.post("/api/projects", {
      goal: "Вымышленная цель",
      budget_usd: 1,
    });
    assert.equal(r.status, 201, String(code));
    const id = r.json.project.id;
    const why =
      code !== null && Object.hasOwn(WHY_NOT_STARTED, code)
        ? WHY_NOT_STARTED[code]
        : WHY_OTHER;
    assert.deepStrictEqual(r.json, {
      project: { id, link: { to: "project", api: `/api/projects/${id}` } },
      started: false,
      result_text: `Проект создан, но работа не началась: ${why}`,
    });
    assert.deepStrictEqual(engines.calls, [id]);
    assert.equal(eventsOf(box, id)[0].type, "PROJECT_CREATED");
    assert.doesNotMatch(r.text, /детали ядра|E_/);
  }
  assert.equal(WHY_NOT_STARTED.E_WORK_DIR, "рабочая папка проекта недоступна");
});

test("WEB-3f the real engine refuses its precheck (a wrong scenario of the project): 201 started false with the reason in words; the server answers on", async (t) => {
  const box = webSandbox(t);
  // The engines of the server read a setting the engine refuses at its precheck
  // (E_CONFIG); the server itself is started with a good one.
  const warnings = [];
  const engines = createEngines({
    home: box.home,
    env: { ...box.env, SAI_TEAM_TASK_TIMEOUT_MS: "abc" },
    warn: (l) => warnings.push(l),
  });
  const s = await startServer(t, box, { engines });
  const r = await s.post("/api/projects", {
    goal: "Вымышленная цель",
    budget_usd: 1,
  });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.started, false);
  assert.equal(
    r.json.result_text,
    "Проект создан, но работа не началась: неверная настройка Sai Team",
  );
  assert.equal(eventsOf(box, r.json.project.id)[0].type, "PROJECT_CREATED");
  assert.equal(warnings.length, 1, "the refusal goes to stderr");
  assert.doesNotMatch(warnings[0], /\n|\s+at /);
  const next = await s.get("/api/projects");
  assert.equal(next.status, 200);
  await waitUntil(() => s.engines.size() === 0, 5000);
  assert.equal(s.engines.size(), 0);
});

test("WEB-3g budget_usd: null (what the page sends for a ceiling that is not a decimal record): 400 with field budget_usd, no folder", async (t) => {
  const box = webSandbox(t);
  const engines = fakeEngines();
  const s = await startServer(t, box, { engines });
  const before = snapshot(box.home);
  const r = await s.post("/api/projects", { goal: "Цель", budget_usd: null });
  assert.equal(r.status, 400);
  assert.deepStrictEqual(r.json, {
    error_text: BUDGET_TEXT,
    field: "budget_usd",
    reload: false,
  });
  assert.deepStrictEqual(snapshot(box.home), before);
  assert.deepStrictEqual(engines.calls, []);
});

test("WEB-3 postProject never throws: a failing engines.start becomes 500 with the general text and one warning", async (t) => {
  const box = webSandbox(t);
  const warned = [];
  const ctx = {
    home: box.home,
    env: box.env,
    config: { realRuns: true },
    executor: "claude-cli",
    scenarioBytes: null,
    engines: {
      start: async () => {
        throw new Error("сбой движка /secret/path");
      },
    },
    warn: (l) => warned.push(l),
  };
  const r = await postProject(ctx, { goal: "Цель", budget_usd: 1 });
  assert.deepStrictEqual(r, {
    status: 500,
    body: {
      error_text: "Что-то пошло не так. Повторите позже",
      field: null,
      reload: false,
    },
  });
  assert.equal(warned.length, 1);
  assert.doesNotMatch(JSON.stringify(r), /secret|сбой/);
});
