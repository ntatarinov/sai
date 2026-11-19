import fs from "node:fs";
import path from "node:path";
import { cleanSource } from "./clean.js";
import {
  IDEA_ID_RE,
  ISO_UTC_RE,
  LENSES,
  RUN_ID_RE,
  SCHEMAS,
  isSafeSourcePath,
} from "./contract.js";
import {
  Issues,
  UsageError,
  createFolderAllOrNothing,
  isNonEmptyString,
  isOsError,
  readTextFile,
  sha256,
  stableJson,
} from "./util.js";

export function nowUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Anything at the path occupies it, a dangling symbolic link included: lstat, not
// existsSync. An lstat error means "no entry here"; the write phase says what is wrong
// with the path as an E_WRITE line (design §4.1, §5.3 P1).
function occupied(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch (err) {
    if (isOsError(err)) return false;
    throw err;
  }
}

// true when the real path of root/p (every symbolic link on the way resolved) is
// outside the real path of root (ISS-0120, ISS-0037): a source that is a link to a
// file outside the project, or lies in a linked folder outside it, is refused, so
// its text never reaches the copies, the verdict or a commit. A cloned repository
// is enough to bring such a link. A link that stays inside the project is read.
// A path that cannot be resolved (missing, dangling) is not judged here: the read
// below reports it as before.
function leadsOutside(root, p) {
  let realRoot;
  let realFile;
  try {
    realRoot = fs.realpathSync(root);
    realFile = fs.realpathSync(path.join(root, p));
  } catch (err) {
    if (isOsError(err)) return false;
    throw err;
  }
  const rel = path.relative(realRoot, realFile);
  return (
    rel === "" ||
    rel === ".." ||
    rel.startsWith(`..${path.sep}`) ||
    path.isAbsolute(rel)
  );
}

// Builds everything in memory first; nothing is written unless every check passes, and
// the run folder is then created all or nothing (design §4.1, §5.3 P1-P4).
export function prepareRun(root, opts) {
  const { runId, candidates, context, analysts, judge, executor } = opts;
  const createdAt = opts.createdAt ?? nowUtc();
  if (!RUN_ID_RE.test(runId ?? "")) {
    throw new UsageError(`RUN-ID must match WF06-YYYYMMDD-NN, got "${runId}"`);
  }
  if (!ISO_UTC_RE.test(createdAt)) {
    throw new UsageError(`--created-at must be YYYY-MM-DDTHH:MM:SSZ`);
  }
  const runDir = path.join(root, "runs", runId);
  if (occupied(runDir)) {
    throw new UsageError(`run folder already exists: runs/${runId}`);
  }

  const issues = new Issues();
  const label = "run.json";

  if (candidates.length < 2) {
    issues.add("E_CANDIDATE", label, "at least 2 candidates are required");
  }
  const seenCandidates = new Set();
  for (const id of candidates) {
    if (seenCandidates.has(id)) {
      issues.add("E_DUPLICATE", label, `candidate repeated: ${id}`);
      continue;
    }
    seenCandidates.add(id);
    if (!IDEA_ID_RE.test(id)) {
      issues.add("E_CANDIDATE", label, `bad idea_id format: ${id}`);
    } else if (!fs.existsSync(path.join(root, "ideas", `${id}.md`))) {
      issues.add("E_CANDIDATE", label, `idea file not found: ideas/${id}.md`);
    }
  }

  const sourcePaths = [
    ...[...seenCandidates]
      .filter((id) => IDEA_ID_RE.test(id))
      .map((id) => `ideas/${id}.md`),
  ];
  for (const p of context) {
    if (sourcePaths.includes(p)) {
      issues.add("E_DUPLICATE", label, `source repeated: ${p}`);
    } else {
      sourcePaths.push(p);
    }
  }

  const sources = [];
  const copies = [];
  for (const p of sourcePaths) {
    if (isSafeSourcePath(p) && leadsOutside(root, p)) {
      issues.add(
        "E_SOURCE_PATH",
        label,
        `source leads outside the project through a symbolic link: ${p}`,
      );
      continue;
    }
    const original = isSafeSourcePath(p)
      ? readTextFile(path.join(root, p))
      : undefined;
    if (original === undefined) {
      issues.add(
        "E_SOURCE_PATH",
        label,
        `source not allowed, missing, not a file or unreadable: ${p}`,
      );
      continue;
    }
    const cleaned = cleanSource(original);
    if (cleaned.error) {
      issues.add("E_SOURCE_MARKERS", p, cleaned.error);
      continue;
    }
    sources.push({
      path: p,
      original_sha256: sha256(original),
      clean_sha256: sha256(cleaned.text),
    });
    copies.push({ path: p, text: cleaned.text });
  }

  const lensKeys = Object.keys(analysts);
  const labels = [...LENSES.map((l) => analysts[l]), judge, executor];
  if (
    lensKeys.length !== LENSES.length ||
    !LENSES.every((l) => lensKeys.includes(l))
  ) {
    issues.add(
      "E_ROSTER",
      label,
      `analysts must be exactly: ${LENSES.join(", ")}`,
    );
  } else if (!labels.every(isNonEmptyString)) {
    issues.add("E_ROSTER", label, "every roster label must be non-empty");
  } else if (new Set(labels).size !== labels.length) {
    issues.add("E_ROSTER", label, "all five roster labels must be distinct");
  }

  if (!issues.empty) return { issues };

  const run = {
    schema: SCHEMAS.run,
    run_id: runId,
    created_at: createdAt,
    candidates,
    sources,
    roster: {
      analysts: Object.fromEntries(LENSES.map((l) => [l, analysts[l]])),
      judge,
      executor,
    },
  };
  const runText = stableJson(run);

  // The copies in the order of run.sources, run.json last (design §5.3 P2).
  const files = [
    ...copies.map((copy) => ({
      rel: `sources/${copy.path}`,
      content: copy.text,
    })),
    { rel: "run.json", content: runText },
  ];
  if (!createFolderAllOrNothing(root, `runs/${runId}`, files, issues)) {
    return { issues };
  }
  return { issues, runDir, seal: sha256(runText) };
}
