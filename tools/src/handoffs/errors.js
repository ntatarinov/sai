// A handled failure of the command `handoff` (design REQ-039, 3.5): a code, a one-line
// text and an exit code, 1 (a refusal by the rules) or 2 (a wrong call or environment).
// `lines` are the lines that go to stdout with the refusal (violations of REQ-038).
export class HandoffError extends Error {
  constructor(code, message, exit, lines = []) {
    super(message);
    this.code = code;
    this.exit = exit;
    this.lines = lines;
  }
}

// The code of the operating system inside a failure, or "код не определён".
export function osCodeOf(err) {
  return err !== null &&
    typeof err === "object" &&
    typeof err.code === "string" &&
    /^E[A-Z0-9]+$/u.test(err.code)
    ? err.code
    : "код не определён";
}
