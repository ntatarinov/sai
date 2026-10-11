// Constants of the server of the business interface of Sai Team (design REQ-011,
// section 3; decisions/0024, 0025). Constants only.

// The only address of the server (criterion 1).
export const HOST = "127.0.0.1";
// Fixed so that the link does not change between runs (Pixel Office has 4780).
export const DEFAULT_PORT = 4781;
// The largest body of a write request, in bytes: equal to the largest message of
// the command queue of the engine, so a message above it is refused before any
// write (criterion 15 (c)).
export const BODY_MAX = 65_536;
// The largest body of a request of control of a project (pause, resume, stop), in
// bytes; over it — 400 "not understood" (design REQ-035, section 2;
// decisions/0032, C2).
export const CONTROL_BODY_MAX = 4_096;
// The longest pause while the body of a POST is read: from the start of the read
// and from each next part of the body; over it — 408 (section 4.1, step 4).
export const BODY_IDLE_MS = 15_000;
// The header of the key of the page (decisions/0025, W2).
export const KEY_HEADER = "x-sai-page";
// Random bytes of the key (64 hex characters).
export const KEY_BYTES = 32;
// The Content-Type of every API answer and of every refusal (section 4.2).
export const JSON_TYPE = "application/json; charset=utf-8";
// How long a request that creates or resumes a project waits for the first write
// of the engine, and the step of that wait (section 8.3; design REQ-035,
// section 7).
export const ENGINE_START_WAIT_MS = 5_000;
export const START_POLL_MS = 50;
// The wait for the engines to stop when the server ends (= CANCEL_WAIT_MS of the
// engine).
export const SHUTDOWN_WAIT_MS = 15_000;
// Phrases of "what is happening" (criterion 4 (1)).
export const LAST_PHRASES = 5;
// The name of a file of the page.
export const STATIC_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
// The allowed files of the page by extension.
export const STATIC_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
});
