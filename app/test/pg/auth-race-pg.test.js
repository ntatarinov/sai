import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { test } from "node:test";
import { createApp } from "../../server/app.js";
import { createDb } from "../../server/db/index.js";
import { createPgAdapter } from "../../server/db/pg.js";
import {
  ADMIN,
  ORIGIN,
  PREVIEW,
  fastHasher,
  randomToken,
  sha256Hex,
} from "../fixtures/auth.js";
import { migrationList } from "../fixtures/db.js";
import { APP, childEnv } from "../fixtures/helpers.js";
import {
  admin,
  client,
  freshDatabase,
  newPassword,
  url,
} from "../fixtures/pg-env.js";

// REQ-114 criteria 5 and 2 on real Postgres (the code design M2AUTH, 4.9.5 B3 and P2, C16, 4.9.6): parallel
// attempts on one counter are serialised by the row lock of the row that holds it (PGlite serialises every
// transaction, F9, so only this job shows it). The app runs as sai_app_login on a pool of 10 connections;
// the hasher of the test waits in every computation, so parallel requests overlap for real.

/**
 * A migrated database, the app on it, and a superuser client for the seeds and the reads.
 * @param {import("node:test").TestContext} t
 * @param {{ delayMs: number }} o
 */
async function pgApp(t, o) {
  const name = await freshDatabase(t);
  const pw = newPassword();
  const m = spawnSync(process.execPath, ["server/db/migrate.js"], {
    cwd: APP,
    env: childEnv({
      DATABASE_URL: url("postgres", admin().password, name),
      APP_DB_PASSWORD: pw,
    }),
    encoding: "utf8",
  });
  assert.equal(m.status, 0, m.stderr);
  const su = await client(name);
  const adapter = createPgAdapter(url("sai_app_login", pw, name), {
    connectTimeoutMs: 4000,
    max: 10,
  });
  t.after(async () => {
    await adapter.close();
    await su.end();
  });
  const hasher = fastHasher({ delayMs: o.delayMs });
  const setupToken = randomToken();
  const pepper = crypto.randomBytes(32);
  const now = Date.UTC(2026, 10, 24, 12, 0, 0);
  const app = createApp({
    config: { siteGate: false, version: "dev" },
    origins: { app: ORIGIN, preview: PREVIEW },
    db: createDb(adapter),
    site: null,
    migrations: migrationList(),
    log: () => {},
    auth: {
      pepper,
      setupTokenHash: sha256Hex(setupToken),
      clock: () => now,
      random: () => 1,
      passwords: hasher,
    },
  });
  /**
   * @param {string} method
   * @param {string} path
   * @param {{ ip: string, body?: unknown, cookie?: string, csrf?: string }} c
   */
  const call = async (method, path, c) => {
    /** @type {Record<string, string>} */
    const headers = { Origin: ORIGIN };
    if (c.body !== undefined) headers["Content-Type"] = "application/json";
    if (c.cookie) headers.Cookie = c.cookie;
    if (c.csrf) headers["x-sai-csrf"] = c.csrf;
    const started = performance.now();
    const res = await app.request(
      `${ORIGIN}${path}`,
      {
        method,
        headers,
        body: c.body === undefined ? undefined : JSON.stringify(c.body),
      },
      { clientIp: c.ip },
    );
    const text = await res.text();
    return {
      status: res.status,
      json: JSON.parse(text),
      retryAfter: res.headers.get("retry-after"),
      cookie: res.headers.getSetCookie()[0]?.split(";")[0] ?? null,
      ms: performance.now() - started,
    };
  };
  /** An ordinary user inserted by the superuser. @param {string} email @param {string} password */
  const addUser = async (email, password) => {
    const r = await su.query(
      "insert into users (email, email_norm, display_name, password_hash) values ($1, lower($1), 'Race User', $2) returning id",
      [email, await hasher.hash(password)],
    );
    return /** @type {string} */ (r.rows[0].id);
  };
  const setup = async () => {
    const r = await call("POST", "/api/auth/setup", {
      ip: "192.0.2.250",
      body: {
        token: setupToken,
        email: ADMIN.email,
        name: ADMIN.name,
        password: ADMIN.password,
      },
    });
    assert.equal(r.status, 201);
  };
  return { app, call, su, hasher, addUser, setup, setupToken };
}

/** @param {number[]} statuses */
const tally = (statuses) =>
  statuses.reduce(
    (a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }),
    /** @type {Record<number, number>} */ ({}),
  );

test("AUTH-RACE-1 ten parallel wrong logins on one ordinary account from ten addresses: exactly 5 × 401 and 5 × 429 locked, failed_logins = 5, five scrypt computations", async (t) => {
  const p = await pgApp(t, { delayMs: 150 });
  const id = await p.addUser("race.user@example.test", "race-user-pass-1");
  const before = p.hasher.count();
  const answers = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      p.call("POST", "/api/auth/login", {
        ip: `198.51.100.${10 + i}`,
        body: { email: "race.user@example.test", password: `wrong-pass-${i}x` },
      }),
    ),
  );
  assert.deepEqual(tally(answers.map((a) => a.status)), { 401: 5, 429: 5 });
  for (const a of answers.filter((x) => x.status === 429)) {
    assert.deepEqual(a.json, { error: "locked" });
    assert.match(String(a.retryAfter), /^[1-9][0-9]*$/);
  }
  assert.equal(
    p.hasher.count() - before,
    5,
    "scrypt only for the attempts before the lock",
  );
  const [row] = (
    await p.su.query(
      "select failed_logins, locked_until from users where id = $1",
      [id],
    )
  ).rows;
  assert.equal(row.failed_logins, 5);
  assert.ok(row.locked_until !== null);
});

test("AUTH-RACE-2 ten parallel wrong re-auth calls from ten sessions of one user: 5 × 401, 5 × 429 reauth_locked, reauth_failures = 5", async (t) => {
  const p = await pgApp(t, { delayMs: 150 });
  const id = await p.addUser("race.reauth@example.test", "race-reauth-pass-1");
  /** @type {Array<{ cookie: string, csrf: string }>} */
  const sessions = [];
  for (let i = 0; i < 10; i++) {
    const l = await p.call("POST", "/api/auth/login", {
      ip: `198.51.100.${40 + i}`,
      body: {
        email: "race.reauth@example.test",
        password: "race-reauth-pass-1",
      },
    });
    assert.equal(l.status, 200);
    const cookie = /** @type {string} */ (l.cookie);
    const me = await p.call("GET", "/api/auth/me", {
      ip: `198.51.100.${40 + i}`,
      cookie,
    });
    sessions.push({ cookie, csrf: me.json.csrf });
  }
  const answers = await Promise.all(
    sessions.map((s, i) =>
      p.call("POST", "/api/auth/reauth", {
        ip: `198.51.100.${60 + i}`,
        ...s,
        body: { password: `wrong-reauth-${i}x`, purpose: "settings" },
      }),
    ),
  );
  assert.deepEqual(tally(answers.map((a) => a.status)), { 401: 5, 429: 5 });
  for (const a of answers.filter((x) => x.status === 429))
    assert.deepEqual(a.json, { error: "reauth_locked" });
  const [row] = (
    await p.su.query(
      "select reauth_failures, reauth_locked_until, failed_logins from users where id = $1",
      [id],
    )
  ).rows;
  assert.equal(row.reauth_failures, 5);
  assert.ok(row.reauth_locked_until !== null);
  assert.equal(row.failed_logins, 0);
});

test("AUTH-RACE-3 five parallel wrong admin logins from one address: one scrypt, 4 × 429 with Retry-After, login_delays.fails = 1", async (t) => {
  const p = await pgApp(t, { delayMs: 300 });
  await p.setup();
  const before = p.hasher.count();
  const answers = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      p.call("POST", "/api/auth/login", {
        ip: "198.51.100.77",
        body: { email: ADMIN.email, password: `wrong-admin-${i}x` },
      }),
    ),
  );
  assert.deepEqual(tally(answers.map((a) => a.status)), { 401: 1, 429: 4 });
  for (const a of answers.filter((x) => x.status === 429)) {
    assert.deepEqual(a.json, { error: "rate_limited" });
    assert.match(String(a.retryAfter), /^[1-9][0-9]*$/);
  }
  assert.equal(p.hasher.count() - before, 1, "one scrypt from one address");
  const rows = (await p.su.query("select fails from login_delays")).rows;
  assert.deepEqual(rows, [{ fails: 1 }]);
});

test("AUTH-RACE-4 six parallel wrong admin logins from six addresses and the right password from a seventh, clean address at the same moment: the right one answers 200 within the deadline, each wrong one 401 with its own delay row, the admin's row unchanged", async (t) => {
  const p = await pgApp(t, { delayMs: 800 });
  await p.setup();
  const wrong = Array.from({ length: 6 }, (_, i) =>
    p.call("POST", "/api/auth/login", {
      ip: `198.51.100.${90 + i}`,
      body: { email: ADMIN.email, password: `wrong-admin-${i}y` },
    }),
  );
  const right = p.call("POST", "/api/auth/login", {
    ip: "198.51.100.99",
    body: { email: ADMIN.email, password: ADMIN.password },
  });
  const [ok, ...bad] = await Promise.all([right, ...wrong]);
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.ok(ok.cookie, "a session cookie");
  assert.ok(ok.ms < 4000, `${Math.round(ok.ms)} ms`);
  for (const b of bad) {
    assert.equal(b.status, 401);
    assert.deepEqual(b.json, { error: "invalid_credentials" });
  }
  const delays = (await p.su.query("select fails from login_delays")).rows;
  assert.deepEqual(
    delays,
    Array.from({ length: 6 }, () => ({ fails: 1 })),
  );
  const [row] = (
    await p.su.query(
      "select failed_logins, locked_until from users where is_platform_admin",
    )
  ).rows;
  assert.deepEqual(row, { failed_logins: 0, locked_until: null });
});

test("AUTH-RACE-5 two parallel setups on Postgres: exactly one 201 and one 404 and one admin (SU-3 under real concurrency)", async (t) => {
  for (let round = 0; round < 3; round++) {
    const p = await pgApp(t, { delayMs: 200 });
    const body = (/** @type {string} */ email) => ({
      token: p.setupToken,
      email,
      name: ADMIN.name,
      password: ADMIN.password,
    });
    const answers = await Promise.all([
      p.call("POST", "/api/auth/setup", {
        ip: "192.0.2.31",
        body: body(ADMIN.email),
      }),
      p.call("POST", "/api/auth/setup", {
        ip: "192.0.2.32",
        body: body("second@example.test"),
      }),
    ]);
    assert.deepEqual(
      answers.map((a) => a.status).sort(),
      [201, 404],
      JSON.stringify(answers.map((a) => a.json)),
    );
    const n = (
      await p.su.query(
        "select (select count(*) from users)::int as u, (select count(*) from orgs)::int as o, (select count(*) from audit_log)::int as a",
      )
    ).rows[0];
    assert.deepEqual(n, { u: 1, o: 1, a: 1 });
  }
});
