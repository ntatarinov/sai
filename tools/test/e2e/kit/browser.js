import { spawn } from "node:child_process";
import { connect } from "./cdp.js";
import {
  installHandlers,
  makeTempDir,
  noteBrowserForRunner,
  registerGroup,
  removeTempDir,
  signalGroup,
  stopGroup,
  unregisterGroup,
  waitGroupGone,
} from "./cleanup.js";
import { consoleError, evaluateConsole, makeDeclaration } from "./console.js";
import { E2eError, safeText } from "./errors.js";
import { findChrome } from "./find-chrome.js";
import { Page } from "./page.js";

// Starts a real Chrome as its own process group, talks to it, and stops it
// (design section 4.6). Clean-up is registered at spawn, before the first wait.

const PORT_LINE =
  /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/\S+)/;
const AFTER_START_TAIL = 4096;
const BEFORE_START_TAIL = 65536;

function buildArgs(profileDir) {
  return Object.freeze([
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--use-mock-keychain",
    "--disable-gpu",
    "--no-proxy-server",
    "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1",
    "about:blank",
  ]);
}

function exitInfoOf(code, signal) {
  return signal ? `signal ${signal}` : `exit code ${code}`;
}

function lastLineOf(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return lines.length ? lines[lines.length - 1] : "";
}

export class Browser {
  #connection;
  #closeGraceMs;
  #closePromise = null;
  #pages = [];
  #entries = [];
  #declarations = [];

  constructor({ connection, pid, profileDir, product, args, closeGraceMs }) {
    this.#connection = connection;
    this.pid = pid;
    this.profileDir = profileDir;
    this.product = product;
    this.args = args;
    this.#closeGraceMs = closeGraceMs;
  }

  isClosed() {
    return this.#closePromise !== null;
  }

  #live(fn) {
    if (this.isClosed())
      throw new E2eError("USAGE", `${fn}: the browser is closed`);
  }

  async newPage() {
    this.#live("Browser.newPage");
    const { targetId } = await this.#connection.send("Target.createTarget", {
      url: "about:blank",
    });
    const { sessionId } = await this.#connection.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    const page = new Page({
      connection: this.#connection,
      sessionId,
      targetId,
      index: this.#pages.length,
      onEntry: (entry) => this.#entries.push(entry),
      declarations: () => this.#declarations,
    });
    this.#pages.push(page);
    await page.init();
    return page;
  }

  send(method, params) {
    return this.#connection.send(method, params);
  }

  expect(declaration) {
    this.#live("Browser.expect");
    this.#declarations.push(makeDeclaration({ ...declaration, once: false }));
  }

  expectOncePerStart(declaration) {
    this.#live("Browser.expectOncePerStart");
    this.#declarations.push(makeDeclaration({ ...declaration, once: true }));
  }

  consoleEntries() {
    return [...this.#entries];
  }

  unexpectedEntries() {
    return evaluateConsole(this.#entries, this.#declarations).unexpected;
  }

  // The favicon line comes a few milliseconds after the load event, so wait first.
  async verifyConsole({ settleMs = 300 } = {}) {
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    const { unexpected, unmet } = evaluateConsole(
      this.#entries,
      this.#declarations,
    );
    const error = consoleError(unexpected, unmet);
    if (error) throw error;
  }

  close() {
    if (this.#closePromise === null) this.#closePromise = this.#doClose();
    return this.#closePromise;
  }

  async #doClose() {
    const pgid = this.pid;
    this.#connection.close();
    const gone = await stopGroup(pgid, this.#closeGraceMs);
    let reason = null;
    if (!gone) reason = "the process group is still alive after SIGKILL";
    else unregisterGroup(pgid);
    try {
      removeTempDir(this.profileDir);
    } catch (err) {
      reason =
        reason ?? `the folder could not be removed (${err.code ?? "error"})`;
    }
    if (reason) {
      throw new E2eError(
        "CLEANUP_FAILED",
        `could not clean up: pid ${pgid}, folder "${this.profileDir}": ${reason}`,
        { pid: pgid, profileDir: this.profileDir },
      );
    }
  }
}

// Kills the group, waits for it, removes the folder and the registration.
async function abortStart(pgid, profileDir) {
  if (pgid !== undefined) {
    signalGroup(pgid, "SIGKILL");
    await waitGroupGone(pgid, 3000);
    unregisterGroup(pgid);
  }
  try {
    removeTempDir(profileDir);
  } catch {
    // the exit handler tries again
  }
}

export async function launchBrowser(options = {}) {
  const {
    env = process.env,
    startTimeoutMs = 20000,
    callTimeoutMs = 20000,
    closeGraceMs = 3000,
  } = options;

  const found = findChrome({ env });
  const profileDir = makeTempDir("profile");
  const args = buildArgs(profileDir);
  let child;
  try {
    child = spawn(found.path, args, {
      detached: true,
      stdio: ["ignore", "ignore", "pipe"],
      env,
    });
  } catch (err) {
    await abortStart(undefined, profileDir);
    throw new E2eError(
      "START_FAILED",
      `could not start "${found.path}": ${err.code ?? "error"}`,
      {},
      err,
    );
  }
  const pid = child.pid;
  if (pid !== undefined) {
    registerGroup(pid, profileDir);
    noteBrowserForRunner(pid, profileDir);
    installHandlers();
  }

  let tail = "";
  let started = false;
  let exited = null; // { code, signal }
  let connection = null;
  let startSettled = false;
  let stopStart;

  const startResult = new Promise((resolve, reject) => {
    let exitTimer;
    const settle = (fn, value) => {
      if (startSettled) return;
      startSettled = true;
      clearTimeout(timer);
      clearTimeout(exitTimer);
      fn(value);
    };
    stopStart = () => settle(() => {});

    child.stderr.setEncoding("utf8");
    child.stderr.on("error", () => {});
    child.stderr.on("data", (chunk) => {
      tail += chunk;
      if (!started) {
        const match = PORT_LINE.exec(tail);
        if (match) {
          started = true;
          settle(resolve, match[1]);
        }
        if (tail.length > BEFORE_START_TAIL)
          tail = tail.slice(-BEFORE_START_TAIL);
      }
      // the pipe keeps being read after the port line: a full pipe would block Chrome
      if (started && tail.length > AFTER_START_TAIL)
        tail = tail.slice(-AFTER_START_TAIL);
    });

    child.on("error", (err) => {
      settle(
        reject,
        new E2eError(
          "START_FAILED",
          `could not start "${found.path}": ${err.code ?? "error"}`,
          {},
          err,
        ),
      );
    });

    child.on("exit", (code, signal) => {
      exited = { code, signal };
      if (connection) {
        connection.fail(
          new E2eError(
            "BROWSER_CLOSED",
            `the browser is closed (${exitInfoOf(code, signal)})`,
            { exitInfo: exitInfoOf(code, signal), lastLine: lastLineOf(tail) },
          ),
        );
      }
      if (startSettled) return;
      // the last lines of stderr may still be on their way; wait a moment for them
      const fail = () => {
        const lines = tail.split("\n").filter((line) => line.trim() !== "");
        const stderrTail = lines.slice(-20);
        let message =
          `the browser exited before it was ready (${exitInfoOf(code, signal)}). ` +
          `Last line of its stderr: "${safeText(lastLineOf(tail), 300)}"`;
        if (stderrTail.some((line) => /sandbox/i.test(line))) {
          message +=
            " Chrome refused to start with its sandbox; the kit never turns the sandbox off (decisions/0107), so the machine has to be fixed.";
        }
        settle(
          reject,
          new E2eError("START_EXITED", message, {
            pid,
            profileDir,
            exitCode: code,
            signal,
            stderrTail,
          }),
        );
      };
      // "close" comes when the process has ended and its stderr is read to the end;
      // a helper process that holds the pipe open is waited for 300 ms only
      child.once("close", fail);
      exitTimer = setTimeout(fail, 300);
    });

    const timer = setTimeout(() => {
      settle(
        reject,
        new E2eError(
          "START_TIMEOUT",
          `the browser did not start in ${startTimeoutMs} ms (no "DevTools listening" line on its stderr); it was killed`,
          { pid, profileDir },
        ),
      );
    }, startTimeoutMs);
  });
  startResult.catch(() => {});

  try {
    const wsUrl = await startResult;
    connection = await connect(wsUrl, { callTimeoutMs });
    if (exited) {
      connection.fail(
        new E2eError("BROWSER_CLOSED", "the browser is closed", {
          exitInfo: exitInfoOf(exited.code, exited.signal),
        }),
      );
    }
    const version = await connection.send("Browser.getVersion");
    return new Browser({
      connection,
      pid,
      profileDir,
      product: String(version.product ?? ""),
      args,
      closeGraceMs,
    });
  } catch (err) {
    stopStart();
    if (connection) connection.close();
    await abortStart(pid, profileDir);
    throw err;
  }
}

// withBrowser(options?, body) -> the value of body. The browser is always closed.
export async function withBrowser(optionsOrBody, maybeBody) {
  const body = typeof optionsOrBody === "function" ? optionsOrBody : maybeBody;
  const options =
    typeof optionsOrBody === "function" ? {} : (optionsOrBody ?? {});
  if (typeof body !== "function") {
    throw new E2eError("USAGE", "withBrowser: the body must be a function");
  }
  const browser = await launchBrowser(options);
  let value;
  let failure = null;
  try {
    value = await body(browser);
    await browser.verifyConsole();
  } catch (err) {
    failure = err;
  }
  try {
    await browser.close();
  } catch (cleanupError) {
    if (failure === null) throw cleanupError;
    if (typeof failure === "object") failure.cleanupError = cleanupError;
  }
  if (failure !== null) throw failure;
  return value;
}
