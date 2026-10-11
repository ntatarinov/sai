// REQ-039, criterion 5 (design 10, HO-35, HO-35b, HO-36, HO-75): the refusals of close.
// For every refusal the file and the tree of the repository are byte for byte as they
// were, there is no `.sai-tmp` and no `.sai-old`, stderr is one line `handoff: CODE: ...`
// without a stack, and stdout is empty except for the lines of violations of REQ-038.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { closeHandoff } from "../src/handoffs/close.js";
import { HandoffError } from "../src/handoffs/errors.js";
import {
  FAKE_RUN,
  assertRefusal,
  describe,
  fileHashes,
  listTree,
  newCmdRepo,
  newSai,
  runCli,
} from "./handoffs-helpers.js";

const DIR = `handoffs/${FAKE_RUN}`;
const PAST = "2026-10-11T10:00:00Z";
const stamp = (offsetSeconds) =>
  new Date(Date.now() + offsetSeconds * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/u, "Z");

// A closable handoff document; `over` replaces fields (undefined drops one).
function file(over = {}) {
  const d = {
    handoff_id: "step01-x",
    run_id: FAKE_RUN,
    workflow_id: "WF-01",
    step: "01",
    from_agent: "ORCH",
    to_agent: "BACKEND-DEV",
    file: `${DIR}/f.json`,
    status: "IN_PROGRESS",
    context: { requirement_ids: [] },
    task: { description: "t" },
    created_at: PAST,
    started_at: PAST,
    completed_at: null,
    result: { status: "COMPLETED", summary: "s" },
    ...over,
  };
  return `${JSON.stringify(d, null, 2)}\n`;
}

const BOM = String.fromCharCode(0xfeff);

// [name, how to prepare (returns the args of close after "close") or null for the file
// f.json with `text`, exit, code, part of the line]
const CASES = [
  [
    "completed_at is already written",
    { text: file({ completed_at: PAST }) },
    1,
    "E_HO_STATE",
    "completed_at уже записан",
  ],
  [
    "result is null",
    { text: file({ result: null }) },
    1,
    "E_HO_STATE",
    "result не объект",
  ],
  [
    "result is a list",
    { text: file({ result: [] }) },
    1,
    "E_HO_STATE",
    "result не объект",
  ],
  [
    "result.status is FAILED, --status COMPLETED",
    { text: file({ result: { status: "FAILED" } }) },
    1,
    "E_HO_STATE",
    "result.status (FAILED) не равен --status (COMPLETED)",
  ],
  [
    "the status is already COMPLETED",
    { text: file({ status: "COMPLETED" }) },
    1,
    "E_HO_STATE",
    "status сейчас COMPLETED",
  ],
  [
    "the status is already FAILED",
    { text: file({ status: "FAILED" }) },
    1,
    "E_HO_STATE",
    "status сейчас FAILED",
  ],
  [
    "the status is CANCELLED",
    { text: file({ status: "CANCELLED" }) },
    1,
    "E_HO_STATE",
    "status сейчас CANCELLED",
  ],
  [
    "a status that is not a word",
    { text: file({ status: "x y" }) },
    1,
    "E_HO_STATE",
    "значение не из списка",
  ],
  [
    "a stop: status and result.status are IN_PROGRESS",
    { text: file({ result: { status: "IN_PROGRESS", issues: [] } }) },
    1,
    "E_HO_STATE",
    "это остановка",
  ],
  [
    "--status DONE",
    { text: file(), args: ["--status", "DONE"] },
    2,
    "E_HO_USAGE",
    "допустимы COMPLETED и FAILED",
  ],
  ["no --status", { text: file(), args: [] }, 2, "E_HO_USAGE", "--status"],
  [
    "two paths",
    { text: file(), args: ["--status", "COMPLETED", `${DIR}/g.json`] },
    2,
    "E_HO_USAGE",
    "ровно один путь",
  ],
  [
    "no path",
    { text: file(), noPath: true },
    2,
    "E_HO_USAGE",
    "ровно один путь",
  ],
  [
    "a path with ..",
    { text: file(), path: `${DIR}/../x.json` },
    1,
    "E_HO_PATH",
    "путь:",
  ],
  [
    "an absolute path",
    { text: file(), path: "ABS" },
    1,
    "E_HO_PATH",
    "абсолютный",
  ],
  [
    "a path outside of handoffs/",
    { text: file(), path: "docs/x.json" },
    1,
    "E_HO_PATH",
    "handoffs/",
  ],
  [
    "a path that starts with ./",
    { text: file(), path: `./${DIR}/f.json` },
    1,
    "E_HO_PATH",
    "путь:",
  ],
  [
    "a path without .json",
    { text: file(), path: `${DIR}/f.txt` },
    1,
    "E_HO_PATH",
    "путь:",
  ],
  [
    "a path with a control character",
    { text: file(), path: `${DIR}/f\n.json` },
    1,
    "E_HO_PATH",
    "управляющий",
  ],
  [
    "a path with a backslash",
    { text: file(), path: `${DIR}\\f.json` },
    1,
    "E_HO_PATH",
    "обратная",
  ],
  ["an empty path", { text: file(), path: "" }, 1, "E_HO_PATH", "пустой"],
  [
    "a double slash",
    { text: file(), path: `${DIR}//f.json` },
    1,
    "E_HO_PATH",
    "путь:",
  ],
  [
    "a folder instead of a file",
    {
      text: file(),
      path: `${DIR}/dir.json`,
      before: (s) => fs.mkdirSync(path.join(s.root, DIR, "dir.json")),
    },
    1,
    "E_HO_PATH",
    "не обычный файл",
  ],
  [
    "a link to a file outside of the root",
    {
      text: file(),
      path: `${DIR}/link.json`,
      before: (s) => {
        fs.writeFileSync(path.join(s.dir, "outside.json"), file());
        fs.symlinkSync(
          path.join(s.dir, "outside.json"),
          path.join(s.root, DIR, "link.json"),
        );
      },
    },
    1,
    "E_HO_PATH",
    "ссылка",
  ],
  [
    "a link to a file inside of the root",
    {
      text: file(),
      path: `${DIR}/link.json`,
      before: (s) =>
        fs.symlinkSync("f.json", path.join(s.root, DIR, "link.json")),
    },
    1,
    "E_HO_PATH",
    "ссылка",
  ],
  [
    "the folder of the run is a link",
    {
      text: file(),
      path: "handoffs/LINKED/f.json",
      before: (s) => {
        fs.symlinkSync(
          path.join(s.root, DIR),
          path.join(s.root, "handoffs", "LINKED"),
        );
      },
    },
    1,
    "E_HO_PATH",
    "ссылка",
  ],
  [
    "no such file",
    { text: file(), path: `${DIR}/none.json` },
    1,
    "E_HO_FILE",
    "файла нет",
  ],
  ["not JSON", { text: '{"status": ' }, 1, "E_HO_FILE", "не читается как JSON"],
  ["an empty file", { text: "" }, 1, "E_HO_FILE", "файл пуст"],
  [
    "a file with a BOM",
    { text: BOM + file() },
    1,
    "E_HO_FILE",
    "E_HO_FILE_ANY",
  ],
  [
    "a binary file",
    { bytes: Buffer.from([0x7b, 0x00, 0x7d]) },
    1,
    "E_HO_FILE",
    "E_HO_FILE_ANY",
  ],
  [
    "not UTF-8",
    { bytes: Buffer.from([0x7b, 0xff, 0xfe, 0x7d]) },
    1,
    "E_HO_FILE",
    "E_HO_FILE_ANY",
  ],
  [
    "a file larger than 16 MiB",
    { bytes: Buffer.alloc(16 * 1024 * 1024 + 1, 0x20) },
    1,
    "E_HO_FILE",
    "16 МиБ",
  ],
  [
    "the top level is a list",
    { text: "[]\n" },
    1,
    "E_HO_FILE",
    "не читается как JSON",
  ],
  [
    "the top level is null",
    { text: "null\n" },
    1,
    "E_HO_FILE",
    "не читается как JSON",
  ],
  [
    "the top level is a number",
    { text: "42\n" },
    1,
    "E_HO_FILE",
    "не читается как JSON",
  ],
  [
    "the top level is a string",
    { text: '"s"\n' },
    1,
    "E_HO_FILE",
    "не читается как JSON",
  ],
  [
    "nesting deeper than the limit",
    { text: `{"a":${"[".repeat(300)}${"]".repeat(300)}}\n` },
    1,
    "E_HO_FILE",
    "не читается как JSON",
  ],
  [
    "status repeated on the top level",
    {
      text: file().replace(
        '"status": "IN_PROGRESS",',
        '"status": "IN_PROGRESS",\n  "status": "PENDING",',
      ),
    },
    1,
    "E_HO_FILE",
    "повторён",
  ],
  [
    "completed_at repeated on the top level",
    {
      text: file().replace(
        '"completed_at": null,',
        '"completed_at": null,\n  "completed_at": null,',
      ),
    },
    1,
    "E_HO_FILE",
    "повторён",
  ],
  [
    "started_at is later than the clock",
    { text: file({ started_at: "2099-01-01T00:00:00Z" }) },
    1,
    "E_HO_CLOCK",
    "started_at позже часов",
  ],
  [
    "a leftover .sai-tmp",
    {
      text: file(),
      before: (s) => s.write(`${DIR}/.f.json.sai-tmp`, "held\n"),
    },
    1,
    "E_HO_BUSY",
    ".f.json.sai-tmp",
  ],
  [
    "a leftover .sai-old",
    {
      text: file(),
      before: (s) => s.write(`${DIR}/.f.json.sai-old`, "held\n"),
    },
    1,
    "E_HO_BUSY",
    ".f.json.sai-old",
  ],
];

test("HO-35 every refusal of close: the code by the table, one line without a stack, the file and the whole tree as they were, no .sai-tmp or .sai-old", (t) => {
  for (const [name, spec, exit, code, part] of CASES) {
    const sai = newCmdRepo(t);
    const f = `${DIR}/f.json`;
    fs.mkdirSync(path.join(sai.root, DIR), { recursive: true });
    fs.writeFileSync(path.join(sai.root, f), spec.bytes ?? spec.text);
    spec.before?.(sai);
    const before = sai.tree();
    const hashes = fileHashes(sai.root);
    const listing = listTree(sai.root);
    const arg = spec.path === "ABS" ? path.join(sai.root, f) : (spec.path ?? f);
    const args = spec.noPath
      ? ["close", "--status", "COMPLETED"]
      : ["close", arg, ...(spec.args ?? ["--status", "COMPLETED"])];
    const r = sai.cmd(args);
    let line;
    try {
      line = assertRefusal(r, exit, code);
    } catch (err) {
      err.message = `${name}: ${err.message}`;
      throw err;
    }
    if (part !== "E_HO_FILE_ANY")
      assert.ok(line.includes(part), `${name}: ${line}`);
    assert.ok(!line.includes(sai.dir), `${name}: ${line}`);
    assert.equal(sai.tree(), before, name);
    assert.deepEqual(fileHashes(sai.root), hashes, name);
    assert.deepEqual(listTree(sai.root), listing, name);
  }
});

test("HO-35a the time from the future in a field the command does not write: H6 line on stdout in the format of REQ-038, code 1, the file as it was", (t) => {
  const sai = newCmdRepo(t);
  const f = `${DIR}/f.json`;
  sai.write(
    f,
    file({
      result: { status: "COMPLETED", issues: [{ id: "I1", at: stamp(3600) }] },
    }),
  );
  const before = sai.tree();
  const hashes = fileHashes(sai.root);
  const r = sai.cmd(["close", f, "--status", "COMPLETED"]);
  const line = assertRefusal(r, 1, "E_HO_RULES", { stdout: true });
  assert.ok(line.includes("нарушений 1"), line);
  const rows = r.stdout.split("\n").filter((l) => l !== "");
  assert.equal(rows.length, 1, r.stdout);
  assert.match(
    rows[0],
    /^handoffs\/\S+\.json:\d+ — H6: result\.issues\[0\]\.at: /u,
  );
  assert.equal(sai.tree(), before);
  assert.deepEqual(fileHashes(sai.root), hashes);
});

test("HO-36 the lines of violations of close are the lines of handoffs-check for the same text", (t) => {
  const f = `${DIR}/f.json`;
  const future = stamp(3600);
  const original = file({
    result: { status: "COMPLETED", issues: [{ id: "I1", at: future }] },
  });
  const sai = newCmdRepo(t);
  sai.write(f, original);
  const r = sai.cmd(["close", f, "--status", "COMPLETED"]);
  assert.equal(r.status, 1, describe(r));
  const clock = /\(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\)$/u;
  const closeRows = r.stdout.split("\n").filter((l) => l !== "");
  assert.equal(closeRows.length, 1);

  // The text that close would have written, put into a repository that handoffs-check
  // looks at.
  const done = stamp(0);
  const next = original
    .replace('"status": "IN_PROGRESS"', '"status": "COMPLETED"')
    .replace('"completed_at": null', `"completed_at": "${done}"`);
  const other = newSai(t);
  other.write(f, next);
  const check = runCli([], { root: other.root, env: other.env });
  assert.equal(check.status, 1, describe(check));
  const checkRows = check.stdout
    .split("\n")
    .filter((l) => l !== "" && !l.startsWith("handoffs-check:"));
  assert.equal(checkRows.length, 1, check.stdout);
  assert.equal(
    closeRows[0].replace(clock, "(CLOCK)"),
    checkRows[0].replace(clock, "(CLOCK)"),
  );
});

test("HO-35b the file is changed by someone else between the reading and the writing: E_HO_STATE, their bytes stay, no .sai-tmp or .sai-old", (t) => {
  const sai = newCmdRepo(t);
  const f = `${DIR}/f.json`;
  const abs = path.join(sai.root, f);
  sai.write(f, file());
  const theirs = file({ context: { requirement_ids: [], by: "someone else" } });
  const real = fs.readFileSync;
  let calls = 0;
  t.mock.method(fs, "readFileSync", (p, ...rest) => {
    const bytes = real(p, ...rest);
    if (p === abs && ++calls === 1) fs.writeFileSync(abs, theirs);
    return bytes;
  });
  assert.throws(
    () => closeHandoff({ root: sai.root, arg: f, status: "COMPLETED" }),
    (e) =>
      e instanceof HandoffError &&
      e.code === "E_HO_STATE" &&
      e.exit === 1 &&
      e.message.includes("файл изменён во время закрытия"),
  );
  t.mock.restoreAll();
  assert.equal(calls >= 2, true);
  assert.equal(fs.readFileSync(abs, "utf8"), theirs);
  assert.deepEqual(fs.readdirSync(path.join(sai.root, DIR)), ["f.json"]);
});

test("HO-39 close does not need anything but the file: a run in a repository without tools/ and decisions/ works, and the files of other handoffs are not read or changed", (t) => {
  const sai = newCmdRepo(t);
  fs.rmSync(path.join(sai.root, "tools"), { recursive: true });
  fs.rmSync(path.join(sai.root, "decisions"), { recursive: true });
  sai.write(`${DIR}/other.json`, "not even json\n");
  sai.commit("2025-01-04T00:00:00Z");
  sai.write(`${DIR}/f.json`, file());
  const others = fileHashes(sai.root);
  delete others[`${DIR}/f.json`];
  const r = sai.cmd(["close", `${DIR}/f.json`, "--status", "COMPLETED"]);
  assert.equal(r.status, 0, describe(r));
  const after = fileHashes(sai.root);
  delete after[`${DIR}/f.json`];
  assert.deepEqual(after, others);
});
