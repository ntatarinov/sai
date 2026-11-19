import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigError, readConfig } from "../../server/config.js";

// REQ-108 criterion 8 (decisions/0116 О17, О23). Values are built from parts at run time.

const part = (/** @type {string[]} */ ...xs) => xs.join("");
const OWNER_PW = part("own", "er", "-pw");
const APP_PW = part("Ap", "pPw", "-x@:/?#%y");
const owner = part(
  "postgres://",
  "owner_x",
  ":",
  OWNER_PW,
  "@",
  "db.example.test",
  ":6543",
  "/sai_db",
  "?sslmode=require&application_name=sai",
);

test("DBC-1 the runtime URL uses sai_app_login and APP_DB_PASSWORD with the same host, port, database and query", () => {
  const c = readConfig({ DATABASE_URL: owner, APP_DB_PASSWORD: APP_PW });
  const u = new URL(/** @type {string} */ (c.databaseUrl));
  assert.equal(u.username, "sai_app_login");
  assert.equal(decodeURIComponent(u.password), APP_PW);
  assert.equal(u.host, "db.example.test:6543");
  assert.equal(u.pathname, "/sai_db");
  assert.equal(u.search, "?sslmode=require&application_name=sai");
  assert.equal(c.migrationUrl, owner);
});

test("DBC-2 the migration URL is DATABASE_URL_UNPOOLED when set", () => {
  const unpooled = owner.replace("6543", "5432");
  const c = readConfig({
    DATABASE_URL: owner,
    DATABASE_URL_UNPOOLED: unpooled,
    APP_DB_PASSWORD: APP_PW,
  });
  assert.equal(c.migrationUrl, unpooled);
});

test("DBC-3 without APP_DB_PASSWORD the runtime URL is DATABASE_URL", () => {
  assert.equal(readConfig({ DATABASE_URL: owner }).databaseUrl, owner);
});

test("DBC-4 no error text holds a password", () => {
  const bad = [
    {
      DATABASE_URL: part("mysql://u:", OWNER_PW, "@h/d"),
      APP_DB_PASSWORD: APP_PW,
    },
    { DATABASE_URL: part("not a url ", OWNER_PW), APP_DB_PASSWORD: APP_PW },
    {
      DATABASE_URL: owner,
      DATABASE_URL_UNPOOLED: part("x", OWNER_PW),
      APP_DB_PASSWORD: APP_PW,
    },
    { NODE_ENV: "production", APP_DB_PASSWORD: APP_PW },
  ];
  for (const env of bad) {
    assert.throws(
      () => readConfig(env),
      (err) =>
        err instanceof ConfigError &&
        !err.message.includes(OWNER_PW) &&
        !err.message.includes(APP_PW) &&
        !err.message.includes("own"),
    );
  }
});

test("DBC-5 the defaults; PGLITE_DIR or MIGRATIONS_DIR with NODE_ENV=production is refused", () => {
  const c = readConfig({});
  assert.equal(c.host, "127.0.0.1");
  assert.equal(c.port, 0);
  assert.equal(c.version, "dev");
  assert.equal(c.logLevel, "info");
  assert.equal(c.siteGate, false);
  assert.equal(c.databaseUrl, null);
  for (const name of ["PGLITE_DIR", "MIGRATIONS_DIR"])
    assert.throws(
      () =>
        readConfig({
          NODE_ENV: "production",
          DATABASE_URL: owner,
          [name]: "a-test-folder",
        }),
      (err) =>
        err instanceof ConfigError &&
        err.code === "E_CONFIG_TEST_ONLY" &&
        err.message.includes(name),
      name,
    );
  assert.throws(
    () => readConfig({ NODE_ENV: "production", PGLITE_DIR: "a-test-folder" }),
    (err) => err instanceof ConfigError && err.code === "E_CONFIG_DATABASE_URL",
    "DATABASE_URL is checked first",
  );
  assert.equal(
    readConfig({ PGLITE_DIR: "a-test-folder", MIGRATIONS_DIR: "m" }).pgliteDir,
    "a-test-folder",
  );
});
