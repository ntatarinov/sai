// Write protocol shared by the hook, the server and the tests (design 2.2):
// the request signature, the hook-side body builder and the server-side body
// check. This is the one place that decides what reaches the journal.
import crypto from "node:crypto";
import {
  HOOK_EVENTS,
  ID_MAX,
  SOURCE_REAL,
  WRITE_SKEW_MS,
  checkLine,
  codePointLength,
  isCanonicalTime,
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

// Hook input -> request body, or null when the event is to be dropped. A new
// object is built from the allowed fields only; nothing else is copied, so a
// new field in a hook input can never reach the journal (REQ-001, criterion 3).
// nowIso is the moment the hook fired.
export function buildWriteBody(hookInput, nowIso) {
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

  // The same check the server applies: the hook never sends what it rejects.
  const checked = checkLine(body, false);
  return checked.ok ? checked.line : null;
}

// Server-side check of a request body (the second line of data minimisation).
// Returns {ok: true, line} - the journal line with "source": "REAL" added - or
// {ok: false, reason}. Reasons: not_object, has_source, unknown_key:<name>,
// unknown_event, missing:<key>, bad_time, bad_value:<key>, time_skew (the time
// differs from nowMs by more than 60 seconds).
export function validateWriteBody(value, nowMs) {
  const checked = checkLine(value, false);
  if (!checked.ok) return checked;
  const sent = Date.parse(checked.line.time);
  if (!Number.isFinite(nowMs) || Math.abs(sent - nowMs) > WRITE_SKEW_MS) {
    return { ok: false, reason: "time_skew" };
  }
  const { time, ...rest } = checked.line;
  return { ok: true, line: { time, source: SOURCE_REAL, ...rest } };
}
