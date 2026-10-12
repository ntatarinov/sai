// ISS-0031 (design docs/design/ISS-0031-second-round-file-dependency.md, section 7;
// criterion 15 of REQ-013): the pure functions of plan.js that give a task of a
// later round the accepted file it names - the rule "a text names a file" (SF-01),
// the accepted files of the project (SF-02), the completion of depends_on in
// validatePlan (SF-03 ... SF-06) and the block of the accepted files in the note of
// the planner (SF-07 ... SF-09).
//
// No executor, no file, no clock: the state of a project is a literal object here
// (the shape of the reducer: tasks[], files[] with seq). Every test makes its own
// state; nothing is shared, nothing depends on the order of the tests. The baits
// are made of parts and are not real keys.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ACCEPTED_LINES_MAX } from "../src/team/executor.js";
import * as plan from "../src/team/engine/plan.js";

const { PLAN_DETAIL, planNote, validatePlan } = plan;

const ONE = "one_pager.md";

const item = (key, over = {}) => ({
  key,
  role: "researcher",
  text: `Вымышленная задача ${key}`,
  done_when: "Есть итог",
  depends_on: [],
  critical: false,
  ...over,
});

const idOf = (n) => `t-${String(n).padStart(4, "0")}`;
const acceptedName = (task, attempt, original) =>
  `${task}-${attempt}-${original}`;

// A task of the state: { id, status, files: [accepted names] }.
function stTask(n, status, originals = [], over = {}) {
  const id = idOf(n);
  return {
    id,
    role: "researcher",
    text: `Задача ${id}`,
    done_when: "Есть итог",
    depends_on: [],
    critical: false,
    status,
    reason: null,
    last_decision: null,
    files: originals.map((o, i) => acceptedName(id, i + 1, o)),
    ...over,
  };
}

// The state of a project; `seqOf` (optional) gives the seq of the event of a file,
// so that a test can make the order of the events differ from the order of tasks.
function stateOf(tasks, { seqOf = null } = {}) {
  let seq = 100;
  const files = [];
  for (const t of tasks) {
    for (const name of t.files) {
      seq += 1;
      files.push({
        seq: seqOf === null ? seq : seqOf(name),
        name,
        task: t.id,
        bytes: 1,
        sha256: "0".repeat(64),
        kind: "result",
        from_work: true,
      });
    }
  }
  return {
    tasks,
    files,
    plan: { round: 1 },
    goal_check: { passed: null },
    chat: [],
  };
}

const FACTS = Object.freeze({ closedSincePlan: [], goalNotes: null });

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

const dependsOf = (r) => r.tasks.map((t) => [t.id, t.depends_on]);

// ---- SF-01: the rule "a text names a file" -------------------------------------------

const NAMES = [
  "правь one_pager.md",
  "правь one_pager.md.",
  "(см. one_pager.md)",
  "Файл сохранён в one_pager.md",
  "one_pager.md",
  "«one_pager.md»",
  "one_pager.md, потом",
  "one_pager.md...",
  "one_pager.md;",
  "Файл:one_pager.md",
  "правь one_pager.md\nи сохрани",
];
const NOT_NAMES = [
  "правь One_Pager.md",
  "правь one_pager",
  "правь my_one_pager.md",
  "правь one_pager.mdx",
  "правь one_pager.md.bak",
  "out/one_pager.md",
  "../one_pager.md",
  "re-one_pager.md",
  "one_pager_md",
  "one_pager.md.-x",
  "one_pager.md.5",
  // The accepted name is not the original name: the rule does not name it. The line
  // fixes the present border; it changes only with the decision on the question B1.
  "правь t-0001-1-one_pager.md",
  "",
];

for (const text of NAMES) {
  test(`SF-01 criterion 15: the text ${JSON.stringify(text)} names ${ONE}`, () => {
    assert.equal(plan.namesFile(text, ONE), true);
  });
}
for (const text of NOT_NAMES) {
  test(`SF-01 criterion 15: the text ${JSON.stringify(text)} does not name ${ONE}`, () => {
    assert.equal(plan.namesFile(text, ONE), false);
  });
}

test("SF-01 the dot of the name is a dot, not any character; the name is data, not a pattern", () => {
  assert.equal(plan.namesFile("правь aXmd", "a.md"), false);
  assert.equal(plan.namesFile("правь a.md", "a.md"), true);
  assert.equal(plan.namesFile("правь anything", "(.*)"), false);
  assert.equal(plan.namesFile("правь (.*)", "(.*)"), true);
  assert.equal(plan.namesFile("правь a.md", ""), false);
  assert.equal(plan.namesFile(undefined, ONE), false);
  assert.equal(plan.namesFile("правь a.md", undefined), false);
});

// ---- SF-02: the accepted files of the project ----------------------------------------

test("SF-02 acceptedFiles: only the tasks 'done', by the number of the task and of the attempt, not by the order of the events", () => {
  const tasks = [
    stTask(1, "done", ["a.md", "a.md"]),
    stTask(2, "done", ["b.md"]),
    stTask(3, "running", ["c.md"]),
    stTask(4, "review", ["d.md"]),
    stTask(5, "failed", ["e.md"]),
    stTask(6, "waiting_user", ["f.md"]),
    stTask(7, "failed", ["g.md"], { reason: "rejected_by_user" }),
    stTask(8, "interrupted", ["h.md"]),
    stTask(9, "waiting", ["i.md"]),
  ];
  // t-0002 took its file before t-0001 did: the seq is the other way round.
  const state = deepFreeze(
    stateOf(tasks, {
      seqOf: (name) => (name.startsWith("t-0002") ? 1 : 500),
    }),
  );
  const before = JSON.stringify(state);
  const got = plan.acceptedFiles(state);
  assert.deepEqual(
    got.map((a) => [a.task, a.name, a.original, a.attempt]),
    [
      ["t-0001", "t-0001-1-a.md", "a.md", 1],
      ["t-0001", "t-0001-2-a.md", "a.md", 2],
      ["t-0002", "t-0002-1-b.md", "b.md", 1],
    ],
  );
  for (const a of got) assert.equal(Number.isInteger(a.attempt), true);
  assert.equal(JSON.stringify(state), before, "the state is not changed");
});

test("SF-02 acceptedFiles: a name not by the pattern of the core is skipped, the rubbish in the state does not throw", () => {
  const rubbish = {
    tasks: [
      null,
      "text",
      { id: "t-0001", status: "done", files: "not a list" },
      { id: "t-0002", status: "done" },
      {
        id: "t-0003",
        status: "done",
        files: ["plain.md", "t-0009-1-other.md", "t-0003-x-y.md", 7, null],
      },
      { id: "t-0004", status: "done", files: ["t-0004-1-good.md"] },
    ],
  };
  assert.deepEqual(
    plan.acceptedFiles(rubbish).map((a) => a.name),
    ["t-0004-1-good.md"],
  );
  assert.deepEqual(plan.acceptedFiles({ tasks: [] }), []);
  assert.deepEqual(plan.acceptedFiles({}), []);
  assert.deepEqual(plan.acceptedFiles(undefined), []);
  assert.deepEqual(plan.acceptedFiles(stateOf([stTask(1, "done", [])])), []);
});

// ---- SF-03: validatePlan completes depends_on ----------------------------------------

const withOne = () => stateOf([stTask(1, "done", [ONE])]);

test("SF-03 criterion 15 (a): the text names an accepted file - depends_on gets the task that gave it", () => {
  const r = validatePlan(
    { tasks: [item("b", { text: `правь ${ONE}` })] },
    withOne(),
  );
  assert.equal(r.ok, true);
  assert.deepEqual(dependsOf(r), [["t-0002", ["t-0001"]]]);
});

test("SF-03 criterion 15 (a): only done_when names the file - the same", () => {
  const r = validatePlan(
    { tasks: [item("b", { done_when: `Файл сохранён в ${ONE}` })] },
    withOne(),
  );
  assert.equal(r.ok, true);
  assert.deepEqual(dependsOf(r), [["t-0002", ["t-0001"]]]);
});

test("SF-03 the name is accepted from two tasks - both come, in the order of the tasks; a dependency that stands is not repeated and keeps its place", () => {
  const state = stateOf([
    stTask(1, "done", [ONE]),
    stTask(2, "done", [ONE]),
    stTask(3, "done", ["other.md"]),
  ]);
  const both = validatePlan(
    { tasks: [item("b", { text: `правь ${ONE}` })] },
    state,
  );
  assert.deepEqual(dependsOf(both), [["t-0004", ["t-0001", "t-0002"]]]);
  const standing = validatePlan(
    {
      tasks: [item("b", { text: `правь ${ONE}`, depends_on: ["t-0002"] })],
    },
    state,
  );
  assert.deepEqual(dependsOf(standing), [["t-0004", ["t-0002", "t-0001"]]]);
  const all = validatePlan(
    {
      tasks: [
        item("b", { text: `правь ${ONE}`, depends_on: ["t-0001", "t-0002"] }),
      ],
    },
    state,
  );
  assert.deepEqual(dependsOf(all), [["t-0004", ["t-0001", "t-0002"]]]);
});

test("SF-03 a dependency on a task of the same plan that depends on the source does not replace the source", () => {
  const r = validatePlan(
    {
      tasks: [
        item("a", { depends_on: ["t-0001"] }),
        item("b", { text: `правь ${ONE}`, depends_on: ["a"] }),
      ],
    },
    withOne(),
  );
  assert.equal(r.ok, true);
  assert.deepEqual(dependsOf(r), [
    ["t-0002", ["t-0001"]],
    ["t-0003", ["t-0002", "t-0001"]],
  ]);
});

test("SF-03 F1: a key of the plan equal in form to an existing task - the keys are turned into ids BEFORE the completion", () => {
  const r = validatePlan(
    {
      tasks: [
        item("t-0001", { text: `правь ${ONE}` }),
        item("b", { text: `правь ${ONE}`, depends_on: ["t-0001"] }),
      ],
    },
    withOne(),
  );
  assert.equal(r.ok, true);
  assert.deepEqual(dependsOf(r), [
    // the task with the key t-0001 is the new t-0002: it gets the source, not itself
    ["t-0002", ["t-0001"]],
    // b depends on the key (the new t-0002) and keeps the source it names
    ["t-0003", ["t-0002", "t-0001"]],
  ]);
});

test("SF-03 N1: every added number is smaller than the number of its task, never the task itself", () => {
  const state = stateOf([
    stTask(1, "done", [ONE]),
    stTask(2, "done", ["two.md"]),
    stTask(3, "done", ["three.md"]),
  ]);
  const r = validatePlan(
    {
      tasks: [
        item("x", { text: `${ONE} two.md three.md` }),
        item("y", { done_when: "three.md", depends_on: ["x"] }),
        item("z", { text: ONE }),
      ],
    },
    state,
  );
  assert.equal(r.ok, true);
  for (const t of r.tasks) {
    assert.equal(t.depends_on.includes(t.id), false);
    assert.equal(new Set(t.depends_on).size, t.depends_on.length);
    for (const d of t.depends_on) {
      assert.ok(Number(d.slice(2)) < Number(t.id.slice(2)), `${t.id} ${d}`);
    }
  }
});

test("SF-03 nothing is named, or a name nobody gave: depends_on is as in the answer", () => {
  const answer = deepFreeze({
    tasks: [
      item("a"),
      item("b", { text: "правь new_file.md", depends_on: ["a"] }),
      item("c", { done_when: "Файл сохранён в new_file.md" }),
    ],
  });
  const r = validatePlan(answer, withOne());
  assert.deepEqual(dependsOf(r), [
    ["t-0002", []],
    ["t-0003", ["t-0002"]],
    ["t-0004", []],
  ]);
});

test("SF-03 a plan without accepted files gives the same result as before: the same fields in the same order", () => {
  const state = stateOf([stTask(1, "done", [])]);
  const r = validatePlan(
    {
      tasks: [
        item("report", { depends_on: ["prices", "t-0001"], critical: true }),
        item("prices", { text: `правь ${ONE}` }),
      ],
    },
    state,
  );
  assert.deepEqual(r, {
    ok: true,
    tasks: [
      {
        id: "t-0002",
        role: "researcher",
        text: `правь ${ONE}`,
        done_when: "Есть итог",
        depends_on: [],
        critical: false,
      },
      {
        id: "t-0003",
        role: "researcher",
        text: "Вымышленная задача report",
        done_when: "Есть итог",
        depends_on: ["t-0002", "t-0001"],
        critical: true,
      },
    ],
  });
  assert.deepEqual(Object.keys(r.tasks[0]), [
    "id",
    "role",
    "text",
    "done_when",
    "depends_on",
    "critical",
  ]);
});

test("SF-03 missingSources: the ids of the sources not yet in depends_on, once each, in the order of the accepted files", () => {
  const accepted = plan.acceptedFiles(
    stateOf([
      stTask(1, "done", [ONE, "x.md"]),
      stTask(2, "done", [ONE]),
      stTask(3, "done", ["y.md"]),
    ]),
  );
  assert.deepEqual(
    plan.missingSources(
      { text: `${ONE} x.md`, done_when: "y.md", depends_on: [] },
      accepted,
    ),
    ["t-0001", "t-0002", "t-0003"],
  );
  assert.deepEqual(
    plan.missingSources(
      { text: ONE, done_when: "", depends_on: ["t-0001"] },
      accepted,
    ),
    ["t-0002"],
  );
});

// ---- SF-04: nothing extra ------------------------------------------------------------

test("SF-04 criterion 15 (b) / criterion 4: a task that names no file keeps an empty depends_on; the 'does not name' cases give no dependency and no rejection", () => {
  const answer = deepFreeze({
    tasks: [
      item("c"),
      ...NOT_NAMES.filter((x) => x !== "").map((text, i) =>
        item(`n${i}`, { text }),
      ),
    ],
  });
  const state = deepFreeze(withOne());
  const r = validatePlan(answer, state);
  assert.equal(r.ok, true);
  for (const t of r.tasks) assert.deepEqual(t.depends_on, [], t.id);
  assert.equal(r.tasks.length, answer.tasks.length);
});

// ---- SF-05: the earlier checks come first --------------------------------------------

test("SF-05 a cycle and a link to nowhere are rejected as before, even when the text names a file", () => {
  const state = deepFreeze(withOne());
  const cycle = validatePlan(
    {
      tasks: [
        item("a", { text: ONE, depends_on: ["b"] }),
        item("b", { text: ONE, depends_on: ["a"] }),
      ],
    },
    state,
  );
  assert.deepEqual(cycle, {
    ok: false,
    reason: "cycle",
    detail: PLAN_DETAIL.cycle(),
  });
  assert.equal(cycle.detail, "В зависимостях плана есть цикл");
  const nowhere = validatePlan(
    { tasks: [item("a", { text: ONE, depends_on: ["t-0099"] })] },
    state,
  );
  assert.equal(nowhere.ok, false);
  assert.equal(nowhere.reason, "bad_dependency");
  assert.equal(nowhere.detail, PLAN_DETAIL.bad_dependency("a"));
});

// ---- SF-06: the border of 40 dependencies --------------------------------------------

function manyDone(count) {
  const tasks = [];
  for (let n = 1; n <= count; n += 1) {
    tasks.push(stTask(n, "done", n === count ? ["last.md"] : []));
  }
  return stateOf(tasks);
}

test("SF-06 criterion 15: 40 dependencies and a text that names the file of the 41st task - rejected as too_many with the constant detail; the state and the answer are not changed", () => {
  const state = deepFreeze(manyDone(41));
  const deps = Array.from({ length: 40 }, (_, i) => idOf(i + 1));
  const answer = deepFreeze({
    tasks: [item("big", { text: "правь last.md", depends_on: deps })],
  });
  const stateBefore = JSON.stringify(state);
  const answerBefore = JSON.stringify(answer);
  const r = validatePlan(answer, state);
  assert.deepEqual(r, {
    ok: false,
    reason: "too_many",
    detail: "Задача big получила бы больше 40 зависимостей",
  });
  assert.equal(r.detail, PLAN_DETAIL.too_many_deps("big"));
  assert.equal(JSON.stringify(state), stateBefore);
  assert.equal(JSON.stringify(answer), answerBefore);
});

test("SF-06 39 dependencies and one source make 40: the plan is good", () => {
  const state = deepFreeze(manyDone(40));
  const deps = Array.from({ length: 39 }, (_, i) => idOf(i + 1));
  const r = validatePlan(
    { tasks: [item("big", { text: "правь last.md", depends_on: deps })] },
    state,
  );
  assert.equal(r.ok, true);
  assert.equal(r.tasks[0].depends_on.length, 40);
  assert.equal(r.tasks[0].depends_on[39], "t-0040");
});

// ---- SF-07: the block of the accepted files in the note of the planner ---------------

const RULE =
  "Если text или done_when задачи называет такой файл, пиши в тексте именно исходное имя (первое в строке, не принятое), и укажи в её depends_on номер задачи, которая его сдала: файл получит только задача с такой зависимостью. Если не укажешь, ядро добавит эту зависимость само.";
const HEAD = "Принятые файлы проекта:";

function blockOf(note) {
  const at = note.indexOf(HEAD);
  if (at === -1) return null;
  const end = note.indexOf(RULE, at);
  return note.slice(at, end === -1 ? undefined : end + RULE.length);
}

test("SF-07 criterion 15: the block stands between the tasks and the closed tasks; the line, the rule word for word; no content", () => {
  const state = deepFreeze(
    stateOf(
      [
        stTask(1, "done", [ONE]),
        stTask(2, "running", ["live.md"]),
        stTask(3, "failed", ["bad.md"]),
        stTask(4, "failed", ["gone.md"], {
          reason: "rejected_by_user",
          last_decision: { text: "не нужно" },
        }),
      ],
      {},
    ),
  );
  const facts = { closedSincePlan: ["t-0004"], goalNotes: null };
  const note = planNote(state, facts, "В плане больше 40 задач");
  assert.ok(
    note.startsWith("Предыдущий план отклонён: В плане больше 40 задач\n\n"),
  );
  const tasksAt = note.indexOf("Задачи проекта:");
  const blockAt = note.indexOf(HEAD);
  const closedAt = note.indexOf("Закрытые задачи после прошлого плана:");
  assert.ok(tasksAt >= 0 && blockAt > tasksAt && closedAt > blockAt);
  const block = blockOf(note);
  assert.equal(
    block,
    `${HEAD}\n— ${ONE} (задача t-0001, принят как t-0001-1-${ONE})\n${RULE}`,
  );
  for (const hidden of ["live.md", "bad.md", "gone.md"]) {
    assert.equal(block.includes(hidden), false, hidden);
  }
});

test("SF-07 the block is made from acceptedFiles: the set of the original names in the block is the set of the function", () => {
  const state = deepFreeze(
    stateOf([
      stTask(1, "done", ["a.md", "b.md"]),
      stTask(2, "done", ["c.md"]),
      stTask(3, "review", ["d.md"]),
    ]),
  );
  const block = blockOf(planNote(state, FACTS));
  const lines = block.split("\n").filter((l) => l.startsWith("— "));
  const shown = lines.map((l) => /^— (\S+) \(задача/u.exec(l)[1]);
  assert.deepEqual(
    shown,
    plan.acceptedFiles(state).map((a) => a.original),
  );
});

test("SF-07 the content of a file is not in the note: only names and numbers of tasks", () => {
  const label = ["СОДЕРЖИМОЕ", "ФАЙЛА", "МЕТКА"].join("-");
  const state = stateOf([stTask(1, "done", [ONE])]);
  state.files[0].content = label;
  state.tasks[0].content = label;
  assert.equal(planNote(deepFreeze(state), FACTS).includes(label), false);
});

test("SF-07 without accepted files there is no block, and the note is the same as the note without the block", () => {
  const empty = stateOf([
    stTask(1, "done", []),
    stTask(2, "running", ["x.md"]),
  ]);
  const note = planNote(deepFreeze(empty), FACTS);
  assert.equal(note.includes(HEAD), false);
  assert.equal(note.includes("Принятые файлы"), false);
  const withFile = stateOf([
    stTask(1, "done", [ONE]),
    stTask(2, "running", []),
  ]);
  const full = planNote(deepFreeze(withFile), FACTS);
  const block = blockOf(full);
  assert.equal(full.replace(`\n\n${block}`, ""), note);
  assert.equal(
    planNote(deepFreeze(stateOf([])), FACTS, null).includes(HEAD),
    false,
  );
});

// ---- SF-08: the limit of the block ---------------------------------------------------

test("SF-08 the block shows the last 50 files by the number of the task and the attempt, first the line about the earlier ones; the prompt is short", () => {
  assert.equal(ACCEPTED_LINES_MAX, 50);
  const names = (n) =>
    Array.from({ length: 20 }, (_, i) => `r${n}x${i + 1}.md`);
  const tasks = [
    stTask(1, "done", names(1)),
    stTask(2, "done", names(2)),
    stTask(3, "done", names(3)),
  ];
  // The files of t-0003 were accepted first: the events go in another order.
  const state = deepFreeze(
    stateOf(tasks, {
      seqOf: (name) =>
        1000 - Number(name.slice(2, 6)) * 100 - Number(name.split("-")[1]),
    }),
  );
  const all = plan.acceptedFiles(state);
  assert.equal(all.length, 60);
  assert.deepEqual(all.map((a) => [a.task, a.attempt]).slice(0, 3), [
    ["t-0001", 1],
    ["t-0001", 2],
    ["t-0001", 3],
  ]);
  const note = planNote(state, FACTS);
  const lines = blockOf(note)
    .split("\n")
    .filter((l) => l.startsWith("— "));
  assert.equal(lines.length, 51);
  assert.equal(lines[0], "— и ещё 10 более ранних файлов");
  const expected = all
    .slice(10)
    .map((a) => `— ${a.original} (задача ${a.task}, принят как ${a.name})`);
  assert.deepEqual(lines.slice(1), expected);
  assert.ok(lines[1].includes("t-0001-11-"), lines[1]);
  assert.ok(lines[50].includes("t-0003-20-"), lines[50]);
  assert.ok(note.length < 200_000);
});

test("SF-08 exactly 50 files: all shown, no line about the earlier ones", () => {
  const state = deepFreeze(
    stateOf([
      stTask(
        1,
        "done",
        Array.from({ length: 50 }, (_, i) => `f${i}.md`),
      ),
    ]),
  );
  const lines = blockOf(planNote(state, FACTS))
    .split("\n")
    .filter((l) => l.startsWith("— "));
  assert.equal(lines.length, 50);
  assert.equal(
    lines.some((l) => l.includes("более ранних")),
    false,
  );
});

// ---- SF-09: a name that looks like a key is masked in the note, the completion works ---

// The bait is made of parts: "ghp_" and 36 characters, a made-up one, not a real key.
const BAIT = ["gh", "p_", "FAKE", "fake", "0".repeat(28)].join("");

test("SF-09 Q7: a file name that looks like a key is shown masked in the note, and the completion by that name still works", () => {
  assert.equal(BAIT.length, 40);
  const state = deepFreeze(stateOf([stTask(1, "done", [BAIT])]));
  const note = planNote(state, FACTS);
  assert.equal(note.includes(BAIT), false, "the bait is in the note");
  const line = blockOf(note)
    .split("\n")
    .find((l) => l.startsWith("— "));
  assert.ok(line.includes("[скрыто]"), line);
  const r = validatePlan(
    { tasks: [item("b", { text: `правь ${BAIT}` })] },
    state,
  );
  assert.equal(r.ok, true);
  assert.deepEqual(dependsOf(r), [["t-0002", ["t-0001"]]]);
});
