// REQ-103 (program PUBLIC-V1, R0.3; run M0DOCS-20261117-01): the current documents stay
// true. The tests CD-1 ... CD-10 of section 16 of docs/design/REQ-103-current-documents.md
// (decisions/0117 О10) and CD-11 ... CD-13 of decisions/0117 О44, О48, with the boundary of
// CD-3 by О47.
//
// The tests read files only: no write, no process, no network, no clock. Each checks a
// property that does not change with time. The oracles are the rules written here; nothing
// is imported from tools/src (the headings and the markers of STATE.md are written out
// below). Every rule is a function of an in-memory model of the files, so CD-10 can show
// each rule red on a damaged copy and green on its benign twins, as RD's «not blind» test
// does in repo.test.js.
//
// Checked at the run only, not here, because they change with time (design sections 5.6,
// 6.1, 15; decisions/0117 О4, О11, О23, О40, О49):
// - the counts and the open defects of STATE.md and README.md, their values and their
//   times (criteria 2 (e), 5 (b), 5 (c)); here only their one-line form and the sum of
//   the four severities are pinned;
// - the gate lines of STATE.md equal to the unanswered rows of PROGRESS.md (GATESEQ
//   equal, the reviewer's MR06): an owner's answer recorded in PROGRESS.md changes the set
//   at any moment, and the next writer of the block refreshes it (design 5.5);
// - the rows of the PLAN.md table that PROGRESS.md and the passed gates ask for (PLANROWS
//   (1), (4), (6), the reviewer's MR03): a gate that passes adds a requirement, and ORCH
//   removes a row on the owner's word (CLAUDE.md, the closed list);
// - the two README sections and the IDEA-ANALYST / IDEA-JUDGE paragraph of CLAUDE.md
//   byte-equal to the base tag of the run (criteria 5 (e), 4 (b), the reviewer's MR14,
//   MR18): another requirement may edit them after this run, and RD, TD, E2K-61 and
//   REQ-003 AC3 pin their words;
// - the WF-06 block and the owner's section of the STATE.md tail equal to the archive
//   (criterion 2 (c), the design's M05): apply-verdict and the owner's start record write
//   there (decisions/0117 О47); TM-01 (а) of team-docs.test.js pins the owner's record;
// - the bodies of the four docs/product files after their first line, the number of *.md
//   files there (four), and the lines of ideas/README.md other than the row of 02-sai.md
//   (criteria 6 (a), 6 (b); the gate's O20, O21, O22): another requirement may legally
//   rewrite those texts, so only their forms are pinned here (the snapshot line, the
//   three cells of the row, decisions/0033).
// RELEASE-VALIDATOR checks all the run-time parts above against the base tag at step 9
// (decisions/0117 О51, F2): the README sections and the IDEA paragraph (4 (b), 5 (e)) are
// byte-equal to the tag, the bodies named above are equal to the tag, and the counts and
// times are equal to a fresh count.
//
// One rule that the durable part of GATESEQ in CD-2 rests on (decisions/0117 О51, F6): a
// gate row's name, the first column of the table «Owner gates» in
// docs/program/public-v1/PROGRESS.md, is never edited after it is written. The tables of
// PROGRESS.md are only appended (decisions/0091); a gate that is asked again is a new row
// with a new name. A gate line of STATE.md names a row, so a renamed row turns CD-2 red
// with no write to STATE.md: the fix is to restore the name, or to write a new row.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const RUN = "M0DOCS-20261117-01";

// The three headings and the two markers that the code reads in STATE.md (decisions/0080
// item 7; design 5.4).
const OWNER = "### Решение владельца о старте";
const BLOCK = "### Рекомендация агентов (WF-06)";
const NEXT = "### Что делать дальше — по порядку";
const START = "<!-- sai:wf06:start -->";
const END = "<!-- sai:wf06:end -->";

// The two archive copies, pinned from the one live record context.pre_state of
// handoffs/M0DOCS-20261117-01/step-02-doc-updater.json (design 4.3): history never changes.
const ARCHIVES = [
  {
    path: `docs/archive/STATE-until-${RUN}.md`,
    gitBlob: "21f3930a42b272afecb167bf7052f8ac79b6a43e",
    sha256: "728cb4eae27bf23c4f05c8d9c3dc886bf1c6174d3c593f58ccf13f2aa5b2ced6",
    bytes: 474809,
    lines: 1316,
  },
  {
    path: `docs/archive/PLAN-until-${RUN}.md`,
    gitBlob: "8615dc45e45ca0322dba6b6ba2d5aa1aa9585d8d",
    sha256: "3bc7897b9e52b3ac674a29ab9b8452b53d4981516ca1472536a1b8da8528b46b",
    bytes: 129382,
    lines: 399,
  },
];

// The four cancelled handoffs (design section 10). For each: its top-level fields at the
// base tag except `status`, and the sha256 of their canonical JSON, computed from
// `git show base/M0DOCS-20261117-01:<path>`. The cancellation changes the status and adds
// a field; nothing that was there is rewritten (quality-bar §6 item 8).
const TAG_FIELDS = [
  "completed_at",
  "context",
  "created_at",
  "file",
  "from_agent",
  "handoff_id",
  "priority",
  "result",
  "run_id",
  "started_at",
  "step",
  "task",
  "to_agent",
  "workflow_id",
];
const FOUR = [
  [
    "handoffs/WF06-20260926-01/step-10-orch.json",
    TAG_FIELDS,
    "06276e94d81b5621ec738daa0dca7b821347438422db85886e962acbd9888628",
  ],
  [
    "handoffs/WF06-20260926-01/step-11-req-analyst.json",
    TAG_FIELDS,
    "5237a86abb45c4add25dbd9147e4398f0b1df98393380e9038ebf27ef98988be",
  ],
  [
    "handoffs/WF06-20260926-01/step-12-ba-analyst.json",
    TAG_FIELDS,
    "2f4f344a4ea5b7aee2b0624db44e41de91e95e24a5242319d35ce4f940628808",
  ],
  [
    "handoffs/ISS-0002-20260930-01/step-06-test-designer-r2.json",
    [...TAG_FIELDS, "round"].sort(),
    "c5ce19bb0987f94914b1b5e7ffe30319c700af254dd82a0207bf8840a2c420c6",
  ],
];

// The two cancellations of 2026-09-28 that predate the field `by` (decisions/0117 О48);
// bookkeeping files are only appended, so they are not rewritten.
const HISTORY_WITHOUT_BY = [
  "handoffs/WF06-20260925-01/step-10-orch.json",
  "handoffs/WF06-20260925-01/step-13-req-analyst.json",
];

// The closed list of what ORCH writes (CLAUDE.md): the list of the base tag with the two
// items of design E7.2 after the item of the decision records. Each item is compared with
// its whitespace folded, so a re-wrapped line keeps it.
const ORCH_LIST = [
  '- handoffs and the service files of a run in `handoffs/<RUN-ID>/` — including the list of parallel runs `handoffs/<RUN-ID>/parallel-runs.jsonl` and the "before" snapshot in WF-07; corrections go in separate fields `orch_note`, `orch_correction`, `orch_cancellation`; `not_agent_attested` — only by the rules of "Pauses and interruptions" (`docs/workflows/handoffs.md`);',
  "- `PLAN.md` — the plan of iterations: it adds checked requirements to it and removes them on the owner's word (WF-01, step 3);",
  "- records of decisions in `decisions/` and their lines in `decisions/README.md` — proposals to raise the bar (quality-bar §4) and decisions on the course of work; a record carries the owner's words or the proposal of a role, with a section \"Basis\" (`decisions/README.md`); an exception from the bar — only by the owner's written words (quality-bar §1, item 3);",
  '- the files of the program in `docs/program/public-v1/**` — bookkeeping and the owner\'s instructions, no code; its `PLAN.md` and `ARCHITECTURE.md` are not edited, a change is a dated row of the table "Plan amendments" of `PROGRESS.md` (`decisions/0091`, items 4 and 8);',
  "- appending the owner's words verbatim to `docs/owner-requests/` (`decisions/0091`, item 4): only appended, nothing in those files is rewritten;",
  "- moving a requirement status to `in_progress` when work on it starts (WF-02, step 0; the WF-07 variant);",
  "- the fix on the short path of WF-02;",
  "- the sample file given by the owner (WF-04, step 0);",
  "- the run files in `runs/<RUN-ID>/` that the command prepare-run creates (WF-06, step 0);",
  "- bookkeeping after step 6 of WF-06: requirement statuses other than `done` (it is set only by DOC-UPDATER after PASS of RELEASE-VALIDATOR — the header of `docs/requirements.yaml`), `docs/anti-patterns.md`, `STATE.md` outside the recommendation block;",
  "- the record of the owner's decision on the start in `STATE.md` on his direct word — this is a transfer of his words (WF-06, step 7).",
];

// Sentences of the old README that the run made false or found false (criterion 5 (a),
// (g), design R1, R5, R7-R11).
const README_GONE = [
  "No health audit yet",
  "will appear with the first audit",
  "goal templates",
  "runs (`STATE.md`)",
  "The exact status is in `docs/requirements.yaml` and `STATE.md`",
  "what is done, what is open, what is next",
  '"Ждёт владельца"',
];

const UNREADABLE = Symbol("unreadable");

// ---- reading the files (the only place that touches the disk) -------------------------

const abs = (rel) => path.join(ROOT, rel);

function maybeBytes(rel) {
  try {
    return fs.readFileSync(abs(rel));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function maybeJson(rel) {
  const buf = maybeBytes(rel);
  if (buf === null) return null;
  try {
    const value = JSON.parse(buf.toString("utf8"));
    return isObject(value) ? value : UNREADABLE;
  } catch {
    return UNREADABLE;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The passing gates one parsed handoff holds, [requirement id, completed_at, run] for
// each requirement it names: only a handoff to REQ-VALIDATOR with the verdict PASS is a
// gate (a FAIL handoff of an earlier run is not the first gate of anything).
function gatesOf(json) {
  const ids = json.context?.requirement_ids;
  if (
    json.to_agent !== "REQ-VALIDATOR" ||
    !isObject(json.result) ||
    json.result.verdict !== "PASS" ||
    !Array.isArray(ids)
  )
    return [];
  return ids
    .filter((id) => typeof id === "string" && /^REQ-[0-9]{3}$/u.test(id))
    .map((id) => [
      id,
      json.completed_at === null ? "null" : String(json.completed_at),
      String(json.run_id),
    ]);
}

// Every handoff handoffs/<run>/<name>.json; only those that can be a passing
// REQ-VALIDATOR handoff or a cancellation are parsed.
function readHandoffs() {
  const gates = [];
  const cancelled = [];
  const unreadable = [];
  const runs = fs
    .readdirSync(abs("handoffs"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const run of runs) {
    for (const name of fs.readdirSync(abs(`handoffs/${run}`)).sort()) {
      if (!name.endsWith(".json")) continue;
      const file = `handoffs/${run}/${name}`;
      const raw = fs.readFileSync(abs(file), "utf8");
      const gateLike = raw.includes('"REQ-VALIDATOR"');
      const cancelLike =
        raw.includes("CANCELLED") || raw.includes("orch_cancellation");
      if (!gateLike && !cancelLike) continue;
      let json;
      try {
        json = JSON.parse(raw);
      } catch {
        json = undefined;
      }
      if (!isObject(json)) {
        unreadable.push([file, gateLike, cancelLike]);
        continue;
      }
      gates.push(...gatesOf(json));
      if (
        json.status === "CANCELLED" ||
        Object.hasOwn(json, "orch_cancellation")
      )
        cancelled.push([file, json]);
    }
  }
  return { gates, cancelled, unreadable };
}

function load() {
  const read = (rel) => fs.readFileSync(abs(rel), "utf8");
  const archiveDir = abs("docs/archive");
  const productDir = abs("docs/product");
  return {
    state: fs.readFileSync(abs("STATE.md")),
    archive: Object.fromEntries(
      ARCHIVES.map((a) => [a.path, maybeBytes(a.path)]),
    ),
    archiveNames: fs.existsSync(archiveDir)
      ? fs.readdirSync(archiveDir).sort()
      : [],
    plan: read("PLAN.md"),
    claude: read("CLAUDE.md"),
    readme: read("README.md"),
    ideas: read("ideas/README.md"),
    product: fs
      .readdirSync(productDir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .map((e) => [
        e.name,
        e.isFile()
          ? fs.readFileSync(path.join(productDir, e.name), "utf8")
          : null,
      ]),
    progress: read("docs/program/public-v1/PROGRESS.md"),
    requirements: read("docs/requirements.yaml"),
    four: Object.fromEntries(FOUR.map(([file]) => [file, maybeJson(file)])),
    ...readHandoffs(),
    exists: (rel) => fs.existsSync(abs(rel)),
  };
}

let cached;
const real = () => (cached ??= load());

// ---- small helpers --------------------------------------------------------------------

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");
const gitBlob = (buf) =>
  crypto
    .createHash("sha1")
    .update(`blob ${buf.length}\0`)
    .update(buf)
    .digest("hex");
const lossless = (buf) => Buffer.from(buf.toString("utf8"), "utf8").equals(buf);
const indexes = (lines, line) =>
  lines.flatMap((l, i) => (l === line ? [i] : []));
const digits = (s) => s.replace(/[^0-9]/gu, "");

function countLineBreaks(buf) {
  let n = 0;
  for (const byte of buf) if (byte === 10) n += 1;
  return n;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value))
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

// The body of the section that starts at the first line `isHeading` accepts, up to the
// next `## ` heading; `null` when there is no such line.
function sectionBody(text, isHeading, withHeading = false) {
  const lines = text.split("\n");
  const start = lines.findIndex(isHeading);
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !/^## /u.test(lines[end])) end += 1;
  return lines.slice(withHeading ? start : start + 1, end).join("\n");
}

const writeList = (claude) =>
  sectionBody(
    claude,
    (l) => l.startsWith("ORCH writes by itself only this"),
    true,
  );

// The status of a block of docs/requirements.yaml: its first `    status: ` line before
// the next block.
function statusOf(yaml, id) {
  const lines = yaml.split("\n");
  const at = lines.indexOf(`  - id: ${id}`);
  if (at === -1) return undefined;
  for (let i = at + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("  - id: ")) return undefined;
    const m = /^ {4}status: (\S+)/u.exec(lines[i]);
    if (m) return m[1];
  }
  return undefined;
}

// The run of the earliest passing REQ-VALIDATOR handoff of a requirement (design 6.1,
// FIRSTGATE): ordered by `completed_at`, then by run.
function firstGate(gates, id) {
  const mine = gates
    .filter((g) => g[0] === id)
    .sort((a, b) => {
      if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
      if (a[2] !== b[2]) return a[2] < b[2] ? -1 : 1;
      return 0;
    });
  return mine.length ? mine[0][2] : undefined;
}

// Every first-column text of the table «Owner gates» of PROGRESS.md, answered or not
// (design 5.6, GATEROWS); the table's rows are only appended.
function gateRows(progress) {
  const lines = progress.split("\n");
  const start = lines.indexOf("## Owner gates");
  if (start === -1) return [];
  const rows = [];
  for (
    let i = start + 1;
    i < lines.length && !lines[i].startsWith("## ");
    i += 1
  ) {
    if (!lines[i].startsWith("|")) continue;
    const g = lines[i].split("|")[1].replace(/^ +| +$/gu, "");
    if (g !== "Gate" && !/^-+$/u.test(g)) rows.push(g);
  }
  return rows;
}

// ---- CD-1: the archive copies ---------------------------------------------------------

function cd1(m) {
  const out = [];
  const add = (msg) => out.push(`CD-1: ${msg}`);
  for (const a of ARCHIVES) {
    const buf = m.archive[a.path];
    if (buf === null) {
      add(`${a.path} does not exist`);
      continue;
    }
    if (buf.length !== a.bytes)
      add(`${a.path} has ${buf.length} bytes, the record ${a.bytes}`);
    const lines = countLineBreaks(buf);
    if (lines !== a.lines)
      add(`${a.path} has ${lines} lines, the record ${a.lines}`);
    if (sha256(buf) !== a.sha256)
      add(`${a.path}: its sha256 is not the recorded one`);
    if (gitBlob(buf) !== a.gitBlob)
      add(`${a.path}: its git blob id is not the recorded one`);
  }
  const copies = m.archiveNames.filter((n) => n.endsWith(`-until-${RUN}.md`));
  if (copies.length !== 2)
    add(`docs/archive holds ${copies.length} copies of the run, need 2`);
  return out;
}

// ---- CD-2: the one-screen block of STATE.md -------------------------------------------

const R_LINE =
  /^- Requirements \(`docs\/requirements\.yaml`, the status lines of the blocks, read [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z\): /u;
const D_LINE =
  /^- Open defects \(`docs\/issues\/`, the first line «Серьёзность: …» of each file, read [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z\): [0-9]+ — /u;
const COUNTS_FORM =
  "[0-9]+ in total — [0-9]+ done, [0-9]+ in progress, [0-9]+ blocked, [0-9]+ pending, [0-9]+ cancelled";

// SHAPE of design 5.6: one letter per line of the block, in the order of design 5.2.
function shape(block) {
  let gates = 0;
  let seq = "";
  for (const l of block) {
    if (l === "# Sai — the current state") seq += "H";
    else if (l === "") seq += "E";
    else if (
      l.startsWith("One screen. DOC-UPDATER rewrites the lines of this block ")
    )
      seq += "P";
    else if (l.startsWith("**State:** ")) seq += "S";
    else if (R_LINE.test(l)) seq += "R";
    else if (D_LINE.test(l)) seq += "D";
    else if (l.startsWith("**Open gates:** the rows of «Owner gates» in ")) {
      seq += "G";
      gates = 1;
    } else if (
      l.startsWith("- ") &&
      gates === 1 &&
      !/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/u.test(l) &&
      !l.startsWith("- **")
    )
      seq += "g";
    else if (l.startsWith("Owner actions pending (the same file, «Now»): ")) {
      seq += "O";
      gates = 2;
    } else if (l.startsWith("**Next step:** ")) seq += "N";
    else if (
      l.startsWith(
        "The three sections below the line are copied verbatim from the old file: ",
      )
    )
      seq += "T";
    else seq += "X";
  }
  return seq;
}

function cd2(m) {
  const out = [];
  const add = (msg) => out.push(`CD-2: ${msg}`);
  const text = m.state.toString("utf8");
  if (!lossless(m.state)) add("STATE.md is not valid UTF-8");
  if (m.state.length >= 40000)
    add(`STATE.md has ${m.state.length} bytes, it must stay below 40000`);
  const lines = text.split("\n");
  for (const h of [OWNER, BLOCK, NEXT]) {
    const n = indexes(lines, h).length;
    if (n !== 1) add(`the heading «${h}» stands ${n} times, need once`);
  }
  const s = indexes(lines, START);
  const e = indexes(lines, END);
  if (s.length !== 1 || e.length !== 1 || s[0] > e[0])
    add(
      `the WF-06 markers stand ${s.length} and ${e.length} times, need once each, start before end`,
    );
  const sep = lines.indexOf("---");
  if (sep === -1) {
    add("no line --- ends the block");
    return out;
  }
  if (sep + 1 > 50)
    add(`the line --- is line ${sep + 1}, it must stand at most at line 50`);
  if (lines[sep - 1] !== "")
    add(
      "no empty line before the line --- (Markdown reads the text above as a heading)",
    );
  if (lines[sep + 1] !== "" || lines[sep + 2] !== OWNER)
    add("after the line ---: not one empty line and then the owner heading");
  const block = lines.slice(0, sep);
  for (const label of ["State", "Open gates", "Next step"]) {
    const re = new RegExp(`^(#+ |[*][*])?${label}([ :*]|$)`, "u");
    const n = block.filter((l) => re.test(l)).length;
    if (n !== 1)
      add(`the label «${label}» starts ${n} lines of the block, need 1`);
  }
  const seq = shape(block);
  if (!/^HEPESERDEGEg*EOENETE$/u.test(seq))
    add(
      `SHAPE of the block is ${seq.slice(0, 60)}${seq.length > 60 ? "…" : ""}, need HEPESERDEGEg*EOENETE`,
    );
  const r = block.find((l) => R_LINE.test(l));
  if (r && !new RegExp(`\\): ${COUNTS_FORM}\\.$`, "u").test(r))
    add("the requirements line does not end with the counts on one line");
  const d = block.find((l) => D_LINE.test(l));
  const dm = d
    ? /\): ([0-9]+) — ([0-9]+) critical, ([0-9]+) high, ([0-9]+) medium, ([0-9]+) low\.$/u.exec(
        d,
      )
    : null;
  if (d && !dm)
    add(
      "the defects line does not end with «<n> — <c> critical, <h> high, <m> medium, <l> low.»",
    );
  if (
    dm &&
    Number(dm[1]) !== [2, 3, 4, 5].reduce((t, i) => t + Number(dm[i]), 0)
  )
    add("the four severities of the defects line do not add up to its total");
  // GATESEQ, the durable part: every gate line is a row of «Owner gates», in its order.
  const rows = gateRows(m.progress);
  const g = block.findIndex((l) => l.startsWith("**Open gates:**"));
  if (g === -1) add("the block has no line «**Open gates:**»");
  else {
    let last = -1;
    for (
      let i = g + 1;
      i < block.length && !/^(\*\*|Owner actions)/u.test(block[i]);
      i += 1
    ) {
      if (!block[i].startsWith("- ")) continue;
      const at = rows.indexOf(block[i].slice(2));
      if (at === -1)
        add(
          `gate line ${i + 1} names no row of «Owner gates» in docs/program/public-v1/PROGRESS.md`,
        );
      else if (at <= last)
        add(`gate line ${i + 1} is out of the table order or repeated`);
      else last = at;
    }
  }
  return out;
}

// ---- CD-3: the tail of STATE.md against the archive (decisions/0117 О47) ---------------

function tailParts(text) {
  const lines = text.split("\n");
  const heads = indexes(lines, OWNER);
  if (heads.length !== 1)
    return { error: `${heads.length} owner headings, need 1` };
  const tail = lines.slice(heads[0]);
  const s = indexes(tail, START);
  const e = indexes(tail, END);
  if (s.length !== 1 || e.length !== 1 || s[0] > e[0])
    return {
      error: `the WF-06 markers stand ${s.length} and ${e.length} times below the owner heading, need once each, start before end`,
    };
  return {
    owner: tail.slice(1, s[0]),
    block: tail.slice(s[0], e[0] + 1),
    rest: tail.slice(e[0] + 1),
    restLine: heads[0] + e[0] + 2,
  };
}

function cd3(m) {
  const out = [];
  const add = (msg) => out.push(`CD-3: ${msg}`);
  const archive = m.archive[ARCHIVES[0].path];
  if (archive === null) {
    add("there is no archive copy of STATE.md to compare the tail with");
    return out;
  }
  const theirs = tailParts(archive.toString("utf8"));
  const mine = tailParts(m.state.toString("utf8"));
  if (theirs.error) add(`the archive copy: ${theirs.error}`);
  if (mine.error) {
    add(`STATE.md: ${mine.error}`);
    return out;
  }
  // Region (b): the owner's records; a heading there would end the owner's section.
  mine.owner.forEach((l, i) => {
    if (/^#{1,3} /u.test(l))
      add(`a heading stands in the owner's section (tail line ${i + 2})`);
  });
  // Region (a): a block the way apply-verdict writes it starts with the block heading.
  if (mine.block[1] !== BLOCK)
    add(`the line after the start marker is not «${BLOCK}»`);
  if (!theirs.error) {
    const a = mine.rest;
    const b = theirs.rest;
    if (a.join("\n") !== b.join("\n")) {
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
      add(
        `the tail after the end marker differs from the archive copy, first at STATE.md line ${mine.restLine + i}`,
      );
    }
  }
  return out;
}

// ---- CD-4: the root PLAN.md -----------------------------------------------------------

function cd4(m) {
  const out = [];
  const add = (msg) => out.push(`CD-4: ${msg}`);
  const p = m.plan;
  if (!p.includes("docs/program/public-v1/PLAN.md"))
    add("PLAN.md does not name docs/program/public-v1/PLAN.md");
  if (!/PUBLIC-V1 milestone M[0-9]+/u.test(p))
    add("PLAN.md does not name «PUBLIC-V1 milestone M<k>»");
  if (!p.includes("Одновременно работают не больше двух агентов"))
    add("PLAN.md has no line «Одновременно работают не больше двух агентов»");
  const lines = p.split("\n");
  const iterations = lines.filter((l) => /^## Итерация [0-9]/u.test(l)).length;
  if (iterations)
    add(
      `PLAN.md has ${iterations} headings «## Итерация N»: they belong to the archive`,
    );
  const size = Buffer.byteLength(p, "utf8");
  if (size >= 8000) add(`PLAN.md has ${size} bytes, it must stay below 8000`);
  const heads = lines.filter((l) =>
    /^## Requirements of the iteration/u.test(l),
  ).length;
  if (heads !== 1) {
    add(
      `PLAN.md has ${heads} sections «Requirements of the iteration», need 1`,
    );
    return out;
  }
  const rows = sectionBody(p, (l) =>
    /^## Requirements of the iteration/u.test(l),
  )
    .split("\n")
    .filter((l) => /^\| REQ-[0-9]{3} /u.test(l));
  const seen = new Map();
  for (const row of rows) {
    const cells =
      /^\| (REQ-[0-9]{3}) \| ([^|]*[^| ]) \| ([^|]*[^| ]) \|$/u.exec(row);
    if (!cells) {
      add(
        `the row «${row.slice(0, 24)}…» is not of the form | REQ-NNN | P-code | Run |`,
      );
      continue;
    }
    const [, id, , run] = cells;
    seen.set(id, (seen.get(id) ?? 0) + 1);
    const status = statusOf(m.requirements, id);
    if (status === undefined)
      add(`${id}: no block with a status line in docs/requirements.yaml`);
    else if (status === "cancelled")
      add(`${id}: the block is cancelled, its row must go`);
    const first = firstGate(m.gates, id);
    if (first !== run)
      add(
        `${id}: its Run ${run} is not the run of the first passing REQ-VALIDATOR handoff (${first ?? "none"})`,
      );
  }
  for (const id of ["REQ-102", "REQ-103"])
    if ((seen.get(id) ?? 0) !== 1)
      add(`the table has ${seen.get(id) ?? 0} rows of ${id}, need 1`);
  for (const [id, n] of seen)
    if (n > 1 && id !== "REQ-102" && id !== "REQ-103")
      add(`the table has ${n} rows of ${id}`);
  for (const [file, gateLike] of m.unreadable)
    if (gateLike)
      add(`${file} is not a JSON object: a first gate cannot be read`);
  return out;
}

// ---- CD-5 and CD-13: CLAUDE.md --------------------------------------------------------

function cd5(m) {
  const out = [];
  const add = (msg) => out.push(`CD-5: ${msg}`);
  const what = sectionBody(m.claude, (l) => l === "## What we are building");
  if (what === null) add("CLAUDE.md has no section «## What we are building»");
  else
    for (const w of [
      "docs/program/public-v1/PLAN.md",
      "PUBLIC-V1",
      "virtual team",
    ])
      if (!what.includes(w))
        add(`the section «What we are building» does not name «${w}»`);
  const list = writeList(m.claude);
  if (list === null)
    add("CLAUDE.md has no list «ORCH writes by itself only this»");
  else {
    for (const w of ["docs/program/public-v1/**", "docs/owner-requests/"])
      if (!list.includes(w)) add(`ORCH's write list does not name «${w}»`);
    if (!/append/iu.test(list)) add("ORCH's write list does not say «append»");
  }
  return out;
}

function listItems(list) {
  const items = [];
  for (const l of list.split("\n").slice(1)) {
    if (l.startsWith("- ")) items.push(l);
    else if (l.startsWith("  ") && items.length)
      items[items.length - 1] += ` ${l}`;
    else if (l.trim() !== "") items.push(`(not an item) ${l}`);
  }
  return items.map((s) => s.replace(/\s+/gu, " ").trim());
}

function cd13(m) {
  const list = writeList(m.claude);
  if (list === null)
    return ["CD-13: CLAUDE.md has no list «ORCH writes by itself only this»"];
  const got = listItems(list);
  const out = [];
  const short = (s) => `«${s.slice(0, 48)}…»`;
  for (const s of got)
    if (!ORCH_LIST.includes(s))
      out.push(`CD-13: an item the design's list does not have: ${short(s)}`);
  for (const s of ORCH_LIST)
    if (!got.includes(s))
      out.push(`CD-13: an item of the design's list is missing: ${short(s)}`);
  if (!out.length && got.join("\n") !== ORCH_LIST.join("\n"))
    out.push(
      "CD-13: the items are not in the design's order, or one is doubled",
    );
  return out;
}

// ---- CD-6: README.md ------------------------------------------------------------------

function cd6(m) {
  const out = [];
  const add = (msg) => out.push(`CD-6: ${msg}`);
  const t = m.readme;
  for (const w of README_GONE)
    if (t.includes(w)) add(`README.md still has «${w}»`);
  if (/in the order of .PLAN[.]md./u.test(t))
    add("README.md still says «in the order of `PLAN.md`»");
  for (const w of ["AUD-001", "docs/audits/README.md"])
    if (!t.includes(w)) add(`README.md does not name «${w}»`);
  const lines = t.split("\n");
  const at = lines.flatMap((l, i) => (l.includes("REQ-008") ? [i] : []));
  if (at.length !== 1)
    add(
      `README.md has ${at.length} lines with REQ-008, need 1 (criterion 5 (d) reads that line and the next)`,
    );
  else {
    // Each of the three requirements stands next to the status word of its own status
    // line on the one REQ-008 line: the first word of a status after its id. One word may
    // serve all three, or the sentence may split them (decisions/0117 О51, F3).
    const sentence = lines[at[0]];
    for (const id of ["REQ-001", "REQ-007", "REQ-008"]) {
      const from = sentence.indexOf(id);
      const said =
        from === -1
          ? null
          : /\b(in_progress|blocked|pending|done|cancelled)\b/u.exec(
              sentence.slice(from + id.length),
            );
      const truth = statusOf(m.requirements, id);
      if (!said)
        add(`the REQ-008 sentence does not say a status word after ${id}`);
      else if (said[1] !== truth)
        add(
          `the REQ-008 sentence says «${said[1]}» for ${id}, the status lines of docs/requirements.yaml say ${truth}`,
        );
    }
    if (`${sentence}\n${lines[at[0] + 1] ?? ""}`.includes("still in"))
      add("the REQ-008 sentence still says «still in»");
  }
  // The forms of the time lines (their values are checked at the run).
  const asOf = lines.filter((l) =>
    /^As of [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z, /u.test(l),
  ).length;
  if (asOf !== 1) add(`README.md has ${asOf} lines «As of <time>, …», need 1`);
  const counts = lines.filter((l) => l.startsWith("- **Requirements:** "));
  if (
    counts.length !== 1 ||
    !new RegExp(`^- \\*\\*Requirements:\\*\\* ${COUNTS_FORM}$`, "u").test(
      counts[0],
    )
  )
    add(
      "README.md has no single counts line «- **Requirements:** <counts>» on one line",
    );
  const defects = lines.filter((l) => l.startsWith("- **Open defects: "));
  const total =
    defects.length === 1
      ? /^- \*\*Open defects: ([0-9]+)\*\* /u.exec(defects[0])
      : null;
  if (!total) add("README.md has no single line «- **Open defects: <n>** …»");
  else {
    const parts = [
      ...defects[0].matchAll(
        /([0-9]+) (critical|high|of medium severity|low)\b/gu,
      ),
    ];
    const sum = parts.reduce((t2, p) => t2 + Number(p[1]), 0);
    if (sum !== Number(total[1]) || !parts.some((p) => p[2] === "critical"))
      add(
        "the severities of the README defects line do not add up to its total",
      );
  }
  return out;
}

// ---- CD-7, CD-8: docs/product and ideas/README.md -------------------------------------

// Criterion 6 (a) reads the *.md files of docs/product: a .DS_Store or another entry that
// is not Markdown is not a snapshot (decisions/0117 О51, F5).
function cd7(m) {
  const product = m.product.filter(([name]) => name.endsWith(".md"));
  if (!product.length) return ["CD-7: docs/product holds no file *.md"];
  const out = [];
  const add = (msg) => out.push(`CD-7: ${msg}`);
  for (const [name, body] of product) {
    if (body === null) {
      add(`docs/product/${name} is not a file`);
      continue;
    }
    const [first = "", second = ""] = body.split("\n");
    if (
      !/^Snapshot of [0-9]{4}-[0-9]{2}-[0-9]{2}; current: docs\/program\/public-v1\/$/u.test(
        first,
      )
    )
      add(
        `docs/product/${name}: line 1 is not «Snapshot of <date>; current: docs/program/public-v1/»`,
      );
    if (!second.startsWith("# "))
      add(`docs/product/${name}: line 2 is not the heading of the snapshot`);
  }
  return out;
}

function cd8(m) {
  const rows = m.ideas
    .split("\n")
    .flatMap((l, i) =>
      l.startsWith("| [02-sai.md](02-sai.md) |") ? [[i + 1, l]] : [],
    );
  if (rows.length !== 1)
    return [
      `CD-8: ideas/README.md has ${rows.length} rows of 02-sai.md, need 1`,
    ];
  const out = [];
  const add = (msg) => out.push(`CD-8: ${msg}`);
  const [n, row] = rows[0];
  const cells = row.split("|");
  if (cells.length !== 5 || cells[0] !== "" || cells[4] !== "")
    add(
      `ideas/README.md line ${n}: the row has ${cells.length - 2} cells, need 3`,
    );
  if (row.includes("Выбрана"))
    add(`ideas/README.md line ${n}: still «Выбрана»`);
  if (!(cells[3] ?? "").includes("decisions/0033"))
    add(
      `ideas/README.md line ${n}: the status cell does not name decisions/0033`,
    );
  return out;
}

// ---- CD-9: the four cancelled handoffs ------------------------------------------------

const STRICT_TIME = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/u;
const PATH_IN_TEXT =
  /(?<![A-Za-z0-9_./-])(?:decisions|handoffs|docs|runs|tools|ideas)\/[A-Za-z0-9._/-]*[A-Za-z0-9_-]/gu;

function cd9(m) {
  const out = [];
  const add = (msg) => out.push(`CD-9: ${msg}`);
  for (const [file, fields, hash] of FOUR) {
    const j = m.four[file];
    if (j === null) {
      add(`${file} does not exist`);
      continue;
    }
    if (j === UNREADABLE) {
      add(`${file} is not a JSON object`);
      continue;
    }
    if (j.status !== "CANCELLED") add(`${file}: its status is not CANCELLED`);
    const kept = fields.every((k) => Object.hasOwn(j, k));
    const picked = Object.fromEntries(fields.map((k) => [k, j[k]]));
    if (!kept || sha256(canonical(picked)) !== hash)
      add(
        `${file}: a field it had at the base tag (other than status) is changed or gone`,
      );
    const c = j.orch_cancellation;
    if (!isObject(c)) {
      add(`${file}: no orch_cancellation object`);
      continue;
    }
    if (c.by !== "ORCH") add(`${file}: orch_cancellation.by is not «ORCH»`);
    if (typeof c.at !== "string" || !STRICT_TIME.test(c.at))
      add(`${file}: orch_cancellation.at is not a time YYYY-MM-DDTHH:MM:SSZ`);
    if (typeof c.reason !== "string" || [...c.reason].length <= 20) {
      add(`${file}: orch_cancellation.reason is not longer than 20 characters`);
      continue;
    }
    const named = [
      ...new Set(
        (c.reason.match(PATH_IN_TEXT) ?? []).map((p) =>
          p.replace(/[./]+$/u, ""),
        ),
      ),
    ];
    if (
      !named.some(
        (p) => p.startsWith("decisions/") || p.startsWith("handoffs/"),
      )
    )
      add(`${file}: the reason names no record under decisions/ or handoffs/`);
    for (const p of named) {
      if (p.split("/").some((s) => s === "." || s === ".."))
        add(`${file}: the reason names a path with «.» or «..»: ${p}`);
      else if (!m.exists(p))
        add(`${file}: the reason names ${p}, which does not exist`);
    }
  }
  return out;
}

// ---- CD-11: key shapes and personal data (decisions/0117 О44) --------------------------

const reservedDomain = (d) =>
  /(?:^|\.)(?:example\.(?:com|net|org)|example|invalid|test|localhost)$/iu.test(
    d,
  );

function luhn(ds) {
  let sum = 0;
  for (let i = 0; i < ds.length; i += 1) {
    let v = Number(ds[ds.length - 1 - i]);
    if (i % 2 === 1) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
  }
  return sum % 10 === 0;
}

function publicIp([a, b, c, d]) {
  if ([a, b, c, d].some((x) => x > 255)) return false;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

// [name, pattern, keep?]: a match that `keep` refuses is not a finding. A finding names
// the place and the shape, never the matched text (AP-152).
const SHAPES = [
  ["an AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/gu],
  [
    "a GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/gu,
  ],
  ["an sk- key", /\bsk-[A-Za-z0-9_-]{20,}/gu],
  ["a Slack token", /\bxox[abposr]-[A-Za-z0-9-]{10,}/gu],
  ["a Stripe key", /\b[prs]k_(?:live|test)_[A-Za-z0-9]{16,}/gu],
  ["a Google API key", /\bAIza[0-9A-Za-z_-]{30,}/gu],
  ["a Telegram bot token", /(?<![0-9A-Za-z])[0-9]{8,10}:[A-Za-z0-9_-]{30,}/gu],
  ["an npm token", /\bnpm_[A-Za-z0-9]{30,}/gu],
  ["a private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/gu],
  [
    "a JSON web token",
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu,
  ],
  ["a Bearer token", /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/gu],
  [
    "a password in an address",
    /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/gu,
  ],
  [
    "a secret given to a name",
    /(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)["'`]?\s*[:=]\s*["'`]?[A-Za-z0-9_+/=.-]{12,}/giu,
  ],
  [
    "an e-mail address",
    /([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/gu,
    (h) => h[1] !== "git" && !reservedDomain(h[2]),
  ],
  [
    "a phone number",
    /\+[0-9][0-9 ()-]{8,}[0-9]/gu,
    (h) => digits(h[0]).length >= 10 && digits(h[0]).length <= 15,
  ],
  [
    "a 12-digit identity number",
    /(?<![0-9A-Za-z])[0-9]{12}(?![0-9A-Za-z])/gu,
    // A GitHub run id is not an identity number: inside an actions/runs/ link or right
    // after the word «run» (decisions/0117 О51, F4).
    (h) => !/(?:actions\/runs\/|\bruns? )$/iu.test(h.input.slice(0, h.index)),
  ],
  [
    "a card number",
    /(?<![0-9A-Za-z])(?:[0-9]{4}[ -]){3}[0-9]{1,7}(?![0-9A-Za-z])|(?<![0-9A-Za-z])[0-9]{13,19}(?![0-9A-Za-z])/gu,
    (h) => luhn(digits(h[0])),
  ],
  [
    "a public IP address",
    /(?<![0-9.])([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})(?![0-9.]|\/[0-9])/gu,
    (h) => publicIp(h.slice(1, 5).map(Number)),
  ],
  ["a bank account number (IBAN)", /\bKZ[0-9]{2}[0-9A-Z]{16}\b/gu],
];

// The texts of the scan: the four root documents, ideas/README.md, docs/product, and the
// reason of every cancellation of the repository.
function scanTexts(m) {
  const texts = [
    ["STATE.md", m.state.toString("utf8")],
    ["PLAN.md", m.plan],
    ["CLAUDE.md", m.claude],
    ["README.md", m.readme],
    ["ideas/README.md", m.ideas],
    ...m.product
      .filter(([, body]) => body !== null)
      .map(([name, body]) => [`docs/product/${name}`, body]),
  ];
  const reasons = new Map(m.cancelled);
  for (const [file, j] of Object.entries(m.four))
    if (isObject(j)) reasons.set(file, j);
  for (const [file, j] of reasons) {
    const reason = j.orch_cancellation?.reason;
    if (typeof reason === "string")
      texts.push([`${file} (orch_cancellation.reason)`, reason]);
  }
  return texts;
}

// The shapes of personal data; the rest of SHAPES are key shapes (decisions/0117 О51, F4).
const PERSONAL = new Set([
  "an e-mail address",
  "a phone number",
  "a 12-digit identity number",
  "a card number",
  "a public IP address",
  "a bank account number (IBAN)",
]);

// The lines of the WF-06 block of STATE.md, from the start marker to the end marker.
// apply-verdict copies the analysts' reasons there, and the sources under runs/ are read
// by the traces check, so the personal-data shapes do not read it; the key shapes do.
// With the markers not once each, start before end, the whole file is read.
function wf06Lines(text) {
  const lines = text.split("\n");
  const s = indexes(lines, START);
  const e = indexes(lines, END);
  const inside = new Set();
  if (s.length === 1 && e.length === 1 && s[0] < e[0])
    for (let i = s[0]; i <= e[0]; i += 1) inside.add(i);
  return inside;
}

function cd11(m) {
  const out = [];
  for (const [where, body] of scanTexts(m)) {
    const unread = where === "STATE.md" ? wf06Lines(body) : new Set();
    body.split("\n").forEach((line, i) => {
      for (const [name, re, keep] of SHAPES) {
        if (unread.has(i) && PERSONAL.has(name)) continue;
        for (const hit of line.matchAll(re))
          if (!keep || keep(hit)) {
            out.push(`CD-11: ${where} line ${i + 1}: ${name}`);
            break;
          }
      }
    });
  }
  return out;
}

// ---- CD-12: who cancels (decisions/0117 О44, О48) ------------------------------------

function cd12(m) {
  const out = [];
  const add = (msg) => out.push(`CD-12: ${msg}`);
  const byFile = new Map(m.cancelled);
  for (const [file, j] of m.cancelled) {
    const c = j.orch_cancellation;
    if (!isObject(c)) {
      add(`${file}: cancelled with no orch_cancellation object`);
      continue;
    }
    if (Object.hasOwn(c, "by")) {
      if (c.by !== "ORCH")
        add(
          `${file}: orch_cancellation.by is not «ORCH»: only ORCH cancels a handoff`,
        );
    } else if (!HISTORY_WITHOUT_BY.includes(file))
      add(
        `${file}: orch_cancellation has no «by», and the file is not one of the two named records of 2026-09-28`,
      );
  }
  for (const file of HISTORY_WITHOUT_BY) {
    const j = byFile.get(file);
    if (!j || j.status !== "CANCELLED")
      add(`${file}: the named history exception is not a cancelled handoff`);
  }
  for (const [file, , cancelLike] of m.unreadable)
    if (cancelLike)
      add(`${file} is not a JSON object: its cancellation cannot be read`);
  return out;
}

// ---- the tests ------------------------------------------------------------------------

const RULES = {
  "CD-1": cd1,
  "CD-2": cd2,
  "CD-3": cd3,
  "CD-4": cd4,
  "CD-5": cd5,
  "CD-6": cd6,
  "CD-7": cd7,
  "CD-8": cd8,
  "CD-9": cd9,
  "CD-11": cd11,
  "CD-12": cd12,
  "CD-13": cd13,
};
const findings = (m) => Object.values(RULES).flatMap((rule) => rule(m));

test("REQ-103 criterion 1, CD-1: the two archive copies are the bytes of the record pre_state (sha256, git blob, size, lines), and the run has exactly two", () => {
  assert.deepEqual(cd1(real()), []);
});

test("REQ-103 criterion 2 (a), (b), (d), (f), CD-2: STATE.md is one screen: below 40000 bytes, --- at most at line 50 after an empty line, the anchors and the markers once, the labels once, SHAPE, the count forms and the durable part of GATESEQ", () => {
  assert.deepEqual(cd2(real()), []);
});

test("REQ-103 criterion 2 (c), CD-3 (decisions/0117 О47): the tail of STATE.md equals the archive copy outside the WF-06 block and the owner's records", () => {
  assert.deepEqual(cd3(real()), []);
});

test("REQ-103 criterion 3, CD-4: the root PLAN.md is the current iteration of PUBLIC-V1, and every row of its table is a live requirement whose Run is the run of its first passing gate", () => {
  assert.deepEqual(cd4(real()), []);
});

test("REQ-103 criterion 4 (a), (c), CD-5: CLAUDE.md says what is built now and lets ORCH write the program files and append the owner's words", () => {
  assert.deepEqual(cd5(real()), []);
});

test("REQ-103 criterion 5 (a), (d), (g), CD-6: README.md has none of the false sentences, names the audit, states the status of REQ-001, REQ-007, REQ-008 on one line, and keeps its count lines in their form", () => {
  assert.deepEqual(cd6(real()), []);
});

test("REQ-103 criterion 6 (a), CD-7: every file of docs/product begins with the snapshot line, then its heading", () => {
  assert.deepEqual(cd7(real()), []);
});

test("REQ-103 criterion 6 (b), CD-8: the row of 02-sai.md in ideas/README.md has three cells and names decisions/0033, not «Выбрана»", () => {
  assert.deepEqual(cd8(real()), []);
});

test("REQ-103 criterion 7, CD-9: the four stale handoffs are CANCELLED by ORCH with a strict time and a reason whose paths exist, and nothing they held is rewritten", () => {
  assert.equal(FOUR.length, 4);
  assert.deepEqual(cd9(real()), []);
});

test("REQ-103 Q7, CD-11 (decisions/0117 О44): the root documents, docs/product, ideas/README.md and every cancellation reason hold no key shape and no personal data", () => {
  assert.deepEqual(cd11(real()), []);
});

test("REQ-103 criterion 7, CD-12 (decisions/0117 О44, О48): every cancelled handoff of the repository was cancelled by ORCH; only the two named records of 2026-09-28 have no «by»", () => {
  assert.equal(HISTORY_WITHOUT_BY.length, 2);
  assert.deepEqual(cd12(real()), []);
});

test("REQ-103 criterion 4 (c), CD-13 (decisions/0117 О44): ORCH's closed write list in CLAUDE.md equals the design's list, item by item", () => {
  assert.equal(ORCH_LIST.length, 11);
  assert.deepEqual(cd13(real()), []);
});

// ---- CD-10: the rules are not blind ---------------------------------------------------
// Each damage is built from the shape of a file, not from today's values (an open gate, a
// count, a status word, the size), so the cases still apply when those lines change.

function change(text, from, to) {
  if (!text.includes(from))
    throw new Error(
      `the damage does not apply: «${from.slice(0, 40)}» is not in the text`,
    );
  return text.replace(from, () => to);
}

function rx(text, re, fn) {
  if (!re.test(text))
    throw new Error(`the damage does not apply: no match of ${re}`);
  return text.replace(re, fn);
}

function lineIndex(lines, pred) {
  const i = lines.findIndex(pred);
  if (i === -1) throw new Error("the damage does not apply: no such line");
  return i;
}

function editLines(text, fn) {
  const lines = text.split("\n");
  fn(lines);
  return lines.join("\n");
}

const insertAfter = (text, pred, ...added) =>
  editLines(text, (lines) =>
    lines.splice(lineIndex(lines, pred) + 1, 0, ...added),
  );
const insertBefore = (text, pred, ...added) =>
  editLines(text, (lines) => lines.splice(lineIndex(lines, pred), 0, ...added));
const removeLine = (text, pred) =>
  editLines(text, (lines) => lines.splice(lineIndex(lines, pred), 1));
const replaceLine = (text, pred, fn) =>
  editLines(text, (lines) => {
    const i = lineIndex(lines, pred);
    lines[i] = fn(lines[i]);
  });
const swapLines = (text, predA, predB) =>
  editLines(text, (lines) => {
    const a = lineIndex(lines, predA);
    const b = lineIndex(lines, predB);
    [lines[a], lines[b]] = [lines[b], lines[a]];
  });
const starts = (prefix) => (l) => l.startsWith(prefix);
const is = (line) => (l) => l === line;

const stateText = (m) => m.state.toString("utf8");
const withState = (m, fn) => ({
  ...m,
  state: Buffer.from(fn(stateText(m)), "utf8"),
});
const withText = (m, field, fn) => ({ ...m, [field]: fn(m[field]) });
const withArchive = (m, file, fn) => ({
  ...m,
  archive: { ...m.archive, [file]: fn(m.archive[file]) },
});

// A copy of one of the four handoffs, changed by `fn`; the list of cancellations follows.
function withFour(m, file, fn) {
  const j =
    m.four[file] === null ? null : JSON.parse(JSON.stringify(m.four[file]));
  const result = fn(j);
  const next = result === undefined ? j : result;
  const cancelLike =
    isObject(next) &&
    (next.status === "CANCELLED" || Object.hasOwn(next, "orch_cancellation"));
  const cancelled = m.cancelled.filter(([f]) => f !== file);
  if (cancelLike) cancelled.push([file, next]);
  return { ...m, four: { ...m.four, [file]: next }, cancelled };
}

// The section «What we are building» or ORCH's write list, changed by `fn`.
function editPart(text, isStart, fn) {
  const lines = text.split("\n");
  const start = lineIndex(lines, isStart);
  let end = start + 1;
  while (end < lines.length && !/^## /u.test(lines[end])) end += 1;
  const part = lines.slice(start, end).join("\n");
  return [...lines.slice(0, start), fn(part), ...lines.slice(end)].join("\n");
}
const inWhat = (fn) => (text) =>
  editPart(text, is("## What we are building"), fn);
const inList = (fn) => (text) =>
  editPart(text, starts("ORCH writes by itself only this"), fn);

// M15: the two new items of ORCH's list (however they are wrapped) moved after
// «## Workflows».
function movedItems(text) {
  const lines = text.split("\n");
  const at = lineIndex(
    lines,
    starts("- the files of the program in `docs/program/public-v1/**`"),
  );
  let end = at + 1;
  let items = 1;
  while (end < lines.length) {
    if (lines[end].startsWith("- ")) {
      items += 1;
      if (items > 2) break;
    } else if (!lines[end].startsWith("  ")) break;
    end += 1;
  }
  const moved = lines.splice(at, end - at);
  lines.splice(lineIndex(lines, is("## Workflows")) + 1, 0, "", ...moved);
  return lines.join("\n");
}

function setStatus(yaml, id, status) {
  return editLines(yaml, (lines) => {
    const at = lineIndex(lines, is(`  - id: ${id}`));
    const i = lines.findIndex((l, k) => k > at && /^ {4}status: /u.test(l));
    lines[i] = `    status: ${status}`;
  });
}

// The gate lines of the block replaced by `gateLines` (whatever gates are open now).
function withGateLines(text, gateLines) {
  return editLines(text, (lines) => {
    const g = lineIndex(lines, starts("**Open gates:** "));
    while (g + 2 < lines.length && lines[g + 2].startsWith("- "))
      lines.splice(g + 2, 1);
    lines.splice(g + 2, 0, ...gateLines);
  });
}

// The REQ-008 sentence with its status word given by `fn(word)`; the word is read.
function req008(text, fn) {
  return replaceLine(
    text,
    (l) => l.includes("REQ-008"),
    (l) => {
      const said = /REQ-008\) are `?([a-z_]+)`?/u.exec(l);
      if (!said)
        throw new Error(
          "the damage does not apply: no status word on the REQ-008 line",
        );
      return l.replace(said[0], () => fn(said[1]));
    },
  );
}

// A requirement id that is never used (the ids start at REQ-001), for made-up rows.
const NONE = "REQ-000";
const noneBlock = (status) =>
  `\n  - id: ${NONE}\n    title: an example\n    status: ${status}\n`;

// The WF-06 block the way apply-verdict writes it (REQ-002, REQ-004; placeBlock of
// tools/src/apply.js, read as text): the lines from the start marker to the end marker are
// replaced by a block that starts with the start marker and the block heading and ends
// with the end marker.
function placeLikeApplyVerdict(text, block) {
  const lines = text.split("\n");
  const s = lineIndex(lines, is(START));
  const e = lineIndex(lines, is(END));
  return [...lines.slice(0, s), ...block, ...lines.slice(e + 1)].join("\n");
}
const RECOMMEND = [
  START,
  BLOCK,
  "",
  "Прогон `WF06-20991231-01`, вердикт версии 1 от 2099-12-31.",
  "Рекомендованная идея: **Пример** (`01-example`), уверенность: средняя.",
  "",
  "Причины:",
  "- первая причина",
  "",
  "Условия:",
  "- первое условие",
  "",
  "Остановиться, если:",
  "- первый признак",
  "",
  "Решение принимает владелец. До его записи код продукта не пишется.",
  "Подробно: `runs/WF06-20991231-01/verdict-1.md`; следующие шаги для ORCH: `runs/WF06-20991231-01/proposed-actions.json`.",
  END,
];
const ESCALATE = [
  START,
  BLOCK,
  "",
  "Прогон `WF06-20991231-01`: агенты не пришли к принятому вердикту за 3 проверки.",
  "Нужно решение владельца.",
  "",
  "Последние замечания исполнителя:",
  "- замечание",
  "",
  "Решение принимает владелец. До его записи код продукта не пишется.",
  "Подробно: `runs/WF06-20991231-01/verdict-3.md`, `runs/WF06-20991231-01/verdict-review-3.json`.",
  END,
];
const OWNER_RECORD = [
  "**2099-12-31 — запись владельца о старте (пример).** Слова владельца записаны здесь.",
  "",
];

const ISS = FOUR[3][0];
const STEP12 = FOUR[2][0];
const STATE_ARCHIVE = ARCHIVES[0].path;
const PLAN_ARCHIVE = ARCHIVES[1].path;

// Planted shapes, each made from parts at run time, so this file holds none of them.
const PLANTS = [
  ["an AWS access key", "AKIA" + "Q7".repeat(8)],
  ["a GitHub token", "gh" + "p_" + "a1".repeat(18)],
  ["an sk- key", "sk" + "-ant-" + "b2".repeat(12)],
  ["a Slack token", "xo" + "xb-" + "1234567890-abcdefgh"],
  ["a Stripe key", "sk" + "_live_" + "c3".repeat(10)],
  ["a Google API key", "AI" + "za" + "d4".repeat(17) + "e"],
  ["a Telegram bot token", "123456789" + ":" + "f5".repeat(17) + "g"],
  ["an npm token", "np" + "m_" + "h6".repeat(18)],
  ["a private key block", "-----BEGIN " + "RSA PRIVATE" + " KEY-----"],
  [
    "a JSON web token",
    "ey" +
      "JhbGciOiJIUzI1NiJ9" +
      "." +
      "ey" +
      "JzdWIiOiJ4In0" +
      "." +
      "c2lnbmF0dXJl",
  ],
  ["a Bearer token", "Bea" + "rer " + "k7".repeat(10)],
  [
    "a password in an address",
    "https" + "://" + "user:" + "pw-x" + "@host.example",
  ],
  ["a secret given to a name", "SAI_TEAM_" + "TOKEN=" + "m8".repeat(8)],
  ["an e-mail address", "a.person" + "@" + "sai-person.kz"],
  ["a phone number", "+7" + " 701 123 45 67"],
  ["a 12-digit identity number", "8501" + "01300123"],
  ["a card number", "4111" + " 1111 1111 1111"],
  ["a public IP address", "93.184" + ".216.34"],
  ["a bank account number (IBAN)", "KZ86" + "125KZT5004100100"],
];
const PLACES = [
  [
    "the Next step line of STATE.md",
    (m, v) =>
      withState(m, (t) =>
        replaceLine(t, starts("**Next step:** "), (l) => `${l} ${v}`),
      ),
  ],
  ["the tail of STATE.md", (m, v) => withState(m, (t) => `${t}${v}\n`)],
  ["PLAN.md", (m, v) => withText(m, "plan", (t) => `${t}\n${v}\n`)],
  ["CLAUDE.md", (m, v) => withText(m, "claude", (t) => `${t}\n${v}\n`)],
  ["README.md", (m, v) => withText(m, "readme", (t) => `${t}\n${v}\n`)],
  ["ideas/README.md", (m, v) => withText(m, "ideas", (t) => `${t}\n${v}\n`)],
  [
    "a file of docs/product",
    (m, v) => ({
      ...m,
      product: m.product.map(([n, b], i) => [n, i === 0 ? `${b}\n${v}\n` : b]),
    }),
  ],
  [
    "a cancellation reason",
    (m, v) =>
      withFour(m, STEP12, (j) => {
        j.orch_cancellation.reason += ` ${v}`;
      }),
  ],
];
const ID_SHAPE = "a 12-digit identity number";
// A GitHub run id of 12 digits (they are 11 digits today), made from parts.
const RUN_ID = "4396" + "87012420";
const BENIGN = [
  "the server listens on 127.0.0.1:4780 and the docs use a@example.invalid and owner@host.example",
  "clone git@github.com:owner/sai.git; sha256 728cb4eae27bf23c4f05c8d9c3dc886bf1c6174d3c593f58ccf13f2aa5b2ced6",
  "run ISS-0093-20261028-01 at 2026-11-18T05:27:52Z on Node 22.23.4; the GitHub run 41677599441",
  "the token of the session; `SAI_TEAM_TOKEN` names a variable; token: short; 10.0.0.0/8, 192.0.2.1",
  "13 digits 1000000000000 and the time zone +05:00",
];

function cases(m) {
  const red = (name, id, has, make) => ({ name, id, has, make });
  const green = (name, ids, make) => ({ name, ids, make });
  const journal = "- **2026-11-18T10:00:00Z — a run X done (a journal line).**";
  const rows = gateRows(m.progress);
  // The gate entries of a parsed handoff of an earlier run, added to the model the way
  // readHandoffs adds them (the rule `gatesOf` decides which of them count).
  const earlierGate = (patch) => ({
    to_agent: "REQ-VALIDATOR",
    run_id: "OTHER-20261001-01",
    completed_at: "2026-10-01T00:00:00Z",
    context: { requirement_ids: ["REQ-103"] },
    result: { verdict: "PASS" },
    ...patch,
  });
  const withGates = (x, json) => ({
    ...x,
    gates: [...x.gates, ...gatesOf(json)],
  });
  // The REQ-008 line of README.md replaced by `text`, and the status lines of REQ-001,
  // REQ-007 and REQ-008 set to `statuses`, so the case does not depend on today's words.
  const sentence = (x, text, statuses) => ({
    ...x,
    readme: replaceLine(
      x.readme,
      (l) => l.includes("REQ-008"),
      () => text,
    ),
    requirements: ["REQ-001", "REQ-007", "REQ-008"].reduce(
      (y, id, i) => setStatus(y, id, statuses[i]),
      x.requirements,
    ),
  });
  const SHARED =
    "The requirements for the core of Pixel Office (REQ-001, REQ-007, REQ-008) are `blocked`:";
  const SPLIT =
    "The requirements for the core of Pixel Office: REQ-001 is `done`; the other two (REQ-007, REQ-008) are `blocked`:";
  const SPLIT_BACK =
    "The requirements for the core of Pixel Office: REQ-007 and REQ-008 are `blocked`; REQ-001 is `done`:";
  const plant = (name) => PLANTS.find(([n]) => n === name)[1];
  // A WF-06 block the way apply-verdict writes it, the reasons holding the named shapes.
  const blockWith = (...names) => [
    START,
    BLOCK,
    "",
    "Причины:",
    ...names.map((n) => `- ${plant(n)}`),
    "",
    END,
  ];
  const PERSONAL_NAMES = [...PERSONAL];
  const atGates = (t, line) =>
    editLines(t, (l) =>
      l.splice(lineIndex(l, starts("**Open gates:** ")) + 2, 0, line),
    );
  return [
    // CD-1
    red(
      "M03: the final line break of the STATE archive removed",
      "CD-1",
      "sha256",
      (x) => withArchive(x, STATE_ARCHIVE, (b) => b.subarray(0, b.length - 1)),
    ),
    red(
      "M01, MR02: the STATE archive without line 52, written after the tag",
      "CD-1",
      "bytes",
      (x) =>
        withArchive(x, STATE_ARCHIVE, (b) =>
          Buffer.from(
            editLines(b.toString("utf8"), (l) => l.splice(51, 1)),
            "utf8",
          ),
        ),
    ),
    red("one byte of the PLAN archive changed", "CD-1", "sha256", (x) =>
      withArchive(x, PLAN_ARCHIVE, (b) => {
        const c = Buffer.from(b);
        c[100] = c[100] === 0x41 ? 0x42 : 0x41;
        return c;
      }),
    ),
    red("the PLAN archive missing", "CD-1", "does not exist", (x) =>
      withArchive(x, PLAN_ARCHIVE, () => null),
    ),
    red("a third copy named for the run", "CD-1", "copies of the run", (x) => ({
      ...x,
      archiveNames: [...x.archiveNames, `README-until-${RUN}.md`],
    })),
    // CD-2
    red(
      "M04: the anchor «… — по порядку» with a hyphen",
      "CD-2",
      "stands 0 times",
      (x) =>
        withState(x, (t) =>
          change(t, NEXT, "### Что делать дальше - по порядку"),
        ),
    ),
    red(
      "M07: lines added until --- passes line 50",
      "CD-2",
      "at most at line 50",
      (x) =>
        withState(x, (t) =>
          insertAfter(
            t,
            starts("**Open gates:** "),
            ...Array(Math.max(1, 51 - t.split("\n").indexOf("---"))).fill(
              "- a filler line of the block",
            ),
          ),
        ),
    ),
    red(
      "M08, V26: no empty line before the line ---",
      "CD-2",
      "no empty line before",
      (x) => withState(x, (t) => change(t, "\n\n---\n", "\n---\n")),
    ),
    red("M09: a second **State:** line", "CD-2", "label «State»", (x) =>
      withState(x, (t) =>
        insertAfter(
          t,
          starts("**State:** "),
          "**State:** a second state line.",
        ),
      ),
    ),
    red("a second «Next step» label", "CD-2", "label «Next step»", (x) =>
      withState(x, (t) =>
        insertAfter(t, starts("**Next step:** "), "Next step: again."),
      ),
    ),
    red(
      "V09, MR05: a dated journal line after the defects line",
      "CD-2",
      "SHAPE",
      (x) =>
        withState(x, (t) =>
          insertAfter(t, starts("- Open defects ("), journal),
        ),
    ),
    red(
      "V09b: the same journal line among the gate lines",
      "CD-2",
      "SHAPE",
      (x) => withState(x, (t) => atGates(t, journal)),
    ),
    red(
      "V09c: a journal line with a date only among the gate lines",
      "CD-2",
      "names no row",
      (x) =>
        withState(x, (t) =>
          atGates(
            t,
            "- 2026-11-18 — ISS-0092 closed, a run X done (a journal line).",
          ),
        ),
    ),
    red("05b T15: a dated journal line above the title", "CD-2", "SHAPE", (x) =>
      withState(x, (t) => `${journal}\n${t}`),
    ),
    red("two gate lines out of the table order", "CD-2", "table order", (x) =>
      withState(x, (t) => withGateLines(t, [`- ${rows[1]}`, `- ${rows[0]}`])),
    ),
    red("a gate line doubled", "CD-2", "table order", (x) =>
      withState(x, (t) => withGateLines(t, [`- ${rows[0]}`, `- ${rows[0]}`])),
    ),
    green(
      "gate lines that are rows of the table, in its order",
      ["CD-2"],
      (x) =>
        withState(x, (t) =>
          withGateLines(t, [`- ${rows[0]}`, `- ${rows[rows.length - 1]}`]),
        ),
    ),
    red(
      "M18: the counts of the block wrapped over two lines",
      "CD-2",
      "counts on one line",
      (x) =>
        withState(x, (t) =>
          replaceLine(t, starts("- Requirements ("), (l) =>
            rx(l, /, ([0-9]+) blocked,/u, (_, n) => `,\n  ${n} blocked,`),
          ),
        ),
    ),
    red(
      "a severity of the defects line changed so the sum breaks",
      "CD-2",
      "add up",
      (x) =>
        withState(x, (t) =>
          replaceLine(t, starts("- Open defects ("), (l) =>
            rx(l, / ([0-9]+) low\.$/u, (_, n) => ` ${Number(n) + 1} low.`),
          ),
        ),
    ),
    red("M06: the end marker dropped", "CD-2", "markers", (x) =>
      withState(x, (t) => removeLine(t, is(END))),
    ),
    red("the start marker doubled", "CD-2", "markers", (x) =>
      withState(x, (t) => insertAfter(t, is(START), START)),
    ),
    red(
      "a dated line between --- and the owner heading",
      "CD-2",
      "after the line ---",
      (x) =>
        withState(x, (t) =>
          change(
            t,
            `---\n\n${OWNER}`,
            `---\n\n- 2026-11-18 — a run X done.\n${OWNER}`,
          ),
        ),
    ),
    red("STATE.md grows to 40000 bytes", "CD-2", "below 40000", (x) =>
      withState(x, (t) =>
        insertBefore(
          t,
          is(START),
          "x".repeat(Math.max(1, 40000 - Buffer.byteLength(t, "utf8"))),
          "",
        ),
      ),
    ),
    red("no line --- at all", "CD-2", "no line ---", (x) =>
      withState(x, (t) => removeLine(t, is("---"))),
    ),
    // CD-3
    red(
      "M11t, MR01: the final line break of STATE.md removed",
      "CD-3",
      "after the end marker",
      (x) => withState(x, (t) => t.slice(0, -1)),
    ),
    red(
      "one word changed in «Что делать дальше»",
      "CD-3",
      "after the end marker",
      (x) =>
        withState(x, (t) =>
          editLines(t, (l) => {
            const i = l.findIndex(
              (s, k) => k > l.indexOf(NEXT) && s.trim() !== "",
            );
            l[i] = `${l[i]} (changed)`;
          }),
        ),
    ),
    red(
      "an empty line added after the end marker",
      "CD-3",
      "after the end marker",
      (x) => withState(x, (t) => insertAfter(t, is(END), "")),
    ),
    red("the start marker lost", "CD-3", "markers", (x) =>
      withState(x, (t) => removeLine(t, is(START))),
    ),
    red("the start marker doubled", "CD-3", "markers", (x) =>
      withState(x, (t) => insertAfter(t, is(START), START)),
    ),
    red("the markers in the wrong order", "CD-3", "markers", (x) =>
      withState(x, (t) => swapLines(t, is(START), is(END))),
    ),
    red("the end marker lost", "CD-3", "markers", (x) =>
      withState(x, (t) => removeLine(t, is(END))),
    ),
    red(
      "a heading inside the owner's section",
      "CD-3",
      "owner's section",
      (x) =>
        withState(x, (t) => insertAfter(t, is(OWNER), "### Another section")),
    ),
    red(
      "the block heading after the start marker replaced",
      "CD-3",
      "after the start marker",
      (x) =>
        withState(x, (t) =>
          change(t, `${START}\n${BLOCK}`, `${START}\n### Something else`),
        ),
    ),
    green(
      "a new recommendation block made the way apply-verdict makes it",
      ["CD-2", "CD-3"],
      (x) => withState(x, (t) => placeLikeApplyVerdict(t, RECOMMEND)),
    ),
    green(
      "an escalation block made the way apply-verdict makes it",
      ["CD-2", "CD-3"],
      (x) => withState(x, (t) => placeLikeApplyVerdict(t, ESCALATE)),
    ),
    green(
      "an owner record added to the owner's section",
      ["CD-2", "CD-3"],
      (x) => withState(x, (t) => insertBefore(t, is(START), ...OWNER_RECORD)),
    ),
    green("an owner record and a new block together", ["CD-2", "CD-3"], (x) =>
      withState(x, (t) =>
        placeLikeApplyVerdict(
          insertBefore(t, is(START), ...OWNER_RECORD),
          RECOMMEND,
        ),
      ),
    ),
    // CD-4
    red(
      "M12: the old PLAN.md kept below the new head",
      "CD-4",
      "below 8000",
      (x) =>
        withText(
          x,
          "plan",
          (t) => `${t}\n${x.archive[PLAN_ARCHIVE].toString("utf8")}`,
        ),
    ),
    red("a heading «## Итерация 10» added", "CD-4", "Итерация", (x) =>
      withText(x, "plan", (t) => `${t}\n## Итерация 10 — the old way\n`),
    ),
    red("M13: «не более двух агентов»", "CD-4", "двух агентов", (x) =>
      withText(x, "plan", (t) =>
        change(t, "не больше двух агентов", "не более двух агентов"),
      ),
    ),
    red("no «PUBLIC-V1 milestone M<k>»", "CD-4", "PUBLIC-V1 milestone", (x) =>
      withText(x, "plan", (t) =>
        rx(t, /PUBLIC-V1 milestone M[0-9]+/gu, () => "PUBLIC-V1, a milestone"),
      ),
    ),
    red(
      "the program plan not named",
      "CD-4",
      "docs/program/public-v1/PLAN.md",
      (x) =>
        withText(x, "plan", (t) =>
          t
            .split("docs/program/public-v1/PLAN.md")
            .join("docs/program/public-v1/"),
        ),
    ),
    red("the row of REQ-103 dropped", "CD-4", "rows of REQ-103", (x) =>
      withText(x, "plan", (t) => removeLine(t, starts("| REQ-103 "))),
    ),
    red("the row of REQ-102 doubled", "CD-4", "rows of REQ-102", (x) =>
      withText(x, "plan", (t) =>
        editLines(t, (l) => {
          const i = lineIndex(l, starts("| REQ-102 "));
          l.splice(i, 0, l[i]);
        }),
      ),
    ),
    red("M40: a row of a cancelled requirement", "CD-4", "cancelled", (x) => ({
      ...x,
      requirements: `${x.requirements}${noneBlock("cancelled")}`,
      plan: insertAfter(
        x.plan,
        starts("| REQ-102 "),
        `| ${NONE} | R9.9 | X-20990101-01 |`,
      ),
    })),
    red(
      "MR04, V28b: the Run of REQ-103 is the amendment run",
      "CD-4",
      "first passing",
      (x) =>
        withText(x, "plan", (t) =>
          replaceLine(t, starts("| REQ-103 "), (l) =>
            rx(l, /\| [^|]+ \|$/u, () => "| REQ103AMEND-20261117-01 |"),
          ),
        ),
    ),
    red("a row of a requirement with no block", "CD-4", "no block", (x) =>
      withText(x, "plan", (t) =>
        insertAfter(
          t,
          starts("| REQ-102 "),
          `| ${NONE} | R9.9 | X-20990101-01 |`,
        ),
      ),
    ),
    red("a row that is not three cells", "CD-4", "not of the form", (x) =>
      withText(x, "plan", (t) =>
        insertAfter(t, starts("| REQ-102 "), `| ${NONE} | R9.9 |`),
      ),
    ),
    red(
      "the section «Requirements of the iteration» renamed",
      "CD-4",
      "sections «Requirements of the iteration»",
      (x) =>
        withText(x, "plan", (t) =>
          change(t, "## Requirements of the iteration", "## Requirements"),
        ),
    ),
    red(
      "an earlier passing gate of REQ-103 by another run",
      "CD-4",
      "first passing",
      (x) => ({
        ...x,
        gates: [
          ...x.gates,
          ["REQ-103", "2026-10-01T00:00:00Z", "OTHER-20261001-01"],
        ],
      }),
    ),
    red(
      "a gate handoff that does not parse",
      "CD-4",
      "first gate cannot be read",
      (x) => ({
        ...x,
        unreadable: [
          ...x.unreadable,
          ["handoffs/X-20990101-01/step-02-req-validator.json", true, false],
        ],
      }),
    ),
    red(
      "05b T02: an earlier passing handoff of REQ-103 to REQ-VALIDATOR by another run",
      "CD-4",
      "first passing",
      (x) => withGates(x, earlierGate({})),
    ),
    green(
      "05b T02: an earlier FAIL handoff of REQ-103 to REQ-VALIDATOR by another run",
      ["CD-4"],
      (x) => withGates(x, earlierGate({ result: { verdict: "FAIL" } })),
    ),
    green(
      "05b T02: an earlier PASS handoff of REQ-103 to another role by another run",
      ["CD-4"],
      (x) => withGates(x, earlierGate({ to_agent: "REVIEWER" })),
    ),
    green(
      "05b T02: an earlier handoff of REQ-103 that names no requirement list",
      ["CD-4"],
      (x) => withGates(x, earlierGate({ context: {} })),
    ),
    green(
      "an amendment gate of REQ-103 after its first gate",
      ["CD-4"],
      (x) => ({
        ...x,
        gates: [
          ...x.gates,
          ["REQ-103", "2099-12-31T00:00:00Z", "REQ103AMEND-20261117-01"],
        ],
      }),
    ),
    green("a new row whose Run is its first gate", ["CD-4"], (x) => ({
      ...x,
      gates: [...x.gates, [NONE, "2099-12-31T00:00:00Z", "NEW-20991231-01"]],
      requirements: `${x.requirements}${noneBlock("pending")}`,
      plan: insertAfter(
        x.plan,
        starts("| REQ-102 "),
        `| ${NONE} | R9.9 | NEW-20991231-01 |`,
      ),
    })),
    // CD-5
    red(
      "M35: «virtual team» removed from «What we are building»",
      "CD-5",
      "virtual team",
      (x) =>
        withText(
          x,
          "claude",
          inWhat((s) => s.split("virtual team").join("team")),
        ),
    ),
    red("PUBLIC-V1 removed from the section", "CD-5", "«PUBLIC-V1»", (x) =>
      withText(
        x,
        "claude",
        inWhat((s) => s.split("PUBLIC-V1").join("the program")),
      ),
    ),
    red(
      "the program plan path removed from the section",
      "CD-5",
      "docs/program/public-v1/PLAN.md",
      (x) =>
        withText(
          x,
          "claude",
          inWhat((s) =>
            s.split("docs/program/public-v1/PLAN.md").join("the plan"),
          ),
        ),
    ),
    red(
      "M15, MR08: the two new items moved after «## Workflows»",
      "CD-5",
      "docs/program/public-v1/**",
      (x) => withText(x, "claude", movedItems),
    ),
    red("«append» gone from the write list", "CD-5", "append", (x) =>
      withText(
        x,
        "claude",
        inList((s) => s.replace(/append/giu, "add")),
      ),
    ),
    // CD-13
    red("A16: an extra item in the list", "CD-13", "does not have", (x) =>
      withText(x, "claude", (t) =>
        insertBefore(
          t,
          starts("- moving a requirement status"),
          "- any other file ORCH chooses;",
        ),
      ),
    ),
    red("an item removed", "CD-13", "missing", (x) =>
      withText(x, "claude", (t) =>
        removeLine(t, is("- the fix on the short path of WF-02;")),
      ),
    ),
    red("the words of an item changed", "CD-13", "does not have", (x) =>
      withText(x, "claude", (t) => change(t, "prepare-run", "make-run")),
    ),
    red(
      "M15: the two new items moved after «## Workflows»",
      "CD-13",
      "missing",
      (x) => withText(x, "claude", movedItems),
    ),
    red("an item doubled", "CD-13", "order", (x) =>
      withText(x, "claude", (t) =>
        insertAfter(
          t,
          is("- the fix on the short path of WF-02;"),
          "- the fix on the short path of WF-02;",
        ),
      ),
    ),
    green("an item re-wrapped", ["CD-13"], (x) =>
      withText(
        x,
        "claude",
        inList((part) =>
          editLines(part, (l) => {
            const i = lineIndex(
              l,
              (s, k) => s.startsWith("- ") && (l[k + 1] ?? "").startsWith("  "),
            );
            l[i] = `${l[i]} ${l[i + 1].trim()}`;
            l.splice(i + 1, 1);
          }),
        ),
      ),
    ),
    // CD-6
    ...README_GONE.map((w) =>
      red(`the false sentence «${w}» back`, "CD-6", w, (x) =>
        withText(x, "readme", (t) => `${t}\n- ${w}\n`),
      ),
    ),
    red(
      "R1 not applied: «in the order of `PLAN.md`» back",
      "CD-6",
      "in the order of",
      (x) =>
        withText(
          x,
          "readme",
          (t) => `${t}\n  built, in the order of \`PLAN.md\`: until the\n`,
        ),
    ),
    red("AUD-001 not named", "CD-6", "«AUD-001»", (x) =>
      withText(x, "readme", (t) => t.split("AUD-001").join("AUD-000")),
    ),
    red(
      "docs/audits/README.md not named",
      "CD-6",
      "docs/audits/README.md",
      (x) =>
        withText(x, "readme", (t) =>
          t.split("docs/audits/README.md").join("docs/audits/INDEX.md"),
        ),
    ),
    red(
      "M20: the status moved off the REQ-008 line",
      "CD-6",
      "does not say",
      (x) => withText(x, "readme", (t) => req008(t, () => "REQ-008) are")),
    ),
    red("a second line with REQ-008", "CD-6", "lines with REQ-008", (x) =>
      withText(x, "readme", (t) => `${t}\nREQ-008 is named again.\n`),
    ),
    red(
      "the sentence names a status the blocks do not have",
      "CD-6",
      "status lines",
      (x) =>
        withText(x, "readme", (t) =>
          req008(
            t,
            (w) => `REQ-008) are \`${w === "done" ? "pending" : "done"}\``,
          ),
        ),
    ),
    red("the old sentence «are still in progress»", "CD-6", "still in", (x) =>
      withText(x, "readme", (t) => req008(t, () => "REQ-008) are still in")),
    ),
    red(
      "M18: the README counts wrapped over two lines",
      "CD-6",
      "counts line",
      (x) =>
        withText(x, "readme", (t) =>
          replaceLine(t, starts("- **Requirements:** "), (l) =>
            rx(l, /, ([0-9]+) blocked,/u, (_, n) => `,\n  ${n} blocked,`),
          ),
        ),
    ),
    red(
      "M19, MR07: the total of «Open defects» changed",
      "CD-6",
      "add up",
      (x) =>
        withText(x, "readme", (t) =>
          replaceLine(t, starts("- **Open defects: "), (l) =>
            rx(
              l,
              /^- \*\*Open defects: ([0-9]+)\*\*/u,
              (_, n) => `- **Open defects: ${Number(n) + 1}**`,
            ),
          ),
        ),
    ),
    red("a second «As of <time>» line", "CD-6", "As of", (x) =>
      withText(
        x,
        "readme",
        (t) => `${t}\nAs of 2026-11-18T05:27:52Z, again.\n`,
      ),
    ),
    green(
      "the sentence and the three status lines all `done`",
      ["CD-6"],
      (x) => ({
        ...x,
        readme: req008(x.readme, () => "REQ-008) are `done`"),
        requirements: ["REQ-001", "REQ-007", "REQ-008"].reduce(
          (y, id) => setStatus(y, id, "done"),
          x.requirements,
        ),
      }),
    ),
    green(
      "one status word for the three requirements, each status line the same",
      ["CD-6"],
      (x) => sentence(x, SHARED, ["blocked", "blocked", "blocked"]),
    ),
    green(
      "the split of O07: REQ-001 `done`, the other two `blocked`, as the status lines say",
      ["CD-6"],
      (x) => sentence(x, SPLIT, ["done", "blocked", "blocked"]),
    ),
    green(
      "the split the other way round: REQ-007 and REQ-008 first, REQ-001 last",
      ["CD-6"],
      (x) => sentence(x, SPLIT_BACK, ["done", "blocked", "blocked"]),
    ),
    red(
      "the split sentence, but REQ-007 is `done` in its block",
      "CD-6",
      "status lines",
      (x) => sentence(x, SPLIT, ["done", "done", "blocked"]),
    ),
    red(
      "the split sentence, but REQ-001 is still `blocked` in its block",
      "CD-6",
      "status lines",
      (x) => sentence(x, SPLIT, ["blocked", "blocked", "blocked"]),
    ),
    red(
      "05b T03: REQ-001 alone `in_progress` under the sentence that says `blocked`",
      "CD-6",
      "for REQ-001",
      (x) => sentence(x, SHARED, ["in_progress", "blocked", "blocked"]),
    ),
    red(
      "05b T03: REQ-007 alone `in_progress` under the sentence that says `blocked`",
      "CD-6",
      "for REQ-007",
      (x) => sentence(x, SHARED, ["blocked", "in_progress", "blocked"]),
    ),
    red(
      "05b T03: REQ-008 alone `in_progress` under the sentence that says `blocked`",
      "CD-6",
      "for REQ-008",
      (x) => sentence(x, SHARED, ["blocked", "blocked", "in_progress"]),
    ),
    red(
      "the sentence names only REQ-008, REQ-001 and REQ-007 are not on it",
      "CD-6",
      "does not say a status word after REQ-001",
      (x) =>
        sentence(x, "The window of REQ-008 is `blocked`:", [
          "blocked",
          "blocked",
          "blocked",
        ]),
    ),
    // CD-7
    green(
      "a .DS_Store, a non-Markdown file and a folder in docs/product are not snapshots",
      ["CD-7"],
      (x) => ({
        ...x,
        product: [
          ...x.product,
          [".DS_Store", "\u0000\u0000\u0000\u0001Bud1"],
          ["notes.txt", "no snapshot line here\n"],
          ["images", null],
        ],
      }),
    ),
    red("a Markdown file named like a folder", "CD-7", "sub.md", (x) => ({
      ...x,
      product: [...x.product, ["sub.md", null]],
    })),
    red(
      "docs/product holds only entries that are not Markdown",
      "CD-7",
      "no file",
      (x) => ({
        ...x,
        product: [[".DS_Store", "\u0000\u0000\u0000\u0001Bud1"]],
      }),
    ),
    red("M21: the snapshot line without the last /", "CD-7", "line 1", (x) => ({
      ...x,
      product: x.product.map(([n, b], i) => [
        n,
        i === 0 ? change(b, "public-v1/\n", "public-v1\n") : b,
      ]),
    })),
    red(
      "M22, MR09: an empty line after the snapshot line",
      "CD-7",
      "line 2",
      (x) => ({
        ...x,
        product: x.product.map(([n, b], i) => [
          n,
          i === x.product.length - 1 ? b.replace("\n", "\n\n") : b,
        ]),
      }),
    ),
    red("a fifth file without the snapshot line", "CD-7", "new.md", (x) => ({
      ...x,
      product: [...x.product, ["new.md", "# New\n"]],
    })),
    red("docs/product empty", "CD-7", "no file", (x) => ({
      ...x,
      product: [],
    })),
    // CD-8
    red("M23: «Выбрана» kept in the cell", "CD-8", "Выбрана", (x) =>
      withText(x, "ideas", (t) =>
        replaceLine(t, starts("| [02-sai.md](02-sai.md) |"), (l) =>
          rx(l, /\| ([^|]*) \|$/u, (_, c) => `| **Выбрана**; ${c} |`),
        ),
      ),
    ),
    red("M24, MR10: a | inside the cell", "CD-8", "cells", (x) =>
      withText(x, "ideas", (t) =>
        replaceLine(t, starts("| [02-sai.md](02-sai.md) |"), (l) =>
          rx(l, / \|$/u, () => " | x |"),
        ),
      ),
    ),
    red("decisions/0033 not named", "CD-8", "decisions/0033", (x) =>
      withText(x, "ideas", (t) =>
        replaceLine(t, starts("| [02-sai.md](02-sai.md) |"), (l) =>
          rx(l, /decisions\/0033/gu, () => "decisions/0034"),
        ),
      ),
    ),
    red("the row doubled", "CD-8", "rows of 02-sai.md", (x) =>
      withText(x, "ideas", (t) =>
        editLines(t, (l) => {
          const i = lineIndex(l, starts("| [02-sai.md](02-sai.md) |"));
          l.splice(i, 0, l[i]);
        }),
      ),
    ),
    // CD-9
    red(
      "M25, MR11: result.status of the ISS-0002 handoff changed",
      "CD-9",
      "base tag",
      (x) =>
        withFour(x, ISS, (j) => {
          j.result.status = "CANCELLED";
        }),
    ),
    red("M26, MR12: orch_cancellation without by", "CD-9", "by is not", (x) =>
      withFour(x, STEP12, (j) => {
        delete j.orch_cancellation.by;
      }),
    ),
    red("L3, A15a: a cancellation by REVIEWER", "CD-9", "by is not", (x) =>
      withFour(x, STEP12, (j) => {
        j.orch_cancellation.by = "REVIEWER";
      }),
    ),
    red("M27: at with milliseconds", "CD-9", ".at is not", (x) =>
      withFour(x, STEP12, (j) => {
        j.orch_cancellation.at = "2026-11-18T05:39:32.000Z";
      }),
    ),
    red("a reason of 20 characters", "CD-9", "20 characters", (x) =>
      withFour(x, STEP12, (j) => {
        j.orch_cancellation.reason = "x".repeat(20);
      }),
    ),
    red(
      "M38: a reason that names a missing decision file",
      "CD-9",
      "does not exist",
      (x) =>
        withFour(x, STEP12, (j) => {
          j.orch_cancellation.reason = change(
            j.orch_cancellation.reason,
            "decisions/0015-product-virtual-team-start.md",
            "decisions/0015-no-such-record.md",
          );
        }),
    ),
    red(
      "a reason that names no record under decisions/ or handoffs/",
      "CD-9",
      "names no record",
      (x) =>
        withFour(x, STEP12, (j) => {
          j.orch_cancellation.reason =
            "Not to be done any more: see docs/audits/AUD-001/report.json for the finding.";
        }),
    ),
    red("a reason path with ..", "CD-9", "«..»", (x) =>
      withFour(x, ISS, (j) => {
        j.orch_cancellation.reason += " (decisions/../STATE.md)";
      }),
    ),
    red("the status back to PENDING", "CD-9", "not CANCELLED", (x) =>
      withFour(x, STEP12, (j) => {
        j.status = "PENDING";
      }),
    ),
    red("a field of the tag rewritten (the task)", "CD-9", "base tag", (x) =>
      withFour(x, STEP12, (j) => {
        j.task.description += " (edited)";
      }),
    ),
    red("the handoff missing", "CD-9", "does not exist", (x) =>
      withFour(x, STEP12, () => null),
    ),
    green("an orch_note appended", ["CD-9"], (x) =>
      withFour(x, ISS, (j) => {
        j.orch_note = {
          by: "ORCH",
          at: "2099-12-31T00:00:00Z",
          text: "An appended note.",
        };
      }),
    ),
    // CD-11
    ...PLANTS.map(([shapeName, value], i) => {
      const [where, put] = PLACES[i % PLACES.length];
      return red(`${shapeName} planted in ${where}`, "CD-11", shapeName, (x) =>
        put(x, value),
      );
    }),
    green(
      "benign twins: loopback, reserved domains, hashes, run ids, times, versions, names",
      ["CD-11"],
      (x) => withText(x, "readme", (t) => `${t}\n${BENIGN.join("\n")}\n`),
    ),
    green(
      "a GitHub run id of 12 digits, right after «run» and inside an actions/runs/ link",
      ["CD-11"],
      (x) =>
        withText(
          x,
          "readme",
          (t) =>
            `${t}\nthe GitHub run ${RUN_ID} and Run ${RUN_ID} again\nhttps://github.com/owner/sai/actions/runs/${RUN_ID}/job/5\n`,
        ),
    ),
    red(
      "a 12-digit number after «run of», not right after «run»",
      "CD-11",
      "a 12-digit identity number",
      (x) =>
        withText(x, "readme", (t) => `${t}\na run of ${plant(ID_SHAPE)}\n`),
    ),
    red(
      "a 12-digit number after «running», not right after «run»",
      "CD-11",
      "a 12-digit identity number",
      (x) => withText(x, "readme", (t) => `${t}\nrunning ${plant(ID_SHAPE)}\n`),
    ),
    red(
      "a 12-digit number in a runs/ path that is not an actions/runs/ link",
      "CD-11",
      "a 12-digit identity number",
      (x) =>
        withText(
          x,
          "readme",
          (t) => `${t}\nsee other/runs/${plant(ID_SHAPE)}\n`,
        ),
    ),
    green(
      "the personal-data shapes inside the WF-06 block of STATE.md",
      ["CD-11"],
      (x) =>
        withState(x, (t) =>
          placeLikeApplyVerdict(t, blockWith(...PERSONAL_NAMES)),
        ),
    ),
    red(
      "a key shape inside the WF-06 block of STATE.md: an AWS access key",
      "CD-11",
      "an AWS access key",
      (x) =>
        withState(x, (t) =>
          placeLikeApplyVerdict(t, blockWith("an AWS access key")),
        ),
    ),
    red(
      "a key shape inside the WF-06 block of STATE.md: a secret given to a name",
      "CD-11",
      "a secret given to a name",
      (x) =>
        withState(x, (t) =>
          placeLikeApplyVerdict(t, blockWith("a secret given to a name")),
        ),
    ),
    red(
      "an e-mail address on the line before the start marker",
      "CD-11",
      "an e-mail address",
      (x) =>
        withState(x, (t) =>
          insertBefore(t, is(START), `- ${plant("an e-mail address")}`),
        ),
    ),
    red(
      "an e-mail address on the line after the end marker",
      "CD-11",
      "an e-mail address",
      (x) =>
        withState(x, (t) =>
          insertAfter(t, is(END), `- ${plant("an e-mail address")}`),
        ),
    ),
    red(
      "personal data in the block whose start marker is lost: the whole file is read",
      "CD-11",
      "an e-mail address",
      (x) =>
        withState(x, (t) =>
          removeLine(
            placeLikeApplyVerdict(t, blockWith("an e-mail address")),
            is(START),
          ),
        ),
    ),
    red(
      "personal data between two markers of a file other than STATE.md",
      "CD-11",
      "an e-mail address",
      (x) =>
        withText(
          x,
          "readme",
          (t) => `${t}\n${blockWith("an e-mail address").join("\n")}\n`,
        ),
    ),
    // CD-12
    red("a third cancelled handoff without by", "CD-12", "no «by»", (x) => ({
      ...x,
      cancelled: [
        ...x.cancelled,
        [
          "handoffs/X-20990101-01/step-01-orch.json",
          {
            status: "CANCELLED",
            orch_cancellation: {
              at: "2099-12-31T00:00:00Z",
              reason: "A cancellation without its author.",
            },
          },
        ],
      ],
    })),
    red("a cancellation by REVIEWER", "CD-12", "not «ORCH»", (x) =>
      withFour(x, FOUR[1][0], (j) => {
        j.orch_cancellation.by = "REVIEWER";
      }),
    ),
    red("a history exception given another by", "CD-12", "not «ORCH»", (x) => ({
      ...x,
      cancelled: x.cancelled.map(([f, j]) =>
        f === HISTORY_WITHOUT_BY[0]
          ? [
              f,
              {
                ...j,
                orch_cancellation: { ...j.orch_cancellation, by: "REVIEWER" },
              },
            ]
          : [f, j],
      ),
    })),
    red(
      "a history exception no longer cancelled",
      "CD-12",
      "history exception",
      (x) => ({
        ...x,
        cancelled: x.cancelled.filter(([f]) => f !== HISTORY_WITHOUT_BY[1]),
      }),
    ),
    red(
      "a CANCELLED handoff with no orch_cancellation",
      "CD-12",
      "no orch_cancellation",
      (x) => ({
        ...x,
        cancelled: [
          ...x.cancelled,
          ["handoffs/X-20990101-01/step-02-orch.json", { status: "CANCELLED" }],
        ],
      }),
    ),
    red(
      "a cancelled handoff that does not parse",
      "CD-12",
      "cannot be read",
      (x) => ({
        ...x,
        unreadable: [
          ...x.unreadable,
          ["handoffs/X-20990101-01/step-03-orch.json", false, true],
        ],
      }),
    ),
  ];
}

test("REQ-103 CD-10: the rules are not blind: each rule of CD-1 ... CD-9 and CD-11 ... CD-13 is red on its damaged copy and green on its benign twins", () => {
  const m = real();
  assert.deepEqual(findings(m), []);
  const all = cases(m);
  assert.ok(all.length >= 120, `only ${all.length} cases`);
  for (const id of Object.keys(RULES))
    assert.ok(
      all.some((c) => c.id === id),
      `no damaged copy for ${id}`,
    );
  const blind = [];
  for (const c of all) {
    let copy;
    try {
      copy = c.make(m);
    } catch (error) {
      blind.push(`${c.name}: ${error.message}`);
      continue;
    }
    if (c.ids) {
      const found = c.ids.flatMap((id) => RULES[id](copy));
      if (found.length)
        blind.push(`${c.name}: expected green, got ${JSON.stringify(found)}`);
    } else {
      const found = RULES[c.id](copy);
      if (!found.some((f) => f.includes(c.has)))
        blind.push(
          `${c.name}: expected a ${c.id} finding with «${c.has}», got ${JSON.stringify(found)}`,
        );
    }
  }
  assert.deepEqual(blind, []);
});
