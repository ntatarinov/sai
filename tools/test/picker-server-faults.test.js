// SF-6a ... SF-6n: failures do not bring the server down (design REQ-056, 5.9 and 9.1,
// criterion 6): a body that is wrong, too large or too slow, a method that is not allowed,
// a request that the parser of Node refuses, a file of the page that cannot be read, a
// folder with broken files, a program error in the command. After each refusal the server
// answers the next request with the same bytes, the folders do not change and the log is
// empty. Every server listens on port 0 and is closed in t.after.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { checkBytes } from "../src/picker/check.js";
import { publicQuestionnaire } from "../src/picker/public-data.js";
import { fileLanguages, tenantInLanguage } from "../src/picker/view.js";
import { installFaults } from "./fault-inject.js";
import {
  EXPECTED,
  PICKER,
  TOOLS,
  fixtureBytes,
  makeTmp,
} from "./picker-helpers.js";
import {
  IDS,
  LANGS,
  NOT_FOUND_BODY,
  PUBLIC_DIR,
  SERVER_TEXTS,
  allLanguages,
  demoAnswerSets,
  demoBytes,
  demoDir,
  demoPlain,
  listingDigest,
  makeTenantDir,
  parseMany,
  parseRaw,
  rawExchange,
  rawSend,
  request,
  resultRequest,
  signature,
  sourceOf,
  startForTest,
  startPickerClosing,
  streamBody,
  textFor,
} from "./picker-server-helpers.js";
import { textLine } from "./picker-text-helpers.js";

const FAULT_PATH = path.join(TOOLS, "test", "fault-inject.js");
const good = (name = "leader") => demoAnswerSets("uchet-pro")[name];
const COMMON = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};
const NO_TRACE = /Error|HPE_|ERR_|Parse|node_modules|\.js:\d|\n\s+at /u;

// What must be the same after a refusal.
async function snapshot(s, dir) {
  const q = await request(s.port, { path: "/t/uchet-pro/api/questionnaire" });
  assert.equal(q.status, 200);
  return {
    questionnaire: q.text,
    dir: listingDigest(dir),
    pub: listingDigest(PUBLIC_DIR),
  };
}
async function assertSame(s, dir, before, label) {
  assert.deepEqual(await snapshot(s, dir), before, label);
  assert.deepEqual(s.log(), [], `${label}: the log`);
}

const origin = (port) => `http://127.0.0.1:${port}`;
const post = (port, body, lang, type = "application/json") =>
  request(port, {
    method: "POST",
    path: `/t/uchet-pro/api/result${lang ? `?lang=${lang}` : ""}`,
    headers: { Origin: origin(port), "Content-Type": type },
    body,
  });

// ---------------------------------------------------------------------- SF-6a

test("SF-6a: a body that is no JSON, empty, cut, not UTF-8 (also one bad byte inside a key of a right JSON), a list, null, a number or a string is 400 bad_request in the language of the request, with no trace; a BOM is allowed; the server is the same after", async (t) => {
  const dir = demoDir(t);
  const s = await startForTest(t, dir);
  const before = await snapshot(s, dir);
  const answers = JSON.stringify({ answers: good() });
  const bodies = [
    Buffer.from("nope"),
    Buffer.from(""),
    Buffer.from('{"answers":'),
    Buffer.from([0xff, 0xfe]),
    Buffer.concat([
      Buffer.from('{"answers":{"a'),
      Buffer.from([0xff]),
      Buffer.from('":1}}'),
    ]),
    Buffer.from("[]"),
    Buffer.from("null"),
    Buffer.from("5"),
    Buffer.from('"text"'),
    Buffer.from("[{}]"),
    Buffer.from("{"),
  ];
  for (const body of bodies) {
    for (const lang of LANGS) {
      const res = await post(s.port, body, lang);
      const label = `${body.toString("latin1").slice(0, 20)} ${lang}`;
      assert.equal(res.status, 400, label);
      assert.deepEqual(
        JSON.parse(res.text),
        { error: "bad_request", message: textFor("server_bad_request", lang) },
        label,
      );
      assert.doesNotMatch(res.text, NO_TRACE, label);
    }
    await assertSame(s, dir, before, "after a body");
  }
  const bom = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(answers),
  ]);
  const ok = await post(s.port, bom, "ru");
  assert.equal(ok.status, 200);
  assert.equal(JSON.parse(ok.text).recommended.length > 0, true);
});

// ---------------------------------------------------------------------- SF-6b

function paddedBody(total) {
  const base = JSON.stringify({ answers: good() });
  assert.ok(base.length < total);
  return base + " ".repeat(total - base.length);
}

test("SF-6b: a body of 16384 bytes is taken and 16385 is 413 - as a plain request, as a declared length with no body, as a chunked stream, as a stream of 3 MiB; a stream of 40 MiB makes the server close the connection after at most 8 MiB and a margin; the server is the same after", async (t) => {
  const dir = demoDir(t);
  const s = await startForTest(t, dir, { bodyIdleMs: 2000 });
  const before = await snapshot(s, dir);
  const port = s.port;
  const tooLarge = (res, lang = "ru") => {
    assert.equal(res.status, 413);
    assert.deepEqual(JSON.parse(Buffer.from(res.body).toString("utf8")), {
      error: "too_large",
      message: textFor("server_too_large", lang),
    });
  };
  const exact = await post(port, paddedBody(16384), "ru");
  assert.equal(exact.status, 200);
  const over = await post(port, paddedBody(16385), "ru");
  assert.equal(over.status, 413);
  tooLarge({ status: over.status, body: over.body });
  // a declared length with no body: the answer comes at once, the body is not waited for
  const head =
    `POST /t/uchet-pro/api/result HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: ${origin(port)}\r\n` +
    "Content-Type: application/json\r\nContent-Length: 20000\r\nConnection: close\r\n\r\n";
  const declared = await rawExchange(port, head, { waitMs: 1500 });
  tooLarge(declared);
  // the same in each language of the request: the text of the refusal follows ?lang=
  for (const lang of ["kk", "en"]) {
    const asked = await rawExchange(
      port,
      head.replace("api/result ", `api/result?lang=${lang} `),
      { waitMs: 1500 },
    );
    tooLarge(asked, lang);
  }
  // a declared length of exactly the limit and of one more
  const lim = await rawExchange(port, head.replace("20000", "16385"), {
    waitMs: 1500,
  });
  tooLarge(lim);
  // chunked, 16385 bytes in total
  const chunked = await streamBody(port, {
    target: "/t/uchet-pro/api/result",
    total: 16385,
    chunked: true,
    chunkSize: 4096,
  });
  tooLarge(chunked);
  for (const lang of ["kk", "en"]) {
    const streamed = await streamBody(port, {
      target: `/t/uchet-pro/api/result?lang=${lang}`,
      total: 16385,
      chunked: true,
      chunkSize: 4096,
    });
    tooLarge(streamed, lang);
    const counted = await streamBody(port, {
      target: `/t/uchet-pro/api/result?lang=${lang}`,
      total: 3 * 1024 * 1024,
    });
    tooLarge(counted, lang);
  }
  const chunkedOk = await streamBody(port, {
    target: "/t/uchet-pro/api/result",
    total: 16384,
    chunked: true,
    chunkSize: 4096,
  });
  assert.equal(
    chunkedOk.status,
    400,
    "16384 spaces are taken as a body: it is no JSON",
  );
  // 3 MiB by pieces of 64 KiB
  const three = await streamBody(port, {
    target: "/t/uchet-pro/api/result",
    total: 3 * 1024 * 1024,
  });
  tooLarge(three);
  // 40 MiB: closed by the server early
  const forty = await streamBody(port, {
    target: "/t/uchet-pro/api/result",
    total: 40 * 1024 * 1024,
    maxMs: 60000,
  });
  tooLarge(forty);
  assert.equal(
    forty.serverClosed,
    true,
    "the server closed the connection before the end",
  );
  // the buffers of the sockets of the two sides hold some megabytes that the server has not
  // read, so the limit is far from 8 MiB; a server that reads it all would take 40 MiB
  assert.ok(forty.written < 30 * 1024 * 1024, `written ${forty.written}`);
  await assertSame(s, dir, before, "after the sizes");
});

test(
  "SF-6b2: after a refusal the rest of the body is thrown away only while data comes at least every 5 s - a client that sends a part and stops has its connection closed by the server (the answer 413 came at once)",
  { timeout: 30000 },
  async (t) => {
    const dir = demoDir(t);
    const s = await startForTest(t, dir);
    const port = s.port;
    const head =
      `POST /t/uchet-pro/api/result HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: ${origin(port)}\r\n` +
      "Content-Type: application/json\r\nContent-Length: 1000000\r\n\r\n";
    const { raw, closed } = await rawSend(
      port,
      Buffer.concat([Buffer.from(head), Buffer.alloc(20000, 0x20)]),
      {
        waitMs: 12000,
      },
    );
    const answer = parseRaw(raw);
    assert.equal(answer.status, 413);
    assert.equal(
      closed,
      true,
      "the server closed the connection after the pause",
    );
    assert.equal(
      (await request(port, { path: "/t/uchet-pro/api/questionnaire" })).status,
      200,
    );
  },
);

test("SF-6o: with a folder of the page that holds no index.html (or a folder of that name) the page is the unknown path, a file of the page is the unknown path, the questionnaire still works; the file is read at every request, so a file put there later is served", async (t) => {
  const publicDir = makeTmp(t);
  const s = await startForTest(t, demoDir(t), { publicDir });
  const unknown = async (target) => {
    const res = await request(s.port, { path: target });
    assert.equal(res.status, 404, target);
    assert.equal(res.text, NOT_FOUND_BODY, target);
  };
  await unknown("/t/uchet-pro/");
  await unknown("/assets/main.js");
  await unknown("/assets/index.html");
  fs.mkdirSync(path.join(publicDir, "index.html"));
  await unknown("/t/uchet-pro/");
  assert.equal(
    (await request(s.port, { path: "/t/uchet-pro/api/questionnaire" })).status,
    200,
  );
  fs.rmdirSync(path.join(publicDir, "index.html"));
  fs.writeFileSync(
    path.join(publicDir, "index.html"),
    "<!doctype html><title>x</title>",
  );
  const page = await request(s.port, { path: "/t/svet-marketing/" });
  assert.equal(page.status, 200);
  assert.equal(page.text, "<!doctype html><title>x</title>");
  assert.equal(page.headers["content-type"], "text/html; charset=utf-8");
  assert.deepEqual(s.log(), []);
});

// ---------------------------------------------------------------------- SF-6c

const ALLOW = [
  ["questionnaire", "/t/uchet-pro/api/questionnaire", "GET"],
  ["result", "/t/uchet-pro/api/result", "POST"],
  ["page", "/t/uchet-pro/", "GET"],
  ["redirect", "/t/uchet-pro", "GET"],
  ["asset", "/assets/main.js", "GET"],
];

test("SF-6c: PUT, DELETE, PATCH, HEAD, OPTIONS on every kind of route, POST on the questionnaire and GET on the result are 405 with the Allow of the table; the message is in the language of the request where the tenant is known and in all languages where not", async (t) => {
  const dir = demoDir(t);
  const s = await startForTest(t, dir);
  const before = await snapshot(s, dir);
  for (const [kind, target, allow] of ALLOW) {
    for (const method of [
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
      allow === "GET" ? "POST" : "GET",
    ]) {
      for (const lang of LANGS) {
        const res = await request(s.port, {
          method,
          path: `${target}?lang=${lang}`,
          body: method === "GET" || method === "HEAD" ? undefined : "{}",
        });
        const label = `${method} ${kind} ${lang}`;
        assert.equal(res.status, 405, label);
        assert.equal(res.headers.allow, allow, label);
        for (const [name, value] of Object.entries(COMMON))
          assert.equal(res.headers[name], value, label);
        if (method !== "HEAD") {
          const known =
            kind === "questionnaire" || kind === "result" || kind === "page";
          const message = known
            ? textFor("server_method", lang)
            : allLanguages("server_method");
          assert.deepEqual(
            JSON.parse(res.text),
            { error: "method_not_allowed", message },
            label,
          );
        }
      }
    }
  }
  await assertSame(s, dir, before, "after the methods");
});

const RAW_HEAD = (port) => `Host: 127.0.0.1:${port}\r\n`;
const PARSER_CASES = (port) => [
  [
    "a word in place of the method",
    `FOO / HTTP/1.1\r\n${RAW_HEAD(port)}\r\n`,
    400,
    "bad_request",
    "server_bad_request",
  ],
  [
    "garbage",
    "\u0001\u0002garbage\r\n\r\n",
    400,
    "bad_request",
    "server_bad_request",
  ],
  [
    "a control sign in the line of the request",
    `GET /a\u0001b HTTP/1.1\r\n${RAW_HEAD(port)}\r\n`,
    400,
    "bad_request",
    "server_bad_request",
  ],
  [
    "a wrong Content-Length",
    `POST /t/uchet-pro/api/result HTTP/1.1\r\n${RAW_HEAD(port)}Content-Length: abc\r\n\r\n`,
    400,
    "bad_request",
    "server_bad_request",
  ],
  [
    "a header of 20000 signs",
    `GET / HTTP/1.1\r\n${RAW_HEAD(port)}X-Big: ${"a".repeat(20000)}\r\n\r\n`,
    431,
    "too_large",
    "server_too_large",
  ],
  [
    "slow headers",
    `GET /t/uchet-pro/ HTTP/1.1\r\n${RAW_HEAD(port)}`,
    408,
    "timeout",
    "server_slow",
  ],
];

test("SF-6c2: requests that the parser of Node refuses (a word for the method, garbage, a control sign, a wrong length, a header over 16 KiB, slow headers) get the closed answer of design 5.6 - the code, the common headers, JSON, the exact length, Connection: close, the three languages in one line, no trace - and the next request is 200 with an empty log; HTTP/1.1 with no Host gets 403 with an empty body", async (t) => {
  const dir = demoDir(t);
  const s = await startForTest(t, dir, {
    headersTimeoutMs: 1000,
    requestTimeoutMs: 2000,
  });
  const before = await snapshot(s, dir);
  for (const [label, text, status, code, key] of PARSER_CASES(s.port)) {
    const res = await rawExchange(s.port, text, { waitMs: 8000 });
    assert.equal(res.status, status, label);
    for (const [name, value] of Object.entries(COMMON))
      assert.equal(res.headers[name], value, `${label}: ${name}`);
    assert.equal(
      res.headers["content-type"],
      "application/json; charset=utf-8",
      label,
    );
    assert.equal(res.headers.connection, "close", label);
    assert.equal(Number(res.headers["content-length"]), res.body.length, label);
    assert.deepEqual(
      JSON.parse(res.body.toString("utf8")),
      { error: code, message: allLanguages(key) },
      label,
    );
    assert.doesNotMatch(res.body.toString("utf8"), NO_TRACE, label);
    assert.equal(res.closed, true, `${label}: closed`);
    await assertSame(s, dir, before, label);
  }
  const noHost = await rawExchange(
    s.port,
    "GET /t/uchet-pro/ HTTP/1.1\r\nConnection: close\r\n\r\n",
  );
  assert.equal(noHost.status, 403);
  assert.equal(noHost.body.length, 0);
  assert.equal(noHost.headers["content-length"], "0");
  await assertSame(s, dir, before, "no Host");
});

test("SF-6c3: two or three right requests sent at once on one connection and then garbage get their answers one after the other without a mix - the right answers, then the closed answer of the refusal - and nothing is left over", async (t) => {
  const dir = demoDir(t);
  const s = await startForTest(t, dir);
  const port = s.port;
  const before = await snapshot(s, dir);
  const get = (target) =>
    `GET ${target} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n\r\n`;
  const targets = [
    "/t/uchet-pro/api/questionnaire",
    "/t/svet-marketing/api/questionnaire?lang=kk",
    "/t/net-takogo/",
    "/t/uchet-pro/",
  ];
  for (const garbage of [
    "FOO / HTTP/1.1\r\n\r\n",
    "\u0001\u0002garbage\r\n\r\n",
    `GET / HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nX-Big: ${"a".repeat(20000)}\r\n\r\n`,
  ]) {
    for (const count of [2, 3]) {
      const sent = targets.slice(0, count);
      const { raw, closed } = await rawSend(
        port,
        `${sent.map(get).join("")}${garbage}`,
        { waitMs: 3000 },
      );
      const { answers, rest } = parseMany(raw);
      assert.equal(rest.length, 0, "nothing is left over");
      // Node answers the next request of a pipeline only when the one before is done, so the
      // requests that are still waiting when the garbage comes are dropped: what counts is
      // that what was answered is whole and the refusal does not cut into it
      assert.ok(
        answers.length >= 2 && answers.length <= count + 1,
        `${answers.length}`,
      );
      assert.equal(answers[0].status, 200);
      assert.equal(answers[0].body.toString("utf8"), before.questionnaire);
      for (const answer of answers.slice(1, -1))
        assert.ok([200, 404].includes(answer.status));
      const last = answers.at(-1);
      assert.ok([400, 431].includes(last.status));
      assert.equal(last.headers.connection, "close");
      assert.deepEqual(Object.keys(JSON.parse(last.body.toString("utf8"))), [
        "error",
        "message",
      ]);
      assert.equal(closed, true);
    }
  }
  await assertSame(s, dir, before, "after the pipelines");
});

// ---------------------------------------------------------------------- SF-6e / 6f

function blocks(entries) {
  return entries.flatMap(([name, lines]) => [
    `Арендатор ${name} не обслуживается:`,
    ...lines,
  ]);
}
const renamed = (sample, name) =>
  EXPECTED[sample].lines.map((l) => l.replace(sample, name));

test("SF-6e: a folder with one right file and a broken one, a link, a folder, an empty file, a binary file, a file over 512 KB, a file that is not UTF-8 and a text file - the server works, stderr holds the blocks of design 4.3 in the order of the names, the bad addresses are unknown paths", async (t) => {
  const outsideLink = (d, name) =>
    fs.symlinkSync(path.join(d, "uchet-pro.json"), path.join(d, name));
  const dir = makeTenantDir(t, {
    "uchet-pro.json": demoBytes("uchet-pro"),
    "e-field-extra-top.json": fixtureBytes("e-field-extra-top.json"),
    "link.json": outsideLink,
    "sub.json": (d, name) => fs.mkdirSync(path.join(d, name)),
    "empty.json": "",
    "binary.json": Buffer.concat([
      Buffer.from('{"a":"'),
      Buffer.from([0xff, 0xfe]),
      Buffer.from('"}'),
    ]),
    "big.json": Buffer.alloc(524289, 0x20),
    "notes.txt": "text",
  });
  const before = listingDigest(dir);
  const s = await startForTest(t, dir);
  assert.deepEqual(s.ids, ["uchet-pro"]);
  const expected = [
    ["big.json", ["Файл big.json больше 512 КБ. Сократите его."]],
    [
      "binary.json",
      [
        "binary.json: строка 1, знак 7: E_JSON: Файл не в кодировке UTF-8. Сохраните его как UTF-8.",
      ],
    ],
    ["e-field-extra-top.json", EXPECTED["e-field-extra-top.json"].lines],
    ["empty.json", renamed("e-json-empty.txt", "empty.json")],
    ["link.json", ["link.json — ссылка. Укажите сам файл, а не ссылку."]],
    ["sub.json", ["sub.json — папка, а не файл. Укажите файл арендатора."]],
  ];
  assert.deepEqual(s.err, blocks(expected));
  for (const [name] of expected) {
    const res = await request(s.port, {
      path: `/t/${name.replace(".json", "")}/`,
    });
    assert.equal(res.status, 404, name);
  }
  assert.equal((await request(s.port, { path: "/t/uchet-pro/" })).status, 200);
  assert.deepEqual(listingDigest(dir), before);
});

test("SF-6e2: the name of a file that is not served is written tamed in the block - a word such as token is not hidden, a space and a control sign become '_', a long name is cut to 40 signs; the same for a folder and a link", async (t) => {
  const dir = makeTenantDir(t, {
    "uchet-pro.json": demoBytes("uchet-pro"),
    "token-shop.json": "{}",
    "bad name.json": "{}",
    "tab\tname.json": "{}",
    "my dir.json": (d, name) => fs.mkdirSync(path.join(d, name)),
    [`${"n".repeat(45)}.json`]: "{}",
  });
  const s = await startForTest(t, dir);
  assert.deepEqual(s.ids, ["uchet-pro"]);
  const headers = s.err.filter((l) => l.startsWith("Арендатор "));
  assert.deepEqual(headers, [
    "Арендатор bad_name.json не обслуживается:",
    "Арендатор my_dir.json не обслуживается:",
    `Арендатор ${"n".repeat(40)}… не обслуживается:`,
    "Арендатор tab_name.json не обслуживается:",
    "Арендатор token-shop.json не обслуживается:",
  ]);
  for (const line of s.err) assert.doesNotMatch(line, /\n|\t/u);
});

test("SF-6e3: only a name that ends with .json is a tenant file - uchet-pro.json.bak, x.json.bak, notes.json.txt, json and a name with .json in the middle are not read, not told in stderr, not counted, and their addresses are unknown", async (t) => {
  const copy = demoBytes("uchet-pro");
  const dir = makeTenantDir(t, {
    "uchet-pro.json": copy,
    "uchet-pro.json.bak": copy,
    "x.json.bak": copy,
    "notes.json.txt": copy,
    "a.json.b.json.old": copy,
    json: copy,
    "x.JSON": copy,
  });
  const before = listingDigest(dir);
  const s = await startForTest(t, dir);
  assert.deepEqual(s.ids, ["uchet-pro"]);
  assert.deepEqual(s.err, []);
  for (const id of ["x", "notes", "a", "json", "uchet-pro-bak"]) {
    assert.equal(
      (await request(s.port, { path: `/t/${id}/` })).text,
      NOT_FOUND_BODY,
      id,
    );
  }
  assert.deepEqual(listingDigest(dir), before);
  // they do not count towards the limit of 100 either
  const many = makeTenantDir(t, {
    "uchet-pro.json": copy,
    ...Object.fromEntries(
      Array.from({ length: 120 }, (_, i) => [`f${i}.json.bak`, "x"]),
    ),
  });
  const ok = await startForTest(t, many);
  assert.deepEqual(ok.ids, ["uchet-pro"]);
});

test("SF-6f: a folder with only broken files, an empty folder and a folder with no .json file give code 1 and the line of the table; 101 .json names give code 2 and nothing starts; a folder with no right to read gives code 2", async (t) => {
  const none =
    "picker: В папке нет ни одного исправного файла арендатора. Исправьте файлы и запустите снова.";
  const io = { out() {}, err() {} };
  const onlyBad = makeTenantDir(t, {
    "e-field-extra-top.json": fixtureBytes("e-field-extra-top.json"),
  });
  const errors = [];
  const r1 = await startPickerClosing(
    t,
    { tenants: onlyBad, port: 0 },
    { out() {}, err: (l) => errors.push(l) },
  );
  assert.deepEqual(r1, { ok: false, exitCode: 1, lines: [none] });
  assert.deepEqual(
    errors,
    blocks([
      ["e-field-extra-top.json", EXPECTED["e-field-extra-top.json"].lines],
    ]),
  );
  const empty = makeTenantDir(t, {});
  assert.deepEqual(
    await startPickerClosing(t, { tenants: empty, port: 0 }, io),
    {
      ok: false,
      exitCode: 1,
      lines: [none],
    },
  );
  const noJson = makeTenantDir(t, { "notes.txt": "x", "page.html": "y" });
  assert.deepEqual(
    await startPickerClosing(t, { tenants: noJson, port: 0 }, io),
    {
      ok: false,
      exitCode: 1,
      lines: [none],
    },
  );
  const many = makeTenantDir(
    t,
    Object.fromEntries(
      Array.from({ length: 101 }, (_, i) => [
        `f${String(i).padStart(3, "0")}.json`,
        "{}",
      ]),
    ),
  );
  const manyOut = [];
  const r2 = await startPickerClosing(
    t,
    { tenants: many, port: 0 },
    { out() {}, err: (l) => manyOut.push(l) },
  );
  assert.deepEqual(r2, {
    ok: false,
    exitCode: 2,
    lines: [
      `picker: В папке ${path.basename(many)} больше 100 файлов арендаторов. Оставьте нужные.`,
    ],
  });
  assert.deepEqual(manyOut, []);
  // exactly 100 are allowed, and files that are not .json are not counted
  const hundred = makeTenantDir(t, {
    ...Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [
        `g${String(i).padStart(3, "0")}.json`,
        "{}",
      ]),
    ),
    ...Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`h${i}.txt`, "x"]),
    ),
  });
  const r3 = await startPickerClosing(
    t,
    { tenants: hundred, port: 0 },
    { out() {}, err() {} },
  );
  assert.deepEqual(r3, { ok: false, exitCode: 1, lines: [none] });
  // no right to read
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    const locked = makeTenantDir(t, {
      "uchet-pro.json": demoBytes("uchet-pro"),
    });
    fs.chmodSync(locked, 0o000);
    let r4;
    try {
      r4 = await startPickerClosing(t, { tenants: locked, port: 0 }, io);
    } finally {
      fs.chmodSync(locked, 0o700);
    }
    assert.deepEqual(r4, {
      ok: false,
      exitCode: 2,
      lines: [
        `picker: Нет права читать папку ${path.basename(locked)}. Проверьте права.`,
      ],
    });
  }
});

// ---------------------------------------------------------------------- SF-6g

test("SF-6g: for every kind of refusal and in each language the message is the text of the table, the three languages differ, ru has no address with 'ты', and the body holds no stack, path or name of an error", async (t) => {
  const dir = demoDir(t);
  const s = await startForTest(t, dir, { bodyIdleMs: 250 });
  const port = s.port;
  const plain = JSON.stringify({ answers: good() });
  const kinds = [
    [
      "forbidden",
      403,
      "forbidden",
      "server_forbidden",
      {},
      (lang) =>
        request(port, {
          method: "POST",
          path: `/t/uchet-pro/api/result?lang=${lang}`,
          headers: {
            Origin: "http://evil.example",
            "Content-Type": "application/json",
          },
          body: plain,
        }),
    ],
    [
      "method",
      405,
      "method_not_allowed",
      "server_method",
      {},
      (lang) =>
        request(port, {
          method: "PUT",
          path: `/t/uchet-pro/api/questionnaire?lang=${lang}`,
          body: "{}",
        }),
    ],
    [
      "wrong type",
      415,
      "wrong_type",
      "server_wrong_type",
      {},
      (lang) => post(port, plain, lang, "text/plain"),
    ],
    [
      "too large",
      413,
      "too_large",
      "server_too_large",
      {},
      (lang) => post(port, " ".repeat(20000), lang),
    ],
    [
      "bad request",
      400,
      "bad_request",
      "server_bad_request",
      {},
      (lang) => post(port, "nope", lang),
    ],
    [
      "extra field",
      400,
      "bad_request",
      "server_extra_field",
      { field: "comment" },
      (lang) =>
        post(port, JSON.stringify({ comment: 1, answers: good() }), lang),
    ],
    [
      "no answers",
      400,
      "bad_request",
      "server_no_answers",
      {},
      (lang) => post(port, "{}", lang),
    ],
    [
      "answers invalid",
      400,
      "answers_invalid",
      "server_answers_invalid",
      {},
      (lang) => post(port, JSON.stringify({ answers: {} }), lang),
    ],
    [
      "slow",
      408,
      "timeout",
      "server_slow",
      {},
      async (lang) => {
        const raw = await rawExchange(
          port,
          `POST /t/uchet-pro/api/result?lang=${lang} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: ${origin(port)}\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{"ans`,
          { waitMs: 5000 },
        );
        return {
          status: raw.status,
          text: raw.body.toString("utf8"),
          headers: raw.headers,
        };
      },
    ],
  ];
  const seen = new Map();
  for (const [name, status, code, key, values, run] of kinds) {
    for (const lang of LANGS) {
      const res = await run(lang);
      assert.equal(res.status, status, `${name} ${lang}`);
      const json = JSON.parse(res.text);
      assert.equal(json.error, code, `${name} ${lang}`);
      assert.equal(json.message, textFor(key, lang, values), `${name} ${lang}`);
      assert.doesNotMatch(res.text, NO_TRACE, `${name} ${lang}`);
      assert.doesNotMatch(res.text, /\/tmp|\/var\/|\/Users\//u);
      seen.set(`${name} ${lang}`, json.message);
    }
    assert.equal(
      new Set(LANGS.map((l) => seen.get(`${name} ${l}`))).size,
      3,
      name,
    );
    assert.doesNotMatch(
      seen.get(`${name} ru`),
      /(^|[^\p{L}\p{N}])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои)(?![\p{L}\p{N}])/iu,
      name,
    );
  }
  // the 500 (the file of the page cannot be read)
  for (const lang of LANGS) {
    const faults = installFaults([
      {
        fn: "openSync",
        paths: [path.join(PUBLIC_DIR, "index.html")],
        effect: "throw",
        code: "EIO",
      },
    ]);
    try {
      const res = await request(port, { path: `/t/uchet-pro/?lang=${lang}` });
      assert.equal(res.status, 500);
      assert.deepEqual(JSON.parse(res.text), {
        error: "internal",
        message: textFor("server_internal", lang),
      });
      assert.doesNotMatch(res.text, NO_TRACE);
    } finally {
      faults.restore();
    }
  }
  assert.equal(Object.keys(SERVER_TEXTS).length, 11);
});

// ---------------------------------------------------------------------- SF-6h

test("SF-6h: a failure to read the file of the page is 500 internal in the language of the request, with one line in the log that holds the kind and the code and not the text of the failure; the next request is 200", async (t) => {
  const dir = demoDir(t);
  const s = await startForTest(t, dir);
  const before = await snapshot(s, dir);
  const faults = installFaults([
    {
      fn: "openSync",
      paths: [path.join(PUBLIC_DIR, "index.html")],
      effect: "throw",
      code: "EIO",
    },
  ]);
  let res;
  try {
    res = await request(s.port, { path: "/t/uchet-pro/?lang=kk" });
  } finally {
    faults.restore();
  }
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.text), {
    error: "internal",
    message: textFor("server_internal", "kk"),
  });
  assert.doesNotMatch(res.text, NO_TRACE);
  assert.deepEqual(s.log(), [
    "Сайт подбора: ошибка обработчика запроса: Error EIO",
  ]);
  const next = await request(s.port, { path: "/t/uchet-pro/" });
  assert.equal(next.status, 200);
  assert.deepEqual(
    next.body,
    fs.readFileSync(path.join(PUBLIC_DIR, "index.html")),
  );
  assert.deepEqual(await snapshot(s, dir), before);
  // a file of the page: the same failure on /assets/ gives a 500 without a tenant, in all languages
  const faults2 = installFaults([
    {
      fn: "openSync",
      paths: [path.join(PUBLIC_DIR, "main.js")],
      effect: "throw",
      code: "EIO",
    },
  ]);
  try {
    const asset = await request(s.port, { path: "/assets/main.js" });
    assert.equal(asset.status, 500);
    assert.equal(JSON.parse(asset.text).error, "internal");
  } finally {
    faults2.restore();
  }
  assert.equal(s.log().length, 2);
});

// ---------------------------------------------------------------------- SF-6i

test("SF-6i: a pause in the body longer than bodyIdleMs is 408 with Connection: close and the server lives; a client that goes away in the middle of a body (200 times) gets no answer and writes nothing to the log", async (t) => {
  const dir = demoDir(t);
  const s = await startForTest(t, dir, { bodyIdleMs: 250 });
  const before = await snapshot(s, dir);
  const port = s.port;
  const head = (lang) =>
    `POST /t/uchet-pro/api/result?lang=${lang} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: ${origin(port)}\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n`;
  for (const lang of LANGS) {
    const res = await rawExchange(port, `${head(lang)}{"ans`, { waitMs: 5000 });
    assert.equal(res.status, 408, lang);
    assert.equal(res.headers.connection, "close", lang);
    assert.deepEqual(JSON.parse(res.body.toString("utf8")), {
      error: "timeout",
      message: textFor("server_slow", lang),
    });
    assert.equal(res.closed, true);
  }
  await assertSame(s, dir, before, "after the pauses");
  // a client that goes away
  const { default: net } = await import("node:net");
  for (let i = 0; i < 200; i++) {
    await new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port }, () => {
        socket.write(`${head("ru")}{"answers"`);
        setTimeout(() => {
          socket.destroy();
          resolve();
        }, i % 3);
      });
      socket.on("error", () => resolve());
    });
  }
  await new Promise((r) => setTimeout(r, 600));
  await assertSame(s, dir, before, "after the broken connections");
});

// ---------------------------------------------------------------------- SF-6k

const LANG_FILE = path.join(
  TOOLS,
  "test",
  "fixtures",
  "picker-lang",
  "ok-lang-minimal.json",
);
const langTenant = () => JSON.parse(fs.readFileSync(LANG_FILE, "utf8"));
// The text that the file check used to let in and now refuses (design REQ-068, 9.1, Z1).
const REFUSED = "A\u0000B\u0007C\u202eD\u2028E\ud800F";

test("SF-6k(a): a tenant whose name holds hard but allowed signs - no-break spaces, a pair of the smiley, letters, a quote, a backslash, < and & - is served as data of JSON: 200, a body that is right JSON with no byte below 0x20, the quote and the backslash escaped in the raw body, and the name after JSON.parse equal to the file", async (t) => {
  const odd = 'A\u00a0B\u202fC\u2003D\ud83d\ude00\u0451\u049b\u04af"\\<&';
  const tenant = langTenant();
  for (const lang of LANGS) tenant.name[lang] = `${odd}-${lang}`;
  const dir = makeTenantDir(t, {
    "ok-lang-minimal.json": JSON.stringify(tenant),
  });
  const s = await startForTest(t, dir);
  assert.deepEqual(s.ids, ["ok-lang-minimal"], s.err.join("\n"));
  for (const lang of LANGS) {
    const res = await request(s.port, {
      path: `/t/ok-lang-minimal/api/questionnaire?lang=${lang}`,
    });
    assert.equal(res.status, 200);
    for (const byte of res.body)
      assert.ok(byte >= 0x20, "a byte below 0x20 in the body");
    const raw = res.body.toString("utf8");
    assert.ok(raw.includes('\\"'), "the quote is escaped");
    assert.ok(raw.includes("\\\\"), "the backslash is escaped");
    assert.equal(JSON.parse(raw).name, `${odd}-${lang}`);
  }
});

test("SF-6k(b): a tenant whose name holds the signs the check refuses (a null sign, a bell, U+202E, U+2028, a single half) is not served - beside a right tenant the ids are only the right one, the server tells the block and the line of E_TEXT, and its address answers 404 byte for byte as an unknown tenant", async (t) => {
  const tenant = langTenant();
  tenant.name.ru = `${REFUSED}-ru`;
  const dir = makeTenantDir(t, {
    "uchet-pro.json": demoBytes("uchet-pro"),
    "ok-lang-minimal.json": JSON.stringify(tenant),
  });
  const before = listingDigest(dir);
  const s = await startForTest(t, dir);
  assert.deepEqual(s.ids, ["uchet-pro"]);
  assert.deepEqual(s.err, [
    "Арендатор ok-lang-minimal.json не обслуживается:",
    textLine("ok-lang-minimal.json", "name.ru", 0x0000),
  ]);
  const refused = await request(s.port, { path: "/t/ok-lang-minimal/" });
  const unknown = await request(s.port, { path: "/t/net-takogo/" });
  assert.equal(refused.status, 404);
  assert.equal(signature(refused), signature(unknown));
  assert.equal(refused.text, NOT_FOUND_BODY);
  const asked = await request(s.port, {
    path: "/t/ok-lang-minimal/api/questionnaire?lang=kk",
  });
  assert.equal(
    signature(asked),
    signature(
      await request(s.port, {
        path: "/t/net-takogo/api/questionnaire?lang=kk",
      }),
    ),
  );
  assert.equal((await request(s.port, { path: "/t/uchet-pro/" })).status, 200);
  assert.deepEqual(listingDigest(dir), before);
});

test("SF-6k(c): the second line of defence - a questionnaire built from a tenant in memory, past the check of the file, with the refused signs in the name, is still right JSON in each language: no byte below 0x20, the null sign, the bell and the single half written as escapes, U+202E as it is, and the name after JSON.parse equal to the text", () => {
  const bytes = Buffer.from(fs.readFileSync(LANG_FILE));
  const checked = checkBytes(bytes, "ok-lang-minimal.json");
  assert.equal(checked.exitCode, 0);
  const languages = fileLanguages(checked.tenant);
  for (const lang of LANGS) {
    const view = {
      ...tenantInLanguage(checked.tenant, lang),
      name: `${REFUSED}-${lang}`,
    };
    const json = JSON.stringify(
      publicQuestionnaire(view, { version: "v", lang, languages }),
    );
    for (const byte of Buffer.from(json, "utf8"))
      assert.ok(byte >= 0x20, "a byte below 0x20");
    assert.ok(json.includes("\\u0000"));
    assert.ok(json.includes("\\u0007"));
    assert.ok(json.includes("\\ud800"));
    assert.ok(json.includes("\u202e"));
    assert.equal(JSON.parse(json).name, `${REFUSED}-${lang}`);
  }
});

// ---------------------------------------------------------------------- SF-6l

test("SF-6l: error.question is the id of a question of this tenant or null - never a key of the visitor; an extra field of 15000 signs is cut to 40 signs and has no control sign; '$&' and '$1' in a name stay letters", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const port = s.port;
  const plain = demoPlain("uchet-pro");
  const first = plain.questions.find((q) => q.required);
  const { [first.id]: dropped, ...without } = good();
  void dropped;
  const known = await resultRequest(port, "uchet-pro", without, "ru");
  assert.equal(known.status, 400);
  assert.equal(JSON.parse(known.text).question, first.id);
  assert.equal(JSON.parse(known.text).error, "answers_invalid");
  for (const key of [
    "ключ-чужой",
    "bad\u0001\u0002key",
    "‮tricky",
    "k".repeat(15000),
    "constructor",
    "__proto__",
  ]) {
    const answers = JSON.parse(JSON.stringify({ ...good() }));
    Object.defineProperty(answers, key, {
      value: 1,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const res = await resultRequest(port, "uchet-pro", answers, "ru");
    assert.equal(res.status, 400, key.slice(0, 10));
    const json = JSON.parse(res.text);
    assert.equal(json.question, null, key.slice(0, 10));
    assert.equal(
      res.text.includes(key.slice(0, 10)),
      false,
      "the key is not given back",
    );
    assert.deepEqual(Object.keys(json), ["error", "message", "question"]);
    assert.ok(res.body.length < 600);
  }
  // an extra field in the body
  const huge = "x".repeat(15000);
  const extra = await resultRequest(port, "uchet-pro", null, "en", {
    body: JSON.stringify({ [huge]: 1, answers: {} }),
  });
  assert.equal(extra.status, 400);
  const message = JSON.parse(extra.text).message;
  assert.equal(
    message,
    textFor("server_extra_field", "en", { field: `${"x".repeat(40)}…` }),
  );
  assert.ok(extra.body.length < 400);
  const control = await resultRequest(port, "uchet-pro", null, "ru", {
    body: JSON.stringify({ "a\u0001b c": 1, answers: {} }),
  });
  assert.equal(
    JSON.parse(control.text).message,
    textFor("server_extra_field", "ru", { field: "a_b_c" }),
  );
  for (const field of ["$&", "$1", "$`", "{field}"]) {
    const res = await resultRequest(port, "uchet-pro", null, "ru", {
      body: JSON.stringify({ [field]: 1, answers: {} }),
    });
    assert.equal(
      JSON.parse(res.text).message,
      `В запросе лишнее поле ${field}. Удалите его.`,
      field,
    );
  }
});

// ---------------------------------------------------------------------- SF-6m

test("SF-6m: a result has no ranking; the ids of the solutions that are not recommended are in no body of the six sets in three languages; for 'none' there is no id of a solution at all", async (t) => {
  const s = await startForTest(t, demoDir(t));
  for (const id of IDS) {
    const plain = demoPlain(id);
    const all = plain.solutions.map((x) => x.id);
    for (const lang of LANGS) {
      for (const name of ["leader", "close", "none"]) {
        const res = await resultRequest(
          s.port,
          id,
          demoAnswerSets(id)[name],
          lang,
        );
        assert.equal(res.status, 200);
        const json = JSON.parse(res.text);
        assert.equal(Object.hasOwn(json, "ranking"), false);
        assert.deepEqual(Object.keys(json), [
          "clear_leader",
          "recommended",
          "no_match_text",
          "hypotheses",
        ]);
        const given = json.recommended.map((x) => x.id);
        for (const sid of all) {
          assert.equal(
            res.text.includes(sid),
            given.includes(sid),
            `${id} ${name} ${lang}: ${sid}`,
          );
        }
        if (name === "none") {
          assert.deepEqual(given, []);
          assert.equal(json.no_match_text, plain.result.no_match_text[lang]);
        }
      }
    }
  }
});

// ---------------------------------------------------------------------- SF-6n

test("SF-6n: a program error in the command ends the process with code 3, an empty stdout and a stack in stderr with no 'picker:' prefix - also from the code that runs later (serve); no file of the picker imports cli.js and cli.js exports nothing", (t) => {
  const dir = makeTmp(t);
  const file = path.join(dir, "ok-minimal.json");
  fs.writeFileSync(file, fixtureBytes("ok-minimal.json"));
  const cli = path.join(PICKER, "cli.js");
  const run = (args, fault) =>
    spawnSync(process.execPath, ["--import", FAULT_PATH, cli, ...args], {
      cwd: TOOLS,
      env: { PATH: process.env.PATH, SAI_TEST_FAULTS: JSON.stringify([fault]) },
      encoding: "utf8",
      timeout: 30000,
    });
  const check = run(["check", file], {
    fn: "lstatSync",
    paths: [file],
    effect: "bug",
  });
  assert.equal(check.status, 3);
  assert.equal(check.stdout, "");
  assert.match(check.stderr, /injected bug/u);
  assert.match(check.stderr, / {4}at /u);
  assert.doesNotMatch(check.stderr, /^picker: /mu);
  const tenants = makeTenantDir(t, {
    "uchet-pro.json": demoBytes("uchet-pro"),
  });
  const target = path.join(tenants, "uchet-pro.json");
  const serve = run(["serve", "--tenants", tenants, "--port", "0"], {
    fn: "lstatSync",
    paths: [target],
    effect: "bug",
  });
  assert.equal(serve.status, 3);
  assert.equal(serve.stdout, "");
  assert.match(serve.stderr, /injected bug/u);
  assert.match(serve.stderr, / {4}at /u);
  assert.doesNotMatch(serve.stderr, /^picker: /mu);
  // an error of the system is still code 2
  const eio = run(["check", file], {
    fn: "lstatSync",
    paths: [file],
    effect: "throw",
    code: "EIO",
  });
  assert.equal(eio.status, 2);
  // nobody imports cli.js, and it exports nothing
  for (const name of fs
    .readdirSync(PICKER)
    .filter((n) => n.endsWith(".js") && n !== "cli.js")) {
    assert.doesNotMatch(
      sourceOf(name),
      /from "\.\/cli\.js"|import\("\.\/cli\.js"\)|picker\/cli\.js/u,
      name,
    );
  }
  assert.doesNotMatch(sourceOf("cli.js"), /^export\b/mu);
  assert.deepEqual(fs.readFileSync(file), fixtureBytes("ok-minimal.json"));
});
