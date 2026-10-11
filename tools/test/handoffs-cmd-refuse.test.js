// REQ-039, criterion 3 (design 10, HO-20...HO-21, HO-25...HO-27, HO-74): the refusals of
// `new`. Every refusal is code 1 or 2, one stderr line `handoff: <CODE>: ...` without a
// stack, nothing on stdout (except the lines of violations of REQ-038), and the tree of
// the repository is as it was.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  CANON,
  FAKE_ID,
  FAKE_REL,
  FAKE_RUN,
  assertRefusal,
  baseTag,
  canonArgs,
  describe,
  fileHashes,
  listTree,
  newCmdRepo,
  newArgs,
} from "./handoffs-helpers.js";

// A repository with the tag of the run and one handoff already made.
function withFile(t) {
  const sai = newCmdRepo(t);
  sai.tag(baseTag(FAKE_RUN));
  const first = sai.cmd(canonArgs());
  assert.equal(first.status, 0, describe(first));
  return sai;
}

// [name, args, exit, code, a part of the line]
const USAGE = (what) => ["E_HO_USAGE", what];
const REFUSALS = [
  [
    "the file already exists",
    canonArgs(),
    1,
    "E_HO_EXISTS",
    "файл уже есть: " + FAKE_REL,
  ],
  [
    "the handoff_id is in another file",
    canonArgs({ role: "BACKEND-DEV" }),
    1,
    "E_HO_EXISTS",
    "handoff_id уже есть в файле " + FAKE_REL,
  ],
  [
    "run in small letters",
    canonArgs({ run: "prod-20991231-01" }),
    1,
    "E_HO_INPUT",
    "--run",
  ],
  [
    "run with dashes in the date",
    canonArgs({ run: "PROD-2099-12-31-01" }),
    1,
    "E_HO_INPUT",
    "--run",
  ],
  [
    "run with a one-digit number",
    canonArgs({ run: "PROD-20991231-1" }),
    1,
    "E_HO_INPUT",
    "--run",
  ],
  ["step 5b", canonArgs({ step: "5b" }), 1, "E_HO_INPUT", "--step"],
  ["step 100", canonArgs({ step: "100" }), 1, "E_HO_INPUT", "--step"],
  ["step 05B", canonArgs({ step: "05B" }), 1, "E_HO_INPUT", "--step"],
  [
    "unknown role",
    canonArgs({ role: "NOT-A-ROLE" }),
    1,
    "E_HO_INPUT",
    ".claude/agents",
  ],
  [
    "qualifier with a space and a capital",
    canonArgs({ qualifier: "Req 1" }),
    1,
    "E_HO_INPUT",
    "--qualifier",
  ],
  [
    "qualifier longer than 40",
    canonArgs({ qualifier: "a".repeat(41) }),
    1,
    "E_HO_INPUT",
    "--qualifier",
  ],
  ["suffix r0", canonArgs({ suffix: "r0" }), 1, "E_HO_INPUT", "--suffix"],
  ["suffix x1", canonArgs({ suffix: "x1" }), 1, "E_HO_INPUT", "--suffix"],
  ["suffix R1", canonArgs({ suffix: "R1" }), 1, "E_HO_INPUT", "--suffix"],
  [
    "workflow WF-9",
    canonArgs({ workflow: "WF-9" }),
    1,
    "E_HO_INPUT",
    "--workflow",
  ],
  ["empty task", canonArgs({ task: "" }), 1, "E_HO_INPUT", "--task"],
  ["blank task", canonArgs({ task: "   " }), 1, "E_HO_INPUT", "--task"],
  [
    "bad requirement",
    canonArgs({ requirement: ["REQ-001", "REQ-1"] }),
    1,
    "E_HO_INPUT",
    "--requirement",
  ],
  [
    "bad priority",
    canonArgs({ priority: "URGENT" }),
    1,
    "E_HO_INPUT",
    "--priority",
  ],
  [
    "rework-of outside of handoffs",
    canonArgs({ "rework-of": "docs/x.json" }),
    1,
    "E_HO_INPUT",
    "--rework-of",
  ],
  [
    "rework-of with ..",
    canonArgs({ "rework-of": "handoffs/../x.json" }),
    1,
    "E_HO_INPUT",
    "--rework-of",
  ],
  [
    "empty criterion",
    canonArgs({ criterion: ["a", ""] }),
    1,
    "E_HO_INPUT",
    "--criterion",
  ],
  [
    "blank write-set",
    canonArgs({ "write-set": " " }),
    1,
    "E_HO_INPUT",
    "--write-set",
  ],
  [
    "blank artifact-in",
    canonArgs({ "artifact-in": "\t" }),
    1,
    "E_HO_INPUT",
    "--artifact-in",
  ],
  ["blank route", canonArgs({ route: " " }), 1, "E_HO_INPUT", "--route"],
  [
    "unknown key",
    [...canonArgs(), "--bogus", "x"],
    2,
    ...USAGE("неизвестный ключ"),
  ],
  [
    "a key without a value at the end",
    [...canonArgs(), "--route"],
    2,
    ...USAGE("нет значения"),
  ],
  [
    "a key followed by another key",
    [...canonArgs({ route: undefined }), "--route", "--priority", "HIGH"],
    2,
    ...USAGE("нет значения"),
  ],
  [
    "a value that starts with --",
    canonArgs({ task: "--drop everything" }),
    2,
    ...USAGE("нет значения"),
  ],
  [
    "a criterion that starts with --",
    canonArgs({ criterion: "--x" }),
    2,
    ...USAGE("нет значения"),
  ],
  [
    "a key twice",
    [...canonArgs(), "--run", "PROD-20991231-02"],
    2,
    ...USAGE("задан дважды"),
  ],
  ["no task", canonArgs({ task: undefined }), 2, ...USAGE("--task")],
  ["no run", canonArgs({ run: undefined }), 2, ...USAGE("--run")],
  ["no subcommand", [], 2, ...USAGE("нет подкоманды")],
  ["an unknown subcommand", ["start"], 2, ...USAGE("неизвестная подкоманда")],
  [
    "a loose argument",
    [...canonArgs(), "extra"],
    2,
    ...USAGE("лишний аргумент"),
  ],
];

test("HO-20 every refusal of new: the code by the table, one line `handoff: CODE: ...` without a stack, nothing on stdout, the tree and git status as they were", (t) => {
  const sai = withFile(t);
  const fileBefore = sai.read(FAKE_REL);
  for (const [name, args, exit, code, part] of REFUSALS) {
    const tree = sai.tree();
    const status = sai.status();
    const r = sai.cmd(args);
    let line;
    try {
      line = assertRefusal(r, exit, code);
    } catch (err) {
      err.message = `${name}: ${err.message}`;
      throw err;
    }
    assert.ok(line.includes(part), `${name}: ${line}`);
    assert.equal(sai.tree(), tree, name);
    assert.equal(sai.status(), status, name);
  }
  assert.deepEqual(sai.read(FAKE_REL), fileBefore);
});

test("HO-20c the checks of a repeat come before any write: with every mkdir, write and link failing, a repeat of a file, of a handoff_id or of a leftover is still code 1 and nothing is touched", (t) => {
  const sai = withFile(t);
  const dir = path.join(sai.root, "handoffs", FAKE_RUN);
  const tmpOf = (name) => path.join(dir, `.${name}.sai-tmp`);
  const second = "step-06-test-design-validator-req999-r1.json";
  fs.writeFileSync(tmpOf(second), "held by another process\n");
  const cases = [
    ["file", canonArgs(), "E_HO_EXISTS", path.basename(FAKE_REL)],
    [
      "handoff_id",
      canonArgs({ role: "BACKEND-DEV" }),
      "E_HO_EXISTS",
      "handoff_id",
    ],
    ["leftover", canonArgs({ step: "06" }), "E_HO_BUSY", second],
  ];
  for (const [name, args, code, part] of cases) {
    const target = args.includes("BACKEND-DEV")
      ? "step-05b-backend-dev-req999-r1.json"
      : args.includes("06")
        ? second
        : path.basename(FAKE_REL);
    const faults = [
      {
        fn: "mkdirSync",
        paths: [path.join(sai.root, "handoffs"), dir],
        effect: "throw",
        code: "EIO",
      },
      {
        fn: "writeFileSync",
        paths: [tmpOf(target)],
        effect: "throw",
        code: "EIO",
      },
      { fn: "linkSync", from: tmpOf(target), effect: "throw", code: "EIO" },
    ];
    const before = sai.tree();
    const hashes = fileHashes(sai.root);
    const r = sai.cmd(args, { faults });
    const line = assertRefusal(r, 1, code);
    assert.ok(line.includes(part), `${name}: ${line}`);
    assert.equal(sai.tree(), before, name);
    assert.deepEqual(fileHashes(sai.root), hashes, name);
  }
});

test("HO-20b a refusal makes no folder of the run: the folder handoffs/<RUN-ID>/ does not appear", (t) => {
  const sai = newCmdRepo(t);
  sai.tag(baseTag("PROD-20991231-05"));
  const before = listTree(sai.root);
  for (const over of [
    { step: "5b" },
    { role: "NOT-A-ROLE" },
    { task: "" },
    { suffix: "r0" },
  ]) {
    const r = sai.cmd(canonArgs({ run: "PROD-20991231-05", ...over }));
    assertRefusal(r, 1, "E_HO_INPUT");
  }
  assert.deepEqual(listTree(sai.root), before);
  assert.ok(!fs.existsSync(path.join(sai.root, "handoffs")));
});

const TEXT_KEYS = (mark) => ({
  task: `task ${mark}`,
  criterion: [`criterion ${mark}`],
  route: `route ${mark}`,
  "write-set": [`write ${mark}`],
  "artifact-in": [`in ${mark}`],
});

// The marks stand in the five text keys of a refusal; none of them may come back.
function assertNoValues(t, mark, cases) {
  for (const [name, over, setup] of cases) {
    const inner = newCmdRepo(t);
    inner.tag(baseTag(FAKE_RUN));
    if (setup) setup(inner);
    const r = inner.cmd(newArgs({ ...CANON, ...TEXT_KEYS(mark), ...over }));
    assert.notEqual(r.status, 0, name);
    assert.ok(!r.stdout.includes(mark), `${name}: stdout ${r.stdout}`);
    assert.ok(!r.stderr.includes(mark), `${name}: stderr ${r.stderr}`);
    assert.ok(r.stderr.startsWith("handoff: "), `${name}: ${r.stderr}`);
  }
}

const REFUSED_WITH_TEXT = [
  ["bad run", { run: "bad-run" }],
  ["bad step", { step: "5b" }],
  ["bad role", { role: "NOT-A-ROLE" }],
  ["bad workflow", { workflow: "WF-9" }],
  ["bad requirement", { requirement: "REQ-1" }],
  ["bad rework-of", { "rework-of": "x" }],
  ["no tag for WF-02", { run: "PROD-20991231-09" }],
  ["unknown key", { bogus: "x" }],
  [
    "the file exists",
    {},
    (s) => {
      s.cmd(newArgs({ ...CANON, workflow: "WF-01" }));
    },
  ],
  [
    "the handoff_id exists",
    { role: "BACKEND-DEV" },
    (s) => {
      s.cmd(newArgs({ ...CANON, workflow: "WF-01" }));
    },
  ],
];

test("HO-21 no value of task, criterion, route, write-set or artifact-in comes back in a refusal", (t) => {
  assertNoValues(t, "SENTINEL-ZQ9", REFUSED_WITH_TEXT);
});

test("HO-74 a secret in an argument does not come back in a refusal", (t) => {
  // Put together from parts, so that this file holds no string like a key.
  const secret = ["sk", "-", "Zq9".repeat(8)].join("");
  assertNoValues(t, secret, REFUSED_WITH_TEXT);
});

test("HO-25 a temporary file left by an interrupted or parallel write: code 1 E_HO_BUSY, the leftover is not touched, the file is not made", (t) => {
  const sai = newCmdRepo(t);
  sai.tag(baseTag(FAKE_RUN));
  const tmp = `handoffs/${FAKE_RUN}/.${path.posix.basename(FAKE_REL)}.sai-tmp`;
  sai.write(tmp, "held by another process\n");
  const before = sai.tree();
  const hashes = fileHashes(sai.root);
  const r = sai.cmd(canonArgs());
  const line = assertRefusal(r, 1, "E_HO_BUSY");
  assert.ok(line.includes(path.posix.basename(tmp)), line);
  assert.equal(sai.tree(), before);
  assert.deepEqual(fileHashes(sai.root), hashes);
  assert.ok(!fs.existsSync(path.join(sai.root, FAKE_REL)));
});

test("HO-26 a path of a home folder in the task and a path of a temporary folder in a criterion: code 1 E_HO_RULES, the violations H10 and H11 on stdout, nothing is made", (t) => {
  const sai = newCmdRepo(t);
  sai.tag(baseTag(FAKE_RUN));
  // Put together from parts, so that this file is not a trace itself.
  const home = ["", "Us" + "ers", "zq", "work"].join("/");
  const temp = ["", "pri" + "vate", "tmp", "zq"].join("/");
  const before = sai.tree();
  const r = sai.cmd(
    canonArgs({ task: `see ${home} now`, criterion: [`cd ${temp}`] }),
  );
  const line = assertRefusal(r, 1, "E_HO_RULES", { stdout: true });
  assert.ok(line.includes("нарушений 2"), line);
  const rows = r.stdout.split("\n").filter((l) => l !== "");
  assert.equal(rows.length, 2, r.stdout);
  for (const row of rows)
    assert.match(row, /^handoffs\/\S+\.json:\d+ — H1[01]: /u, row);
  assert.ok(
    rows.some((x) => x.includes(" — H10: ")),
    r.stdout,
  );
  assert.ok(
    rows.some((x) => x.includes(" — H11: ")),
    r.stdout,
  );
  assert.ok(!r.stdout.includes("zq") && !r.stderr.includes("zq"));
  assert.equal(sai.tree(), before);
  assert.ok(!fs.existsSync(path.join(sai.root, "handoffs")));
});

test("HO-27 handoffs or handoffs/<RUN-ID> is a link or a plain file: code 2 E_HO_IO, nothing is made and the target of a link stays empty", (t) => {
  const cases = [
    ["handoffs is a file", (s) => s.write("handoffs", "x\n")],
    [
      "handoffs is a link",
      (s) => {
        fs.mkdirSync(path.join(s.dir, "elsewhere"));
        fs.symlinkSync(
          path.join(s.dir, "elsewhere"),
          path.join(s.root, "handoffs"),
        );
      },
    ],
    [
      "the folder of the run is a link",
      (s) => {
        fs.mkdirSync(path.join(s.dir, "elsewhere"));
        fs.mkdirSync(path.join(s.root, "handoffs"));
        fs.symlinkSync(
          path.join(s.dir, "elsewhere"),
          path.join(s.root, "handoffs", FAKE_RUN),
        );
      },
    ],
    [
      "the folder of the run is a file",
      (s) => {
        fs.mkdirSync(path.join(s.root, "handoffs"));
        fs.writeFileSync(path.join(s.root, "handoffs", FAKE_RUN), "x\n");
      },
    ],
  ];
  for (const [name, setup] of cases) {
    const sai = newCmdRepo(t);
    sai.tag(baseTag(FAKE_RUN));
    setup(sai);
    const before = sai.tree();
    const r = sai.cmd(canonArgs());
    const line = assertRefusal(r, 2, "E_HO_IO");
    assert.ok(!line.includes(sai.dir), `${name}: ${line}`);
    assert.equal(sai.tree(), before, name);
    const elsewhere = path.join(sai.dir, "elsewhere");
    if (fs.existsSync(elsewhere))
      assert.deepEqual(fs.readdirSync(elsewhere), [], name);
  }
});

test("HO-28 the second call with the same identifier of a run but another step is not a repeat: both files stay", (t) => {
  const sai = withFile(t);
  const r = sai.cmd(canonArgs({ step: "06" }));
  assert.equal(r.status, 0, describe(r));
  assert.ok(fs.existsSync(path.join(sai.root, FAKE_REL)));
  assert.equal(
    sai.json(
      `handoffs/${FAKE_RUN}/step-06-test-design-validator-req999-r1.json`,
    ).handoff_id,
    FAKE_ID.replace("step05b", "step06"),
  );
});
