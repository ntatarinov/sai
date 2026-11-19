import { pathToFileURL } from "node:url";

// smoke (REQ-109 criterion 5, ARCH §16): checks a running site from outside. One line per check; exit 0
// when all pass, 1 when one fails, 2 on a wrong call. Redirects are never followed; 15 s in all.

const FLOOR = [22, 23, 4];
const TOTAL_MS = 12000;
const EACH_MS = 5000;

/**
 * @param {string} version
 * @returns {boolean}
 */
export function nodeAtFloor(version) {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) return false;
  const v = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (v[0] !== FLOOR[0]) return false;
  return v[1] > FLOOR[1] || (v[1] === FLOOR[1] && v[2] >= FLOOR[2]);
}

/**
 * The pure decision on the headers of `/`.
 * @param {Headers} h
 * @param {boolean} https
 * @returns {string[]} the failed checks
 */
export function headerFailures(h, https) {
  const out = [];
  const csp = h.get("content-security-policy");
  if (!csp || csp.includes("unsafe-inline")) out.push("csp");
  if (h.get("x-content-type-options") !== "nosniff") out.push("nosniff");
  if (h.get("x-frame-options") !== "DENY") out.push("x-frame-options");
  if (!h.get("referrer-policy")) out.push("referrer-policy");
  if (h.get("x-robots-tag") !== "noindex") out.push("x-robots-tag");
  if (h.has("x-powered-by")) out.push("x-powered-by");
  if (/\d/.test(h.get("server") ?? "")) out.push("server");
  if (
    https &&
    !(h.get("strict-transport-security") ?? "").includes("max-age=31536000")
  )
    out.push("hsts");
  return out;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isUniform404Body(text) {
  try {
    const v = JSON.parse(text);
    return (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      Object.keys(v).length === 1 &&
      typeof v.error === "string"
    );
  } catch {
    return false;
  }
}

/**
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (
      !["--base", "--preview", "--expect-version"].includes(k) ||
      argv[i + 1] === undefined
    )
      return null;
    o[k.slice(2)] = argv[i + 1];
  }
  if (!o.base) return null;
  for (const key of ["base", "preview"]) {
    if (!o[key]) continue;
    let u;
    try {
      u = new URL(o[key]);
    } catch {
      return null;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    o[key] = u.origin;
  }
  return o;
}

/**
 * @param {{ base: string, preview?: string, "expect-version"?: string }} o
 * @param {(line: string) => void} say
 * @param {() => string} [rand]
 * @returns {Promise<number>}
 */
export async function runSmoke(
  o,
  say,
  rand = () => Math.random().toString(36).slice(2, 10),
) {
  const signal = AbortSignal.timeout(TOTAL_MS);
  const get = (/** @type {string} */ url) =>
    fetch(url, {
      redirect: "manual",
      signal: AbortSignal.any([signal, AbortSignal.timeout(EACH_MS)]),
    });
  const https = o.base.startsWith("https:");
  let failed = 0;
  const check = (
    /** @type {string} */ name,
    /** @type {boolean} */ ok,
    /** @type {string} */ why = "",
  ) => {
    say(
      ok ? `smoke: ok ${name}` : `smoke: FAIL ${name}${why ? `: ${why}` : ""}`,
    );
    if (!ok) failed += 1;
  };
  try {
    const root = await get(`${o.base}/`);
    await root.arrayBuffer();
    check("/ 200", root.status === 200, `status ${root.status}`);
    const hf = headerFailures(root.headers, https);
    check("headers of /", hf.length === 0, hf.join(", "));
    const health = await get(`${o.base}/api/health`);
    const hb = await health.json().catch(() => null);
    check("/api/health 200", health.status === 200, `status ${health.status}`);
    check(
      "/api/health version",
      typeof hb?.version === "string" &&
        (!o["expect-version"] || hb.version === o["expect-version"]),
      "version",
    );
    check(
      "/api/health node",
      typeof hb?.node === "string" && nodeAtFloor(hb.node),
      `node ${hb?.node}`,
    );
    const nested = await get(`${o.base}/api/${rand()}/${rand()}`);
    const nb = await nested.text();
    check(
      "nested /api 404",
      nested.status === 404 &&
        (nested.headers.get("content-type") ?? "").startsWith(
          "application/json",
        ) &&
        isUniform404Body(nb),
      `status ${nested.status}`,
    );
    const random = await get(`${o.base}/${rand()}`);
    await random.arrayBuffer();
    check("random path 404", random.status === 404, `status ${random.status}`);
    if (o.preview) {
      const pr = await get(`${o.preview}/`);
      await pr.arrayBuffer();
      const loc = pr.headers.get("location");
      let origin = "";
      try {
        origin = loc ? new URL(loc, o.preview).origin : "";
      } catch {
        origin = "";
      }
      check(
        "preview 307",
        pr.status === 307 && origin === o.base,
        `status ${pr.status}`,
      );
    }
  } catch {
    say("smoke: FAIL the site did not answer");
    return 1;
  }
  return failed === 0 ? 0 : 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const o = parseArgs(process.argv.slice(2));
  if (!o) {
    process.stderr.write(
      "smoke: usage: node scripts/smoke.js --base <http(s) URL> [--preview <URL>] [--expect-version <v>]\n",
    );
    process.exitCode = 2;
  } else {
    process.exitCode = await runSmoke(/** @type {any} */ (o), (l) =>
      process.stdout.write(`${l}\n`),
    );
  }
}
