// REQ-014, criteria 1 and 2: the command finds the traces, the file of hashes and its
// lock, the exceptions, the open list, the names in paths (design REQ-014, 14.1: TC-1 -
// TC-23). Every case has its own temporary git repository. "Zqxwvorg" is a made-up
// name; the paths of home folders are put together from parts.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { addNames } from "../src/traces/add.js";
import { TraceError } from "../src/traces/lists.js";
import { installFaults } from "./fault-inject.js";
import {
  CLI,
  EXCEPTIONS_REL,
  HASHES_HEADER,
  HASHES_REL,
  LABEL,
  LINUX,
  LINUX_ENC,
  LOCK_REL,
  MAC,
  MAC_ENC,
  TOOLS,
  assertLine,
  assertNoStack,
  deadPid,
  makeRepo,
  runCli,
  sha256,
} from "./fixtures/traces/helpers.js";

const NAME = "Zqxwvorg";

function add(repo, text) {
  const r = repo.run(["add"], { input: text });
  assert.equal(r.status, 0, r.stderr);
  return r;
}

// One file in a fresh repository, checked; `name` is added to the list first.
function checkOne(t, rel, content, { name } = {}) {
  const repo = makeRepo(t);
  if (name !== undefined) add(repo, `${name}\n`);
  repo.write(rel, content);
  return { repo, r: repo.run() };
}

function assertTrace(r, line) {
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assertLine(r.stdout, line);
}

function assertClean(r) {
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /, следов 0, /u);
}

function noName(...texts) {
  for (const text of texts) assert.ok(!text.toLowerCase().includes("zqxwvorg"));
}

test("TC-1 a macOS home path: code 1, file and line; tracked and untracked files", (t) => {
  const repo = makeRepo(
    t,
    {
      "notes.txt": `x\nsee ${MAC}anna/notes.md\n`,
      "new.txt": `${MAC}anna\n`,
    },
    { untracked: ["new.txt"] },
  );
  const r = repo.run();
  assertTrace(r, "notes.txt:2: путь домашнего каталога");
  assertLine(r.stdout, "new.txt:1: путь домашнего каталога");
  assert.ok(!r.stdout.includes("anna"));
  assert.ok(!r.stdout.includes(MAC));
});

test("TC-2 a Linux home path: code 1, file and line", (t) => {
  const { r } = checkOne(t, "b/x.txt", `a\nb\ncd ${LINUX}anna/x\n`);
  assertTrace(r, "b/x.txt:3: путь домашнего каталога");
});

test("TC-1b the encoded form of a home path", (t) => {
  for (const [content, expected] of [
    [`.claude/projects/${MAC_ENC}anna-work/x.jsonl\n`, 1],
    [`${LINUX_ENC}anna-x\n`, 1],
    [`"${MAC_ENC}a.b_c-d"\n`, 1],
    [`.claude/projects/${MAC_ENC}<имя>-work\n`, 0],
    [`x${LINUX_ENC}page-\n`, 0],
    [`${MAC_ENC}anna\n`, 0],
    [`${MAC_ENC}anna/x\n`, 0],
  ]) {
    const { r } = checkOne(t, "a.txt", content);
    assert.equal(r.status, expected, `${content}: ${r.stdout}`);
    if (expected === 1)
      assertLine(r.stdout, "a.txt:1: путь домашнего каталога");
  }
});

test("TC-3 a name added from stdin is found; TC-9 the name is nowhere in the file or the output", (t) => {
  const repo = makeRepo(t, { "a.txt": `one\nthe ${NAME} here\n` });
  assertClean(repo.run());
  const a = add(repo, `${NAME}\n`);
  assert.equal(a.stdout, "traces: добавлено хешей 1, уже были 0\n");
  const r = repo.run();
  assertTrace(r, "a.txt:2: название из списка");
  const file = repo.read(HASHES_REL).toString("utf8");
  assert.equal(file.split("\n")[0], HASHES_HEADER);
  assert.match(file, /\n[0-9a-f]{64}\n$/u);
  noName(file, a.stdout, a.stderr, r.stdout, r.stderr);
});

test("TC-4 the same name in another case", (t) => {
  const { r } = checkOne(t, "a.txt", `${NAME.toUpperCase()}\n`, { name: NAME });
  assertTrace(r, "a.txt:1: название из списка");
  const lower = checkOne(t, "a.txt", "zqxwvorg\n", {
    name: NAME.toUpperCase(),
  });
  assertTrace(lower.r, "a.txt:1: название из списка");
});

test("TC-5 a Markdown link beyond the root", (t) => {
  assertTrace(
    checkOne(t, "README.md", "[x](../x.md)\n").r,
    "README.md:1: ссылка за корень репозитория",
  );
  assertTrace(
    checkOne(t, "docs/a.md", "a\n[x](../../x.md)\n").r,
    "docs/a.md:2: ссылка за корень репозитория",
  );
  assertClean(checkOne(t, "docs/a.md", "[x](../x.md) [y](./b/c.md)\n").r);
});

test("TC-6 TC-7 the word rule: a/Zqxwvorg/b and zqxwvorg-api", (t) => {
  assertTrace(
    checkOne(t, "a.txt", "a/Zqxwvorg/b\n", { name: NAME }).r,
    "a.txt:1: название из списка",
  );
  assertTrace(
    checkOne(t, "a.txt", "x\nzqxwvorg-api\n", { name: NAME }).r,
    "a.txt:2: название из списка",
  );
  // A longer word is another word.
  assertClean(
    checkOne(t, "a.txt", "zqxwvorgapi zqxwvorg2\n", { name: NAME }).r,
  );
});

test("TC-8 a clean repository: code 0 and the summary line", (t) => {
  const repo = makeRepo(t, { "a.txt": "hello\n", "docs/b.md": "[t](a.md)\n" });
  const r = repo.run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "traces: файлов проверено 3, следов 0, пропущено 0\n");
  assert.equal(r.stderr, "");
});

test("TC-10 a placeholder in the place of the name is not a trace", (t) => {
  assertClean(
    checkOne(
      t,
      "a.txt",
      `${MAC}<имя>/x\n${LINUX}<имя>/y\n${MAC}\n${LINUX}$USER/x\ndata${LINUX}x\n`,
    ).r,
  );
});

test("TC-11 an exception works only for this line of this file", (t) => {
  const line = `path ${MAC}anna/x`;
  const repo = makeRepo(t, { "a.txt": `top\n${line}\n` });
  const h = repo.run(["hash-line", "--file", "a.txt", "--line", "2"]);
  assert.equal(h.status, 0, h.stderr);
  assert.equal(h.stdout, `${sha256(line)}\n`);
  repo.write(
    EXCEPTIONS_REL,
    `# header\n\na.txt\t${h.stdout.trim()}\tусловный путь из примера\n`,
  );
  const used = repo.run();
  assertClean(used);
  assert.ok(!used.stdout.includes("исключение не использовано"), used.stdout);
  // An exception recorded for another file does not hide the line here.
  const other = makeRepo(t, { "a.txt": `${line}\n` });
  other.write(EXCEPTIONS_REL, `b.txt\t${sha256(line)}\tпример\n`);
  assertTrace(other.run(), "a.txt:1: путь домашнего каталога");
  // The same line in another file.
  repo.write("b.txt", `${line}\n`);
  assertTrace(repo.run(), "b.txt:1: путь домашнего каталога");
  fs.rmSync(path.join(repo.root, "b.txt"));
  // The same line with one character changed: a trace, and the exception is unused.
  repo.write("a.txt", `top\n${line}y\n`);
  const r = repo.run();
  assertTrace(r, "a.txt:2: путь домашнего каталога");
  assertLine(
    r.stdout,
    `traces: исключение не использовано: ${EXCEPTIONS_REL}:3`,
  );
});

test("TC-11 an exception does not hide a name on the same line", (t) => {
  const line = `${NAME} ${MAC}anna/x`;
  const repo = makeRepo(t, { "a.txt": `${line}\n` });
  add(repo, `${NAME}\n`);
  repo.write(EXCEPTIONS_REL, `a.txt\t${sha256(line)}\tпример\n`);
  const r = repo.run();
  assert.equal(r.status, 1);
  assertLine(r.stdout, "a.txt:1: название из списка");
  assert.ok(!r.stdout.includes("путь домашнего каталога"));
});

test("TC-12 the open list outside the repository; without it the hashes alone", (t) => {
  const repo = makeRepo(t, { "a.txt": `a ${NAME} b\n` });
  const list = path.join(repo.dir, "list.txt");
  fs.writeFileSync(list, `# open list\n${NAME}\n`);
  const r = repo.run([], { env: { SAI_TRACE_LIST: list } });
  assertTrace(r, "a.txt:1: название из списка");
  assertLine(
    r.stdout,
    `traces: открытый список: sha256 ${sha256(fs.readFileSync(list))}, названий 1, совпадений названий 1`,
  );
  assert.ok(!r.stdout.includes(list) && !r.stderr.includes(list));
  noName(r.stdout, r.stderr);
  const plain = repo.run();
  assertClean(plain);
  assert.ok(!plain.stdout.includes("открытый список"));
});

test("TC-13 the open list inside the repository, empty, missing or bad: code 2, no path printed", (t) => {
  const repo = makeRepo(t, { "a.txt": "a\n" });
  const inside = repo.write("list.txt", `${NAME}\n`);
  const link = path.join(repo.dir, "link.txt");
  fs.symlinkSync(inside, link);
  const bad = path.join(repo.dir, "bad.txt");
  fs.writeFileSync(bad, `${NAME}\nAB ${NAME}\n`);
  for (const [value, code] of [
    [inside, "E_TRACE_LIST_INSIDE"],
    [path.join(repo.root, "not-yet.txt"), "E_TRACE_LIST_INSIDE"],
    [link, "E_TRACE_LIST_INSIDE"],
    ["", "E_TRACE_LIST"],
    [path.join(repo.dir, "missing.txt"), "E_TRACE_LIST"],
    [bad, "E_TRACE_LIST"],
  ]) {
    const r = repo.run([], { env: { SAI_TRACE_LIST: value } });
    assert.equal(r.status, 2, value);
    assert.match(r.stderr, new RegExp(`^traces: ${code}: `, "u"));
    assert.equal(r.stdout, "");
    assertNoStack(r.stderr);
    if (value !== "") assert.ok(!r.stderr.includes(value));
    noName(r.stderr);
  }
  const r = repo.run([], { env: { SAI_TRACE_LIST: bad } });
  assert.match(r.stderr, /строка 2: часть названия короче 3 знаков/u);
});

test("TC-14 add refuses a bad name, an empty input, a long or non-UTF-8 input: nothing written", (t) => {
  const repo = makeRepo(t);
  add(repo, `${NAME}\n`);
  const before = sha256(repo.read(HASHES_REL));
  for (const [input, reason] of [
    [`AB ${NAME}\n`, "строка 1: часть названия короче 3 знаков"],
    [`ok\n`, "строка 1: часть названия короче 3 знаков"],
    [`Qplm\nZqx wvo rgz\n`, "строка 2: больше двух слов"],
    ["# only a comment\n\n", "пустой ввод"],
    ["---\n", "строка 1: нет ни одного слова"],
    [`${"a".repeat(64 * 1024)}\n`, "ввод больше 64 КиБ"],
    [Buffer.from([0x51, 0x70, 0x6c, 0xff, 0x0a]), "ввод не в UTF-8"],
  ]) {
    const r = repo.run(["add"], { input });
    assert.equal(r.status, 2, reason);
    assert.match(r.stderr, /^traces: E_TRACE_NAME: /u);
    assert.ok(r.stderr.includes(reason), r.stderr);
    noName(r.stderr);
    assert.equal(sha256(repo.read(HASHES_REL)), before);
    assert.ok(!fs.existsSync(path.join(repo.root, LOCK_REL)));
  }
});

test("TC-15 add again with the same name: added 0, the file untouched", (t) => {
  const repo = makeRepo(t);
  add(repo, `${NAME}\n`);
  const abs = path.join(repo.root, HASHES_REL);
  const bytes = fs.readFileSync(abs);
  const mtime = fs.statSync(abs).mtimeMs;
  const r = add(repo, `${NAME.toLowerCase()}\n${NAME}\n`);
  assert.equal(r.stdout, "traces: добавлено хешей 0, уже были 1\n");
  assert.ok(fs.readFileSync(abs).equals(bytes));
  assert.equal(fs.statSync(abs).mtimeMs, mtime);
});

test("TC-16 a failed write of add: E_WRITE, the file the same, no lock, no leftovers", (t) => {
  const repo = makeRepo(t);
  add(repo, `${NAME}\n`);
  const abs = path.join(repo.root, HASHES_REL);
  const bytes = fs.readFileSync(abs);
  const tmp = path.join(
    repo.root,
    "tools/traces/.forbidden-names.sha256.sai-tmp",
  );
  const faults = installFaults([
    { fn: "renameSync", from: tmp, to: abs, effect: "throw", code: "EACCES" },
  ]);
  let result;
  try {
    result = addNames(repo.root, Buffer.from("Qplmzz\n"));
  } finally {
    faults.restore();
  }
  assert.deepEqual(faults.fired(), [true]);
  assert.deepEqual(result.issues.codes(), ["E_WRITE"]);
  assert.ok(fs.readFileSync(abs).equals(bytes));
  assert.deepEqual(fs.readdirSync(path.dirname(abs)).sort(), [
    "forbidden-names.sha256",
  ]);
});

test("TC-16 add creates the missing folders before the lock and removes them when the write fails", (t) => {
  const repo = makeRepo(t, { "a.txt": "a\n" }, { hashes: false });
  const traces = path.join(repo.root, "tools", "traces");
  const faults = installFaults([
    {
      fn: "renameSync",
      to: path.join(traces, "forbidden-names.sha256"),
      effect: "throw",
      code: "ENOSPC",
    },
  ]);
  let result;
  try {
    result = addNames(repo.root, Buffer.from(`${NAME}\n`));
  } finally {
    faults.restore();
  }
  assert.deepEqual(result.issues.codes(), ["E_WRITE"]);
  assert.ok(!fs.existsSync(path.join(repo.root, "tools")));
  // Without a fault the folders are created and stay.
  const r = add(repo, `${NAME}\n`);
  assert.equal(r.stdout, "traces: добавлено хешей 1, уже были 0\n");
  assert.deepEqual(fs.readdirSync(traces), ["forbidden-names.sha256"]);
});

test("TC-17 a pair is formed after the short words are dropped and across a line break", (t) => {
  const pair = `${NAME} Qplm`;
  assertTrace(
    checkOne(t, "a.txt", "x\nzqxwvorg a qplm\n", { name: pair }).r,
    "a.txt:2: название из списка",
  );
  assertTrace(
    checkOne(t, "a.txt", "zqxwvorg\nqplm\n", { name: pair }).r,
    "a.txt:1: название из списка",
  );
  assertClean(
    checkOne(t, "a.txt", "zqxwvorg word qplm\nqplm zqxwvorg\n", { name: pair })
      .r,
  );
  assertClean(checkOne(t, "a.txt", "zqxwvorg alone\n", { name: pair }).r);
});

// The path of the k-th file by the command of the README (sorted by bytes).
function pathByLabel(repo, k) {
  const r = spawnSync(
    "sh",
    [
      "-c",
      `git ls-files -z --cached --others --exclude-standard | LC_ALL=C sort -z | tr '\\0' '\\n' | sed -n '${k}p'`,
    ],
    { cwd: repo.root, env: repo.env, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.replace(/\n$/u, "");
}

function assertLabel(repo, r, rel) {
  const lines = r.stdout.split("\n").filter((l) => LABEL.test(l));
  assert.equal(lines.length, 1, r.stdout);
  const [, k, prefix] = LABEL.exec(lines[0]);
  const sorted = repo
    .lsFiles()
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  assert.equal(sorted[Number(k) - 1], rel);
  assert.equal(pathByLabel(repo, k), rel);
  assert.equal(sha256(Buffer.from(rel, "utf8")).slice(0, 12), prefix);
  noName(r.stdout, r.stderr);
  for (const shown of [rel, path.posix.basename(rel)])
    assert.ok(!r.stdout.includes(shown) && !r.stderr.includes(shown), shown);
  return lines[0].slice(0, lines[0].indexOf(">") + 1);
}

test("TC-18 a name in the path of a file: a label instead of the path", (t) => {
  for (const rel of ["docs/zqxwvorg-api.md", "a/Zqxwvorg/b.txt"]) {
    const repo = makeRepo(t, { "x.txt": "x\n", "z.txt": "z\n" });
    add(repo, `${NAME}\n`);
    repo.write(rel, "clean text\n");
    const r = repo.run();
    assert.equal(r.status, 1, r.stdout);
    assertLabel(repo, r, rel);
  }
  // A binary file: the label also on its line "skipped".
  const repo = makeRepo(t, { "x.txt": "x\n" });
  add(repo, `${NAME}\n`);
  repo.write("img/zqxwvorg.png", Buffer.from([0x89, 0x50, 0, 1, 2]));
  const r = repo.run();
  assert.equal(r.status, 1);
  const label = assertLabel(repo, r, "img/zqxwvorg.png");
  assertLine(r.stdout, `${label}: пропущен: двоичный файл`);
  // A trace in the text of such a file is shown with the label too.
  const both = makeRepo(t);
  add(both, `${NAME}\n`);
  both.write("docs/zqxwvorg-api.md", `ok\n${MAC}anna/x\n`);
  const rb = both.run();
  const lb = assertLabel(both, rb, "docs/zqxwvorg-api.md");
  assertLine(rb.stdout, `${lb}:2: путь домашнего каталога`);
  // A path without the name is printed as it is.
  assertClean(checkOne(t, "docs/notes.md", "clean\n", { name: NAME }).r);
});

test("TC-19 add with a busy lock: a live pid refuses, a dead pid is taken over", (t) => {
  const repo = makeRepo(t);
  const lock = path.join(repo.root, LOCK_REL);
  const before = repo.read(HASHES_REL);
  for (const text of [`${process.pid} 2026-10-09T00:00:00Z\n`, "garbage\n"]) {
    fs.writeFileSync(lock, text);
    const r = repo.run(["add"], { input: `${NAME}\n` });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^traces: E_TRACE_BUSY: идёт другое пополнение/u);
    assert.ok(repo.read(HASHES_REL).equals(before));
    assert.equal(fs.readFileSync(lock, "utf8"), text);
  }
  fs.writeFileSync(lock, `${deadPid()} 2026-10-09T00:00:00Z\n`);
  add(repo, `${NAME}\n`);
  assert.ok(!fs.existsSync(lock));
});

test("TC-19 the file of hashes changed between the two reads: E_TRACE_BUSY, the foreign bytes stay", (t) => {
  const repo = makeRepo(t);
  const abs = path.join(repo.root, HASHES_REL);
  const foreign = `${HASHES_HEADER}\n${"a".repeat(64)}\n`;
  const real = fs.readFileSync;
  let reads = 0;
  t.mock.method(fs, "readFileSync", function readFileSync(p, ...rest) {
    const out = real.call(fs, p, ...rest);
    if (String(p) === abs && ++reads === 1) fs.writeFileSync(abs, foreign);
    return out;
  });
  assert.throws(
    () => addNames(repo.root, Buffer.from(`${NAME}\n`)),
    (err) => err instanceof TraceError && err.code === "E_TRACE_BUSY",
  );
  t.mock.restoreAll();
  assert.equal(fs.readFileSync(abs, "utf8"), foreign);
  assert.ok(!fs.existsSync(path.join(repo.root, LOCK_REL)));
});

function addAsync(repo, input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, "add", "--root", repo.root], {
      cwd: TOOLS,
      env: repo.env,
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stderr }));
    child.stdin.end(input);
  });
}

test("TC-19 two add at once: each 0 or 2, after a retry no hash is lost", async (t) => {
  const repo = makeRepo(t);
  const inputs = ["Qplmaa\n", "Qplmbb\n", "Qplmcc\n", "Qplmdd\n"];
  const results = await Promise.all(inputs.map((i) => addAsync(repo, i)));
  for (const [i, r] of results.entries()) {
    assert.ok(r.status === 0 || r.status === 2, r.stderr);
    if (r.status === 2) {
      assert.match(r.stderr, /E_TRACE_BUSY/u);
      add(repo, inputs[i]);
    }
  }
  const lines = repo.read(HASHES_REL).toString("utf8").trim().split("\n");
  assert.equal(lines.length, 1 + inputs.length);
  assert.ok(!fs.existsSync(path.join(repo.root, LOCK_REL)));
});

test("TC-20 npm run check runs npm run traces before the tests", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(TOOLS, "package.json"), "utf8"),
  );
  assert.equal(pkg.scripts.traces, "node src/traces/cli.js");
  const steps = pkg.scripts.check.split("&&").map((s) => s.trim());
  assert.ok(!pkg.scripts.check.includes("||"));
  assert.ok(steps.includes("npm run traces"));
  assert.ok(steps.indexOf("npm run traces") < steps.indexOf("npm run test"));
});

test("TC-21 Unicode: NFC and NFD, full width, invisible characters", (t) => {
  const nfc = `${NAME}\u0439`;
  const nfd = `${NAME}\u0438\u0306`;
  assert.notEqual(nfc, nfd);
  assertTrace(
    checkOne(t, "a.txt", `${nfd}\n`, { name: nfc }).r,
    "a.txt:1: название из списка",
  );
  assertTrace(
    checkOne(t, "a.txt", `${nfc}\n`, { name: nfd }).r,
    "a.txt:1: название из списка",
  );
  const wide = String.fromCodePoint(
    ...[...NAME].map((c) => c.codePointAt(0) + 0xfee0),
  );
  assertTrace(
    checkOne(t, "a.txt", `${wide}\n`, { name: NAME }).r,
    "a.txt:1: название из списка",
  );
  for (const mark of ["\u200b", "\u00ad", "\ufeff", "\u200d", "\u2060"]) {
    const text = `x${mark}y\n\u200b\nZqx${mark}wvorg\n`;
    assertTrace(
      checkOne(t, "a.txt", text, { name: NAME }).r,
      "a.txt:3: название из списка",
    );
  }
});

test("TC-22 the Markdown links: forms of the address, code, escapes and %XX", (t) => {
  const out = "a.md:1: ссылка за корень репозитория";
  const fence4 = "````";
  for (const [text, expected] of [
    ['[t](../x.md "title")', 1],
    ["[t](<../a b.md>)", 1],
    ["[t](../x_(1).md)", 1],
    ["![i](../i.png)", 1],
    ["[![i](a.png)](../x.md)", 1],
    ["[r]: ../x.md", 1],
    ['[r]: ../x.md "t"', 1],
    ["[t][r]\n\n[r]: docs/x.md", 0],
    ["<https://example.invalid/x>", 0],
    ["[t](mailto:a@example.invalid)", 0],
    ["[t](http://example.invalid/../x)", 0],
    ["[t](#x)", 0],
    ["[t](x.md#../../y)", 0],
    ["`` [t](../x.md) ``", 0],
    ["\\[t](../x.md)", 0],
    ["[t] (../x.md)", 0],
    ["[t](%2E%2E/x.md)", 1],
    ["[t](~/x.md)", 1],
    ["[t](/x.md)", 1],
    ["[x](..)", 1],
    ["[x](../)", 1],
  ]) {
    const { r } = checkOne(t, "a.md", `${text}\n`);
    assert.equal(r.status, expected, `${text}: ${r.stdout}`);
    if (expected === 1) assertLine(r.stdout, out);
  }
  // A fence of four backticks with three inside; after it a link counts again.
  const fenced = `${fence4}\n\`\`\`\n[t](../x.md)\n\`\`\`\n${fence4}\n[t](../x.md)\n`;
  const { r } = checkOne(t, "a.md", fenced);
  assert.equal(r.status, 1);
  assert.deepEqual(
    r.stdout.split("\n").filter((l) => l.startsWith("a.md")),
    ["a.md:6: ссылка за корень репозитория"],
  );
  assertClean(checkOne(t, "a.md", "~~~\n[t](../x.md)\n").r);
  // The same text in a file that is not Markdown is not a link.
  assertClean(checkOne(t, "a.txt", "[t](../x.md)\n").r);
  // A broken %XX: a note, not a trace, no stack.
  for (const bad of ["[t](../%E0%A4%A.md)", "[t](%ZZ)", "[t](%C3%28)"]) {
    const { r: rb } = checkOne(t, "a.md", `x\n${bad}\n`);
    assert.equal(rb.status, 0, rb.stdout + rb.stderr);
    assertLine(rb.stdout, "a.md:2: ссылка не разобрана (негодный %XX)");
    assert.equal(rb.stderr, "");
  }
});

test("TC-23 hash-line prints only the hash of the line; a path with a name is refused", (t) => {
  const repo = makeRepo(t, { "a.txt": "one\r\ntwo секрет\nthree" });
  const r = repo.run(["hash-line", "--file", "a.txt", "--line", "2"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, `${sha256("two секрет")}\n`);
  assert.match(r.stdout, /^[0-9a-f]{64}\n$/u);
  const crlf = repo.run(["hash-line", "--file", "a.txt", "--line", "1"]);
  assert.equal(crlf.stdout, `${sha256("one")}\n`);
  const last = repo.run(["hash-line", "--file", "a.txt", "--line", "3"]);
  assert.equal(last.stdout, `${sha256("three")}\n`);
  for (const args of [
    ["--file", "a.txt", "--line", "4"],
    ["--file", "a.txt", "--line", "0"],
    ["--file", "a.txt", "--line", "x"],
    ["--file", "missing.txt", "--line", "1"],
    ["--file", "../a.txt", "--line", "1"],
    ["--file", "a.txt"],
  ]) {
    const e = repo.run(["hash-line", ...args]);
    assert.equal(e.status, 2, args.join(" "));
    assert.match(e.stderr, /^traces: E_TRACE_USAGE: /u);
    assert.equal(e.stdout, "");
  }
  repo.write("b.bin", Buffer.from([1, 0, 2]));
  assert.equal(
    repo.run(["hash-line", "--file", "b.bin", "--line", "1"]).status,
    2,
  );
  add(repo, `${NAME}\n`);
  repo.write("docs/zqxwvorg-api.md", "x\n");
  const named = repo.run([
    "hash-line",
    "--file",
    "docs/zqxwvorg-api.md",
    "--line",
    "1",
  ]);
  assert.equal(named.status, 2);
  assert.match(named.stderr, /в пути файла название из списка/u);
  assert.equal(named.stdout, "");
});

test("usage: --help is 0; an unknown subcommand or option is 2, one line with a hint", (t) => {
  const repo = makeRepo(t);
  const help = repo.run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^Использование: npm run traces/u);
  for (const args of [
    ["nope"],
    ["--nope", "1"],
    ["check", "--file", "x"],
    ["check", "extra"],
  ]) {
    const r = repo.run(args);
    assert.equal(r.status, 2, args.join(" "));
    assert.match(r.stderr, /^traces: E_TRACE_USAGE: .*--help\n$/u);
  }
  const noValue = runCli(["check", "--root"], {
    env: repo.env,
    cwd: repo.root,
  });
  assert.equal(noValue.status, 2);
  assert.match(
    noValue.stderr,
    /^traces: E_TRACE_USAGE: у ключа --root нет значения/u,
  );
});

test("TC-24 names inherited from Object.prototype are unknown subcommands and keys", (t) => {
  const repo = makeRepo(t, { "a.txt": "a\n" });
  for (const args of [
    ["toString"],
    ["constructor"],
    ["__proto__"],
    ["hasOwnProperty"],
    ["valueOf"],
    ["nope"],
    ["--toString", "x"],
    ["check", "--constructor", "x"],
    ["hash-line", "--__proto__", "x"],
  ]) {
    const r = repo.run(args);
    assert.equal(r.status, 2, args.join(" "));
    const lines = r.stderr.split("\n").filter((l) => l !== "");
    assert.equal(lines.length, 1, r.stderr);
    assert.match(lines[0], /^traces: E_TRACE_USAGE: /u);
    assertNoStack(r.stderr);
    assert.equal(r.stdout, "");
  }
});

test("TC-25 the label number follows the UTF-8 byte order, not UTF-16", (t) => {
  const repo = makeRepo(t);
  add(repo, `${NAME}\n`);
  // U+1F600 is F0 9F 98 80 in UTF-8 (after U+FF21, EF BC A1) but D83D in UTF-16 (before FF21).
  const outside = "zqxwvorg-\u{1F600}.txt";
  const inside = "zqxwvorg-\uFF21.txt";
  repo.write(outside, "x\n");
  repo.write(inside, "y\n");
  const r = repo.run();
  assert.equal(r.status, 1, r.stdout);
  const labels = r.stdout.split("\n").filter((l) => LABEL.test(l));
  assert.equal(labels.length, 2, r.stdout);
  const byPrefix = new Map(
    labels.map((l) => {
      const [, k, prefix] = LABEL.exec(l);
      return [prefix, Number(k)];
    }),
  );
  for (const rel of [outside, inside]) {
    const k = byPrefix.get(sha256(Buffer.from(rel, "utf8")).slice(0, 12));
    assert.ok(k !== undefined, rel);
    assert.equal(pathByLabel(repo, k), rel);
  }
  assert.ok(
    byPrefix.get(sha256(Buffer.from(outside)).slice(0, 12)) >
      byPrefix.get(sha256(Buffer.from(inside)).slice(0, 12)),
  );
});
