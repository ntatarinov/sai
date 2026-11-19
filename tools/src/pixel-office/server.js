// The Pixel Office HTTP server (design 2.2, section 5): 127.0.0.1 only, two
// signed write paths (hook events and records of the orchestrator, REQ-008),
// a read API, and the static files of public/. node:http only, no
// dependencies (decisions/0002).
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_MARKER,
  BODY_MAX,
  HOST,
  NODE_PATH_FILE,
  PORT_FILE,
} from "./config.js";
import {
  JournalReadError,
  JournalWriteError,
  createJournal,
} from "./journal.js";
import { maskSecrets } from "./mask.js";
import {
  READ_COOKIE,
  SIGNATURE_HEADER,
  linkKeyValid,
  readAllowed,
  readKeyOf,
  storeTextEnabled,
  validateNoteBody,
  validateWriteBody,
  verifySignature,
} from "./protocol.js";
import {
  NOTE_MAX,
  SOURCE_ORCH,
  WRITE_SKEW_MS,
  checkNoteLine,
  codePointLength,
} from "./public/schema.js";
import { readSecret, writeSmallFile } from "./state-dir.js";

const DEFAULT_PUBLIC_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "public",
);

// Policy of every HTML response (design 5.4): nothing inline, nothing foreign.
const CSP = [
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

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};
const JSON_TYPE = "application/json; charset=utf-8";
// After a 413 the rest of the request body is discarded: at most this many
// bytes, and while data keeps arriving at least every DRAIN_IDLE_MS.
const DRAIN_MAX = 8 * 1024 * 1024;
const DRAIN_IDLE_MS = 5000;
// A static file is a plain name in the root of public/ with one of TYPES. The
// name is at most 64 characters: a longer one cannot be a file of public/, and
// the file system would refuse it with ENAMETOOLONG.
const STATIC_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
// Opening a static file: a link in the last path component is refused (ELOOP)
// instead of followed, and a pipe or a device does not block the open.
const STATIC_OPEN =
  fs.constants.O_RDONLY |
  (fs.constants.O_NOFOLLOW ?? 0) |
  (fs.constants.O_NONBLOCK ?? 0);
// Errors of opening a static file that mean "no such file here": 404.
const NO_SUCH_FILE = new Set([
  "ENOENT",
  "ENOTDIR",
  "EISDIR",
  "ENAMETOOLONG",
  "ELOOP",
]);

function noop() {}

function commonHeaders(extra) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}

function sendEmpty(res, status, extra) {
  const headers = commonHeaders(extra);
  // A 204 has no body and so no Content-Length.
  if (status !== 204) headers["Content-Length"] = 0;
  res.writeHead(status, headers);
  res.end();
}

function sendJson(res, status, value, extra) {
  const body = JSON.stringify(value);
  res.writeHead(
    status,
    commonHeaders({
      "Content-Type": JSON_TYPE,
      "Content-Length": Buffer.byteLength(body),
      ...extra,
    }),
  );
  res.end(body);
}

// The static file name for a request path, or null when the path is not one.
function staticName(pathname) {
  if (pathname === "/") return "index.html";
  if (!pathname.startsWith("/")) return null;
  const name = pathname.slice(1);
  if (!STATIC_NAME.test(name) || name.includes("..")) return null;
  return Object.hasOwn(TYPES, path.extname(name)) ? name : null;
}

// The content of a regular file of public/, or null when there is none under
// this name: missing, a directory, a link or any other kind of file. A link is
// never followed, so nothing outside public/ can be served through one.
function readPublicFile(file) {
  let fd;
  try {
    fd = fs.openSync(file, STATIC_OPEN);
  } catch (err) {
    if (NO_SUCH_FILE.has(err.code)) return null;
    throw err;
  }
  try {
    return fs.fstatSync(fd).isFile() ? fs.readFileSync(fd) : null;
  } finally {
    fs.closeSync(fd);
  }
}

function isDigits(text) {
  return /^\d+$/.test(text);
}

function describeError(err) {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : "ошибка";
  return text.replace(/\s+/g, " ").slice(0, 200);
}

// options = { stateDir, port, now, journal, publicDir, warn, storeText }. Only
// stateDir and port are required. now returns milliseconds; journal replaces
// the journal (tests); warn receives one-line messages for stderr; storeText
// (boolean) says whether message texts are stored - when it is not given, it
// is read once from SAI_PIXEL_OFFICE_STORE_TEXT (REQ-008 2.4).
export function createServer(options) {
  const { stateDir } = options;
  const storeText =
    typeof options.storeText === "boolean"
      ? options.storeText
      : storeTextEnabled(process.env);
  const requestedPort = options.port ?? 0;
  const now = options.now ?? Date.now;
  const publicDir = options.publicDir ?? DEFAULT_PUBLIC_DIR;
  const warn = (message) => {
    try {
      (options.warn ?? ((m) => process.stderr.write(`${m}\n`)))(message);
    } catch {
      // A failing warning sink must not stop the server.
    }
  };
  const journal = options.journal ?? createJournal(stateDir, { warn });

  let actualPort = null;
  let secret = null;
  let lastReadError = null;

  // ISS-0123: a signed body is accepted once. The sha256 of every accepted body
  // is kept for twice the time tolerance (a body passes the time check for at
  // most that long), oldest first, and a second request with the same bytes in
  // that time is refused 409 replayed: the journal gets no line that no hook
  // firing produced. The time of a hook body has milliseconds, so two real
  // events never have the same bytes. The memory is the process: a replay
  // after a restart of the server, inside the time tolerance, is a named limit.
  const REPLAY_KEEP_MS = 2 * WRITE_SKEW_MS;
  const accepted = new Map();

  function bodyKey(body) {
    return crypto.createHash("sha256").update(body).digest("hex");
  }

  function replayed(key, nowMs) {
    for (const [old, at] of accepted) {
      if (nowMs - at <= REPLAY_KEEP_MS) break;
      accepted.delete(old);
    }
    return accepted.has(key);
  }

  function getSecret() {
    if (secret === null) secret = readSecret(stateDir);
    return secret;
  }

  function internalError(res, err) {
    warn(`Pixel Office: ошибка обработчика запроса: ${describeError(err)}`);
    try {
      if (res.headersSent) res.destroy();
      else sendJson(res, 500, { error: "internal" });
    } catch {
      res.destroy();
    }
  }

  function guarded(res, fn) {
    return (...args) => {
      try {
        fn(...args);
      } catch (err) {
        internalError(res, err);
      }
    };
  }

  function handleStatic(res, name) {
    const data = readPublicFile(path.join(publicDir, name));
    if (data === null) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    const type = TYPES[path.extname(name)];
    const headers = { "Content-Type": type, "Content-Length": data.length };
    if (type.startsWith("text/html")) {
      headers["Content-Security-Policy"] = CSP;
      headers["X-Frame-Options"] = "DENY";
    }
    res.writeHead(200, commonHeaders(headers));
    res.end(data);
  }

  // GET /api/events?after=<n>[&limit=<m>]: one snapshot of the journal.
  function handleRead(res, query) {
    const params = new URLSearchParams(query);
    // A missing, negative, fractional or non-numeric `after` reads from 0.
    const rawAfter = params.get("after");
    const after =
      rawAfter === null ? 0 : isDigits(rawAfter) ? Number(rawAfter) : NaN;
    let limit;
    const rawLimit = params.get("limit");
    if (rawLimit !== null) {
      if (!isDigits(rawLimit)) {
        sendJson(res, 400, { error: "bad_limit" });
        return;
      }
      limit = Number(rawLimit);
    }
    let result;
    let starts;
    try {
      result = journal.read(after, limit);
      starts = journal.starts();
    } catch (err) {
      if (!(err instanceof JournalReadError)) throw err;
      // The page polls every two seconds: report a given failure once.
      if (lastReadError !== err.message) {
        lastReadError = err.message;
        warn(`Pixel Office: ${err.message}`);
      }
      sendJson(res, 500, { error: "read_failed" });
      return;
    }
    lastReadError = null;
    sendJson(res, 200, {
      app: APP_MARKER,
      lines: result.lines,
      from: result.from,
      events: result.events,
      server_starts: starts,
    });
  }

  // Sockets that already have the idle timeout of a discarded body: it is set
  // once per socket, because every call of setTimeout with a callback adds one
  // more 'timeout' listener, and a keep-alive connection can get many 413.
  const drainTimeoutSet = new WeakSet();

  // 413: nothing is buffered beyond BODY_MAX. The rest of what the client is
  // still sending is read and thrown away (up to DRAIN_MAX, and while it keeps
  // arriving), because a connection closed on unread data is reset and the
  // client would never see the 413.
  function answerTooLarge(req, res) {
    if (!res.headersSent) sendJson(res, 413, { error: "too_large" });
    const socket = req.socket;
    if (!drainTimeoutSet.has(socket)) {
      drainTimeoutSet.add(socket);
      socket.setTimeout(DRAIN_IDLE_MS, () => socket.destroy());
    }
  }

  // The body is complete: the signature, then JSON. The parsed object, or
  // null when the answer (401 or 400) is sent already.
  function signedObject(req, res, body) {
    const key = getSecret();
    const signature = req.headers[SIGNATURE_HEADER];
    if (
      key === null ||
      typeof signature !== "string" ||
      !verifySignature(key, body, signature)
    ) {
      sendJson(res, 401, { error: "unauthorized" });
      return null;
    }
    let value;
    try {
      value = JSON.parse(body.toString("utf8"));
    } catch {
      sendJson(res, 400, { error: "not_json" });
      return null;
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      sendJson(res, 400, { error: "not_json" });
      return null;
    }
    return value;
  }

  function appendOr500(res, line, what) {
    try {
      journal.append(line);
      return true;
    } catch (err) {
      if (!(err instanceof JournalWriteError)) throw err;
      warn(`Pixel Office: не удалось записать ${what} в журнал (${err.code})`);
      sendJson(res, 500, { error: "write_failed" });
      return false;
    }
  }

  // POST /api/events. The form of the body; the time check and the append run
  // in one synchronous sequence, so the time is compared with the clock at the
  // moment the line is written.
  function processEvent(req, res, body) {
    const value = signedObject(req, res, body);
    if (value === null) return;
    const nowMs = now();
    const checked = validateWriteBody(value, nowMs, { storeText });
    if (!checked.ok) {
      sendJson(res, 400, { error: checked.reason });
      return;
    }
    const key = bodyKey(body);
    if (replayed(key, nowMs)) {
      sendJson(res, 409, { error: "replayed" });
      return;
    }
    if (!appendOr500(res, checked.line, "событие")) return;
    accepted.set(key, nowMs);
    sendEmpty(res, 204);
  }

  // POST /api/note: a record of the orchestrator (REQ-008 5.2, steps 5-10).
  // The form of the body, the storage switch, masking; then the binding to the
  // last owner message and the append run in one synchronous sequence (no
  // await): no other line can come between the search and the append.
  function processNote(req, res, body) {
    const value = signedObject(req, res, body);
    if (value === null) return;
    const nowMs = now();
    const checked = validateNoteBody(value, nowMs);
    if (!checked.ok) {
      sendJson(res, 400, { error: checked.reason });
      return;
    }
    if (!storeText) {
      sendJson(res, 400, { error: "text_storage_off" });
      return;
    }
    // A note body has no time of its own: the same bytes inside the keep time
    // are the same request sent again (ISS-0123).
    const key = bodyKey(body);
    if (replayed(key, nowMs)) {
      sendJson(res, 409, { error: "replayed" });
      return;
    }
    const { fields } = checked;
    const noteText = maskSecrets(fields.note_text);
    if (codePointLength(noteText, NOTE_MAX) > NOTE_MAX) {
      sendJson(res, 400, { error: "too_long_after_mask" });
      return;
    }
    let requestTime = fields.request_time ?? null;
    let auto = false;
    if (requestTime === null) {
      let found;
      try {
        found = journal.lastOwnerPrompt(fields.session_id ?? null);
      } catch (err) {
        if (!(err instanceof JournalReadError)) throw err;
        warn(`Pixel Office: ${err.message}`);
        sendJson(res, 500, { error: "read_failed" });
        return;
      }
      if (found !== null) {
        requestTime = found.time;
        auto = true;
      }
    }
    const record = {
      time: new Date(nowMs).toISOString(),
      source: SOURCE_ORCH,
      note_text: noteText,
    };
    if (fields.session_id !== undefined) record.session_id = fields.session_id;
    if (fields.req_id !== undefined) record.req_id = fields.req_id;
    if (requestTime !== null) record.request_time = requestTime;
    if (auto) record.request_time_auto = true;
    // The canonical order of the keys, and the last check of the record.
    const line = checkNoteLine(record);
    if (!line.ok) {
      sendJson(res, 400, { error: line.reason });
      return;
    }
    if (!appendOr500(res, line.line, "запись оркестратора")) return;
    accepted.set(key, nowMs);
    sendJson(res, 200, {
      request_time: requestTime,
      request_time_auto: auto,
    });
  }

  // A signed write (POST /api/events or POST /api/note): the body is read up
  // to BODY_MAX bytes and given to onBody.
  function handleWrite(req, res, onBody) {
    const declared = req.headers["content-length"];
    let tooLarge =
      declared !== undefined &&
      isDigits(declared) &&
      Number(declared) > BODY_MAX;
    if (tooLarge) answerTooLarge(req, res);
    const chunks = [];
    let total = 0;
    req.on(
      "data",
      guarded(res, (chunk) => {
        total += chunk.length;
        if (!tooLarge && total > BODY_MAX) {
          tooLarge = true;
          chunks.length = 0;
          answerTooLarge(req, res);
        }
        if (tooLarge) {
          if (total > DRAIN_MAX) req.destroy();
          return;
        }
        chunks.push(chunk);
      }),
    );
    req.on(
      "end",
      guarded(res, () => {
        if (!tooLarge) onBody(req, res, Buffer.concat(chunks, total));
      }),
    );
  }

  function route(req, res) {
    // 1. Host, before anything touches the journal: a page from another site
    // that reaches this port through DNS rebinding sends its own Host.
    const host = req.headers.host;
    if (
      host !== `${HOST}:${actualPort}` &&
      host !== `localhost:${actualPort}`
    ) {
      sendEmpty(res, 403);
      return;
    }
    // 2. Method and path. The request target is split by hand: it is never
    // interpreted as a URL.
    const target = req.url ?? "";
    const q = target.indexOf("?");
    const pathname = q === -1 ? target : target.slice(0, q);
    const query = q === -1 ? "" : target.slice(q + 1);
    if (pathname === "/api/events") {
      if (req.method === "GET") {
        // 3. ISS-0122: the journal is read only with the read key.
        if (!readAllowed(req.headers, readKeyOf(getSecret()))) {
          sendJson(res, 401, { error: "unauthorized" });
          return;
        }
        handleRead(res, query);
      } else if (req.method === "POST") handleWrite(req, res, processEvent);
      else sendEmpty(res, 405, { Allow: "GET, POST" });
      return;
    }
    if (pathname === "/api/note") {
      if (req.method === "POST") handleWrite(req, res, processNote);
      else sendEmpty(res, 405, { Allow: "POST" });
      return;
    }
    // The link of the command (/?k=<read key>): the key goes into a cookie
    // that only this browser holds, and the address without the key is
    // opened (ISS-0122). A wrong key sets nothing and the page is served as
    // usual: its reads are then refused.
    if (pathname === "/" && req.method === "GET") {
      const key = readKeyOf(getSecret());
      if (linkKeyValid(query, key)) {
        sendEmpty(res, 303, {
          Location: "/",
          "Set-Cookie": `${READ_COOKIE}=${key}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`,
        });
        return;
      }
    }
    const name = staticName(pathname);
    if (name !== null) {
      if (req.method === "GET") handleStatic(res, name);
      else sendEmpty(res, 405, { Allow: "GET" });
      return;
    }
    sendJson(res, 404, { error: "not_found" });
  }

  const server = http.createServer((req, res) => {
    req.on("error", noop);
    res.on("error", noop);
    guarded(res, route)(req, res);
  });

  return {
    // Binds to 127.0.0.1 (port 0: any free port). The bind is the only check
    // that the port is free. Then, before any request can be served, the start
    // is recorded and the files `port` and `node-path` are written; if that
    // fails, the server is closed and the promise is rejected.
    listen() {
      return new Promise((resolve, reject) => {
        const onListening = () => {
          server.off("error", onBindError);
          try {
            actualPort = server.address().port;
            secret = readSecret(stateDir);
            journal.recordStart(new Date(now()).toISOString());
            writeSmallFile(stateDir, PORT_FILE, `${actualPort}\n`);
            writeSmallFile(stateDir, NODE_PATH_FILE, `${process.execPath}\n`);
          } catch (err) {
            server.close(() => reject(err));
            server.closeAllConnections();
            return;
          }
          server.on("error", (err) => {
            warn(`Pixel Office: ошибка сервера: ${describeError(err)}`);
          });
          resolve({ port: actualPort });
        };
        const onBindError = (err) => {
          server.off("listening", onListening);
          reject(err);
        };
        server.once("error", onBindError);
        server.once("listening", onListening);
        server.listen(requestedPort, HOST);
      });
    },

    // Stops accepting and closes the open connections.
    close() {
      return new Promise((resolve) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close(() => resolve());
        server.closeAllConnections();
      });
    },
  };
}
