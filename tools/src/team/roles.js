// The catalog of the ten roles of the virtual team (design REQ-009, section 8;
// criterion 10). A pure module without Node API.
//
// `internal` is the internal mapping of a role (the prompt and the tools of the
// executor), filled from role-internal.js (design REQ-010, section 7). It never
// leaves the core: the views and the phrases take a role only through publicRole().
import { ROLE_INTERNAL } from "./role-internal.js";

function role(code, title, name, genitive, description) {
  const internal = ROLE_INTERNAL[code];
  return Object.freeze({
    code,
    title,
    name,
    genitive,
    description,
    internal: Object.freeze({
      prompt: internal.prompt,
      tools: Object.freeze([...internal.tools]),
    }),
  });
}

export const ROLES = Object.freeze([
  role(
    "project_manager",
    "Руководитель проекта",
    "Руководитель проекта",
    "руководителя проекта",
    "Составляет план, распределяет задачи и следит за ходом проекта",
  ),
  role(
    "business_analyst",
    "Бизнес-аналитик",
    "Аналитик",
    "бизнес-аналитика",
    "Изучает данные и процессы бизнеса и формулирует, что нужно сделать",
  ),
  role(
    "researcher",
    "Исследователь",
    "Исследователь",
    "исследователя",
    "Собирает и проверяет информацию из открытых источников",
  ),
  role(
    "financial_analyst",
    "Финансовый аналитик",
    "Финансовый аналитик",
    "финансового аналитика",
    "Считает расходы, доходы, цены и окупаемость",
  ),
  role(
    "lawyer",
    "Юрист",
    "Юрист",
    "юриста",
    "Проверяет договоры, условия и правовые риски",
  ),
  role(
    "marketer",
    "Маркетолог",
    "Маркетолог",
    "маркетолога",
    "Готовит позиционирование, тексты и план продвижения",
  ),
  role(
    "designer",
    "Дизайнер",
    "Дизайнер",
    "дизайнера",
    "Предлагает оформление материалов и макеты",
  ),
  role(
    "developer",
    "Разработчик",
    "Разработчик",
    "разработчика",
    "Готовит технические решения и описания",
  ),
  role(
    "reviewer",
    "Проверяющий (QA)",
    "Проверяющий",
    "проверяющего",
    "Сверяет результат с критерием готовности",
  ),
  role(
    "support",
    "Специалист поддержки",
    "Специалист поддержки",
    "специалиста поддержки",
    "Готовит ответы клиентам и инструкции",
  ),
]);

export const ROLE_CODES = Object.freeze(ROLES.map((r) => r.code));

// The role with this code, or null.
export function roleByCode(code) {
  return ROLES.find((r) => r.code === code) ?? null;
}

// The public fields of a role: the only way the views and the phrases see a role.
export function publicRole(r) {
  return {
    title: r.title,
    name: r.name,
    genitive: r.genitive,
    description: r.description,
  };
}
