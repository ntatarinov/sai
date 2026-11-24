import { makeKeys } from "../auth/keys.js";
import { passwords as defaultPasswords } from "../auth/password.js";
import { REAUTH_HEADER, consumeReauthToken } from "../auth/reauth.js";
import { cookieName, readCookie, readLiveSession } from "../auth/sessions.js";
import { touchSession } from "../db/auth-store.js";
import { TX_DEADLINE_MS } from "../db/index.js";
import { switchToTenant, withPlatform } from "../db/tx.js";
import { csrfEqual, isJsonType, originAllowed } from "./csrf.js";
import { HttpError } from "./errors.js";
import { countRequest, maybeCleanup } from "./rate-limit.js";
import { bodyShapeOf, parseBody } from "./schema.js";

// The request pipeline of the routes that use the session cookie or a rate limit (REQ-114, REQ-115; the code
// design M2AUTH, 4.7). Every step runs in ONE platform transaction on one connection with the request's
// deadline (C3, C17): the session read, every check, the counters, the re-auth consumption and the handler's
// action. A refusal that must be counted is returned by the handler (its counters commit); every other
// refusal is thrown (the transaction rolls back, so the state is unchanged). A tenant route's transaction is
// switched to tenant settings after the checks and before its handler (9b).

/** @typedef {import("../db/index.js").Q} Q */
/** @typedef {import("../auth/sessions.js").Session} Session */
/** @typedef {import("../auth/keys.js").Keys} Keys */
/** @typedef {import("../auth/password.js").Hasher} Hasher */

/**
 * What the app is given for accounts (the code design M2AUTH, 4.7): the pepper and the setup hash (from the
 * configuration), the clock (ms since epoch), the random source of the lazy cleanup, the hasher, and the
 * deadline of a request transaction (tests set a small one).
 * @typedef {object} AuthDeps
 * @property {Buffer | null} pepper
 * @property {string | null} setupTokenHash
 * @property {() => number} [clock]
 * @property {() => number} [random]
 * @property {Hasher} [passwords]
 * @property {number} [txDeadlineMs]
 */

/**
 * The context the pipeline and the auth and admin handlers share.
 * @typedef {object} AuthContext
 * @property {Keys | null} keys null without a pepper (every such route answers 503 server_config)
 * @property {Hasher} passwords
 * @property {string | null} setupTokenHash
 * @property {string} appOrigin
 * @property {string | null} cookieName null when APP_ORIGIN allows no cookie (503 server_config)
 * @property {() => number} clock
 * @property {() => number} random
 * @property {number} txDeadlineMs
 */

/**
 * @param {AuthDeps | undefined} auth
 * @param {string} appOrigin
 * @returns {AuthContext}
 */
export function authContext(auth, appOrigin) {
  const pepper = auth?.pepper ?? null;
  return {
    keys: pepper ? makeKeys(pepper) : null,
    passwords: auth?.passwords ?? defaultPasswords,
    setupTokenHash: auth?.setupTokenHash ?? null,
    appOrigin,
    cookieName: cookieName(appOrigin),
    clock: auth?.clock ?? (() => Date.now()),
    random: auth?.random ?? (() => Math.random()),
    txDeadlineMs: auth?.txDeadlineMs ?? TX_DEADLINE_MS,
  };
}

/**
 * @param {AuthContext} ctx
 * @returns {Keys}
 */
export function keysOf(ctx) {
  if (!ctx.keys) throw new HttpError("server_config");
  return ctx.keys;
}

/**
 * What a handler of the pipeline gets (4.7): for a tenant route `q` is already under tenant settings.
 * @typedef {object} PipelineRequest
 * @property {URLSearchParams} query
 * @property {Record<string, string>} body the checked body (an empty object for GET)
 * @property {Record<string, string>} params
 * @property {Headers} headers
 * @property {string | null} clientIp
 * @property {number} now the clock time of the request, ms since epoch
 * @property {Session | null} session
 * @property {Q} q
 * @property {string | null} reauthId
 */

/**
 * @typedef {object} PipelineRoute
 * @property {Readonly<{ tenant: boolean, admin: boolean, reauth: string | null, worker: boolean, session: boolean, rateLimit: "setup" | "login" | "reset" | "user" | null }>} meta
 * @property {(req: PipelineRequest) => RouteAnswer | Promise<RouteAnswer>} handler
 */

/** @typedef {{ status: number, body: unknown, headers?: Array<[string, string]> }} RouteAnswer */

/**
 * Whether a route takes the pipeline: it uses the session cookie or has a rate limit. Other routes (demo,
 * health) take the path of today unchanged.
 * @param {{ meta: Partial<PipelineRoute["meta"]> }} route
 * @returns {boolean}
 */
export const takesPipeline = (route) =>
  route.meta.session === true ||
  (route.meta.rateLimit !== null && route.meta.rateLimit !== undefined);

/**
 * Runs one request of a pipeline route. Throws HttpError for a thrown refusal and DbError for a database
 * failure (both after the rollback); answers the handler's RouteAnswer after the commit.
 * @param {AuthContext} ctx
 * @param {import("../db/index.js").Db | null} db
 * @param {PipelineRoute} route
 * @param {{ method: string, headers: Headers, query: URLSearchParams, params: Record<string, string>, bodyBytes: Uint8Array, clientIp: string | null, startedAt: number, noteActor: (kind: "user" | "admin") => void }} req
 * @returns {Promise<RouteAnswer>}
 */
export async function runPipeline(ctx, db, route, req) {
  const meta = route.meta;
  const token = readCookie(req.headers.get("cookie"), ctx.cookieName);
  // 0a: an admin route without a session cookie answers the uniform 404 before any statement.
  if (meta.admin && token === null) throw new HttpError("not_found");
  // 0: accounts configured.
  if (!ctx.keys || !ctx.cookieName) throw new HttpError("server_config");
  if (!db) throw new HttpError("db_unavailable");
  const keys = ctx.keys;
  const now = ctx.clock();
  const write = req.method !== "GET" && req.method !== "HEAD";
  return withPlatform(
    db,
    async (q) => {
      // 1: the session, read only; an unknown, expired or malformed cookie reads as no session.
      const session = token ? await readLiveSession(q, keys, token, now) : null;
      if (session) req.noteActor(session.isAdmin ? "admin" : "user");
      // 2: admin routes answer the uniform 404 to everyone but the platform admin.
      if (meta.admin && !session?.isAdmin) throw new HttpError("not_found");
      // 3-5: Origin, media type and the CSRF token of the session routes.
      if (write && meta.session) {
        if (!originAllowed(req.headers, ctx.appOrigin))
          throw new HttpError("origin_refused");
        if (!isJsonType(req.headers)) throw new HttpError("unsupported_type");
        if (session && !csrfEqual(req.headers.get("x-sai-csrf"), session.csrf))
          throw new HttpError("csrf_refused");
      }
      // 6: a signed-in user.
      if ((meta.tenant || meta.rateLimit === "user") && !session)
        throw new HttpError("auth_required");
      // 7: the rate limit.
      if (meta.rateLimit) {
        const subject =
          meta.rateLimit === "user"
            ? /** @type {Session} */ (session).id
            : (req.clientIp ?? "unknown");
        await countRequest(q, keys.mac, meta.rateLimit, subject, now);
      }
      // 8: the re-auth token of the route's purpose.
      /** @type {string | null} */
      let reauthId = null;
      if (meta.reauth !== null) {
        reauthId = session
          ? await consumeReauthToken(
              q,
              keys,
              req.headers.get(REAUTH_HEADER),
              session,
              meta.reauth,
              now,
            )
          : null;
        if (reauthId === null) throw new HttpError("reauth_required");
      }
      // 9: the body.
      const body = write ? parseBody(req.bodyBytes, bodyShapeOf(route)) : {};
      // 9b: a tenant route runs its handler under tenant settings of the session's organisation.
      if (meta.tenant) {
        const orgId = /** @type {Session} */ (session).orgId;
        if (orgId === null) throw new HttpError("not_found");
        await switchToTenant(q, orgId);
      }
      // 10: the handler, with the query of this transaction.
      /** @type {PipelineRequest} */
      const pr = {
        query: req.query,
        body,
        params: req.params,
        headers: req.headers,
        clientIp: req.clientIp,
        now,
        session,
        q,
        reauthId,
      };
      const answer = await route.handler(pr);
      // 11: the session was used (the only column a GET changes); no row when the handler ended it.
      if (session) await touchSession(q, session.id, now);
      // 12: the lazy cleanup.
      await maybeCleanup(q, now, ctx.random);
      return answer;
    },
    { deadlineAt: req.startedAt + ctx.txDeadlineMs },
  );
}
