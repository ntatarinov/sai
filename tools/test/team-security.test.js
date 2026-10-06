// Sai Team core: the findings of the security review (F2, F3, F4); the finding F1 (a
// hard link in work/) is tested in team-store.test.js next to TM-57.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { TeamError, formatError } from "../src/team/errors.js";
import { runGuarded } from "../src/team/cli.js";
import { openWriter } from "../src/team/store.js";
import {
  assertRefusal,
  describeRun,
  journalOf,
  makeClock,
  makeHome,
  runTeam,
  snapshot,
  startProject,
} from "./team-helpers.js";

// Every control character and every bidirectional control character (C0, DEL, C1,
// ALM, LRM, RLM, the embeddings and the isolates) except the final line break.
function hasRaw(text) {
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (
      c <= 0x1f ||
      (c >= 0x7f && c <= 0x9f) ||
      c === 0x61c ||
      c === 0x200e ||
      c === 0x200f ||
      (c >= 0x202a && c <= 0x202e) ||
      (c >= 0x2066 && c <= 0x2069)
    ) {
      return true;
    }
  }
  return false;
}
const FAKE_KEY = "ghp_FAKEFAKEFAKEFAKEFAKE1234567890abcd";
const BAD = "\u001b]0;x\u0007‮\u009b";

function closed(t) {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  p.writer.close();
  return { ...p, home };
}

function lines(text) {
  assert.ok(text === "" || text.endsWith("\n"));
  return text === "" ? [] : text.slice(0, -1).split("\n");
}

// ---- F2 ------------------------------------------------------------------------------

test("F2 a usage error never repeats the arguments of the command", (t) => {
  const p = closed(t);
  const before = snapshot(p.home);
  const cases = [
    [["projects", "--sk-123"], "E_USAGE: Неизвестный параметр"],
    [["projects", "password=hunter2fake"], "E_USAGE: Лишний аргумент"],
    [["projects", FAKE_KEY], "E_USAGE: Лишний аргумент"],
    [["project", p.id, FAKE_KEY], "E_USAGE: Лишний аргумент"],
    [["events", p.id, `--${FAKE_KEY}`, "1"], "E_USAGE: Неизвестный параметр"],
    [
      ["events", p.id, "--limit", "1", "--limit", FAKE_KEY],
      "E_USAGE: Параметр указан дважды",
    ],
    [["events", p.id, "--limit"], "E_USAGE: Нужно значение параметра"],
  ];
  for (const [args, line] of cases) {
    const r = runTeam(p.home, args);
    assert.equal(r.status, 2, describeRun(r));
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, `${line}\n`);
  }
  for (const word of [
    FAKE_KEY,
    "hunter2fake",
    "sk-123",
    "bogus-command-name",
  ]) {
    const r = runTeam(p.home, [word, "x"]);
    assert.equal(r.status, 2, describeRun(r));
    assert.doesNotMatch(r.stderr + r.stdout, new RegExp(word));
    assert.equal(lines(r.stderr).length, 1);
    assert.match(r.stderr, /^E_USAGE: /);
  }
  // values of the options that are wrong are not repeated either
  for (const [flag, value] of [
    ["--limit", FAKE_KEY],
    ["--after", FAKE_KEY],
  ]) {
    const r = runTeam(p.home, ["events", p.id, flag, value]);
    assert.equal(r.status, 2, describeRun(r));
    assert.doesNotMatch(r.stderr, new RegExp(FAKE_KEY));
  }
  assert.deepStrictEqual(snapshot(p.home), before);
});

// ---- F3 ------------------------------------------------------------------------------

test("F3 an error line is one line: control and bidirectional characters are escaped", () => {
  const text = formatError(
    new TeamError("E_EVENT", `Событие отклонено: ${BAD}\nвторая строка\r\n`),
  );
  assert.equal(hasRaw(text), false);
  assert.equal(text.includes("\n"), false);
  for (const escaped of ["\\u001b", "\\u0007", "\\u202e", "\\u009b"]) {
    assert.ok(text.includes(escaped), `${escaped} is not in ${text}`);
  }
  assert.ok(text.startsWith("E_EVENT: Событие отклонено: "));
  // every character of the classes is escaped, an ordinary text is not changed
  for (const code of [
    0x00, 0x0a, 0x1b, 0x7f, 0x80, 0x9f, 0x61c, 0x200e, 0x200f, 0x202a, 0x202e,
    0x2066, 0x2069,
  ]) {
    const one = formatError(
      new TeamError("E_EVENT", `a${String.fromCodePoint(code)}b`),
    );
    assert.equal(hasRaw(one), false, code.toString(16));
  }
  assert.equal(
    formatError(new TeamError("E_EVENT", "Привет — мир, «ёлка» 😀")),
    "E_EVENT: Привет — мир, «ёлка» 😀",
  );
});

test("F3 JSON on stdout has no raw control or bidirectional characters, and parses back to the same data", () => {
  const written = { stdout: "", stderr: "" };
  const io = {
    stdout: { write: (s) => (written.stdout += s) },
    stderr: { write: (s) => (written.stderr += s) },
  };
  const data = { a: `x${BAD}y`, list: ["⁦", "\u007f"], [`k${BAD}`]: 1 };
  assert.equal(
    runGuarded(() => data, io),
    0,
  );
  assert.equal(written.stdout.endsWith("\n"), true);
  assert.equal(hasRaw(written.stdout.slice(0, -1)), false);
  assert.deepStrictEqual(JSON.parse(written.stdout), data);
  assert.equal(written.stderr, "");
});

test("F3 a message with such characters is shown safely by say, events and project", (t) => {
  const p = closed(t);
  const text = `Привет ${BAD} конец`;
  const said = runTeam(p.home, ["say", p.id, "--text", text]);
  assert.equal(said.status, 0, describeRun(said));
  assert.equal(hasRaw(said.stdout.slice(0, -1)), false);
  assert.equal(JSON.parse(said.stdout).event.data.text, text);
  for (const args of [
    ["events", p.id],
    ["project", p.id],
  ]) {
    const r = runTeam(p.home, args);
    assert.equal(r.status, 0, describeRun(r));
    assert.equal(hasRaw(r.stdout.slice(0, -1)), false);
    assert.equal(hasRaw(r.stderr.slice(0, -1)), false);
  }
  assert.equal(
    JSON.parse(runTeam(p.home, ["events", p.id]).stdout).events.at(-1).data
      .text,
    text,
  );
  assert.equal(
    journalOf(p.events).at(-1).data.text,
    text,
    "the journal keeps the text as it came",
  );
});

test("F3 a damaged journal with control characters in a field name is shown as one safe line", (t) => {
  const p = closed(t);
  const first = journalOf(p.events)[0];
  const bad = {
    seq: 2,
    ts: first.ts,
    project: p.id,
    task: null,
    source: "USER",
    type: "CHAT",
    data: {
      text: "Привет",
      kind: "message",
      truncated: false,
      [`extra${BAD}`]: 1,
    },
  };
  // a good line after it, so that the damaged one is in the middle
  const good = {
    ...bad,
    seq: 3,
    data: { text: "Привет", kind: "message", truncated: false },
  };
  fs.appendFileSync(
    p.events,
    `${JSON.stringify(bad)}\n${JSON.stringify(good)}\n`,
  );
  const before = snapshot(p.home);
  for (const args of [
    ["project", p.id],
    ["events", p.id],
    ["say", p.id, "--text", "Привет"],
  ]) {
    const r = runTeam(p.home, args);
    assert.equal(r.status, 1, describeRun(r));
    assert.equal(r.stdout, "");
    assert.equal(lines(r.stderr).length, 1);
    assert.equal(hasRaw(r.stderr.slice(0, -1)), false);
    assert.match(r.stderr, /^E_CORRUPT: Журнал проекта повреждён в строке 2: /);
    assert.ok(r.stderr.includes("\\u001b"), r.stderr);
  }
  const list = runTeam(p.home, ["projects"]);
  assert.equal(list.status, 0, describeRun(list));
  assert.equal(hasRaw(list.stdout.slice(0, -1)), false);
  assert.ok(list.stdout.includes("\\u001b"));
  assert.deepStrictEqual(snapshot(p.home), before);
});

// ---- F4 ------------------------------------------------------------------------------

// The finding F4 (Low): the name of an unknown field is shown whole. The code does not
// limit it to 80 characters yet, so this test describes what is true now and after a
// fix alike: the event is refused, and the message names the field (at least its first
// 80 characters). A test of the upper bound comes with the fix.
test("F4 an event with an unknown field of a very long name is refused with E_EVENT naming the field", (t) => {
  const p = closed(t);
  const long = `x${"й".repeat(300)}`;
  const w = openWriter(p.id, { home: p.home, now: makeClock(Date.now(), 1) });
  t.after(() => w.close());
  const before = snapshot(p.home);
  const data = { text: "Привет", kind: "message", truncated: false, [long]: 1 };
  assertRefusal(
    p.home,
    () => w.append({ source: "USER", type: "CHAT", task: null, data }),
    "E_EVENT",
  );
  assert.deepStrictEqual(snapshot(p.home), before);
  let message = "";
  try {
    w.append({ source: "USER", type: "CHAT", task: null, data });
  } catch (err) {
    message = err.message;
  }
  assert.ok(message.includes(long.slice(0, 80)));
});
