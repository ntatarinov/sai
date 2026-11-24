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
import { acceptBody, inviteBody } from "../fixtures/m23.js";
import {
  admin,
  client,
  freshDatabase,
  newPassword,
  url,
} from "../fixtures/pg-env.js";

// The races of REQ-116 and REQ-117 on real Postgres (the code design M2PROJ, 7.3, C3, C5, 4.4): ten parallel
// accepts of one invite, ten parallel edits of one project and 25 parallel creations by one user, each over a
// pool of ten connections of sai_app_login. PGlite serialises every transaction (M2AUTH F9, M2PROJ F11), so only
// this job shows that the row locks of the invite claim, of the project row and of the daily window do their
// work. The hasher waits in every computation, so the parallel requests overlap for real; the clock is fixed.

/**
 * A migrated database, the app on it over a pool of 10, and a superuser client for the reads.
 * @param {import("node:test").TestContext} t
 */
async function pgApp(t) {
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
  const hasher = fastHasher({ delayMs: 100 });
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
   * @param {{ ip: string, body?: unknown, cookie?: string | null, csrf?: string | null, reauth?: string | null }} c
   */
  const call = async (method, path, c) => {
    /** @type {Record<string, string>} */
    const headers = { Origin: ORIGIN };
    if (c.body !== undefined) headers["Content-Type"] = "application/json";
    if (c.cookie) headers.Cookie = c.cookie;
    if (c.csrf) headers["x-sai-csrf"] = c.csrf;
    if (c.reauth) headers["x-sai-reauth"] = c.reauth;
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
      text,
      json: text.startsWith("{") ? JSON.parse(text) : null,
      retryAfter: res.headers.get("retry-after"),
      cookie: res.headers.getSetCookie()[0]?.split(";")[0] ?? null,
    };
  };
  const adminIp = "192.0.2.250";
  /** Setup, the admin's login and a re-auth token; returns what an admin call needs. */
  const adminSession = async () => {
    const s = await call("POST", "/api/auth/setup", {
      ip: adminIp,
      body: {
        token: setupToken,
        email: ADMIN.email,
        name: ADMIN.name,
        password: ADMIN.password,
      },
    });
    assert.equal(s.status, 201, s.text);
    const l = await call("POST", "/api/auth/login", {
      ip: adminIp,
      body: { email: ADMIN.email, password: ADMIN.password },
    });
    assert.equal(l.status, 200, l.text);
    const me = await call("GET", "/api/auth/me", {
      ip: adminIp,
      cookie: l.cookie,
    });
    return {
      ip: adminIp,
      cookie: l.cookie,
      csrf: /** @type {string} */ (me.json.csrf),
    };
  };
  /**
   * An invite of a new customer organisation made by the admin; returns its code.
   * @param {{ ip: string, cookie: string | null, csrf: string }} a
   * @param {string} email
   */
  const makeInvite = async (a, email) => {
    const re = await call("POST", "/api/auth/reauth", {
      ...a,
      body: { password: ADMIN.password, purpose: "owner_identity" },
    });
    assert.equal(re.status, 200, re.text);
    const r = await call("POST", "/api/admin/invites", {
      ...a,
      reauth: re.json.token,
      body: inviteBody({ email, org_name: "Race Co" }),
    });
    assert.equal(r.status, 201, r.text);
    return /** @type {string} */ (r.json.link.split("#c=")[1]);
  };
  return { call, su, makeInvite, adminSession, hasher };
}

/** @param {number[]} statuses */
const tally = (statuses) =>
  statuses.reduce(
    (a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }),
    /** @type {Record<number, number>} */ ({}),
  );

/**
 * A client of a new customer organisation: invited by the admin, accepted, signed in by the accept's cookie.
 * @param {Awaited<ReturnType<typeof pgApp>>} p
 */
async function client1(p) {
  const a = await p.adminSession();
  const code = await p.makeInvite(a, "client.race@example.test");
  const ip = "203.0.113.50";
  const r = await p.call("POST", `/api/invites/${code}/accept`, {
    ip,
    body: acceptBody({ email: "client.race@example.test" }),
  });
  assert.equal(r.status, 200, r.text);
  const me = await p.call("GET", "/api/auth/me", { ip, cookie: r.cookie });
  assert.equal(me.status, 200, me.text);
  return { ip, cookie: r.cookie, csrf: /** @type {string} */ (me.json.csrf) };
}

const projectBody = (/** @type {string} */ title) => ({
  title,
  idea: "A race idea",
  what: "tool",
  whom: "team",
  lang: "ru",
});

test("M2R-1 ten parallel accepts of one invite code over a pool of ten connections: exactly one 200 and nine 404, one user, one membership, one organisation, one consent record, one audit row invite.accept, and the invite is spent once", async (t) => {
  const p = await pgApp(t);
  const a = await p.adminSession();
  const email = "race.invitee@example.test";
  const code = await p.makeInvite(a, email);
  const before = p.hasher.count();
  const answers = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      p.call("POST", `/api/invites/${code}/accept`, {
        ip: `203.0.113.${100 + i}`,
        body: acceptBody({ email, name: `Racer ${i}` }),
      }),
    ),
  );
  assert.deepEqual(
    tally(answers.map((x) => x.status)),
    { 200: 1, 404: 9 },
    answers.map((x) => `${x.status} ${x.text}`).join("\n"),
  );
  for (const x of answers.filter((y) => y.status === 404))
    assert.deepEqual(x.json, { error: "not_found" });
  const one = async (
    /** @type {string} */ sql,
    /** @type {unknown[]} */ params,
  ) => (await p.su.query(sql, params)).rows[0].n;
  assert.equal(
    await one("select count(*)::int as n from users where email_norm = $1", [
      email,
    ]),
    1,
  );
  const [u] = (
    await p.su.query("select id from users where email_norm = $1", [email])
  ).rows;
  assert.equal(
    await one("select count(*)::int as n from org_members where user_id = $1", [
      u.id,
    ]),
    1,
  );
  assert.equal(
    await one(
      "select count(*)::int as n from user_consents where user_id = $1",
      [u.id],
    ),
    1,
  );
  assert.equal(
    await one("select count(*)::int as n from orgs where name = 'Race Co'", []),
    1,
  );
  assert.equal(
    await one(
      "select count(*)::int as n from audit_log where action = 'invite.accept'",
      [],
    ),
    1,
  );
  const inv = (
    await p.su.query(
      "select used_at, used_by from invites where email_norm = $1",
      [email],
    )
  ).rows;
  assert.equal(inv.length, 1);
  assert.equal(inv[0].used_by, u.id);
  assert.notEqual(inv[0].used_at, null);
  assert.ok(
    p.hasher.count() > before,
    "the passwords were computed in parallel",
  );
});

test("M2R-2 ten parallel edits of one project over a pool of ten connections: all ten answer 200 with the versions 2 to 11 each once, the stored versions are 1 to 11 with no gap and no duplicate, and the ten audit rows carry ten distinct version numbers", async (t) => {
  const p = await pgApp(t);
  const c = await client1(p);
  const made = await p.call("POST", "/api/projects", {
    ...c,
    body: projectBody("Race project"),
  });
  assert.equal(made.status, 201, made.text);
  const id = made.json.id;
  const answers = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      p.call("POST", `/api/projects/${id}/idea`, {
        ...c,
        body: { text: `Edit ${i}`, reason: `Reason ${i}` },
      }),
    ),
  );
  for (const x of answers) assert.equal(x.status, 200, x.text);
  assert.deepEqual(
    answers.map((x) => x.json.version).sort((x, y) => x - y),
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  );
  const stored = (
    await p.su.query(
      "select version from idea_versions where project_id = $1 order by version",
      [id],
    )
  ).rows.map((r) => r.version);
  assert.deepEqual(stored, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  // The version of each answer is the version of the row that carries its text.
  for (const [i, x] of answers.entries()) {
    const [row] = (
      await p.su.query(
        "select version from idea_versions where project_id = $1 and text = $2",
        [id, `Edit ${i}`],
      )
    ).rows;
    assert.equal(row.version, x.json.version, `edit ${i}`);
  }
  const audit = (
    await p.su.query(
      "select (details->>'version')::int as v from audit_log where action = 'project.idea_version' and target_id = $1 order by v",
      [id],
    )
  ).rows.map((r) => r.v);
  assert.deepEqual(audit, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("M2R-3 25 parallel creations by one user over a pool of ten connections: exactly 20 answer 201 and five answer 429 with Retry-After, 20 projects and 20 audit rows project.create stand, and no project of the refused five", async (t) => {
  const p = await pgApp(t);
  const c = await client1(p);
  const answers = await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      p.call("POST", "/api/projects", {
        ...c,
        body: projectBody(`Parallel ${i}`),
      }),
    ),
  );
  assert.deepEqual(
    tally(answers.map((x) => x.status)),
    { 201: 20, 429: 5 },
    answers.map((x) => `${x.status} ${x.text}`).join("\n"),
  );
  for (const x of answers.filter((y) => y.status === 429)) {
    assert.deepEqual(x.json, { error: "rate_limited" });
    assert.match(x.retryAfter ?? "", /^[1-9][0-9]*$/);
  }
  const count = async (/** @type {string} */ sql) =>
    (await p.su.query(sql)).rows[0].n;
  assert.equal(await count("select count(*)::int as n from projects"), 20);
  assert.equal(await count("select count(*)::int as n from idea_versions"), 20);
  assert.equal(
    await count(
      "select count(*)::int as n from audit_log where action = 'project.create'",
    ),
    20,
  );
  const made = new Set(
    answers.filter((x) => x.status === 201).map((x) => x.json.id),
  );
  const stored = new Set(
    (await p.su.query("select id from projects")).rows.map((r) => r.id),
  );
  assert.deepEqual(stored, made);
});
