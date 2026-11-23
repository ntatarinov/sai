// The command `cd tools && npm run pixel-office-note -- --text "<text>"`
// (design REQ-008, section 6): the orchestrator records how it understood an
// owner message. One signed POST /api/note to the local Pixel Office server;
// the server stamps the time and the source and binds the record to the last
// owner message. The address is only config.HOST and the port only the file
// `port` of the state directory; nothing in the arguments or the environment
// changes it. The output never has the secret, the signature, the body or the
// text. The command writes nothing to disk.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { NODE_REFUSAL_EXIT, refuseBelowNodeFloor } from "../node-floor.js";
import { refuseUnsupportedPlatform } from "../platform-guard.js";
import { HOST, NOTE_HTTP_MS, PORT_FILE } from "./config.js";
import { maskSecrets } from "./mask.js";
import { SIGNATURE_HEADER, signBody, storeTextEnabled } from "./protocol.js";
import {
  NOTE_MAX,
  NOTE_SESSION_MAX,
  REQ_ID_PATTERN,
  codePointLength,
  isCanonicalTime,
} from "./public/schema.js";
import { readSecret, readStateText, resolveStateDir } from "./state-dir.js";

const USAGE = [
  'Использование: npm run pixel-office-note -- --text "<текст>" [--req REQ-NNN] [--session <id>] [--request-time <ISO>]',
  "  --text          как оркестратор понял сообщение владельца (обязательно, до 2 000 знаков)",
  "  --req           номер требования, например REQ-008",
  "  --session       session_id сессии (по умолчанию сервер ищет сообщение владельца во всём журнале)",
  "  --request-time  время сообщения владельца (ISO UTC с миллисекундами)",
  "  --help          эта справка",
].join("\n");

// Longest answer of the server that is read.
const ANSWER_MAX = 4096;
// An error code of the server is echoed only in this form.
const ERROR_CODE = /^[a-z_:A-Za-z0-9-]{1,60}$/;
// An unknown option is named only in this form (never with a value).
const OPTION_NAME = /^--[a-z][a-z-]{0,30}$/;
const PORT_TEXT = /^\s*(\d{1,5})\s*$/;

const OPTIONS = {
  "--text": "text",
  "--req": "req",
  "--session": "session",
  "--request-time": "requestTime",
};

class UsageError extends Error {}

// The arguments: {help: true} or {text, req, session, requestTime}. Throws
// UsageError with the reason.
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    if (arg === "--help" || arg === "-h") return { help: true };
    if (Object.hasOwn(OPTIONS, arg)) {
      const name = OPTIONS[arg];
      if (i + 1 >= argv.length) {
        throw new UsageError(`у параметра ${arg} нет значения`);
      }
      if (Object.hasOwn(opts, name)) {
        throw new UsageError(`параметр ${arg} указан дважды`);
      }
      opts[name] = String(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("-")) {
      throw new UsageError(
        OPTION_NAME.test(arg)
          ? `неизвестный параметр ${arg}`
          : "неизвестный параметр",
      );
    } else {
      throw new UsageError("текст передаётся только через --text");
    }
  }
  if (!Object.hasOwn(opts, "text")) {
    throw new UsageError("нет параметра --text");
  }
  if (Object.hasOwn(opts, "session")) {
    const n = codePointLength(opts.session, NOTE_SESSION_MAX);
    if (n < 1 || n > NOTE_SESSION_MAX) {
      throw new UsageError(
        `значение --session должно быть от 1 до ${NOTE_SESSION_MAX} знаков`,
      );
    }
  }
  if (Object.hasOwn(opts, "req") && !REQ_ID_PATTERN.test(opts.req)) {
    throw new UsageError("значение --req должно иметь вид REQ-NNN");
  }
  if (
    Object.hasOwn(opts, "requestTime") &&
    !isCanonicalTime(opts.requestTime)
  ) {
    throw new UsageError(
      "значение --request-time должно быть временем UTC вида 2026-10-05T12:00:00.000Z",
    );
  }
  return opts;
}

function checkText(text) {
  if (text.trim() === "") throw new UsageError("текст пустой");
  if (codePointLength(text, NOTE_MAX) > NOTE_MAX) {
    throw new UsageError("текст длиннее 2 000 знаков");
  }
  const masked = maskSecrets(text);
  if (codePointLength(masked, NOTE_MAX) > NOTE_MAX) {
    throw new UsageError("после маскирования текст длиннее 2 000 знаков");
  }
  return masked;
}

// One POST. Resolves {status, text} or {failure: "refused" | "timeout" |
// "connection"}; the whole exchange (connection and answer) has NOTE_HTTP_MS.
// An agent of its own: proxy variables of the environment are not used.
function send(httpRequest, port, payload, signature) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (!done) {
        done = true;
        resolve(value);
      }
    };
    const signal = AbortSignal.timeout(NOTE_HTTP_MS);
    const fail = (err) => {
      if (signal.aborted) finish({ failure: "timeout" });
      else if (err && err.code === "ECONNREFUSED")
        finish({ failure: "refused" });
      else finish({ failure: "connection" });
    };
    let req;
    try {
      req = httpRequest(
        {
          agent: new http.Agent({ keepAlive: false }),
          host: HOST,
          port,
          path: "/api/note",
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
            [SIGNATURE_HEADER]: signature,
          },
          signal,
        },
        (res) => {
          const chunks = [];
          let total = 0;
          signal.addEventListener("abort", () => {
            res.destroy();
            finish({ failure: "timeout" });
          });
          res.on("data", (chunk) => {
            if (total >= ANSWER_MAX) return;
            const piece = chunk.subarray(0, ANSWER_MAX - total);
            chunks.push(piece);
            total += piece.length;
            if (total >= ANSWER_MAX) res.destroy();
          });
          const end = () =>
            finish({
              status: res.statusCode,
              text: Buffer.concat(chunks, total).toString("utf8"),
            });
          res.on("end", end);
          res.on("close", end);
          res.on("error", () => {
            if (signal.aborted) finish({ failure: "timeout" });
            else end();
          });
        },
      );
    } catch (err) {
      fail(err);
      return;
    }
    req.on("error", fail);
    req.end(payload);
  });
}

function parseJson(text) {
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

const STATUS_REASONS = {
  401: "подпись не принята",
  403: "адрес отклонён",
  // ISS-0123: the same bytes were accepted in the last two minutes.
  409: "такая же запись уже принята, повтор отклонён",
  413: "запись слишком велика",
  500: "ошибка сервера",
};

// The answer of the server -> [code, stdout line or null, stderr line or null].
function interpret(answer) {
  const { status, text } = answer;
  if (status === 200) {
    const value = parseJson(text);
    if (value !== null && value.request_time === null) {
      return [0, "записано без привязки: сообщение владельца не найдено", null];
    }
    if (value !== null && isCanonicalTime(value.request_time)) {
      if (value.request_time_auto === true) {
        return [
          0,
          `записано; привязано к сообщению владельца ${value.request_time}`,
          null,
        ];
      }
      if (value.request_time_auto === false) return [0, "записано", null];
    }
    return [1, null, "неожиданный ответ сервера 200"];
  }
  if (Object.hasOwn(STATUS_REASONS, status)) {
    return [1, null, STATUS_REASONS[status]];
  }
  if (status === 400) {
    const value = parseJson(text);
    const error =
      value !== null &&
      typeof value.error === "string" &&
      ERROR_CODE.test(value.error)
        ? value.error
        : "?";
    if (error === "text_storage_off") {
      return [1, null, "хранение текста на сервере отключено"];
    }
    return [1, null, `запись отклонена: ${error}`];
  }
  const code = Number.isInteger(status) ? status : "?";
  return [1, null, `неожиданный ответ сервера ${code}`];
}

function writeLine(stream, text) {
  try {
    stream.write(`${text}\n`);
  } catch {
    // Nobody reads the output: there is nothing else to do.
  }
}

// io = {env, home, stdout, stderr, httpRequest}. Resolves the exit code: 0 for
// --help, for storage turned off and for 200 from /api/note; 2 for a usage
// error; 1 for every other failure.
export async function main(argv, io) {
  const env = io.env ?? {};
  const err = (text) => {
    writeLine(io.stderr, text);
    return 1;
  };
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    writeLine(io.stderr, `${e.message}; см. --help`);
    return 2;
  }
  if (opts.help) {
    writeLine(io.stdout, USAGE);
    return 0;
  }
  // The Node floor (REQ-110), before the storage switch, the folder and the request.
  if (refuseBelowNodeFloor(io.stderr)) return NODE_REFUSAL_EXIT;
  // Linux and macOS only (ISS-0132), before the same.
  if (refuseUnsupportedPlatform(io.stderr)) return NODE_REFUSAL_EXIT;
  if (!storeTextEnabled(env)) {
    writeLine(io.stderr, "хранение текста отключено");
    return 0;
  }
  let noteText;
  try {
    noteText = checkText(opts.text);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    writeLine(io.stderr, `${e.message}; см. --help`);
    return 2;
  }

  let dir;
  try {
    dir = resolveStateDir(env, io.home);
  } catch (e) {
    return err(e instanceof Error ? e.message : "сервер не запущен");
  }
  const secret = readSecret(dir);
  if (secret === null) return err("сервер не запущен");
  const portText = readStateText(dir, PORT_FILE);
  if (portText === null) return err("сервер не запущен");
  const match = PORT_TEXT.exec(portText);
  const port = match === null ? 0 : Number(match[1]);
  if (port < 1 || port > 65535) return err("файл port испорчен");

  const body = { note_text: noteText };
  if (opts.req !== undefined) body.req_id = opts.req;
  if (opts.requestTime !== undefined) body.request_time = opts.requestTime;
  if (opts.session !== undefined) body.session_id = opts.session;
  const payload = JSON.stringify(body);
  const answer = await send(
    io.httpRequest ?? http.request,
    port,
    payload,
    signBody(secret, payload),
  );
  if (answer.failure === "refused") return err("сервер не запущен");
  if (answer.failure === "timeout") return err("сервер не ответил за 3 с");
  if (answer.failure === "connection") {
    return err("соединение с сервером прервано");
  }
  const [code, out, problem] = interpret(answer);
  if (out !== null) writeLine(io.stdout, out);
  if (problem !== null) writeLine(io.stderr, problem);
  return code;
}

function isEntryPoint() {
  try {
    return (
      fs.realpathSync(process.argv[1]) ===
      fs.realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  for (const stream of [process.stdout, process.stderr]) {
    stream.on("error", () => {});
  }
  main(process.argv.slice(2), {
    env: process.env,
    home: os.homedir(),
    stdout: process.stdout,
    stderr: process.stderr,
  }).then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      process.stderr.write("ошибка команды pixel-office-note\n");
      process.exitCode = 1;
    },
  );
}
