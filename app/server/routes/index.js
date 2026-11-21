import { demoRoutes } from "./demo.js";
import { healthHandler } from "./health.js";

// The route table (ARCH §13): method, path and metadata of every /api route. The two demo routes of the
// public landing come first when the app is given the demo (the code design of the public landing, 4.7),
// then the health route; without the demo their paths answer the uniform 404.

/**
 * What a handler gets: the query of the address and the body the app has read (empty for no body).
 * @typedef {{ query: URLSearchParams, body: Uint8Array }} RouteRequest
 */

/**
 * What a handler answers: the status and the body, which the app writes as JSON.
 * @typedef {{ status: number, body: unknown }} RouteAnswer
 */

/**
 * A row of the route table. A handler answers a RouteAnswer, or throws an HttpError, which the app answers
 * with its status and its code.
 * @typedef {object} Route
 * @property {string} method
 * @property {string} path
 * @property {Readonly<{ tenant: boolean }>} meta
 * @property {(req: RouteRequest) => RouteAnswer | Promise<RouteAnswer>} handler
 */

/**
 * @param {Parameters<typeof healthHandler>[0] & { demo?: Parameters<typeof demoRoutes>[0] }} deps
 * @returns {ReadonlyArray<Route>}
 */
export function routeTable(deps) {
  return Object.freeze([
    ...(deps.demo ? demoRoutes(deps.demo) : []),
    Object.freeze({
      method: "GET",
      path: "/api/health",
      meta: Object.freeze({ tenant: false }),
      handler: healthHandler(deps),
    }),
  ]);
}
