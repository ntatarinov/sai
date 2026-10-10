// The channel of commands of a running engine of Sai Team: the file queue inbox/
// of the project folder (design REQ-013, section 13; decisions/0020). The side of
// a command (sendToEngine, deliver) and the side of the engine (openInbox).
//
// The fifth place that writes files (criterion 2 of REQ-009): writeInboxFile is the
// only call that creates a file here, always inside inbox/ of one project, always
// a new name (flag "wx", mode 0600). A message is published by linkSync (never
// replaces an existing name); the engine takes it by renameSync into its own name
// taken/.taking-<name>. The channel writes no event: the engine does, through the
// writer of the core. No path of inbox/ leaves this module.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { maskSecrets } from "../../pixel-office/mask.js";
import { TeamError, engineError, eventError, fromOsError } from "../errors.js";
import { resolveHome, resolveProjectDir, INBOX_DIR } from "../home.js";
import { ENGINE_HOLDER, holdsLive, isAlive, lockHolder } from "../lock.js";
import { LIMITS, PATTERNS, isCanonicalTs } from "../schema.js";
import { openWriter, readProject } from "../store.js";
import { eventView } from "../view.js";
import { applyCommand, parseBudget } from "./commands.js";
import { scanFacts } from "./facts.js";

export const MSG_NAME = /^m-[0-9]{12}\.json$/;
export const MSG_BYTES_MAX = 65_536;
export const ACK_WAIT_MS = 10_000;
export const INBOX_POLL_MS = 100;
export const SEND_POLL_MS = 50;
export const INBOX_ENTRIES_MAX = 100;
export const PUBLISH_TRIES_MAX = 50;
export const ORPHAN_ACK_MS = 60_000;
// The largest number of a message: 12 digits (MSG_NAME). A sender that would need
// a longer one refuses (E_CHANNEL_FULL) instead of publishing a name the engine
// never reads.
export const NUMBER_MAX = 999_999_999_999;
// How far above the largest taken number a new number may be. A number further
// away is not a number a sender computes (1 + the largest it sees): the engine
// refuses it (E_CHANNEL_BAD) and does not raise high by it, so one planted file
// cannot use up the numbers of the channel.
export const NUMBER_JUMP_MAX = 1_000_000;

// (r5.3) The one rule of the numbers for the sender and the engine: a number above
// high + NUMBER_JUMP_MAX is not a number of the channel — the engine refuses it,
// the clean-up does not raise high by it and a sender does not count it.
export function countsAsNumber(n, high) {
  return n <= high + NUMBER_JUMP_MAX;
}

// The next number of a sender (section 13.6): 1 + the largest of high and the
// numbers it sees that count; above NUMBER_MAX — E_CHANNEL_FULL.
export function nextNumber(numbers, high) {
  let top = high;
  for (const n of numbers) if (countsAsNumber(n, high) && n > top) top = n;
  const next = 1 + top;
  if (next > NUMBER_MAX) throw engineError("E_CHANNEL_FULL");
  return next;
}

const TAKEN_DIR = "taken";
const ACK_DIR = "ack";
const HIGH_FILE = "high";
const TAKING = ".taking-";
const TAKING_NAME = /^\.taking-(m-[0-9]{12}\.json)$/;
const HIGH_FORM = /^[0-9]{12}\n$/;
const ACK_NAME = /^[0-9a-f]{16}\.ack$/;
const LEFTOVER = /^\.(tmp|cancel)-/;
// (r5.5, F1) the temporary file of a sender: its pid is in the name.
const SENDER_TMP = /^\.tmp-([0-9]+)-[0-9a-f]{16}$/;

// A leftover of inbox/ the clean-up removes: .cancel-*, and a temporary file of a
// sender that is not alive (or not of the form of a sender). The temporary file
// of a live sender is a publication going on right now and is never touched.
function removableLeftover(name) {
  if (name.startsWith(".cancel-")) return true;
  if (!name.startsWith(".tmp-")) return false;
  const m = SENDER_TMP.exec(name);
  if (m === null) return true;
  const pid = Number(m[1]);
  return !(Number.isSafeInteger(pid) && pid >= 1 && isAlive(pid));
}
const INBOX_WAIT_MS = 1000;
const BUSY_RETRIES = 3;
const BUSY_PAUSE_MS = 100;
const KINDS = ["say", "pause", "resume", "stop", "budget", "answer"];
const MESSAGE_KEYS = [
  "v",
  "project",
  "nonce",
  "sender_pid",
  "sent_at",
  "kind",
  "args",
];
const ACK_OK_KEYS = ["v", "nonce", "msg", "ok", "event", "notices"];
const ACK_FAIL_KEYS = ["v", "nonce", "msg", "ok", "code", "message"];
const DROPPED_TEXT =
  "Сообщения, полученные до готовности проекта, не выполнены";
const strictUtf8 = new TextDecoder("utf-8", { fatal: true });
const { O_RDONLY, O_NOFOLLOW } = fs.constants;

// ---- small helpers ---------------------------------------------------------------

function usage(message) {
  return new TeamError("E_USAGE", message);
}

function channelError() {
  return engineError("E_CHANNEL");
}

function ownUid() {
  return typeof process.getuid === "function" ? process.getuid() : null;
}

function isOwn(st) {
  const uid = ownUid();
  return uid === null || st.uid === uid;
}

function rand16() {
  return crypto.randomBytes(8).toString("hex");
}

function pad12(n) {
  return String(n).padStart(12, "0");
}

function numberOf(name) {
  return Number(name.slice(2, 14));
}

function lstatOrNull(p) {
  try {
    return fs.lstatSync(p);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

function unlinkQuietly(p) {
  try {
    fs.unlinkSync(p);
  } catch {
    // ENOENT: the sender revoked it, or a clean-up after a crash removes it.
  }
}

function isPlainObject(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function sameKeys(obj, keys) {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((k, i) => own[i] === k);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pathsOf(projectDir) {
  const inbox = path.join(projectDir, INBOX_DIR);
  return {
    inbox,
    taken: path.join(inbox, TAKEN_DIR),
    ack: path.join(inbox, ACK_DIR),
    high: path.join(inbox, TAKEN_DIR, HIGH_FILE),
  };
}

// The one creation of a file of the channel (section 13.7): a new temporary name in
// `dir`, mode 0600, flushed. Returns its path.
function writeInboxFile(dir, buf, prefix) {
  const tmp = path.join(dir, `${prefix}${rand16()}`);
  fs.writeFileSync(tmp, buf, { flag: "wx", mode: 0o600, flush: true });
  return tmp;
}

// A folder of the channel: a real folder (not a link) of this user.
function goodDir(st) {
  return st !== null && st.isDirectory() && !st.isSymbolicLink() && isOwn(st);
}

// Reads a file of the channel by the rules of section 13.5, step 5 (also for an
// ack): a regular file of this user, mode exactly 0600, not above the limit, read
// without following a link, the same inode; strict UTF-8 and JSON. Returns
// { value } or { error: true }.
function readChannelFile(file) {
  let st;
  try {
    st = fs.lstatSync(file);
  } catch {
    return { error: true };
  }
  if (
    !st.isFile() ||
    st.isSymbolicLink() ||
    !isOwn(st) ||
    (st.mode & 0o777) !== 0o600 ||
    st.size > MSG_BYTES_MAX
  ) {
    return { error: true, st };
  }
  let fd;
  try {
    fd = fs.openSync(file, O_RDONLY | O_NOFOLLOW);
  } catch {
    return { error: true, st };
  }
  try {
    const fst = fs.fstatSync(fd);
    if (fst.ino !== st.ino || fst.size > MSG_BYTES_MAX)
      return { error: true, st };
    const buf = Buffer.alloc(fst.size);
    let at = 0;
    while (at < buf.length) {
      const n = fs.readSync(fd, buf, at, buf.length - at, at);
      if (n === 0) break;
      at += n;
    }
    return { value: JSON.parse(strictUtf8.decode(buf.subarray(0, at))), st };
  } catch {
    return { error: true, st };
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // nothing left to do
    }
  }
}

// ---- the arguments of a message (section 13.3) -------------------------------------

function checkTextArg(text) {
  if (typeof text !== "string" || text.trim() === "") {
    // the rule of the core without an engine (writer.say): an empty text is E_EVENT
    throw eventError("text");
  }
  const points = (s) => [...s].length;
  if (
    points(text) > LIMITS.TEXT_MAX ||
    points(maskSecrets(text)) > LIMITS.TEXT_MAX
  ) {
    throw new TeamError(
      "E_TOO_LONG",
      `Сообщение длиннее ${LIMITS.TEXT_MAX} знаков — сократите его`,
    );
  }
  return text;
}

function moneyArg(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Number(value.toFixed(6)) !== value
  ) {
    throw usage(
      `Сумма: число больше 0 и не больше ${LIMITS.BUDGET_MAX}, до 6 знаков после точки`,
    );
  }
  return parseBudget(String(value));
}

// The one parse of the arguments of a message, for the command line and for a file
// of the channel: a message gives the engine nothing a command line does not.
export function parseEngineArgs(kind, args) {
  if (!KINDS.includes(kind)) throw usage("Неизвестная команда");
  if (!isPlainObject(args)) throw usage("Неизвестная команда");
  switch (kind) {
    case "say":
      if (!sameKeys(args, ["text"])) throw usage("Неизвестная команда");
      return { text: checkTextArg(args.text) };
    case "pause":
    case "stop":
      if (!sameKeys(args, [])) throw usage("Неизвестная команда");
      return {};
    case "resume": {
      if (!sameKeys(args, ["parallel"])) throw usage("Неизвестная команда");
      const p = args.parallel;
      if (p !== null && ![1, 2, 3].includes(p)) {
        throw usage("--parallel: число 1, 2 или 3");
      }
      return { parallel: p };
    }
    case "budget":
      if (!sameKeys(args, ["budget_usd"])) throw usage("Неизвестная команда");
      return { budget_usd: moneyArg(args.budget_usd) };
    case "answer": {
      if (!sameKeys(args, ["task", "decision", "text"])) {
        throw usage("Неизвестная команда");
      }
      if (typeof args.task !== "string" || args.task === "") {
        throw usage("Нужен номер задачи");
      }
      if (!["approve", "change", "reject"].includes(args.decision)) {
        throw usage("Решение: approve, change или reject");
      }
      if (args.decision === "change" && args.text === null) {
        throw usage("Для change нужен --text");
      }
      if (args.decision !== "change" && args.text !== null) {
        throw usage("--text нужен только для change");
      }
      return {
        task: args.task,
        decision: args.decision,
        text: args.text === null ? null : checkTextArg(args.text),
      };
    }
    default:
      throw usage("Неизвестная команда");
  }
}

function maskedArgs(kind, args) {
  if (kind === "say") return { text: maskSecrets(args.text) };
  if (kind === "answer" && args.text !== null) {
    return { ...args, text: maskSecrets(args.text) };
  }
  return args;
}

// ---- the side of a command (section 13.6) -------------------------------------------

function homeOf(opts) {
  if (typeof opts.home === "string") return opts.home;
  return resolveHome(opts.env ?? process.env);
}

// The live engine of a project: { pid } or null.
export function engineHolder(id, opts = {}) {
  const dir = resolveProjectDir(homeOf(opts), id);
  const holder = lockHolder(dir);
  if (holder === null || !holder.alive || holder.holder !== ENGINE_HOLDER) {
    return null;
  }
  return { pid: holder.pid };
}

function listMessages(inbox) {
  return fs
    .readdirSync(inbox)
    .filter((n) => MSG_NAME.test(n))
    .sort();
}

// The number in taken/high for a sender: no file — 0; a file not of the form —
// E_CHANNEL.
function senderHigh(highPath) {
  let st;
  try {
    st = fs.lstatSync(highPath);
  } catch (err) {
    if (err.code === "ENOENT") return 0;
    throw channelError();
  }
  if (
    !st.isFile() ||
    st.isSymbolicLink() ||
    !isOwn(st) ||
    st.size !== 13 ||
    (st.mode & 0o777) !== 0o600
  ) {
    throw channelError();
  }
  let text;
  try {
    text = fs.readFileSync(highPath, {
      encoding: "utf8",
      flag: O_RDONLY | O_NOFOLLOW,
    });
  } catch (err) {
    if (err.code === "ENOENT") return 0;
    throw channelError();
  }
  if (!HIGH_FORM.test(text)) throw channelError();
  return Number(text.slice(0, 12));
}

// Step 5: the temporary file in inbox/, then a free number by linkSync. Returns the
// name of the message.
function publishMessage(paths, buf) {
  const writeTmp = () => {
    try {
      return writeInboxFile(paths.inbox, buf, `.tmp-${process.pid}-`);
    } catch (err) {
      throw fromOsError(err, "write");
    }
  };
  let tmp = writeTmp();
  try {
    for (let i = 0; i < PUBLISH_TRIES_MAX; i += 1) {
      let names;
      try {
        names = listMessages(paths.inbox);
      } catch (err) {
        throw fromOsError(err, "read");
      }
      const high = senderHigh(paths.high);
      const name = `m-${pad12(nextNumber(names.map(numberOf), high))}.json`;
      try {
        fs.linkSync(tmp, path.join(paths.inbox, name));
        return name;
      } catch (err) {
        if (err.code === "EEXIST") continue;
        // (r5.5, F1) our own temporary file is gone (removed by someone else):
        // write a new one; it is one of the same PUBLISH_TRIES_MAX tries.
        if (err.code === "ENOENT" && lstatOrNull(tmp) === null) {
          tmp = writeTmp();
          continue;
        }
        throw fromOsError(err, "write");
      }
    }
    throw engineError("E_CHANNEL_FULL");
  } finally {
    unlinkQuietly(tmp);
  }
}

// Step 3: inbox/ is a folder of this user with mode 0700. The engine has just taken
// the lock and may not have made it yet: wait for it up to INBOX_WAIT_MS.
async function waitInbox(paths) {
  const until = Date.now() + INBOX_WAIT_MS;
  for (;;) {
    let st;
    try {
      st = lstatOrNull(paths.inbox);
    } catch {
      st = null;
    }
    if (goodDir(st) && (st.mode & 0o777) === 0o700) return;
    if (Date.now() > until) throw channelError();
    await sleep(SEND_POLL_MS);
  }
}

// An ack as the sender trusts it: { ack } or { bad: true } or { none: true }.
function readAck(file, nonce) {
  if (lstatOrNull(file) === null) return { none: true };
  const r = readChannelFile(file);
  if (r.error) return { bad: true };
  const a = r.value;
  if (!isPlainObject(a) || a.v !== 1 || a.nonce !== nonce) return { bad: true };
  if (a.ok === true) {
    if (!sameKeys(a, ACK_OK_KEYS) || !isPlainObject(a.event))
      return { bad: true };
    if (!Array.isArray(a.notices)) return { bad: true };
  } else if (a.ok === false) {
    if (!sameKeys(a, ACK_FAIL_KEYS)) return { bad: true };
    if (typeof a.code !== "string" || !/^E_[A-Z_]{1,40}$/.test(a.code)) {
      return { bad: true };
    }
    if (typeof a.message !== "string") return { bad: true };
  } else {
    return { bad: true };
  }
  if (typeof a.msg !== "string" || !MSG_NAME.test(a.msg)) return { bad: true };
  return { ack: a };
}

// Step 8: revoke the message the engine has not taken.
function revoke(paths, name, id, gone) {
  const from = path.join(paths.inbox, name);
  const to = path.join(paths.inbox, `.cancel-${name}`);
  try {
    fs.renameSync(from, to);
  } catch (err) {
    if (err.code === "ENOENT") {
      return engineError("E_CHANNEL_UNCONFIRMED", { id });
    }
    return fromOsError(err, "write");
  }
  unlinkQuietly(to);
  return engineError(gone ? "E_CHANNEL_TIMEOUT_GONE" : "E_CHANNEL_TIMEOUT");
}

// Section 13.6. Returns the ack "accepted", or { fallback: true } when there is no
// live lock (the caller writes itself; nothing is written to inbox/). A refusal of
// the engine is thrown with its code and text.
export async function sendToEngine(id, message, opts = {}) {
  const projectDir = resolveProjectDir(homeOf(opts), id);
  const holder = lockHolder(projectDir);
  if (holder === null || !holder.alive) return { fallback: true };
  if (holder.holder !== ENGINE_HOLDER) {
    throw new TeamError(
      "E_PROJECT_BUSY",
      `Проект занят другим процессом (pid ${holder.pid})`,
      { pid: holder.pid },
    );
  }
  const enginePid = holder.pid;
  const paths = pathsOf(projectDir);
  await waitInbox(paths);
  let count;
  try {
    count = listMessages(paths.inbox).length;
  } catch (err) {
    throw fromOsError(err, "read");
  }
  if (count >= INBOX_ENTRIES_MAX) throw engineError("E_CHANNEL_FULL");
  const args = maskedArgs(
    message.kind,
    parseEngineArgs(message.kind, message.args),
  );
  const nonce = rand16();
  const body = {
    v: 1,
    project: id,
    nonce,
    sender_pid: process.pid,
    sent_at: new Date().toISOString(),
    kind: message.kind,
    args,
  };
  const buf = Buffer.from(`${JSON.stringify(body)}\n`, "utf8");
  if (buf.length > MSG_BYTES_MAX) throw engineError("E_MSG_TOO_BIG");
  let name = publishMessage(paths, buf);
  const deadline = Date.now() + ACK_WAIT_MS;
  const ackFile = path.join(paths.ack, `${nonce}.ack`);
  for (;;) {
    const r = readAck(ackFile, nonce);
    if (r.bad) throw revoke(paths, name, id, false);
    if (r.ack !== undefined) {
      unlinkQuietly(ackFile);
      if (r.ack.ok) return r.ack;
      if (r.ack.code === "E_CHANNEL_STALE" && Date.now() < deadline) {
        name = publishMessage(paths, buf);
        continue;
      }
      throw new TeamError(r.ack.code, r.ack.message);
    }
    // (0026 R2) The same rule as lockHolder: a closed broken engine writer of this
    // process is not a live engine.
    if (!holdsLive(enginePid, projectDir)) {
      // One more look: the ack may have come just before the engine ended.
      const last = readAck(ackFile, nonce);
      if (last.ack !== undefined || last.bad) continue;
      throw revoke(paths, name, id, true);
    }
    if (Date.now() >= deadline) throw revoke(paths, name, id, false);
    await sleep(SEND_POLL_MS);
  }
}

// Section 13.9: the one entry of a command and of the server of REQ-011. No live
// lock — the writer of the core and applyCommand here; the live engine — the
// channel; another holder — E_PROJECT_BUSY.
export async function deliver(id, message, opts = {}) {
  const home = homeOf(opts);
  for (let i = 0; ; i += 1) {
    const sent = await sendToEngine(id, message, { ...opts, home });
    if (sent.fallback !== true) return { via: "engine", ack: sent };
    let writer;
    try {
      writer = openWriter(id, { home, now: opts.now });
    } catch (err) {
      // An engine took the lock between the look and the opening (section 14).
      if (
        err instanceof TeamError &&
        err.code === "E_PROJECT_BUSY" &&
        i < BUSY_RETRIES
      ) {
        await sleep(BUSY_PAUSE_MS);
        continue;
      }
      throw err;
    }
    try {
      const before = writer.state;
      // the facts of the journal, read under the lock just taken — only resume and
      // answer need them (sections 9.2, 12.2)
      const facts = ["resume", "answer"].includes(message.kind)
        ? scanFacts(readProject(id, { home }).events)
        : null;
      const event = applyCommand(
        writer,
        {
          kind: message.kind,
          args: parseEngineArgs(message.kind, message.args),
        },
        { facts, config: null },
      );
      return {
        via: "self",
        event: eventView(event, before),
        notices: [...writer.notices],
      };
    } finally {
      writer.close();
    }
  }
}

// ---- the side of the engine (sections 13.4, 13.5, 13.8) ----------------------------

function prepareDir(dir) {
  let st = lstatOrNull(dir);
  if (st === null) {
    fs.mkdirSync(dir, { mode: 0o700 });
    st = fs.lstatSync(dir);
  }
  if (!goodDir(st)) throw channelError();
  if ((st.mode & 0o777) !== 0o700) fs.chmodSync(dir, 0o700);
}

// taken/high for the engine: { value, bad }; never a refusal (section 13.4, step 1).
function engineHigh(highPath) {
  let st;
  try {
    st = fs.lstatSync(highPath);
  } catch {
    return { value: 0, bad: false };
  }
  if (
    !st.isFile() ||
    st.isSymbolicLink() ||
    !isOwn(st) ||
    (st.mode & 0o777) !== 0o600 ||
    st.size !== 13
  ) {
    return { value: 0, bad: true };
  }
  try {
    const text = fs.readFileSync(highPath, {
      encoding: "utf8",
      flag: O_RDONLY | O_NOFOLLOW,
    });
    if (!HIGH_FORM.test(text)) return { value: 0, bad: true };
    return { value: Number(text.slice(0, 12)), bad: false };
  } catch {
    return { value: 0, bad: true };
  }
}

function writeHigh(paths, n) {
  // A folder in place of high (a replacement) is moved aside, not removed: the
  // rename stays inside taken/ and touches nothing in the folder.
  const st = lstatOrNull(paths.high);
  if (st !== null && st.isDirectory() && !st.isSymbolicLink()) {
    fs.renameSync(paths.high, path.join(paths.taken, `.bad-${rand16()}`));
  }
  const tmp = writeInboxFile(paths.taken, `${pad12(n)}\n`, ".tmp-high-");
  try {
    fs.renameSync(tmp, paths.high);
  } catch (err) {
    unlinkQuietly(tmp);
    throw err;
  }
}

function writeAck(paths, nonce, body) {
  const buf = Buffer.from(`${JSON.stringify(body)}\n`, "utf8");
  const tmp = writeInboxFile(paths.ack, buf, ".tmp-");
  try {
    fs.linkSync(tmp, path.join(paths.ack, `${nonce}.ack`));
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  } finally {
    unlinkQuietly(tmp);
  }
}

// The nonce of a message file, or null (section 13.5, step 5 for the reading).
function nonceOf(file) {
  const r = readChannelFile(file);
  if (r.error || !isPlainObject(r.value)) return null;
  return typeof r.value.nonce === "string" && PATTERNS.nonce.test(r.value.nonce)
    ? r.value.nonce
    : null;
}

// The whole check of a taken message (section 13.5, step 5): { message } or
// { nonce } (a refusal; nonce may be null).
function checkMessage(file, id) {
  const r = readChannelFile(file);
  if (r.error) return { nonce: null };
  const m = r.value;
  const nonce =
    isPlainObject(m) &&
    typeof m.nonce === "string" &&
    PATTERNS.nonce.test(m.nonce)
      ? m.nonce
      : null;
  if (
    !isPlainObject(m) ||
    !sameKeys(m, MESSAGE_KEYS) ||
    m.v !== 1 ||
    m.project !== id ||
    nonce === null ||
    !Number.isInteger(m.sender_pid) ||
    m.sender_pid < 1 ||
    !isCanonicalTs(m.sent_at) ||
    !KINDS.includes(m.kind)
  ) {
    return { nonce };
  }
  let args;
  try {
    args = parseEngineArgs(m.kind, m.args);
  } catch {
    return { nonce };
  }
  return { message: { kind: m.kind, args }, nonce };
}

function badId(st) {
  return crypto
    .createHash("sha256")
    .update(`bad:${st.dev}:${st.ino}:${st.size}:${st.mtimeMs}`)
    .digest("hex")
    .slice(0, 16);
}

function droppedText(count, part, parts) {
  return parts > 1
    ? `${DROPPED_TEXT}: ${count} (часть ${part} из ${parts})`
    : `${DROPPED_TEXT}: ${count}`;
}

// Section 13.4, step 2: the clean-up of what lies in inbox/ before the engine is
// ready. Nothing found is executed; a step may be repeated after a crash without
// counting a message twice.
function cleanUp(paths, writer, highNow, notices) {
  // 2.1 read
  const found = [];
  const others = [];
  for (const [dir, pattern] of [
    [paths.inbox, MSG_NAME],
    [paths.taken, TAKING_NAME],
  ]) {
    for (const name of fs.readdirSync(dir).sort()) {
      if (!pattern.test(name)) {
        if (
          !LEFTOVER.test(name) &&
          name !== TAKEN_DIR &&
          name !== ACK_DIR &&
          name !== HIGH_FILE &&
          !name.startsWith(".tmp-high-")
        ) {
          others.push(name);
        }
        continue;
      }
      const file = path.join(dir, name);
      const st = lstatOrNull(file);
      if (st === null) continue;
      const msg = dir === paths.inbox ? name : TAKING_NAME.exec(name)[1];
      found.push({ file, st, msg, number: numberOf(msg) });
    }
  }
  if (others.length > 0) {
    notices.push(
      "В папке сообщений проекта есть посторонние файлы: они не тронуты",
    );
  }
  const byInode = new Map();
  for (const f of found) {
    const key = `${f.st.dev}:${f.st.ino}`;
    if (!byInode.has(key)) {
      const nonce = nonceOf(f.file);
      byInode.set(key, {
        id: nonce ?? badId(f.st),
        readable: nonce !== null,
        msg: f.msg,
      });
    }
    f.ident = byInode.get(key);
  }
  // 2.2 divide: one id — one message; known ids are only removed.
  const known = new Set(writer.state.nonces);
  const unknown = new Map();
  for (const f of found) {
    if (!known.has(f.ident.id)) unknown.set(f.ident.id, f.ident);
  }
  // 2.3 high
  const msgsTop = writer.state.msgs.reduce(
    (m, name) => Math.max(m, numberOf(name)),
    0,
  );
  const base = Math.max(highNow.value, msgsTop);
  const h = Math.max(
    base,
    ...found.map((f) => f.number).filter((n) => countsAsNumber(n, base)),
  );
  if (h > highNow.value || highNow.bad) writeHigh(paths, h);
  // 2.4 the events, all parts in one batch
  const ids = [...unknown.keys()].sort();
  if (ids.length > 0) writer.recordDropped(ids, droppedText);
  // 2.5 an ack for every waiting sender of a not executed message
  const acked = new Set();
  for (const ident of unknown.values()) {
    if (!ident.readable) continue;
    writeAck(paths, ident.id, {
      v: 1,
      nonce: ident.id,
      msg: ident.msg,
      ok: false,
      code: "E_CHANNEL_DROPPED",
      message: engineError("E_CHANNEL_DROPPED").message,
    });
    acked.add(`${ident.id}.ack`);
  }
  // 2.6 remove
  for (const f of found) unlinkQuietly(f.file);
  for (const name of fs.readdirSync(paths.inbox)) {
    if (removableLeftover(name)) unlinkQuietly(path.join(paths.inbox, name));
  }
  for (const name of fs.readdirSync(paths.taken)) {
    if (name.startsWith(".tmp-high-"))
      unlinkQuietly(path.join(paths.taken, name));
  }
  for (const name of fs.readdirSync(paths.ack)) {
    if (!acked.has(name)) unlinkQuietly(path.join(paths.ack, name));
  }
  return { high: h, dropped: ids.length };
}

// Section 13.4: under the lock of the engine, before the first message. `writer`
// is the writer of the engine. Throws E_CHANNEL for a folder that is not ours.
export function openInbox(projectDir, writer, id) {
  const paths = pathsOf(projectDir);
  const notices = [];
  let high;
  let dropped;
  try {
    prepareDir(paths.inbox);
    prepareDir(paths.taken);
    prepareDir(paths.ack);
    ({ high, dropped } = cleanUp(
      paths,
      writer,
      engineHigh(paths.high),
      notices,
    ));
  } catch (err) {
    if (err instanceof TeamError) throw err;
    if (err && typeof err.code === "string") throw channelError();
    throw err;
  }
  return {
    notices,
    dropped,
    // Section 13.5, steps 1-5: the next message to execute, or null. A stale,
    // damaged or unwritable one is answered here and removed.
    take() {
      for (;;) {
        let names;
        try {
          names = listMessages(paths.inbox);
        } catch {
          return null;
        }
        if (names.length === 0) return null;
        let taken = null;
        let duplicate = null;
        for (const name of names) {
          const takingPath = path.join(paths.taken, `${TAKING}${name}`);
          // A taken message with this name is still in work (a stop): renameSync
          // would replace it. The new file is a late duplicate of a taken number.
          if (lstatOrNull(takingPath) !== null) {
            duplicate = name;
            break;
          }
          try {
            fs.renameSync(path.join(paths.inbox, name), takingPath);
            taken = { name, takingPath, n: numberOf(name) };
            break;
          } catch (err) {
            if (err.code === "ENOENT") continue;
            return null;
          }
        }
        if (duplicate !== null) {
          const file = path.join(paths.inbox, duplicate);
          const nonce = nonceOf(file);
          if (nonce !== null) {
            try {
              writeAck(paths, nonce, {
                v: 1,
                nonce,
                msg: duplicate,
                ok: false,
                code: "E_CHANNEL_STALE",
                message: engineError("E_CHANNEL_STALE").message,
              });
            } catch {
              // The sender then revokes or reports "not confirmed".
            }
          }
          unlinkQuietly(file);
          continue;
        }
        if (taken === null) continue;
        const refuse = (nonce, code, message) => {
          if (nonce !== null) {
            try {
              writeAck(paths, nonce, {
                v: 1,
                nonce,
                msg: taken.name,
                ok: false,
                code,
                message,
              });
            } catch {
              // The sender then gets "not confirmed"; no event is written.
            }
          }
          unlinkQuietly(taken.takingPath);
        };
        if (!countsAsNumber(taken.n, high)) {
          refuse(
            nonceOf(taken.takingPath),
            "E_CHANNEL_BAD",
            engineError("E_CHANNEL_BAD").message,
          );
          continue;
        }
        if (taken.n <= high) {
          refuse(
            nonceOf(taken.takingPath),
            "E_CHANNEL_STALE",
            engineError("E_CHANNEL_STALE").message,
          );
          continue;
        }
        try {
          writeHigh(paths, taken.n);
          high = taken.n;
        } catch (err) {
          const e = fromOsError(err, "write");
          refuse(nonceOf(taken.takingPath), "E_DISK", e.message);
          continue;
        }
        const checked = checkMessage(taken.takingPath, id);
        if (checked.message === undefined) {
          refuse(
            checked.nonce,
            "E_CHANNEL_BAD",
            engineError("E_CHANNEL_BAD").message,
          );
          continue;
        }
        return {
          ...checked.message,
          msg: taken.name,
          nonce: checked.nonce,
          takingPath: taken.takingPath,
        };
      }
    },
    // Step 7: the ack, then the taken file is removed.
    answer(taken, body) {
      try {
        writeAck(paths, taken.nonce, {
          v: 1,
          nonce: taken.nonce,
          msg: taken.msg,
          ...body,
        });
      } finally {
        unlinkQuietly(taken.takingPath);
      }
    },
    // Step 8: an ack older than ORPHAN_ACK_MS has nobody waiting for it.
    sweep(nowMs = Date.now()) {
      let names;
      try {
        names = fs.readdirSync(paths.ack);
      } catch {
        return;
      }
      for (const name of names) {
        if (!ACK_NAME.test(name)) continue;
        const st = lstatOrNull(path.join(paths.ack, name));
        if (st !== null && nowMs - st.mtimeMs > ORPHAN_ACK_MS) {
          unlinkQuietly(path.join(paths.ack, name));
        }
      }
    },
    close() {},
  };
}
