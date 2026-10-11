// REQ-039, criterion 1 (design 10, HO-01...HO-08): `npm run handoff -- new` makes the
// file of a handoff: the name, the identifier, the fields and their order, `round`,
// `base_tag`, the time of the clock, the form of the text. Every case has its own
// temporary repository; the clock is the real one and is read before and after the run.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { HELP, parseArgv } from "../src/handoffs/args.js";
import { handoffNames } from "../src/handoffs/build.js";
import { HandoffError } from "../src/handoffs/errors.js";
import { readRoles } from "../src/handoffs/roles.js";
import {
  AGENTS_DIR,
  CANON,
  FAKE_ID,
  FAKE_REL,
  FAKE_RUN,
  baseTag,
  canonArgs,
  describe,
  listTree,
  newArgs,
  newCmdRepo,
  runHandoff,
} from "./handoffs-helpers.js";

const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const seconds = (stamp) => Date.parse(stamp) / 1000;
const now = () => Math.floor(Date.now() / 1000);

test("HO-01 the call of the requirement makes the file: path, handoff_id, fields in order, round, base_tag, times of one reading, two lines, code 0", (t) => {
  const sai = newCmdRepo(t);
  sai.tag(baseTag(FAKE_RUN));
  const before = now();
  const r = sai.cmd(
    canonArgs({
      criterion: ["Первый пункт", "Второй пункт"],
      requirement: "REQ-999",
      "artifact-in": ["docs/design/REQ-999-demo.md", "пояснение (в скобках)"],
      "write-set": "tools/test/demo.test.js",
      route: "A -> B",
    }),
  );
  const after = now();
  assert.equal(r.status, 0, describe(r));
  assert.equal(r.stderr, "");
  assert.equal(r.stdout, `${FAKE_REL}\nhandoff_id: ${FAKE_ID}\n`);

  const d = sai.json(FAKE_REL);
  assert.deepEqual(Object.keys(d), [
    "handoff_id",
    "run_id",
    "workflow_id",
    "step",
    "round",
    "from_agent",
    "to_agent",
    "file",
    "status",
    "priority",
    "context",
    "task",
    "created_at",
    "started_at",
    "completed_at",
    "result",
  ]);
  assert.deepEqual(Object.keys(d.context), [
    "requirement_ids",
    "agent_run_id",
    "artifacts_in",
    "route",
    "write_set",
    "base_tag",
  ]);
  assert.deepEqual(
    { ...d, created_at: "T", started_at: "T" },
    {
      handoff_id: FAKE_ID,
      run_id: FAKE_RUN,
      workflow_id: "WF-02",
      step: "05b",
      round: 1,
      from_agent: "ORCH",
      to_agent: "TEST-DESIGN-VALIDATOR",
      file: FAKE_REL,
      status: "PENDING",
      priority: "NORMAL",
      context: {
        requirement_ids: ["REQ-999"],
        agent_run_id: null,
        artifacts_in: ["docs/design/REQ-999-demo.md", "пояснение (в скобках)"],
        route: "A -> B",
        write_set: ["tools/test/demo.test.js"],
        base_tag: `base/${FAKE_RUN}`,
      },
      task: {
        description: CANON.task,
        acceptance_criteria: ["Первый пункт", "Второй пункт"],
      },
      created_at: "T",
      started_at: "T",
      completed_at: null,
      result: null,
    },
  );
  assert.match(d.created_at, TIME);
  assert.equal(d.created_at, d.started_at);
  const at = seconds(d.created_at);
  assert.ok(
    at >= before && at <= after,
    `${d.created_at} / ${before}..${after}`,
  );
});

test("HO-02 the text of the file: two spaces, a line feed at the end, Cyrillic as it is, no BOM", (t) => {
  const sai = newCmdRepo(t);
  sai.tag(baseTag(FAKE_RUN));
  assert.equal(sai.cmd(canonArgs()).status, 0);
  const bytes = sai.read(FAKE_REL);
  assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const text = bytes.toString("utf8");
  assert.ok(text.startsWith('{\n  "handoff_id": '));
  assert.ok(text.endsWith("}\n") && !text.endsWith("}\n\n"));
  assert.ok(!text.includes("\\u"), "letters are not escaped");
  assert.ok(text.includes("Проверить тесты REQ-999"));
  assert.equal(text, `${JSON.stringify(JSON.parse(text), null, 2)}\n`);
  assert.equal(fs.statSync(path.join(sai.root, FAKE_REL)).mode & 0o777, 0o644);
});

test("HO-03 the shortest call: defaults, empty lists and no optional fields; run2 and v3 give no round; all optional keys keep the order", (t) => {
  const sai = newCmdRepo(t);
  const base = {
    run: "PROD-20991231-02",
    step: "01",
    role: "BACKEND-DEV",
    workflow: "WF-01",
    task: "t",
  };
  const r = sai.cmd(newArgs(base));
  assert.equal(r.status, 0, describe(r));
  const d = sai.json("handoffs/PROD-20991231-02/step-01-backend-dev.json");
  assert.equal(d.priority, "NORMAL");
  assert.deepEqual(d.context, {
    requirement_ids: [],
    agent_run_id: null,
    artifacts_in: [],
  });
  assert.deepEqual(d.task, { description: "t", acceptance_criteria: [] });
  assert.ok(!("round" in d));

  for (const suffix of ["run2", "v3"]) {
    const x = sai.cmd(newArgs({ ...base, step: "02", suffix }));
    assert.equal(x.status, 0, describe(x));
    const rel = `handoffs/PROD-20991231-02/step-02-backend-dev-${suffix}.json`;
    const doc = sai.json(rel);
    assert.ok(!("round" in doc), suffix);
    assert.equal(doc.handoff_id, `step02-${suffix}-PROD-20991231-02`);
  }

  sai.tag(baseTag("PROD-20991231-03"));
  const all = sai.cmd(
    newArgs({
      ...base,
      run: "PROD-20991231-03",
      priority: "HIGH",
      requirement: ["REQ-001", "REQ-002"],
      route: "x",
      "write-set": ["a", "b"],
      "rework-of": "handoffs/PROD-20991231-03/step-01-backend-dev.json",
      suffix: "r2",
    }),
  );
  assert.equal(all.status, 0, describe(all));
  const full = sai.json(
    "handoffs/PROD-20991231-03/step-01-backend-dev-r2.json",
  );
  assert.equal(full.priority, "HIGH");
  assert.equal(full.round, 2);
  assert.deepEqual(Object.keys(full).slice(0, 8), [
    "handoff_id",
    "run_id",
    "workflow_id",
    "step",
    "round",
    "from_agent",
    "to_agent",
    "file",
  ]);
  assert.deepEqual(full.context.write_set, ["a", "b"]);
  assert.deepEqual(Object.keys(full.context), [
    "requirement_ids",
    "agent_run_id",
    "artifacts_in",
    "route",
    "write_set",
    "base_tag",
    "rework_of",
  ]);
  assert.deepEqual(full.context.requirement_ids, ["REQ-001", "REQ-002"]);
  assert.deepEqual(full.context.write_set, ["a", "b"]);
});

test("HO-04 the arguments: repeated keys are lists in the order of input, write_set is a list even for one value, the help names every key", () => {
  const parsed = parseArgv(
    canonArgs({
      criterion: ["c3", "c1", "c2"],
      requirement: ["REQ-002", "REQ-001"],
      "artifact-in": ["b", "a"],
      "write-set": ["only one"],
    }),
  );
  assert.equal(parsed.cmd, "new");
  assert.deepEqual(parsed.opts.criterion, ["c3", "c1", "c2"]);
  assert.deepEqual(parsed.opts.requirement, ["REQ-002", "REQ-001"]);
  assert.deepEqual(parsed.opts.artifactIn, ["b", "a"]);
  assert.deepEqual(parsed.opts.writeSet, ["only one"]);
  assert.equal(parsed.opts.suffix, "r1");
  assert.deepEqual(
    parseArgv(["close", "handoffs/R-1/x.json", "--status", "FAILED"]),
    {
      cmd: "close",
      opts: { path: "handoffs/R-1/x.json", status: "FAILED" },
    },
  );
  assert.deepEqual(parseArgv(["new", "--help"]), { help: true });
  for (const key of [
    "run",
    "step",
    "role",
    "workflow",
    "task",
    "criterion",
    "requirement",
    "artifact-in",
    "write-set",
    "route",
    "qualifier",
    "suffix",
    "priority",
    "rework-of",
    "status",
  ])
    assert.ok(HELP.includes(`--${key}`), key);
  assert.ok(HELP.includes("new") && HELP.includes("close"));
  // A key given twice that may not repeat is a wrong call (code 2).
  assert.throws(
    () => parseArgv(canonArgs({ route: ["a", "b"] })),
    (e) => e instanceof HandoffError && e.exit === 2,
  );
});

test("HO-05 the name of the file and the handoff_id for every combination, and for every role code of the folder of roles", () => {
  const base = { run: "ISS-0002-20260930-01", step: "06", role: "CODE-FIXER" };
  const cases = [
    [{}, "step-06-code-fixer", "step06"],
    [{ qualifier: "market" }, "step-06-code-fixer-market", "step06-market"],
    [{ suffix: "r2" }, "step-06-code-fixer-r2", "step06-r2"],
    [
      { qualifier: "req001", suffix: "run2" },
      "step-06-code-fixer-req001-run2",
      "step06-req001-run2",
    ],
    [{ suffix: "v3" }, "step-06-code-fixer-v3", "step06-v3"],
  ];
  for (const [over, stem, id] of cases) {
    const names = handoffNames({ ...base, ...over });
    assert.equal(names.rel, `handoffs/${base.run}/${stem}.json`);
    assert.equal(names.handoffId, `${id}-${base.run}`);
  }
  assert.equal(handoffNames({ ...base, suffix: "r2" }).round, 2);
  assert.equal(handoffNames({ ...base, suffix: "v2" }).round, undefined);

  // The codes are counted here independently of readRoles: the last brackets of `name:`.
  const codes = [];
  for (const file of fs.readdirSync(AGENTS_DIR)) {
    const line = fs
      .readFileSync(path.join(AGENTS_DIR, file), "utf8")
      .split("\n")
      .find((l) => l.startsWith("name:"));
    const m = /\(([A-Z0-9-]+)\)\s*$/u.exec(line ?? "");
    if (m !== null) codes.push(m[1]);
  }
  assert.ok(codes.length >= 30, `${codes.length} codes`);
  for (const code of codes) {
    const names = handoffNames({
      run: "PROD-20991231-01",
      step: "01",
      role: code,
    });
    assert.equal(
      names.rel,
      `handoffs/PROD-20991231-01/step-01-${code.toLowerCase()}.json`,
    );
  }
});

function agentFile(root, file, text) {
  const dir = path.join(root, ".claude", "agents");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
}

test("HO-06 the list of roles is read from the folder: the count equals an independent count, invented roles are known, odd files are skipped, no folder is code 2", (t) => {
  // The project's own folder.
  const own = fs
    .readdirSync(AGENTS_DIR)
    .map((f) => fs.readFileSync(path.join(AGENTS_DIR, f), "utf8"))
    .flatMap((x) =>
      x.split("\n").filter((l) => /^name:.*\([A-Z0-9-]+\)\s*$/u.test(l)),
    );
  const root = path.dirname(path.dirname(AGENTS_DIR));
  const roles = readRoles(root);
  assert.equal(roles.length, new Set(own).size);
  assert.ok(roles.includes("TEST-DESIGNER") && roles.includes("ORCH"));

  // Invented roles: the list is not in the code.
  const sai = newCmdRepo(t);
  fs.rmSync(path.join(sai.root, ".claude", "agents"), { recursive: true });
  for (const [file, code] of [
    ["a.md", "ALPHA"],
    ["b.md", "BETA-1"],
    ["c.md", "GAMMA"],
  ])
    agentFile(sai.root, file, `---\nname: Demo (${code})\n---\ntext\n`);
  assert.deepEqual(readRoles(sai.root), ["ALPHA", "BETA-1", "GAMMA"]);
  sai.commit("2025-01-03T00:00:00Z");
  const ok = sai.cmd(
    newArgs({
      run: "PROD-20991231-01",
      step: "01",
      role: "BETA-1",
      workflow: "WF-01",
      task: "t",
    }),
  );
  assert.equal(ok.status, 0, describe(ok));
  assert.equal(
    sai.json("handoffs/PROD-20991231-01/step-01-beta-1.json").to_agent,
    "BETA-1",
  );
  const no = sai.cmd(
    newArgs({
      run: "PROD-20991231-01",
      step: "02",
      role: "BACKEND-DEV",
      workflow: "WF-01",
      task: "t",
    }),
  );
  assert.equal(no.status, 1, describe(no));
  assert.ok(no.stderr.includes("E_HO_INPUT"));

  // Odd files: no block, no brackets, a repeated code.
  fs.rmSync(path.join(sai.root, ".claude", "agents"), { recursive: true });
  agentFile(sai.root, "x.md", "name: No Block (NOBLOCK)\n");
  agentFile(sai.root, "y.md", "---\nname: No brackets\n---\n");
  agentFile(sai.root, "z.md", "---\nname: One (REPEAT)\n---\n");
  agentFile(sai.root, "w.md", "---\nname: Two (REPEAT)\n---\n");
  agentFile(
    sai.root,
    "v.md",
    "---\ndescription: (HIDDEN)\nname: Named (REAL-1)\n---\n",
  );
  agentFile(sai.root, "u.txt", "---\nname: Text (NOTMD)\n---\n");
  assert.deepEqual(readRoles(sai.root), ["REAL-1", "REPEAT"]);

  // No code at all, and no folder: code 2 E_HO_ROLES, nothing written.
  fs.rmSync(path.join(sai.root, ".claude", "agents"), { recursive: true });
  agentFile(sai.root, "only.md", "---\nname: No code\n---\n");
  const handoffsBefore = listTree(path.join(sai.root, "handoffs"));
  const none = sai.cmd(canonArgs({ workflow: "WF-01" }));
  assert.equal(none.status, 2, describe(none));
  assert.ok(none.stderr.startsWith("handoff: E_HO_ROLES: "), none.stderr);
  fs.rmSync(path.join(sai.root, ".claude"), { recursive: true });
  const missing = sai.cmd(canonArgs({ workflow: "WF-01" }));
  assert.equal(missing.status, 2, describe(missing));
  assert.ok(missing.stderr.startsWith("handoff: E_HO_ROLES: "), missing.stderr);
  assert.deepEqual(listTree(path.join(sai.root, "handoffs")), handoffsBefore);
  assert.throws(
    () => readRoles(path.join(sai.root, "nowhere")),
    (e) => e instanceof HandoffError && e.code === "E_HO_ROLES" && e.exit === 2,
  );
});

test("HO-07 a file made by new passes handoffs-check: code 0, no violations", (t) => {
  const sai = newCmdRepo(t);
  sai.tag(baseTag(FAKE_RUN));
  const r = sai.cmd(canonArgs({ criterion: "a", "write-set": "b" }));
  assert.equal(r.status, 0, describe(r));
  const check = sai.run([]);
  assert.equal(check.status, 0, describe(check));
  assert.match(check.stdout, /нарушений 0/u);
});

test("HO-08 every workflow WF-01...WF-07 is accepted; WF-00, WF-08, WF-1 and wf-01 are refused", (t) => {
  const sai = newCmdRepo(t);
  sai.tag(baseTag(FAKE_RUN));
  for (let n = 1; n <= 7; n++) {
    const workflow = `WF-0${n}`;
    const r = sai.cmd(
      canonArgs({
        workflow,
        step: `0${n}`,
        suffix: undefined,
        qualifier: undefined,
      }),
    );
    assert.equal(r.status, 0, `${workflow}: ${describe(r)}`);
    const d = sai.json(
      `handoffs/${FAKE_RUN}/step-0${n}-test-design-validator.json`,
    );
    assert.equal(d.workflow_id, workflow);
    assert.equal(d.context.base_tag, `base/${FAKE_RUN}`);
  }
  for (const workflow of ["WF-00", "WF-08", "WF-1", "wf-01", "WF-001", ""]) {
    const before = sai.tree();
    const r = sai.cmd(canonArgs({ workflow, step: "09" }));
    assert.equal(r.status, 1, `${workflow}: ${describe(r)}`);
    assert.ok(
      r.stderr.startsWith("handoff: E_HO_INPUT: ключ --workflow"),
      r.stderr,
    );
    assert.equal(sai.tree(), before);
  }
});

test("HO-09 the process of the helper itself: a run outside of a git repository stops with code 2 and writes nothing", (t) => {
  const sai = newCmdRepo(t);
  const outside = path.join(sai.dir, "outside");
  fs.mkdirSync(outside);
  const r = runHandoff(canonArgs({ workflow: "WF-01" }), {
    cwd: outside,
    env: sai.env,
  });
  assert.equal(r.status, 2, describe(r));
  assert.ok(r.stderr.startsWith("handoff: E_TRACE_NOT_GIT: "), r.stderr);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("HO-01b the text of the task and of the lists is written as it is: spaces at the ends, quotes, a dollar sign, a back quote, a line feed, Unicode; the order of the lists is the order of input", (t) => {
  const sai = newCmdRepo(t);
  sai.tag(baseTag(FAKE_RUN));
  const task = '  Текст "с кавычками" и $HOME `x` \\ \nвторая строка 😀  ';
  const criteria = ["  третий ", "первый", "второй\n"];
  const r = sai.cmd(
    canonArgs({
      task,
      criterion: criteria,
      "write-set": ["b", "a"],
      "artifact-in": ["z", "y"],
      requirement: ["REQ-002", "REQ-001"],
    }),
  );
  assert.equal(r.status, 0, describe(r));
  const d = sai.json(FAKE_REL);
  assert.equal(d.task.description, task);
  assert.deepEqual(d.task.acceptance_criteria, criteria);
  assert.deepEqual(d.context.write_set, ["b", "a"]);
  assert.deepEqual(d.context.artifacts_in, ["z", "y"]);
  assert.deepEqual(d.context.requirement_ids, ["REQ-002", "REQ-001"]);
});
