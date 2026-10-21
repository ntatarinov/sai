// What the picker site server reads from a request (design REQ-056, 5.6 and 5.4): the
// target, the route, the language, the type of the body and its form. Pure functions:
// they read no file, no clock and no environment, change nothing and do not throw.
import { STATIC_NAME } from "./config.js";
import { TENANT_ID } from "./limits.js";
import { chooseLanguage } from "./public/texts.js";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// splitTarget(target) -> { pathname, query }: the part before the first "?" and the part
// after it (without the "?"). Nothing is decoded.
export function splitTarget(target) {
  if (typeof target !== "string") return { pathname: "", query: "" };
  const mark = target.indexOf("?");
  if (mark < 0) return { pathname: target, query: "" };
  return { pathname: target.slice(0, mark), query: target.slice(mark + 1) };
}

// routeOf(pathname) -> { kind, id } for the page, the redirect, the questionnaire and the
// result, { kind: "asset", name } for a file of the page, null for every other path. The
// path is cut at "/" and never decoded: "%2D", "..", "//" and a capital letter make the
// path unknown.
export function routeOf(pathname) {
  if (typeof pathname !== "string") return null;
  const parts = pathname.split("/");
  if (parts[0] !== "") return null;
  if (parts[1] === "assets") {
    const name = parts[2];
    if (parts.length !== 3 || !STATIC_NAME.test(name) || name.includes(".."))
      return null;
    return { kind: "asset", name };
  }
  if (parts[1] !== "t" || parts.length < 3 || parts.length > 5) return null;
  const id = parts[2];
  if (!TENANT_ID.test(id)) return null;
  if (parts.length === 3) return { kind: "redirect", id };
  if (parts.length === 4) return parts[3] === "" ? { kind: "page", id } : null;
  if (parts[3] !== "api") return null;
  if (parts[4] === "questionnaire") return { kind: "questionnaire", id };
  if (parts[4] === "result") return { kind: "result", id };
  return null;
}

// languageOf(query, languages) -> "ru" | "kk" | "en": the first value of lang in the
// query, when it is exactly one of the three and the file has it, else ru. No header is read.
export function languageOf(query, languages) {
  const text = typeof query === "string" ? query : "";
  const wanted = new URLSearchParams(text).get("lang");
  return chooseLanguage({ query: wanted ?? undefined, available: languages });
}

// isJsonType(value) -> true when the part of a Content-Type before ";" is application/json
// (capitals and spaces at the ends do not matter).
export function isJsonType(value) {
  if (typeof value !== "string") return false;
  const type = value.split(";")[0].replace(/^[ \t]+|[ \t]+$/gu, "");
  return type.toLowerCase() === "application/json";
}

// checkBody(parsed) -> { ok: true, answers } | { ok: false, key, field? }: the form of a
// body that is parsed JSON. The body is an object with the one key "answers"; `key` is the
// key of TEXTS for the refusal, `field` the first other key as it was written. What
// "answers" holds is judged by the engine.
export function checkBody(parsed) {
  if (!isObject(parsed)) return { ok: false, key: "server_bad_request" };
  for (const name of Object.keys(parsed)) {
    if (name !== "answers")
      return { ok: false, key: "server_extra_field", field: name };
  }
  if (!Object.hasOwn(parsed, "answers"))
    return { ok: false, key: "server_no_answers" };
  return { ok: true, answers: parsed.answers };
}
