import assert from "node:assert/strict";
import { test } from "node:test";
import { readRoot } from "../fixtures/helpers.js";

// REQ-109 criterion 9 (decisions/0116 О19). The option lists are those of Vercel's CLI reference, read
// 2026-11-17, not measured.

const OPTIONS = {
  deploy: ["--prod", "--yes", "--env"],
  rollback: ["--timeout"],
  redeploy: ["--no-wait", "--environment"],
  promote: ["--timeout"],
};
const GLOBAL = ["--cwd", "--scope"];
// Other commands of the Vercel CLI: a runbook line that runs one of them is red. A command line with none
// of these words and none of OPTIONS is a deploy, the CLI's default command.
const OTHER_COMMANDS = [
  "alias",
  "bisect",
  "build",
  "certs",
  "dev",
  "dns",
  "domains",
  "env",
  "git",
  "init",
  "inspect",
  "integration",
  "link",
  "list",
  "login",
  "logout",
  "logs",
  "ls",
  "project",
  "projects",
  "pull",
  "remove",
  "rm",
  "switch",
  "teams",
  "whoami",
];

/**
 * The command forms: every `vercel` command, wherever its options stand, is `npx vercel@<x.y.z>`, one
 * listed command with only its listed options; rollback, redeploy and promote carry the S1 words, and so
 * does every line that names the project ids.
 * @param {string[]} texts
 * @returns {string[]}
 */
export function commandFindings(texts) {
  const out = [];
  const pins = new Set();
  for (const text of texts) {
    for (const m of text.matchAll(/vercel@([^\s`]+)/g)) pins.add(m[1]);
    if (/vercel(@\S+)?\s+link\b/.test(text)) out.push("vercel link");
    for (const line of text.split("\n")) {
      if (
        /VERCEL_ORG_ID|VERCEL_PROJECT_ID/.test(line) &&
        !line.includes("verify at spike S1")
      )
        out.push("ids without the S1 words");
      // A command: the word `vercel` (not vercel.com, vercel.json, .vercel/ or vercel-build) up to the end
      // of its inline code, a shell comment, `&&`, `;` or `|`.
      for (const m of line.matchAll(
        /(^|[^\w.@/-])vercel(@[^\s`]*)?(?=[\s`]|$)([^`#;&|]*)/g,
      )) {
        const start = (m.index ?? 0) + m[1].length;
        if (!/(^|[\s`])npx\s+$/.test(line.slice(0, start)))
          out.push("vercel without npx");
        if (!/^@\d+\.\d+\.\d+$/.test(m[2] ?? ""))
          out.push("vercel without an exact pin");
        const words = m[3].split(/\s+/).filter(Boolean);
        const named = words.find(
          (w) => w in OPTIONS || OTHER_COMMANDS.includes(w),
        );
        if (named && OTHER_COMMANDS.includes(named))
          out.push(`vercel ${named}`);
        const command = /** @type {keyof typeof OPTIONS} */ (
          named && named in OPTIONS ? named : "deploy"
        );
        const allowed = [...(OPTIONS[command] ?? []), ...GLOBAL];
        for (const w of words)
          if (w.startsWith("-") && !allowed.includes(w.split("=")[0]))
            out.push(`${command} ${w.split("=")[0]}`);
        if (
          ["rollback", "redeploy", "promote"].includes(command) &&
          !line.includes("verify at spike S1")
        )
          out.push(`${command} without the S1 words`);
      }
    }
  }
  if (pins.size !== 1 || ![...pins].every((p) => /^\d+\.\d+\.\d+$/.test(p)))
    out.push(`pins ${[...pins].join(",")}`);
  return out;
}

/** @param {string} release @param {string} incident @returns {string[]} */
export function orderFindings(release, incident) {
  const out = [];
  // release.md: the deploy path with the ids and the expected version, the rollback (Hobby), the step
  // after a rollback, the post-deploy record.
  const order = [
    "git clone",
    "rev-parse HEAD",
    "--format=%ae",
    "VERCEL_ORG_ID=",
    "VERCEL_PROJECT_ID=",
    "deploy --prod --yes --env APP_VERSION=",
    "smoke.js --base",
    "--expect-version <sha>",
    "rm -rf",
    "rollback <previous production deployment URL>",
    "On Hobby only the previous production deployment",
    "Instant Rollback",
    "expand-only",
    "promote <deployment URL>",
    "turns the automatic assignment of the production domains back on",
    "docs/uat/<RUN-ID>-prod.md",
  ];
  let at = -1;
  for (const s of order) {
    const i = release.indexOf(s);
    if (i <= at) out.push(`release order: ${s}`);
    at = Math.max(at, i);
  }
  for (const s of [
    "Production",
    "страницу 404 платформы",
    "An agent only asks",
  ])
    if (!incident.includes(s)) out.push(`incident: ${s}`);
  // incident.md, in this order: the close with its redeploy and its check, the next step when the site is
  // still open (report at once; promote the closed deployment, or build it again), then the way back
  // with its own redeploy.
  const steps = [
    "## Закрыть сайт",
    "`SITE_GATE` = `closed`",
    "только для новой публикации",
    "redeploy <current production deployment URL>",
    "«Сервис временно остановлен владельцем»",
    "503",
    "Сразу сообщите",
    "promote <new deployment URL>",
    "повторите шаг 2",
    "## Открыть снова",
    "пустым",
    "redeploy <current production deployment URL>",
  ];
  let k = -1;
  for (const s of steps) {
    const i = incident.indexOf(s, k + 1);
    if (i < 0) out.push(`incident order: ${s}`);
    else k = i;
  }
  // The key shapes of ARCH §14.4 and the home folders of a computer, built from parts so that this file
  // does not hold them.
  const shapes = [
    ["sk", "ant-"].join("-"),
    ["ghp", ""].join("_"),
    ["github", "pat", ""].join("_"),
    ["AK", "IA"].join(""),
    ["PRIVATE", "KEY"].join(" "),
    ["", "Users", ""].join("/"),
    ["", "home", ""].join("/"),
  ];
  if (
    shapes.some((s) => (release + incident).includes(s)) ||
    /[A-Za-z]:\\/.test(release + incident)
  )
    out.push("a path or a secret");
  return out;
}

const files = () => [
  readRoot("docs/runbooks/release.md"),
  readRoot("docs/runbooks/incident.md"),
  readRoot("app/README.md"),
];

const change = (
  /** @type {string} */ t,
  /** @type {string} */ a,
  /** @type {string} */ b,
) => {
  const n = t.replace(a, b);
  assert.notEqual(n, t, `the change did not apply: ${a}`);
  return n;
};

test("RB-1 the runbooks keep the order, the owner's steps and the command forms", () => {
  const [r, i, readme] = files();
  assert.deepEqual(orderFindings(r, i), []);
  assert.deepEqual(commandFindings([r, i, readme]), []);
});

test("RB-2 each damaged form is red with the finding of its rule", () => {
  const [r, i, readme] = files();
  const rollback =
    "npx vercel@64.1.0 rollback <previous production deployment URL>   # verify at spike S1\n";
  const reopen =
    "2. `npx vercel@64.1.0 redeploy <current production deployment URL>` (verify at spike S1).";
  const commands = (/** @type {string} */ release, incident = i) =>
    commandFindings([release, incident, readme]);
  /** @type {Array<[string, string[]]>} */
  const cases = [
    // The damaged forms the criterion names, and --force.
    [
      "rollback --yes",
      commands(
        change(
          r,
          "rollback <previous production deployment URL>",
          "rollback <previous production deployment URL> --yes",
        ),
      ),
    ],
    [
      "deploy --token",
      commands(
        change(r, "deploy --prod --yes", "deploy --prod --yes --token x"),
      ),
    ],
    [
      "pins 64.1.0,64.2.0",
      commands(change(r, "vercel@64.1.0 promote", "vercel@64.2.0 promote")),
    ],
    [
      "pins 64.1.0,latest",
      commands(change(r, "vercel@64.1.0 promote", "vercel@latest promote")),
    ],
    ["vercel link", commands(`${r}\nnpx vercel@64.1.0 link\n`)],
    [
      "rollback without the S1 words",
      commands(
        change(r, rollback, rollback.replace("   # verify at spike S1", "")),
      ),
    ],
    [
      "deploy --force",
      commands(change(r, "deploy --prod --yes", "deploy --prod --force --yes")),
    ],
    // Options before the command, short options, a deploy without its word, no pin, no npx, another
    // command.
    [
      "deploy --token",
      commands(
        change(
          r,
          "npx vercel@64.1.0 deploy",
          "npx vercel@64.1.0 --token x deploy",
        ),
      ),
    ],
    [
      "rollback --yes",
      commands(
        change(
          r,
          "npx vercel@64.1.0 rollback",
          "npx vercel@64.1.0 --yes rollback",
        ),
      ),
    ],
    [
      "rollback --yes",
      commands(
        change(
          r,
          rollback,
          `${rollback}npx vercel@64.1.0 --scope s rollback <url> --yes   # verify at spike S1\n`,
        ),
      ),
    ],
    [
      "rollback -y",
      commands(
        change(
          r,
          "rollback <previous production deployment URL>   #",
          "rollback <previous production deployment URL> -y   #",
        ),
      ),
    ],
    [
      "deploy --token",
      commands(
        change(r, rollback, `${rollback}npx vercel@64.1.0 --prod --token x\n`),
      ),
    ],
    [
      "vercel without an exact pin",
      commands(
        change(
          r,
          rollback,
          "npx vercel rollback <previous production deployment URL>   # verify at spike S1\n",
        ),
      ),
    ],
    [
      "vercel without an exact pin",
      commands(
        r,
        change(
          i,
          reopen,
          "2. `npx vercel redeploy <current production deployment URL>` (verify at spike S1).",
        ),
      ),
    ],
    [
      "redeploy without the S1 words",
      commands(
        r,
        change(i, reopen, reopen.replace(" (verify at spike S1)", "")),
      ),
    ],
    [
      "redeploy --force",
      commands(
        r,
        change(
          i,
          reopen,
          reopen.replace("redeploy <", "--scope t redeploy --force <"),
        ),
      ),
    ],
    [
      "vercel without npx",
      commands(
        change(r, "npx vercel@64.1.0 rollback", "vercel@64.1.0 rollback"),
      ),
    ],
    ["vercel env", commands(`${r}\nnpx vercel@64.1.0 env pull .env\n`)],
    [
      "ids without the S1 words",
      commands(
        change(
          r,
          "cd <clone>/app && VERCEL_ORG_ID=<id> VERCEL_PROJECT_ID=<id> npx",
          "export VERCEL_ORG_ID=<id> VERCEL_PROJECT_ID=<id>\ncd <clone>/app && npx",
        ),
      ),
    ],
    // The items of the release order and of the owner's steps.
    [
      "release order: VERCEL_ORG_ID=",
      orderFindings(change(r, "VERCEL_ORG_ID=<id> ", ""), i),
    ],
    [
      "release order: VERCEL_PROJECT_ID=",
      orderFindings(change(r, "VERCEL_PROJECT_ID=<id> ", ""), i),
    ],
    [
      "release order: --expect-version <sha>",
      orderFindings(change(r, " --expect-version <sha>", ""), i),
    ],
    [
      "release order: On Hobby only the previous production deployment",
      orderFindings(
        change(
          r,
          "On Hobby only the previous production deployment can be rolled back to; ",
          "",
        ),
        i,
      ),
    ],
    [
      "release order: turns the automatic assignment of the production domains back on",
      orderFindings(
        change(
          r,
          "turns the automatic assignment of the production domains back on",
          "is the next step",
        ),
        i,
      ),
    ],
    [
      "release order: rm -rf",
      orderFindings(change(r, "rm -rf ", "remove "), i),
    ],
    [
      "incident order: redeploy <current production deployment URL>",
      orderFindings(r, change(i, reopen, "2. Опубликуйте сайт снова.")),
    ],
    [
      "incident order: promote <new deployment URL>",
      orderFindings(
        r,
        change(
          i,
          "     `npx vercel@64.1.0 promote <new deployment URL>` (verify at spike S1).\n",
          "",
        ),
      ),
    ],
    [
      "incident order: Сразу сообщите",
      orderFindings(
        r,
        change(i, "Сразу сообщите, какой шаг не сработал, и с", "С"),
      ),
    ],
    [
      "incident order: повторите шаг 2",
      orderFindings(r, change(i, "повторите шаг 2", "подождите")),
    ],
    [
      "incident: An agent only asks",
      orderFindings(r, change(i, "An agent only asks", "The owner")),
    ],
  ];
  for (const [label, found] of cases)
    assert.ok(found.includes(label), `${label}: ${JSON.stringify(found)}`);
});
