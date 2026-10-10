// The HTTP server of the business interface of Sai Team (design REQ-011, sections
// 4, 5 and 12; decisions/0024, 0025). 127.0.0.1 only; the checks of Host, Origin
// and the key of the page before any read of data; the files of the page from
// memory. node:http only, no dependencies (decisions/0002).
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { formatError } from "../team/errors.js";
import { PATTERNS } from "../team/schema.js";
import {
  failure,
  getChat,
  getProject,
  getProjects,
  getRole,
  getTask,
  notFoundReply,
  postChat,
  postProject,
} from "./api.js";
import {
  BODY_IDLE_MS,
  BODY_MAX,
  HOST,
  JSON_TYPE,
  KEY_BYTES,
  KEY_HEADER,
  STATIC_NAME,
  STATIC_TYPES,
} from "./config.js";
import { TEXT } from "./texts.js";

// Policy of every HTML answer (as Pixel Office): nothing inline, nothing foreign.
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

// The marker of the key in index.html (section 4.3): <meta name="sai-page"
// content=""> — also in the form "… content="" />" that the formatter of the
// repository writes. The key goes into its content.
const KEY_MARK = /<meta name="sai-page" content="" ?\/?>/g;
const keyMeta = (mark, key) => mark.replace('content=""', `content="${key}"`);
const KEY_FORM = /^[0-9a-f]{64}$/;
// A role number in a path: 1, 2, … without leading zeros (the range is checked by
// the handler against the catalog, before any read).
const ROLE_NO = /^[1-9][0-9]?$/;
// After a refused request the rest of its body is read and thrown away: at most
// this many bytes, and while data keeps coming at least every DRAIN_IDLE_MS.
const DRAIN_MAX = 8 * 1024 * 1024;
const DRAIN_IDLE_MS = 5000;
// Reading a file of the page: a link in the last part is refused instead of
// followed, and a pipe or a device does not block.
const READ_FLAGS =
  fs.constants.O_RDONLY |
  (fs.constants.O_NOFOLLOW ?? 0) |
  (fs.constants.O_NONBLOCK ?? 0);

export class PublicFilesError extends Error {}

// The files of the page (decisions/0025, W6), read once at the start: regular
// files only, not links, with a name of STATIC_NAME and an extension of
// STATIC_TYPES. index.html must hold the marker of the key exactly once.
// Returns Map<name, Buffer>; throws PublicFilesError.
export function loadPublicFiles(dir) {
  const files = new Map();
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    throw new PublicFilesError("public");
  }
  for (const e of entries) {
    if (!e.isFile() || !STATIC_NAME.test(e.name)) continue;
    if (!Object.hasOwn(STATIC_TYPES, path.extname(e.name))) continue;
    try {
      const data = fs.readFileSync(path.join(dir, e.name), {
        flag: READ_FLAGS,
      });
      files.set(e.name, data);
    } catch {
      throw new PublicFilesError(e.name);
    }
  }
  const index = files.get("index.html");
  if (
    index === undefined ||
    (index.toString("utf8").match(KEY_MARK) ?? []).length !== 1
  ) {
    throw new PublicFilesError("index.html");
  }
  return files;
}

function noop() {}

function commonHeaders(extra) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}

function sendJson(res, status, value, extra = {}) {
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

function sendReply(res, reply, extra) {
  sendJson(res, reply.status, reply.body, extra);
}

function isDigits(text) {
  return /^\d+$/.test(text);
}

// The type of the body (section 4.1, 3.2): the value before the first ";", without
// spaces and tabs at the ends, in lower case, is exactly application/json.
function isJsonType(value) {
  if (typeof value !== "string") return false;
  const base = value.split(";")[0].replace(/^[ \t]+|[ \t]+$/g, "");
  return base.toLowerCase() === "application/json";
}

// The parts of a path: split at "/", each decoded once. null — not decodable.
function pathParts(pathname) {
  if (!pathname.startsWith("/")) return null;
  const parts = pathname.slice(1).split("/");
  try {
    return parts.map((p) => decodeURIComponent(p));
  } catch {
    return null;
  }
}

// The route of a path: { get?, post?, field } or null (section 5.1). field — the
// field of the form a too big body belongs to.
function routeOf(parts) {
  if (parts.length < 2 || parts[0] !== "api" || parts[1] !== "projects") {
    return null;
  }
  if (parts.length === 2) {
    return {
      get: (ctx) => getProjects(ctx),
      post: (ctx, body) => postProject(ctx, body),
      field: null,
    };
  }
  const id = parts[2];
  if (!PATTERNS.project.test(id)) return null;
  if (parts.length === 3) {
    return { get: (ctx) => getProject(ctx, id), field: null };
  }
  if (parts.length === 4 && parts[3] === "chat") {
    return {
      get: (ctx) => getChat(ctx, id),
      post: (ctx, body) => postChat(ctx, id, body),
      field: "text",
    };
  }
  if (parts.length === 5 && parts[3] === "tasks") {
    const task = parts[4];
    if (!PATTERNS.task.test(task)) return null;
    return { get: (ctx) => getTask(ctx, id, task), field: null };
  }
  if (parts.length === 5 && parts[3] === "roles") {
    if (!ROLE_NO.test(parts[4])) return null;
    const n = Number(parts[4]);
    return { get: (ctx) => getRole(ctx, id, n), field: null };
  }
  return null;
}

function allowOf(route) {
  return route.post === undefined ? "GET" : "GET, POST";
}

// opts = { home, env, config, executor, scenarioBytes, port, publicFiles, engines,
//          warn, bodyIdleMs } → { listen(), close(), port() }
// bodyIdleMs — the longest pause while a body is read (BODY_IDLE_MS by default;
// only the tests give a shorter one).
export function createWebServer(opts) {
  const requestedPort = opts.port ?? 0;
  const bodyIdleMs = opts.bodyIdleMs ?? BODY_IDLE_MS;
  const warn = (line) => {
    try {
      opts.warn(line);
    } catch {
      // A failing warning must not stop the server.
    }
  };
  const ctx = {
    home: opts.home,
    env: opts.env,
    config: opts.config,
    executor: opts.executor,
    scenarioBytes: opts.scenarioBytes ?? null,
    engines: opts.engines,
    warn,
  };

  // The key of this start: in memory only, never written, printed or answered.
  const key = crypto.randomBytes(KEY_BYTES).toString("hex");
  const keyBytes = Buffer.from(key, "utf8");
  const files = new Map(opts.publicFiles);
  const index = files.get("index.html");
  if (index !== undefined) {
    files.set(
      "index.html",
      Buffer.from(
        index.toString("utf8").replace(KEY_MARK, (mark) => keyMeta(mark, key)),
      ),
    );
  }

  let actualPort = null;

  function internalError(res, err) {
    warn(`ошибка обработчика запроса: ${formatError(err)}`);
    try {
      if (res.headersSent) res.destroy();
      else sendReply(res, failure(500, TEXT.internal));
    } catch {
      res.destroy();
    }
  }

  // Sockets that already have the idle timeout of a discarded body (set once per
  // socket: each setTimeout with a callback adds a listener).
  const drainTimeoutSet = new WeakSet();

  // The rest of a refused body is read and thrown away (a connection closed on
  // unread data is reset, and the client would not see the answer).
  function discard(req) {
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > DRAIN_MAX) req.destroy();
    });
    const socket = req.socket;
    if (socket && !drainTimeoutSet.has(socket)) {
      drainTimeoutSet.add(socket);
      socket.setTimeout(DRAIN_IDLE_MS, () => socket.destroy());
    }
  }

  function refuse(req, res, reply, extra) {
    sendReply(res, reply, extra);
    if (req.method === "POST") discard(req);
  }

  function handleStatic(req, res, name) {
    if (req.method !== "GET") {
      refuse(req, res, failure(405, TEXT.badRequest), { Allow: "GET" });
      return;
    }
    const data = files.get(name);
    const type = STATIC_TYPES[path.extname(name)];
    const headers = { "Content-Type": type, "Content-Length": data.length };
    if (type.startsWith("text/html")) {
      headers["Content-Security-Policy"] = CSP;
      headers["X-Frame-Options"] = "DENY";
    }
    res.writeHead(200, commonHeaders(headers));
    res.end(data);
  }

  function run(res, fn) {
    let pending;
    try {
      pending = Promise.resolve(fn());
    } catch (err) {
      internalError(res, err);
      return;
    }
    pending.then(
      (reply) => {
        try {
          sendReply(res, reply);
        } catch (err) {
          internalError(res, err);
        }
      },
      (err) => internalError(res, err),
    );
  }

  // Section 4.1, step 3: before the body is read.
  function writeAllowed(req) {
    const origin = req.headers.origin;
    const origins = [
      `http://${HOST}:${actualPort}`,
      `http://localhost:${actualPort}`,
    ];
    if (typeof origin !== "string" || !origins.includes(origin)) {
      return failure(403, TEXT.refused);
    }
    if (!isJsonType(req.headers["content-type"])) {
      return failure(403, TEXT.refused);
    }
    const given = req.headers[KEY_HEADER];
    if (typeof given !== "string" || !KEY_FORM.test(given)) {
      return failure(403, TEXT.refused);
    }
    if (!crypto.timingSafeEqual(Buffer.from(given, "utf8"), keyBytes)) {
      return failure(403, TEXT.staleKey, null, true);
    }
    return null;
  }

  // Section 4.1, step 4: at most BODY_MAX bytes, UTF-8, JSON, an object; at most
  // bodyIdleMs of pause from the start of the read and from each next part.
  function readBody(req, res, route) {
    const tooBig = failure(413, TEXT.tooBig, route.field);
    const declared = req.headers["content-length"];
    if (
      declared !== undefined &&
      isDigits(declared) &&
      Number(declared) > BODY_MAX
    ) {
      refuse(req, res, tooBig);
      return;
    }
    const chunks = [];
    let total = 0;
    let timer = null;
    const stop = () => {
      clearTimeout(timer);
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("close", onClose);
    };
    // The body did not come in time: 408 with the common text, the handler of
    // the write is not called, nothing goes to err (it is not a failure of the
    // server). The rest of the body is thrown away and the connection is closed
    // after the answer.
    const onIdle = () => {
      stop();
      chunks.length = 0;
      req.resume();
      res.on("finish", () => req.socket?.end());
      sendReply(res, failure(408, TEXT.internal), { Connection: "close" });
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(onIdle, bodyIdleMs);
      timer.unref();
    };
    const onData = (chunk) => {
      arm();
      total += chunk.length;
      if (total > BODY_MAX) {
        stop();
        chunks.length = 0;
        refuse(req, res, tooBig);
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      stop();
      let body;
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(
          Buffer.concat(chunks, total),
        );
        body = JSON.parse(text);
      } catch {
        sendReply(res, failure(400, TEXT.badRequest));
        return;
      }
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        sendReply(res, failure(400, TEXT.badRequest));
        return;
      }
      run(res, () => route.post(ctx, body));
    };
    // The client went away before the end: nothing to answer, no timer left.
    const onClose = () => {
      if (!req.complete) stop();
    };
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("close", onClose);
    arm();
  }

  function handle(req, res) {
    // 1. Host, before anything touches the data: a page of another site that
    // reaches this port through DNS rebinding sends its own Host.
    const host = req.headers.host;
    if (
      host !== `${HOST}:${actualPort}` &&
      host !== `localhost:${actualPort}`
    ) {
      refuse(req, res, failure(403, TEXT.hostRefused));
      return;
    }
    // 2. Method and path; the target is split by hand, never read as a URL.
    const target = req.url ?? "";
    const q = target.indexOf("?");
    const pathname = q === -1 ? target : target.slice(0, q);
    const parts = pathParts(pathname);
    if (parts === null) {
      refuse(req, res, notFoundReply());
      return;
    }
    if (parts.length === 1) {
      const name = parts[0] === "" ? "index.html" : parts[0];
      if (STATIC_NAME.test(name) && files.has(name)) {
        handleStatic(req, res, name);
        return;
      }
      refuse(req, res, notFoundReply());
      return;
    }
    const route = routeOf(parts);
    if (route === null) {
      refuse(req, res, notFoundReply());
      return;
    }
    if (req.method === "GET") {
      run(res, () => route.get(ctx));
      return;
    }
    if (req.method !== "POST" || route.post === undefined) {
      refuse(req, res, failure(405, TEXT.badRequest), {
        Allow: allowOf(route),
      });
      return;
    }
    // 3. Origin, type and key; 4. the body.
    const refused = writeAllowed(req);
    if (refused !== null) {
      refuse(req, res, refused);
      return;
    }
    readBody(req, res, route);
  }

  const server = http.createServer((req, res) => {
    req.on("error", noop);
    res.on("error", noop);
    try {
      handle(req, res);
    } catch (err) {
      internalError(res, err);
    }
  });

  return {
    // Binds to 127.0.0.1 (port 0: any free port); the bind is the only check that
    // the port is free.
    listen() {
      return new Promise((resolve, reject) => {
        const onListening = () => {
          server.off("error", onBindError);
          actualPort = server.address().port;
          server.on("error", (err) => {
            warn(`ошибка сервера: ${formatError(err)}`);
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

    port: () => actualPort,
  };
}
