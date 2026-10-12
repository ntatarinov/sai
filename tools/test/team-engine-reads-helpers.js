// Helpers of the tests of ISS-0023 (design docs/design/ISS-0023-reviewer-sees-
// result-file.md, section 7.0): a project of the claude-cli executor whose
// executable is the fake fake-claude-reads.js. Not a test file.
//
// Every project here is made after assertSafeEnv (AP-025): the data folder and HOME
// are temporary, the executable is the fake file of fixtures/team. Nothing here
// calls a model or goes to the network.
import fs from "node:fs";
import path from "node:path";
import { createProject } from "../src/team/store.js";
import {
  FIXTURES,
  assertSafeEnv,
  execEnv,
  journal,
  makeSandbox,
} from "./exec-helpers.js";
import { assertDoneAfterGoal } from "./team-engine-helpers.js";

export const FAKE_READS = path.join(FIXTURES, "fake-claude-reads.js");
export const MEMO = "memo_research.md";
export const MEMO_TEXT = "# Совет 1\nКофе в подарок за пятую чашку.\n";
// A bait of the full length: "ghp_" and 36 characters (a shorter one is not masked).
export const BAIT = "ghp_FAKEfake0000000000000000000000000000";

export const EVENTS_END = [
  "PROJECT_DONE",
  "TASK_WAITING_USER",
  "PROJECT_WAITING",
  "PROJECT_FAILED",
];

function readLines(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  return text
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => JSON.parse(l));
}

// spec = { goal, tasks: [plan item], work: [{ when?, files, answer? }],
//          reviewTask?: true, over?: env,
//          plans?: [plan answer], goalScript?: [{ passed, notes }],
//          probes?: [string] }   (ISS-0031: the three optional fields are written
//                                 to plan.json as plans, goal_script, probes)
// -> { sb, env, id, dir, events, fakeDir, log(), stdins() }
export function readsProject(t, spec) {
  const sb = makeSandbox(t);
  const env = execEnv(sb, {
    SAI_TEAM_CLAUDE_BIN: FAKE_READS,
    ...(spec.over ?? {}),
  });
  assertSafeEnv(env);
  const fakeDir = path.join(sb.user, "fake-claude-reads");
  fs.mkdirSync(fakeDir, { recursive: true, mode: 0o700 });
  const plan = {
    plan: { tasks: spec.tasks ?? spec.plans?.[0]?.tasks },
    work: spec.work,
    reassign_role: "researcher",
  };
  if (spec.reviewTask === true) plan.review_task = "yes";
  if (spec.plans !== undefined) plan.plans = spec.plans;
  if (spec.goalScript !== undefined) plan.goal_script = spec.goalScript;
  if (spec.probes !== undefined) plan.probes = spec.probes;
  fs.writeFileSync(path.join(fakeDir, "plan.json"), JSON.stringify(plan));
  const { id } = createProject(
    { goal: spec.goal, budget_usd: 5, executor: "claude-cli" },
    { home: sb.home },
  );
  const dir = path.join(sb.home, id);
  const p = {
    sb,
    env,
    id,
    dir,
    events: path.join(dir, "events.jsonl"),
    fakeDir,
    log: () => readLines(path.join(fakeDir, "log.jsonl")),
    stdins: () =>
      fs
        .readdirSync(fakeDir)
        .filter((f) => /^stdin-[0-9]+\.bin$/u.test(f))
        .map((f) => ({
          n: Number(/[0-9]+/u.exec(f)[0]),
          text: fs.readFileSync(path.join(fakeDir, f), "utf8"),
        }))
        .sort((a, b) => a.n - b.n),
  };
  t.after(() => {
    if (fs.existsSync(p.events)) assertDoneAfterGoal(journal(p));
  });
  return p;
}

// The predicate "an event that ends the wait of a project".
export const isEnd = (e) => EVENTS_END.includes(e.type);

// The end of the wait for one task: it is done, or the project waits for the user.
export const isTaskEnd = (e) => e.type === "TASK_DONE" || isEnd(e);
