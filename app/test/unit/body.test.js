import assert from "node:assert/strict";
import { test } from "node:test";
import { readBody, readText } from "../../server/http/body.js";
import { errorBody, HttpError } from "../../server/http/errors.js";

// REQ-108 criterion 10 (body limits).

const req = (
  /** @type {Uint8Array} */ bytes,
  /** @type {boolean} */ declare = true,
) =>
  new Request("http://127.0.0.1/x", {
    method: "POST",
    body: bytes,
    headers: declare ? { "content-length": String(bytes.byteLength) } : {},
  });

test("BODY-1 65 536 bytes are accepted, 65 537 refused with 413 in the error shape", async () => {
  assert.equal((await readBody(req(new Uint8Array(65536)))).byteLength, 65536);
  for (const declare of [true, false]) {
    await assert.rejects(
      readBody(req(new Uint8Array(65537), declare)),
      (e) =>
        e instanceof HttpError &&
        e.status === 413 &&
        errorBody(e.code) === '{"error":"body_too_large"}',
    );
  }
});

test("BODY-2 bytes that are not UTF-8 are refused with 400", async () => {
  await assert.rejects(
    readText(req(new Uint8Array([0x61, 0xff, 0x62]))),
    (e) =>
      e instanceof HttpError &&
      e.status === 400 &&
      errorBody(e.code) === '{"error":"bad_encoding"}',
  );
  assert.equal(await readText(req(new TextEncoder().encode("ok ü"))), "ok ü");
});
