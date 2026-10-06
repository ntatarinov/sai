// The parser of the output `--output-format stream-json` of Claude Code (design
// REQ-010, section 5.4): "by form, with a margin". It checks only what it cannot do
// without, skips and counts everything else. A pure module without Node API.
//
// The form is taken from `claude --help` 2.1.289 and from the names of the fields
// found in the installed file; the nesting is an assumption until a real run is
// recorded (I4 of the design).

// The names of the fields the parser reads (EX-21 compares the samples with them).
export const KNOWN_FIELDS = Object.freeze([
  "type",
  "subtype",
  "message",
  "content",
  "text",
  "name",
  "id",
  "tool_use_id",
  "is_error",
  "result",
  "total_cost_usd",
  "structured_output",
]);

const WEB_TOOL_NAMES = new Set(["WebFetch", "WebSearch"]);

// tool_use name -> activity (section 5.5).
const ACTIVITY_BY_TOOL = Object.freeze({
  Read: "reading",
  Glob: "reading",
  Grep: "reading",
  WebSearch: "searching",
  WebFetch: "searching",
  Write: "writing",
  Edit: "writing",
});

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseObject(text) {
  try {
    const value = JSON.parse(text);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

// { push(line) -> { events }, finish() -> StreamSummary }.
// events: ExecutorEvent[] observed in this line ({ kind: "activity", ... }).
export function createStreamParser() {
  let lines = 0;
  let skipped = 0;
  let broken = 0;
  let webError = false;
  let result = null;
  const toolNames = new Map();

  function onAssistant(obj, events) {
    const content = isObject(obj.message) ? obj.message.content : undefined;
    if (!Array.isArray(content)) {
      skipped += 1;
      return;
    }
    for (const item of content) {
      if (!isObject(item)) continue;
      if (item.type === "tool_use" && typeof item.name === "string") {
        if (typeof item.id === "string") toolNames.set(item.id, item.name);
        const activity = Object.prototype.hasOwnProperty.call(
          ACTIVITY_BY_TOOL,
          item.name,
        )
          ? ACTIVITY_BY_TOOL[item.name]
          : "other";
        events.push({ kind: "activity", activity, text: null });
      } else if (item.type === "text" && typeof item.text === "string") {
        events.push({
          kind: "activity",
          activity: "thinking",
          text: item.text,
        });
      }
    }
  }

  function onUser(obj) {
    const content = isObject(obj.message) ? obj.message.content : undefined;
    if (!Array.isArray(content)) {
      skipped += 1;
      return;
    }
    for (const item of content) {
      if (!isObject(item)) continue;
      if (
        item.type === "tool_result" &&
        item.is_error === true &&
        typeof item.tool_use_id === "string" &&
        WEB_TOOL_NAMES.has(toolNames.get(item.tool_use_id))
      ) {
        webError = true;
      } else if (
        item.type === "web_search_tool_result" &&
        !Array.isArray(item.content)
      ) {
        webError = true;
      }
    }
  }

  function onResult(obj) {
    if (
      result !== null ||
      typeof obj.subtype !== "string" ||
      typeof obj.is_error !== "boolean"
    ) {
      broken += 1;
      return;
    }
    const cost =
      typeof obj.total_cost_usd === "number" &&
      Number.isFinite(obj.total_cost_usd) &&
      obj.total_cost_usd >= 0
        ? obj.total_cost_usd
        : null;
    let answer = null;
    if (isObject(obj.structured_output)) {
      answer = obj.structured_output;
    } else if (typeof obj.result === "string") {
      answer = parseObject(obj.result);
    }
    result = { subtype: obj.subtype, is_error: obj.is_error, cost, answer };
  }

  return {
    push(line) {
      const events = [];
      if (typeof line !== "string" || line.trim() === "") return { events };
      lines += 1;
      const obj = parseObject(line);
      if (obj === null || typeof obj.type !== "string") {
        broken += 1;
        return { events };
      }
      switch (obj.type) {
        case "system":
          skipped += 1;
          break;
        case "assistant":
          onAssistant(obj, events);
          break;
        case "user":
          onUser(obj);
          break;
        case "result":
          onResult(obj);
          break;
        default:
          skipped += 1;
      }
      return { events };
    },
    finish() {
      return { lines, skipped, broken, webError, result };
    },
  };
}
