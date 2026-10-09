// Sai Team engine: the corrections r5.2 of the design (docs/design/REQ-013-team-engine.md,
// section 28): resume of a project that never started (F-7, sections 15.3, 17) and an
// answer for a task that failed only on the ceiling (F-8, section 9.2). Only the fake
// executable may be started by these commands, after assertSafeEnv (runTeam).
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { FAIL_DETAIL } from "../src/team/language.js";
import { openWriter } from "../src/team/store.js";
import {
  describeRun,
  execEnv,
  fakeStarts,
  makeProject,
  makeSandbox,
  runTeam,
  sha256,
  snapshot,
} from "./exec-helpers.js";

test(
  "F-7 resume of a project that never started: E_NOT_STARTED with its text, exit 1, nothing written",
  { timeout: 60_000 },
  (t) => {
    const sb = makeSandbox(t);
    const p = makeProject(sb, { tasks: 0 });
    const env = execEnv(sb);
    const before = sha256(fs.readFileSync(p.events));
    const tree = snapshot(p.dir);
    const r = runTeam(["resume", p.id], env);
    assert.equal(r.status, 1, describeRun(r));
    assert.equal(r.stdout, "");
    assert.equal(
      r.stderr,
      "E_NOT_STARTED: Проект ещё не запускался — запустите его командой start\n",
    );
    assert.equal(sha256(fs.readFileSync(p.events)), before);
    assert.deepStrictEqual(snapshot(p.dir), tree);
    assert.equal(fakeStarts(sb).length, 0);
  },
);

test(
  "F-8 an answer for a task that failed only on the ceiling: E_NOT_WAITING (no question is open for it), the journal unchanged; a task that failed otherwise still takes change",
  { timeout: 60_000 },
  (t) => {
    const sb = makeSandbox(t);
    const p = makeProject(sb, { tasks: 2 });
    const w = openWriter(p.id, { home: sb.home });
    try {
      for (const [id, detail] of [
        ["t-0001", FAIL_DETAIL.budget],
        ["t-0002", FAIL_DETAIL.failed],
      ]) {
        w.append({
          source: "ENGINE",
          type: "TASK_STARTED",
          task: id,
          data: {},
        });
        w.append({
          source: "ENGINE",
          type: "TASK_FAILED",
          task: id,
          data: { reason: "retries_exhausted", detail },
        });
      }
    } finally {
      w.close();
    }
    const env = execEnv(sb);
    const before = sha256(fs.readFileSync(p.events));
    for (const argv of [
      ["answer", p.id, "t-0001", "change", "--text", "Иначе"],
      ["answer", p.id, "t-0001", "reject"],
    ]) {
      const r = runTeam(argv, env);
      assert.equal(r.status, 1, describeRun(r));
      assert.equal(r.stderr, "E_NOT_WAITING: Задача не ждёт вашего решения\n");
      assert.equal(sha256(fs.readFileSync(p.events)), before);
    }
    const ok = runTeam(
      ["answer", p.id, "t-0002", "change", "--text", "Иначе"],
      env,
    );
    assert.equal(ok.status, 0, describeRun(ok));
    assert.equal(JSON.parse(ok.stdout).event.type, "DECISION_RECEIVED");
  },
);
