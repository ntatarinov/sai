import assert from "node:assert/strict";
import { test } from "node:test";
import { readApp } from "../fixtures/helpers.js";

// REQ-108 criterion 12 and REQ-109 criterion 6 (HEALTHCHECK).

/** @param {string} d @param {string} c @returns {string[]} */
export function dockerFindings(d, c) {
  const out = [];
  const lines = d.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  // The file starts with the FROM line itself (criterion 12): no comment or blank line before it.
  if (
    !/^FROM node:22\.23\.4-bookworm-slim@sha256:[0-9a-f]{64}$/.test(
      d.split("\n")[0],
    )
  )
    out.push("FROM");
  if (!lines.includes("RUN npm ci --omit=dev")) out.push("npm ci --omit=dev");
  const user = lines.find((l) => l.startsWith("USER "));
  if (!user || /^USER (root|0)(:|$)/.test(user)) out.push("USER");
  if (
    !lines.includes("ENV PORT=8080") ||
    !lines.includes("EXPOSE 8080") ||
    !lines.includes("ENV NODE_ENV=production")
  )
    out.push("PORT, EXPOSE, NODE_ENV");
  if (
    !lines.includes(
      'CMD ["sh", "-c", "node server/db/migrate.js && exec node server/node-main.js"]',
    )
  )
    out.push("CMD");
  if (!/^HEALTHCHECK .*\/api\/health/m.test(d)) out.push("HEALTHCHECK");
  const services = [...c.matchAll(/^ {2}([a-z]+):$/gm)].map((m) => m[1]);
  const svcBlock = c.split("\nvolumes:")[0];
  if (
    JSON.stringify(
      [...svcBlock.matchAll(/^ {2}([a-z]+):$/gm)].map((m) => m[1]),
    ) !== '["db","web"]'
  )
    out.push("services");
  if (!/image: postgres:17@sha256:[0-9a-f]{64}\n/.test(c)) out.push("db image");
  if (
    !/healthcheck:/.test(c.split("  web:")[0]) ||
    !/volumes:\n\s+- /.test(c.split("  web:")[0])
  )
    out.push("db volume and healthcheck");
  const web = c.split("  web:")[1] ?? "";
  if (
    !/build: \.\n/.test(web) ||
    !/PORT: "8080"/.test(web) ||
    !/APP_DB_PASSWORD: \$\{/.test(web) ||
    !/condition: service_healthy/.test(web)
  )
    out.push("web");
  for (const m of c.matchAll(/^\s+[A-Z_]*PASSWORD:\s*(\S+)\s*$/gm))
    if (!m[1].startsWith("${")) out.push("a password literal");
  for (const m of c.matchAll(/:\/\/[^:\s/@]+:(\S+?)@/g))
    if (!m[1].startsWith("${")) out.push("a password literal");
  void services;
  return out;
}

test("DF-1 the real Dockerfile and compose.yaml keep every rule", () => {
  assert.deepEqual(
    dockerFindings(
      readApp("Dockerfile").toString(),
      readApp("compose.yaml").toString(),
    ),
    [],
  );
});

test("DF-2 each damaged copy is red", () => {
  const d = readApp("Dockerfile").toString();
  const c = readApp("compose.yaml").toString();
  const cases = [
    [d.replace(/@sha256:[0-9a-f]{64}/, ""), c],
    [d.replace("USER node", "USER root"), c],
    [d.replace("USER node", "USER 0"), c],
    [d.replace("RUN npm ci --omit=dev", "RUN npm ci"), c],
    [d.replace(/^HEALTHCHECK.*$/m, ""), c],
    [
      d,
      c.replace(/POSTGRES_PASSWORD: \$\{[^}]*\}/, "POSTGRES_PASSWORD: hunter2"),
    ],
    [
      d,
      c.replace(
        "volumes:\n  db-data:",
        "  cache:\n    image: x\nvolumes:\n  db-data:",
      ),
    ],
  ];
  for (const [dd, cc] of cases) assert.notDeepEqual(dockerFindings(dd, cc), []);
});
