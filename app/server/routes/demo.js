import fs from "node:fs";
import { pickLang } from "../../public/shared/i18n/lang.js";
import { HttpError } from "../http/errors.js";
import { computeResult } from "../vendor/picker-engine.js";

// The two demo routes of the public landing (ARCH §13; REQ-111 criteria 7 and 8; the code design of the
// public landing, 4.7): GET /api/demo/questionnaire gives the five questions of Sai's own intake in one
// language, and POST /api/demo/result the result of the byte copy of the picker engine for the answers of
// a page. The intake is read once, when the app is made, and the routes store nothing: no database call,
// no cookie, and no answer in a log line (the one line of a request is written by the app's middleware,
// with the error code only). The language comes from `?lang=` alone, never from a request header.

/** The intake file, in the literal form that the function's tracer follows (the code design, 4.7). */
export const INTAKE_FILE = new URL(
  "../../content/sai-intake.json",
  import.meta.url,
);

/** The keys of a text of the intake format sai-picker-tenant/2: an object with exactly these keys. */
const TEXT_LANGS = Object.freeze(["ru", "kk", "en"]);

/** @typedef {{ ok: true, tenant: Record<string, any> } | { ok: false }} Intake */

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Reads and parses the intake. Ok only for an object with the schema sai-picker-tenant/2, the id
 * sai-intake, five questions each of the type single with an options array, the arrays solutions and rules
 * and an object result. Never throws: a missing, unreadable or broken file gives { ok: false }.
 * @param {URL | string} [file]
 * @returns {Intake}
 */
export function loadIntake(file = INTAKE_FILE) {
  try {
    const tenant = JSON.parse(fs.readFileSync(file, "utf8"));
    if (
      isObject(tenant) &&
      tenant.schema === "sai-picker-tenant/2" &&
      tenant.id === "sai-intake" &&
      Array.isArray(tenant.questions) &&
      tenant.questions.length === 5 &&
      tenant.questions.every(
        (/** @type {unknown} */ q) =>
          isObject(q) && q.type === "single" && Array.isArray(q.options),
      ) &&
      Array.isArray(tenant.solutions) &&
      Array.isArray(tenant.rules) &&
      isObject(tenant.result)
    )
      return { ok: true, tenant };
  } catch {
    return { ok: false };
  }
  return { ok: false };
}

/**
 * A new copy of the value in which every object with exactly the keys ru, kk and en is its value in
 * `lang`; the order of keys and items stays, and numbers and booleans are copied.
 * @param {unknown} value
 * @param {string} lang
 * @returns {unknown}
 */
function pick(value, lang) {
  if (Array.isArray(value)) return value.map((item) => pick(item, lang));
  if (value === null || typeof value !== "object") return value;
  const source = /** @type {Record<string, unknown>} */ (value);
  const keys = Object.keys(source);
  if (
    keys.length === TEXT_LANGS.length &&
    TEXT_LANGS.every((l) => keys.includes(l))
  )
    return source[lang];
  const copy = Object.create(Object.getPrototypeOf(source));
  // A key is defined, not assigned: an own key `__proto__` of a parsed file stays an own key of the copy.
  for (const key of keys)
    Object.defineProperty(copy, key, {
      value: pick(source[key], lang),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  return copy;
}

/**
 * The tenant in one language: a new copy in which every object with exactly the keys ru, kk and en is
 * its value in `lang` (a language outside them gives ru); the input is not changed. It is the rule of
 * tenantInLanguage of tools/src/picker/view.js, written again here because the server imports nothing of
 * tools/.
 * @param {unknown} tenant
 * @param {string} lang
 * @returns {any}
 */
export function inLanguage(tenant, lang) {
  return pick(tenant, TEXT_LANGS.includes(lang) ? lang : "ru");
}

/**
 * The code of a refusal of the engine: its own code for the three that a page can cause, else
 * bad_answers (no other can come from five single questions with required false).
 * @param {string} reason
 * @returns {import("../http/errors.js").ErrorCode}
 */
function refusalCode(reason) {
  if (
    reason === "unknown_question" ||
    reason === "unknown_option" ||
    reason === "wrong_kind"
  )
    return reason;
  return "bad_answers";
}

/**
 * The two rows of the route table. `langs` is the frozen list of the languages the app answers in: the
 * local set on the local server and in Docker, the public languages in the function.
 * @param {{ intake: Intake, langs: readonly string[] }} demo
 * @returns {ReadonlyArray<import("./index.js").Route>}
 */
export function demoRoutes({ intake, langs }) {
  /**
   * The questionnaire, built field by field: no help text, rule, point, condition or solution text, and
   * no field that a file adds. An intake that loadIntake accepted but that this projection cannot read
   * (an option that is not an object, a value nested too deep to copy) answers demo_unavailable, as the
   * result route answers for the same intake.
   * @param {import("./index.js").RouteRequest} req
   * @returns {import("./index.js").RouteAnswer}
   */
  const questionnaire = ({ query }) => {
    if (!intake.ok) throw new HttpError("demo_unavailable");
    const lang = pickLang(query.get("lang"), null, langs);
    /** @type {Array<{ id: unknown, title: unknown, options: Array<{ id: unknown, label: unknown }> }>} */
    let questions;
    try {
      const view = inLanguage(intake.tenant, lang);
      questions = view.questions.map((/** @type {any} */ q) => ({
        id: q.id,
        title: q.title,
        options: q.options.map((/** @type {any} */ o) => ({
          id: o.id,
          label: o.label,
        })),
      }));
    } catch {
      throw new HttpError("demo_unavailable");
    }
    return {
      status: 200,
      body: { lang, questions },
    };
  };

  /**
   * The result of the engine for `{"answers": {…}}`, built field by field: never the ranking, a score,
   * the rules, a price, a term, what is needed, the next steps or the hypotheses.
   * @param {import("./index.js").RouteRequest} req
   * @returns {import("./index.js").RouteAnswer}
   */
  const result = ({ query, body }) => {
    if (!intake.ok) throw new HttpError("demo_unavailable");
    const lang = pickLang(query.get("lang"), null, langs);
    /** @type {unknown} */
    let parsed;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(body),
      );
    } catch {
      throw new HttpError("bad_json");
    }
    if (!isObject(parsed)) throw new HttpError("bad_body");
    const keys = Object.keys(parsed);
    if (keys.length !== 1 || keys[0] !== "answers")
      throw new HttpError("bad_body");
    const answers = parsed.answers;
    if (!isObject(answers)) throw new HttpError("bad_answers");
    let out;
    try {
      out = computeResult(inLanguage(intake.tenant, lang), answers);
    } catch {
      throw new HttpError("demo_unavailable");
    }
    if (!out.ok) throw new HttpError(refusalCode(out.error.reason));
    const found = out.result;
    return {
      status: 200,
      body: {
        lang,
        clear_leader: found.clear_leader,
        recommended: found.recommended.map((s) => ({
          id: s.id,
          name: s.name,
          summary: s.summary,
          includes: s.includes,
          not_suitable_when: s.not_suitable_when,
        })),
        no_match_text: found.no_match_text,
      },
    };
  };

  return Object.freeze([
    Object.freeze({
      method: "GET",
      path: "/api/demo/questionnaire",
      meta: Object.freeze({ tenant: false }),
      handler: questionnaire,
    }),
    Object.freeze({
      method: "POST",
      path: "/api/demo/result",
      meta: Object.freeze({ tenant: false }),
      handler: result,
    }),
  ]);
}
