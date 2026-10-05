// Write protocol shared by the hook, the server and the tests (design 2.2):
// the request signature, the hook-side body builder and the server-side body
// check. This is the one place that decides what reaches the journal.
import crypto from "node:crypto";
import { BODY_MAX, ENV_STORE_TEXT, PROMPT_SCAN_MAX } from "./config.js";
import { maskSecrets, prepareText } from "./mask.js";
import {
  HOOK_EVENTS,
  ID_MAX,
  PROMPT_MAX,
  SERVICE_MARKERS,
  SOURCE_ORCH,
  SOURCE_REAL,
  WRITE_SKEW_MS,
  checkLine,
  checkNoteLine,
  codePointLength,
  firstCodePoints,
  isCanonicalTime,
  safeKeyName,
  truncateDescription,
} from "./public/schema.js";

// Header with the signature of the request body.
export const SIGNATURE_HEADER = "x-pixel-office-signature";

const SIGNATURE_PATTERN = /^[0-9a-fA-F]{64}$/;

function isBytes(body) {
  return typeof body === "string" || body instanceof Uint8Array;
}

// HMAC-SHA256 over the bytes of the body. The key is the secret string as it
// is (its UTF-8 bytes; it is not decoded from base64url). 64 lowercase hex digits.
export function signBody(secret, body) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

// True only for a correct signature of this body under this secret. Compares
// in constant time and never throws: a missing or malformed signature is false.
export function verifySignature(secret, body, signature) {
  if (typeof secret !== "string" || secret === "" || !isBytes(body)) {
    return false;
  }
  if (typeof signature !== "string" || !SIGNATURE_PATTERN.test(signature)) {
    return false;
  }
  const expected = Buffer.from(signBody(secret, body), "hex");
  const given = Buffer.from(signature, "hex");
  return (
    expected.length === given.length && crypto.timingSafeEqual(expected, given)
  );
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const ABSENT = Symbol("absent");
const TOO_LONG = Symbol("too_long");

// A string field of a hook input: the string, ABSENT (not a string, or shorter
// than min) or TOO_LONG (more than ID_MAX code points: the event is dropped).
function takeString(value, min) {
  if (typeof value !== "string") return ABSENT;
  const n = codePointLength(value, ID_MAX);
  if (n > ID_MAX) return TOO_LONG;
  return n < min ? ABSENT : value;
}

// Storage of message texts (REQ-008 2.4): on only when the variable is
// absent, empty or "1"; "0" and any other value (a typo too) turn it off.
export function storeTextEnabled(env) {
  const value =
    env !== null && typeof env === "object" ? env[ENV_STORE_TEXT] : undefined;
  return value === undefined || value === "" || value === "1";
}

function bodyBytes(line) {
  return Buffer.byteLength(JSON.stringify(line), "utf8");
}

// The fields of an owner message (REQ-008 4, steps 1-5).
function addPromptFields(body, prompt, storeText) {
  if (typeof prompt !== "string") return;
  const head = prompt.trimStart();
  const service = SERVICE_MARKERS.some((m) => head.startsWith(m));
  body.prompt_kind = service ? "service" : "owner";
  if (service || !storeText) return;
  const prepared = prepareText(prompt, PROMPT_SCAN_MAX, PROMPT_MAX);
  if (prepared.text === "") return;
  body.prompt_text = prepared.text;
  if (prepared.truncated) body.prompt_truncated = true;
}

// Step 6: a body longer than BODY_MAX bytes (as JSON, the way it is sent) gets
// the longest start of prompt_text with which it fits; a binary search over
// the number of code points. The text is masked already.
function fitBody(line) {
  if (bodyBytes(line) <= BODY_MAX || typeof line.prompt_text !== "string") {
    return line;
  }
  const points = Array.from(line.prompt_text);
  const trial = { ...line, prompt_truncated: true };
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    trial.prompt_text = points.slice(0, mid).join("");
    if (bodyBytes(trial) <= BODY_MAX) lo = mid;
    else hi = mid - 1;
  }
  const text = firstCodePoints(line.prompt_text, lo);
  const out = { ...line };
  delete out.prompt_text;
  delete out.prompt_truncated;
  if (text.trim() !== "") {
    out.prompt_text = text;
    out.prompt_truncated = true;
  }
  return out;
}

// Hook input -> request body, or null when the event is to be dropped. A new
// object is built from the allowed fields only; nothing else is copied, so a
// new field in a hook input can never reach the journal (REQ-001, criterion 3).
// nowIso is the moment the hook fired. options.storeText: the text of an owner
// message is stored (masked, REQ-008 4); false when not given.
export function buildWriteBody(hookInput, nowIso, options = {}) {
  const storeText = options !== null && options.storeText === true;
  if (!isPlainObject(hookInput) || !isCanonicalTime(nowIso)) return null;
  const event = hookInput.hook_event_name;
  if (typeof event !== "string" || !HOOK_EVENTS.includes(event)) return null;

  const sessionId = takeString(hookInput.session_id, 1);
  if (typeof sessionId !== "string") return null;
  const body = { time: nowIso, hook_event_name: event, session_id: sessionId };

  const agentId = takeString(hookInput.agent_id, 1);
  if (agentId === TOO_LONG) return null;
  if (typeof agentId === "string") body.agent_id = agentId;
  else if (event === "SubagentStart" || event === "SubagentStop") return null;

  const agentType = takeString(hookInput.agent_type, 0);
  if (agentType === TOO_LONG) return null;
  if (typeof agentType === "string") body.agent_type = agentType;

  if (event === "PostToolUse") {
    if (hookInput.tool_name !== "Agent") return null;
    const toolUseId = takeString(hookInput.tool_use_id, 1);
    if (typeof toolUseId !== "string") return null;
    const response = hookInput.tool_response;
    const launched = isPlainObject(response)
      ? takeString(response.agentId, 1)
      : ABSENT;
    if (typeof launched !== "string") return null;
    body.tool_use_id = toolUseId;
    body.launched_agent_id = launched;

    const input = hookInput.tool_input;
    if (isPlainObject(input)) {
      const subagentType = takeString(input.subagent_type, 1);
      if (subagentType === TOO_LONG) return null;
      if (typeof subagentType === "string") body.subagent_type = subagentType;
      if (typeof input.description === "string") {
        const description = truncateDescription(input.description);
        if (description !== "") body.description = description;
      }
    }
  }

  if (event === "UserPromptSubmit") {
    addPromptFields(body, hookInput.prompt, storeText);
  }

  // The same check the server applies: the hook never sends what it rejects.
  const checked = checkLine(body, false);
  if (!checked.ok) return null;
  const fitted = checkLine(fitBody(checked.line), false);
  return fitted.ok ? fitted.line : null;
}

// Server-side check of a request body (the second line of data minimisation).
// Returns {ok: true, line} - the journal line with "source": "REAL" added - or
// {ok: false, reason}. Reasons: not_object, has_source, unknown_key:<name>,
// not_allowed:<key>, unknown_event, missing:<key>, bad_time, bad_value:<key>,
// time_skew (the time differs from nowMs by more than 60 seconds),
// text_storage_off (prompt_text while options.storeText is not true).
// prompt_text is masked again; longer than PROMPT_MAX after that, it is cut
// and gets prompt_truncated.
export function validateWriteBody(value, nowMs, options = {}) {
  const storeText = options !== null && options.storeText === true;
  const checked = checkLine(value, false);
  if (!checked.ok) return checked;
  const sent = Date.parse(checked.line.time);
  if (!Number.isFinite(nowMs) || Math.abs(sent - nowMs) > WRITE_SKEW_MS) {
    return { ok: false, reason: "time_skew" };
  }
  const { time, ...rest } = checked.line;
  if (Object.hasOwn(rest, "prompt_text")) {
    if (!storeText) return { ok: false, reason: "text_storage_off" };
    const masked = maskSecrets(rest.prompt_text);
    if (codePointLength(masked, PROMPT_MAX) > PROMPT_MAX) {
      rest.prompt_text = firstCodePoints(masked, PROMPT_MAX);
      rest.prompt_truncated = true;
    } else {
      rest.prompt_text = masked;
    }
  }
  return { ok: true, line: { time, source: SOURCE_REAL, ...rest } };
}

// The keys a body of POST /api/note may have.
const NOTE_BODY_KEYS = new Set([
  "note_text",
  "req_id",
  "request_time",
  "session_id",
]);

// Server-side check of a body of POST /api/note (REQ-008 5.2, step 6).
// Returns {ok: true, fields} - note_text and the given ones of req_id,
// request_time, session_id, not masked yet - or {ok: false, reason}. Reasons:
// not_object, has_source, has_time, unknown_key:<name>, missing:note_text,
// bad_value:<key>, empty_note; bad_value:request_time also for a request time
// later than nowMs by more than 60 seconds.
export function validateNoteBody(value, nowMs) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "not_object" };
  }
  if (Object.hasOwn(value, "source"))
    return { ok: false, reason: "has_source" };
  if (Object.hasOwn(value, "time")) return { ok: false, reason: "has_time" };
  for (const key of Object.keys(value)) {
    if (!NOTE_BODY_KEYS.has(key)) {
      return { ok: false, reason: `unknown_key:${safeKeyName(key)}` };
    }
  }
  if (!Number.isFinite(nowMs)) return { ok: false, reason: "time_skew" };
  const checked = checkNoteLine({
    ...value,
    time: new Date(nowMs).toISOString(),
    source: SOURCE_ORCH,
  });
  if (!checked.ok) return checked;
  const fields = {};
  for (const key of NOTE_BODY_KEYS) {
    if (Object.hasOwn(checked.line, key)) fields[key] = checked.line[key];
  }
  if (
    Object.hasOwn(fields, "request_time") &&
    Date.parse(fields.request_time) - nowMs > WRITE_SKEW_MS
  ) {
    return { ok: false, reason: "bad_value:request_time" };
  }
  return { ok: true, fields };
}
