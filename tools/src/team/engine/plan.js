// The planner of the engine of Sai Team (design REQ-013, section 5; criterion 1):
// the schema of the answer of the project manager, the check of a plan in a fixed
// order and the order of its tasks. A pure module without Node API.
//
// The values of an answer are data: no field of a plan changes the executor, the
// ceiling, the flags or the fields of the project (Q7).
import { checkAnswer } from "../executor.js";
import { taskIdFor } from "../reducer.js";
import { ROLES, ROLE_CODES, publicRole } from "../roles.js";
import { LIMITS, TASK_STATUS_TEXT } from "../schema.js";
import { closedTasks } from "./answers.js";

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

// Section 5.2: freer than the rules of the engine, so that 41 tasks or a role out
// of the catalog are their own faults and not "schema".
export const PLAN_ANSWER_SCHEMA = deepFreeze({
  type: "object",
  properties: {
    tasks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          key: { type: "string", minLength: 1, maxLength: 20 },
          role: { type: "string", minLength: 1, maxLength: 40 },
          text: { type: "string", minLength: 1, maxLength: 4000 },
          done_when: { type: "string", minLength: 1, maxLength: 2000 },
          depends_on: {
            type: "array",
            maxItems: 40,
            items: { type: "string", minLength: 1, maxLength: 20 },
          },
          critical: { type: "boolean" },
        },
        required: [
          "key",
          "role",
          "text",
          "done_when",
          "depends_on",
          "critical",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["tasks"],
  additionalProperties: false,
});

const KEY_PATTERN = /^[a-z0-9_-]{1,20}$/;
const TASK_ID = /^t-[0-9]{4}$/;

// The constant texts of a rejected plan (section 5.3); `<key>` only after its
// check by the pattern, never the role or the text of the answer.
export const PLAN_DETAIL = Object.freeze({
  schema: (field) =>
    field === null
      ? "План не соответствует схеме"
      : `План не соответствует схеме: ${field}`,
  too_many_plan: () => `В плане больше ${LIMITS.PLAN_TASKS_MAX} задач`,
  too_many_project: () =>
    `В проекте будет больше ${LIMITS.PROJECT_TASKS_MAX} задач`,
  unknown_role: (key) => `Роль задачи ${key} не из каталога`,
  bad_dependency: (key) => `Задача ${key} ссылается на несуществующую задачу`,
  cycle: () => "В зависимостях плана есть цикл",
});

// "$.tasks[3].done_when" -> "tasks.3.done_when"; the path names only fields of the
// schema and numbers.
function fieldOf(pathText) {
  const field = pathText
    .replace(/^\$\.?/, "")
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/^\./, "");
  return field === "" ? null : field;
}

function reject(reason, detail) {
  return { ok: false, reason, detail };
}

// A stable topological order: the first item (in the order of the answer) whose
// dependencies inside the plan are all placed. Items: { key, depends_on } where a
// dependency is a key of the plan or the id of an existing task. Items of a cycle
// are not returned.
export function orderPlan(items) {
  const keys = new Set(items.map((i) => i.key));
  const placed = new Set();
  const out = [];
  let progress = true;
  while (out.length < items.length && progress) {
    progress = false;
    for (const item of items) {
      if (placed.has(item.key)) continue;
      const ready = item.depends_on.every((d) => !keys.has(d) || placed.has(d));
      if (ready) {
        placed.add(item.key);
        out.push(item);
        progress = true;
        break;
      }
    }
  }
  return out;
}

// Section 5.3: { ok: true, tasks: PlanTask[] } or { ok: false, reason, detail }.
export function validatePlan(answer, state) {
  // 1. The schema, the pattern of the keys, no repeated key, no blank text.
  const checked = checkAnswer(PLAN_ANSWER_SCHEMA, answer);
  if (!checked.ok) {
    return reject("schema", PLAN_DETAIL.schema(fieldOf(checked.path)));
  }
  const items = answer.tasks;
  const seen = new Set();
  for (const [i, item] of items.entries()) {
    if (!KEY_PATTERN.test(item.key) || seen.has(item.key)) {
      return reject("schema", PLAN_DETAIL.schema(`tasks.${i}.key`));
    }
    seen.add(item.key);
    for (const field of ["text", "done_when"]) {
      if (item[field].trim() === "") {
        return reject("schema", PLAN_DETAIL.schema(`tasks.${i}.${field}`));
      }
    }
  }
  // 2. The number of tasks.
  if (items.length > LIMITS.PLAN_TASKS_MAX) {
    return reject("too_many", PLAN_DETAIL.too_many_plan());
  }
  if (state.tasks.length + items.length > LIMITS.PROJECT_TASKS_MAX) {
    return reject("too_many", PLAN_DETAIL.too_many_project());
  }
  // 3. The roles of the catalog.
  for (const item of items) {
    if (!ROLE_CODES.includes(item.role)) {
      return reject("unknown_role", PLAN_DETAIL.unknown_role(item.key));
    }
  }
  // 4. Every dependency: another key of this plan or a task of the project.
  const existing = new Set(state.tasks.map((t) => t.id));
  for (const item of items) {
    for (const dep of item.depends_on) {
      const inPlan = seen.has(dep) && dep !== item.key;
      const inProject = TASK_ID.test(dep) && existing.has(dep);
      if (!inPlan && !inProject) {
        return reject("bad_dependency", PLAN_DETAIL.bad_dependency(item.key));
      }
    }
  }
  // 5. No cycle among the keys of the plan.
  const ordered = orderPlan(
    items.map((item) => ({
      ...item,
      depends_on: [...new Set(item.depends_on)],
    })),
  );
  if (ordered.length !== items.length) {
    return reject("cycle", PLAN_DETAIL.cycle());
  }
  const idOf = new Map();
  ordered.forEach((item, i) => {
    idOf.set(item.key, taskIdFor(state.tasks.length + i + 1));
  });
  const tasks = ordered.map((item) => ({
    id: idOf.get(item.key),
    role: item.role,
    text: item.text,
    done_when: item.done_when,
    depends_on: item.depends_on.map((d) => (idOf.has(d) ? idOf.get(d) : d)),
    critical: item.critical,
  }));
  return { ok: true, tasks };
}

// ---- the note of the planner (section 7.2) ------------------------------------------

const CHAT_CONTEXT_MAX = 20;

function roleTitle(code) {
  const role = ROLES.find((r) => r.code === code);
  return role === undefined ? "" : publicRole(role).title;
}

export function catalogText() {
  return ROLES.map((r) => `— ${r.code}: ${publicRole(r).title}`).join("\n");
}

const FAILED_WORDS = Object.freeze({
  rejected_by_user: "отклонена пользователем",
  dependency_closed: "зависела от отклонённой задачи",
});

function taskLine(t) {
  const why =
    t.status === "failed" && Object.hasOwn(FAILED_WORDS, t.reason)
      ? ` (${FAILED_WORDS[t.reason]})`
      : "";
  return `— ${t.id}, ${roleTitle(t.role)}: ${t.text} — ${TASK_STATUS_TEXT[t.status]}${why}`;
}

function closedLine(t) {
  const how =
    t.reason === "dependency_closed"
      ? "закрыта: зависела от отклонённой задачи"
      : "отклонена пользователем";
  const text =
    t.last_decision !== null && t.last_decision.text !== null
      ? `; решение пользователя: ${t.last_decision.text}`
      : "";
  return `— ${t.id}: ${t.text} — ${how}${text}`;
}

// The note of a run of the planner: constant headers, data as it is (masked by the
// core). rejection: the detail of the rejected first attempt, or null.
export function planNote(state, facts, rejection = null) {
  const parts = [];
  if (rejection !== null) parts.push(`Предыдущий план отклонён: ${rejection}`);
  parts.push(
    [
      "Составь план: tasks — список задач; у каждой key (латиница, цифры, _ и -, до 20 знаков), role (код роли из каталога), text, done_when (критерий готовности), depends_on (ключи задач этого плана или номера задач проекта), critical (true — действие вовне: готовится только черновик).",
      `Не больше ${LIMITS.PLAN_TASKS_MAX} задач.`,
    ].join(" "),
  );
  parts.push(`Роли каталога:\n${catalogText()}`);
  parts.push(`Раунд плана: ${state.plan.round}`);
  if (state.tasks.length > 0) {
    parts.push(`Задачи проекта:\n${state.tasks.map(taskLine).join("\n")}`);
  }
  const closed = closedTasks(state)
    .filter((id) => facts.closedSincePlan.includes(id))
    .map((id) => state.tasks.find((t) => t.id === id));
  if (closed.length > 0) {
    parts.push(
      `Закрытые задачи после прошлого плана:\n${closed.map(closedLine).join("\n")}`,
    );
  }
  if (facts.goalNotes !== null && state.goal_check.passed === false) {
    parts.push(`Замечания сверки цели:\n${facts.goalNotes}`);
  }
  const messages = state.chat
    .filter((c) => c.source === "USER" && c.kind === "message")
    .slice(-CHAT_CONTEXT_MAX);
  if (messages.length > 0) {
    parts.push(
      `Сообщения пользователя:\n${messages.map((c) => `— ${c.text}`).join("\n")}`,
    );
  }
  return parts.join("\n\n");
}
