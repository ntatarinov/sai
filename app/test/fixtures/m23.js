import crypto from "node:crypto";

// Shared helpers of the tests of REQ-116 and REQ-117 (task M2.3, the code design M2PROJ, section 7), written by the
// lane «invites» and imported by both TEST-DESIGNER lanes. It adds to fixtures/auth.js and changes nothing there:
// the oracles here are the test's own (the consent sentences as literals, the HMAC of an invite code computed with
// node:crypto from the harness pepper), rows are planted by plain SQL, invites and accepts go through the real
// routes. A function takes the harness `h` of authHarness (fixtures/auth.js).
//
// File ownership of the two lanes (an existing file has one writer):
//   lane invites: int/invites.test.js, int/deletion.test.js, pg/owner-org.test.js, unit/consent.test.js, and in
//   existing files int/auth-reauth.test.js (RA-5 cases, purposes), int/rate-limit.test.js (RL-4, RL-5),
//   int/auth-session.test.js (SS-9), int/logging.test.js (LG-3), unit/forbidden-words.test.js (FW-8, FW-9),
//   unit/texts.test.js (TX-11, TX-12), fixtures/auth.js (TABLES, guard row G21) and this file.
//   lane projects: every other file of design sections 7 and 9 (route-table, isolation, permission-matrix and its
//   golden file, migrate, rls, npmrc, public-pages, public-build, vercel-build, security-invariants, m2-pages,
//   m2-race-pg, rehearsal seeds, the e2e path, projects, tenant-plan, admin-board, format-kz, project-stages).

/** The tables the refusal tests compare before and after (row counts and the sha256 of the rows). */
export const STATE_TABLES = Object.freeze([
  "audit_log",
  "deletion_requests",
  "idea_versions",
  "invites",
  "org_members",
  "orgs",
  "projects",
  "user_consents",
  "users",
]);

/** The tables that 0003 creates. */
export const NEW_TABLES = Object.freeze([
  "deletion_requests",
  "idea_versions",
  "projects",
  "user_consents",
]);

/**
 * The five consent sentences of each language, as the design fixes them (4.8): the test's own literals, so the
 * digest oracle does not read the code under test. ru and en are the text of REQ-116; kk is the draft of the
 * coding role.
 */
export const CONSENT = Object.freeze({
  ru: Object.freeze([
    "Я соглашаюсь на обработку моих данных, чтобы работать в Sai по приглашению.",
    "Данные: адрес почты, имя, хеш пароля, запись об этом согласии и HMAC-код IP-адреса.",
    "Данные хранятся до удаления учётной записи.",
    "Данные хранятся в Германии (Франкфурт); тексты для ИИ обрабатывает Anthropic в США.",
    "Согласие можно отозвать, а данные удалить по запросу в течение 15 рабочих дней.",
  ]),
  kk: Object.freeze([
    "Мен Sai жүйесінде шақыру бойынша жұмыс істеу үшін деректерімді өңдеуге келісемін.",
    "Деректер: пошта мекенжайы, аты, құпиясөз хэші, осы келісім туралы жазба және IP мекенжайының HMAC коды.",
    "Деректер есептік жазба жойылғанға дейін сақталады.",
    "Деректер Германияда (Франкфурт) сақталады; ЖИ мәтіндерін АҚШ-тағы Anthropic өңдейді.",
    "Келісімді қайтарып алуға болады, ал деректер сұраныс бойынша 15 жұмыс күні ішінде жойылады.",
  ]),
  en: Object.freeze([
    "I agree to the processing of my data so that I can work in Sai by invitation.",
    "Data: e-mail, name, password hash, this consent record and an HMAC code of the IP.",
    "The data is kept until the account is deleted.",
    "The data is stored in Germany (Frankfurt); texts for the AI are processed by Anthropic in the USA.",
    "I can withdraw consent, and the data is deleted on request within 15 working days.",
  ]),
});

/**
 * The sha256 (64 lower-case hex) of the five sentences of a language joined by one U+0020.
 * @param {"ru" | "kk" | "en"} lang
 */
export const consentSha = (lang) =>
  crypto
    .createHash("sha256")
    .update(CONSENT[lang].join(" "), "utf8")
    .digest("hex");

/** The invite code of a link `<origin>/invite.html#c=<code>`. @param {string} link */
export const codeOf = (link) => link.split("#c=")[1];

/**
 * HMAC-SHA256(pepper, "invite" + NUL + code), hex: the stored form of an invite code, computed by the test.
 * @param {Buffer} pepper
 * @param {string} code
 */
export const inviteHash = (pepper, code) =>
  crypto
    .createHmac("sha256", pepper)
    .update(`invite\u0000${code}`, "utf8")
    .digest("hex");

/** A password that satisfies the rules and is not in the common list. */
export const CLIENT_PASSWORD = "client-pass-9Zx2";

/**
 * A valid body of POST /api/admin/invites for a new customer organisation (owner identity true).
 * @param {Record<string, unknown>} [o]
 */
export const inviteBody = (o = {}) => ({
  email: "New.Client@Example.test",
  role: "org_owner",
  owner_identity: true,
  org_name: "Client Co",
  ...o,
});

/**
 * A valid body of POST /api/invites/:code/accept (ru consent, the invited e-mail in upper case).
 * @param {Record<string, unknown>} [o]
 */
export const acceptBody = (o = {}) => ({
  name: "Aigul K",
  email: "NEW.CLIENT@example.test",
  password: CLIENT_PASSWORD,
  consent: true,
  consent_sha256: consentSha("ru"),
  consent_lang: "ru",
  ...o,
});

/**
 * Creates an invite through the real route as the signed-in admin with a fresh `owner_identity` token (a
 * `reauth` of null sends none). The answer carries the code of the link when the call succeeded.
 * @param {import("./auth.js").AuthHarness} h
 * @param {import("./auth.js").Actor} admin
 * @param {Record<string, unknown>} [body] the body (default: inviteBody())
 * @param {{ reauth?: string | null }} [o]
 */
export async function createInvite(h, admin, body = inviteBody(), o = {}) {
  const reauth =
    o.reauth === undefined
      ? await h.reauthToken(admin, "owner_identity")
      : o.reauth;
  const r = await h.call("POST", "/api/admin/invites", {
    as: admin,
    reauth,
    body,
  });
  return Object.assign(r, {
    code: typeof r.json?.link === "string" ? codeOf(r.json.link) : null,
  });
}

/**
 * POST /api/invites/:code/accept from a client address (default 203.0.113.50; the actor in `o.as` is a signed-in
 * caller whose old session the accept ends).
 * @param {import("./auth.js").AuthHarness} h
 * @param {string} code
 * @param {Record<string, unknown>} [body]
 * @param {import("./auth.js").CallOptions} [o]
 */
export const acceptInvite = (h, code, body = acceptBody(), o = {}) =>
  h.call("POST", `/api/invites/${code}/accept`, {
    ip: "203.0.113.50",
    ...o,
    body,
  });

/**
 * An invite row planted by plain SQL (its code is the given 22 characters; the hash is computed here).
 * @param {import("./auth.js").AuthHarness} h
 * @param {{ code: string, email: string, createdBy: string, orgId?: string | null, orgName?: string | null, role?: string, ownerIdentity?: boolean, expiresAt?: number, usedAt?: number | null }} p
 * @returns {Promise<{ id: string, code: string }>}
 */
export async function plantInvite(h, p) {
  const orgId = p.orgId ?? null;
  const rows = await h.sql(
    "insert into invites (org_id, org_name, email_norm, role, owner_identity, code_hash, expires_at, used_at, created_by) values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9) returning id",
    [
      orgId,
      orgId === null ? (p.orgName ?? "Planted Co") : null,
      p.email.toLowerCase(),
      p.role ?? "member",
      p.ownerIdentity ?? true,
      inviteHash(h.pepper, p.code),
      new Date(p.expiresAt ?? h.now() + 86400000).toISOString(),
      p.usedAt === undefined || p.usedAt === null
        ? null
        : new Date(p.usedAt).toISOString(),
      p.createdBy,
    ],
  );
  return { id: rows[0].id, code: p.code };
}

/**
 * A client: the admin invites the e-mail into a new customer organisation, the accept signs him in; returns the
 * actor with his organisation id and a CSRF token.
 * @param {import("./auth.js").AuthHarness} h
 * @param {import("./auth.js").Actor} admin
 * @param {{ email?: string, orgName?: string, name?: string, ip?: string }} [o]
 * @returns {Promise<import("./auth.js").Actor>}
 */
export async function joinAsClient(h, admin, o = {}) {
  const email = o.email ?? "client@example.test";
  const made = await createInvite(
    h,
    admin,
    inviteBody({ email, org_name: o.orgName ?? "Client Co" }),
  );
  if (made.status !== 201 || made.code === null)
    throw new Error(`invite answered ${made.status} ${made.text}`);
  const ip = o.ip ?? "203.0.113.60";
  const r = await acceptInvite(
    h,
    made.code,
    acceptBody({ email, name: o.name ?? "Client" }),
    { ip },
  );
  if (r.status !== 200 || !r.cookie)
    throw new Error(`accept answered ${r.status} ${r.text}`);
  const row = (
    await h.sql(
      "select u.id, m.org_id from users u join org_members m on m.user_id = u.id where u.email_norm = $1",
      [email.toLowerCase()],
    )
  )[0];
  /** @type {import("./auth.js").Actor} */
  const actor = {
    id: row.id,
    email,
    password: CLIENT_PASSWORD,
    orgId: row.org_id,
    role: "org_owner",
    ip,
    cookie: r.cookie,
    csrf: null,
  };
  const me = await h.call("GET", "/api/auth/me", { as: actor, origin: null });
  if (me.status !== 200) throw new Error(`me answered ${me.status}`);
  actor.csrf = me.json.csrf;
  return actor;
}

/**
 * A project and its idea versions planted by plain SQL (the first version has no reason, every later one has the
 * given reason; versions are numbered from 1). Times are the injected clock.
 * @param {import("./auth.js").AuthHarness} h
 * @param {{ orgId: string, createdBy: string, title?: string, language?: "ru" | "en", stage?: string, versions?: Array<{ text: string, reason?: string }>, quickFacts?: Record<string, string> }} p
 * @returns {Promise<{ id: string }>}
 */
export async function addProject(h, p) {
  const at = new Date(h.now()).toISOString();
  const rows = await h.sql(
    "insert into projects (org_id, title, language, stage, created_by, created_at, updated_at) values ($1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz) returning id",
    [
      p.orgId,
      p.title ?? "A project",
      p.language ?? "ru",
      p.stage ?? "draft",
      p.createdBy,
      at,
    ],
  );
  const id = /** @type {string} */ (rows[0].id);
  const versions = p.versions ?? [{ text: "The first idea" }];
  for (const [i, v] of versions.entries())
    await h.sql(
      "insert into idea_versions (org_id, project_id, version, text, quick_facts, reason, created_by, created_at) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::timestamptz)",
      [
        p.orgId,
        id,
        i + 1,
        v.text,
        JSON.stringify(
          p.quickFacts ?? { what: "shop", whom: "customers", lang: "ru" },
        ),
        i === 0 ? null : (v.reason ?? "Changed"),
        p.createdBy,
        at,
      ],
    );
  return { id };
}

/**
 * The id of the owner organisation (made by setup).
 * @param {import("./auth.js").AuthHarness} h
 */
export async function ownerOrgId(h) {
  return /** @type {string} */ (
    (await h.sql("select id from orgs where kind = 'owner'"))[0].id
  );
}

/**
 * Runs SQL as the database owner (the test's own path for the one thing the app role cannot do) and returns to
 * the login role.
 * @param {import("./auth.js").AuthHarness} h
 * @param {string} sql
 */
export async function asOwner(h, sql) {
  await h.raw.exec("set session authorization postgres");
  try {
    await h.raw.exec(sql);
  } finally {
    await h.raw.exec("set session authorization sai_app_login");
  }
}

/**
 * Sets platform_settings.registration_mode (a JSON text) or removes the row (null).
 * @param {import("./auth.js").AuthHarness} h
 * @param {string | null} mode
 */
export async function setRegistrationMode(h, mode) {
  await asOwner(
    h,
    mode === null
      ? "delete from platform_settings where key = 'registration_mode'"
      : `insert into platform_settings (key, value) values ('registration_mode', '${JSON.stringify(mode)}'::jsonb) on conflict (key) do update set value = excluded.value`,
  );
}
