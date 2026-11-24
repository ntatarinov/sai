import { adminRoutes } from "./admin.js";
import { authRoutes } from "./auth.js";
import { demoRoutes } from "./demo.js";
import { healthHandler } from "./health.js";

// The route table (ARCH §13; REQ-115 criterion 6; the code design M2AUTH, 4.4): method, path and metadata of
// every /api route. The two demo routes of the public landing come first when the app is given the demo (the
// code design of the public landing, 4.7), then the health route, then the auth and admin routes; without the
// demo their paths answer the uniform 404. The routes whose `session` is true or whose `rateLimit` is not null
// take the request pipeline of server/http/auth-mw.js; the others the path of the app as before.

/**
 * The metadata of a route: exactly these six keys.
 * - tenant: the route reads or writes tenant data of the session's organisation (a signed-in user);
 * - admin: only the platform admin; everyone else gets the uniform 404 before any other check;
 * - reauth: the re-auth purpose the route consumes, or null;
 * - worker: a worker route (lane B); false for every route of M2.2;
 * - session: the route uses the session cookie and falls under the CSRF rule of REQ-114 criterion 4;
 * - rateLimit: the limit of the route (server/http/rate-limit.js); "user" also needs a signed-in user.
 * @typedef {Readonly<{ tenant: boolean, admin: boolean, reauth: string | null, worker: boolean, session: boolean, rateLimit: "setup" | "login" | "reset" | "user" | null }>} RouteMeta
 */

/**
 * What a handler of the demo and health routes gets: the query of the address and the bytes of the body, as
 * before. The routes of the pipeline get PipelineRequest of server/http/auth-mw.js (the checked body as an
 * object, params, headers, clientIp, now, session, the query `q` of the request transaction, reauthId).
 * @typedef {{ query: URLSearchParams, body: Uint8Array }} RouteRequest
 */

/**
 * What a handler answers: the status, the body, which the app writes as JSON, and at most the headers
 * Set-Cookie and Retry-After.
 * @typedef {{ status: number, body: unknown, headers?: Array<[string, string]> }} RouteAnswer
 */

/**
 * A row of the route table: exactly the keys method, path, meta and handler. A handler answers a RouteAnswer,
 * or throws an HttpError, which the app answers with its status and its code.
 * @typedef {object} Route
 * @property {string} method
 * @property {string} path
 * @property {RouteMeta} meta
 * @property {(req: any) => RouteAnswer | Promise<RouteAnswer>} handler
 */

/** @type {RouteMeta} */
const PUBLIC_META = Object.freeze({
  tenant: false,
  admin: false,
  reauth: null,
  worker: false,
  session: false,
  rateLimit: null,
});

/**
 * @param {Parameters<typeof healthHandler>[0] & { demo?: Parameters<typeof demoRoutes>[0], auth: import("../http/auth-mw.js").AuthContext }} deps
 * @returns {ReadonlyArray<Route>}
 */
export function routeTable(deps) {
  return Object.freeze([
    ...(deps.demo ? demoRoutes(deps.demo) : []),
    Object.freeze({
      method: "GET",
      path: "/api/health",
      meta: PUBLIC_META,
      handler: healthHandler(deps),
    }),
    ...authRoutes(deps.auth),
    ...adminRoutes(deps.auth),
  ]);
}
