// The handlers of the routes of the business interface (design REQ-011, sections
// 5, 8 and 10). Reading: listProjects and readProject of the core, then the pure
// builders of display.js. Writing: createProject of the core, the engines of the
// server and, for the chat, only deliver of the engine — the one entry that gives
// a message to a running engine or, without one, writes it through the core.
//
// The control of a project (design REQ-035, section 6): pause and stop only through
// deliver; resume through deliver to a live engine, otherwise through an engine of
// the server in the mode "resume" (decisions/0030, section 2; 0032, C3).
//
// Every handler returns a Reply = { status, body } (or a promise of one) and never
// throws: a refusal is a Failure with a text of texts.js, never the message of an
// error of the core (it may hold codes of the system, pids or commands).
import { deliver, engineHolder } from "../team/engine/channel.js";
import { TeamError, formatError } from "../team/errors.js";
import { LIMITS } from "../team/schema.js";
import { createProject, listProjects, readProject } from "../team/store.js";
import {
  chatPage,
  controlRefusal,
  listItem,
  projectPage,
  roleCard,
  roleOfNo,
  sentMessage,
  taskPage,
} from "./display.js";
import {
  TEXT,
  WHY_NOT_STARTED,
  WHY_OTHER,
  createdNotStarted,
  resumeFailed,
} from "./texts.js";

// ---- replies ------------------------------------------------------------------------

export function failure(status, text, field = null, reload = false) {
  return { status, body: { error_text: text, field, reload } };
}

// The one answer "not found" (section 4.4): the same status and the same bytes
// for every path, id, task or role that is not there.
export function notFoundReply() {
  return failure(404, TEXT.notFound);
}

function ok(status, body) {
  return { status, body };
}

function codeOf(err) {
  return err instanceof TeamError ? err.code : null;
}

// An unexpected error: the general text for the page, one line for stderr.
function internal(ctx, err) {
  say(ctx, formatError(err));
  return failure(500, TEXT.internal);
}

function say(ctx, line) {
  try {
    ctx.warn(line);
  } catch {
    // A failing warning must not change the answer.
  }
}

function sayAll(ctx, lines) {
  for (const line of lines ?? []) say(ctx, line);
}

// A refusal of reading (section 10).
function readFailure(ctx, err) {
  switch (codeOf(err)) {
    case "E_NOT_FOUND":
      return notFoundReply();
    case "E_CORRUPT":
      return failure(500, TEXT.corrupt);
    case "E_DISK":
      return failure(500, TEXT.readFailed);
    default:
      return internal(ctx, err);
  }
}

function readOne(ctx, id) {
  const read = readProject(id, { home: ctx.home });
  sayAll(ctx, read.warnings);
  return read;
}

function hasExactKeys(body, keys) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }
  const own = Object.keys(body);
  return (
    own.length === keys.length && keys.every((k) => Object.hasOwn(body, k))
  );
}

// ---- reading ------------------------------------------------------------------------

export function getProjects(ctx) {
  try {
    const r = listProjects({ home: ctx.home });
    sayAll(ctx, r.warnings);
    return ok(200, { projects: r.projects.map(listItem) });
  } catch (err) {
    return readFailure(ctx, err);
  }
}

export function getProject(ctx, id) {
  try {
    return ok(200, projectPage(readOne(ctx, id)));
  } catch (err) {
    return readFailure(ctx, err);
  }
}

export function getChat(ctx, id) {
  try {
    return ok(200, chatPage(readOne(ctx, id)));
  } catch (err) {
    return readFailure(ctx, err);
  }
}

export function getTask(ctx, id, task) {
  try {
    const page = taskPage(readOne(ctx, id), task);
    return page === null ? notFoundReply() : ok(200, page);
  } catch (err) {
    return readFailure(ctx, err);
  }
}

// n: the number of a role (decisions/0025, W5), checked against the catalog
// before any read.
export function getRole(ctx, id, n) {
  try {
    if (roleOfNo(n) === null) return notFoundReply();
    const card = roleCard(readOne(ctx, id), n);
    return card === null ? notFoundReply() : ok(200, card);
  } catch (err) {
    return readFailure(ctx, err);
  }
}

// ---- a new project (section 8.1) ----------------------------------------------------

function goodBudget(x) {
  return (
    typeof x === "number" &&
    Number.isFinite(x) &&
    x > 0 &&
    x <= LIMITS.BUDGET_MAX &&
    Number(x.toFixed(6)) === x
  );
}

function createFailure(ctx, err) {
  switch (codeOf(err)) {
    case "E_EVENT":
      return failure(400, TEXT.goalRefused, "goal");
    case "E_DISK":
      return failure(500, TEXT.createDisk);
    default:
      return internal(ctx, err);
  }
}

function whyNotStarted(err) {
  const code = codeOf(err);
  return code !== null && Object.hasOwn(WHY_NOT_STARTED, code)
    ? WHY_NOT_STARTED[code]
    : WHY_OTHER;
}

export async function postProject(ctx, body) {
  try {
    if (!hasExactKeys(body, ["goal", "budget_usd"])) {
      return failure(400, TEXT.badRequest);
    }
    const { goal, budget_usd: budget } = body;
    if (typeof goal !== "string") return failure(400, TEXT.badRequest);
    if (goal.trim() === "") return failure(400, TEXT.goalEmpty, "goal");
    if ([...goal].length > LIMITS.GOAL_MAX) {
      return failure(400, TEXT.goalLong, "goal");
    }
    if (!goodBudget(budget)) {
      return failure(400, TEXT.budgetBad, "budget_usd");
    }
    if (ctx.executor === "claude-cli" && !ctx.config.realRuns) {
      return failure(400, TEXT.realRunsOff);
    }
    const input = { goal, budget_usd: budget, executor: ctx.executor };
    if (ctx.executor === "scripted") input.scenario_bytes = ctx.scenarioBytes;
    let created;
    try {
      created = createProject(input, { home: ctx.home });
    } catch (err) {
      return createFailure(ctx, err);
    }
    sayAll(ctx, created.notices);
    const id = created.id;
    const project = { id, link: { to: "project", api: `/api/projects/${id}` } };
    const r = await ctx.engines.start(id);
    if (r.started) {
      return ok(201, { project, started: true, result_text: TEXT.created });
    }
    return ok(201, {
      project,
      started: false,
      result_text: createdNotStarted(whyNotStarted(r.error)),
    });
  } catch (err) {
    return internal(ctx, err);
  }
}

// ---- a message of the chat (section 8.2) --------------------------------------------

// The refusals of a sending, by code: [status, text, field] (design REQ-011 r3,
// section 10, the rows of the chat).
const CHAT_REFUSALS = Object.freeze({
  E_EVENT: [400, TEXT.chatEmpty, "text"],
  E_TOO_LONG: [400, TEXT.chatLong, "text"],
  E_MSG_TOO_BIG: [413, TEXT.tooBig, "text"],
  E_USAGE: [400, TEXT.badRequest, null],
  E_PROJECT_BUSY: [409, TEXT.chatBusy, null],
  E_CHANNEL_TIMEOUT: [504, TEXT.chatUnconfirmed, null],
  E_CHANNEL_UNCONFIRMED: [504, TEXT.chatUnconfirmed, null],
  // deliver repeats a sending only until the deadline of the ack, then throws.
  E_CHANNEL_STALE: [504, TEXT.chatUnconfirmed, null],
  E_ENGINE_STOPPING: [409, TEXT.chatStopping, null],
  E_CHANNEL_DROPPED: [409, TEXT.chatDropped, null],
  E_CHANNEL_FULL: [409, TEXT.chatFull, null],
  E_CHANNEL: [500, TEXT.chatLinkDown, null],
  E_CHANNEL_BAD: [500, TEXT.chatLinkDown, null],
  E_DISK: [500, TEXT.chatDisk, null],
  E_CORRUPT: [500, TEXT.corrupt, null],
});

// Exported for the tests of the refusals of the chat (design REQ-011 r3,
// section 8.2).
export function chatFailure(ctx, err) {
  const code = codeOf(err);
  if (code === "E_NOT_FOUND") return notFoundReply();
  // (design ISS-0010, section 5.2) The rollback of the core failed: the whole
  // line of the message may be in the journal.
  if (code === "E_DISK" && err?.details?.rollback === "failed") {
    return failure(500, TEXT.chatDiskUnsure, null);
  }
  if (code !== null && Object.hasOwn(CHAT_REFUSALS, code)) {
    const [status, text, field] = CHAT_REFUSALS[code];
    return failure(status, text, field);
  }
  return internal(ctx, err);
}

export async function postChat(ctx, id, body) {
  try {
    if (!hasExactKeys(body, ["text"]) || typeof body.text !== "string") {
      return failure(400, TEXT.badRequest);
    }
    let r;
    try {
      r = await deliver(
        id,
        { kind: "say", args: { text: body.text } },
        { home: ctx.home },
      );
    } catch (err) {
      return chatFailure(ctx, err);
    }
    const event = r.via === "engine" ? (r.ack?.event ?? null) : r.event;
    if (r.via !== "engine") sayAll(ctx, r.notices);
    return ok(200, { result_text: TEXT.sent, message: sentMessage(id, event) });
  } catch (err) {
    return internal(ctx, err);
  }
}

// ---- the control of a project (design REQ-035, section 6) ---------------------------

// The action of a body of the form of section 3.2, or null.
function controlAction(body) {
  if (
    hasExactKeys(body, ["action"]) &&
    (body.action === "pause" || body.action === "resume")
  ) {
    return body.action;
  }
  if (
    hasExactKeys(body, ["action", "confirmed"]) &&
    body.action === "stop" &&
    body.confirmed === true
  ) {
    return "stop";
  }
  return null;
}

// The refusals of a command, by code: [status, text] (section 6.4).
const CONTROL_REFUSALS = Object.freeze({
  E_DISK: [500, TEXT.ctlDisk],
  E_PROJECT_BUSY: [409, TEXT.ctlBusy],
  E_CHANNEL_FULL: [409, TEXT.ctlBusy],
  E_CHANNEL_DROPPED: [409, TEXT.ctlBusy],
  E_ENGINE_STOPPING: [409, TEXT.ctlStopping],
  E_CHANNEL_TIMEOUT: [504, TEXT.ctlUnconfirmed],
  E_CHANNEL_UNCONFIRMED: [504, TEXT.ctlUnconfirmed],
  E_CHANNEL_STALE: [504, TEXT.ctlUnconfirmed],
  E_CHANNEL: [500, TEXT.chatLinkDown],
  E_CHANNEL_BAD: [500, TEXT.chatLinkDown],
  E_USAGE: [400, TEXT.badRequest],
});

// The refusals of the engine about the state of the project: the text is chosen
// by the state read anew.
const STATE_CODES = Object.freeze([
  "E_PAUSE_STATE",
  "E_STOPPED",
  "E_FINISHED",
  "E_ALREADY_RUNNING",
  "E_NOT_STARTED",
  "E_OPEN_QUESTION",
  "E_BUDGET_NEEDED",
  "E_TRANSITION",
]);

// The checks of the executor before the engine "resume" opens.
const PREFLIGHT_CODES = Object.freeze([
  "E_SCENARIO",
  "E_CONFIG",
  "E_WORK_DIR",
  "E_NO_BUDGET",
  "E_REAL_RUNS_OFF",
  "E_EXECUTOR",
  "E_EXECUTOR_NOT_FOUND",
]);

// Exported for the tests of the refusals of the control (design REQ-035, section
// 6.4, CTL-7c). The message of the error never goes to the page.
export function controlFailure(ctx, id, action, err) {
  const code = codeOf(err);
  if (code === "E_NOT_FOUND") return notFoundReply();
  if (code === "E_CORRUPT") return failure(500, TEXT.corrupt);
  if (code === "E_DISK" && err?.details?.rollback === "failed") {
    return failure(500, TEXT.ctlDiskUnsure);
  }
  if (code !== null && Object.hasOwn(CONTROL_REFUSALS, code)) {
    const [status, text] = CONTROL_REFUSALS[code];
    return failure(status, text);
  }
  if (STATE_CODES.includes(code)) {
    // A read without the lock: it only chooses the text and allows nothing.
    let read;
    try {
      read = readProject(id, { home: ctx.home });
    } catch (readErr) {
      return readFailure(ctx, readErr);
    }
    const text = controlRefusal(action, read.state, read.events);
    return failure(409, text ?? TEXT.ctlBusy);
  }
  if (PREFLIGHT_CODES.includes(code)) {
    return failure(409, resumeFailed(whyNotStarted(err)));
  }
  return internal(ctx, err);
}

// A live engine leads the project: an engine of this server, or the lock is alive
// and its holder is an engine of another process.
function engineLive(ctx, id) {
  return ctx.engines.has(id) || engineHolder(id, { home: ctx.home }) !== null;
}

// Section 6.3, step 2: no live engine — the engine of the project in the process
// of the server, in the mode "resume".
async function resumeHere(ctx, id) {
  const r = await ctx.engines.resume(id);
  if (r.resumed) {
    return r.error === null
      ? ok(200, { result_text: TEXT.sent })
      : failure(500, TEXT.ctlResumedBroken);
  }
  if (r.error !== null) return controlFailure(ctx, id, "resume", r.error);
  return failure(504, TEXT.ctlUnconfirmed);
}

async function control(ctx, id, action) {
  let read;
  try {
    read = readOne(ctx, id);
  } catch (err) {
    return readFailure(ctx, err);
  }
  const refusal = controlRefusal(action, read.state, read.events);
  if (refusal !== null) return failure(409, refusal);
  try {
    if (action === "resume" && !engineLive(ctx, id)) {
      return await resumeHere(ctx, id);
    }
    const args = action === "resume" ? { parallel: null } : {};
    const r = await deliver(id, { kind: action, args }, { home: ctx.home });
    if (r.via !== "engine") sayAll(ctx, r.notices);
    return ok(200, { result_text: TEXT.sent });
  } catch (err) {
    return controlFailure(ctx, id, action, err);
  }
}

// body: the parsed JSON object of the request; id: checked against the pattern
// of a project by the route. One command per project at a time in this server
// (decisions/0032, C5).
export async function postControl(ctx, id, body) {
  try {
    const action = controlAction(body);
    if (action === null) return failure(400, TEXT.badRequest);
    if (ctx.controlling.has(id)) return failure(409, TEXT.ctlBusy);
    ctx.controlling.add(id);
    try {
      return await control(ctx, id, action);
    } finally {
      ctx.controlling.delete(id);
    }
  } catch (err) {
    return internal(ctx, err);
  }
}
