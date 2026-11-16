// Pixel Office in a real headless Chrome (REQ-106, criteria 1-7;
// docs/design/REQ-106-e2e-pixel-office.md, 4.4 and 8; decisions/0112). Every test
// makes its own two folders under the temporary root (the state folder and the home
// of the hook), starts its own server through the starter of the kit (its own home
// folder, the state folder given through stateEnv) and, where it opens the page, its
// own browser; it shares nothing with another test. Events reach the server only
// through the real hook program, run by runHook with three variables, both folders
// checked in the same call; the spec never writes the journal and never reads the
// real state folder. Every call that names the home folder of the person or the
// real state folder goes to a spawn that records it and throws (rule R2-S of the
// design, section 6). The oracles: the words of the requirement, the README tables
// (the words of the rows, the five files) and the table of role names that the
// requirement names; the code of the page is never read. Every wait is for a fact,
// with a limit. Run by `cd tools && npm run e2e -- pixel-office`.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  E2eError,
  assertUnderTempRoot,
  makeTempDir,
  removeTempDir,
  startStand,
  tempRoot,
  withBrowser,
  withStand,
} from "./kit/index.js";
// the data table of the plain role names that the requirement names (decision
// 0055; decisions/0112, О15): a table, not a rule of the page
import { ROLE_NAMES } from "../../src/pixel-office/public/texts.js";

const LIMIT = { timeout: 30000 };
const TOOLS = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const HOOK_LIMIT_MS = 10000;
// The words of the requirement (criteria 1, 2, 4, 6, 7).
const LIVE = "на связи";
const DOWN = "Нет связи с сервером Pixel Office";
const WORKING = "в работе";
const FINISHED = "закончила работу, итог не записан";
const MASK = "[скрыто]";
const COUNT = " · 3 из 3";
const NOW_WORD = "Сейчас";
const ROLE_A = "Sai Code Designer (CODE-DESIGNER)";
const ROLE_B = "Sai Test Runner (TEST-RUNNER)";
// invented ids; RELEASE-VALIDATOR searches the real journal for this prefix
const SESSION = "e2e106-session-0001";
// The browser's own line for the missing /favicon.ico (the server serves no icon):
// once per start of the browser (decisions/0112, О3).
const FAVICON = {
  kind: "browser-log",
  text: "Failed to load resource: the server responded with a status of 404 (Not Found)",
  path: "/favicon.ico",
};
// The browser's own line for a poll that found no server, while the server is down
// in "reconnect" only: at least one, no upper bound (decisions/0112, О4).
const REFUSED = {
  kind: "browser-log",
  text: "Failed to load resource: net::ERR_CONNECTION_REFUSED",
  path: "/api/events",
};

// The options of a Pixel Office server on the state folder `office` (design 4.3).
function officeOptions(office, port = 0) {
  return {
    name: "office",
    args: ["src/pixel-office/main.js", "--port", String(port)],
    readyPattern: /^Pixel Office: (http:\/\/127\.0\.0\.1:\d+\/)$/mu,
    stateEnv: { SAI_PIXEL_OFFICE_DIR: office },
  };
}

// The two folders of one test: the state folder of its servers and the home folder
// of its hook runs.
function testFolders() {
  return { office: makeTempDir("office"), home: makeTempDir("hook-home") };
}

// Removes both folders; `check`: the home of the hook was empty (read before the
// removal, asserted after it, so a red check leaves no folder).
function dropFolders(folders, check = true) {
  const left = fs.readdirSync(folders.home);
  removeTempDir(folders.office);
  removeTempDir(folders.home);
  if (check) {
    assert.deepEqual(left, [], "the home folder of the hook holds nothing");
  }
}

// Runs `body(folders)` with the two folders of a test; they are removed in every
// outcome, and the home check of dropFolders does not hide an earlier failure.
async function inFolders(body) {
  const folders = testFolders();
  let value;
  try {
    value = await body(folders);
  } catch (err) {
    dropFolders(folders, false);
    throw err;
  }
  dropFolders(folders);
  return value;
}

// A folder for the hook: its real path under the temporary root, not the root
// itself; else PATH_REFUSED.
function checkedFolder(dir) {
  const real = assertUnderTempRoot(dir);
  if (real === tempRoot()) {
    throw new E2eError(
      "PATH_REFUSED",
      `runHook: refused folder "${dir}": the temporary root itself`,
    );
  }
  return real;
}

// The real hook program /bin/sh src/pixel-office/hook.sh with the JSON `payload` on
// stdin and exactly three variables. Both folders are checked in this call, before
// the spawn, and the child gets the checked real paths. `deps.spawn` is for test 1
// only. -> { code, signal, stdout, stderr, before, after } (the clock just before
// the spawn and at the close of the hook).
async function runHook(payload, folders, deps = {}) {
  const office = checkedFolder(folders.office);
  const home = checkedFolder(folders.home);
  const spawnHook = deps.spawn ?? spawn;
  const before = Date.now();
  const child = spawnHook("/bin/sh", ["src/pixel-office/hook.sh"], {
    cwd: TOOLS,
    env: { PATH: process.env.PATH, SAI_PIXEL_OFFICE_DIR: office, HOME: home },
    stdio: ["pipe", "pipe", "pipe"],
  });
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const limit = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // gone already
      }
      reject(
        new Error(
          `the hook ${payload.hook_event_name} did not end in ${HOOK_LIMIT_MS} ms; its pid ${child.pid} was killed`,
        ),
      );
    }, HOOK_LIMIT_MS);
    child.on("error", (err) => {
      clearTimeout(limit);
      reject(err);
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code, signal) => {
      clearTimeout(limit);
      resolve({ code, signal, stdout, stderr, before, after: Date.now() });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(payload));
  });
}

// The hook payloads of README "What of the hook input is stored": no time field, the
// hook sets the time when it fires.
function start(agent, role) {
  return {
    hook_event_name: "SubagentStart",
    session_id: SESSION,
    agent_id: agent,
    agent_type: role,
  };
}

function stop(agent, role) {
  return {
    hook_event_name: "SubagentStop",
    session_id: SESSION,
    agent_id: agent,
    agent_type: role,
  };
}

function handover(agent, role, description, n) {
  return {
    hook_event_name: "PostToolUse",
    session_id: SESSION,
    tool_name: "Agent",
    tool_use_id: `e2e106-tool-${n}`,
    tool_input: { description, subagent_type: role },
    tool_response: { agentId: agent },
  };
}

// The plain name of a role "Sai … (CODE)" from the table of role names.
function plainName(role) {
  const name = ROLE_NAMES[/\(([A-Z-]+)\)$/u.exec(role)[1]];
  assert.equal(typeof name, "string", `the plain name of ${role}`);
  return name;
}

// A section "### <heading>" of tools/README.md, up to the next heading.
function readmeSection(heading) {
  const readme = fs.readFileSync(path.join(TOOLS, "README.md"), "utf8");
  const at = readme.indexOf(`\n### ${heading}\n`);
  assert.ok(at >= 0, `the README section ${heading}`);
  const rest = readme.slice(at + 1);
  const next = rest.slice(4).search(/\n#{2,3} /u);
  return next === -1 ? rest : rest.slice(0, next + 4);
}

// The cells of the rows of the first table of a README section.
function tableRows(section) {
  return section
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| -"))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );
}

// The Russian words of a row of the README table "The journal in plain words" for
// the event `event` ("SubagentStart (first)", "SubagentStop"): the second column up
// to " (the ", with «{роль}» replaced by the plain name `name`.
function readmeWords(event, name) {
  const space = event.indexOf(" ");
  const cell =
    space === -1
      ? `\`${event}\``
      : `\`${event.slice(0, space)}\`${event.slice(space)}`;
  const rows = tableRows(readmeSection("The journal in plain words"));
  const row = rows.find((cells) => cells[0] === cell);
  assert.ok(row, `the README row of ${event}`);
  const cut = row[1].indexOf(" (the ");
  assert.ok(cut > 0, `the Russian words of ${event}`);
  const words = row[1].slice(0, cut);
  assert.ok(words.includes("{роль}"), `the role in the words of ${event}`);
  return words.replace("{роль}", name);
}

// The five file names of the README table "Where things are".
function readmeStateFiles() {
  const rows = tableRows(readmeSection("Where things are"));
  const names = rows
    .map((cells) => /^`([^`]+)`$/u.exec(cells[0]))
    .filter((m) => m !== null)
    .map((m) => m[1]);
  assert.equal(names.length, 5, `the files of the README: ${names.join(",")}`);
  return names;
}

// Page code. Every source given to waitFor or evaluate is an expression or a
// function with its args (a function given with no args would be a true value and
// end the wait at once: the kit trap of design 4.4).
const LINK_TEXT = `document.querySelector("#link-status")?.textContent ?? ""`;
const META = `document.querySelector("#journal-meta")?.textContent ?? ""`;
const EVENTS = `[...document.querySelectorAll("#journal > li .event")].map((el) => el.textContent)`;
// the task rows whose role is `name` and whose state is `state`
const TASKS = `(name, state) => [...document.querySelectorAll('#tasks .item[data-kind="task"]')].filter((el) => el.querySelector(".item-role")?.textContent === name && el.querySelector(".item-state")?.textContent === state).length`;
const WORKING_ROWS = `[...document.querySelectorAll('#tasks .item[data-kind="task"] .item-state')].filter((el) => el.textContent === ${JSON.stringify(WORKING)}).length`;
const NAVIGATIONS = `performance.getEntriesByType("navigation").map((entry) => entry.type)`;
// the block «Сейчас» is shown: not hidden, a box above 0, visible, and its text
// starts with the word (decisions/0112, О9)
const NOW_SHOWN = `(() => {
  const el = document.querySelector("#now");
  if (el === null || el.hidden) return false;
  const box = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none" && el.textContent.trim().startsWith(${JSON.stringify(NOW_WORD)});
})()`;
// every place of the page a text can take (design C-9): the text of the body, the
// title, the address, the value of every attribute, the storage of the origin
const SEEN = `(() => {
  const attributes = [];
  for (const el of document.querySelectorAll("*")) {
    for (const attribute of el.attributes) attributes.push(attribute.value);
  }
  const storage = [];
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      storage.push(key, store.getItem(key));
    }
  }
  return {
    body: document.body.textContent,
    title: document.title,
    address: decodeURIComponent(location.href),
    attributes: attributes.join("\\n"),
    storage: storage.join("\\n"),
  };
})()`;

const linkIs = (word) => `(${LINK_TEXT}) === ${JSON.stringify(word)}`;
const eventCount = (n) => `(${EVENTS}).length === ${n}`;

// The page of `stand` in a new tab: answered 200, and «на связи» after the first
// poll, which the page makes at its load.
async function openPage(browser, stand) {
  browser.expectOncePerStart(FAVICON);
  const page = await browser.newPage();
  const { status } = await page.goto(stand.url);
  assert.equal(status, 200, "the page answers");
  await page.waitFor(linkIs(LIVE), {
    timeoutMs: 10000,
    description: `«${LIVE}»`,
  });
  return page;
}

// The non-empty lines of a file; none for a missing one.
function lines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line !== "");
}

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

// The entries of the folder `dir`, sorted by name, each with the sha256 of its
// bytes ("not a file" for another kind of entry).
function listing(dir) {
  return fs
    .readdirSync(dir)
    .sort()
    .map((name) => {
      const entry = path.join(dir, name);
      return [
        name,
        fs.lstatSync(entry).isFile() ? sha256(entry) : "not a file",
      ];
    });
}

// The shape of an environment `env` as spawn hands it to a child (for…in: also the
// names inherited from its prototype): the names of `wanted` that it has, and only
// the count of every other name, so that a red check names no other variable of
// this process and prints no value (Q7; decisions/0112, О24). It equals
// shapeOf(wanted) exactly when the child gets the names of `wanted` and no other.
function envShape(env, wanted) {
  const names = [];
  for (const name in env) names.push(name);
  return {
    plain: Object.getPrototypeOf(env) === Object.prototype,
    symbols: Object.getOwnPropertySymbols(env).length,
    names: names.filter((name) => wanted.includes(name)).sort(),
    others: names.filter((name) => !wanted.includes(name)).length,
  };
}

function shapeOf(wanted) {
  return { plain: true, symbols: 0, names: [...wanted].sort(), others: 0 };
}

// The names in the state folder `dir` that the README table "Where things are"
// does not list.
function foreignStateNames(dir) {
  const files = readmeStateFiles();
  return fs
    .readdirSync(dir)
    .sort()
    .filter((name) => !files.includes(name));
}

// The folders sai-e2e-* of the temporary root.
function kitFolders() {
  return fs
    .readdirSync(tempRoot())
    .filter((name) => name.startsWith("sai-e2e-"))
    .sort();
}

// A key-shaped text, built at run time from parts, so that no file holds its shape:
// the prefix and 36 letters and digits from the sha512 of a fixed made-up phrase
// (deterministic).
function keyShaped() {
  const letters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto
    .createHash("sha512")
    .update("REQ-106 mask test: a made-up phrase, never a key")
    .digest();
  let tail = "";
  for (let i = 0; i < 36; i++) tail += letters[bytes[i] % 62];
  return ["gh", "p", "_"].join("") + tail;
}

// The 12 middle characters of the key.
function middle(key) {
  return key.slice(14, 26);
}

// ------------------------------------------------------------------ criterion 1

test("isolated start", LIMIT, async () => {
  await inFolders(async (folders) => {
    // (a) refusals: nothing is started. Every call that names the home folder of
    // the person or the real state folder gets a spawn that records and throws
    const home = os.homedir();
    const realState = path.join(home, ".sai-pixel-office");
    const recorded = [];
    const throwingSpawn = (...call) => {
      recorded.push(call);
      throw new Error("a real folder reached the spawn");
    };
    const good = officeOptions(folders.office);
    // a folder of links of the test, removed in every outcome (the removal takes
    // the links away, never what they point to): a link to the real state folder,
    // given to the hook helper only as a refused value, and a link to the state
    // folder of the test, a spelling that is not its real path
    const links = makeTempDir("links");
    try {
      const stateLink = path.join(links, "real-state-link");
      fs.symlinkSync(realState, stateLink);
      const officeLink = path.join(links, "office-link");
      fs.symlinkSync(folders.office, officeLink);
      const foldersBefore = kitFolders();
      for (const [what, options, code] of [
        [
          "the home folder in stateEnv",
          { ...good, stateEnv: { SAI_PIXEL_OFFICE_DIR: home } },
          "PATH_REFUSED",
        ],
        [
          "the real state folder in stateEnv",
          { ...good, stateEnv: { SAI_PIXEL_OFFICE_DIR: realState } },
          "PATH_REFUSED",
        ],
        [
          "the real state folder in env",
          { ...good, stateEnv: {}, env: { SAI_PIXEL_OFFICE_DIR: realState } },
          "PATH_REFUSED",
        ],
        [
          "the real state folder after --dir",
          { ...good, args: [...good.args, "--dir", realState] },
          "PATH_REFUSED",
        ],
        [
          "the real state folder in --dir=",
          { ...good, args: [...good.args, `--dir=${realState}`] },
          "PATH_REFUSED",
        ],
        ["HOME in env", { ...good, env: { HOME: folders.home } }, "USAGE"],
      ]) {
        await assert.rejects(
          startStand(options, { spawn: throwingSpawn }),
          (err) => {
            assert.ok(err instanceof E2eError, `${what}: ${err}`);
            assert.equal(err.code, code, `${what}: ${err.message}`);
            return true;
          },
          what,
        );
      }
      // the hook helper: each of its two folders outside the temporary root (also
      // through a link under a folder of the test), and each equal to the root
      // itself (decisions/0112, О18 and О24)
      for (const [what, given] of [
        ["the real state folder", { office: realState, home: folders.home }],
        [
          "a link to the real state folder",
          { office: stateLink, home: folders.home },
        ],
        ["the home folder as its home", { office: folders.office, home }],
        [
          "the temporary root as the office",
          { ...folders, office: tempRoot() },
        ],
        ["the temporary root as its home", { ...folders, home: tempRoot() }],
      ]) {
        await assert.rejects(
          runHook(start("e2e106-agent-refused", ROLE_A), given, {
            spawn: throwingSpawn,
          }),
          (err) => {
            assert.ok(err instanceof E2eError, `runHook, ${what}: ${err}`);
            assert.equal(err.code, "PATH_REFUSED", `runHook, ${what}`);
            return true;
          },
          `runHook, ${what}`,
        );
      }
      assert.equal(recorded.length, 0, "a refused call reached the spawn");
      assert.deepEqual(kitFolders(), foldersBefore, "a refusal made a folder");

      // the call of the hook helper with the folders of the test, the state folder
      // given as a link and the home with a "..": /bin/sh, the hook program, the
      // tools folder, and exactly three variables with the real paths
      const spelled = {
        office: officeLink,
        home: [folders.home, "..", path.basename(folders.home)].join(path.sep),
      };
      // controls: neither spelling is the real path it stands for
      assert.notEqual(spelled.office, fs.realpathSync(folders.office));
      assert.notEqual(spelled.home, fs.realpathSync(folders.home));
      const calls = [];
      const recorder = (...call) => {
        calls.push(call);
        throw new Error("recorded, not started");
      };
      await assert.rejects(
        runHook(start("e2e106-agent-recorded", ROLE_A), spelled, {
          spawn: recorder,
        }),
        /^Error: recorded, not started$/u,
      );
      assert.equal(calls.length, 1);
      const [file, args, options] = calls[0];
      assert.equal(file, "/bin/sh");
      assert.deepEqual(args, ["src/pixel-office/hook.sh"]);
      assert.equal(options.cwd, TOOLS);
      // the names first, as spawn hands them over (also the inherited ones), a
      // name besides the three only counted, so that a red run prints no other
      // variable and no value of this process (Q7); then the three values one by
      // one, PATH compared without being printed
      const hookNames = ["HOME", "PATH", "SAI_PIXEL_OFFICE_DIR"];
      assert.deepEqual(
        envShape(options.env, hookNames),
        shapeOf(hookNames),
        "the variables of the hook: these three names and no other",
      );
      assert.ok(
        options.env.PATH === process.env.PATH,
        "PATH of the hook: the PATH of the test process",
      );
      assert.equal(
        options.env.SAI_PIXEL_OFFICE_DIR,
        fs.realpathSync(folders.office),
        "SAI_PIXEL_OFFICE_DIR of the hook: the real path of the state folder",
      );
      assert.equal(
        options.env.HOME,
        fs.realpathSync(folders.home),
        "HOME of the hook: the real path of its home folder",
      );
    } finally {
      removeTempDir(links);
    }

    // (b) the stand: before any event its home and its state folder hold only what
    // the README names, and the page is on line with no task in work
    const files = readmeStateFiles();
    await withStand(good, async (stand) => {
      assert.deepEqual(
        { ...stand.stateEnv },
        {
          SAI_PIXEL_OFFICE_DIR: fs.realpathSync(folders.office),
        },
      );
      assert.deepEqual(
        fs.readdirSync(stand.homeDir),
        [],
        "the home of the server",
      );
      const names = fs.readdirSync(folders.office).sort();
      for (const name of names) {
        assert.ok(files.includes(name), `a file of the state folder: ${name}`);
      }
      assert.ok(names.includes("server-starts.jsonl"), names.join(","));
      assert.deepEqual(lines(path.join(folders.office, "events.jsonl")), []);
      assert.equal(
        lines(path.join(folders.office, "server-starts.jsonl")).length,
        1,
      );
      await withBrowser(async (browser) => {
        const page = await openPage(browser, stand);
        assert.equal(await page.evaluate(LINK_TEXT), LIVE);
        assert.equal(await page.evaluate(WORKING_ROWS), 0, "a task in work");
      });
      assert.deepEqual(
        fs.readdirSync(stand.homeDir),
        [],
        "the home at the end",
      );
    });
  });
});

// ------------------------------------------------------------------ criterion 2

test("live", LIMIT, async () => {
  await inFolders(async (folders) => {
    await withStand(officeOptions(folders.office), async (stand) => {
      await withBrowser(async (browser) => {
        const page = await openPage(browser, stand);
        await page.evaluate(`(window.__e2eMarker = "e2e106-marker", true)`);
        assert.deepEqual(await page.evaluate(NAVIGATIONS), ["navigate"]);
        // control: no task in work before the hook
        assert.equal(await page.evaluate(WORKING_ROWS), 0, "control");
        const name = plainName(ROLE_A);
        const agent = "e2e106-agent-live";
        for (const [payload, state] of [
          [start(agent, ROLE_A), WORKING],
          [stop(agent, ROLE_A), FINISHED],
        ]) {
          const hook = await runHook(payload, folders);
          assert.equal(hook.code, 0, `${payload.hook_event_name}: the hook`);
          // from the end of the hook, polled every 100 ms
          await page.waitFor(TASKS, {
            args: [name, state],
            pollMs: 100,
            timeoutMs: 5000,
            description: `the task «${name}» «${state}»`,
          });
          const shownAfter = Date.now() - hook.after;
          assert.ok(
            shownAfter <= 5000,
            `«${state}» shown ${shownAfter} ms after the end of the hook`,
          );
          assert.equal(await page.evaluate(TASKS, [name, state]), 1, state);
        }
        // no reload happened
        assert.equal(
          await page.evaluate("window.__e2eMarker"),
          "e2e106-marker",
        );
        assert.deepEqual(await page.evaluate(NAVIGATIONS), ["navigate"]);
      });
    });
  });
});

// ------------------------------------------------------------------ criterion 3

test("journal", LIMIT, async () => {
  await inFolders(async (folders) => {
    await withStand(officeOptions(folders.office), async (stand) => {
      await withBrowser(async (browser) => {
        const page = await openPage(browser, stand);
        const agent = "e2e106-agent-journal";
        const payloads = [
          start(agent, ROLE_A),
          start(agent, ROLE_A),
          stop(agent, ROLE_A),
        ];
        const runs = [];
        for (const payload of payloads) {
          assert.ok(!("time" in payload), "a payload has no time");
          const hook = await runHook(payload, folders);
          assert.equal(hook.code, 0, `${payload.hook_event_name}: the hook`);
          runs.push(hook);
        }
        await page.waitFor(eventCount(3), {
          timeoutMs: 10000,
          description: "the three rows of the journal",
        });
        const name = plainName(ROLE_A);
        // the new rows at the bottom
        assert.deepEqual(await page.evaluate(EVENTS), [
          readmeWords("SubagentStart (first)", name),
          readmeWords("SubagentStart (repeated)", name),
          readmeWords("SubagentStop", name),
        ]);
        const meta = await page.evaluate(META);
        assert.ok(meta.endsWith(COUNT), `the counter: ${meta}`);

        const stored = lines(path.join(folders.office, "events.jsonl"));
        assert.equal(stored.length, 3, "the lines of the journal file");
        const kinds = ["SubagentStart", "SubagentStart", "SubagentStop"];
        stored.forEach((line, i) => {
          const event = JSON.parse(line);
          assert.equal(event.hook_event_name, kinds[i], `line ${i + 1}`);
          assert.equal(event.source, "REAL", `line ${i + 1}`);
          assert.equal(event.session_id, SESSION, `line ${i + 1}`);
          assert.equal(event.agent_id, agent, `line ${i + 1}`);
          assert.match(
            event.time,
            /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u,
            `line ${i + 1}`,
          );
          // the time came from the hook: inside the window of its own run
          const at = Date.parse(event.time);
          assert.ok(
            runs[i].before <= at && at <= runs[i].after,
            `line ${i + 1}: ${event.time} outside its hook run`,
          );
        });
      });
    });
  });
});

// ------------------------------------------------------------------ criterion 4

test("mask", LIMIT, async () => {
  const key = keyShaped();
  // controls: the text has the shape of a key
  assert.equal(key.length, 40);
  const tail = key.slice(4);
  assert.match(tail, /[A-Z]/u, "an upper letter");
  assert.match(tail, /[a-z]/u, "a lower letter");
  assert.match(tail, /[0-9]/u, "a digit");
  assert.match(key, new RegExp(["^gh", "p_[A-Za-z0-9]{36}$"].join(""), "u"));
  const hidden = middle(key);
  assert.equal(hidden.length, 12);
  const control = "Check the stock list now";
  const masked = `Check ${MASK} now`;
  await inFolders(async (folders) => {
    await withStand(officeOptions(folders.office), async (stand) => {
      await withBrowser(async (browser) => {
        const page = await openPage(browser, stand);
        const before = await page.evaluate(SEEN);
        assert.ok(!before.body.includes(control), "control: not there before");
        const a = "e2e106-agent-mask-a";
        const b = "e2e106-agent-mask-b";
        for (const payload of [
          start(a, ROLE_A),
          handover(a, ROLE_A, `Check ${key} now`, 1),
          stop(a, ROLE_A),
          start(b, ROLE_B),
          handover(b, ROLE_B, control, 2),
          stop(b, ROLE_B),
        ]) {
          const hook = await runHook(payload, folders);
          assert.equal(hook.code, 0, `${payload.hook_event_name}: the hook`);
        }
        await page.waitFor(
          `${eventCount(6)} && document.body.textContent.includes(${JSON.stringify(MASK)}) && document.body.textContent.includes(${JSON.stringify(control)})`,
          {
            timeoutMs: 10000,
            description: "six rows, the mask and the control text",
          },
        );
        const seen = await page.evaluate(SEEN);
        assert.ok(seen.body.includes(MASK), "the page shows the mask");
        assert.ok(seen.body.includes(control), "the page shows the control");
        const answers = [];
        for (const record of page.network()) {
          if (new URL(record.url).pathname !== "/api/events") continue;
          if (!record.finished) continue;
          answers.push(await page.responseBody(record.requestId));
        }
        assert.ok(
          answers.some((body) => body.includes(masked)),
          "control: an answer to the page holds the masked description",
        );
        const places = [
          ["the text of the page", seen.body],
          ["the title", seen.title],
          ["the address", seen.address],
          ["an attribute", seen.attributes],
          ["the storage of the origin", seen.storage],
          ["an answer of /api/events", answers.join("\n")],
          ["the stdout of the server", stand.stdout()],
          ["the stderr of the server", stand.stderr()],
        ];
        for (const [place, text] of places) {
          assert.ok(!text.includes(key), `${place} holds the key`);
          assert.ok(!text.includes(hidden), `${place} holds its middle`);
        }
        const file = fs.readFileSync(
          path.join(folders.office, "events.jsonl"),
          "utf8",
        );
        assert.equal(file.split(key).length - 1, 0, "the key in the file");
        assert.equal(
          file.split(hidden).length - 1,
          0,
          "the middle in the file",
        );
        assert.ok(file.includes(control), "the control text in the file");
        assert.ok(file.includes(masked), "the masked description in the file");
      });
    });
  });
});

// ------------------------------------------------------------------ criterion 5

test("untouched home", LIMIT, async () => {
  await inFolders(async (folders) => {
    const stand = await startStand(officeOptions(folders.office));
    let stopped = null;
    try {
      const agent = "e2e106-agent-home";
      const hook = await runHook(start(agent, ROLE_A), folders);
      assert.equal(hook.code, 0, "the hook");
      // the event went to the temporary folder of the test
      const stored = lines(path.join(folders.office, "events.jsonl"));
      assert.equal(stored.length, 1, "the event in the temporary folder");
      assert.equal(JSON.parse(stored[0]).agent_id, agent);
      // both home folders hold nothing
      assert.deepEqual(
        fs.readdirSync(stand.homeDir),
        [],
        "the home of the server",
      );
      assert.deepEqual(
        fs.readdirSync(folders.home),
        [],
        "the home of the hook",
      );
      // a stop with code 0 is impossible while the home of the server holds anything
      stopped = await stand.stop();
      assert.deepEqual(stopped, { code: 0, signal: null });
      assert.equal(
        fs.existsSync(stand.homeDir),
        false,
        "the home after the stop",
      );
      // after the event the state folder still holds only what the README names
      assert.deepEqual(
        foreignStateNames(folders.office),
        [],
        "a file of the state folder that the README does not name",
      );
    } finally {
      if (stopped === null) await stand.stop().catch(() => {});
    }
  });
});

// ------------------------------------------------------------------ criterion 6

// Stops every stand of `stands` that is still up; a stop failure is attached to the
// first failure `failure` (not thrown over it), or thrown when there is none.
async function stopStands(stands, failure) {
  let first = null;
  for (const stand of stands) {
    try {
      await stand.stop();
    } catch (err) {
      if (err === failure) continue;
      if (failure !== null && typeof failure === "object") {
        (failure.cleanupErrors ??= []).push(err);
      } else if (first === null) {
        first = err;
      }
    }
  }
  if (failure === null && first !== null) throw first;
}

// The restart on `port` with the same state folder, and its identity read at once,
// before the page is read: (i) ours bound the port, it wrote the second start row;
// (ii) a foreign process holds the port; (iii) a link but no second start row.
// No wait by time, no retry, no other port (decisions/0112, О5).
async function restart(office, port, stands) {
  let stand;
  try {
    stand = await startStand(officeOptions(office, port));
  } catch (err) {
    if (
      err instanceof E2eError &&
      err.code === "STAND_START_EXITED" &&
      err.message.includes("занят другим процессом")
    ) {
      assert.fail(
        `the port ${port} was taken by another process between the stop and the restart: ${err.message}`,
      );
    }
    throw err;
  }
  stands.push(stand);
  const rows = lines(path.join(office, "server-starts.jsonl")).length;
  if (rows !== 2) {
    assert.fail(
      `the restart printed its link but wrote no start row into this folder: either another Pixel Office holds port ${port}, or this server did not record its start (start rows: ${rows})`,
    );
  }
  assert.equal(stand.port, port, "the restart is on the same port");
  return stand;
}

test("reconnect", LIMIT, async () => {
  await inFolders(async (folders) => {
    const journal = path.join(folders.office, "events.jsonl");
    const starts = path.join(folders.office, "server-starts.jsonl");
    const stands = [];
    let failure = null;
    try {
      const first = await startStand(officeOptions(folders.office));
      stands.push(first);
      await withBrowser(async (browser) => {
        browser.expect(REFUSED);
        const page = await openPage(browser, first);
        const agent = "e2e106-agent-reconnect";
        for (const payload of [
          start(agent, ROLE_A),
          start(agent, ROLE_A),
          stop(agent, ROLE_A),
        ]) {
          const hook = await runHook(payload, folders);
          assert.equal(hook.code, 0, `${payload.hook_event_name}: the hook`);
        }
        await page.waitFor(eventCount(3), {
          timeoutMs: 10000,
          description: "the three rows",
        });
        const rows = await page.evaluate(EVENTS);

        // the server goes away
        assert.deepEqual(await first.stop(), { code: 0, signal: null });
        await page.waitFor(linkIs(DOWN), {
          timeoutMs: 10000,
          description: `«${DOWN}»`,
        });
        assert.deepEqual(await page.evaluate(EVENTS), rows, "the rows kept");
        // a hook while it is down: quiet, and the file unchanged, and the whole
        // state folder too (every name with the sha256 of its bytes)
        const shaBefore = sha256(journal);
        const folderBefore = listing(folders.office);
        assert.ok(
          folderBefore.some(([name]) => name === "events.jsonl"),
          "control: the listing holds the journal file",
        );
        const lost = await runHook(start("e2e106-agent-lost", ROLE_A), folders);
        assert.deepEqual(
          { code: lost.code, stdout: lost.stdout, stderr: lost.stderr },
          { code: 0, stdout: "", stderr: "" },
          "the hook while the server is down",
        );
        assert.equal(sha256(journal), shaBefore, "the journal file changed");
        assert.deepEqual(
          listing(folders.office),
          folderBefore,
          "the state folder changed while the server was down",
        );

        // the server comes back on the same port and folder
        const second = await restart(folders.office, first.port, stands);
        await page.waitFor(`${linkIs(LIVE)} && ${eventCount(3)}`, {
          timeoutMs: 10000,
          description: `«${LIVE}» and the three rows again`,
        });
        assert.deepEqual(await page.evaluate(EVENTS), rows, "the rows again");
        assert.equal(lines(starts).length, 2, "the start rows");
        const hook = await runHook(stop(agent, ROLE_A), folders);
        assert.equal(hook.code, 0, "the hook after the restart");
        await page.waitFor(eventCount(4), {
          pollMs: 100,
          timeoutMs: 5000,
          description: "the new row after the restart",
        });
        const shownAfter = Date.now() - hook.after;
        assert.ok(shownAfter <= 5000, `the new row after ${shownAfter} ms`);
        const after = await page.evaluate(EVENTS);
        assert.equal(after[3], readmeWords("SubagentStop", plainName(ROLE_A)));
        // the event sent while the server was down is lost
        const stored = lines(journal).map((line) => JSON.parse(line));
        assert.equal(stored.length, 4, "the lines of the journal file");
        assert.ok(
          stored.every((event) => event.agent_id === agent),
          "the event of the lost hook is in the file",
        );
        assert.deepEqual(await second.stop(), { code: 0, signal: null });
        // at the end the state folder holds only what the README names
        assert.deepEqual(
          foreignStateNames(folders.office),
          [],
          "a file of the state folder that the README does not name",
        );
      });
    } catch (err) {
      failure = err;
    }
    await stopStands(stands, failure);
    if (failure !== null) throw failure;
  });
});

// ------------------------------------------------------------------ criterion 7

test("windows", LIMIT, async () => {
  await inFolders(async (folders) => {
    const stand = await startStand(officeOptions(folders.office));
    const stands = [stand];
    let failure = null;
    try {
      await withBrowser(async (browser) => {
        browser.expectOncePerStart(FAVICON);
        const page = await browser.newPage();
        for (const [width, height] of [
          [1470, 784],
          [390, 844],
          [320, 568],
        ]) {
          const size = `${width}x${height}`;
          await page.setViewport(width, height);
          const { status } = await page.goto(stand.url);
          assert.equal(status, 200, `${size}: the page answers`);
          await page.waitFor(linkIs(LIVE), {
            timeoutMs: 10000,
            description: `${size}: «${LIVE}»`,
          });
          assert.equal(
            await page.evaluate(NOW_SHOWN),
            true,
            `${size}: «${NOW_WORD}»`,
          );
          assert.deepEqual(
            browser.unexpectedEntries(),
            [],
            `${size}: a console error or an exception`,
          );
        }
      });
      // SIGTERM ends the server with code 0
      assert.deepEqual(await stand.stop(), { code: 0, signal: null });
    } catch (err) {
      failure = err;
    }
    await stopStands(stands, failure);
    if (failure !== null) throw failure;
  });
});
