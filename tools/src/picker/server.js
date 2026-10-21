// The HTTP server of the picker site (design REQ-056, 5.6-5.9; decisions/0065, 0071).
// It listens on the local address only. The tenant is the first part of the path and
// nothing else: not the query, not a header, not the body. Every request goes through the
// same fixed order of checks (design 5.6), and the first check is the Host header, before
// any data is read. What is shown to a visitor is built by public-data.js; what is said
// in a refusal comes from the texts of public/texts.js through messages.js.
import http from "node:http";
import { DEFAULT_PUBLIC_DIR, readAsset } from "./assets.js";
import {
  BODY_IDLE_MS,
  BODY_MAX,
  CHECK_INTERVAL_MS,
  CSP,
  DRAIN_IDLE_MS,
  DRAIN_MAX,
  HEADERS_TIMEOUT_MS,
  HOST,
  JSON_TYPE,
  KEEP_ALIVE_MS,
  MAX_HEADER_BYTES,
  PAGE_FILE,
  REQUEST_TIMEOUT_MS,
} from "./config.js";
import { computeResult } from "./engine.js";
import { errorBody } from "./messages.js";
import { show } from "./places.js";
import { publicResult } from "./public-data.js";
import {
  checkBody,
  isJsonType,
  languageOf,
  routeOf,
  splitTarget,
} from "./request.js";

// Sent with every answer of this server.
const COMMON_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
});

// The answer to an unknown path, made once: the same bytes whatever the path, the method
// or the language was.
const NOT_FOUND_BODY = Buffer.from(
  errorBody("not_found", "server_not_found", null),
  "utf8",
);

const STATUS_TEXT = Object.freeze({
  400: "Bad Request",
  408: "Request Timeout",
  431: "Request Header Fields Too Large",
});

function noop() {}

// One line of the log names the kind of an exception and, for an error of the system, its
// code. The text of an exception is never written: it may hold what a visitor sent.
function describeError(err) {
  const kind =
    typeof err?.name === "string" && /^[A-Za-z]{1,40}$/u.test(err.name)
      ? err.name
      : "Error";
  const code =
    typeof err?.code === "string" && /^[A-Z0-9_]{1,40}$/u.test(err.code)
      ? ` ${err.code}`
      : "";
  return `${kind}${code}`;
}

// Header lines of a raw answer.
function headerLines(fields) {
  return Object.getOwnPropertyNames(fields).map(
    (name) => `${name}: ${fields[name]}\r\n`,
  );
}

// What the HTTP parser refused (design 5.6, D28): the status, the code of the answer and
// the key of its text.
function parseFailure(err) {
  if (err?.code === "HPE_HEADER_OVERFLOW")
    return { status: 431, code: "too_large", key: "server_too_large" };
  if (err?.code === "ERR_HTTP_REQUEST_TIMEOUT")
    return { status: 408, code: "timeout", key: "server_slow" };
  return { status: 400, code: "bad_request", key: "server_bad_request" };
}

// The question of an answer error, only when it is a question of this tenant: a key that
// the visitor made up, or took from another tenant, is never given back.
function questionOf(view, error) {
  const wanted = error?.question;
  if (typeof wanted !== "string") return null;
  return view.questions.some((question) => question.id === wanted)
    ? wanted
    : null;
}

// options = { registry, port, publicDir, warn, bodyIdleMs, headersTimeoutMs,
//             requestTimeoutMs } -> { listen(), close(), port() }
// The four last values only make the times shorter, for the tests.
export function createPickerServer(options) {
  const registry = options.registry;
  const requestedPort = options.port ?? 0;
  const publicDir = options.publicDir ?? DEFAULT_PUBLIC_DIR;
  const bodyIdleMs = options.bodyIdleMs ?? BODY_IDLE_MS;
  const requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const headersTimeoutMs = Math.min(
    options.headersTimeoutMs ?? HEADERS_TIMEOUT_MS,
    requestTimeoutMs,
  );
  const warn = (line) => {
    try {
      options.warn?.(line);
    } catch {
      // A failing receiver of the log must not stop the server.
    }
  };

  let actualPort = null;

  // The rest of a body that was refused is read and thrown away (a connection closed on
  // unread data is reset, and the client would not see the answer): at most DRAIN_MAX
  // bytes, and while data comes at least every DRAIN_IDLE_MS.
  function discard(req) {
    let total = 0;
    let timer = null;
    const stop = () => {
      clearTimeout(timer);
      req.off("data", onData);
      req.off("end", stop);
      req.off("close", stop);
    };
    const give = () => {
      stop();
      req.destroy();
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(give, DRAIN_IDLE_MS);
      timer.unref();
    };
    const onData = (chunk) => {
      total += chunk.length;
      if (total > DRAIN_MAX) {
        give();
        return;
      }
      arm();
    };
    req.on("data", onData);
    req.on("end", stop);
    req.on("close", stop);
    arm();
  }

  // The one place where an answer is written. An answer to a request whose body has not
  // all come ends with the discard of the rest.
  function send(req, res, status, type, bytes, extra = {}) {
    const fields = { ...COMMON_HEADERS };
    if (type !== null) fields["Content-Type"] = type;
    fields["Content-Length"] = bytes.length;
    res.writeHead(status, { ...fields, ...extra });
    res.end(bytes);
    if (!req.complete) discard(req);
  }

  // An answer with a text. lang null: all the languages in one line.
  function sendError(req, res, status, code, key, lang, more = {}) {
    const body = errorBody(code, key, lang, more.values, more.extra);
    send(req, res, status, JSON_TYPE, Buffer.from(body, "utf8"), more.headers);
  }

  // The answer to every unknown path, tenant and file: the only place that says it.
  function notFound(req, res) {
    send(req, res, 404, JSON_TYPE, NOT_FOUND_BODY);
  }

  function methodNotAllowed(req, res, lang, allow) {
    sendError(req, res, 405, "method_not_allowed", "server_method", lang, {
      headers: { Allow: allow },
    });
  }

  function sendFile(req, res, asset) {
    const extra = asset.type.startsWith("text/html")
      ? { "Content-Security-Policy": CSP, "X-Frame-Options": "DENY" }
      : {};
    send(req, res, 200, asset.type, asset.bytes, extra);
  }

  function internalError(req, res, state, err) {
    warn(`Сайт подбора: ошибка обработчика запроса: ${describeError(err)}`);
    try {
      if (res.headersSent) res.destroy();
      else sendError(req, res, 500, "internal", "server_internal", state.lang);
    } catch {
      res.destroy();
    }
  }

  // Steps 9 to 11 of the order (design 5.6): the type, the declared length, the body.
  // `done(bytes)` gets the whole body.
  function readBody(req, res, state, done) {
    const lang = state.lang;
    if (!isJsonType(req.headers["content-type"])) {
      sendError(req, res, 415, "wrong_type", "server_wrong_type", lang);
      return;
    }
    const declared = req.headers["content-length"];
    if (
      typeof declared === "string" &&
      /^\d+$/u.test(declared) &&
      Number(declared) > BODY_MAX
    ) {
      sendError(req, res, 413, "too_large", "server_too_large", lang);
      return;
    }
    const chunks = [];
    let total = 0;
    let timer = null;
    const stop = () => {
      clearTimeout(timer);
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("close", stop);
    };
    // The body stopped coming: the answer is sent, the rest is thrown away and the
    // connection is closed after the answer.
    const onIdle = () => {
      stop();
      chunks.length = 0;
      sendError(req, res, 408, "timeout", "server_slow", lang, {
        headers: { Connection: "close" },
      });
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
        sendError(req, res, 413, "too_large", "server_too_large", lang);
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      stop();
      try {
        done(Buffer.concat(chunks, total));
      } catch (err) {
        internalError(req, res, state, err);
      }
    };
    req.on("data", onData);
    req.on("end", onEnd);
    // The client went away before the end: nothing to answer, no timer left.
    req.on("close", stop);
    arm();
  }

  // Steps 12 to 15 of the order: the body is strict UTF-8 and JSON, has the right form,
  // and the engine takes the answers.
  function answerResult(req, res, state, entry, bytes) {
    const lang = state.lang;
    let parsed;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      sendError(req, res, 400, "bad_request", "server_bad_request", lang);
      return;
    }
    const checked = checkBody(parsed);
    if (!checked.ok) {
      const values =
        checked.field === undefined ? {} : { field: show(checked.field) };
      sendError(req, res, 400, "bad_request", checked.key, lang, { values });
      return;
    }
    const view = entry.views.get(lang);
    const computed = computeResult(view, checked.answers);
    if (!computed.ok) {
      sendError(
        req,
        res,
        400,
        "answers_invalid",
        "server_answers_invalid",
        lang,
        {
          extra: { question: questionOf(view, computed.error) },
        },
      );
      return;
    }
    const body = JSON.stringify(publicResult(computed.result));
    send(req, res, 200, JSON_TYPE, Buffer.from(body, "utf8"));
  }

  // The origins that a page served by this server sends.
  function originAllowed(origin) {
    return (
      origin === `http://${HOST}:${actualPort}` ||
      origin === `http://localhost:${actualPort}`
    );
  }

  function handle(req, res, state) {
    // 1. The Host header, before anything touches the data: a page of another site that
    // reaches this port through a changed name sends its own.
    const named = req.headers.host;
    if (
      named !== `${HOST}:${actualPort}` &&
      named !== `localhost:${actualPort}`
    ) {
      send(req, res, 403, null, Buffer.alloc(0));
      return;
    }
    // 2. The route; the target is cut by hand and never decoded.
    const { pathname, query } = splitTarget(req.url);
    const found = routeOf(pathname);
    if (found === null) {
      notFound(req, res);
      return;
    }
    // 3. A file of the page: it must be there, then the method.
    if (found.kind === "asset") {
      const asset = readAsset(publicDir, found.name);
      if (asset === null) {
        notFound(req, res);
        return;
      }
      if (req.method !== "GET") {
        methodNotAllowed(req, res, null, "GET");
        return;
      }
      sendFile(req, res, asset);
      return;
    }
    // 4. The redirect to the address with the slash: for every right id, the tenant
    // exists or not.
    if (found.kind === "redirect") {
      if (req.method !== "GET") {
        methodNotAllowed(req, res, null, "GET");
        return;
      }
      send(req, res, 308, null, Buffer.alloc(0), {
        Location: `/t/${found.id}/`,
      });
      return;
    }
    // 5. The tenant: the one lookup of a request, with the id of the path.
    const entry = registry.get(found.id);
    if (entry === undefined) {
      notFound(req, res);
      return;
    }
    // 6. The language of the request; never a refusal.
    state.lang = languageOf(query, entry.languages);
    const lang = state.lang;
    // 7. The method of the route.
    const wanted = found.kind === "result" ? "POST" : "GET";
    if (req.method !== wanted) {
      methodNotAllowed(req, res, lang, wanted);
      return;
    }
    if (found.kind === "page") {
      const asset = readAsset(publicDir, PAGE_FILE);
      if (asset === null) notFound(req, res);
      else sendFile(req, res, asset);
      return;
    }
    if (found.kind === "questionnaire") {
      send(req, res, 200, JSON_TYPE, entry.questionnaires.get(lang));
      return;
    }
    // 8. The origin of a POST.
    if (!originAllowed(req.headers.origin)) {
      sendError(req, res, 403, "forbidden", "server_forbidden", lang);
      return;
    }
    // 9 to 15. The type, the length, the body, its form, the engine.
    readBody(req, res, state, (bytes) => {
      answerResult(req, res, state, entry, bytes);
    });
  }

  // A request that the parser of Node refused never reaches handle(): it gets a closed
  // answer, in one write, with the common headers and the text in all the languages (design
  // 5.6, D28). A broken connection gets no answer. Nothing is written to the log.
  function refuseParse(err, socket) {
    try {
      if (
        !socket.writable ||
        socket.destroyed ||
        typeof err?.syscall === "string"
      ) {
        socket.destroy();
        return;
      }
      const failure = parseFailure(err);
      const body = Buffer.from(
        errorBody(failure.code, failure.key, null),
        "utf8",
      );
      const head = [
        `HTTP/1.1 ${failure.status} ${STATUS_TEXT[failure.status]}\r\n`,
        ...headerLines({
          ...COMMON_HEADERS,
          "Content-Type": JSON_TYPE,
          "Content-Length": body.length,
          Connection: "close",
        }),
        "\r\n",
      ].join("");
      socket.end(Buffer.concat([Buffer.from(head, "utf8"), body]));
    } catch {
      socket.destroy();
    }
  }

  const server = http.createServer(
    {
      maxHeaderSize: MAX_HEADER_BYTES,
      headersTimeout: headersTimeoutMs,
      requestTimeout: requestTimeoutMs,
      keepAliveTimeout: KEEP_ALIVE_MS,
      connectionsCheckingInterval: CHECK_INTERVAL_MS,
      // A request without the Host header is not refused by Node but given to handle(),
      // which answers it in step 1.
      requireHostHeader: false,
    },
    (req, res) => {
      req.on("error", noop);
      res.on("error", noop);
      const state = { lang: null };
      try {
        handle(req, res, state);
      } catch (err) {
        internalError(req, res, state, err);
      }
    },
  );
  server.on("clientError", refuseParse);

  return {
    // Binds to the local address (port 0: any free port) and rejects with the error of
    // the system when it cannot (a port in use).
    listen() {
      return new Promise((resolve, reject) => {
        const onListening = () => {
          server.off("error", onBindError);
          const bound = server.address();
          actualPort = bound.port;
          server.on("error", (err) => {
            warn(`Сайт подбора: ошибка сервера: ${describeError(err)}`);
          });
          resolve({ address: bound.address, port: bound.port });
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

    // Stops accepting and closes every open connection; may be called twice.
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
