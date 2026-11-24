import assert from "node:assert/strict";
import { test } from "node:test";
import { createDb } from "../../server/db/index.js";
import {
  switchToTenant,
  withPlatform,
  withTenant,
} from "../../server/db/tx.js";
import { routeTable } from "../../server/routes/index.js";
import { appendAudit } from "../../server/services/audit.js";
import { authHarness } from "../fixtures/auth.js";
import { migratedPglite } from "../fixtures/db.js";

// REQ-115 criterion 4 (the code design M2AUTH, 4.3, 4.5.3, C7, C17 and B4) on PGlite: the tx.js helpers run
// every statement of the callback in one transaction under `set local role sai_app` and the two settings;
// a value that is not a uuid throws before any statement; the settings end with the transaction; a throw
// rolls back; a tenant route runs on the request's one transaction switched to tenant settings. Also the
// platform-only rule of the audit writer (decisions/0137 Addition 4, SEC F1).

// A lower-case uuid of the form ARCH §14.2 gives, written here as the test's own oracle.
const UUID_FORM =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const A = "a1111111-1111-4111-8111-111111111111";
const B = "b2222222-2222-4222-8222-222222222222";

/**
 * A migrated PGlite under the login role behind an adapter that counts every statement (plain and inside a
 * transaction) and every transaction, and the Db of the app over it.
 */
async function counted() {
  const raw = await migratedPglite();
  const tx = /** @type {NonNullable<typeof raw.transaction>} */ (
    raw.transaction
  );
  /** @type {string[]} */
  const texts = [];
  let transactions = 0;
  const adapter = {
    query: (/** @type {string} */ t, /** @type {unknown[]} */ p) => (
      texts.push(t),
      raw.query(t, p)
    ),
    exec: (/** @type {string} */ t) => (texts.push(t), raw.exec(t)),
    close: () => raw.close(),
    transaction: (/** @type {(c: any) => Promise<any>} */ fn) => {
      transactions += 1;
      return tx((c) =>
        fn({
          query: (/** @type {string} */ t, /** @type {unknown[]} */ p) => (
            texts.push(t),
            c.query(t, p)
          ),
        }),
      );
    },
  };
  const db = createDb(adapter);
  await db.ensureSafe();
  // Two organisations, made as the platform (the test's own rows).
  await withPlatform(db, async (q) => {
    for (const [id, name] of [
      [A, "Org A"],
      [B, "Org B"],
    ])
      await q.query(
        "insert into orgs (id, name, kind) values ($1, $2, 'customer')",
        [id, name],
      );
  });
  return {
    db,
    raw,
    texts,
    transactions: () => transactions,
    /** @param {string} table */
    count: async (table) =>
      withPlatform(
        db,
        async (q) =>
          (await q.query(`select count(*)::int as n from ${table}`)).rows[0].n,
      ),
  };
}

const WHO =
  "select current_user as u, current_setting('app.org_id', true) as o, current_setting('app.role', true) as r";

test("TXH-1 withTenant with a value that is not a uuid throws before any statement", async (t) => {
  const c = await counted();
  t.after(() => c.raw.close());
  const one = A.replace("1", "g");
  assert.ok(!UUID_FORM.test(one));
  // The values of the criterion, and the classes around them: case, length, form, version and variant
  // digits, white space, other types.
  /** @type {unknown[]} */
  const bad = [
    "",
    "org",
    one,
    A.toUpperCase(),
    A.slice(0, -1),
    `${A}0`,
    ` ${A}`,
    `${A}\n`,
    `{${A}}`,
    A.replaceAll("-", ""),
    "a1111111-1111-0111-8111-111111111111",
    "a1111111-1111-4111-c111-111111111111",
    `${A},${B}`,
    `${A}' or '1'='1`,
    null,
    undefined,
    42,
    [A],
    { toString: () => A },
  ];
  // Generated texts of the uuid alphabet with a fixed seed: each is refused exactly when it is not of the
  // form (the oracle above), never by luck.
  let seed = 115;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
  const alphabet = "0123456789abcdefgABF-";
  for (let i = 0; i < 200; i++) {
    const chars = [...A].map((ch) =>
      rnd() < 0.08 ? alphabet[Math.floor(rnd() * alphabet.length)] : ch,
    );
    const v = chars.join("");
    if (!UUID_FORM.test(v)) bad.push(v);
  }
  assert.ok(bad.length > 60, `${bad.length} cases`);
  const before = c.texts.length;
  for (const v of bad) {
    await assert.rejects(
      withTenant(c.db, /** @type {any} */ (v), async () => "ran"),
      (e) =>
        e instanceof TypeError &&
        e.message === "withTenant: orgId is not a uuid",
      String(v),
    );
  }
  assert.equal(c.texts.length - before, 0, "no statement was sent");
  assert.equal(c.transactions(), 1, "only the setup transaction");
  // A value of the form is taken.
  assert.equal(await withTenant(c.db, A, async () => "ran"), "ran");
});

test("TXH-2 inside withTenant(A) the role is sai_app, app.org_id is A and app.role is tenant; inside withPlatform app.role is platform; each callback runs in one transaction", async (t) => {
  const c = await counted();
  t.after(() => c.raw.close());
  const before = c.transactions();
  const tenant = await withTenant(c.db, A, async (q) => ({
    who: (await q.query(WHO)).rows[0],
    orgs: (await q.query("select id from orgs order by id")).rows.map(
      (r) => r.id,
    ),
    // The same transaction for every statement: the transaction id does not change.
    xids: [
      (await q.query("select txid_current()::text as x")).rows[0].x,
      (await q.query("select txid_current()::text as x")).rows[0].x,
    ],
  }));
  assert.deepEqual(tenant.who, { u: "sai_app", o: A, r: "tenant" });
  assert.deepEqual(tenant.orgs, [A]);
  assert.equal(tenant.xids[0], tenant.xids[1]);
  const platform = await withPlatform(c.db, async (q) => ({
    who: (await q.query(WHO)).rows[0],
    orgs: (await q.query("select id from orgs order by id")).rows.map(
      (r) => r.id,
    ),
  }));
  assert.deepEqual(platform.who, { u: "sai_app", o: "", r: "platform" });
  assert.deepEqual(platform.orgs, [A, B]);
  assert.equal(c.transactions() - before, 2);
  // The callback gets no exec: the simple protocol cannot carry a second statement past the settings.
  await withTenant(c.db, A, async (q) => {
    assert.equal(/** @type {any} */ (q).exec, undefined);
  });
});

test("TXH-3 after the transaction the same connection answers the login role and an empty app.org_id; a plain statement sent while a callback waits runs outside it", async (t) => {
  const c = await counted();
  t.after(() => c.raw.close());
  await withTenant(c.db, A, async (q) => {
    await q.query("select 1");
  });
  assert.deepEqual((await c.db.query(WHO)).rows[0], {
    u: "sai_app_login",
    o: "",
    r: "",
  });
  // A plain statement sent from inside the callback (as another request would send it) must not run in the
  // open transaction: on PGlite a manual BEGIN would let it in (F9, the mutant M43).
  /** @type {Promise<any> | null} */
  let plain = null;
  const inside = await withTenant(c.db, A, async (q) => {
    await q.query("select 1");
    plain = c.db.query(WHO);
    // One more statement of the transaction after the plain one was queued.
    return (await q.query(WHO)).rows[0];
  });
  assert.deepEqual(inside, { u: "sai_app", o: A, r: "tenant" });
  const outside = (await /** @type {Promise<any>} */ (plain)).rows[0];
  assert.deepEqual(outside, { u: "sai_app_login", o: "", r: "" });
});

test("TXH-4 a throw inside the callback rolls back every statement of it and goes on unchanged", async (t) => {
  const c = await counted();
  t.after(() => c.raw.close());
  const counts = async () => ({
    orgs: await c.count("orgs"),
    invites: await c.count("invites"),
    members: await c.count("org_members"),
    users: await c.count("users"),
  });
  const HASH = `scrypt$17$8$1$${"A".repeat(22)}$${"A".repeat(86)}`;
  await withPlatform(c.db, (q) =>
    q.query(
      "insert into users (email, email_norm, display_name, password_hash) values ('u@example.test', 'u@example.test', 'U', $1)",
      [HASH],
    ),
  );
  const before = await counts();
  const boom = new Error("planted");
  await assert.rejects(
    withPlatform(c.db, async (q) => {
      await q.query(
        "insert into orgs (name, kind) values ('Org C', 'customer')",
      );
      await q.query(
        "insert into users (email, email_norm, display_name, password_hash) values ('x@example.test', 'x@example.test', 'X', $1)",
        [HASH],
      );
      throw boom;
    }),
    (e) => e === boom,
  );
  await assert.rejects(
    withTenant(c.db, A, async (q) => {
      const made = await q.query(
        "insert into invites (org_id, email_norm, role, code_hash, expires_at, created_by) select $1, 'i@example.test', 'viewer', $2, now(), id from users limit 1 returning id",
        [A, "c".repeat(64)],
      );
      assert.equal(made.rows.length, 1, "the invite was inserted");
      await q.query(
        "insert into org_members (org_id, user_id, role) select $1, id, 'member' from users limit 1",
        [A],
      );
      throw boom;
    }),
    (e) => e === boom,
  );
  assert.deepEqual(await counts(), before);
  assert.deepEqual(before, { orgs: 2, invites: 0, members: 0, users: 1 });
});

test("TXH-5 a planted tenant route takes the request's one transaction switched to tenant settings: one transaction, sai_app, tenant, the session's organisation, a foreign insert refused, an answer within 5 s; switchToTenant with a value that is not a uuid sends no statement", async (t) => {
  /** @type {any[]} */
  const seen = [];
  const planted = Object.freeze({
    method: "GET",
    path: "/api/t/probe",
    meta: Object.freeze({
      tenant: true,
      admin: false,
      reauth: null,
      worker: false,
      session: true,
      rateLimit: "user",
    }),
    handler: async (/** @type {any} */ req) => {
      const who = (await req.q.query(WHO)).rows[0];
      await req.q.query("savepoint planted");
      /** @type {string | null} */
      let refused = null;
      try {
        await req.q.query(
          "insert into org_members (org_id, user_id, role) values ($1, $2, 'viewer')",
          [req.query.get("foreign"), req.query.get("user")],
        );
      } catch (err) {
        refused = /** @type {any} */ (err).sqlstate ?? "refused";
      }
      await req.q.query("rollback to savepoint planted");
      seen.push({ who, refused });
      return { status: 200, body: { ok: true } };
    },
  });
  const h = await authHarness(t, {
    routeTable: (/** @type {any} */ deps) => [...routeTable(deps), planted],
  });
  const member = await h.signIn(await h.addUser({ role: "member" }));
  const other = await h.addOrg("Foreign");
  // An account without a membership: the planted insert breaks no key, so only row security can refuse it.
  const stranger = await h.addUser({ role: null });
  const before = h.transactions();
  const members = await h.digest(["org_members"]);
  const started = Date.now();
  // A request that never answers (a transaction opened inside the request's own one waits for ever on
  // PGlite, F25) fails at 5 s instead of holding the test.
  /** @type {NodeJS.Timeout | undefined} */
  let timer;
  const r = await Promise.race([
    h.call("GET", `/api/t/probe?foreign=${other}&user=${stranger.id}`, {
      as: member,
      origin: null,
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("no answer within 5 s")), 5000);
    }),
  ]).finally(() => clearTimeout(timer));
  assert.ok(Date.now() - started < 5000, `${Date.now() - started} ms`);
  assert.equal(r.status, 200, r.text);
  assert.equal(h.transactions() - before, 1, "one transaction per request");
  assert.deepEqual(seen, [
    { who: { u: "sai_app", o: member.orgId, r: "tenant" }, refused: "42501" },
  ]);
  assert.deepEqual(await h.digest(["org_members"]), members);
  // An anonymous call of the tenant route: 401, and no handler ran.
  const anon = await h.call("GET", "/api/t/probe", { origin: null });
  assert.equal(anon.status, 401);
  assert.equal(seen.length, 1);
  // switchToTenant refuses a value that is not a uuid before any statement.
  /** @type {string[]} */
  const sent = [];
  const q = {
    query: async (/** @type {string} */ text) => (
      sent.push(text),
      { rows: [] }
    ),
  };
  for (const v of ["", "org", A.replace("1", "g"), A.toUpperCase()])
    await assert.rejects(
      switchToTenant(q, v),
      (e) =>
        e instanceof TypeError &&
        e.message === "switchToTenant: orgId is not a uuid",
      v,
    );
  assert.deepEqual(sent, []);
  await switchToTenant(q, A);
  assert.equal(sent.length, 1);
});

test("TXH-6 the audit writer refuses to write under tenant settings: TypeError before the chain lock, audit_log unchanged; under platform settings it writes one row", async (t) => {
  const c = await counted();
  t.after(() => c.raw.close());
  const entry = {
    orgId: A,
    actorKind: /** @type {const} */ ("system"),
    actorId: null,
    action: "auth.login_failed",
    targetKind: null,
    targetId: null,
    ip: null,
    details: { reason: "unknown_email" },
  };
  const ctx = { now: Date.UTC(2026, 10, 24), mac: () => "f".repeat(64) };
  const before = await c.count("audit_log");
  /** @type {string[]} */
  let inTx = [];
  await assert.rejects(
    withTenant(c.db, A, async (q) => {
      const mark = c.texts.length;
      try {
        await appendAudit(q, entry, ctx);
      } finally {
        inTx = c.texts.slice(mark);
      }
    }),
    (e) =>
      e instanceof TypeError &&
      e.message === "audit: the writer runs only under platform settings",
  );
  assert.ok(
    inTx.every((s) => !/pg_advisory_xact_lock|insert into audit_log/i.test(s)),
    inTx.join("\n"),
  );
  assert.equal(await c.count("audit_log"), before);
  await withPlatform(c.db, (q) => appendAudit(q, entry, ctx));
  assert.equal(await c.count("audit_log"), before + 1);
});
