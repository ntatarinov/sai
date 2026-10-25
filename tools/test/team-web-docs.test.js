// REQ-011, criteria 12, 13 and 14 (design REQ-011, sections 11, 12, 14): the section
// of tools/README.md and the script of package.json; the decision about the place
// of the server before the code; the network only in the server and the page
// (WEB-12, WEB-13a, WEB-14).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { DEFAULT_PORT } from "../src/web/config.js";
import { REPO_ROOT, TOOLS_DIR } from "./exec-helpers.js";
import { WEB_SRC } from "./team-web-helpers.js";

const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

function section(text, title) {
  const start = text.indexOf(`\n${title}\n`);
  assert.ok(start !== -1, `no section ${title}`);
  const rest = text.slice(start + 1);
  const next = rest.slice(title.length).search(/\n## /);
  return next === -1 ? rest : rest.slice(0, title.length + next);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

test("WEB-12 tools/README.md has the section «## Sai Team — the interface»: how to start, the address with the link, that only this computer is listened to, the six questions, the rule of the due time, real runs and Ctrl-C; package.json has the script team-web", () => {
  const readme = read(TOOLS_DIR, "README.md");
  const s = section(readme, "## Sai Team — the interface");
  for (const line of [
    "npm run team-web",
    "127.0.0.1",
    `http://127.0.0.1:${DEFAULT_PORT}/`,
    "--port",
    "--executor scripted --scenario",
    "SAI_TEAM_REAL_RUNS=1",
    "The server listens only on `127.0.0.1`",
    "Что происходит",
    "Кто занимается",
    "Когда будет готово",
    "Есть ли проблема",
    "Нужно ли что-то от меня",
    "Результат",
    "### The rule of the term",
    "the median of durations",
    "срок пока не оценить",
    "примерно через X мин",
    "npm run team -- resume",
    "without percents",
  ]) {
    assert.ok(s.includes(line), `the section lacks: ${line}`);
  }
  // an example has no path of this computer
  assert.doesNotMatch(
    s,
    /\/Users\/|\/home\/[a-z]|C:\\\\|\/private\/var|\/tmp\//,
  );
  const pkg = JSON.parse(read(TOOLS_DIR, "package.json"));
  assert.equal(pkg.scripts["team-web"], "node src/web/main.js");
  assert.equal(pkg.dependencies, undefined);
  assert.match(pkg.scripts.test, /test\/\*\*\/\*\.test\.js/);
  // the tests of this requirement are in the run
  const mine = fs
    .readdirSync(path.join(TOOLS_DIR, "test"))
    .filter((f) => /^team-web-.*\.test\.js$/.test(f));
  assert.ok(mine.length >= 12, mine.join(", "));
});

test("WEB-13a the decision about the place of the server (decisions/0024) names tools/src/web/, 127.0.0.1, 0015 and REQ-013 and is in decisions/README.md as accepted; 0025 is there too", () => {
  const d = read(REPO_ROOT, "decisions", "0024-team-web-location.md");
  for (const s of ["tools/src/web/", "127.0.0.1", "0015", "REQ-013"]) {
    assert.ok(d.includes(s), s);
  }
  const index = read(REPO_ROOT, "decisions", "README.md");
  for (const n of ["0024", "0025"]) {
    const row = index.split("\n").find((l) => l.startsWith(`| [${n}]`));
    assert.ok(row !== undefined, n);
    assert.match(row, /\| Принято/, n);
  }
  assert.ok(
    fs.existsSync(path.join(REPO_ROOT, "decisions", "0025-team-web-server.md")),
  );
});

test("WEB-14 the network only in the server and the page: no network module and no fetch( in tools/src/team/; node:http only in web/server.js; no https, net, tls, dgram in tools/src/web/; one fetch( in public/ with relative paths only; main.js opens no network", () => {
  const NET = /node:(http|https|net|tls|dgram)|fetch[(]/;
  for (const f of walk(path.join(TOOLS_DIR, "src", "team"))) {
    assert.doesNotMatch(read(f), NET, f);
  }
  const web = walk(WEB_SRC);
  const http = web.filter((f) => read(f).includes("node:http"));
  assert.deepStrictEqual(
    http.map((f) => path.relative(WEB_SRC, f)),
    ["server.js"],
  );
  for (const f of web) {
    assert.doesNotMatch(read(f), /node:(https|net|tls|dgram)/, f);
  }
  const fetches = web.flatMap((f) =>
    [...read(f).matchAll(/fetch\(/g)].map(() => path.relative(WEB_SRC, f)),
  );
  assert.deepStrictEqual(fetches, [path.join("public", "app.js")]);
  const app = read(WEB_SRC, "public", "app.js");
  // the only fetch is inside request(path, init)
  const start = app.indexOf("async function request(path, init) {");
  const end = app.indexOf("\n}\n", start);
  assert.ok(start !== -1 && end !== -1);
  assert.match(app.slice(start, end), /window\.fetch\(path, \{/);
  // every constant address is relative
  for (const m of app.matchAll(/const (API_[A-Z_]+) = "([^"]*)";/g)) {
    assert.match(m[2], /^\/api(\/|$)/, m[1]);
  }
  for (const f of web.filter((x) =>
    x.includes(`${path.sep}public${path.sep}`),
  )) {
    assert.doesNotMatch(read(f), /https?:\/\//, f);
  }
  const main = read(WEB_SRC, "main.js");
  assert.doesNotMatch(main, /node:http|fetch\(/);
  const server = read(WEB_SRC, "server.js");
  assert.match(server, /server\.listen\(requestedPort, HOST\)/);
});
