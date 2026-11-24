import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PUBLIC_LANGS } from "../../public/shared/i18n/lang.js";
import { loadIntake } from "../../server/routes/demo.js";
import { routeTable } from "../../server/routes/index.js";
import { authHarness, totpCode } from "../fixtures/auth.js";
import { APP } from "../fixtures/helpers.js";
import {
  acceptBody,
  addProject,
  createInvite,
  inviteBody,
} from "../fixtures/m23.js";

// REQ-115 criterion 9 (audit chapter 10, stage 2; the code design M2AUTH, 4.12): every route of the real route
// table is called by every actor with its canonical request, and the class of each answer equals the row of
// app/test/fixtures/permission-matrix.golden.json; a route or an actor without its row fails. The golden file
// was written from the table of the design, not from the answers.

const GOLDEN = path.join(
  APP,
  "test",
  "fixtures",
  "permission-matrix.golden.json",
);
const ACTORS = [
  "anonymous",
  "viewer",
  "member",
  "org_admin",
  "org_owner",
  "platform_admin",
];
const CLASSES = ["2xx", "401", "403", "404"];
const ANSWERS = JSON.parse(
  fs.readFileSync(
    path.join(APP, "content", "sai-intake.answers", "landing.json"),
    "utf8",
  ),
);

/** @typedef {{ route: string, actor: string, class: string }} Row */

/** @returns {Row[]} */
const golden = () => JSON.parse(fs.readFileSync(GOLDEN, "utf8"));

/**
 * The findings of a golden table against the routes and actors: a route or an actor without its row, a row
 * twice, a row of no route or no actor, a class outside the four.
 * @param {Row[]} rows
 * @param {string[]} routes `<METHOD> <path>` of the route table
 * @param {string[]} actors
 * @returns {string[]}
 */
export function matrixFindings(rows, routes, actors) {
  const out = [];
  const seen = new Map();
  for (const r of rows) {
    const key = `${r.route} | ${r.actor}`;
    if (seen.has(key)) out.push(`a row twice: ${key}`);
    seen.set(key, r.class);
    if (!routes.includes(r.route)) out.push(`a row of no route: ${r.route}`);
    if (!actors.includes(r.actor)) out.push(`a row of no actor: ${r.actor}`);
    if (!CLASSES.includes(r.class)) out.push(`a class: ${key} ${r.class}`);
    if (Object.keys(r).sort().join(",") !== "actor,class,route")
      out.push(`the keys of ${key}`);
  }
  for (const route of routes)
    for (const actor of actors)
      if (!seen.has(`${route} | ${actor}`))
        out.push(`no row: ${route} | ${actor}`);
  return out;
}

/** @param {number} status */
const classOf = (status) =>
  status >= 200 && status < 300 ? "2xx" : String(status);

/**
 * The real route table as the app builds it with the demo (read at test time).
 * @param {import("node:test").TestContext} t
 */
async function realRoutes(t) {
  /** @type {any[]} */
  let table = [];
  await authHarness(t, {
    demo: { intake: loadIntake(), langs: PUBLIC_LANGS },
    routeTable: (/** @type {any} */ deps) => (table = [...routeTable(deps)]),
  });
  return table.map((r) => `${r.method} ${r.path}`);
}

/**
 * Calls one route as every actor with its canonical request (4.12: a fresh migrated database with setup done,
 * each actor signed in but anonymous; re-auth tokens of the route's purpose; the TOTP state the route needs; a
 * fresh reset code of a throwaway account), in the order of ACTORS. Each actor's call is made right after its
 * own preparation, so no earlier call of another actor decides it.
 * @param {import("node:test").TestContext} t
 * @param {string} route
 * @returns {Promise<Record<string, { status: number, text: string }>>}
 */
async function callAsEveryActor(t, route) {
  const h = await authHarness(t, {
    demo: { intake: loadIntake(), langs: PUBLIC_LANGS },
  });
  const all = await h.actors();
  /** @type {Record<string, any>} */
  const byName = { ...all, platform_admin: all.admin };
  const [method, template] = route.split(" ");
  /** @type {Record<string, { status: number, text: string }>} */
  const out = {};
  let n = 0;
  for (const name of ACTORS) {
    n += 1;
    const a = byName[name];
    /** @type {Record<string, unknown> | undefined} */
    let body = method === "GET" ? undefined : {};
    /** @type {string | null} */
    let reauth = null;
    let p = template;
    const purpose = {
      "POST /api/admin/users/:id/reset-link": "reset_link",
      "POST /api/admin/totp/enrol": "totp_enrol",
      "POST /api/admin/totp/off": "totp_off",
      "POST /api/admin/invites": "owner_identity",
      "POST /api/admin/users/:id/delete": "user_delete",
    }[route];
    switch (route) {
      case "GET /api/demo/questionnaire":
        p = `${template}?lang=ru`;
        break;
      case "POST /api/demo/result":
        p = `${template}?lang=ru`;
        body = { answers: ANSWERS };
        break;
      case "POST /api/auth/setup":
        body = {
          token: h.setupToken,
          email: `second${n}@example.test`,
          name: "Second Admin",
          password: "second-admin-pass-8Kd",
        };
        break;
      case "POST /api/auth/login":
        body = a
          ? { email: a.email, password: a.password }
          : { email: "nobody-here@example.test", password: "some-pass-4Xq9" };
        break;
      case "POST /api/auth/password":
        body = {
          current: a?.password ?? "some-pass-4Xq9",
          next: "changed-pass-9Zq",
        };
        break;
      case "POST /api/auth/reauth":
        body = {
          password: a?.password ?? "some-pass-4Xq9",
          purpose: "settings",
        };
        break;
      case "POST /api/auth/reset": {
        // A fresh code of a throwaway account, issued by the admin through the route.
        const target = await h.addUser({ role: null });
        const token = await h.reauthToken(all.admin, "reset_link");
        const link = await h.call(
          "POST",
          `/api/admin/users/${target.id}/reset-link`,
          { as: all.admin, body: {}, reauth: token },
        );
        assert.equal(link.status, 200, link.text);
        const code = /#c=([A-Za-z0-9_-]{22})$/.exec(link.json.link)?.[1];
        body = { code, password: "reset-pass-7Hq2x" };
        break;
      }
      case "POST /api/admin/users/:id/reset-link":
        p = template.replace(":id", (await h.addUser({ role: null })).id);
        break;
      case "POST /api/admin/totp/confirm":
        body = { code: "123456" };
        if (name === "platform_admin") {
          const token = await h.reauthToken(a, "totp_enrol");
          const e = await h.call("POST", "/api/admin/totp/enrol", {
            as: a,
            body: {},
            reauth: token,
          });
          assert.equal(e.status, 200, e.text);
          body = { code: totpCode(e.json.secret, h.now()) };
        }
        break;
      case "POST /api/admin/totp/off":
        body = { code: "123456" };
        if (name === "platform_admin") {
          const e = await h.call("POST", "/api/admin/totp/enrol", {
            as: a,
            body: {},
            reauth: await h.reauthToken(a, "totp_enrol"),
          });
          assert.equal(e.status, 200, e.text);
          const c = await h.call("POST", "/api/admin/totp/confirm", {
            as: a,
            body: { code: totpCode(e.json.secret, h.now()) },
          });
          assert.equal(c.status, 200, c.text);
          // The re-auth of totp_off takes the next step's code, the switch-off the one after it.
          h.tick(30000);
          reauth = await h.reauthToken(a, "totp_off", {
            code: totpCode(e.json.secret, h.now()),
          });
          h.tick(30000);
          body = { code: totpCode(e.json.secret, h.now()) };
        }
        break;
      // M2.3 (code design M2PROJ, 4.3.2 and 7.5): the canonical requests of rows N1-N14. Each actor's call
      // has its own fresh invite, throwaway user or project, so no earlier call decides it.
      case "GET /api/invites/:code":
      case "POST /api/invites/:code/accept": {
        const email = `canon${n}@example.test`;
        const made = await createInvite(
          h,
          all.admin,
          inviteBody({ email, org_name: `Canonical Co ${n}` }),
        );
        assert.equal(made.status, 201, made.text);
        p = template.replace(":code", String(made.code));
        if (method === "POST") body = acceptBody({ email });
        break;
      }
      case "POST /api/account/deletion-request":
        body = { password: a?.password ?? "some-pass-4Xq9" };
        break;
      case "POST /api/admin/invites":
        body = inviteBody({ email: `canon-new${n}@example.test` });
        break;
      case "POST /api/admin/users/:id/delete":
        p = template.replace(":id", (await h.addUser({ role: null })).id);
        break;
      case "GET /api/admin/projects/:id":
      case "POST /api/admin/projects/:id/idea": {
        const proj = await addProject(h, {
          orgId: /** @type {string} */ (all.member.orgId),
          createdBy: all.member.id,
        });
        p = template.replace(":id", proj.id);
        if (method === "POST")
          body = { text: "A corrected idea", reason: "Because it was unclear" };
        break;
      }
      case "POST /api/projects":
        body = {
          title: "A project",
          idea: "An idea",
          what: "shop",
          whom: "team",
          lang: "ru",
        };
        break;
      case "GET /api/projects/:id":
      case "POST /api/projects/:id/idea": {
        // A project of the actor's own organisation (an anonymous caller gets any id).
        const proj = a?.orgId
          ? await addProject(h, { orgId: a.orgId, createdBy: all.member.id })
          : { id: "00000000-0000-4000-8000-000000000000" };
        p = template.replace(":id", proj.id);
        if (method === "POST")
          body = { text: "A corrected idea", reason: "Because it was unclear" };
        break;
      }
      default:
        break;
    }
    // Every signed-in actor gets a real token of the route's purpose too (any user may get one), so the
    // actor is the only difference between the calls.
    if (purpose && a && reauth === null)
      reauth = await h.reauthToken(a, purpose);
    const r = await h.call(method, p, {
      as: a ?? null,
      body,
      reauth,
      ...(method === "GET" ? { origin: null } : {}),
    });
    out[name] = { status: r.status, text: r.text };
  }
  return out;
}

test("PM-1 every route called as every actor answers the class of its row in the golden file", async (t) => {
  const routes = await realRoutes(t);
  const rows = golden();
  assert.deepEqual(matrixFindings(rows, routes, ACTORS), []);
  assert.ok(routes.length >= 29, `${routes.length} routes`);
  t.diagnostic(
    `permission matrix: ${routes.length} routes × ${ACTORS.length} actors`,
  );
  /** @type {string[]} */
  const wrong = [];
  for (const route of routes) {
    const got = await callAsEveryActor(t, route);
    for (const actor of ACTORS) {
      const want = rows.find((r) => r.route === route && r.actor === actor);
      const seen = classOf(got[actor].status);
      if (seen !== want?.class)
        wrong.push(
          `${route} | ${actor}: ${seen} (${got[actor].text.slice(0, 60)}), golden ${want?.class}`,
        );
    }
  }
  assert.deepEqual(wrong, []);
});

test("PM-2 a route or an actor without its rows fails; the golden file names each organisation role", async (t) => {
  const routes = await realRoutes(t);
  const rows = golden();
  assert.equal(rows.length, routes.length * ACTORS.length);
  const text = fs.readFileSync(GOLDEN, "utf8");
  for (const role of ["org_admin", "org_owner", "member", "viewer"])
    assert.ok(
      (text.match(new RegExp(`"${role}"`, "g")) ?? []).length > 0,
      role,
    );
  const verify = "GET /api/admin/audit/verify";
  /** @type {Array<[string, Row[], string[], string[]]>} */
  const cases = [
    [
      `no row: ${verify} | member`,
      rows.filter((r) => !(r.route === verify && r.actor === "member")),
      routes,
      ACTORS,
    ],
    // A route of the table without rows (a route added later and not entered).
    [
      "no row: POST /api/planted | viewer",
      rows,
      [...routes, "POST /api/planted"],
      ACTORS,
    ],
    // An actor without rows.
    ["no row: GET /api/health | auditor", rows, routes, [...ACTORS, "auditor"]],
    [
      "a row of no route: GET /api/gone",
      [...rows, { route: "GET /api/gone", actor: "viewer", class: "2xx" }],
      routes,
      ACTORS,
    ],
    [
      `a row twice: ${verify} | viewer`,
      [...rows, { route: verify, actor: "viewer", class: "404" }],
      routes,
      ACTORS,
    ],
    [
      `a class: ${verify} | viewer 500`,
      rows.map((r) =>
        r.route === verify && r.actor === "viewer" ? { ...r, class: "500" } : r,
      ),
      routes,
      ACTORS,
    ],
  ];
  for (const [label, r, rs, as] of cases) {
    const found = matrixFindings(r, rs, as);
    assert.ok(found.includes(label), `${label}: ${JSON.stringify(found)}`);
  }
});
