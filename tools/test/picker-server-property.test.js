// SP-1 ... SP-4: properties of the server with a seed (design REQ-056, 9.2): the routes
// on random strings, random paths around the real ones, damaged bodies, connections that
// are broken in the middle. The seeds are 56001, 56002, 56005, 56006; Math.random is not used.
import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";
import { routeOf } from "../src/picker/request.js";
import { makeRng } from "./picker-helpers.js";
import {
  LANGS,
  NOT_FOUND_BODY,
  demoAnswerSets,
  demoDir,
  getJson,
  rawExchange,
  request,
  resultRequest,
  signature,
  startForTest,
} from "./picker-server-helpers.js";

const ID_RULE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/u;
const KINDS = ["page", "redirect", "questionnaire", "result", "asset"];

test("SP-1: routeOf on 20000 random strings (seed 56001) never throws, gives null or one of the five kinds, an id that fits the rule, and null for every string with a percent sign or two points", () => {
  const rng = makeRng(56001);
  const pieces = [
    "/",
    "/",
    "t",
    "assets",
    "api",
    "questionnaire",
    "result",
    "%",
    "%2e",
    "%2F",
    "..",
    ".",
    "uchet-pro",
    "svet-marketing",
    "a",
    "-",
    "_",
    "A",
    "\\",
    "\u0000",
    "é",
    "stub.js",
    "texts.js",
    ".js",
    "lead",
    "?",
    "#",
    " ",
    "x".repeat(40),
  ];
  for (let i = 0; i < 20000; i++) {
    let target = rng.next() < 0.5 ? "/" : "";
    for (let k = rng.int(9); k >= 0; k--) target += rng.pick(pieces);
    if (rng.next() < 0.3) target = `/t/${target.slice(1)}`;
    const found = routeOf(target);
    if (found === null) continue;
    assert.ok(KINDS.includes(found.kind), target);
    if (found.kind === "asset")
      assert.match(found.name, /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u, target);
    else assert.match(found.id, ID_RULE, target);
    assert.equal(target.includes("%"), false, target);
    assert.equal(target.includes(".."), false, target);
    assert.equal(target.includes("\\"), false, target);
  }
});

test("SP-2: 300 random GET paths around the real ones (seed 56002) give 200, 308 or 404 only, all the 404 are one signature, no 5xx, and the log stays empty", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const rng = makeRng(56002);
  const bases = [
    "/t/uchet-pro/",
    "/t/uchet-pro",
    "/t/uchet-pro/api/questionnaire",
    "/t/svet-marketing/",
    "/assets/texts.js",
    "/assets/stub.js",
    "/t/net-takogo/",
    "/",
  ];
  const noise = [
    "%2D",
    "%2e",
    "%2E%2E",
    "%00",
    "%5c",
    "..",
    ".",
    "/",
    "//",
    "x",
    "-",
    "_",
    "A",
    "%",
    "%zz",
    "~",
    "!",
    "$",
    "&",
    "'",
    "(",
    ")",
    "*",
    "+",
    ",",
    ";",
    "=",
    ":",
    "@",
  ];
  const codes = new Set([200, 308, 404]);
  const notFound = new Set();
  for (let i = 0; i < 300; i++) {
    let target = rng.pick(bases);
    for (let k = rng.int(3); k >= 0; k--) {
      const at = 1 + rng.int(target.length);
      target = target.slice(0, at) + rng.pick(noise) + target.slice(at);
    }
    if (rng.next() < 0.3)
      target += `?lang=${rng.pick(["kk", "en", "de", ""])}&tenant=svet-marketing`;
    const res = await rawExchange(
      s.port,
      `GET ${target} HTTP/1.1\r\nHost: 127.0.0.1:${s.port}\r\nConnection: close\r\n\r\n`,
    );
    assert.ok(codes.has(res.status), `${target}: ${res.status}`);
    if (res.status === 404) {
      notFound.add(signature(res));
      assert.equal(res.body.toString("utf8"), NOT_FOUND_BODY);
    }
  }
  assert.equal(notFound.size, 1);
  assert.deepEqual(s.log(), []);
});

test("SP-3: 500 damaged bodies (seed 56005) - a bad byte in a key or in a value, a key renamed, a value that is a number, null, a list, an object, a string of 14000 signs, unicode, a cut - give 200 or 400 with bad_request or answers_invalid, never 5xx, an error body under 600 bytes, and the server lives", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const rng = makeRng(56005);
  const answers = demoAnswerSets("uchet-pro").leader;
  const keys = Object.keys(answers);
  const values = [
    0,
    1,
    -1,
    2.5,
    null,
    true,
    "",
    "я",
    "\u0000",
    [],
    ["x"],
    {},
    { a: 1 },
    "z".repeat(14000),
    "😀",
    "‮",
    "$&",
  ];
  let ok = 0;
  let refused = 0;
  for (let i = 0; i < 500; i++) {
    const damaged = JSON.parse(JSON.stringify(answers));
    const key = rng.pick(keys);
    let body;
    const kind = rng.int(7);
    if (kind === 0) damaged[key] = rng.pick(values);
    else if (kind === 1) {
      damaged[`${key}x`] = damaged[key];
      delete damaged[key];
    } else if (kind === 2) delete damaged[key];
    if (kind <= 2) body = Buffer.from(JSON.stringify({ answers: damaged }));
    else if (kind === 3) {
      const text = Buffer.from(JSON.stringify({ answers: damaged }));
      body = Buffer.concat([
        text.subarray(0, 12 + rng.int(40)),
        Buffer.from([0xff]),
        text.subarray(20 + rng.int(40)),
      ]);
    } else if (kind === 4) {
      const text = Buffer.from(JSON.stringify({ answers: damaged }));
      body = text.subarray(0, rng.int(text.length));
    } else if (kind === 5) {
      body = Buffer.from(
        JSON.stringify({ answers: damaged }).replace(
          /"/u,
          `"${String.fromCharCode(0xff)}`,
        ),
        "latin1",
      );
    } else body = Buffer.from(JSON.stringify({ answers: damaged }));
    const lang = rng.pick(LANGS);
    const res = await resultRequest(s.port, "uchet-pro", null, lang, { body });
    assert.ok(res.status === 200 || res.status === 400, `${i}: ${res.status}`);
    if (res.status === 200) {
      ok += 1;
      continue;
    }
    refused += 1;
    const json = JSON.parse(res.text);
    assert.ok(
      ["bad_request", "answers_invalid"].includes(json.error),
      `${i}: ${json.error}`,
    );
    assert.ok(res.body.length < 600, `${i}: ${res.body.length}`);
  }
  assert.ok(ok > 20 && refused > 200, `ok ${ok} refused ${refused}`);
  const alive = await getJson(s.port, "/t/uchet-pro/api/questionnaire");
  assert.equal(alive.status, 200);
  assert.deepEqual(s.log(), []);
});

test("SP-4: 200 connections broken in the middle of a request (seed 56006) - the server lives and the log stays empty", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const rng = makeRng(56006);
  const body = JSON.stringify({ answers: demoAnswerSets("uchet-pro").leader });
  const origin = `http://127.0.0.1:${s.port}`;
  const full = [
    `GET /t/uchet-pro/api/questionnaire HTTP/1.1\r\nHost: 127.0.0.1:${s.port}\r\n\r\n`,
    `POST /t/uchet-pro/api/result HTTP/1.1\r\nHost: 127.0.0.1:${s.port}\r\nOrigin: ${origin}\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}`,
    `POST /t/uchet-pro/api/result HTTP/1.1\r\nHost: 127.0.0.1:${s.port}\r\nOrigin: ${origin}\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n${body.length.toString(16)}\r\n${body}\r\n0\r\n\r\n`,
    "\u0001\u0002\u0003 garbage",
  ];
  for (let i = 0; i < 200; i++) {
    const text = rng.pick(full);
    const cut = text.slice(0, rng.int(text.length + 1));
    await new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port: s.port }, () => {
        socket.write(cut);
        if (rng.next() < 0.5) socket.destroy();
        else setTimeout(() => socket.destroy(), rng.int(4));
        resolve();
      });
      socket.on("error", () => resolve());
    });
  }
  await new Promise((r) => setTimeout(r, 500));
  const alive = await request(s.port, {
    path: "/t/uchet-pro/api/questionnaire",
  });
  assert.equal(alive.status, 200);
  assert.deepEqual(s.log(), []);
});
