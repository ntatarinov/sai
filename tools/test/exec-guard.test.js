// Tests of the guard of these tests themselves (design REQ-010, section 15.1: EX-38;
// criterion 13; lesson AP-025): the helper that every command and every direct call
// goes through refuses at once anything that could start a real Claude Code or reach
// a real data folder. Nothing here starts a process.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  FAULT_PATH,
  FIXTURES,
  assertSafeEnv,
  execEnv,
  fakeClaudePath,
  makeSandbox,
  runTeam,
  runTeamExpectRefusal,
} from "./exec-helpers.js";

// A copy of the shape of tools/test/fixtures/team in a temporary folder, so that the
// forms of the guard can be tried with files that exist and files that do not.
function fakeFixtures(t) {
  const sb = makeSandbox(t);
  const dir = path.join(sb.root, "fixtures-copy");
  fs.mkdirSync(dir);
  const exec = path.join(dir, "fake-claude.js");
  fs.writeFileSync(exec, "#!/usr/bin/env node\n");
  fs.chmodSync(exec, 0o755);
  const plain = path.join(dir, "plain-file.js");
  fs.writeFileSync(plain, "x\n");
  fs.chmodSync(plain, 0o644);
  const present = path.join(dir, "missing-present");
  fs.writeFileSync(present, "x\n");
  fs.chmodSync(present, 0o755);
  const outside = path.join(sb.root, "outside.js");
  fs.writeFileSync(outside, "#!/usr/bin/env node\n");
  fs.chmodSync(outside, 0o755);
  const outsideMissing = path.join(sb.root, "missing-outside");
  return { sb, dir, exec, plain, present, outside, outsideMissing };
}

function env(sb, over = {}) {
  return execEnv(sb, over);
}

test("EX-38 the helper lets through exactly the three forms of section 15.2", (t) => {
  const f = fakeFixtures(t);
  const pass = (over) => assertSafeEnv(env(f.sb, over), f.dir);
  // Form 1: a working file inside the fixtures, also through a link that ends there.
  pass({ SAI_TEAM_CLAUDE_BIN: f.exec });
  const link = path.join(f.sb.root, "link-to-fake");
  fs.symlinkSync(f.exec, link);
  pass({ SAI_TEAM_CLAUDE_BIN: link });
  // Form 2: "no file", missing-* in the fixtures.
  pass({ SAI_TEAM_CLAUDE_BIN: path.join(f.dir, "missing-claude") });
  // Form 3: a relative missing-* with an empty temporary folder as PATH.
  pass({
    SAI_TEAM_CLAUDE_BIN: "missing-claude-relative",
    PATH: f.sb.emptyPath,
  });
  // The real fixtures and the real fake file.
  assertSafeEnv(execEnv(f.sb));
  assert.equal(fakeClaudePath(), path.join(FIXTURES, "fake-claude.js"));
  fs.accessSync(fakeClaudePath(), fs.constants.X_OK);
});

test("EX-38 the helper throws for a file outside the fixtures, in any disguise", (t) => {
  const f = fakeFixtures(t);
  const bad = (bin, over = {}) =>
    assert.throws(
      () =>
        assertSafeEnv(env(f.sb, { SAI_TEAM_CLAUDE_BIN: bin, ...over }), f.dir),
      /exec test:/u,
      String(bin),
    );
  bad(undefined);
  bad("");
  bad("/bin/sh");
  bad("/usr/bin/env");
  bad(f.outside);
  // Through a link: the link is in a temporary folder but ends outside.
  const link = path.join(f.sb.root, "link-to-sh");
  fs.symlinkSync("/bin/sh", link);
  bad(link);
  const link2 = path.join(f.dir, "missing-link");
  fs.symlinkSync("/bin/sh", link2);
  bad(link2);
  // Through "..".
  bad(path.join(f.dir, "..", "outside.js"));
  bad(`${f.dir}/../outside.js`);
  // A folder, not a file.
  bad(f.dir);
  // A file that cannot be executed.
  bad(f.plain);
});

test("EX-38 a missing-* name: only when there is no file, only in the fixtures, only as a bare name with an empty PATH", (t) => {
  const f = fakeFixtures(t);
  const bad = (bin, over = {}) =>
    assert.throws(
      () =>
        assertSafeEnv(env(f.sb, { SAI_TEAM_CLAUDE_BIN: bin, ...over }), f.dir),
      /exec test:/u,
      String(bin),
    );
  bad(f.present); // missing-* in the fixtures, but the file is there
  bad(f.outsideMissing); // missing-* with no file, but outside the fixtures
  bad(path.join(f.dir, "sub", "missing-x")); // a folder that does not exist
  bad(path.join(f.dir, "not-missing-claude")); // no file, wrong prefix
  bad("claude", { PATH: f.sb.emptyPath });
  bad("claude");
  bad("./missing-x", { PATH: f.sb.emptyPath });
  bad("sub/missing-x", { PATH: f.sb.emptyPath });
  bad("not-missing", { PATH: f.sb.emptyPath });
  bad("missing-x", { PATH: "/usr/bin:/bin" }); // PATH is not empty
  bad("missing-x", { PATH: os.tmpdir() }); // a temporary folder, but not empty
  bad("missing-x", { PATH: undefined }); // no PATH at all
  bad("missing-x", { PATH: path.join(f.sb.root, "no-such-folder") });
  bad("missing-x", { PATH: "relative/path" });
  // A PATH folder that was empty, then got a file: not empty any more.
  const filled = path.join(f.sb.root, "filled-path");
  fs.mkdirSync(filled);
  fs.writeFileSync(path.join(filled, "claude"), "x");
  bad("missing-x", { PATH: filled });
});

test("EX-38 the data folder and HOME must be temporary and never the real ones", (t) => {
  const f = fakeFixtures(t);
  const bad = (over) =>
    assert.throws(
      () => assertSafeEnv(env(f.sb, over), f.dir),
      /exec test:/u,
      JSON.stringify(over),
    );
  const home = os.homedir();
  bad({ HOME: home });
  bad({ HOME: undefined });
  bad({ HOME: "relative/home" });
  bad({ SAI_TEAM_HOME: path.join(home, ".sai-team") });
  bad({ SAI_TEAM_HOME: path.join(home, ".sai-pixel-office") });
  bad({ SAI_TEAM_HOME: path.join(home, ".sai-team", "p-20260101-aaaaaa") });
  bad({ SAI_TEAM_HOME: undefined });
  bad({ SAI_TEAM_HOME: "team" });
  bad({ SAI_TEAM_HOME: "/" });
  bad({ SAI_TEAM_HOME: home });
  // A link in the temporary folder that leads into the real data folder.
  const link = path.join(f.sb.root, "to-real-team");
  fs.symlinkSync(path.join(home, ".sai-team"), link);
  bad({ SAI_TEAM_HOME: link });
  // A link in the temporary folder to the home folder of the user, and a path under it
  // that does not exist yet: the real path of the parent leads out, so it is refused.
  // The fake file is the good one, so that only the folder can be the reason.
  const toHome = path.join(f.sb.root, "to-home");
  fs.symlinkSync(home, toHome);
  const badFolder = (over, reason) =>
    assert.throws(
      () =>
        assertSafeEnv(
          env(f.sb, { SAI_TEAM_CLAUDE_BIN: f.exec, ...over }),
          f.dir,
        ),
      reason,
      JSON.stringify(over),
    );
  const outOfTmp = /is not inside the temporary folder/u;
  const realData = outOfTmp;
  badFolder({ SAI_TEAM_HOME: path.join(toHome, ".sai-team") }, realData);
  badFolder(
    { SAI_TEAM_HOME: path.join(toHome, ".sai-team", "x", "y") },
    realData,
  );
  badFolder(
    { SAI_TEAM_HOME: path.join(toHome, ".sai-pixel-office", "x") },
    realData,
  );
  badFolder(
    { SAI_TEAM_HOME: path.join(toHome, "nonexistent-folder-sai") },
    outOfTmp,
  );
  badFolder({ HOME: path.join(toHome, ".sai-team") }, realData);
  badFolder({ HOME: path.join(toHome, "nonexistent-folder-sai") }, outOfTmp);
  // A missing path whose parent is really inside the temporary folder stays allowed.
  assertSafeEnv(
    env(f.sb, {
      SAI_TEAM_HOME: path.join(f.sb.root, "later", "team"),
      SAI_TEAM_CLAUDE_BIN: f.exec,
    }),
    f.dir,
  );
  assert.throws(() => assertSafeEnv(null, f.dir), /exec test:/u);
});

test("EX-38 the runners refuse an unsafe environment before starting anything, and only allow a known --import", (t) => {
  const sb = makeSandbox(t);
  const good = execEnv(sb);
  for (const over of [
    { SAI_TEAM_CLAUDE_BIN: "/bin/sh" },
    { SAI_TEAM_CLAUDE_BIN: undefined },
    { SAI_TEAM_CLAUDE_BIN: "claude" },
    { HOME: os.homedir() },
    { SAI_TEAM_HOME: path.join(os.homedir(), ".sai-team") },
  ]) {
    assert.throws(
      () => runTeam(["projects"], execEnv(sb, over)),
      /exec test:/u,
    );
    assert.throws(
      () => runTeamExpectRefusal(["projects"], execEnv(sb, over)),
      /exec test:/u,
    );
  }
  for (const nodeArgs of [
    ["--import", "/etc/hosts"],
    ["--import", path.join(FIXTURES, "..", "..", "helpers.js")],
    ["--require", FAULT_PATH],
    ["--import"],
    ["--import", FAULT_PATH, "--x"],
    ["-e", "1"],
  ]) {
    assert.throws(
      () => runTeam(["projects"], good, nodeArgs),
      /exec test:/u,
      JSON.stringify(nodeArgs),
    );
  }
});
