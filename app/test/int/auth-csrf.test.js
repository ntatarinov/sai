import assert from "node:assert/strict";
import { test } from "node:test";
import { SOURCE_LANGS } from "../../public/shared/i18n/lang.js";
import { createApp } from "../../server/app.js";
import { loadIntake } from "../../server/routes/demo.js";
import { routeTable } from "../../server/routes/index.js";
import { ADMIN, authHarness, totpCode } from "../fixtures/auth.js";

// REQ-114 criterion 4 (the code design M2AUTH, 4.7 steps 3-5, the metadata key `session`): every non-GET
// route of the real route table whose `session` is true refuses a foreign or missing Origin (403), a body
// type other than application/json (415) and, for a signed-in caller, a missing, foreign or changed CSRF
// token (403); after each refusal every row of every table is unchanged (sha256), the rate counters
// included. The routes are read from the table at test time; a route without a case fails.

/** @typedef {import("../fixtures/auth.js").AuthHarness} H */
/** @typedef {import("../fixtures/auth.js").Actor} Actor */
/** @typedef {{ h: H, as: Actor, other: Actor, path: string, body: Record<string, unknown>, reauth?: string, ok: number }} Prepared */

const demo = () => ({ intake: loadIntake(), langs: SOURCE_LANGS });

/** The real route table of an app (read through the app's own call of routeTable). */
async function realRoutes(/** @type {import("node:test").TestContext} */ t) {
  /** @type {ReadonlyArray<import("../../server/routes/index.js").Route>} */
  let rows = [];
  await authHarness(t, {
    demo: demo(),
    routeTable: (/** @type {any} */ deps) => (rows = routeTable(deps)),
  });
  return rows;
}

/** A harness with a signed-in ordinary user and a second signed-in user (another session). */
async function base(/** @type {import("node:test").TestContext} */ t) {
  const h = await authHarness(t);
  const as = await h.signIn(await h.addUser({ email: "caller@example.test" }));
  const other = await h.signIn(
    await h.addUser({ email: "other@example.test" }),
  );
  return { h, as, other };
}

/** An admin harness: setup done, the admin signed in, one more ordinary user signed in. */
async function adminBase(/** @type {import("node:test").TestContext} */ t) {
  const h = await authHarness(t);
  const as = await h.signIn(await h.setup());
  const other = await h.signIn(
    await h.addUser({ email: "other@example.test" }),
  );
  return { h, as, other };
}

/**
 * The cases by route: a request that the route accepts (`ok`) when every header is right.
 * @type {Record<string, (t: import("node:test").TestContext) => Promise<Prepared>>}
 */
const CASES = {
  "POST /api/auth/setup": async (t) => {
    const { h, as, other } = await base(t);
    return {
      h,
      as,
      other,
      path: "/api/auth/setup",
      body: {
        token: h.setupToken,
        email: ADMIN.email,
        name: ADMIN.name,
        password: ADMIN.password,
      },
      ok: 201,
    };
  },
  "POST /api/auth/login": async (t) => {
    const { h, as, other } = await base(t);
    return {
      h,
      as,
      other,
      path: "/api/auth/login",
      body: { email: as.email, password: as.password },
      ok: 200,
    };
  },
  "POST /api/auth/logout": async (t) => ({
    ...(await base(t)),
    path: "/api/auth/logout",
    body: {},
    ok: 200,
  }),
  "POST /api/auth/password": async (t) => {
    const { h, as, other } = await base(t);
    return {
      h,
      as,
      other,
      path: "/api/auth/password",
      body: { current: as.password, next: "csrf-new-password-1" },
      ok: 200,
    };
  },
  "POST /api/auth/reauth": async (t) => {
    const { h, as, other } = await base(t);
    return {
      h,
      as,
      other,
      path: "/api/auth/reauth",
      body: { password: as.password, purpose: "settings" },
      ok: 200,
    };
  },
  "POST /api/auth/reset": async (t) => {
    const { h, as: admin, other } = await adminBase(t);
    const target = await h.addUser({ email: "target@example.test" });
    const link = await h.call(
      "POST",
      `/api/admin/users/${target.id}/reset-link`,
      { as: admin, reauth: await h.reauthToken(admin, "reset_link"), body: {} },
    );
    const as = await h.signIn(
      await h.addUser({ email: "caller@example.test" }),
    );
    return {
      h,
      as,
      other,
      path: "/api/auth/reset",
      body: {
        code: link.json.link.split("#c=")[1],
        password: "csrf-reset-pass-1",
      },
      ok: 200,
    };
  },
  "POST /api/admin/users/:id/reset-link": async (t) => {
    const { h, as, other } = await adminBase(t);
    return {
      h,
      as,
      other,
      path: `/api/admin/users/${other.id}/reset-link`,
      body: {},
      reauth: await h.reauthToken(as, "reset_link"),
      ok: 200,
    };
  },
  "POST /api/admin/totp/enrol": async (t) => {
    const { h, as, other } = await adminBase(t);
    return {
      h,
      as,
      other,
      path: "/api/admin/totp/enrol",
      body: {},
      reauth: await h.reauthToken(as, "totp_enrol"),
      ok: 200,
    };
  },
  "POST /api/admin/totp/confirm": async (t) => {
    const { h, as, other } = await adminBase(t);
    const secret = await enrol(h, as);
    return {
      h,
      as,
      other,
      path: "/api/admin/totp/confirm",
      body: { code: totpCode(secret, h.now()) },
      ok: 200,
    };
  },
  "POST /api/admin/totp/off": async (t) => {
    const { h, as, other } = await adminBase(t);
    const secret = await enrol(h, as);
    const confirmed = await h.call("POST", "/api/admin/totp/confirm", {
      as,
      body: { code: totpCode(secret, h.now()) },
    });
    assert.equal(confirmed.status, 200);
    h.tick(30000);
    const reauth = await h.reauthToken(as, "totp_off", {
      code: totpCode(secret, h.now()),
    });
    h.tick(30000);
    return {
      h,
      as,
      other,
      path: "/api/admin/totp/off",
      body: { code: totpCode(secret, h.now()) },
      reauth,
      ok: 200,
    };
  },
};

/** Starts a TOTP enrolment of the admin; the base32 secret. @param {H} h @param {Actor} admin */
async function enrol(h, admin) {
  const r = await h.call("POST", "/api/admin/totp/enrol", {
    as: admin,
    reauth: await h.reauthToken(admin, "totp_enrol"),
    body: {},
  });
  assert.equal(r.status, 200);
  return /** @type {string} */ (r.json.secret);
}

test("CS-1 every non-GET route with session true refuses a foreign or missing Origin (403), another body type (415) and a missing, foreign or changed CSRF token (403), and every row stays unchanged", async (t) => {
  const rows = (await realRoutes(t)).filter(
    (r) => r.method !== "GET" && r.meta.session === true,
  );
  t.diagnostic(`CS-1 routes with cases: ${rows.length}`);
  assert.ok(rows.length > 0);
  let refusals = 0;
  for (const row of rows) {
    const key = `${row.method} ${row.path}`;
    const prepare = CASES[key];
    assert.ok(prepare, `no case for ${key}`);
    const p = await prepare(t);
    const send = (/** @type {import("../fixtures/auth.js").CallOptions} */ o) =>
      p.h.call(row.method, p.path, {
        as: p.as,
        reauth: p.reauth,
        body: p.body,
        ...o,
      });
    const csrf = /** @type {string} */ (p.as.csrf);
    const changed = `${csrf.slice(0, -1)}${csrf.endsWith("A") ? "B" : "A"}`;
    /** @type {Array<[string, import("../fixtures/auth.js").CallOptions, number, string]>} */
    const cases = [
      [
        "foreign Origin",
        { origin: "https://evil.example" },
        403,
        "origin_refused",
      ],
      ["missing Origin", { origin: null }, 403, "origin_refused"],
      ["Origin null", { origin: "null" }, 403, "origin_refused"],
      [
        "Origin with a slash",
        { origin: `${p.h.origin}/` },
        403,
        "origin_refused",
      ],
      [
        "Origin of another port",
        { origin: "http://127.0.0.1:2" },
        403,
        "origin_refused",
      ],
      ["text/plain", { type: "text/plain" }, 415, "unsupported_type"],
      [
        "a form type",
        { type: "application/x-www-form-urlencoded" },
        415,
        "unsupported_type",
      ],
      ["no type", { type: null }, 415, "unsupported_type"],
      [
        "json with another charset",
        { type: "application/json; charset=latin1" },
        415,
        "unsupported_type",
      ],
      ["missing CSRF", { csrf: null }, 403, "csrf_refused"],
      ["CSRF of another session", { csrf: p.other.csrf }, 403, "csrf_refused"],
      [
        "CSRF with a changed last character",
        { csrf: changed },
        403,
        "csrf_refused",
      ],
      ["CSRF one character longer", { csrf: `${csrf}A` }, 403, "csrf_refused"],
      [
        "CSRF one character shorter",
        { csrf: csrf.slice(1) },
        403,
        "csrf_refused",
      ],
    ];
    if (!row.meta.admin)
      cases.push(
        [
          "anonymous, foreign Origin",
          { cookie: null, csrf: null, origin: "https://evil.example" },
          403,
          "origin_refused",
        ],
        [
          "anonymous, missing Origin",
          { cookie: null, csrf: null, origin: null },
          403,
          "origin_refused",
        ],
        [
          "anonymous, text/plain",
          { cookie: null, csrf: null, type: "text/plain" },
          415,
          "unsupported_type",
        ],
      );
    for (const [label, o, status, code] of cases) {
      const before = await p.h.counts();
      const digest = await p.h.digest();
      const r = await send(o);
      assert.equal(r.status, status, `${key}, ${label}: ${r.text}`);
      assert.deepEqual(r.json, { error: code }, `${key}, ${label}`);
      assert.deepEqual(r.setCookie, [], `${key}, ${label}`);
      assert.deepEqual(await p.h.counts(), before, `${key}, ${label}: counts`);
      assert.deepEqual(await p.h.digest(), digest, `${key}, ${label}: rows`);
      refusals += 1;
    }
    // The same request with every header right is accepted: the refusals came from the checks.
    const accepted = await send({});
    assert.equal(accepted.status, p.ok, `${key} accepted: ${accepted.text}`);
  }
  t.diagnostic(`CS-1 refusals checked: ${refusals}`);
});

test("CS-2 every non-GET route with session false is POST /api/demo/result or a worker route", async (t) => {
  const rows = await realRoutes(t);
  const outside = rows
    .filter((r) => r.method !== "GET" && r.meta.session !== true)
    .map((r) => `${r.method} ${r.path}`);
  assert.ok(outside.includes("POST /api/demo/result"));
  for (const k of outside)
    assert.ok(
      k === "POST /api/demo/result" || /^[A-Z]+ \/api\/worker\//.test(k),
      `outside the CSRF rule: ${k}`,
    );
  // Every route the rule covers is in the table with session true (the auth and admin routes).
  const covered = rows
    .filter((r) => r.meta.session === true)
    .map((r) => r.path);
  for (const p of ["/api/auth/setup", "/api/auth/login", "/api/auth/reset"])
    assert.ok(covered.includes(p), p);
});

test("CS-3 POST /api/demo/result without Origin, with a text body or a foreign Origin answers 200 and the same answer as the app without accounts", async (t) => {
  const h = await authHarness(t, { demo: demo() });
  const plain = createApp({
    config: { siteGate: false, version: "dev" },
    origins: { app: h.origin, preview: "http://localhost:1" },
    db: null,
    site: null,
    migrations: [],
    log: () => {},
    demo: demo(),
  });
  const body = JSON.stringify({ answers: { goal: "tell" } });
  for (const [
    label,
    headers,
  ] of /** @type {Array<[string, Record<string, string>]>} */ ([
    ["no Origin, text/plain", { "Content-Type": "text/plain" }],
    ["no Origin, no type", {}],
    [
      "foreign Origin",
      { Origin: "https://evil.example", "Content-Type": "text/plain" },
    ],
    [
      "own Origin, json",
      { Origin: h.origin, "Content-Type": "application/json" },
    ],
  ])) {
    const before = await h.digest();
    const a = await h.app.request(`${h.origin}/api/demo/result?lang=ru`, {
      method: "POST",
      headers,
      body,
    });
    const b = await plain.request(`${h.origin}/api/demo/result?lang=ru`, {
      method: "POST",
      headers,
      body,
    });
    assert.equal(a.status, 200, label);
    const text = await a.text();
    assert.equal(text, await b.text(), label);
    assert.ok(Array.isArray(JSON.parse(text).recommended), label);
    assert.deepEqual(a.headers.getSetCookie(), []);
    assert.deepEqual(await h.digest(), before, `${label}: no row changes`);
  }
});

test("CS-4 every GET route of the table changes no row except auth_sessions.last_seen_at, rate_limits and audit_log", async (t) => {
  /** @type {ReadonlyArray<import("../../server/routes/index.js").Route>} */
  let rows = [];
  const h = await authHarness(t, {
    demo: demo(),
    routeTable: (/** @type {any} */ deps) => (rows = routeTable(deps)),
  });
  const admin = await h.signIn(await h.setup());
  const user = await h.signIn(await h.addUser());
  const gets = rows.filter((r) => r.method === "GET");
  t.diagnostic(`CS-4 GET routes: ${gets.length}`);
  assert.ok(gets.length >= 4);
  const tables = [
    "users",
    "orgs",
    "org_members",
    "invites",
    "auth_sessions",
    "reauth_tokens",
    "password_resets",
    "login_delays",
    "login_failures",
    "platform_settings",
    "schema_migrations",
  ];
  const omit = { auth_sessions: ["last_seen_at"] };
  for (const r of gets)
    for (const as of [null, user, admin]) {
      h.tick(1000);
      const before = await h.digest(tables, omit);
      const res = await h.call("GET", `${r.path}?lang=ru`, {
        as,
        origin: null,
      });
      assert.ok(res.status < 500, `${r.path}: ${res.status}`);
      assert.deepEqual(
        await h.digest(tables, omit),
        before,
        `${r.path} as ${as?.role ?? "anonymous"}`,
      );
    }
});
