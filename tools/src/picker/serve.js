// The command `serve` of the picker site (design REQ-056, 4). One function starts the
// site (`startPicker`), the command and, later, the stand of REQ-062 both call it. The
// text of every refusal is written out here as it is shown (design 4.2); nothing is put
// together from the pieces that are not named in the table.
import { DEFAULT_PORT } from "./config.js";
import { tame } from "./places.js";
import { createPickerServer } from "./server.js";
import { loadTenants } from "./tenants.js";

const SEE_HELP = "Справка: npm run picker -- --help";
const NO_TENANTS_TEXT =
  "Не указана папка арендаторов. Пример: npm run picker -- serve --tenants <папка>";
const KEYS = new Set(["--tenants", "--port", "--home"]);
// The closed list of what `startPicker` takes (REQ-062 adds a field to it).
const OPTIONS = new Set([
  "tenants",
  "home",
  "port",
  "publicDir",
  "bodyIdleMs",
  "headersTimeoutMs",
  "requestTimeoutMs",
]);
const MAX_PORT = 65535;

function refusal(text) {
  return { ok: false, text };
}

// A value is absent when it is empty, begins with "--" or holds a null sign; the next word
// that is another key is not taken as a value (as for the command `handoff`).
function hasValue(value) {
  return (
    typeof value === "string" &&
    value !== "" &&
    !value.startsWith("--") &&
    !value.includes("\u0000")
  );
}

function portText(value) {
  const shown =
    typeof value === "number" || typeof value === "string"
      ? tame(value)
      : typeof value;
  return `Порт — целое число от 0 до ${MAX_PORT} (сейчас: ${shown}).`;
}

function isPort(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PORT;
}

// parseServeArguments(args) -> { ok: true, tenants, home, port } | { ok: false, text }.
// The arguments are checked from left to right, each one (a stray word, an unknown key, a
// repeat, no value), then "no --tenants", then the port; the first refusal is the only one.
// The folder is not looked at here. `--help` is not read here: it is a key like any other.
export function parseServeArguments(args) {
  const given = new Map();
  for (let i = 0; i < args.length; i += 1) {
    const arg = String(args[i]);
    if (!arg.startsWith("--")) {
      return refusal(`Лишний аргумент ${tame(arg)}. ${SEE_HELP}`);
    }
    const eq = arg.indexOf("=");
    const key = eq === -1 ? arg : arg.slice(0, eq);
    if (!KEYS.has(key))
      return refusal(`Неизвестный ключ ${tame(key)}. ${SEE_HELP}`);
    if (given.has(key)) return refusal(`Ключ ${tame(key)} указан дважды.`);
    const value = eq === -1 ? args[i + 1] : arg.slice(eq + 1);
    if (!hasValue(value)) return refusal(`Ключ ${tame(key)} требует значение.`);
    if (eq === -1) i += 1;
    given.set(key, value);
  }
  if (!given.has("--tenants")) return refusal(NO_TENANTS_TEXT);
  let port = DEFAULT_PORT;
  if (given.has("--port")) {
    const raw = given.get("--port");
    port = /^\d+$/u.test(raw) ? Number(raw) : Number.NaN;
    if (!isPort(port)) return refusal(portText(raw));
  }
  return {
    ok: true,
    tenants: given.get("--tenants"),
    home: given.get("--home") ?? null,
    port,
  };
}

function refused(exitCode, ...texts) {
  return {
    ok: false,
    exitCode,
    lines: texts.map((text) => `picker: ${text}`),
  };
}

// The checks of the options of `startPicker`, in the order of design 4.5; a refusal is a
// value, not an exception.
function checkOptions(options) {
  for (const name of Object.keys(options)) {
    if (!OPTIONS.has(name))
      return refused(2, `Неизвестный параметр запуска ${tame(name)}.`);
  }
  const { tenants, port } = options;
  if (
    typeof tenants !== "string" ||
    tenants === "" ||
    tenants.includes("\u0000")
  )
    return refused(2, NO_TENANTS_TEXT);
  if (port !== undefined && !isPort(port)) return refused(2, portText(port));
  return null;
}

// The blocks of the files that are not served, to stderr, before the site starts.
function reportNotServed(notServed, io) {
  for (const item of notServed) {
    io.err(`Арендатор ${item.fileName} не обслуживается:`);
    for (const line of item.lines) io.err(line);
  }
}

// An error of the system that stopped the binding (a port that is taken, no right, ...).
function bindRefusal(err, port) {
  if (typeof err?.code !== "string") throw err;
  if (err.code === "EADDRINUSE") {
    return refused(
      1,
      `Порт ${port} занят. Освободите его или запустите с другим: npm run picker -- serve --tenants <папка> --port <номер>`,
    );
  }
  return refused(
    1,
    `Не удалось запустить сайт (${tame(err.code)}). Проверьте порт.`,
  );
}

// startPicker(options, io) -> { ok: true, address, port, close(), ids }
//                           | { ok: false, exitCode: 1 | 2, lines }.
// `options` is a closed list: tenants (needed), home (taken, not used before REQ-059), port,
// publicDir, bodyIdleMs, headersTimeoutMs, requestTimeoutMs. `io` is { out(line), err(line) }.
// The blocks of the files that are not served go to io.err at once; `lines` of a refusal are
// the lines that the caller writes to stderr. Only a program error is an exception.
export async function startPicker(options, io) {
  const given = options ?? {};
  const bad = checkOptions(given);
  if (bad !== null) return bad;
  const loaded = loadTenants(given.tenants);
  if (loaded.error !== undefined) return refused(2, loaded.error);
  reportNotServed(loaded.notServed, io);
  if (loaded.registry.size === 0) {
    return refused(
      1,
      "В папке нет ни одного исправного файла арендатора. Исправьте файлы и запустите снова.",
    );
  }
  const port = given.port ?? DEFAULT_PORT;
  const server = createPickerServer({
    registry: loaded.registry,
    port,
    publicDir: given.publicDir,
    bodyIdleMs: given.bodyIdleMs,
    headersTimeoutMs: given.headersTimeoutMs,
    requestTimeoutMs: given.requestTimeoutMs,
    warn: (line) => io.err(line),
  });
  let bound;
  try {
    bound = await server.listen();
  } catch (err) {
    return bindRefusal(err, port);
  }
  return {
    ok: true,
    address: bound.address,
    port: bound.port,
    close: () => server.close(),
    ids: loaded.registry.ids(),
  };
}

// runServe(args, io, onStop) -> the exit code. `onStop(callback)` calls `callback` once,
// when the process is asked to stop. The code is 0 after a stop.
export async function runServe(args, io, onStop) {
  const parsed = parseServeArguments(args);
  if (!parsed.ok) {
    io.err(`picker: ${parsed.text}`);
    return 2;
  }
  const stop = new Promise((resolve) => onStop(() => resolve()));
  const started = await startPicker(
    { tenants: parsed.tenants, home: parsed.home, port: parsed.port },
    io,
  );
  if (!started.ok) {
    for (const line of started.lines) io.err(line);
    return started.exitCode;
  }
  io.out("Сайт подбора запущен. Откройте ссылки:");
  for (const id of started.ids)
    io.out(`http://${started.address}:${started.port}/t/${id}/`);
  io.out("Изменения файлов арендаторов применяются после перезапуска.");
  io.out("Остановить сайт: Ctrl+C.");
  await stop;
  await started.close();
  return 0;
}
