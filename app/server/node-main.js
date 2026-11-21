import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { SOURCE_LANGS } from "../public/shared/i18n/lang.js";
import { createApp } from "./app.js";
import { ConfigError, nodeFloorRefusal, readConfig } from "./config.js";
import { openRuntimeDb } from "./db/index.js";
import { defaultMigrationsDir, readMigrations } from "./db/migrate.js";
import { originsFor } from "./http/origin.js";
import { loadIntake } from "./routes/demo.js";
import { loadStaticSite } from "./static.js";

// The Node and Docker entry (ARCH §0, §3): prints the app URL on 127.0.0.1 and the preview URL on
// localhost (same port); exits on an unsafe database role; stays alive when the database is down, and
// when the demo intake is missing or broken (both demo routes then answer 503). It serves the local set:
// the demo answers in every language of the source.

const SELFCHECK_DEADLINE_MS = 4000;
const STOP_LIMIT_MS = 3000;

/** @param {string} line */
const fail = (line) => {
  process.stderr.write(`${line}\n`);
  process.exit(1);
};

async function main() {
  if (process.env.NODE_ENV === "production") {
    const refusal = nodeFloorRefusal(process.version);
    if (refusal) fail(refusal);
  }
  let config;
  try {
    config = readConfig(process.env);
  } catch (err) {
    if (err instanceof ConfigError) fail(`sai: refused: ${err.message}`);
    throw err;
  }
  const site = loadStaticSite();
  const intake = loadIntake();
  if (!intake.ok)
    process.stderr.write(
      "sai: the demo intake is missing or broken; /api/demo answers 503\n",
    );
  const migrations = readMigrations(
    config.migrationsDir ?? defaultMigrationsDir(),
  ).map(({ name, sha256 }) => ({ name, sha256 }));
  const db = config.siteGate
    ? null
    : await openRuntimeDb(config, { connectTimeoutMs: SELFCHECK_DEADLINE_MS });
  if (db) {
    /** @type {NodeJS.Timeout | undefined} */
    let timer;
    const verdict = await Promise.race([
      db.ensureSafe().then(
        () => "ok",
        (/** @type {any} */ err) =>
          err?.code === "E_DB_ROLE" ? "unsafe" : "down",
      ),
      new Promise((r) => {
        timer = setTimeout(() => r("down"), SELFCHECK_DEADLINE_MS);
      }),
    ]);
    clearTimeout(timer);
    if (verdict === "unsafe")
      fail(
        "sai: refused: the database role of the app is a superuser or bypasses row security",
      );
    if (verdict === "down")
      process.stderr.write(
        "sai: the database does not answer; the pages are served and /api/health answers 503\n",
      );
  }
  const server = createServer();
  server.listen(config.port, config.host, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const origins = originsFor(config, port);
    const app = createApp({
      config,
      origins,
      db,
      site,
      migrations,
      log: (e) => process.stdout.write(`${JSON.stringify(e)}\n`),
      demo: { intake, langs: SOURCE_LANGS },
    });
    server.on("request", getRequestListener(app.fetch));
    process.stdout.write(
      `http://127.0.0.1:${port}/\nhttp://localhost:${port}/\n`,
    );
  });
  const stop = () => {
    server.close();
    server.closeIdleConnections();
    const t = setTimeout(() => process.exit(0), STOP_LIMIT_MS);
    t.unref();
    Promise.resolve(db?.close())
      .catch(() => {})
      .finally(() => server.closeAllConnections());
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

await main();
