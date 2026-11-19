// The one security header set (ARCH §14.1, REQ-109 criterion 4). vercel.json repeats the https set.

/** @type {ReadonlyArray<readonly [string, string]>} */
const BASE = Object.freeze([
  [
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  ],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "no-referrer"],
  [
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  ],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["X-Robots-Tag", "noindex"],
]);

const HSTS = /** @type {const} */ ([
  "Strict-Transport-Security",
  "max-age=31536000",
]);

/**
 * @param {{ https: boolean }} request
 * @returns {Array<[string, string]>}
 */
export function securityHeaders({ https }) {
  const list = BASE.map(([n, v]) => /** @type {[string, string]} */ ([n, v]));
  if (https) list.splice(1, 0, [HSTS[0], HSTS[1]]);
  return list;
}

/** Added to every /api answer. */
export const API_CACHE = /** @type {const} */ (["Cache-Control", "no-store"]);
