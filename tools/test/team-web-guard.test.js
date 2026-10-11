// REQ-011, criterion 9 (design REQ-011, sections 4, 11): a write (a new project, a
// message of the chat) from a foreign Origin, without Origin, without the key or
// with a wrong one, or with a wrong type of the body is refused and changes
// nothing; a path, id, task or role that is not there is one and the same «not
// found»; a secret in the chat is masked; the server writes no file itself; every
// answer has the JSON type and nosniff (WEB-9a…WEB-9g).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { journal, sha256 } from "./exec-helpers.js";
import { holdWriter } from "./team-helpers.js";
import {
  JSON_TYPE,
  NOT_FOUND_BODY,
  WEB_SRC,
  dirs,
  fakeEngines,
  planTask,
  project,
  request,
  snapshot,
  startServer,
  webSandbox,
  withPlan,
} from "./team-web-helpers.js";

const REFUSED = {
  error_text: "Запрос отклонён: действие доступно только со страницы Sai Team",
  field: null,
  reload: false,
};
const STALE = {
  error_text:
    "Sai Team был перезапущен, и эта страница устарела. Обновите страницу и повторите — текст в поле пропадёт, скопируйте его, если он нужен",
  field: null,
  reload: true,
};

function rawPost(s, pth, headers, body) {
  return request(s.port, { method: "POST", path: pth, headers, body });
}

async function fixture(t) {
  const box = webSandbox(t);
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  p.w.close();
  const engines = fakeEngines();
  const s = await startServer(t, box, { engines });
  const key = await s.key();
  return { box, p, s, key, engines };
}

test("WEB-9a a write from a foreign Origin, without Origin, without the key, with a key of a wrong form or with a wrong type: 403, the journal and the folders unchanged, no start", async (t) => {
  const { box, p, s, key, engines } = await fixture(t);
  const own = `http://127.0.0.1:${s.port}`;
  const good = {
    Origin: own,
    "Content-Type": "application/json",
    "X-Sai-Page": key,
  };
  const bad = [
    { ...good, Origin: "http://evil.test" },
    { ...good, Origin: `http://127.0.0.1:${s.port + 1}` },
    { ...good, Origin: `https://127.0.0.1:${s.port}` },
    { ...good, Origin: `http://localhost:${s.port + 1}` },
    { ...good, Origin: "null" },
    { ...good, Origin: `${own}/` },
    { ...good, Origin: undefined },
    { ...good, "X-Sai-Page": undefined },
    { ...good, "X-Sai-Page": "" },
    { ...good, "X-Sai-Page": key.slice(1) },
    { ...good, "X-Sai-Page": `${key}0` },
    { ...good, "X-Sai-Page": key.toUpperCase() },
    { ...good, "X-Sai-Page": "g".repeat(64) },
    { ...good, "Content-Type": "text/plain" },
    { ...good, "Content-Type": undefined },
  ];
  const before = snapshot(box.home);
  const hash = sha256(fs.readFileSync(p.events));
  for (const headers of bad) {
    for (const [pth, body] of [
      ["/api/projects", { goal: "Вымышленная", budget_usd: 1 }],
      [`/api/projects/${p.id}/chat`, { text: "Сообщение" }],
    ]) {
      const r = await rawPost(s, pth, headers, JSON.stringify(body));
      assert.equal(r.status, 403, `${pth} ${JSON.stringify(headers)}`);
      assert.deepStrictEqual(r.json, REFUSED, JSON.stringify(headers));
    }
  }
  // a key of the right form that is not the key of this start: it differs only in
  // the first, only in a middle or only in the last sign — the whole key is
  // compared, not its beginning (TEST-DESIGN-VALIDATOR F1, mutant V05)
  const flip = (c) => (c === "a" ? "b" : "a");
  const others = [
    flip(key[0]) + key.slice(1),
    key.slice(0, 32) + flip(key[32]) + key.slice(33),
    key.slice(0, 63) + flip(key[63]),
  ];
  for (const other of others) {
    assert.equal(other.length, key.length);
    assert.notEqual(other, key);
    for (const [pth, body] of [
      ["/api/projects", { goal: "Вымышленная", budget_usd: 1 }],
      [`/api/projects/${p.id}/chat`, { text: "x" }],
    ]) {
      const r = await rawPost(
        s,
        pth,
        { ...good, "X-Sai-Page": other },
        JSON.stringify(body),
      );
      assert.equal(r.status, 403, `${pth} ${other}`);
      assert.deepStrictEqual(r.json, STALE, `${pth} ${other}`);
    }
  }
  assert.deepStrictEqual(snapshot(box.home), before);
  assert.equal(sha256(fs.readFileSync(p.events)), hash);
  assert.deepStrictEqual(engines.calls, []);
  // the same headers with the right key pass (the checks are not a blanket refusal)
  const ok = await rawPost(
    s,
    "/api/projects",
    good,
    JSON.stringify({ goal: "Цель", budget_usd: 1 }),
  );
  assert.equal(ok.status, 201);
  const okc = await rawPost(
    s,
    `/api/projects/${p.id}/chat`,
    { ...good, Origin: `http://localhost:${s.port}` },
    JSON.stringify({ text: "Привет" }),
  );
  assert.equal(okc.status, 200);
});

test("WEB-9b «../x», an absolute path, an encoded slash, a missing project, a task or a role that is not there — one and the same 404, byte for byte, with the same headers", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  p.w.close();
  // another project with a task this one has not
  const other = project(t, box);
  withPlan(other.w, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "lawyer"),
  ]);
  other.w.close();
  // a folder with the name of a project but no journal; a link named as a project
  fs.mkdirSync(path.join(box.home, "p-20990101-000001"), { mode: 0o700 });
  fs.symlinkSync(p.dir, path.join(box.home, "p-20990101-000002"));
  const s = await startServer(t, box);
  const key = await s.key();
  const before = snapshot(box.home);
  const base = `/api/projects/${p.id}`;
  const gets = [
    "/api/projects/..%2Fx",
    "/api/projects/%2Fetc%2Fpasswd",
    "/api/projects/../x",
    "/api/projects/..",
    "/api/projects/p-20990101-a1b2c3",
    "/api/projects/p-20990101-a1b2c3/chat",
    "/api/projects/p-20990101-000001",
    "/api/projects/p-20990101-000002",
    "/api/projects/P-20990101-A1B2C3",
    `/api/projects/${p.id}%2Fchat`,
    `${base}/tasks/..%2Ft-0001`,
    `${base}/tasks/t-9999`,
    `${base}/tasks/t-0002`,
    `${base}/tasks/t-1`,
    `${base}/tasks/`,
    `${base}/roles/0`,
    `${base}/roles/11`,
    `${base}/roles/01`,
    `${base}/roles/1.0`,
    `${base}/roles/-1`,
    `${base}/roles/99`,
    `${base}/roles/`,
    `${base}/other`,
    `${base}/chat/x`,
    `${base}/%E0%A4%A`,
    "/api/projects/p-20990101-a1b2c3/roles/1",
    "/api/projects/p-20990101-a1b2c3/tasks/t-0001",
  ];
  const answers = [];
  for (const pth of gets) answers.push([pth, await s.get(pth)]);
  answers.push([
    "POST chat of a missing project",
    await s.post(
      "/api/projects/p-20990101-a1b2c3/chat",
      { text: "x" },
      { key },
    ),
  ]);
  answers.push([
    "POST chat of a link",
    await s.post(
      "/api/projects/p-20990101-000002/chat",
      { text: "x" },
      { key },
    ),
  ]);
  const strip = (h) => {
    const copy = { ...h };
    delete copy.date;
    return copy;
  };
  const first = answers[0][1];
  for (const [pth, r] of answers) {
    assert.equal(r.status, 404, pth);
    assert.equal(r.text, NOT_FOUND_BODY, pth);
    assert.deepStrictEqual(strip(r.headers), strip(first.headers), pth);
  }
  assert.deepStrictEqual(snapshot(box.home), before);
  // and the task t-0002 is there in the other project: the paths are per project
  assert.equal(
    (await s.get(`/api/projects/${other.id}/tasks/t-0002`)).status,
    200,
  );
});

test("WEB-9c a secret in the text of the chat (a sample of the tests of maskSecrets) is «[скрыто]» in the journal and in the answer", async (t) => {
  const { p, s } = await fixture(t);
  const secrets = [
    "sk-ant-api03-FAKEFAKEFAKEFAKE1234567890abcd",
    "ghp_FAKEFAKEFAKEFAKEFAKE1234567890abcd",
    "AKIAFAKEFAKEFAKE1234",
  ];
  const text = `ключи: ${secrets.join(" и ")}`;
  const r = await s.post(`/api/projects/${p.id}/chat`, { text });
  assert.equal(r.status, 200);
  const raw = fs.readFileSync(p.events, "utf8");
  for (const secret of secrets) {
    assert.ok(!raw.includes(secret), secret);
    assert.ok(!r.text.includes(secret), secret);
  }
  const chat = journal(p).findLast((e) => e.type === "CHAT");
  assert.match(chat.data.text, /\[скрыто\]/);
  assert.equal(r.json.message.text, chat.data.text);
});

function srcFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) srcFiles(abs, out);
    else out.push(abs);
  }
  return out;
}

test("WEB-9d tools/src/web/ writes no file past the API of the core: no appendFile, writeFile, createWriteStream, openSync or rename anywhere (comments included), no inbox, the channel only in api.js", () => {
  const files = srcFiles(WEB_SRC);
  assert.ok(files.length >= 10);
  const channel = [];
  for (const f of files) {
    const body = fs.readFileSync(f, "utf8");
    const rel = path.relative(WEB_SRC, f).split(path.sep).join("/");
    assert.doesNotMatch(
      body,
      /appendFile|writeFile|createWriteStream|openSync|rename/,
      rel,
    );
    assert.doesNotMatch(body, /inbox/, rel);
    assert.doesNotMatch(body, /child_process/, rel);
    if (/channel/.test(body)) channel.push(rel);
    // (REQ-035, design section 18 r5) engineHolder lives only in api.js
    if (rel !== "api.js") assert.doesNotMatch(body, /engineHolder/, rel);
  }
  assert.deepStrictEqual(channel, ["api.js"]);
  const api = fs.readFileSync(path.join(WEB_SRC, "api.js"), "utf8");
  const lines = api.split("\n").filter((l) => /channel/.test(l));
  // (REQ-035, design sections 6.3, 11) the channel gives the server exactly two
  // names: deliver — the one entry of a write — and engineHolder, which only reads
  // the lock (is a live engine of another process there?).
  assert.deepStrictEqual(lines, [
    'import { deliver, engineHolder } from "../team/engine/channel.js";',
  ]);
  assert.doesNotMatch(api, /from "node:fs"|from "fs"/, "api.js reads no file");
  // exactly two calls of deliver: one in postChat (the chat of REQ-011) and one in
  // the control of a project (REQ-035, section 6.2–6.3); nowhere else
  const calls = [...api.matchAll(/\bdeliver\(/g)].map((m) => m.index);
  assert.equal(calls.length, 2, "deliver( is called twice in api.js");
  const chatStart = api.indexOf("export async function postChat(");
  const chatEnd = api.indexOf("\n}\n", chatStart);
  const controlStart = api.indexOf("async function control(");
  const controlEnd = api.indexOf("\n}\n", controlStart);
  assert.ok(chatStart !== -1 && controlStart !== -1);
  assert.deepStrictEqual(
    calls.map((at) =>
      at > chatStart && at < chatEnd
        ? "postChat"
        : at > controlStart && at < controlEnd
          ? "control"
          : `elsewhere at ${at}`,
    ),
    ["postChat", "control"],
  );
  // engineHolder only reads: one call, in the check «a live engine leads the project»
  assert.equal([...api.matchAll(/\bengineHolder\(/g)].length, 1);
});

test("WEB-9e every answer of the API and every refusal (200, 201, 400, 403, 404, 405, 408, 409, 413, 500) has Content-Type application/json; charset=utf-8 and nosniff", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  p.w.close();
  const held = project(t, box);
  held.w.close();
  const holder = await holdWriter(t, box.home, held.id);
  const broken = project(t, box);
  broken.w.close();
  fs.writeFileSync(
    broken.events,
    `${fs.readFileSync(broken.events, "utf8")}{x\n{"y":1}\n`,
  );
  const s = await startServer(t, box, { bodyIdleMs: 200 });
  const key = await s.key();
  const got = new Map();
  const add = (r) => got.set(r.status, r);
  add(await s.get("/api/projects"));
  add(await s.get(`/api/projects/${p.id}`));
  add(await s.post("/api/projects", { goal: "Цель", budget_usd: 1 }, { key }));
  add(await s.post("/api/projects", { goal: "", budget_usd: 1 }, { key }));
  add(
    await s.post(
      "/api/projects",
      { goal: "Цель", budget_usd: 1 },
      { key, headers: { Origin: undefined } },
    ),
  );
  add(await s.get("/api/projects/p-20990101-a1b2c3"));
  add(await s.request({ method: "DELETE", path: "/api/projects" }));
  add(
    await request(s.port, {
      method: "POST",
      path: `/api/projects/${p.id}/chat`,
      headers: {
        Origin: `http://127.0.0.1:${s.port}`,
        "Content-Type": "application/json",
        "X-Sai-Page": key,
        "Content-Length": "100",
      },
      parts: [[Buffer.from('{"text":"x'), 0]],
    }),
  );
  add(await s.post(`/api/projects/${held.id}/chat`, { text: "x" }, { key }));
  add(await s.post(`/api/projects/${p.id}/chat`, "x".repeat(70_000), { key }));
  add(await s.get(`/api/projects/${broken.id}`));
  assert.deepStrictEqual(
    [...got.keys()].sort((a, b) => a - b),
    [200, 201, 400, 403, 404, 405, 408, 409, 413, 500],
  );
  for (const [status, r] of got) {
    assert.equal(r.headers["content-type"], JSON_TYPE, String(status));
    assert.equal(
      r.headers["x-content-type-options"],
      "nosniff",
      String(status),
    );
    assert.equal(r.headers["cache-control"], "no-store", String(status));
    assert.equal(r.headers["referrer-policy"], "no-referrer", String(status));
    assert.equal(typeof r.json, "object", String(status));
  }
  await holder.kill();
});

test("WEB-9f the type of the body: the value before «;», trimmed, in lower case, is application/json — parameters and case do not matter; jsonx, json-patch+json, an empty value or none — 403", async (t) => {
  const { box, p, s, key, engines } = await fixture(t);
  const own = `http://127.0.0.1:${s.port}`;
  const accepted = [
    "application/json",
    "application/json; charset=UTF-8",
    "Application/JSON ;charset=utf-8",
    "APPLICATION/JSON",
    "application/json;",
    "application/json\t; x=y",
  ];
  for (const type of accepted) {
    const r = await rawPost(
      s,
      `/api/projects/${p.id}/chat`,
      { Origin: own, "Content-Type": type, "X-Sai-Page": key },
      JSON.stringify({ text: `тип ${type}` }),
    );
    assert.equal(r.status, 200, type);
  }
  const before = snapshot(box.home);
  for (const type of [
    "application/jsonx",
    "application/json-patch+json",
    "",
    "text/json",
    "application/x-www-form-urlencoded",
    "multipart/form-data",
    "application/ld+json",
    "json",
  ]) {
    for (const [pth, body] of [
      ["/api/projects", { goal: "Цель", budget_usd: 1 }],
      [`/api/projects/${p.id}/chat`, { text: "x" }],
    ]) {
      const r = await rawPost(
        s,
        pth,
        { Origin: own, "Content-Type": type, "X-Sai-Page": key },
        JSON.stringify(body),
      );
      assert.equal(r.status, 403, `${pth} ${type}`);
      assert.deepStrictEqual(r.json, REFUSED);
    }
  }
  assert.deepStrictEqual(snapshot(box.home), before);
  assert.deepStrictEqual(engines.calls, []);
});

test("WEB-9g a key of the right form from another start of the server: 403 with reload: true and the text «перезапущен»; no key: 403 reload: false; the journal and the folders unchanged in both", async (t) => {
  const { box, p, s } = await fixture(t);
  const old = await startServer(t, box);
  const oldKey = await old.key();
  await old.close();
  const before = snapshot(box.home);
  const dirsBefore = dirs(box.home);
  for (const [pth, body] of [
    ["/api/projects", { goal: "Цель", budget_usd: 1 }],
    [`/api/projects/${p.id}/chat`, { text: "Текст из старой страницы" }],
  ]) {
    const stale = await s.post(pth, body, { key: oldKey });
    assert.equal(stale.status, 403);
    assert.deepStrictEqual(stale.json, STALE);
    const none = await s.post(pth, body, {
      headers: { "X-Sai-Page": undefined },
      key: "",
    });
    assert.equal(none.status, 403);
    assert.deepStrictEqual(none.json, REFUSED);
  }
  assert.deepStrictEqual(snapshot(box.home), before);
  assert.deepStrictEqual(dirs(box.home), dirsBefore);
  // GET needs no key: the old page reads on
  assert.equal((await s.get(`/api/projects/${p.id}`)).status, 200);
});
