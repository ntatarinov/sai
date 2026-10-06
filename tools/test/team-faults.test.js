// Sai Team core: failures of the disk do not bring the process down (design REQ-009,
// criterion 13, TM-45 ... TM-48). Every failure is injected with fault-inject.js: in
// the process of the test through withFaults (the API), in a child process through
// --import (the commands).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { EXIT, TeamError } from "../src/team/errors.js";
import { runGuarded } from "../src/team/cli.js";
import { createProject, openWriter, readProject } from "../src/team/store.js";
import { withFaults } from "./fault-inject.js";
import {
  assertOnlyDeadLockAdded,
  assertRefusal,
  describeRun,
  journalOf,
  makeClock,
  makeHome,
  openTracked,
  runTeam,
  runWriterChild,
  snapshot,
  startProject,
  typesOf,
  usr,
} from "./team-helpers.js";

const INPUT = { goal: "Цель", budget_usd: 1, executor: "claude-cli" };

function closedProject(t, over = {}) {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock(), over);
  p.writer.close();
  return { ...p, home };
}

function assertNoStack(text) {
  assert.doesNotMatch(text, /\n\s+at /);
  assert.doesNotMatch(text, /Uncaught|node:internal|\.js:\d+/);
}

// (r6) After a command whose write of the journal failed (the writer was broken, its
// process ended): the folder is as it was except writer.lock of the dead process;
// the next command takes the stale lock (only LOCK_STALE_REMOVED and its own event
// are added: the fixture has no open run) and works.
function assertNextCommandRecovers(p, before, pid, lines) {
  assertOnlyDeadLockAdded(p.dir, before, pid);
  assert.equal(
    journalOf(p.events).length,
    lines,
    "no event of the failed call",
  );
  const next = runTeam(p.home, ["say", p.id, "--text", "Ещё раз"]);
  assert.equal(next.status, 0, describeRun(next));
  assert.deepStrictEqual(typesOf(journalOf(p.events).slice(lines)), [
    "LOCK_STALE_REMOVED",
    "CHAT",
  ]);
  assert.equal(journalOf(p.events).at(-2).data.pid, pid);
  assert.equal(fs.existsSync(path.join(p.dir, "writer.lock")), false);
}

// ---- TM-45 ---------------------------------------------------------------------------

test("TM-45 EACCES while the folder of a project is created: E_DISK, the data folder is as it was, the next call works", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const randomId = () => "a1b2c3";
  const id = "p-20260101-a1b2c3";
  const before = snapshot(home);
  const realMkdir = fs.mkdirSync;
  const result = withFaults(
    [
      {
        fn: "mkdirSync",
        paths: [path.join(home, `.creating-${id}`)],
        effect: "throw",
        code: "EACCES",
      },
    ],
    () => createProject(INPUT, { home, now: clock, randomId }),
  );
  assert.deepStrictEqual(result.fired, [true]);
  assert.equal(fs.mkdirSync, realMkdir);
  assert.ok(result.error instanceof TeamError, String(result.error));
  assert.equal(result.error.code, "E_DISK");
  assert.equal(result.error.details.os_code, "EACCES");
  assert.equal(
    result.error.message,
    "Не удалось записать на диск (EACCES); данные проекта не изменены",
  );
  assertNoStack(String(result.error.stack ?? "").split("\n")[0]);
  assert.deepStrictEqual(snapshot(home), before);
  const next = createProject(INPUT, { home, now: clock, randomId });
  assert.equal(next.id, id);
  assert.equal(readProject(id, { home }).state.goal, "Цель");
});

for (const [fn, target, code] of [
  ["writeFileSync", "events.jsonl", "EIO"],
  ["renameSync", null, "EXDEV"],
  ["mkdirSync", "files", "ENOSPC"],
]) {
  test(`TM-45 a failure of ${fn} later in the creation leaves no folder behind`, (t) => {
    const home = makeHome(t);
    const clock = makeClock();
    const id = "p-20260101-a1b2c3";
    const creating = path.join(home, `.creating-${id}`);
    const fault =
      fn === "renameSync"
        ? { fn, from: creating, effect: "throw", code }
        : { fn, paths: [path.join(creating, target)], effect: "throw", code };
    const before = snapshot(home);
    const result = withFaults([fault], () =>
      createProject(INPUT, { home, now: clock, randomId: () => "a1b2c3" }),
    );
    assert.deepStrictEqual(result.fired, [true]);
    assert.equal(result.error.code, "E_DISK");
    assert.equal(result.error.details.os_code, code);
    assert.deepStrictEqual(
      snapshot(home),
      before,
      "no .creating-* and no project",
    );
    assert.deepStrictEqual(fs.readdirSync(home), []);
  });
}

// ---- TM-46 ---------------------------------------------------------------------------

for (const code of ["ENOSPC", "EIO"]) {
  test(`TM-46 ${code} on the write of the journal during say: code 1, E_DISK, no stack, nothing changed`, (t) => {
    const p = closedProject(t);
    const before = snapshot(p.dir);
    const r = runTeam(p.home, ["say", p.id, "--text", "Привет"], {
      faults: [{ fn: "writeSync", paths: [p.events], effect: "throw", code }],
    });
    assert.equal(r.status, 1, describeRun(r));
    assert.equal(r.signal, null);
    assert.equal(r.stdout, "");
    assert.equal(
      r.stderr,
      `E_DISK: Не удалось записать на диск (${code}); данные проекта не изменены\n`,
    );
    assertNoStack(r.stderr);
    assertNextCommandRecovers(p, before, r.pid, 1);
  });
}

test("TM-46 a failure of fsync during say is E_DISK too, and the journal is as it was", (t) => {
  const p = closedProject(t);
  const before = snapshot(p.dir);
  const r = runTeam(p.home, ["say", p.id, "--text", "Привет"], {
    faults: [
      { fn: "fsyncSync", paths: [p.events], effect: "throw", code: "EIO" },
    ],
  });
  assert.equal(r.status, 1, describeRun(r));
  assert.match(r.stderr, /^E_DISK: Не удалось записать на диск \(EIO\)/);
  assertNoStack(r.stderr);
  assert.equal(journalOf(p.events).length, 1);
  assertNextCommandRecovers(p, before, r.pid, 1);
});

test("TM-46 a failure to read is E_DISK with its own text; reading changes nothing", (t) => {
  const p = closedProject(t);
  const before = snapshot(p.dir);
  const open = runTeam(p.home, ["project", p.id], {
    faults: [
      { fn: "openSync", paths: [p.events], effect: "throw", code: "EIO" },
    ],
  });
  assert.equal(open.status, 1, describeRun(open));
  assert.equal(
    open.stderr,
    "E_DISK: Не удалось прочитать данные проекта (EIO)\n",
  );
  const stat = runTeam(p.home, ["events", p.id], {
    faults: [
      { fn: "lstatSync", paths: [p.dir], effect: "throw", code: "EACCES" },
    ],
  });
  assert.equal(stat.status, 1, describeRun(stat));
  assert.equal(
    stat.stderr,
    "E_DISK: Не удалось прочитать данные проекта (EACCES)\n",
  );
  assert.deepStrictEqual(snapshot(p.dir), before);
});

test("TM-46 a failure to take the lock or to narrow a mode: E_DISK, no leftover, no event", (t) => {
  const p = closedProject(t);
  const lock = path.join(p.dir, "writer.lock");
  const before = snapshot(p.dir);
  const link = withFaults(
    [{ fn: "linkSync", to: lock, effect: "throw", code: "EIO" }],
    () => openWriter(p.id, { home: p.home, now: makeClock(Date.now(), 1) }),
  );
  assert.deepStrictEqual(link.fired, [true]);
  assert.equal(link.error.code, "E_DISK");
  assert.deepStrictEqual(snapshot(p.dir), before, "no writer.lock, no .new");

  fs.chmodSync(p.dir, 0o755);
  const wide = snapshot(p.dir);
  const chmod = withFaults(
    [{ fn: "chmodSync", paths: [p.dir], effect: "throw", code: "EPERM" }],
    () => openWriter(p.id, { home: p.home, now: makeClock(Date.now(), 1) }),
  );
  assert.deepStrictEqual(chmod.fired, [true]);
  assert.equal(chmod.error.code, "E_DISK");
  assert.equal(chmod.error.details.os_code, "EPERM");
  assert.deepStrictEqual(
    snapshot(p.dir),
    wide,
    "the lock is given back, nothing is written",
  );
  assert.equal(journalOf(p.events).length, 1);
});

// ---- TM-47 ---------------------------------------------------------------------------

test("TM-47 EIO while a result file is written: E_DISK, files/ and the journal as they were, the writer goes on", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  w.say("До");
  const filesDir = path.join(p.dir, "files");
  const before = snapshot(p.dir);
  const state = structuredClone(w.state);
  const realWrite = fs.writeFileSync;
  const result = withFaults(
    [
      {
        fn: "writeFileSync",
        paths: [path.join(filesDir, ".partial-report.md")],
        effect: "throw",
        code: "EIO",
      },
    ],
    () => w.writeResultFile({ name: "report.md", content: "Итог" }),
  );
  assert.deepStrictEqual(result.fired, [true]);
  assert.equal(fs.writeFileSync, realWrite);
  assert.ok(result.error instanceof TeamError, String(result.error));
  assert.equal(result.error.code, "E_DISK");
  assert.equal(result.error.details.os_code, "EIO");
  assert.deepStrictEqual(fs.readdirSync(filesDir), []);
  assert.deepStrictEqual(snapshot(p.dir), before);
  assert.deepStrictEqual(w.state, state);
  // the writer is not broken: the journal was not touched
  w.writeResultFile({ name: "report.md", content: "Итог" });
  w.say("После");
  assert.equal(w.state.files.length, 1);
  assert.deepStrictEqual(fs.readdirSync(filesDir), ["report.md"]);
});

test("TM-47 a failure at the link, at the removal of the partial file or at the event leaves no file and does not break the writer", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  const filesDir = path.join(p.dir, "files");
  const partial = path.join(filesDir, ".partial-a.md");
  const target = path.join(filesDir, "a.md");
  let before = snapshot(p.dir);
  let r = withFaults(
    [
      {
        fn: "linkSync",
        from: partial,
        to: target,
        effect: "throw",
        code: "EIO",
      },
    ],
    () => w.writeResultFile({ name: "a.md", content: "Текст" }),
  );
  assert.deepStrictEqual(r.fired, [true]);
  assert.equal(r.error.code, "E_DISK");
  assert.deepStrictEqual(snapshot(p.dir), before, "after a failed link");

  r = withFaults(
    [{ fn: "unlinkSync", paths: [partial], effect: "throw", code: "EIO" }],
    () => w.writeResultFile({ name: "a.md", content: "Текст" }),
  );
  assert.deepStrictEqual(r.fired, [true]);
  assert.equal(r.error.code, "E_DISK");
  assert.equal(
    fs.existsSync(target),
    false,
    "the published file is taken back",
  );
  assert.equal(
    journalOf(p.events).some((e) => e.type === "RESULT_FILE"),
    false,
  );

  // the event cannot be written: the file is removed again and the writer is broken
  before = snapshot(p.dir);
  r = withFaults(
    [{ fn: "writeSync", paths: [p.events], effect: "throw", code: "ENOSPC" }],
    () => w.writeResultFile({ name: "b.md", content: "Текст" }),
  );
  assert.deepStrictEqual(r.fired, [true]);
  assert.equal(r.error.code, "E_DISK");
  assert.equal(fs.existsSync(path.join(filesDir, "b.md")), false);
  assert.deepStrictEqual(snapshot(p.dir), before);
  assertRefusal(p.dir, () => w.say("Ещё"), "E_WRITER_BROKEN");
  // (r6) after close() the lock of the live process stays: the project is busy for
  // this process, the folder is as it was
  w.close();
  const folder = snapshot(p.dir);
  const busy = assertRefusal(
    p.dir,
    () => openWriter(p.id, { home, now: makeClock(Date.now(), 1) }),
    "E_PROJECT_BUSY",
  );
  assert.equal(busy.details.pid, process.pid);
  assert.deepStrictEqual(snapshot(p.dir), folder);
});

test("TM-47 the same failure of the event in a child process: after its death the next writer takes the stale lock, the name b.md is free and the file is written", (t) => {
  const p = closedProject(t);
  const filesDir = path.join(p.dir, "files");
  const before = snapshot(p.dir);
  const r = runWriterChild(
    p.home,
    p.id,
    `let code = null;
try { w.writeResultFile({ name: "b.md", content: "Текст" }); } catch (e) { code = e.code; }
w.close();
process.stdout.write(String(code));`,
    {
      faults: [
        { fn: "writeSync", paths: [p.events], effect: "throw", code: "ENOSPC" },
      ],
    },
  );
  assert.equal(r.status, 0, describeRun(r));
  assert.equal(r.stdout, "E_DISK");
  assert.deepStrictEqual(fs.readdirSync(filesDir), []);
  assertOnlyDeadLockAdded(p.dir, before, r.pid);
  const again = openTracked(t, p.home, p.id, makeClock(Date.now(), 1));
  assert.deepStrictEqual(typesOf(journalOf(p.events).slice(1)), [
    "LOCK_STALE_REMOVED",
  ]);
  again.writeResultFile({ name: "b.md", content: "Текст" });
  assert.deepStrictEqual(fs.readdirSync(filesDir).sort(), ["b.md"]);
});

// ---- TM-48 ---------------------------------------------------------------------------

test("TM-48 a bug of the program during say is E_INTERNAL, code 3, without a stack; the journal as it was", (t) => {
  const p = closedProject(t);
  const before = snapshot(p.dir);
  const r = runTeam(p.home, ["say", p.id, "--text", "Привет"], {
    faults: [{ fn: "writeSync", paths: [p.events], effect: "bug" }],
  });
  assert.equal(r.status, 3, describeRun(r));
  assert.equal(r.stdout, "");
  assert.equal(
    r.stderr,
    "E_INTERNAL: Внутренняя ошибка ядра Sai Team (TypeError)\n",
  );
  assertNoStack(r.stderr);
  // (r6) the writer is broken by the bug: its lock of the dead process stays
  assertOnlyDeadLockAdded(p.dir, before, r.pid);
  assert.equal(journalOf(p.events).length, 1);
  // and a bug while reading
  const read = runTeam(p.home, ["project", p.id], {
    faults: [{ fn: "openSync", paths: [p.events], effect: "bug" }],
  });
  assert.equal(read.status, 3, describeRun(read));
  assert.match(
    read.stderr,
    /^E_INTERNAL: Внутренняя ошибка ядра Sai Team \(TypeError\)\n$/,
  );
});

function io() {
  const out = { stdout: "", stderr: "" };
  return {
    out,
    io: {
      stdout: { write: (s) => (out.stdout += s) },
      stderr: { write: (s) => (out.stderr += s) },
    },
  };
}

test("TM-48 runGuarded: success is one line of JSON; a refusal 1, a usage error 2, anything else 3 without a stack", () => {
  const cases = [
    [() => ({ ok: true, list: [1, 2] }), 0, '{"ok":true,"list":[1,2]}\n', ""],
    [() => undefined, 0, "null\n", ""],
    [
      () => {
        throw new TypeError("secret detail");
      },
      3,
      "",
      "E_INTERNAL: Внутренняя ошибка ядра Sai Team (TypeError)\n",
    ],
    [
      () => {
        throw new RangeError("x");
      },
      3,
      "",
      "E_INTERNAL: Внутренняя ошибка ядра Sai Team (RangeError)\n",
    ],
    [
      () => {
        throw "just a string";
      },
      3,
      "",
      "E_INTERNAL: Внутренняя ошибка ядра Sai Team (Error)\n",
    ],
    [
      () => {
        throw null;
      },
      3,
      "",
      "E_INTERNAL: Внутренняя ошибка ядра Sai Team (Error)\n",
    ],
    [
      () => {
        throw new TeamError(
          "E_DISK",
          "Не удалось записать на диск (EIO); данные проекта не изменены",
        );
      },
      1,
      "",
      "E_DISK: Не удалось записать на диск (EIO); данные проекта не изменены\n",
    ],
    [
      () => {
        throw new TeamError("E_USAGE", "Нужен id проекта");
      },
      2,
      "",
      "E_USAGE: Нужен id проекта\n",
    ],
    [
      () => {
        throw new TeamError(
          "E_INTERNAL",
          "Внутренняя ошибка ядра Sai Team (now)",
        );
      },
      3,
      "",
      "E_INTERNAL: Внутренняя ошибка ядра Sai Team (now)\n",
    ],
  ];
  for (const [fn, code, stdout, stderr] of cases) {
    const { out, io: streams } = io();
    assert.equal(runGuarded(fn, streams), code, stderr);
    assert.equal(out.stdout, stdout);
    assert.equal(out.stderr, stderr);
    assert.doesNotMatch(out.stderr, /secret detail/);
  }
  assert.deepStrictEqual(EXIT, { OK: 0, REFUSED: 1, USAGE: 2, INTERNAL: 3 });
});

test("TM-48 a bug of the program in the API is not an E_DISK", (t) => {
  const p = closedProject(t);
  const w = openTracked(t, p.home, p.id, makeClock(Date.now(), 1));
  const result = withFaults(
    [{ fn: "writeSync", paths: [p.events], effect: "bug" }],
    () =>
      w.append(
        usr("CHAT", { text: "Привет", kind: "message", truncated: false }),
      ),
  );
  assert.deepStrictEqual(result.fired, [true]);
  assert.ok(result.error instanceof TypeError);
  assert.ok(!(result.error instanceof TeamError));
});
