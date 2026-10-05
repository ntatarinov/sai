// L01-L09 (design REQ-002 §9.6): the strict listing tree() of helpers.js is the tool that
// every write-phase row measures "nothing changed" with, so it is tested itself. These
// rows behave the same on the code before the fix and after it; their strength is the
// mutants of tree() (§9.7, M16).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { listing, makeFifo, makeSocket, tree } from "./helpers.js";

const HELPERS_URL = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "helpers.js"),
).href;

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sai-listing-"));
}

test("L01 an added empty folder makes the two listings differ", () => {
  const root = scratch();
  fs.writeFileSync(path.join(root, "file.txt"), "text");
  const before = tree(root);
  fs.mkdirSync(path.join(root, "empty"));
  const after = tree(root);
  assert.notEqual(after, before);
  assert.match(after, /^d \d{4} - - - empty$/m);
});

test("L02 added nested empty folders a/b make the two listings differ", () => {
  const root = scratch();
  const before = tree(root);
  fs.mkdirSync(path.join(root, "a", "b"), { recursive: true });
  const after = tree(root);
  assert.notEqual(after, before);
  assert.match(after, /^d \d{4} - - - a$/m);
  assert.match(after, /^d \d{4} - - - a\/b$/m);
});

test("L03 a file mode 0644 -> 0444, and separately a folder mode 0755 -> 0555, make the listings differ", () => {
  const root = scratch();
  const file = path.join(root, "file.txt");
  const folder = path.join(root, "folder");
  fs.writeFileSync(file, "text");
  fs.mkdirSync(folder);
  fs.chmodSync(file, 0o644);
  fs.chmodSync(folder, 0o755);
  try {
    const fileBefore = tree(root);
    fs.chmodSync(file, 0o444);
    const fileAfter = tree(root);
    assert.notEqual(fileAfter, fileBefore);
    assert.match(fileBefore, /^f 0644 4 [0-9a-f]{64} \d+ file\.txt$/m);
    assert.match(fileAfter, /^f 0444 4 [0-9a-f]{64} \d+ file\.txt$/m);

    const folderBefore = tree(root);
    fs.chmodSync(folder, 0o555);
    const folderAfter = tree(root);
    assert.notEqual(folderAfter, folderBefore);
    assert.match(folderBefore, /^d 0755 - - - folder$/m);
    assert.match(folderAfter, /^d 0555 - - - folder$/m);
  } finally {
    fs.chmodSync(folder, 0o755);
  }
});

test("L04 an added dangling link, and separately a changed link text, make the listings differ", () => {
  const root = scratch();
  const before = tree(root);
  const link = path.join(root, "link");
  fs.symlinkSync("missing/x", link);
  const added = tree(root);
  assert.notEqual(added, before);
  assert.match(added, /^l \d{4} - -> missing\/x - link$/m);

  fs.unlinkSync(link);
  fs.symlinkSync("missing/y", link);
  const changed = tree(root);
  assert.notEqual(changed, added);
  assert.match(changed, /^l \d{4} - -> missing\/y - link$/m);
});

test("L05 a file rewritten with the same bytes but another modification time makes the listings differ", () => {
  const root = scratch();
  const file = path.join(root, "file.txt");
  fs.writeFileSync(file, "same bytes");
  fs.utimesSync(file, 1_000_000_000, 1_000_000_000);
  const before = listing(root).get("file.txt");
  const beforeText = tree(root);
  fs.writeFileSync(file, "same bytes");
  fs.utimesSync(file, 1_500_000_000, 1_500_000_000);
  const after = listing(root).get("file.txt");
  assert.equal(after.sha, before.sha, "the bytes are the same");
  assert.equal(after.size, before.size);
  assert.notEqual(after.mtimeNs, before.mtimeNs);
  assert.notEqual(tree(root), beforeText);
});

test("L06 a file created and removed in a folder (its time changes) leaves the listings equal", () => {
  const root = scratch();
  const folder = path.join(root, "folder");
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, "kept.txt"), "kept");
  fs.utimesSync(folder, 1_000_000_000, 1_000_000_000);
  const before = tree(root);
  fs.writeFileSync(path.join(folder, "temporary"), "x");
  fs.rmSync(path.join(folder, "temporary"));
  assert.notEqual(
    fs.statSync(folder).mtimeMs,
    1_000_000_000_000,
    "the time of the folder must have changed",
  );
  assert.equal(tree(root), before);
});

// Relies on file permissions being enforced, i.e. the suite does not run as root.
test("L07 a file with mode 000 does not make tree() throw and is shown as unreadable", () => {
  const root = scratch();
  const file = path.join(root, "secret.txt");
  fs.writeFileSync(file, "text");
  fs.chmodSync(file, 0o000);
  try {
    const text = tree(root);
    assert.match(text, /^f 0000 4 unreadable \d+ secret\.txt$/m);
  } finally {
    fs.chmodSync(file, 0o644);
  }
});

test("L08 a file and a folder outside the root given as extra are listed, and a change to the file shows", () => {
  const root = scratch();
  const outside = scratch();
  const file = path.join(outside, "outside.txt");
  const folder = path.join(outside, "folder");
  fs.writeFileSync(file, "outside");
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, "inner.txt"), "inner");
  const before = tree(root, file, folder);
  for (const listed of [file, folder, path.join(folder, "inner.txt")]) {
    assert.ok(before.includes(` ${listed}`), `${listed} must be listed`);
  }
  assert.equal(tree(root).includes(outside), false, "not listed without extra");
  fs.appendFileSync(file, " changed");
  assert.notEqual(tree(root, file, folder), before);
});

test("L09 a pipe and a socket in the root are listed as other, never opened, and make the listings differ", () => {
  const root = scratch();
  fs.writeFileSync(path.join(root, "file.txt"), "text");
  const before = tree(root);
  const undoPipe = makeFifo(path.join(root, "pipe"));
  try {
    const undoSocket = makeSocket(path.join(root, "socket"));
    try {
      // tree() runs in a child process with a time limit: a tree() that opened the
      // pipe would hang for ever, and here it is killed and the row fails.
      const child = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import { tree } from ${JSON.stringify(HELPERS_URL)}; process.stdout.write(tree(process.argv[1]));`,
          root,
        ],
        { encoding: "utf8", timeout: 10_000 },
      );
      assert.equal(
        child.status,
        0,
        `tree() must finish in time: ${JSON.stringify({ signal: child.signal, error: child.error?.code, stderr: child.stderr })}`,
      );
      assert.match(child.stdout, /^o \d{4} - - - pipe$/m);
      assert.match(child.stdout, /^o \d{4} - - - socket$/m);
      assert.notEqual(child.stdout, before);
    } finally {
      undoSocket();
    }
  } finally {
    undoPipe();
  }
});
