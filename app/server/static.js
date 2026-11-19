import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The static files of app/public, read once at start into a map from URL path to bytes. A request path
// is looked up exactly and never joined to a folder, so no request can name a file outside the map.

const TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
});
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const FILE_LIMIT = 2 * 1024 * 1024;
const TOTAL_LIMIT = 8 * 1024 * 1024;

/** @typedef {{ bytes: Uint8Array<ArrayBuffer>, type: string }} StaticFile */
/** @typedef {{ lookup: (pathname: string) => StaticFile | null, notFound: StaticFile, gate: StaticFile }} StaticSite */

export const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));

/**
 * @param {string} dir
 * @returns {StaticSite}
 */
export function loadStaticSite(dir = PUBLIC_DIR) {
  /** @type {Map<string, StaticFile>} */
  const files = new Map();
  let total = 0;
  /** @param {string} abs @param {string} rel */
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!SEGMENT.test(entry.name)) continue;
      const childAbs = path.join(abs, entry.name);
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (entry.isFile()) {
        const type =
          TYPES[
            /** @type {keyof typeof TYPES} */ (
              path.extname(entry.name).toLowerCase()
            )
          ];
        if (!type) continue;
        const bytes = new Uint8Array(fs.readFileSync(childAbs));
        if (bytes.byteLength > FILE_LIMIT)
          throw new Error(
            `static: ${childRel} is larger than ${FILE_LIMIT} bytes`,
          );
        total += bytes.byteLength;
        files.set(childRel, { bytes, type });
      }
    }
  };
  walk(dir, "");
  if (total > TOTAL_LIMIT)
    throw new Error(`static: app/public is larger than ${TOTAL_LIMIT} bytes`);
  const need = (/** @type {string} */ p) => {
    const f = files.get(p);
    if (!f) throw new Error(`static: app/public${p} is missing`);
    return f;
  };
  const index = need("/index.html");
  return {
    lookup: (pathname) =>
      pathname === "/" ? index : (files.get(pathname) ?? null),
    notFound: need("/404.html"),
    gate: need("/gate.html"),
  };
}
