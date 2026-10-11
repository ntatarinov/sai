// REQ-039, criterion 2 (design 10, HO-10...HO-15): the tag of the base `base/<RUN-ID>`.
// A run of WF-02 without the tag is refused and nothing is made; any process with the
// tag gets `context.base_tag`; without the tag the other processes get no such field.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { tagExists } from "../src/handoffs/git-history.js";
import {
  FAKE_REL,
  FAKE_RUN,
  assertRefusal,
  baseTag,
  canonArgs,
  describe,
  newCmdRepo,
  runHandoff,
} from "./handoffs-helpers.js";

test("HO-10 WF-02 without the tag: code 1, one line with decisions/0031 and the tag name, no folder of the run, the tree as it was", (t) => {
  const sai = newCmdRepo(t);
  const before = sai.tree();
  const status = sai.status();
  const r = sai.cmd(canonArgs());
  const line = assertRefusal(r, 1, "E_HO_BASE");
  assert.ok(line.includes("decisions/0031"), line);
  assert.ok(line.includes(`base/${FAKE_RUN}`), line);
  assert.ok(!fs.existsSync(path.join(sai.root, "handoffs", FAKE_RUN)));
  assert.equal(sai.tree(), before);
  assert.equal(sai.status(), status);
});

test("HO-11 WF-01 without the tag: code 0, the file is made, context has no base_tag", (t) => {
  const sai = newCmdRepo(t);
  const r = sai.cmd(canonArgs({ workflow: "WF-01" }));
  assert.equal(r.status, 0, describe(r));
  const d = sai.json(FAKE_REL);
  assert.ok(!("base_tag" in d.context));
  assert.deepEqual(Object.keys(d.context), [
    "requirement_ids",
    "agent_run_id",
    "artifacts_in",
  ]);
});

test("HO-11b every process WF-01...WF-07 with the tag gets context.base_tag equal to base/<RUN-ID>", (t) => {
  const sai = newCmdRepo(t);
  sai.tag(baseTag(FAKE_RUN));
  for (let n = 1; n <= 7; n++) {
    const r = sai.cmd(
      canonArgs({
        workflow: `WF-0${n}`,
        step: `0${n}`,
        suffix: undefined,
        qualifier: undefined,
      }),
    );
    assert.equal(r.status, 0, describe(r));
    const rel = `handoffs/${FAKE_RUN}/step-0${n}-test-design-validator.json`;
    assert.equal(
      sai.json(rel).context.base_tag,
      `base/${FAKE_RUN}`,
      `WF-0${n}`,
    );
  }
});

test("HO-12 a light tag and an annotated tag count; a tag of another run, a branch of that name, a tag of a neighbour number and a tag that is not a commit do not", (t) => {
  const light = newCmdRepo(t);
  light.tag(baseTag(FAKE_RUN));
  assert.equal(light.cmd(canonArgs()).status, 0);
  assert.equal(light.json(FAKE_REL).context.base_tag, `base/${FAKE_RUN}`);

  const annotated = newCmdRepo(t);
  annotated.tag(baseTag(FAKE_RUN), { annotated: true });
  const a = annotated.cmd(canonArgs());
  assert.equal(a.status, 0, describe(a));
  assert.equal(annotated.json(FAKE_REL).context.base_tag, `base/${FAKE_RUN}`);

  // None of these is the tag of the run: WF-02 is refused, nothing is made.
  const wrong = [
    ["a tag of another run", (s) => s.tag("base/PROD-20991231-77")],
    ["a tag of the neighbour number", (s) => s.tag("base/PROD-20991231-02")],
    ["a tag without the prefix", (s) => s.tag(FAKE_RUN)],
    ["a branch of that name", (s) => s.git("branch", baseTag(FAKE_RUN))],
    [
      "a tag of a tree",
      (s) =>
        s.git(
          "tag",
          baseTag(FAKE_RUN),
          s.git("rev-parse", "HEAD^{tree}").trim(),
        ),
    ],
  ];
  for (const [name, put] of wrong) {
    const sai = newCmdRepo(t);
    put(sai);
    const before = sai.tree();
    const r = sai.cmd(canonArgs());
    assertRefusal(r, 1, "E_HO_BASE");
    assert.equal(sai.tree(), before, name);
  }
});

test("HO-13 failures of git: outside of a repository and without git the code is 2, one line, no stack, no path of the computer, nothing is written", (t) => {
  const sai = newCmdRepo(t);
  const outside = path.join(sai.dir, "outside");
  fs.mkdirSync(outside);
  const r = runHandoff(canonArgs({ workflow: "WF-01" }), {
    cwd: outside,
    env: sai.env,
  });
  const line = assertRefusal(r, 2, "E_TRACE_NOT_GIT");
  assert.ok(!line.includes(sai.dir), line);
  assert.deepEqual(fs.readdirSync(outside), []);

  const emptyBin = path.join(sai.dir, "empty-bin");
  fs.mkdirSync(emptyBin);
  const before = sai.tree();
  const noGit = sai.cmd(canonArgs({ workflow: "WF-01" }), {
    env: { PATH: emptyBin },
  });
  const noLine = assertRefusal(noGit, 2, "E_TRACE_GIT");
  assert.ok(noLine.includes("git не найден"), noLine);
  assert.ok(!noLine.includes(sai.dir), noLine);
  assert.equal(sai.tree(), before);
});

test("HO-14 tagExists: a name that does not fit the pattern of RUN-ID is refused before any call of git; a tag is true, no tag is false", (t) => {
  const sai = newCmdRepo(t);
  sai.tag(baseTag(FAKE_RUN));
  assert.equal(tagExists(sai.root, FAKE_RUN), true);
  assert.equal(tagExists(sai.root, "PROD-20991231-02"), false);
  assert.equal(tagExists(sai.root, "ISS-0002-20260930-01"), false);
  const bad = [
    "--upload-pack=x",
    "PROD 20991231-01",
    "../x",
    "PROD-20991231-01\n",
    "",
    "prod-20991231-01",
    "PROD-20991231-1",
    "-PROD-20991231-01",
    undefined,
    null,
  ];
  // A folder that is not a repository: a call of git would be code 2 (E_TRACE_*); a bad
  // name must be refused earlier, with its own code.
  const nowhere = path.join(sai.dir, "nowhere");
  for (const name of bad)
    assert.throws(
      () => tagExists(nowhere, name),
      (e) => e.code === "E_HO_BASE_TAG",
      String(name),
    );
});

test("HO-15 the other processes without the tag (WF-03, WF-07 and the rest) make the file with no base_tag; only WF-02 is refused", (t) => {
  const sai = newCmdRepo(t);
  for (const n of [3, 4, 5, 6, 7]) {
    const r = sai.cmd(
      canonArgs({
        workflow: `WF-0${n}`,
        step: `0${n}`,
        suffix: undefined,
        qualifier: undefined,
      }),
    );
    assert.equal(r.status, 0, describe(r));
    const rel = `handoffs/${FAKE_RUN}/step-0${n}-test-design-validator.json`;
    assert.ok(!("base_tag" in sai.json(rel).context), `WF-0${n}`);
  }
  const refused = sai.cmd(canonArgs({ step: "09", suffix: undefined }));
  assertRefusal(refused, 1, "E_HO_BASE");
});

test("HO-13b git answers with an unexpected code to the question about the tag (a stand-in script on PATH): code 2 E_TRACE_GIT, one line, no stack, nothing is written", (t) => {
  const sai = newCmdRepo(t);
  const real = spawnSync("sh", ["-c", "command -v git"], {
    env: sai.env,
    encoding: "utf8",
  }).stdout.trim();
  assert.ok(real.startsWith("/"), real);
  const bin = path.join(sai.dir, "stand-in");
  fs.mkdirSync(bin);
  const script = path.join(bin, "git");
  fs.writeFileSync(
    script,
    [
      "#!/bin/sh",
      'case "$*" in',
      '  *"--verify --quiet refs/tags/base/"*) exit 3;;',
      "esac",
      `exec "${real}" "$@"`,
      "",
    ].join("\n"),
  );
  fs.chmodSync(script, 0o755);
  const before = sai.tree();
  const r = sai.cmd(canonArgs({ workflow: "WF-01" }), {
    env: { PATH: `${bin}${path.delimiter}${sai.env.PATH}` },
  });
  const line = assertRefusal(r, 2, "E_TRACE_GIT");
  assert.ok(line.includes("git не смог выполнить команду (код 3)"), line);
  assert.ok(!line.includes(sai.dir), line);
  assert.equal(sai.tree(), before);
  // The same script with the question answered by the real git works as before.
  const ok = sai.cmd(canonArgs({ workflow: "WF-01" }));
  assert.equal(ok.status, 0, describe(ok));
});
