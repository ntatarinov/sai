import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { cleanSource } from "../src/clean.js";
import { prepareRun } from "../src/prepare.js";
import { UsageError } from "../src/util.js";
import {
  ALPHA,
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
