import assert from "node:assert/strict";
import crypto from "node:crypto";
import net from "node:net";
import { test } from "node:test";
import {
  latestQuickFacts,
  listProjectsOf,
  lockProject,
  readProjectRow,
  readVersions,
  setStage,
  touchProject,
} from "../../server/db/project-store.js";
import { createPgAdapter } from "../../server/db/pg.js";
import { authContext } from "../../server/http/auth-mw.js";
import { withPlatform } from "../../server/db/tx.js";
import { moveStage, purgeOrgProjects } from "../../server/services/projects.js";
import { ADMIN, authHarness } from "../fixtures/auth.js";
import { pgStandIn, waitFor } from "../fixtures/helpers.js";
import { STATE_TABLES, addProject, ownerOrgId } from "../fixtures/m23.js";

// REQ-117 criteria 1 to 3 (the code design M2PROJ, 4.3 rows N9 to N14, 4.5.2, section 7.2; rework 02b F2 and F4):
// the project routes of the session's organisation through app.request on a migrated PGlite with an injected
// clock. Every refusal test compares the row counts and the sha256 of the rows of STATE_TABLES before and after
// (a refusal leaves the state as it was); the oracles are the test's own: the facts of the description, the
// HMAC of the address as the spec writes it, the version rows read by plain SQL.

/** @typedef {import("../fixtures/auth.js").AuthHarness} H */
/** @typedef {import("../fixtures/auth.js").Actor} Actor */

/** A valid body of POST /api/projects. @param {Record<string, unknown>} [o] */
const projectBody = (o = {}) => ({
  title: "My flower shop",
  idea: "An online shop for flowers\nwith delivery in the city",
  what: "shop",
  whom: "customers",
  lang: "ru",
  ...o,
});

/** A copy of a body without one key. @param {Record<string, unknown>} body @param {string} key */
const withoutKey = (body, key) =>
  Object.fromEntries(Object.entries(body).filter(([k]) => k !== key));

/** A valid body of the idea edit routes. @param {Record<string, unknown>} [o] */
const ideaBody = (o = {}) => ({
  text: "A shop for flowers and plants",
  reason: "Added plants",
  ...o,
});

/**
 * The state compared before and after a refusal: counts and the sha256 of the rows of the nine tables, and the
 * rate counters.
 * @param {H} h
 */
const stateOf = async (h) => ({
  counts: await h.counts(),
  digest: await h.digest([...STATE_TABLES, "rate_limits"]),
});

/**
 * A harness with the six actors of the matrix (setup done, everyone signed in): the admin, and a viewer, a
 * member, an org_admin and an org_owner of one customer organisation.
 * @param {import("node:test").TestContext} t
 * @param {Parameters<typeof authHarness>[1]} [o]
 */
async function world(t, o) {
  const h = await authHarness(t, o);
  const A = await h.actors();
  return { h, A };
}

/** The rows of a table as sorted JSON texts, by plain SQL. @param {H} h @param {string} sql @param {unknown[]} [p] */
const rowsOf = async (h, sql, p) =>
  (await h.sql(`select row_to_json(x)::text as j from (${sql}) x`, p))
    .map((r) => /** @type {string} */ (r.j))
    .sort();

test("PRJ-1 POST /api/projects by an org_owner, an org_admin, a member and the platform admin answers 201 and creates one project at draft in the session's organisation, one idea version 1 with the quick facts and no reason, and one audit row project.create with the caller, the organisation and the HMAC of the address; the audit chain verifies", async (t) => {
  const { h, A } = await world(t);
  const before = await h.counts();
  let n = 0;
  for (const who of /** @type {const} */ ([
    "org_owner",
    "org_admin",
    "member",
  ])) {
    n += 1;
    const a = A[who];
    h.tick(1000);
    const r = await h.call("POST", "/api/projects", {
      as: a,
      body: projectBody({
        title: `Shop of ${who}`,
        lang: n === 2 ? "en" : "ru",
      }),
    });
    assert.equal(r.status, 201, `${who}: ${r.text}`);
    assert.deepEqual(Object.keys(r.json).sort(), ["id", "stage", "version"]);
    assert.equal(r.json.stage, "draft");
    assert.equal(r.json.version, 1);
    assert.match(
      r.json.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    const [p] = await h.sql("select * from projects where id = $1", [
      r.json.id,
    ]);
    assert.equal(p.org_id, a.orgId, `${who}: the session's organisation`);
    assert.equal(p.stage, "draft");
    assert.equal(p.title, `Shop of ${who}`);
    assert.equal(p.language, n === 2 ? "en" : "ru");
    assert.equal(p.created_by, a.id);
    assert.equal(new Date(p.created_at).getTime(), h.now());
    assert.equal(new Date(p.updated_at).getTime(), h.now());
    const versions = await h.sql(
      "select * from idea_versions where project_id = $1",
      [r.json.id],
    );
    assert.equal(versions.length, 1);
    assert.equal(versions[0].version, 1);
    assert.equal(versions[0].reason, null);
    assert.equal(versions[0].org_id, a.orgId);
    assert.equal(versions[0].created_by, a.id);
    assert.equal(versions[0].text, projectBody().idea);
    assert.deepEqual(versions[0].quick_facts, {
      what: "shop",
      whom: "customers",
      lang: n === 2 ? "en" : "ru",
    });
    const audit = await h.sql(
      "select * from audit_log where action = 'project.create' and target_id = $1",
      [r.json.id],
    );
    assert.equal(audit.length, 1, `${who}: one audit row`);
    assert.equal(audit[0].org_id, a.orgId);
    assert.equal(audit[0].actor_kind, "user");
    assert.equal(audit[0].actor_id, a.id);
    assert.equal(audit[0].target_kind, "project");
    assert.deepEqual(audit[0].details, { stage: "draft" });
    // The address stands in the row only as HMAC-SHA256(pepper, "ip" NUL address), written here.
    assert.equal(
      audit[0].ip_hmac,
      crypto
        .createHmac("sha256", h.pepper)
        .update(`ip\u0000${a.ip}`, "utf8")
        .digest("hex"),
    );
  }
  // The platform admin is the org_owner of the owner organisation: his project is in that organisation, and
  // his audit row says admin.
  const r = await h.call("POST", "/api/projects", {
    as: A.admin,
    body: projectBody({ title: "Admin's own" }),
  });
  assert.equal(r.status, 201, r.text);
  const [p] = await h.sql("select org_id from projects where id = $1", [
    r.json.id,
  ]);
  assert.equal(p.org_id, await ownerOrgId(h));
  const [a] = await h.sql(
    "select actor_kind, org_id from audit_log where target_id = $1",
    [r.json.id],
  );
  assert.deepEqual(
    { ...a },
    { actor_kind: "admin", org_id: await ownerOrgId(h) },
  );
  const after = await h.counts();
  assert.equal(after.projects - before.projects, 4);
  assert.equal(after.idea_versions - before.idea_versions, 4);
  assert.equal(after.audit_log - before.audit_log, 4);
  const verify = await h.call("GET", "/api/admin/audit/verify", {
    as: A.admin,
    origin: null,
  });
  assert.equal(verify.status, 200);
  assert.equal(verify.json.ok, true);
});

test("PRJ-2 a viewer's POST /api/projects answers 403 forbidden and writes nothing: no project, no version, no audit row, no quota count", async (t) => {
  const { h, A } = await world(t);
  const before = await stateOf(h);
  const r = await h.call("POST", "/api/projects", {
    as: A.viewer,
    body: projectBody(),
  });
  assert.equal(r.status, 403, r.text);
  assert.deepEqual(r.json, { error: "forbidden" });
  assert.deepEqual(await stateOf(h), before);
  // An anonymous caller is refused before the plan (401), with the same unchanged state.
  const anon = await h.call("POST", "/api/projects", { body: projectBody() });
  assert.equal(anon.status, 401, anon.text);
  assert.deepEqual(await stateOf(h), before);
});

test("PRJ-3 an empty or blank title, a title of 121 characters, an idea of 8 001 characters or empty, a control sign, U+200B, U+202E and U+FEFF in the idea, a quick fact outside its set or of another type, a missing quick fact, an added key (org_id, orgId, stage, an unknown one) or a body that is no JSON is refused with 400 and leaves every table unchanged; 120 and 8 000 characters are taken", async (t) => {
  const { h, A } = await world(t);
  const before = await stateOf(h);
  /** @type {Array<[string, unknown]>} */
  const bad = [
    ["an empty title", projectBody({ title: "" })],
    ["a blank title", projectBody({ title: "   " })],
    ["a title of 121 characters", projectBody({ title: "x".repeat(121) })],
    ["an idea of 8 001 characters", projectBody({ idea: "x".repeat(8001) })],
    ["an empty idea", projectBody({ idea: "" })],
    ["U+0001 in the idea", projectBody({ idea: "a\u0001b" })],
    ["U+200B in the idea", projectBody({ idea: "a\u200bb" })],
    ["U+202E in the idea", projectBody({ idea: "a\u202eb" })],
    ["U+FEFF in the title", projectBody({ title: "a\ufeffb" })],
    ["a quick fact outside its set", projectBody({ what: "spaceship" })],
    ["whom outside its set", projectBody({ whom: "everyone" })],
    ["lang kk (not offered)", projectBody({ lang: "kk" })],
    ["a quick fact that is a number", projectBody({ what: 5 })],
    ["a missing quick fact", withoutKey(projectBody(), "what")],
    ["a missing title", withoutKey(projectBody(), "title")],
    ["an added key org_id", { ...projectBody(), org_id: A.member.orgId }],
    ["an added key orgId", { ...projectBody(), orgId: A.member.orgId }],
    ["an added key stage", { ...projectBody(), stage: "approved" }],
    ["an unknown key", { ...projectBody(), colour: "red" }],
    ["an array", [projectBody()]],
    ["a body that is no JSON", "{ not json"],
  ];
  for (const [label, body] of bad) {
    const r = await h.call("POST", "/api/projects", { as: A.member, body });
    assert.equal(r.status, 400, `${label}: ${r.status} ${r.text}`);
    assert.ok(
      ["bad_body", "bad_json"].includes(r.json?.error),
      `${label}: ${r.text}`,
    );
    assert.deepEqual(await stateOf(h), before, `${label}: the state changed`);
  }
  // The edges are taken.
  const edge = await h.call("POST", "/api/projects", {
    as: A.member,
    body: projectBody({ title: "t".repeat(120), idea: "i".repeat(8000) }),
  });
  assert.equal(edge.status, 201, edge.text);
});

test("PRJ-4 the 21st creation of one user within one 24-hour window answers 429 with Retry-After and changes no row; two hours later it is still refused; one window later it works; a second user from the same address is not limited (the key is the user)", async (t) => {
  const { h, A } = await world(t);
  // A second user of the same address as the first (the limit is per user, not per address).
  const sameIp = "198.51.100.99";
  const first = await h.signIn(
    await h.addUser({
      email: "q1@example.test",
      ip: sameIp,
      orgId: /** @type {string} */ (A.member.orgId),
    }),
  );
  const second = await h.signIn(
    await h.addUser({
      email: "q2@example.test",
      ip: sameIp,
      orgId: /** @type {string} */ (A.member.orgId),
    }),
  );
  for (let i = 1; i <= 20; i += 1) {
    const r = await h.call("POST", "/api/projects", {
      as: first,
      body: projectBody({ title: `Project ${i}` }),
    });
    assert.equal(r.status, 201, `creation ${i}: ${r.text}`);
  }
  const before = await stateOf(h);
  const over = await h.call("POST", "/api/projects", {
    as: first,
    body: projectBody({ title: "The 21st" }),
  });
  assert.equal(over.status, 429, over.text);
  assert.deepEqual(over.json, { error: "rate_limited" });
  assert.match(over.headers.get("retry-after") ?? "", /^[1-9][0-9]*$/);
  assert.deepEqual(
    await stateOf(h),
    before,
    "the refused creation left the state as it was",
  );
  // Two hours later the window (a fixed 24 hours) has not changed: still refused, still unchanged.
  h.tick(2 * 3600 * 1000);
  const later = await h.call("POST", "/api/projects", {
    as: first,
    body: projectBody({ title: "Later" }),
  });
  assert.equal(later.status, 429, later.text);
  // The second user of the same address creates at once.
  const other = await h.call("POST", "/api/projects", {
    as: second,
    body: projectBody({ title: "Other user" }),
  });
  assert.equal(other.status, 201, other.text);
  // One window later (the clock is 24 hours on) the first user works again; sessions are signed in again.
  h.tick(24 * 3600 * 1000);
  await h.signIn(first);
  const again = await h.call("POST", "/api/projects", {
    as: first,
    body: projectBody({ title: "Next day" }),
  });
  assert.equal(again.status, 201, again.text);
  const titles = (
    await h.sql(
      "select count(*)::int as n from projects where created_by = $1",
      [first.id],
    )
  )[0].n;
  assert.equal(titles, 21);
});

test("PRJ-5 GET /api/projects of a member of A lists only A's projects, newest update first, with no field of another organisation; the organisations B and C have projects too", async (t) => {
  const { h, A } = await world(t);
  const orgB = await h.addOrg("Organisation B");
  const orgC = await h.addOrg("Organisation C");
  const a1 = await addProject(h, {
    orgId: /** @type {string} */ (A.member.orgId),
    createdBy: A.member.id,
    title: "A first",
  });
  h.tick(60_000);
  const a2 = await addProject(h, {
    orgId: /** @type {string} */ (A.member.orgId),
    createdBy: A.member.id,
    title: "A second",
  });
  const b = await addProject(h, {
    orgId: orgB,
    createdBy: A.member.id,
    title: "B secret title",
  });
  const c = await addProject(h, {
    orgId: orgC,
    createdBy: A.member.id,
    title: "C secret title",
  });
  for (const who of /** @type {const} */ ([
    "viewer",
    "member",
    "org_admin",
    "org_owner",
  ])) {
    const r = await h.call("GET", "/api/projects", {
      as: A[who],
      origin: null,
    });
    assert.equal(r.status, 200, `${who}: ${r.text}`);
    assert.deepEqual(
      r.json.projects.map((/** @type {any} */ p) => p.id),
      [a2.id, a1.id],
      `${who}: newest update first`,
    );
    assert.deepEqual(Object.keys(r.json.projects[0]).sort(), [
      "id",
      "stage",
      "title",
      "updated_at",
    ]);
    assert.equal(r.json.projects[0].stage, "draft");
    assert.equal(
      r.json.projects[0].updated_at,
      new Date(h.now()).toISOString(),
    );
    for (const secret of [
      b.id,
      c.id,
      "B secret title",
      "C secret title",
      orgB,
      orgC,
    ])
      assert.equal(r.text.includes(secret), false, `${who}: shows ${secret}`);
  }
  // The platform admin sees his own organisation's list (empty here), not the customers'.
  const own = await h.call("GET", "/api/projects", {
    as: A.admin,
    origin: null,
  });
  assert.deepEqual(own.json, { projects: [] });
  // An anonymous caller: 401.
  assert.equal(
    (await h.call("GET", "/api/projects", { origin: null })).status,
    401,
  );
});

/** A free port with nothing listening on it. */
async function closedPort() {
  const s = net.createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", () => r(null)));
  const port = /** @type {net.AddressInfo} */ (s.address()).port;
  await new Promise((r) => s.close(() => r(null)));
  return port;
}

test("PRJ-6 with the database refusing connections and with a statement that never answers, POST /api/projects and POST /api/projects/:id/idea answer 503 db_unavailable within 5 s and write nothing; after the recovery the creation works", async (t) => {
  const stand = await pgStandIn(t, { plan: () => "stall", answer: () => null });
  const refused = createPgAdapter(
    `postgres://u:p@127.0.0.1:${await closedPort()}/d`,
    { connectTimeoutMs: 4000 },
  );
  const silent = createPgAdapter(`postgres://u:p@127.0.0.1:${stand.port}/d`, {
    connectTimeoutMs: 4000,
  });
  t.after(() => {
    void refused.close().catch(() => {});
    void silent.close().catch(() => {});
  });
  /** @type {"ok" | "refused" | "silent"} */
  let mode = "ok";
  const h = await authHarness(t, {
    wrap: (/** @type {any} */ raw) => {
      const cur = () =>
        mode === "ok" ? raw : mode === "refused" ? refused : silent;
      return {
        query: (/** @type {string} */ s, /** @type {unknown[]} */ p) =>
          cur().query(s, p),
        exec: (/** @type {string} */ s) => cur().exec(s),
        close: async () => {},
        transaction: (/** @type {any} */ fn) => cur().transaction(fn),
      };
    },
  });
  const A = await h.actors();
  const own = await addProject(h, {
    orgId: /** @type {string} */ (A.member.orgId),
    createdBy: A.member.id,
  });
  const before = await stateOf(h);
  for (const m of /** @type {const} */ (["refused", "silent", "refused"])) {
    mode = m;
    for (const [label, path, body] of /** @type {const} */ ([
      ["create", "/api/projects", projectBody()],
      ["edit", `/api/projects/${own.id}/idea`, ideaBody()],
    ])) {
      const started = performance.now();
      const r = await h.call("POST", path, { as: A.member, body });
      const ms = performance.now() - started;
      assert.equal(r.status, 503, `${m} ${label}: ${r.text}`);
      assert.deepEqual(r.json, { error: "db_unavailable" }, `${m} ${label}`);
      assert.ok(ms < 5000, `${m} ${label}: ${Math.round(ms)} ms`);
    }
  }
  mode = "ok";
  assert.deepEqual(await stateOf(h), before, "the failures wrote nothing");
  const ok = await h.call("POST", "/api/projects", {
    as: A.member,
    body: projectBody(),
  });
  assert.equal(ok.status, 201, `after the recovery: ${ok.text}`);
  await waitFor(
    () =>
      [...new Set(stand.statements.map(([id]) => id))].every((id) =>
        stand.closed.has(id),
      ),
    15000,
    "the stalled connections to be released",
  );
});

test("PRJ-7 POST /api/projects/:id/idea adds version n+1 with the reason and the quick facts of the newest version, keeps every earlier row byte-equal, sets the project's updated_at to the clock and writes one audit row project.idea_version with the version number; two edits give 2 and 3", async (t) => {
  const { h, A } = await world(t);
  const made = await h.call("POST", "/api/projects", {
    as: A.member,
    body: projectBody({ lang: "en" }),
  });
  assert.equal(made.status, 201, made.text);
  const id = made.json.id;
  const other = await addProject(h, {
    orgId: /** @type {string} */ (A.member.orgId),
    createdBy: A.member.id,
    title: "Untouched",
  });
  // The version rows as JSON texts in version order (not sorted as texts).
  const versionRows = async () =>
    (
      await h.sql(
        "select row_to_json(x)::text as j from idea_versions x where x.project_id = $1 order by x.version",
        [id],
      )
    ).map((r) => /** @type {string} */ (r.j));
  const otherRows = () =>
    rowsOf(h, "select * from projects where id = $1", [other.id]);
  const projectRow = async () =>
    (await h.sql("select * from projects where id = $1", [id]))[0];
  const v1 = await versionRows();
  const untouched = await otherRows();
  const createdAt = new Date((await projectRow()).created_at).getTime();
  for (const n of [2, 3]) {
    h.tick(60_000);
    const earlier = await versionRows();
    const r = await h.call("POST", `/api/projects/${id}/idea`, {
      as: A.org_admin,
      body: ideaBody({ text: `Idea text ${n}`, reason: `Reason ${n}` }),
    });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json, { version: n });
    const now = await versionRows();
    assert.equal(now.length, n);
    // Every earlier row is byte-equal (the sha256 of each is unchanged); the new row is the last.
    for (const [i, row] of earlier.entries())
      assert.equal(sha(now[i]), sha(row), `version ${i + 1} changed`);
    const last = JSON.parse(now[n - 1]);
    assert.equal(last.version, n);
    assert.equal(last.text, `Idea text ${n}`);
    assert.equal(last.reason, `Reason ${n}`);
    assert.equal(last.created_by, A.org_admin.id);
    assert.equal(last.org_id, A.member.orgId);
    assert.deepEqual(last.quick_facts, {
      what: "shop",
      whom: "customers",
      lang: "en",
    });
    assert.equal(new Date(last.created_at).getTime(), h.now());
    assert.equal(new Date((await projectRow()).updated_at).getTime(), h.now());
    const audit = await h.sql(
      "select * from audit_log where action = 'project.idea_version' and target_id = $1 order by id",
      [id],
    );
    assert.equal(audit.length, n - 1);
    assert.deepEqual(audit[n - 2].details, { version: n });
    assert.equal(audit[n - 2].actor_kind, "user");
    assert.equal(audit[n - 2].actor_id, A.org_admin.id);
    assert.equal(audit[n - 2].org_id, A.member.orgId);
  }
  assert.equal(
    sha((await versionRows())[0]),
    sha(v1[0]),
    "version 1 is as it was typed",
  );
  assert.equal(new Date((await projectRow()).created_at).getTime(), createdAt);
  assert.deepEqual(
    await otherRows(),
    untouched,
    "another project is untouched",
  );
});

/** @param {string} text */
const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");

test("PRJ-8 an edit without a reason, with an empty or a 2 001-character reason, an empty or 8 001-character text, an added key, by a viewer, of a foreign or missing project or of an id that is no uuid is refused with unchanged state; a foreign project answers 404 even to a viewer (before the role)", async (t) => {
  const { h, A } = await world(t);
  const orgB = await h.addOrg("Organisation B");
  const own = await addProject(h, {
    orgId: /** @type {string} */ (A.member.orgId),
    createdBy: A.member.id,
  });
  const foreign = await addProject(h, {
    orgId: orgB,
    createdBy: A.member.id,
    title: "Foreign",
  });
  const before = await stateOf(h);
  /** @type {Array<[string, Actor, string, unknown, number, string]>} */
  const cases = [
    ["no reason", A.member, own.id, { text: "x" }, 400, "bad_body"],
    [
      "an empty reason",
      A.member,
      own.id,
      ideaBody({ reason: "" }),
      400,
      "bad_body",
    ],
    [
      "a reason of 2 001 characters",
      A.member,
      own.id,
      ideaBody({ reason: "r".repeat(2001) }),
      400,
      "bad_body",
    ],
    ["no text", A.member, own.id, { reason: "why" }, 400, "bad_body"],
    [
      "an empty text",
      A.member,
      own.id,
      ideaBody({ text: "" }),
      400,
      "bad_body",
    ],
    [
      "a text of 8 001 characters",
      A.member,
      own.id,
      ideaBody({ text: "t".repeat(8001) }),
      400,
      "bad_body",
    ],
    [
      "a control sign in the reason",
      A.member,
      own.id,
      ideaBody({ reason: "a\u0002b" }),
      400,
      "bad_body",
    ],
    [
      "an added key org_id",
      A.member,
      own.id,
      { ...ideaBody(), org_id: A.member.orgId },
      400,
      "bad_body",
    ],
    [
      "an added key stage",
      A.member,
      own.id,
      { ...ideaBody(), stage: "approved" },
      400,
      "bad_body",
    ],
    ["a viewer", A.viewer, own.id, ideaBody(), 403, "forbidden"],
    [
      "a foreign project (as a member)",
      A.member,
      foreign.id,
      ideaBody(),
      404,
      "not_found",
    ],
    [
      "a foreign project (as a viewer: 404 before the role)",
      A.viewer,
      foreign.id,
      ideaBody(),
      404,
      "not_found",
    ],
    [
      "a missing project",
      A.member,
      crypto.randomUUID(),
      ideaBody(),
      404,
      "not_found",
    ],
    [
      "an id that is no uuid",
      A.member,
      "not-a-uuid",
      ideaBody(),
      404,
      "not_found",
    ],
  ];
  for (const [label, as, id, body, status, code] of cases) {
    const r = await h.call("POST", `/api/projects/${id}/idea`, { as, body });
    assert.equal(r.status, status, `${label}: ${r.text}`);
    assert.deepEqual(r.json, { error: code }, label);
    assert.deepEqual(await stateOf(h), before, `${label}: the state changed`);
  }
  // The edges are taken: a reason and a text of the full length.
  const edge = await h.call("POST", `/api/projects/${own.id}/idea`, {
    as: A.member,
    body: ideaBody({ text: "t".repeat(8000), reason: "r".repeat(2000) }),
  });
  assert.equal(edge.status, 200, edge.text);
});

test("PRJ-9 the platform admin's POST /api/admin/projects/:id/idea on a project of a customer organisation adds the next version with the project's organisation, the quick facts copied and himself as author; its audit row has actor_kind admin and the project's organisation; a missing project or a bad body is refused with unchanged state", async (t) => {
  const { h, A } = await world(t);
  const customer = /** @type {string} */ (A.member.orgId);
  const p = await addProject(h, {
    orgId: customer,
    createdBy: A.member.id,
    quickFacts: { what: "bot", whom: "team", lang: "en" },
  });
  h.tick(30_000);
  const r = await h.call("POST", `/api/admin/projects/${p.id}/idea`, {
    as: A.admin,
    body: ideaBody({ reason: "Clarified with the client" }),
  });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json, { version: 2 });
  const [v] = await h.sql(
    "select * from idea_versions where project_id = $1 and version = 2",
    [p.id],
  );
  assert.equal(
    v.org_id,
    customer,
    "the version carries the project's organisation, not the admin's",
  );
  assert.equal(v.created_by, A.admin.id);
  assert.equal(v.reason, "Clarified with the client");
  assert.deepEqual(v.quick_facts, { what: "bot", whom: "team", lang: "en" });
  const [proj] = await h.sql("select updated_at from projects where id = $1", [
    p.id,
  ]);
  assert.equal(new Date(proj.updated_at).getTime(), h.now());
  const [audit] = await h.sql(
    "select * from audit_log where action = 'project.idea_version' and target_id = $1",
    [p.id],
  );
  assert.equal(audit.actor_kind, "admin");
  assert.equal(audit.actor_id, A.admin.id);
  assert.equal(audit.org_id, customer);
  assert.deepEqual(audit.details, { version: 2 });
  // A second edit continues the numbering.
  const again = await h.call("POST", `/api/admin/projects/${p.id}/idea`, {
    as: A.admin,
    body: ideaBody(),
  });
  assert.deepEqual(again.json, { version: 3 });
  // Refusals leave the state as it was.
  const before = await stateOf(h);
  for (const [label, path, body, status] of /** @type {const} */ ([
    [
      "a missing project",
      `/api/admin/projects/${crypto.randomUUID()}/idea`,
      ideaBody(),
      404,
    ],
    ["an id that is no uuid", "/api/admin/projects/nope/idea", ideaBody(), 404],
    ["no reason", `/api/admin/projects/${p.id}/idea`, { text: "x" }, 400],
    [
      "a reason of 2 001 characters",
      `/api/admin/projects/${p.id}/idea`,
      ideaBody({ reason: "r".repeat(2001) }),
      400,
    ],
  ])) {
    const x = await h.call("POST", path, { as: A.admin, body });
    assert.equal(x.status, status, `${label}: ${x.text}`);
    assert.deepEqual(await stateOf(h), before, `${label}: the state changed`);
  }
});

test("PRJ-10 GET /api/projects/:id answers the versions in order with reason, author and time; an ordinary author keeps his id and name; the platform admin author is the mark {id: null, name: null, platform: true} and his id, name and e-mail stand nowhere in the answer; the keys are exactly those of the design", async (t) => {
  const { h, A } = await world(t);
  const made = await h.call("POST", "/api/projects", {
    as: A.member,
    body: projectBody({ lang: "en", what: "app", whom: "team" }),
  });
  const id = made.json.id;
  h.tick(60_000);
  assert.equal(
    (
      await h.call("POST", `/api/projects/${id}/idea`, {
        as: A.org_owner,
        body: ideaBody({ text: "Second", reason: "From the owner" }),
      })
    ).status,
    200,
  );
  h.tick(60_000);
  assert.equal(
    (
      await h.call("POST", `/api/admin/projects/${id}/idea`, {
        as: A.admin,
        body: ideaBody({ text: "Third", reason: "From the Sai team" }),
      })
    ).status,
    200,
  );
  const r = await h.call("GET", `/api/projects/${id}`, {
    as: A.viewer,
    origin: null,
  });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(Object.keys(r.json).sort(), [
    "created_at",
    "id",
    "language",
    "quick_facts",
    "stage",
    "title",
    "updated_at",
    "versions",
  ]);
  assert.equal(r.json.id, id);
  assert.equal(r.json.stage, "draft");
  assert.equal(r.json.language, "en");
  assert.deepEqual(r.json.quick_facts, {
    what: "app",
    whom: "team",
    lang: "en",
  });
  assert.equal(r.json.updated_at, new Date(h.now()).toISOString());
  assert.deepEqual(
    r.json.versions.map((/** @type {any} */ v) => v.version),
    [1, 2, 3],
  );
  assert.deepEqual(
    r.json.versions.map((/** @type {any} */ v) => v.reason),
    [null, "From the owner", "From the Sai team"],
  );
  assert.deepEqual(
    r.json.versions.map((/** @type {any} */ v) => v.text),
    [projectBody().idea, "Second", "Third"],
  );
  for (const v of r.json.versions) {
    assert.deepEqual(Object.keys(v).sort(), [
      "author",
      "created_at",
      "reason",
      "text",
      "version",
    ]);
    assert.match(v.created_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  }
  assert.deepEqual(r.json.versions[0].author, {
    id: A.member.id,
    name: "Test User",
  });
  assert.deepEqual(r.json.versions[1].author, {
    id: A.org_owner.id,
    name: "Test User",
  });
  // The platform admin as author is a mark, with no id and no name (rework 02b, F2).
  assert.deepEqual(r.json.versions[2].author, {
    id: null,
    name: null,
    platform: true,
  });
  for (const secret of [
    A.admin.id,
    ADMIN.name,
    ADMIN.email,
    ADMIN.email.toLowerCase(),
  ])
    assert.equal(r.text.includes(secret), false, `the answer shows ${secret}`);
  // Another organisation's project answers like a missing one.
  const orgB = await h.addOrg("Organisation B");
  const foreign = await addProject(h, { orgId: orgB, createdBy: A.member.id });
  const miss = await h.call("GET", `/api/projects/${crypto.randomUUID()}`, {
    as: A.member,
    origin: null,
  });
  const alien = await h.call("GET", `/api/projects/${foreign.id}`, {
    as: A.member,
    origin: null,
  });
  assert.equal(alien.status, 404);
  assert.equal(alien.same, miss.same);
});

/** A context for the service calls that need keys: the pepper of the harness. @param {H} h */
const ctxOf = (h) =>
  authContext(
    { pepper: h.pepper, setupTokenHash: null, clock: () => h.now() },
    h.origin,
  );

/** The database handle the service calls use: the harness's own adapter, under the login role. @param {H} h */
const dbOf = (h) => ({
  transaction: /** @type {NonNullable<typeof h.raw.transaction>} */ (
    h.raw.transaction
  ).bind(h.raw),
});

test("PRJ-11 moveStage in a platform transaction moves a project along an allowed pair, sets updated_at to the clock and writes one audit row project.stage; a pair outside the table is refused with `forbidden`, a missing or foreign project with `not_found`, each with unchanged state; no route accepts a stage", async (t) => {
  const { h, A } = await world(t);
  const orgId = /** @type {string} */ (A.member.orgId);
  const p = await addProject(h, { orgId, createdBy: A.member.id });
  const orgB = await h.addOrg("Organisation B");
  const foreign = await addProject(h, { orgId: orgB, createdBy: A.member.id });
  const ctx = ctxOf(h);
  const move = (
    /** @type {string} */ projectId,
    /** @type {string} */ org,
    /** @type {string} */ to,
  ) =>
    withPlatform(dbOf(h), (q) =>
      moveStage(q, ctx, {
        projectId,
        orgId: org,
        to,
        actor: { kind: "admin", id: A.admin.id },
        now: h.now(),
      }),
    );
  const stageOf = async () =>
    (
      await h.sql("select stage, updated_at from projects where id = $1", [
        p.id,
      ])
    )[0];
  h.tick(10_000);
  await move(p.id, orgId, "interview");
  const s1 = await stageOf();
  assert.equal(s1.stage, "interview");
  assert.equal(new Date(s1.updated_at).getTime(), h.now());
  const audit = await h.sql(
    "select * from audit_log where action = 'project.stage' and target_id = $1",
    [p.id],
  );
  assert.equal(audit.length, 1);
  assert.deepEqual(audit[0].details, { stage: "interview" });
  assert.equal(audit[0].org_id, orgId);
  assert.equal(audit[0].actor_kind, "admin");
  assert.equal(audit[0].actor_id, A.admin.id);
  // The refusals: a pair outside the table, an equal pair, a skipped stage, a missing project, a foreign one.
  const before = await stateOf(h);
  for (const [label, run, code] of /** @type {const} */ ([
    ["interview -> accepted", () => move(p.id, orgId, "accepted"), "forbidden"],
    [
      "interview -> interview",
      () => move(p.id, orgId, "interview"),
      "forbidden",
    ],
    ["interview -> approved", () => move(p.id, orgId, "approved"), "forbidden"],
    ["interview -> draft", () => move(p.id, orgId, "draft"), "forbidden"],
    ["an unknown stage", () => move(p.id, orgId, "finished"), "forbidden"],
    [
      "a missing project",
      () => move(crypto.randomUUID(), orgId, "spec"),
      "not_found",
    ],
    ["an id that is no uuid", () => move("nope", orgId, "spec"), "not_found"],
    [
      "a foreign project (the organisation of the call is not the project's)",
      () => move(foreign.id, orgId, "interview"),
      "not_found",
    ],
  ])) {
    await assert.rejects(
      run(),
      (/** @type {any} */ e) => e?.code === code,
      label,
    );
    assert.deepEqual(await stateOf(h), before, `${label}: the state changed`);
  }
  // The chain continues, and archived is reached from any stage.
  await move(p.id, orgId, "spec");
  await move(p.id, orgId, "archived");
  assert.equal((await stageOf()).stage, "archived");
  await assert.rejects(
    move(p.id, orgId, "spec"),
    (/** @type {any} */ e) => e?.code === "forbidden",
  );
  // No route of M2 moves a stage: a body key `stage` is refused by every project route.
  const own = await addProject(h, {
    orgId,
    createdBy: A.member.id,
    title: "Stays at draft",
  });
  const viaCreate = await h.call("POST", "/api/projects", {
    as: A.member,
    body: { ...projectBody(), stage: "approved" },
  });
  const viaEdit = await h.call("POST", `/api/projects/${own.id}/idea`, {
    as: A.member,
    body: { ...ideaBody(), stage: "approved" },
  });
  const viaAdmin = await h.call("POST", `/api/admin/projects/${own.id}/idea`, {
    as: A.admin,
    body: { ...ideaBody(), stage: "approved" },
  });
  for (const r of [viaCreate, viaEdit, viaAdmin])
    assert.equal(r.status, 400, r.text);
  assert.equal(
    (await h.sql("select stage from projects where id = $1", [own.id]))[0]
      .stage,
    "draft",
  );
});

test("PRJ-12 the purge helper removes the idea versions and the projects of one customer organisation and nothing of another, keeps the audit rows with ids only, and refuses the owner organisation with a TypeError before any delete (rework 02b, F4)", async (t) => {
  const { h, A } = await world(t);
  const customer = /** @type {string} */ (A.member.orgId);
  const orgB = await h.addOrg("Organisation B");
  const owner = await ownerOrgId(h);
  const mine = await addProject(h, {
    orgId: customer,
    createdBy: A.member.id,
    versions: [{ text: "one" }, { text: "two", reason: "why" }],
  });
  await addProject(h, { orgId: customer, createdBy: A.member.id });
  const theirs = await addProject(h, {
    orgId: orgB,
    createdBy: A.member.id,
    versions: [{ text: "b1" }, { text: "b2", reason: "why" }],
  });
  const admins = await addProject(h, { orgId: owner, createdBy: A.admin.id });
  // An audit row about the project, to be kept.
  assert.equal(
    (
      await h.call("POST", `/api/projects/${mine.id}/idea`, {
        as: A.member,
        body: ideaBody(),
      })
    ).status,
    200,
  );
  const auditBefore = await h.sql(
    "select id, org_id, target_id from audit_log where action = 'project.idea_version'",
  );
  assert.equal(auditBefore.length, 1);
  // The owner organisation is never purged: refused, nothing deleted.
  const before = await stateOf(h);
  await assert.rejects(
    withPlatform(dbOf(h), (q) => purgeOrgProjects(q, owner)),
    (/** @type {any} */ e) => e instanceof TypeError,
  );
  assert.deepEqual(await stateOf(h), before);
  assert.equal(
    (
      await h.sql("select count(*)::int as n from projects where id = $1", [
        admins.id,
      ])
    )[0].n,
    1,
  );
  // A customer organisation is purged: its four versions of two projects, and only those.
  const res = await withPlatform(dbOf(h), (q) => purgeOrgProjects(q, customer));
  assert.deepEqual(res, { versions: 4, projects: 2 });
  assert.equal(
    (
      await h.sql("select count(*)::int as n from projects where org_id = $1", [
        customer,
      ])
    )[0].n,
    0,
  );
  assert.equal(
    (
      await h.sql(
        "select count(*)::int as n from idea_versions where org_id = $1",
        [customer],
      )
    )[0].n,
    0,
  );
  assert.equal(
    (
      await h.sql(
        "select count(*)::int as n from idea_versions where project_id = $1",
        [theirs.id],
      )
    )[0].n,
    2,
  );
  assert.equal(
    (
      await h.sql(
        "select count(*)::int as n from projects where org_id in ($1, $2)",
        [orgB, owner],
      )
    )[0].n,
    2,
  );
  // The audit rows stay, with ids only.
  assert.deepEqual(
    await h.sql(
      "select id, org_id, target_id from audit_log where action = 'project.idea_version'",
    ),
    auditBefore,
  );
  // The setting that lets the trigger pass a delete is gone after the transaction.
  const setting = (
    await h.sql("select current_setting('app.purge_org', true) as s")
  )[0].s;
  assert.ok(setting === null || setting === "", `setting: ${setting}`);
  // Outside platform settings the helper deletes nothing (the guard of the store).
  await assert.rejects(
    dbOf(h).transaction(async (q) => {
      await q.query("set local role sai_app");
      await q.query(
        "select set_config('app.org_id', $1, true), set_config('app.role', 'tenant', true)",
        [orgB],
      );
      return purgeOrgProjects(q, orgB);
    }),
    (/** @type {any} */ e) => e instanceof TypeError,
  );
  assert.equal(
    (
      await h.sql(
        "select count(*)::int as n from idea_versions where project_id = $1",
        [theirs.id],
      )
    )[0].n,
    2,
  );
});

test("PRJ-13 the statements of the project store carry the organisation themselves (the plan's wall): on platform settings, which row-level security does not narrow, a call with another organisation's id reads nothing, locks nothing and changes nothing, and the same call with the project's own organisation does", async (t) => {
  const { h, A } = await world(t);
  const orgA = /** @type {string} */ (A.member.orgId);
  const orgB = await h.addOrg("Organisation B");
  const mine = await addProject(h, {
    orgId: orgA,
    createdBy: A.member.id,
    title: "A's own",
    versions: [{ text: "first" }, { text: "second", reason: "why" }],
    quickFacts: { what: "bot", whom: "team", lang: "ru" },
  });
  await addProject(h, {
    orgId: orgB,
    createdBy: A.member.id,
    title: "B's own",
  });
  const before = await stateOf(h);
  const db = dbOf(h);
  const run = (/** @type {(q: any) => Promise<any>} */ f) =>
    withPlatform(db, f);
  // Another organisation's id: nothing is read.
  assert.deepEqual(
    (await run((q) => listProjectsOf(q, orgB, 200))).map(
      (/** @type {any} */ p) => p.title,
    ),
    ["B's own"],
    "the list holds the organisation's own projects only",
  );
  assert.equal(await run((q) => readProjectRow(q, mine.id, orgB)), null);
  assert.deepEqual(await run((q) => readVersions(q, mine.id, orgB)), []);
  assert.equal(await run((q) => latestQuickFacts(q, mine.id, orgB)), null);
  assert.equal(await run((q) => lockProject(q, mine.id, orgB)), null);
  // Another organisation's id: nothing is changed.
  assert.equal(
    await run((q) => setStage(q, mine.id, orgB, "interview", h.now() + 1000)),
    false,
  );
  await run((q) => touchProject(q, mine.id, orgB, h.now() + 1000));
  assert.deepEqual(
    await stateOf(h),
    before,
    "a call with the wrong organisation changed a row",
  );
  // The project's own organisation (and, for the lock, the admin's null): the same calls work.
  assert.equal(
    (await run((q) => readProjectRow(q, mine.id, orgA)))?.title,
    "A's own",
  );
  assert.deepEqual(
    (await run((q) => readVersions(q, mine.id, orgA))).map(
      (/** @type {any} */ v) => v.version,
    ),
    [1, 2],
  );
  assert.deepEqual(await run((q) => latestQuickFacts(q, mine.id, orgA)), {
    what: "bot",
    whom: "team",
    lang: "ru",
  });
  assert.equal((await run((q) => lockProject(q, mine.id, orgA)))?.org_id, orgA);
  assert.equal((await run((q) => lockProject(q, mine.id, null)))?.org_id, orgA);
  assert.deepEqual(
    (await run((q) => listProjectsOf(q, orgA, 200))).map(
      (/** @type {any} */ p) => p.title,
    ),
    ["A's own"],
  );
  assert.equal(
    await run((q) => setStage(q, mine.id, orgA, "interview", h.now() + 1000)),
    true,
  );
});
