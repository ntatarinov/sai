import assert from "node:assert/strict";
import { test } from "node:test";
import { securityHeaders } from "../../server/http/headers.js";
import { readApp } from "../fixtures/helpers.js";

// REQ-109 criterion 4: the list is written here, not read from the module.

const HTTPS = [
  [
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  ],
  ["Strict-Transport-Security", "max-age=31536000"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "no-referrer"],
  [
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  ],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["X-Robots-Tag", "noindex"],
];
const sorted = (/** @type {string[][]} */ l) =>
  l.map(([n, v]) => `${n}: ${v}`).sort();

/** @param {any} vercel */
export function vercelStatic(vercel) {
  const rule = (vercel.headers ?? []).find(
    (/** @type {any} */ h) => h.source === "/(.*)",
  );
  return rule
    ? rule.headers.map((/** @type {any} */ h) => [h.key, h.value])
    : [];
}

test("HP-1 the https set and the http set", () => {
  assert.deepEqual(sorted(securityHeaders({ https: true })), sorted(HTTPS));
  assert.deepEqual(
    sorted(securityHeaders({ https: false })),
    sorted(HTTPS.filter(([n]) => n !== "Strict-Transport-Security")),
  );
});

test("HP-2 vercel.json gives the static paths the same https set; damaged copies are red", () => {
  const v = JSON.parse(readApp("vercel.json").toString());
  assert.deepEqual(sorted(vercelStatic(v)), sorted(HTTPS));
  const one = structuredClone(v);
  one.headers[0].headers.pop();
  const inline = structuredClone(v);
  inline.headers[0].headers[0].value += "; script-src 'unsafe-inline'";
  const changed = structuredClone(v);
  changed.headers[0].headers[3].value = "SAMEORIGIN";
  for (const d of [one, inline, changed])
    assert.notDeepEqual(sorted(vercelStatic(d)), sorted(HTTPS));
});
