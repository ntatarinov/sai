// Helpers of the tests of the picker site server (design REQ-056, 9.3). Not a test file.
// The server of a test always listens on port 0 and is closed in t.after; the expected
// answers (the questionnaire, the result, the lists of strings of a tenant) are built here
// from the file and from the engine of REQ-055, never from public-data.js.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { computeResult } from "../src/picker/engine.js";
import { startPicker } from "../src/picker/serve.js";
import { createPickerServer } from "../src/picker/server.js";
import { loadTenants } from "../src/picker/tenants.js";
import {
  CLI,
  DEMO_ANSWERS,
  DEMO_TENANTS,
  LEGACY_TENANTS,
  PICKER,
  TOOLS,
  makeTmp,
} from "./picker-helpers.js";
import { textPlaces, viewByOracle } from "./picker-lang-helpers.js";

export const IDS = ["uchet-pro", "svet-marketing"];
export const LANGS = ["ru", "kk", "en"];
export const PUBLIC_DIR = path.join(PICKER, "public");
export const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");

// ------------------------------------------------------------- the texts of the answers

// The texts of the answers of the server (design 5.4, as the reader of the texts left them
// in public/texts.js): key -> [ru, kk, en]. The oracle of the tests.
export const SERVER_TEXTS = {
  server_not_found: [
    "Страница не найдена.",
    "Бет табылмады.",
    "Page not found.",
  ],
  server_forbidden: [
    "Запрос отклонён.",
    "Сұрау қабылданбады.",
    "Request denied.",
  ],
  server_method: [
    "Так обращаться к этой странице нельзя.",
    "Бұл бетке бұлай жүгінуге болмайды.",
    "This page cannot be accessed that way.",
  ],
  server_wrong_type: [
    "Запрос не принят: неверный тип данных.",
    "Сұрау қабылданбады: деректер түрі дұрыс емес.",
    "Request not accepted: unsupported data type.",
  ],
  server_too_large: [
    "Запрос слишком большой. Сократите ответы и попробуйте ещё раз.",
    "Сұрау тым үлкен. Жауаптарды қысқартып, қайталап көріңіз.",
    "The request is too large. Shorten the answers and try again.",
  ],
  server_slow: [
    "Запрос пришёл слишком поздно. Отправьте его ещё раз.",
    "Сұрау тым кеш келді. Оны қайта жіберіңіз.",
    "The request took too long to arrive. Send it again.",
  ],
  server_bad_request: [
    "Запрос не удалось прочитать. Отправьте ответы ещё раз.",
    "Сұрауды оқу мүмкін болмады. Жауаптарды қайта жіберіңіз.",
    "The request could not be read. Send the answers again.",
  ],
  server_extra_field: [
    "В запросе лишнее поле {field}. Удалите его.",
    "Сұрауда артық {field} өрісі бар. Оны алып тастаңыз.",
    "The request has an extra field {field}. Remove it.",
  ],
  server_no_answers: [
    "В запросе нет ответов. Отправьте их ещё раз.",
    "Сұрауда жауаптар жоқ. Оларды қайта жіберіңіз.",
    "The request has no answers. Send them again.",
  ],
  server_answers_invalid: [
    "Ответы не подходят к этой анкете. Пройдите анкету ещё раз.",
    "Жауаптар бұл сауалнамаға сәйкес келмейді. Сауалнаманы қайта толтырыңыз.",
    "The answers do not fit this questionnaire. Go through it again.",
  ],
  server_internal: [
    "Что-то пошло не так. Попробуйте ещё раз позже.",
    "Бірдеңе дұрыс болмады. Кейінірек қайталап көріңіз.",
    "Something went wrong. Please try again later.",
  ],
  page_stub_notice: [
    "Страница с вопросами скоро появится.",
    "Сұрақтар беті жақында пайда болады.",
    "The questions page will be available soon.",
  ],
};
// The text of a key in a language, {name} replaced by the values.
export function textFor(key, lang, values = {}) {
  const text = SERVER_TEXTS[key][LANGS.indexOf(lang)];
  return text.replace(/\{([a-z]+)\}/gu, (whole, name) => values[name] ?? whole);
}
export const allLanguages = (key, values = {}) =>
  LANGS.map((lang) => textFor(key, lang, values)).join(" / ");
export const NOT_FOUND_BODY =
  '{"error":"not_found","message":"Страница не найдена. / Бет табылмады. / Page not found."}';

// ------------------------------------------------------------- tenants and folders

export const demoBytes = (id) =>
  fs.readFileSync(path.join(DEMO_TENANTS, `${id}.json`));
export const legacyBytes = (id) =>
  fs.readFileSync(path.join(LEGACY_TENANTS, `${id}.json`));
export const demoPlain = (id) => JSON.parse(demoBytes(id).toString("utf8"));
export const legacyPlain = (id) => JSON.parse(legacyBytes(id).toString("utf8"));
export const demoAnswerSets = (id) =>
  JSON.parse(fs.readFileSync(path.join(DEMO_ANSWERS, `${id}.json`), "utf8"));

// A folder of tenants in a temporary folder: name -> bytes, text, or a function(dir) that
// makes the entry (a link, a folder, a pipe).
export function makeTenantDir(t, files) {
  const dir = makeTmp(t);
  for (const [name, content] of Object.entries(files)) {
    if (typeof content === "function") content(dir, name);
    else fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}
export const demoDir = (t, ids = IDS) =>
  makeTenantDir(
    t,
    Object.fromEntries(ids.map((id) => [`${id}.json`, demoBytes(id)])),
  );

// Every entry of a folder, deeply, with the sha256 of a file: what must not change.
export function listingDigest(dir) {
  const out = [];
  const walk = (here, rel) => {
    for (const entry of fs.readdirSync(here).sort()) {
      const abs = path.join(here, entry);
      const name = rel === "" ? entry : `${rel}/${entry}`;
      const stat = fs.lstatSync(abs);
      if (stat.isSymbolicLink()) out.push([name, "link"]);
      else if (stat.isDirectory()) {
        out.push([name, "dir"]);
        walk(abs, name);
      } else if (stat.isFile()) out.push([name, sha256(fs.readFileSync(abs))]);
      else out.push([name, "other"]);
    }
  };
  walk(dir, "");
  return out;
}

// ------------------------------------------------------------- starting a server

// Starts the server of a test on port 0 with startPicker (or, with wrapRegistry, with
// createPickerServer on a registry that the test wraps) and closes it in t.after. `out`
// and `err` are the lines of the command; `log()` gives what the server wrote to the log
// after it started.
export async function startForTest(t, dir, options = {}) {
  const out = [];
  const err = [];
  const io = { out: (l) => out.push(l), err: (l) => err.push(l) };
  const { wrapRegistry, ...rest } = options;
  if (wrapRegistry !== undefined) {
    const loaded = loadTenants(dir);
    const registry = wrapRegistry(loaded.registry);
    const server = createPickerServer({
      registry,
      port: 0,
      warn: (line) => err.push(line),
      ...rest,
    });
    const bound = await server.listen();
    t.after(() => server.close());
    const logStart = err.length;
    return {
      ok: true,
      port: bound.port,
      address: bound.address,
      out,
      err,
      registry,
      log: () => err.slice(logStart),
      close: () => server.close(),
    };
  }
  const started = await startPicker({ tenants: dir, port: 0, ...rest }, io);
  if (started.ok) t.after(() => started.close());
  const logStart = err.length;
  return { ...started, out, err, log: () => err.slice(logStart) };
}

// startPicker whose server, if it starts after all, is closed in t.after - so that a check
// that fails on a wrong "refused" result does not leave a server open and hang the run.
export async function startPickerClosing(t, options, io) {
  const started = await startPicker(options, io);
  if (started.ok) t.after(() => started.close());
  return started;
}

// ------------------------------------------------------------- clients

// A request with node:http, no agent, our own Host. Rejects after timeoutMs (a guard that
// is not the way a test finds a fault).
export function request(
  port,
  {
    method = "GET",
    path: target = "/",
    headers = {},
    body,
    host,
    timeoutMs = 8000,
  } = {},
) {
  return new Promise((resolve, reject) => {
    const fields = { Host: host ?? `127.0.0.1:${port}`, ...headers };
    const bytes = body === undefined ? undefined : Buffer.from(body);
    if (bytes !== undefined && fields["Content-Length"] === undefined)
      fields["Content-Length"] = bytes.length;
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path: target,
        headers: fields,
        agent: false,
        setHost: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            rawHeaders: res.rawHeaders,
            body: buffer,
            text: buffer.toString("utf8"),
          });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("request guard")));
    if (bytes !== undefined) req.write(bytes);
    req.end();
  });
}

export const getJson = async (port, target, options = {}) => {
  const res = await request(port, { path: target, ...options });
  return { ...res, json: JSON.parse(res.text) };
};

export const resultRequest = (port, id, answers, lang, extra = {}) =>
  request(port, {
    method: "POST",
    path: `/t/${id}/api/result${lang === undefined ? "" : `?lang=${lang}`}`,
    headers: {
      Origin: `http://127.0.0.1:${port}`,
      "Content-Type": "application/json",
      ...extra.headers,
    },
    body: extra.body ?? JSON.stringify({ answers }),
  });

// Raw bytes to the port; the answer is read until the connection is closed, `until` says
// it is complete, or waitMs have passed. { raw, closed }.
export function rawSend(
  port,
  data,
  {
    waitMs = 2000,
    until = null,
    end = false,
    afterConnect = null,
    afterMs = 0,
  } = {},
) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const chunks = [];
    let closed = false;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ raw: Buffer.concat(chunks), closed });
    };
    const timer = setTimeout(finish, waitMs);
    let settling = false;
    socket.on("data", (c) => {
      chunks.push(c);
      if (until !== null && until(Buffer.concat(chunks))) {
        if (afterMs > 0) {
          if (!settling) {
            settling = true;
            setTimeout(finish, afterMs);
          }
        } else finish();
      }
    });
    socket.on("close", () => {
      closed = true;
      finish();
    });
    socket.on("error", () => {});
    socket.on("connect", () => {
      if (data !== null && data !== undefined) socket.write(data);
      if (end) socket.end();
      if (afterConnect !== null) afterConnect(socket);
    });
  });
}

// The answer of a raw exchange as { status, headers (lower case, joined), body }.
export function parseRaw(raw) {
  const text = raw.toString("latin1");
  const cut = text.indexOf("\r\n\r\n");
  if (cut < 0)
    return {
      status: null,
      headers: {},
      body: Buffer.alloc(0),
      complete: false,
    };
  const lines = text.slice(0, cut).split("\r\n");
  const status = Number(/^HTTP\/1\.[01] (\d{3})/u.exec(lines[0])?.[1] ?? NaN);
  const headers = {};
  for (const line of lines.slice(1)) {
    const at = line.indexOf(":");
    const name = line.slice(0, at).toLowerCase();
    const value = line.slice(at + 1).trim();
    headers[name] = name in headers ? `${headers[name]}, ${value}` : value;
  }
  const body = raw.subarray(cut + 4);
  const length = headers["content-length"];
  const complete = length === undefined ? true : body.length >= Number(length);
  return { status, headers, body, statusLine: lines[0], complete };
}

// A sequence of answers on one connection (a pipeline): [{ status, headers, body }] cut by
// Content-Length; `rest` is what is left over (it must be empty).
export function parseMany(raw) {
  const out = [];
  let rest = raw;
  for (;;) {
    const cut = rest.indexOf("\r\n\r\n");
    if (cut < 0) break;
    const one = parseRaw(rest);
    const length = Number(one.headers["content-length"] ?? 0);
    if (one.body.length < length) break;
    out.push({
      status: one.status,
      headers: one.headers,
      body: one.body.subarray(0, length),
    });
    rest = rest.subarray(cut + 4 + length);
  }
  return { answers: out, rest };
}

// A complete raw request/answer exchange with `Connection: close`.
export async function rawExchange(port, requestText, options = {}) {
  const { raw, closed } = await rawSend(port, requestText, {
    until: (buf) => {
      const p = parseRaw(buf);
      return p.status !== null && p.complete;
    },
    afterMs: 300,
    ...options,
  });
  return { ...parseRaw(raw), raw, closed };
}

// Code, headers without Date and the body in hex: what must be equal for equal answers.
export function signature(res) {
  const headers = { ...res.headers };
  delete headers.date;
  const names = Object.keys(headers).sort();
  return JSON.stringify([
    res.status,
    names.map((n) => [n, headers[n]]),
    Buffer.from(res.body).toString("hex"),
  ]);
}

// A body of `total` bytes (spaces) written in pieces with the back pressure of the socket.
// Resolves with what the server answered, how many bytes it took and whether it closed
// the connection before the end. `declare` false: Transfer-Encoding: chunked.
export function streamBody(
  port,
  {
    target,
    headers = {},
    total,
    chunked = false,
    chunkSize = 65536,
    maxMs = 30000,
    declare = true,
  },
) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setMaxListeners(0);
    const chunks = [];
    let written = 0;
    let finished = false;
    let serverClosed = false;
    const piece = Buffer.alloc(chunkSize, 0x20);
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const raw = Buffer.concat(chunks);
      socket.destroy();
      resolve({
        ...parseRaw(raw),
        raw,
        written,
        serverClosed,
        accepted: socket.bytesWritten,
      });
    };
    const timer = setTimeout(finish, maxMs);
    socket.on("data", (c) => chunks.push(c));
    socket.on("error", () => {
      serverClosed = true;
      finish();
    });
    socket.on("close", () => {
      if (written < total) serverClosed = true;
      finish();
    });
    socket.on("connect", async () => {
      const fields = {
        Host: `127.0.0.1:${port}`,
        Origin: `http://127.0.0.1:${port}`,
        "Content-Type": "application/json",
        ...headers,
      };
      if (chunked) fields["Transfer-Encoding"] = "chunked";
      else if (declare) fields["Content-Length"] = String(total);
      const head = `POST ${target} HTTP/1.1\r\n${Object.entries(fields)
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join("")}\r\n`;
      socket.write(head);
      while (written < total && !socket.destroyed && !finished) {
        const size = Math.min(chunkSize, total - written);
        const data = size === chunkSize ? piece : piece.subarray(0, size);
        const frame = chunked
          ? Buffer.concat([
              Buffer.from(`${size.toString(16)}\r\n`),
              data,
              Buffer.from("\r\n"),
            ])
          : data;
        const ok = socket.write(frame);
        written += size;
        if (!ok) {
          await new Promise((r) => {
            socket.once("drain", r);
            socket.once("close", r);
          });
        }
      }
      if (!socket.destroyed && !finished) {
        if (chunked) socket.write("0\r\n\r\n");
        // give the server a moment to answer, then finish
        setTimeout(() => {
          socket.end();
        }, 300);
      }
    });
  });
}

// ------------------------------------------------------------- the process of the command

// Runs `node cli.js ...args` in tools/; kills it in t.after. waitLines(n) resolves with the
// first n lines of stdout.
export function spawnCli(t, args, { cwd = TOOLS, env, viaNpm = false } = {}) {
  const home = viaNpm ? makeTmp(t) : undefined;
  const child = viaNpm
    ? spawn("npm", ["run", "-s", "picker", "--", ...args], {
        cwd,
        env: env ?? { PATH: process.env.PATH, HOME: home },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      })
    : spawn(process.execPath, [CLI, ...args], {
        cwd,
        env: env ?? { PATH: process.env.PATH },
        stdio: ["ignore", "pipe", "pipe"],
      });
  let stdout = "";
  let stderr = "";
  const waiters = [];
  child.stdout.on("data", (c) => {
    stdout += c.toString("utf8");
    for (const w of waiters) w();
  });
  child.stderr.on("data", (c) => {
    stderr += c.toString("utf8");
  });
  const exited = new Promise((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
  const kill = (signal) => {
    try {
      if (viaNpm) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch {
      // already gone
    }
  };
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) kill("SIGKILL");
    if (viaNpm) kill("SIGKILL");
  });
  const lines = () =>
    stdout.split("\n").filter((l, i, a) => i < a.length - 1 || l !== "");
  return {
    child,
    exited,
    stdout: () => stdout,
    stderr: () => stderr,
    lines,
    waitLines(n, ms = 15000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`no ${n} lines: ${stdout}`)),
          ms,
        );
        const check = () => {
          if (lines().length >= n) {
            clearTimeout(timer);
            resolve(lines());
          }
        };
        waiters.push(check);
        check();
      });
    },
    async stop(signal) {
      kill(signal);
      const result = await Promise.race([
        exited,
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("did not stop")), 5000),
        ),
      ]);
      return result;
    },
  };
}

// The port is closed: a connection is refused.
export function portRefuses(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.on("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", (err) => resolve(err.code === "ECONNREFUSED"));
  });
}

// ------------------------------------------------------------- the oracles

const hasOwn = (o, k) => Object.hasOwn(o, k);

// The questionnaire that a visitor must get (design 5.3), built from the file of the
// tenant (a plain object) and written again here: the order of the keys is part of it.
export function expectedQuestionnaire(tenant, lang, version) {
  const v2 = tenant.schema === "sai-picker-tenant/2";
  const view = v2 ? viewByOracle(tenant, lang) : tenant;
  const languages = v2 ? ["ru", "kk", "en"] : ["ru"];
  const shown = v2 && languages.includes(lang) ? lang : "ru";
  const condition = (c) => {
    const out = { question: c.question };
    for (const key of ["any_of", "none_of", "min", "max"])
      if (hasOwn(c, key)) out[key] = c[key];
    return out;
  };
  const question = (q) => {
    const out = { id: q.id, title: q.title };
    if (hasOwn(q, "help")) out.help = q.help;
    out.type = q.type;
    out.required = q.required;
    if (hasOwn(q, "options"))
      out.options = q.options.map((o) => ({ id: o.id, label: o.label }));
    for (const key of ["min", "max", "unit"])
      if (hasOwn(q, key)) out[key] = q[key];
    if (hasOwn(q, "show_if")) out.show_if = q.show_if.map(condition);
    return out;
  };
  const leads =
    hasOwn(view, "leads") && view.leads.enabled === true
      ? {
          contact_fields: view.leads.contact_fields,
          consent_text: view.leads.consent_text,
          operator_name: view.leads.operator_name,
          privacy_contact: view.leads.privacy_contact,
          retention_days: view.leads.retention_days,
        }
      : null;
  return {
    version,
    lang: shown,
    languages,
    name: view.name,
    intro: view.intro,
    questions_min: view.questions.filter((q) => !hasOwn(q, "show_if")).length,
    questions_max: view.questions.length,
    questions: view.questions.map(question),
    ai: false,
    leads,
  };
}

// The result that a visitor must get: the engine on the view of the file, without ranking.
export function expectedResult(tenant, lang, answers) {
  const v2 = tenant.schema === "sai-picker-tenant/2";
  const view = v2 ? viewByOracle(tenant, lang) : tenant;
  const computed = computeResult(view, answers);
  if (!computed.ok) return null;
  const { ranking, ...rest } = computed.result;
  void ranking;
  return rest;
}

// The ids of a tenant file.
export function idsOf(tenant) {
  return [
    tenant.id,
    ...tenant.questions.map((q) => q.id),
    ...tenant.questions.flatMap((q) => (q.options ?? []).map((o) => o.id)),
    ...tenant.solutions.map((s) => s.id),
    ...tenant.rules.map((r) => r.id),
    ...(tenant.hypotheses ?? []).map((h) => h.id),
  ];
}

// Every string of a tenant that a visitor of another tenant must never see: the ids, the
// texts for the visitor in all the languages, the two strings of the leads.
export function foreignStrings(tenant) {
  const out = new Set(idsOf(tenant));
  for (const place of textPlaces(tenant)) {
    if (typeof place.value === "string") out.add(place.value);
    else for (const l of LANGS) out.add(place.value[l]);
  }
  if (tenant.leads !== undefined) {
    out.add(tenant.leads.operator_name);
    out.add(tenant.leads.privacy_contact);
  }
  return out;
}

// All the string values of a JSON value (not the keys).
export function stringValues(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) stringValues(v, out);
  else if (value !== null && typeof value === "object")
    for (const k of Object.keys(value)) stringValues(value[k], out);
  return out;
}

// The sets of keys at every place of a value: [{ place, keys }].
export function keyPaths(value, here = "$", out = []) {
  if (Array.isArray(value)) {
    value.forEach((v) => keyPaths(v, `${here}[]`, out));
  } else if (value !== null && typeof value === "object") {
    out.push({ place: here, keys: Object.keys(value) });
    for (const k of Object.keys(value)) keyPaths(value[k], `${here}.${k}`, out);
  }
  return out;
}

// Source text of a module of the picker without its comments (for the structural tests).
export function codeOf(name) {
  const text = fs.readFileSync(path.join(PICKER, name), "utf8");
  return text
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .split("\n")
    .map((line) => line.replace(/(^|\s)\/\/.*$/u, "$1"))
    .join("\n");
}
export const sourceOf = (name) =>
  fs.readFileSync(path.join(PICKER, name), "utf8");
