import fs from "node:fs";
import { entryFromEvent, evaluateConsole } from "./console.js";
import { E2eError, safeText } from "./errors.js";
import { assertLoopbackUrl, assertShotPath } from "./guards.js";

// One page (a separate target reached through a flat session). The API that the
// page requirements need (design section 4.8). Page code is always a string.

const WINDOW = { width: 1470, height: 784 };

const KEYS = {
  Tab: { key: "Tab", code: "Tab", vk: 9 },
  Enter: { key: "Enter", code: "Enter", vk: 13, text: "\r" },
  Space: { key: " ", code: "Space", vk: 32, text: " " },
  Escape: { key: "Escape", code: "Escape", vk: 27 },
  Backspace: { key: "Backspace", code: "Backspace", vk: 8 },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", vk: 38 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", vk: 40 },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", vk: 37 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", vk: 39 },
};

// After a load event the page is left alone for this long. Chrome asks for the
// favicon right after the load event and drops that request (and its console
// line) when the next navigation starts at once; measured: a second navigation
// started at once loses the line every time, one started 50 ms later never does.
const LOAD_SETTLE_MS = 100;

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

// In-page helpers, passed as strings (the lint config knows no browser globals).
const FIND_FOR_CLICK = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) return { state: "missing" };
  el.scrollIntoView({ block: "center", inline: "center" });
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { state: "invisible" };
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const top = document.elementFromPoint(x, y);
  if (!top || !(top === el || el.contains(top))) {
    return { state: "covered", by: top ? top.id || top.tagName.toLowerCase() : "nothing" };
  }
  return { state: "ok", x, y };
}`;

const FIND_FOR_TYPE = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) return { state: "missing" };
  el.scrollIntoView({ block: "center", inline: "center" });
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { state: "invisible" };
  el.focus();
  return { state: "ok" };
}`;

function firstLine(text) {
  return String(text ?? "").split("\n")[0];
}

function cut(text, max) {
  return text.length > max ? text.slice(0, max) : text;
}

export class Page {
  #connection;
  #sessionId;
  #targetId;
  #index;
  #onEntry;
  #declarations;
  #unsubscribe;
  #closed = false;
  #entries = [];
  #records = [];
  #byRequest = new Map();
  #documentStatus = new Map();
  #loadWaiters = new Set();

  constructor({
    connection,
    sessionId,
    targetId,
    index,
    onEntry,
    declarations,
  }) {
    this.#connection = connection;
    this.#sessionId = sessionId;
    this.#targetId = targetId;
    this.#index = index;
    this.#onEntry = onEntry;
    this.#declarations = declarations;
    this.#unsubscribe = connection.subscribe((message) =>
      this.#onEvent(message),
    );
  }

  // Enables the domains and applies the defaults without checking them: the
  // window 1470x784 and the light colour scheme (the machine decides otherwise).
  async init() {
    await this.#send("Page.enable");
    await this.#send("Runtime.enable");
    await this.#send("Log.enable");
    await this.#send("Network.enable");
    await this.#send("Emulation.setDeviceMetricsOverride", {
      width: WINDOW.width,
      height: WINDOW.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await this.#send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: "light" }],
    });
  }

  #send(method, params) {
    return this.#connection.send(method, params, this.#sessionId);
  }

  #live(fn) {
    if (this.#closed) throw new E2eError("USAGE", `${fn}: the page is closed`);
  }

  #onEvent(message) {
    if (message.sessionId !== this.#sessionId) return;
    const entry = entryFromEvent(message, {
      page: this.#index,
      at: performance.now(),
    });
    if (entry) {
      this.#entries.push(entry);
      this.#onEntry(entry);
      return;
    }
    const p = message.params ?? {};
    switch (message.method) {
      case "Network.requestWillBeSent": {
        const previous = this.#byRequest.get(p.requestId);
        if (previous && p.redirectResponse)
          previous.status = p.redirectResponse.status ?? null;
        const record = {
          requestId: p.requestId,
          method: p.request?.method ?? "GET",
          url: p.request?.url ?? "",
          status: null,
          type: p.type ?? "Other",
          requestBody: p.request?.postData ?? null,
          finished: false,
          failed: null,
        };
        this.#records.push(record);
        this.#byRequest.set(p.requestId, record);
        break;
      }
      case "Network.responseReceived": {
        const record = this.#byRequest.get(p.requestId);
        if (record) {
          record.status = p.response?.status ?? null;
          if (p.type) record.type = p.type;
        }
        if (p.type === "Document" && p.loaderId) {
          this.#documentStatus.set(p.loaderId, p.response?.status ?? null);
        }
        break;
      }
      case "Network.loadingFinished": {
        const record = this.#byRequest.get(p.requestId);
        if (record) record.finished = true;
        break;
      }
      case "Network.loadingFailed": {
        const record = this.#byRequest.get(p.requestId);
        if (record) record.failed = String(p.errorText ?? "failed");
        break;
      }
      case "Page.loadEventFired":
        for (const done of [...this.#loadWaiters]) done();
        break;
      default:
    }
  }

  // Sends `method` and waits for the next load event of this page.
  async #navigateAndWait(method, params, label, timeoutMs) {
    let done;
    const loaded = new Promise((resolve) => {
      done = resolve;
    });
    this.#loadWaiters.add(done);
    let timer;
    const late = new Promise((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new E2eError(
              "NAVIGATION_FAILED",
              `${label}: no load event in ${timeoutMs} ms`,
            ),
          ),
        timeoutMs,
      );
    });
    late.catch(() => {});
    try {
      const result = await this.#send(method, params);
      if (result.errorText) {
        throw new E2eError(
          "NAVIGATION_FAILED",
          `${label}: ${safeText(result.errorText)}`,
        );
      }
      await Promise.race([loaded, late]);
      await new Promise((resolve) => setTimeout(resolve, LOAD_SETTLE_MS));
      return result;
    } finally {
      clearTimeout(timer);
      this.#loadWaiters.delete(done);
    }
  }

  async goto(url, { timeoutMs = 15000 } = {}) {
    this.#live("Page.goto");
    const href = assertLoopbackUrl(url);
    const result = await this.#navigateAndWait(
      "Page.navigate",
      { url: href },
      href,
      timeoutMs,
    );
    const status = this.#documentStatus.get(result.loaderId);
    return { url: href, status: status === undefined ? null : status };
  }

  async reload({ timeoutMs = 15000 } = {}) {
    this.#live("Page.reload");
    await this.#navigateAndWait("Page.reload", {}, "reload", timeoutMs);
  }

  async evaluate(source, args) {
    this.#live("Page.evaluate");
    if (typeof source !== "string") {
      throw new E2eError(
        "USAGE",
        "Page.evaluate: page code must be a string, not a function",
      );
    }
    let expression = source;
    if (args !== undefined) {
      if (!Array.isArray(args)) {
        throw new E2eError("USAGE", "Page.evaluate: args must be an array");
      }
      expression = `(${source}).apply(null, ${JSON.stringify(args)})`;
    }
    const answer = await this.#send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (answer.exceptionDetails) {
      const details = answer.exceptionDetails;
      const text = details.exception?.description ?? details.text;
      throw new E2eError(
        "PAGE_EXCEPTION",
        `the page script threw: ${safeText(firstLine(text), 300)}`,
      );
    }
    return answer.result?.value;
  }

  async waitFor(
    source,
    { args, timeoutMs = 5000, pollMs = 50, description } = {},
  ) {
    this.#live("Page.waitFor");
    const deadline = performance.now() + timeoutMs;
    let last;
    let lastProtocolError = null;
    for (;;) {
      try {
        last = await this.evaluate(source, args);
        if (last) return last;
      } catch (err) {
        // a page that is changing can lose its script context for a moment
        if (!(err instanceof E2eError) || err.code !== "PROTOCOL_ERROR")
          throw err;
        lastProtocolError = err;
      }
      if (performance.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    const what = description ?? cut(source, 120);
    let shown;
    try {
      shown = cut(JSON.stringify(last) ?? "undefined", 200);
    } catch {
      shown = "unprintable";
    }
    throw new E2eError(
      "WAIT_TIMEOUT",
      `waited ${timeoutMs} ms for: ${what}; last value: ${shown}` +
        (lastProtocolError
          ? `; last protocol error: ${lastProtocolError.message}`
          : ""),
    );
  }

  async #find(fn, script, selector) {
    this.#live(fn);
    if (typeof selector !== "string") {
      throw new E2eError("USAGE", `${fn}: the selector must be a string`);
    }
    const found = await this.evaluate(script, [selector]);
    if (found.state === "missing") {
      throw new E2eError(
        "ELEMENT_NOT_FOUND",
        `${fn}: no element matches "${selector}"`,
      );
    }
    if (found.state === "invisible") {
      throw new E2eError(
        "ELEMENT_NOT_VISIBLE",
        `${fn}: "${selector}" has no size`,
      );
    }
    if (found.state === "covered") {
      throw new E2eError(
        "CLICK_INTERCEPTED",
        `${fn}: "${selector}" is covered by ${safeText(found.by, 100)}`,
      );
    }
    return found;
  }

  async click(selector) {
    const found = await this.#find("Page.click", FIND_FOR_CLICK, selector);
    const point = { x: found.x, y: found.y, button: "left", clickCount: 1 };
    await this.#send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...point,
    });
    await this.#send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...point,
    });
  }

  async type(selector, text) {
    if (typeof text !== "string") {
      throw new E2eError("USAGE", "Page.type: the text must be a string");
    }
    await this.#find("Page.type", FIND_FOR_TYPE, selector);
    await this.#send("Input.insertText", { text });
  }

  async press(key, { shift = false, ctrl = false, alt = false } = {}) {
    this.#live("Page.press");
    const spec = Object.hasOwn(KEYS, key) ? KEYS[key] : undefined;
    if (!spec) {
      throw new E2eError(
        "USAGE",
        `Page.press: unknown key "${String(key)}"; the keys are: ${Object.keys(KEYS).join(", ")}`,
      );
    }
    const modifiers = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (shift ? 8 : 0);
    const base = {
      key: spec.key,
      code: spec.code,
      windowsVirtualKeyCode: spec.vk,
      nativeVirtualKeyCode: spec.vk,
      modifiers,
    };
    const down = { type: "keyDown", ...base };
    if (spec.text !== undefined) down.text = spec.text;
    await this.#send("Input.dispatchKeyEvent", down);
    await this.#send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  }

  async setViewport(width, height) {
    this.#live("Page.setViewport");
    for (const value of [width, height]) {
      if (!Number.isInteger(value) || value < 1 || value > 10000) {
        throw new E2eError(
          "USAGE",
          "Page.setViewport: width and height must be integers 1..10000",
        );
      }
    }
    await this.#send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const got = await this.evaluate(
      "({ innerWidth: window.innerWidth, innerHeight: window.innerHeight })",
    );
    if (got.innerWidth !== width || got.innerHeight !== height) {
      throw new E2eError(
        "VIEWPORT_MISMATCH",
        `asked for ${width}x${height}, the page reports ${safeText(got.innerWidth, 20)}x${safeText(got.innerHeight, 20)}`,
      );
    }
    return got;
  }

  async setColorScheme(scheme) {
    this.#live("Page.setColorScheme");
    if (scheme !== "light" && scheme !== "dark") {
      throw new E2eError(
        "USAGE",
        'Page.setColorScheme: the scheme must be "light" or "dark"',
      );
    }
    await this.#send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: scheme }],
    });
    const dark = await this.evaluate(
      "matchMedia('(prefers-color-scheme: dark)').matches",
    );
    if (dark !== (scheme === "dark")) {
      throw new E2eError(
        "SCHEME_MISMATCH",
        `asked for the ${scheme} scheme, the page reports dark=${safeText(dark, 20)}`,
      );
    }
    return dark;
  }

  async horizontalOverflow() {
    this.#live("Page.horizontalOverflow");
    const got = await this.evaluate(`(() => ({
      scrollWidth: Math.max(
        document.documentElement.scrollWidth,
        document.body ? document.body.scrollWidth : 0,
      ),
      innerWidth: window.innerWidth,
    }))()`);
    return {
      overflowing: got.scrollWidth > got.innerWidth,
      scrollWidth: got.scrollWidth,
      innerWidth: got.innerWidth,
    };
  }

  consoleEntries() {
    return [...this.#entries];
  }

  unexpectedEntries() {
    return evaluateConsole(this.#entries, this.#declarations()).unexpected;
  }

  network() {
    return this.#records.map((record) => ({ ...record }));
  }

  clearNetwork() {
    this.#records = [];
    this.#byRequest.clear();
  }

  async responseBody(requestId) {
    this.#live("Page.responseBody");
    const answer = await this.#send("Network.getResponseBody", { requestId });
    return answer.base64Encoded
      ? Buffer.from(answer.body, "base64").toString("utf8")
      : String(answer.body);
  }

  async screenshot(path) {
    this.#live("Page.screenshot");
    const target = assertShotPath(path);
    const answer = await this.#send("Page.captureScreenshot", {
      format: "png",
    });
    const bytes = Buffer.from(String(answer.data ?? ""), "base64");
    if (
      bytes.length < PNG_SIGNATURE.length ||
      !bytes.subarray(0, 8).equals(PNG_SIGNATURE)
    ) {
      throw new E2eError(
        "PROTOCOL_ERROR",
        "Page.captureScreenshot: screenshot is not a PNG",
      );
    }
    try {
      fs.writeFileSync(target, bytes);
    } catch (err) {
      throw new E2eError(
        "SCREENSHOT_FAILED",
        `Page.screenshot: could not write "${target}": ${err.code ?? "error"}`,
        {},
        err,
      );
    }
    return { path: target, bytes: bytes.length };
  }

  async close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#unsubscribe();
    for (const done of [...this.#loadWaiters]) done();
    await this.#connection.send("Target.closeTarget", {
      targetId: this.#targetId,
    });
  }
}
