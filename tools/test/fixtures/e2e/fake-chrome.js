#!/usr/bin/env node
// A stand-in for Chrome that speaks just enough of the DevTools protocol for the
// end-to-end kit (docs/design/REQ-104-e2e-chrome-kit.md, section 5). Node
// built-ins only. It never reads stdin. Variables: SAI_FAKE_CHROME_MODE (default
// "ok") and SAI_FAKE_CHROME_LOG (a file; one JSON line per event). The mode
// "ok-ignore-term" is "ok" that ignores SIGTERM (only SIGKILL ends it), so that
// a started browser can be closed the hard way. The mode "no-upgrade" prints the
// port line and accepts the connection, but never answers the WebSocket upgrade.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";

const MODE = process.env.SAI_FAKE_CHROME_MODE || "ok";
const LOG = process.env.SAI_FAKE_CHROME_LOG;
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
// a 1x1 PNG
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function log(event) {
  if (!LOG) return;
  try {
    fs.appendFileSync(LOG, `${JSON.stringify(event)}\n`);
  } catch {
    // the log is only for the tests
  }
}

function writeStderr(text) {
  const buffer = Buffer.from(text);
  let offset = 0;
  while (offset < buffer.length) {
    try {
      offset += fs.writeSync(2, buffer, offset);
    } catch (err) {
      if (err.code !== "EAGAIN") throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
  }
}

if (process.argv.includes("--version")) {
  process.stdout.write("Fake Chrome 1.2.3\n");
  process.exit(0);
}

log({ event: "start", pid: process.pid, argv: process.argv.slice(2) });

if (MODE === "exit-early") {
  writeStderr("first line\nfake: cannot start, boom\n");
  process.exit(3);
}
if (MODE === "ok-ignore-term") process.on("SIGTERM", () => {});
if (MODE === "hang" || MODE === "hang-ignore-term") {
  if (MODE === "hang-ignore-term") process.on("SIGTERM", () => {});
  setInterval(() => {}, 1000);
} else {
  start();
}

function frame(text) {
  const payload = Buffer.from(text);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.from([
      0x81,
      126,
      payload.length >> 8,
      payload.length & 255,
    ]);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

// Reads the masked frames of the client out of `buffer`; returns the rest.
function readFrames(buffer, onText, onClose) {
  let rest = buffer;
  for (;;) {
    if (rest.length < 2) return rest;
    const opcode = rest[0] & 15;
    let length = rest[1] & 127;
    let offset = 2;
    if (length === 126) {
      if (rest.length < 4) return rest;
      length = rest.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (rest.length < 10) return rest;
      length = Number(rest.readBigUInt64BE(2));
      offset = 10;
    }
    const masked = (rest[1] & 128) !== 0;
    const maskLength = masked ? 4 : 0;
    if (rest.length < offset + maskLength + length) return rest;
    const mask = rest.subarray(offset, offset + maskLength);
    const payload = Buffer.from(
      rest.subarray(offset + maskLength, offset + maskLength + length),
    );
    if (masked)
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    rest = rest.subarray(offset + maskLength + length);
    if (opcode === 1) onText(payload.toString("utf8"));
    else if (opcode === 8) onClose();
  }
}

function start() {
  const sockets = new Set();
  let targets = 0;
  let sessions = 0;
  let noisyDone = false;
  const server = http.createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    if (MODE === "close-on-connect") socket.destroy();
  });
  server.on("upgrade", (req, socket) => {
    if (MODE === "no-upgrade") {
      socket.on("error", () => {});
      return;
    }
    if (MODE === "close-on-connect") {
      socket.destroy();
      return;
    }
    const accept = createHash("sha1")
      .update(`${req.headers["sec-websocket-key"]}${GUID}`)
      .digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    let pending = Buffer.alloc(0);
    const send = (object) => {
      if (!socket.destroyed)
        socket.write(
          frame(typeof object === "string" ? object : JSON.stringify(object)),
        );
    };
    const onText = (text) => {
      let message;
      try {
        message = JSON.parse(text);
      } catch {
        return;
      }
      log({
        event: "call",
        method: message.method,
        params: message.params,
        sessionId: message.sessionId,
      });
      handle(message, send, socket);
    };
    socket.on("data", (chunk) => {
      pending = readFrames(Buffer.concat([pending, chunk]), onText, () =>
        socket.end(),
      );
    });
    socket.on("error", () => {});
  });

  function noisy() {
    if (MODE !== "noisy" || noisyDone) return;
    noisyDone = true;
    const chunk = "x".repeat(4095) + "\n";
    for (let i = 0; i < 256; i++) writeStderr(chunk);
  }

  function handle(message, send, socket) {
    const { id, method, sessionId } = message;
    if (MODE === "no-answer") return;
    if (MODE === "port-then-close") {
      socket.destroy();
      return;
    }
    if (MODE === "bad-json") {
      send("this is not json");
      return;
    }
    if (MODE === "error-object") {
      send({ id, error: { code: -32000, message: "boom from fake" } });
      return;
    }
    noisy();
    const answer = (result) =>
      send({ id, result, ...(sessionId ? { sessionId } : {}) });
    switch (method) {
      case "Browser.getVersion":
        answer({ product: "FakeChrome/1.2.3" });
        break;
      case "Target.createTarget":
        answer({ targetId: `T${++targets}` });
        break;
      case "Target.attachToTarget":
        answer({ sessionId: `S${++sessions}` });
        break;
      case "Page.navigate":
        answer({ frameId: "F1", loaderId: `L${Date.now()}` });
        send({
          method: "Page.loadEventFired",
          params: { timestamp: 1 },
          sessionId,
        });
        break;
      case "Page.captureScreenshot":
        answer({ data: PNG_BASE64 });
        break;
      case "Runtime.evaluate":
        answer({ result: { type: "undefined" } });
        break;
      case "Target.closeTarget":
        answer({ success: true });
        break;
      default:
        answer({});
    }
  }

  if (MODE === "with-child") {
    const child = spawn(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      {
        stdio: "ignore",
      },
    );
    log({ event: "child", pid: child.pid });
  }

  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    writeStderr(
      `\nDevTools listening on ws://127.0.0.1:${port}/devtools/browser/fake\n`,
    );
  });
}
