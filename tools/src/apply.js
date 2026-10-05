import path from "node:path";
import {
  BLOCK_HEADING,
  CONFIDENCE_RU,
  MAX_VERSION,
  OWNER_HEADING,
  SCHEMAS,
  STATE_ANCHOR,
  STATE_END,
  STATE_START,
} from "./contract.js";
import {
  Issues,
  readTextFile,
  sha256,
  stableJson,
  writeAllOrNothing,
} from "./util.js";
import { validateRun } from "./validate.js";

// Every check runs before the first write; any issue means nothing is written (design §5).
// The write phase is all or nothing too: a failure leaves the disk as it was, or says
// in E_WRITE lines what is left (design §5.1-§5.7, decisions/0004).
export function applyVerdict(root, runDir) {
  const { issues, ctx } = validateRun(root, runDir, { stage: "review" });
  if (!issues.empty) return { issues };

  const n = ctx.latest;
  const review = ctx.reviews[n];
  const verdict = ctx.verdicts[n];
  const runRel = `runs/${ctx.runId}`;
  let mode;
  if (review.decision === "ACCEPT") mode = "recommend";
  else if (n === MAX_VERSION) mode = "escalate";
  else {
    issues.add(
      "E_NOT_ACCEPTED",
      `verdict-review-${n}.json`,
      "latest review is REJECT; the judge must rework the verdict",
    );
    return { issues };
  }

  const block =
    mode === "recommend"
      ? recommendBlock(ctx, verdict, n, runRel)
      : escalateBlock(ctx, review, runRel);

  const stateBefore = readTextFile(path.join(root, "STATE.md"));
  if (stateBefore === undefined) {
    issues.add(
      "E_STATE_ANCHOR",
      "STATE.md",
      "STATE.md missing, not a file or unreadable",
    );
    return { issues };
  }
  const stateAfter = placeBlock(stateBefore, block, issues);
  if (stateAfter === undefined) return { issues };

  const ownerBefore = ownerSection(stateBefore);
  if (ownerBefore === undefined) {
    issues.add(
      "E_STATE_ANCHOR",
      "STATE.md",
      `heading not found: ${OWNER_HEADING}`,
    );
    return { issues };
  }
  if (ownerSection(stateAfter) !== ownerBefore) {
    issues.add(
      "E_OWNER_SECTION",
      "STATE.md",
      "the owner's section would change",
    );
    return { issues };
  }

  const state = { rel: "STATE.md", content: stateAfter };
  const proposed =
    mode === "recommend"
      ? {
          rel: `${runRel}/proposed-actions.json`,
          content: stableJson({
            schema: SCHEMAS.proposed,
            run_id: ctx.runId,
            verdict_version: n,
            actions: verdict.next_actions.map((a, i) => ({
              step: String(10 + i),
              to_agent: a.to_agent,
              task: a.task,
              acceptance_criteria: a.acceptance_criteria,
            })),
          }),
        }
      : undefined;
  const written = proposed ? [state, proposed] : [state];
  const report = {
    rel: `${runRel}/apply-report.json`,
    content: stableJson({
      schema: SCHEMAS.report,
      run_id: ctx.runId,
      verdict_version: n,
      mode,
      written: written.map((f) => ({ path: f.rel, sha256: sha256(f.content) })),
    }),
  };

  // Commit order: STATE.md goes last, its rename is the commit point, so a STATE.md that
  // names proposed-actions.json never exists without it (design §5.3).
  const targets = proposed ? [proposed, report, state] : [report, state];
  const changed = writeAllOrNothing(root, targets, issues);
  return { issues, mode, changed };
}

function bullets(items) {
  return items.map((t) => `- ${t}`).join("\n");
}

function ideaTitle(ctx, ideaId) {
  const first = ctx.copies.get(`ideas/${ideaId}.md`).split("\n")[0];
  return first.replace(/^#\s+/, "");
}

function recommendBlock(ctx, verdict, n, runRel) {
  return [
    STATE_START,
    BLOCK_HEADING,
    "",
    `Прогон \`${ctx.runId}\`, вердикт версии ${n} от ${verdict.created_at.slice(0, 10)}.`,
    `Рекомендованная идея: **${ideaTitle(ctx, verdict.chosen)}** (\`${verdict.chosen}\`), уверенность: ${CONFIDENCE_RU[verdict.confidence]}.`,
    "",
    "Причины:",
    bullets(verdict.reasons.slice(0, 3).map((r) => r.text)),
    "",
    "Условия:",
    bullets(verdict.conditions),
    "",
    "Остановиться, если:",
    bullets(verdict.kill_criteria),
    "",
    "Решение принимает владелец. До его записи код продукта не пишется.",
    `Подробно: \`${runRel}/verdict-${n}.md\`; следующие шаги для ORCH: \`${runRel}/proposed-actions.json\`.`,
    STATE_END,
  ].join("\n");
}

function escalateBlock(ctx, review, runRel) {
  return [
    STATE_START,
    BLOCK_HEADING,
    "",
    `Прогон \`${ctx.runId}\`: агенты не пришли к принятому вердикту за ${MAX_VERSION} проверки.`,
    "Нужно решение владельца.",
    "",
    "Последние замечания исполнителя:",
    bullets(review.issues),
    "",
    "Решение принимает владелец. До его записи код продукта не пишется.",
    `Подробно: \`${runRel}/verdict-${MAX_VERSION}.md\`, \`${runRel}/verdict-review-${MAX_VERSION}.json\`.`,
    STATE_END,
  ].join("\n");
}

export function placeBlock(text, block, issues = new Issues()) {
  const lines = text.split("\n");
  const starts = lines.flatMap((l, i) => (l === STATE_START ? [i] : []));
  const ends = lines.flatMap((l, i) => (l === STATE_END ? [i] : []));
  const blockLines = block.split("\n");
  if (starts.length === 0 && ends.length === 0) {
    const anchor = lines.indexOf(STATE_ANCHOR);
    if (anchor === -1) {
      issues.add(
        "E_STATE_ANCHOR",
        "STATE.md",
        `line not found: ${STATE_ANCHOR}`,
      );
      return undefined;
    }
    return [
      ...lines.slice(0, anchor),
      ...blockLines,
      "",
      ...lines.slice(anchor),
    ].join("\n");
  }
  if (starts.length === 1 && ends.length === 1 && starts[0] < ends[0]) {
    return [
      ...lines.slice(0, starts[0]),
      ...blockLines,
      ...lines.slice(ends[0] + 1),
    ].join("\n");
  }
  issues.add(
    "E_STATE_MARKERS",
    "STATE.md",
    "block markers must appear exactly once each, start before end",
  );
  return undefined;
}

// The owner's section ends at the next "### " heading or at the block's start marker.
export function ownerSection(text) {
  const lines = text.split("\n");
  const start = lines.indexOf(OWNER_HEADING);
  if (start === -1) return undefined;
  let end = start + 1;
  while (
    end < lines.length &&
    !lines[end].startsWith("### ") &&
    lines[end] !== STATE_START
  )
    end++;
  return lines.slice(start, end).join("\n");
}
