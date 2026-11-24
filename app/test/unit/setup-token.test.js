import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { APP, childEnv, tempDir } from "../fixtures/helpers.js";

// REQ-114 criterion 2, the script (the code design M2AUTH, 4.16): `node scripts/setup-token.js` prints a
// token and its sha256 and writes nothing.

const SCRIPT = path.join(APP, "scripts", "setup-token.js");

/** @param {string} cwd @param {string[]} [args] */
const run = (cwd, args = []) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    env: childEnv(),
    encoding: "utf8",
    timeout: 20000,
  });

test("STK-1 setup-token.js in an empty folder exits 0, prints exactly a 43-character base64url token and the 64-hex sha256 of it, two runs differ, the folder stays empty; an argument is refused", (t) => {
  const dir = tempDir(t);
  const tokens = [];
  for (let i = 0; i < 2; i++) {
    const r = run(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, "");
    const m = /^([A-Za-z0-9_-]{43})\n([0-9a-f]{64})\n$/.exec(r.stdout);
    assert.ok(m, JSON.stringify(r.stdout));
    assert.equal(Buffer.from(m[1], "base64url").length, 32);
    assert.equal(
      m[2],
      crypto.createHash("sha256").update(m[1], "utf8").digest("hex"),
      "the second line is the sha256 of the first",
    );
    tokens.push(m[1]);
  }
  assert.notEqual(tokens[0], tokens[1]);
  assert.deepEqual(fs.readdirSync(dir), []);
  const refused = run(dir, ["--out", "x"]);
  assert.equal(refused.status, 2);
  assert.equal(refused.stdout, "");
  assert.equal(refused.stderr, "setup-token: refused: no argument is taken\n");
  assert.deepEqual(fs.readdirSync(dir), []);
});
