#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyVerdict } from "./apply.js";
import { STAGES } from "./contract.js";
import { NODE_REFUSAL_EXIT, refuseBelowNodeFloor } from "./node-floor.js";
import { prepareRun } from "./prepare.js";
import { snapshot, snapshotDiff } from "./snapshot.js";
import { UsageError, readTextFile } from "./util.js";
import { validateRun } from "./validate.js";

const DEFAULT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function parseArgs(argv, spec) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const name = a.slice(2);
    if (!(name in spec)) throw new UsageError(`unknown option --${name}`);
    const value = argv[++i];
    if (value === undefined) throw new UsageError(`--${name} needs a value`);
    if (spec[name] === "many") (opts[name] ??= []).push(value);
    else opts[name] = value;
  }
  return { positional, opts };
}

function resolveRunDir(root, arg) {
  if (arg === undefined)
    throw new UsageError("run folder argument is required");
  const runsDir = path.resolve(root, "runs");
  const runDir = path.resolve(arg);
  const rel = path.relative(runsDir, runDir);
  if (
    rel === "" ||
    rel.startsWith("..") ||
    rel.includes(path.sep) ||
    path.isAbsolute(rel)
  ) {
    throw new UsageError(`run folder must be directly inside ${runsDir}`);
  }
  if (!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
    throw new UsageError(`run folder not found: ${runDir}`);
  }
  return runDir;
}

function report(issues) {
  for (const i of issues.list)
    process.stderr.write(`${i.code} ${i.file}: ${i.message}\n`);
}

const commands = {
  "prepare-run"(argv) {
    const { positional, opts } = parseArgs(argv, {
      root: "one",
      candidates: "one",
      context: "one",
      analyst: "many",
      judge: "one",
      executor: "one",
      "created-at": "one",
    });
    const root = path.resolve(opts.root ?? DEFAULT_ROOT);
    const analysts = {};
    for (const pair of opts.analyst ?? []) {
      const eq = pair.indexOf("=");
      if (eq < 1)
        throw new UsageError(`--analyst expects <lens>=<label>, got "${pair}"`);
      analysts[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    const split = (v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const result = prepareRun(root, {
      runId: positional[0],
      candidates: split(opts.candidates),
      context: split(opts.context),
      analysts,
      judge: opts.judge,
      executor: opts.executor,
      createdAt: opts["created-at"],
    });
    if (!result.issues.empty) {
      report(result.issues);
      return 1;
    }
    process.stdout.write(`prepared ${positional[0]}\nseal ${result.seal}\n`);
    return 0;
  },

  validate(argv) {
    const { positional, opts } = parseArgs(argv, {
      root: "one",
      stage: "one",
      seal: "one",
    });
    const root = path.resolve(opts.root ?? DEFAULT_ROOT);
    const stage = opts.stage ?? "review";
    if (!STAGES.includes(stage))
      throw new UsageError(`--stage must be one of: ${STAGES.join(", ")}`);
    const runDir = resolveRunDir(root, positional[0]);
    const { issues } = validateRun(root, runDir, { stage, seal: opts.seal });
    if (!issues.empty) {
      report(issues);
      return 1;
    }
    process.stdout.write(`OK ${path.basename(runDir)} (stage ${stage})\n`);
    return 0;
  },

  "apply-verdict"(argv) {
    const { positional, opts } = parseArgs(argv, { root: "one" });
    const root = path.resolve(opts.root ?? DEFAULT_ROOT);
    const runDir = resolveRunDir(root, positional[0]);
    const result = applyVerdict(root, runDir);
    if (!result.issues.empty) {
      report(result.issues);
      return 1;
    }
    process.stdout.write(
      result.changed === 0 ? "unchanged\n" : `applied ${result.mode}\n`,
    );
    return 0;
  },

  snapshot(argv) {
    const { positional, opts } = parseArgs(argv, { root: "one" });
    const root = path.resolve(opts.root ?? DEFAULT_ROOT);
    if (positional[0] === undefined)
      throw new UsageError("output file argument is required");
    fs.writeFileSync(positional[0], snapshot(root));
    return 0;
  },

  "snapshot-diff"(argv) {
    const { positional, opts } = parseArgs(argv, { allow: "many" });
    if (positional.length !== 2)
      throw new UsageError("expects <before> <after>");
    const read = (f) => {
      const text = readTextFile(f);
      if (text === undefined)
        throw new UsageError(
          `snapshot missing, not a file or unreadable: ${f}`,
        );
      return text;
    };
    const diffs = snapshotDiff(
      read(positional[0]),
      read(positional[1]),
      opts.allow ?? [],
    );
    for (const d of diffs) process.stdout.write(`${d}\n`);
    return diffs.length === 0 ? 0 : 1;
  },
};

function main(argv) {
  // The Node floor (REQ-110), before any of the five commands.
  if (refuseBelowNodeFloor(process.stderr)) return NODE_REFUSAL_EXIT;
  const [command, ...rest] = argv;
  try {
    if (!(command in commands))
      throw new UsageError(`unknown command "${command}"`);
    return commands[command](rest);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`E_USAGE: ${err.message}\n`);
      return 2;
    }
    throw err;
  }
}

process.exitCode = main(process.argv.slice(2));
