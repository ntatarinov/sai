// Sai Team core: one writer, the lock, a failed write (design REQ-009, TM-11, TM-12,
// TM-13, TM-14, TM-15, TM-56, TM-61). Failures of the operating system are injected
// with fault-inject.js only; mock.method only counts calls or swaps a file.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { TeamError } from "../src/team/errors.js";
import { openWriter, readProject } from "../src/team/store.js";
import { withFaults } from "./fault-inject.js";
import {
  assertRefusal,
  deadPid,
  describeRun,
  holdWriter,
  journalOf,
  makeClock,
  makeHome,
  modeOf,
  newProject,
  openTracked,
  runTeam,
  runWriterChild,
  sha256,
  snapshot,
  startProject,
  usr,
  countJournalCalls,
} from "./team-helpers.js";

function lockOf(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, "writer.lock"), "utf8"));
}

// ---- TM-11 ---------------------------------------------------------------------------

test("TM-11 while another live process holds the right, say is refused and nothing changes; reading works", async (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const { id } = newProject(home, clock);
  const dir = path.join(home, id);
  const holder = await holdWriter(t, home, id);
  assert.equal(lockOf(dir).pid, holder.pid);
  const before = snapshot(dir);

  const say = runTeam(home, ["say", id, "--text", "Привет"]);
  assert.equal(say.status, 1, describeRun(say));
  assert.equal(say.stdout, "");
  assert.equal(
    say.stderr,
    `E_PROJECT_BUSY: Проект занят другим процессом (pid ${holder.pid})\n`,
  );
  assert.deepStrictEqual(snapshot(dir), before);

  for (const args of [["project", id], ["events", id], ["projects"]]) {
    const r = runTeam(home, args);
    assert.equal(r.status, 0, describeRun(r));
    assert.equal(r.stderr, "");
    JSON.parse(r.stdout);
  }
  assert.deepStrictEqual(snapshot(dir), before, "reading changes nothing");
});

test("TM-11 a second writer in the same process and a damaged lock are refused; the right is given back on close", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const { id } = newProject(home, clock);
  const dir = path.join(home, id);
  const first = openTracked(t, home, id, clock);
  assert.equal(lockOf(dir).pid, process.pid);
  let err = null;
  try {
    openWriter(id, { home, now: clock });
  } catch (caught) {
    err = caught;
  }
  assert.ok(err instanceof TeamError, String(err));
  assert.equal(err.code, "E_PROJECT_BUSY");
  assert.equal(err.details.pid, process.pid);
  first.say("Первый");
  first.close();
  assert.equal(fs.existsSync(path.join(dir, "writer.lock")), false);
  const second = openTracked(t, home, id, clock);
  second.say("Второй");
  second.close();
  assert.equal(journalOf(path.join(dir, "events.jsonl")).length, 3);

  // a lock that is not a lock: nobody takes the right and nothing is removed
  fs.writeFileSync(path.join(dir, "writer.lock"), "not json\n", {
    mode: 0o600,
  });
  assertRefusal(dir, () => openWriter(id, { home, now: clock }), "E_LOCK_BAD");
  fs.writeFileSync(path.join(dir, "writer.lock"), '{"pid":0}\n', {
    mode: 0o600,
  });
  assertRefusal(dir, () => openWriter(id, { home, now: clock }), "E_LOCK_BAD");
});

// ---- TM-12 ---------------------------------------------------------------------------

test("TM-12 a stale lock of a killed process is taken away and the journal says so", async (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const { id } = newProject(home, clock);
  const dir = path.join(home, id);
  const holder = await holdWriter(t, home, id);
  await holder.kill();
  assert.equal(lockOf(dir).pid, holder.pid, "the lock stays after the kill");

  const statusBefore = readProject(id, { home }).state.status;
  const say = runTeam(home, ["say", id, "--text", "Привет"]);
  assert.equal(say.status, 0, describeRun(say));
  const out = JSON.parse(say.stdout);
  assert.ok(out.notices.some((n) => n.includes(String(holder.pid))));
  const events = journalOf(path.join(dir, "events.jsonl"));
  // (r5) exactly two new events, and the status of the project is as it was: the
  // fixture has no open run and no task to interrupt.
  assert.equal(events.length, 3);
  assert.equal(readProject(id, { home }).state.status, statusBefore);
  assert.deepStrictEqual(
    events.slice(1).map((e) => [e.type, e.source]),
    [
      ["LOCK_STALE_REMOVED", "ENGINE"],
      ["CHAT", "USER"],
    ],
  );
  assert.deepStrictEqual(events[1].data, { pid: holder.pid });
  assert.equal(events[2].data.text, "Привет");
  assert.equal(fs.existsSync(path.join(dir, "writer.lock")), false);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), [
    "events.jsonl",
    "files",
    "work",
  ]);
});

// ---- TM-13 ---------------------------------------------------------------------------

function bytesOf(file) {
  return fs.readFileSync(file);
}

// (design ISS-0010, К8; decision 0026) close() of a broken writer that still holds
// the lock leaves it byte for byte; the same process then opens the project again:
// the lock is removed as stale (its own pid), the journal goes on after `lines`
// events with LOCK_STALE_REMOVED, the new writer writes, and its close() gives the
// lock back.
function reopenAfterBroken(t, p, home, clock, lines) {
  const lockFile = path.join(p.dir, "writer.lock");
  const lockBefore = fs.readFileSync(lockFile);
  p.writer.close();
  assert.ok(
    fs.readFileSync(lockFile).equals(lockBefore),
    "close() leaves the lock byte for byte the same",
  );
  assert.equal(lockOf(p.dir).pid, process.pid);
  const again = openTracked(t, home, p.id, clock);
  assert.ok(
    again.notices.some((n) => n.includes(String(process.pid))),
    "the notices name the removed lock",
  );
  const added = journalOf(p.events).slice(lines);
  assert.deepStrictEqual(
    added.map((e) => [e.type, e.source]),
    [["LOCK_STALE_REMOVED", "ENGINE"]],
  );
  assert.deepStrictEqual(added[0].data, { pid: process.pid });
  assert.equal(again.state.last_seq, lines + 1);
  again.say("После восстановления");
  const last = journalOf(p.events).at(-1);
  assert.equal(last.type, "CHAT");
  assert.equal(last.data.text, "После восстановления");
  assert.equal(journalOf(p.events).length, lines + 2);
  again.close();
  assert.equal(fs.existsSync(lockFile), false, "a healthy close() frees it");
}

const WRITE_FAULTS = [
  ["EIO", "throw"],
  ["ENOSPC", "throw"],
  ["ENOSPC", "partial"],
];

for (const [code, effect] of WRITE_FAULTS) {
  test(`TM-13 a failed write (${effect} ${code}) gives E_DISK, leaves the file as it was and breaks the writer`, (t) => {
    const home = makeHome(t);
    const clock = makeClock();
    const p = startProject(t, home, clock);
    const { writer: w } = p;
    w.say("До сбоя");
    const before = bytesOf(p.events);
    const state = structuredClone(w.state);
    const realWriteSync = fs.writeSync;

    const result = withFaults(
      [{ fn: "writeSync", paths: [p.events], effect, code }],
      () =>
        w.append(
          usr("CHAT", { text: "Сбой", kind: "message", truncated: false }),
        ),
    );
    assert.deepStrictEqual(result.fired, [true], "the fault must fire");
    assert.equal(fs.writeSync, realWriteSync, "the fault is removed");
    assert.ok(result.error instanceof TeamError, String(result.error));
    assert.equal(result.error.code, "E_DISK");
    assert.equal(result.error.details.os_code, code);
    assert.equal(result.error.details.rollback, "ok");
    assert.match(result.error.message, new RegExp(`\\(${code}\\)`));
    assert.doesNotMatch(result.error.message, /\n\s+at /);
    assert.ok(
      bytesOf(p.events).equals(before),
      "the journal is byte for byte the same",
    );
    assert.deepStrictEqual(w.state, state);
    assert.equal(w.state.last_seq, state.last_seq);

    // the writer is broken for good, also after a good rollback
    const next = assertRefusal(p.dir, () => w.say("После"), "E_WRITER_BROKEN");
    assert.match(next.message, /откройте проект заново/);
    assert.ok(bytesOf(p.events).equals(before));

    // (r6) close() of a broken writer keeps the lock byte for byte; (decision
    // 0026) this process then opens the project again with the stale-lock removal.
    reopenAfterBroken(t, p, home, clock, journalOf(p.events).length);
  });

  // The check that the next writer goes on (moved here from the same test of r5): the
  // failure is in a child process; it ends by itself holding the broken writer's lock.
  test(`TM-13 the same failure (${effect} ${code}) in a child process: the next writer takes the lock of the dead process and writes on`, (t) => {
    const home = makeHome(t);
    const clock = makeClock();
    const { id } = newProject(home, clock);
    const dir = path.join(home, id);
    const events = path.join(dir, "events.jsonl");
    const r = runWriterChild(
      home,
      id,
      `w.say("До сбоя");
const out = [];
for (const text of ["Сбой", "После"]) {
  try { w.say(text); out.push("ok"); } catch (e) { out.push(e.code); }
}
w.close();
process.stdout.write(JSON.stringify(out));`,
      { faults: [{ fn: "writeSync", paths: [events], effect, code, nth: 2 }] },
    );
    assert.equal(r.status, 0, describeRun(r));
    assert.deepStrictEqual(JSON.parse(r.stdout), ["E_DISK", "E_WRITER_BROKEN"]);
    const lines = journalOf(events).length;
    assert.equal(lines, 2, "PROJECT_CREATED and 'До сбоя' only");
    assert.equal(lockOf(dir).pid, r.pid);
    assert.throws(
      () => process.kill(r.pid, 0),
      (err) => err.code === "ESRCH",
    );
    const again = openTracked(t, home, id, makeClock(Date.now(), 1));
    again.say("Заново");
    const added = journalOf(events).slice(lines);
    assert.deepStrictEqual(
      added.map((e) => e.type),
      ["LOCK_STALE_REMOVED", "CHAT"],
    );
    assert.equal(added[0].data.pid, r.pid);
    assert.equal(added[1].data.text, "Заново");
    assert.equal(journalOf(events).length, lines + 2);
  });
}

// ---- TM-14 ---------------------------------------------------------------------------

test("TM-14 a failed fsync with a good rollback: no new line, the writer is broken", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  const { writer: w } = p;
  const before = bytesOf(p.events);
  const state = structuredClone(w.state);
  const realFsync = fs.fsyncSync;
  const result = withFaults(
    [{ fn: "fsyncSync", paths: [p.events], effect: "throw", code: "EIO" }],
    () => w.say("Сбой fsync"),
  );
  assert.deepStrictEqual(result.fired, [true]);
  assert.equal(fs.fsyncSync, realFsync);
  assert.equal(result.error.code, "E_DISK");
  assert.equal(result.error.details.os_code, "EIO");
  assert.equal(result.error.details.rollback, "ok");
  assert.match(result.error.message, /данные проекта не изменены/);
  assert.ok(bytesOf(p.events).equals(before), "no record");
  assert.deepStrictEqual(w.state, state);
  assertRefusal(p.dir, () => w.say("Ещё"), "E_WRITER_BROKEN");
  // (r6) the lock stays after close(); (decision 0026) the same process opens the
  // project again with the stale-lock removal
  reopenAfterBroken(t, p, home, clock, state.last_seq);
});

test("TM-14 a failed fsync and a failed rollback: the journal has the whole line of the event, the state has not", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  const { writer: w } = p;
  const before = bytesOf(p.events);
  const state = structuredClone(w.state);
  const result = withFaults(
    [
      { fn: "fsyncSync", paths: [p.events], effect: "throw", code: "EIO" },
      { fn: "ftruncateSync", paths: [p.events], effect: "throw", code: "EIO" },
    ],
    () => w.say("Сбой отката"),
  );
  assert.deepStrictEqual(result.fired, [true, true]);
  assert.equal(result.error.code, "E_DISK");
  assert.equal(result.error.details.rollback, "failed");
  assert.match(result.error.message, /откат не удался/);
  const after = bytesOf(p.events);
  assert.ok(after.subarray(0, before.length).equals(before));
  const added = after.subarray(before.length).toString("utf8");
  assert.ok(added.endsWith("\n"));
  assert.equal(added.split("\n").length, 2, "exactly one whole line");
  const event = JSON.parse(added);
  assert.equal(event.seq, state.last_seq + 1);
  assert.equal(event.type, "CHAT");
  assert.equal(event.data.text, "Сбой отката");
  assert.deepStrictEqual(w.state, state, "the state has no event");
  assertRefusal(p.dir, () => w.say("Ещё"), "E_WRITER_BROKEN");
  // (r6) the event that was written is read from the journal, without a new writer;
  // (decision 0026) after close() the lock stays and the same process opens the
  // project again: the whole line stays an event of the journal
  const last = journalOf(p.events).at(-1);
  assert.equal(last.type, "CHAT");
  assert.equal(last.data.text, "Сбой отката");
  assert.equal(last.seq, state.last_seq + 1);
  assert.equal(
    readProject(p.id, { home }).state.last_seq,
    state.last_seq + 1,
    "a reader sees the event that was written",
  );
  reopenAfterBroken(t, p, home, clock, state.last_seq + 1);
  const events = journalOf(p.events);
  assert.equal(
    events.filter((e) => e.type === "CHAT" && e.data.text === "Сбой отката")
      .length,
    1,
    "the whole line is one event of the journal",
  );
  assert.equal(events[state.last_seq].type, "CHAT");
});

// ---- TM-15 ---------------------------------------------------------------------------

test("TM-15 every successful append syncs the journal after its last write and before it returns", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  const { writer: w } = p;
  const log = [];
  const realWrite = fs.writeSync;
  const realFsync = fs.fsyncSync;
  t.mock.method(fs, "writeSync", function (...args) {
    log.push({ call: "write", fd: args[0], data: args[1] });
    return realWrite.apply(fs, args);
  });
  t.mock.method(fs, "fsyncSync", function (...args) {
    log.push({ call: "fsync", fd: args[0] });
    return realFsync.apply(fs, args);
  });
  for (const text of ["Один", "Два", "Три"]) {
    log.length = 0;
    const event = w.say(text);
    const writes = log
      .map((l, i) => [l, i])
      .filter(([l]) => l.call === "write");
    assert.ok(writes.length >= 1);
    const [lastWrite, at] = writes.at(-1);
    const line = Buffer.concat(writes.map(([l]) => l.data));
    assert.equal(JSON.parse(line.toString("utf8")).data.text, text);
    assert.equal(event.data.text, text);
    const synced = log
      .slice(at + 1)
      .some((l) => l.call === "fsync" && l.fd === lastWrite.fd);
    assert.ok(synced, "no fsync of the journal after the last write");
  }
});

// ---- TM-56 ---------------------------------------------------------------------------

test("TM-56 a lock that changes hands while it is taken away: busy, no leftover, the lock of the third stays", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const { id } = newProject(home, clock);
  const dir = path.join(home, id);
  const lock = path.join(dir, "writer.lock");
  const dead = deadPid();
  const second = process.ppid;
  const third = process.pid;
  fs.writeFileSync(
    lock,
    `${JSON.stringify({ pid: dead, since: "2026-10-06T08:00:00.000Z" })}\n`,
    { mode: 0o600 },
  );
  const journal = sha256(fs.readFileSync(path.join(dir, "events.jsonl")));
  const realRename = fs.renameSync;
  const swap = (pid) =>
    fs.writeFileSync(
      lock,
      `${JSON.stringify({ pid, since: "2026-10-06T08:00:01.000Z" })}\n`,
      { mode: 0o600 },
    );
  let renames = 0;
  t.mock.method(fs, "renameSync", function (from, to) {
    if (from !== lock) return realRename.call(fs, from, to);
    renames += 1;
    swap(second);
    realRename.call(fs, from, to);
    fs.writeFileSync(
      lock,
      `${JSON.stringify({ pid: third, since: "2026-10-06T08:00:02.000Z" })}\n`,
      { flag: "wx", mode: 0o600 },
    );
  });
  let caught = null;
  try {
    openWriter(id, { home, now: clock });
  } catch (err) {
    caught = err;
  }
  assert.equal(renames, 1);
  assert.ok(caught instanceof TeamError);
  assert.equal(caught.code, "E_PROJECT_BUSY");
  assert.equal(caught.details.pid, second);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), [
    "events.jsonl",
    "files",
    "work",
    "writer.lock",
  ]);
  assert.equal(lockOf(dir).pid, third);
  assert.equal(
    sha256(fs.readFileSync(path.join(dir, "events.jsonl"))),
    journal,
  );
});

test("TM-56 a lock that turns live between the first look and the taking: busy, the lock of the live process stays", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const { id } = newProject(home, clock);
  const dir = path.join(home, id);
  const lock = path.join(dir, "writer.lock");
  const live = process.ppid;
  const content = (pid) =>
    `${JSON.stringify({ pid, since: "2026-01-01T08:00:00.000Z" })}\n`;
  fs.writeFileSync(lock, content(deadPid()), { mode: 0o600 });
  const realLink = fs.linkSync;
  let calls = 0;
  t.mock.method(fs, "linkSync", function (from, to) {
    calls += 1;
    // the other process takes the lock (it is live now) just before ours is linked
    fs.writeFileSync(lock, content(live), { mode: 0o600 });
    return realLink.call(fs, from, to);
  });
  const counts = countJournalCalls(t, path.join(dir, "events.jsonl"));
  let err = null;
  try {
    openWriter(id, { home, now: clock });
  } catch (caught) {
    err = caught;
  }
  assert.ok(err instanceof TeamError, String(err));
  assert.equal(err.code, "E_PROJECT_BUSY");
  assert.deepStrictEqual(counts, {
    writeSync: 0,
    fsyncSync: 0,
    ftruncateSync: 0,
  });
  assert.equal(calls, 1);
  assert.equal(err.details.pid, live);
  assert.equal(lockOf(dir).pid, live);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), [
    "events.jsonl",
    "files",
    "work",
    "writer.lock",
  ]);
});

test("TM-56 a writer whose lock was taken by another process finds out at its next append", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  const { writer: w, dir } = p;
  w.say("Пока право моё");
  const lock = path.join(dir, "writer.lock");
  const foreign = `${JSON.stringify({ pid: process.ppid, since: "2026-10-06T08:00:00.000Z" })}\n`;
  fs.writeFileSync(lock, foreign, { mode: 0o600 });
  const before = snapshot(dir);
  const state = structuredClone(w.state);
  // The lock is checked BEFORE the journal is touched: not one write, fsync or rollback
  // (a rollback would hide a write that had been made).
  const counts = countJournalCalls(t, p.events);
  const err = assertRefusal(dir, () => w.say("Чужой замок"), "E_LOCK_LOST");
  assert.match(err.message, /Право записи на проект потеряно/);
  assert.deepStrictEqual(counts, {
    writeSync: 0,
    fsyncSync: 0,
    ftruncateSync: 0,
  });
  assert.deepStrictEqual(snapshot(dir), before);
  assert.deepStrictEqual(w.state, state);
  assertRefusal(dir, () => w.say("Ещё"), "E_WRITER_BROKEN");
  // the foreign lock is not removed by the writer that lost it
  w.close();
  assert.equal(fs.readFileSync(lock, "utf8"), foreign);
});

test("TM-56 a journal changed by another process is a conflict, and the writer is broken", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  const { writer: w, dir } = p;
  w.say("Моя строка");
  fs.appendFileSync(p.events, '{"x":1}\n');
  const err = assertRefusal(dir, () => w.say("Конфликт"), "E_CONFLICT");
  assert.match(err.message, /изменён другим процессом/);
  assertRefusal(dir, () => w.say("Ещё"), "E_WRITER_BROKEN");
});

// ---- TM-61 ---------------------------------------------------------------------------

test("TM-61 a refused say (busy, damaged journal) leaves the modes as they were", async (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const { id } = newProject(home, clock);
  const dir = path.join(home, id);
  const holder = await holdWriter(t, home, id);
  fs.chmodSync(dir, 0o755);
  const before = snapshot(dir);
  const busy = runTeam(home, ["say", id, "--text", "Привет"]);
  assert.equal(busy.status, 1, describeRun(busy));
  assert.match(busy.stderr, /^E_PROJECT_BUSY: /);
  assert.equal(modeOf(dir), 0o755);
  assert.deepStrictEqual(snapshot(dir), before);
  await holder.kill();
  fs.rmSync(path.join(dir, "writer.lock"));

  // a damaged middle of the journal
  const events = path.join(dir, "events.jsonl");
  const good = fs.readFileSync(events, "utf8");
  const line = JSON.parse(good.trim());
  const second = {
    ...line,
    seq: 2,
    type: "CHAT",
    source: "USER",
    data: { text: 1 },
  };
  const third = {
    ...line,
    seq: 3,
    type: "CHAT",
    source: "USER",
    data: { text: "Привет", kind: "message", truncated: false },
  };
  fs.appendFileSync(
    events,
    `${JSON.stringify(second)}\n${JSON.stringify(third)}\n`,
  );
  fs.chmodSync(dir, 0o755);
  const damaged = snapshot(dir);
  const corrupt = runTeam(home, ["say", id, "--text", "Привет"]);
  assert.equal(corrupt.status, 1, describeRun(corrupt));
  assert.match(
    corrupt.stderr,
    /^E_CORRUPT: Журнал проекта повреждён в строке 2: /,
  );
  assert.equal(modeOf(dir), 0o755);
  assert.deepStrictEqual(snapshot(dir), damaged);
});
