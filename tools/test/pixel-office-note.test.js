// SV (command): `pixel-office-note` (design REQ-008, section 6; criteria 5, 6,
// 8, 17, 19). The command runs in this process through main() with its own
// output streams, or as a child process where the process environment matters
// (proxy variables). Servers run on port 0 in temporary folders; the real
// state directory and port 4780 are never used.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { test } from "node:test";
import { main } from "../src/pixel-office/note.js";
import { signBody } from "../src/pixel-office/protocol.js";
import {
  SRC,
  T0,
  childEnv,
  iso,
  prepareState,
  sandbox,
  sha256OrNone,
  startServer,
  writeBody,
} from "./pixel-office-helpers.js";

const fixedNow = () => T0;
const NOTE_JS = path.join(SRC, "note.js");

const ownerLine = (session, offsetSec) =>
  writeBody("UserPromptSubmit", session, iso(T0 + offsetSec * 1000), {
    prompt_kind: "owner",
    prompt_text: "сделай X",
  });

// Runs main() against a state directory; records every request it makes.
async function runNote(box, argv, o = {}) {
  const out = { stdout: "", stderr: "" };
  const requests = [];
  const spy = (options, callback) => {
    const record = { options, body: null };
    requests.push(record);
    const req = http.request(options, callback);
    const end = req.end.bind(req);
    req.end = (payload, ...rest) => {
      record.body = payload;
      return end(payload, ...rest);
    };
    return req;
  };
  const started = performance.now();
  const code = await main(argv, {
    env: o.env ?? childEnv(box),
    home: box.home,
    stdout: { write: (s) => (out.stdout += s) },
    stderr: { write: (s) => (out.stderr += s) },
    httpRequest: spy,
  });
  return { code, ...out, requests, ms: performance.now() - started };
}

async function serverWithOwner(t, o = {}) {
  const srv = await startServer(t, { now: fixedNow, ...o });
  const r = await srv.post(ownerLine("s-demo", -5));
  assert.equal(r.status, 204);
  return srv;
}

const lastLine = (srv) => JSON.parse(srv.lines().at(-1));

test(
  "SV-58: --text and --req (no --session) send exactly one signed POST to /api/note and none to /api/events; the line has the keys of the criterion and no session_id; with --session the same plus session_id; wrong forms give code 2 and no request",
  { timeout: 30000 },
  async (t) => {
    const srv = await serverWithOwner(t);
    const before = srv.lines().length;
    const r = await runNote(srv.box, [
      "--text",
      "текст понимания",
      "--req",
      "REQ-008",
    ]);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.requests.length, 1);
    assert.equal(r.requests[0].options.path, "/api/note");
    assert.equal(r.requests[0].options.method, "POST");
    assert.equal(r.requests[0].options.host, "127.0.0.1");
    assert.equal(
      r.requests.some((q) => q.options.path === "/api/events"),
      false,
    );
    assert.deepEqual(Object.keys(JSON.parse(r.requests[0].body)).sort(), [
      "note_text",
      "req_id",
    ]);
    assert.equal(
      r.requests[0].options.headers["x-pixel-office-signature"],
      signBody(srv.secret, r.requests[0].body),
    );
    assert.match(r.stdout, /записано; привязано к сообщению владельца/);
    assert.equal(srv.lines().length, before + 1);
    const line = lastLine(srv);
    assert.deepEqual(Object.keys(line).sort(), [
      "note_text",
      "req_id",
      "request_time",
      "request_time_auto",
      "source",
      "time",
    ]);
    assert.equal(line.source, "ORCH");
    assert.equal(line.note_text, "текст понимания");
    assert.equal(line.req_id, "REQ-008");
    assert.equal(line.time, iso(T0));
    assert.equal(line.request_time, iso(T0 - 5000));
    assert.equal(line.request_time_auto, true);

    const withSession = await runNote(srv.box, [
      "--text",
      "с сессией",
      "--session",
      "s-demo",
    ]);
    assert.equal(withSession.code, 0, withSession.stderr);
    assert.equal(lastLine(srv).session_id, "s-demo");
    assert.deepEqual(Object.keys(lastLine(srv)).sort(), [
      "note_text",
      "request_time",
      "request_time_auto",
      "session_id",
      "source",
      "time",
    ]);
    assert.equal(JSON.parse(withSession.requests[0].body).session_id, "s-demo");

    // An explicit --request-time: kept, not marked automatic.
    const explicit = iso(T0 - 9000);
    const t3 = await runNote(srv.box, [
      "--text",
      "время",
      "--request-time",
      explicit,
    ]);
    assert.equal(t3.code, 0);
    assert.equal(t3.stdout.trim(), "записано");
    assert.equal(Object.hasOwn(lastLine(srv), "request_time_auto"), false);

    // A text beginning with "-" is the value of --text.
    const dash = await runNote(srv.box, ["--text", "--не опция"]);
    assert.equal(dash.code, 0, dash.stderr);
    assert.equal(lastLine(srv).note_text, "--не опция");

    // Wrong forms: code 2, no request, journal unchanged.
    const sha = srv.sha();
    const count = srv.lines().length;
    const wrong = [
      ["позиционный текст"],
      ["--text"],
      ["--text", "а", "--text", "б"],
      ["--req", "REQ-008"],
      [],
      ["--text", "а", "позиционный"],
      ["--text", ""],
      ["--text", "   "],
      ["--text", "а".repeat(2001)],
      ["--text", "а", "--req", "REQ-8"],
      ["--text", "а", "--req", "../x"],
      ["--text", "а", "--request-time", "вчера"],
      ["--text", "а", "--session", ""],
      ["--text", "а", "--session", "s".repeat(201)],
      ["--text", "token=x ".repeat(250)],
    ];
    for (const argv of wrong) {
      const w = await runNote(srv.box, argv);
      assert.equal(w.code, 2, JSON.stringify(argv).slice(0, 80));
      assert.equal(w.requests.length, 0, JSON.stringify(argv).slice(0, 80));
      assert.equal(w.stdout, "");
      assert.match(w.stderr, /--help/);
    }
    assert.equal(srv.sha(), sha);
    assert.equal(srv.lines().length, count);
  },
);

test("SV-59: --help prints the usage and exits 0 with nothing else; --secret and other unknown options give code 2 and no write; the secret is never printed", async (t) => {
  const srv = await serverWithOwner(t);
  const sha = srv.sha();
  for (const flag of ["--help", "-h"]) {
    const r = await runNote(srv.box, [flag]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /--text/);
    assert.equal(r.stderr, "");
    assert.equal(r.requests.length, 0);
    assert.equal(
      /--secret/.test(r.stdout),
      false,
      "no parameter for the secret",
    );
    assert.equal(r.stdout.includes(srv.secret), false);
  }
  for (const argv of [
    ["--text", "а", "--secret", "x"],
    ["--text", "а", "--secret", srv.secret],
    ["--text", "а", `--secret=${srv.secret}`],
    ["--secret", srv.secret, "--text", "а"],
  ]) {
    const r = await runNote(srv.box, argv);
    assert.notEqual(r.code, 0);
    assert.equal(r.requests.length, 0);
    assert.equal(r.stdout.includes(srv.secret), false);
    assert.equal(r.stderr.includes(srv.secret), false);
  }
  // The secret is not taken from the environment either.
  const env = childEnv(srv.box, {
    SAI_PIXEL_OFFICE_SECRET: "чужой",
    SECRET: "чужой",
  });
  const viaEnv = await runNote(srv.box, ["--text", "а"], { env });
  assert.equal(viaEnv.code, 0, viaEnv.stderr);
  assert.equal(viaEnv.stdout.includes(srv.secret), false);
  assert.equal(viaEnv.stderr.includes(srv.secret), false);
  assert.equal(srv.lines().length, 2);
  assert.notEqual(srv.sha(), sha);
});

test(
  "SV-62: with the server stopped the command exits 1 with 'сервер не запущен', does not create the state directory and does not change the journal",
  { timeout: 30000 },
  async (t) => {
    // No state directory at all.
    const box = sandbox(t);
    const none = await runNote(box, ["--text", "а"]);
    assert.equal(none.code, 1);
    assert.match(none.stderr, /сервер не запущен/);
    assert.equal(none.stdout, "");
    assert.equal(fs.existsSync(box.dir), false, "the directory was created");
    assert.equal(none.requests.length, 0);
    // A secret but no port file.
    const box2 = sandbox(t);
    prepareState(box2);
    const noPort = await runNote(box2, ["--text", "а"]);
    assert.equal(noPort.code, 1);
    assert.match(noPort.stderr, /сервер не запущен/);
    assert.equal(sha256OrNone(path.join(box2.dir, "events.jsonl")), "none");
    // A port nobody listens on.
    const s = net.createServer();
    await new Promise((r) => s.listen(0, "127.0.0.1", r));
    const { port } = s.address();
    await new Promise((r) => s.close(r));
    fs.writeFileSync(path.join(box2.dir, "port"), `${port}\n`);
    const names = fs.readdirSync(box2.dir).sort();
    const refused = await runNote(box2, ["--text", "а"]);
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /сервер не запущен/);
    assert.equal(sha256OrNone(path.join(box2.dir, "events.jsonl")), "none");
    assert.deepEqual(
      fs.readdirSync(box2.dir).sort(),
      names,
      "a file was created",
    );
  },
);

test("SV-64 (command): with SAI_PIXEL_OFFICE_STORE_TEXT=0 the command exits 0, says 'хранение текста отключено' on stderr, sends nothing and the journal does not change", async (t) => {
  const srv = await serverWithOwner(t);
  const sha = srv.sha();
  for (const value of ["0", "yes", "false"]) {
    const env = childEnv(srv.box, { SAI_PIXEL_OFFICE_STORE_TEXT: value });
    const r = await runNote(srv.box, ["--text", "а"], { env });
    assert.equal(r.code, 0, value);
    assert.match(r.stderr, /хранение текста отключено/);
    assert.equal(r.stdout, "");
    assert.equal(r.requests.length, 0);
  }
  assert.equal(srv.sha(), sha);
  // On: absent, empty, 1.
  for (const value of ["", "1"]) {
    const env = childEnv(srv.box, { SAI_PIXEL_OFFICE_STORE_TEXT: value });
    const r = await runNote(srv.box, ["--text", "а"], { env });
    assert.equal(r.code, 0, value);
    assert.equal(r.requests.length, 1);
  }
  // Storage off at the server only: 400 text_storage_off -> code 1.
  const off = await startServer(t, { now: fixedNow, storeText: false });
  const shaOff = off.sha();
  const r = await runNote(off.box, ["--text", "а"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /хранение текста на сервере отключено/);
  assert.equal(off.sha(), shaOff);
});

test(
  "SV-68: a silent server - code 1 within 3.5 s with 'сервер не ответил за 3 с'; a closed port - code 1 within 3.5 s; in no case the secret, note_text or the signature is printed",
  { timeout: 20000 },
  async (t) => {
    const box = sandbox(t);
    const secret = prepareState(box);
    const needle = "уникальный-текст-68";
    // Nothing of the secret, the text or the signature in the output of a case.
    const noLeak = (r, label) => {
      const hidden = [secret, needle];
      for (const q of r.requests) {
        hidden.push(q.options.headers["x-pixel-office-signature"]);
        if (q.body !== null) hidden.push(String(q.body));
      }
      for (const h of hidden) {
        assert.ok(typeof h === "string" && h.length > 0, label);
        assert.equal((r.stdout + r.stderr).includes(h), false, label);
      }
      assert.equal(r.stdout, "", label);
    };
    const sockets = new Set();
    const silent = net.createServer((s) => sockets.add(s));
    await new Promise((r) => silent.listen(0, "127.0.0.1", r));
    t.after(() => {
      for (const s of sockets) s.destroy();
      silent.close();
    });
    fs.writeFileSync(path.join(box.dir, "port"), `${silent.address().port}\n`);
    const r = await runNote(box, ["--text", needle]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /сервер не ответил за 3 с/);
    assert.equal(r.requests.length, 1);
    noLeak(r, "silent server");
    assert.ok(r.ms >= 2500 && r.ms <= 3500, `took ${r.ms} ms`);
    assert.equal(r.stdout, "");
    // A server that answers the head and stops: the same limit for the answer.
    const slow = http.createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.write("{");
    });
    await new Promise((resolve) => slow.listen(0, "127.0.0.1", resolve));
    t.after(() => {
      slow.closeAllConnections();
      slow.close();
    });
    fs.writeFileSync(path.join(box.dir, "port"), `${slow.address().port}\n`);
    const r2 = await runNote(box, ["--text", needle]);
    assert.equal(r2.code, 1);
    assert.ok(r2.ms <= 3500, `took ${r2.ms} ms`);
    assert.equal(r2.requests.length, 1);
    noLeak(r2, "head and silence");
    // A closed port.
    const probe = net.createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const { port } = probe.address();
    await new Promise((resolve) => probe.close(resolve));
    fs.writeFileSync(path.join(box.dir, "port"), `${port}\n`);
    const r3 = await runNote(box, ["--text", needle]);
    assert.equal(r3.code, 1);
    assert.ok(r3.ms <= 3500, `took ${r3.ms} ms`);
    assert.match(r3.stderr, /сервер не запущен/);
    noLeak(r3, "closed port");
  },
);

test(
  "SV-69: answers of a fake server - 401, 403, 413, 500, 400, 204, 200 - give their own reasons; the secret, the signature, the body and note_text are never printed; 200 from /api/note is the only code 0",
  { timeout: 30000 },
  async (t) => {
    const box = sandbox(t);
    const secret = prepareState(box);
    const needle = "уникальная-подстрока-69";
    let answer = { status: 200, body: "" };
    const seen = [];
    const fake = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        seen.push({
          url: req.url,
          signature: req.headers["x-pixel-office-signature"],
          body: Buffer.concat(chunks).toString("utf8"),
        });
        res.writeHead(answer.status, { "content-type": "application/json" });
        res.end(answer.body);
      });
    });
    await new Promise((r) => fake.listen(0, "127.0.0.1", r));
    t.after(() => {
      fake.closeAllConnections();
      fake.close();
    });
    fs.writeFileSync(path.join(box.dir, "port"), `${fake.address().port}\n`);
    const auto = (time) =>
      JSON.stringify({ request_time: time, request_time_auto: true });
    const cases = [
      [401, "", 1, /подпись не принята/],
      [403, "", 1, /адрес отклонён/],
      [413, "", 1, /запись слишком велика/],
      [500, `{"error":"${needle}"}`, 1, /ошибка сервера/],
      [
        400,
        '{"error":"bad_value:req_id"}',
        1,
        /запись отклонена: bad_value:req_id/,
      ],
      [400, `{"error":"<b>${needle}</b>"}`, 1, /запись отклонена: \?/],
      [400, "not json", 1, /запись отклонена: \?/],
      [
        400,
        '{"error":"text_storage_off"}',
        1,
        /хранение текста на сервере отключено/,
      ],
      [204, "", 1, /неожиданный ответ сервера 204/],
      [301, "", 1, /неожиданный ответ сервера 301/],
      [200, "not json", 1, /неожиданный ответ сервера 200/],
      [
        200,
        JSON.stringify({ request_time: null, request_time_auto: false }),
        0,
        null,
      ],
      [200, auto(iso(T0)), 0, null],
      [
        200,
        JSON.stringify({ request_time: iso(T0), request_time_auto: false }),
        0,
        null,
      ],
    ];
    const sha = sha256OrNone(path.join(box.dir, "events.jsonl"));
    for (const [status, body, code, pattern] of cases) {
      answer = { status, body };
      const r = await runNote(box, [
        "--text",
        `текст ${needle}`,
        "--req",
        "REQ-008",
      ]);
      assert.equal(r.code, code, `${status} ${body}`);
      if (pattern !== null) assert.match(r.stderr, pattern, `${status}`);
      const sent = seen.at(-1);
      assert.equal(sent.url, "/api/note");
      const printed = r.stdout + r.stderr;
      for (const hidden of [secret, sent.signature, sent.body, needle]) {
        assert.equal(printed.includes(hidden), false, `${status}: ${hidden}`);
      }
      if (code === 1) assert.equal(r.stdout, "");
    }
    assert.equal(sha256OrNone(path.join(box.dir, "events.jsonl")), sha);
    const zero = cases.filter((c) => c[2] === 0).map((c) => c[0]);
    assert.deepEqual([...new Set(zero)], [200]);
  },
);

test(
  "SV-70: --host, --port, --url, --dir give code 2 and no request; a bad port file gives code 1 without a request; the address is not changed by the environment; a proxy in the environment gets no connection",
  { timeout: 30000 },
  async (t) => {
    const srv = await serverWithOwner(t);
    for (const argv of [
      ["--text", "а", "--host", "evil.example"],
      ["--text", "а", "--port", "1"],
      ["--text", "а", "--url", "http://evil.example/"],
      ["--text", "а", "--dir", "/tmp"],
      ["--text", "а", "--port=4780"],
    ]) {
      const r = await runNote(srv.box, argv);
      assert.notEqual(r.code, 0, argv.join(" "));
      assert.equal(r.requests.length, 0);
      assert.equal(r.stdout.includes("evil.example"), false);
    }
    // Wrong port files: code 1, nothing sent.
    const box = sandbox(t);
    prepareState(box);
    for (const content of [
      "abc\n",
      "0\n",
      "70000\n",
      "-5\n",
      "12 34\n",
      "\n",
      "1e3\n",
    ]) {
      fs.writeFileSync(path.join(box.dir, "port"), content);
      const r = await runNote(box, ["--text", "а"]);
      assert.equal(r.code, 1, JSON.stringify(content));
      assert.equal(r.requests.length, 0, JSON.stringify(content));
    }
    // Variables that look like an address change nothing: the port file rules.
    const env = childEnv(srv.box, {
      HOST: "evil.example",
      PORT: "1",
      HTTP_PROXY: "http://127.0.0.1:1",
      SAI_PIXEL_OFFICE_HOST: "evil.example",
      SAI_PIXEL_OFFICE_PORT: "1",
    });
    const viaEnv = await runNote(srv.box, ["--text", "через окружение"], {
      env,
    });
    assert.equal(viaEnv.code, 0, viaEnv.stderr);
    assert.equal(viaEnv.requests[0].options.host, "127.0.0.1");
    assert.equal(viaEnv.requests[0].options.port, srv.port);

    // A real child process with proxy variables: the proxy gets nothing.
    let connections = 0;
    const proxy = net.createServer((s) => {
      connections += 1;
      s.destroy();
    });
    await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
    t.after(() => proxy.close());
    const url = `http://127.0.0.1:${proxy.address().port}`;
    const before = srv.lines().length;
    for (const extra of [
      { NODE_USE_ENV_PROXY: "1", HTTP_PROXY: url, http_proxy: url },
      { NODE_OPTIONS: "--use-env-proxy", HTTP_PROXY: url, http_proxy: url },
    ]) {
      const result = await new Promise((resolve) => {
        const child = spawn(
          process.execPath,
          [NOTE_JS, "--text", "через прокси"],
          {
            env: childEnv(srv.box, extra),
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let stderr = "";
        child.stderr.on("data", (d) => (stderr += d));
        child.stdout.on("data", () => {});
        child.on("close", (code) => resolve({ code, stderr }));
      });
      assert.equal(result.code, 0, result.stderr);
    }
    assert.equal(
      srv.lines().length,
      before + 2,
      "both notes reached the server",
    );
    assert.equal(connections, 0, "the proxy got a connection");

    // The source has no address of its own but 127.0.0.1 (design 6).
    const source = fs.readFileSync(NOTE_JS, "utf8").split("\n");
    const banned = /https?:\/\/[^1l]|0[.]0[.]0[.]0|localhost/;
    assert.deepEqual(
      source.filter((l) => banned.test(l)),
      [],
    );
  },
);
