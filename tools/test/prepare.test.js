import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { cleanSource } from "../src/clean.js";
import { prepareRun } from "../src/prepare.js";
import { UsageError } from "../src/util.js";
import {
  ALPHA,
  BAR,
  Q,
  assertCode,
  makeProject,
  prepareOptions,
  runDirOf,
} from "./helpers.js";

function rejectedWithoutWrites(opts, code, setup) {
  const root = makeProject();
  if (setup) setup(root);
  const result = prepareRun(root, prepareOptions(opts));
  assertCode(result, code);
  assert.equal(fs.existsSync(runDirOf(root)), false, "nothing may be created");
}

test("E_CANDIDATE: idea file missing", () => {
  rejectedWithoutWrites(
    { candidates: ["01-alpha", "03-gamma"] },
    "E_CANDIDATE",
  );
});

test("E_CANDIDATE: bad idea_id format", () => {
  rejectedWithoutWrites(
    { candidates: ["01-alpha", "../STATE"] },
    "E_CANDIDATE",
  );
});

test("E_DUPLICATE: candidate repeated", () => {
  rejectedWithoutWrites(
    { candidates: ["01-alpha", "01-alpha", "02-beta"] },
    "E_DUPLICATE",
  );
});

test("E_SOURCE_PATH: ideas/README.md is never a source", () => {
  rejectedWithoutWrites({ context: ["ideas/README.md"] }, "E_SOURCE_PATH");
});

test("E_SOURCE_PATH: path traversal", () => {
  rejectedWithoutWrites({ context: ["docs/../STATE.md"] }, "E_SOURCE_PATH");
});

test("E_SOURCE_PATH: a context path that is a folder is reported, not thrown", () => {
  rejectedWithoutWrites(
    { context: ["docs/folder.md"] },
    "E_SOURCE_PATH",
    (root) => fs.mkdirSync(path.join(root, "docs", "folder.md")),
  );
});

test("E_SOURCE_MARKERS: unpaired conclusion marker", () => {
  rejectedWithoutWrites({}, "E_SOURCE_MARKERS", (root) =>
    fs.appendFileSync(
      path.join(root, ALPHA),
      "<!-- conclusion:start -->\nхвост\n",
    ),
  );
});

test("E_ROSTER: roster labels not distinct", () => {
  rejectedWithoutWrites({ judge: "a-m" }, "E_ROSTER");
});

test("E_USAGE: bad RUN-ID and existing folder", () => {
  const root = makeProject();
  assert.throws(
    () => prepareRun(root, prepareOptions({ runId: "RUN-1" })),
    UsageError,
  );
  fs.mkdirSync(runDirOf(root));
  assert.throws(() => prepareRun(root, prepareOptions()), UsageError);
});

test("cleaned copy drops status paragraphs, Итог column and conclusions, keeps facts", () => {
  const root = makeProject();
  const result = prepareRun(root, prepareOptions());
  assert.ok(result.issues.empty);
  const copy = fs.readFileSync(
    path.join(runDirOf(root), "sources", ALPHA),
    "utf8",
  );
  for (const gone of [
    "Записано",
    "Продолжение статусного абзаца",
    "Итог",
    "Отброшено",
    Q.conclusion,
    "conclusion",
  ]) {
    assert.ok(!copy.includes(gone), `must be removed: ${gone}`);
  }
  assert.ok(copy.includes(Q.a1));
  assert.ok(copy.includes(`| Квиз | ${Q.a3} |`));
});

test("cleaning removes a bold «Почему нет» column and a «Статус:» paragraph", () => {
  const text =
    "Статус: хобби.\nвторая строка\n\n| Идея | **Почему нет** |\n|---|---|\n| X | занято |\n";
  const { text: cleaned } = cleanSource(text);
  assert.ok(!cleaned.includes("хобби") && !cleaned.includes("вторая строка"));
  assert.ok(!cleaned.includes("Почему нет") && !cleaned.includes("занято"));
  assert.ok(cleaned.includes("| Идея |") && cleaned.includes("| X |"));
});

test("cleaning leaves text without markers, status paragraphs or listed columns byte-identical", () => {
  const text =
    "# Заголовок\n\nЗаписано в середине строки не считается.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n";
  assert.equal(cleanSource(text).text, text);
});

// ---- ISS-0120 (with ISS-0037): a source never leads outside the project ------------

// A file outside the project with a text that must never reach the run folder.
const OUTSIDE_TEXT = "OUTSIDE-SECRET-iss0120-not-a-real-value\n";

function outsideFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sai-outside-"));
  const file = path.join(dir, "context.md");
  fs.writeFileSync(file, OUTSIDE_TEXT);
  return { dir, file };
}

// Every file under root, read as text: the outside text is in none of them.
function assertOutsideTextAbsent(root) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) {
        assert.ok(
          !fs.readFileSync(abs, "utf8").includes(OUTSIDE_TEXT.trim()),
          `outside text found in ${abs}`,
        );
      }
    }
  };
  walk(root);
}

test("ISS-0120 a context source that is a link to a file outside the project is refused with a named message, nothing is written", () => {
  const { file } = outsideFile();
  const root = makeProject();
  fs.symlinkSync(file, path.join(root, "docs", "context.md"));
  const result = prepareRun(
    root,
    prepareOptions({ context: [BAR, "docs/context.md"] }),
  );
  assertCode(result, "E_SOURCE_PATH");
  assert.match(
    JSON.stringify(result.issues.list),
    /source leads outside the project through a symbolic link: docs\/context\.md/u,
  );
  assert.equal(fs.existsSync(runDirOf(root)), false, "nothing may be created");
  assertOutsideTextAbsent(root);
});

test("ISS-0120 an idea file that is a link to a file outside the project is refused", () => {
  const { file } = outsideFile();
  const root = makeProject();
  fs.rmSync(path.join(root, ALPHA));
  fs.symlinkSync(file, path.join(root, ALPHA));
  const result = prepareRun(root, prepareOptions());
  assertCode(result, "E_SOURCE_PATH");
  assert.equal(fs.existsSync(runDirOf(root)), false, "nothing may be created");
  assertOutsideTextAbsent(root);
});

test("ISS-0120 a source inside a linked folder that lies outside the project is refused", () => {
  const { dir } = outsideFile();
  const root = makeProject();
  fs.symlinkSync(dir, path.join(root, "docs", "linked"));
  const result = prepareRun(
    root,
    prepareOptions({ context: [BAR, "docs/linked/context.md"] }),
  );
  assertCode(result, "E_SOURCE_PATH");
  assert.equal(fs.existsSync(runDirOf(root)), false, "nothing may be created");
  assertOutsideTextAbsent(root);
});

test("ISS-0120 a link that stays inside the project is still read and copied", () => {
  const root = makeProject();
  fs.writeFileSync(path.join(root, "docs", "real.md"), "# Внутри проекта\n");
  fs.symlinkSync(
    path.join(root, "docs", "real.md"),
    path.join(root, "docs", "inside.md"),
  );
  const result = prepareRun(
    root,
    prepareOptions({ context: [BAR, "docs/inside.md"] }),
  );
  assert.ok(result.issues.empty, JSON.stringify(result.issues.list));
  assert.equal(
    fs.readFileSync(
      path.join(runDirOf(root), "sources", "docs", "inside.md"),
      "utf8",
    ),
    "# Внутри проекта\n",
  );
});

test("ISS-0120 a dangling link is reported with the old message, not thrown", () => {
  const root = makeProject();
  fs.symlinkSync(
    path.join(root, "docs", "missing.md"),
    path.join(root, "docs", "dangling.md"),
  );
  const result = prepareRun(
    root,
    prepareOptions({ context: [BAR, "docs/dangling.md"] }),
  );
  assertCode(result, "E_SOURCE_PATH");
  assert.match(
    JSON.stringify(result.issues.list),
    /source not allowed, missing/u,
  );
});
