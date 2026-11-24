import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { APP, childEnv } from "../fixtures/helpers.js";
import {
  admin,
  client,
  freshDatabase,
  newPassword,
  url,
} from "../fixtures/pg-env.js";

// REQ-116 criterion 3 (the code design M2PROJ, 4.2.1, 4.2.3; F9) on the real Postgres of the job pg: a member of the
// owner organisation is an owner identity, enforced by two triggers (the one of 0002 on org_members and the guard
// of 0003 on users) for every role, the owner role of the tables included; a user has exactly one membership.

/**
 * A fresh database migrated by the runner.
 * @param {import("node:test").TestContext} t
 */
async function migrated(t) {
  const db = await freshDatabase(t);
  const pw = newPassword();
  const m = spawnSync(process.execPath, ["server/db/migrate.js"], {
    cwd: APP,
    env: childEnv({
      DATABASE_URL: url("postgres", admin().password, db),
      APP_DB_PASSWORD: pw,
    }),
    encoding: "utf8",
  });
  assert.equal(m.status, 0, m.stderr);
  return db;
}

const HASH = `scrypt$17$8$1$${"A".repeat(22)}$${"A".repeat(86)}`;

/**
 * The owner organisation, a customer organisation, and users: an owner identity, two plain users, one of them
 * a member of the customer organisation (written as the owner role of the tables, past row security).
 * @param {import("pg").Client} c
 */
async function seed(c) {
  const org = async (/** @type {string} */ name, /** @type {string} */ kind) =>
    /** @type {string} */ (
      (
        await c.query(
          "insert into orgs (name, kind) values ($1, $2) returning id",
          [name, kind],
        )
      ).rows[0].id
    );
  const user = async (
    /** @type {string} */ email,
    /** @type {boolean} */ flag,
  ) =>
    /** @type {string} */ (
      (
        await c.query(
          "insert into users (email, email_norm, display_name, password_hash, is_owner_identity) values ($1, $1, $2, $3, $4) returning id",
          [email, "Test", HASH, flag],
        )
      ).rows[0].id
    );
  const owner = await org("Owner", "owner");
  const customer = await org("Customer", "customer");
  const identity = await user("identity@example.test", true);
  const plain = await user("plain@example.test", false);
  const other = await user("other@example.test", false);
  await c.query(
    "insert into org_members (org_id, user_id, role) values ($1, $2, 'org_owner')",
    [owner, identity],
  );
  await c.query(
    "insert into org_members (org_id, user_id, role) values ($1, $2, 'member')",
    [customer, other],
  );
  return { owner, customer, identity, plain, other };
}

/** The sha256-free state of the two tables as text, for before and after. @param {import("pg").Client} c */
async function state(c) {
  const members = await c.query(
    "select row_to_json(m)::text as j from org_members m order by 1",
  );
  const users = await c.query(
    "select row_to_json(u)::text as j from users u order by 1",
  );
  return JSON.stringify([
    members.rows.map((r) => r.j),
    users.rows.map((r) => r.j),
  ]);
}

/**
 * Runs one statement and returns the SQLSTATE of its failure, or null. With `asApp` it runs in a transaction
 * as sai_app under platform settings (every row visible, the app's own path), rolled back at the end.
 * @param {import("pg").Client} c
 * @param {string} sql
 * @param {unknown[]} params
 * @param {boolean} asApp
 * @returns {Promise<{ code: string | null, constraint: string | null }>}
 */
async function attempt(c, sql, params, asApp) {
  try {
    if (asApp) {
      await c.query("begin");
      await c.query("set local role sai_app");
      await c.query("select set_config('app.role', 'platform', true)");
    }
    await c.query(sql, params);
    return { code: null, constraint: null };
  } catch (e) {
    const err = /** @type {any} */ (e);
    return { code: err.code ?? "?", constraint: err.constraint ?? null };
  } finally {
    if (asApp) await c.query("rollback");
  }
}

test("OO-1 a direct insert or move of a member of the owner organisation who is no owner identity is refused by the trigger, as the owner role and as sai_app, with the rows unchanged", async (t) => {
  const db = await migrated(t);
  const c = await client(db);
  try {
    const s = await seed(c);
    const insert =
      "insert into org_members (org_id, user_id, role) values ($1, $2, 'member')";
    const move = "update org_members set org_id = $1 where user_id = $2";
    for (const asApp of [false, true]) {
      const before = await state(c);
      const r1 = await attempt(c, insert, [s.owner, s.plain], asApp);
      assert.equal(r1.code, "P0001", `insert asApp=${asApp}`);
      // A member of a customer organisation cannot be moved into the owner organisation either.
      const r2 = await attempt(c, move, [s.owner, s.other], asApp);
      // The app role has no UPDATE grant on org_members: it is refused at the privilege (42501), the owner role by the trigger.
      assert.equal(r2.code, asApp ? "42501" : "P0001", `move asApp=${asApp}`);
      assert.equal(await state(c), before, `unchanged asApp=${asApp}`);
    }
    // The same insert for an owner identity (a user who has no membership yet) passes: the trigger is not vacuous.
    for (const asApp of [false, true]) {
      const spare = /** @type {string} */ (
        (
          await c.query(
            "insert into users (email, email_norm, display_name, password_hash, is_owner_identity) values ($1, $1, 'Spare', $2, true) returning id",
            [`spare-${asApp}@example.test`, HASH],
          )
        ).rows[0].id
      );
      const r = await attempt(
        c,
        "insert into org_members (org_id, user_id, role) values ($1, $2, 'member')",
        [s.owner, spare],
        asApp,
      );
      assert.equal(r.code, null, `owner identity asApp=${asApp}`);
    }
    // A plain user joins a customer organisation as before.
    const ok = await attempt(c, insert, [s.customer, s.plain], false);
    assert.equal(ok.code, null);
  } finally {
    await c.end();
  }
});

test("OO-2 a second membership row for a user who has one is refused by the unique key on user_id, in another organisation and in the same", async (t) => {
  const db = await migrated(t);
  const c = await client(db);
  try {
    const s = await seed(c);
    for (const asApp of [false, true]) {
      const before = await state(c);
      const other = await attempt(
        c,
        "insert into org_members (org_id, user_id, role) values ($1, $2, 'viewer')",
        [s.customer, s.identity],
        asApp,
      );
      assert.equal(other.code, "23505", `another organisation asApp=${asApp}`);
      assert.equal(other.constraint, "org_members_user_id_key");
      const same = await attempt(
        c,
        "insert into org_members (org_id, user_id, role) values ($1, $2, 'viewer')",
        [s.customer, s.other],
        asApp,
      );
      assert.equal(same.code, "23505", `the same organisation asApp=${asApp}`);
      assert.equal(await state(c), before);
    }
  } finally {
    await c.end();
  }
});

test("OO-3 setting is_owner_identity to false for a member of the owner organisation is refused by the guard trigger; setting it true, or false for another user, is not", async (t) => {
  const db = await migrated(t);
  const c = await client(db);
  try {
    const s = await seed(c);
    const set = (/** @type {boolean} */ flag) =>
      `update users set is_owner_identity = ${flag} where id = $1`;
    for (const asApp of [false, true]) {
      const before = await state(c);
      const refused = await attempt(c, set(false), [s.identity], asApp);
      assert.equal(refused.code, "P0001", `asApp=${asApp}`);
      assert.equal(await state(c), before);
      // Setting true is not guarded: the plain user becomes an owner identity (rolled back for the app run).
      const up = await attempt(c, set(true), [s.plain], asApp);
      assert.equal(up.code, null);
      // A customer member's flag may change either way (the guard is for owner-organisation members only).
      const down = await attempt(c, set(false), [s.other], asApp);
      assert.equal(down.code, null);
    }
    // The statement that changes another column of the owner identity is not blocked by the guard.
    const name = await attempt(
      c,
      "update users set display_name = 'Renamed' where id = $1",
      [s.identity],
      false,
    );
    assert.equal(name.code, null);
    // The flag of the member is still true after all the attempts.
    assert.equal(
      (
        await c.query("select is_owner_identity from users where id = $1", [
          s.identity,
        ])
      ).rows[0].is_owner_identity,
      true,
    );
  } finally {
    await c.end();
  }
});
