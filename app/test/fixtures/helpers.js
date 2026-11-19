import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Shared helpers of app/test (no test here): a server of node-main on port 0, raw requests with a chosen
// Host header, temporary folders outside the project (removed in t.after), the presence guards of the
// test folders, a wait with a deadline, a TCP stand-in that counts its connections and a Postgres
// stand-in that answers or goes silent per connection.

export const APP = fileURLToPath(new URL("../../", import.meta.url));
export const ROOT = path.resolve(APP, "..");

/** @param {import("node:test").TestContext} t */
export function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sai-app-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** The environment of a child: only what the test gives, plus PATH. */
export function childEnv(/** @type {Record<string, string>} */ extra = {}) {
  return { PATH: process.env.PATH ?? "", ...extra };
}

/**
 * @param {import("node:test").TestContext} t
 * @param {Record<string, string>} env
 * @param {{ script?: string, waitUrls?: boolean }} [o]
 */
export function startNode(t, env, o = {}) {
  const child = spawn(process.execPath, [o.script ?? "server/node-main.js"], {
    cwd: APP,
    env: childEnv(env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  const exited = new Promise((r) =>
    child.on("exit", (code, signal) => r({ code, signal })),
  );
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new Error(`no URLs within 15 s; stderr: ${err.slice(0, 300)}`)),
      15000,
    );
    const look = () => {
      const m =
        /^http:\/\/127\.0\.0\.1:(\d+)\/\nhttp:\/\/localhost:(\d+)\/$/m.exec(
          out,
        );
      if (m) {
        clearTimeout(timer);
        // The app host and the preview host share one port (REQ-108 criterion 4).
        if (m[1] === m[2] && Number(m[1]) > 0) resolve(Number(m[1]));
        else reject(new Error(`two ports: ${m[1]} and ${m[2]}`));
      }
    };
    child.stdout.on("data", look);
    child.on("exit", () => {
      clearTimeout(timer);
      reject(new Error(`exited before the URLs; stderr: ${err.slice(0, 300)}`));
    });
  });
  ready.catch(() => {});
  return { child, exited, ready, out: () => out, err: () => err };
}

/**
 * @param {number} port
 * @param {string} rawPath sent as it is
 * @param {{ host?: string, method?: string, headers?: Record<string, string>, body?: Buffer | string }} [o]
 * @returns {Promise<{ status: number, headers: http.IncomingHttpHeaders, body: Buffer }>}
 */
export function request(port, rawPath, o = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: rawPath,
        method: o.method ?? "GET",
        headers: { Host: o.host ?? `127.0.0.1:${port}`, ...o.headers },
        agent: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.setTimeout(10000, () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
    if (o.body !== undefined) req.write(o.body);
    req.end();
  });
}

/** @param {string} rel */
export const readApp = (rel) => fs.readFileSync(path.join(APP, rel));
/** @param {string} rel */
export const readRoot = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * The presence guard of a test folder (decisions/0118 О17): the names of `names` whose `<name>.test.js`
 * is not a file in `dir`. `node --test` over a folder without its files ends with exit 0 and «# tests 0».
 * @param {string} dir
 * @param {readonly string[]} names
 * @returns {string[]}
 */
export function missingTestFiles(dir, names) {
  return names.filter((n) => {
    try {
      return !fs.statSync(path.join(dir, `${n}.test.js`)).isFile();
    } catch {
      return true;
    }
  });
}

/**
 * Waits until `cond()` is true, polling every 10 ms, and fails after `ms` (a deadline, never a fixed
 * sleep).
 * @param {() => boolean} cond
 * @param {number} ms
 * @param {string} what
 */
export async function waitFor(cond, ms, what) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error(`waited ${ms} ms for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

/**
 * A TCP stand-in on 127.0.0.1:0 that accepts every connection, never answers and records the remote
 * port of each one. `barrier()` opens one probe connection of the test and waits until the stand-in has
 * accepted it, so every connection made before the call has been recorded too; it returns the probe's
 * port. Every socket and the server are closed in t.after.
 * @param {import("node:test").TestContext} t
 */
export async function standIn(t) {
  /** @type {number[]} */
  const seen = [];
  /** @type {Set<net.Socket>} */
  const socks = new Set();
  const server = net.createServer((s) => {
    s.on("error", () => {});
    socks.add(s);
    seen.push(s.remotePort ?? 0);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", () => r(null)));
  const port = /** @type {net.AddressInfo} */ (server.address()).port;
  t.after(() => {
    for (const s of socks) s.destroy();
    server.close();
  });
  const barrier = async () => {
    const probe = net.connect(port, "127.0.0.1");
    probe.on("error", () => {});
    socks.add(probe);
    await new Promise((r) => probe.once("connect", () => r(null)));
    const own = probe.localPort ?? 0;
    await waitFor(() => seen.includes(own), 5000, "the probe connection");
    return own;
  };
  return { port, seen, barrier };
}

/** @param {string} type @param {Buffer} body */
const pgFrame = (type, body) => {
  const b = Buffer.alloc(5 + body.length);
  b.write(type, 0, "latin1");
  b.writeInt32BE(4 + body.length, 1);
  body.copy(b, 5);
  return b;
};
/** @param {number} n */
const pgInt32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n);
  return b;
};
/** @param {number} n */
const pgInt16 = (n) => {
  const b = Buffer.alloc(2);
  b.writeInt16BE(n);
  return b;
};
/** @param {string} s */
const pgText = (s) => Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])]);
const pgReady = () => pgFrame("Z", Buffer.from("I"));

/**
 * @typedef {{ fields: Array<[string, number]>, rows: string[][] }} PgResult a result in the text
 * format: the column names with their type oids (16 bool, 25 text), and the rows
 */

/**
 * A Postgres stand-in on 127.0.0.1:0: the start of a session without a password and the simple query
 * protocol, as much as the pg client needs. `plan(n)` gives the n-th connection (from 1) its behaviour:
 * "answer" — every statement gets `answer(text)` (null gives an error answer), or "stall" — the session
 * starts and then no statement is ever answered, while the socket stays open (a database that went
 * silent). It records every statement with the number of its connection, and the connections the client
 * closed. Every socket and the server are closed in t.after.
 * @param {import("node:test").TestContext} t
 * @param {{ plan: (n: number) => "answer" | "stall", answer: (text: string) => PgResult | null }} o
 */
export async function pgStandIn(t, { plan, answer }) {
  /** @type {Array<[number, string]>} */
  const statements = [];
  /** @type {Set<number>} */
  const closed = new Set();
  /** @type {Set<net.Socket>} */
  const socks = new Set();
  let count = 0;
  /** @param {PgResult} r */
  const result = (r) =>
    Buffer.concat([
      pgFrame(
        "T",
        Buffer.concat([
          pgInt16(r.fields.length),
          ...r.fields.map(([name, oid]) =>
            Buffer.concat([
              pgText(name),
              pgInt32(0),
              pgInt16(0),
              pgInt32(oid),
              pgInt16(-1),
              pgInt32(-1),
              pgInt16(0),
            ]),
          ),
        ]),
      ),
      ...r.rows.map((row) =>
        pgFrame(
          "D",
          Buffer.concat([
            pgInt16(row.length),
            ...row.map((v) => {
              const b = Buffer.from(v, "utf8");
              return Buffer.concat([pgInt32(b.length), b]);
            }),
          ]),
        ),
      ),
      pgFrame("C", pgText(`SELECT ${r.rows.length}`)),
      pgReady(),
    ]);
  const failure = () =>
    Buffer.concat([
      pgFrame(
        "E",
        Buffer.concat([
          Buffer.from("S"),
          pgText("ERROR"),
          Buffer.from("C"),
          pgText("XX000"),
          Buffer.from("M"),
          pgText("the stand-in has no answer to this statement"),
          Buffer.from([0]),
        ]),
      ),
      pgReady(),
    ]);
  const server = net.createServer((s) => {
    const id = ++count;
    const mode = plan(id);
    socks.add(s);
    s.on("error", () => {});
    s.on("end", () => closed.add(id));
    let buf = Buffer.alloc(0);
    let started = false;
    s.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (!started) {
          // The startup message has no type byte: its length, then the protocol code.
          if (buf.length < 8) return;
          const len = buf.readInt32BE(0);
          if (buf.length < len) return;
          const code = buf.readInt32BE(4);
          buf = buf.subarray(len);
          // An SSL or GSS encryption request gets «N» (not supported), and the startup follows.
          if (code === 80877103 || code === 80877104) {
            s.write("N");
            continue;
          }
          started = true;
          s.write(
            Buffer.concat([
              pgFrame("R", pgInt32(0)),
              pgFrame("K", Buffer.concat([pgInt32(id), pgInt32(1)])),
              pgReady(),
            ]),
          );
          continue;
        }
        if (buf.length < 5) return;
        const type = String.fromCharCode(buf[0]);
        const len = buf.readInt32BE(1);
        if (buf.length < 1 + len) return;
        const body = buf.subarray(5, 1 + len);
        buf = buf.subarray(1 + len);
        if (type === "X") {
          closed.add(id);
          s.end();
          return;
        }
        if (type !== "Q") continue;
        const text = body.subarray(0, body.length - 1).toString("utf8");
        statements.push([id, text]);
        if (mode === "stall") continue;
        const r = answer(text);
        s.write(r ? result(r) : failure());
      }
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", () => r(null)));
  t.after(() => {
    for (const s of socks) s.destroy();
    server.close();
  });
  return {
    port: /** @type {net.AddressInfo} */ (server.address()).port,
    statements,
    closed,
  };
}
