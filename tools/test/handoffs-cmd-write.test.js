// REQ-039, criterion 6 (design 10, HO-40...HO-45, HO-76): the command writes only into
// handoffs/<RUN-ID>/ and leaves no litter, whatever the outcome. Failures of the disk are
// injected into the process of the command with tools/test/fault-inject.js (the --import
// mode): a link, a write of the temporary file, mkdir, an unlink, a rename, a kill.
// After each, the files and folders of the repository are looked at.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { handoffNames } from "../src/handoffs/build.js";
import {
  FAKE_ID,
  FAKE_REL,
  FAKE_RUN,
  assertRefusal,
  baseTag,
  canonArgs,
  describe,
  doc,
  fileHashes,
  listTree,
  newArgs,
  newCmdRepo,
  recipientWrites,
} from "./handoffs-helpers.js";

const TMP = `handoffs/${FAKE_RUN}/.${path.posix.basename(FAKE_REL)}.sai-tmp`;
const abs = (sai, rel) => path.join(sai.root, rel);

// A repository with the tag of the run and an old handoff of another run, committed.
function withOld(t) {
  const sai = newCmdRepo(t);
  const old = "handoffs/OLD-20260101-01/step-01-a.json";
  sai.writeDoc(old, doc(old, { run_id: "OLD-20260101-01" }));
  sai.commit("2025-01-05T00:00:00Z", { message: "old handoff" });
  sai.tag(baseTag(FAKE_RUN));
  return sai;
}

const recipient = (sai, rel) =>
  recipientWrites(sai, rel, {
    status: "IN_PROGRESS",
    result: { status: "COMPLETED", summary: "s" },
  });

test("HO-40 new and close touch nothing but the file of the run: the listing of files differs by the new file and its folder only, git status shows one new folder, the old handoffs have the same hashes", (t) => {
  const sai = withOld(t);
  assert.equal(sai.status(), "");
  const before = listTree(sai.root);
  const hashes = fileHashes(sai.root);
  const r = sai.cmd(canonArgs());
  assert.equal(r.status, 0, describe(r));
  const added = listTree(sai.root).filter((x) => !before.includes(x));
  assert.deepEqual(added, [`handoffs/${FAKE_RUN}/`, FAKE_REL]);
  assert.deepEqual(
    listTree(sai.root).filter((x) => before.includes(x)),
    before,
  );
  assert.equal(sai.status(), `?? handoffs/${FAKE_RUN}/\n`);
  const after = fileHashes(sai.root);
  for (const [rel, hash] of Object.entries(hashes))
    assert.equal(after[rel], hash, rel);

  recipient(sai, FAKE_REL);
  const afterRecipient = fileHashes(sai.root);
  const c = sai.cmd(["close", FAKE_REL, "--status", "COMPLETED"]);
  assert.equal(c.status, 0, describe(c));
  const afterClose = fileHashes(sai.root);
  const changed = Object.keys(afterClose).filter(
    (k) => afterClose[k] !== afterRecipient[k],
  );
  assert.deepEqual(changed, [FAKE_REL]);
  assert.deepEqual(Object.keys(afterClose), Object.keys(afterRecipient));
  assert.equal(sai.status(), `?? handoffs/${FAKE_RUN}/\n`);
});

// A failure inside the process of the command; the state is as it was.
function injected(t, faults, { args = canonArgs(), setup, cwdOf } = {}) {
  const sai = withOld(t);
  setup?.(sai);
  const before = listTree(sai.root);
  const hashes = fileHashes(sai.root);
  const r = sai.cmd(args, { faults: faults(sai) });
  return { sai, r, before, hashes, cwdOf };
}

function assertNothingLeft(x, name) {
  assert.deepEqual(listTree(x.sai.root), x.before, name);
  assert.deepEqual(fileHashes(x.sai.root), x.hashes, name);
}

test("HO-41a a refused or failed link: code 2 E_HO_IO, no file, no temporary file, the folders made by the run are removed (EPERM, EXDEV: the file system has no hard links; ENOSPC)", (t) => {
  for (const [code, part] of [
    ["EPERM", "жёсткие ссылки"],
    ["EXDEV", "жёсткие ссылки"],
    ["ENOSPC", "создание файла"],
  ]) {
    const x = injected(t, (sai) => [
      {
        fn: "linkSync",
        from: abs(sai, TMP),
        to: abs(sai, FAKE_REL),
        effect: "throw",
        code,
      },
    ]);
    const line = assertRefusal(x.r, 2, "E_HO_IO");
    assert.ok(line.includes(part) && line.includes(`(${code})`), line);
    assert.ok(!line.includes(x.sai.dir), line);
    assertNothingLeft(x, code);
  }
});

test("HO-41b the write of the temporary file fails (half written, or refused): code 2, the half file is removed, the folders made by the run are removed", (t) => {
  for (const effect of ["partial", "throw"]) {
    const x = injected(t, (sai) => [
      {
        fn: "writeFileSync",
        paths: [abs(sai, TMP)],
        effect,
        code: "ENOSPC",
      },
    ]);
    const line = assertRefusal(x.r, 2, "E_HO_IO");
    assert.ok(line.includes("(ENOSPC)"), line);
    assertNothingLeft(x, effect);
  }
});

test("HO-41c mkdir fails (the folder of the run, or handoffs): code 2, what the run made is removed, what was there stays", (t) => {
  const first = injected(t, (sai) => [
    {
      fn: "mkdirSync",
      paths: [abs(sai, `handoffs/${FAKE_RUN}`)],
      effect: "throw",
      code: "EACCES",
    },
  ]);
  assertRefusal(first.r, 2, "E_HO_IO");
  assertNothingLeft(first, "run folder");

  // `handoffs` itself does not exist: the folder is made by the run and removed again.
  const second = injected(
    t,
    (sai) => [
      {
        fn: "mkdirSync",
        paths: [abs(sai, `handoffs/${FAKE_RUN}`)],
        effect: "throw",
        code: "EIO",
      },
    ],
    {
      setup: (sai) => {
        fs.rmSync(abs(sai, "handoffs"), { recursive: true });
        sai.commit("2025-01-06T00:00:00Z");
      },
    },
  );
  assertRefusal(second.r, 2, "E_HO_IO");
  assertNothingLeft(second, "handoffs made by the run");
  assert.ok(!fs.existsSync(abs(second.sai, "handoffs")));
});

test("HO-41d the temporary file cannot be removed after the link (N2): the file is made and whole, stdout is empty, code 2, one line names the file, the handoff_id and the leftover; after removing it the next new says that the file exists", (t) => {
  const x = injected(t, (sai) => [
    {
      fn: "unlinkSync",
      paths: [abs(sai, TMP)],
      effect: "throw",
      code: "EACCES",
    },
  ]);
  const line = assertRefusal(x.r, 2, "E_HO_IO");
  assert.ok(
    line.includes(
      `файл создан (${FAKE_REL}, ${FAKE_ID}), но временный файл не удалён: ${TMP}`,
    ),
    line,
  );
  assert.equal(x.r.stdout, "");
  assert.equal(x.sai.json(FAKE_REL).handoff_id, FAKE_ID);
  assert.deepEqual(
    listTree(x.sai.root)
      .filter((p) => !x.before.includes(p))
      .sort(),
    [`handoffs/${FAKE_RUN}/`, FAKE_REL, TMP].sort(),
  );
  fs.unlinkSync(abs(x.sai, TMP));
  assertRefusal(x.sai.cmd(canonArgs()), 1, "E_HO_EXISTS");
});

test("HO-41e the process is killed before the link: no file, a leftover temporary file; the next new answers E_HO_BUSY and does not touch it; after its removal new works", (t) => {
  const x = injected(t, (sai) => [
    { fn: "linkSync", from: abs(sai, TMP), effect: "kill" },
  ]);
  assert.equal(x.r.status, null, describe(x.r));
  assert.ok(!fs.existsSync(abs(x.sai, FAKE_REL)));
  assert.ok(fs.existsSync(abs(x.sai, TMP)));
  const leftover = fileHashes(x.sai.root)[TMP];
  assertRefusal(x.sai.cmd(canonArgs()), 1, "E_HO_BUSY");
  assert.equal(fileHashes(x.sai.root)[TMP], leftover);
  fs.unlinkSync(abs(x.sai, TMP));
  const again = x.sai.cmd(canonArgs());
  assert.equal(again.status, 0, describe(again));
  assert.equal(x.sai.json(FAKE_REL).handoff_id, FAKE_ID);
});

test("HO-41f F2: the link answers EEXIST - the own temporary file is removed, code 1 E_HO_EXISTS; when its removal fails too - code 2 and the leftover is named", (t) => {
  const link = (sai) => ({
    fn: "linkSync",
    from: abs(sai, TMP),
    to: abs(sai, FAKE_REL),
    effect: "throw",
    code: "EEXIST",
  });
  const first = injected(t, (sai) => [link(sai)]);
  assertRefusal(first.r, 1, "E_HO_EXISTS");
  assertNothingLeft(first, "EEXIST");

  const second = injected(t, (sai) => [
    link(sai),
    {
      fn: "unlinkSync",
      paths: [abs(sai, TMP)],
      effect: "throw",
      code: "EACCES",
    },
  ]);
  const line = assertRefusal(second.r, 2, "E_HO_IO");
  assert.ok(line.includes(`временный файл не удалён: ${TMP}`), line);
  assert.ok(fs.existsSync(abs(second.sai, TMP)));
  assert.ok(!fs.existsSync(abs(second.sai, FAKE_REL)));
});

test("HO-41g F4: the second search of handoff_id cannot read a file - the link and the temporary file are removed, code 2, the existing files are as they were; if the link cannot be removed - code 2 and the file is named", (t) => {
  const other = "handoffs/OTHER-20260101-01/step-01-z.json";
  const put = (sai) => {
    sai.write(other, `${JSON.stringify({ handoff_id: "step99-unrelated" })}\n`);
    sai.commit("2025-01-06T00:00:00Z");
  };
  const lstat = (sai) => ({
    fn: "lstatSync",
    paths: [abs(sai, other)],
    nth: 2,
    effect: "throw",
    code: "EACCES",
  });
  const first = injected(t, (sai) => [lstat(sai)], { setup: put });
  const line = assertRefusal(first.r, 2, "E_HO_IO");
  assert.ok(
    line.includes(
      "повторный поиск handoff_id не удался (EACCES); handoff не создан",
    ),
    line,
  );
  assertNothingLeft(first, "second search");

  const second = injected(
    t,
    (sai) => [
      lstat(sai),
      {
        fn: "unlinkSync",
        paths: [abs(sai, FAKE_REL)],
        effect: "throw",
        code: "EACCES",
      },
    ],
    { setup: put },
  );
  const text = assertRefusal(second.r, 2, "E_HO_IO");
  assert.ok(text.includes(`файл ${FAKE_REL} создан, но не подтверждён`), text);
  assert.ok(fs.existsSync(abs(second.sai, FAKE_REL)));
  assert.ok(!fs.existsSync(abs(second.sai, TMP)));
});

// A closable file in a repository; returns what the failure tests of close need.
function closing(t) {
  const sai = withOld(t);
  assert.equal(sai.cmd(canonArgs()).status, 0);
  recipient(sai, FAKE_REL);
  const side = (suffix) =>
    `handoffs/${FAKE_RUN}/.${path.posix.basename(FAKE_REL)}${suffix}`;
  return { sai, tmp: side(".sai-tmp"), old: side(".sai-old") };
}

test("HO-42 failures of the write in close: the file is as it was byte for byte, no .sai-tmp and no .sai-old, code 2 E_HO_WRITE, one line in Russian with the reason by the code of the system", (t) => {
  const cases = [
    [
      "rename EACCES",
      (c) => ({
        fn: "renameSync",
        from: abs(c.sai, c.tmp),
        effect: "throw",
        code: "EACCES",
      }),
      "нет права записи",
    ],
    [
      "rename EIO",
      (c) => ({
        fn: "renameSync",
        from: abs(c.sai, c.tmp),
        effect: "throw",
        code: "EIO",
      }),
      "ошибка ввода-вывода диска",
    ],
    [
      "write half",
      (c) => ({
        fn: "writeFileSync",
        paths: [abs(c.sai, c.tmp)],
        effect: "partial",
        code: "ENOSPC",
      }),
      "на диске нет места",
    ],
    [
      "backup link",
      (c) => ({
        fn: "linkSync",
        from: abs(c.sai, FAKE_REL),
        to: abs(c.sai, c.old),
        effect: "throw",
        code: "EROFS",
      }),
      "нет права записи",
    ],
  ];
  for (const [name, fault, reason] of cases) {
    const c = closing(t);
    const bytes = c.sai.read(FAKE_REL);
    const listing = listTree(c.sai.root);
    const r = c.sai.cmd(["close", FAKE_REL, "--status", "COMPLETED"], {
      faults: [fault(c)],
    });
    const line = assertRefusal(r, 2, "E_HO_WRITE");
    assert.ok(
      line.includes(`запись не удалась: ${FAKE_REL}: ${reason}`) &&
        line.endsWith("; файл прежний"),
      `${name}: ${line}`,
    );
    assert.doesNotMatch(line, /cannot|could not|rollback|injected/iu, name);
    assert.ok(!line.includes(c.sai.dir), name);
    assert.deepEqual(c.sai.read(FAKE_REL), bytes, name);
    assert.deepEqual(listTree(c.sai.root), listing, name);
  }
});

test("HO-42b the write is done but the backup cannot be removed: the file is closed and whole, the line says so and names the leftover, stdout is empty, code 2", (t) => {
  const c = closing(t);
  const r = c.sai.cmd(["close", FAKE_REL, "--status", "COMPLETED"], {
    faults: [
      {
        fn: "unlinkSync",
        paths: [abs(c.sai, c.old)],
        effect: "throw",
        code: "EACCES",
      },
    ],
  });
  const line = assertRefusal(r, 2, "E_HO_WRITE");
  assert.ok(
    line.includes(
      `файл закрыт (${FAKE_REL}), но резервный файл не удалён: ${c.old}; удалите его вручную`,
    ),
    line,
  );
  const d = c.sai.json(FAKE_REL);
  assert.equal(d.status, "COMPLETED");
  assert.match(d.completed_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u);
  assert.ok(fs.existsSync(abs(c.sai, c.old)));
  assert.ok(!fs.existsSync(abs(c.sai, c.tmp)));
});

test("HO-42c the rename fails and the cleanup fails too: the file is as it was, the line names what is left to remove by hand", (t) => {
  const c = closing(t);
  const bytes = c.sai.read(FAKE_REL);
  const r = c.sai.cmd(["close", FAKE_REL, "--status", "COMPLETED"], {
    faults: [
      {
        fn: "renameSync",
        from: abs(c.sai, c.tmp),
        effect: "throw",
        code: "EIO",
      },
      {
        fn: "unlinkSync",
        paths: [abs(c.sai, c.old)],
        effect: "throw",
        code: "EACCES",
      },
    ],
  });
  const line = assertRefusal(r, 2, "E_HO_WRITE");
  assert.ok(line.includes("файл прежний"), line);
  assert.ok(line.includes(`остались ${c.old}; удалите вручную`), line);
  assert.deepEqual(c.sai.read(FAKE_REL), bytes);
  assert.ok(fs.existsSync(abs(c.sai, c.old)));
});

test("HO-43 the code: one writeFileSync in tools/src/handoffs/ (the temporary file of create.js, exclusive), no rename, linkSync in create.js, writeAllOrNothing in close.js", () => {
  const dir = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "src",
    "handoffs",
  );
  const files = Object.fromEntries(
    fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".js"))
      .map((n) => [n, fs.readFileSync(path.join(dir, n), "utf8")]),
  );
  const hits = Object.entries(files).flatMap(([name, body]) =>
    body
      .split("\n")
      .flatMap((line) => (line.includes("writeFileSync") ? [name] : [])),
  );
  assert.deepEqual(hits, ["create.js"]);
  assert.match(files["create.js"], /writeFileSync\([\s\S]*?flag: "wx"/u);
  for (const [name, body] of Object.entries(files)) {
    assert.doesNotMatch(
      body,
      /renameSync|\.rename\(|copyFileSync|\.cpSync\(/u,
      name,
    );
  }
  assert.match(files["create.js"], /fs\.linkSync\(/u);
  assert.match(files["close.js"], /writeAllOrNothing\(/u);
  assert.doesNotMatch(files["close.js"], /linkSync|unlinkSync\(\w*abs\(rel\)/u);
});

test("HO-44 hostile values in run, step, qualifier, suffix and role are refused and nothing is made; accepted values give a path inside handoffs/<RUN-ID>/", (t) => {
  const sai = withOld(t);
  const hostile = [
    "..",
    "../x",
    "a/b",
    "a\\b",
    "a b",
    "a\nb",
    ".hidden",
    "x".repeat(3000),
    `${FAKE_RUN}/../x`,
    "",
  ];
  const before = listTree(sai.root);
  const hashes = fileHashes(sai.root);
  for (const key of ["run", "step", "qualifier", "suffix", "role"])
    for (const value of hostile) {
      const r = sai.cmd(canonArgs({ workflow: "WF-01", [key]: value }));
      assert.notEqual(
        r.status,
        0,
        `${key}=${JSON.stringify(value).slice(0, 20)}`,
      );
      assert.ok(r.status === 1 || r.status === 2);
      assert.equal(r.stdout, "");
    }
  assert.deepEqual(listTree(sai.root), before);
  assert.deepEqual(fileHashes(sai.root), hashes);

  const good = [
    ["ISS-0002-20260930-01", "00", "CODE-FIXER", "a-b-c1", "v9999"],
    ["A1-20991231-99", "99z", "ORCH", undefined, "r1"],
    ["AUD-001-20261012-01", "05b", "REVIEWER", "market", undefined],
  ];
  for (const [run, step, role, qualifier, suffix] of good) {
    const r = sai.cmd(
      newArgs({
        run,
        step,
        role,
        workflow: "WF-01",
        task: "t",
        qualifier,
        suffix,
      }),
    );
    assert.equal(r.status, 0, describe(r));
    const rel = r.stdout.split("\n")[0];
    assert.equal(rel, handoffNames({ run, step, role, qualifier, suffix }).rel);
    const inside = path.posix.relative(`handoffs/${run}`, rel);
    assert.ok(!inside.startsWith("..") && !inside.includes("/"), inside);
    assert.ok(fs.existsSync(abs(sai, rel)));
  }
});

test("HO-45 the tree outside of handoffs/ is as it was after any run, successful or refused, injected or not", (t) => {
  const sai = withOld(t);
  const outside = () =>
    Object.fromEntries(
      Object.entries(fileHashes(sai.root)).filter(
        ([k]) => !k.startsWith("handoffs/"),
      ),
    );
  const before = outside();
  const dirs = () =>
    listTree(sai.root).filter((p) => !p.startsWith("handoffs"));
  const dirsBefore = dirs();
  sai.cmd(canonArgs());
  sai.cmd(canonArgs());
  sai.cmd(canonArgs({ step: "5b" }));
  sai.cmd(canonArgs({ workflow: "WF-02", step: "06", suffix: undefined }));
  recipient(sai, FAKE_REL);
  sai.cmd(["close", FAKE_REL, "--status", "COMPLETED"]);
  sai.cmd(["close", FAKE_REL, "--status", "COMPLETED"]);
  sai.cmd(["close", "docs/x.json", "--status", "COMPLETED"]);
  sai.cmd(canonArgs({ step: "07" }), {
    faults: [
      {
        fn: "linkSync",
        from: abs(
          sai,
          `handoffs/${FAKE_RUN}/.step-07-test-design-validator-req999-r1.json.sai-tmp`,
        ),
        effect: "throw",
        code: "ENOSPC",
      },
    ],
  });
  assert.deepEqual(outside(), before);
  assert.deepEqual(dirs(), dirsBefore);
});

test("HO-76 the command does not need or touch tools/handoffs/exceptions.tsv, tools/traces/ or decisions/: new and close work in a repository without them", (t) => {
  const sai = withOld(t);
  fs.rmSync(abs(sai, "tools"), { recursive: true });
  fs.rmSync(abs(sai, "decisions"), { recursive: true });
  sai.commit("2025-01-07T00:00:00Z", { message: "without tools" });
  const r = sai.cmd(canonArgs());
  assert.equal(r.status, 0, describe(r));
  recipient(sai, FAKE_REL);
  const c = sai.cmd(["close", FAKE_REL, "--status", "COMPLETED"]);
  assert.equal(c.status, 0, describe(c));
  assert.ok(!fs.existsSync(abs(sai, "tools")));
  assert.ok(!fs.existsSync(abs(sai, "decisions")));
});
