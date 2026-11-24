import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { AUTH_CODES } from "../../server/http/errors.js";
import { blank } from "../fixtures/blank.js";
import { APP } from "../fixtures/helpers.js";

// The route table (the code design M2AUTH, 4.4, 4.8). RT-6 is of REQ-114 criterion 13 (the auth lane): every
// error code that the app, the request pipeline and the auth and admin routes can answer is in AUTH_CODES,
// so every answer of routes 4-15 has a page text. RT-1 … RT-5 (REQ-115 criterion 6) are of the tenancy lane.

/** The files whose code literals RT-6 reads (4.8, 9.1 c13). */
function scannedFiles() {
  const http = fs
    .readdirSync(path.join(APP, "server", "http"))
    .filter((f) => f.endsWith(".js"))
    .sort()
    .map((f) => `server/http/${f}`);
  return [
    "server/app.js",
    ...http,
    "server/routes/auth.js",
    "server/routes/admin.js",
    // M2.3 (REQ-116, REQ-117): the new route files, and the two services whose rules throw or return the
    // refusals that a route answers (the routes themselves only call them).
    "server/routes/invites.js",
    "server/routes/projects.js",
    "server/routes/admin-projects.js",
    "server/services/orgs.js",
    "server/services/projects.js",
  ];
}

/** Every .js file of server/ and api/, by its path from app/. */
function codeFiles() {
  /** @param {string} rel @returns {string[]} */
  const walk = (rel) =>
    fs
      .readdirSync(path.join(APP, rel), { withFileTypes: true })
      .flatMap((d) =>
        d.isDirectory()
          ? d.name === "vendor"
            ? []
            : walk(`${rel}/${d.name}`)
          : d.name.endsWith(".js")
            ? [`${rel}/${d.name}`]
            : [],
      );
  return [...walk("server"), ...walk("api")];
}

/** The forms of an answered code: a thrown HttpError, an `error:` literal, a returned refusal, an error body. */
const FORMS = [
  /\bnew\s+HttpError\(\s*"([a-z_]+)"/g,
  /\berror:\s*"([a-z_]+)"/g,
  /\brefusal\(\s*"([a-z_]+)"/g,
  /\berrorBody\(\s*"([a-z_]+)"/g,
  // The returned refusal of services/orgs.js (the counters commit, M2AUTH C4): `returned("<code>", <status>)`.
  /\breturned\(\s*"([a-z_]+)"/g,
];

/**
 * The span of `function <name>` … its closing brace in a text whose comments and strings are blanked.
 * @param {string} code
 * @param {string} name
 * @returns {[number, number] | null}
 */
function functionSpan(code, name) {
  const m = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(code);
  if (!m) return null;
  const open = code.indexOf("{", m.index);
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}" && --depth === 0) return [m.index, i];
  }
  return null;
}

/**
 * The codes of the scanned texts, by code and the places it stands. The one exception: the code of
 * `readText` in http/body.js (the body as text, `bad_encoding`) when no file of server/ or api/ imports
 * readText, because then no route answers it.
 * @param {Record<string, string>} texts path from app/ → source
 * @param {Record<string, string>} all every code file of server/ and api/ → source
 * @returns {Map<string, string[]>}
 */
function answeredCodes(texts, all) {
  /** @type {Map<string, string[]>} */
  const out = new Map();
  const importers = Object.entries(all)
    .filter(([f]) => f !== "server/http/body.js")
    .filter(([, src]) =>
      /\bimport\s*\{[^}]*\breadText\b[^}]*\}\s*from/.test(blank(src, true)),
    )
    .map(([f]) => f);
  for (const [file, src] of Object.entries(texts)) {
    const kept = blank(src, true);
    const span =
      file === "server/http/body.js" && importers.length === 0
        ? functionSpan(blank(src), "readText")
        : null;
    for (const re of FORMS)
      for (const m of kept.matchAll(re)) {
        const at = /** @type {number} */ (m.index);
        if (span && at > span[0] && at < span[1]) continue;
        const line = kept.slice(0, at).split("\n").length;
        out.set(m[1], [...(out.get(m[1]) ?? []), `${file}:${line}`]);
      }
  }
  return out;
}

const read = (/** @type {string} */ rel) =>
  fs.readFileSync(path.join(APP, rel), "utf8");

test("RT-6 every code literal of new HttpError(…), { error: … }, refusal(…) and errorBody(…) in app.js, http/*.js, the route files and services/{orgs,projects}.js is in AUTH_CODES; a planted code outside AUTH_CODES in a copy of routes/auth.js is red (bad_request is a code since M2.3)", () => {
  const files = scannedFiles();
  assert.ok(
    files.includes("server/http/auth-mw.js") && files.length >= 8,
    files.join(),
  );
  const texts = Object.fromEntries(files.map((f) => [f, read(f)]));
  const all = Object.fromEntries(codeFiles().map((f) => [f, read(f)]));
  const codes = answeredCodes(texts, all);
  const outside = [...codes].filter(
    ([c]) => !AUTH_CODES.includes(/** @type {any} */ (c)),
  );
  assert.deepEqual(
    outside,
    [],
    "codes answered by the auth routes without a page text",
  );
  // The scan sees the codes of every form (a scan that finds nothing would pass the rule above).
  for (const c of [
    "csrf_refused",
    "origin_refused",
    "invalid_credentials",
    "reset_invalid",
    "totp_required",
    "rate_limited",
    "site_closed",
    "body_too_large",
    "server_error",
    // M2.3 (guard row G4): the codes of the invitation, consent and project code.
    "forbidden",
    "personal_data_gate",
    "registration_closed",
    "account_exists",
    "consent_stale",
  ])
    assert.ok(codes.has(c), `the scan finds ${c}`);
  // The planted copies: each form with a code outside AUTH_CODES is found.
  for (const plant of [
    'throw new HttpError("bad_unplanned");',
    'return { status: 400, body: { error: "bad_answers" } };',
    'return refusal("unknown_option", 400);',
    'return errorBody("wrong_kind");',
  ]) {
    const copy = {
      ...texts,
      "server/routes/auth.js": texts["server/routes/auth.js"].replace(
        "export function authRoutes(ctx) {",
        `export function authRoutes(ctx) {\n  if (ctx === null) ${plant}`,
      ),
    };
    const found = [...answeredCodes(copy, all)].filter(
      ([c]) => !AUTH_CODES.includes(/** @type {any} */ (c)),
    );
    assert.equal(found.length, 1, plant);
    assert.match(found[0][1][0], /^server\/routes\/auth\.js:\d+$/);
  }
  // A comment that names a code is not an answer.
  const commented = {
    ...texts,
    "server/routes/auth.js": `// new HttpError("bad_unplanned")\n${texts["server/routes/auth.js"]}`,
  };
  assert.deepEqual(
    [...answeredCodes(commented, all)].filter(
      ([c]) => !AUTH_CODES.includes(/** @type {any} */ (c)),
    ),
    [],
  );
  // The exception holds only while no file imports readText: an importer makes its code count.
  const withImporter = {
    ...all,
    "server/routes/auth.js": `import { readText } from "../http/body.js";\n${all["server/routes/auth.js"]}`,
  };
  const counted = [...answeredCodes(texts, withImporter)].filter(
    ([c]) => !AUTH_CODES.includes(/** @type {any} */ (c)),
  );
  assert.deepEqual(
    counted.map(([c]) => c),
    ["bad_encoding"],
  );
});

// ---------------------------------------------------------------------------------------------------------
// RT-1 … RT-5: REQ-115 criterion 6 (the tenancy lane; the code design M2AUTH, 4.4 and 4.7 steps 0a-8): the
// metadata of every route of the real table, read at test time, and the uniform 404 of an admin route and the
// re-auth refusal on planted rows.

// The modules of these cases are imported where they are used, so this block adds no line to the imports of
// the file's first part.
const deps = async () => ({
  ...(await import("../fixtures/auth.js")),
  ...(await import("../../server/routes/index.js")),
  ...(await import("../../server/routes/demo.js")),
  ...(await import("../../public/shared/i18n/lang.js")),
});

const META_KEYS = [
  "admin",
  "rateLimit",
  "reauth",
  "session",
  "tenant",
  "worker",
];
const RATE_LIMITS = [
  "setup",
  "login",
  "reset",
  "user",
  "invite",
  "invite_view",
  null,
];
// The re-auth purposes of the closed table of 4.9.4, written here.
const PURPOSES = [
  "reset_link",
  "totp_enrol",
  "totp_off",
  "dev_start",
  "dev_resume",
  "worker_token",
  "settings",
  "kill_switch_off",
  "ai_allow",
  "codes",
  "owner_identity",
  "user_delete",
];

/**
 * The findings of the route rows: a row whose keys are not exactly method, path, meta and handler; a meta object
 * that is not frozen, whose keys are not exactly the six, or whose value has another type.
 * @param {ReadonlyArray<any>} rows
 * @returns {string[]}
 */
export function metaFindings(rows) {
  const out = [];
  for (const r of rows) {
    const name = `${r?.method} ${r?.path}`;
    if (
      JSON.stringify(Object.keys(r ?? {}).sort()) !==
      JSON.stringify(["handler", "meta", "method", "path"])
    )
      out.push(
        `${name}: row keys ${Object.keys(r ?? {})
          .sort()
          .join(",")}`,
      );
    const m = r?.meta;
    if (m === null || typeof m !== "object") {
      out.push(`${name}: no meta`);
      continue;
    }
    if (!Object.isFrozen(m)) out.push(`${name}: meta not frozen`);
    const keys = Object.keys(m).sort();
    for (const k of META_KEYS)
      if (!keys.includes(k)) out.push(`${name}: lacks ${k}`);
    for (const k of keys)
      if (!META_KEYS.includes(k)) out.push(`${name}: extra ${k}`);
    for (const k of ["tenant", "admin", "worker", "session"])
      if (k in m && typeof m[k] !== "boolean")
        out.push(`${name}: ${k} not a boolean`);
    if ("reauth" in m && m.reauth !== null && !PURPOSES.includes(m.reauth))
      out.push(`${name}: reauth ${m.reauth}`);
    if ("rateLimit" in m && !RATE_LIMITS.includes(m.rateLimit))
      out.push(`${name}: rateLimit ${m.rateLimit}`);
  }
  return out;
}

/**
 * The real table as createApp builds it, with the demo.
 * @param {import("node:test").TestContext} t
 * @returns {Promise<any[]>}
 */
async function realTable(t) {
  const { authHarness, loadIntake, PUBLIC_LANGS, routeTable } = await deps();
  /** @type {any[]} */
  let table = [];
  await authHarness(t, {
    demo: { intake: loadIntake(), langs: PUBLIC_LANGS },
    routeTable: (/** @type {any} */ deps) => (table = [...routeTable(deps)]),
  });
  return table;
}

test("RT-1 every route of the real table has a frozen meta object with exactly the six keys, each of its type", async (t) => {
  const rows = await realTable(t);
  assert.ok(rows.length >= 29, `${rows.length} routes`);
  assert.deepEqual(metaFindings(rows), []);
  // The design's values of the admin routes: admin, a user rate limit, the session, and their purposes (the
  // five of M2.2 and the seven of M2.3, rows N4-N10 of the code design M2PROJ, 4.3).
  /** @type {Record<string, string | null>} */
  const admin = {
    "POST /api/admin/users/:id/reset-link": "reset_link",
    "POST /api/admin/totp/enrol": "totp_enrol",
    "POST /api/admin/totp/confirm": null,
    "POST /api/admin/totp/off": "totp_off",
    "GET /api/admin/audit/verify": null,
    "POST /api/admin/invites": "owner_identity",
    "GET /api/admin/deletion-requests": null,
    "POST /api/admin/users/:id/delete": "user_delete",
    "GET /api/admin/requests": null,
    "GET /api/admin/projects/:id": null,
    "POST /api/admin/projects/:id/idea": null,
    "GET /api/admin/audit": null,
  };
  // The four real tenant routes (rows N11-N14): the only rows whose tenant is true.
  const tenant = [
    "GET /api/projects",
    "POST /api/projects",
    "GET /api/projects/:id",
    "POST /api/projects/:id/idea",
  ];
  for (const k of [...Object.keys(admin), ...tenant])
    assert.ok(
      rows.some((r) => `${r.method} ${r.path}` === k),
      `the table has ${k}`,
    );
  for (const r of rows) {
    const key = `${r.method} ${r.path}`;
    assert.equal(r.meta.admin, key in admin, key);
    if (key in admin) assert.equal(r.meta.reauth, admin[key], key);
    else assert.equal(r.meta.reauth, null, key);
    assert.equal(r.meta.worker, false, key);
    assert.equal(r.meta.tenant, tenant.includes(key), key);
  }
});

test("RT-2 a planted table whose route lacks a key, has an extra key, a value of another type or a meta that can change is reported", async (t) => {
  const rows = await realTable(t);
  const base = rows.find((r) => r.path === "/api/auth/me");
  assert.ok(base);
  const name = `${base.method} ${base.path}`;
  const lacking = Object.fromEntries(
    Object.entries(base.meta).filter(([k]) => k !== "tenant"),
  );
  /** @type {Array<[string, any]>} */
  const cases = [
    [`${name}: lacks tenant`, { ...base, meta: Object.freeze(lacking) }],
    [
      `${name}: extra org`,
      { ...base, meta: Object.freeze({ ...base.meta, org: true }) },
    ],
    [
      `${name}: session not a boolean`,
      { ...base, meta: Object.freeze({ ...base.meta, session: "yes" }) },
    ],
    [
      `${name}: rateLimit hourly`,
      { ...base, meta: Object.freeze({ ...base.meta, rateLimit: "hourly" }) },
    ],
    [
      `${name}: reauth anything`,
      { ...base, meta: Object.freeze({ ...base.meta, reauth: "anything" }) },
    ],
    [`${name}: meta not frozen`, { ...base, meta: { ...base.meta } }],
    [
      `${name}: row keys handler,meta,method,path,shape`,
      { ...base, shape: {} },
    ],
  ];
  for (const [label, row] of cases) {
    const found = metaFindings([...rows.filter((r) => r !== base), row]);
    assert.ok(found.includes(label), `${label}: ${JSON.stringify(found)}`);
  }
});

/** A planted route row with the six keys. @param {Record<string, unknown>} over */
const plantedRow = (over) =>
  Object.freeze({
    method: "POST",
    path: "/api/planted",
    meta: Object.freeze({
      tenant: false,
      admin: false,
      reauth: null,
      worker: false,
      session: true,
      rateLimit: "user",
      ...over,
    }),
    handler: async () => ({ status: 200, body: { ok: true } }),
  });

test("RT-3 a planted admin route answers a signed-in ordinary user and an anonymous caller 404 byte-equal to an unknown /api address, with and without Origin", async (t) => {
  const { authHarness, routeTable } = await deps();
  const row = plantedRow({ admin: true });
  const h = await authHarness(t, {
    routeTable: (/** @type {any} */ deps) => [...routeTable(deps), row],
  });
  const admin = await h.setup();
  const user = await h.signIn(await h.addUser({ role: "member" }));
  for (const as of [user, null])
    for (const origin of [h.origin, null]) {
      const label = `${as ? "user" : "anonymous"} ${origin ? "with" : "without"} Origin`;
      const a = await h.call("POST", "/api/planted", { as, origin, body: {} });
      const b = await h.call("POST", "/api/no-such-route", {
        as,
        origin,
        body: {},
      });
      assert.equal(a.status, 404, `${label}: ${a.text}`);
      assert.equal(a.same, b.same, label);
      assert.deepEqual(a.setCookie, [], label);
    }
  // The admin passes the 404 (the route is the admin's).
  const ok = await h.call("POST", "/api/planted", {
    as: await h.signIn(admin),
    body: {},
  });
  assert.equal(ok.status, 200, ok.text);
});

test("RT-4 a planted route marked reauth answers 403 reauth_required to a call without a re-auth token, and the action does not run", async (t) => {
  const { authHarness, routeTable } = await deps();
  let ran = 0;
  const row = Object.freeze({
    ...plantedRow({ reauth: "settings" }),
    handler: async () => {
      ran += 1;
      return { status: 200, body: { ok: true } };
    },
  });
  const h = await authHarness(t, {
    routeTable: (/** @type {any} */ deps) => [...routeTable(deps), row],
  });
  await h.setup();
  const user = await h.signIn(await h.addUser({ role: "member" }));
  const before = await h.digest();
  for (const reauth of [null, "x".repeat(43)]) {
    const r = await h.call("POST", "/api/planted", {
      as: user,
      body: {},
      reauth,
    });
    assert.equal(r.status, 403, r.text);
    assert.deepEqual(r.json, { error: "reauth_required" });
  }
  assert.equal(ran, 0);
  assert.deepEqual(await h.digest(), before);
  // With a token of the purpose the action runs once.
  const token = await h.reauthToken(user, "settings");
  const ok = await h.call("POST", "/api/planted", {
    as: user,
    body: {},
    reauth: token,
  });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ran, 1);
});

test("RT-5 session is false for the demo routes, the health route and the worker routes, and true for every other non-GET route", async (t) => {
  const rows = await realTable(t);
  const off = [
    "POST /api/demo/result",
    "GET /api/demo/questionnaire",
    "GET /api/health",
  ];
  for (const k of off)
    assert.ok(
      rows.some((r) => `${r.method} ${r.path}` === k),
      k,
    );
  for (const r of rows) {
    const key = `${r.method} ${r.path}`;
    const worker = r.path.startsWith("/api/worker/");
    if (off.includes(key) || worker) assert.equal(r.meta.session, false, key);
    else if (r.method !== "GET") assert.equal(r.meta.session, true, key);
  }
});

test("RT-7 a plan belongs to a tenant row, and withPlan refuses any other row, the real rows with a plan are exactly the two tenant writes, and every row keeps exactly the four keys", async (t) => {
  const { planOf, withPlan } = await import("../../server/http/plan.js");
  const rows = await realTable(t);
  // The rows keep exactly method, path, meta and handler (the plan stands beside the row, not in it).
  assert.deepEqual(metaFindings(rows), []);
  const planned = rows
    .filter((r) => planOf(r) !== undefined)
    .map((r) => `${r.method} ${r.path}`)
    .sort();
  assert.deepEqual(planned, [
    "POST /api/projects",
    "POST /api/projects/:id/idea",
  ]);
  for (const r of rows)
    if (planOf(r) !== undefined)
      assert.equal(r.meta.tenant, true, `${r.method} ${r.path}`);
  // A plan on a row with tenant false is refused at table build, with a TypeError and no row kept.
  const plan = async () => ({ audit: null, state: null });
  for (const over of [{ tenant: false }, { tenant: false, admin: true }]) {
    const row = plantedRow(over);
    assert.throws(() => withPlan(row, plan), TypeError);
    assert.equal(planOf(row), undefined);
  }
  const tenantRow = plantedRow({ tenant: true });
  assert.equal(withPlan(tenantRow, plan), tenantRow);
  assert.equal(planOf(tenantRow), plan);
  assert.deepEqual(Object.keys(tenantRow).sort(), [
    "handler",
    "meta",
    "method",
    "path",
  ]);
  // A plan that is not a function is refused too.
  assert.throws(
    () => withPlan(plantedRow({ tenant: true }), /** @type {any} */ ("plan")),
    TypeError,
  );
});
