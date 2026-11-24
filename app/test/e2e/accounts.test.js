/* global document */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN } from "../fixtures/auth.js";
import {
  newPage,
  openBrowser,
  serveAccounts,
  shownTextFindings,
} from "../fixtures/browser.js";
import { collector, reportedProblems } from "../fixtures/e2e-kit.js";
import { CLIENT_PASSWORD, acceptBody, inviteBody } from "../fixtures/m23.js";

// REQ-117 criterion 10 (the whole path in a browser; the code design M2PROJ, 4.9.2 and F18), the tests ACC-1 and
// ACC-2 of the e2e job: one real Chrome, the server of `serveAccounts(t)` (node-main on port 0 with a fresh
// in-memory PGlite, a pepper and the hash of a setup token). A test reads the pages through the element ids of
// the design (4.9.2) and collects what it finds; the text that each page shows is read through
// `shownTextFindings`, which takes the five consent sentences through the narrow exception of 4.8.

const CLIENT_EMAIL = "client.acc@example.test";
const SHOP = {
  title: "Цветочный магазин",
  idea: "Хочу сайт, где люди закажут цветы с доставкой по городу",
};
const REASON = "Уточнил у клиента, что нужна доставка в день заказа";

/**
 * The reports of a page that no test allows. The sign-in page asks `GET /api/auth/me` before anyone has signed
 * in, and Chrome writes one console line for that 401 answer; it is the probe of the page, not an error of it,
 * so the lines of exactly that request are left out (every other console line is a finding).
 * @param {{ outside: string[], violations: string[], pageErrors: string[], consoleLines: Array<{ level: string, text: string, url: string }> }} env
 * @param {string} origin
 */
const problemsOf = (env, origin) =>
  reportedProblems({
    ...env,
    consoleLines: env.consoleLines.filter(
      (l) =>
        !(
          l.level === "error" &&
          /status of 401/.test(l.text) &&
          l.url === `${origin}/api/auth/me`
        ),
    ),
  });

/** A page waits until an element of the design is shown. @param {import("playwright-core").Page} page @param {string} selector */
const shown = (page, selector) =>
  page.locator(selector).first().waitFor({ state: "visible", timeout: 15000 });

/**
 * A JSON API client over the cookie jar of a browser context (the session the pages share): one call, its
 * answer, with the CSRF token the caller has read.
 * @param {import("playwright-core").BrowserContext} context
 * @param {string} origin
 */
function api(context, origin) {
  /** @type {string | null} */
  let csrf = null;
  /**
   * @param {"GET" | "POST"} method
   * @param {string} path
   * @param {unknown} [body]
   * @param {{ reauth?: string }} [o]
   */
  const call = async (method, path, body, o = {}) => {
    /** @type {Record<string, string>} */
    const headers = { Origin: origin };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (csrf !== null) headers["x-sai-csrf"] = csrf;
    if (o.reauth) headers["x-sai-reauth"] = o.reauth;
    const res = await context.request.fetch(`${origin}${path}`, {
      method,
      headers,
      data: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return {
      status: res.status(),
      text,
      json: text.startsWith("{") ? JSON.parse(text) : null,
    };
  };
  return {
    call,
    /** Reads the session's CSRF token from GET /api/auth/me. */
    async readCsrf() {
      const me = await call("GET", "/api/auth/me");
      assert.equal(me.status, 200, me.text);
      csrf = me.json.csrf;
    },
  };
}

test("ACC-1 setup with the token, the admin signs in, invites a new owner identity with a re-auth, a second context opens the link (the consent box is not ticked), ticks it and accepts, creates a project with the three quick facts, sees the stage strip at its first stage; the admin board shows it under «Новые» with count 1, the card, «Изменить заявку» with «Почему», version 2 on both sides, and the audit page lists the six actions in their order; no console error, no request outside the server, no forbidden word in what the pages show", async (t) => {
  const srv = await serveAccounts(t);
  const browser = await openBrowser(t);
  const adminEnv = await newPage(browser, t, { port: srv.port });
  const clientEnv = await newPage(browser, t, { port: srv.port });
  const admin = adminEnv.page;
  const client = clientEnv.page;
  const found = collector();
  /** Reads the text a page shows now and files the findings. @param {import("playwright-core").Page} page @param {string} where */
  const lint = async (page, where) =>
    found.add(where, await shownTextFindings(page, "ru"));

  // 1. The first setup, in the browser, with the setup token.
  await admin.goto(`${srv.origin}/setup.html`);
  await admin.fill("#token", srv.setupToken);
  await admin.fill("#email", ADMIN.email);
  await admin.fill("#name", ADMIN.name);
  await admin.fill("#password", ADMIN.password);
  await admin.click("#submit");
  await shown(admin, "#done");
  await lint(admin, "setup done");

  // 2. The admin signs in.
  await admin.goto(`${srv.origin}/login.html`);
  await admin.fill("#email", ADMIN.email);
  await admin.fill("#password", ADMIN.password);
  await admin.click("#submit");
  await shown(admin, "#session");
  await lint(admin, "login signed in");

  // 3. The invite of a new customer organisation for an owner identity, with a re-auth (the password again).
  await admin.goto(`${srv.origin}/admin-invites.html`);
  await shown(admin, "#app");
  await admin.fill("#email", CLIENT_EMAIL);
  await admin.selectOption("#org-mode", "new");
  await admin.fill("#org-name", "Цветы и Ко");
  await admin.check("#owner-identity");
  await admin.fill("#password", ADMIN.password);
  await admin.click("#submit");
  await shown(admin, "#result");
  const link = await admin.inputValue("#link");
  assert.match(
    link,
    new RegExp(`^${srv.origin}/invite\\.html#c=[A-Za-z0-9_-]{22}$`),
  );
  await lint(admin, "invite created");

  // 4. A second context opens the link: the consent box is not ticked; he ticks it and accepts.
  await client.goto(link);
  await shown(client, "#app");
  assert.equal(
    await client.isChecked("#consent"),
    false,
    "the consent box is ticked at load",
  );
  for (const n of [1, 2, 3, 4, 5])
    assert.ok(
      (await client.textContent(`#consent-${n}`))?.trim(),
      `the consent sentence ${n} is shown`,
    );
  assert.equal(
    new URL(client.url()).hash,
    "",
    "the code is cleared from the address",
  );
  await lint(client, "invite page");
  await client.fill("#name", "Айгуль");
  await client.fill("#email", CLIENT_EMAIL);
  await client.fill("#password", CLIENT_PASSWORD);
  await client.check("#consent");
  await Promise.all([
    client.waitForURL(/\/projects\.html$/),
    client.click("#submit"),
  ]);
  await shown(client, "#app");
  await lint(client, "project list (empty)");

  // 5. «Новый проект»: a title, an idea, the three quick facts, «Создать».
  await Promise.all([
    client.waitForURL(/\/project-new\.html$/),
    client.click("#new"),
  ]);
  await shown(client, "#app");
  await client.fill("#title", SHOP.title);
  await client.fill("#idea", SHOP.idea);
  await client.click('#qf-what [data-option="shop"]');
  await client.click('#qf-whom [data-option="customers"]');
  await client.click('#qf-lang [data-option="ru"]');
  await lint(client, "new project form");
  await Promise.all([
    client.waitForURL(/\/project\.html\?id=[0-9a-f-]{36}$/),
    client.click("#create"),
  ]);
  await shown(client, "#app");
  const projectUrl = client.url();

  // 6. The project page: the stage strip at its first stage.
  const strip = await client.$$eval("#strip li", (items) =>
    items.map((li) => ({
      stage: li.getAttribute("data-stage"),
      current: li.getAttribute("aria-current") === "step",
      done: li.classList.contains("done"),
    })),
  );
  assert.equal(strip.length, 11);
  assert.deepEqual(
    strip.filter((s) => s.current).map((s) => s.stage),
    ["draft"],
    "the strip marks the first stage as the current one",
  );
  assert.equal(
    strip.filter((s) => s.done).length,
    0,
    "no earlier stage is done at the first",
  );
  assert.equal(await client.textContent("#title"), SHOP.title);
  assert.equal(await client.locator("#versions li").count(), 1);
  await lint(client, "project page v1");

  // 7. The admin board: the project under «Новые» with the count 1.
  await admin.goto(`${srv.origin}/admin.html`);
  await shown(admin, '#board [data-stage="draft"]');
  assert.equal(
    (await admin.textContent('#board [data-stage="draft"] .count'))?.trim(),
    "1",
  );
  assert.equal(
    (
      await admin.textContent(
        '#board [data-stage="draft"] h2 [data-t="board_new"]',
      )
    )?.trim(),
    "Новые",
  );
  assert.equal(await admin.locator("#board [data-stage]").count(), 11);
  await lint(admin, "admin board");

  // 8. The card, «Изменить заявку» with «Почему».
  await Promise.all([
    admin.waitForURL(/\/admin-request\.html\?id=[0-9a-f-]{36}$/),
    admin.click(`#board [data-stage="draft"] a.lnk`),
  ]);
  await shown(admin, "#app");
  assert.equal(await admin.textContent("#title"), SHOP.title);
  assert.equal(await admin.locator("#versions li").count(), 1);
  await lint(admin, "card v1");
  await admin.click("#edit");
  await shown(admin, "#edit-form");
  assert.equal(
    await admin.inputValue("#edit-text"),
    SHOP.idea,
    "the edit form holds the newest text",
  );
  await admin.fill("#edit-text", `${SHOP.idea}, и самовывоз`);
  await admin.fill("#edit-reason", REASON);
  await admin.click("#edit-submit");
  await admin.waitForFunction(
    () => document.querySelectorAll("#versions li").length === 2,
    null,
    { timeout: 15000 },
  );
  await lint(admin, "card v2");

  // 9. Version 2 with its reason on both sides.
  /** @param {import("playwright-core").Page} page */
  const secondVersion = async (page) =>
    (await page.locator("#versions li").nth(1).textContent()) ?? "";
  const adminV2 = await secondVersion(admin);
  assert.ok(adminV2.includes(REASON), `the card shows the reason: ${adminV2}`);
  assert.ok(adminV2.includes("самовывоз"));
  await client.goto(projectUrl);
  await shown(client, "#app");
  await client.waitForFunction(
    () => document.querySelectorAll("#versions li").length === 2,
    null,
    { timeout: 15000 },
  );
  const clientV2 = await secondVersion(client);
  assert.ok(
    clientV2.includes(REASON),
    `the project page shows the reason: ${clientV2}`,
  );
  assert.ok(clientV2.includes("Почему"), "the reason carries its label");
  await lint(client, "project page v2");

  // 10. The audit page lists the six actions in their relative order (other rows may stand between them).
  await admin.goto(`${srv.origin}/admin-audit.html`);
  await shown(admin, "#rows li");
  const rows = await admin.$$eval("#rows li", (items) =>
    items.map((li) => li.textContent ?? ""),
  );
  const order = [
    "auth.setup",
    "auth.login",
    "invite.create",
    "invite.accept",
    "project.create",
    "project.idea_version",
  ];
  let from = 0;
  for (const action of order) {
    const at = rows.findIndex((row, i) => i >= from && row.includes(action));
    assert.ok(
      at >= 0,
      `the audit page lists ${action} after row ${from}: ${rows.join(" | ")}`,
    );
    from = at + 1;
  }
  await lint(admin, "audit page");

  assert.deepEqual(found.lines(), []);
  assert.deepEqual(problemsOf(adminEnv, srv.origin), []);
  assert.deepEqual(problemsOf(clientEnv, srv.origin), []);
  for (const env of [adminEnv, clientEnv])
    for (const u of env.requested)
      assert.ok(
        u.startsWith(`${srv.origin}/`) || u.startsWith("data:"),
        `a request left the server: ${u}`,
      );
});

/**
 * The Astana-time text of a moment (UTC+5, no summer time), written here from the fields of Date: the oracle of
 * the times that the pages show.
 * @param {number} ms
 */
function astana(ms) {
  const d = new Date(ms + 5 * 3_600_000);
  const two = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${two(d.getUTCDate())}.${two(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

test("ACC-2 the client's deletion request on /account.html shows its time in the Kazakhstan form, and the admin deletion page lists it with the same time", async (t) => {
  const srv = await serveAccounts(t);
  const browser = await openBrowser(t);
  const adminEnv = await newPage(browser, t, { port: srv.port });
  const clientEnv = await newPage(browser, t, { port: srv.port });
  const found = collector();
  // The two accounts through the JSON API of the contexts (the sessions the pages then share).
  const a = api(adminEnv.context, srv.origin);
  const setup = await a.call("POST", "/api/auth/setup", {
    token: srv.setupToken,
    email: ADMIN.email,
    name: ADMIN.name,
    password: ADMIN.password,
  });
  assert.equal(setup.status, 201, setup.text);
  const login = await a.call("POST", "/api/auth/login", {
    email: ADMIN.email,
    password: ADMIN.password,
  });
  assert.equal(login.status, 200, login.text);
  await a.readCsrf();
  const token = await a.call("POST", "/api/auth/reauth", {
    password: ADMIN.password,
    purpose: "owner_identity",
  });
  assert.equal(token.status, 200, token.text);
  const made = await a.call(
    "POST",
    "/api/admin/invites",
    inviteBody({ email: CLIENT_EMAIL }),
    { reauth: token.json.token },
  );
  assert.equal(made.status, 201, made.text);
  const code = made.json.link.split("#c=")[1];
  const c = api(clientEnv.context, srv.origin);
  const accepted = await c.call(
    "POST",
    `/api/invites/${code}/accept`,
    acceptBody({ email: CLIENT_EMAIL }),
  );
  assert.equal(accepted.status, 200, accepted.text);

  // The client asks for the deletion of his account on the account page.
  const client = clientEnv.page;
  await client.goto(`${srv.origin}/account.html`);
  await shown(client, "#app");
  const before = Date.now();
  await client.fill("#del-password", CLIENT_PASSWORD);
  await client.click("#del-submit");
  await client.waitForFunction(
    () =>
      (document.getElementById("del-note")?.textContent ?? "").trim() !== "",
    null,
    { timeout: 15000 },
  );
  const after = Date.now();
  // The times between the click and the answer, minute by minute: the page's time is one of them.
  const wanted = new Set([astana(before), astana(after)]);
  for (let ms = before; ms < after; ms += 30_000) wanted.add(astana(ms));
  const note = (await client.textContent("#del-note")) ?? "";
  assert.ok(
    [...wanted].some((w) => note.includes(w)),
    `the note shows a time of ${[...wanted].join(" or ")}: ${note}`,
  );
  found.add("account page", await shownTextFindings(client, "ru"));

  // The admin deletion page lists it, with the same time.
  const admin = adminEnv.page;
  await admin.goto(`${srv.origin}/admin-deletions.html`);
  await shown(admin, "#list .row .when");
  const when = ((await admin.textContent("#list .row .when")) ?? "").trim();
  assert.match(when, /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
  assert.ok(
    wanted.has(when),
    `the list shows a time of ${[...wanted].join(" or ")}: ${when}`,
  );
  assert.ok(
    note.includes(when),
    "the account page and the admin list show one time",
  );
  found.add("admin deletions page", await shownTextFindings(admin, "ru"));

  assert.deepEqual(found.lines(), []);
  assert.deepEqual(problemsOf(adminEnv, srv.origin), []);
  assert.deepEqual(problemsOf(clientEnv, srv.origin), []);
});
