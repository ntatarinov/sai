import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";
import { toDbError } from "../../server/db/index.js";
import { createPgAdapter } from "../../server/db/pg.js";
import { ADMIN, authHarness, randomToken } from "../fixtures/auth.js";
import { pgStandIn, waitFor } from "../fixtures/helpers.js";

// REQ-114 criterion 10 (Q10; the code design M2AUTH, 4.5.2, 4.7 step 0a and the DbError mapping, C15): with the
// database refusing connections and with a database whose statement never answers (the pg adapter of the app
// against a closed port and against the Postgres stand-in of helpers.js), login, setup, logout and me answer
// 503 db_unavailable within 5 s with no cookie, and the process keeps serving; a slow database whose answers
// pass the request deadline rolls the transaction back (rows unchanged); a COMMIT in flight at the deadline is
// waited for; an admin route without a session cookie answers the uniform 404 with no statement.

/** A port with nothing listening on it (bound on port 0, then closed). */
async function closedPort() {
  const s = net.createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", () => r(null)));
  const port = /** @type {net.AddressInfo} */ (s.address()).port;
  await new Promise((r) => s.close(() => r(null)));
  return port;
}

const sleep = (/** @type {number} */ ms) =>
  new Promise((r) => setTimeout(r, ms));

/**
 * A harness whose app talks to PGlite, or to the pg adapter of a closed port, or to the pg adapter of a
 * stand-in that never answers a statement, by `set(mode)`.
 * @param {import("node:test").TestContext} t
 * @param {"ok" | "refused" | "silent"} first
 */
async function switching(t, first) {
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
  let mode = first;
  /** Waits until every connection of the stand-in that got a statement was closed by the client. */
  const released = () =>
    waitFor(
      () =>
        [...new Set(stand.statements.map(([id]) => id))].every((id) =>
          stand.closed.has(id),
        ),
      15000,
      "the stalled connections to be released",
    );
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
  return {
    h,
    released,
    set: (/** @type {"ok" | "refused" | "silent"} */ m) => (mode = m),
  };
}

/**
 * The four routes of the criterion, in parallel; each answer with its time.
 * @param {import("../fixtures/auth.js").AuthHarness} h
 * @param {import("../fixtures/auth.js").Actor | null} u
 */
async function fourRoutes(h, u) {
  const timed = async (
    /** @type {Promise<import("../fixtures/auth.js").Answer>} */ p,
  ) => {
    const started = performance.now();
    const r = await p;
    return { r, ms: performance.now() - started };
  };
  return Promise.all([
    timed(
      h.call("POST", "/api/auth/login", {
        ip: "192.0.2.11",
        body: {
          email: u?.email ?? "a@example.test",
          password: u?.password ?? "some-pass-123",
        },
      }),
    ),
    timed(
      h.call("POST", "/api/auth/setup", {
        ip: "192.0.2.12",
        body: {
          token: h.setupToken,
          email: ADMIN.email,
          name: ADMIN.name,
          password: ADMIN.password,
        },
      }),
    ),
    timed(h.call("POST", "/api/auth/logout", { as: u, body: {} })),
    timed(h.call("GET", "/api/auth/me", { as: u, origin: null })),
  ]);
}

test("ADD-1 with the database refusing connections and with a statement that never answers, login, setup, logout and me answer 503 db_unavailable within 5 s with no cookie; after the recovery the next login works", async (t) => {
  const { h, set, released } = await switching(t, "ok");
  const u = await h.signIn(await h.addUser());
  const before = await h.digest();
  for (const mode of /** @type {const} */ (["refused", "silent", "refused"])) {
    set(mode);
    for (const { r, ms } of await fourRoutes(h, u)) {
      assert.equal(r.status, 503, `${mode}: ${r.text}`);
      assert.deepEqual(r.json, { error: "db_unavailable" }, mode);
      assert.ok(ms < 5000, `${mode}: ${Math.round(ms)} ms`);
      assert.deepEqual(r.setCookie, [], mode);
    }
    // The process keeps serving: an address that needs no database answers at once.
    const nope = await h.call("GET", "/api/nope", { origin: null });
    assert.equal(nope.status, 404);
  }
  set("ok");
  assert.deepEqual(await h.digest(), before, "the failures changed no row");
  assert.equal(
    (await h.call("GET", "/api/auth/me", { as: u, origin: null })).status,
    200,
    "the session still works",
  );
  const again = await h.call("POST", "/api/auth/login", {
    ip: "192.0.2.13",
    body: { email: u.email, password: u.password },
  });
  assert.equal(again.status, 200);
  assert.equal(again.setCookie.length, 1);
  await released();
});

test("ADD-1b a database that is down from the first request (no selfcheck answered yet): 503 within 5 s, then the recovery", async (t) => {
  for (const first of /** @type {const} */ (["refused", "silent"])) {
    const { h, set, released } = await switching(t, first);
    const u = await h.addUser();
    for (const { r, ms } of await fourRoutes(h, u)) {
      assert.equal(r.status, 503, `${first}: ${r.text}`);
      assert.deepEqual(r.json, { error: "db_unavailable" });
      assert.ok(ms < 5000, `${first}: ${Math.round(ms)} ms`);
      assert.deepEqual(r.setCookie, []);
    }
    set("ok");
    const ok = await h.call("POST", "/api/auth/login", {
      ip: "192.0.2.14",
      body: { email: u.email, password: u.password },
    });
    assert.equal(ok.status, 200, `${first}: after the recovery`);
    await released();
  }
});

/**
 * A TCP relay to `port` whose connections the test can cut at a chosen moment (a database connection that
 * drops while the app holds it).
 * @param {import("node:test").TestContext} t
 * @param {number} port
 */
async function relay(t, port) {
  /** @type {Set<net.Socket>} */
  const socks = new Set();
  const server = net.createServer((c) => {
    const u = net.connect(port, "127.0.0.1");
    for (const s of [c, u]) {
      s.on("error", () => {});
      socks.add(s);
    }
    c.pipe(u);
    u.pipe(c);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", () => r(null)));
  const cut = () => {
    for (const s of socks) s.destroy();
    socks.clear();
  };
  t.after(() => {
    cut();
    server.close();
  });
  return { port: /** @type {net.AddressInfo} */ (server.address()).port, cut };
}

test("ADD-4 a database connection that drops while a request transaction holds it: 503 db_unavailable within 5 s, no uncaught error, and the process keeps serving", async (t) => {
  /** @type {unknown[]} */
  const crashes = [];
  const onCrash = (/** @type {unknown} */ e) => crashes.push(e);
  process.on("uncaughtException", onCrash);
  t.after(() => process.off("uncaughtException", onCrash));
  const stand = await pgStandIn(t, { plan: () => "stall", answer: () => null });
  const r = await relay(t, stand.port);
  const pg = createPgAdapter(`postgres://u:p@127.0.0.1:${r.port}/d`, {
    connectTimeoutMs: 4000,
  });
  t.after(() => void pg.close().catch(() => {}));
  // The selfcheck answers on PGlite; the request transaction goes to the pg adapter through the relay.
  const h = await authHarness(t, {
    wrap: (/** @type {any} */ raw) => ({
      query: (/** @type {string} */ s, /** @type {unknown[]} */ p) =>
        raw.query(s, p),
      exec: (/** @type {string} */ s) => raw.exec(s),
      close: async () => {},
      transaction: (/** @type {any} */ fn) =>
        /** @type {NonNullable<typeof pg.transaction>} */ (pg.transaction)(fn),
    }),
  });
  assert.equal(
    (await h.call("GET", "/api/health", { origin: null })).status,
    200,
  );
  for (let round = 0; round < 2; round++) {
    const started = performance.now();
    const pending = h.call("POST", "/api/auth/login", {
      ip: "192.0.2.15",
      body: { email: "a@example.test", password: "some-pass-123" },
    });
    await waitFor(
      () => stand.statements.length > round,
      4000,
      "the transaction to start",
    );
    r.cut();
    const answer = await pending;
    assert.equal(answer.status, 503, answer.text);
    assert.deepEqual(answer.json, { error: "db_unavailable" });
    assert.ok(performance.now() - started < 5000);
    // A turn of the event loop for the error events of the cut connection.
    await sleep(50);
    assert.deepEqual(crashes.map(String), [], "no uncaught error");
    assert.equal(
      (await h.call("GET", "/api/nope", { origin: null })).status,
      404,
      "the app keeps serving",
    );
  }
});

/**
 * A harness whose PGlite transactions answer chosen statements late (the statement runs, its answer is held)
 * or hold the end of the callback (COMMIT in flight); it counts the statements of each transaction and the
 * transactions still running.
 * @param {import("node:test").TestContext} t
 * @param {number} txDeadlineMs
 */
async function slow(t, txDeadlineMs) {
  /** @type {{ late?: (i: number) => number, commitMs?: number }} */
  const plan = {};
  let inflight = 0;
  let last = 0;
  const h = await authHarness(t, {
    txDeadlineMs,
    wrap: (/** @type {any} */ raw) => ({
      query: (/** @type {string} */ s, /** @type {unknown[]} */ p) =>
        raw.query(s, p),
      exec: (/** @type {string} */ s) => raw.exec(s),
      close: async () => {},
      transaction: (/** @type {any} */ fn) => {
        inflight += 1;
        let i = 0;
        return raw
          .transaction(async (/** @type {any} */ c) => {
            const value = await fn({
              query: async (
                /** @type {string} */ s,
                /** @type {unknown[]} */ p,
              ) => {
                i += 1;
                last = i;
                const r = await c.query(s, p);
                const d = plan.late?.(i) ?? 0;
                if (d > 0) await sleep(d);
                return r;
              },
            });
            if (plan.commitMs) await sleep(plan.commitMs);
            return value;
          })
          .finally(() => {
            inflight -= 1;
          });
      },
    }),
  });
  return {
    h,
    plan,
    settled: () =>
      waitFor(() => inflight === 0, 10000, "the transactions to settle"),
    statements: () => last,
  };
}

test("ADD-2 a slow database: when the deadline passes before the last statement, or after the last statement and before COMMIT, the answer is 503 and no row changes; a COMMIT in flight at the deadline is answered 200 with the change made", async (t) => {
  const DEADLINE = 300;
  /** The two routes: a prepared request on a fresh harness. */
  const routes = {
    setup: async (/** @type {Awaited<ReturnType<typeof slow>>} */ s) => {
      await s.h.call("GET", "/api/health", { origin: null });
      return () =>
        s.h.call("POST", "/api/auth/setup", {
          ip: "192.0.2.21",
          body: {
            token: s.h.setupToken,
            email: ADMIN.email,
            name: ADMIN.name,
            password: ADMIN.password,
          },
        });
    },
    password: async (/** @type {Awaited<ReturnType<typeof slow>>} */ s) => {
      const u = await s.h.signIn(await s.h.addUser());
      return () =>
        s.h.call("POST", "/api/auth/password", {
          as: u,
          body: { current: u.password, next: "a-slow-new-pass-1" },
        });
    },
  };
  for (const [name, prepare] of Object.entries(routes)) {
    // The number of statements of the request transaction, counted on a database that is not slow.
    const probe = await slow(t, 4000);
    const send = await prepare(probe);
    assert.equal(
      (await send()).status < 300,
      true,
      `${name} works when the database is fast`,
    );
    const n = probe.statements();
    assert.ok(n >= 4, `${name}: ${n} statements`);
    for (const [
      label,
      late,
    ] of /** @type {Array<[string, (i: number) => number]>} */ ([
      [
        "the deadline passes in the middle",
        (i) => (i === Math.ceil(n / 2) ? DEADLINE + 100 : 0),
      ],
      ["every statement answers late", () => Math.ceil((DEADLINE * 1.5) / n)],
      [
        "the deadline passes after the last statement, before COMMIT",
        (i) => (i === n ? DEADLINE + 100 : 0),
      ],
    ])) {
      const s = await slow(t, DEADLINE);
      const go = await prepare(s);
      const before = await s.h.digest();
      s.plan.late = late;
      const started = performance.now();
      const r = await go();
      assert.equal(r.status, 503, `${name}, ${label}: ${r.text}`);
      assert.deepEqual(r.json, { error: "db_unavailable" });
      assert.ok(performance.now() - started < 5000);
      await s.settled();
      s.plan.late = undefined;
      assert.deepEqual(
        await s.h.digest(),
        before,
        `${name}, ${label}: every row unchanged`,
      );
    }
  }
  // The COMMIT in flight: the guard has passed, the deadline passes while the commit is held (under 900 ms).
  const s = await slow(t, DEADLINE);
  const go = await routes.password(s);
  s.plan.commitMs = DEADLINE + 250;
  const started = performance.now();
  const r = await go();
  assert.equal(r.status, 200, `commit in flight: ${r.text}`);
  assert.ok(
    performance.now() - started > DEADLINE,
    "the answer came after the deadline",
  );
  s.plan.commitMs = 0;
  const [row] = await s.h.sql(
    "select count(*)::int as n from audit_log where action = 'auth.password_change'",
  );
  assert.equal(row.n, 1, "the change is there");
});

test("ADD-3 with the database down, an admin route without a session cookie answers 404 byte-equal to an unknown /api address and sends no statement", async (t) => {
  let calls = 0;
  const fail = () => {
    calls += 1;
    // What an adapter gives for a refused connection (the adapter contract: every error is a DbError).
    return Promise.reject(
      toDbError(
        Object.assign(new Error("connect ECONNREFUSED"), {
          code: "ECONNREFUSED",
        }),
      ),
    );
  };
  const h = await authHarness(t, {
    wrap: () => ({
      query: fail,
      exec: fail,
      transaction: fail,
      close: async () => {},
    }),
  });
  for (const [method, path] of [
    ["GET", "/api/admin/audit/verify"],
    ["POST", "/api/admin/totp/enrol"],
    ["POST", "/api/admin/totp/confirm"],
    ["POST", "/api/admin/totp/off"],
    [
      "POST",
      "/api/admin/users/11111111-1111-4111-8111-111111111111/reset-link",
    ],
  ])
    for (const cookie of [
      null,
      "sai_s=short",
      "other=" + randomToken(),
      `sai_s=${randomToken()}; sai_s=${randomToken()}`,
    ]) {
      const o = {
        cookie,
        body: method === "GET" ? undefined : {},
        origin: method === "GET" ? null : undefined,
      };
      const r = await h.call(method, path, o);
      const unknown = await h.call(method, `${path}x`, o);
      assert.equal(r.status, 404, `${method} ${path} ${cookie}`);
      assert.equal(r.same, unknown.same, `${method} ${path} ${cookie}`);
    }
  assert.equal(calls, 0, "no statement was sent");
  // A caller with a well-formed session cookie gets 503 (the session read needs the database).
  const r = await h.call("GET", "/api/admin/audit/verify", {
    cookie: `sai_s=${randomToken()}`,
    origin: null,
  });
  assert.equal(r.status, 503);
  assert.deepEqual(r.json, { error: "db_unavailable" });
});
