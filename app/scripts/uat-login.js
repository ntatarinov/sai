import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// uat-login (REQ-114 criterion 11, AC2.6 part; decisions/0135 О2; the code design M2AUTH, 4.17):
//   node scripts/uat-login.js --base <origin> --out <file>
// reads the e-mail and the password in-process from the secret file named by SAI_UAT_IDENTITY_FILE, signs in
// at <origin>, writes one session-state file of the browser kit at <file> (mode 0600, never over an existing
// file) and prints only its path. Each refusal is exit 1 with one line on stderr, and no file is written. The
// secret file must be a regular file outside the repository that only its owner can read, opened once without
// following a link and checked and read on that descriptor; on Windows the
// mode cannot be checked, so the script refuses there (fail closed, decisions/0137 О4). It starts no other
// process and reads no keychain.

const LOGIN_TIMEOUT_MS = 10000;
const LOCAL_ORIGIN = /^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/;
const USAGE = "usage: uat-login.js --base <origin> --out <file>";

/** The folder above app/: the root of the repository. */
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @param {string} text
 * @returns {string | null} the origin, or null
 */
function originOf(text) {
  if (LOCAL_ORIGIN.test(text)) return text;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (url.pathname !== "/" || url.search || url.hash) return null;
  return url.origin === text || `${url.origin}/` === text ? url.origin : null;
}

/**
 * Whether `target` (whose nearest existing part is resolved by realpath) lies inside `root`.
 * @param {string} root
 * @param {string} target an absolute path
 * @returns {boolean}
 */
function inside(root, target) {
  let realRoot;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    realRoot = path.resolve(root);
  }
  let probe = target;
  /** @type {string[]} */
  const rest = [];
  for (;;) {
    try {
      probe = path.join(fs.realpathSync(probe), ...rest);
      break;
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) {
        probe = path.join(probe, ...rest);
        break;
      }
      rest.unshift(path.basename(probe));
      probe = parent;
    }
  }
  const rel = path.relative(realRoot, probe);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * @param {string[]} argv the arguments after the script
 * @returns {{ base: string, out: string } | null}
 */
function parseArgs(argv) {
  if (argv.length !== 4) return null;
  /** @type {Record<string, string>} */
  const got = {};
  for (let i = 0; i < 4; i += 2) {
    const k = argv[i];
    if ((k !== "--base" && k !== "--out") || k in got) return null;
    got[k] = argv[i + 1];
  }
  return { base: got["--base"], out: got["--out"] };
}

/**
 * The cookie of a Set-Cookie line: name, value and Max-Age.
 * @param {string} line
 * @returns {{ name: string, value: string, maxAge: number | null } | null}
 */
function cookieOf(line) {
  const [pair, ...attrs] = line.split(";");
  const at = pair.indexOf("=");
  if (at <= 0) return null;
  const name = pair.slice(0, at).trim();
  const value = pair.slice(at + 1).trim();
  if (name !== "__Host-sai_s" && name !== "sai_s") return null;
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  let maxAge = null;
  for (const a of attrs) {
    const m = /^\s*max-age\s*=\s*([0-9]+)\s*$/i.exec(a);
    if (m) maxAge = Number(m[1]);
  }
  return { name, value, maxAge };
}

/**
 * @param {{ argv: string[], env: Record<string, string | undefined>, platform: string, fetch: (url: string, init: RequestInit) => Promise<Response>, repoRoot?: string, now?: () => number }} o
 * @returns {Promise<{ code: number, out: string, err: string }>}
 */
export async function run({
  argv,
  env,
  platform,
  fetch,
  repoRoot = REPO_ROOT,
  now = () => Date.now(),
}) {
  const refuse = (/** @type {string} */ reason) => ({
    code: 1,
    out: "",
    err: `uat-login: refused: ${reason}\n`,
  });
  const args = parseArgs(argv);
  if (!args) return refuse(USAGE);
  const base = originOf(args.base);
  if (!base)
    return refuse("--base is not an https origin or http://127.0.0.1:<port>");
  if (!path.isAbsolute(args.out))
    return refuse("--out is not an absolute path");
  if (inside(repoRoot, args.out))
    return refuse("--out lies inside the repository");
  if (fs.existsSync(args.out)) return refuse("--out exists already");
  if (!fs.existsSync(path.dirname(args.out)))
    return refuse("the folder of --out does not exist");

  const file = env.SAI_UAT_IDENTITY_FILE;
  if (!file) return refuse("SAI_UAT_IDENTITY_FILE is not set");
  if (!path.isAbsolute(file))
    return refuse("SAI_UAT_IDENTITY_FILE is not an absolute path");
  /** @type {fs.Stats} */
  let st;
  try {
    st = fs.lstatSync(file);
  } catch {
    return refuse("the identity file is missing");
  }
  if (st.isSymbolicLink())
    return refuse("the identity file is a symbolic link");
  if (!st.isFile()) return refuse("the identity file is not a regular file");
  if (inside(repoRoot, file))
    return refuse("the identity file lies inside the repository");
  if (platform === "win32")
    return refuse(
      "file permissions cannot be checked on Windows; run it on Linux or macOS",
    );
  // One open that refuses a link (a file swapped for a link after the lstat above), then the checks and the
  // read on that descriptor only (decisions/0137 Addition 4, SEC F3).
  /** @type {number} */
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (err) {
    return refuse(
      /** @type {NodeJS.ErrnoException} */ (err).code === "ELOOP"
        ? "the identity file is a symbolic link"
        : "the identity file is missing",
    );
  }
  /** @type {string} */
  let text;
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile())
      return refuse("the identity file is not a regular file");
    if ((opened.mode & 0o077) !== 0)
      return refuse("the identity file can be read by group or others");
    text = fs.readFileSync(fd, "utf8");
  } catch {
    return refuse("the identity file is not readable");
  } finally {
    fs.closeSync(fd);
  }

  /** @type {{ email: string, password: string }} */
  let identity;
  try {
    const parsed = JSON.parse(text);
    const keys =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.keys(parsed).sort()
        : [];
    if (
      keys.join(",") !== "email,password" ||
      typeof parsed.email !== "string" ||
      typeof parsed.password !== "string"
    )
      return refuse("the identity file is not JSON {email, password}");
    identity = parsed;
  } catch {
    return refuse("the identity file is not JSON {email, password}");
  }

  /** @type {Response} */
  let res;
  try {
    res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: identity.email,
        password: identity.password,
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
    });
  } catch {
    return refuse("the login was refused");
  }
  const cookies = res.headers
    .getSetCookie()
    .map(cookieOf)
    .filter((c) => c);
  await res.body?.cancel().catch(() => {});
  if (res.status !== 200 || cookies.length !== 1)
    return refuse("the login was refused");
  const c =
    /** @type {{ name: string, value: string, maxAge: number | null }} */ (
      cookies[0]
    );
  const state = {
    cookies: [
      {
        name: c.name,
        value: c.value,
        domain: new URL(base).hostname,
        path: "/",
        expires: c.maxAge === null ? -1 : Math.floor(now() / 1000) + c.maxAge,
        httpOnly: true,
        secure: c.name.startsWith("__Host-"),
        sameSite: "Lax",
      },
    ],
    origins: [],
  };
  try {
    fs.writeFileSync(args.out, `${JSON.stringify(state, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
  } catch {
    return refuse("the session file cannot be written");
  }
  return { code: 0, out: `${args.out}\n`, err: "" };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const r = await run({
    argv: process.argv.slice(2),
    env: process.env,
    platform: process.platform,
    fetch: (url, init) => fetch(url, init),
  });
  process.stdout.write(r.out);
  process.stderr.write(r.err);
  process.exitCode = r.code;
}
