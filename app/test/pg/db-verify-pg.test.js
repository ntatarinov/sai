import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { APP, childEnv, tempDir } from "../fixtures/helpers.js";
import { admin, client, freshDatabase, url } from "../fixtures/pg-env.js";

// REQ-120 criterion 1, the part on the job's Postgres (the code design M2AUTH, 6.1, N1): db-verify over two
// databases migrated and seeded alike, after one UPDATE and one INSERT in B, and in the previous-schema mode
// with one more migration that adds a nullable column or drops a seeded column.

const MIGRATIONS = path.join(APP, "db", "migrations");
const SEEDS = path.join(APP, "test", "fixtures", "rehearsal");

/**
 * @param {string} script
 * @param {string[]} args
 * @param {Record<string, string>} env
 * @returns {Promise<{ code: number | null, out: string, err: string }>}
 */
function run(script, args, env) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [script, ...args], {
      cwd: APP,
      env: childEnv(env),
    });
    let out = "";
    let err = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (err += d));
    c.on("exit", (code) => resolve({ code, out, err }));
  });
}

/**
 * A fresh database migrated with the files of `dir` and seeded with the seed of each file.
 * @param {import("node:test").TestContext} t
 * @param {string} dir
 */
async function seeded(t, dir) {
  const name = await freshDatabase(t);
  const m = await run("server/db/migrate.js", [], {
    DATABASE_URL: url("postgres", admin().password, name),
    MIGRATIONS_DIR: dir,
  });
  assert.equal(m.code, 0, m.err);
  const c = await client(name);
  try {
    for (const f of fs.readdirSync(dir).sort())
      if (fs.existsSync(path.join(SEEDS, f)))
        await c.query(fs.readFileSync(path.join(SEEDS, f), "utf8"));
  } finally {
    await c.end();
  }
  return name;
}

/** @param {string} a @param {string} b @param {string[]} [args] */
const verify = (a, b, args = []) =>
  run("scripts/db-verify.js", args, {
    SAI_VERIFY_A_URL: url("postgres", admin().password, a),
    SAI_VERIFY_B_URL: url("postgres", admin().password, b),
  });

/** A copy of app/db/migrations with one more file. @param {import("node:test").TestContext} t @param {string} name @param {string} text */
function withOneMore(t, name, text) {
  const dir = path.join(tempDir(t), "m");
  fs.mkdirSync(dir);
  for (const f of fs.readdirSync(MIGRATIONS))
    fs.copyFileSync(path.join(MIGRATIONS, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, name), text);
  return dir;
}

test("DVP-1 two databases migrated and seeded alike are equal; one UPDATE in B, or one row more, makes them different", async (t) => {
  const a = await seeded(t, MIGRATIONS);
  const b = await seeded(t, MIGRATIONS);
  const same = await verify(a, b);
  assert.equal(same.code, 0, same.out + same.err);
  const lines = same.out.trim().split("\n");
  assert.equal(lines.at(-1), "db-verify: equal");
  assert.ok(
    lines.includes("db-verify: users: ok") &&
      lines.includes("db-verify: audit_log: ok"),
    same.out,
  );
  assert.ok(
    !same.out.includes(admin().password) && !same.out.includes("example.test"),
  );
  const c = await client(b);
  try {
    await c.query(
      "update users set display_name = 'Changed' where email_norm = 'client@example.test'",
    );
    const one = await verify(a, b);
    assert.equal(one.code, 1, one.out);
    assert.match(one.out, /^db-verify: users: differs: content$/m);
    assert.equal(one.out.trim().split("\n").at(-1), "db-verify: different");
    await c.query(
      "update users set display_name = 'Seed client' where email_norm = 'client@example.test'",
    );
    assert.equal((await verify(a, b)).code, 0);
    // One row more in a table outside the closed list: the count of the rows is read, not a literal <row>.
    await c.query(
      "insert into rate_limits (key, window_start, count) values (repeat('9', 64), '2026-11-23T11:00:00Z', 1)",
    );
    const more = await verify(a, b);
    assert.equal(more.code, 1, more.out);
    assert.match(more.out, /^db-verify: rate_limits: differs: row count$/m);
    assert.ok(!more.out.includes("9999"), "no value in a line");
  } finally {
    await c.end();
  }
});

test("DVP-2 previous-schema: B with one more migration that adds a nullable column is equal to A; one that drops a seeded column is different", async (t) => {
  const a = await seeded(t, MIGRATIONS);
  for (const [file, text, want, line] of [
    [
      "9998_add_note.sql",
      "alter table orgs add column note text;\n",
      0,
      "db-verify: equal",
    ],
    [
      "9998_drop_name.sql",
      "alter table users drop column display_name;\n",
      1,
      "db-verify: users: differs: column dropped",
    ],
  ]) {
    const b = await seeded(t, MIGRATIONS);
    const m = await run("server/db/migrate.js", [], {
      DATABASE_URL: url("postgres", admin().password, b),
      MIGRATIONS_DIR: withOneMore(t, String(file), String(text)),
    });
    assert.equal(m.code, 0, m.err);
    const r = await verify(a, b, ["--previous-schema"]);
    assert.equal(r.code, want, r.out + r.err);
    assert.ok(r.out.split("\n").includes(String(line)), r.out);
  }
});
