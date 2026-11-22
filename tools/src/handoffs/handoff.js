#!/usr/bin/env node
// `cd tools && npm run handoff -- new|close ...` (design REQ-039; decisions/0039): makes
// a new handoff file or closes one. Exit 0: done; 1: a refusal by the rules; 2: a wrong
// call or environment. A refusal is one stderr line `handoff: <code>: <text>`, without a
// stack trace and without the values of the arguments; a program error is not caught.
import { NODE_REFUSAL_EXIT, refuseBelowNodeFloor } from "../node-floor.js";
import { isOsError } from "../util.js";
import { repoRoot } from "../traces/git-files.js";
import { TraceError } from "../traces/lists.js";
import { HELP, parseArgv } from "./args.js";
import { buildDocument, handoffNames, serialize } from "./build.js";
import { closeHandoff } from "./close.js";
import { createExclusive, preflight } from "./create.js";
import { HandoffError, osCodeOf } from "./errors.js";
import { tagExists } from "./git-history.js";
import { checkText, violationLines } from "./one-file.js";
import { readRoles } from "./roles.js";
import { formatUtc } from "./times.js";

// `new`: steps 3-10 of the design (the values are already checked).
function newHandoff(opts) {
  const root = repoRoot(process.cwd());
  if (!readRoles(root).includes(opts.role))
    throw new HandoffError(
      "E_HO_INPUT",
      "ключ --role: такого кода роли нет; список — строки name: в .claude/agents/*.md (grep -h '^name:' .claude/agents/*.md)",
      1,
    );
  const hasTag = tagExists(root, opts.run);
  if (!hasTag && opts.workflow === "WF-02")
    throw new HandoffError(
      "E_HO_BASE",
      `метки base/${opts.run} нет: поставьте её до первого изменения прогона (decisions/0031)`,
      1,
    );
  // One reading of the clock for both times and for the check of the rules.
  const nowSec = Math.floor(Date.now() / 1000);
  const stamp = formatUtc(nowSec);
  const names = handoffNames(opts);
  const doc = buildDocument(
    opts,
    names,
    stamp,
    hasTag ? `base/${opts.run}` : null,
  );
  const text = serialize(doc);
  const violations = checkText({
    rel: names.rel,
    text,
    nowSec,
    commitOf: () => null,
  });
  if (violations.length > 0)
    throw new HandoffError(
      "E_HO_RULES",
      `новый текст нарушает правила учёта (REQ-038): нарушений ${violations.length}; строки — в stdout; файл не записан`,
      1,
      violationLines(violations),
    );
  preflight(root, names.rel, names.handoffId);
  createExclusive(root, names.rel, text, names.handoffId);
  return [names.rel, `handoff_id: ${names.handoffId}`];
}

function main(argv) {
  try {
    const parsed = parseArgv(argv);
    if (parsed.help) {
      process.stdout.write(`${HELP}\n`);
      return 0;
    }
    // The Node floor (REQ-110), before both commands.
    if (refuseBelowNodeFloor(process.stderr)) return NODE_REFUSAL_EXIT;
    const lines =
      parsed.cmd === "new"
        ? newHandoff(parsed.opts)
        : closeHandoff({
            root: repoRoot(process.cwd()),
            arg: parsed.opts.path,
            status: parsed.opts.status,
          });
    process.stdout.write(`${lines.join("\n")}\n`);
    return 0;
  } catch (err) {
    if (err instanceof HandoffError) {
      if (err.lines.length > 0)
        process.stdout.write(`${err.lines.join("\n")}\n`);
      process.stderr.write(`handoff: ${err.code}: ${err.message}\n`);
      return err.exit;
    }
    if (err instanceof TraceError) {
      process.stderr.write(`handoff: ${err.code}: ${err.message}\n`);
      return 2;
    }
    if (isOsError(err)) {
      process.stderr.write(
        `handoff: E_HO_IO: сбой операционной системы (${osCodeOf(err)})\n`,
      );
      return 2;
    }
    throw err;
  }
}

process.exitCode = main(process.argv.slice(2));
