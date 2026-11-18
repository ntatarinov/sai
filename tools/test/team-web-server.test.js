// REQ-011, criterion 1 (design REQ-011, sections 2, 3, 4.1 (1), 4.2, 4.3, 12):
// the command prints the link, the server listens on 127.0.0.1 only, a foreign
// Host gets a refusal without data; the files of the page, the headers, the key
// of the page; the refusals of the command (WEB-1a, WEB-1b, WEB-1c…WEB-1h).
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  BODY_IDLE_MS,
  BODY_MAX,
  DEFAULT_PORT,
  HOST,
  JSON_TYPE as CONFIG_JSON_TYPE,
  KEY_BYTES,
  KEY_HEADER,
} from "../src/web/config.js";
import { main } from "../src/web/main.js";
import {
  PublicFilesError,
  createWebServer,
  loadPublicFiles,
} from "../src/web/server.js";
import { readConfig } from "../src/team/config.js";
import { snapshot } from "./exec-helpers.js";
import {
  JSON_TYPE,
  NOT_FOUND_BODY,
  PUBLIC_DIR,
  fakeEngines,
  pageKey,
  project,
  publicFiles,
  accessKeyOfLine,
  request,
  spawnWeb,
  startServer,
  webSandbox,
  within,
} from "./team-web-helpers.js";

const USAGE =
  "Использование: npm run team-web [-- --port N] [--executor claude-cli|scripted --scenario <файл>]\n";
const LINK = /^Sai Team: http:\/\/127\.0\.0\.1:(\d+)\/\?k=[0-9a-f]{64}\n$/;

function io() {
  const out = [];
  const err = [];
  return {
    out: { write: (s) => out.push(String(s)) },
    err: { write: (s) => err.push(String(s)) },
    outText: () => out.join(""),
    errText: () => err.join(""),
  };
}

// Connecting to `address`:`port`: "connected" or the code of the refusal.
function tryConnect(address, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: address, port });
    socket.setTimeout(2000, () => {
      socket.destroy();
      resolve("timeout");
    });
    socket.on("connect", () => {
      socket.destroy();
      resolve("connected");
    });
    socket.on("error", (err) => resolve(err.code));
  });
}

function otherAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (!a.internal && a.family === "IPv4") out.push(a.address);
    }
  }
  return out;
}

test("WEB-1a the command prints exactly one line Sai Team: http://127.0.0.1:<port>/?k=<access key>; only 127.0.0.1 answers; ::1 and the other addresses of the computer refuse the connection; SIGTERM ends it with 0 and the start writes nothing", async (t) => {
  const box = webSandbox(t);
  // The data folder does not exist yet: the start must not make it.
  const home = path.join(box.sb.root, "not-yet");
  const env = { ...box.env, SAI_TEAM_HOME: home };
  const run = spawnWeb(t, ["--port", "0"], env);
  const line = await within(run.firstLine, 20_000, "the link");
  const m = LINK.exec(line ?? "");
  assert.ok(m !== null, `the line: ${JSON.stringify(line)} ${run.err()}`);
  accessKeyOfLine(line); // ISS-0122: the cookie of the link for request()
  const port = Number(m[1]);
  assert.ok(port > 0);
  const page = await request(port, { path: "/" });
  assert.equal(page.status, 200);
  const writeKey = /<meta name="sai-page" content="([0-9a-f]{64})"/.exec(
    page.text,
  )[1];
  const list = await request(port, { path: "/api/projects" });
  assert.deepStrictEqual(list.json, { projects: [] });
  assert.equal(await tryConnect("127.0.0.1", port), "connected");
  assert.notEqual(await tryConnect("::1", port), "connected", "::1");
  for (const a of otherAddresses()) {
    assert.notEqual(await tryConnect(a, port), "connected", a);
  }
  assert.equal(fs.existsSync(home), false, "the start made the data folder");
  run.child.kill("SIGTERM");
  const end = await within(run.done, 20_000, "the end");
  assert.equal(end.code, 0, end.stderr);
  assert.equal(end.stdout, line, "only the link goes to stdout");
  assert.equal(end.stderr, "");
  // ISS-0122: the one 64-hex value of the output is the access key of the link;
  // the key of the writes (the page key) is printed nowhere
  assert.deepEqual((end.stdout + end.stderr).match(/[0-9a-f]{64}/g), [
    accessKeyOfLine(line),
  ]);
  assert.equal((end.stdout + end.stderr).includes(writeKey), false, "no key");
});

test("WEB-1a the server object binds 127.0.0.1 (HOST of config.js) and its port; the constants of section 3", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  assert.equal(HOST, "127.0.0.1");
  assert.equal(DEFAULT_PORT, 4781);
  assert.equal(BODY_MAX, 65_536);
  assert.equal(BODY_IDLE_MS, 15_000);
  assert.equal(KEY_HEADER, "x-sai-page");
  assert.equal(KEY_BYTES, 32);
  assert.equal(CONFIG_JSON_TYPE, JSON_TYPE);
  assert.equal(s.server.port(), s.port);
  assert.equal(await tryConnect("127.0.0.1", s.port), "connected");
  assert.notEqual(await tryConnect("::1", s.port), "connected");
  await s.close();
  assert.notEqual(await tryConnect("127.0.0.1", s.port), "connected");
});

test("WEB-1b a Host other than 127.0.0.1:<port> or localhost:<port> gets 403 «Запрос отклонён» without the data of a project, for GET and POST, before anything is read", async (t) => {
  const box = webSandbox(t);
  const goal = "Цель фикстуры: открыть вымышленную пекарню";
  const p = project(t, box, { goal });
  const s = await startServer(t, box);
  const before = snapshot(box.home);
  const paths = [
    "/",
    "/app.js",
    "/api/projects",
    `/api/projects/${p.id}`,
    `/api/projects/${p.id}/chat`,
  ];
  const hosts = [
    `example.test:${s.port}`,
    `127.0.0.1:${s.port + 1}`,
    `localhost:${s.port + 1}`,
    "127.0.0.1",
    "localhost",
    `127.0.0.2:${s.port}`,
    `[::1]:${s.port}`,
    `0.0.0.0:${s.port}`,
    `127.0.0.1:${s.port}.evil.test`,
    `LOCALHOST:${s.port}`,
    "",
  ];
  for (const host of hosts) {
    for (const pth of paths) {
      const r = await s.request({ path: pth, headers: { Host: host } });
      assert.equal(r.status, 403, `${host} ${pth}`);
      assert.deepStrictEqual(r.json, {
        error_text: "Запрос отклонён",
        field: null,
        reload: false,
      });
      assert.equal(r.headers["content-type"], JSON_TYPE);
      assert.ok(!r.text.includes(goal));
      assert.ok(!r.text.includes(p.id));
    }
    const key = await s.key();
    const w = await s.post(
      "/api/projects",
      { goal: "Новая", budget_usd: 1 },
      { key, headers: { Host: host } },
    );
    assert.equal(w.status, 403, `${host} POST`);
    assert.equal(w.json.error_text, "Запрос отклонён");
  }
  // Without Host at all Node itself refuses an HTTP/1.1 request (400), before the
  // handler: no data either.
  const none = await s.request({
    path: `/api/projects/${p.id}`,
    headers: { Host: undefined },
  });
  assert.ok(none.status === 400 || none.status === 403, String(none.status));
  assert.ok(!none.text.includes(goal));
  assert.deepStrictEqual(snapshot(box.home), before);
  // The two allowed forms answer.
  for (const host of [`127.0.0.1:${s.port}`, `localhost:${s.port}`]) {
    const r = await s.request({
      path: `/api/projects/${p.id}`,
      headers: { Host: host },
    });
    assert.equal(r.status, 200, host);
    assert.equal(r.json.goal, goal);
  }
});

test("WEB-1c the files of the page: the types of STATIC_TYPES, CSP and frame refusal for HTML, the common headers everywhere, no Access-Control-*; unknown names and nested paths are «not found»", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  const expect = {
    "/": "text/html; charset=utf-8",
    "/index.html": "text/html; charset=utf-8",
    "/app.js": "text/javascript; charset=utf-8",
    "/style.css": "text/css; charset=utf-8",
  };
  for (const [p, type] of Object.entries(expect)) {
    const r = await s.get(p);
    assert.equal(r.status, 200, p);
    assert.equal(r.headers["content-type"], type, p);
    assert.equal(r.headers["cache-control"], "no-store");
    assert.equal(r.headers["x-content-type-options"], "nosniff");
    assert.equal(r.headers["referrer-policy"], "no-referrer");
    if (type.startsWith("text/html")) {
      assert.equal(
        r.headers["content-security-policy"],
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
      );
      assert.equal(r.headers["x-frame-options"], "DENY");
    } else {
      assert.equal(r.headers["content-security-policy"], undefined);
      const file = fs.readFileSync(path.join(PUBLIC_DIR, p.slice(1)));
      assert.ok(Buffer.from(r.text, "utf8").equals(file), p);
    }
    for (const h of Object.keys(r.headers)) {
      assert.ok(!h.startsWith("access-control-"), h);
    }
  }
  for (const p of [
    "/nope.js",
    "/.hidden.js",
    "/app.js/x",
    "/public/app.js",
    "/../package.json",
    "/%2E%2E%2Fpackage.json",
    "/main.js",
    "/api",
    "/api/",
    "/api/project",
    "/api/projects/",
    "/%E0%A4%A",
  ]) {
    const r = await s.get(p);
    assert.equal(r.status, 404, p);
    assert.equal(r.text, NOT_FOUND_BODY, p);
    assert.equal(r.headers["content-type"], JSON_TYPE, p);
  }
});

test("WEB-1d a method not of the table: 405 with Allow and the text of a request not understood; OPTIONS has no Access-Control-*", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  const s = await startServer(t, box);
  const cases = [
    ["POST", "/", "GET"],
    ["PUT", "/app.js", "GET"],
    ["OPTIONS", "/api/projects", "GET, POST"],
    ["DELETE", "/api/projects", "GET, POST"],
    ["PUT", `/api/projects/${p.id}`, "GET"],
    ["PATCH", `/api/projects/${p.id}/chat`, "GET, POST"],
    ["POST", `/api/projects/${p.id}`, "GET"],
    ["POST", `/api/projects/${p.id}/tasks/t-0001`, "GET"],
    ["POST", `/api/projects/${p.id}/roles/1`, "GET"],
  ];
  for (const [method, pth, allow] of cases) {
    const r = await s.request({ method, path: pth });
    assert.equal(r.status, 405, `${method} ${pth}`);
    assert.equal(r.headers.allow, allow, `${method} ${pth}`);
    assert.deepStrictEqual(r.json, {
      error_text: "Запрос не понят. Обновите страницу",
      field: null,
      reload: false,
    });
    assert.equal(r.headers["content-type"], JSON_TYPE);
    for (const h of Object.keys(r.headers)) {
      assert.ok(!h.startsWith("access-control-"), h);
    }
  }
});

test("WEB-1e the key of the page: 64 hex in the one marker of GET /, a new key for every start, never in an API answer or in a refusal", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  const a = await startServer(t, box);
  const b = await startServer(t, box);
  const ka = await pageKey(a.port);
  const kb = await pageKey(b.port);
  assert.match(ka, /^[0-9a-f]{64}$/);
  assert.notEqual(ka, kb);
  assert.equal(await pageKey(a.port), ka, "the same start keeps its key");
  const page = await a.get("/");
  assert.equal(page.text.match(/name="sai-page"/g).length, 1);
  assert.ok(page.text.includes(`<meta name="sai-page" content="${ka}" />`));
  assert.equal(/token/i.test(page.text), false);
  const answers = [
    await a.get("/api/projects"),
    await a.get(`/api/projects/${p.id}`),
    await a.get(`/api/projects/${p.id}/chat`),
    await a.get("/api/projects/p-20990101-a1b2c3"),
    await a.post("/api/projects", { goal: "", budget_usd: 1 }, { key: ka }),
    await a.post("/api/projects", { goal: "x", budget_usd: 1 }, { key: kb }),
    await a.post("/api/projects", "{", { key: ka }),
  ];
  for (const r of answers) {
    assert.ok(!r.text.includes(ka));
    assert.ok(!r.text.includes(kb));
    assert.ok(!JSON.stringify(r.headers).includes(ka));
  }
  assert.ok(!a.warnings.join("\n").includes(ka));
});

test("WEB-1f loadPublicFiles: the marker of the key exactly once (both forms of section 4.3); none or two — a refusal; only regular files with a name of STATIC_NAME and a known extension; a link is not followed", (t) => {
  const box = webSandbox(t);
  const dir = path.join(box.sb.root, "pub");
  fs.mkdirSync(dir);
  const write = (name, text) => fs.writeFileSync(path.join(dir, name), text);
  write("index.html", '<meta name="sai-page" content="">');
  write("app.js", "x");
  write("notes.txt", "x");
  write(".hidden.js", "x");
  fs.symlinkSync(
    path.join(PUBLIC_DIR, "style.css"),
    path.join(dir, "style.css"),
  );
  const files = loadPublicFiles(dir);
  assert.deepStrictEqual([...files.keys()].sort(), ["app.js", "index.html"]);
  write("index.html", '<meta name="sai-page" content="" />');
  assert.ok(loadPublicFiles(dir).has("index.html"));
  for (const bad of [
    "<p>нет метки</p>",
    '<meta name="sai-page" content=""><meta name="sai-page" content="" />',
    '<meta name="sai-page" content="x" />',
  ]) {
    write("index.html", bad);
    assert.throws(() => loadPublicFiles(dir), PublicFilesError, bad);
  }
  fs.rmSync(path.join(dir, "index.html"));
  assert.throws(() => loadPublicFiles(dir), PublicFilesError);
  assert.throws(
    () => loadPublicFiles(path.join(dir, "missing")),
    PublicFilesError,
  );
  // The real files of the page pass.
  const real = loadPublicFiles(PUBLIC_DIR);
  assert.ok(real.has("index.html") && real.has("app.js"));
  assert.ok(real.has("style.css"));
});

test("WEB-1g the parameters of the command: every wrong form ends with 2 and exactly the line of usage; the scenario missing or wrong — 1; a home that is not absolute — 2 with one line; nothing is written", async (t) => {
  const box = webSandbox(t);
  const before = snapshot(box.home);
  const bad = [
    ["--bogus", "1"],
    ["--port"],
    ["--port", "1", "--port", "2"],
    ["--port", "70000"],
    ["--port", "-1"],
    ["--port", "12a"],
    ["--port", ""],
    ["--port", "123456"],
    ["--executor", "other"],
    ["--executor", "scripted"],
    ["--scenario", "x.json"],
    ["--executor", "claude-cli", "--scenario", "x.json"],
    ["port", "1"],
  ];
  for (const argv of bad) {
    const o = io();
    const code = await main(argv, box.env, o);
    assert.equal(code, 2, argv.join(" "));
    assert.equal(o.errText(), USAGE, argv.join(" "));
    assert.equal(o.outText(), "");
  }
  const scen = path.join(box.sb.root, "scenario.json");
  for (const text of [null, "{", '{"version":1}', "[]"]) {
    if (text === null) fs.rmSync(scen, { force: true });
    else fs.writeFileSync(scen, text);
    const o = io();
    const code = await main(
      ["--executor", "scripted", "--scenario", scen],
      box.env,
      o,
    );
    assert.equal(code, 1, String(text));
    assert.equal(o.errText(), "Файл сценария не найден или неверен\n");
  }
  const o = io();
  const code = await main([], { ...box.env, SAI_TEAM_HOME: "relative/dir" }, o);
  assert.equal(code, 2);
  assert.equal(o.errText().split("\n").length, 2, o.errText());
  assert.doesNotMatch(o.errText(), /\n\s+at /);
  assert.deepStrictEqual(snapshot(box.home), before);
});

test("WEB-1h a busy port: the command ends with 1 and the line «Порт N занят…»; nothing is written", async (t) => {
  const box = webSandbox(t);
  const holder = http.createServer();
  await new Promise((r) => holder.listen(0, "127.0.0.1", r));
  t.after(() => holder.close());
  const port = holder.address().port;
  const before = snapshot(box.home);
  const run = spawnWeb(t, ["--port", String(port)], box.env);
  const end = await within(run.done, 20_000, "the end");
  assert.equal(end.code, 1, end.stderr);
  assert.equal(
    end.stderr,
    `Порт ${port} занят. Запустите с другим: npm run team-web -- --port <номер>\n`,
  );
  assert.equal(end.stdout, "");
  assert.deepStrictEqual(snapshot(box.home), before);
});

test("WEB-1h listen refuses with another code of the system: the promise rejects with that code and the server does not answer", async (t) => {
  const box = webSandbox(t);
  // The port is taken by a plain server: the bind refuses (EADDRINUSE).
  const holder = http.createServer();
  await new Promise((r) => holder.listen(0, "127.0.0.1", r));
  t.after(() => holder.close());
  const server = createWebServer({
    home: box.home,
    env: box.env,
    config: readConfig(box.env),
    executor: "claude-cli",
    scenarioBytes: null,
    port: holder.address().port,
    publicFiles: publicFiles(),
    engines: fakeEngines(),
    warn: () => {},
  });
  // closed in any case: a server that did bind must not keep the process alive
  t.after(() => server.close());
  await assert.rejects(server.listen(), (err) => err.code === "EADDRINUSE");
  assert.equal(server.port(), null);
  await server.close();
});

// ---- ISS-0122: the page and the reads only with the access key ------------------------

test("ISS-0122 without the access cookie the page is a short 401 text with no key of the writes, every read of data is 401; a wrong cookie too; the files of the page stay open", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  for (const headers of [
    {},
    { Cookie: `sai_team_web=${"0".repeat(64)}` },
    { Cookie: `other=${s.accessKey()}` },
  ]) {
    const page = await s.get("/", headers, { access: false });
    assert.equal(page.status, 401, JSON.stringify(headers));
    assert.doesNotMatch(page.text, /[0-9a-f]{64}/u);
    assert.match(page.text, /npm run team-web/u);
    assert.ok(page.headers["content-security-policy"]);
    const list = await s.get("/api/projects", headers, { access: false });
    assert.equal(list.status, 401);
    assert.match(list.json.error_text, /Нет доступа/u);
  }
  assert.equal((await s.get("/app.js", {}, { access: false })).status, 200);
  assert.equal((await s.get("/style.css", {}, { access: false })).status, 200);
  const ok = await s.get("/api/projects");
  assert.equal(ok.status, 200);
});

test("ISS-0122 the link /?k=<access key> answers 303 to / with an HttpOnly SameSite=Strict cookie; a wrong k sets nothing; the access key is not the key of the writes", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  const r = await s.get(`/?k=${s.accessKey()}`, {}, { access: false });
  assert.equal(r.status, 303);
  assert.equal(r.headers.location, "/");
  const cookie = r.headers["set-cookie"][0];
  assert.ok(cookie.startsWith(`sai_team_web=${s.accessKey()};`), cookie);
  for (const part of ["HttpOnly", "SameSite=Strict", "Path=/"]) {
    assert.ok(cookie.includes(part), part);
  }
  const bad = await s.get(`/?k=${"0".repeat(64)}`, {}, { access: false });
  assert.equal(bad.status, 401);
  assert.equal(bad.headers["set-cookie"], undefined);
  assert.notEqual(await s.key(), s.accessKey());
});
