import fs from "node:fs";
import path from "node:path";
import { cleanSource } from "./clean.js";
import {
  ALLOWED_NEXT_AGENTS,
  CRITERIA,
  IDEA_ID_RE,
  ISO_UTC_RE,
  LENSES,
  MAX_VERSION,
  MIN_QUOTE_LENGTH,
  REQUIRED_CHECKS,
  SCHEMAS,
  STAGES,
  isSafeSourcePath,
} from "./contract.js";
import {
  Issues,
  isNonEmptyString,
  isPlainObject,
  normalizeWs,
  readJson,
  readTextFile,
  sha256,
} from "./util.js";

export function validateRun(root, runDir, { stage = "review", seal } = {}) {
  const issues = new Issues();
  const ctx = {
    root,
    runDir,
    runId: path.basename(runDir),
    verdicts: {},
    reviews: {},
  };
  const upto = STAGES.indexOf(stage);
  const steps = [
    ["run", () => checkRun(ctx, issues, seal)],
    ["assessments", () => checkAssessments(ctx, issues)],
    ["crossreviews", () => checkCrossreviews(ctx, issues)],
    ["responses", () => checkResponses(ctx, issues)],
    ["verdict", () => checkVerdicts(ctx, issues)],
    ["review", () => checkReviews(ctx, issues)],
  ];
  // Later stages depend on facts established by earlier ones, so stop at the first
  // stage that has issues; every issue of that stage is still reported.
  for (const [name, fn] of steps) {
    if (STAGES.indexOf(name) > upto) break;
    const before = issues.list.length;
    fn();
    if (issues.list.length > before) break;
  }
  return { issues, ctx };
}

function checkTopKeys(obj, keys, file, issues) {
  for (const k of keys) {
    if (!(k in obj)) issues.add("E_SHAPE", file, `missing field "${k}"`);
  }
  for (const k of Object.keys(obj)) {
    if (!keys.includes(k))
      issues.add("E_SHAPE", file, `unexpected field "${k}"`);
  }
}

function loadArtifact(ctx, issues, file, schema, keys) {
  const doc = readJson(path.join(ctx.runDir, file), issues, file);
  if (doc === undefined) return undefined;
  if (!isPlainObject(doc)) {
    issues.add("E_SHAPE", file, "top level must be a JSON object");
    return undefined;
  }
  checkTopKeys(doc, keys, file, issues);
  if (doc.schema !== schema) {
    issues.add("E_SHAPE", file, `schema must be "${schema}"`);
  }
  if (doc.run_id !== ctx.runId) {
    issues.add("E_RUN_ID", file, `run_id must be "${ctx.runId}"`);
  }
  return doc;
}

function checkProducer(doc, role, instance, file, issues) {
  const pb = doc.produced_by;
  if (!isPlainObject(pb) || pb.role !== role || pb.instance !== instance) {
    issues.add(
      "E_PRODUCER",
      file,
      `produced_by must be {"role":"${role}","instance":"${instance}"}`,
    );
  }
}

function isNonEmptyStringArray(v) {
  return Array.isArray(v) && v.length > 0 && v.every(isNonEmptyString);
}

function isScore(v) {
  return Number.isInteger(v) && v >= 1 && v <= 5;
}

function checkEvidence(ctx, issues, list, file, where, missingCode) {
  if (!Array.isArray(list) || list.length === 0) {
    issues.add(
      missingCode,
      file,
      `${where}: at least one evidence item is required`,
    );
    return;
  }
  for (const ev of list) {
    if (
      !isPlainObject(ev) ||
      typeof ev.source !== "string" ||
      typeof ev.quote !== "string"
    ) {
      issues.add("E_SHAPE", file, `${where}: evidence must be {source, quote}`);
      continue;
    }
    if (!ctx.sources.has(ev.source)) {
      issues.add(
        "E_EVIDENCE_SOURCE",
        file,
        `${where}: source not in run.sources: ${ev.source}`,
      );
    } else if ([...ev.quote.trim()].length < MIN_QUOTE_LENGTH) {
      issues.add(
        "E_QUOTE_SHORT",
        file,
        `${where}: quote shorter than ${MIN_QUOTE_LENGTH} characters`,
      );
    } else if (!ctx.sources.get(ev.source).includes(normalizeWs(ev.quote))) {
      issues.add(
        "E_QUOTE_NOT_FOUND",
        file,
        `${where}: quote not found in cleaned ${ev.source}`,
      );
    }
  }
}

function checkUnknownLensFiles(ctx, issues, prefix) {
  const re = new RegExp(`^${prefix}-(.+)\\.json$`);
  for (const f of fs.readdirSync(ctx.runDir)) {
    const m = re.exec(f);
    if (m && !LENSES.includes(m[1])) {
      issues.add("E_LENS", f, `unknown lens "${m[1]}"`);
    }
  }
}

// ---------------------------------------------------------------- run.json

function checkRun(ctx, issues, seal) {
  const file = "run.json";
  const run = loadArtifact(ctx, issues, file, SCHEMAS.run, [
    "schema",
    "run_id",
    "created_at",
    "candidates",
    "sources",
    "roster",
  ]);
  if (run === undefined) return;
  if (!ISO_UTC_RE.test(run.created_at ?? "")) {
    issues.add("E_SHAPE", file, "created_at must be YYYY-MM-DDTHH:MM:SSZ");
  }

  const candidates = Array.isArray(run.candidates) ? run.candidates : [];
  if (!Array.isArray(run.candidates)) {
    issues.add("E_SHAPE", file, "candidates must be an array");
  } else if (candidates.length < 2) {
    issues.add("E_CANDIDATE", file, "at least 2 candidates are required");
  }
  const seen = new Set();
  for (const id of candidates) {
    if (seen.has(id))
      issues.add("E_DUPLICATE", file, `candidate repeated: ${id}`);
    seen.add(id);
    if (typeof id !== "string" || !IDEA_ID_RE.test(id)) {
      issues.add("E_CANDIDATE", file, `bad idea_id format: ${id}`);
    } else if (!fs.existsSync(path.join(ctx.root, "ideas", `${id}.md`))) {
      issues.add("E_CANDIDATE", file, `idea file not found: ideas/${id}.md`);
    }
  }
  ctx.candidates = [...seen].filter((id) => typeof id === "string");

  ctx.sources = new Map();
  ctx.copies = new Map();
  const sources = Array.isArray(run.sources) ? run.sources : [];
  if (!Array.isArray(run.sources)) {
    issues.add("E_SHAPE", file, "sources must be an array");
  }
  for (const s of sources) {
    if (
      !isPlainObject(s) ||
      typeof s.path !== "string" ||
      typeof s.original_sha256 !== "string" ||
      typeof s.clean_sha256 !== "string"
    ) {
      issues.add(
        "E_SHAPE",
        file,
        "source must be {path, original_sha256, clean_sha256}",
      );
      continue;
    }
    if (ctx.copies.has(s.path)) {
      issues.add("E_DUPLICATE", file, `source repeated: ${s.path}`);
      continue;
    }
    if (!isSafeSourcePath(s.path)) {
      issues.add("E_SOURCE_PATH", file, `source path not allowed: ${s.path}`);
      continue;
    }
    const copy = readTextFile(path.join(ctx.runDir, "sources", s.path));
    if (copy === undefined) {
      issues.add(
        "E_SOURCE_CHANGED",
        file,
        `cleaned copy missing, not a file or unreadable: sources/${s.path}`,
      );
      continue;
    }
    if (sha256(copy) !== s.clean_sha256) {
      issues.add(
        "E_SOURCE_CHANGED",
        file,
        `cleaned copy does not match clean_sha256: ${s.path}`,
      );
      continue;
    }
    const original = readTextFile(path.join(ctx.root, s.path));
    if (original !== undefined) {
      if (sha256(original) === s.original_sha256) {
        const recleaned = cleanSource(original);
        if (recleaned.error || recleaned.text !== copy) {
          issues.add(
            "E_SOURCE_CHANGED",
            file,
            `re-cleaning the unchanged original differs from the copy: ${s.path}`,
          );
          continue;
        }
      }
    }
    ctx.copies.set(s.path, copy);
    ctx.sources.set(s.path, normalizeWs(copy));
  }
  for (const id of ctx.candidates) {
    if (!sources.some((s) => isPlainObject(s) && s.path === `ideas/${id}.md`)) {
      issues.add(
        "E_SOURCE_PATH",
        file,
        `candidate file missing from sources: ideas/${id}.md`,
      );
    }
  }

  const roster = run.roster;
  const analysts = isPlainObject(roster) ? roster.analysts : undefined;
  if (
    !isPlainObject(roster) ||
    !isPlainObject(analysts) ||
    Object.keys(analysts).length !== LENSES.length ||
    !LENSES.every((l) => l in analysts)
  ) {
    issues.add(
      "E_ROSTER",
      file,
      `roster.analysts must be exactly: ${LENSES.join(", ")}`,
    );
  } else {
    const labels = [
      ...LENSES.map((l) => analysts[l]),
      roster.judge,
      roster.executor,
    ];
    if (!labels.every(isNonEmptyString)) {
      issues.add("E_ROSTER", file, "every roster label must be non-empty");
    } else if (new Set(labels).size !== labels.length) {
      issues.add("E_ROSTER", file, "all five roster labels must be distinct");
    } else {
      ctx.roster = roster;
    }
  }

  if (seal !== undefined) {
    const actual = sha256(fs.readFileSync(path.join(ctx.runDir, file)));
    if (actual !== seal) {
      issues.add("E_SEAL", file, `seal mismatch: run.json sha256 is ${actual}`);
    }
  }
}

// --------------------------------------------------------- round 1

function checkAssessments(ctx, issues) {
  checkUnknownLensFiles(ctx, issues, "assessment");
  ctx.r1 = {};
  for (const lens of LENSES) {
    const file = `assessment-${lens}.json`;
    const doc = loadArtifact(ctx, issues, file, SCHEMAS.assessment, [
      "schema",
      "run_id",
      "produced_by",
      "lens",
      "ideas",
    ]);
    if (doc === undefined) continue;
    if (doc.lens !== lens) issues.add("E_LENS", file, `lens must be "${lens}"`);
    checkProducer(doc, "IDEA-ANALYST", ctx.roster.analysts[lens], file, issues);
    if (!Array.isArray(doc.ideas)) {
      issues.add("E_SHAPE", file, "ideas must be an array");
      continue;
    }
    const scores = {};
    for (const item of doc.ideas) {
      if (!isPlainObject(item)) {
        issues.add("E_SHAPE", file, "each idea must be an object");
        continue;
      }
      const id = item.idea_id;
      if (id in scores) {
        issues.add("E_DUPLICATE", file, `idea assessed twice: ${id}`);
        continue;
      }
      if (!ctx.candidates.includes(id)) {
        issues.add("E_COVERAGE", file, `not a candidate: ${id}`);
        continue;
      }
      scores[id] = {};
      if (!isNonEmptyString(item.summary)) {
        issues.add("E_SHAPE", file, `${id}: summary must be non-empty`);
      }
      if (!isPlainObject(item.scores)) {
        issues.add("E_COVERAGE", file, `${id}: scores missing`);
        continue;
      }
      for (const k of Object.keys(item.scores)) {
        if (!CRITERIA[lens].includes(k)) {
          issues.add(
            "E_COVERAGE",
            file,
            `${id}: criterion of another lens: ${k}`,
          );
        }
      }
      for (const c of CRITERIA[lens]) {
        const e = item.scores[c];
        if (e === undefined) {
          issues.add("E_COVERAGE", file, `${id}: criterion missing: ${c}`);
          continue;
        }
        if (!isPlainObject(e)) {
          issues.add("E_SHAPE", file, `${id}.${c}: must be an object`);
          continue;
        }
        if (isScore(e.score)) scores[id][c] = e.score;
        else
          issues.add(
            "E_SCORE_RANGE",
            file,
            `${id}.${c}: score must be an integer 1-5`,
          );
        if (!isNonEmptyString(e.comment)) {
          issues.add("E_SHAPE", file, `${id}.${c}: comment must be non-empty`);
        }
        checkEvidence(
          ctx,
          issues,
          e.evidence,
          file,
          `${id}.${c}`,
          "E_EVIDENCE_MISSING",
        );
      }
    }
    for (const id of ctx.candidates) {
      if (!(id in scores))
        issues.add("E_COVERAGE", file, `candidate not assessed: ${id}`);
    }
    ctx.r1[lens] = scores;
  }
}

// --------------------------------------------------------- round 2

function checkCrossreviews(ctx, issues) {
  checkUnknownLensFiles(ctx, issues, "crossreview");
  ctx.disagreements = [];
  for (const lens of LENSES) {
    const file = `crossreview-${lens}.json`;
    const doc = loadArtifact(ctx, issues, file, SCHEMAS.crossreview, [
      "schema",
      "run_id",
      "produced_by",
      "lens",
      "items",
    ]);
    if (doc === undefined) continue;
    if (doc.lens !== lens) issues.add("E_LENS", file, `lens must be "${lens}"`);
    checkProducer(doc, "IDEA-ANALYST", ctx.roster.analysts[lens], file, issues);
    if (!Array.isArray(doc.items)) {
      issues.add("E_SHAPE", file, "items must be an array");
      continue;
    }
    const expected = new Set();
    for (const other of LENSES.filter((l) => l !== lens)) {
      for (const id of ctx.candidates) {
        for (const c of CRITERIA[other]) expected.add(`${other}|${id}|${c}`);
      }
    }
    const seen = new Set();
    for (const item of doc.items) {
      if (!isPlainObject(item)) {
        issues.add("E_SHAPE", file, "each item must be an object");
        continue;
      }
      const key = `${item.lens}|${item.idea_id}|${item.criterion}`;
      if (!expected.has(key)) {
        issues.add(
          "E_REVIEW_COVERAGE",
          file,
          `not a score of another lens: ${key}`,
        );
        continue;
      }
      if (seen.has(key)) {
        issues.add(
          "E_REVIEW_COVERAGE",
          file,
          `reviewed more than once: ${key}`,
        );
        continue;
      }
      seen.add(key);
      const actual = ctx.r1[item.lens][item.idea_id][item.criterion];
      if (item.their_score !== actual) {
        issues.add(
          "E_THEIR_SCORE",
          file,
          `${key}: their_score must be ${actual}`,
        );
      }
      if (!isNonEmptyString(item.note))
        issues.add("E_SHAPE", file, `${key}: note must be non-empty`);
      if (item.stance === "disagree") {
        if (!isScore(item.proposed_score) || item.proposed_score === actual) {
          issues.add(
            "E_DISAGREE_SHAPE",
            file,
            `${key}: proposed_score must be 1-5 and differ from ${actual}`,
          );
        }
        checkEvidence(
          ctx,
          issues,
          item.evidence,
          file,
          key,
          "E_DISAGREE_SHAPE",
        );
        ctx.disagreements.push({
          raised_by: lens,
          lens: item.lens,
          idea_id: item.idea_id,
          criterion: item.criterion,
        });
      } else if (item.stance !== "agree") {
        issues.add(
          "E_SHAPE",
          file,
          `${key}: stance must be "agree" or "disagree"`,
        );
      }
    }
    for (const key of expected) {
      if (!seen.has(key))
        issues.add("E_REVIEW_COVERAGE", file, `score not reviewed: ${key}`);
    }
  }
}

// --------------------------------------------------------- round 3

function checkResponses(ctx, issues) {
  checkUnknownLensFiles(ctx, issues, "response");
  ctx.final = structuredClone(ctx.r1);
  ctx.held = [];
  for (const lens of LENSES) {
    const file = `response-${lens}.json`;
    const doc = loadArtifact(ctx, issues, file, SCHEMAS.response, [
      "schema",
      "run_id",
      "produced_by",
      "lens",
      "responses",
    ]);
    if (doc === undefined) continue;
    if (doc.lens !== lens) issues.add("E_LENS", file, `lens must be "${lens}"`);
    checkProducer(doc, "IDEA-ANALYST", ctx.roster.analysts[lens], file, issues);
    if (!Array.isArray(doc.responses)) {
      issues.add("E_SHAPE", file, "responses must be an array");
      continue;
    }
    const expected = new Set(
      ctx.disagreements
        .filter((d) => d.lens === lens)
        .map((d) => `${d.raised_by}|${d.idea_id}|${d.criterion}`),
    );
    const seen = new Set();
    const revisedTo = new Map();
    for (const r of doc.responses) {
      if (!isPlainObject(r)) {
        issues.add("E_SHAPE", file, "each response must be an object");
        continue;
      }
      const key = `${r.raised_by}|${r.idea_id}|${r.criterion}`;
      if (!expected.has(key)) {
        issues.add("E_RESPONSE_COVERAGE", file, `no such disagreement: ${key}`);
        continue;
      }
      if (seen.has(key)) {
        issues.add(
          "E_RESPONSE_COVERAGE",
          file,
          `answered more than once: ${key}`,
        );
        continue;
      }
      seen.add(key);
      if (!isNonEmptyString(r.reason)) {
        issues.add(
          "E_RESPONSE_SHAPE",
          file,
          `${key}: reason must be non-empty`,
        );
      }
      const base = ctx.r1[lens][r.idea_id][r.criterion];
      if (r.action === "revise") {
        if (r.from !== base || !isScore(r.to) || r.to === r.from) {
          issues.add(
            "E_RESPONSE_SHAPE",
            file,
            `${key}: revise needs from=${base} and a different to 1-5`,
          );
          continue;
        }
        const pair = `${r.idea_id}|${r.criterion}`;
        if (revisedTo.has(pair) && revisedTo.get(pair) !== r.to) {
          issues.add(
            "E_RESPONSE_CONFLICT",
            file,
            `${pair}: revised to different scores`,
          );
          continue;
        }
        revisedTo.set(pair, r.to);
      } else if (r.action === "hold") {
        checkEvidence(ctx, issues, r.evidence, file, key, "E_RESPONSE_SHAPE");
        ctx.held.push({
          raised_by: r.raised_by,
          lens,
          idea_id: r.idea_id,
          criterion: r.criterion,
        });
      } else {
        issues.add(
          "E_RESPONSE_SHAPE",
          file,
          `${key}: action must be "revise" or "hold"`,
        );
      }
    }
    for (const key of expected) {
      if (!seen.has(key))
        issues.add(
          "E_RESPONSE_COVERAGE",
          file,
          `disagreement not answered: ${key}`,
        );
    }
    for (const [pair, to] of revisedTo) {
      const [id, c] = pair.split("|");
      ctx.final[lens][id][c] = to;
    }
  }
  ctx.totals = new Map(
    ctx.candidates.map((id) => [
      id,
      LENSES.reduce(
        (sum, l) =>
          sum + CRITERIA[l].reduce((s, c) => s + ctx.final[l][id][c], 0),
        0,
      ),
    ]),
  );
}

// --------------------------------------------------------- verdict and review versions

function scanVersions(ctx, issues) {
  const verdicts = new Set();
  const reviews = new Set();
  for (const f of fs.readdirSync(ctx.runDir)) {
    const v = /^verdict-(\d+)\.(json|md)$/.exec(f);
    const r = /^verdict-review-(\d+)\.json$/.exec(f);
    const m = v ?? r;
    if (!m) continue;
    const n = Number(m[1]);
    if (n > MAX_VERSION) {
      issues.add("E_REVIEW_LIMIT", f, `version ${n} exceeds ${MAX_VERSION}`);
      continue;
    }
    if (n < 1) {
      issues.add("E_VERSION", f, "versions start at 1");
      continue;
    }
    if (v && v[2] === "json") verdicts.add(n);
    if (r) reviews.add(n);
  }
  ctx.verdictVersions = [...verdicts].sort((a, b) => a - b);
  ctx.reviewVersions = [...reviews].sort((a, b) => a - b);
}

function reviewDecision(ctx, v) {
  const scratch = new Issues();
  const doc = readJson(
    path.join(ctx.runDir, `verdict-review-${v}.json`),
    scratch,
    "",
  );
  return isPlainObject(doc) ? doc.decision : undefined;
}

function checkVerdicts(ctx, issues) {
  scanVersions(ctx, issues);
  const versions = ctx.verdictVersions;
  if (versions.length === 0) {
    issues.add("E_JSON", "verdict-1.json", "file is missing or unreadable");
    return;
  }
  versions.forEach((v, i) => {
    if (v !== i + 1)
      issues.add(
        "E_VERSION",
        `verdict-${v}.json`,
        "verdict versions must be 1..N without gaps",
      );
    if (v > 1 && reviewDecision(ctx, v - 1) !== "REJECT") {
      issues.add(
        "E_VERSION",
        `verdict-${v}.json`,
        `requires verdict-review-${v - 1}.json with decision REJECT`,
      );
    }
  });
  for (const v of versions) checkVerdict(ctx, issues, v);
  ctx.latest = versions[versions.length - 1];
}

function checkVerdict(ctx, issues, v) {
  const file = `verdict-${v}.json`;
  const doc = loadArtifact(ctx, issues, file, SCHEMAS.verdict, [
    "schema",
    "run_id",
    "produced_by",
    "version",
    "created_at",
    "ranking",
    "chosen",
    "confidence",
    "reasons",
    "dissent",
    "conditions",
    "kill_criteria",
    "owner_decision_required",
    "next_actions",
  ]);
  if (doc === undefined) return;
  checkProducer(doc, "IDEA-JUDGE", ctx.roster.judge, file, issues);
  if (doc.version !== v) issues.add("E_VERSION", file, `version must be ${v}`);
  if (!ISO_UTC_RE.test(doc.created_at ?? "")) {
    issues.add("E_SHAPE", file, "created_at must be YYYY-MM-DDTHH:MM:SSZ");
  }

  const ranking = Array.isArray(doc.ranking) ? doc.ranking : [];
  if (!Array.isArray(doc.ranking))
    issues.add("E_SHAPE", file, "ranking must be an array");
  const ranked = new Set();
  ranking.forEach((e, i) => {
    if (!isPlainObject(e)) {
      issues.add("E_SHAPE", file, "ranking entries must be objects");
      return;
    }
    if (!ctx.candidates.includes(e.idea_id)) {
      issues.add("E_RANKING_COVERAGE", file, `not a candidate: ${e.idea_id}`);
    } else if (ranked.has(e.idea_id)) {
      issues.add("E_RANKING_COVERAGE", file, `ranked twice: ${e.idea_id}`);
    } else {
      ranked.add(e.idea_id);
      const total = ctx.totals.get(e.idea_id);
      if (e.total !== total) {
        issues.add(
          "E_TOTAL_MISMATCH",
          file,
          `${e.idea_id}: total must be ${total}`,
        );
      }
    }
    if (e.rank !== i + 1)
      issues.add(
        "E_RANK_SEQUENCE",
        file,
        `position ${i + 1} must have rank ${i + 1}`,
      );
    if (!isNonEmptyString(e.rationale))
      issues.add("E_SHAPE", file, `${e.idea_id}: rationale must be non-empty`);
  });
  for (const id of ctx.candidates) {
    if (!ranked.has(id))
      issues.add("E_RANKING_COVERAGE", file, `candidate missing: ${id}`);
  }
  for (let i = 0; i + 1 < ranking.length; i++) {
    const a = ctx.totals.get(ranking[i]?.idea_id);
    const b = ctx.totals.get(ranking[i + 1]?.idea_id);
    if (a !== undefined && b !== undefined && a < b) {
      issues.add(
        "E_RANK_ORDER",
        file,
        `${ranking[i].idea_id} (${a}) is above ${ranking[i + 1].idea_id} (${b})`,
      );
    }
  }
  if (ranking[0] && doc.chosen !== ranking[0].idea_id) {
    issues.add(
      "E_CHOSEN_NOT_FIRST",
      file,
      `chosen must be ${ranking[0].idea_id}`,
    );
  }

  if (!["low", "medium", "high"].includes(doc.confidence)) {
    issues.add("E_SHAPE", file, "confidence must be low, medium or high");
  }

  const reasons = Array.isArray(doc.reasons) ? doc.reasons : [];
  if (reasons.length < 2)
    issues.add("E_REASONS", file, "at least 2 reasons are required");
  let aboutChosen = 0;
  for (const r of reasons) {
    if (!isPlainObject(r)) {
      issues.add("E_SHAPE", file, "reasons must be objects");
      continue;
    }
    if (!isNonEmptyString(r.text))
      issues.add("E_SHAPE", file, "reason text must be non-empty");
    if (!Array.isArray(r.refs) || r.refs.length === 0) {
      issues.add("E_REASONS", file, "each reason needs at least one ref");
      continue;
    }
    for (const ref of r.refs) {
      const ok =
        isPlainObject(ref) &&
        LENSES.includes(ref.lens) &&
        ctx.candidates.includes(ref.idea_id) &&
        CRITERIA[ref.lens].includes(ref.criterion);
      if (!ok)
        issues.add(
          "E_REASONS",
          file,
          `ref to a non-existent score: ${JSON.stringify(ref)}`,
        );
    }
    if (r.refs.some((ref) => isPlainObject(ref) && ref.idea_id === doc.chosen))
      aboutChosen++;
  }
  if (aboutChosen < 2)
    issues.add(
      "E_REASONS",
      file,
      "at least 2 reasons must refer to the chosen idea",
    );

  const dissent = Array.isArray(doc.dissent) ? doc.dissent : [];
  if (!Array.isArray(doc.dissent))
    issues.add("E_SHAPE", file, "dissent must be an array");
  for (const d of dissent) {
    if (!isPlainObject(d) || !isNonEmptyString(d.resolution)) {
      issues.add(
        "E_SHAPE",
        file,
        "dissent entries need a non-empty resolution",
      );
    }
  }
  for (const h of ctx.held) {
    const matches = dissent.filter(
      (d) =>
        isPlainObject(d) &&
        d.raised_by === h.raised_by &&
        d.lens === h.lens &&
        d.idea_id === h.idea_id &&
        d.criterion === h.criterion,
    );
    if (matches.length !== 1) {
      issues.add(
        "E_DISSENT_MISSING",
        file,
        `held disagreement must appear exactly once: ${h.raised_by}->${h.lens}|${h.idea_id}|${h.criterion}`,
      );
    }
  }

  if (!isNonEmptyStringArray(doc.conditions))
    issues.add("E_SHAPE", file, "conditions must be non-empty");
  if (!isNonEmptyStringArray(doc.kill_criteria))
    issues.add("E_SHAPE", file, "kill_criteria must be non-empty");
  if (doc.owner_decision_required !== true) {
    issues.add(
      "E_OWNER_DECISION",
      file,
      "owner_decision_required must be true",
    );
  }

  const actions = Array.isArray(doc.next_actions) ? doc.next_actions : [];
  if (actions.length < 1 || actions.length > 5) {
    issues.add("E_SHAPE", file, "next_actions must have 1 to 5 items");
  }
  for (const a of actions) {
    if (!isPlainObject(a)) {
      issues.add("E_SHAPE", file, "next_actions entries must be objects");
      continue;
    }
    if (!ALLOWED_NEXT_AGENTS.includes(a.to_agent)) {
      issues.add(
        "E_NEXT_ACTION_AGENT",
        file,
        `to_agent not allowed before the owner's start decision: ${a.to_agent}`,
      );
    }
    if (
      !isNonEmptyString(a.task) ||
      !isNonEmptyStringArray(a.acceptance_criteria)
    ) {
      issues.add(
        "E_SHAPE",
        file,
        "next action needs task and acceptance_criteria",
      );
    }
  }

  const md = readTextFile(path.join(ctx.runDir, `verdict-${v}.md`));
  if (
    md === undefined ||
    typeof doc.chosen !== "string" ||
    !md.includes(doc.chosen) ||
    !/^## Ограничения\s*$/m.test(md)
  ) {
    issues.add(
      "E_VERDICT_MD",
      `verdict-${v}.md`,
      "must be a readable file, mention the chosen idea and contain '## Ограничения'",
    );
  }
  ctx.verdicts[v] = doc;
}

function checkReviews(ctx, issues) {
  for (const v of ctx.reviewVersions) {
    if (!ctx.verdictVersions.includes(v)) {
      issues.add(
        "E_VERSION",
        `verdict-review-${v}.json`,
        `no verdict-${v}.json`,
      );
    }
  }
  if (!ctx.reviewVersions.includes(ctx.latest)) {
    issues.add(
      "E_JSON",
      `verdict-review-${ctx.latest}.json`,
      "file is missing or unreadable",
    );
  }
  for (const v of ctx.reviewVersions.filter((n) =>
    ctx.verdictVersions.includes(n),
  )) {
    checkReview(ctx, issues, v);
  }
}

function checkReview(ctx, issues, v) {
  const file = `verdict-review-${v}.json`;
  const doc = loadArtifact(ctx, issues, file, SCHEMAS.review, [
    "schema",
    "run_id",
    "produced_by",
    "version",
    "decision",
    "checks",
    "issues",
  ]);
  if (doc === undefined) return;
  checkProducer(doc, "VERDICT-EXECUTOR", ctx.roster.executor, file, issues);
  if (doc.version !== v) issues.add("E_VERSION", file, `version must be ${v}`);

  const checks = Array.isArray(doc.checks) ? doc.checks : [];
  if (!Array.isArray(doc.checks))
    issues.add("E_REVIEW_CHECKS", file, "checks must be an array");
  const names = new Set();
  for (const c of checks) {
    if (!isPlainObject(c) || !REQUIRED_CHECKS.includes(c.name)) {
      issues.add(
        "E_REVIEW_CHECKS",
        file,
        `unknown check: ${JSON.stringify(c?.name)}`,
      );
      continue;
    }
    if (names.has(c.name))
      issues.add("E_REVIEW_CHECKS", file, `check repeated: ${c.name}`);
    names.add(c.name);
    if (!["PASS", "FAIL"].includes(c.result))
      issues.add(
        "E_REVIEW_CHECKS",
        file,
        `${c.name}: result must be PASS or FAIL`,
      );
    if (!isNonEmptyString(c.detail))
      issues.add(
        "E_REVIEW_CHECKS",
        file,
        `${c.name}: detail must be non-empty`,
      );
  }
  for (const name of REQUIRED_CHECKS) {
    if (!names.has(name))
      issues.add("E_REVIEW_CHECKS", file, `required check missing: ${name}`);
  }

  if (
    !Array.isArray(doc.issues) ||
    !doc.issues.every((i) => typeof i === "string")
  ) {
    issues.add("E_SHAPE", file, "issues must be an array of strings");
  }
  if (doc.decision === "ACCEPT") {
    if (checks.some((c) => !isPlainObject(c) || c.result !== "PASS")) {
      issues.add(
        "E_REVIEW_DECISION",
        file,
        "ACCEPT requires every check to PASS",
      );
    }
  } else if (doc.decision === "REJECT") {
    if (!Array.isArray(doc.issues) || doc.issues.length === 0) {
      issues.add("E_REVIEW_DECISION", file, "REJECT requires non-empty issues");
    }
  } else {
    issues.add("E_SHAPE", file, 'decision must be "ACCEPT" or "REJECT"');
  }
  ctx.reviews[v] = doc;
}
