// The check of a text for the visitor in a file of the form /2 (design REQ-061, 5.3):
// an object with exactly the languages ru, kk and en. It does not change the value and
// does not throw on any value that comes from JSON.
import { FORMAT_V2, FORMAT_V3, LANGUAGES } from "./limits.js";
import { show } from "./places.js";

// "ru, kk и en": the list of languages for the messages, built from LANGUAGES.
const LANGUAGE_LIST = `${LANGUAGES.slice(0, -1).join(", ")} и ${LANGUAGES.at(-1)}`;

// The one rule that tells the form of a tenant file: it is /2 when the root has its own
// field schema equal to FORMAT_V2. The check (validate.js) and the view (view.js) both use it.
export function isFormatV2(doc) {
  return (
    doc !== null &&
    typeof doc === "object" &&
    Object.hasOwn(doc, "schema") &&
    doc.schema === FORMAT_V2
  );
}

// The same for /3 (design REQ-069, D1).
export function isFormatV3(doc) {
  return (
    doc !== null &&
    typeof doc === "object" &&
    Object.hasOwn(doc, "schema") &&
    doc.schema === FORMAT_V3
  );
}

// True for the forms whose texts for the visitor are in three languages: /2 and /3.
export function isLanguageFormat(doc) {
  return isFormatV2(doc) || isFormatV3(doc);
}

// "/1", "/2" or "/3". A value of schema that is none of the three gives "/1" (decision 0070).
export function formatOf(doc) {
  if (isFormatV3(doc)) return "/3";
  return isFormatV2(doc) ? "/2" : "/1";
}

// checkLanguageText(ctx, path, value, min, max): `ctx` is the context of validate.js
// with ctx.line(path, value, min, max, language) for one language.
export function checkLanguageText(ctx, path, value, min, max) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    ctx.add(
      "E_FIELD",
      path,
      `Нужен текст на трёх языках: ${LANGUAGE_LIST}. Исправьте значение.`,
    );
    return;
  }
  for (const key of Object.keys(value)) {
    if (!LANGUAGES.includes(key))
      ctx.add(
        "E_FIELD",
        [...path, key],
        `Лишний язык ${show(key)}. Допустимы только ${LANGUAGE_LIST}.`,
      );
  }
  for (const language of LANGUAGES) {
    const languagePath = [...path, language];
    if (Object.hasOwn(value, language))
      ctx.line(languagePath, value[language], min, max, language);
    else
      ctx.add(
        "E_FIELD",
        languagePath,
        `Нет перевода на ${language}. Добавьте текст на этом языке.`,
      );
  }
}
