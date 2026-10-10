// The engines of REQ-013 in the process of the server (design REQ-011, section
// 8.3; decisions/0025, W1). The right to write a project is the lock of the core
// with holder "engine" and the pid of the server; the server starts no process.
import { createEngine } from "../team/engine/engine.js";
import { formatError } from "../team/errors.js";
import { ENGINE_START_WAIT_MS, START_POLL_MS } from "./config.js";

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// opts = { home, env, warn }; warn gets one line for stderr.
// Engines = { start(id), stopAll(waitMs), size() }
export function createEngines({ home, env, warn }) {
  const running = new Map(); // id -> { engine, done, settled, error }

  function report(id, err) {
    try {
      warn(`проект ${id}: ${formatError(err)}`);
    } catch {
      // A failing report must not change the result.
    }
  }

  // { started, error }: started — the engine wrote its start (the project is no
  // longer "created"), or it is still opening when the wait is over; error — the
  // refusal of the engine (a TeamError) when it ended before.
  async function start(id) {
    if (running.has(id)) return { started: true, error: null };
    let engine;
    try {
      engine = createEngine(id, { home, env, mode: "start" });
    } catch (err) {
      report(id, err);
      return { started: false, error: err };
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
    stopAll,
    size: () => running.size,
  };
}
