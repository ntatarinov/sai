import assert from "node:assert/strict";
import { test } from "node:test";
import { request, startNode, waitFor } from "../fixtures/helpers.js";

// REQ-108 criterion 10 (request id and logs).

const KEYS = [
  "ts",
  "level",
  "req_id",
  "route",
  "status",
  "ms",
  "actor_kind",
  "org_id",
  "job_id",
  "code",
];

test("LG-1 one JSON line per request, the request id, no personal data", async (t) => {
  const s = startNode(t, { PORT: "0" });
  const port = await s.ready;
  const a = await request(port, "/nope?t=QMARK1", {
    method: "POST",
    body: "BMARK2",
    headers: {
      Cookie: "c=CMARK3",
      Authorization: "Bearer AMARK4",
      "X-Forwarded-For": "203.0.113.7",
    },
  });
  const b = await request(port, "/api/health");
  const planted = await request(port, "/", {
    headers: { "X-Request-Id": "planted-id" },
  });
  assert.ok(
    a.headers["x-request-id"] &&
      a.headers["x-request-id"] !== b.headers["x-request-id"],
  );
  assert.ok(planted.headers["x-request-id"]);
  assert.notEqual(planted.headers["x-request-id"], "planted-id");
  const lines = () =>
    s
      .out()
      .split("\n")
      .filter((l) => l.startsWith("{"));
  await waitFor(() => lines().length >= 3, 5000, "three log lines");
  assert.equal(lines().length, 3);
  for (const l of lines())
    for (const k of Object.keys(JSON.parse(l))) assert.ok(KEYS.includes(k), k);
  assert.deepEqual(
    lines().map((l) => JSON.parse(l).req_id),
    [a, b, planted].map((r) => r.headers["x-request-id"]),
  );
  const all = s.out() + s.err();
  for (const m of [
    "QMARK1",
    "BMARK2",
    "CMARK3",
    "AMARK4",
    "203.0.113.7",
    "planted-id",
  ])
    assert.ok(!all.includes(m), m);
});
