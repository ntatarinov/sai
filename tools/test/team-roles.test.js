// Sai Team core: the catalog of the ten roles and what is shown of it (design
// REQ-009, TM-35, TM-36, TM-37).
import assert from "node:assert/strict";
import test from "node:test";
import {
  ROLES,
  ROLE_CODES,
  publicRole,
  roleByCode,
} from "../src/team/roles.js";
import {
  assertAppendRefused,
  describeRun,
  eng,
  makeClock,
  makeHome,
  planTask,
  runTeam,
  startProject,
  usr,
  withPlan,
} from "./team-helpers.js";

// The titles as the requirement lists them (criterion 10), in its order.
const TITLES = [
  "Руководитель проекта",
  "Бизнес-аналитик",
  "Исследователь",
  "Финансовый аналитик",
  "Юрист",
  "Маркетолог",
  "Дизайнер",
  "Разработчик",
  "Проверяющий (QA)",
  "Специалист поддержки",
];

// ---- TM-35 ---------------------------------------------------------------------------

test("TM-35 exactly ten roles with the names of the requirement; the codes are unique", () => {
  assert.equal(ROLES.length, 10);
  assert.deepStrictEqual(
    ROLES.map((r) => r.title),
    TITLES,
  );
  assert.equal(new Set(ROLES.map((r) => r.code)).size, 10);
  assert.deepStrictEqual(
    ROLE_CODES,
    ROLES.map((r) => r.code),
  );
  assert.equal(new Set(ROLES.map((r) => r.name)).size, 10);
  for (const role of ROLES) {
    assert.match(role.code, /^[a-z_]+$/);
    for (const key of ["title", "name", "genitive", "description"]) {
      assert.equal(typeof role[key], "string", `${role.code}.${key}`);
      assert.ok(role[key].trim().length > 0, `${role.code}.${key}`);
    }
    // the place for the internal mapping exists (REQ-010 fills it; null before that)
    assert.deepStrictEqual(Object.keys(role.internal).sort(), [
      "prompt",
      "tools",
    ]);
    assert.ok(
      role.internal.prompt === null || typeof role.internal.prompt === "string",
    );
    assert.ok(
      role.internal.tools === null || Array.isArray(role.internal.tools),
    );
    assert.deepStrictEqual(Object.keys(role).sort(), [
      "code",
      "description",
      "genitive",
      "internal",
      "name",
      "title",
    ]);
    assert.equal(roleByCode(role.code), role);
  }
  assert.equal(roleByCode("wizard"), null);
  assert.equal(roleByCode(undefined), null);
  assert.ok(Object.isFrozen(ROLES));
  assert.ok(Object.isFrozen(ROLE_CODES));
  assert.deepStrictEqual(Object.keys(publicRole(ROLES[0])).sort(), [
    "description",
    "genitive",
    "name",
    "title",
  ]);
});

// ---- TM-36 ---------------------------------------------------------------------------

test("TM-36 a role outside the catalog is E_EVENT everywhere a role is named, and nothing changes", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w, dir } = p;
  const created = (role) =>
    eng(
      "TASK_CREATED",
      {
        role,
        text: "Задача",
        done_when: "Готово",
        depends_on: [],
        critical: false,
      },
      "t-0001",
    );
  for (const role of [
    "wizard",
    "",
    "Lawyer",
    "LAWYER",
    null,
    5,
    undefined,
    "lawyer ",
  ]) {
    assertAppendRefused(w, dir, created(role), "E_EVENT");
  }
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  for (const role of ["wizard", "", "Lawyer"]) {
    assertAppendRefused(
      w,
      dir,
      eng("PLAN_RECEIVED", { round: 0, tasks: [planTask("t-0001", role)] }),
      "E_EVENT",
    );
    assertAppendRefused(
      w,
      dir,
      eng("PLAN_RECEIVED", {
        round: 0,
        tasks: [planTask("t-0001", "lawyer"), planTask("t-0002", role)],
      }),
      "E_EVENT",
    );
  }
  assert.deepStrictEqual(w.state.tasks, []);
  w.append(
    eng("PLAN_RECEIVED", { round: 0, tasks: [planTask("t-0001", "lawyer")] }),
  );
  assertAppendRefused(
    w,
    dir,
    eng(
      "TASK_REASSIGNED",
      { from_role: "lawyer", to_role: "wizard", reason: "Нет" },
      "t-0001",
    ),
    "E_EVENT",
  );
  assertAppendRefused(
    w,
    dir,
    eng(
      "TASK_REASSIGNED",
      { from_role: "wizard", to_role: "marketer", reason: "Нет" },
      "t-0001",
    ),
    "E_EVENT",
  );
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  assertAppendRefused(
    w,
    dir,
    eng(
      "RUN_STARTED",
      {
        run_id: "r-00001",
        purpose: "work",
        role: "wizard",
        executor: "claude-cli",
        max_budget_usd: null,
      },
      "t-0001",
    ),
    "E_EVENT",
  );
  assert.throws(
    () => w.addTask({ role: "wizard", text: "Задача", done_when: "Готово" }),
    (err) => err.code === "E_EVENT",
  );
});

// ---- TM-37 ---------------------------------------------------------------------------

test("TM-37 the project shows the names of all ten roles and none of the codes or internal fields", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  withPlan(
    p.writer,
    ROLES.map((role, i) =>
      planTask(`t-${String(i + 1).padStart(4, "0")}`, role.code),
    ),
  );
  p.writer.append(eng("TASK_STARTED", {}, "t-0001"));
  const r = runTeam(home, ["project", p.id]);
  assert.equal(r.status, 0, describeRun(r));
  const view = JSON.parse(r.stdout).project;
  assert.deepStrictEqual(
    view.tasks.map((x) => x.role_title),
    TITLES,
  );
  for (const title of TITLES) assert.ok(r.stdout.includes(title), title);
  const list = runTeam(home, ["projects"]).stdout;

  // the codes and every non-empty string value of `internal` of the catalog
  const hidden = ROLES.map((role) => role.code);
  for (const role of ROLES) {
    for (const value of Object.values(role.internal)) {
      if (typeof value === "string" && value !== "") hidden.push(value);
      if (Array.isArray(value))
        hidden.push(...value.filter((v) => typeof v === "string" && v !== ""));
    }
  }
  assert.equal(hidden.length >= 10, true);
  for (const text of [r.stdout, list]) {
    for (const value of hidden) {
      assert.equal(text.includes(value), false, `"${value}" is in the output`);
    }
    assert.doesNotMatch(
      text,
      /"internal"|"prompt"|"tools"|"role"|"scenario_file"/,
    );
  }
  assert.equal(JSON.stringify(view).includes("work/"), false);
});
