// The Pixel Office HTTP server (design 2.2, section 5): localhost only, one
// signed write path, a read API, and the static files of public/. node:http
// only, no dependencies (decisions/0002).
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
import {
  SIGNATURE_HEADER,
  validateWriteBody,
  verifySignature,
} from "./protocol.js";
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

// options = { stateDir, port, now, journal, publicDir, warn }. Only stateDir
// and port are required. now returns milliseconds; journal replaces the
// journal (tests); warn receives one-line messages for stderr.
export function createServer(options) {
  const { stateDir } = options;
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

  // The body is complete. Signature, then JSON, then the form of the body; the
  // time check and the append run in one synchronous sequence, so the time is
  // compared with the clock at the moment the line is written.
  function processBody(req, res, body) {
    const key = getSecret();
    const signature = req.headers[SIGNATURE_HEADER];
    if (
      key === null ||
      typeof signature !== "string" ||
      !verifySignature(key, body, signature)
    ) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    let value;
    try {
      value = JSON.parse(body.toString("utf8"));
    } catch {
      sendJson(res, 400, { error: "not_json" });
      return;
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      sendJson(res, 400, { error: "not_json" });
      return;
    }
    const checked = validateWriteBody(value, now());
    if (!checked.ok) {
      sendJson(res, 400, { error: checked.reason });
      return;
    }
    try {
      journal.append(checked.line);
    } catch (err) {
      if (!(err instanceof JournalWriteError)) throw err;
      warn(`Pixel Office: не удалось записать событие в журнал (${err.code})`);
      sendJson(res, 500, { error: "write_failed" });
      return;
    }
    sendEmpty(res, 204);
  }

  // POST /api/events: the only write path.
  function handleWrite(req, res) {
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
        if (!tooLarge) processBody(req, res, Buffer.concat(chunks, total));
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
      if (req.method === "GET") handleRead(res, query);
      else if (req.method === "POST") handleWrite(req, res);
      else sendEmpty(res, 405, { Allow: "GET, POST" });
      return;
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
