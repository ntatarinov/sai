export const LENSES = ["market", "execution", "owner_fit"];

export const CRITERIA = {
  market: ["demand_evidence", "competition_gap"],
  execution: ["cost_to_test", "build_fit"],
  owner_fit: ["owner_goals", "no_selling_self"],
};

export const ALLOWED_NEXT_AGENTS = ["REQ-ANALYST", "BA-ANALYST", "ORCH"];

export const REQUIRED_CHECKS = [
  "tool_validate",
  "totals_recomputed",
  "quotes_spot_checked",
  "dissent_covered",
  "next_actions_in_scope",
];

export const STAGES = [
  "run",
  "assessments",
  "crossreviews",
  "responses",
  "verdict",
  "review",
];

export const MAX_VERSION = 3;
export const MIN_QUOTE_LENGTH = 12;

export const RUN_ID_RE = /^WF06-\d{8}-\d{2}$/;
export const IDEA_ID_RE = /^[0-9]{2}-[a-z0-9-]+$/;
export const SOURCE_PATH_RE = /^(ideas|docs)\/[A-Za-z0-9._/-]+\.md$/;
export const FORBIDDEN_SOURCES = ["ideas/README.md"];
export const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export const SCHEMAS = {
  run: "sai.wf06-run/1",
  assessment: "sai.idea-assessment/1",
  crossreview: "sai.idea-crossreview/1",
  response: "sai.idea-response/1",
  verdict: "sai.idea-verdict/1",
  review: "sai.verdict-review/1",
  proposed: "sai.wf06-proposed-actions/1",
  report: "sai.wf06-apply-report/1",
};

export const CONCLUSION_START = "<!-- conclusion:start -->";
export const CONCLUSION_END = "<!-- conclusion:end -->";
export const STRIPPED_PARAGRAPH_PREFIXES = ["Записано:", "Статус:"];
export const STRIPPED_TABLE_COLUMNS = ["Итог", "Статус", "Почему нет"];

export const STATE_START = "<!-- sai:wf06:start -->";
export const STATE_END = "<!-- sai:wf06:end -->";
export const STATE_ANCHOR = "### Что делать дальше — по порядку";
export const OWNER_HEADING = "### Решение владельца о старте";
export const BLOCK_HEADING = "### Рекомендация агентов (WF-06)";
export const CONFIDENCE_RU = {
  low: "низкая",
  medium: "средняя",
  high: "высокая",
};

export function isSafeSourcePath(p) {
  if (typeof p !== "string" || !SOURCE_PATH_RE.test(p)) return false;
  if (FORBIDDEN_SOURCES.includes(p)) return false;
  return p.split("/").every((seg) => seg !== ".." && seg !== "." && seg !== "");
}
