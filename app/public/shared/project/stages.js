// The stages of a project and the moves between them (the code design M2PROJ, 4.7; ARCH §4): pure data and
// two checks, so the server and the pages read one list. Nothing here reads a clock, a random source or a
// page; the stage is changed by the projects service alone, with an audit row.

/** The eleven stages, in the order of a project's life. */
export const STAGES = Object.freeze([
  "draft",
  "interview",
  "spec",
  "approved",
  "dev_requested",
  "in_development",
  "built",
  "delivered",
  "accepted",
  "returned",
  "archived",
]);

/**
 * The allowed moves: the stages each stage may move to. 20 of the 121 ordered pairs: the chain from draft
 * to delivered, delivered to accepted or returned, returned back to development, and archived from every
 * other stage.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const NEXT = Object.freeze({
  draft: Object.freeze(["interview", "archived"]),
  interview: Object.freeze(["spec", "archived"]),
  spec: Object.freeze(["approved", "archived"]),
  approved: Object.freeze(["dev_requested", "archived"]),
  dev_requested: Object.freeze(["in_development", "archived"]),
  in_development: Object.freeze(["built", "archived"]),
  built: Object.freeze(["delivered", "archived"]),
  delivered: Object.freeze(["accepted", "returned", "archived"]),
  accepted: Object.freeze(["archived"]),
  returned: Object.freeze(["in_development", "archived"]),
  archived: Object.freeze([]),
});

/**
 * Whether a value is one of the eleven stages.
 * @param {unknown} x
 * @returns {boolean}
 */
export function isStage(x) {
  return typeof x === "string" && STAGES.includes(x);
}

/**
 * Whether a project at stage `from` may move to stage `to`. An unknown stage and an equal pair are not
 * allowed.
 * @param {unknown} from
 * @param {unknown} to
 * @returns {boolean}
 */
export function canMove(from, to) {
  if (typeof from !== "string" || typeof to !== "string") return false;
  if (!isStage(from) || !isStage(to)) return false;
  return NEXT[from].includes(to);
}
