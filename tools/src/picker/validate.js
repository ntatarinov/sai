// The check of a parsed tenant file (design REQ-054, 4 and 5.7). validateTenant is a
// pure function: it does not change its input, does not read the clock, the environment
// or the disk, and does not throw on any value that comes from JSON.
import { checkCondition } from "./conditions.js";
import { checkLanguageText, isFormatV2 } from "./lang-check.js";
import {
  CONTACT_FIELDS,
  DEFAULT_LANGUAGE,
  FORMAT_V1,
  FORMAT_V2,
  QUESTION_TYPES,
} from "./limits.js";
import { pathText, show } from "./places.js";
import { textProblem, trimmedLength, wordsProblem } from "./text-rules.js";

// The language whose texts are written in the form "вы": the address "ты" is forbidden here only.
const FORMAL_LANGUAGE = "ru";

const TENANT_ID = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const INNER_ID = /^[a-z0-9-]{1,40}$/;

const WRONG_TYPE = new Map([
  ["string", "Ожидается строка."],
  ["int", "Ожидается целое число."],
  ["bool", "Ожидается значение true или false."],
  ["list", "Ожидается список."],
  ["object", "Ожидается объект."],
]);

// Questions keep these keys; some are for one kind of question only.
const QUESTION_KEYS = new Set([
  "id",
  "title",
  "help",
  "type",
  "required",
  "options",
  "min",
  "max",
  "unit",
  "show_if",
]);
const ONLY_FOR = new Map([
  ["options", ["single", "multiple"]],
  ["min", ["number"]],
  ["max", ["number"]],
  ["unit", ["number"]],
]);

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// The type of a question when it is one of the three, else null.
function knownType(question) {
  const type = question.type;
  return typeof type === "string" && QUESTION_TYPES.includes(type)
    ? type
    : null;
}

// The context of one check: the issues (one per place, the first found wins), the
// rules of type, size and range, and the tables for the references. `mode` is "/1"
// (texts for the visitor are strings) or "/2" (each is an object with ru, kk and en).
function makeContext(mode) {
  const issues = [];
  const places = new Set();
  const ctx = {
    issues,
    questions: new Map(),
    solutions: new Set(),
    add(code, path, text) {
      const key = JSON.stringify(path);
      if (places.has(key)) return;
      places.add(key);
      issues.push({ code, path, text });
    },
    wrong(path, kind) {
      ctx.add("E_FIELD", path, `${WRONG_TYPE.get(kind)} Исправьте значение.`);
    },
    // An integer within the range (null: no bound); false when it is not.
    int(path, v, min, max) {
      if (!Number.isSafeInteger(v)) {
        ctx.wrong(path, "int");
        return false;
      }
      if ((min !== null && v < min) || (max !== null && v > max)) {
        ctx.add(
          "E_LIMIT",
          path,
          max === null
            ? `Число ${v} вне границ: не меньше ${min}. Исправьте значение.`
            : `Число ${v} вне границ от ${min} до ${max}. Исправьте значение.`,
        );
        return false;
      }
      return true;
    },
    // True when the value is a list (a wrong size is reported, the items are still checked).
    list(path, v, min, max) {
      if (!Array.isArray(v)) {
        ctx.wrong(path, "list");
        return false;
      }
      if (v.length < min || v.length > max) {
        ctx.add(
          "E_LIMIT",
          path,
          `Элементов: ${v.length}, допустимо от ${min} до ${max}. Исправьте список.`,
        );
      }
      return true;
    },
    bool(path, v) {
      if (typeof v !== "boolean") ctx.wrong(path, "bool");
    },
    // A text for the visitor: a string in /1, an object with three languages in /2.
    text(path, v, min, max) {
      if (mode === "/2") checkLanguageText(ctx, path, v, min, max);
      else ctx.line(path, v, min, max, DEFAULT_LANGUAGE);
    },
    // A text in one language: type, length, then the rule of understandable text. The
    // address "ты" is forbidden in ru only.
    line(path, v, min, max, language) {
      if (typeof v !== "string") {
        ctx.wrong(path, "string");
        return;
      }
      const length = trimmedLength(v);
      if (length < min || length > max) {
        ctx.add(
          "E_LIMIT",
          path,
          `Знаков: ${length}, допустимо от ${min} до ${max}. Исправьте текст.`,
        );
        return;
      }
      const problem =
        language === FORMAL_LANGUAGE ? textProblem(v) : wordsProblem(v);
      if (problem === null) return;
      ctx.add(
        "E_TEXT",
        path,
        problem.kind === "formal"
          ? "Обращение не на «вы». Перепишите текст в форме «вы»."
          : `Фраза длиннее 18 слов (в ней ${problem.words}). Разбейте её точкой.`,
      );
    },
    // A list of texts for the visitor.
    texts(path, v, listMin, listMax, min, max) {
      if (ctx.list(path, v, listMin, listMax))
        v.forEach((item, i) => ctx.text([...path, i], item, min, max));
    },
  };
  return ctx;
}

// An object with known fields: the extra keys first, then the fields in the order of
// the table. A field is { name, required, check(path, value) }.
function checkObject(ctx, path, value, fields) {
  if (!isObject(value)) {
    ctx.wrong(path, "object");
    return;
  }
  const known = new Set(fields.map((f) => f.name));
  for (const key of Object.keys(value)) {
    if (!known.has(key))
      ctx.add(
        "E_FIELD",
        [...path, key],
        `Лишнее поле ${show(key)}. Удалите его.`,
      );
  }
  for (const field of fields) {
    const fieldPath = [...path, field.name];
    if (Object.hasOwn(value, field.name))
      field.check(fieldPath, value[field.name]);
    else if (field.required)
      ctx.add("E_FIELD", fieldPath, `Нет поля ${field.name}. Добавьте его.`);
  }
}

// The items of a list of objects, each checked by `each(path, item, index)`.
function checkItems(ctx, path, value, min, max, each) {
  if (ctx.list(path, value, min, max))
    value.forEach((item, i) => each([...path, i], item, i));
}

// An inner id: type, pattern, repeat; `seen` maps the ids of this list to the places.
function checkInnerId(ctx, path, value, seen) {
  if (typeof value !== "string") {
    ctx.wrong(path, "string");
    return;
  }
  if (!INNER_ID.test(value)) {
    ctx.add(
      "E_ID",
      path,
      "Допустимы 1–40 знаков: строчные латинские буквы, цифры и дефис.",
    );
  } else if (seen.has(value)) {
    ctx.add(
      "E_DUP",
      path,
      `Идентификатор ${show(value)} уже есть в ${pathText(seen.get(value))}. Выберите другой.`,
    );
  }
  if (!seen.has(value)) seen.set(value, path);
}

function field(name, required, check) {
  return { name, required, check };
}

function checkConditions(ctx, path, value, ownIndex) {
  checkItems(ctx, path, value, ownIndex === null ? 1 : 0, 3, (itemPath, item) =>
    checkCondition(ctx, itemPath, item, ownIndex),
  );
}

function checkOption(ctx, path, value, seen) {
  checkObject(ctx, path, value, [
    field("id", true, (p, v) => checkInnerId(ctx, p, v, seen)),
    field("label", true, (p, v) => ctx.text(p, v, 1, 100)),
  ]);
}

function checkQuestion(ctx, path, value, index, seen) {
  if (!isObject(value)) {
    ctx.wrong(path, "object");
    return;
  }
  const type = knownType(value);
  // Until the type is known, the fields that depend on it are only checked for their form.
  const applies = (name) =>
    type === null || !ONLY_FOR.has(name) || ONLY_FOR.get(name).includes(type);
  for (const key of Object.keys(value)) {
    if (!QUESTION_KEYS.has(key) || !applies(key))
      ctx.add(
        "E_FIELD",
        [...path, key],
        `Лишнее поле ${show(key)}. Удалите его.`,
      );
  }
  const present = (name) => Object.hasOwn(value, name) && applies(name);
  const missing = (name, needed) => {
    if (!Object.hasOwn(value, name) && needed)
      ctx.add("E_FIELD", [...path, name], `Нет поля ${name}. Добавьте его.`);
  };
  const at = (name) => [...path, name];

  if (Object.hasOwn(value, "id")) checkInnerId(ctx, at("id"), value.id, seen);
  else missing("id", true);
  if (Object.hasOwn(value, "title")) ctx.text(at("title"), value.title, 1, 200);
  else missing("title", true);
  if (Object.hasOwn(value, "help")) ctx.text(at("help"), value.help, 1, 300);
  if (!Object.hasOwn(value, "type")) {
    missing("type", true);
  } else if (typeof value.type !== "string") {
    ctx.wrong(at("type"), "string");
  } else if (type === null) {
    ctx.add(
      "E_FIELD",
      at("type"),
      "Допустимо только: single, multiple, number. Исправьте значение.",
    );
  }
  if (Object.hasOwn(value, "required"))
    ctx.bool(at("required"), value.required);
  else missing("required", true);
  if (present("options")) {
    const optionIds = new Map();
    checkItems(ctx, at("options"), value.options, 2, 8, (p, item) =>
      checkOption(ctx, p, item, optionIds),
    );
  } else {
    missing("options", type === "single" || type === "multiple");
  }
  const minOk = present("min") && ctx.int(at("min"), value.min, null, null);
  const maxOk = present("max") && ctx.int(at("max"), value.max, null, null);
  missing("min", type === "number");
  missing("max", type === "number");
  if (type === "number" && minOk && maxOk && value.min >= value.max) {
    ctx.add(
      "E_LIMIT",
      at("max"),
      "Число min должно быть меньше max. Исправьте границы.",
    );
  }
  if (present("unit")) ctx.text(at("unit"), value.unit, 1, 20);
  if (Object.hasOwn(value, "show_if"))
    checkConditions(ctx, at("show_if"), value.show_if, index);
}

function checkSolution(ctx, path, value, seen) {
  checkObject(ctx, path, value, [
    field("id", true, (p, v) => checkInnerId(ctx, p, v, seen)),
    field("name", true, (p, v) => ctx.text(p, v, 1, 80)),
    field("summary", true, (p, v) => ctx.text(p, v, 1, 300)),
    field("includes", true, (p, v) => ctx.texts(p, v, 1, 10, 1, 150)),
    field("needs_from_you", true, (p, v) => ctx.texts(p, v, 0, 10, 1, 150)),
    field("next_steps", true, (p, v) => ctx.texts(p, v, 1, 5, 1, 150)),
    field("price_text", false, (p, v) => ctx.text(p, v, 1, 120)),
    field("duration_text", false, (p, v) => ctx.text(p, v, 1, 120)),
    field("not_suitable_when", true, (p, v) => ctx.texts(p, v, 0, 5, 1, 150)),
  ]);
}

function checkRule(ctx, path, value, seen) {
  checkObject(ctx, path, value, [
    field("id", true, (p, v) => checkInnerId(ctx, p, v, seen)),
    field("when", true, (p, v) => checkConditions(ctx, p, v, null)),
    field("solution", true, (p, v) => {
      if (typeof v !== "string") ctx.wrong(p, "string");
      else if (!ctx.solutions.has(v))
        ctx.add(
          "E_REF",
          p,
          `Решение ${show(v)} не найдено. Укажите id решения из списка solutions.`,
        );
    }),
    field("points", true, (p, v) => {
      if (v === 0) {
        ctx.add(
          "E_LIMIT",
          p,
          "Баллы не могут быть равны 0. Укажите от -10 до -1 или от 1 до 10.",
        );
      } else {
        ctx.int(p, v, -10, 10);
      }
    }),
    field("text", true, (p, v) => ctx.text(p, v, 1, 200)),
  ]);
}

function checkHypothesis(ctx, path, value, seen) {
  checkObject(ctx, path, value, [
    field("id", true, (p, v) => checkInnerId(ctx, p, v, seen)),
    field("title", true, (p, v) => ctx.text(p, v, 1, 100)),
    field("explanation", true, (p, v) => ctx.text(p, v, 1, 300)),
    field("when", true, (p, v) => checkConditions(ctx, p, v, null)),
  ]);
}

function checkResult(ctx, path, value) {
  checkObject(ctx, path, value, [
    field("top", true, (p, v) => ctx.int(p, v, 1, 3)),
    field("min_score", true, (p, v) => ctx.int(p, v, 1, null)),
    field("clear_lead_gap", true, (p, v) => ctx.int(p, v, 1, null)),
    field("no_match_text", true, (p, v) => ctx.text(p, v, 1, 300)),
  ]);
}

function checkContactFields(ctx, path, value) {
  const seen = new Set();
  checkItems(ctx, path, value, 1, 2, (p, item) => {
    if (typeof item !== "string") {
      ctx.wrong(p, "string");
    } else if (!CONTACT_FIELDS.includes(item)) {
      ctx.add(
        "E_FIELD",
        p,
        "Допустимо только: phone, email. Исправьте значение.",
      );
    } else if (seen.has(item)) {
      ctx.add("E_DUP", p, `Способ связи ${item} указан дважды. Оставьте один.`);
    } else {
      seen.add(item);
    }
  });
}

function checkLeads(ctx, path, value) {
  checkObject(ctx, path, value, [
    field("enabled", true, (p, v) => ctx.bool(p, v)),
    field("contact_fields", true, (p, v) => checkContactFields(ctx, p, v)),
    field("operator_name", true, (p, v) =>
      ctx.line(p, v, 1, 100, DEFAULT_LANGUAGE),
    ),
    field("consent_text", true, (p, v) => ctx.text(p, v, 1, 600)),
    field("privacy_contact", true, (p, v) =>
      ctx.line(p, v, 1, 200, DEFAULT_LANGUAGE),
    ),
    field("retention_days", true, (p, v) => ctx.int(p, v, 1, 365)),
  ]);
}

function checkTenantId(ctx, path, value, fileName) {
  if (typeof value !== "string") {
    ctx.wrong(path, "string");
  } else if (!TENANT_ID.test(value)) {
    ctx.add(
      "E_ID",
      path,
      "Допустимы 3–32 знака: строчные латинские буквы, цифры и дефис внутри.",
    );
  } else if (typeof fileName === "string" && fileName !== `${value}.json`) {
    ctx.add(
      "E_ID",
      path,
      `Имя файла должно быть ${show(value)}.json. Переименуйте файл или исправьте id.`,
    );
  }
}

// The tables for the references (Р8): the first question with an id, its type and
// the ids of its options; the ids of the solutions. Any id that is a string is in.
function fillTables(ctx, doc) {
  if (Array.isArray(doc.questions)) {
    doc.questions.forEach((q, index) => {
      if (!isObject(q) || typeof q.id !== "string" || ctx.questions.has(q.id))
        return;
      const options = new Set();
      if (Array.isArray(q.options)) {
        for (const option of q.options) {
          if (isObject(option) && typeof option.id === "string")
            options.add(option.id);
        }
      }
      ctx.questions.set(q.id, { index, type: knownType(q), options });
    });
  }
  if (Array.isArray(doc.solutions)) {
    for (const solution of doc.solutions) {
      if (isObject(solution) && typeof solution.id === "string")
        ctx.solutions.add(solution.id);
    }
  }
}

// A solution with no rule of positive points is never recommended: E_UNREACHABLE.
function checkReachable(ctx, doc) {
  if (!Array.isArray(doc.solutions) || !Array.isArray(doc.rules)) return;
  const rewarded = new Set();
  for (const rule of doc.rules) {
    if (
      isObject(rule) &&
      typeof rule.solution === "string" &&
      typeof rule.points === "number" &&
      rule.points > 0
    )
      rewarded.add(rule.solution);
  }
  doc.solutions.forEach((solution, index) => {
    if (!isObject(solution) || typeof solution.id !== "string") return;
    if (rewarded.has(solution.id)) return;
    ctx.add(
      "E_UNREACHABLE",
      ["solutions", index],
      `У решения ${show(solution.id)} нет правила с положительными баллами. Добавьте такое правило.`,
    );
  });
}

// validateTenant(doc, { fileName }) -> [{ code, path, text }] in the order of finding.
export function validateTenant(doc, options = {}) {
  const ctx = makeContext(isFormatV2(doc) ? "/2" : "/1");
  if (!isObject(doc)) {
    ctx.add(
      "E_FIELD",
      [],
      "Файл должен содержать один объект в фигурных скобках.",
    );
    return ctx.issues;
  }
  fillTables(ctx, doc);
  const fileName = options?.fileName;
  const questionIds = new Map();
  const solutionIds = new Map();
  const ruleIds = new Map();
  const hypothesisIds = new Map();
  checkObject(ctx, [], doc, [
    field("schema", true, (p, v) => {
      if (typeof v !== "string") ctx.wrong(p, "string");
      else if (v !== FORMAT_V1 && v !== FORMAT_V2)
        ctx.add(
          "E_FIELD",
          p,
          `Допустимо только: ${FORMAT_V1} или ${FORMAT_V2}. Исправьте значение.`,
        );
    }),
    field("id", true, (p, v) => checkTenantId(ctx, p, v, fileName)),
    field("name", true, (p, v) => ctx.text(p, v, 1, 60)),
    field("intro", true, (p, v) => ctx.text(p, v, 1, 400)),
    field("questions", true, (p, v) =>
      checkItems(ctx, p, v, 1, 30, (qp, q, i) =>
        checkQuestion(ctx, qp, q, i, questionIds),
      ),
    ),
    field("solutions", true, (p, v) =>
      checkItems(ctx, p, v, 1, 20, (sp, s) =>
        checkSolution(ctx, sp, s, solutionIds),
      ),
    ),
    field("rules", true, (p, v) =>
      checkItems(ctx, p, v, 1, 200, (rp, r) => checkRule(ctx, rp, r, ruleIds)),
    ),
    field("hypotheses", false, (p, v) =>
      checkItems(ctx, p, v, 0, 20, (hp, h) =>
        checkHypothesis(ctx, hp, h, hypothesisIds),
      ),
    ),
    field("result", true, (p, v) => checkResult(ctx, p, v)),
    field("leads", false, (p, v) => checkLeads(ctx, p, v)),
  ]);
  checkReachable(ctx, doc);
  return ctx.issues;
}
