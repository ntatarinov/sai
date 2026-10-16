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

// ------------------------------------------------------------------ FS-16
// REQ-042 criterion 11: the README tells the new words. The four checks of the
// criterion are `awk` + `grep` commands; here they are written in JS so that the
// test needs no tools, and run on invented text too, to show that they accept
// and reject as intended.

// awk '/START/{f=1;next} /^## /{f=0} f' : the lines after a line that starts a
// part, up to the next heading of level 2 (a repeated start begins again).
function awkPart(text, start) {
  const out = [];
  let f = false;
  for (const line of text.split("\n")) {
    if (start.test(line)) {
      f = true;
      continue;
    }
    if (/^## /.test(line)) f = false;
    if (f) out.push(line);
  }
  return out;
}
// grep -c : the number of lines that match
const grepC = (lines, re) => lines.filter((l) => re.test(l)).length;

const LIMITS = /^### Ограничения/;
const PIXEL = /^## Pixel Office/;

test("FS-16: the README tells the new words - 'нет свежих данных' in the limits and in the section, 'сервер перезапускался' in the section, no 'задач n/', 'полоса хода' or «завершена» there; the four checks of criterion 11, run on the file and on invented text", () => {
  const limits = awkPart(README, LIMITS);
  const pixel = awkPart(README, PIXEL);
  assert.ok(
    grepC(limits, /нет свежих данных/) >= 1,
    "limits: нет свежих данных",
  );
  assert.ok(
    grepC(pixel, /нет свежих данных/) >= 1,
    "section: нет свежих данных",
  );
  assert.ok(
    grepC(pixel, /сервер перезапускался/) >= 1,
    "section: сервер перезапускался",
  );
  assert.equal(grepC(pixel, /задач [0-9n]+\/|полоса хода|«завершена»/), 0);
  // the threshold and the constant are named in the section
  assert.ok(pixel.join("\n").includes("STALE_AFTER_MS"));
  assert.ok(/60 минут/.test(pixel.join("\n")));
  // the trusted lines (criterion 7) and the old words are not in the limits
  assert.equal(grepC(limits, /«завершена»/), 0);

  // the checks themselves, on invented text
  const sample = [
    "# Doc",
    "## Pixel Office",
    "Текст.",
    "### Ограничения",
    "1. Задача не остаётся «в работе»: нет свежих данных.",
    "## Другое",
    "нет свежих данных тут не считается",
  ].join("\n");
  assert.equal(grepC(awkPart(sample, LIMITS), /нет свежих данных/), 1);
  assert.equal(grepC(awkPart(sample, PIXEL), /нет свежих данных/), 1);
  assert.equal(grepC(awkPart(sample, PIXEL), /сервер перезапускался/), 0);
  const old = "## Pixel Office\nзадач 3/5 · полоса хода · «завершена»";
  assert.equal(
    grepC(awkPart(old, PIXEL), /задач [0-9n]+\/|полоса хода|«завершена»/),
    1,
  );
});

// ------------------------------------------------------- REQ-036, 045, 044
// The README tells the new behaviour (REQ-036 criterion 10, REQ-045 criterion
// 9, REQ-044 criterion 11): the awk + grep -c of the criteria, in JS (awkPart
// and grepC above), also on invented text.

test("NM-09: the section Pixel Office of the README says 'строка на агента' (REQ-036 criterion 10)", () => {
  const pixel = awkPart(README, PIXEL);
  assert.ok(grepC(pixel, /строка на агента/) >= 1);
  assert.equal(
    grepC(
      awkPart("## Pixel Office\nодна строка «Сейчас»", PIXEL),
      /строка на агента/,
    ),
    0,
  );
});

test("JR-07: the section Pixel Office of the README has the column 'Чего это не доказывает' and the row 'Оркестратор записал, как понял запрос' (REQ-045 criterion 9)", () => {
  const pixel = awkPart(README, PIXEL);
  assert.ok(grepC(pixel, /Чего это не доказывает/) >= 1);
  assert.ok(grepC(pixel, /Оркестратор записал, как понял запрос/) >= 1);
  // and they stand in the section, not elsewhere
  const rest = README.split("\n").filter((l) => !pixel.includes(l));
  assert.equal(grepC(rest, /Чего это не доказывает/), 0);
});

test("AC-11: the section Pixel Office of the README names the card of an 'экземпляр' (REQ-044 criterion 11)", () => {
  const pixel = awkPart(README, PIXEL);
  assert.ok(grepC(pixel, /экземпляр/) >= 1);
  assert.equal(
    grepC(awkPart("## Pixel Office\nкарточка роли", PIXEL), /экземпляр/),
    0,
  );
});

test("DC-03: the section Pixel Office of the README has the phrases of criterion 8 REQ-048 ('код роли'), 6 REQ-049 ('Показать всех'), 7 REQ-046 ('Показать более ранние', 'Поиск в журнале') - each at least once, as awk … | grep -c counts them, and not only outside the section", () => {
  const pixel = awkPart(README, PIXEL);
  for (const phrase of [
    /код роли/,
    /Показать всех/,
    /Показать более ранние/,
    /Поиск в журнале/,
  ]) {
    assert.ok(grepC(pixel, phrase) >= 1, String(phrase));
    // the count is of the section: a text without it gives 0
    assert.equal(
      grepC(
        awkPart(`## Pixel Office\nдругое\n## Дальше\n${phrase.source}`, PIXEL),
        phrase,
      ),
      0,
    );
  }
});

test("MC-07: the section Pixel Office of the README names the 'карточка основной сессии' (REQ-047 criterion 7)", () => {
  const pixel = awkPart(README, PIXEL);
  assert.ok(grepC(pixel, /карточка основной сессии/) >= 1);
  assert.equal(
    grepC(
      awkPart("## Pixel Office\nкарточка роли", PIXEL),
      /карточка основной сессии/,
    ),
    0,
  );
});
