// Fixtures of the tests of the server of the business interface (design REQ-011,
// section 15): projects in every status of a project and of a task, made only
// through the API of the core. Not a test file.
import { ROLES } from "../src/team/roles.js";
import {
  MIN,
  T0,
  ask,
  clockAt,
  doneIn,
  endRun,
  eng,
  fail,
  planTask,
  project,
  startRun,
  toReview,
  usr,
  withPlan,
  work,
} from "./team-web-helpers.js";

export const AGENT_TEXT = "рост на 12% по JSON-выгрузке";

// A project with a task in every status, a chat about a task, a question, files with
// and without a task. Returns the project of team-web-helpers.project.
export function richProject(t, box, over = {}) {
  const c = clockAt(T0);
  const p = project(t, box, over, { clock: c });
  const w = p.w;
  withPlan(w, [
    planTask("t-0001", "researcher", { text: "Собрать вымышленные цены" }),
    planTask("t-0002", "marketer"),
    planTask("t-0003", "lawyer"),
    planTask("t-0004", "developer"),
    planTask("t-0005", "designer"),
    planTask("t-0006", "support"),
    planTask("t-0007", "researcher", { text: "Вторая задача исследователя" }),
    planTask("t-0008", "business_analyst"),
  ]);
  doneIn(w, c, "t-0001", T0 + MIN, 2 * MIN);
  c.run();
  w.writeResultFile({
    task: null,
    name: "r-00001-plan-input.md",
    content: "вход",
  });
  w.writeResultFile({ task: "t-0001", name: "prices.md", content: AGENT_TEXT });
  work(w, "t-0002");
  toReview(w, "t-0002");
  fail(w, "t-0003", "Источник данных недоступен");
  work(w, "t-0004");
  w.append(eng("TASK_INTERRUPTED", { cause: "stop" }, "t-0004"));
  work(w, "t-0005", ["mockup.md"]);
  work(w, "t-0006");
  toReview(w, "t-0006");
  w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "review_failed", draft: null },
      "t-0006",
    ),
  );
  w.append(eng("PROJECT_WAITING", { reason: "review_failed" }, "t-0006"));
  ask(w, "Изменить задачу или отклонить её?", "t-0006");
  w.append(
    eng(
      "CHAT",
      { text: AGENT_TEXT, kind: "message", truncated: false },
      "t-0001",
    ),
  );
  w.addMemory({ kind: "fact", text: AGENT_TEXT });
  w.say("Сообщение владельца");
  return p;
}

// One project in each status of a project: [status, project].
export function projectsInEveryStatus(t, box) {
  const out = [];
  const created = project(t, box, { executor: "scripted" });
  out.push(["created", created]);
  const planning = project(t, box);
  planning.w.append(usr("PROJECT_STARTED", { parallel: 2 }));
  planning.w.append(eng("PLANNING_STARTED", { round: 0 }));
  out.push(["planning", planning]);
  out.push(["waiting_user", richProject(t, box, { executor: "scripted" })]);
  const running = project(t, box);
  withPlan(running.w, [planTask("t-0001", "researcher")]);
  work(running.w, "t-0001");
  out.push(["running", running]);
  const paused = project(t, box);
  withPlan(paused.w, [planTask("t-0001", "researcher")]);
  paused.w.append(usr("PROJECT_PAUSED"));
  out.push(["paused", paused]);
  const stopped = project(t, box);
  withPlan(stopped.w, [planTask("t-0001", "developer")]);
  stopped.w.append(eng("TASK_STARTED", {}, "t-0001"));
  stopped.w.append(eng("TASK_INTERRUPTED", { cause: "stop" }, "t-0001"));
  stopped.w.append(usr("PROJECT_STOPPED"));
  out.push(["stopped", stopped]);
  const c = clockAt(T0);
  const done = project(t, box, {}, { clock: c });
  withPlan(done.w, [planTask("t-0001", "researcher")]);
  doneIn(done.w, c, "t-0001", T0 + MIN, MIN);
  const g = startRun(done.w, "goal_check", "reviewer");
  done.w.append(eng("GOAL_CHECK_STARTED", { round: 0, run_id: g }));
  done.w.append(
    eng("GOAL_CHECK_RESULT", {
      round: 0,
      run_id: g,
      passed: true,
      notes: "Есть",
    }),
  );
  endRun(done.w, g);
  done.w.append(eng("PROJECT_DONE"));
  out.push(["done", done]);
  const failed = project(t, box);
  failed.w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  failed.w.append(
    eng("PROJECT_FAILED", { reason: "unrecoverable", detail: "Нет доступа" }),
  );
  out.push(["failed", failed]);
  return out;
}

export const ROLE_NUMBERS = ROLES.map((_, i) => i + 1);
