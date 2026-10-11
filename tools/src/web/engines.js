// The engines of REQ-013 in the process of the server (design REQ-011, section
// 8.3; design REQ-035, section 7; decisions/0025, W1, and 0030, section 2). The
// right to write a project is the lock of the core with holder "engine" and the
// pid of the server; the server starts no process.
import { createEngine } from "../team/engine/engine.js";
import { TeamError, engineError, formatError } from "../team/errors.js";
import { ENGINE_START_WAIT_MS, START_POLL_MS } from "./config.js";

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The statuses a paused project reaches only by PROJECT_RESUMED (design REQ-035,
// section 7, step 1).
const RESUMED = Object.freeze(["planning", "running", "waiting_user", "done"]);

// opts = { home, env, warn, create? }; warn gets one line for stderr; create — the
// factory of an engine (createEngine of the engine by default; only the tests give
// another one).
// Engines = { start(id), resume(id), has(id), stopAll(waitMs), size() }
export function createEngines({ home, env, warn, create = createEngine }) {
  const running = new Map(); // id -> { engine, done, settled, error }

  function report(id, err) {
    try {
      warn(`проект ${id}: ${formatError(err)}`);
    } catch {
      // A failing report must not change the result.
    }
  }

  // The engine of a project in this process, in the mode "start" or "resume":
  // { entry } — it runs (the end is not awaited), or { error } — it was not made.
  function launch(id, mode) {
    let engine;
    try {
      engine = create(id, { home, env, mode });
    } catch (err) {
      report(id, err);
      return { entry: null, error: err };
    }
    const entry = { engine, done: null, settled: false, error: null };
    running.set(id, entry);
    let run;
    try {
      run = engine.run();
    } catch (err) {
      run = Promise.reject(err);
    }
    entry.done = run.then(
      () => {},
      (err) => {
        entry.error = err;
        report(id, err);
      },
    );
    entry.done = entry.done.finally(() => {
      entry.settled = true;
      if (running.get(id) === entry) running.delete(id);
    });
    return { entry, error: null };
  }

  // { started, error }: started — the engine wrote its start (the project is no
  // longer "created"), or it is still opening when the wait is over; error — the
  // refusal of the engine (a TeamError) when it ended before.
  async function start(id) {
    if (running.has(id)) return { started: true, error: null };
    const { entry, error } = launch(id, "start");
    if (entry === null) return { started: false, error };
    const { engine } = entry;

    const deadline = Date.now() + ENGINE_START_WAIT_MS;
    for (;;) {
      if (entry.error !== null) return { started: false, error: entry.error };
      const s = engine.state();
      if (s !== null && s.status !== "created") {
        return { started: true, error: null };
      }
      if (entry.settled || Date.now() >= deadline) {
        return { started: true, error: null };
      }
      await pause(START_POLL_MS);
    }
  }

  // { resumed, error, late } (design REQ-035, section 7): resumed — the engine
  // wrote the resumption (error is then its failure if it already ended); error
  // alone — the refusal of the engine; late — neither within the wait. The first
  // look is made at once, before the first await.
  async function resume(id) {
    if (running.has(id)) {
      return {
        resumed: false,
        error: engineError("E_ALREADY_RUNNING"),
        late: false,
      };
    }
    const deadline = Date.now() + ENGINE_START_WAIT_MS;
    const { entry, error } = launch(id, "resume");
    if (entry === null) return { resumed: false, error, late: false };
    const { engine } = entry;

    for (;;) {
      const s = engine.state();
      if (s !== null && RESUMED.includes(s.status)) {
        return { resumed: true, error: entry.error, late: false };
      }
      if (entry.error !== null) {
        return { resumed: false, error: entry.error, late: false };
      }
      if (entry.settled) {
        return {
          resumed: false,
          error: new TeamError(
            "E_INTERNAL",
            "Внутренняя ошибка ядра Sai Team (resume)",
          ),
          late: false,
        };
      }
      if (Date.now() >= deadline) {
        return { resumed: false, error: null, late: true };
      }
      await pause(START_POLL_MS);
    }
  }

  // An engine of this server leads the project now.
  function has(id) {
    const entry = running.get(id);
    return entry !== undefined && !entry.settled;
  }

  // The first signal of the server: every engine pauses its project (as Ctrl-C of
  // the command start). true — all of them ended within waitMs.
  async function stopAll(waitMs) {
    const entries = [];
    for (const [id, entry] of running) {
      entries.push(entry);
      try {
        entry.engine.requestStop("signal");
      } catch (err) {
        report(id, err);
      }
    }
    if (entries.length === 0) return true;
    let timer = null;
    const late = new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), waitMs);
    });
    const all = Promise.all(entries.map((e) => e.done)).then(() => true);
    try {
      return await Promise.race([all, late]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    start,
    resume,
    has,
    stopAll,
    size: () => running.size,
  };
}
