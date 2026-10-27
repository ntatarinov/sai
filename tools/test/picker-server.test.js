// SV-1 ... SV-8: the server of the picker site on 127.0.0.1 (design docs/design/
// REQ-056-picker-server.md, section 9.1): start and links, the questionnaire, the unknown
// tenant, the tenant only from the path, the stand, the checks of a request, no call out.
// Every server listens on port 0 and is closed in t.after. The expected answers are built
// in picker-server-helpers.js from the files and from the engine, not from src/.
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { test } from "node:test";
import { checkFile } from "../src/picker/check.js";
import { DEFAULT_PORT, HOST } from "../src/picker/config.js";
import { parseServeArguments } from "../src/picker/serve.js";
import * as publicData from "../src/picker/public-data.js";
import { publicQuestionnaire } from "../src/picker/public-data.js";
import { loadTenants } from "../src/picker/tenants.js";
import { installFaults } from "./fault-inject.js";
import { deepFreeze, sets } from "./picker-engine-helpers.js";
import {
  EXPECTED,
  LEGACY_TENANTS,
  PICKER,
  TOOLS,
  fixtureBytes,
  makeRng,
  makeTmp,
  runPicker,
} from "./picker-helpers.js";
import {
  IDS,
  LANGS,
  NOT_FOUND_BODY,
  PUBLIC_DIR,
  allLanguages,
  codeOf,
  demoAnswerSets,
  demoBytes,
  demoDir,
  demoPlain,
  expectedQuestionnaire,
  expectedResult,
  foreignStrings,
  getJson,
  keyPaths,
  legacyBytes,
  listingDigest,
  makeTenantDir,
  portRefuses,
  rawExchange,
  request,
  resultRequest,
  sha256,
  signature,
  sourceOf,
  spawnCli,
  startForTest,
  startPickerClosing,
  stringValues,
  textFor,
} from "./picker-server-helpers.js";
import {
  OFFICES,
  expectedFallback,
  expectedLook,
  expectedObject,
  languageView,
  lookFixtureBytes,
  lookFixtureJson,
  lookStrings,
  officeDir,
  walkNumbers,
} from "./picker-look-helpers.js";

const PAGE = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"));
const SEE = "Справка: npm run picker -- --help";
const NO_TENANTS =
  "Не указана папка арендаторов. Пример: npm run picker -- serve --tenants <папка>";
const COMMON = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

// ---------------------------------------------------------------------- SV-1

const startLines = (port) => [
  "Сайт подбора запущен. Откройте ссылки:",
  `http://127.0.0.1:${port}/t/svet-marketing/`,
  `http://127.0.0.1:${port}/t/uchet-pro/`,
  "Изменения файлов арендаторов применяются после перезапуска.",
  "Остановить сайт: Ctrl+C.",
];

test("SV-1a: the command prints the five lines with one real port in both links and an empty stderr (directly and through npm); after SIGTERM and after SIGINT it ends with code 0 within 5 s and the port is closed", async (t) => {
  for (const viaNpm of [false, true]) {
    const run = spawnCli(
      t,
      ["serve", "--tenants", "src/picker/demo-tenants", "--port", "0"],
      { viaNpm },
    );
    const lines = await run.waitLines(5);
    const port = Number(/:(\d+)\/t\/svet-marketing\/$/u.exec(lines[1])?.[1]);
    assert.ok(port > 0, lines[1]);
    assert.deepEqual(lines, startLines(port), `npm=${viaNpm}`);
    assert.equal(run.stderr(), "", `npm=${viaNpm}`);
    const page = await request(port, { path: "/t/uchet-pro/" });
    assert.equal(page.status, 200);
    if (!viaNpm) {
      const started = Date.now();
      const done = await run.stop("SIGTERM");
      assert.equal(done.code, 0);
      assert.ok(Date.now() - started < 5000);
      assert.equal(await portRefuses(port), true);
    } else {
      await run.stop("SIGTERM").catch(() => {});
    }
  }
  const second = spawnCli(t, [
    "serve",
    "--tenants",
    "src/picker/demo-tenants",
    "--port",
    "0",
  ]);
  const lines = await second.waitLines(5);
  const port = Number(/:(\d+)\/t\/svet-marketing\/$/u.exec(lines[1])[1]);
  const done = await second.stop("SIGINT");
  assert.equal(done.code, 0);
  assert.equal(second.stderr(), "");
  assert.equal(await portRefuses(port), true);
});

test("SV-1b: the server listens on 127.0.0.1 only - startPicker gives the address of the socket, a connection to ::1 is refused, config.HOST is 127.0.0.1", async (t) => {
  const dir = demoDir(t);
  const s = await startForTest(t, dir);
  assert.equal(s.ok, true);
  assert.equal(s.address, "127.0.0.1");
  assert.equal(HOST, "127.0.0.1");
  assert.equal(DEFAULT_PORT, 4782);
  const code = await new Promise((resolve) => {
    const socket = net.connect({ host: "::1", port: s.port });
    socket.on("connect", () => {
      socket.destroy();
      resolve("connected");
    });
    socket.on("error", (err) => resolve(err.code));
  });
  assert.ok(["ECONNREFUSED", "EADDRNOTAVAIL"].includes(code), code);
  assert.deepEqual(s.ids, ["svet-marketing", "uchet-pro"]);
});

const wantRefusal = (text) => `picker: ${text}`;

test("SV-1c: 17 calls of the command that are refused give code 2, an empty stdout and the one line of the table, with no stack", (t) => {
  const dir = demoDir(t);
  const file = path.join(dir, "uchet-pro.json");
  const big = makeTenantDir(
    t,
    Object.fromEntries(
      Array.from({ length: 101 }, (_, i) => [
        `f${String(i).padStart(3, "0")}.json`,
        "{}",
      ]),
    ),
  );
  const gone = path.join(dir, "no-such-folder");
  const port = (value) =>
    wantRefusal(`Порт — целое число от 0 до 65535 (сейчас: ${value}).`);
  const cases = [
    [["serve"], wantRefusal(NO_TENANTS)],
    [["serve", "--tenants"], wantRefusal("Ключ --tenants требует значение.")],
    [
      ["serve", "--port", "--tenants", "x"],
      wantRefusal("Ключ --port требует значение."),
    ],
    [
      ["serve", "--tenants", "x", "--port="],
      wantRefusal("Ключ --port требует значение."),
    ],
    [
      ["serve", "--tenants=--x"],
      wantRefusal("Ключ --tenants требует значение."),
    ],
    [
      ["serve", "--tenants", ""],
      wantRefusal("Ключ --tenants требует значение."),
    ],
    [
      ["serve", "--bogus", "1"],
      wantRefusal(`Неизвестный ключ --bogus. ${SEE}`),
    ],
    [
      ["serve", "--tenants", "a", "--tenants", "b"],
      wantRefusal("Ключ --tenants указан дважды."),
    ],
    [
      ["serve", "--tenants", "x", "word"],
      wantRefusal(`Лишний аргумент word. ${SEE}`),
    ],
    [["serve", "--tenants", dir, "--port", "abc"], port("abc")],
    [["serve", "--tenants", dir, "--port", "70000"], port("70000")],
    [["serve", "--tenants", dir, "--port", "1e3"], port("1e3")],
    [["serve", "--tenants", dir, "--port", "-1"], port("-1")],
    [["serve", "--tenants", dir, "--port", "0x10"], port("0x10")],
    [
      ["serve", "--tenants", gone, "--port", "0"],
      wantRefusal(
        "Папка арендаторов не найдена: no-such-folder. Проверьте путь.",
      ),
    ],
    [
      ["serve", "--tenants", file, "--port", "0"],
      wantRefusal(
        "uchet-pro.json — не папка. Укажите папку с файлами арендаторов.",
      ),
    ],
    [
      ["serve", "--tenants", big, "--port", "0"],
      wantRefusal(
        `В папке ${path.basename(big)} больше 100 файлов арендаторов. Оставьте нужные.`,
      ),
    ],
  ];
  assert.equal(cases.length, 17);
  const before = listingDigest(dir);
  for (const [args, line] of cases) {
    const run = runPicker(args);
    const label = JSON.stringify(args.slice(0, 4));
    assert.equal(run.code, 2, label);
    assert.equal(run.stdout, "", label);
    assert.deepEqual(run.err, [line], label);
    assert.doesNotMatch(run.stderr, / {4}at /u, label);
  }
  assert.deepEqual(listingDigest(dir), before);
});

test("SV-1c2: startPicker called with a wrong option gives { ok: false, exitCode: 2, lines } as a value and opens no port; without a port it tries 4782 (either it starts there or it says the port is taken)", async (t) => {
  const dir = demoDir(t);
  const io = { out() {}, err() {} };
  const cases = [
    [{ tenants: dir, bogus: 1 }, "Неизвестный параметр запуска bogus."],
    [{}, NO_TENANTS],
    [{ tenants: "" }, NO_TENANTS],
    [
      { tenants: dir, port: 65536 },
      "Порт — целое число от 0 до 65535 (сейчас: 65536).",
    ],
    [
      { tenants: dir, port: 1.5 },
      "Порт — целое число от 0 до 65535 (сейчас: 1.5).",
    ],
  ];
  for (const [options, text] of cases) {
    const r = await startPickerClosing(t, options, io);
    assert.deepEqual(
      r,
      { ok: false, exitCode: 2, lines: [`picker: ${text}`] },
      JSON.stringify(options),
    );
  }
  const r = await startPickerClosing(t, { tenants: dir }, io);
  if (r.ok) {
    t.after(() => r.close());
    assert.equal(r.port, 4782);
    assert.equal(r.address, "127.0.0.1");
  } else {
    assert.equal(r.exitCode, 1);
    assert.deepEqual(r.lines, [
      "picker: Порт 4782 занят. Освободите его или запустите с другим: npm run picker -- serve --tenants <папка> --port <номер>",
    ]);
  }
});

test("SV-1d: GET of every printed link is 200, text/html and the bytes of public/index.html", async (t) => {
  const s = await startForTest(t, demoDir(t));
  for (const id of s.ids) {
    for (const suffix of ["", "?lang=kk", "?lang=en", "?lang=de"]) {
      const res = await request(s.port, { path: `/t/${id}/${suffix}` });
      assert.equal(res.status, 200, id);
      assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
      assert.deepEqual(res.body, PAGE, id);
    }
  }
});

test("SV-1e: GET /t/<id> is 308 to /t/<id>/ for a tenant and for none, with the same headers and an empty body; the query is dropped", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const a = await request(s.port, { path: "/t/uchet-pro" });
  const b = await request(s.port, { path: "/t/net-takogo" });
  assert.equal(a.status, 308);
  assert.equal(b.status, 308);
  assert.equal(a.headers.location, "/t/uchet-pro/");
  assert.equal(b.headers.location, "/t/net-takogo/");
  assert.equal(a.text, "");
  assert.equal(b.text, "");
  const strip = (r) => {
    const h = { ...r.headers };
    delete h.date;
    delete h.location;
    return h;
  };
  assert.deepEqual(strip(a), strip(b));
  assert.equal(a.headers["content-length"], "0");
  const q = await request(s.port, { path: "/t/uchet-pro?lang=kk" });
  assert.equal(q.status, 308);
  assert.equal(q.headers.location, "/t/uchet-pro/");
  const evil = await request(s.port, {
    path: "/t/uchet-pro?next=http://x.example",
  });
  assert.equal(evil.headers.location, "/t/uchet-pro/");
});

test("SV-1f: every file of public/ is served at /assets/<name> - 200, the type of its extension and its bytes", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
  };
  const names = fs.readdirSync(PUBLIC_DIR).sort();
  assert.ok(
    names.includes("index.html") &&
      names.includes("texts.js") &&
      names.includes("main.js"),
  );
  for (const name of names) {
    assert.match(name, /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u);
    const ext = path.extname(name);
    assert.ok(Object.hasOwn(types, ext), name);
    const res = await request(s.port, { path: `/assets/${name}` });
    assert.equal(res.status, 200, name);
    assert.equal(res.headers["content-type"], types[ext], name);
    assert.deepEqual(
      res.body,
      fs.readFileSync(path.join(PUBLIC_DIR, name)),
      name,
    );
  }
});

test("SV-1g: a taken port gives code 1 and the line of the table; the default port is 4782; --port 0 and --port=0 are the same; --home is taken and creates nothing", async (t) => {
  const dir = demoDir(t);
  const holder = net.createServer();
  await new Promise((resolve) => holder.listen(0, "127.0.0.1", resolve));
  t.after(() => holder.close());
  const taken = holder.address().port;
  const line = `picker: Порт ${taken} занят. Освободите его или запустите с другим: npm run picker -- serve --tenants <папка> --port <номер>`;
  const r = await startPickerClosing(
    t,
    { tenants: dir, port: taken },
    { out() {}, err() {} },
  );
  assert.deepEqual(r, { ok: false, exitCode: 1, lines: [line] });
  const run = runPicker(["serve", "--tenants", dir, "--port", String(taken)]);
  assert.equal(run.code, 1);
  assert.equal(run.stdout, "");
  assert.deepEqual(run.err, [line]);
  assert.equal(parseServeArguments(["--tenants", "x"]).port, 4782);
  assert.equal(DEFAULT_PORT, 4782);
  assert.deepEqual(
    parseServeArguments(["--tenants", "x", "--port", "0"]),
    parseServeArguments(["--tenants", "x", "--port=0"]),
  );
  assert.equal(parseServeArguments(["--tenants", "x", "--port=0"]).port, 0);
  // --home is taken, nothing is made
  const parent = makeTmp(t);
  const home = path.join(parent, "home-folder");
  const before = listingDigest(parent);
  const s = await startForTest(t, dir, { home });
  assert.equal(s.ok, true);
  assert.equal(fs.existsSync(home), false);
  assert.deepEqual(listingDigest(parent), before);
  assert.deepEqual(
    parseServeArguments(["--tenants", "x", "--home", home]).home,
    home,
  );
});

test("SV-1h: the command on a folder with one right file, a broken one, a text file and a folder named x.json - one link in stdout, the blocks of design 4.3 in stderr", async (t) => {
  const bad = fixtureBytes("e-field-extra-top.json");
  const dir = makeTenantDir(t, {
    "uchet-pro.json": demoBytes("uchet-pro"),
    "e-field-extra-top.json": bad,
    "notes.txt": "not a tenant",
    "sub.json": (d, name) => fs.mkdirSync(path.join(d, name)),
  });
  const before = listingDigest(dir);
  const run = spawnCli(t, ["serve", "--tenants", dir, "--port", "0"]);
  const lines = await run.waitLines(4);
  const port = Number(/:(\d+)\//u.exec(lines[1])[1]);
  assert.deepEqual(lines, [
    "Сайт подбора запущен. Откройте ссылки:",
    `http://127.0.0.1:${port}/t/uchet-pro/`,
    "Изменения файлов арендаторов применяются после перезапуска.",
    "Остановить сайт: Ctrl+C.",
  ]);
  assert.equal(
    run.stderr(),
    [
      "Арендатор e-field-extra-top.json не обслуживается:",
      ...EXPECTED["e-field-extra-top.json"].lines,
      "Арендатор sub.json не обслуживается:",
      "sub.json — папка, а не файл. Укажите файл арендатора.",
      "",
    ].join("\n"),
  );
  const miss = await request(port, { path: "/t/e-field-extra-top/" });
  assert.equal(miss.text, NOT_FOUND_BODY);
  assert.equal((await run.stop("SIGTERM")).code, 0);
  assert.deepEqual(listingDigest(dir), before);
});

test("SV-1i: when the reader of the output is gone (a pipe closed by head) the site goes on answering", async (t) => {
  const dir = makeTenantDir(t, {
    "uchet-pro.json": demoBytes("uchet-pro"),
    "e-field-extra-top.json": fixtureBytes("e-field-extra-top.json"),
  });
  const holder = net.createServer();
  await new Promise((resolve) => holder.listen(0, "127.0.0.1", resolve));
  const port = holder.address().port;
  await new Promise((resolve) => holder.close(resolve));
  const { spawn } = await import("node:child_process");
  const cli = path.join(PICKER, "cli.js");
  const child = spawn(
    "sh",
    [
      "-c",
      `exec node "${cli}" serve --tenants "${dir}" --port ${port} 2>&1 | head -1`,
    ],
    { cwd: TOOLS, detached: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // already gone
    }
  });
  let first = "";
  child.stdout.on("data", (c) => {
    first += c.toString("utf8");
  });
  let answer = null;
  for (let i = 0; i < 80 && answer === null; i++) {
    await new Promise((r) => setTimeout(r, 100));
    answer = await request(port, {
      path: "/t/uchet-pro/api/questionnaire",
    }).catch(() => null);
  }
  assert.notEqual(answer, null, "the server answers");
  assert.equal(answer.status, 200);
  await new Promise((r) => setTimeout(r, 400));
  const later = await request(port, { path: "/t/uchet-pro/api/questionnaire" });
  assert.equal(later.status, 200);
  assert.equal(
    first.trim(),
    "Арендатор e-field-extra-top.json не обслуживается:",
  );
});

// ---------------------------------------------------------------------- SV-2

const tenantsOf = (id) => ({
  plain: demoPlain(id),
  bytes: demoBytes(id),
});

test("SV-2a: for each tenant and language the questionnaire equals the object built from the file - the fields of design 5.3 in their order, the texts in that language", async (t) => {
  const s = await startForTest(t, demoDir(t));
  for (const id of IDS) {
    const { plain, bytes } = tenantsOf(id);
    for (const lang of LANGS) {
      const res = await request(s.port, {
        path: `/t/${id}/api/questionnaire?lang=${lang}`,
      });
      assert.equal(res.status, 200, `${id} ${lang}`);
      const want = expectedQuestionnaire(plain, lang, sha256(bytes));
      assert.deepEqual(JSON.parse(res.text), want, `${id} ${lang}`);
      assert.equal(res.text, JSON.stringify(want), `${id} ${lang}: key order`);
    }
  }
  // the two files of the form /3: the oracle is the form of design 7.1 of REQ-069
  const office = await startForTest(t, officeDir(t));
  for (const id of OFFICES) {
    const plain = lookFixtureJson(id);
    const bytes = lookFixtureBytes(id);
    for (const lang of LANGS) {
      const res = await request(office.port, {
        path: `/t/${id}/api/questionnaire?lang=${lang}`,
      });
      assert.equal(res.status, 200, `${id} ${lang}`);
      const want = expectedQuestionnaire(plain, lang, sha256(bytes));
      assert.deepEqual(JSON.parse(res.text), want, `${id} ${lang}`);
      assert.equal(res.text, JSON.stringify(want), `${id} ${lang}: key order`);
    }
  }
});

const ALLOWED_QUESTION = [
  "id",
  "title",
  "help",
  "type",
  "required",
  "options",
  "min",
  "max",
  "unit",
  "show_if",
];
const NEVER = [
  "rules",
  "when",
  "points",
  "solutions",
  "hypotheses",
  "result",
  "top",
  "min_score",
  "clear_lead_gap",
  "no_match_text",
  "schema",
  "enabled",
  "text",
  "solution",
  "explanation",
  "includes",
  "next_steps",
  "price_text",
  "file",
  "path",
  "max_per_hour",
  "max_stored",
];

test("SV-2b: the keys of every level of the questionnaire are those of the table of design 5.3, and none of the forbidden names stands anywhere", async (t) => {
  const s = await startForTest(t, demoDir(t));
  for (const id of IDS) {
    for (const lang of LANGS) {
      const { json } = await getJson(
        s.port,
        `/t/${id}/api/questionnaire?lang=${lang}`,
      );
      const places = keyPaths(json);
      const top = places.find((p) => p.place === "$");
      assert.deepEqual(top.keys, [
        "version",
        "lang",
        "languages",
        "name",
        "intro",
        "questions_min",
        "questions_max",
        "questions",
        "ai",
        "leads",
      ]);
      for (const p of places) {
        for (const forbidden of NEVER)
          assert.equal(
            p.keys.includes(forbidden),
            false,
            `${p.place}: ${forbidden}`,
          );
        if (p.place === "$.questions[]")
          for (const k of p.keys) assert.ok(ALLOWED_QUESTION.includes(k), k);
        if (p.place === "$.questions[].options[]")
          assert.deepEqual(p.keys, ["id", "label"]);
        if (p.place === "$.questions[].show_if[]") {
          assert.equal(p.keys[0], "question");
          for (const k of p.keys.slice(1))
            assert.ok(["any_of", "none_of", "min", "max"].includes(k), k);
        }
        if (p.place === "$.leads")
          assert.deepEqual(p.keys, [
            "contact_fields",
            "consent_text",
            "operator_name",
            "privacy_contact",
            "retention_days",
          ]);
      }
      assert.equal(top.keys.includes("id"), false);
      // a question has its id, title, type and required, always
      for (const p of places.filter((x) => x.place === "$.questions[]")) {
        for (const k of ["id", "title", "type", "required"])
          assert.ok(p.keys.includes(k), k);
      }
    }
  }
  // the files of the form /3: the keys of every level are those of 7.1 and 7.2 of REQ-069
  const office = await startForTest(t, officeDir(t));
  const QUESTION_ORDER = [
    "id",
    "title",
    "help",
    "type",
    "required",
    "options",
    "min",
    "max",
    "unit",
    "chips",
    "desk",
    "show_if",
  ];
  for (const id of OFFICES) {
    const plain = lookFixtureJson(id);
    for (const lang of LANGS) {
      const { json } = await getJson(
        office.port,
        `/t/${id}/api/questionnaire?lang=${lang}`,
      );
      const places = keyPaths(json);
      const keysAt = (place) =>
        places.filter((p) => p.place === place).map((p) => p.keys);
      const label = `${id} ${lang}`;
      assert.deepEqual(
        keysAt("$"),
        [
          [
            "version",
            "lang",
            "languages",
            "name",
            "look",
            "intro",
            "questions_min",
            "questions_max",
            "questions",
            "ai",
            "leads",
          ],
        ],
        label,
      );
      assert.deepEqual(
        keysAt("$.look"),
        [["mark", "tagline", "industry", "headline", "colors", "team"]],
        label,
      );
      assert.deepEqual(keysAt("$.look.colors"), [["light", "dark"]], label);
      assert.deepEqual(keysAt("$.look.colors.light"), [["accent", "accent2"]]);
      assert.deepEqual(keysAt("$.look.colors.dark"), [["accent", "accent2"]]);
      assert.deepEqual(
        keysAt("$.look.team[]"),
        Array(4).fill(["name", "role", "says", "figure", "shirt"]),
        label,
      );
      assert.deepEqual(
        keysAt("$.questions[]"),
        plain.questions.map((q) =>
          QUESTION_ORDER.filter((k) => Object.hasOwn(q, k)),
        ),
        label,
      );
      assert.deepEqual(
        keysAt("$.questions[].options[]"),
        plain.questions.flatMap((q) =>
          (q.options ?? []).map((o) =>
            Object.hasOwn(o, "object")
              ? ["id", "label", "object"]
              : ["id", "label"],
          ),
        ),
        label,
      );
      assert.deepEqual(
        keysAt("$.questions[].options[].object"),
        plain.questions.flatMap((q) =>
          (q.options ?? [])
            .filter((o) => Object.hasOwn(o, "object"))
            .map((o) => Object.keys(expectedObject(o.object))),
        ),
        label,
      );
      assert.deepEqual(
        keysAt("$.leads"),
        [
          [
            "contact_fields",
            "whatsapp",
            "consent_text",
            "operator_name",
            "privacy_contact",
            "retention_days",
          ],
        ],
        label,
      );
      for (const p of places)
        for (const forbidden of NEVER)
          assert.equal(
            p.keys.includes(forbidden),
            false,
            `${label} ${p.place}: ${forbidden}`,
          );
    }
  }
});

// The values the other tenant owns, that no answer of this one may hold.
const SERVICE = new Set([
  "single",
  "multiple",
  "number",
  "phone",
  "email",
  "ru",
  "kk",
  "en",
  "schema",
]);

async function everyAnswerOf(port, id) {
  const bodies = [];
  const sets3 = demoAnswerSets(id);
  for (const lang of LANGS) {
    bodies.push(
      (await request(port, { path: `/t/${id}/api/questionnaire?lang=${lang}` }))
        .text,
    );
    bodies.push((await request(port, { path: `/t/${id}/?lang=${lang}` })).text);
    for (const name of ["leader", "close", "none"]) {
      const res = await resultRequest(port, id, sets3[name], lang);
      assert.equal(res.status, 200, `${id} ${lang} ${name}`);
      bodies.push(res.text);
    }
  }
  return bodies;
}

test("SV-2c: no id and no text of one tenant stands in any answer for the other (the questionnaire, the page, three results in each language), checked by values and, for strings of 15 signs or more, in the raw body", async (t) => {
  const s = await startForTest(t, demoDir(t));
  for (const [mine, other] of [IDS, [...IDS].reverse()]) {
    const bodies = await everyAnswerOf(s.port, mine);
    const foreign = [...foreignStrings(demoPlain(other))].filter(
      (x) => !SERVICE.has(x),
    );
    assert.ok(foreign.length > 150);
    const own = new Set(foreignStrings(demoPlain(mine)));
    for (const body of bodies) {
      let values = [];
      try {
        values = stringValues(JSON.parse(body));
      } catch {
        // the page is no JSON
      }
      for (const value of values) {
        if (SERVICE.has(value) || own.has(value)) continue;
        assert.equal(foreign.includes(value), false, `${mine} holds ${value}`);
      }
      for (const word of foreign) {
        if ([...word].length >= 15)
          assert.equal(body.includes(word), false, `${mine}: ${word}`);
      }
    }
  }
});

test("SV-2d: the version is the sha256 of the bytes of the file, one for all the languages, the same after a restart, different after a change of one sign (also a line break at the end), and a change on the disk while the server runs changes nothing", async (t) => {
  const bytes = demoBytes("uchet-pro");
  const dir = makeTenantDir(t, { "uchet-pro.json": bytes });
  const versionOf = async (s, lang = "ru") =>
    (await getJson(s.port, `/t/uchet-pro/api/questionnaire?lang=${lang}`)).json
      .version;
  const one = await startForTest(t, dir);
  const v = await versionOf(one);
  assert.match(v, /^[0-9a-f]{64}$/u);
  assert.equal(v, sha256(bytes));
  for (const lang of LANGS) assert.equal(await versionOf(one, lang), v, lang);
  const bodyBefore = (
    await request(one.port, { path: "/t/uchet-pro/api/questionnaire" })
  ).text;
  // the file changes while the server runs
  fs.appendFileSync(path.join(dir, "uchet-pro.json"), "\n");
  assert.equal(await versionOf(one), v);
  assert.equal(
    (await request(one.port, { path: "/t/uchet-pro/api/questionnaire" })).text,
    bodyBefore,
  );
  await one.close();
  // after a restart: the new bytes
  const two = await startForTest(t, dir);
  const changed = await versionOf(two);
  assert.equal(
    changed,
    sha256(fs.readFileSync(path.join(dir, "uchet-pro.json"))),
  );
  assert.notEqual(changed, v, "a line break at the end changes the version");
  await two.close();
  // a space inside a value
  const text = bytes.toString("utf8").replace("Учёт-Про", "Учёт-Про ");
  fs.writeFileSync(path.join(dir, "uchet-pro.json"), text);
  const three = await startForTest(t, dir);
  const third = await versionOf(three);
  assert.equal(third, sha256(Buffer.from(text)));
  assert.notEqual(third, v);
  assert.notEqual(third, changed);
  await three.close();
  // restart without a change: the same
  const four = await startForTest(t, dir);
  assert.equal(await versionOf(four), third);
});

test("SV-2e: the language - none gives ru; ?lang=kk gives kk; de, KK, empty, 'kk,en' and ' kk' count as none; the first of two lang wins; Accept-Language is not read; a file of the form /1 gives ru for every lang", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const base = (
    await request(s.port, { path: "/t/uchet-pro/api/questionnaire" })
  ).text;
  assert.equal(JSON.parse(base).lang, "ru");
  const kk = await getJson(s.port, "/t/uchet-pro/api/questionnaire?lang=kk");
  assert.equal(kk.json.lang, "kk");
  assert.equal(kk.json.name, demoPlain("uchet-pro").name.kk);
  for (const q of [
    "?lang=de",
    "?lang=KK",
    "?lang=",
    "?lang=kk,en",
    "?lang=%20kk",
    "?lang=kk%2Cen",
  ]) {
    assert.equal(
      (await request(s.port, { path: `/t/uchet-pro/api/questionnaire${q}` }))
        .text,
      base,
      q,
    );
  }
  const two = await getJson(
    s.port,
    "/t/uchet-pro/api/questionnaire?lang=kk&lang=en",
  );
  assert.equal(two.json.lang, "kk");
  const header = await request(s.port, {
    path: "/t/uchet-pro/api/questionnaire",
    headers: { "Accept-Language": "kk" },
  });
  assert.equal(header.text, base);
  const both = await request(s.port, {
    path: "/t/uchet-pro/api/questionnaire?lang=en",
    headers: { "Accept-Language": "kk" },
  });
  assert.equal(JSON.parse(both.text).lang, "en");
  // a file of the form /1
  const dir = makeTenantDir(t, { "uchet-pro.json": legacyBytes("uchet-pro") });
  const legacy = await startForTest(t, dir);
  const l1 = await getJson(
    legacy.port,
    "/t/uchet-pro/api/questionnaire?lang=kk",
  );
  assert.deepEqual(l1.json.languages, ["ru"]);
  assert.equal(l1.json.lang, "ru");
  const l2 = await getJson(legacy.port, "/t/uchet-pro/api/questionnaire");
  assert.equal(l1.text, l2.text);
  assert.equal(
    l2.json.name,
    JSON.parse(legacyBytes("uchet-pro").toString("utf8")).name,
  );
});

test("SV-2f: questions_min and questions_max count the questions without show_if and all (8/12 and 7/11); ai is false; leads of the first is an object with its fields, of the second null; a copy with leads switched off gives null", async (t) => {
  const copy = demoPlain("uchet-pro");
  copy.leads.enabled = false;
  copy.id = "uchet-off";
  const dir = makeTenantDir(t, {
    "uchet-pro.json": demoBytes("uchet-pro"),
    "svet-marketing.json": demoBytes("svet-marketing"),
    "uchet-off.json": JSON.stringify(copy),
  });
  const s = await startForTest(t, dir);
  const u = (await getJson(s.port, "/t/uchet-pro/api/questionnaire")).json;
  const v = (await getJson(s.port, "/t/svet-marketing/api/questionnaire")).json;
  assert.deepEqual([u.questions_min, u.questions_max], [8, 12]);
  assert.deepEqual([v.questions_min, v.questions_max], [7, 11]);
  assert.equal(u.ai, false);
  assert.equal(v.ai, false);
  assert.deepEqual(u.leads.contact_fields, ["phone", "email"]);
  assert.equal(u.leads.retention_days, 30);
  for (const lang of LANGS) {
    const k = (
      await getJson(s.port, `/t/uchet-pro/api/questionnaire?lang=${lang}`)
    ).json;
    assert.equal(
      k.leads.consent_text,
      demoPlain("uchet-pro").leads.consent_text[lang],
    );
  }
  assert.equal(
    u.leads.operator_name,
    demoPlain("uchet-pro").leads.operator_name,
  );
  assert.equal(v.leads, null);
  const off = (await getJson(s.port, "/t/uchet-off/api/questionnaire")).json;
  assert.equal(off.leads, null);
});

test("SV-2g: publicQuestionnaire on a view with extra fields at every level gives only the listed fields", () => {
  const view = deepFreeze({
    name: "N",
    intro: "I",
    internal_note: "secret",
    rules: [{ id: "r", points: 3 }],
    solutions: [{ id: "s" }],
    questions: [
      {
        id: "q",
        title: "T",
        type: "single",
        required: true,
        internal_note: "secret",
        points: 5,
        options: [{ id: "o", label: "L", points: 3, note: "x" }],
        show_if: [{ question: "p", any_of: ["a"], note: "x" }],
      },
      {
        id: "n",
        title: "N",
        type: "number",
        required: false,
        min: 1,
        max: 5,
        unit: "u",
        rules: 1,
      },
    ],
    leads: {
      enabled: true,
      contact_fields: ["phone"],
      consent_text: "C",
      operator_name: "O",
      privacy_contact: "P",
      retention_days: 3,
      internal: "x",
    },
    result: { top: 1 },
  });
  const out = publicQuestionnaire(view, {
    version: "v",
    lang: "ru",
    languages: ["ru"],
  });
  assert.deepEqual(Object.keys(out), [
    "version",
    "lang",
    "languages",
    "name",
    "intro",
    "questions_min",
    "questions_max",
    "questions",
    "ai",
    "leads",
  ]);
  assert.deepEqual(Object.keys(out.questions[0]), [
    "id",
    "title",
    "type",
    "required",
    "options",
    "show_if",
  ]);
  assert.deepEqual(Object.keys(out.questions[0].options[0]), ["id", "label"]);
  assert.deepEqual(Object.keys(out.questions[0].show_if[0]), [
    "question",
    "any_of",
  ]);
  assert.deepEqual(Object.keys(out.questions[1]), [
    "id",
    "title",
    "type",
    "required",
    "min",
    "max",
    "unit",
  ]);
  assert.deepEqual(Object.keys(out.leads), [
    "contact_fields",
    "consent_text",
    "operator_name",
    "privacy_contact",
    "retention_days",
  ]);
  assert.equal(JSON.stringify(out).includes("secret"), false);
  assert.equal(out.questions_min, 1);
  assert.equal(out.questions_max, 2);
  // the arrays are copies
  assert.notEqual(out.leads.contact_fields, view.leads.contact_fields);
  assert.notEqual(
    out.questions[0].show_if[0].any_of,
    view.questions[0].show_if[0].any_of,
  );
  // a view of the form /3 with extra fields at every new level (REQ-069): only the listed
  // fields leave, in the order of 7.1, the input is frozen and stays as it was
  const plain = lookFixtureJson("ok-office-a");
  const noisy = structuredClone(languageView(plain, "kk"));
  noisy.look.logo = "x";
  noisy.look.colors.sepia = { accent: "#000000" };
  noisy.look.colors.light.extra = 1;
  noisy.look.colors.dark.extra = 1;
  for (const staff of noisy.look.team) staff.age = 30;
  for (const q of noisy.questions) {
    q.points = 5;
    if (q.chips !== undefined) q.chips.extra = 1;
    for (const o of q.options ?? []) {
      o.score = 3;
      if (o.object !== undefined) o.object.size = 4;
    }
  }
  noisy.leads.internal = "x";
  noisy.leads.token = "y";
  const noisyText = JSON.stringify(noisy);
  deepFreeze(noisy);
  const options = { version: "v", lang: "kk", languages: ["ru", "kk", "en"] };
  const wanted = expectedQuestionnaire(plain, "kk", "v");
  const got = publicQuestionnaire(noisy, options);
  assert.equal(JSON.stringify(got), JSON.stringify(wanted));
  assert.deepEqual(got, wanted);
  assert.equal(JSON.stringify(noisy), noisyText, "the input is not changed");
  assert.deepEqual(Object.keys(got.look), [
    "mark",
    "tagline",
    "industry",
    "headline",
    "colors",
    "team",
  ]);
  assert.deepEqual(Object.keys(got.look.team[0]), [
    "name",
    "role",
    "says",
    "figure",
    "shirt",
  ]);
  assert.deepEqual(Object.keys(got.leads), [
    "contact_fields",
    "whatsapp",
    "consent_text",
    "operator_name",
    "privacy_contact",
    "retention_days",
  ]);
  const own = publicData.publicLook(noisy.look);
  assert.equal(JSON.stringify(own), JSON.stringify(expectedLook(plain, "kk")));
  assert.equal(JSON.stringify(got).includes("max_per_hour"), false);
  assert.equal(JSON.stringify(got).includes("internal"), false);
  // the arrays and objects are copies
  assert.notEqual(got.questions[2].chips, noisy.questions[2].chips);
  assert.notEqual(got.look.team, noisy.look.team);
  assert.notEqual(got.look.colors, noisy.look.colors);
  // a view of the form /2 (no look of its own): no look, no whatsapp
  const old = publicQuestionnaire(languageView(demoPlain("uchet-pro"), "ru"), {
    ...options,
    lang: "ru",
  });
  assert.equal(Object.hasOwn(old, "look"), false);
  assert.equal(Object.hasOwn(old.leads, "whatsapp"), false);
});

test("SV-2h: two requests give the same bytes; the type is application/json; charset=utf-8; Content-Length is the length of the body", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const a = await request(s.port, {
    path: "/t/svet-marketing/api/questionnaire?lang=en",
  });
  const b = await request(s.port, {
    path: "/t/svet-marketing/api/questionnaire?lang=en",
  });
  assert.deepEqual(a.body, b.body);
  assert.equal(a.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(Number(a.headers["content-length"]), a.body.length);
});

// ---------------------------------------------------------------------- SV-3

const rawGet = (port, target, extra = "", method = "GET", body = "") =>
  rawExchange(
    port,
    `${method} ${target} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n${extra}${
      body === "" ? "" : `Content-Length: ${body.length}\r\n`
    }\r\n${body}`,
  );

const UNKNOWN_REQUESTS = (long) => [
  ["GET", "/t/net-takogo/"],
  ["GET", "/t/net-takogo/?lang=kk"],
  ["GET", "/t/net-takogo/api/questionnaire"],
  ["POST", "/t/net-takogo/api/result"],
  ["GET", "/t/uchet-pro/net-takogo"],
  ["GET", "/"],
  ["GET", "/t/"],
  ["GET", "/t/UCHET-PRO/"],
  ["GET", "/t/UCHET-PRO"],
  ["GET", "/t/../uchet-pro/"],
  ["GET", "/assets/net-takogo.js"],
  ["GET", "/t/uchet-pro/api/lead"],
  ["GET", "/t/uchet-pro/api/advice"],
  ["GET", "/t/uchet-pro/api/questionnaire/"],
  ["GET", "//t/uchet-pro/"],
  ["GET", "/T/uchet-pro/"],
  ["GET", "/t/uchet%2Dpro/"],
  ["GET", "/assets/"],
  ["GET", "/assets/../x"],
  ["GET", "/assets/x.exe"],
  ["GET", "/favicon.ico"],
  ["GET", "/t/uchet-pro/api/"],
  ["GET", "/t/uchet-pro//"],
  ["POST", "/t/net-takogo/api/result", "big"],
  ["POST", "/t/net-takogo/api/result", "origin"],
  ["POST", "/t/net-takogo/api/result", "type"],
  ["GET", "/t/net-takogo/", "lang"],
  ["GET", "/t/uchet-pro\\"],
  ["GET", "/t/uchet-pro%5c/"],
  ["GET", "/t/%2e%2e/uchet-pro/"],
  ["GET", "/t/uchet-pro/%00"],
  ["GET", "/assets/..%5ctexts.js"],
  ["GET", "/assets/a%00.js"],
  ["GET", `/t/${"a".repeat(long)}/`],
  ["GET", `/assets/${"a".repeat(long)}.js`],
];

test("SV-3a: 35 requests that name no tenant or no page give one and the same answer - the code 404, the headers without Date and the bytes of the body; also for a tenant whose file has mistakes", async (t) => {
  const dir = makeTenantDir(t, {
    "uchet-pro.json": demoBytes("uchet-pro"),
    "svet-marketing.json": demoBytes("svet-marketing"),
    "broken-one.json": fixtureBytes("e-field-extra-top.json"),
  });
  const s = await startForTest(t, dir);
  const requests = UNKNOWN_REQUESTS(8000);
  assert.equal(requests.length, 35);
  const seen = new Map();
  for (const [method, target, kind] of requests) {
    let extra = "";
    let body = "";
    if (kind === "big") body = "x".repeat(100000);
    if (kind === "origin")
      extra =
        "Origin: http://evil.example\r\nContent-Type: application/json\r\n";
    if (kind === "type")
      extra = `Origin: http://127.0.0.1:${s.port}\r\nContent-Type: text/plain\r\n`;
    if (kind === "lang") extra = "Accept-Language: kk\r\n";
    const res = await rawGet(s.port, target, extra, method, body);
    assert.equal(res.status, 404, `${method} ${target.slice(0, 40)}`);
    seen.set(`${method} ${target.slice(0, 40)}`, signature(res));
  }
  const bad = await rawGet(s.port, "/t/broken-one/");
  assert.equal(bad.status, 404);
  const sigs = new Set([...seen.values(), signature(bad)]);
  assert.equal(
    sigs.size,
    1,
    [...seen.entries()]
      .filter(([, v]) => v !== [...seen.values()][0])
      .map(([k]) => k)
      .join(" | "),
  );
});

test("SV-3b: the answer of an unknown path is the literal body in three languages, with the type JSON and the right length", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const res = await request(s.port, { path: "/t/net-takogo/" });
  assert.equal(res.status, 404);
  assert.equal(res.text, NOT_FOUND_BODY);
  assert.equal(
    res.text,
    JSON.stringify({
      error: "not_found",
      message: allLanguages("server_not_found"),
    }),
  );
  assert.equal(res.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(Number(res.headers["content-length"]), res.body.length);
});

test("SV-3c: the redirect tells nothing - 30 random right ids and the two real ones give 308 with equal headers; a wrong id (capital, short, edge hyphen, 33 signs, underscore, point) is the unknown path; POST gives 405 with Allow: GET", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const rng = makeRng(56003);
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const ids = ["uchet-pro", "svet-marketing"];
  while (ids.length < 32) {
    const length = 3 + rng.int(29);
    let id = "";
    for (let i = 0; i < length; i++) id += chars[rng.int(chars.length)];
    ids.push(id);
  }
  let first = null;
  for (const id of ids) {
    const res = await request(s.port, { path: `/t/${id}` });
    assert.equal(res.status, 308, id);
    assert.equal(res.headers.location, `/t/${id}/`);
    const h = { ...res.headers };
    delete h.date;
    delete h.location;
    first ??= JSON.stringify(h);
    assert.equal(JSON.stringify(h), first, id);
  }
  for (const id of [
    "UCHET-PRO",
    "ab",
    "-ab",
    "ab-",
    "a".repeat(33),
    "a_b",
    "uchet.pro",
  ]) {
    const res = await request(s.port, { path: `/t/${id}` });
    assert.equal(res.status, 404, id);
    assert.equal(res.text, NOT_FOUND_BODY);
  }
  const post = await request(s.port, {
    method: "POST",
    path: "/t/uchet-pro",
    body: "{}",
  });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, "GET");
  const post2 = await request(s.port, {
    method: "POST",
    path: "/t/net-takogo",
    body: "{}",
  });
  assert.equal(post2.status, 405);
});

test("SV-3d: a file with mistakes, a link to a file outside the folder, a link to a folder outside, an ordinary folder named y.json - each address is the unknown path and the block of design 4.3 is in stderr", async (t) => {
  const outside = makeTenantDir(t, {
    "uchet-pro.json": demoBytes("uchet-pro"),
    "inner-folder": (d, name) => fs.mkdirSync(path.join(d, name)),
  });
  const dir = makeTenantDir(t, {
    "svet-marketing.json": demoBytes("svet-marketing"),
    "e-field-extra-top.json": fixtureBytes("e-field-extra-top.json"),
    "link-file.json": (d, name) =>
      fs.symlinkSync(path.join(outside, "uchet-pro.json"), path.join(d, name)),
    "x.json": (d, name) =>
      fs.symlinkSync(path.join(outside, "inner-folder"), path.join(d, name)),
    "y.json": (d, name) => fs.mkdirSync(path.join(d, name)),
  });
  const before = listingDigest(dir);
  const s = await startForTest(t, dir);
  assert.deepEqual(s.ids, ["svet-marketing"]);
  for (const id of ["e-field-extra-top", "link-file", "x", "y", "uchet-pro"]) {
    const res = await request(s.port, { path: `/t/${id}/` });
    assert.equal(res.status, 404, id);
    assert.equal(res.text, NOT_FOUND_BODY, id);
  }
  assert.deepEqual(s.err, [
    "Арендатор e-field-extra-top.json не обслуживается:",
    ...EXPECTED["e-field-extra-top.json"].lines,
    "Арендатор link-file.json не обслуживается:",
    "link-file.json — ссылка. Укажите сам файл, а не ссылку.",
    "Арендатор x.json не обслуживается:",
    "x.json — ссылка. Укажите сам файл, а не ссылку.",
    "Арендатор y.json не обслуживается:",
    "y.json — папка, а не файл. Укажите файл арендатора.",
  ]);
  assert.deepEqual(listingDigest(dir), before);
});

test("SV-3e: server.js says 404 in one place only - the function notFound - and the other places call it", () => {
  const code = codeOf("server.js");
  assert.equal((code.match(/\b404\b/gu) ?? []).length, 1);
  assert.match(
    code,
    /function notFound\(req, res\) \{\s*send\(req, res, 404,/u,
  );
  assert.ok((code.match(/\bnotFound\(req, res\)/gu) ?? []).length >= 5);
});

// ---------------------------------------------------------------------- SV-4

const goodAnswers = (id, name = "leader") => demoAnswerSets(id)[name];

test("SV-4a: a body with a field besides answers (tenant, lang, comment, __proto__) is 400 bad_request with 'the request has an extra field X' and no result; a body with no answers is 400 with 'no answers'", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const answers = goodAnswers("uchet-pro");
  for (const field of ["tenant", "lang", "comment"]) {
    const body = JSON.stringify({ [field]: "svet-marketing", answers });
    for (const lang of LANGS) {
      const res = await resultRequest(s.port, "uchet-pro", answers, lang, {
        body,
      });
      assert.equal(res.status, 400, field);
      const json = JSON.parse(res.text);
      assert.deepEqual(Object.keys(json), ["error", "message"]);
      assert.equal(json.error, "bad_request");
      assert.equal(
        json.message,
        textFor("server_extra_field", lang, { field }),
      );
      assert.equal(res.text.includes("recommended"), false);
    }
  }
  const ru = await resultRequest(s.port, "uchet-pro", answers, undefined, {
    body: JSON.stringify({ tenant: "svet-marketing", answers }),
  });
  assert.equal(
    JSON.parse(ru.text).message,
    "В запросе лишнее поле tenant. Удалите его.",
  );
  const proto = await resultRequest(s.port, "uchet-pro", answers, undefined, {
    body: `{"__proto__":{"x":1},"answers":${JSON.stringify(answers)}}`,
  });
  assert.equal(proto.status, 400);
  assert.equal(
    JSON.parse(proto.text).message,
    textFor("server_extra_field", "ru", { field: "__proto__" }),
  );
  for (const bad of ["{}", '{"Answers":{}}']) {
    const none = await resultRequest(s.port, "uchet-pro", null, "kk", {
      body: bad,
    });
    assert.equal(none.status, 400, bad);
  }
  const none = await resultRequest(s.port, "uchet-pro", null, "kk", {
    body: "{}",
  });
  assert.deepEqual(JSON.parse(none.text), {
    error: "bad_request",
    message: textFor("server_no_answers", "kk"),
  });
  // the extra field comes first, before the lack of answers
  const both = await resultRequest(s.port, "uchet-pro", null, "en", {
    body: '{"tenant":"x"}',
  });
  assert.equal(
    JSON.parse(both.text).message,
    textFor("server_extra_field", "en", { field: "tenant" }),
  );
});

test("SV-4b: the answers of the other tenant (all three sets) are 400 answers_invalid with question null and no string of the other tenant; a mix of right answers and one foreign key is the same; a key of 15000 signs is not given back; __proto__ in a multiple question is refused in both places", async (t) => {
  const s = await startForTest(t, demoDir(t));
  for (const [mine, other] of [IDS, [...IDS].reverse()]) {
    const foreign = [...foreignStrings(demoPlain(other))].filter(
      (x) => !SERVICE.has(x),
    );
    const smallest = Object.keys(goodAnswers(other)).sort()[0];
    for (const name of ["leader", "close", "none"]) {
      for (const lang of LANGS) {
        const res = await resultRequest(
          s.port,
          mine,
          goodAnswers(other, name),
          lang,
        );
        assert.equal(res.status, 400, `${mine} ${name}`);
        const json = JSON.parse(res.text);
        assert.equal(json.error, "answers_invalid");
        assert.equal(json.question, null);
        assert.equal(json.message, textFor("server_answers_invalid", lang));
        assert.equal(res.text.includes(smallest), false, smallest);
        for (const word of foreign)
          assert.equal(res.text.includes(word), false, word);
      }
    }
    const mixed = {
      ...goodAnswers(mine),
      [Object.keys(goodAnswers(other))[0]]: "x",
    };
    const res = await resultRequest(s.port, mine, mixed, "ru");
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.text).question, null);
  }
  const huge = "k".repeat(15000);
  const big = await resultRequest(
    s.port,
    "uchet-pro",
    { ...goodAnswers("uchet-pro"), [huge]: 1 },
    "ru",
  );
  assert.equal(big.status, 400);
  assert.ok(big.body.length < 400, `${big.body.length}`);
  assert.equal(big.text.includes("kkkkkkkk"), false);
  const multiple = demoPlain("uchet-pro").questions.find(
    (q) => q.type === "multiple",
  ).id;
  for (const list of [
    ["__proto__", 1],
    [1, "__proto__"],
  ]) {
    const res = await resultRequest(
      s.port,
      "uchet-pro",
      { ...goodAnswers("uchet-pro"), [multiple]: list },
      "ru",
    );
    assert.equal(res.status, 400, JSON.stringify(list));
    assert.equal(JSON.parse(res.text).error, "answers_invalid");
  }
});

test("SV-4c: a hint of another tenant in the query, a header X-Tenant, Referer, Cookie or Origin does not change the answer for the path; a POST with the same hints gives the result of the tenant of the path", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const path1 = "/t/uchet-pro/api/questionnaire";
  const base = (await request(s.port, { path: path1 })).text;
  for (const [target, headers] of [
    [`${path1}?tenant=svet-marketing`, {}],
    [path1, { "X-Tenant": "svet-marketing" }],
    [path1, { Referer: `http://127.0.0.1:${s.port}/t/svet-marketing/` }],
    [path1, { Cookie: "tenant=svet-marketing" }],
    [path1, { Origin: `http://127.0.0.1:${s.port}/t/svet-marketing` }],
    [
      `${path1}?tenant=svet-marketing&id=svet-marketing`,
      {
        "X-Tenant": "svet-marketing",
        Referer: "http://x.example/t/svet-marketing/",
      },
    ],
  ]) {
    const res = await request(s.port, { path: target, headers });
    assert.equal(res.text, base, target);
    assert.equal(res.status, 200);
  }
  const want = JSON.stringify(
    expectedResult(demoPlain("uchet-pro"), "ru", goodAnswers("uchet-pro")),
  );
  for (const [suffix, headers] of [
    ["?tenant=svet-marketing", {}],
    ["", { "X-Tenant": "svet-marketing" }],
    ["", { Cookie: "tenant=svet-marketing" }],
  ]) {
    const res = await request(s.port, {
      method: "POST",
      path: `/t/uchet-pro/api/result${suffix}`,
      headers: {
        Origin: `http://127.0.0.1:${s.port}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ answers: goodAnswers("uchet-pro") }),
    });
    assert.equal(res.status, 200, suffix);
    assert.equal(res.text, want, suffix);
  }
});

test("SV-4d: ?lang=kk&tenant=svet-marketing is ?lang=kk; Accept-Language: kk without lang is the answer without the header and differs from ?lang=kk", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const kk = (
    await request(s.port, { path: "/t/uchet-pro/api/questionnaire?lang=kk" })
  ).text;
  const mixed = (
    await request(s.port, {
      path: "/t/uchet-pro/api/questionnaire?lang=kk&tenant=svet-marketing",
    })
  ).text;
  assert.equal(mixed, kk);
  const plain = (
    await request(s.port, { path: "/t/uchet-pro/api/questionnaire" })
  ).text;
  const header = (
    await request(s.port, {
      path: "/t/uchet-pro/api/questionnaire",
      headers: { "Accept-Language": "kk" },
    })
  ).text;
  assert.equal(header, plain);
  assert.notEqual(header, kk);
});

test("SV-4e: structure (the text of the modules) - four headers read, one lookup of the registry with the id of the path, no walk over the registry, no variable at module level, no Accept-Language, readTenantFile with baseDir on the bytes that are fingerprinted, the languages asked only after a right check, one place for the form of the body, one TENANT_ID", () => {
  for (const name of ["server.js", "request.js"]) {
    const code = codeOf(name);
    const read = new Set(
      [...code.matchAll(/headers(?:\.([a-z]+)|\[["']([a-z-]+)["']\])/gu)].map(
        (m) => m[1] ?? m[2],
      ),
    );
    for (const header of read)
      assert.ok(
        ["host", "origin", "content-type", "content-length"].includes(header),
        `${name}: ${header}`,
      );
  }
  const headersRead = new Set(
    [
      ...codeOf("server.js").matchAll(
        /headers(?:\.([a-z]+)|\[["']([a-z-]+)["']\])/gu,
      ),
    ].map((m) => m[1] ?? m[2]),
  );
  assert.deepEqual([...headersRead].sort(), [
    "content-length",
    "content-type",
    "host",
    "origin",
  ]);
  const server = codeOf("server.js");
  const gets = [...server.matchAll(/registry\.get\(([^)]*)\)/gu)];
  assert.equal(gets.length, 1);
  assert.equal(gets[0][1], "found.id");
  for (const name of ["server.js", "request.js", "public-data.js"]) {
    const code = codeOf(name);
    for (const pattern of [
      /\.ids\(\)/u,
      /\.values\(\)/u,
      /\.entries\(\)/u,
      /\.keys\(\)/u,
      /\[\.\.\.registry/u,
    ])
      assert.doesNotMatch(code, pattern, `${name}: ${pattern}`);
  }
  for (const name of [
    "server.js",
    "request.js",
    "public-data.js",
    "messages.js",
  ]) {
    const code = codeOf(name);
    assert.doesNotMatch(
      code,
      /^let\s/mu,
      `${name}: a variable at module level`,
    );
    assert.doesNotMatch(code, /^var\s/mu, `${name}: var`);
    assert.doesNotMatch(code, /accept-language/iu, name);
  }
  const tenants = codeOf("tenants.js");
  const read = /readTenantFile\(([^;]*?)\);/su.exec(tenants);
  assert.match(read[1], /baseDir/u);
  assert.match(tenants, /const \{ bytes, fileName \} = read;/u);
  assert.match(tenants, /checkBytes\(bytes, fileName\)/u);
  assert.match(tenants, /entryOf\(fileName, bytes, checked\.tenant\)/u);
  assert.match(tenants, /fingerprintOf\(bytes\)/u);
  assert.equal((tenants.match(/\btenantInLanguage\(/gu) ?? []).length, 1);
  assert.equal((tenants.match(/\bfileLanguages\(/gu) ?? []).length, 1);
  const entry = tenants.slice(
    tenants.indexOf("function entryOf"),
    tenants.indexOf("function registryOf"),
  );
  assert.match(entry, /tenantInLanguage\(/u);
  assert.match(entry, /fileLanguages\(/u);
  assert.match(
    tenants,
    /if \(checked\.exitCode === 0\) \{\s*entries\.push\(entryOf\(/u,
  );
  const request = codeOf("request.js");
  assert.equal((request.match(/typeof value === "object"/gu) ?? []).length, 1);
  assert.equal(
    (request.match(/\bisObject\(/gu) ?? []).length,
    2,
    "defined once, used once (in checkBody)",
  );
  const body = request.slice(request.indexOf("export function checkBody"));
  assert.match(body, /isObject\(parsed\)/u);
  // one definition of the rule of the id
  let definitions = 0;
  for (const name of fs.readdirSync(PICKER).filter((f) => f.endsWith(".js"))) {
    definitions += (codeOf(name).match(/\bTENANT_ID\s*=/gu) ?? []).length;
  }
  assert.equal(definitions, 1);
  // and the rule is not written out again as a literal anywhere else: no file of the picker
  // but limits.js holds the middle part of it
  for (const name of fs
    .readdirSync(PICKER)
    .filter((f) => f.endsWith(".js") && f !== "limits.js")) {
    assert.doesNotMatch(
      codeOf(name),
      /a-z0-9-\]\{1,30\}|\{1,30\}\[a-z0-9\]/u,
      `${name}: the rule of the id again`,
    );
    assert.doesNotMatch(
      codeOf(name),
      /\[a-z0-9\]\[a-z0-9-\]/u,
      `${name}: the rule of the id again`,
    );
  }
  assert.match(codeOf("limits.js"), /\[a-z0-9\]\[a-z0-9-\]\{1,30\}\[a-z0-9\]/u);
  assert.match(codeOf("limits.js"), /export const TENANT_ID =/u);
  assert.match(codeOf("validate.js"), /TENANT_ID/u);
  assert.match(
    codeOf("request.js"),
    /import \{ TENANT_ID \} from "\.\/limits\.js"/u,
  );
});

test("SV-4f: 300 POST requests mixed between the two tenants, in random languages, each give the result the engine gives for that tenant, with no string of the other", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const rng = makeRng(56004);
  const plains = Object.fromEntries(IDS.map((id) => [id, demoPlain(id)]));
  const legacy = Object.fromEntries(
    IDS.map((id) => [
      id,
      checkFile(path.join(LEGACY_TENANTS, `${id}.json`)).tenant,
    ]),
  );
  const pools = Object.fromEntries(
    IDS.map((id) => [id, sets(legacy[id], 56004, 150)]),
  );
  const foreign = Object.fromEntries(
    IDS.map((id) => [
      id,
      [...foreignStrings(plains[IDS.find((x) => x !== id)])].filter(
        (x) => !SERVICE.has(x),
      ),
    ]),
  );
  for (let i = 0; i < 300; i++) {
    const id = rng.pick(IDS);
    const lang = rng.pick(LANGS);
    const answers = rng.pick(pools[id]);
    const res = await resultRequest(s.port, id, answers, lang);
    assert.equal(res.status, 200, `${i}`);
    const want = expectedResult(plains[id], lang, answers);
    assert.equal(res.text, JSON.stringify(want), `${i} ${id} ${lang}`);
    assert.equal(Object.hasOwn(JSON.parse(res.text), "ranking"), false);
    const values = stringValues(JSON.parse(res.text));
    for (const word of foreign[id]) {
      assert.equal(values.includes(word), false, word);
      if ([...word].length >= 15)
        assert.equal(res.text.includes(word), false, word);
    }
  }
  assert.deepEqual(s.log(), []);
});

// ---------------------------------------------------------------------- SV-5

test("SV-5a: the stand on a running server (steps C3-C6 of design 6.3): 30 answers all 200; the names and ids of the solutions of one tenant are in no file of the other and are found in its own results; no file of results holds the key ranking, and the search finds it in a control file; the ten requests of C5 give one signature; the requests of C6 give the texts", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const files = new Map();
  for (const id of IDS) {
    for (const lang of LANGS) {
      files.set(
        `${id}-${lang}-questionnaire.json`,
        await request(s.port, {
          path: `/t/${id}/api/questionnaire?lang=${lang}`,
        }),
      );
      files.set(
        `${id}-${lang}-page.html`,
        await request(s.port, { path: `/t/${id}/?lang=${lang}` }),
      );
      for (const name of ["leader", "close", "none"]) {
        files.set(
          `${id}-${lang}-result-${name}.json`,
          await resultRequest(s.port, id, goodAnswers(id, name), lang),
        );
      }
    }
  }
  assert.equal(files.size, 30);
  for (const [name, res] of files) assert.equal(res.status, 200, name);
  const terms = Object.fromEntries(
    IDS.map((id) => [
      id,
      demoPlain(id).solutions.flatMap((x) => [
        x.id,
        ...LANGS.map((l) => x.name[l]),
      ]),
    ]),
  );
  for (const [mine, other] of [IDS, [...IDS].reverse()]) {
    for (const [name, res] of files) {
      if (!name.startsWith(`${mine}-`)) continue;
      for (const term of terms[other])
        assert.equal(res.text.includes(term), false, `${name}: ${term}`);
    }
  }
  // the control: its own names are found in the results with a recommendation, not in none
  for (const id of IDS) {
    for (const lang of LANGS) {
      for (const [name, wanted] of [
        ["leader", true],
        ["close", true],
        ["none", false],
      ]) {
        const body = files.get(`${id}-${lang}-result-${name}.json`).text;
        assert.equal(
          terms[id].some((term) => body.includes(term)),
          wanted,
          `${id} ${lang} ${name}`,
        );
      }
    }
  }
  // the key ranking: in no file of results, found in a control body
  for (const [name, res] of files) {
    if (name.includes("-result-"))
      assert.equal(res.text.includes('"ranking"'), false, name);
  }
  assert.equal('{"ranking":[]}'.includes('"ranking"'), true);
  // C5
  const paths = [
    "/t/net-takogo/",
    "/t/net-takogo/?lang=kk",
    "/t/net-takogo/api/questionnaire",
    "/t/uchet-pro/net-takogo",
    "/",
    "/t/",
    "/t/UCHET-PRO/",
    "/t/UCHET-PRO",
    "/t/../uchet-pro/",
    "/assets/net-takogo.js",
  ];
  const signatures = new Set();
  for (const p of paths)
    signatures.add(signature(await request(s.port, { path: p })));
  signatures.add(signature(await resultRequest(s.port, "net-takogo", {})));
  assert.equal(signatures.size, 1);
  // C6
  const extra = await request(s.port, {
    method: "POST",
    path: "/t/uchet-pro/api/result",
    headers: {
      Origin: `http://127.0.0.1:${s.port}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tenant: "svet-marketing", answers: {} }),
  });
  assert.equal(
    JSON.parse(extra.text).message,
    "В запросе лишнее поле tenant. Удалите его.",
  );
  const foreignSet = await resultRequest(
    s.port,
    "uchet-pro",
    goodAnswers("svet-marketing"),
  );
  assert.equal(JSON.parse(foreignSet.text).question, null);
  assert.equal(foreignSet.text.includes("svet-marketing"), false);
  const ru = files.get("uchet-pro-ru-questionnaire.json").text;
  const kk = files.get("uchet-pro-kk-questionnaire.json").text;
  assert.equal(
    (
      await request(s.port, {
        path: "/t/uchet-pro/api/questionnaire?tenant=svet-marketing",
      })
    ).text,
    ru,
  );
  assert.equal(
    (
      await request(s.port, {
        path: "/t/uchet-pro/api/questionnaire",
        headers: { "X-Tenant": "svet-marketing" },
      })
    ).text,
    ru,
  );
  assert.equal(
    (
      await request(s.port, {
        path: "/t/uchet-pro/api/questionnaire?lang=kk&tenant=svet-marketing",
      })
    ).text,
    kk,
  );
  assert.equal(
    (
      await request(s.port, {
        path: "/t/uchet-pro/api/questionnaire",
        headers: { "Accept-Language": "kk" },
      })
    ).text,
    ru,
  );
  // POST without Origin: refused (the design of the stand tells to add it)
  const noOrigin = await request(s.port, {
    method: "POST",
    path: "/t/uchet-pro/api/result",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(noOrigin.status, 403);
});

// ---------------------------------------------------------------------- SV-7

async function rawHostCase(
  port,
  hostLines,
  target,
  method = "GET",
  extra = "",
  body = "",
  version = "1.1",
) {
  const head = `${method} ${target} HTTP/${version}\r\n${hostLines}${extra}Connection: close\r\n${
    body === "" ? "" : `Content-Length: ${body.length}\r\n`
  }\r\n${body}`;
  return rawExchange(port, head);
}

test("SV-7a: a request with a wrong Host (a name, no port, another port, capitals, a trailing point, empty, ::1, 0.0.0.0, two Host headers with a wrong first, HTTP/1.0 with none) is 403 with an empty body, for every kind of request, and NOTHING is read - no lookup of the registry, no open of a file of the page; localhost with the port passes", async (t) => {
  const dir = demoDir(t);
  let lookups = 0;
  const originalOpen = fs.openSync;
  let opens = 0;
  fs.openSync = (...args) => {
    if (String(args[0]).startsWith(PUBLIC_DIR)) opens += 1;
    return originalOpen(...args);
  };
  t.after(() => {
    fs.openSync = originalOpen;
  });
  const s = await startForTest(t, dir, {
    wrapRegistry: (registry) => ({
      get: (id) => {
        lookups += 1;
        return registry.get(id);
      },
      ids: () => registry.ids(),
      get size() {
        return registry.size;
      },
    }),
  });
  const port = s.port;
  const hosts = [
    `Host: evil.example:${port}\r\n`,
    "Host: 127.0.0.1\r\n",
    `Host: 127.0.0.1:${port + 1}\r\n`,
    `Host: LOCALHOST:${port}\r\n`,
    "Host: localhost\r\n",
    `Host: 127.0.0.1:${port}.\r\n`,
    "Host: \r\n",
    `Host: [::1]:${port}\r\n`,
    `Host: 0.0.0.0:${port}\r\n`,
    `Host: evil.example:${port}\r\nHost: 127.0.0.1:${port}\r\n`,
  ];
  const requests = [
    ["GET", "/t/uchet-pro/"],
    ["GET", "/t/uchet-pro/api/questionnaire"],
    ["GET", "/t/net-takogo/"],
    ["GET", "/assets/main.js"],
    [
      "POST",
      "/t/uchet-pro/api/result",
      `Origin: http://127.0.0.1:${port}\r\nContent-Type: application/json\r\n`,
      '{"answers":{}}',
    ],
    ["GET", "/"],
  ];
  for (const hostLines of hosts) {
    for (const [method, target, extra = "", body = ""] of requests) {
      const res = await rawHostCase(
        port,
        hostLines,
        target,
        method,
        extra,
        body,
      );
      const label = `${JSON.stringify(hostLines)} ${method} ${target}`;
      assert.equal(res.status, 403, label);
      assert.equal(res.body.length, 0, label);
      assert.equal(res.headers["content-length"], "0", label);
    }
  }
  for (const [method, target, extra = "", body = ""] of requests) {
    const res = await rawHostCase(port, "", target, method, extra, body, "1.0");
    assert.equal(res.status, 403, `1.0 ${target}`);
    assert.equal(res.body.length, 0);
  }
  const noHost = await rawExchange(
    port,
    "GET /t/uchet-pro/ HTTP/1.1\r\nConnection: close\r\n\r\n",
  );
  assert.equal(noHost.status, 403);
  assert.equal(noHost.body.length, 0);
  assert.equal(lookups, 0, "the registry is not asked for a refused Host");
  assert.equal(opens, 0, "no file of the page is opened for a refused Host");
  // the right ones pass
  const ok = await rawHostCase(
    port,
    `Host: localhost:${port}\r\n`,
    "/t/uchet-pro/api/questionnaire",
  );
  assert.equal(ok.status, 200);
  const page = await rawHostCase(
    port,
    `Host: localhost:${port}\r\n`,
    "/t/uchet-pro/",
  );
  assert.equal(page.status, 200);
  assert.ok(lookups >= 2);
  assert.ok(opens >= 1);
});

test("SV-7b: the Origin of a POST - a stranger, null, another port, https, no port, a slash at the end, capitals, a longer port, a suffix, none - is 403 forbidden in the language of the request; the two right ones pass; a GET is not asked for an Origin", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const port = s.port;
  const answers = goodAnswers("uchet-pro");
  const post = (origin, lang = "ru") =>
    request(port, {
      method: "POST",
      path: `/t/uchet-pro/api/result?lang=${lang}`,
      headers: {
        "Content-Type": "application/json",
        ...(origin === null ? {} : { Origin: origin }),
      },
      body: JSON.stringify({ answers }),
    });
  for (const origin of [
    "http://evil.example",
    "null",
    `http://127.0.0.1:${port + 1}`,
    `https://127.0.0.1:${port}`,
    "http://127.0.0.1",
    `http://127.0.0.1:${port}/`,
    `HTTP://127.0.0.1:${port}`,
    `http://127.0.0.1:${port}0`,
    `http://127.0.0.1:${port}.evil.example`,
    `http://LOCALHOST:${port}`,
    `http://127.0.0.1:${port}, http://evil.example`,
    "",
    null,
  ]) {
    for (const lang of LANGS) {
      const res = await post(origin, lang);
      assert.equal(res.status, 403, String(origin));
      assert.deepEqual(
        JSON.parse(res.text),
        { error: "forbidden", message: textFor("server_forbidden", lang) },
        String(origin),
      );
    }
  }
  for (const origin of [
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ]) {
    assert.equal((await post(origin)).status, 200, origin);
  }
  const get = await request(port, {
    path: "/t/uchet-pro/api/questionnaire",
    headers: { Origin: "http://evil.example" },
  });
  assert.equal(get.status, 200);
});

test("SV-7c: the type of the body - text/plain, application/jsonx, application/json5, text/json, multipart, urlencoded, none - is 415 wrong_type; application/json, with a charset, and in capitals pass", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const port = s.port;
  const body = JSON.stringify({ answers: goodAnswers("uchet-pro") });
  const send = (type, lang = "ru") =>
    request(port, {
      method: "POST",
      path: `/t/uchet-pro/api/result?lang=${lang}`,
      headers: {
        Origin: `http://127.0.0.1:${port}`,
        ...(type === null ? {} : { "Content-Type": type }),
      },
      body,
    });
  for (const type of [
    "text/plain",
    "application/jsonx",
    "application/json5",
    "text/json",
    "multipart/form-data; boundary=x",
    "application/x-www-form-urlencoded",
    "json",
    "application/json/",
    null,
  ]) {
    for (const lang of LANGS) {
      const res = await send(type, lang);
      assert.equal(res.status, 415, String(type));
      assert.deepEqual(JSON.parse(res.text), {
        error: "wrong_type",
        message: textFor("server_wrong_type", lang),
      });
    }
  }
  for (const type of [
    "application/json",
    "application/json; charset=utf-8",
    "APPLICATION/JSON",
    "application/json ; charset=utf-8",
    " application/json",
  ]) {
    assert.equal((await send(type)).status, 200, type);
  }
});

test("SV-7d: the order of the checks - a stranger's Origin before the type and the size; the type before the size; the size before the form; an unknown tenant before the Origin; the method before the Origin", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const port = s.port;
  const big = " ".repeat(20000);
  const good = `http://127.0.0.1:${port}`;
  const send = (target, origin, type, body, method = "POST") =>
    request(port, {
      method,
      path: target,
      headers: {
        ...(origin ? { Origin: origin } : {}),
        ...(type ? { "Content-Type": type } : {}),
      },
      body,
    });
  const r1 = await send(
    "/t/uchet-pro/api/result",
    "http://evil.example",
    "text/plain",
    big,
  );
  assert.equal(r1.status, 403);
  const r2 = await send("/t/uchet-pro/api/result", good, "text/plain", big);
  assert.equal(r2.status, 415);
  const r3 = await send(
    "/t/uchet-pro/api/result",
    good,
    "application/json",
    big,
  );
  assert.equal(r3.status, 413);
  const r4 = await send(
    "/t/uchet-pro/api/result",
    good,
    "application/json",
    "not json",
  );
  assert.equal(r4.status, 400);
  assert.equal(JSON.parse(r4.text).error, "bad_request");
  const r5 = await send(
    "/t/net-takogo/api/result",
    "http://evil.example",
    "text/plain",
    big,
  );
  assert.equal(r5.status, 404);
  const r6 = await send(
    "/t/uchet-pro/api/result",
    "http://evil.example",
    "text/plain",
    "{}",
    "PUT",
  );
  assert.equal(r6.status, 405);
  const r7 = await send(
    "/t/uchet-pro/api/questionnaire",
    "http://evil.example",
    "text/plain",
    "{}",
    "POST",
  );
  assert.equal(r7.status, 405);
  // a form error comes before the engine
  const r8 = await send(
    "/t/uchet-pro/api/result",
    good,
    "application/json",
    '{"answers":1,"x":2}',
  );
  assert.equal(r8.status, 400);
  assert.equal(JSON.parse(r8.text).error, "bad_request");
});

const HEADER_KINDS = [
  "page",
  "asset",
  "questionnaire",
  "result",
  "400",
  "403 host",
  "403 origin",
  "404",
  "405",
  "408",
  "413",
  "415",
  "500",
  "308",
];

test("SV-7e: all 14 kinds of answer carry Cache-Control no-store, nosniff, no-referrer and the exact Content-Length; none carries Access-Control-*, Server, Set-Cookie or X-Powered-By; the policy and X-Frame-Options stand on the html answers only", async (t) => {
  const s = await startForTest(t, demoDir(t), { bodyIdleMs: 250 });
  const port = s.port;
  const origin = `http://127.0.0.1:${port}`;
  const post = { Origin: origin, "Content-Type": "application/json" };
  const answers = JSON.stringify({ answers: goodAnswers("uchet-pro") });
  const got = new Map();
  got.set("page", await request(port, { path: "/t/uchet-pro/" }));
  got.set("asset", await request(port, { path: "/assets/main.js" }));
  got.set(
    "questionnaire",
    await request(port, { path: "/t/uchet-pro/api/questionnaire" }),
  );
  got.set(
    "result",
    await request(port, {
      method: "POST",
      path: "/t/uchet-pro/api/result",
      headers: post,
      body: answers,
    }),
  );
  got.set(
    "400",
    await request(port, {
      method: "POST",
      path: "/t/uchet-pro/api/result",
      headers: post,
      body: "nope",
    }),
  );
  got.set(
    "403 host",
    await request(port, { path: "/t/uchet-pro/", host: "evil.example" }),
  );
  got.set(
    "403 origin",
    await request(port, {
      method: "POST",
      path: "/t/uchet-pro/api/result",
      headers: { ...post, Origin: "http://evil.example" },
      body: answers,
    }),
  );
  got.set("404", await request(port, { path: "/nothing" }));
  got.set(
    "405",
    await request(port, {
      method: "PUT",
      path: "/t/uchet-pro/api/questionnaire",
      body: "{}",
    }),
  );
  const slow = await rawExchange(
    port,
    `POST /t/uchet-pro/api/result HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: ${origin}\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{"ans`,
    { waitMs: 5000 },
  );
  got.set("408", slow);
  got.set(
    "413",
    await request(port, {
      method: "POST",
      path: "/t/uchet-pro/api/result",
      headers: post,
      body: " ".repeat(20000),
    }),
  );
  got.set(
    "415",
    await request(port, {
      method: "POST",
      path: "/t/uchet-pro/api/result",
      headers: { ...post, "Content-Type": "text/plain" },
      body: answers,
    }),
  );
  got.set("308", await request(port, { path: "/t/uchet-pro" }));
  const expectedStatus = {
    page: 200,
    asset: 200,
    questionnaire: 200,
    result: 200,
    400: 400,
    "403 host": 403,
    "403 origin": 403,
    404: 404,
    405: 405,
    408: 408,
    413: 413,
    415: 415,
    308: 308,
  };
  for (const [kind, res] of got) {
    assert.equal(res.status, expectedStatus[kind], kind);
    checkHeaders(kind, res);
  }
  // 500: the file of the page cannot be read
  const faults = installFaults([
    {
      fn: "openSync",
      paths: [path.join(PUBLIC_DIR, "index.html")],
      effect: "throw",
      code: "EIO",
    },
  ]);
  try {
    const res = await request(port, { path: "/t/uchet-pro/" });
    assert.equal(res.status, 500);
    checkHeaders("500", res);
    got.set("500", res);
  } finally {
    faults.restore();
  }
  assert.deepEqual([...got.keys()].sort(), [...HEADER_KINDS].sort());
  const html = await request(port, { path: "/assets/index.html" });
  checkHeaders("asset html", html);
  assert.ok(html.headers["content-security-policy"]);
  assert.equal(html.headers["x-frame-options"], "DENY");
  for (const kind of HEADER_KINDS) {
    const res = got.get(kind);
    if (kind === "page") {
      assert.ok(res.headers["content-security-policy"], kind);
      assert.equal(res.headers["x-frame-options"], "DENY", kind);
    } else {
      assert.equal(res.headers["content-security-policy"], undefined, kind);
      assert.equal(res.headers["x-frame-options"], undefined, kind);
    }
  }
});

function checkHeaders(kind, res) {
  for (const [name, value] of Object.entries(COMMON))
    assert.equal(res.headers[name], value, `${kind}: ${name}`);
  assert.equal(
    Number(res.headers["content-length"]),
    res.body.length,
    `${kind}: Content-Length`,
  );
  for (const name of Object.keys(res.headers)) {
    assert.doesNotMatch(name, /^access-control-/u, `${kind}: ${name}`);
  }
  for (const name of ["server", "set-cookie", "x-powered-by"])
    assert.equal(res.headers[name], undefined, `${kind}: ${name}`);
}

const CSP_LITERAL =
  "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";

test("SV-7f: every page answer has the policy of design 5.1, the nine parts, only 'self' and 'none', default-src 'self', no scheme, no *, no data:, nothing unsafe", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const pages = [];
  for (const id of IDS)
    for (const lang of LANGS) pages.push(`/t/${id}/?lang=${lang}`);
  pages.push("/assets/index.html");
  for (const target of pages) {
    const res = await request(s.port, { path: target });
    const csp = res.headers["content-security-policy"];
    assert.equal(csp, CSP_LITERAL, target);
    const parts = csp.split("; ").map((p) => p.split(" "));
    assert.equal(parts.length, 9);
    assert.deepEqual(
      parts.map((p) => p[0]),
      [
        "default-src",
        "script-src",
        "style-src",
        "connect-src",
        "img-src",
        "base-uri",
        "form-action",
        "frame-ancestors",
        "object-src",
      ],
    );
    for (const [, ...sources] of parts)
      for (const source of sources)
        assert.ok(["'self'", "'none'"].includes(source), source);
    assert.ok(parts.some((p) => p[0] === "default-src" && p[1] === "'self'"));
    assert.doesNotMatch(csp, /https?:|\*|data:|unsafe-/u);
  }
});

test("SV-7g: index.html has no script without src, no style, no style or on... attribute, every src and href begins with /assets/, no http:// or https://", () => {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
  for (const m of html.matchAll(/<script\b([^>]*)>/giu))
    assert.match(m[1], /\bsrc="[^"]+"/u, m[0]);
  assert.doesNotMatch(html, /<style\b/iu);
  assert.doesNotMatch(html, /\sstyle\s*=/iu);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/iu);
  for (const m of html.matchAll(/\b(?:src|href)="([^"]*)"/giu))
    assert.ok(m[1].startsWith("/assets/"), m[1]);
  assert.doesNotMatch(html, /https?:\/\//u);
  assert.ok((html.match(/<script\b/giu) ?? []).length >= 1);
});

test("SV-7h: the files of public/ hold no http:// or https:// address", () => {
  const names = fs
    .readdirSync(PUBLIC_DIR)
    .filter((n) => /[.](js|html|css)$/u.test(n));
  assert.ok(names.length >= 3);
  for (const name of names)
    assert.doesNotMatch(
      fs.readFileSync(path.join(PUBLIC_DIR, name), "utf8"),
      /https?:\/\//u,
      name,
    );
});

// ---------------------------------------------------------------------- SV-8

test("SV-8a: the text of the server part has no fetch(, request or get of http or https, node:net, node:dgram, child_process or Math.random (comments count)", () => {
  const re =
    /fetch[(]|https?[.]request|https?[.]get[(]|node:net|node:dgram|child_process|Math[.]random/u;
  const names = fs.readdirSync(PICKER).filter((n) => n.endsWith(".js"));
  assert.ok(names.includes("server.js"));
  for (const name of names) assert.doesNotMatch(sourceOf(name), re, name);
});

test("SV-8b: on a running server 50 different requests open connections only to the port of the server (the connect of net.Socket is recorded)", async (t) => {
  const s = await startForTest(t, demoDir(t));
  const calls = [];
  const original = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function record(...args) {
    calls.push(args);
    return original.apply(this, args);
  };
  t.after(() => {
    net.Socket.prototype.connect = original;
  });
  const targets = [
    "/t/uchet-pro/",
    "/t/svet-marketing/api/questionnaire?lang=kk",
    "/t/net-takogo/",
    "/assets/texts.js",
    "/t/uchet-pro",
    "/",
  ];
  for (let i = 0; i < 50; i++) {
    if (i % 5 === 4)
      await resultRequest(
        s.port,
        "uchet-pro",
        goodAnswers("uchet-pro"),
        LANGS[i % 3],
      );
    else await request(s.port, { path: targets[i % targets.length] });
  }
  assert.ok(calls.length >= 50);
  for (const args of calls) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const port =
      typeof first === "object" && first !== null ? first.port : first;
    const host =
      typeof first === "object" && first !== null ? first.host : args[1];
    assert.equal(Number(port), s.port);
    assert.ok(
      host === undefined || host === "127.0.0.1" || host === "localhost",
      String(host),
    );
  }
});

// ---------------------------------------------------------------------- SV-9

// The sha256 of the six answers for the two demo tenants, obtained by running the server
// on the base tag of the run (design REQ-069, F4): they must stay as they are.
const DEMO_HASHES = {
  "uchet-pro": {
    ru: "ed7d65846b4885f0722b6428aab07080820c6cf597681a0ca462d6ebbdcc1e96",
    kk: "b7ed6ba4f73efa9842cead1006f0c9e6038397441f8345c8576f6d57b47b4081",
    en: "b74367ccc8716c3780275eef00ac3fc1171cc119166c07afdf788a845cf4d95e",
  },
  "svet-marketing": {
    ru: "952a99e23c9c060a1b182028aee1c3721220db4b8221745412ebef8ce0ceda60",
    kk: "53a706196b498567a1e23589339a6b468d0fff61d06defbe5332a54ae9f75024",
    en: "1a0b16d18ea49937ff863d6fe030728148ece5bd9fb7fa7ff9ab725a8fa3fc7c",
  },
};
const NEW_KEYS = ["look", "desk", "chips", "object", "whatsapp"];
const OFFICE_NUMBERS = {
  "ok-office-a": { max_per_hour: 37, max_stored: 4217 },
  "ok-office-b": { max_per_hour: 41, max_stored: 5309 },
};

test("SV-9a: two files of the form /3 (A and B) in a temporary folder - for ru, kk and en the questionnaire holds the look, the desk of the questions that have it, the quick numbers, the objects of the options and whatsapp in leads; the keys of each level and the values equal the file in that language; the version is one for the three languages; max_per_hour and max_stored are not in the answer", async (t) => {
  const s = await startForTest(t, officeDir(t));
  for (const id of OFFICES) {
    const plain = lookFixtureJson(id);
    const bytes = lookFixtureBytes(id);
    assert.equal(plain.schema, "sai-picker-tenant/3");
    const versions = new Set();
    for (const lang of LANGS) {
      const label = `${id} ${lang}`;
      const res = await getJson(
        s.port,
        `/t/${id}/api/questionnaire?lang=${lang}`,
      );
      assert.equal(res.status, 200, label);
      const answer = res.json;
      versions.add(answer.version);
      assert.equal(answer.lang, lang, label);
      assert.deepEqual(answer.languages, LANGS, label);
      // the look in the language of the file
      assert.deepEqual(answer.look, expectedLook(plain, lang), label);
      assert.equal(answer.look.headline, plain.look.headline[lang], label);
      assert.equal(answer.look.team[0].name, plain.look.team[0].name, label);
      assert.equal(
        answer.look.team[1].role,
        plain.look.team[1].role[lang],
        label,
      );
      assert.equal(
        answer.look.colors.dark.accent,
        plain.look.colors.dark.accent,
        label,
      );
      // desks, quick numbers and objects
      plain.questions.forEach((q, i) => {
        const got = answer.questions[i];
        assert.equal(got.desk, q.desk, `${label} q${i} desk`);
        assert.deepEqual(got.chips, q.chips, `${label} q${i} chips`);
        assert.equal(Object.hasOwn(got, "chips"), Object.hasOwn(q, "chips"));
        (q.options ?? []).forEach((o, j) => {
          assert.deepEqual(
            got.options[j].object,
            Object.hasOwn(o, "object") ? expectedObject(o.object) : undefined,
            `${label} q${i} o${j}`,
          );
          assert.equal(
            Object.hasOwn(got.options[j], "object"),
            Object.hasOwn(o, "object"),
          );
        });
      });
      assert.equal(answer.leads.whatsapp, plain.leads.whatsapp, label);
      assert.deepEqual(
        answer.leads.contact_fields,
        plain.leads.contact_fields,
        label,
      );
      // the whole answer is what the oracle builds, key order included
      const want = expectedQuestionnaire(plain, lang, sha256(bytes));
      assert.deepEqual(answer, want, label);
      assert.equal(res.text, JSON.stringify(want), `${label}: key order`);
      // the limits of the lead server stay on the server
      assert.equal(res.text.includes("max_per_hour"), false, label);
      assert.equal(res.text.includes("max_stored"), false, label);
      const numbers = walkNumbers(answer);
      assert.equal(
        numbers.includes(OFFICE_NUMBERS[id].max_per_hour),
        false,
        label,
      );
      assert.equal(
        numbers.includes(OFFICE_NUMBERS[id].max_stored),
        false,
        label,
      );
      assert.equal(plain.leads.max_per_hour, OFFICE_NUMBERS[id].max_per_hour);
      assert.equal(plain.leads.max_stored, OFFICE_NUMBERS[id].max_stored);
    }
    assert.deepEqual([...versions], [sha256(bytes)], `${id}: one version`);
  }
});

test("SV-9b: isolation (Q8) - no string of the look of B stands in any answer of A in any language, and the other way round; the answer of each holds its own headline and its own first staff name, also after the other tenant has been asked in between", async (t) => {
  const s = await startForTest(t, officeDir(t));
  const SHARED = /^(f(0[1-9]|1[0-2])|accent|accent2|ink)$/u;
  const answers = {};
  for (const id of OFFICES) {
    answers[id] = {};
    for (const lang of LANGS) {
      const res = await getJson(
        s.port,
        `/t/${id}/api/questionnaire?lang=${lang}`,
      );
      answers[id][lang] = res;
    }
  }
  for (const [mine, other] of [OFFICES, [...OFFICES].reverse()]) {
    const plainMine = lookFixtureJson(mine);
    const plainOther = lookFixtureJson(other);
    const foreign = [...lookStrings(plainOther)].filter((x) => !SHARED.test(x));
    assert.ok(foreign.length > 30, `${other}: ${foreign.length} strings`);
    for (const lang of LANGS) {
      const { json, text } = answers[mine][lang];
      const own = new Set(stringValues(json));
      for (const f of foreign) {
        assert.equal(own.has(f), false, `${mine} ${lang}: «${f}» of ${other}`);
        if ([...f].length >= 15)
          assert.equal(text.includes(f), false, `${mine} ${lang}: raw «${f}»`);
      }
      // the positive side: the own look is there
      assert.equal(json.look.headline, plainMine.look.headline[lang]);
      assert.equal(json.look.team[0].name, plainMine.look.team[0].name);
      assert.equal(json.look.mark, plainMine.look.mark);
      assert.equal(
        json.look.colors.light.accent,
        plainMine.look.colors.light.accent,
      );
      assert.equal(json.leads.whatsapp, plainMine.leads.whatsapp);
      assert.notEqual(json.look.headline, plainOther.look.headline[lang]);
    }
  }
  // the order of the requests changes nothing
  for (const id of [...OFFICES, ...OFFICES].reverse()) {
    for (const lang of LANGS) {
      const again = await request(s.port, {
        path: `/t/${id}/api/questionnaire?lang=${lang}`,
      });
      assert.equal(again.text, answers[id][lang].text, `${id} ${lang}`);
    }
  }
});

test("SV-9c: the six answers for the two demo tenants have the sha256 of the base tag (literals) and hold none of the keys look, desk, chips, object and whatsapp", async (t) => {
  const s = await startForTest(t, demoDir(t));
  for (const id of IDS) {
    for (const lang of LANGS) {
      const res = await request(s.port, {
        path: `/t/${id}/api/questionnaire?lang=${lang}`,
      });
      assert.equal(res.status, 200, `${id} ${lang}`);
      assert.equal(sha256(res.body), DEMO_HASHES[id][lang], `${id} ${lang}`);
      for (const place of keyPaths(JSON.parse(res.text)))
        for (const key of NEW_KEYS)
          assert.equal(
            place.keys.includes(key),
            false,
            `${id} ${lang} ${place.place}: ${key}`,
          );
    }
  }
  // the copies of the form /1 give their answer without the new keys too
  const legacy = await startForTest(
    t,
    makeTenantDir(t, { "uchet-pro.json": legacyBytes("uchet-pro") }),
  );
  const res = await getJson(legacy.port, "/t/uchet-pro/api/questionnaire");
  for (const place of keyPaths(res.json))
    for (const key of NEW_KEYS)
      assert.equal(place.keys.includes(key), false, key);
});

test("SV-9d: publicQuestionnaire and publicLook on views with extra fields at every level (the look, its colours, a theme, a staff member, a question, a quick-number list, an option, an office object, the leads) give only the listed fields in the order of the design; a frozen input is not changed; a look with no tagline gives null; a view with no look of its own gives no look", () => {
  for (const [id, lang] of [
    ["ok-office-b", "en"],
    ["ok-no-tagline", "ru"],
  ]) {
    const plain = lookFixtureJson(id);
    const base = languageView(plain, lang);
    const noisy = structuredClone(base);
    noisy.look.extra = { a: 1 };
    noisy.look.colors.third = { accent: "#000000", accent2: "#000000" };
    noisy.look.colors.light.accent3 = "#111111";
    noisy.look.colors.dark.accent3 = "#222222";
    noisy.look.team.forEach((staff, i) => {
      staff.age = 30 + i;
      staff.photo = "x";
    });
    noisy.leads.max_per_hour = 7;
    noisy.questions.forEach((q) => {
      q.internal = "x";
      for (const o of q.options ?? []) {
        o.points = 9;
        if (o.object !== undefined) o.object.color = "red";
      }
    });
    const text = JSON.stringify(noisy);
    deepFreeze(noisy);
    const look = publicData.publicLook(noisy.look);
    assert.deepEqual(look, expectedLook(plain, lang), id);
    assert.equal(
      JSON.stringify(look),
      JSON.stringify(expectedLook(plain, lang)),
      id,
    );
    assert.equal(
      look.tagline,
      Object.hasOwn(plain.look, "tagline") ? plain.look.tagline[lang] : null,
    );
    const out = publicQuestionnaire(noisy, {
      version: "v",
      lang,
      languages: LANGS,
    });
    assert.equal(
      JSON.stringify(out),
      JSON.stringify(expectedQuestionnaire(plain, lang, "v")),
      id,
    );
    assert.equal(
      JSON.stringify(noisy),
      text,
      `${id}: the input is not changed`,
    );
    assert.notEqual(out.look, noisy.look);
  }
  assert.equal(
    expectedLook(lookFixtureJson("ok-no-tagline"), "ru").tagline,
    null,
  );
  // a view with no look of its own
  const two = languageView(demoPlain("svet-marketing"), "kk");
  const out = publicQuestionnaire(deepFreeze(two), {
    version: "v",
    lang: "kk",
    languages: LANGS,
  });
  assert.equal(Object.hasOwn(out, "look"), false);
  assert.deepEqual(Object.keys(out), [
    "version",
    "lang",
    "languages",
    "name",
    "intro",
    "questions_min",
    "questions_max",
    "questions",
    "ai",
    "leads",
  ]);
});

// The three kinds of tenant in registries built from temporary folders.
function threeKinds(t) {
  const mixed = loadTenants(
    makeTenantDir(t, {
      "ok-office-a.json": lookFixtureBytes("ok-office-a"),
      "uchet-pro.json": demoBytes("uchet-pro"),
    }),
  ).registry;
  const legacy = loadTenants(
    makeTenantDir(t, { "uchet-pro.json": legacyBytes("uchet-pro") }),
  ).registry;
  return {
    three: mixed.get("ok-office-a"),
    two: mixed.get("uchet-pro"),
    one: legacy.get("uchet-pro"),
  };
}

test("SV-9e: lookOfView (for the tenant's own page and the progress data) - a /3 view gives its own look per language, a /2 view and a /1 view give the fallback look with the name of the tenant in that language, never null for any of the three kinds; every call gives a new object; the registry records of the three kinds have the same six keys", (t) => {
  const kinds = threeKinds(t);
  const plain3 = lookFixtureJson("ok-office-a");
  const plain2 = demoPlain("uchet-pro");
  const plain1 = JSON.parse(legacyBytes("uchet-pro").toString("utf8"));
  const KEYS = [
    "id",
    "fileName",
    "version",
    "languages",
    "views",
    "questionnaires",
  ];
  for (const entry of Object.values(kinds))
    assert.deepEqual(Object.keys(entry), KEYS);
  for (const lang of LANGS) {
    const view = kinds.three.views.get(lang);
    const look = publicData.lookOfView(view);
    assert.deepEqual(look, expectedLook(plain3, lang), `/3 ${lang}`);
    assert.notEqual(look, publicData.lookOfView(view));
    assert.deepEqual(look, publicData.lookOfView(view));
    const view2 = kinds.two.views.get(lang);
    assert.equal(view2.name, plain2.name[lang]);
    const fallback = publicData.lookOfView(view2);
    assert.notEqual(fallback, null);
    assert.deepEqual(
      fallback,
      expectedFallback(plain2.name[lang]),
      `/2 ${lang}`,
    );
    assert.equal(fallback.headline, plain2.name[lang]);
    assert.notEqual(fallback, publicData.lookOfView(view2));
    assert.equal(
      fallback.team.every((s) => s.role === null && s.name === null),
      true,
    );
  }
  const view1 = kinds.one.views.get("ru");
  const fallback1 = publicData.lookOfView(view1);
  assert.notEqual(fallback1, null);
  assert.deepEqual(fallback1, expectedFallback(plain1.name));
  assert.equal(fallback1.headline, plain1.name);
  // the fallback is made from the name, so the name decides the mark
  assert.equal(fallback1.mark, expectedFallback(plain1.name).mark);
  // the argument is not changed (the views are frozen)
  assert.equal(Object.isFrozen(view1), true);
  assert.equal(Object.isFrozen(kinds.three.views.get("ru").look), true);
});

test("SV-9f: ownLookOfView (for the board, decisions/0085 items 7 and 8) - a /3 view gives its own look, equal to publicLook of the view and to the look inside the questionnaire of the same language; a /2 view and a /1 view give exactly null; every call gives a new object; the server has no other function that makes a look for the board", (t) => {
  const kinds = threeKinds(t);
  for (const lang of LANGS) {
    const view = kinds.three.views.get(lang);
    const before = JSON.stringify(view);
    const own = publicData.ownLookOfView(view);
    assert.deepEqual(own, publicData.publicLook(view.look), lang);
    assert.deepEqual(
      own,
      JSON.parse(kinds.three.questionnaires.get(lang)).look,
      lang,
    );
    assert.deepEqual(own, publicData.lookOfView(view), lang);
    assert.deepEqual(
      own,
      expectedLook(lookFixtureJson("ok-office-a"), lang),
      lang,
    );
    assert.notEqual(own, publicData.ownLookOfView(view));
    assert.notEqual(own.team, publicData.ownLookOfView(view).team);
    assert.equal(JSON.stringify(view), before, "the argument is not changed");
    assert.equal(
      publicData.ownLookOfView(kinds.two.views.get(lang)),
      null,
      `/2 ${lang}`,
    );
  }
  assert.equal(publicData.ownLookOfView(kinds.one.views.get("ru")), null);
  // the functions of the module: the board builds its fallback itself in the browser
  assert.deepEqual(Object.keys(publicData).sort(), [
    "lookOfView",
    "ownLookOfView",
    "publicLook",
    "publicQuestionnaire",
    "publicResult",
  ]);
});

// The leads of ok-office-a without the key `whatsapp`, as the visitor must get them
// (literals, the key order of the design: contact_fields, whatsapp, consent_text,
// operator_name, privacy_contact, retention_days).
const LEADS_NO_WHATSAPP = {
  ru: {
    contact_fields: ["phone", "telegram"],
    whatsapp: null,
    consent_text: "Я согласен на хранение моей заявки.",
    operator_name: "Пример-Лавка, вымышленная фирма",
    privacy_contact: "Напишите на privacy@example.invalid.",
    retention_days: 30,
  },
  kk: {
    contact_fields: ["phone", "telegram"],
    whatsapp: null,
    consent_text: "Қазақша мәтін 33",
    operator_name: "Пример-Лавка, вымышленная фирма",
    privacy_contact: "Напишите на privacy@example.invalid.",
    retention_days: 30,
  },
  en: {
    contact_fields: ["phone", "telegram"],
    whatsapp: null,
    consent_text: "English text 33",
    operator_name: "Пример-Лавка, вымышленная фирма",
    privacy_contact: "Напишите на privacy@example.invalid.",
    retention_days: 30,
  },
};
const LEADS_KEYS = [
  "contact_fields",
  "whatsapp",
  "consent_text",
  "operator_name",
  "privacy_contact",
  "retention_days",
];

test("SV-9g: a file of the form /3 with the leads enabled and no leads.whatsapp - for ru, kk and en the served answer holds `whatsapp: null` as the second key of leads (after contact_fields), and publicQuestionnaire gives the same for a view without the field", async (t) => {
  const plain = lookFixtureJson("ok-office-a");
  assert.equal(plain.leads.enabled, true);
  delete plain.leads.whatsapp;
  assert.equal(Object.hasOwn(plain.leads, "whatsapp"), false);
  const bytes = Buffer.from(`${JSON.stringify(plain, null, 2)}\n`, "utf8");
  const dir = makeTenantDir(t, { "ok-office-a.json": bytes });
  const s = await startForTest(t, dir);
  for (const lang of LANGS) {
    const label = `served ${lang}`;
    const res = await getJson(
      s.port,
      `/t/ok-office-a/api/questionnaire?lang=${lang}`,
    );
    assert.equal(res.status, 200, label);
    assert.equal(res.json.version, sha256(bytes), label);
    assert.deepEqual(Object.keys(res.json.leads), LEADS_KEYS, label);
    assert.equal(Object.hasOwn(res.json.leads, "whatsapp"), true, label);
    assert.equal(res.json.leads.whatsapp, null, label);
    assert.deepEqual(res.json.leads, LEADS_NO_WHATSAPP[lang], label);
    // the key stands in the text of the answer, at its place
    assert.equal(
      res.text.includes(
        `"leads":{"contact_fields":["phone","telegram"],"whatsapp":null,"consent_text":`,
      ),
      true,
      `${label}: the text`,
    );
    assert.equal(
      res.text.includes(`"leads":${JSON.stringify(LEADS_NO_WHATSAPP[lang])}`),
      true,
      `${label}: the whole leads`,
    );
  }
  // the same through the function, on a frozen view of every language
  for (const lang of LANGS) {
    const label = `function ${lang}`;
    const view = deepFreeze(languageView(plain, lang));
    assert.equal(Object.hasOwn(view.leads, "whatsapp"), false, label);
    const out = publicQuestionnaire(view, {
      version: "v",
      lang,
      languages: LANGS,
    });
    assert.deepEqual(Object.keys(out.leads), LEADS_KEYS, label);
    assert.equal(Object.hasOwn(out.leads, "whatsapp"), true, label);
    assert.equal(out.leads.whatsapp, null, label);
    assert.equal(
      JSON.stringify(out.leads),
      JSON.stringify(LEADS_NO_WHATSAPP[lang]),
      label,
    );
    assert.equal(
      JSON.stringify(out).includes(
        `"contact_fields":["phone","telegram"],"whatsapp":null,"consent_text":`,
      ),
      true,
      `${label}: the text`,
    );
  }
});
