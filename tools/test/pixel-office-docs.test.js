// DC: the documents of REQ-008 (criteria 15 and 16): the README of tools/ names
// what is stored and how to switch it off; the role of the orchestrator tells
// it to record "how it understood" with the exact command. The checks are the
// expressions of the criteria, run on the files (and on invented sample lines,
// to show what the expressions themselves accept and reject).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ROOT, TOOLS } from "./pixel-office-helpers.js";

const README = fs.readFileSync(path.join(TOOLS, "README.md"), "utf8");
const ROLE = fs.readFileSync(
  path.join(ROOT, ".claude", "agents", "orchestrator.md"),
  "utf8",
);

// Number of "## " headings of README.md before REQ-008 (the part about Pixel
// Office has its own, none is removed).
const README_H2_BEFORE = 2;

test("DC-01: tools/README.md has every phrase of criterion 15 (like grep -F), and its '## ' headings are all still there", () => {
  const phrases = [
    "pixel-office-note",
    "--text",
    "SAI_PIXEL_OFFICE_STORE_TEXT",
    "0011",
    "### Хранение текста",
    "остаточный риск",
    "[скрыто]",
    "/api/note",
    "--session",
    "без --session",
    "и у сервера, и у Claude Code (в обоих местах)",
    "три части через точку",
    "a.test.js",
    "22.21.1",
  ];
  for (const phrase of phrases) {
    assert.ok(README.includes(phrase), `README.md has no: ${phrase}`);
  }
  const headings = README.split("\n").filter((l) => l.startsWith("## "));
  assert.ok(
    headings.length >= README_H2_BEFORE,
    `${headings.length} headings of level 2`,
  );
  assert.ok(headings.includes("## Pixel Office"));
});

// The four checks of criterion 16 as the criterion writes them.
const G1 = /pixel-office-note/;
const G2 = /до раздачи|до запуска агентов/;
const G3 = /pixel-office-note[^`]*--text/;
const G4 = /pixel-office-note[^`]*/g;

// Lines that match; for G4 the count of matches (grep -o) that hold --session.
function checks(text) {
  const lines = text.split("\n");
  return {
    g1: lines.filter((l) => G1.test(l)).length,
    g2: lines.filter((l) => G2.test(l)).length,
    g3: lines.filter((l) => G3.test(l)).length,
    g4: lines
      .flatMap((l) => l.match(G4) ?? [])
      .filter((m) => m.includes("--session")).length,
  };
}

test("DC-02: the role of the orchestrator passes G1-G4 of criterion 16; the same expressions on invented lines accept and reject as intended", () => {
  const real = checks(ROLE);
  assert.ok(real.g1 >= 1, "G1: no line with pixel-office-note");
  assert.ok(real.g2 >= 1, "G2: no 'до раздачи' or 'до запуска агентов'");
  assert.ok(real.g3 >= 1, "G3: no command with --text in one line");
  assert.equal(real.g4, 0, "G4: --session inside the command");

  // The expressions themselves, on invented lines.
  const good =
    'Команда: `npm run pixel-office-note -- --text "пример"` и пояснение: --session не передаётся.';
  const withSession =
    'Команда: `npm run pixel-office-note -- --text "пример" --session s1`.';
  const broken =
    'Команда: `npm run pixel-office-note --\n--text "пример"` в двух строках.';
  const a = checks(good);
  assert.equal(a.g3, 1);
  assert.equal(a.g4, 0);
  const b = checks(withSession);
  assert.equal(b.g3, 1);
  assert.equal(b.g4, 1);
  const c = checks(broken);
  assert.equal(c.g1, 1);
  assert.equal(c.g3, 0);
  // Without the backquotes the explanation after the command is part of the
  // match: the check would give 1 (the reason for the quotes in the role).
  const bare = checks("pixel-office-note --text x, --session не передаётся");
  assert.equal(bare.g4, 1);
});
