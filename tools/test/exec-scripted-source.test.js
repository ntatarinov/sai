// Tests that scripted is only a player of scenarios: no scenario text in the code, no
// writing to the disk (design REQ-010, section 15.1: EX-07, EX-51; criteria 2 and 16).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  FIXTURES,
  TEAM_SRC,
  allFilesText,
  describeRun,
  execEnv,
  fakeStarts,
  journal,
  makeProject,
  makeSandbox,
  ofType,
  runTeam,
  sha256,
  snapshot,
  stateOf,
} from "./exec-helpers.js";

const GHP = ["gh", "p_", "FAKEfake", "0".repeat(28)].join("");
const SCRIPTED = path.join(TEAM_SRC, "executors", "scripted.js");

function walk(dir, visit) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walk(abs, visit);
    else visit(abs);
  }
}

function longStrings(value, out = []) {
  if (typeof value === "string") {
    if ([...value].length > 20) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) longStrings(v, out);
  } else if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) longStrings(v, out);
  }
  return out;
}

test("EX-07 no long text of any scenario of the fixtures appears in the code of Sai Team", () => {
  const code = [];
  walk(TEAM_SRC, (f) => code.push([f, fs.readFileSync(f, "utf8")]));
  const scenarios = fs
    .readdirSync(FIXTURES)
    .filter((n) => /^scenario-.*\.json$/u.test(n));
  assert.ok(scenarios.length >= 4);
  let checked = 0;
  for (const name of scenarios) {
    const text = fs.readFileSync(path.join(FIXTURES, name), "utf8");
    const raw = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    for (const text of longStrings(JSON.parse(raw))) {
      checked += 1;
      for (const [file, body] of code) {
        assert.equal(
          body.includes(text),
          false,
          `${name}: "${text}" is in ${file}`,
        );
      }
    }
  }
  assert.ok(checked >= 8, `strings checked: ${checked}`);
});

test("EX-51 a scripted run writes nothing into work/; its files come from memory and are stored byte for byte, 0600; a note with a key is refused", (t) => {
  const sb = makeSandbox(t);
  const scenario = fs.readFileSync(path.join(FIXTURES, "scenario-files.json"));
  const p = makeProject(sb, { executor: "scripted", scenario_bytes: scenario });
  const workBefore = snapshot(p.work);
  const r = runTeam(["run-task", p.id, p.task], execEnv(sb));
  assert.equal(r.status, 0, describeRun(r));
  assert.deepEqual(snapshot(p.work), workBefore);
  assert.deepEqual(fs.readdirSync(p.work), []);
  assert.deepEqual(fs.readdirSync(p.files).sort(), [
    "t-0001-1-input.md",
    "t-0001-1-note.md",
  ]);
  for (const name of fs.readdirSync(p.files)) {
    assert.equal(fs.lstatSync(path.join(p.files, name)).mode & 0o777, 0o600);
  }
  const noteBytes = fs.readFileSync(path.join(p.files, "t-0001-1-note.md"));
  const note = noteBytes.toString("utf8");
  assert.equal(
    note,
    "Заметка с вымышленными версиями a.b.c и 0.1.0 для проверки точного хранения\n",
    "the note is the text of the scenario, byte for byte",
  );
  assert.doesNotMatch(note, /\[скрыто\]/u);
  assert.equal(
    sha256(noteBytes),
    "fe4ac9e96d66dae3795c55544ffa19499bdbb86351c2aa234bb76e686f9b3596",
  );
  const input = fs.readFileSync(
    path.join(p.files, "t-0001-1-input.md"),
    "utf8",
  );
  assert.match(
    input,
    /## Задача/u,
    "the text of the task as the process would get it",
  );
  const events = journal(p);
  const rf = ofType(events, "RESULT_FILE");
  assert.equal(rf.length, 2);
  for (const e of rf) assert.equal(e.data.from_work, false);
  // The result files and the journal hold no copy of the key; the byte copy of the scenario
  // (criterion 16, d) is the only file that keeps the text of the scenario as it is.
  for (const [name] of Object.entries(snapshot(sb.home))) {
    const abs = path.join(sb.home, name);
    if (!fs.statSync(abs).isFile() || name.endsWith("scenario.json")) continue;
    assert.equal(fs.readFileSync(abs, "latin1").includes(GHP), false, name);
  }
  assert.equal(stateOf(sb, p.id).tasks[0].status, "review");
  assert.ok(allFilesText(sb.home).length > 0);

  // The same scenario with a key in the note (the mark of the fixture is replaced by
  // the key at run time): the core refuses the file, nothing of it is stored, the key
  // is only in the byte copy of the scenario.
  const text = fs.readFileSync(
    path.join(FIXTURES, "scenario-secret.json"),
    "utf8",
  );
  const sb2 = makeSandbox(t);
  const q = makeProject(sb2, {
    executor: "scripted",
    scenario_bytes: Buffer.from(text.replace("@@BAIT@@", GHP + "A".repeat(36))),
  });
  const refused = runTeam(["run-task", q.id, q.task], execEnv(sb2));
  assert.equal(refused.status, 1, describeRun(refused));
  assert.equal(fs.existsSync(path.join(q.files, "t-0001-1-note.md")), false);
  for (const name of Object.keys(snapshot(sb2.home))) {
    const abs = path.join(sb2.home, name);
    if (!fs.statSync(abs).isFile() || name.endsWith("scenario.json")) continue;
    assert.equal(
      fs.readFileSync(abs, "latin1").includes(GHP + "A".repeat(36)),
      false,
      name,
    );
  }
});

test("EX-51 scripted.js has no call that writes, only one read that does not follow a link", () => {
  const body = fs.readFileSync(SCRIPTED, "utf8");
  const forbidden =
    /writeFile|mkdir|rename|unlink|copyFile|appendFile|createWriteStream|openSync|[.]open[(]|O_WRONLY|O_RDWR|O_CREAT|O_APPEND|O_TRUNC|\blink(Sync)?\b|symlink|truncate|rmSync|\brm\(/u;
  const lines = body.split("\n");
  lines.forEach((line, i) => {
    if (line.trim().startsWith("//")) return; // a comment writes nothing
    assert.doesNotMatch(line, forbidden, `scripted.js:${i + 1}: ${line}`);
  });
  const reads = lines.filter((l) => l.includes("readFileSync"));
  assert.ok(reads.length >= 1, "no read of the scenario");
  for (const line of reads) assert.match(line, /O_NOFOLLOW/u, line);
  assert.doesNotMatch(
    body,
    /from\s+["']node:(child_process|net|http|https)["']/u,
  );
});

test("EX-51 a scenario in the project replaced by a link: refused with E_SCENARIO, the journal and work/ do not change", (t) => {
  const sb = makeSandbox(t);
  const p = makeProject(sb, {
    executor: "scripted",
    scenario_bytes: fs.readFileSync(path.join(FIXTURES, "scenario-basic.json")),
  });
  const target = path.join(sb.root, "real-scenario.json");
  fs.copyFileSync(path.join(FIXTURES, "scenario-basic.json"), target);
  const copy = path.join(p.dir, "scenario.json");
  fs.rmSync(copy);
  fs.symlinkSync(target, copy);
  const journalBefore = sha256(fs.readFileSync(p.events));
  const workBefore = snapshot(p.work);
  const r = runTeam(["run-task", p.id, p.task], execEnv(sb));
  assert.equal(r.status, 1, describeRun(r));
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^E_SCENARIO: /u);
  assert.equal(sha256(fs.readFileSync(p.events)), journalBefore);
  assert.deepEqual(snapshot(p.work), workBefore);
  assert.equal(fakeStarts(sb).length, 0);
  assert.equal(fs.readFileSync(target, "utf8").length > 0, true);
});

test("EX-51 a scenario that is missing, empty, not UTF-8 or of a wrong form is E_SCENARIO and writes nothing", (t) => {
  const sb = makeSandbox(t);
  const bad = [
    ["missing", null],
    ["empty", Buffer.alloc(0)],
    ["not UTF-8", Buffer.from([0xff, 0xfe, 0x7b, 0x7d])],
    ["not JSON", Buffer.from("{ nope")],
    ["no runs", Buffer.from('{"version":1,"runs":[]}')],
    [
      "version 2",
      Buffer.from(
        '{"version":2,"runs":[{"match":{},"steps":[],"result":{"outcome":"ok"}}]}',
      ),
    ],
    [
      "unknown key",
      Buffer.from(
        '{"version":1,"runs":[{"match":{},"steps":[],"result":{"outcome":"ok"},"x":1}]}',
      ),
    ],
    [
      "unknown outcome",
      Buffer.from(
        '{"version":1,"runs":[{"match":{},"steps":[],"result":{"outcome":"cancelled"}}]}',
      ),
    ],
  ];
  for (const [label, bytes] of bad) {
    const p = makeProject(sb, {
      executor: "scripted",
      scenario_bytes: fs.readFileSync(
        path.join(FIXTURES, "scenario-basic.json"),
      ),
    });
    const copy = path.join(p.dir, "scenario.json");
    if (bytes === null) fs.rmSync(copy);
    else fs.writeFileSync(copy, bytes);
    const before = sha256(fs.readFileSync(p.events));
    const r = runTeam(["run-task", p.id, p.task], execEnv(sb));
    assert.equal(r.status, 1, `${label}: ${describeRun(r)}`);
    assert.match(r.stderr, /^E_SCENARIO: /u, label);
    assert.equal(sha256(fs.readFileSync(p.events)), before, label);
    assert.deepEqual(fs.readdirSync(p.work), [], label);
  }
});

test("EX-51 the places of the code that write files are exactly the four of the core and the channel of REQ-013 (TM-04)", () => {
  const places = [];
  walk(TEAM_SRC, (f) => {
    fs.readFileSync(f, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/writeFile|appendFile|createWriteStream/u.test(line)) {
          places.push(`${path.basename(f)}:${i + 1}`);
        }
      });
  });
  assert.equal(places.length, 5, places.join(", "));
  assert.deepEqual(places.map((p) => p.split(":")[0]).sort(), [
    "channel.js",
    "files.js",
    "lock.js",
    "store.js",
    "store.js",
  ]);
});
