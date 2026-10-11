// REQ-038, criteria 4, 5 and 6: what the code of tools/src/handoffs/ may contain
// (design 12, HC-RT-1, HC-4f, HC-4g, HC-8k). HC-RT-1 repeats for the new module the
// checks of TR-4c of traces: git is run in git-history.js and nowhere else, without a
// command interpreter, with the fixed lists of arguments.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { TOOLS, newSai, doc, REL, T } from "./handoffs-helpers.js";

const SRC = path.join(TOOLS, "src");
const DIR = path.join(SRC, "handoffs");

function moduleFiles() {
  return fs
    .readdirSync(DIR)
    .filter((n) => n.endsWith(".js"))
    .sort();
}

const readModule = (name) => fs.readFileSync(path.join(DIR, name), "utf8");

// The arguments of a call starting at `open` (the index of "("), split at the top level.
function callArgs(body, open) {
  const args = [];
  let depth = 0;
  let quote = null;
  let start = open + 1;
  for (let i = open; i < body.length; i++) {
    const c = body[i];
    if (quote !== null) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) {
        const last = body.slice(start, i).trim();
        if (last !== "") args.push(last);
        return args;
      }
    } else if (c === "," && depth === 1) {
      args.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  throw new Error("unclosed call");
}

// An array literal of string literals and the two allowed names: `sha` (the checked hash
// of a commit), alone or followed by a string literal: `sha + "^{commit}"`, and `ref`
// (the name of the tag base/<RUN-ID>, built in tagExists from a checked RUN-ID).
function arrayItems(literal) {
  assert.match(literal, /^\[[\s\S]*\]$/u, literal);
  return callArgs(`(${literal.slice(1, -1)})`, 0).map((item) => {
    const plain = /^"([^"\\]*)"$/u.exec(item);
    if (plain !== null) return plain[1];
    if (item === "sha") return "<коммит>";
    if (item === "ref") return "<метка>";
    const joined = /^sha\s*\+\s*"([^"\\]*)"$/u.exec(item);
    assert.ok(joined !== null, `not a literal: ${item}`);
    return `<коммит>${joined[1]}`;
  });
}

const GIT = ["-c", "core.fsmonitor=false"];
const EXPECTED_CALLS = [
  [...GIT, "rev-parse", "--is-shallow-repository"],
  [...GIT, "rev-parse", "--verify", "--quiet", "<коммит>^{commit}"],
  [...GIT, "merge-base", "--is-ancestor", "<коммит>", "HEAD"],
  [
    ...GIT,
    "-c",
    "core.quotePath=false",
    "log",
    "--reverse",
    "--no-renames",
    "-z",
    "--format=%x01%H %cI",
    "--name-only",
    "HEAD",
    "--",
    "handoffs",
  ],
  [...GIT, "rev-parse", "--verify", "--quiet", "<метка>"],
  [...GIT, "cat-file", "--batch"],
];

const FORBIDDEN_IN_GIT_FILE =
  /shell|\bexec\(|execSync|spawn|fork|execFile\(|require\(/u;
const FORBIDDEN_ELSEWHERE =
  /child_process|execFileSync|execSync|spawn|\bshell\b|\bfork\(|\brequire\(|\bimport\(/u;

// All the checks of HC-RT-1 on a set of files { name: source }; returns what was found,
// so that the test can also be run on sources that must be refused.
function findings(files, gitFile = "git-history.js") {
  const out = [];
  const withProcess = Object.keys(files)
    .filter((n) => /child_process/u.test(files[n]))
    .sort();
  if (JSON.stringify(withProcess) !== JSON.stringify([gitFile]))
    out.push(`child_process in: ${withProcess.join(", ")}`);
  for (const [name, body] of Object.entries(files))
    if (name !== gitFile && FORBIDDEN_ELSEWHERE.test(body))
      out.push(`forbidden form in ${name}`);
  const body = files[gitFile] ?? "";
  const imports = [
    ...body.matchAll(
      /import\s+([^;]*?)\s+from\s+["'](?:node:)?child_process["']/gu,
    ),
  ];
  if (imports.length !== 1) out.push(`imports: ${imports.length}`);
  else if (imports[0][1].replace(/\s+/gu, " ") !== "{ execFileSync }")
    out.push(`import of ${imports[0][1]}`);
  if (FORBIDDEN_IN_GIT_FILE.test(body))
    out.push("forbidden form in the git file");
  // tagExists (REQ-039, decisions/0040): the name of the tag is built from a RUN-ID that
  // was checked by the pattern before; a name that was not checked never reaches git.
  const refAt = body.search(
    /const ref = "refs\/tags\/base\/" \+ runId \+ "\^\{commit\}";/u,
  );
  const guardAt = body.search(/!RUN_ID\.test\(runId\)/u);
  if (refAt < 0) out.push("tagExists: the tag name is not built from runId");
  else if (guardAt < 0 || guardAt > refAt)
    out.push("tagExists: runId is not checked before the call");
  const calls = [...body.matchAll(/execFileSync\(/gu)].map((m) => ({
    args: callArgs(body, m.index + "execFileSync".length),
    at: m.index,
  }));
  if (calls.length !== EXPECTED_CALLS.length)
    out.push(`calls: ${calls.length}`);
  calls.forEach(({ args }, i) => {
    if (args[0] !== '"git"')
      out.push(`call ${i + 1} does not start with "git"`);
    let items;
    try {
      items = arrayItems(args[1] ?? "");
    } catch (err) {
      out.push(`call ${i + 1}: ${err.message}`);
      return;
    }
    if (JSON.stringify(items) !== JSON.stringify(EXPECTED_CALLS[i]))
      out.push(`call ${i + 1}: ${JSON.stringify(items)}`);
    const options = args[2] ?? "";
    const last = i === EXPECTED_CALLS.length - 1;
    if (!/stdio:\s*\["(pipe|ignore)"/u.test(options))
      out.push(`call ${i + 1}: no stdio`);
    else if (last !== /stdio:\s*\["pipe"/u.test(options))
      out.push(`call ${i + 1}: stdin`);
    if (last !== /\binput:/u.test(options)) out.push(`call ${i + 1}: input`);
    if (!/\btimeout:/u.test(options)) out.push(`call ${i + 1}: no timeout`);
    if (!/\bcwd:/u.test(options)) out.push(`call ${i + 1}: no cwd`);
  });
  return out;
}

function currentFiles() {
  return Object.fromEntries(moduleFiles().map((n) => [n, readModule(n)]));
}

test("HC-RT-1a the files of tools/src/handoffs/ with the word child_process are exactly [git-history.js]", () => {
  const names = moduleFiles();
  assert.ok(names.length >= 7, names.join(","));
  const found = names.filter((n) => /child_process/u.test(readModule(n)));
  assert.deepEqual(found, ["git-history.js"]);
  // No folder inside hides another file.
  for (const e of fs.readdirSync(DIR, { withFileTypes: true }))
    assert.ok(e.isFile(), e.name);
});

test("HC-RT-1b git-history.js has one import { execFileSync } and none of shell, exec(, execSync, spawn, fork, execFile(, require(", () => {
  assert.deepEqual(findings(currentFiles()), []);
});

test('HC-RT-1c every call of execFileSync starts with "git" and the lists of arguments are the recorded ones', () => {
  const body = readModule("git-history.js");
  const calls = [...body.matchAll(/execFileSync\(/gu)].map((m) =>
    callArgs(body, m.index + "execFileSync".length),
  );
  assert.equal(calls.length, 6);
  for (const args of calls) assert.equal(args[0], '"git"');
  assert.deepEqual(
    calls.map((args) => arrayItems(args[1])),
    EXPECTED_CALLS,
  );
  // The call that feeds git through its standard input: input is set, stdin is a pipe.
  assert.match(calls[5][2], /\binput:/u);
  assert.match(calls[5][2], /stdio:\s*\["pipe"/u);
  for (const args of calls.slice(0, 5))
    assert.match(args[2], /stdio:\s*\["ignore"/u);
  for (const args of calls) {
    assert.match(args[2], /\btimeout:/u);
    assert.match(args[2], /\bcwd:\s*root/u);
  }
});

test("HC-RT-1d the check itself refuses what it is meant to refuse (the mutants of the requirement)", () => {
  const files = currentFiles();
  const with_ = (name, body) => ({ ...files, [name]: body });
  const git = files["git-history.js"];
  const refused = [
    [
      "child_process in another file",
      with_("rules.js", `${files["rules.js"]}\n// child_process\n`),
    ],
    [
      "a second import in another file",
      with_(
        "times.js",
        `import { execFileSync } from "node:child_process";\n${files["times.js"]}`,
      ),
    ],
    [
      "shell: true",
      with_(
        "git-history.js",
        git.replace("cwd: root,", "cwd: root,\n shell: true,"),
      ),
    ],
    ["execSync", with_("git-history.js", `${git}\nexecSync("git");\n`)],
    ["spawn", with_("git-history.js", `${git}\n// spawn\n`)],
    ["require(", with_("git-history.js", `${git}\nrequire("x");\n`)],
    [
      "a changed list of arguments",
      with_(
        "git-history.js",
        git.replace(
          '"--is-shallow-repository"',
          '"--is-shallow-repository", "--x"',
        ),
      ),
    ],
    [
      "no fsmonitor",
      with_(
        "git-history.js",
        git.replace(
          /"core\.fsmonitor=false",\s*"rev-parse",\s*"--verify"/u,
          '"rev-parse", "--verify"',
        ),
      ),
    ],
    [
      "a call not starting with git",
      with_(
        "git-history.js",
        git.replace(
          /"git",(\s*\[\s*"-c",\s*"core\.fsmonitor=false",\s*"merge-base")/u,
          '"/usr/bin/git",$1',
        ),
      ),
    ],
    [
      "a seventh call",
      with_(
        "git-history.js",
        `${git}\nexecFileSync("git", ["status"], { cwd: "." });\n`,
      ),
    ],
    [
      "tagExists without --quiet",
      with_(
        "git-history.js",
        git.replace('"--verify", "--quiet", ref', '"--verify", ref'),
      ),
    ],
    [
      "tagExists without the check of RUN-ID",
      with_(
        "git-history.js",
        git.replace(
          'typeof runId !== "string" || !RUN_ID.test(runId)',
          "false",
        ),
      ),
    ],
    [
      "tagExists with a tag name built from the raw argument",
      with_(
        "git-history.js",
        git.replace(
          '"refs/tags/base/" + runId + "^{commit}"',
          '"refs/tags/base/" + String(runId)',
        ),
      ),
    ],
    [
      "stdin ignored for cat-file",
      with_(
        "git-history.js",
        git.replace(
          'stdio: ["pipe", "pipe", "pipe"]',
          'stdio: ["ignore", "pipe", "pipe"]',
        ),
      ),
    ],
    [
      "no input for cat-file",
      with_(
        "git-history.js",
        git.replace(/input: Buffer\.from\([^\n]*\),\n/u, ""),
      ),
    ],
    [
      "a second import",
      with_(
        "git-history.js",
        `import { execSync } from "node:child_process";\n${git}`,
      ),
    ],
    [
      "no word child_process in the git file",
      with_(
        "git-history.js",
        git.replace(
          /import \{ execFileSync \} from "node:child_process";\n/u,
          "",
        ),
      ),
    ],
  ];
  for (const [name, mutated] of refused) {
    assert.notDeepEqual(mutated, files, name);
    assert.notEqual(
      JSON.stringify(findings(mutated)),
      "[]",
      `not refused: ${name}`,
    );
  }
  assert.deepEqual(findings(files), []);
});

test("HC-RT-1e TR-4c with the added line passes: node --test test/traces-runtime.test.js is code 0", () => {
  // The runner of tests inside a test reports to its parent unless this is dropped.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(
    process.execPath,
    ["--test", "test/traces-runtime.test.js"],
    { cwd: TOOLS, env, encoding: "utf8", timeout: 120_000 },
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /# fail 0/u);
});

test("HC-4f the command calls hasHomePath and readExceptions of traces and has no rule or reading of its own for home folders", () => {
  const files = currentFiles();
  const all = Object.values(files).join("\n");
  assert.match(all, /\bhasHomePath\b/u);
  assert.match(all, /\breadExceptions\b/u);
  const own = new RegExp(`${"Us"}ers|/${"ho"}me|traces/exceptions`, "u");
  for (const [name, body] of Object.entries(files))
    assert.doesNotMatch(body, own, name);
  // The imports come from traces.
  assert.match(
    files["check.js"],
    /import \{[^}]*readExceptions[^}]*\} from "\.\.\/traces\/lists\.js"/u,
  );
  assert.match(
    files["rules.js"],
    /import \{[^}]*hasHomePath[^}]*\} from "\.\.\/traces\/rules\.js"/u,
  );
});

test("HC-4g hasTempPath is a function exported by traces/rules.js and is not defined again in the module", async () => {
  const rules = await import("../src/traces/rules.js");
  assert.equal(typeof rules.hasTempPath, "function");
  assert.equal(typeof rules.hasHomePath, "function");
  const own = Object.values(currentFiles()).join("\n");
  assert.doesNotMatch(own, /function hasTempPath|const hasTempPath/u);
  assert.match(own, /\bhasTempPath\b/u);
  assert.match(
    fs.readFileSync(path.join(SRC, "traces", "rules.js"), "utf8"),
    /export function hasTempPath\(/u,
  );
});

test("HC-5c npm run traces does not apply H11: a path of a temporary folder in a file does not make traces red", (t) => {
  const sai = newSai(t);
  sai.writeDoc(REL, doc(REL, { task: { note: "cd /tmp/zqwork" } }));
  sai.write("docs/x.md", "see /tmp/zqwork/x\n");
  sai.commit(T("06:00:00"));
  const before = sai.tree();
  const r = spawnSync(
    process.execPath,
    [path.join(TOOLS, "src", "traces", "cli.js"), "--root", sai.root],
    { cwd: TOOLS, env: sai.env, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(sai.tree(), before);
});

// The four texts of failures of git, copied from traces/git-files.js (which does not
// export them) into git-history.js.
const FAILURE_TEXTS = [
  "git не найден",
  "git не ответил за 30 с",
  "это не git-репозиторий: команда проверяет файлы, которые отслеживает git; запустите её в клоне Sai",
  "git не смог выполнить команду (код ",
];

test("HC-8k the four texts of failures of git in git-history.js are the strings of traces/git-files.js", () => {
  const theirs = fs.readFileSync(
    path.join(SRC, "traces", "git-files.js"),
    "utf8",
  );
  const ours = readModule("git-history.js");
  for (const s of FAILURE_TEXTS) {
    assert.ok(theirs.includes(s), `traces/git-files.js lacks: ${s}`);
    assert.ok(ours.includes(s), `git-history.js lacks: ${s}`);
  }
  // The codes with which they are raised are the same too.
  for (const code of ["E_TRACE_GIT", "E_TRACE_NOT_GIT"]) {
    assert.ok(theirs.includes(code) && ours.includes(code), code);
  }
});
