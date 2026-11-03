import { E2eError, safeText } from "./errors.js";

// The protocol client: the global WebSocket of Node 22 talking to the browser
// endpoint (design section 4.5). Nothing here prints; every failure is an E2eError.

function closedError(method, exitInfo) {
  const text = method
    ? `the browser closed during ${method} (${exitInfo})`
    : `the browser is closed (${exitInfo})`;
  return new E2eError("BROWSER_CLOSED", text, { exitInfo });
}

class Connection {
  #ws;
  #callTimeoutMs;
  #nextId = 1;
  #pending = new Map();
  #handlers = new Set();
  #closed = false;
  #exitInfo = "connection lost";
  internalErrors = [];

  constructor(ws, callTimeoutMs) {
    this.#ws = ws;
    this.#callTimeoutMs = callTimeoutMs;
    ws.onmessage = (event) => this.#onMessage(event.data);
    ws.onclose = () => this.fail(closedError(undefined, "connection lost"));
    ws.onerror = () => this.fail(closedError(undefined, "connection lost"));
  }

  isClosed() {
    return this.#closed;
  }

  send(method, params, sessionId) {
    if (this.#closed)
      return Promise.reject(closedError(undefined, this.#exitInfo));
    const id = this.#nextId++;
    const request = { id, method };
    if (params !== undefined) request.params = params;
    if (sessionId !== undefined) request.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(
          new E2eError(
            "CALL_TIMEOUT",
            `${method}: no answer in ${this.#callTimeoutMs} ms`,
            {
              method,
            },
          ),
        );
      }, this.#callTimeoutMs);
      this.#pending.set(id, { method, resolve, reject, timer });
      try {
        this.#ws.send(JSON.stringify(request));
      } catch {
        this.#pending.delete(id);
        clearTimeout(timer);
        reject(closedError(method, this.#exitInfo));
      }
    });
  }

  subscribe(handler) {
    this.#handlers.add(handler);
    return () => {
      this.#handlers.delete(handler);
    };
  }

  // Rejects every pending call and marks the connection closed. A BROWSER_CLOSED
  // error is rebuilt for each call so that the message names the call's method.
  fail(error) {
    if (this.#closed) return;
    this.#closed = true;
    if (error?.code === "BROWSER_CLOSED" && error.details?.exitInfo) {
      this.#exitInfo = error.details.exitInfo;
    }
    this.#ws.onmessage = null;
    this.#ws.onclose = null;
    this.#ws.onerror = null;
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    for (const entry of pending) {
      clearTimeout(entry.timer);
      if (error?.code === "BROWSER_CLOSED")
        entry.reject(closedError(entry.method, this.#exitInfo));
      else entry.reject(error);
    }
    this.#closeSocket();
  }

  close() {
    this.fail(closedError(undefined, "connection lost"));
  }

  #closeSocket() {
    try {
      this.#ws.close();
    } catch {
      // already closed
    }
  }

  #badAnswer() {
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    this.#closed = true;
    this.#ws.onmessage = null;
    this.#ws.onclose = null;
    this.#ws.onerror = null;
    for (const entry of pending) {
      clearTimeout(entry.timer);
      entry.reject(
        new E2eError(
          "PROTOCOL_BAD_ANSWER",
          `${entry.method}: the answer of the browser is not valid JSON; the connection was closed`,
          { method: entry.method },
        ),
      );
    }
    this.#closeSocket();
  }

  #onMessage(data) {
    if (this.#closed) return;
    let message;
    try {
      if (typeof data !== "string") throw new Error("binary frame");
      message = JSON.parse(data);
      if (message === null || typeof message !== "object")
        throw new Error("not an object");
    } catch {
      this.#badAnswer();
      return;
    }
    if (message.id !== undefined) {
      const entry = this.#pending.get(message.id);
      if (!entry) return;
      this.#pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error && typeof message.error === "object") {
        entry.reject(
          new E2eError(
            "PROTOCOL_ERROR",
            `${entry.method}: ${safeText(message.error.message, 300)} (code ${safeText(message.error.code, 20)})`,
            { method: entry.method, code: message.error.code },
          ),
        );
      } else {
        entry.resolve(message.result ?? {});
      }
      return;
    }
    for (const handler of [...this.#handlers]) {
      try {
        handler(message);
      } catch (err) {
        this.internalErrors.push(err);
      }
    }
  }
}

// Opens the socket. The handshake has the same limit as a call: a peer that
// accepts the connection and never answers the upgrade ends with CALL_TIMEOUT.
export function connect(wsUrl, { callTimeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      reject(
        new E2eError(
          "BROWSER_CLOSED",
          "the browser is closed (connection lost)",
          {},
          err,
        ),
      );
      return;
    }
    const release = () => {
      clearTimeout(timer);
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
    };
    const timer = setTimeout(() => {
      release();
      try {
        ws.close();
      } catch {
        // already closed
      }
      reject(
        new E2eError(
          "CALL_TIMEOUT",
          `connect: no answer in ${callTimeoutMs} ms`,
          { method: "connect" },
        ),
      );
    }, callTimeoutMs);
    ws.onopen = () => {
      release();
      resolve(new Connection(ws, callTimeoutMs));
    };
    const lost = () => {
      release();
      reject(closedError(undefined, "connection lost"));
    };
    ws.onerror = lost;
    ws.onclose = lost;
  });
}
