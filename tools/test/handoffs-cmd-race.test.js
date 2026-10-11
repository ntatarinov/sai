// REQ-039, criterion 3 and 6 (design 10, HO-22, HO-23, HO-23b, HO-24): the exclusive
// creation of a file. Real parallel processes, and in-process runs of `createExclusive`
// in which the second writer is put in at the exact moment (a call of an fs function of
// the default object is replaced; nothing is done by permissions). The state after every
// refusal is looked at: no temporary file of its own, the file of the other writer as it
// was, the folders made by the run removed and the folders of others kept.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createExclusive } from "../src/handoffs/create.js";
import { HandoffError } from "../src/handoffs/errors.js";
import {
  describe,
  fileHashes,
  listTree,
  newArgs,
  newCmdRepo,
  startHandoff,
} from "./handoffs-helpers.js";

const WF01 = {
  step: "01",
  role: "BACKEND-DEV",
  workflow: "WF-01",
  task: "race",
};

test("HO-22 two parallel new with the same name, 20 times with a new folder each time: one code 0, one code 1 (E_HO_EXISTS or E_HO_BUSY, never E_HO_IO), one file, no temporary file, the folder is whole", async (t) => {
  const sai = newCmdRepo(t);
  const env = { ...sai.env };
  for (let n = 0; n < 20; n++) {
    const run = `PROD-20991231-${String(10 + n)}`;
    const args = newArgs({ ...WF01, run });
    const results = await Promise.all([
      startHandoff(args, { cwd: sai.root, env }),
      startHandoff(args, { cwd: sai.root, env }),
    ]);
    const codes = results.map((r) => r.status).sort();
    assert.deepEqual(codes, [0, 1], `run ${n}: ${JSON.stringify(results)}`);
    const loser = results.find((r) => r.status === 1);
    assert.match(loser.stderr, /^handoff: E_HO_(EXISTS|BUSY): /u, loser.stderr);
    assert.equal(loser.stdout, "");
    const rel = `handoffs/${run}/step-01-backend-dev.json`;
    assert.deepEqual(fs.readdirSync(path.join(sai.root, "handoffs", run)), [
      "step-01-backend-dev.json",
    ]);
    const winner = results.find((r) => r.status === 0);
    assert.equal(winner.stdout.split("\n")[0], rel);
    assert.equal(sai.json(rel).handoff_id, `step01-${run}`);
  }
});

test("HO-22b four parallel new with the same name: one file, three refusals, nothing left", async (t) => {
  const sai = newCmdRepo(t);
  const args = newArgs({ ...WF01, run: "PROD-20991231-60" });
  const results = await Promise.all(
    [1, 2, 3, 4].map(() => startHandoff(args, { cwd: sai.root, env: sai.env })),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [0, 1, 1, 1]);
  for (const r of results.filter((x) => x.status === 1))
    assert.match(r.stderr, /^handoff: E_HO_(EXISTS|BUSY): /u);
  assert.deepEqual(
    fs.readdirSync(path.join(sai.root, "handoffs", "PROD-20991231-60")),
    ["step-01-backend-dev.json"],
  );
});

// The pieces of an in-process run: a repository, a text, a name.
function setup(t, { run = "PROD-20991231-70", folder = false } = {}) {
  const sai = newCmdRepo(t);
  const rel = `handoffs/${run}/step-01-backend-dev.json`;
  const id = `step01-${run}`;
  const text = `${JSON.stringify({ handoff_id: id, mine: true }, null, 2)}\n`;
  if (folder)
    fs.mkdirSync(path.join(sai.root, "handoffs", run), { recursive: true });
  const abs = (r) => path.join(sai.root, r);
  const tmp = `handoffs/${run}/.step-01-backend-dev.json.sai-tmp`;
  return { sai, rel, id, text, abs, tmp, run };
}

const refused = (exit, code, part) => (e) =>
  e instanceof HandoffError &&
  e.exit === exit &&
  e.code === code &&
  (part === undefined || e.message.includes(part));

function osFault(code, path_) {
  const err = new Error(`${code}: injected`);
  err.code = code;
  err.syscall = "injected";
  err.path = path_;
  return err;
}

test("HO-23 the name is taken between the check and the link: E_HO_EXISTS, the file of the other is as it was, the own temporary file is gone, the folder stays", (t) => {
  for (const folder of [true, false]) {
    const s = setup(t, { folder });
    const real = fs.linkSync;
    const m = t.mock.method(fs, "linkSync", (from, to) => {
      fs.writeFileSync(to, "the other writer\n");
      return real(from, to);
    });
    assert.throws(
      () => createExclusive(s.sai.root, s.rel, s.text, s.id),
      refused(1, "E_HO_EXISTS", "файл уже есть"),
    );
    m.mock.restore();
    assert.equal(fs.readFileSync(s.abs(s.rel), "utf8"), "the other writer\n");
    assert.ok(!fs.existsSync(s.abs(s.tmp)), "own temporary file");
    assert.deepEqual(fs.readdirSync(path.dirname(s.abs(s.rel))), [
      path.basename(s.rel),
    ]);
  }
});

test("HO-23a the link is refused with EEXIST and the winner has already gone: the folders made by this run are removed", (t) => {
  const s = setup(t);
  const before = listTree(s.sai.root);
  t.mock.method(fs, "linkSync", () => {
    throw osFault("EEXIST");
  });
  assert.throws(
    () => createExclusive(s.sai.root, s.rel, s.text, s.id),
    refused(1, "E_HO_EXISTS"),
  );
  t.mock.restoreAll();
  assert.deepEqual(listTree(s.sai.root), before);
});

test("HO-23c the removal of the own temporary file fails after EEXIST: code 2, the text names the file that is left", (t) => {
  const s = setup(t, { folder: true });
  fs.writeFileSync(s.abs(s.rel), "the other writer\n");
  const realUnlink = fs.unlinkSync;
  t.mock.method(fs, "unlinkSync", (p) => {
    if (p === s.abs(s.tmp)) throw osFault("EACCES", p);
    return realUnlink(p);
  });
  assert.throws(
    () => createExclusive(s.sai.root, s.rel, s.text, s.id),
    refused(2, "E_HO_IO", s.tmp),
  );
  t.mock.restoreAll();
  assert.ok(fs.existsSync(s.abs(s.tmp)), "the file named in the text is there");
  assert.equal(fs.readFileSync(s.abs(s.rel), "utf8"), "the other writer\n");
});

test("HO-23b the folder of the run made by another run between the check and mkdir is a normal course: the file is made and the folder is not counted as made by this run", (t) => {
  const s = setup(t);
  const realMkdir = fs.mkdirSync;
  const m = t.mock.method(fs, "mkdirSync", (p, ...rest) => {
    if (p === s.abs(`handoffs/${s.run}`)) realMkdir(p);
    return realMkdir(p, ...rest);
  });
  createExclusive(s.sai.root, s.rel, s.text, s.id);
  m.mock.restore();
  assert.equal(fs.readFileSync(s.abs(s.rel), "utf8"), s.text);
  assert.ok(!fs.existsSync(s.abs(s.tmp)));

  // A later failure of the link: the folder of the other run is kept, the one made by
  // this run (handoffs) is removed only if it is empty - here it is not.
  const s2 = setup(t, { run: "PROD-20991231-71" });
  t.mock.method(fs, "mkdirSync", (p, ...rest) => {
    if (p === s2.abs(`handoffs/${s2.run}`)) realMkdir(p);
    return realMkdir(p, ...rest);
  });
  t.mock.method(fs, "linkSync", () => {
    throw osFault("ENOSPC");
  });
  assert.throws(
    () => createExclusive(s2.sai.root, s2.rel, s2.text, s2.id),
    refused(2, "E_HO_IO"),
  );
  t.mock.restoreAll();
  assert.ok(
    fs.existsSync(s2.abs(`handoffs/${s2.run}`)),
    "folder of the other run",
  );
  assert.deepEqual(fs.readdirSync(s2.abs(`handoffs/${s2.run}`)), []);
});

test("HO-23d the folder of the run turns into a link or a file in the same moment: code 2 E_HO_IO and nothing of its own is left; a folder that vanishes before the temporary file is code 2 too", (t) => {
  const realMkdir = fs.mkdirSync;
  const kinds = [
    [
      "a link",
      (s, p) => {
        fs.mkdirSync(s.abs("elsewhere-" + s.run), { recursive: true });
        fs.symlinkSync(s.abs("elsewhere-" + s.run), p);
      },
    ],
    ["a file", (_s, p) => fs.writeFileSync(p, "x\n")],
  ];
  for (const [name, put] of kinds) {
    const s = setup(t);
    t.mock.method(fs, "mkdirSync", (p, ...rest) => {
      if (p === s.abs(`handoffs/${s.run}`)) put(s, p);
      return realMkdir(p, ...rest);
    });
    assert.throws(
      () => createExclusive(s.sai.root, s.rel, s.text, s.id),
      refused(2, "E_HO_IO", "не папка"),
      name,
    );
    t.mock.restoreAll();
    assert.ok(!fs.existsSync(s.abs(s.tmp)), name);
    const linkTarget = s.abs("elsewhere-" + s.run);
    if (fs.existsSync(linkTarget))
      assert.deepEqual(fs.readdirSync(linkTarget), [], name);
  }

  const s = setup(t, { folder: true });
  const realWrite = fs.writeFileSync;
  t.mock.method(fs, "writeFileSync", (p, ...rest) => {
    if (p === s.abs(s.tmp)) fs.rmdirSync(path.dirname(p));
    return realWrite(p, ...rest);
  });
  assert.throws(
    () => createExclusive(s.sai.root, s.rel, s.text, s.id),
    refused(2, "E_HO_IO", "папка прогона исчезла"),
  );
  t.mock.restoreAll();
  assert.ok(!fs.existsSync(s.abs(s.tmp)));
  assert.ok(!fs.existsSync(s.abs(s.rel)));
});

function otherWithId(s, id) {
  const other = `handoffs/${s.run}/other.json`;
  fs.mkdirSync(s.abs(`handoffs/${s.run}`), { recursive: true });
  fs.writeFileSync(s.abs(other), `${JSON.stringify({ handoff_id: id })}\n`);
  return other;
}

test("HO-24 the same handoff_id appears in another file before the second search: the own link is removed, the other file is whole, E_HO_EXISTS; if the removal fails too - code 2 and the text names the file", (t) => {
  const s = setup(t);
  const other = otherWithId(s, s.id);
  const hashes = fileHashes(s.sai.root);
  assert.throws(
    () => createExclusive(s.sai.root, s.rel, s.text, s.id),
    refused(1, "E_HO_EXISTS", other),
  );
  assert.ok(!fs.existsSync(s.abs(s.rel)), "the own link");
  assert.ok(!fs.existsSync(s.abs(s.tmp)), "the own temporary file");
  assert.deepEqual(fileHashes(s.sai.root), hashes);

  // The removal of the own link fails.
  const realUnlink = fs.unlinkSync;
  t.mock.method(fs, "unlinkSync", (p) => {
    if (p === s.abs(s.rel)) throw osFault("EACCES", p);
    return realUnlink(p);
  });
  assert.throws(
    () => createExclusive(s.sai.root, s.rel, s.text, s.id),
    refused(2, "E_HO_IO", s.rel),
  );
  t.mock.restoreAll();
  assert.ok(fs.existsSync(s.abs(s.rel)), "the file named in the text is there");
  assert.ok(!fs.existsSync(s.abs(s.tmp)));
});

test("HO-24b F4: the second search of handoff_id fails (a file or a folder cannot be read): no file of its own is left, code 2 E_HO_IO, the files that were there are as they were", (t) => {
  for (const fault of ["readFileSync", "readdirSync", "lstatSync"]) {
    const s = setup(t, { run: "PROD-20991231-72" });
    const other = otherWithId(s, "step99-unrelated");
    const hashes = fileHashes(s.sai.root);
    const real = fs[fault];
    const target = fault === "readdirSync" ? s.abs("handoffs") : s.abs(other);
    t.mock.method(fs, fault, (p, ...rest) => {
      if (p === target) throw osFault("EACCES", p);
      return real(p, ...rest);
    });
    assert.throws(
      () => createExclusive(s.sai.root, s.rel, s.text, s.id),
      refused(
        2,
        "E_HO_IO",
        "повторный поиск handoff_id не удался (EACCES); handoff не создан",
      ),
      fault,
    );
    t.mock.restoreAll();
    assert.ok(!fs.existsSync(s.abs(s.rel)), `${fault}: own link`);
    assert.ok(!fs.existsSync(s.abs(s.tmp)), `${fault}: own temporary file`);
    assert.deepEqual(fileHashes(s.sai.root), hashes, fault);
  }

  // The search fails and the own link cannot be removed: code 2, the text names the file.
  const s = setup(t, { run: "PROD-20991231-73" });
  const other = otherWithId(s, "step99-unrelated");
  const realRead = fs.readFileSync;
  const realUnlink = fs.unlinkSync;
  t.mock.method(fs, "readFileSync", (p, ...rest) => {
    if (p === s.abs(other)) throw osFault("EIO", p);
    return realRead(p, ...rest);
  });
  t.mock.method(fs, "unlinkSync", (p) => {
    if (p === s.abs(s.rel)) throw osFault("EACCES", p);
    return realUnlink(p);
  });
  assert.throws(
    () => createExclusive(s.sai.root, s.rel, s.text, s.id),
    refused(2, "E_HO_IO", `файл ${s.rel} создан, но не подтверждён`),
  );
  t.mock.restoreAll();
  assert.ok(fs.existsSync(s.abs(s.rel)));
});

test("HO-24c the first search (before the write) finds the same handoff_id: refusal without any write, even without a link", (t) => {
  const sai = newCmdRepo(t);
  const a = sai.cmd(newArgs({ ...WF01, run: "PROD-20991231-74" }));
  assert.equal(a.status, 0, describe(a));
  const before = fileHashes(sai.root);
  const b = sai.cmd(
    newArgs({ ...WF01, run: "PROD-20991231-74", role: "REVIEWER" }),
  );
  assert.equal(b.status, 1, describe(b));
  assert.match(
    b.stderr,
    /^handoff: E_HO_EXISTS: handoff_id уже есть в файле /u,
  );
  assert.deepEqual(fileHashes(sai.root), before);
});
