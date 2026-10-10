// ST: .claude/settings.json, tools/README.md and tools/package.json
// (design 10.2; REQ-001 criteria 1, 7, 10, 11, 12, 13, 14).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { DEFAULT_PORT } from "../src/pixel-office/config.js";
import { HOOK_EVENTS } from "../src/pixel-office/public/schema.js";
import { SETTINGS, SRC, TOOLS } from "./pixel-office-helpers.js";

const settingsText = fs.readFileSync(SETTINGS, "utf8");
const settings = JSON.parse(settingsText);

function handlers() {
  const out = [];
  for (const [event, groups] of Object.entries(settings.hooks)) {
    for (const group of groups) {
      for (const h of group.hooks) out.push({ event, group, h });
    }
  }
  return out;
}

test("ST-01: hooks are exactly HOOK_EVENTS; command type, no async, timeout 3-5; matcher Agent only on PostToolUse; the guard names hook.sh", () => {
  assert.deepEqual(Object.keys(settings.hooks).sort(), [...HOOK_EVENTS].sort());
  for (const { event, group, h } of handlers()) {
    assert.equal(h.type, "command", event);
    assert.equal(Object.hasOwn(h, "async"), false, event);
    assert.ok(h.timeout >= 3 && h.timeout <= 5, `${event}: ${h.timeout}`);
    if (event === "PostToolUse") assert.equal(group.matcher, "Agent");
    else assert.equal(Object.hasOwn(group, "matcher"), false, event);
    assert.ok(
      h.args.some((a) => a.includes("${CLAUDE_PROJECT_DIR}")),
      event,
    );
    assert.ok(
      h.args.some((a) => a.includes("tools/src/pixel-office/hook.sh")),
      event,
    );
  }
  assert.equal(handlers().length, HOOK_EVENTS.length);
  assert.ok(fs.existsSync(path.join(SRC, "hook.sh")));
});

test("ST-02: the only top-level key is hooks", () => {
  assert.deepEqual(Object.keys(settings), ["hooks"]);
});

test("ST-03: the file holds no secret - no run of 40 or more characters of [A-Za-z0-9_-]", () => {
  assert.equal(/[A-Za-z0-9_-]{40,}/.test(settingsText), false);
});

test("ST-04: the command of every handler writes the mark sai-pixel-office to stderr first", () => {
  for (const { event, h } of handlers()) {
    const script = h.args[h.args.indexOf("-c") + 1];
    assert.ok(
      script.startsWith("echo sai-pixel-office >&2;"),
      `${event}: ${script.slice(0, 40)}`,
    );
  }
});

test("ST-05: every handler with pixel-office has a timeout of 3-5 s, and there are such handlers (the JS form of the jq check of criterion 10)", () => {
  const mine = handlers().filter(({ h }) =>
    JSON.stringify(h).includes("pixel-office"),
  );
  assert.ok(mine.length > 0);
  assert.equal(
    mine.every(({ h }) => (h.timeout ?? 0) >= 3 && (h.timeout ?? 0) <= 5),
    true,
  );
});

test("ST-06: the README has the 14 lines of criterion 13 and the link; its port is DEFAULT_PORT; no old phrases", () => {
  const readme = fs.readFileSync(path.join(TOOLS, "README.md"), "utf8");
  const required = [
    "## Pixel Office",
    "npm run pixel-office",
    "~/.sai-pixel-office/",
    "https://code.claude.com/docs/en/settings",
    "в настройках которых есть обработчики Pixel Office",
    "при копии обработчиков",
    "https://code.claude.com/docs/en/hooks",
    "### Ограничения",
    "остаться «в работе»",
    "учётная запись",
    "одной вписанной строки",
    "навсегда",
    "## Проверка",
    "npm run check",
  ];
  assert.equal(required.length, 14);
  for (const line of required) {
    assert.ok(readme.includes(line), `README lacks: ${line}`);
  }
  assert.ok(readme.includes("http://127.0.0.1:"));
  // The port of Pixel Office is checked where it is written: in the section
  // «## Pixel Office», up to the next heading «## » (design REQ-011 r3, 1.2, F3;
  // other sections, such as the one of Sai Team, have their own ports).
  const start = readme.indexOf("\n## Pixel Office\n");
  assert.ok(start !== -1);
  const rest = readme.slice(start + 1);
  const next = rest.indexOf("\n## ", 1);
  const pixel = next === -1 ? rest : rest.slice(0, next);
  const ports = [...pixel.matchAll(/http:\/\/127\.0\.0\.1:(\d+)/g)].map((m) =>
    Number(m[1]),
  );
  assert.ok(ports.length >= 1);
  for (const p of ports) assert.equal(p, DEFAULT_PORT);
  for (const old of ["новые сверху", "например в соседней"]) {
    assert.equal(readme.includes(old), false, old);
  }
  assert.ok(readme.includes("новые внизу"));
});

test("ST-07: package.json has the script pixel-office to src/pixel-office/main.js and no dependencies", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(TOOLS, "package.json"), "utf8"),
  );
  assert.match(pkg.scripts["pixel-office"], /src\/pixel-office\/main\.js/);
  assert.equal(Object.hasOwn(pkg, "dependencies"), false);
});
