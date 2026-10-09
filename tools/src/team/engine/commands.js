// The commands of the engine of Sai Team (design REQ-013, section 15): the parse of
// their arguments and applyCommand — the one check and write of a command, for the
// engine (a message of its channel) and for a command without an engine. The check
// runs on the current state of the writer and the write follows in the same
// synchronous call (the protection is in the same operation).
import { maskSecrets } from "../../pixel-office/mask.js";
import {
  TeamError,
  engineError,
  eventError,
  transitionError,
} from "../errors.js";
import { LIMITS, PATTERNS } from "../schema.js";
import { checkDecision, openQuestions } from "./answers.js";
import { MIN_RUN_USD, PARALLEL_ALLOWED, slotBudget } from "./schedule.js";

const BUDGET_PATTERN = /^[0-9]+(\.[0-9]{1,6})?$/;
const KINDS = ["say", "pause", "resume", "stop", "budget", "answer"];
const LIVE = ["planning", "running", "waiting_user"];

function usage(message) {
  return new TeamError("E_USAGE", message);
}

function codePoints(s) {
  return [...s].length;
}

// The arguments of the new commands of the command line (section 15.1). Every
// check of the form is here, before the project is read. `positional` are the
// arguments after the id of the project; `options` the "--name value" pairs.
export const COMMANDS = Object.freeze({
  start: { positional: 1, min: 1, options: ["--parallel"] },
  resume: { positional: 1, min: 1, options: ["--parallel"] },
  pause: { positional: 1, min: 1, options: [] },
  stop: { positional: 1, min: 1, options: [] },
  budget: { positional: 2, min: 1, options: [] },
  answer: { positional: 3, min: 1, options: ["--text"] },
});

export function parseParallel(value) {
  if (value === undefined) return null;
  const n = /^[1-3]$/.test(value) ? Number(value) : NaN;
  if (!PARALLEL_ALLOWED.includes(n)) {
    throw usage("--parallel: число 1, 2 или 3");
  }
  return n;
}

export function parseBudget(value) {
  if (value === undefined) throw usage("Нужна сумма: budget <id> <сумма>");
  const n =
    typeof value === "string" &&
    value.length <= 20 &&
    BUDGET_PATTERN.test(value)
      ? Number(value)
      : NaN;
  if (!(n > 0 && n <= LIMITS.BUDGET_MAX)) {
    throw usage(
      `Сумма: число больше 0 и не больше ${LIMITS.BUDGET_MAX}, до 6 знаков после точки`,
    );
  }
  return n;
}

// args of a command line: [id, ...rest] and options; returns the args of the
// command ({ command, id, ... }).
export function parseCommand(command, positional, options) {
  const args = { command, id: positional[0] };
  switch (command) {
    case "start":
    case "resume":
      args.parallel = parseParallel(options["--parallel"]);
      break;
    case "budget":
      args.budget_usd = parseBudget(positional[1]);
      break;
    case "answer": {
      if (positional[1] === undefined) throw usage("Нужен номер задачи");
      const decision = positional[2];
      if (!["approve", "change", "reject"].includes(decision)) {
        throw usage("Решение: approve, change или reject");
      }
      const text = options["--text"];
      if (decision === "change" && text === undefined) {
        throw usage("Для change нужен --text");
      }
      if (decision !== "change" && text !== undefined) {
        throw usage("--text нужен только для change");
      }
      args.task = positional[1];
      args.decision = decision;
      args.text = text ?? null;
      break;
    }
    default:
      break;
  }
  return args;
}

// The message of a command: { kind, args } (section 13.3).
export function messageOf(args) {
  switch (args.command) {
    case "say":
      return { kind: "say", args: { text: args.text } };
    case "pause":
    case "stop":
      return { kind: args.command, args: {} };
    case "resume":
      return { kind: "resume", args: { parallel: args.parallel ?? null } };
    case "budget":
      return { kind: "budget", args: { budget_usd: args.budget_usd } };
    case "answer":
      return {
        kind: "answer",
        args: { task: args.task, decision: args.decision, text: args.text },
      };
    default:
      throw usage("Неизвестная команда");
  }
}

// The text of say and of answer change: the rule of the core (1 ... 4000 code
// points, before and after masking; E_TOO_LONG).
function checkText(text) {
  if (typeof text !== "string" || text.trim() === "") {
    // the rule of the core without an engine (writer.say): an empty text is E_EVENT
    throw eventError("text");
  }
  if (
    codePoints(text) > LIMITS.TEXT_MAX ||
    codePoints(maskSecrets(text)) > LIMITS.TEXT_MAX
  ) {
    throw new TeamError(
      "E_TOO_LONG",
      `Сообщение длиннее ${LIMITS.TEXT_MAX} знаков — сократите его`,
    );
  }
}

// Section 12.2: may the project be resumed now? Returns the `after` of
// PROJECT_RESUMED by the rule И13; throws the refusal of the design.
export function checkResume(state, facts, config) {
  switch (state.status) {
    case "planning":
    case "running":
      throw engineError("E_ALREADY_RUNNING");
    case "stopped":
      throw engineError("E_STOPPED");
    case "done":
    case "failed":
      throw engineError("E_FINISHED");
    case "paused":
    case "waiting_user":
      break;
    case "created":
      throw engineError("E_NOT_STARTED");
    default:
      throw transitionError(
        "И13",
        "возобновить можно только проект на паузе или ждущий решения",
      );
  }
  const open = openQuestions(state, facts).find((q) => q.task !== null);
  if (open !== undefined) {
    throw engineError("E_OPEN_QUESTION", { id: state.id, task: open.task });
  }
  if (state.status === "paused") {
    return state.paused_by === "recovery" ? "recovery" : "command";
  }
  if (state.waiting !== null && state.waiting.reason === "budget") {
    const reserve = slotBudget(state, config, 0);
    if (reserve !== null && reserve < MIN_RUN_USD) {
      throw engineError("E_BUDGET_NEEDED", { id: state.id });
    }
    return "budget";
  }
  return "decision";
}

function checkArgs(kind, args) {
  if (!KINDS.includes(kind) || args === null || typeof args !== "object") {
    throw usage("Неизвестная команда");
  }
}

function messageFields(opts) {
  if (opts.msg === undefined || opts.msg === null) return {};
  if (!PATTERNS.msg.test(opts.msg) || !PATTERNS.nonce.test(opts.nonce)) {
    throw new TeamError("E_INTERNAL", "Внутренняя ошибка ядра Sai Team (msg)");
  }
  return { msg: opts.msg, nonce: opts.nonce };
}

// A value a command needs and did not get: undefined and null alike (r5.3).
function absent(value) {
  return value === undefined || value === null;
}

// Section 15.5: the check by the current state and the write, one synchronous
// call. opts = { msg?, nonce? (a message of the channel), facts (for resume and
// answer), config (for resume) }. Returns the event; a refusal throws a TeamError
// and the journal is not changed.
export function applyCommand(writer, message, opts = {}) {
  const { kind, args } = message ?? {};
  checkArgs(kind, args);
  const ids = messageFields(opts);
  const state = writer.state;
  switch (kind) {
    case "say":
      checkText(args.text);
      return writer.append({
        source: "USER",
        type: "CHAT",
        task: null,
        data: { text: args.text, kind: "message", truncated: false, ...ids },
      });
    case "pause":
      if (!LIVE.includes(state.status)) throw engineError("E_PAUSE_STATE");
      return writer.append({
        source: "USER",
        type: "PROJECT_PAUSED",
        task: null,
        data: { ...ids },
      });
    case "resume": {
      if (absent(opts.facts) || absent(opts.config)) {
        throw new TeamError(
          "E_INTERNAL",
          "Внутренняя ошибка ядра Sai Team (resume)",
        );
      }
      const parallel = args.parallel ?? null;
      if (parallel !== null && !PARALLEL_ALLOWED.includes(parallel)) {
        throw usage("--parallel: число 1, 2 или 3");
      }
      const after = checkResume(state, opts.facts, opts.config);
      return writer.append({
        source: "USER",
        type: "PROJECT_RESUMED",
        task: null,
        data: { parallel, after, ...ids },
      });
    }
    case "stop":
      if (state.status === "stopped") throw engineError("E_STOPPED");
      if (state.status === "done" || state.status === "failed") {
        throw engineError("E_FINISHED");
      }
      return writer.append({
        source: "USER",
        type: "PROJECT_STOPPED",
        task: null,
        data: { ...ids },
      });
    case "budget": {
      const b = args.budget_usd;
      if (typeof b !== "number" || !(b > 0) || b > LIMITS.BUDGET_MAX) {
        throw usage(
          `Сумма: число больше 0 и не больше ${LIMITS.BUDGET_MAX}, до 6 знаков после точки`,
        );
      }
      if (!(b > state.spent_usd)) throw engineError("E_BUDGET_LOW");
      return writer.append({
        source: "USER",
        type: "BUDGET_SET",
        task: null,
        data: { budget_usd: b, ...ids },
      });
    }
    case "answer": {
      const text = args.text ?? null;
      if (text !== null) checkText(text);
      if (absent(opts.facts)) {
        throw new TeamError(
          "E_INTERNAL",
          "Внутренняя ошибка ядра Sai Team (answer)",
        );
      }
      checkDecision(state, args.task, args.decision, text, opts.facts);
      return writer.append({
        source: "USER",
        type: "DECISION_RECEIVED",
        task: args.task,
        data: { decision: args.decision, text, ...ids },
      });
    }
    default:
      throw usage("Неизвестная команда");
  }
}
