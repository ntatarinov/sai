// The checks that exist only in the form /3 of a tenant file (design REQ-069, 4.2 and
// 5): the section `look` and the office object of an option. Each function is pure: it
// writes lines into `ctx` (the context of validate.js), never changes its input, never
// reads the disk, the clock or the environment, and does not throw on any JSON value.
import { checkLanguageText } from "./lang-check.js";
import {
  FIGURES,
  GLYPHS,
  MIN_CONTRAST,
  OBJECT_IDS,
  OBJECT_RULES,
  SHEET,
  SHIRTS,
  TEAM_SIZE,
  contrastRatio,
  isColor,
  isMarkSign,
} from "./limits.js";
import { checkItems, checkObject, field, isObject } from "./shape.js";

// "3,0": the boundary of the contrast rule as the messages write it.
const CONTRAST_TEXT = MIN_CONTRAST.toFixed(1).replace(".", ",");

const CONTRAST_MESSAGE = {
  light: `Контраст цвета с листом светлой темы меньше ${CONTRAST_TEXT} : 1. Возьмите цвет темнее.`,
  dark: `Контраст цвета с листом тёмной темы меньше ${CONTRAST_TEXT} : 1. Возьмите цвет светлее.`,
};

// The characters of a staff name (decision 0085, item 2): letters, combining marks,
// decimal digits, space, hyphen, apostrophe (two kinds) and dot.
const STAFF_NAME = /^[\p{L}\p{M}\p{Nd} '’.-]+$/u;

function listText(items) {
  return items.join(", ");
}

// A value of a closed list of names; anything else is E_REF with the list in the text.
function checkListed(ctx, path, value, names) {
  if (typeof value === "string" && names.includes(value)) return;
  ctx.add(
    "E_REF",
    path,
    `Допустимо только: ${listText(names)}. Исправьте значение.`,
  );
}

function checkMark(ctx, path, value) {
  if (typeof value !== "string") {
    ctx.wrong(path, "string");
    return;
  }
  const count = [...value].length;
  if (count !== 1) {
    ctx.add(
      "E_LIMIT",
      path,
      `Знаков: ${count}, нужен ровно 1. Оставьте одну букву или цифру.`,
    );
  } else if (!isMarkSign(value)) {
    ctx.add(
      "E_FIELD",
      path,
      "Нужна буква или цифра любого алфавита. Исправьте значение.",
    );
  }
}

// A colour: the form first, then the contrast with the sheet of its own theme.
function checkColor(ctx, path, value, theme) {
  if (!isColor(value)) {
    ctx.add(
      "E_FIELD",
      path,
      "Цвет записывается как «#» и шесть строчных шестнадцатеричных цифр, например #1f7a8c. Исправьте значение.",
    );
  } else if (contrastRatio(value, SHEET[theme]) < MIN_CONTRAST) {
    ctx.add("E_LIMIT", path, CONTRAST_MESSAGE[theme]);
  }
}

function checkTheme(ctx, path, value, theme) {
  checkObject(ctx, path, value, [
    field("accent", true, (p, v) => checkColor(ctx, p, v, theme)),
    field("accent2", true, (p, v) => checkColor(ctx, p, v, theme)),
  ]);
}

// The name of a staff member is one string for all languages: type, forbidden sign and
// length are one call; the characters are looked at only for a text that passed it.
function checkStaffName(ctx, path, value) {
  if (!ctx.line(path, value, 1, 30, "en")) return;
  if (!STAFF_NAME.test(value))
    ctx.add(
      "E_FIELD",
      path,
      "Имя — только буквы, цифры, пробел, дефис, апостроф и точка. Исправьте значение.",
    );
}

function checkStaff(ctx, path, value) {
  checkObject(ctx, path, value, [
    field("name", true, (p, v) => checkStaffName(ctx, p, v)),
    field("role", true, (p, v) => checkLanguageText(ctx, p, v, 1, 40)),
    field("says", true, (p, v) => checkLanguageText(ctx, p, v, 1, 40)),
    field("figure", true, (p, v) => checkListed(ctx, p, v, FIGURES)),
    field("shirt", true, (p, v) => checkListed(ctx, p, v, SHIRTS)),
  ]);
}

// checkLook(ctx, path, value): the whole section `look` (design 5.3).
export function checkLook(ctx, path, value) {
  checkObject(ctx, path, value, [
    field("mark", true, (p, v) => checkMark(ctx, p, v)),
    field("tagline", false, (p, v) => checkLanguageText(ctx, p, v, 1, 40)),
    field("industry", true, (p, v) => checkLanguageText(ctx, p, v, 1, 60)),
    field("headline", true, (p, v) => checkLanguageText(ctx, p, v, 1, 120)),
    field("colors", true, (p, v) =>
      checkObject(ctx, p, v, [
        field("light", true, (tp, tv) => checkTheme(ctx, tp, tv, "light")),
        field("dark", true, (tp, tv) => checkTheme(ctx, tp, tv, "dark")),
      ]),
    ),
    field("team", true, (p, v) =>
      checkItems(ctx, p, v, TEAM_SIZE, TEAM_SIZE, (sp, staff) =>
        checkStaff(ctx, sp, staff),
      ),
    ),
  ]);
}

function checkObjectId(ctx, path, value) {
  if (typeof value === "string" && OBJECT_IDS.includes(value)) return;
  ctx.add("E_REF", path, `Допустимо только: ${listText(OBJECT_IDS)}.`);
}

// 1 to 3 signs, each a letter or a decimal digit: the count first, then the class.
function checkTag(ctx, path, value) {
  if (typeof value !== "string") {
    ctx.wrong(path, "string");
    return;
  }
  const signs = [...value];
  if (signs.length < 1 || signs.length > 3) {
    ctx.add(
      "E_LIMIT",
      path,
      `Знаков: ${signs.length}, допустимо от 1 до 3. Исправьте текст.`,
    );
  } else if (!signs.every(isMarkSign)) {
    ctx.add(
      "E_FIELD",
      path,
      "Допустимы только буквы и цифры, без пробелов. Исправьте значение.",
    );
  }
}

function checkGlyph(ctx, path, value) {
  if (typeof value === "string" && GLYPHS.includes(value)) return;
  ctx.add(
    "E_FIELD",
    path,
    `Допустимо только: ${listText(GLYPHS)}. Исправьте значение.`,
  );
}

// checkOfficeObject(ctx, path, value): one office object { id, level, tag, glyph } (5.5).
// A parameter that the id does not allow is an extra field. While the id is not one of
// the catalogue, every parameter is allowed and checked for its form only.
export function checkOfficeObject(ctx, path, value) {
  const id =
    isObject(value) && Object.hasOwn(value, "id") ? value.id : undefined;
  const known = typeof id === "string" && OBJECT_IDS.includes(id);
  const rules = known ? OBJECT_RULES[id] : null;
  const fields = [field("id", true, (p, v) => checkObjectId(ctx, p, v))];
  if (rules === null || rules.level !== null) {
    const [min, max] = rules === null ? [1, 4] : rules.level;
    fields.push(field("level", false, (p, v) => ctx.int(p, v, min, max)));
  }
  if (rules === null || rules.tag)
    fields.push(field("tag", false, (p, v) => checkTag(ctx, p, v)));
  if (rules === null || rules.glyph)
    fields.push(field("glyph", false, (p, v) => checkGlyph(ctx, p, v)));
  checkObject(ctx, path, value, fields);
}

// checkChips(ctx, path, value, min, max): the quick numbers of one number question
// (5.6). `min` and `max` are the ends of the question when both are valid integers and
// null otherwise: the range is then not looked at, and only the integer form of each
// item is (a half range would put the word null into a message). The items are checked
// also when there are too many; then a repeat, else a number smaller than the nearest
// earlier valid one.
export function checkChips(ctx, path, value, min, max) {
  if (!ctx.list(path, value, 0, 4)) return;
  const bounded = Number.isSafeInteger(min) && Number.isSafeInteger(max);
  const seen = new Set();
  let previous = null;
  value.forEach((item, i) => {
    const itemPath = [...path, i];
    if (!ctx.int(itemPath, item, bounded ? min : null, bounded ? max : null))
      return;
    if (seen.has(item))
      ctx.add(
        "E_DUP",
        itemPath,
        `Число ${item} уже есть в chips. Оставьте одно.`,
      );
    else if (previous !== null && item < previous)
      ctx.add(
        "E_ORDER",
        itemPath,
        "Числа должны идти по возрастанию. Поставьте это число правее.",
      );
    seen.add(item);
    previous = item;
  });
}

// checkDesks(ctx, questions): the rules that look at all questions (5.6), run once
// after them. A question has its own desk when it has the key, whatever the value (a
// wrong value has its own line from the question). When some question has the key, the
// first object without it gets a line and no other does; a valid desk smaller than the
// nearest earlier valid one is out of order. Entries that are not objects are skipped.
export function checkDesks(ctx, questions) {
  if (!Array.isArray(questions)) return;
  const objects = [];
  questions.forEach((q, index) => {
    if (isObject(q)) objects.push({ q, index });
  });
  if (!objects.some(({ q }) => Object.hasOwn(q, "desk"))) return;
  let reported = false;
  let previous = null;
  for (const { q, index } of objects) {
    const place = ["questions", index, "desk"];
    if (!Object.hasOwn(q, "desk")) {
      if (!reported)
        ctx.add(
          "E_FIELD",
          place,
          "Стол задан не у всех вопросов. Добавьте поле desk.",
        );
      reported = true;
    } else if (
      Number.isSafeInteger(q.desk) &&
      q.desk >= 1 &&
      q.desk <= TEAM_SIZE
    ) {
      if (previous !== null && q.desk < previous)
        ctx.add(
          "E_ORDER",
          place,
          "Номер стола меньше, чем у предыдущего вопроса. Не уменьшайте его.",
        );
      previous = q.desk;
    }
  }
}

// checkWhatsapp(ctx, path, value): digits only, then 10 to 15 of them (5.7).
export function checkWhatsapp(ctx, path, value) {
  if (typeof value !== "string") {
    ctx.wrong(path, "string");
    return;
  }
  if (!/^[0-9]*$/u.test(value)) {
    ctx.add(
      "E_FIELD",
      path,
      "Номер WhatsApp — только цифры, без плюса и пробелов. Исправьте значение.",
    );
  } else if (value.length < 10 || value.length > 15) {
    ctx.add(
      "E_LIMIT",
      path,
      `Цифр: ${value.length}, допустимо от 10 до 15. Исправьте номер.`,
    );
  }
}
