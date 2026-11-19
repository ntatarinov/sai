import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { runSelfcheck } from "../../server/db/selfcheck.js";
import { connectPgSession } from "../../server/db/pg.js";
import { APP, childEnv } from "../fixtures/helpers.js";
import {
  admin,
  client,
  freshDatabase,
  newPassword,
  url,
} from "../fixtures/pg-env.js";

// REQ-108 criterion 8: the real selfcheck on real Postgres.

test("SP-1 refuses the superuser, a BYPASSRLS login, a SUPERUSER NOBYPASSRLS login and a login whose group role has BYPASSRLS or SUPERUSER; passes sai_app_login", async (t) => {
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
  const bypass = `sai_t_bypass_${randomBytes(4).toString("hex")}`;
  const bpw = newPassword();
  const c = await client(db);
  await c.query("select set_config('sai.t', $1, false)", [bpw]);
  await c.query(
    `do $$ begin execute format('create role ${bypass} login bypassrls password %L', current_setting('sai.t')); end $$`,
  );
  await c.query(`grant connect on database ${db} to ${bypass}`);
  t.after(async () => {
    const d = await client();
    await d.query(`drop role if exists ${bypass}`);
    await d.end();
  });
  // A superuser that does not bypass row security by its own attribute: rolsuper alone must refuse it.
  const superuser = `sai_t_super_${randomBytes(4).toString("hex")}`;
  const spw = newPassword();
  await c.query("select set_config('sai.t', $1, false)", [spw]);
  await c.query(
    `do $$ begin execute format('create role ${superuser} login superuser nobypassrls password %L', current_setting('sai.t')); end $$`,
  );
  t.after(async () => {
    const d = await client();
    await d.query(`drop role if exists ${superuser}`);
    await d.end();
  });
  // A login role whose own attributes are safe but which is a member of a group role with BYPASSRLS, or
  // with SUPERUSER (a sai_app kept from before 0001, or changed after it), is refused too: the selfcheck
  // reads every role the session user can become. Roles belong to the whole server, so the test makes
  // its own group and login roles and never changes the shared sai_app.
  /** @type {Array<{ member: string, password: string }>} */
  const members = [];
  for (const attr of ["bypassrls", "superuser"]) {
    const group = `sai_t_group_${randomBytes(4).toString("hex")}`;
    const member = `sai_t_member_${randomBytes(4).toString("hex")}`;
    const mpw = newPassword();
    await c.query(`create role ${group} nologin ${attr}`);
    await c.query("select set_config('sai.t', $1, false)", [mpw]);
    await c.query(
      `do $$ begin execute format('create role ${member} login nosuperuser nobypassrls password %L', current_setting('sai.t')); end $$`,
    );
    await c.query(`grant ${group} to ${member}`);
    await c.query(`grant connect on database ${db} to ${member}`);
    t.after(async () => {
      const d = await client();
      await d.query(`drop role if exists ${member}`);
      await d.query(`drop role if exists ${group}`);
      await d.end();
    });
    members.push({ member, password: mpw });
  }
  await c.end();
  const verdict = async (
    /** @type {string} */ user,
    /** @type {string} */ password,
  ) => {
    const s = await connectPgSession(url(user, password, db), {
      connectTimeoutMs: 5000,
    });
    try {
      return await runSelfcheck(s);
    } finally {
      await s.close();
    }
  };
  assert.equal(await verdict("postgres", admin().password), "unsafe");
  assert.equal(await verdict(bypass, bpw), "unsafe");
  assert.equal(await verdict(superuser, spw), "unsafe");
  for (const { member, password } of members)
    assert.equal(await verdict(member, password), "unsafe", member);
  assert.equal(await verdict("sai_app_login", pw), "ok");
});
