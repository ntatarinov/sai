import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { snapshot, snapshotDiff } from "../src/snapshot.js";
import { makeProject } from "./helpers.js";

const ALLOW = ["STATE.md", "runs/WF06-20260925-01/"];

test("changes inside allowed prefixes are ignored", () => {
  const root = makeProject();
  const before = snapshot(root);
  fs.appendFileSync(path.join(root, "STATE.md"), "\nблок\n");
  fs.mkdirSync(path.join(root, "runs", "WF06-20260925-01"));
  fs.writeFileSync(
    path.join(root, "runs", "WF06-20260925-01", "run.json"),
    "{}",
  );
  assert.deepEqual(snapshotDiff(before, snapshot(root), ALLOW), []);
});

test("changed, added and removed files outside the allowlist are reported", () => {
  const root = makeProject();
  const before = snapshot(root);
  fs.appendFileSync(path.join(root, "ideas", "01-alpha.md"), "\nправка\n");
  fs.writeFileSync(path.join(root, "docs", "events.json"), "[]");
  fs.rmSync(path.join(root, "ideas", "README.md"));
  assert.deepEqual(snapshotDiff(before, snapshot(root), ALLOW), [
    "added docs/events.json",
    "changed ideas/01-alpha.md",
    "removed ideas/README.md",
  ]);
});

test("a file entry in the allowlist allows only that file", () => {
  const root = makeProject();
  const before = snapshot(root);
  fs.writeFileSync(path.join(root, "STATE.md.bak"), "копия");
  assert.deepEqual(snapshotDiff(before, snapshot(root), ALLOW), [
    "added STATE.md.bak",
  ]);
});

test("tools/node_modules and .git are not part of the snapshot", () => {
  const root = makeProject();
  fs.mkdirSync(path.join(root, "tools", "node_modules"), { recursive: true });
  fs.writeFileSync(path.join(root, "tools", "node_modules", "x.js"), "");
  fs.mkdirSync(path.join(root, ".git"));
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "");
  const snap = snapshot(root);
  assert.ok(!snap.includes("node_modules") && !snap.includes(".git"));
});
