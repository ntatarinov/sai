// Sai Team core: the language module, an event as a phrase for a business owner
// (design REQ-009, TM-38 ... TM-42).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  NEUTRAL_PHRASE,
  PHRASES,
  SCRIPTED_SUFFIX,
  phrase,
  phrasesForJournal,
} from "../src/team/language.js";
import { reduce } from "../src/team/reducer.js";
import { ROLES, ROLE_CODES } from "../src/team/roles.js";
import { EVENT_TYPES } from "../src/team/schema.js";
import { openWriter } from "../src/team/store.js";
import {
  buildDone,
  buildFailed,
  buildStopped,
  crashWriter,
  eng,
  journalOf,
  makeClock,
  makeHome,
  newProject,
  planTask,
  runTeam,
  startProject,
  usr,
  withPlan,
} from "./team-helpers.js";

// ---- the table of the design, written out here (not taken from the module) -------------

const NAME = {
  project_manager: "Руководитель проекта",
  business_analyst: "Аналитик",
  researcher: "Исследователь",
  financial_analyst: "Финансовый аналитик",
  lawyer: "Юрист",
  marketer: "Маркетолог",
  designer: "Дизайнер",
  developer: "Разработчик",
  reviewer: "Проверяющий",
  support: "Специалист поддержки",
};
const GENITIVE = {
  project_manager: "руководителя проекта",
  business_analyst: "бизнес-аналитика",
  researcher: "исследователя",
  financial_analyst: "финансового аналитика",
  lawyer: "юриста",
  marketer: "маркетолога",
  designer: "дизайнера",
  developer: "разработчика",
  reviewer: "проверяющего",
  support: "специалиста поддержки",
};
const STARTED = {
  business_analyst: "Аналитик изучает данные",
  researcher: "Исследователь собирает информацию",
  financial_analyst: "Финансовый аналитик считает показатели",
  lawyer: "Юрист изучает правовые вопросы",
  marketer: "Маркетолог готовит материалы",
  designer: "Дизайнер работает над оформлением",
  developer: "Разработчик работает над решением",
  reviewer: "Проверяющий проверяет результат",
  support: "Специалист поддержки готовит ответы",
  project_manager: "Руководитель проекта работает над задачей",
};
const WAITING = {
  plan_failed: "Не удалось составить план — нужен ваш ответ",
  budget: "Достигнут потолок расходов — нужно ваше решение",
  task_failed: "Задача не получилась — нужно ваше решение",
  review_failed: "Результат не прошёл проверку — нужно ваше решение",
  approval: "От вас требуется решение",
  goal_check_failed: "Цель пока не достигнута — нужно ваше решение",
};

function roleOf(event, before) {
  const { type, data, task } = event;
  if (type === "TASK_CREATED" || type === "RUN_STARTED") return data.role;
  if (type === "AGENT_ACTIVITY" || type === "RUN_FINISHED") {
    return before.runs.open[data.run_id].role;
  }
  return before?.tasks.find((x) => x.id === task)?.role ?? null;
}

// The phrase of the design for an event and the state before it.
function expected(event, before) {
  const { type, data, source } = event;
  const name = NAME[roleOf(event, before)];
  switch (type) {
    case "PROJECT_CREATED":
      return "Создан новый проект";
    case "PROJECT_STARTED":
      return "Команда приступила к работе";
    case "PLANNING_STARTED":
      return data.round === 0
        ? "Руководитель проекта составляет план"
        : "Руководитель проекта добавляет задачи к плану";
    case "PLAN_REJECTED":
      return "Руководитель проекта уточняет план";
    case "PLAN_RETRY":
      return "Руководитель проекта составляет план заново";
    case "PLAN_RECEIVED":
      return `План готов, задач в плане: ${data.tasks.length}`;
    case "PROJECT_WAITING":
      return WAITING[data.reason];
    case "PROJECT_PAUSED":
      return "Проект на паузе";
    case "PROJECT_RESUMED":
      return "Работа над проектом продолжается";
    case "PROJECT_RECOVERED":
      return "Работа команды прервалась — чтобы продолжить, возобновите проект";
    case "PROJECT_STOPPED":
      return "Проект остановлен";
    case "PROJECT_DONE":
      return "Проект выполнен";
    case "PROJECT_FAILED":
      return "Проект завершён без результата";
    case "GOAL_CHECK_STARTED":
      return "Проверяющий сверяет результаты с целью";
    case "GOAL_CHECK_RESULT":
      return data.passed
        ? "Цель проекта достигнута"
        : "Цель пока не достигнута";
    case "BUDGET_SPENT":
      return "Учтены расходы на работу команды";
    case "BUDGET_SET":
      return "Потолок расходов изменён";
    case "CHAT":
      if (source === "USER") return "Новое сообщение от вас";
      return data.kind === "question"
        ? "Команда задала вам вопрос"
        : "Сообщение от команды";
    case "MEMORY_ADDED":
      return {
        fact: "В память проекта добавлен факт",
        decision: "Записано решение",
        note: "Добавлена заметка",
      }[data.kind];
    case "RESULT_FILE":
      return data.kind === "result"
        ? "Готов новый файл с результатом"
        : "Готов черновик";
    case "LOCK_STALE_REMOVED":
      return "Проект снова доступен после неожиданной остановки";
    case "JOURNAL_RECOVERED":
      return "После сбоя отброшена недописанная запись";
    case "TASK_CREATED": {
      const open = data.depends_on
        .map((id) => before.tasks.find((x) => x.id === id))
        .filter((x) => x.status !== "done");
      if (open.length === 1)
        return `Ожидает результат от ${GENITIVE[open[0].role]}`;
      if (open.length > 1) return "Ожидает результаты других задач";
      return `${name}: новая задача`;
    }
    case "TASK_STARTED":
      return STARTED[roleOf(event, before)];
    case "RUN_STARTED": {
      if (data.purpose === "work") {
        const attempt =
          before.tasks.find((x) => x.id === event.task).attempts + 1;
        return attempt === 1
          ? `${name} приступает к задаче`
          : `${name} пробует ещё раз, попытка ${attempt}`;
      }
      return {
        review: "Проверяющий проверяет результат",
        plan: "Руководитель проекта составляет план",
        goal_check: "Проверяющий сверяет результаты с целью",
      }[data.purpose];
    }
    case "AGENT_ACTIVITY":
      return {
        reading: `${name} изучает материалы`,
        searching: "Собирает информацию",
        writing: `${name} готовит документ`,
        thinking: `${name} обдумывает задачу`,
        other: `${name} работает над задачей`,
      }[data.activity];
    case "RUN_FINISHED":
      return {
        ok: `${name}: попытка завершена`,
        network: "Нет доступа к сети",
        timeout: "Задача заняла слишком много времени",
        not_found: "Исполнитель недоступен",
        invalid_output: "Результат пришёл в неверном виде",
        failed: "Попытка не удалась",
        cancelled: "Работа остановлена",
        interrupted: "Работа прервана",
      }[data.outcome];
    case "RUN_REFUSED":
      return "Потолок расходов исчерпан, работа не начата";
    case "TASK_RETRY":
      return `${name} попробует ещё раз`;
    case "TASK_REVIEW":
      return "Результат передан на проверку";
    case "REVIEW_RESULT":
      return data.passed
        ? "Проверка пройдена"
        : "Проверяющий вернул задачу на доработку";
    case "TASK_REASSIGNED":
      return "К проекту подключён дополнительный специалист";
    case "TASK_WAITING_USER":
      return data.reason === "approval"
        ? "Черновик готов — от вас требуется решение"
        : "Результат не удаётся довести — нужно ваше решение";
    case "DECISION_RECEIVED":
      return {
        approve: "Вы одобрили черновик",
        change: "Вы попросили изменить результат",
        reject: "Вы отклонили черновик",
      }[data.decision];
    case "TASK_DONE":
      return data.via === "review"
        ? `${name}: задача готова`
        : "Черновик принят, действие вовне не выполнено";
    case "TASK_FAILED":
      if (data.reason === "rejected_by_user") return "Задача отклонена вами";
      if (data.reason === "result_file")
        return `${name}: файл с результатом не удалось принять`;
      return `${name}: задача не получилась`;
    case "TASK_INTERRUPTED":
      return "Работа над задачей прервана";
    default:
      throw new Error(`no expectation for ${type}`);
  }
}

const SUFFIXED = (type) =>
  type.startsWith("TASK_") ||
  type.startsWith("RUN_") ||
  type === "AGENT_ACTIVITY" ||
  type === "MEMORY_ADDED";

// Checks every event of a journal; returns the types seen.
function checkJournal(events, scripted) {
  let state = null;
  const seen = new Set();
  const phrases = phrasesForJournal(events);
  events.forEach((event, i) => {
    const base = expected(event, state);
    const want =
      scripted && SUFFIXED(event.type) ? `${base}${SCRIPTED_SUFFIX}` : base;
    assert.equal(
      phrase(event, state),
      want,
      `${event.type} (seq ${event.seq})`,
    );
    assert.equal(
      phrases[i],
      want,
      `phrasesForJournal ${event.type} (seq ${event.seq})`,
    );
    seen.add(event.type);
    state = reduce(state, event);
  });
  return seen;
}

// A running project that a real crash left behind (r5: a child process killed by
// SIGKILL holding the lock, then a cut last line); opening it writes the events of the
// recovery (a stale lock, a cut line, closed runs, interrupted tasks, the pause).
function recovered(t, home, clock) {
  const made = newProject(home, clock);
  const dir = path.join(home, made.id);
  const p = { id: made.id, dir, events: path.join(dir, "events.jsonl") };
  crashWriter(home, p.id, "H.leaveRunning(w);");
  fs.appendFileSync(p.events, '{"seq":99,"ts":"2026');
  const w = openWriter(p.id, { home, now: makeClock(Date.now(), 1) });
  t.after(() => w.close());
  return p;
}

// ---- TM-38 ---------------------------------------------------------------------------

test("TM-38 every one of the 37 types has its phrase, in the journals made through the API", (t) => {
  assert.equal(Object.keys(EVENT_TYPES).length, 37);
  const home = makeHome(t);
  const clock = makeClock();
  const seen = new Set();
  const done = startProject(t, home, clock);
  buildDone(done.writer);
  const stopped = startProject(t, home, clock);
  buildStopped(stopped.writer);
  const failed = startProject(t, home, clock);
  buildFailed(failed.writer);
  const crash = recovered(t, home, clock);
  for (const p of [done, stopped, failed, crash]) {
    for (const type of checkJournal(journalOf(p.events), false)) seen.add(type);
  }
  assert.deepStrictEqual([...seen].sort(), Object.keys(EVENT_TYPES).sort());
});

test("TM-38 on a scripted project the phrases of TASK_*, RUN_*, AGENT_ACTIVITY and MEMORY_ADDED end with the suffix, the others do not", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const scripted = startProject(t, home, clock, { executor: "scripted" });
  buildDone(scripted.writer);
  const events = journalOf(scripted.events);
  checkJournal(events, true);
  const phrases = phrasesForJournal(events);
  assert.equal(SCRIPTED_SUFFIX, " — тестовый исполнитель");
  events.forEach((e, i) => {
    assert.equal(
      phrases[i].endsWith(SCRIPTED_SUFFIX),
      SUFFIXED(e.type),
      `${e.type}: ${phrases[i]}`,
    );
  });
  assert.ok(phrases.some((x) => x.endsWith(SCRIPTED_SUFFIX)));
  // the same events of a project of the real executor have none
  const real = startProject(t, home, clock);
  buildDone(real.writer);
  assert.ok(
    phrasesForJournal(journalOf(real.events)).every(
      (x) => !x.includes(SCRIPTED_SUFFIX),
    ),
  );
});

test("TM-38 the table of the design: every role, activity, outcome, reason and decision gives its own phrase", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  withPlan(
    p.writer,
    ROLES.map((r, i) =>
      planTask(`t-${String(i + 1).padStart(4, "0")}`, r.code),
    ),
  );
  const state = structuredClone(p.writer.state);
  for (const [i, role] of ROLE_CODES.entries()) {
    const id = `t-${String(i + 1).padStart(4, "0")}`;
    const open = structuredClone(state);
    open.runs.open["r-00001"] = {
      purpose: "work",
      role,
      task: id,
      executor: "claude-cli",
      started_seq: 1,
    };
    assert.equal(phrase(eng("TASK_STARTED", {}, id), state), STARTED[role]);
    assert.equal(
      phrase(
        eng(
          "RUN_STARTED",
          {
            run_id: "r-00001",
            purpose: "work",
            role,
            executor: "claude-cli",
            max_budget_usd: null,
          },
          id,
        ),
        state,
      ),
      `${NAME[role]} приступает к задаче`,
    );
    const again = structuredClone(state);
    again.tasks[i].attempts = 1;
    assert.equal(
      phrase(
        eng(
          "RUN_STARTED",
          {
            run_id: "r-00001",
            purpose: "work",
            role,
            executor: "claude-cli",
            max_budget_usd: null,
          },
          id,
        ),
        again,
      ),
      `${NAME[role]} пробует ещё раз, попытка 2`,
    );
    assert.equal(
      phrase(
        eng(
          "TASK_RETRY",
          { next_attempt: 2, delay_ms: 0, reason: "failed" },
          id,
        ),
        state,
      ),
      `${NAME[role]} попробует ещё раз`,
    );
    assert.equal(
      phrase(
        eng("TASK_DONE", { via: "review", external_action_done: false }, id),
        state,
      ),
      `${NAME[role]}: задача готова`,
    );
    const activity = (a) =>
      eng(
        "AGENT_ACTIVITY",
        { run_id: "r-00001", activity: a, executor: "claude-cli", text: null },
        id,
      );
    assert.equal(
      phrase({ ...activity("reading"), source: "AGENT" }, open),
      `${NAME[role]} изучает материалы`,
    );
    assert.equal(
      phrase({ ...activity("searching"), source: "AGENT" }, open),
      "Собирает информацию",
    );
    assert.equal(
      phrase({ ...activity("writing"), source: "AGENT" }, open),
      `${NAME[role]} готовит документ`,
    );
    assert.equal(
      phrase({ ...activity("thinking"), source: "AGENT" }, open),
      `${NAME[role]} обдумывает задачу`,
    );
    assert.equal(
      phrase({ ...activity("other"), source: "AGENT" }, open),
      `${NAME[role]} работает над задачей`,
    );
    const finished = (outcome) =>
      eng(
        "RUN_FINISHED",
        {
          run_id: "r-00001",
          outcome,
          summary: null,
          cost_usd: null,
          files: [],
        },
        id,
      );
    assert.equal(
      phrase(finished("ok"), open),
      `${NAME[role]}: попытка завершена`,
    );
    assert.equal(
      phrase(
        eng("TASK_FAILED", { reason: "executor_not_found", detail: "Нет" }, id),
        state,
      ),
      `${NAME[role]}: задача не получилась`,
    );
    assert.equal(
      phrase(
        eng("TASK_FAILED", { reason: "result_file", detail: "Нет" }, id),
        state,
      ),
      `${NAME[role]}: файл с результатом не удалось принять`,
    );
  }
  const open = structuredClone(state);
  open.runs.open["r-00001"] = {
    purpose: "work",
    role: "lawyer",
    task: "t-0005",
    executor: "claude-cli",
    started_seq: 1,
  };
  const finished = (outcome) =>
    eng(
      "RUN_FINISHED",
      { run_id: "r-00001", outcome, summary: null, cost_usd: null, files: [] },
      "t-0005",
    );
  assert.ok(phrase(finished("network"), open).startsWith("Нет доступа к сети"));
  assert.equal(
    phrase(finished("timeout"), open),
    "Задача заняла слишком много времени",
  );
  assert.equal(phrase(finished("not_found"), open), "Исполнитель недоступен");
  assert.equal(
    phrase(finished("invalid_output"), open),
    "Результат пришёл в неверном виде",
  );
  assert.equal(phrase(finished("failed"), open), "Попытка не удалась");
  assert.equal(phrase(finished("cancelled"), open), "Работа остановлена");
  assert.equal(phrase(finished("interrupted"), open), "Работа прервана");
  for (const [reason, text] of Object.entries(WAITING)) {
    assert.equal(phrase(eng("PROJECT_WAITING", { reason }), state), text);
  }
  assert.equal(
    phrase(
      eng("PROJECT_FAILED", { reason: "user_rejected", detail: "Нет" }),
      state,
    ),
    "Проект завершён без результата",
  );
  const decision = (d) =>
    usr("DECISION_RECEIVED", { decision: d, text: null }, "t-0001");
  assert.equal(phrase(decision("approve"), state), "Вы одобрили черновик");
  assert.equal(
    phrase(decision("change"), state),
    "Вы попросили изменить результат",
  );
  assert.equal(phrase(decision("reject"), state), "Вы отклонили черновик");
  assert.equal(
    phrase(
      eng(
        "TASK_FAILED",
        { reason: "rejected_by_user", detail: "Нет" },
        "t-0001",
      ),
      state,
    ),
    "Задача отклонена вами",
  );
  assert.equal(
    phrase(
      eng(
        "TASK_DONE",
        { via: "approval", external_action_done: false },
        "t-0001",
      ),
      state,
    ),
    "Черновик принят, действие вовне не выполнено",
  );
  assert.equal(
    phrase(eng("PLANNING_STARTED", { round: 1 }), state),
    "Руководитель проекта добавляет задачи к плану",
  );
  const created = (role, deps) =>
    eng(
      "TASK_CREATED",
      { role, text: "Т", done_when: "Г", depends_on: deps, critical: false },
      "t-0011",
    );
  assert.equal(
    phrase(created("marketer", ["t-0001", "t-0002"]), state),
    "Ожидает результаты других задач",
  );
  assert.equal(
    phrase(created("marketer", []), state),
    "Маркетолог: новая задача",
  );
  assert.equal(
    phrase(
      eng(
        "TASK_REASSIGNED",
        { from_role: "lawyer", to_role: "marketer", reason: "Нет" },
        "t-0005",
      ),
      state,
    ),
    "К проекту подключён дополнительный специалист",
  );
});

// ---- TM-39 ---------------------------------------------------------------------------

test("TM-39 the three samples of the owner, through the command events", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  withPlan(w, [
    planTask("t-0001", "financial_analyst"),
    planTask("t-0002", "business_analyst"),
    planTask("t-0003", "lawyer"),
  ]);
  w.addTask({
    role: "marketer",
    text: "Подготовить письмо",
    done_when: "Письмо готово",
    depends_on: ["t-0001"],
  });
  w.append(eng("TASK_STARTED", {}, "t-0002"));
  w.append(
    eng(
      "TASK_REASSIGNED",
      {
        from_role: "lawyer",
        to_role: "researcher",
        reason: "Нужны данные",
      },
      "t-0003",
    ),
  );
  w.close();
  const r = runTeam(home, ["events", p.id, "--limit", "200"]);
  assert.equal(r.status, 0, r.stderr);
  const phraseOf = (type) =>
    JSON.parse(r.stdout).events.find((e) => e.type === type).phrase;
  assert.equal(phraseOf("TASK_STARTED"), "Аналитик изучает данные");
  assert.equal(
    phraseOf("TASK_CREATED"),
    "Ожидает результат от финансового аналитика",
  );
  assert.equal(
    phraseOf("TASK_REASSIGNED"),
    "К проекту подключён дополнительный специалист",
  );
});

// ---- TM-40 ---------------------------------------------------------------------------

const FORBIDDEN = [
  "токен",
  "контекст",
  "промт",
  "prompt",
  "token",
  "context",
  "json",
  "stderr",
  "exit",
  "%",
  "процент",
  "percent",
  "настоящий",
  "реальный",
  "claude",
  "демо",
  "demo",
  "демонстрац",
];
const FORBIDDEN_WORDS = [
  /(?<![\p{L}])ии(?![\p{L}])/iu,
  /(?<![\p{L}])ai(?![\p{L}])/iu,
];

function assertClean(text, where) {
  const low = text.toLowerCase();
  for (const word of FORBIDDEN)
    assert.ok(!low.includes(word), `${where}: "${text}" has "${word}"`);
  for (const re of FORBIDDEN_WORDS)
    assert.doesNotMatch(text, re, `${where}: "${text}"`);
}

test("TM-40 no phrase of the table or of the fixtures has a technical word", (t) => {
  assert.ok(PHRASES.length >= 70);
  for (const row of PHRASES) assertClean(row.text, `PHRASES ${row.type}`);
  assertClean(NEUTRAL_PHRASE, "NEUTRAL_PHRASE");
  assertClean(SCRIPTED_SUFFIX, "SCRIPTED_SUFFIX");
  const home = makeHome(t);
  const clock = makeClock();
  for (const executor of ["claude-cli", "scripted"]) {
    const p = startProject(t, home, clock, { executor });
    buildDone(p.writer);
    for (const text of phrasesForJournal(journalOf(p.events)))
      assertClean(text, executor);
  }
  // the checker itself catches what it is for
  for (const bad of [
    "Токен кончился",
    "Это JSON",
    "Работает ИИ",
    "Реальный запуск",
    "Exit 1",
    "50%",
    "Claude отвечает",
  ]) {
    assert.throws(() => assertClean(bad, "self-test"));
  }
});

// ---- TM-41 ---------------------------------------------------------------------------

test("TM-41 an unknown type gives the neutral phrase and never the code of the type", () => {
  assert.equal(NEUTRAL_PHRASE, "В проекте произошли изменения");
  for (const type of [
    "NO_SUCH_TYPE",
    "TASK_EXPLODED",
    "__proto__",
    "constructor",
    "toString",
    "hasOwnProperty",
    "",
    5,
    null,
    undefined,
  ]) {
    const text = phrase(
      { seq: 1, source: "ENGINE", type, task: null, data: {} },
      null,
    );
    assert.equal(text, NEUTRAL_PHRASE, String(type));
    if (typeof type === "string" && type !== "")
      assert.ok(!text.includes(type));
  }
  assert.equal(phrase({}, null), NEUTRAL_PHRASE);
  assert.equal(phrase(null, null), NEUTRAL_PHRASE);
  assert.equal(phrase(undefined, null), NEUTRAL_PHRASE);
  assert.equal(phrase("PROJECT_DONE", null), NEUTRAL_PHRASE);
});

// ---- TM-42 ---------------------------------------------------------------------------

test("TM-42 no phrase has the code of a role; phrases about tasks have the name or the genitive of the role", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  for (const code of ROLE_CODES) {
    for (const row of PHRASES) {
      assert.ok(
        !row.text.includes(code),
        `${row.type}: "${row.text}" has ${code}`,
      );
    }
  }
  for (const executor of ["claude-cli", "scripted"]) {
    const p = startProject(t, home, clock, { executor });
    buildDone(p.writer);
    for (const text of phrasesForJournal(journalOf(p.events))) {
      for (const code of ROLE_CODES)
        assert.ok(!text.includes(code), `"${text}" has ${code}`);
    }
  }
  const q = startProject(t, home, clock);
  withPlan(
    q.writer,
    ROLES.map((r, i) =>
      planTask(`t-${String(i + 1).padStart(4, "0")}`, r.code),
    ),
  );
  const state = structuredClone(q.writer.state);
  ROLES.forEach((role, i) => {
    const id = `t-${String(i + 1).padStart(4, "0")}`;
    assert.ok(
      phrase(
        eng(
          "TASK_RETRY",
          { next_attempt: 2, delay_ms: 0, reason: "failed" },
          id,
        ),
        state,
      ).includes(role.name),
      role.code,
    );
    assert.ok(
      phrase(
        eng("TASK_DONE", { via: "review", external_action_done: false }, id),
        state,
      ).includes(role.name),
      role.code,
    );
    const fresh = structuredClone(state);
    const created = eng(
      "TASK_CREATED",
      {
        role: "support",
        text: "Т",
        done_when: "Г",
        depends_on: [id],
        critical: false,
      },
      "t-0011",
    );
    assert.ok(phrase(created, fresh).includes(role.genitive), role.code);
  });
});
