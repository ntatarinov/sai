// SMK-01 ... SMK-13: the kit against a real headless Chrome (REQ-104). Every test
// starts its own browser and its own page server on 127.0.0.1, port 0; the pages
// are invented (a page titled Demo, a button Go that sets the title Done, a block
// of 700 px). The oracles are the numbers and texts of the design, not the code of
// the kit. Run by `cd tools && npm run e2e -- smoke`.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import {
  E2eError,
  launchBrowser,
  makeTempDir,
  removeTempDir,
  repoRoot,
  tempRoot,
  withBrowser,
} from "./kit/index.js";

const LIMIT = { timeout: 20000 };
const NOT_FOUND_404 =
  "Failed to load resource: the server responded with a status of 404 (Not Found)";

// A page server of one test. `routes` maps a path to a function (req, res, body).
async function startSite(routes) {
  const sockets = new Set();
  const seen = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      seen.push({ method: req.method, path: url.pathname, body });
      const route = routes[url.pathname];
      if (route) route(req, res, body);
      else if (url.pathname === "/favicon.ico") {
        res.writeHead(204);
        res.end();
      } else {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("missing");
      }
    });
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    seen,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function page(body, head = "") {
  return (_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
      `<!doctype html><html><head><meta charset="utf-8"><title>Demo</title>${head}</head><body>${body}</body></html>`,
    );
  };
}

function text(status, body, type = "text/plain") {
  return (_req, res) => {
    res.writeHead(status, { "content-type": type });
    res.end(body);
  };
}

function processGone(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (err) {
    return err.code === "ESRCH";
  }
}

function groupGone(pgid) {
  try {
    process.kill(-pgid, 0);
    return false;
  } catch (err) {
    return err.code === "ESRCH";
  }
}

function assertCleaned(seen) {
  assert.ok(processGone(seen.pid), `process ${seen.pid} is still alive`);
  assert.ok(groupGone(seen.pid), `group ${seen.pid} is still alive`);
  assert.equal(fs.existsSync(seen.profileDir), false, "profile folder left");
}

async function until(check, ms = 5000) {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() > deadline) assert.fail("the condition did not become true");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

const GO_PAGE = page(
  `<button id="go" onclick="document.title='Done'">Go</button>`,
);

test("SMK-01 start click title", LIMIT, async () => {
  const site = await startSite({ "/": GO_PAGE });
  const seen = {};
  try {
    await withBrowser(async (browser) => {
      seen.pid = browser.pid;
      seen.profileDir = browser.profileDir;
      assert.match(browser.product, /Chrome\/\d+\.\d+/);
      const real = fs.realpathSync(browser.profileDir);
      assert.ok(
        real.startsWith(tempRoot() + path.sep),
        "profile folder is under the temporary root",
      );
      assert.ok(
        !real.startsWith(repoRoot() + path.sep),
        "profile folder is outside the repository",
      );
      const tab = await browser.newPage();
      const answer = await tab.goto(`${site.base}/`);
      assert.equal(answer.status, 200);
      assert.equal(await tab.evaluate("document.title"), "Demo");
      await tab.click("#go");
      await tab.waitFor("document.title === 'Done'");
      assert.equal(await tab.evaluate("document.title"), "Done");
    });
    assertCleaned(seen);
  } finally {
    await site.close();
  }
});

test("SMK-02 clean-up after a throwing body", LIMIT, async () => {
  const site = await startSite({ "/": GO_PAGE });
  const seen = {};
  const thrown = new Error("the body failed on purpose");
  try {
    let caught = null;
    try {
      await withBrowser(async (browser) => {
        seen.pid = browser.pid;
        seen.profileDir = browser.profileDir;
        const tab = await browser.newPage();
        await tab.goto(`${site.base}/`);
        throw thrown;
      });
    } catch (err) {
      caught = err;
    }
    assert.equal(caught, thrown, "the same error object comes back");
    assertCleaned(seen);
  } finally {
    await site.close();
  }
});

test("SMK-03 clean-up with a pending request", LIMIT, async () => {
  // the server never answers /hang and keeps the connection
  const site = await startSite({
    "/": GO_PAGE,
    "/hang": () => {},
  });
  const seen = {};
  try {
    await withBrowser(async (browser) => {
      seen.pid = browser.pid;
      seen.profileDir = browser.profileDir;
      const tab = await browser.newPage();
      await tab.goto(`${site.base}/`);
      await tab.evaluate("(() => { fetch('/hang'); return 1; })()");
      await until(() => site.seen.some((request) => request.path === "/hang"));
    });
    assertCleaned(seen);
  } finally {
    await site.close();
  }
});

test("SMK-04 browser killed mid-call", LIMIT, async () => {
  const site = await startSite({ "/": GO_PAGE });
  const browser = await launchBrowser();
  const seen = { pid: browser.pid, profileDir: browser.profileDir };
  try {
    const tab = await browser.newPage();
    await tab.goto(`${site.base}/`);
    // a call that can never finish by itself
    const pending = tab.evaluate("new Promise(() => {})");
    const rejected = assert.rejects(
      pending,
      (err) => err instanceof E2eError && err.code === "BROWSER_CLOSED",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    const started = Date.now();
    process.kill(-browser.pid, "SIGKILL");
    await rejected;
    assert.ok(Date.now() - started < 5000, "the call rejected within 5 s");
    await assert.rejects(
      tab.evaluate("1"),
      (err) => err instanceof E2eError && err.code === "BROWSER_CLOSED",
    );
    assert.match(
      await tab.evaluate("1").then(
        () => "",
        (err) => err.message,
      ),
      /closed/,
    );
  } finally {
    await browser.close();
    await site.close();
  }
  assertCleaned(seen);
});

const SIZES = [
  [1470, 784],
  [390, 844],
  [320, 568],
];

test("SMK-05 sizes and overflow", LIMIT, async () => {
  const site = await startSite({
    "/fluid": page(`<p>a fluid page</p>`, `<style>body{margin:0}</style>`),
    "/wide": page(
      `<div id="wide" style="width:700px;height:10px;background:#888"></div>`,
      `<style>body{margin:0}</style>`,
    ),
  });
  try {
    await withBrowser(async (browser) => {
      const tab = await browser.newPage();
      for (const [width, height] of SIZES) {
        const reported = await tab.setViewport(width, height);
        assert.deepEqual(reported, { innerWidth: width, innerHeight: height });
        await tab.goto(`${site.base}/fluid`);
        assert.equal(await tab.evaluate("window.innerWidth"), width);
        assert.equal(await tab.evaluate("window.innerHeight"), height);
        const fluid = await tab.horizontalOverflow();
        // negative control: a fluid page does not overflow, scrollWidth equals innerWidth
        assert.equal(fluid.overflowing, false, `fluid at ${width}`);
        assert.equal(fluid.scrollWidth, fluid.innerWidth);
        assert.equal(fluid.innerWidth, width);
        await tab.goto(`${site.base}/wide`);
        const wide = await tab.horizontalOverflow();
        // positive control: 700 px is wider than 390 and 320, narrower than 1470
        assert.equal(wide.overflowing, 700 > width, `wide at ${width}`);
        assert.equal(wide.innerWidth, width);
      }
    });
  } finally {
    await site.close();
  }
});

const THEME_PAGE = page(
  `<p>text</p>`,
  `<style>body{background:#fff;color:#000}@media (prefers-color-scheme: dark){body{background:#111;color:#eee}}</style>`,
);

test("SMK-06 themes", LIMIT, async () => {
  const site = await startSite({ "/": THEME_PAGE });
  const background = "getComputedStyle(document.body).backgroundColor";
  try {
    await withBrowser(async (browser) => {
      const tab = await browser.newPage();
      await tab.goto(`${site.base}/`);
      // a fresh page is light whatever the machine prefers
      assert.equal(
        await tab.evaluate(
          "matchMedia('(prefers-color-scheme: dark)').matches",
        ),
        false,
      );
      const light = await tab.evaluate(background);
      assert.equal(light, "rgb(255, 255, 255)");
      assert.equal(await tab.setColorScheme("dark"), true);
      const dark = await tab.evaluate(background);
      assert.notEqual(dark, light);
      assert.equal(dark, "rgb(17, 17, 17)");
      assert.equal(await tab.setColorScheme("light"), false);
      assert.equal(await tab.evaluate(background), light);
    });
  } finally {
    await site.close();
  }
});

const FOUR_PAGE = page(
  `<script>
    console.error('x');
    setTimeout(function () { throw new Error('timer boom'); }, 0);
    Promise.reject(new Error('rej boom'));
    fetch('/fail500');
  </script>`,
);
const FOUR = [
  ["console", "x"],
  ["exception", "Error: timer boom"],
  ["rejection", "Error: rej boom"],
  [
    "browser-log",
    "Failed to load resource: the server responded with a status of 500 (Internal Server Error)",
  ],
];

test("SMK-07 console entries", LIMIT, async () => {
  const site = await startSite({
    "/four": FOUR_PAGE,
    "/fail500": text(500, "boom"),
    "/clean": page(`<p>clean</p>`),
    "/one": page(`<script>console.error('x')</script>`),
  });
  try {
    // four distinct entries, one per source
    const browser = await launchBrowser();
    try {
      const tab = await browser.newPage();
      await tab.goto(`${site.base}/four`);
      await until(() => browser.consoleEntries().length >= 4);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const entries = browser.consoleEntries();
      assert.equal(entries.length, 4);
      const got = entries
        .map((entry) => [entry.kind, entry.text])
        .sort((a, b) => a[0].localeCompare(b[0]));
      assert.deepEqual(
        got,
        [...FOUR].sort((a, b) => a[0].localeCompare(b[0])),
      );
      assert.equal(browser.unexpectedEntries().length, 4);
      await assert.rejects(
        browser.verifyConsole({ settleMs: 10 }),
        (err) =>
          err.code === "CONSOLE_ENTRIES" &&
          /4 unexpected console entries/.test(err.message),
      );
    } finally {
      await browser.close();
    }

    // a clean page gives no entry and the run passes
    await withBrowser(async (clean) => {
      const tab = await clean.newPage();
      await tab.goto(`${site.base}/clean`);
      assert.equal(clean.consoleEntries().length, 0);
    });

    // a declared entry is not counted
    await withBrowser(async (declared) => {
      declared.expect({ kind: "console", text: "x" });
      const tab = await declared.newPage();
      await tab.goto(`${site.base}/one`);
      await until(() => declared.consoleEntries().length >= 1);
      assert.equal(declared.consoleEntries().length, 1);
      assert.equal(declared.unexpectedEntries().length, 0);
    });

    // a declared entry that never happened fails the run, and the browser is closed
    const seen = {};
    await assert.rejects(
      withBrowser(async (unmet) => {
        seen.pid = unmet.pid;
        seen.profileDir = unmet.profileDir;
        unmet.expect({ kind: "console", text: "never printed" });
        const tab = await unmet.newPage();
        await tab.goto(`${site.base}/clean`);
      }),
      (err) =>
        err.code === "CONSOLE_ENTRIES" &&
        /1 declared entries did not happen/.test(err.message) &&
        /never printed/.test(err.message),
    );
    assertCleaned(seen);
  } finally {
    await site.close();
  }
});

test("SMK-08 favicon once per start", LIMIT, async () => {
  const site = await startSite({
    "/": page(`<p>no favicon</p>`),
    "/favicon.ico": text(404, "no icon"),
  });
  const declaration = {
    kind: "browser-log",
    text: NOT_FOUND_404,
    path: "/favicon.ico",
  };
  try {
    // two loads in one start: exactly one favicon entry and the run passes
    await withBrowser(async (browser) => {
      browser.expectOncePerStart(declaration);
      const tab = await browser.newPage();
      await tab.goto(`${site.base}/`);
      await tab.goto(`${site.base}/`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const entries = browser.consoleEntries();
      assert.equal(entries.length, 1);
      assert.equal(new URL(entries[0].url).pathname, "/favicon.ico");
    });

    // the same declaration in a start that loads no page: unmet
    await assert.rejects(
      withBrowser(async (browser) => {
        browser.expectOncePerStart(declaration);
        await browser.newPage();
      }),
      (err) =>
        err.code === "CONSOLE_ENTRIES" &&
        /1 declared entries did not happen/.test(err.message),
    );

    // a declaration does not carry over: the next start has the entry undeclared
    await assert.rejects(
      withBrowser(async (browser) => {
        const tab = await browser.newPage();
        await tab.goto(`${site.base}/`);
      }),
      (err) =>
        err.code === "CONSOLE_ENTRIES" &&
        /1 unexpected console entries/.test(err.message),
    );
  } finally {
    await site.close();
  }
});

const KEYS_PAGE = page(
  `<button id="b1" onclick="document.title='pressed'">One</button>
   <input id="t" type="text">
   <input id="c" type="checkbox">
   <button id="b2">Two</button>`,
);

test("SMK-09 keyboard and typing", LIMIT, async () => {
  const site = await startSite({ "/": KEYS_PAGE });
  const active = "document.activeElement.id";
  try {
    await withBrowser(async (browser) => {
      const tab = await browser.newPage();
      await tab.goto(`${site.base}/`);
      await tab.press("Tab");
      assert.equal(await tab.evaluate(active), "b1");
      await tab.press("Enter");
      assert.equal(await tab.evaluate("document.title"), "pressed");
      await tab.press("Tab");
      assert.equal(await tab.evaluate(active), "t");
      await tab.press("Tab");
      assert.equal(await tab.evaluate(active), "c");
      await tab.press("Space");
      assert.equal(
        await tab.evaluate("document.getElementById('c').checked"),
        true,
      );
      await tab.press("Tab", { shift: true });
      assert.equal(await tab.evaluate(active), "t");
      await tab.type("#t", "привет");
      assert.equal(
        await tab.evaluate("document.getElementById('t').value"),
        "привет",
      );
      await assert.rejects(
        tab.press("F13"),
        (err) => err instanceof E2eError && err.code === "USAGE",
      );
    });
  } finally {
    await site.close();
  }
});

const CLICK_PAGE = page(
  `<button id="covered" onclick="document.title='covered'">Covered</button>
   <div id="ov" style="position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.1)"></div>`,
);
const FAR_PAGE = page(
  `<div style="height:3000px"></div>
   <button id="far" onclick="document.title='far'">Far</button>
   <button id="zero" style="width:0;height:0;padding:0;border:0;overflow:hidden"></button>
   <script>setTimeout(function () { window.ready = true; }, 300);</script>`,
);

test("SMK-10 click is checked and waits", LIMIT, async () => {
  const site = await startSite({ "/covered": CLICK_PAGE, "/far": FAR_PAGE });
  try {
    await withBrowser(async (browser) => {
      const tab = await browser.newPage();
      await tab.goto(`${site.base}/covered`);
      await assert.rejects(
        tab.click("#covered"),
        (err) => err.code === "CLICK_INTERCEPTED" && /ov/.test(err.message),
      );
      // the covered button was not pressed
      assert.equal(await tab.evaluate("document.title"), "Demo");

      await tab.goto(`${site.base}/far`);
      await tab.click("#far");
      assert.equal(await tab.evaluate("document.title"), "far");
      await assert.rejects(
        tab.click("#nothing-here"),
        (err) => err.code === "ELEMENT_NOT_FOUND",
      );
      await assert.rejects(
        tab.click("#zero"),
        (err) => err.code === "ELEMENT_NOT_VISIBLE",
      );

      // waitFor: returns when the condition turns true later, not on the first poll
      await tab.goto(`${site.base}/far`);
      const started = Date.now();
      const value = await tab.waitFor("window.ready === true");
      assert.equal(value, true);
      assert.ok(Date.now() - started >= 150, "waited for the condition");
      await assert.rejects(
        tab.waitFor("false", { timeoutMs: 200, description: "never true" }),
        (err) =>
          err.code === "WAIT_TIMEOUT" &&
          /waited 200 ms for: never true/.test(err.message),
      );
    });
  } finally {
    await site.close();
  }
});

test("SMK-11 network, reload, second tab", LIMIT, async () => {
  const site = await startSite({
    "/": page(`<p>home</p>`),
    "/api/echo": text(200, '{"ok":1}', "application/json"),
  });
  try {
    await withBrowser(async (browser) => {
      // a page that is missing answers 404: its console lines are declared
      browser.expect({ kind: "browser-log", text: NOT_FOUND_404 });
      const tab = await browser.newPage();
      await tab.goto(`${site.base}/`);
      const status = await tab.evaluate(
        `fetch('/api/echo', { method: 'POST', body: '{"a":1}' }).then((r) => r.status)`,
      );
      assert.equal(status, 200);
      const post = await until(() =>
        tab
          .network()
          .find(
            (record) =>
              record.method === "POST" &&
              record.url.endsWith("/api/echo") &&
              record.finished,
          ),
      );
      assert.equal(post.requestBody, '{"a":1}');
      assert.equal(post.status, 200);
      assert.equal(await tab.responseBody(post.requestId), '{"ok":1}');

      const missing = await tab.goto(`${site.base}/no-such-route`);
      assert.equal(missing.status, 404);

      // reload keeps the page
      await tab.goto(`${site.base}/`);
      const before = tab
        .network()
        .filter((r) => r.url === `${site.base}/`).length;
      await tab.reload();
      assert.equal(await tab.evaluate("document.title"), "Demo");
      assert.equal(await tab.evaluate("location.pathname"), "/");
      const after = tab
        .network()
        .filter((r) => r.url === `${site.base}/`).length;
      assert.equal(after, before + 1);

      // a second tab of the same profile sees the localStorage of the first
      await tab.evaluate("localStorage.setItem('k', 'v')");
      const second = await browser.newPage();
      await second.goto(`${site.base}/`);
      assert.equal(await second.evaluate("localStorage.getItem('k')"), "v");
      await second.close();
    });
  } finally {
    await site.close();
  }
});

test("SMK-12 screenshot", LIMIT, async () => {
  const site = await startSite({ "/": GO_PAGE });
  const dir = makeTempDir("smoke-shot");
  try {
    await withBrowser(async (browser) => {
      const tab = await browser.newPage();
      await tab.goto(`${site.base}/`);
      const file = path.join(dir, "demo.png");
      const result = await tab.screenshot(file);
      const data = fs.readFileSync(file);
      assert.ok(data.length > 0);
      assert.equal(result.bytes, data.length);
      assert.deepEqual(
        [...data.subarray(0, 8)],
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
      // a path inside the repository is refused and nothing is written there
      const inside = path.join(repoRoot(), "smoke-must-not-exist.png");
      await assert.rejects(
        tab.screenshot(inside),
        (err) => err.code === "PATH_REFUSED",
      );
      assert.equal(fs.existsSync(inside), false);
    });
  } finally {
    removeTempDir(dir);
    await site.close();
  }
  assert.equal(fs.existsSync(dir), false);
});

test("SMK-13 only this computer", LIMIT, async () => {
  const site = await startSite({
    "/": GO_PAGE,
    "/out": (_req, res) => {
      res.writeHead(302, { location: "http://example.com/" });
      res.end();
    },
  });
  try {
    await withBrowser(async (browser) => {
      const tab = await browser.newPage();
      // a redirect that leaves 127.0.0.1 ends on an error page, fast
      let started = Date.now();
      await assert.rejects(
        tab.goto(`${site.base}/out`),
        (err) => err.code === "NAVIGATION_FAILED",
      );
      assert.ok(Date.now() - started < 10000);
      await tab.waitFor("location.href.startsWith('chrome-error:')");

      // a page script that sends the window to a literal foreign address
      await tab.goto(`${site.base}/`);
      assert.equal(
        await tab.evaluate("location.origin.startsWith('http://127.')"),
        true,
      );
      started = Date.now();
      await tab.evaluate(
        "setTimeout(() => { location.href = 'http://192.0.2.1/'; }, 0)",
      );
      await tab.waitFor("location.href.startsWith('chrome-error:')", {
        timeoutMs: 10000,
      });
      assert.ok(Date.now() - started < 10000);

      // a loopback page still loads
      const again = await tab.goto(`${site.base}/`);
      assert.equal(again.status, 200);
    });
  } finally {
    await site.close();
  }
});
