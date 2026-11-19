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
  // The addresses outside /api show the platform's 404 page, the /api addresses the function's 503 (N6).
  for (const s of [
    "Production",
    "страницу 404 платформы",
    "адреса /api отвечают кодом 503",
    "An agent only asks",
  ])
    if (!incident.includes(s)) out.push(`incident: ${s}`);
  // incident.md, in this order: the close with its redeploy and its check (the 404 page outside /api, the
  // 503 of /api, and what the closed output without 404.html answers, which S1 measures), the next step
  // when the site is still open (report at once; promote the new deployment, or build it again, and when
  // the build fails again note the deployment on the address and close without a build by promoting the
  // closed Production deployment built in advance, whose making S1 measures), then the way back with its
  // own redeploy, or, after a close by promote and instead of that redeploy, the promote of the noted
  // deployment, which after a rollback is not the newest one.
  const steps = [
    "## Закрыть сайт",
    "`SITE_GATE` = `closed`",
    "только для новой публикации",
    "redeploy <current production deployment URL>",
    "«Сервис временно остановлен владельцем»",
    "503",
    "адреса вне /api показывают собственную страницу 404 платформы, а адреса /api отвечают кодом 503.",
    "а в закрытой публикации этого файла нет",
    "что тогда отвечает Vercel, измерит и запишет сюда проверка S1",
    "Сразу сообщите",
    "promote <new deployment URL>",
    "повторите шаг 2",
    "без новой сборки",
    "Запишите адрес публикации, которая сейчас стоит на адресе",
    "закрытую публикацию Production, собранную один раз заранее",
    "promote <closed deployment URL>",
    "поэтому закрытая публикация должна быть публикацией Production",
    "Как собрать её заранее",
    "измерит и запишет сюда проверка S1",
    "## Открыть снова",
    "пустым",
    "дальше делайте не шаг 2",
    "redeploy <current production deployment URL>",
    "вместо шага 2",
    "чей адрес вы записали в шаге 4",
    "а не самая новая",
    "promote <last open production deployment URL>",
  ];
  let k = -1;
  for (const s of steps) {
    const i = incident.indexOf(s, k + 1);
    if (i < 0) out.push(`incident order: ${s}`);
    else k = i;
  }
  // The way back never puts the closed deployment on the address again.
  const back = incident.indexOf("## Открыть снова");
  if (back >= 0 && incident.includes("<closed deployment URL>", back))
    out.push("incident: the closed deployment in the way back");
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
  // The close without a build, when the closed build fails again (SEC-8).
  const closedPromote =
    "     `npx vercel@64.1.0 promote <closed deployment URL>` (verify at spike S1).\n";
  const noteCurrent =
    " Запишите адрес публикации, которая сейчас стоит на адресе (в списке Deployments она отмечена Current): он нужен, чтобы открыть сайт снова.";
  const closedBranch = `   - Сборка не удалась и при повторе шага 2: закройте сайт без новой сборки.${noteCurrent} Поставьте на адрес закрытую публикацию Production, собранную один раз заранее:\n${closedPromote}`;
  // The S1 paragraph of the closed deployment, and the way back after a close by promote (SEC-8).
  const between = (/** @type {string} */ a, /** @type {string} */ b) => {
    const from = i.indexOf(a);
    const to = i.indexOf(b, from);
    assert.ok(from >= 0 && to > from, `not in incident.md: ${a} … ${b}`);
    return i.slice(from, to + (b.startsWith("##") ? 0 : b.length));
  };
  const closedMaking = between(
    "   Закрытая публикация хранит",
    "## Открыть снова",
  );
  const openPromote =
    "   `npx vercel@64.1.0 promote <last open production deployment URL>` (verify at spike S1).";
  const reopenBranch = between("   Если сайт закрыли", openPromote);
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
    // The close without a build: the branch gone, its words gone, its S1 words gone.
    [
      "incident order: promote <closed deployment URL>",
      orderFindings(r, change(i, closedBranch, "")),
    ],
    [
      "incident order: без новой сборки",
      orderFindings(
        r,
        change(i, "закройте сайт без новой сборки", "закройте сайт"),
      ),
    ],
    [
      "promote without the S1 words",
      commands(
        r,
        change(
          i,
          closedPromote,
          closedPromote.replace(" (verify at spike S1)", ""),
        ),
      ),
    ],
    [
      "incident: адреса /api отвечают кодом 503",
      orderFindings(r, change(i, ", а адреса /api отвечают кодом 503", "")),
    ],
    // The 404 sentence turned back to «every other address», its 503 clause moved to a note.
    [
      "incident order: адреса вне /api показывают собственную страницу 404 платформы, а адреса /api отвечают кодом 503.",
      orderFindings(
        r,
        change(
          i,
          "Остальные адреса вне /api показывают собственную страницу 404 платформы, а адреса /api отвечают кодом 503.",
          "Остальные адреса показывают собственную страницу 404 платформы. (Неверно, что адреса /api отвечают кодом 503.)",
        ),
      ),
    ],
    // The closed deployment: not said to be Production, not said to be built in advance, the S1 paragraph
    // on how to build it gone.
    [
      "incident order: закрытую публикацию Production, собранную один раз заранее",
      orderFindings(
        r,
        change(i, "закрытую публикацию Production,", "закрытую публикацию,"),
      ),
    ],
    [
      "incident order: закрытую публикацию Production, собранную один раз заранее",
      orderFindings(
        r,
        change(
          i,
          "закрытую публикацию Production, собранную один раз заранее:",
          "закрытую публикацию Production:",
        ),
      ),
    ],
    [
      "incident order: Как собрать её заранее",
      orderFindings(r, change(i, closedMaking, "")),
    ],
    // The way back after a close by promote: the pointer of step 1 gone, the branch gone, its S1 words gone.
    [
      "incident order: дальше делайте не шаг 2",
      orderFindings(
        r,
        change(
          i,
          " Если сайт закрыли по последнему пункту шага 4, дальше делайте не шаг 2, а то, что написано под ним.",
          "",
        ),
      ),
    ],
    [
      "incident order: promote <last open production deployment URL>",
      orderFindings(r, change(i, reopenBranch, "")),
    ],
    [
      "promote without the S1 words",
      commands(
        r,
        change(
          i,
          openPromote,
          openPromote.replace(" (verify at spike S1)", ""),
        ),
      ),
    ],
    // The 503 of /api taken back by a parenthesis before the end of the sentence.
    [
      "incident order: адреса вне /api показывают собственную страницу 404 платформы, а адреса /api отвечают кодом 503.",
      orderFindings(
        r,
        change(
          i,
          "а адреса /api отвечают кодом 503.",
          "а адреса /api отвечают кодом 503 (это проверять не нужно).",
        ),
      ),
    ],
    // What the closed output answers outside /api: the missing 404.html not said, the S1 words gone (N6).
    [
      "incident order: а в закрытой публикации этого файла нет",
      orderFindings(
        r,
        change(
          i,
          "а в закрытой публикации этого файла нет",
          "и этот файл есть в любой публикации",
        ),
      ),
    ],
    [
      "incident order: что тогда отвечает Vercel, измерит и запишет сюда проверка S1",
      orderFindings(
        r,
        change(
          i,
          "что тогда отвечает Vercel, измерит и запишет сюда проверка S1",
          "тогда Vercel показывает свою страницу",
        ),
      ),
    ],
    // The closed deployment: the reason it must be a Production deployment turned around, the S1 promise on
    // how to build it replaced by «decide yourself», and the way back promoting it again (SEC-8).
    [
      "incident order: поэтому закрытая публикация должна быть публикацией Production",
      orderFindings(
        r,
        change(
          i,
          "поэтому закрытая публикация должна быть публикацией Production",
          "поэтому закрытая публикация может быть любой",
        ),
      ),
    ],
    [
      "incident: the closed deployment in the way back",
      orderFindings(
        r,
        change(
          i,
          openPromote,
          `${openPromote}\n   Потом поставьте закрытую: \`npx vercel@64.1.0 promote <closed deployment URL>\` (verify at spike S1).`,
        ),
      ),
    ],
    [
      "incident order: измерит и запишет сюда проверка S1",
      orderFindings(
        r,
        change(
          i,
          "Как собрать её заранее, её адрес и то, что `promote` ставит её на адрес без сборки, измерит и запишет сюда проверка S1.",
          "Как собрать её заранее, решите сами; `promote` всегда ставит её на адрес без сборки.",
        ),
      ),
    ],
    // The way back after a close by promote: the deployment on the address not noted before the close,
    // the promote done after the redeploy instead of in its place, the noted deployment replaced by the
    // newest open build (after a rollback that is the bad release).
    [
      "incident order: Запишите адрес публикации, которая сейчас стоит на адресе",
      orderFindings(r, change(i, noteCurrent, "")),
    ],
    [
      "incident order: вместо шага 2",
      orderFindings(
        r,
        change(
          i,
          "после шага 1 сделайте это вместо шага 2",
          "после шага 2 сделайте ещё и это",
        ),
      ),
    ],
    [
      "incident order: чей адрес вы записали в шаге 4",
      orderFindings(
        r,
        change(i, "чей адрес вы записали в шаге 4", "что стоит там сейчас"),
      ),
    ],
    [
      "incident order: а не самая новая",
      orderFindings(
        r,
        change(
          i,
          ", — ту, чей адрес вы записали в шаге 4 (до закрытия она была отмечена Current; после отката это та, на которую откатились, а не самая новая):",
          " (последний выпуск, собранный при пустом `SITE_GATE`):",
        ),
      ),
    ],
    [
      "incident: An agent only asks",
      orderFindings(r, change(i, "An agent only asks", "The owner")),
    ],
  ];
  for (const [label, found] of cases)
    assert.ok(found.includes(label), `${label}: ${JSON.stringify(found)}`);
});
