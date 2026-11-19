import { healthHandler } from "./health.js";

// The route table (ARCH §13): method, path and metadata of every /api route. M1 has one route.

/**
 * @param {Parameters<typeof healthHandler>[0]} deps
 */
export function routeTable(deps) {
  return Object.freeze([
    Object.freeze({
      method: "GET",
      path: "/api/health",
      meta: Object.freeze({ tenant: false }),
      handler: healthHandler(deps),
    }),
  ]);
}
