import { parseOrigin } from "./http/origin.js";
import { gateClosed } from "./http/site-gate.js";

// The configuration of the app, read once from the environment (ARCH §19.3). Errors name the variable,
// never its value.

export const LOGIN_ROLE = "sai_app_login";

export class ConfigError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * @typedef {object} Config
 * @property {boolean} production
 * @property {number} port
 * @property {string} host
 * @property {string | null} databaseUrl the runtime URL (sai_app_login when APP_DB_PASSWORD is set)
 * @property {string | null} migrationUrl DATABASE_URL_UNPOOLED, else DATABASE_URL
 * @property {string | null} appDbPassword
 * @property {string | null} appOrigin
 * @property {string | null} previewOrigin
 * @property {string} version
 * @property {boolean} siteGate
 * @property {"info" | "debug"} logLevel
 * @property {string | null} pgliteDir
 * @property {string | null} migrationsDir
 */

/**
 * @param {string} text
 * @param {string} name
 * @returns {URL}
 */
function postgresUrl(text, name) {
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new ConfigError(
      "E_CONFIG_URL",
      `${name} is not a postgres:// address`,
    );
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
    throw new ConfigError(
      "E_CONFIG_URL",
      `${name} is not a postgres:// address`,
    );
  return url;
}

/**
 * The runtime URL: the host, port, database and query of DATABASE_URL with the login role and its
 * password (decisions/0116 О17). The password is encoded by encodeURIComponent: the URL setter alone
 * leaves `%` as it is, and the database client then reads another password (measured 2026-11-17).
 * @param {string} databaseUrl
 * @param {string} password
 * @returns {string}
 */
export function runtimeUrl(databaseUrl, password) {
  const url = postgresUrl(databaseUrl, "DATABASE_URL");
  url.username = LOGIN_ROLE;
  url.password = encodeURIComponent(password);
  return url.href;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Config}
 */
export function readConfig(env) {
  const production = env.NODE_ENV === "production";
  const raw = (/** @type {string} */ name) => {
    const v = env[name];
    return typeof v === "string" && v !== "" ? v : null;
  };
  const portText = raw("PORT") ?? "0";
  if (!/^\d{1,5}$/.test(portText) || Number(portText) > 65535)
    throw new ConfigError("E_CONFIG_PORT", "PORT is not a port number");
  const databaseUrl = raw("DATABASE_URL");
  const unpooled = raw("DATABASE_URL_UNPOOLED");
  const password = raw("APP_DB_PASSWORD");
  const pgliteDir = raw("PGLITE_DIR");
  const migrationsDir = raw("MIGRATIONS_DIR");
  if (production && !databaseUrl)
    throw new ConfigError(
      "E_CONFIG_DATABASE_URL",
      "DATABASE_URL is required when NODE_ENV=production",
    );
  if (production && (pgliteDir || migrationsDir))
    throw new ConfigError(
      "E_CONFIG_TEST_ONLY",
      "PGLITE_DIR and MIGRATIONS_DIR are refused when NODE_ENV=production",
    );
  if (databaseUrl) postgresUrl(databaseUrl, "DATABASE_URL");
  if (unpooled) postgresUrl(unpooled, "DATABASE_URL_UNPOOLED");
  const appOrigin = raw("APP_ORIGIN");
  const previewOrigin = raw("PREVIEW_ORIGIN");
  if (appOrigin && !parseOrigin(appOrigin))
    throw new ConfigError("E_CONFIG_ORIGIN", "APP_ORIGIN is not an origin");
  if (previewOrigin && !parseOrigin(previewOrigin))
    throw new ConfigError("E_CONFIG_ORIGIN", "PREVIEW_ORIGIN is not an origin");
  const logLevel = raw("LOG_LEVEL") ?? "info";
  if (logLevel !== "info" && logLevel !== "debug")
    throw new ConfigError("E_CONFIG_LOG", "LOG_LEVEL is not info or debug");
  return {
    production,
    port: Number(portText),
    host: raw("HOST") ?? "127.0.0.1",
    databaseUrl:
      databaseUrl && password ? runtimeUrl(databaseUrl, password) : databaseUrl,
    migrationUrl: unpooled ?? databaseUrl,
    appDbPassword: password,
    appOrigin: appOrigin ? parseOrigin(appOrigin) : null,
    previewOrigin: previewOrigin ? parseOrigin(previewOrigin) : null,
    version: raw("APP_VERSION") ?? "dev",
    siteGate: gateClosed(env.SITE_GATE),
    logLevel,
    pgliteDir,
    migrationsDir,
  };
}

export const NODE_FLOOR = "22.23.4";

/**
 * The Node floor of the entry points (ARCH §3): null when the version is accepted, else one plain line.
 * Called only by server/node-main.js with NODE_ENV=production.
 * @param {string} version a process.version text such as v22.23.4
 * @returns {string | null}
 */
export function nodeFloorRefusal(version) {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const refuse = `sai: refused: Node ${version} is below the floor ${NODE_FLOOR} (Node 22.x, at least ${NODE_FLOOR})`;
  if (!m) return refuse;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (a !== 22) return refuse;
  if (b > 23 || (b === 23 && c >= 4)) return null;
  return refuse;
}
