import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { run } from "../../scripts/uat-login.js";
import { sha256Hex } from "../fixtures/auth.js";
import {
  APP,
  childEnv,
  request,
  startNode,
  tempDir,
} from "../fixtures/helpers.js";

// REQ-114 criterion 11 (the code design M2AUTH, 4.17; decisions/0135 О2, 0137 О4 and Addition 4 SEC F3): the UAT
// login script against a local server on port 0 with an owner identity made by setup. On POSIX the success
// path and the mode cases run; on win32 the script takes the branch the design names (it refuses, the file
// modes cannot be checked) and every other refusal is still checked. No case is skipped.

const SCRIPT = path.join(APP, "scripts", "uat-login.js");
const POSIX = process.platform !== "win32";
const WIN32_LINE =
  "uat-login: refused: file permissions cannot be checked on Windows; run it on Linux or macOS\n";
const IDENTITY = {
  email: "Uat.Owner@Example.test",
  password: "uat-owner-pass-Z9",
};

/** A server of node-main with setup done for the owner identity. @param {import("node:test").TestContext} t */
async function server(t) {
  const token = crypto.randomBytes(32).toString("base64url");
  const s = startNode(t, {
    PORT: "0",
    SECRET_PEPPER: crypto.randomBytes(32).toString("base64url"),
    SETUP_TOKEN_HASH: sha256Hex(token),
  });
  const port = await s.ready;
  const base = `http://127.0.0.1:${port}`;
  const r = await request(port, "/api/auth/setup", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      email: IDENTITY.email,
      name: "Uat Owner",
      password: IDENTITY.password,
    }),
  });
  assert.equal(r.status, 201);
  return { s, port, base };
}

/** A secret file with mode 0600 in a folder outside the repository. @param {string} dir */
function secretFile(
  dir,
  content = JSON.stringify(IDENTITY),
  name = "identity.json",
) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

/** @param {string[]} args @param {Record<string, string>} env */
function spawnScript(args, env) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [SCRIPT, ...args], {
      cwd: APP,
      env: childEnv(env),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (err += d));
    c.on("exit", (code) => resolve({ code, out, err }));
  });
}

/**
 * One refusal: exit 1, exactly one line «uat-login: refused: …», nothing on stdout, no file at --out, the secret
 * file unchanged.
 * @param {{ code: number, out: string, err: string }} r
 * @param {string} out
 * @param {string | null} secret
 * @param {string} before the sha256 of the secret file before the run (or "")
 * @param {RegExp} reason
 */
function refusedLine(r, out, secret, before, reason) {
  assert.equal(r.code, 1, r.err);
  assert.equal(r.out, "");
  assert.match(r.err, /^uat-login: refused: [^\n]+\n$/);
  assert.match(r.err, reason);
  assert.ok(!fs.existsSync(out), "no file at --out");
  if (secret && fs.existsSync(secret))
    assert.equal(sha256Hex(fs.readFileSync(secret, "utf8")), before);
}

test("UL-1 the script signs in with the secret file, writes one session-state file at --out and prints only its path; its output holds neither the password nor the token (on win32: the named refusal)", async (t) => {
  const { base, port } = await server(t);
  const dir = tempDir(t);
  const secret = secretFile(dir);
  const out = path.join(dir, "state.json");
  const r = /** @type {{ code: number, out: string, err: string }} */ (
    await spawnScript(["--base", base, "--out", out], {
      SAI_UAT_IDENTITY_FILE: secret,
    })
  );
  if (!POSIX) {
    assert.equal(r.code, 1);
    assert.equal(r.err, WIN32_LINE);
    assert.equal(r.out, "");
    assert.ok(!fs.existsSync(out));
    return;
  }
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, `${out}\n`);
  assert.equal(r.err, "");
  const state = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.deepEqual(Object.keys(state).sort(), ["cookies", "origins"]);
  assert.deepEqual(state.origins, []);
  assert.equal(state.cookies.length, 1);
  const c = state.cookies[0];
  assert.deepEqual(Object.keys(c).sort(), [
    "domain",
    "expires",
    "httpOnly",
    "name",
    "path",
    "sameSite",
    "secure",
    "value",
  ]);
  assert.equal(c.name, "sai_s");
  assert.match(c.value, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(c.domain, "127.0.0.1");
  assert.equal(c.path, "/");
  assert.equal(c.httpOnly, true);
  assert.equal(c.secure, false);
  assert.equal(c.sameSite, "Lax");
  assert.ok(
    Math.abs(c.expires - (Math.floor(Date.now() / 1000) + 604800)) < 120,
  );
  assert.equal(fs.statSync(out).mode & 0o777, 0o600);
  for (const m of [IDENTITY.password, c.value, IDENTITY.email])
    assert.ok(!(r.out + r.err).includes(m));
  const me = await request(port, "/api/auth/me", {
    headers: { Cookie: `sai_s=${c.value}` },
  });
  assert.equal(me.status, 200, "the written session works");
});

test("UL-2 each refusal exits 1 with one line and writes no file: secret file inside the repository, a symbolic link (POSIX), missing, not the JSON form, a wrong password (POSIX), --out inside the repository or existing, bad arguments", async (t) => {
  const { base } = await server(t);
  const dir = tempDir(t);
  const secret = secretFile(dir);
  const good = sha256Hex(fs.readFileSync(secret, "utf8"));
  const out = path.join(dir, "state.json");
  const inRepo = fs.mkdtempSync(path.join(APP, "test", ".uat-"));
  t.after(() => fs.rmSync(inRepo, { recursive: true, force: true }));
  const repoSecret = secretFile(inRepo);
  /** @param {string[]} argv @param {Record<string, string | undefined>} env @param {RegExp} reason @param {string | null} [file] */
  const refused = async (argv, env, reason, file = secret, at = out) => {
    const before =
      file && fs.existsSync(file)
        ? sha256Hex(fs.readFileSync(file, "utf8"))
        : "";
    const r = await run({
      argv,
      env,
      platform: process.platform,
      fetch: (u, i) => fetch(u, i),
    });
    refusedLine(r, at, file, before, reason);
  };
  const args = ["--base", base, "--out", out];
  const env = { SAI_UAT_IDENTITY_FILE: secret };
  await refused(
    args,
    { SAI_UAT_IDENTITY_FILE: repoSecret },
    /inside the repository/,
    repoSecret,
  );
  await refused(
    args,
    { SAI_UAT_IDENTITY_FILE: path.join(dir, "missing.json") },
    /missing/,
  );
  await refused(args, {}, /SAI_UAT_IDENTITY_FILE is not set/);
  await refused(
    args,
    { SAI_UAT_IDENTITY_FILE: "identity.json" },
    /not an absolute path/,
  );
  await refused(args, { SAI_UAT_IDENTITY_FILE: dir }, /not a regular file/);
  await refused(
    ["--base", base, "--out", path.join(inRepo, "state.json")],
    env,
    /--out lies inside the repository/,
    secret,
    path.join(inRepo, "state.json"),
  );
  await refused(
    ["--base", base, "--out", path.join(APP, "uat-state.json")],
    env,
    /--out lies inside the repository/,
    secret,
    path.join(APP, "uat-state.json"),
  );
  fs.writeFileSync(path.join(dir, "exists.json"), "keep");
  const r = await run({
    argv: ["--base", base, "--out", path.join(dir, "exists.json")],
    env,
    platform: process.platform,
    fetch: (u, i) => fetch(u, i),
  });
  assert.equal(r.code, 1);
  assert.match(r.err, /^uat-login: refused: --out exists already\n$/);
  assert.equal(fs.readFileSync(path.join(dir, "exists.json"), "utf8"), "keep");
  await refused(
    ["--base", base, "--out", "state.json"],
    env,
    /--out is not an absolute path/,
    secret,
    path.join(APP, "state.json"),
  );
  await refused(
    ["--base", base, "--out", path.join(dir, "no-folder", "s.json")],
    env,
    /folder of --out does not exist/,
    secret,
    path.join(dir, "no-folder", "s.json"),
  );
  for (const b of [
    "http://example.test",
    "http://localhost:1",
    `${base}/api`,
    "https://user:pw@sai.example",
    "ftp://sai.example",
    "https://sai.example/?x=1",
  ])
    await refused(["--base", b, "--out", out], env, /--base is not/);
  for (const a of [
    [],
    ["--base", base],
    ["--out", out, "--out", out],
    ["--base", base, "--out", out, "--x"],
  ])
    await refused(a, env, /usage/);
  if (POSIX) {
    for (const content of [
      "not json",
      "[]",
      JSON.stringify({ email: IDENTITY.email }),
      JSON.stringify({ ...IDENTITY, extra: 1 }),
      JSON.stringify({ email: 1, password: "x" }),
    ])
      await refused(
        args,
        {
          SAI_UAT_IDENTITY_FILE: secretFile(
            dir,
            content,
            `bad-${sha256Hex(content).slice(0, 6)}.json`,
          ),
        },
        /not JSON \{email, password\}/,
        null,
      );
    await refused(
      args,
      {
        SAI_UAT_IDENTITY_FILE: secretFile(
          dir,
          JSON.stringify({ ...IDENTITY, password: "a-wrong-uat-pass-1" }),
          "wrong.json",
        ),
      },
      /the login was refused/,
      null,
    );
    const link = path.join(dir, "link.json");
    fs.symlinkSync(secret, link);
    await refused(args, { SAI_UAT_IDENTITY_FILE: link }, /symbolic link/);
    // SEC F3: a link swapped in after the lstat of a regular file is refused (the open does not follow it).
    const realLstat = fs.lstatSync;
    const swapped = secretFile(dir, JSON.stringify(IDENTITY), "swapped.json");
    /** @type {any} */ (fs).lstatSync = /** @type {any} */ (
      (/** @type {fs.PathLike} */ p, /** @type {any} */ o) => {
        const st = realLstat(p, o);
        if (String(p) === swapped && !fs.existsSync(`${swapped}.real`)) {
          fs.renameSync(swapped, `${swapped}.real`);
          fs.symlinkSync(`${swapped}.real`, swapped);
        }
        return st;
      }
    );
    try {
      await refused(
        args,
        { SAI_UAT_IDENTITY_FILE: swapped },
        /symbolic link/,
        null,
      );
    } finally {
      /** @type {any} */ (fs).lstatSync = realLstat;
    }
  } else {
    // On win32 the script refuses before it reads the file, whatever the file holds.
    for (const content of [
      "not json",
      JSON.stringify({ ...IDENTITY, password: "a-wrong-uat-pass-1" }),
    ])
      await refused(
        args,
        {
          SAI_UAT_IDENTITY_FILE: secretFile(
            dir,
            content,
            `w-${sha256Hex(content).slice(0, 6)}.json`,
          ),
        },
        /cannot be checked on Windows/,
        null,
      );
  }
  assert.equal(sha256Hex(fs.readFileSync(secret, "utf8")), good);
});

test('UL-3 the mode of the secret file: 0640 and 0604 are refused and 0600 works (POSIX); the win32 branch refuses through run({ platform: "win32" })', async (t) => {
  const { base } = await server(t);
  const dir = tempDir(t);
  const fetchIt = (/** @type {string} */ u, /** @type {RequestInit} */ i) =>
    fetch(u, i);
  // The win32 branch, on every system: exit 1, the one line, no file.
  const winSecret = secretFile(dir, JSON.stringify(IDENTITY), "win.json");
  const winOut = path.join(dir, "win-state.json");
  const w = await run({
    argv: ["--base", base, "--out", winOut],
    env: { SAI_UAT_IDENTITY_FILE: winSecret },
    platform: "win32",
    fetch: fetchIt,
  });
  assert.deepEqual(w, { code: 1, out: "", err: WIN32_LINE });
  assert.ok(!fs.existsSync(winOut));
  if (!POSIX) return;
  for (const mode of [0o640, 0o604, 0o644, 0o660, 0o606, 0o700 | 0o004]) {
    const file = secretFile(
      dir,
      JSON.stringify(IDENTITY),
      `m${mode.toString(8)}.json`,
    );
    fs.chmodSync(file, mode);
    const before = sha256Hex(fs.readFileSync(file, "utf8"));
    const out = path.join(dir, `state-${mode.toString(8)}.json`);
    const r = await run({
      argv: ["--base", base, "--out", out],
      env: { SAI_UAT_IDENTITY_FILE: file },
      platform: process.platform,
      fetch: fetchIt,
    });
    refusedLine(r, out, file, before, /can be read by group or others/);
  }
  for (const mode of [0o600, 0o400]) {
    const file = secretFile(
      dir,
      JSON.stringify(IDENTITY),
      `ok${mode.toString(8)}.json`,
    );
    fs.chmodSync(file, mode);
    const out = path.join(dir, `ok-${mode.toString(8)}.json`);
    const r = await run({
      argv: ["--base", base, "--out", out],
      env: { SAI_UAT_IDENTITY_FILE: file },
      platform: process.platform,
      fetch: fetchIt,
    });
    assert.equal(r.code, 0, r.err);
    assert.equal(r.out, `${out}\n`);
    assert.ok(fs.existsSync(out));
  }
});

test("UL-4 the script starts no child process and reads no Keychain: the grep of the criterion finds nothing, and finds the planted import in a copy", () => {
  const RULE = /node:child_process|find-generic-password/;
  const src = fs.readFileSync(SCRIPT, "utf8");
  const hits = src.split("\n").filter((l) => RULE.test(l));
  assert.deepEqual(hits, []);
  const planted = `import cp from "node:child_process";\n${src}`;
  assert.equal(planted.split("\n").filter((l) => RULE.test(l)).length, 1);
  const keychain = src.replace(
    "const LOGIN_TIMEOUT_MS",
    "// security find-generic-password -s sai\nconst LOGIN_TIMEOUT_MS",
  );
  assert.equal(keychain.split("\n").filter((l) => RULE.test(l)).length, 1);
  assert.doesNotMatch(src, /\bchild_process\b|\bexecSync\b|\bspawn\(/);
});
