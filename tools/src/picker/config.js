// Constants of the picker site server (design REQ-056, 5.1). Constants only: no import,
// no call of the platform.

// The one address that the server listens on; the checks of the headers and the links
// that the command prints are built from it.
export const HOST = "127.0.0.1";
// Fixed so that the link does not change between runs (Pixel Office has 4780, Sai Team 4781).
export const DEFAULT_PORT = 4782;

// The largest body of a POST, in bytes.
export const BODY_MAX = 16384;
// The longest pause in a body; after it the answer is 408.
export const BODY_IDLE_MS = 15000;
// After a refusal the rest of a body is discarded: at most DRAIN_MAX bytes, and while
// data comes at least every DRAIN_IDLE_MS.
export const DRAIN_MAX = 8 * 1024 * 1024;
export const DRAIN_IDLE_MS = 5000;

// Limits of the headers and of the times of the HTTP parser.
export const MAX_HEADER_BYTES = 16384;
export const HEADERS_TIMEOUT_MS = 10000;
export const REQUEST_TIMEOUT_MS = 30000;
export const KEEP_ALIVE_MS = 5000;
export const CHECK_INTERVAL_MS = 1000;

// More names of tenant files in the folder than this refuse the start.
export const MAX_TENANT_FILES = 100;

// The type of every answer with data.
export const JSON_TYPE = "application/json; charset=utf-8";

// The policy of every page: nothing inline, nothing foreign.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'self'",
  "img-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

// A file of public/ is a plain name with one of these extensions.
export const STATIC_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const STATIC_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
});
// The page of every tenant.
export const PAGE_FILE = "index.html";
