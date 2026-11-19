import { Hono } from "hono";
import { readBody } from "./http/body.js";
import { errorBody, HttpError, UNIFORM_404 } from "./http/errors.js";
import { API_CACHE, securityHeaders } from "./http/headers.js";
import { isPreviewHost } from "./http/origin.js";
import { newRequestId } from "./http/request-id.js";
import { routeTable } from "./routes/index.js";

// createApp(deps): the one Hono app of the Node server, Docker and the Vercel function (ARCH §0, §2).
// Order: request id and log → headers → site gate (no database) → body limit → preview host → routes →
// static files.

/**
 * @typedef {object} AppDeps
 * @property {{ siteGate: boolean, version: string }} config
 * @property {import("./http/origin.js").Origins} origins
 * @property {import("./db/index.js").Db | null} db
 * @property {import("./static.js").StaticSite | null} site
 * @property {ReadonlyArray<{ name: string, sha256: string }>} migrations
 * @property {(entry: Record<string, unknown>) => void} log
 * @property {() => number} [now]
 */

const JSON_TYPE = "application/json; charset=utf-8";

/**
 * @param {AppDeps} deps
 */
export function createApp(deps) {
  const now = deps.now ?? (() => performance.now());
  // The router matches the raw path: the same text that the middlewares below read for /api and that the
  // static map looks up (never decoded). Hono's own getPath decodes it, so `/%61pi/health` would reach the
  // health handler while the app classifies it as a page: no `Cache-Control: no-store`, and an answer that
  // tells an existing route from a missing one. Route parameters are still decoded by `c.req.param()`.
  /** @type {Hono<{ Variables: { tag: { route: string, code?: string }, body: Uint8Array } }>} */
  const app = new Hono({ getPath: (req) => new URL(req.url).pathname });
  const routes = routeTable({
    db: deps.db,
    migrations: deps.migrations,
    version: deps.config.version,
  });

  app.use("*", async (c, next) => {
    const started = now();
    const reqId = newRequestId();
    /** @type {{ route: string, code?: string }} */
    const tag = { route: "unknown" };
    c.set("tag", tag);
    await next();
    const url = new URL(c.req.url);
    const res = c.res;
    for (const [n, v] of securityHeaders({ https: url.protocol === "https:" }))
      res.headers.set(n, v);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/"))
      res.headers.set(API_CACHE[0], API_CACHE[1]);
    res.headers.set("X-Request-Id", reqId);
    res.headers.delete("Server");
    res.headers.delete("X-Powered-By");
    /** @type {Record<string, unknown>} */
    const line = {
      ts: new Date().toISOString(),
      level: "info",
      req_id: reqId,
      route: tag.route,
      status: res.status,
      ms: Math.round(now() - started),
    };
    if (tag.code) line.code = tag.code;
    deps.log(line);
  });

  const json = (
    /** @type {any} */ c,
    /** @type {number} */ status,
    /** @type {string} */ text,
  ) => c.body(text, /** @type {any} */ (status), { "Content-Type": JSON_TYPE });
  const html = (
    /** @type {any} */ c,
    /** @type {number} */ status,
    /** @type {Uint8Array} */ bytes,
  ) =>
    c.body(bytes, /** @type {any} */ (status), {
      "Content-Type": "text/html; charset=utf-8",
    });
  const isApi = (/** @type {string} */ p) =>
    p === "/api" || p.startsWith("/api/");

  app.use("*", async (c, next) => {
    const tag = c.get("tag");
    const path = new URL(c.req.url).pathname;
    if (deps.config.siteGate) {
      tag.route = "gate";
      if (isApi(path) || !deps.site)
        return json(c, 503, errorBody("site_closed"));
      return html(c, 503, deps.site.gate.bytes);
    }
    try {
      c.set(
        "body",
        c.req.raw.body ? await readBody(c.req.raw) : new Uint8Array(0),
      );
    } catch (err) {
      if (err instanceof HttpError) {
        tag.route = "body";
        tag.code = err.code;
        return json(c, err.status, errorBody(err.code));
      }
      throw err;
    }
    const url = new URL(c.req.url);
    if (isPreviewHost(url, deps.origins)) {
      if (path.startsWith("/api/p/")) {
        tag.route = "api_404";
        return json(c, 404, UNIFORM_404);
      }
      tag.route = "preview_redirect";
      // The origin of Location is always the configured app origin: the request path is set as the
      // path of that origin, never resolved against it (a path that starts with `//` would name
      // another host), and Host or X-Forwarded-Host is never read.
      const location = new URL(deps.origins.app);
      location.pathname = path;
      location.search = url.search;
      return c.body(null, 307, { Location: location.href });
    }
    return next();
  });

  for (const r of routes) {
    app.on(r.method, r.path, async (c) => {
      c.get("tag").route = r.path;
      const out = await r.handler();
      return json(c, out.status, JSON.stringify(out.body));
    });
  }

  app.all("*", (c) => {
    const tag = c.get("tag");
    const path = new URL(c.req.url).pathname;
    if (isApi(path) || !deps.site) {
      tag.route = "api_404";
      return json(c, 404, UNIFORM_404);
    }
    const file =
      c.req.method === "GET" || c.req.method === "HEAD"
        ? deps.site.lookup(path)
        : null;
    if (file) {
      tag.route = "static";
      return c.body(file.bytes, 200, { "Content-Type": file.type });
    }
    tag.route = "static_404";
    return html(c, 404, deps.site.notFound.bytes);
  });

  app.onError((_err, c) => {
    const tag = c.get("tag");
    if (tag) tag.code = "server_error";
    return json(c, 500, errorBody("server_error"));
  });
  return app;
}

/**
 * The app of the Vercel function: the database by the runtime URL (no statement before the selfcheck),
 * no static files (the platform serves app/public), origins from the configuration only.
 * @param {import("./config.js").Config} config
 * @param {{ adapter?: import("./db/index.js").Adapter, log?: (entry: Record<string, unknown>) => void }} [inject]
 */
export async function createFunctionApp(config, inject = {}) {
  const { createDb } = await import("./db/index.js");
  const { readMigrations, defaultMigrationsDir } =
    await import("./db/migrate.js");
  const { originsFor } = await import("./http/origin.js");
  let db = null;
  if (!config.siteGate) {
    if (inject.adapter) db = createDb(inject.adapter);
    else if (config.databaseUrl) {
      const { createPgAdapter } = await import("./db/pg.js");
      db = createDb(
        createPgAdapter(config.databaseUrl, { connectTimeoutMs: 4000 }),
      );
    }
  }
  const migrations = readMigrations(defaultMigrationsDir()).map(
    ({ name, sha256 }) => ({ name, sha256 }),
  );
  const log =
    inject.log ??
    ((/** @type {Record<string, unknown>} */ e) =>
      process.stdout.write(`${JSON.stringify(e)}\n`));
  return createApp({
    config,
    origins: originsFor(config, null),
    db,
    site: null,
    migrations,
    log,
  });
}
