import { Hono } from "hono";
import { PUBLIC_LANGS } from "../public/shared/i18n/lang.js";
import { DbError } from "./db/index.js";
import { authContext, runPipeline, takesPipeline } from "./http/auth-mw.js";
import { readBody } from "./http/body.js";
import { normalise } from "./http/client-ip.js";
import { errorBody, HttpError, UNIFORM_404 } from "./http/errors.js";
import { API_CACHE, securityHeaders } from "./http/headers.js";
import { isPreviewHost } from "./http/origin.js";
import { newRequestId } from "./http/request-id.js";
import { loadIntake } from "./routes/demo.js";
import { routeTable } from "./routes/index.js";

// createApp(deps): the one Hono app of the Node server, Docker and the Vercel function (ARCH §0, §2).
// Order: request id and log → headers → site gate (no database) → body limit → preview host → routes →
// static files. The routes that use the session cookie or a rate limit take the request pipeline of
// http/auth-mw.js (the code design M2AUTH, 4.7); the others the path below as before.

// The Vercel entry imports only this file and config.js (ARCH §2.2), so the address rule is re-exported here.
export { vercelClientIp } from "./http/client-ip.js";

/**
 * @typedef {object} AppDeps
 * @property {{ siteGate: boolean, version: string, secretPepper?: Buffer | null, setupTokenHash?: string | null }} config
 * @property {import("./http/origin.js").Origins} origins
 * @property {import("./db/index.js").Db | null} db
 * @property {import("./static.js").StaticSite | null} site
 * @property {ReadonlyArray<{ name: string, sha256: string }>} migrations
 * @property {(entry: Record<string, unknown>) => void} log
 * @property {() => number} [now]
 * @property {{ intake: import("./routes/demo.js").Intake, langs: readonly string[] }} [demo] the intake and
 *   the languages of the two demo routes; without it their paths answer the uniform 404
 * @property {import("./http/auth-mw.js").AuthDeps} [auth] accounts; by default the pepper and the setup hash
 *   of the configuration, Date.now, Math.random and the scrypt hasher of auth/password.js
 * @property {(deps: Parameters<typeof routeTable>[0]) => ReadonlyArray<import("./routes/index.js").Route>} [routeTable]
 *   another route table (tests plant rows); by default the real one
 */

const JSON_TYPE = "application/json; charset=utf-8";

/**
 * The client address of a request (the code design M2AUTH, 4.7): the address the Vercel entry gives in the
 * env, else the socket address of the Node server, else null; normalised. No request header is read here.
 * @param {unknown} env
 * @returns {string | null}
 */
function clientIpOf(env) {
  if (env === null || typeof env !== "object") return null;
  const e =
    /** @type {{ clientIp?: unknown, incoming?: { socket?: { remoteAddress?: unknown } } }} */ (
      env
    );
  if (Object.hasOwn(e, "clientIp")) return normalise(e.clientIp);
  return normalise(e.incoming?.socket?.remoteAddress);
}

/**
 * @param {AppDeps} deps
 */
export function createApp(deps) {
  const now = deps.now ?? (() => performance.now());
  // The router matches the raw path: the same text that the middlewares below read for /api and that the
  // static map looks up (never decoded). Hono's own getPath decodes it, so `/%61pi/health` would reach the
  // health handler while the app classifies it as a page: no `Cache-Control: no-store`, and an answer that
  // tells an existing route from a missing one. Route parameters are still decoded by `c.req.param()`.
  /** @type {Hono<{ Variables: { tag: { route: string, code?: string, actor?: "user" | "admin" }, body: Uint8Array } }>} */
  const app = new Hono({ getPath: (req) => new URL(req.url).pathname });
  const auth = authContext(
    deps.auth ?? {
      pepper: deps.config.secretPepper ?? null,
      setupTokenHash: deps.config.setupTokenHash ?? null,
    },
    deps.origins.app,
  );
  const routes = (deps.routeTable ?? routeTable)({
    db: deps.db,
    migrations: deps.migrations,
    version: deps.config.version,
    demo: deps.demo,
    auth,
  });

  app.use("*", async (c, next) => {
    const started = now();
    const reqId = newRequestId();
    /** @type {{ route: string, code?: string, actor?: "user" | "admin" }} */
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
    if (tag.actor) line.actor_kind = tag.actor;
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

  /**
   * @param {any} c
   * @param {{ status: number, body: unknown, headers?: Array<[string, string]> }} out
   */
  const answer = (c, out) => {
    const body = /** @type {{ error?: unknown }} */ (out.body);
    if (out.status >= 400 && body && typeof body.error === "string")
      c.get("tag").code = body.error;
    const res = json(c, out.status, JSON.stringify(out.body));
    for (const [name, value] of out.headers ?? [])
      if (name === "Set-Cookie" || name === "Retry-After")
        res.headers.append(name, value);
    return res;
  };

  for (const r of routes) {
    if (takesPipeline(r)) {
      app.on(r.method, r.path, async (c) => {
        const startedAt = performance.now();
        const tag = c.get("tag");
        tag.route = r.path;
        try {
          const out = await runPipeline(auth, deps.db, r, {
            method: c.req.method,
            headers: c.req.raw.headers,
            query: new URL(c.req.url).searchParams,
            params: c.req.param(),
            bodyBytes: c.get("body"),
            clientIp: clientIpOf(c.env),
            startedAt,
            noteActor: (kind) => {
              tag.actor = kind;
            },
          });
          return answer(c, out);
        } catch (err) {
          // A thrown refusal after the rollback: its status and stable code (and Retry-After for a 429);
          // a database failure: 503 db_unavailable, or 500 server_error for a failed statement. No cookie
          // is set on any of them. Any other exception goes to onError (500).
          if (err instanceof HttpError) {
            tag.code = err.code;
            const res = json(c, err.status, errorBody(err.code));
            if (err.retryAfter !== undefined)
              res.headers.set("Retry-After", String(err.retryAfter));
            return res;
          }
          if (err instanceof DbError) {
            const code =
              err.code === "E_DB_QUERY" ? "server_error" : "db_unavailable";
            tag.code = code;
            return json(
              c,
              code === "server_error" ? 500 : 503,
              errorBody(code),
            );
          }
          throw err;
        }
      });
      continue;
    }
    app.on(r.method, r.path, async (c) => {
      const tag = c.get("tag");
      tag.route = r.path;
      let out;
      try {
        out = await r.handler({
          query: new URL(c.req.url).searchParams,
          body: c.get("body"),
        });
      } catch (err) {
        // A refusal of the handler: its status and its stable code, as the body limit answers above;
        // any other exception goes to onError.
        if (!(err instanceof HttpError)) throw err;
        tag.code = err.code;
        return json(c, err.status, errorBody(err.code));
      }
      return answer(c, out);
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
 * no static files (the platform serves app/public), origins from the configuration only, and the demo in
 * the public languages only (REQ-111 criterion 9 (g)).
 * @param {import("./config.js").Config} config
 * @param {{ adapter?: import("./db/index.js").Adapter, log?: (entry: Record<string, unknown>) => void, intake?: import("./routes/demo.js").Intake }} [inject]
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
    demo: { intake: inject.intake ?? loadIntake(), langs: PUBLIC_LANGS },
  });
}
