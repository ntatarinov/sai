// Sai Team core: where the data lives and who may see it, result files, creating a
// project (design REQ-009, TM-20 ... TM-26, TM-57 ... TM-60 and the probe F1 of the
// security review), TM-63 (importResultBytes, r4).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { TeamError } from "../src/team/errors.js";
import { withFaults } from "./fault-inject.js";
import { resolveHome } from "../src/team/home.js";
import {
  createProject,
  listProjects,
  openWriter,
  readEvents,
  readProject,
} from "../src/team/store.js";
import {
  assertRefusal,
  assertSafeHome,
  childEnv,
  describeRun,
  eng,
  journalOf,
  makeClock,
  makeHome,
  modeOf,
  newProject,
  openTracked,
  planTask,
  runTeam,
  scratchOf,
  sha256,
  snapshot,
  startProject,
  startRun,
  usr,
  withPlan,
} from "./team-helpers.js";

// A fictional key shaped like a GitHub token.
const FAKE_KEY = "ghp_FAKEFAKEFAKEFAKEFAKE1234567890abcd";
const ID = /^p-[0-9]{8}-[0-9a-f]{6}$/;

function out(r) {
  assert.equal(r.status, 0, describeRun(r));
  return JSON.parse(r.stdout);
}

// ---- TM-20 ---------------------------------------------------------------------------

test("TM-20 folders are 0700 and the files of the core are 0600", (t) => {
  const home = makeHome(t, { create: false });
  const clock = makeClock();
  const { id } = newProject(home, clock, {
    executor: "scripted",
    scenario_bytes: Buffer.from('{"steps":[]}'),
  });
  const dir = path.join(home, id);
  // as createProject leaves them: a writer would narrow wide modes, so look first
  for (const folder of [
    home,
    dir,
    path.join(dir, "files"),
    path.join(dir, "work"),
  ]) {
    assert.equal(modeOf(folder), 0o700, `${folder} after the creation`);
  }
  for (const file of [
    path.join(dir, "events.jsonl"),
    path.join(dir, "scenario.json"),
  ]) {
    assert.equal(modeOf(file), 0o600, `${file} after the creation`);
  }
  const w = openTracked(t, home, id, clock);
  w.writeResultFile({ name: "result.md", content: "Итог\n" });
  for (const folder of [
    home,
    dir,
    path.join(dir, "files"),
    path.join(dir, "work"),
  ]) {
    assert.equal(modeOf(folder), 0o700, folder);
  }
  for (const file of [
    path.join(dir, "events.jsonl"),
    path.join(dir, "writer.lock"),
    path.join(dir, "scenario.json"),
    path.join(dir, "files", "result.md"),
  ]) {
    assert.equal(modeOf(file), 0o600, file);
  }
  assert.deepStrictEqual(w.notices, [], "nothing had to be narrowed");
});

// ---- TM-21 ---------------------------------------------------------------------------

test("TM-21 a writer narrows wide modes and says so; a reader only warns", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  p.writer.writeResultFile({ name: "r.md", content: "Текст" });
  p.writer.close();
  const dir = p.dir;
  fs.chmodSync(home, 0o755);
  fs.chmodSync(dir, 0o755);
  fs.chmodSync(path.join(dir, "files"), 0o755);
  fs.chmodSync(path.join(dir, "files", "r.md"), 0o644);
  fs.chmodSync(p.events, 0o644);

  // reading: a warning in the output and the same lines in stderr; nothing changes
  const before = snapshot(home);
  const listed = runTeam(home, ["projects"]);
  const list = out(listed);
  assert.ok(list.warnings.length >= 1);
  assert.ok(list.warnings.some((w) => /Права папки данных шире 0700/.test(w)));
  for (const w of list.warnings) assert.ok(listed.stderr.includes(w));
  const shown = runTeam(home, ["project", p.id]);
  assert.ok(out(shown).warnings.some((w) => /шире/.test(w)));
  assert.ok(shown.stderr.length > 0);
  assert.deepStrictEqual(snapshot(home), before);
  assert.equal(modeOf(home), 0o755);

  // writing: narrows, after the lock, and names every change
  const said = out(runTeam(home, ["say", p.id, "--text", "Привет"]));
  assert.ok(
    said.notices.filter((n) => n.startsWith("Права")).length >= 4,
    said.notices.join("\n"),
  );
  assert.equal(modeOf(home), 0o700);
  assert.equal(modeOf(dir), 0o700);
  assert.equal(modeOf(path.join(dir, "files")), 0o700);
  assert.equal(modeOf(path.join(dir, "files", "r.md")), 0o600);
  assert.equal(modeOf(p.events), 0o600);
  const after = out(runTeam(home, ["projects"]));
  assert.deepStrictEqual(after.warnings, []);
});

test("TM-21 the work folder is narrowed but its files are not touched", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const draft = path.join(p.writer.workDir, "draft.md");
  fs.writeFileSync(draft, "Черновик", { mode: 0o666 });
  fs.chmodSync(draft, 0o666);
  p.writer.close();
  fs.chmodSync(p.writer.workDir, 0o755);
  openTracked(t, home, p.id, makeClock(Date.now(), 1));
  assert.equal(modeOf(p.writer.workDir), 0o700);
  assert.equal(modeOf(draft), 0o666);
});

// ---- TM-22 ---------------------------------------------------------------------------

test("TM-22 the helpers refuse a data folder that is not a temporary one", (t) => {
  const real = path.join(os.homedir(), ".sai-team");
  assert.throws(() => assertSafeHome(undefined), /not set/);
  assert.throws(() => assertSafeHome(""), /not set/);
  assert.throws(() => assertSafeHome("relative/dir"), /absolute/);
  assert.throws(() => assertSafeHome(real), /real data folder/);
  assert.throws(
    () => assertSafeHome(path.join(real, "p-20260101-aaaaaa")),
    /real data folder/,
  );
  assert.throws(
    () => assertSafeHome(path.join(os.homedir(), ".sai-pixel-office")),
    /real data folder/,
  );
  const home = makeHome(t);
  assert.equal(assertSafeHome(home), home);
  assert.ok(
    home.startsWith(os.tmpdir()) ||
      home.startsWith(fs.realpathSync(os.tmpdir())),
  );
  const env = childEnv(home);
  assert.equal(env.SAI_TEAM_HOME, home);
  assert.equal(env.HOME, scratchOf(home));
  assert.throws(() => childEnv(real), /real data folder/);
});

test("TM-22 the data folder must be an absolute path: a relative or an empty one is E_HOME", (t) => {
  assert.throws(
    () => resolveHome({ SAI_TEAM_HOME: "relative/dir" }),
    (err) => err instanceof TeamError && err.code === "E_HOME",
  );
  assert.throws(
    () => resolveHome({ SAI_TEAM_HOME: "" }),
    (err) => err instanceof TeamError && err.code === "E_HOME",
  );
  assert.equal(resolveHome({ SAI_TEAM_HOME: "/some/where" }), "/some/where");
  const home = makeHome(t);
  for (const value of ["relative/dir", ""]) {
    const r = runTeam(home, ["projects"], { env: { SAI_TEAM_HOME: value } });
    assert.equal(r.status, 1, describeRun(r));
    assert.match(r.stderr, /^E_HOME: /);
    assert.equal(r.stdout, "");
  }
});

// ---- TM-23 ---------------------------------------------------------------------------

test("TM-23 the id of a project is made by the core, never from the text of the user", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const scratch = scratchOf(home);
  const before = snapshot(scratch);
  const { id } = newProject(home, clock, {
    goal: "../../etc/passwd ../x /tmp/evil p-20260101-aaaaaa",
  });
  assert.match(id, ID);
  assert.deepStrictEqual(fs.readdirSync(home), [id]);
  assert.deepStrictEqual(fs.readdirSync(scratch), ["home"]);
  assert.equal(Object.keys(before).length > 0, true);
  assert.equal(
    readProject(id, { home }).state.goal,
    "../../etc/passwd ../x /tmp/evil p-20260101-aaaaaa",
  );

  // the day is the day of the clock, the rest comes from the random source
  const other = createProject(
    { goal: "Цель", budget_usd: 1, executor: "claude-cli" },
    { home, now: () => Date.UTC(2026, 4, 17, 12), randomId: () => "0a1b2c" },
  );
  assert.equal(other.id, "p-20260517-0a1b2c");
  // without randomId a real random id of the same shape
  const random = createProject(
    { goal: "Цель", budget_usd: 1, executor: "claude-cli" },
    { home, now: clock },
  );
  assert.match(random.id, ID);
});

test("TM-23 an id that is taken is not used again: a new one up to five times, then E_DISK", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const input = { goal: "Цель", budget_usd: 1, executor: "claude-cli" };
  const first = createProject(input, {
    home,
    now: clock,
    randomId: () => "aaaaaa",
  });
  const draw = (values) => {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
  };
  const second = createProject(input, {
    home,
    now: clock,
    randomId: draw(["aaaaaa", "aaaaaa", "bbbbbb"]),
  });
  assert.notEqual(second.id, first.id);
  assert.ok(second.id.endsWith("-bbbbbb"));
  const before = snapshot(home);
  assertRefusal(
    home,
    () => createProject(input, { home, now: clock, randomId: () => "aaaaaa" }),
    "E_DISK",
  );
  assert.deepStrictEqual(snapshot(home), before);
});

// ---- TM-24 ---------------------------------------------------------------------------

const BAD_IDS = [
  "p-20260101-ffffff",
  "../x",
  "../decoy",
  "/etc",
  "a/b",
  "p-20260101-ffffff\0",
  "",
  "p-20260101-FFFFFF",
  " p-20260101-ffffff",
  5,
  null,
  {},
  undefined,
];

test("TM-24 an id that does not exist or is not an id: one code, one text, no access to files", (t) => {
  const home = makeHome(t);
  const scratch = scratchOf(home);
  newProject(home, makeClock());
  const decoy = path.join(scratch, "decoy");
  fs.mkdirSync(decoy);
  fs.writeFileSync(path.join(decoy, "events.jsonl"), "decoy\n");
  const before = snapshot(scratch);
  const messages = new Set();
  for (const bad of BAD_IDS) {
    for (const call of [
      () => readProject(bad, { home }),
      () => readEvents(bad, { home }),
      () => openWriter(bad, { home }),
    ]) {
      let caught = null;
      try {
        call();
      } catch (err) {
        caught = err;
      }
      assert.ok(caught instanceof TeamError, `${String(bad)}: ${caught}`);
      assert.equal(caught.code, "E_NOT_FOUND");
      messages.add(caught.message);
    }
  }
  assert.deepStrictEqual([...messages], ["Проект не найден"]);
  assert.deepStrictEqual(
    snapshot(scratch),
    before,
    "the decoy and everything else is untouched",
  );

  // through the commands: the same line, the same code
  for (const bad of [
    "p-20260101-ffffff",
    "../x",
    "../decoy",
    "/etc",
    "a/b",
    "p-20260101-FFFFFF",
  ]) {
    for (const args of [
      ["project", bad],
      ["events", bad],
      ["say", bad, "--text", "Привет"],
    ]) {
      const r = runTeam(home, args);
      assert.equal(r.status, 1, describeRun(r));
      assert.equal(r.stdout, "");
      assert.equal(r.stderr, "E_NOT_FOUND: Проект не найден\n");
    }
  }
  assert.deepStrictEqual(snapshot(scratch), before);
});

test("TM-24 for an id that is not an id nothing outside the data folder is even looked at", (t) => {
  const home = makeHome(t);
  const scratch = scratchOf(home);
  const decoy = path.join(scratch, "decoy");
  fs.mkdirSync(decoy);
  fs.writeFileSync(path.join(decoy, "events.jsonl"), "decoy\n");
  const faults = [
    { fn: "lstatSync", paths: [decoy], effect: "bug" },
    {
      fn: "openSync",
      paths: [path.join(decoy, "events.jsonl")],
      effect: "bug",
    },
  ];
  for (const args of [
    ["project", "../decoy"],
    ["events", "../decoy"],
    ["say", "../decoy", "--text", "Привет"],
  ]) {
    const r = runTeam(home, args, { faults });
    assert.equal(r.status, 1, describeRun(r));
    assert.equal(r.stderr, "E_NOT_FOUND: Проект не найден\n");
  }
});

test("TM-24 a folder that only looks like a project is 'not found' too: a link, a copy under another id, an empty or linked journal", (t) => {
  const home = makeHome(t);
  const scratch = scratchOf(home);
  const p = startProject(t, home, makeClock());
  p.writer.close();
  const message = "Проект не найден";
  const notFound = (id) => {
    for (const call of [
      () => readProject(id, { home }),
      () => readEvents(id, { home }),
      () => openWriter(id, { home }),
    ]) {
      assert.throws(
        call,
        (err) =>
          err instanceof TeamError &&
          err.code === "E_NOT_FOUND" &&
          err.message === message,
      );
    }
  };
  // a link to a real project
  fs.symlinkSync(p.dir, path.join(home, "p-20260101-aaaaaa"));
  notFound("p-20260101-aaaaaa");
  // a copy whose first line names another project
  fs.cpSync(p.dir, path.join(home, "p-20260101-bbbbbb"), { recursive: true });
  notFound("p-20260101-bbbbbb");
  // an empty journal
  const empty = path.join(home, "p-20260101-cccccc");
  fs.mkdirSync(empty, { mode: 0o700 });
  fs.writeFileSync(path.join(empty, "events.jsonl"), "");
  notFound("p-20260101-cccccc");
  // a journal that is a link
  const linked = path.join(home, "p-20260101-dddddd");
  fs.mkdirSync(linked, { mode: 0o700 });
  fs.symlinkSync(p.events, path.join(linked, "events.jsonl"));
  notFound("p-20260101-dddddd");
  // a folder of the data folder that is not a project is not listed
  fs.mkdirSync(path.join(home, "notes"));
  fs.mkdirSync(path.join(home, ".creating-p-20260101-eeeeee"));
  assert.deepStrictEqual(
    listProjects({ home }).projects.map((x) => x.id),
    [p.id],
  );
  assert.ok(scratch.length > 0);
});

// ---- TM-25 ---------------------------------------------------------------------------

test("TM-25 a result file cannot leave files/: a bad name is refused, nothing appears outside, no event", (t) => {
  const home = makeHome(t);
  const scratch = scratchOf(home);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  const outside = path.join(scratch, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "secret.txt"), "не трогать");
  fs.symlinkSync(
    path.join(outside, "secret.txt"),
    path.join(p.dir, "files", "link.md"),
  );
  const before = snapshot(scratch);
  const events = fs.readFileSync(p.events);
  for (const name of [
    "../../x",
    "../x.md",
    "/etc/passwd",
    "a/b.md",
    "..",
    ".hidden",
    "a\\b.md",
    "x\0y",
  ]) {
    assertRefusal(
      scratch,
      () => w.writeResultFile({ name, content: "Текст" }),
      "E_FILE_NAME",
    );
  }
  // a name that is already a link out of files/ is "exists"; the target is not written
  assertRefusal(
    scratch,
    () => w.writeResultFile({ name: "link.md", content: "Затереть" }),
    "E_FILE_EXISTS",
  );
  assert.deepStrictEqual(snapshot(scratch), before);
  assert.equal(
    fs.readFileSync(path.join(outside, "secret.txt"), "utf8"),
    "не трогать",
  );
  assert.ok(fs.readFileSync(p.events).equals(events), "no event");

  // files/ itself replaced by a link out: refused, nothing written outside
  fs.rmSync(path.join(p.dir, "files"), { recursive: true });
  fs.symlinkSync(outside, path.join(p.dir, "files"));
  const caught = assertRefusal(
    scratch,
    () => w.writeResultFile({ name: "x.md", content: "Текст" }),
    "E_DISK",
  );
  assert.ok(caught instanceof TeamError);
  assert.deepStrictEqual(fs.readdirSync(outside).sort(), ["secret.txt"]);
});

// ---- TM-26 ---------------------------------------------------------------------------

test("TM-26 a result file of project A is not seen in project B", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const a = startProject(t, home, clock, { goal: "Проект А" });
  const b = startProject(t, home, clock, { goal: "Проект Б" });
  a.writer.writeResultFile({ name: "only-a.md", content: "Секрет проекта А" });
  const shownA = out(runTeam(home, ["project", a.id])).project;
  const shownB = out(runTeam(home, ["project", b.id])).project;
  assert.deepStrictEqual(
    shownA.files.map((f) => f.name),
    ["only-a.md"],
  );
  assert.deepStrictEqual(shownB.files, []);
  assert.equal(fs.existsSync(path.join(b.dir, "files", "only-a.md")), false);
  assert.deepStrictEqual(fs.readdirSync(path.join(b.dir, "files")), []);
  assert.equal(
    journalOf(b.events).some((e) => e.type === "RESULT_FILE"),
    false,
  );
  assert.doesNotMatch(runTeam(home, ["events", b.id]).stdout, /only-a|Секрет/);
  assert.doesNotMatch(runTeam(home, ["project", b.id]).stdout, /only-a|Секрет/);
});

// ---- TM-57 and F1 --------------------------------------------------------------------

function work(p, rel, content) {
  const file = path.join(p.writer.workDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

test("TM-57 a text file of work/ becomes a result file: masked, 0600, with the event and the hash of what was written", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  const source = work(
    p,
    "notes/report.md",
    `Отчёт. Ключ: ${FAKE_KEY}\nКонец\n`,
  );
  const workBefore = snapshot(w.workDir);
  const event = w.importWorkFile({ path: "notes/report.md" });
  const written = path.join(p.dir, "files", "report.md");
  assert.equal(modeOf(written), 0o600);
  const content = fs.readFileSync(written, "utf8");
  assert.ok(!content.includes(FAKE_KEY));
  assert.ok(content.includes("[скрыто]"));
  assert.deepStrictEqual(event.data, {
    name: "report.md",
    bytes: fs.statSync(written).size,
    sha256: sha256(fs.readFileSync(written)),
    kind: "result",
    from_work: true,
  });
  assert.equal(journalOf(p.events).at(-1).type, "RESULT_FILE");
  assert.equal(journalOf(p.events).at(-1).source, "ENGINE");
  assert.deepStrictEqual(
    snapshot(w.workDir),
    workBefore,
    "work/ is not changed",
  );
  assert.ok(
    fs.readFileSync(source, "utf8").includes(FAKE_KEY),
    "the original keeps its content",
  );
  assert.equal(w.state.files[0].from_work, true);
});

test("TM-57 the name of the result file: the last part of the path, or the name given; a draft is a draft; the same name twice is refused", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  work(p, "a/b/c.md", "Глубоко");
  work(p, "plain.md", "Просто");
  assert.equal(w.importWorkFile({ path: "a/b/c.md" }).data.name, "c.md");
  assert.equal(
    w.importWorkFile({ path: "a/b/c.md", name: "renamed.md", kind: "draft" })
      .data.kind,
    "draft",
  );
  assertRefusal(
    p.dir,
    () => w.importWorkFile({ path: "a/b/c.md" }),
    "E_FILE_EXISTS",
  );
  assertRefusal(
    p.dir,
    () => w.importWorkFile({ path: "plain.md", name: "../out.md" }),
    "E_FILE_NAME",
  );
  assertRefusal(
    p.dir,
    () => w.importWorkFile({ path: "plain.md", task: "t-0007" }),
    "E_TASK_NOT_FOUND",
  );
  assert.deepStrictEqual(fs.readdirSync(path.join(p.dir, "files")).sort(), [
    "c.md",
    "renamed.md",
  ]);
});

test("TM-57 every file that is not an honest text file of work/ is E_WORK_FILE and nothing is written", (t) => {
  const home = makeHome(t);
  const scratch = scratchOf(home);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  fs.writeFileSync(path.join(scratch, "outside.txt"), "Снаружи");
  fs.mkdirSync(path.join(scratch, "outdir"));
  fs.writeFileSync(path.join(scratch, "outdir", "in.md"), "Внутри чужой папки");
  fs.symlinkSync(
    path.join(scratch, "outside.txt"),
    path.join(w.workDir, "link.md"),
  );
  fs.symlinkSync(path.join(scratch, "outdir"), path.join(w.workDir, "linkdir"));
  fs.mkdirSync(path.join(w.workDir, "folder"));
  fs.writeFileSync(
    path.join(w.workDir, "binary.md"),
    Buffer.from([0x61, 0xff, 0xfe, 0x62]),
  );
  fs.writeFileSync(
    path.join(w.workDir, "big.md"),
    Buffer.alloc(5 * 1024 * 1024 + 1, 0x61),
  );
  const before = snapshot(scratch);
  const paths = [
    "../outside.txt",
    "../../x",
    "/etc/hosts",
    path.join(scratch, "outside.txt"),
    "link.md",
    "linkdir/in.md",
    "missing.md",
    "folder",
    "binary.md",
    "big.md",
    "a\\b.md",
    "a//b.md",
    ".",
    "",
    "x\0y.md",
    "a/./b.md",
    ".hidden",
    "a/b/c/d/e/f/g/h/i.md",
    `${"a".repeat(300)}.md`,
    5,
    null,
  ];
  for (const rel of paths) {
    const err = assertRefusal(
      scratch,
      () => w.importWorkFile({ path: rel }),
      "E_WORK_FILE",
    );
    assert.equal(
      err.message,
      "Файл результата не найден в рабочей папке или недопустим",
    );
  }
  assert.deepStrictEqual(snapshot(scratch), before);
});

test("TM-57 a text of exactly 5 MiB is accepted", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  work(p, "limit.md", "a".repeat(5 * 1024 * 1024));
  assert.equal(
    p.writer.importWorkFile({ path: "limit.md" }).data.bytes,
    5 * 1024 * 1024,
  );
});

test("F1 a hard link in work/ to a file outside is refused with 'link'; an ordinary file is accepted", (t) => {
  const home = makeHome(t);
  const scratch = scratchOf(home);
  const clock = makeClock();
  const other = startProject(t, home, clock, { goal: "Чужой проект" });
  const p = startProject(t, home, clock);
  const { writer: w } = p;
  // a hard link to the journal of another project, and one to a file outside the data folder
  fs.linkSync(other.events, path.join(w.workDir, "hard.md"));
  fs.writeFileSync(path.join(scratch, "elsewhere.txt"), "Другой файл");
  fs.linkSync(
    path.join(scratch, "elsewhere.txt"),
    path.join(w.workDir, "hard2.md"),
  );
  fs.writeFileSync(path.join(w.workDir, "ok.md"), "Обычный файл");
  const before = snapshot(scratch);
  for (const rel of ["hard.md", "hard2.md"]) {
    const err = assertRefusal(
      scratch,
      () => w.importWorkFile({ path: rel }),
      "E_WORK_FILE",
    );
    assert.equal(err.details.reason, "link");
  }
  assert.deepStrictEqual(snapshot(scratch), before);
  assert.deepStrictEqual(fs.readdirSync(path.join(p.dir, "files")), []);
  assert.equal(
    journalOf(p.events).some((e) => e.type === "RESULT_FILE"),
    false,
  );
  // an ordinary file is accepted as before
  assert.equal(w.importWorkFile({ path: "ok.md" }).data.name, "ok.md");
  assert.equal(
    fs.readFileSync(path.join(p.dir, "files", "ok.md"), "utf8"),
    "Обычный файл",
  );
});

// ---- TM-58 ---------------------------------------------------------------------------

test("TM-58 ordinary names are kept as they are; names that are not allowed are refused", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  const good = [
    "plan.v2.md",
    "report.2026.md",
    "report_v2.md",
    "notes-final.md",
    "-dash.md",
    "a".repeat(80),
  ];
  for (const name of good) {
    const event = w.writeResultFile({ name, content: `Содержимое ${name}\n` });
    assert.equal(event.data.name, name);
    assert.ok(fs.existsSync(path.join(p.dir, "files", name)));
    assert.equal(
      event.data.sha256,
      sha256(fs.readFileSync(path.join(p.dir, "files", name))),
    );
    assert.match(event.data.sha256, /^[0-9a-f]{64}$/);
  }
  assert.deepStrictEqual(
    journalOf(p.events)
      .filter((e) => e.type === "RESULT_FILE")
      .map((e) => e.data.name),
    good,
  );
  const bad = [
    "отчёт.md",
    "a b.md",
    ".hidden",
    "a..b",
    "a".repeat(81),
    "",
    "a/b",
    "a\\b",
    "a\0b",
    " x.md",
    "x.md ",
    "x:y.md",
    7,
    null,
    undefined,
  ];
  for (const name of bad) {
    assertRefusal(
      p.dir,
      () => w.writeResultFile({ name, content: "Текст" }),
      "E_FILE_NAME",
    );
  }
  // the second file with a name is refused; the first stays
  const before = snapshot(p.dir);
  assertRefusal(
    p.dir,
    () => w.writeResultFile({ name: "plan.v2.md", content: "Другое" }),
    "E_FILE_EXISTS",
  );
  assert.deepStrictEqual(snapshot(p.dir), before);
  // not a text
  assertRefusal(
    p.dir,
    () => w.writeResultFile({ name: "bin.md", content: Buffer.from("x") }),
    "E_EVENT",
  );
  assertRefusal(p.dir, () => w.writeResultFile({ name: "none.md" }), "E_EVENT");
  assertRefusal(
    p.dir,
    () =>
      w.writeResultFile({
        name: "big.md",
        content: "a".repeat(5 * 1024 * 1024 + 1),
      }),
    "E_EVENT",
  );
});

test("TM-58 RESULT_FILE cannot be written through append; the hash in the journal is the hash of the masked file", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  const data = {
    name: "x.md",
    bytes: 3,
    sha256: "0".repeat(64),
    kind: "result",
    from_work: false,
  };
  assertRefusal(p.dir, () => w.append(eng("RESULT_FILE", data)), "E_EVENT");
  const event = w.writeResultFile({
    name: "key.md",
    content: `Ключ ${FAKE_KEY}`,
  });
  const file = fs.readFileSync(path.join(p.dir, "files", "key.md"));
  assert.equal(event.data.sha256, sha256(file));
  assert.equal(event.data.bytes, file.length);
  assert.notEqual(event.data.sha256, sha256(Buffer.from(`Ключ ${FAKE_KEY}`)));
  assert.notEqual(event.data.sha256, "[скрыто]");
});

// ---- TM-59 ---------------------------------------------------------------------------

function scenarioFixture(t, home) {
  // not only ASCII, a byte order mark, and something that masking would change
  const text = `{"steps":[{"say":"Привет, мир","key":"${FAKE_KEY}"}]}\n`;
  const file = path.join(scratchOf(home), "scenario-fixture.json");
  fs.writeFileSync(
    file,
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, "utf8")]),
  );
  assert.ok(t);
  return fs.readFileSync(file);
}

test("TM-59 the scenario is copied byte for byte (also with a BOM), 0600, and the project says where it is", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const bytes = scenarioFixture(t, home);
  const { id, state } = newProject(home, clock, {
    executor: "scripted",
    scenario_bytes: bytes,
  });
  const copy = path.join(home, id, "scenario.json");
  assert.equal(sha256(fs.readFileSync(copy)), sha256(bytes));
  assert.ok(fs.readFileSync(copy).equals(bytes));
  assert.equal(modeOf(copy), 0o600);
  assert.equal(state.scenario_file, "scenario.json");
  assert.equal(
    journalOf(path.join(home, id, "events.jsonl"))[0].data.scenario_file,
    "scenario.json",
  );
  const w = openTracked(t, home, id, clock);
  assert.equal(w.scenarioPath, copy);
  assert.equal(readProject(id, { home }).state.scenario_file, "scenario.json");
  // a scripted project without a scenario
  const plain = newProject(home, clock, { executor: "scripted" });
  assert.equal(plain.state.scenario_file, null);
  assert.equal(
    fs.existsSync(path.join(home, plain.id, "scenario.json")),
    false,
  );
  assert.equal(openTracked(t, home, plain.id, clock).scenarioPath, null);
});

test("TM-59 a scenario that is not allowed is E_EVENT and nothing is created", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const before = snapshot(home);
  const ok = Buffer.from('{"steps":[]}');
  const bad = [
    ["claude-cli", ok],
    ["scripted", Buffer.from("not json")],
    ["scripted", Buffer.from([0x7b, 0xff, 0x7d])],
    ["scripted", '{"steps":[]}'],
    ["scripted", Buffer.from("[]")],
    ["scripted", Buffer.from("1")],
    ["scripted", Buffer.from("null")],
    ["scripted", Buffer.from(`{"a":"${"x".repeat(1024 * 1024)}"}`)],
    ["scripted", {}],
  ];
  for (const [executor, scenario_bytes] of bad) {
    assertRefusal(
      home,
      () => newProject(home, clock, { executor, scenario_bytes }),
      "E_EVENT",
    );
  }
  assert.deepStrictEqual(snapshot(home), before);
  assert.deepStrictEqual(fs.readdirSync(home), []);
  // exactly 1 MiB is fine
  const filler = "x".repeat(1024 * 1024 - '{"a":""}'.length);
  const edge = Buffer.from(`{"a":"${filler}"}`);
  assert.equal(edge.length, 1024 * 1024);
  newProject(home, clock, { executor: "scripted", scenario_bytes: edge });
});

// ---- TM-60 ---------------------------------------------------------------------------

test("TM-60 a project with no ceiling (0) is created; a ceiling out of range is refused", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const { id, state } = newProject(home, clock, { budget_usd: 0 });
  assert.equal(state.budget_usd, 0);
  assert.equal(readProject(id, { home }).state.budget_usd, 0);
  assert.equal(out(runTeam(home, ["project", id])).project.budget_usd, 0);
  assert.equal(
    newProject(home, clock, { budget_usd: 100000 }).state.budget_usd,
    100000,
  );
  assert.equal(
    newProject(home, clock, { budget_usd: 0.000001 }).state.budget_usd,
    0.000001,
  );
  const before = snapshot(home);
  for (const budget_usd of [
    -1,
    100001,
    "5",
    null,
    undefined,
    NaN,
    Infinity,
    0.0000001,
    true,
    [],
    {},
  ]) {
    assertRefusal(
      home,
      () => newProject(home, clock, { budget_usd }),
      "E_EVENT",
    );
  }
  assert.deepStrictEqual(snapshot(home), before);
  // the ceiling cannot be set back to 0 afterwards
  const w = openTracked(t, home, id, clock);
  const dir = path.join(home, id);
  assertRefusal(
    dir,
    () => w.append(usr("BUDGET_SET", { budget_usd: 0 })),
    "E_TRANSITION",
  );
  assertRefusal(
    dir,
    () => w.append(usr("BUDGET_SET", { budget_usd: -2 })),
    "E_EVENT",
  );
});

// ---- creating a project: input, all or nothing ------------------------------------------

test("a project needs a goal, an executor from the list and nothing else", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const before = snapshot(home);
  const bad = [
    { goal: "" },
    { goal: "   " },
    { goal: 5 },
    { goal: null },
    { goal: "x".repeat(2001) },
    { executor: "gpt" },
    { executor: undefined },
  ];
  for (const over of bad) {
    assertRefusal(home, () => newProject(home, clock, over), "E_EVENT");
  }
  assertRefusal(
    home,
    () =>
      createProject(
        { goal: "Цель", budget_usd: 1, executor: "claude-cli", extra: 1 },
        { home, now: clock },
      ),
    "E_EVENT",
  );
  assertRefusal(
    home,
    () => createProject(null, { home, now: clock }),
    "E_EVENT",
  );
  assert.deepStrictEqual(snapshot(home), before);
  // the length is counted in code points: 2000 of 4 bytes each are fine
  const longest = newProject(home, clock, { goal: "😀".repeat(2000) });
  assert.equal([...longest.state.goal].length, 2000);
});

test("a missing data folder is created with 0700 and a wide one is narrowed by createProject", (t) => {
  const missing = makeHome(t, { create: false });
  assert.equal(fs.existsSync(missing), false);
  assert.deepStrictEqual(listProjects({ home: missing }), {
    projects: [],
    warnings: [],
  });
  assert.equal(fs.existsSync(missing), false, "reading creates nothing");
  assert.throws(
    () => readProject("p-20260101-aaaaaa", { home: missing }),
    (err) => err.code === "E_NOT_FOUND",
  );
  assert.equal(fs.existsSync(missing), false);
  const created = newProject(missing, makeClock());
  assert.equal(modeOf(missing), 0o700);
  assert.ok(created.id);

  const wide = makeHome(t);
  fs.chmodSync(wide, 0o755);
  const result = newProject(wide, makeClock());
  assert.equal(modeOf(wide), 0o700);
  assert.ok(result.notices.some((n) => n.includes("0700")));
});

test("a project that cannot be fully created leaves no folder behind (and leftovers are not listed)", (t) => {
  const home = makeHome(t);
  fs.mkdirSync(path.join(home, ".creating-p-20260101-abcdef"));
  assert.deepStrictEqual(listProjects({ home }).projects, []);
  const { id } = newProject(home, makeClock());
  assert.deepStrictEqual(
    listProjects({ home }).projects.map((x) => x.id),
    [id],
  );
});

test("a task that is created by a user has the next number; memory of an agent carries its executor", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  withPlan(w, [planTask("t-0001", "lawyer")]);
  assert.equal(w.nextTaskId(), "t-0002");
  w.addTask(
    { role: "support", text: "Ответить клиенту", done_when: "Ответ отправлен" },
    "USER",
  );
  assert.equal(w.nextTaskId(), "t-0003");
  assert.equal(w.nextRunId(), "r-00001");
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  startRun(w, "work", "lawyer", "t-0001");
  assert.equal(w.nextRunId(), "r-00002");
  w.addMemory(
    { kind: "note", text: "Заметка агента", executor: "claude-cli" },
    "AGENT",
  );
  assert.equal(w.state.memory[0].source, "AGENT");
});

// ---- TM-63 (r4, section 6.8) ---------------------------------------------------------

test("TM-63 importResultBytes: the file is masked, 0600, with the event of the written bytes; work/ is not touched", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  withPlan(w, [planTask("t-0001", "developer")]);
  const workBefore = snapshot(w.workDir);
  const bytes = Buffer.from(`Итог. Ключ: ${FAKE_KEY}\nКонец, ёжик\n`, "utf8");
  const event = w.importResultBytes({ task: null, name: "note.md", bytes });
  const written = path.join(p.dir, "files", "note.md");
  assert.equal(modeOf(written), 0o600);
  const content = fs.readFileSync(written, "utf8");
  assert.ok(!content.includes(FAKE_KEY), "the key is not in the file");
  assert.ok(content.includes("[скрыто]"));
  assert.ok(content.includes("ёжик"), "the rest of the text is as it was");
  assert.deepStrictEqual(event.data, {
    name: "note.md",
    bytes: fs.statSync(written).size,
    sha256: sha256(fs.readFileSync(written)),
    kind: "result",
    from_work: false,
  });
  assert.equal(event.type, "RESULT_FILE");
  assert.equal(event.source, "ENGINE");
  assert.equal(event.task, null);
  assert.deepStrictEqual(journalOf(p.events).at(-1), event);
  assert.equal(w.state.files.length, 1);
  assert.equal(w.state.files[0].from_work, false);
  assert.deepStrictEqual(snapshot(w.workDir), workBefore, "work/ is the same");
  assert.ok(
    !fs.readFileSync(p.events, "utf8").includes(FAKE_KEY),
    "the key is not in the journal",
  );
  assert.deepStrictEqual(fs.readdirSync(path.join(p.dir, "files")), [
    "note.md",
  ]);

  // a task, a draft, and the text exactly at the limit
  const draft = w.importResultBytes({
    task: "t-0001",
    name: "draft.md",
    bytes: Buffer.from("Черновик", "utf8"),
    kind: "draft",
  });
  assert.equal(draft.task, "t-0001");
  assert.equal(draft.data.kind, "draft");
  const big = w.importResultBytes({
    name: "limit.md",
    bytes: Buffer.alloc(5 * 1024 * 1024, 0x61),
  });
  assert.equal(big.data.bytes, 5 * 1024 * 1024);
});

test("TM-63 importResultBytes: every refusal writes nothing (files/, the journal and the data folder are as they were)", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  w.importResultBytes({ name: "taken.md", bytes: Buffer.from("Занято") });
  const good = Buffer.from("Текст", "utf8");
  const cases = [
    [
      "a string instead of a Buffer",
      { name: "a.md", bytes: "Текст" },
      "E_EVENT",
    ],
    [
      "a Uint8Array that is not a Buffer",
      { name: "a.md", bytes: new Uint8Array(good) },
      "E_EVENT",
    ],
    ["no bytes", { name: "a.md" }, "E_EVENT"],
    [
      "bytes that are not UTF-8",
      { name: "a.md", bytes: Buffer.from([0x61, 0xff, 0xfe, 0x62]) },
      "E_EVENT",
    ],
    [
      "a cut multi-byte letter",
      { name: "a.md", bytes: Buffer.from([0xd0]) },
      "E_EVENT",
    ],
    [
      "more than 5 MiB",
      { name: "a.md", bytes: Buffer.alloc(5 * 1024 * 1024 + 1, 0x61) },
      "E_EVENT",
    ],
    ["a name that leaves files/", { name: "../x", bytes: good }, "E_FILE_NAME"],
    ["a name with a slash", { name: "a/b.md", bytes: good }, "E_FILE_NAME"],
    [
      "a name that is taken",
      { name: "taken.md", bytes: good },
      "E_FILE_EXISTS",
    ],
    [
      "a task that is not there",
      { name: "a.md", bytes: good, task: "t-0007" },
      "E_TASK_NOT_FOUND",
    ],
    ["no file object", null, "E_EVENT"],
  ];
  for (const [label, input, code] of cases) {
    const err = assertRefusal(home, () => w.importResultBytes(input), code);
    assert.ok(err.message.length > 0, label);
    assert.doesNotMatch(err.message, /\n\s+at /, label);
  }
  assert.deepStrictEqual(fs.readdirSync(path.join(p.dir, "files")), [
    "taken.md",
  ]);
  // the refusal of the size and of the encoding are named
  assert.equal(
    assertRefusal(
      home,
      () => w.importResultBytes({ name: "a.md", bytes: Buffer.from([0xff]) }),
      "E_EVENT",
    ).message,
    "Файл результата должен быть текстом UTF-8",
  );
  assert.equal(
    assertRefusal(
      home,
      () =>
        w.importResultBytes({
          name: "a.md",
          bytes: Buffer.alloc(5 * 1024 * 1024 + 1, 0x61),
        }),
      "E_EVENT",
    ).message,
    "Файл результата слишком большой",
  );
  // the writer was not broken by the refusals
  w.importResultBytes({ name: "after.md", bytes: good });
  assert.deepStrictEqual(fs.readdirSync(path.join(p.dir, "files")).sort(), [
    "after.md",
    "taken.md",
  ]);
});

test("TM-63 importResultBytes: a failed write is E_DISK, no .partial and no event are left, the writer goes on; a closed writer is refused", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const { writer: w } = p;
  const filesDir = path.join(p.dir, "files");
  const before = snapshot(home);
  const result = withFaults(
    [
      {
        fn: "writeFileSync",
        paths: [path.join(filesDir, ".partial-note.md")],
        effect: "throw",
        code: "EIO",
      },
    ],
    () => w.importResultBytes({ name: "note.md", bytes: Buffer.from("Текст") }),
  );
  assert.deepStrictEqual(result.fired, [true]);
  assert.equal(result.error.code, "E_DISK");
  assert.equal(result.error.details.os_code, "EIO");
  assert.deepStrictEqual(fs.readdirSync(filesDir), []);
  assert.deepStrictEqual(snapshot(home), before);
  w.importResultBytes({ name: "note.md", bytes: Buffer.from("Текст") });
  assert.deepStrictEqual(fs.readdirSync(filesDir), ["note.md"]);

  w.close();
  assertRefusal(
    home,
    () => w.importResultBytes({ name: "x.md", bytes: Buffer.from("Текст") }),
    "E_WRITER_BROKEN",
  );
});
