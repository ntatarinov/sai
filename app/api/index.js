import { createFunctionApp } from "../server/app.js";
import { ConfigError, readConfig } from "../server/config.js";

// The Vercel entry (decisions/0116 О4): one function behind the rewrite /api/:path* → /api/index?__p=:path*.
// It restores the path from __p, keeps the other query parameters and calls the app. Its shape (a default
// export with fetch) is confirmed by spike S1.

const SEGMENT = /^[A-Za-z0-9._~-]+$/;
const MAX_P = 2048;

/**
 * @param {URL} url
 * @returns {string | null} the restored path, or null when __p is not one clean relative path
 */
export function restorePath(url) {
  const all = url.searchParams.getAll("__p");
  if (all.length !== 1) return null;
  const p = all[0];
  if (p.length === 0 || p.length > MAX_P) return null;
  const parts = p.split("/");
  for (const s of parts)
    if (!SEGMENT.test(s) || s === "." || s === "..") return null;
  return `/api/${parts.join("/")}`;
}

/**
 * @param {() => Promise<{ fetch: (r: Request) => Response | Promise<Response> }>} makeApp
 */
export function createEntry(makeApp) {
  /** @type {Promise<{ fetch: (r: Request) => Response | Promise<Response> }> | null} */
  let appPromise = null;
  return {
    /** @param {Request} request */
    async fetch(request) {
      let app;
      try {
        // makeApp may throw before it returns a promise (readConfig runs first in the default export),
        // so the call stands inside the try: a ConfigError always becomes the 503 below.
        appPromise ??= makeApp();
        app = await appPromise;
      } catch (err) {
        appPromise = null;
        if (!(err instanceof ConfigError)) throw err;
        process.stdout.write(
          `${JSON.stringify({ ts: new Date().toISOString(), level: "error", route: "entry", status: 503, code: err.code })}\n`,
        );
        return new Response(JSON.stringify({ error: "server_config" }), {
          status: 503,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
      const url = new URL(request.url);
      if (url.pathname !== "/api/index") return app.fetch(request);
      const path = restorePath(url);
      const target = new URL(url.origin);
      target.pathname = path ?? "/api/index";
      for (const [k, v] of url.searchParams)
        if (k !== "__p") target.searchParams.append(k, v);
      const hasBody = request.method !== "GET" && request.method !== "HEAD";
      return app.fetch(
        new Request(
          target,
          /** @type {RequestInit} */ ({
            method: request.method,
            headers: request.headers,
            body: hasBody ? request.body : null,
            duplex: "half",
          }),
        ),
      );
    },
  };
}

export default createEntry(() => createFunctionApp(readConfig(process.env)));
