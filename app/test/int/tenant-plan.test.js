import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import {
  insertIdeaVersion,
  insertProject,
} from "../../server/db/project-store.js";
import { planOf, withPlan } from "../../server/http/plan.js";
import { routeTable } from "../../server/routes/index.js";
import { authHarness } from "../fixtures/auth.js";
import { STATE_TABLES } from "../fixtures/m23.js";

// REQ-117 criterion 1 and the settlement of decisions/0137 О11 (the plan of a tenant route; the code design
// M2PROJ, C1, 4.4 and 7.3, TP-1 to TP-5): the request pipeline runs the plan of a tenant route on the platform
// settings of the request transaction, appends the audit row it returns with the organisation, the actor and the
// address of the session, then switches to tenant settings and runs the handler, all in one transaction. The
// routes here are planted through deps.routeTable; the statements are recorded by an adapter that wraps PGlite.

/** @typedef {import("../fixtures/auth.js").AuthHarness} H */
/** @typedef {import("../fixtures/auth.js").Actor} Actor */

const META = Object.freeze({
  tenant: true,
  admin: false,
  reauth: null,
  worker: false,
  session: true,
  rateLimit: /** @type {const} */ ("user"),
});

/**
 * A planned audit entry of the good shape: exactly the four keys.
 * @param {Record<string, unknown>} [extra] more keys (a plan that goes wrong)
 */
const planned = (extra = {}) => ({
  action: "project.create",
  targetKind: "project",
  targetId: crypto.randomUUID(),
  details: { stage: "draft" },
  ...extra,
});

/**
 * The handler that does what a real create does: a project and its version 1 in the session's organisation.
 * @param {any} req
 */
async function makeProject(req) {
  const orgId = req.session.orgId;
  const id = crypto.randomUUID();
  await insertProject(req.q, {
    id,
    orgId,
    title: "Planted",
    language: "ru",
    createdBy: req.session.userId,
    now: req.now,
  });
  await insertIdeaVersion(req.q, {
    orgId,
    projectId: id,
    version: 1,
    text: "A planted idea",
    quickFacts: {},
    reason: null,
    createdBy: req.session.userId,
    now: req.now,
  });
}

/** Statements of one request as `{ text, params }`, in the order the adapter saw them. @typedef {{ text: string, params: unknown[] | undefined }} Seen */

/**
 * The world of these tests: the planted tenant routes, an adapter that records every statement, the six actors,
 * and a second organisation that no actor belongs to.
 * @param {import("node:test").TestContext} t
 */
async function world(t) {
  /** @type {Seen[]} */
  const seen = [];
  /** @type {string | null} */
  let otherOrg = null;
  /** @type {Array<any>} */
  const planted = [];
  /**
   * @param {string} path
   * @param {((req: any) => Promise<{ audit: any, state: unknown }>) | null} plan
   * @param {(req: any) => Promise<any>} handler
   */
  const route = (path, plan, handler) => {
    const row = Object.freeze({ method: "POST", path, meta: META, handler });
    planted.push(plan ? withPlan(row, plan) : row);
  };
  route(
    "/api/planted/good",
    async () => ({ audit: planned(), state: null }),
    async (req) => {
      await makeProject(req);
      return { status: 200, body: { ok: true } };
    },
  );
  route(
    "/api/planted/with-reads",
    async (req) => {
      await req.q.query("select 1 as plan_marker");
      return { audit: planned(), state: { marker: true } };
    },
    async (req) => {
      await req.q.query("select 2 as handler_marker");
      return { status: 200, body: { state: req.plan } };
    },
  );
  route(
    "/api/planted/handler-throws",
    async () => ({ audit: planned(), state: null }),
    async (req) => {
      await makeProject(req);
      throw new Error("the handler failed after the plan");
    },
  );
  route(
    "/api/planted/plan-throws",
    async (req) => {
      // The plan writes on platform settings, then fails: nothing of it may outlive the transaction.
      await insertProject(req.q, {
        id: crypto.randomUUID(),
        orgId: req.session.orgId,
        title: "Written by a plan",
        language: "ru",
        createdBy: req.session.userId,
        now: req.now,
      });
      throw new Error("the plan failed");
    },
    async () => ({ status: 200, body: {} }),
  );
  for (const key of ["orgId", "actorKind", "actorId", "ip"])
    route(
      `/api/planted/extra-${key}`,
      async () => ({
        audit: planned({
          [key]:
            key === "orgId"
              ? (otherOrg ?? "")
              : key === "actorKind"
                ? "admin"
                : key === "actorId"
                  ? crypto.randomUUID()
                  : "9.9.9.9",
        }),
        state: null,
      }),
      async () => ({ status: 200, body: {} }),
    );
  for (const key of ["action", "targetKind", "targetId", "details"])
    route(
      `/api/planted/missing-${key}`,
      async () => {
        const a = planned();
        delete (/** @type {any} */ (a)[key]);
        return { audit: a, state: null };
      },
      async () => ({ status: 200, body: {} }),
    );
  route(
    "/api/planted/null-audit",
    async () => ({ audit: null, state: { id: 1 } }),
    async (req) => {
      await makeProject(req);
      return { status: 200, body: { state: req.plan } };
    },
  );
  route("/api/planted/no-plan", null, async (req) => {
    const [who] = (
      await req.q.query(
        "select current_setting('app.role', true) as r, current_setting('app.org_id', true) as o",
      )
    ).rows;
    return { status: 200, body: { who } };
  });
  route(
    "/api/planted/write-other-org",
    async () => ({ audit: planned(), state: null }),
    async (req) => {
      // A handler that writes a row of another organisation: row-level security refuses it.
      await insertProject(req.q, {
        id: crypto.randomUUID(),
        orgId: otherOrg ?? "",
        title: "Foreign",
        language: "ru",
        createdBy: req.session.userId,
        now: req.now,
      });
      return { status: 200, body: {} };
    },
  );
  const h = await authHarness(t, {
    routeTable: (/** @type {any} */ deps) => [...routeTable(deps), ...planted],
    wrap: (/** @type {any} */ raw) => ({
      query: (/** @type {string} */ s, /** @type {unknown[]} */ p) =>
        raw.query(s, p),
      exec: (/** @type {string} */ s) => raw.exec(s),
      close: async () => {},
      transaction: (/** @type {any} */ fn) =>
        raw.transaction((/** @type {any} */ c) =>
          fn({
            query: (/** @type {string} */ s, /** @type {unknown[]} */ p) => {
              seen.push({ text: s, params: p });
              return c.query(s, p);
            },
          }),
        ),
    }),
  });
  const A = await h.actors();
  otherOrg = await h.addOrg("Organisation X");
  const post = (/** @type {string} */ path, /** @type {Actor} */ as) =>
    h.call("POST", path, { as, body: {} });
  /** The state compared before and after a refusal. */
  const state = async () => ({
    counts: await h.counts(),
    digest: await h.digest([...STATE_TABLES, "rate_limits"]),
  });
  return { h, A, seen, post, state, otherOrg: otherOrg, planted };
}

/** @param {Seen} s */
const isSettings = (s) =>
  s.text ===
  "select set_config('app.org_id', $1, true), set_config('app.role', $2, true)";
/** @param {Seen} s */
const isAuditInsert = (s) => s.text.startsWith("insert into audit_log");

test("TP-1 the statements of one planted tenant request run in this order: the platform settings, the plan's own statements, the audit insert, the switch to tenant settings of the session's organisation, the handler's statements; the audit row carries the session's organisation, the caller as actor and the HMAC of the request's address", async (t) => {
  const { h, A, seen, post } = await world(t);
  seen.length = 0;
  const r = await post("/api/planted/with-reads", A.member);
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(
    r.json,
    { state: { marker: true } },
    "the handler gets the plan's state",
  );
  const at = (/** @type {(s: Seen) => boolean} */ f) => seen.findIndex(f);
  const settings = seen
    .map((s, i) => (isSettings(s) ? i : -1))
    .filter((i) => i >= 0);
  assert.equal(
    settings.length,
    2,
    "two settings statements: the platform's and the tenant's",
  );
  assert.equal(settings[0] < settings[1], true);
  assert.deepEqual(
    seen[settings[0]].params,
    ["", "platform"],
    "the first settings are the platform's",
  );
  assert.deepEqual(
    seen[settings[1]].params,
    [A.member.orgId, "tenant"],
    "the switch is to the session's organisation",
  );
  const planStmt = at((s) => s.text === "select 1 as plan_marker");
  const audit = at(isAuditInsert);
  const handlerStmt = at((s) => s.text === "select 2 as handler_marker");
  assert.ok(
    settings[0] < planStmt,
    "the plan runs after the platform settings",
  );
  assert.ok(planStmt < audit, "the plan runs before the audit insert");
  assert.ok(
    audit < settings[1],
    "the audit insert is before the switch to tenant settings",
  );
  assert.ok(settings[1] < handlerStmt, "the handler runs after the switch");
  assert.equal(seen.filter(isAuditInsert).length, 1, "one audit insert");
  const rows = await h.sql(
    "select * from audit_log where action = 'project.create' order by id desc limit 1",
  );
  assert.equal(rows[0].org_id, A.member.orgId);
  assert.equal(rows[0].actor_kind, "user");
  assert.equal(rows[0].actor_id, A.member.id);
  assert.equal(
    rows[0].ip_hmac,
    crypto
      .createHmac("sha256", h.pepper)
      .update(`ip\u0000${A.member.ip}`, "utf8")
      .digest("hex"),
  );
  assert.deepEqual(rows[0].details, { stage: "draft" });
  // A platform admin's call is audited with actor_kind admin.
  const x = await post("/api/planted/good", A.admin);
  assert.equal(x.status, 200, x.text);
  const adminRow = (
    await h.sql(
      "select actor_kind, org_id from audit_log order by id desc limit 1",
    )
  )[0];
  assert.deepEqual(
    { ...adminRow },
    { actor_kind: "admin", org_id: A.admin.orgId },
  );
  // The audit chain still verifies: the planted rows were appended by the one writer.
  const verify = await h.call("GET", "/api/admin/audit/verify", {
    as: A.admin,
    origin: null,
  });
  assert.equal(verify.json.ok, true);
  // A route without a plan runs under tenant settings of the session's organisation, with no audit row.
  const before = (await h.counts()).audit_log;
  const y = await post("/api/planted/no-plan", A.org_owner);
  assert.equal(y.status, 200, y.text);
  assert.deepEqual(y.json.who, { r: "tenant", o: A.org_owner.orgId });
  assert.equal((await h.counts()).audit_log, before);
  // A plan that returns audit null: no audit row, the handler runs and gets the state.
  const z = await post("/api/planted/null-audit", A.member);
  assert.deepEqual(z.json, { state: { id: 1 } });
  assert.equal((await h.counts()).audit_log, before);
});

test("TP-2 a handler that throws after the plan, and a handler that writes a row of another organisation (refused by row-level security), answer 500 and leave the audit log and every table unchanged: the audit row and the action roll back together", async (t) => {
  const { h, A, post, state, otherOrg } = await world(t);
  for (const path of [
    "/api/planted/handler-throws",
    "/api/planted/write-other-org",
  ]) {
    const before = await state();
    const r = await post(path, A.member);
    assert.equal(r.status, 500, `${path}: ${r.text}`);
    assert.deepEqual(r.json, { error: "server_error" }, path);
    assert.deepEqual(await state(), before, `${path}: the state changed`);
  }
  assert.equal(
    (
      await h.sql("select count(*)::int as n from projects where org_id = $1", [
        otherOrg,
      ])
    )[0].n,
    0,
  );
  assert.equal(
    (
      await h.sql(
        "select count(*)::int as n from audit_log where action = 'project.create'",
      )
    )[0].n,
    0,
  );
});

test("TP-3 a plan that throws writes nothing, even what it wrote itself on the platform settings before it failed: 500, every table and the rate counters unchanged", async (t) => {
  const { A, post, state } = await world(t);
  const before = await state();
  const r = await post("/api/planted/plan-throws", A.member);
  assert.equal(r.status, 500, r.text);
  assert.deepEqual(r.json, { error: "server_error" });
  assert.deepEqual(await state(), before);
});

test("TP-4 withPlan on a row whose tenant is false throws a TypeError and keeps no plan; on a tenant row it returns the row itself; every real route row keeps exactly the keys method, path, meta and handler, and the real plans stand on the two tenant writes only", async (t) => {
  const { planted } = await world(t);
  const plan = async () => ({ audit: null, state: null });
  for (const over of [{ tenant: false }, { tenant: false, admin: true }]) {
    const row = Object.freeze({
      method: "POST",
      path: "/api/not-tenant",
      meta: Object.freeze({ ...META, ...over }),
      handler: async () => ({ status: 200, body: {} }),
    });
    assert.throws(() => withPlan(row, plan), TypeError);
    assert.equal(planOf(row), undefined);
  }
  const tenantRow = planted[0];
  assert.deepEqual(Object.keys(tenantRow).sort(), [
    "handler",
    "meta",
    "method",
    "path",
  ]);
  assert.equal(typeof planOf(tenantRow), "function");
  assert.equal(
    planOf(
      planted[planted.findIndex((r) => r.path === "/api/planted/no-plan")],
    ),
    undefined,
  );
  /** @type {any[]} */
  let rows = [];
  await authHarness(t, {
    routeTable: (/** @type {any} */ deps) => (rows = [...routeTable(deps)]),
  });
  for (const r of rows)
    assert.deepEqual(
      Object.keys(r).sort(),
      ["handler", "meta", "method", "path"],
      `${r.method} ${r.path}`,
    );
  assert.deepEqual(
    rows
      .filter((r) => planOf(r))
      .map((r) => `${r.method} ${r.path}`)
      .sort(),
    ["POST /api/projects", "POST /api/projects/:id/idea"],
  );
});

test("TP-5 a planned audit with a key other than action, targetKind, targetId and details (an orgId, an actorKind, an actorId, an ip), or with one of the four missing, fails the request before any audit row (500, rolled back, no table changed), and a plan that sets orgId to another organisation writes no row of that organisation; a plan with exactly the four keys gets the session's organisation, actor and address", async (t) => {
  const { h, A, post, state, otherOrg } = await world(t);
  const paths = [
    ...["orgId", "actorKind", "actorId", "ip"].map(
      (k) => `/api/planted/extra-${k}`,
    ),
    ...["action", "targetKind", "targetId", "details"].map(
      (k) => `/api/planted/missing-${k}`,
    ),
  ];
  for (const path of paths) {
    const before = await state();
    const r = await post(path, A.member);
    assert.equal(r.status, 500, `${path}: ${r.text}`);
    assert.deepEqual(r.json, { error: "server_error" }, path);
    assert.deepEqual(await state(), before, `${path}: the state changed`);
    assert.equal(
      (
        await h.sql(
          "select count(*)::int as n from audit_log where org_id = $1",
          [otherOrg],
        )
      )[0].n,
      0,
      `${path}: a row of the other organisation`,
    );
  }
  // The good shape: the row is the session's, whatever the plan could have said.
  const ok = await post("/api/planted/good", A.org_admin);
  assert.equal(ok.status, 200, ok.text);
  const row = (
    await h.sql(
      "select org_id, actor_kind, actor_id, ip_hmac from audit_log order by id desc limit 1",
    )
  )[0];
  assert.equal(row.org_id, A.org_admin.orgId);
  assert.equal(row.actor_kind, "user");
  assert.equal(row.actor_id, A.org_admin.id);
  assert.equal(
    row.ip_hmac,
    crypto
      .createHmac("sha256", h.pepper)
      .update(`ip\u0000${A.org_admin.ip}`, "utf8")
      .digest("hex"),
  );
  assert.equal(
    (
      await h.sql(
        "select count(*)::int as n from audit_log where org_id = $1",
        [otherOrg],
      )
    )[0].n,
    0,
  );
});
