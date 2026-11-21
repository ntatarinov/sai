import assert from "node:assert/strict";
import { test } from "node:test";
import { readRoot } from "../fixtures/helpers.js";

// REQ-108 criteria 11 and 12 (the checks of the docker job) and REQ-109 criterion 6 (the smoke step). Line
// rules over .github/workflows/app.yml.

const PATHS = [
  "app/**",
  "docs/runbooks/**",
  "tools/package.json",
  "tools/src/team/**",
  "tools/src/pixel-office/mask.js",
  ".github/workflows/app.yml",
];

// The steps of the docker job (REQ-108 criterion 12, REQ-109 criterion 6), each an exact line of the job,
// in this order: the build and `up --wait`, then every check of the running containers, the smoke last.
const DOCKER_STEPS = [
  ["docker build", "run: docker compose -f app/compose.yaml build"],
  ["docker up", "run: docker compose -f app/compose.yaml up -d --wait"],
  [
    "docker node -v",
    "run: docker compose -f app/compose.yaml exec -T web node -v",
  ],
  [
    "docker / 200",
    "curl -sS -o page.html -w '%{http_code}\\n' http://127.0.0.1:8080/ | grep -qx 200",
  ],
  ["docker / bytes", "cmp page.html app/public/index.html"],
  [
    "docker /nope 404",
    "curl -sS -o nope.html -w '%{http_code}\\n' http://127.0.0.1:8080/nope | grep -qx 404",
  ],
  ["docker /nope bytes", "cmp nope.html app/public/404.html"],
  [
    "docker uniform 404",
    `test "$(curl -sS http://127.0.0.1:8080/api/x/y)" = '{"error":"not_found"}'`,
  ],
  [
    "docker preview 307",
    `test "$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Host: localhost:8080' http://127.0.0.1:8080/x)" = "307 http://127.0.0.1:8080/x"`,
  ],
  [
    "docker uid",
    'run: test "$(docker compose -f app/compose.yaml exec -T web id -u)" != "0"',
  ],
  [
    "docker 0001 row",
    `run: test "$(docker compose -f app/compose.yaml exec -T db psql -U postgres -d sai -Atc 'select name from schema_migrations')" = "0001_init.sql"`,
  ],
  [
    "docker probe health",
    "curl -sS -o /dev/null http://127.0.0.1:8080/api/health",
  ],
  [
    "docker probe rows",
    `rows="$(docker compose -f app/compose.yaml exec -T db psql -U postgres -d sai -Atc "select usename from pg_stat_activity where datname = 'sai' and backend_type = 'client backend' and pid <> pg_backend_pid()")"`,
  ],
  ["docker probe sai_app_login", 'echo "$rows" | grep -qx sai_app_login'],
  [
    "docker probe no postgres",
    'if echo "$rows" | grep -qx postgres; then exit 1; fi',
  ],
  [
    "docker smoke",
    "run: node app/scripts/smoke.js --base http://127.0.0.1:8080 --preview http://localhost:8080",
  ],
];

// The options of `docker run`, `docker create` and `docker pull` that take no value (Docker's CLI
// reference, read, not measured). Any other option is read as taking the next word, so the word read as
// the image is the first word that no option takes.
const DOCKER_RUN_FLAGS = [
  "-d",
  "--detach",
  "-i",
  "--interactive",
  "-t",
  "--tty",
  "-P",
  "--publish-all",
  "-q",
  "--quiet",
  "--rm",
  "--init",
  "--privileged",
  "--read-only",
  "--no-healthcheck",
  "--oom-kill-disable",
  "--disable-content-trust",
  "--sig-proxy",
];
const DOCKER_PULL_FLAGS = [
  "-a",
  "--all-tags",
  "-q",
  "--quiet",
  "--disable-content-trust",
];
// A word shaped like an image with a tag and no digest (`alpine:3.20`, `localhost:5000/x:1`).
const UNPINNED =
  /^(?:[a-z0-9.-]+(?::[0-9]+)?\/)?[a-z0-9][a-z0-9._/-]*:[A-Za-z0-9][\w.-]*$/;

/**
 * The word of the arguments of `docker run`, `create` or `pull` that Docker reads as the image, or "".
 * @param {string} command
 * @param {string} args
 */
export function dockerImageOf(command, args) {
  const flags = command === "pull" ? DOCKER_PULL_FLAGS : DOCKER_RUN_FLAGS;
  const words = args
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^["']+|["']+$/g, ""));
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w.startsWith("-")) return w;
    if (w.includes("=")) continue;
    const cluster =
      /^-[A-Za-z]+$/.test(w) &&
      [...w.slice(1)].every((c) => flags.includes(`-${c}`));
    if (!flags.includes(w) && !cluster) i++;
  }
  return "";
}

/** @param {string} text */
export function jobsOf(text) {
  const lines = text.split("\n");
  const at = lines.indexOf("jobs:");
  /** @type {Record<string, string>} */
  const jobs = {};
  let name = "";
  for (const l of lines.slice(at + 1)) {
    const m = /^ {2}([a-z][a-z0-9_-]*):$/.exec(l);
    if (m) {
      name = m[1];
      jobs[name] = "";
    } else if (name && (l.startsWith("    ") || l.trim() === ""))
      jobs[name] += `${l}\n`;
    else if (name && /^\S/.test(l)) break;
  }
  return jobs;
}

/** @param {string} text @returns {string[]} */
export function ciFindings(text) {
  const out = [];
  const lines = text.split("\n");
  const indent = (/** @type {string} */ l) => l.length - l.trimStart().length;
  /** The lines of the block under the exact line `head`, trimmed, blank lines left out. */
  const block = (/** @type {string} */ head) => {
    const i = lines.indexOf(head);
    if (i < 0) return [];
    const acc = [];
    for (const l of lines.slice(i + 1)) {
      if (l.trim() === "") continue;
      if (indent(l) <= indent(head)) break;
      acc.push(l.trim());
    }
    return acc;
  };
  /** The entries of the block under the exact line `head`: its lines indented less than `child`. */
  const entries = (/** @type {string} */ head, /** @type {number} */ child) => {
    const i = lines.indexOf(head);
    if (i < 0) return [];
    const acc = [];
    for (const l of lines.slice(i + 1)) {
      if (l.trim() === "" || l.trim().startsWith("#")) continue;
      if (indent(l) <= indent(head)) break;
      if (indent(l) < child) acc.push(l.trim());
    }
    return acc;
  };
  // The only trigger is push: one `on:` block whose only entry is `push:`, and push has exactly the
  // branches and the paths (a `tags:` beside them would run on any tag).
  if (
    lines.filter((l) => /^["']?on["']?\s*:/.test(l)).length !== 1 ||
    JSON.stringify(entries("on:", 4)) !== '["push:"]'
  )
    out.push("trigger");
  if (JSON.stringify(entries("  push:", 6)) !== '["branches:","paths:"]')
    out.push("push keys");
  if (
    JSON.stringify(block("    branches:")) !==
    JSON.stringify(["- main", '- "ci/**"'])
  )
    out.push("branches");
  if (
    JSON.stringify(block("    paths:")) !==
    JSON.stringify(PATHS.map((p) => `- "${p}"`))
  )
    out.push("paths");
  if (
    JSON.stringify(block("permissions:")) !== JSON.stringify(["contents: read"])
  )
    out.push("permissions");
  if (/^ {4}permissions:/m.test(text)) out.push("job permissions");
  for (const bad of ["pull_request_target", "secrets.", "${{ github.event"])
    if (text.includes(bad)) out.push(`text ${bad}`);
  for (const m of text.matchAll(/uses:\s*(\S+)/g))
    if (!/@[0-9a-f]{40}$/.test(m[1])) out.push(`uses ${m[1]}`);
  // Every image by digest, by five rules. The docker rules read the text with its shell line continuations
  // joined. (1) Each `docker run`, `create` and `pull` command (also as `docker image …` or `docker
  // container …`, after global options such as `--debug`, and with the word `docker` quoted): the word
  // Docker reads as the image carries `@sha256:`, some word does, and no word is an image with a tag and no
  // digest. (2) Each value of an `image:` or `container:` key (a job container or a service), the key
  // quoted or not, in block or flow style (`{ image: … }`). (3) Kept from the first step: every
  // other `postgres:<tag>` or `node:<tag>` text, such as a `--build-arg` of `docker buildx`. (4) Every
  // `--build-arg` value shaped like an image with a tag, quoted or not. (5) The image of every line of an
  // inline Dockerfile (a heredoc or an `echo` fed to `docker build -`): each word after `FROM` (and an
  // optional `--platform=…`), and after `from` in any letter case at the start of a line or right after a
  // quote, carries `@sha256:`, and so does every `docker-image://` source of a build context; after `from`
  // elsewhere, a word shaped like an image with a tag is red.
  const joined = text.replace(/\\\n\s*/g, " ");
  for (const m of joined.matchAll(
    /\bdocker["']?\s+(?:-\S+\s+(?:[^-\s]\S*\s+)?)*(?:(?:image|container)\s+)?(run|create|pull)\b([^\n;&|]*)/g,
  ))
    if (
      !/@sha256:[0-9a-f]{64}$/.test(dockerImageOf(m[1], m[2])) ||
      !/(^|\s)[^\s=]+@sha256:[0-9a-f]{64}(?=\s|$)/.test(m[2]) ||
      m[2]
        .split(/\s+/)
        .some((w) => UNPINNED.test(w.replace(/^["']+|["']+$/g, "")))
    )
      out.push(`image of docker ${m[1]}`);
  for (const m of text.matchAll(
    /(?:^\s*(?:-\s+)?|[{,]\s*)["']?(?:image|container)["']?\s*:[ \t]*([^\s,{}][^\n]*?)\s*(?=$|,|\})/gm,
  ))
    if (!/@sha256:[0-9a-f]{64}["']?$/.test(m[1])) out.push(`image ${m[1]}`);
  for (const m of joined.matchAll(/\b(postgres|node):[A-Za-z0-9][^\s"']*/g))
    if (!/@sha256:[0-9a-f]{64}$/.test(m[0])) out.push(`image ${m[0]}`);
  for (const m of joined.matchAll(
    /--build-arg[=\s]+["']?[A-Za-z_][A-Za-z0-9_]*=["']?([^\s"']+)/g,
  ))
    if (UNPINNED.test(m[1])) out.push(`image ${m[1]}`);
  for (const m of [
    ...joined.matchAll(
      /(?:^|[\s"'])FROM\s+(?:--platform=\S+\s+)?([^\s"';&|)]+)/gm,
    ),
    ...joined.matchAll(
      /(?:^[ \t]*|["'][ \t]*)from[ \t]+(?:--platform=\S+[ \t]+)?([^\s"';&|)]+)/gim,
    ),
    ...joined.matchAll(/docker-image:\/\/([^\s"',;&|)]+)/g),
  ])
    if (!/@sha256:[0-9a-f]{64}$/.test(m[1])) out.push(`image ${m[1]}`);
  for (const m of joined.matchAll(
    /(?:^|[\s"'])from\s+(?:--platform=\S+\s+)?([^\s"';&|)]+)/gim,
  ))
    if (UNPINNED.test(m[1])) out.push(`image ${m[1]}`);
  const jobs = jobsOf(text);
  if (JSON.stringify(Object.keys(jobs)) !== '["check","pg","docker"]')
    out.push("jobs");
  for (const [name, body] of Object.entries(jobs)) {
    if (!/^ {4}timeout-minutes: \d+$/m.test(body)) out.push(`${name} timeout`);
    const versions = [...body.matchAll(/node-version: "([^"]*)"/g)].map(
      (m) => m[1],
    );
    if (versions.length === 0) out.push(`${name} setup-node`);
    for (const v of versions) {
      const m = /^22\.(\d+)\.(\d+)$/.exec(v);
      if (!m || Number(m[1]) < 23 || (Number(m[1]) === 23 && Number(m[2]) < 4))
        out.push(`${name} node-version ${v}`);
    }
    if (!/run: node -v$/m.test(body)) out.push(`${name} node -v`);
  }
  const check = jobs.check ?? "";
  if (!/working-directory: tools\n\s+run: npm ci\n/.test(check))
    out.push("check tools npm ci");
  for (const step of [
    "npm ci",
    "npm run check",
    "npm audit --omit=dev --audit-level=high",
  ])
    if (
      !new RegExp(
        `working-directory: app\\n\\s+run: ${step.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n`,
      ).test(check)
    )
      out.push(`check app ${step}`);
  if (
    !/run: npm run test:pg\n/.test(jobs.pg ?? "") ||
    !/postgres:17@sha256:[0-9a-f]{64}/.test(jobs.pg ?? "")
  )
    out.push("pg job");
  // The steps of the docker job, in order; a step that is missing or out of place is red with its label.
  const docker = (jobs.docker ?? "").split("\n").map((l) => l.trim());
  let at = -1;
  for (const [label, line] of DOCKER_STEPS) {
    const i = docker.indexOf(line, at + 1);
    if (i < 0) out.push(label);
    else at = i;
  }
  if (/\|\||continue-on-error|set \+e/.test(text))
    out.push("a hidden exit code");
  if (/^\s+! /m.test(text)) out.push("a negated command");
  return out;
}

const change = (
  /** @type {string} */ t,
  /** @type {string} */ a,
  /** @type {string} */ b,
) => {
  const n = t.replace(a, b);
  assert.notEqual(n, t, `the change did not apply: ${a}`);
  return n;
};

/** The text without the line whose trimmed text is `line`. */
const dropLine = (/** @type {string} */ t, /** @type {string} */ line) => {
  const lines = t.split("\n");
  const i = lines.findIndex((l) => l.trim() === line);
  assert.ok(i >= 0, `the line is not in app.yml: ${line}`);
  return [...lines.slice(0, i), ...lines.slice(i + 1)].join("\n");
};

test("CIW-1 the real app.yml keeps every rule", () => {
  assert.deepEqual(ciFindings(readRoot(".github/workflows/app.yml")), []);
});

test("CIW-2 each damaged copy is red with the finding of the rule it breaks", () => {
  const t = readRoot(".github/workflows/app.yml");
  const pinned = t.match(/postgres:17@sha256:[0-9a-f]{64}/)?.[0] ?? "";
  const lastPath = '      - ".github/workflows/app.yml"\n';
  const audit = "      - name: Audit the production dependencies\n";
  const checkJob = "  check:\n    runs-on: ubuntu-24.04\n";
  const smoke =
    "run: node app/scripts/smoke.js --base http://127.0.0.1:8080 --preview http://localhost:8080\n";
  // A digest of 64 hex digits, built from parts, and a copy with one more step before the audit.
  const hex = "a".repeat(64);
  const step = (/** @type {string} */ run) =>
    change(t, audit, `      - name: Extra\n        run: ${run}\n${audit}`);
  // A copy whose extra step builds an image from a Dockerfile given on stdin by a heredoc.
  const heredoc = (/** @type {string} */ line) =>
    change(
      t,
      audit,
      `      - name: Extra\n        run: |\n          docker build -t x - <<'EOF'\n          ${line}\n          EOF\n${audit}`,
    );
  /** @type {Array<[string, string]>} */
  const cases = [
    ["trigger", change(t, "on:\n  push:", "on:\n  pull_request:\n  push:")],
    ["trigger", change(t, lastPath, `${lastPath}  workflow_call:\n`)],
    [
      "trigger",
      change(
        t,
        lastPath,
        `${lastPath}  issue_comment:\n    types: [created]\n`,
      ),
    ],
    ["trigger", change(t, lastPath, `${lastPath}  "repository_dispatch":\n`)],
    ["trigger", `${t}\non:\n  workflow_dispatch:\n`],
    ["push keys", change(t, "    paths:\n", '    tags: ["**"]\n    paths:\n')],
    ["branches", change(t, '      - "ci/**"\n', "")],
    ["branches", change(t, "      - main\n", "")],
    ["paths", change(t, '      - "docs/runbooks/**"\n', "")],
    ["permissions", change(t, "  contents: read", "  contents: write")],
    [
      "job permissions",
      change(
        t,
        "    runs-on: ubuntu-24.04\n    timeout-minutes: 15\n    steps:",
        "    runs-on: ubuntu-24.04\n    permissions:\n      contents: write\n    timeout-minutes: 15\n    steps:",
      ),
    ],
    ["text pull_request_target", `${t}\n# pull_request_target\n`],
    ["text secrets.", `${t}\n# \${{ secrets.X }}\n`],
    ["text ${{ github.event", `${t}\n# \${{ github.event.issue.title }}\n`],
    [
      "uses actions/checkout@v7",
      change(t, "@3d3c42e5aac5ba805825da76410c181273ba90b1", "@v7"),
    ],
    ["image of docker run", change(t, pinned, "postgres:17")],
    ["image of docker run", change(t, pinned, "postgres:latest")],
    [
      "image of docker run",
      change(
        t,
        audit,
        `      - name: Extra\n        run: docker run --rm alpine:3.20 true\n${audit}`,
      ),
    ],
    [
      "image of docker pull",
      change(
        t,
        audit,
        `      - name: Extra\n        run: docker pull node:lts\n${audit}`,
      ),
    ],
    // `docker image pull`, red by the command rule and by the image text rule, each on its own.
    [
      "image of docker pull",
      change(
        t,
        audit,
        `      - name: Extra\n        run: docker image pull postgres:17\n${audit}`,
      ),
    ],
    [
      "image postgres:17",
      change(
        t,
        audit,
        `      - name: Extra\n        run: docker image pull postgres:17\n${audit}`,
      ),
    ],
    [
      "image node:22",
      change(
        t,
        audit,
        `      - name: Extra\n        run: docker buildx build --build-arg BASE=node:22 -t x app\n${audit}`,
      ),
    ],
    [
      "image of docker pull",
      change(
        t,
        audit,
        `      - name: Extra\n        run: docker --debug pull node:lts\n${audit}`,
      ),
    ],
    [
      "image of docker create",
      change(
        t,
        audit,
        `      - name: Extra\n        run: docker container create alpine:3.20\n${audit}`,
      ),
    ],
    // A tag that is a word, a digest on a word that is not the image (with the image tagged or not), a
    // tagged image beside the pinned one, a command continued with `\`, and an image in any build-arg.
    [
      "image node:lts",
      step(`docker buildx build --build-arg BASE=node:lts -t x app`),
    ],
    [
      "image node:lts",
      change(
        t,
        audit,
        `      - name: Extra\n        env:\n          BASE: node:lts\n        run: docker buildx build -t x app\n${audit}`,
      ),
    ],
    [
      "image of docker run",
      step(`docker run --rm --label x@sha256:${hex} alpine:3.20 true`),
    ],
    [
      "image of docker run",
      step(`docker run --rm alpine:3.20 echo node@sha256:${hex}`),
    ],
    [
      "image of docker run",
      step(`docker run --rm --label x@sha256:${hex} alpine true`),
    ],
    [
      "image of docker run",
      step(`docker run --rm alpine echo x@sha256:${hex}`),
    ],
    [
      "image of docker run",
      step(`docker run --rm ${pinned} sh -c "docker pull alpine:3.20"`),
    ],
    [
      "image of docker pull",
      change(
        t,
        audit,
        `      - name: Extra\n        run: |\n          docker \\\n            pull alpine:3.20\n${audit}`,
      ),
    ],
    [
      "image alpine:3.20",
      step(`docker buildx build --build-arg BASE=alpine:3.20 -t x app`),
    ],
    // A quoted --build-arg value, an inline Dockerfile (a heredoc, an `echo`, a lower-case `from`, a FROM
    // without a tag) and a `docker-image://` build context.
    [
      "image alpine:3.20",
      step(`docker buildx build --build-arg BASE='alpine:3.20' -t x app`),
    ],
    [
      "image alpine:3.20",
      step(`docker buildx build --build-arg BASE="alpine:3.20" -t x app`),
    ],
    [
      "image ubuntu:24.04",
      step(`docker buildx build --build-arg=BASE='ubuntu:24.04' -t x app`),
    ],
    ["image alpine:3.20", heredoc("FROM alpine:3.20")],
    [
      "image alpine:3.20",
      step(`echo "FROM alpine:3.20" | docker build -t x -`),
    ],
    ["image alpine:3.20", heredoc("from --platform=linux/amd64 alpine:3.20")],
    ["image alpine", heredoc("FROM alpine")],
    ["image alpine:3.20", step(`echo from alpine:3.20 | docker build -t x -`)],
    [
      "image alpine:3.20",
      step(
        `docker buildx build --build-context base=docker-image://alpine:3.20 -t x app`,
      ),
    ],
    [
      "image ubuntu:24.04",
      change(t, checkJob, `${checkJob}    container: ubuntu:24.04\n`),
    ],
    [
      "image redis:7",
      change(
        t,
        checkJob,
        `${checkJob}    services:\n      cache:\n        image: redis:7\n`,
      ),
    ],
    // The key quoted, the flow style, and the word `docker` quoted.
    [
      "image redis:7",
      change(
        t,
        checkJob,
        `${checkJob}    services:\n      cache:\n        "image": redis:7\n`,
      ),
    ],
    [
      "image ubuntu:24.04",
      change(t, checkJob, `${checkJob}    'container': ubuntu:24.04\n`),
    ],
    [
      "image alpine:3.20",
      change(
        t,
        checkJob,
        `${checkJob}    services: { cache: { image: alpine:3.20 } }\n`,
      ),
    ],
    [
      "image ubuntu:24.04",
      change(
        t,
        checkJob,
        `${checkJob}    container: { image: ubuntu:24.04 }\n`,
      ),
    ],
    ["image of docker run", step(`"docker" run --rm alpine:3.20 true`)],
    [
      "jobs",
      change(t, "jobs:\n", "jobs:\n  e2e:\n    runs-on: ubuntu-24.04\n"),
    ],
    ["docker timeout", change(t, "    timeout-minutes: 20\n", "")],
    [
      "check node-version 22.23.3",
      change(t, 'node-version: "22.23.4"', 'node-version: "22.23.3"'),
    ],
    [
      "check node-version 22",
      change(t, 'node-version: "22.23.4"', 'node-version: "22"'),
    ],
    ["check setup-node", change(t, '          node-version: "22.23.4"\n', "")],
    [
      "check node -v",
      change(t, "      - name: Node version\n        run: node -v\n", ""),
    ],
    [
      "check tools npm ci",
      change(
        t,
        "working-directory: tools\n        run: npm ci\n",
        "working-directory: tools\n        run: npm install\n",
      ),
    ],
    [
      "check app npm ci",
      change(
        t,
        "      - name: Install the app dependencies\n        working-directory: app\n        run: npm ci\n      - name: Run the app check\n",
        "      - name: Run the app check\n",
      ),
    ],
    [
      "check app npm run check",
      change(t, "run: npm run check\n", "run: npm run test:unit\n"),
    ],
    [
      "check app npm audit --omit=dev --audit-level=high",
      change(
        t,
        "run: npm audit --omit=dev --audit-level=high",
        "run: npm audit",
      ),
    ],
    ["pg job", change(t, "run: npm run test:pg", "run: npm run test:unit")],
    ...DOCKER_STEPS.map(
      ([label, line]) =>
        /** @type {[string, string]} */ ([label, dropLine(t, line)]),
    ),
    [
      "docker smoke",
      // The smoke moved before `up --wait`.
      change(
        change(
          t,
          `      - name: Smoke against the container\n        ${smoke}`,
          "",
        ),
        "      - name: Start db and web\n",
        `      - name: Smoke against the container\n        ${smoke}      - name: Start db and web\n`,
      ),
    ],
    ["a hidden exit code", change(t, smoke, `${smoke.slice(0, -1)} || true\n`)],
    [
      "a hidden exit code",
      change(
        t,
        "    timeout-minutes: 20\n",
        "    timeout-minutes: 20\n    continue-on-error: true\n",
      ),
    ],
    [
      "a hidden exit code",
      change(
        t,
        "        run: |\n          pw=",
        "        run: |\n          set +e\n          pw=",
      ),
    ],
    [
      "a negated command",
      change(
        t,
        '          if echo "$rows" | grep -qx postgres; then exit 1; fi\n',
        '          ! echo "$rows" | grep -qx postgres\n',
      ),
    ],
  ];
  for (const [label, copy] of cases)
    assert.ok(
      ciFindings(copy).includes(label),
      `${label}: ${JSON.stringify(ciFindings(copy))}`,
    );
  // A pinned image after options that take a value, on a continued line, in a quoted --build-arg, an inline
  // Dockerfile and a build context, stays green.
  for (const copy of [
    step(`docker run --rm --entrypoint sh -e A=1 -v x:/y ${pinned} -c true`),
    step(`docker buildx build --build-arg BASE='${pinned}' -t x app`),
    heredoc(`FROM --platform=linux/amd64 ${pinned}`),
    step(
      `docker buildx build --build-context base=docker-image://${pinned} -t x app`,
    ),
    change(
      t,
      audit,
      `      - name: Extra\n        run: |\n          docker \\\n            run -it --rm ${pinned} true\n${audit}`,
    ),
  ])
    assert.deepEqual(ciFindings(copy), []);
});
