// ISS-0031 (design docs/design/ISS-0031-second-round-file-dependency.md, sections 6
// and 7; criterion 15 of REQ-013, decision 0043): a task of the second round of the
// plan that names the file a task of the first round gave gets that file through a
// dependency. The engine runs with the claude-cli executor and the fake
// fixtures/team/fake-claude-reads.js (after assertSafeEnv, AP-025): no model, no
// network. The fake answers the planner by the number of its run (`plans`), the check
// of the goal by the script (`goalScript`: not passed, then passed) and writes into
// its log what the stdin of every run has (`probes`).
//
// What is proved: with a fake that decides by its input, the task that names an
// accepted file gets it, and nothing else does. What the real planner writes is
// not proved here (design, section 9; REQ-013 criterion 13 waits for the owner).
//
// Every test makes its own projects in their own temporary folders; nothing is
// shared. The bait is made of parts and is not a real key.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { journal } from "./exec-helpers.js";
import {
  item,
  pauseAndExit,
  startEngine,
  until,
} from "./team-engine-helpers.js";
import { isEnd, readsProject } from "./team-engine-reads-helpers.js";
import { validatePlan } from "../src/team/engine/plan.js";

const ONE = "one_pager.md";
const LABEL = "ЧЕРНОВИК-ОДНОСТРАНИЧНИК";
const BAIT = ["gh", "p_", "FAKE", "fake", "0".repeat(28)].join("");
const ACCEPTED = `t-0001-1-${ONE}`;
const PROBES = [ACCEPTED, LABEL, ONE];
const GOAL = "Одностраничник для кофейни";

const ofType = (events, type) => events.filter((e) => e.type === type);

const FIRST = item("a", {
  role: "designer",
  text: "Составь одностраничник для кофейни",
  done_when: `Файл сохранён в ${ONE}`,
});

// The marker of a task of the second round: it is in the text of the task, so that
// the work entry `when` and the search of the run of that task find it.
const task2 = (key, over = {}) =>
  item(key, {
    role: "designer",
    text: `МЕТКА-${key} правь что-нибудь`,
    done_when: "Есть итог",
    ...over,
  });

function twoRounds(second, over = {}) {
  return {
    goal: GOAL,
    plans: [{ tasks: [FIRST] }, { tasks: second }],
    goalScript: [
      { passed: false, notes: "Одностраничник нужно поправить" },
      { passed: true, notes: "Теперь хорошо" },
    ],
    probes: PROBES,
    reviewTask: true,
    work: [
      {
        files: [
          { path: ONE, content: `${LABEL}\nКлюч: ${BAIT}\nКофе в подарок\n` },
        ],
      },
      ...second.map((s) => ({
        when: `МЕТКА-${s.key}`,
        files: [],
      })),
    ],
    ...over,
  };
}

// Runs the project to its end; returns the events.
async function runProject(t, p) {
  const e = startEngine(t, p);
  await until(p, isEnd, "PROJECT_DONE or a wait");
  await pauseAndExit(e);
  return journal(p);
}

// The log line of the work run of the task with the marker.
function workRunOf(p, key) {
  const marker = `МЕТКА-${key}`;
  const stdins = p.stdins();
  const runs = p
    .log()
    .filter(
      (l) =>
        l.purpose === "work" &&
        stdins.find((s) => s.n === l.n).text.includes(marker),
    );
  assert.equal(runs.length, 1, `the work runs of ${key}: ${runs.length}`);
  return runs[0];
}

const planRuns = (p) => p.log().filter((l) => l.purpose === "plan");
const received = (events) => ofType(events, "PLAN_RECEIVED");
const dependsOf = (events, round, i = 0) =>
  received(events)[round].data.tasks[i].depends_on;

// ---- SF-10: criterion 15 (a), the name in the text ------------------------------------

test(
  "SF-10 criterion 15 (a): the task of the second round names the accepted file in its text and has no depends_on - it gets the file through the dependency",
  { timeout: 90_000 },
  async (t) => {
    const p = readsProject(
      t,
      twoRounds([task2("b", { text: `МЕТКА-b правь ${ONE}` })]),
    );
    const events = await runProject(t, p);
    assert.equal(received(events).length, 2);
    assert.deepEqual(dependsOf(events, 1), ["t-0001"]);
    // The first outcome of the criterion: no rejection and no second request.
    assert.equal(ofType(events, "PLAN_REJECTED").length, 0);
    assert.equal(ofType(events, "PLAN_RETRY").length, 0);
    assert.equal(planRuns(p).length, 2);
    // The executor of the task got the accepted name and the content.
    const run = workRunOf(p, "b");
    assert.equal(run.deps_header, true, JSON.stringify(run));
    assert.equal(run.probes[ACCEPTED], true);
    assert.equal(run.probes[LABEL], true);
    // The planner of the second round saw the name, never the content.
    const second = p.stdins().find((s) => s.n === planRuns(p)[1].n).text;
    assert.ok(second.includes("Принятые файлы проекта"));
    assert.ok(
      second.includes(`— ${ONE} (задача t-0001, принят как ${ACCEPTED})`),
    );
    assert.equal(second.includes(LABEL), false);
    assert.equal(ofType(events, "PROJECT_DONE").length, 1);
  },
);

// ---- SF-11: the name only in done_when --------------------------------------------------

test(
  "SF-11 criterion 15 (a): the file is named only in done_when - the same, and the executor never starts with an empty folder and no section of dependencies",
  { timeout: 90_000 },
  async (t) => {
    const p = readsProject(
      t,
      twoRounds([task2("b", { done_when: `Файл сохранён в ${ONE}` })]),
    );
    const events = await runProject(t, p);
    assert.deepEqual(dependsOf(events, 1), ["t-0001"]);
    assert.equal(ofType(events, "PLAN_REJECTED").length, 0);
    const works = p.log().filter((l) => l.purpose === "work");
    const second = works.filter((l) =>
      p
        .stdins()
        .find((s) => s.n === l.n)
        .text.includes("МЕТКА-b"),
    );
    assert.ok(second.length >= 1);
    for (const w of second) {
      assert.equal(w.deps_header, true, JSON.stringify(w));
      assert.equal(w.probes[ACCEPTED], true);
      assert.equal(w.probes[LABEL], true);
    }
    assert.equal(ofType(events, "PROJECT_DONE").length, 1);
  },
);

// ---- SF-12: criterion 15 (b), nothing extra ---------------------------------------------

const NOT_NAMED = [
  ["e1", "правь One_Pager.md"],
  ["e2", "правь one_pager"],
  ["e3", "правь my_one_pager.md"],
  ["e4", "правь one_pager.mdx"],
  ["e5", "правь one_pager.md.bak"],
];

test(
  "SF-12 criterion 15 (b): a task that names no accepted file, a new file nobody gave and the 'does not name' texts get no dependency, no file, and the plan is not rejected",
  { timeout: 120_000 },
  async (t) => {
    const second = [
      task2("c"),
      task2("d", { text: "МЕТКА-d создай new_file.md" }),
      ...NOT_NAMED.map(([key, said]) =>
        task2(key, { text: `МЕТКА-${key} ${said}` }),
      ),
    ];
    const p = readsProject(t, twoRounds(second));
    const events = await runProject(t, p);
    assert.equal(received(events).length, 2);
    for (let i = 0; i < second.length; i += 1) {
      assert.deepEqual(dependsOf(events, 1, i), [], second[i].key);
    }
    assert.equal(ofType(events, "PLAN_REJECTED").length, 0);
    assert.equal(ofType(events, "PLAN_RETRY").length, 0);
    for (const s of second) {
      const run = workRunOf(p, s.key);
      assert.equal(run.deps_header, false, s.key);
      // The text of the task itself holds the original name; what only a
      // dependency brings is the accepted name and the content.
      assert.equal(run.probes[ACCEPTED], false, s.key);
      assert.equal(run.probes[LABEL], false, s.key);
    }
    // The state did not change by it: the only accepted file is the first one.
    assert.deepEqual(fs.readdirSync(path.join(p.dir, "files")), [ACCEPTED]);
    assert.deepEqual(fs.readdirSync(path.join(p.dir, "work")), []);
    assert.equal(ofType(events, "PROJECT_DONE").length, 1);
  },
);

// ---- SF-13: criterion 15 (c), the protection --------------------------------------------

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.lstatSync(full);
    out.push({ full, st });
    if (st.isDirectory()) walk(full, out);
  }
  return out;
}

const FOUND = (root, needle, except) =>
  walk(root)
    .filter(({ full, st }) => st.isFile() && path.basename(full) !== except)
    .filter(({ full }) => fs.readFileSync(full).includes(needle))
    .map(({ full }) => path.basename(full));

test(
  "SF-13 criterion 15 (c): the bait of a key is found nowhere on disk after the second round and is masked in the content the task got; a second project holds nothing of the first",
  { timeout: 120_000 },
  async (t) => {
    const p = readsProject(
      t,
      twoRounds([task2("b", { text: `МЕТКА-b правь ${ONE}` })]),
    );
    const events = await runProject(t, p);
    assert.deepEqual(dependsOf(events, 1), ["t-0001"]);
    const run = workRunOf(p, "b");
    const input = p.stdins().find((s) => s.n === run.n).text;
    assert.ok(input.includes(LABEL), "the task got the content");
    assert.ok(input.includes("[скрыто]"), "the secret is masked, not removed");
    assert.equal(input.includes(BAIT), false);
    // grep -r over the project folder and the folder of the fake (not its plan).
    assert.deepEqual(FOUND(p.dir, BAIT, null), []);
    assert.deepEqual(FOUND(p.fakeDir, BAIT, "plan.json"), []);
    assert.deepEqual(fs.readdirSync(path.join(p.dir, "work")), []);

    // A second project of the same test: another goal, own folders, own id.
    const OTHER = "ВТОРОЙ-ПРОЕКТ";
    const q = readsProject(t, {
      goal: `${OTHER} цель`,
      tasks: [
        item("z", {
          text: `${OTHER}-задача`,
          done_when: `Файл сохранён в second.md`,
        }),
      ],
      work: [
        { files: [{ path: "second.md", content: `${OTHER}-СОДЕРЖИМОЕ\n` }] },
      ],
      goalScript: [{ passed: true, notes: "Хорошо" }],
      probes: [],
      reviewTask: true,
    });
    assert.notEqual(q.id, p.id);
    const qEvents = await runProject(t, q);
    assert.equal(ofType(qEvents, "PROJECT_DONE").length, 1);
    for (const needle of [BAIT, LABEL, ONE, ACCEPTED, p.id, GOAL]) {
      assert.deepEqual(FOUND(q.dir, needle, null), [], needle);
      assert.deepEqual(FOUND(q.fakeDir, needle, "plan.json"), [], needle);
    }
    for (const l of q.log()) {
      for (const [k, v] of Object.entries(l.probes ?? {})) {
        assert.equal(v, false, `run ${l.n} of the second project has ${k}`);
      }
      // The check of the goal shows the files of its own project: only the
      // work runs hold no section of dependencies here.
      if (l.purpose === "work") assert.equal(l.deps_header, false);
    }
    // And the other way round: the first project holds nothing of the second.
    assert.deepEqual(FOUND(p.dir, OTHER, null), []);
    assert.deepEqual(FOUND(p.fakeDir, OTHER, "plan.json"), []);
  },
);

// ---- SF-14: the border of the work: what is not included stays as it was ----------------

test(
  "SF-14 not included: a source in the same plan gets no dependency (the file does not exist when the plan is checked)",
  { timeout: 90_000 },
  async (t) => {
    const p = readsProject(t, {
      goal: GOAL,
      tasks: [
        FIRST,
        item("b", {
          role: "designer",
          text: `МЕТКА-b правь ${ONE}`,
          done_when: "Есть итог",
        }),
      ],
      work: [
        { files: [{ path: ONE, content: `${LABEL}\n` }] },
        { when: "МЕТКА-b", files: [] },
      ],
      goalScript: [{ passed: true, notes: "Хорошо" }],
      probes: PROBES,
      reviewTask: true,
    });
    const events = await runProject(t, p);
    assert.equal(received(events).length, 1);
    assert.deepEqual(dependsOf(events, 0, 0), []);
    assert.deepEqual(dependsOf(events, 0, 1), []);
    assert.equal(ofType(events, "PLAN_REJECTED").length, 0);
    assert.equal(workRunOf(p, "b").deps_header, false);
  },
);

function stateWith(tasks) {
  return {
    tasks: tasks.map(([n, status, files]) => ({
      id: `t-000${n}`,
      status,
      files: files.map((f) => `t-000${n}-1-${f}`),
    })),
  };
}

test("SF-14 not included: the file of a task that is not 'done' and a name with a folder give no dependency, the answer is returned as it is", () => {
  const answer = {
    tasks: [
      item("b", { text: `правь ${ONE}` }),
      item("c", { text: `правь out/${ONE}` }),
    ],
  };
  for (const status of ["running", "review", "failed", "waiting_user"]) {
    const r = validatePlan(answer, stateWith([[1, status, [ONE]]]));
    assert.equal(r.ok, true, status);
    assert.deepEqual(
      r.tasks.map((x) => x.depends_on),
      [[], []],
      status,
    );
  }
});

test("SF-14 control: the same plan and a done task that gave the file - the file is given, the name with a folder is still not named", () => {
  const answer = {
    tasks: [
      item("b", { text: `правь ${ONE}` }),
      item("c", { text: `правь out/${ONE}` }),
    ],
  };
  const done = validatePlan(answer, stateWith([[1, "done", [ONE]]]));
  assert.deepEqual(
    done.tasks.map((x) => x.depends_on),
    [["t-0001"], []],
  );
});

// ---- SF-15: a dependency the planner has put itself ------------------------------------

test(
  "SF-15 the planner puts the dependency itself: the core does not repeat it, the plan is accepted as it came, the task gets the file",
  { timeout: 90_000 },
  async (t) => {
    const p = readsProject(
      t,
      twoRounds([
        task2("b", { text: `МЕТКА-b правь ${ONE}`, depends_on: ["t-0001"] }),
      ]),
    );
    const events = await runProject(t, p);
    assert.deepEqual(dependsOf(events, 1), ["t-0001"]);
    assert.equal(ofType(events, "PLAN_REJECTED").length, 0);
    assert.equal(ofType(events, "PLAN_RETRY").length, 0);
    const run = workRunOf(p, "b");
    assert.equal(run.deps_header, true);
    assert.equal(run.probes[ACCEPTED], true);
    assert.equal(ofType(events, "PROJECT_DONE").length, 1);
  },
);
