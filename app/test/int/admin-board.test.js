import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { ADMIN, authHarness } from "../fixtures/auth.js";
import { STATE_TABLES, addProject } from "../fixtures/m23.js";

// REQ-117 criteria 5 and 6 (the request board, the card and the audit page; the code design M2PROJ, 4.3 rows N7,
// N8 and N10, section 7.2): the admin routes through app.request on a migrated PGlite. The eleven stages and the
// closed details keys are literals written here; the counts and the order are computed by the test from what it
// planted, never read from the code under test.

/** @typedef {import("../fixtures/auth.js").AuthHarness} H */

/** The eleven stages in the order of a project's life. */
const ELEVEN = [
  "draft",
  "interview",
  "spec",
  "approved",
  "dev_requested",
  "in_development",
  "built",
  "delivered",
  "accepted",
  "returned",
  "archived",
];

/** The keys of an audit page row: the closed columns only. */
const ROW_KEYS = [
  "action",
  "actor_kind",
  "created_at",
  "details",
  "id",
  "target_id",
  "target_kind",
];
/** The closed keys of the details of a row (the design M2AUTH 4.11 and M2PROJ C16). */
const DETAIL_KEYS = [
  "method",
  "owner_identity",
  "purpose",
  "reason",
  "reauth_id",
  "remaining",
  "role",
  "session_id",
  "stage",
  "version",
];

/**
 * The state compared before and after a refusal: counts and the sha256 of the rows of the nine tables.
 * @param {H} h
 */
const stateOf = async (h) => ({
  counts: await h.counts(),
  digest: await h.digest(STATE_TABLES),
});

/** The six actors of the matrix, and three customer organisations A, B and C (A is the actors' own). @param {import("node:test").TestContext} t */
async function world(t) {
  const h = await authHarness(t);
  const A = await h.actors();
  const orgA = /** @type {string} */ (A.member.orgId);
  const orgB = await h.addOrg("Organisation B");
  const orgC = await h.addOrg("Organisation C");
  return {
    h,
    A,
    orgA,
    orgB,
    orgC,
    names: {
      [orgA]: "Customer 1",
      [orgB]: "Organisation B",
      [orgC]: "Organisation C",
    },
  };
}

test("BRD-1 GET /api/admin/requests answers the eleven stages in order, each with its true count and its projects (id, title, organisation name, updated_at) newest first, with the projects of three organisations in the counts; a stage holds at most 200 projects but its count is the whole", async (t) => {
  const { h, A, orgA, orgB, orgC, names } = await world(t);
  /** @type {Array<{ stage: string, org: string, title: string, at: number, id: string }>} */
  const planted = [];
  const plan = /** @type {Array<[string, string]>} */ ([
    ["draft", orgA],
    ["draft", orgB],
    ["interview", orgB],
    ["draft", orgC],
    ["spec", orgC],
    ["draft", orgA],
    ["spec", orgC],
    ["built", orgA],
    ["archived", orgB],
  ]);
  for (const [i, [stage, org]] of plan.entries()) {
    h.tick(1000);
    const title = `Request ${i + 1} of ${names[org]} at ${stage}`;
    const { id } = await addProject(h, {
      orgId: org,
      createdBy: A.member.id,
      title,
      stage,
    });
    planted.push({ stage, org, title, at: h.now(), id });
  }
  const r = await h.call("GET", "/api/admin/requests", {
    as: A.admin,
    origin: null,
  });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(Object.keys(r.json), ["stages"]);
  assert.deepEqual(
    r.json.stages.map((/** @type {any} */ s) => s.stage),
    ELEVEN,
  );
  for (const s of r.json.stages) {
    assert.deepEqual(Object.keys(s).sort(), ["count", "projects", "stage"]);
    const want = planted
      .filter((p) => p.stage === s.stage)
      .sort((a, b) => b.at - a.at);
    assert.equal(s.count, want.length, `${s.stage}: the count`);
    assert.deepEqual(
      s.projects.map((/** @type {any} */ p) => p.id),
      want.map((p) => p.id),
      `${s.stage}: the projects, newest first`,
    );
    for (const [i, p] of s.projects.entries()) {
      assert.deepEqual(Object.keys(p).sort(), [
        "id",
        "org_name",
        "title",
        "updated_at",
      ]);
      assert.equal(p.title, want[i].title);
      assert.equal(p.org_name, names[want[i].org]);
      assert.equal(p.updated_at, new Date(want[i].at).toISOString());
    }
  }
  // The three organisations stand in the draft count together (A twice, B and C once).
  assert.equal(r.json.stages[0].count, 4);
  assert.deepEqual(
    new Set(
      r.json.stages[0].projects.map((/** @type {any} */ p) => p.org_name),
    ),
    new Set(["Customer 1", "Organisation B", "Organisation C"]),
  );
  // The cap: 205 projects at one stage are 205 in the count and the newest 200 in the list.
  await h.sql(
    "insert into projects (org_id, title, language, stage, created_by, created_at, updated_at) select $1, 'bulk ' || g, 'ru', 'delivered', $2, $3::timestamptz + (g || ' seconds')::interval, $3::timestamptz + (g || ' seconds')::interval from generate_series(1, 205) g",
    [orgB, A.member.id, new Date(h.now()).toISOString()],
  );
  const big = await h.call("GET", "/api/admin/requests", {
    as: A.admin,
    origin: null,
  });
  const delivered = big.json.stages.find(
    (/** @type {any} */ s) => s.stage === "delivered",
  );
  assert.equal(delivered.count, 205);
  assert.equal(delivered.projects.length, 200);
  assert.equal(delivered.projects[0].title, "bulk 205");
  assert.equal(delivered.projects[199].title, "bulk 6");
  // The board writes no audit row (the list is not audited, the card is).
  assert.equal(
    (
      await h.sql(
        "select count(*)::int as n from audit_log where action = 'admin_read'",
      )
    )[0].n,
    0,
  );
});

test("BRD-2 ?stage=draft answers only the draft projects in one entry; every stage can be asked for; an unknown stage, another case, an empty or a repeated value is refused with 400 bad_request and no audit row", async (t) => {
  const { h, A, orgA, orgB } = await world(t);
  const d1 = await addProject(h, {
    orgId: orgA,
    createdBy: A.member.id,
    title: "Draft one",
  });
  h.tick(1000);
  const d2 = await addProject(h, {
    orgId: orgB,
    createdBy: A.member.id,
    title: "Draft two",
  });
  await addProject(h, {
    orgId: orgA,
    createdBy: A.member.id,
    title: "Interview one",
    stage: "interview",
  });
  const r = await h.call("GET", "/api/admin/requests?stage=draft", {
    as: A.admin,
    origin: null,
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.stages.length, 1);
  assert.equal(r.json.stages[0].stage, "draft");
  assert.equal(r.json.stages[0].count, 2);
  assert.deepEqual(
    r.json.stages[0].projects.map((/** @type {any} */ p) => p.id),
    [d2.id, d1.id],
  );
  for (const stage of ELEVEN) {
    const x = await h.call("GET", `/api/admin/requests?stage=${stage}`, {
      as: A.admin,
      origin: null,
    });
    assert.equal(x.status, 200, `${stage}: ${x.text}`);
    assert.deepEqual(
      x.json.stages.map((/** @type {any} */ s) => s.stage),
      [stage],
    );
    assert.equal(
      x.json.stages[0].count,
      stage === "draft" ? 2 : stage === "interview" ? 1 : 0,
      stage,
    );
  }
  const before = await stateOf(h);
  for (const q of [
    "nope",
    "DRAFT",
    "Draft",
    "draft%20",
    "",
    "approved%00",
    "1",
  ]) {
    const x = await h.call("GET", `/api/admin/requests?stage=${q}`, {
      as: A.admin,
      origin: null,
    });
    assert.equal(x.status, 400, `?stage=${q}: ${x.text}`);
    assert.deepEqual(x.json, { error: "bad_request" }, `?stage=${q}`);
  }
  assert.deepEqual(
    await stateOf(h),
    before,
    "a refused board request wrote nothing",
  );
});

test("BRD-3 GET /api/admin/projects/:id answers the card fields of the design and writes exactly one audit row admin_read per call (two calls, two rows; the organisation is the project's, the actor the admin); a missing project or an id that is no uuid answers 404 and writes none", async (t) => {
  const { h, A, orgB } = await world(t);
  const p = await addProject(h, {
    orgId: orgB,
    createdBy: A.member.id,
    title: "Card of B",
    language: "en",
    quickFacts: { what: "tool", whom: "myself", lang: "en" },
    versions: [{ text: "The first words" }],
  });
  h.tick(60_000);
  const edit = await h.call("POST", `/api/admin/projects/${p.id}/idea`, {
    as: A.admin,
    body: { text: "Clarified words", reason: "Asked the client" },
  });
  assert.equal(edit.status, 200, edit.text);
  const count = async () =>
    (
      await h.sql(
        "select count(*)::int as n from audit_log where action = 'admin_read'",
      )
    )[0].n;
  assert.equal(await count(), 0);
  const r1 = await h.call("GET", `/api/admin/projects/${p.id}`, {
    as: A.admin,
    origin: null,
  });
  const r2 = await h.call("GET", `/api/admin/projects/${p.id}`, {
    as: A.admin,
    origin: null,
  });
  for (const r of [r1, r2]) {
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(Object.keys(r.json).sort(), [
      "created_at",
      "id",
      "language",
      "org",
      "quick_facts",
      "stage",
      "title",
      "updated_at",
      "versions",
    ]);
    assert.equal(r.json.id, p.id);
    assert.equal(r.json.title, "Card of B");
    assert.equal(r.json.stage, "draft");
    assert.equal(r.json.language, "en");
    assert.deepEqual(r.json.org, { id: orgB, name: "Organisation B" });
    assert.deepEqual(r.json.quick_facts, {
      what: "tool",
      whom: "myself",
      lang: "en",
    });
    assert.equal(r.json.updated_at, new Date(h.now()).toISOString());
    assert.deepEqual(
      r.json.versions.map((/** @type {any} */ v) => v.version),
      [1, 2],
    );
    assert.deepEqual(
      r.json.versions.map((/** @type {any} */ v) => v.text),
      ["The first words", "Clarified words"],
    );
    assert.deepEqual(
      r.json.versions.map((/** @type {any} */ v) => v.reason),
      [null, "Asked the client"],
    );
    for (const v of r.json.versions)
      assert.deepEqual(Object.keys(v).sort(), [
        "author",
        "created_at",
        "reason",
        "text",
        "version",
      ]);
    assert.deepEqual(r.json.versions[0].author, {
      id: A.member.id,
      name: "Test User",
      admin: false,
    });
    assert.deepEqual(r.json.versions[1].author, {
      id: A.admin.id,
      name: ADMIN.name,
      admin: true,
    });
  }
  assert.equal(await count(), 2, "two calls, two audit rows");
  const rows = await h.sql(
    "select * from audit_log where action = 'admin_read' order by id",
  );
  for (const row of rows) {
    assert.equal(
      row.org_id,
      orgB,
      "the organisation of the row is the project's",
    );
    assert.equal(row.actor_kind, "admin");
    assert.equal(row.actor_id, A.admin.id);
    assert.equal(row.target_kind, "project");
    assert.equal(row.target_id, p.id);
    assert.deepEqual(row.details, {});
  }
  // A miss writes no row: a missing project, an id that is no uuid.
  const before = await stateOf(h);
  for (const id of [
    crypto.randomUUID(),
    "not-a-uuid",
    "00000000-0000-4000-8000-000000000000",
  ]) {
    const x = await h.call("GET", `/api/admin/projects/${id}`, {
      as: A.admin,
      origin: null,
    });
    assert.equal(x.status, 404, `${id}: ${x.text}`);
    assert.deepEqual(x.json, { error: "not_found" });
  }
  assert.deepEqual(await stateOf(h), before);
  assert.equal(await count(), 2);
});

test("BRD-4 the board, the card, the edit and the audit routes answer an org_owner, an org_admin, a member, a viewer and an anonymous caller 404 byte-equal to an unknown /api address (with and without Origin), and leave every table unchanged", async (t) => {
  const { h, A, orgB } = await world(t);
  const p = await addProject(h, { orgId: orgB, createdBy: A.member.id });
  const before = await stateOf(h);
  /** @type {Array<[string, string, Record<string, unknown> | undefined]>} */
  const routes = [
    ["GET", "/api/admin/requests", undefined],
    ["GET", "/api/admin/requests?stage=draft", undefined],
    ["GET", `/api/admin/projects/${p.id}`, undefined],
    [
      "POST",
      `/api/admin/projects/${p.id}/idea`,
      { text: "A corrected idea", reason: "Because" },
    ],
    ["GET", "/api/admin/audit", undefined],
    ["GET", "/api/admin/audit?after=0", undefined],
  ];
  const actors = /** @type {const} */ ([
    ["org_owner", A.org_owner],
    ["org_admin", A.org_admin],
    ["member", A.member],
    ["viewer", A.viewer],
    ["anonymous", null],
  ]);
  for (const [name, as] of actors)
    for (const origin of [h.origin, null]) {
      for (const [method, path, body] of routes) {
        const opts = { as, origin, ...(body ? { body } : {}) };
        const a = await h.call(method, path, opts);
        const unknown = await h.call(
          method,
          `/api/no-such/${path.split("?")[0].replace(/^\/api\//, "")}`,
          opts,
        );
        assert.equal(a.status, 404, `${name} ${method} ${path}: ${a.text}`);
        assert.equal(
          a.same,
          unknown.same,
          `${name} ${method} ${path}: unlike an unknown address`,
        );
        assert.deepEqual(a.setCookie, []);
      }
    }
  assert.deepEqual(await stateOf(h), before);
  // The admin himself is served (the 404 is the others' answer).
  assert.equal(
    (await h.call("GET", "/api/admin/requests", { as: A.admin, origin: null }))
      .status,
    200,
  );
});

test("ADT-1 GET /api/admin/audit?after=<id> answers the rows after that id in ascending id order, at most 50, each with the closed columns and the closed details keys only, and next (the last id of a full page, else null); paging from 0 reaches every row once; a malformed after is refused with 400", async (t) => {
  const { h, A } = await world(t);
  // More than 50 rows by real actions: 60 project creations by three members (20 a day each), on top of the
  // setup and the logins of the actors.
  const makers = [];
  for (let i = 0; i < 3; i += 1)
    makers.push(
      await h.signIn(
        await h.addUser({
          email: `maker${i}@example.test`,
          orgId: /** @type {string} */ (A.member.orgId),
        }),
      ),
    );
  for (const m of makers)
    for (let i = 0; i < 20; i += 1) {
      const r = await h.call("POST", "/api/projects", {
        as: m,
        body: {
          title: `P ${i}`,
          idea: "An idea",
          what: "site",
          whom: "team",
          lang: "ru",
        },
      });
      assert.equal(r.status, 201, r.text);
    }
  const wanted = (
    await h.sql("select id::text as id from audit_log order by audit_log.id")
  ).map((r) => r.id);
  assert.ok(wanted.length > 60, `${wanted.length} audit rows`);
  const first = await h.call("GET", "/api/admin/audit", {
    as: A.admin,
    origin: null,
  });
  assert.equal(first.status, 200, first.text);
  assert.deepEqual(Object.keys(first.json).sort(), ["next", "rows"]);
  assert.equal(first.json.rows.length, 50, "a full page is 50 rows");
  assert.equal(first.json.next, first.json.rows[49].id);
  assert.deepEqual(
    first.json.rows.map((/** @type {any} */ r) => r.id),
    wanted.slice(0, 50),
  );
  // Every page, from 0 on: the ids are those of the table in ascending order, each once.
  /** @type {string[]} */
  const seen = [];
  let after = "0";
  for (let guard = 0; guard < 20; guard += 1) {
    const page = await h.call("GET", `/api/admin/audit?after=${after}`, {
      as: A.admin,
      origin: null,
    });
    assert.equal(page.status, 200, page.text);
    assert.ok(page.json.rows.length <= 50);
    for (const row of page.json.rows) {
      assert.deepEqual(Object.keys(row).sort(), ROW_KEYS);
      for (const k of Object.keys(row.details))
        assert.ok(
          DETAIL_KEYS.includes(k),
          `a details key outside the closed list: ${k}`,
        );
      assert.match(row.created_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
      assert.ok(
        BigInt(row.id) > BigInt(after),
        `a row at or before after=${after}`,
      );
      seen.push(row.id);
    }
    if (page.json.next === null) {
      assert.ok(page.json.rows.length < 50, "the last page is not full");
      break;
    }
    assert.equal(page.json.next, page.json.rows[page.json.rows.length - 1].id);
    after = page.json.next;
  }
  assert.deepEqual(seen, wanted, "paging reaches every row once, in id order");
  // After the last id: an empty page.
  const end = await h.call(
    "GET",
    `/api/admin/audit?after=${wanted[wanted.length - 1]}`,
    { as: A.admin, origin: null },
  );
  assert.deepEqual(end.json, { rows: [], next: null });
  // A page after a middle id starts at the next id.
  const mid = await h.call("GET", `/api/admin/audit?after=${wanted[9]}`, {
    as: A.admin,
    origin: null,
  });
  assert.equal(mid.json.rows[0].id, wanted[10]);
  // The actions of the rows are the ones the design lists; the project rows carry the stage in their details.
  const created = first.json.rows
    .concat(mid.json.rows)
    .filter((/** @type {any} */ r) => r.action === "project.create");
  assert.ok(created.length > 0);
  for (const r of created) assert.deepEqual(r.details, { stage: "draft" });
  // Malformed `after` values: refused, nothing written.
  const before = await stateOf(h);
  for (const bad of [
    "abc",
    "-1",
    "1.5",
    "1e3",
    "",
    "1234567890123456",
    "0x10",
    "1%20",
    "9223372036854775807x",
  ]) {
    const x = await h.call("GET", `/api/admin/audit?after=${bad}`, {
      as: A.admin,
      origin: null,
    });
    assert.equal(x.status, 400, `after=${bad}: ${x.text}`);
    assert.deepEqual(x.json, { error: "bad_request" }, `after=${bad}`);
  }
  assert.deepEqual(await stateOf(h), before);
  // Fifteen digits are well formed.
  assert.equal(
    (
      await h.call("GET", "/api/admin/audit?after=999999999999999", {
        as: A.admin,
        origin: null,
      })
    ).status,
    200,
  );
});

test("ADT-2 no page of the audit answer holds an e-mail, a name or a client address of the planted values (nor the address code, the hash or the organisation of a row), and a non-admin and an anonymous caller get the 404 of an unknown address", async (t) => {
  const { h, A, orgA } = await world(t);
  const person = await h.signIn(
    await h.addUser({
      email: "planted.person.zq@example.test",
      name: "Zyxwv Plantedname",
      orgId: orgA,
      ip: "198.51.100.77",
    }),
  );
  // Actions that write rows: a project, an edit, a deletion request, and a failed login of the planted e-mail.
  const made = await h.call("POST", "/api/projects", {
    as: person,
    body: {
      title: "Planted title",
      idea: "Planted idea",
      what: "bot",
      whom: "team",
      lang: "en",
    },
  });
  assert.equal(made.status, 201, made.text);
  await h.call("POST", `/api/projects/${made.json.id}/idea`, {
    as: person,
    body: { text: "More", reason: "Why" },
  });
  await h.call("POST", "/api/auth/login", {
    ip: "198.51.100.78",
    body: { email: person.email, password: "wrong-password-0" },
  });
  await h.call("POST", `/api/admin/projects/${made.json.id}/idea`, {
    as: A.admin,
    body: { text: "Admin", reason: "Why" },
  });
  /** @type {string[]} */
  const bodies = [];
  let after = "0";
  for (let guard = 0; guard < 20; guard += 1) {
    const page = await h.call("GET", `/api/admin/audit?after=${after}`, {
      as: A.admin,
      origin: null,
    });
    assert.equal(page.status, 200, page.text);
    bodies.push(page.text);
    if (page.json.next === null) break;
    after = page.json.next;
  }
  const all = bodies.join("\n").toLowerCase();
  assert.ok(all.includes("project.create"), "the page does list the rows");
  const rows = await h.sql(
    "select ip_hmac, hash, prev_hash from audit_log where ip_hmac is not null limit 5",
  );
  const forbidden = [
    "planted.person.zq",
    "example.test",
    "zyxwv",
    "plantedname",
    "198.51.100.77",
    "198.51.100.78",
    "198.51.100",
    ADMIN.name.toLowerCase(),
    "owner.admin",
    "ip_hmac",
    "prev_hash",
    "org_id",
    "actor_id",
    ...rows.flatMap((r) => [r.ip_hmac, r.hash, r.prev_hash]),
  ];
  for (const f of forbidden)
    assert.equal(
      all.includes(String(f).toLowerCase()),
      false,
      `an audit page shows ${f}`,
    );
  // Everyone else gets the uniform 404.
  for (const as of [person, A.member, A.org_owner, null]) {
    const a = await h.call("GET", "/api/admin/audit", { as, origin: null });
    const u = await h.call("GET", "/api/no-such/audit", { as, origin: null });
    assert.equal(a.status, 404, a.text);
    assert.equal(a.same, u.same);
  }
});
