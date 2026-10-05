// Constants of the Pixel Office server and hook (design 2.2). Constants only.

// Fixed so that the link does not change between runs; tools/README.md names it.
export const DEFAULT_PORT = 4780;
// The server listens on this address only, and the hook posts to it only.
export const HOST = "127.0.0.1";

// The state directory lives outside the repository (REQ-001, criterion 11).
export const STATE_DIR_NAME = ".sai-pixel-office";

export const EVENTS_FILE = "events.jsonl";
export const STARTS_FILE = "server-starts.jsonl";
export const SECRET_FILE = "write-secret";
export const PORT_FILE = "port";
export const NODE_PATH_FILE = "node-path";
// The only files the server creates in the state directory.
export const STATE_FILES = Object.freeze([
  EVENTS_FILE,
  STARTS_FILE,
  SECRET_FILE,
  PORT_FILE,
  NODE_PATH_FILE,
]);

// Environment variables.
export const ENV_STATE_DIR = "SAI_PIXEL_OFFICE_DIR";
export const ENV_NODE_FALLBACKS = "SAI_NODE_FALLBACKS";

// Longest accepted write request body, in bytes.
export const BODY_MAX = 16384;
// The hook gives up on the server after this long, and exits after HARD_EXIT.
export const HOOK_HTTP_MS = 1000;
export const HOOK_HARD_EXIT_MS = 1500;
// Longest hook input the hook reads, in bytes.
export const HOOK_INPUT_MAX = 8 * 1024 * 1024;

// Value of the "app" field of every read response: a repeated start of the
// command recognises a Pixel Office server on a busy port by it.
export const APP_MARKER = "sai-pixel-office";
// How long that check waits for the occupant of the port.
export const PROBE_MS = 1000;
