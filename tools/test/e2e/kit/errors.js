// The error type of the end-to-end kit. Every failure the kit defines is an
// E2eError with a stable code (the table in docs/design/REQ-104-e2e-chrome-kit.md,
// section 4.1); tests compare the code and parts of the message, never a stack.

export class E2eError extends Error {
  constructor(code, message, details = {}, cause = undefined) {
    super(message);
    this.name = "E2eError";
    this.code = code;
    this.details = details;
    if (cause !== undefined) this.cause = cause;
  }
}

const ESCAPES = { 10: "\\n", 13: "\\r", 9: "\\t" };

function isControl(code) {
  return (
    code < 32 || (code >= 127 && code <= 159) || code === 8232 || code === 8233
  );
}

// Text that a page or a browser controls, made safe to put into an error message
// or a log line: cut to `max` characters, every control character (a newline
// included) shown as an escape, a leading "::" (a workflow command of the CI log)
// neutralised. The caller never prints such text any other way.
export function safeText(value, max = 200) {
  let text;
  try {
    text = typeof value === "string" ? value : String(value);
  } catch {
    text = "[unprintable]";
  }
  const cut = text.length > max;
  const piece = cut ? text.slice(0, max) : text;
  let out = "";
  for (let i = 0; i < piece.length; i++) {
    const code = piece.charCodeAt(i);
    if (!isControl(code)) out += piece[i];
    else out += ESCAPES[code] ?? `\\u${code.toString(16).padStart(4, "0")}`;
  }
  if (out.startsWith("::")) out = `\\u003a${out.slice(1)}`;
  return cut ? `${out}... (${text.length - max} more characters)` : out;
}
