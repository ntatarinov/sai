// The check of one condition (design REQ-054, 4.5 and 4.6, steps У1-У8). Used for the
// show_if of a question and for the when of a rule and of a hypothesis. The context
// `ctx` is made by validate.js: add(code, path, text) keeps one error per place,
// wrong(path, kind), int(path, v, min, max) and list(path, v, min, max) apply the
// rules of type, size and range, and `questions` is the table of the questions by id.
import { show } from "./places.js";

const CONDITION_KEYS = new Set(["question", "any_of", "none_of", "min", "max"]);
const ONE_KIND_TEXT =
  "Условие должно быть одного вида: any_of, none_of или min и max.";

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// `ownIndex` is the number of the question whose show_if this is; for a when it is null.
export function checkCondition(ctx, path, value, ownIndex) {
  // У1
  if (!isObject(value)) {
    ctx.wrong(path, "object");
    return;
  }
  // У2
  for (const key of Object.keys(value)) {
    if (!CONDITION_KEYS.has(key))
      ctx.add(
        "E_FIELD",
        [...path, key],
        `Лишнее поле ${show(key)}. Удалите его.`,
      );
  }
  // У3
  const questionPath = [...path, "question"];
  let question = null;
  if (!Object.hasOwn(value, "question")) {
    ctx.add("E_FIELD", questionPath, "Нет поля question. Добавьте его.");
  } else if (typeof value.question !== "string") {
    ctx.wrong(questionPath, "string");
  } else {
    question = value.question;
  }
  // У4
  const has = (key) => Object.hasOwn(value, key);
  const isRange = has("min") || has("max");
  const kinds =
    (has("any_of") ? 1 : 0) + (has("none_of") ? 1 : 0) + (isRange ? 1 : 0);
  if (kinds !== 1) ctx.add("E_COND", path, ONE_KIND_TEXT);
  // У5
  let found = null;
  if (question !== null) {
    found = ctx.questions.get(question) ?? null;
    if (found === null) {
      ctx.add(
        "E_REF",
        questionPath,
        `Вопрос ${show(question)} не найден. Укажите id вопроса из списка questions.`,
      );
    } else if (ownIndex !== null && found.index >= ownIndex) {
      ctx.add(
        "E_ORDER",
        questionPath,
        `Вопрос ${show(question)} стоит не выше этого. Ссылайтесь только на вопросы выше.`,
      );
      return;
    }
  }
  if (kinds !== 1) return;
  const listKey = has("any_of") ? "any_of" : has("none_of") ? "none_of" : null;
  // У6: the first key of the kind is min before max
  const firstKey = listKey ?? (has("min") ? "min" : "max");
  if (found !== null && found.type !== null) {
    const isNumber = found.type === "number";
    if (isNumber && listKey !== null) {
      ctx.add(
        "E_COND",
        [...path, firstKey],
        `Условие ${firstKey} не подходит вопросу типа number. Используйте min и max.`,
      );
      return;
    }
    if (!isNumber && listKey === null) {
      ctx.add(
        "E_COND",
        [...path, firstKey],
        `Условие ${firstKey} не подходит вопросу типа ${found.type}. Используйте any_of или none_of.`,
      );
      return;
    }
  }
  // У7 and У8
  if (listKey !== null) {
    const listPath = [...path, listKey];
    if (!ctx.list(listPath, value[listKey], 1, 8)) return;
    const checkOptions = found !== null && found.type !== null;
    value[listKey].forEach((item, i) => {
      if (typeof item !== "string") {
        ctx.wrong([...listPath, i], "string");
      } else if (checkOptions && !found.options.has(item)) {
        ctx.add(
          "E_REF",
          [...listPath, i],
          `Вариант ${show(item)} у вопроса ${show(question)} не найден. Укажите id варианта этого вопроса.`,
        );
      }
    });
    return;
  }
  const minOk = has("min") && ctx.int([...path, "min"], value.min, null, null);
  const maxOk = has("max") && ctx.int([...path, "max"], value.max, null, null);
  if (minOk && maxOk && value.min > value.max) {
    ctx.add(
      "E_LIMIT",
      [...path, "max"],
      "Граница min больше max. Условие никогда не сработает.",
    );
  }
}
