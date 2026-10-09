// The check of a result, the check of the goal and the choice of another role in
// the engine of Sai Team (design REQ-013, sections 7.2 and 8; criteria 5 and 8):
// the schemas of the answers and the inputs of these runs.
import { depsOf, defaultContext } from "../runner.js";
import { roleByCode, publicRole } from "../roles.js";
import { TASK_STATUS_TEXT } from "../schema.js";
import { catalogText } from "./plan.js";

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    passed: { type: "boolean" },
    notes: { type: "string", minLength: 1, maxLength: 4000 },
  },
  required: ["passed", "notes"],
  additionalProperties: false,
};

export const REVIEW_ANSWER_SCHEMA = deepFreeze(structuredClone(VERDICT_SCHEMA));
export const GOAL_ANSWER_SCHEMA = deepFreeze(structuredClone(VERDICT_SCHEMA));
export const REASSIGN_ANSWER_SCHEMA = deepFreeze({
  type: "object",
  properties: {
    role: { type: "string", minLength: 1, maxLength: 40 },
    reason: { type: "string", minLength: 1, maxLength: 500 },
  },
  required: ["role", "reason"],
  additionalProperties: false,
});

function title(code) {
  const role = roleByCode(code);
  return role === null ? "" : publicRole(role).title;
}

// The run of the reviewer for one task: the files of this task as `deps`, the
// text and the criterion of the task in its section "Задача" (buildPrompt).
export function reviewContext(writer, task) {
  return {
    ...defaultContext(writer, task),
    deps: depsOf(writer, { depends_on: [task.id] }),
    note: "Проверь результат задачи строго по критерию готовности. Ответ: passed — true, если критерий выполнен полностью; notes — замечания по пунктам.",
  };
}

// The check of the goal: the files of every done task and the list of the tasks
// with their results.
export function goalContext(writer) {
  const state = writer.state;
  const done = state.tasks.filter((t) => t.status === "done");
  const lines = state.tasks.map(
    (t) =>
      `— ${t.id}, ${title(t.role)}: ${t.text} — ${TASK_STATUS_TEXT[t.status]}`,
  );
  return {
    goal: state.goal,
    memory: defaultContext(writer, { depends_on: [] }).memory,
    deps: depsOf(writer, { depends_on: done.map((t) => t.id) }),
    note: [
      "Сверь результаты задач с целью проекта. Ответ: passed — true, если цель достигнута; notes — что не хватает или почему цель достигнута.",
      `Задачи проекта:\n${lines.join("\n")}`,
    ].join("\n\n"),
  };
}

// The choice of another role: the task, its role, every note of the reviewer in
// this cycle and the catalog of roles.
export function reassignNote(state, task, facts) {
  const notes = facts.reviewNotes[task.id] ?? [];
  return [
    "Результат задачи несколько раз не прошёл проверку. Выбери другую роль из каталога, которая лучше справится. Ответ: role — код роли (не текущая), reason — почему.",
    `Задача ${task.id}: ${task.text}\nКритерий готовности: ${task.done_when}\nТекущая роль: ${title(task.role)} (${task.role})`,
    `Замечания проверяющего:\n${notes.map((n) => `— ${n}`).join("\n") || "нет"}`,
    `Роли каталога:\n${catalogText()}`,
  ].join("\n\n");
}
