import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { computeResult } from "../../../tools/src/picker/engine.js";
import { tenantInLanguage } from "../../../tools/src/picker/view.js";
import { SOURCE_LANGS } from "../../public/shared/i18n/lang.js";
import { createApp } from "../../server/app.js";
import { createDb } from "../../server/db/index.js";
import { loadIntake } from "../../server/routes/demo.js";
import { loadStaticSite } from "../../server/static.js";
import { APP } from "../fixtures/helpers.js";
import { counting, migratedPglite, migrationList } from "../fixtures/db.js";

// REQ-111 criteria 7 and 8: the demo routes answer what the picker's own engine answers for the same
// intake and the same answers (the code under test is a byte copy of that engine and a projection of its
// answer), and they store nothing: no call of the database adapter and no row written, however many
// requests come.

const LOCAL = "http://127.0.0.1:1";
const ANSWERS_DIR = path.join(APP, "content", "sai-intake.answers");
/** @type {Array<[string, Record<string, string>]>} */
const FIXTURES = fs
  .readdirSync(ANSWERS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => [
    f,
    JSON.parse(fs.readFileSync(path.join(ANSWERS_DIR, f), "utf8")),
  ]);

/**
 * The app of the local server with the demo, over a database that may be given.
 * @param {import("../../server/db/index.js").Adapter | null} adapter
 */
function appWithDemo(adapter) {
  const intake = loadIntake();
  assert.equal(intake.ok, true);
  return createApp({
    config: { siteGate: false, version: "dev" },
    origins: { app: LOCAL, preview: "http://localhost:1" },
    db: adapter ? createDb(adapter) : null,
    site: loadStaticSite(),
    migrations: migrationList(),
    log: () => {},
    demo: { intake, langs: SOURCE_LANGS },
  });
}

const sha256 = (/** @type {string} */ text) =>
  createHash("sha256").update(text).digest("hex");

test("DP-1 for every fixture in ru, en and kk the answer of the route is the answer of the picker's own engine on the tenant in that language, projected", async () => {
  const app = appWithDemo(null);
  const tenant = JSON.parse(
    fs.readFileSync(path.join(APP, "content", "sai-intake.json"), "utf8"),
  );
  assert.ok(FIXTURES.length >= 6);
  for (const lang of SOURCE_LANGS) {
    // The questionnaire is the tenant in the language, as the picker's own view gives it.
    const view = tenantInLanguage(tenant, lang);
    const q = await app.fetch(
      new Request(`${LOCAL}/api/demo/questionnaire?lang=${lang}`),
    );
    assert.deepEqual(await q.json(), {
      lang,
      questions: view.questions.map((/** @type {any} */ x) => ({
        id: x.id,
        title: x.title,
        options: x.options.map((/** @type {any} */ o) => ({
          id: o.id,
          label: o.label,
        })),
      })),
    });
    for (const [name, answers] of FIXTURES) {
      const original = computeResult(view, answers);
      assert.equal(original.ok, true, `${lang} ${name}`);
      const found = original.result;
      // The projection of the design (4.7): the fields the page shows, and not the ranking, the scores or
      // the rules that the engine also answers.
      const projected = {
        lang,
        clear_leader: found.clear_leader,
        recommended: found.recommended.map((/** @type {any} */ s) => ({
          id: s.id,
          name: s.name,
          summary: s.summary,
          includes: s.includes,
          not_suitable_when: s.not_suitable_when,
        })),
        no_match_text: found.no_match_text,
      };
      const r = await app.fetch(
        new Request(`${LOCAL}/api/demo/result?lang=${lang}`, {
          method: "POST",
          body: JSON.stringify({ answers }),
        }),
      );
      assert.equal(r.status, 200, `${lang} ${name}`);
      assert.deepEqual(await r.json(), projected, `${lang} ${name}`);
    }
  }
  // The refusals too: the engine refuses what the route refuses, with the reason that the code names.
  for (const [answers, reason] of /** @type {Array<[any, string]>} */ ([
    [{ nope: "a" }, "unknown_question"],
    [{ goal: "zzz" }, "unknown_option"],
    [{ goal: ["tell"] }, "wrong_kind"],
    [{ goal: null }, "wrong_kind"],
  ])) {
    const original = computeResult(tenantInLanguage(tenant, "ru"), answers);
    assert.equal(original.ok, false);
    assert.equal(original.error.reason, reason);
    const r = await app.fetch(
      new Request(`${LOCAL}/api/demo/result`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }),
    );
    assert.equal(r.status, 400);
    assert.deepEqual(await r.json(), { error: reason });
  }
});

test("DP-2 after 100 requests to both routes, valid and refused, the database adapter was called 0 times, every table has the rows it had, and the migration rows are the same", async () => {
  const inner = await migratedPglite();
  const c = counting(inner);
  const app = appWithDemo(c.adapter);

  /** The tables the session can see, their row counts, and the hash of the migration rows. */
  const state = async () => {
    const tables = await inner.query(
      "select table_schema, table_name from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema') order by 1, 2",
    );
    /** @type {Record<string, number>} */
    const counts = {};
    for (const t of tables.rows) {
      const n = await inner.query(
        `select count(*)::int as n from "${t.table_schema}"."${t.table_name}"`,
      );
      counts[`${t.table_schema}.${t.table_name}`] = n.rows[0].n;
    }
    const migrations = await inner.query(
      "select name, sha256 from schema_migrations order by name",
    );
    return { counts, migrations: sha256(JSON.stringify(migrations.rows)) };
  };
  const before = await state();
  assert.ok(Object.keys(before.counts).includes("public.schema_migrations"));
  assert.ok(before.counts["public.schema_migrations"] >= 1);

  /** @type {Array<() => Request>} */
  const kinds = [
    () => new Request(`${LOCAL}/api/demo/questionnaire?lang=ru`),
    () => new Request(`${LOCAL}/api/demo/questionnaire?lang=en`),
    () => new Request(`${LOCAL}/api/demo/questionnaire?lang=kk`),
    ...FIXTURES.map(
      ([, answers]) =>
        () =>
          new Request(`${LOCAL}/api/demo/result?lang=en`, {
            method: "POST",
            body: JSON.stringify({ answers }),
          }),
    ),
    () =>
      new Request(`${LOCAL}/api/demo/result`, {
        method: "POST",
        body: '{"answers":{"goal":"zzz"}}',
      }),
    () =>
      new Request(`${LOCAL}/api/demo/result`, {
        method: "POST",
        body: "not json",
      }),
    () =>
      new Request(`${LOCAL}/api/demo/result`, {
        method: "POST",
        body: new Uint8Array(70000),
      }),
    () => new Request(`${LOCAL}/api/demo/result`),
    () =>
      new Request(`${LOCAL}/api/demo/questionnaire`, {
        method: "POST",
        body: "{}",
      }),
  ];
  /** @type {Record<number, number>} */
  const statuses = {};
  for (let i = 0; i < 100; i++) {
    const r = await app.fetch(kinds[i % kinds.length]());
    statuses[r.status] = (statuses[r.status] ?? 0) + 1;
    await r.arrayBuffer();
  }
  // The requests were valid and refused, and there were 100 of them.
  assert.equal(
    Object.values(statuses).reduce((a, b) => a + b, 0),
    100,
  );
  for (const status of [200, 400, 404, 413])
    assert.ok(statuses[status] > 0, String(status));
  assert.deepEqual(c.texts, [], "the adapter was called");
  assert.deepEqual(await state(), before);

  // The counter is wired: a route that does use the database (the health check) is counted, so the 0
  // above is a measurement and not a dead counter.
  const health = await app.fetch(new Request(`${LOCAL}/api/health`));
  assert.equal(health.status, 200);
  assert.ok(
    c.texts.length > 0,
    "the health route made no call: the counter is dead",
  );
  await inner.close();
});
