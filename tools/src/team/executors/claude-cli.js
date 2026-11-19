// The executor `claude-cli` (design REQ-010, section 5): one attempt of a task is
// one process of Claude Code in print mode, with the text of the task on stdin, a
// fixed list of arguments, an environment from a fixed list and its own process
// group. The only real executor of Sai Team.
//
// A real run happens only when SAI_TEAM_REAL_RUNS is exactly "1" and the project
// has a ceiling of cost above 0; run() checks it itself before the process (the
// protection is in the same operation).
import cp from "node:child_process";
import fs from "node:fs";
import {
  CHILD_ENV_ALLOW,
  GROUP_GONE_WAIT_MS,
  KILL_GRACE_MS,
} from "../config.js";
import { executorError } from "../errors.js";
import {
  ACTIVITY_MAX,
  buildPrompt,
  allowedToolsForRole,
  checkAnswer,
  checkBudget,
  floor6,
  toolsForRole,
} from "../executor.js";
import { FAIL_DETAIL } from "../language.js";
import { groupAlive, stopGroup } from "./proc.js";
import { createStreamParser } from "./stream.js";

export const code = "claude-cli";

// Deny rules of WebFetch for local addresses (section 5.2, Q11).
export const WEB_DENY_RULES = Object.freeze([
  "WebFetch(domain:localhost)",
  "WebFetch(domain:127.0.0.1)",
  "WebFetch(domain:[::1])",
  "WebFetch(domain:0.0.0.0)",
  "WebFetch(domain:169.254.169.254)",
]);

const LINE_BYTES_MAX = 8 * 1024 * 1024;
const OUTPUT_BYTES_MAX = 64 * 1024 * 1024;
const NOT_FOUND_CODES = new Set(["ENOENT", "EACCES", "ENOTDIR"]);
// After the group is gone, the rest of the output has this long to arrive.
const CLOSE_GRACE_MS = 500;

// Up to 6 digits after the point, rounded down, never an exponent.
export function formatUsd(value) {
  const fixed = floor6(value).toFixed(6);
  return fixed.replace(/0+$/, "").replace(/\.$/, "");
}

// The arguments, in the fixed order of section 5.2. The text of the task is not
// an argument: it goes to stdin. --allowedTools holds WebFetch only as one rule
// per site of SAI_TEAM_WEB_DOMAINS (ISS-0119); with --permission-prompts none
// any other address is not allowed.
export function buildArgs(request, config) {
  const tools = toolsForRole(request.role, config);
  const list = tools.join(",");
  const allowed = allowedToolsForRole(request.role, config).join(",");
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--max-budget-usd",
    formatUsd(request.limits.max_budget_usd),
    "--json-schema",
    JSON.stringify(request.answer_schema),
    "--tools",
    list,
    "--allowedTools",
    allowed,
  ];
  if (tools.includes("WebFetch")) {
    args.push("--disallowedTools", WEB_DENY_RULES.join(","));
  }
  args.push(
    "--permission-prompts",
    "none",
    "--restricted",
    "--safe-mode",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--append-system-prompt",
    request.role.internal.prompt,
  );
  return args;
}

// Only the names of CHILD_ENV_ALLOW that are set; no key, token or SAI_TEAM_*.
export function buildChildEnv(env) {
  const out = {};
  const source = env ?? {};
  for (const name of CHILD_ENV_ALLOW) {
    if (typeof source[name] === "string") out[name] = source[name];
  }
  return out;
}

function checkWorkDir(dir) {
  let st;
  try {
    st = fs.lstatSync(dir);
  } catch {
    throw executorError("E_WORK_DIR");
  }
  if (!st.isDirectory() || st.isSymbolicLink()) {
    throw executorError("E_WORK_DIR");
  }
}

// The conditions of a real run (section 5.1), in this order. Writes nothing.
export function check(request, io) {
  if (request.project.executor !== code) throw executorError("E_EXECUTOR");
  if (io.config.realRuns !== true) throw executorError("E_REAL_RUNS_OFF");
  if (!(request.project.budget_usd > 0)) throw executorError("E_NO_BUDGET");
  checkWorkDir(request.limits.work_dir);
  checkBudget(request);
}

function baseResult(stats) {
  return {
    executor: code,
    outcome: "failed",
    transient: true,
    spawned: false,
    answer: null,
    summary: null,
    files: [],
    outputs: [],
    memory: [],
    cost_usd: null,
    detail: null,
    stats,
  };
}

// The outcome of a finished process (the table of section 5.4).
function outcomeOf(state, parsed) {
  if (state.cancelled) {
    return { outcome: "cancelled", transient: false, detail: null };
  }
  if (state.timedOut) {
    return { outcome: "timeout", transient: true, detail: FAIL_DETAIL.timeout };
  }
  if (state.tooBig) {
    return {
      outcome: "invalid_output",
      transient: true,
      detail: FAIL_DETAIL.too_big,
    };
  }
  if (parsed.broken > 0 || parsed.result === null) {
    return parsed.webError
      ? { outcome: "network", transient: true, detail: FAIL_DETAIL.network }
      : {
          outcome: "invalid_output",
          transient: true,
          detail: FAIL_DETAIL.invalid_output,
        };
  }
  const r = parsed.result;
  if (state.exitCode !== 0 || r.is_error || r.subtype !== "success") {
    return parsed.webError
      ? { outcome: "network", transient: true, detail: FAIL_DETAIL.network }
      : { outcome: "failed", transient: true, detail: FAIL_DETAIL.failed };
  }
  if (r.answer === null) {
    return {
      outcome: "invalid_output",
      transient: true,
      detail: FAIL_DETAIL.invalid_output,
    };
  }
  return { outcome: "ok", transient: false, detail: null };
}

// One attempt. Throws a TeamError only before the process (the conditions);
// after the start every failure is a RunResult.
export async function run(request, io) {
  check(request, io);
  const config = io.config;
  const args = buildArgs(request, config);
  const env = buildChildEnv(io.env ?? process.env);
  const prompt = buildPrompt(request);
  const stats = { lines: 0, skipped: 0, activities: 0, dropped_activities: 0 };
  const signal = io.signal ?? null;
  if (signal !== null && signal.aborted) {
    return { ...baseResult(stats), outcome: "cancelled", transient: false };
  }
  // Again right before the process: the folder may have gone since check().
  checkWorkDir(request.limits.work_dir);
  const spawn = typeof io.spawn === "function" ? io.spawn : cp.spawn;
  const answerSchema = request.answer_schema;

  const parser = createStreamParser();
  const state = {
    cancelled: false,
    timedOut: false,
    tooBig: false,
    groupStuck: false,
    exitCode: null,
  };
  let child;
  try {
    child = spawn(config.claudeBin, args, {
      cwd: request.limits.work_dir,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      detached: true,
      windowsHide: true,
    });
  } catch (err) {
    return spawnFailure(stats, err);
  }

  // stop(): the whole group, once. Once the process has exited, the wait for
  // 'close' is bounded (forceClose below): a descendant that left the group may
  // keep stdout open, and then 'close' never comes.
  let stopping = null;
  let exited = false;
  let forceClose = () => {};
  const graceTimers = [];
  const forceCloseSoon = () => {
    graceTimers.push(setTimeout(() => forceClose(), CLOSE_GRACE_MS));
  };
  const stop = () => {
    if (stopping !== null || !Number.isInteger(child.pid)) return;
    stopping = stopGroup(child.pid, {
      graceMs: KILL_GRACE_MS,
      waitMs: GROUP_GONE_WAIT_MS,
    }).then(
      (gone) => {
        if (!gone) state.groupStuck = true;
      },
      () => {
        state.groupStuck = true;
      },
    );
    stopping.then(() => {
      // The group is gone (or even SIGKILL did not end it): after the exit there
      // is nothing more to wait for than the rest of the output.
      if (exited || state.groupStuck) forceCloseSoon();
    });
  };

  function deliver(line) {
    const { events } = parser.push(line);
    for (const event of events) {
      if (stats.activities >= ACTIVITY_MAX) {
        stats.dropped_activities += 1;
        continue;
      }
      stats.activities += 1;
      try {
        io.onEvent(event);
      } catch {
        // The caller handles the failures of its own writes (it aborts the run).
      }
    }
  }

  // The tail of the current line is kept as a list of chunks and joined once, when
  // its end comes (not on every chunk: a long line would be copied again and
  // again).
  let pending = [];
  let pendingBytes = 0;
  let total = 0;
  function takeLine(end) {
    pending.push(end);
    const line = Buffer.concat(pending, pendingBytes + end.length);
    pending = [];
    pendingBytes = 0;
    return line.toString("utf8");
  }
  function onData(chunk) {
    if (state.tooBig) return;
    total += chunk.length;
    if (total > OUTPUT_BYTES_MAX) {
      state.tooBig = true;
      stop();
      return;
    }
    let rest = chunk;
    let at = rest.indexOf(0x0a);
    while (at !== -1) {
      deliver(takeLine(rest.subarray(0, at)));
      rest = rest.subarray(at + 1);
      at = rest.indexOf(0x0a);
    }
    if (rest.length > 0) {
      pending.push(rest);
      pendingBytes += rest.length;
    }
    if (pendingBytes > LINE_BYTES_MAX) {
      state.tooBig = true;
      pending = [];
      pendingBytes = 0;
      stop();
    }
  }

  const timer = setTimeout(() => {
    state.timedOut = true;
    stop();
  }, request.limits.timeout_ms);
  const onAbort = () => {
    state.cancelled = true;
    stop();
  };
  if (signal !== null)
    signal.addEventListener("abort", onAbort, { once: true });

  let spawnError = null;
  let drainTimer = null;
  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    // The process has exited but its stdout/stderr are still open: a process of
    // this attempt (one that left the group) is alive. The streams are closed and
    // the run ends as one whose processes could not be stopped (section 5.6).
    forceClose = () => {
      if (done) return;
      state.groupStuck = true;
      child.stdin?.destroy();
      child.stdout?.destroy();
      child.stderr?.destroy();
      finish();
    };
    child.once("error", (err) => {
      spawnError = err;
      if (!Number.isInteger(child.pid)) finish();
    });
    child.once("exit", (exitCode) => {
      exited = true;
      state.exitCode = exitCode;
      if (done) return;
      // Leftovers of the group (a child that kept running) are stopped too.
      if (Number.isInteger(child.pid) && groupAlive(child.pid)) stop();
      // A bounded wait for 'close', whether stop() was called or not; a stop
      // (timeout, cancel, too much output) ends the wait sooner.
      drainTimer = setTimeout(() => forceClose(), GROUP_GONE_WAIT_MS);
      if (stopping !== null) stopping.then(forceCloseSoon);
    });
    child.once("close", finish);
    child.stdout?.on("data", onData);
    child.stdout?.on("error", () => {});
    // stderr is drained and never kept or written (paths and internals, Q7).
    child.stderr?.on("data", () => {});
    child.stderr?.on("error", () => {});
    child.stdin?.on("error", () => {});
    try {
      child.stdin?.end(prompt, "utf8");
    } catch {
      // The process died before reading: the outcome comes from its exit.
    }
  });
  clearTimeout(timer);
  if (drainTimer !== null) clearTimeout(drainTimer);
  if (stopping !== null) await stopping;
  for (const t of graceTimers) clearTimeout(t);
  if (signal !== null) signal.removeEventListener("abort", onAbort);

  if (!Number.isInteger(child.pid)) return spawnFailure(stats, spawnError);
  if (pendingBytes > 0 && !state.tooBig) deliver(takeLine(Buffer.alloc(0)));
  const parsed = parser.finish();
  stats.lines = parsed.lines;
  stats.skipped = parsed.skipped;
  const out = { ...baseResult(stats), spawned: true };
  out.cost_usd = parsed.result === null ? null : parsed.result.cost;
  let verdict = outcomeOf(state, parsed);
  if (
    verdict.outcome === "ok" &&
    !checkAnswer(answerSchema, parsed.result.answer).ok
  ) {
    verdict = {
      outcome: "invalid_output",
      transient: true,
      detail: FAIL_DETAIL.schema,
    };
  }
  out.outcome = verdict.outcome;
  out.transient = verdict.transient;
  out.detail = verdict.detail;
  // The amendment "the group is not gone" (section 5.4) goes after every
  // outcome, the answer schema included: the processes of this attempt may be
  // alive, so there is no retry, and an ok result is not accepted.
  if (state.groupStuck) {
    out.detail = FAIL_DETAIL.group;
    out.transient = false;
    if (out.outcome === "ok") out.outcome = "failed";
  }
  if (out.outcome !== "ok") return out;

  const answer = parsed.result.answer;
  return {
    ...out,
    transient: false,
    answer,
    // The answers of the engine without a work (plan, review, goal check, choice
    // of a role; design REQ-013) have neither summary nor files.
    summary: typeof answer.summary === "string" ? answer.summary : null,
    files: (Array.isArray(answer.files) ? answer.files : []).map((f) => ({
      path: f.path,
      kind: f.kind ?? "result",
    })),
    memory: Array.isArray(answer.memory)
      ? answer.memory.map((m) => ({ kind: m.kind, text: m.text }))
      : [],
  };
}

function spawnFailure(stats, err) {
  const notFound = err && NOT_FOUND_CODES.has(err.code);
  return {
    ...baseResult(stats),
    outcome: notFound ? "not_found" : "failed",
    transient: !notFound,
    spawned: false,
    detail: notFound ? FAIL_DETAIL.not_found : FAIL_DETAIL.failed,
  };
}
