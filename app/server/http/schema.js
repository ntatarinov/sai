import { forbiddenSign } from "../../public/shared/text-rules.js";
import { HttpError } from "./errors.js";

// The strict body validator of the request pipeline (the code design M2AUTH, C1 and 4.1; decisions/0137 О2: no
// zod). A body is a JSON object with exactly the keys of its shape: an unknown key (`org_id` among them), a
// missing required key, a wrong type, a text over its limit or holding a control or invisible sign → 400
// bad_body; a body that is not UTF-8 or not JSON → 400 bad_json. Lengths count code points.

/**
 * A field of a shape.
 * - text: a string of `min` to `max` code points (after trim for `min`) with no forbidden sign;
 * - email: printable ASCII, exactly one "@", 1-64 before it and 1-189 after it (4.4, B6);
 * - enum: one of `values`;
 * - form: a string that matches `re` (anchored).
 * @typedef {{ kind: "text", min?: number, max: number, optional?: boolean } | { kind: "email", optional?: boolean } | { kind: "enum", values: readonly string[], optional?: boolean } | { kind: "form", re: RegExp, optional?: boolean }} Field
 */

/** @typedef {Readonly<Record<string, Field>>} Shape */

const EMAIL = /^[!-~]{1,64}@[!-~]{1,189}$/;

/** The empty body `{}` of the routes that take no field. */
export const EMPTY = Object.freeze({});

/**
 * The ASCII lower case of an e-mail (A-Z to a-z), which equals Postgres lower() on such a text (F27).
 * @param {string} email
 * @returns {string}
 */
export const emailNorm = (email) =>
  email.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));

/**
 * @param {unknown} value
 * @param {Field} field
 * @returns {boolean}
 */
function fits(value, field) {
  if (typeof value !== "string") return false;
  if (field.kind === "email")
    return EMAIL.test(value) && value.split("@").length === 2;
  if (field.kind === "enum") return field.values.includes(value);
  if (field.kind === "form") return field.re.test(value);
  if (forbiddenSign(value) !== null) return false;
  const length = [...value].length;
  if (length > field.max) return false;
  if ((field.min ?? 0) > 0 && [...value.trim()].length < (field.min ?? 0))
    return false;
  return true;
}

/**
 * @param {Uint8Array} bytes
 * @param {Shape} shape
 * @returns {Record<string, string>}
 */
export function parseBody(bytes, shape) {
  let parsed;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    throw new HttpError("bad_json");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    throw new HttpError("bad_body");
  const body = /** @type {Record<string, unknown>} */ (parsed);
  for (const key of Object.keys(body))
    if (!Object.hasOwn(shape, key)) throw new HttpError("bad_body");
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, field] of Object.entries(shape)) {
    if (!Object.hasOwn(body, key)) {
      if (field.optional) continue;
      throw new HttpError("bad_body");
    }
    if (!fits(body[key], field)) throw new HttpError("bad_body");
    out[key] = /** @type {string} */ (body[key]);
  }
  return out;
}

// The shape of each route's body, kept beside its row (a row has exactly the keys method, path, meta and
// handler; the pipeline reads the shape at step 9).
/** @type {WeakMap<object, Shape>} */
const SHAPES = new WeakMap();

/**
 * @template {object} R
 * @param {R} row
 * @param {Shape} shape
 * @returns {R}
 */
export function withBody(row, shape) {
  SHAPES.set(row, shape);
  return row;
}

/**
 * The shape of a row; a row without one takes the empty body `{}`.
 * @param {object} row
 * @returns {Shape}
 */
export const bodyShapeOf = (row) => SHAPES.get(row) ?? EMPTY;
