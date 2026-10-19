// PK-L1 ... PK-L3: reading a tenant file - the mode with a folder, failures of the system
// and the closing of the descriptor (design REQ-054, 12.2). The functions of load.js are
// called in this process; the failures of the system are made by fault-inject.js.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PickerError, readTenantFile } from "../src/picker/load.js";
import { BUG_CODE, withFaults } from "./fault-inject.js";
import { TOOLS, fixtureBytes, makeTmp, runPicker } from "./picker-helpers.js";

const FAULT_PATH = path.join(TOOLS, "test", "fault-inject.js");
const OUTSIDE = (name) =>
  `Файл ${name} лежит вне папки арендаторов. Положите его в эту папку.`;
const BEHIND_LINK = (name) =>
  `Файл ${name} лежит за ссылкой на папку. Положите его в саму папку арендаторов.`;

// What readTenantFile throws, or the result.
function attempt(file, options) {
  try {
    return { value: readTenantFile(file, options) };
  } catch (error) {
    return { error };
  }
}
function refusal(file, options) {
  const r = attempt(file, options);
  assert.ok(
    r.error instanceof PickerError,
    `${file}: ${r.error?.message ?? "no refusal"}`,
  );
  return r.error.message;
}

test("PK-L1: with a folder - a file inside is read; '..', 'a/../..', a neighbour whose name begins like the folder, the folder itself, a link as a step of the way, a link to a file and a folder are refused with the exact lines", (t) => {
  const root = makeTmp(t);
  const base = path.join(root, "tenants");
  fs.mkdirSync(path.join(base, "sub"), { recursive: true });
  fs.mkdirSync(path.join(root, "tenants-extra"));
  fs.mkdirSync(path.join(root, "elsewhere"));
  const bytes = fixtureBytes("ok-minimal.json");
  fs.writeFileSync(path.join(base, "in.json"), bytes);
  fs.writeFileSync(path.join(base, "sub", "deep.json"), bytes);
  fs.writeFileSync(path.join(root, "outside.json"), bytes);
  fs.writeFileSync(path.join(root, "tenants-extra", "x.json"), bytes);
  fs.writeFileSync(path.join(root, "elsewhere", "e.json"), bytes);
  // inside, also in a real subfolder, and the path may be relative to the folder of the process
  for (const file of [
    path.join(base, "in.json"),
    path.join(base, "sub", "deep.json"),
    path.join(base, "sub", "..", "in.json"),
  ]) {
    const r = attempt(file, { baseDir: base });
    assert.deepEqual(Array.from(r.value.bytes), Array.from(bytes), file);
    assert.equal(r.value.fileName, path.basename(file));
  }
  // outside
  assert.equal(
    refusal(path.join(base, "..", "outside.json"), { baseDir: base }),
    OUTSIDE("outside.json"),
  );
  assert.equal(
    refusal(`${base}/a/../../outside.json`, { baseDir: base }),
    OUTSIDE("outside.json"),
  );
  assert.equal(
    refusal(path.join(root, "tenants-extra", "x.json"), { baseDir: base }),
    OUTSIDE("x.json"),
  );
  assert.equal(refusal(base, { baseDir: base }), OUTSIDE("tenants"));
  assert.equal(
    refusal(path.join(root, "outside.json"), { baseDir: base }),
    OUTSIDE("outside.json"),
  );
  // the same files without a folder are read
  assert.ok(attempt(path.join(root, "outside.json")).value);
  // a link as a step of the way below the folder
  fs.symlinkSync(path.join(root, "elsewhere"), path.join(base, "linked"));
  assert.equal(
    refusal(path.join(base, "linked", "e.json"), { baseDir: base }),
    BEHIND_LINK("e.json"),
  );
  // a link to a file: refused in both modes
  fs.symlinkSync(path.join(base, "in.json"), path.join(base, "link.json"));
  const isLink = "link.json — ссылка. Укажите сам файл, а не ссылку.";
  assert.equal(
    refusal(path.join(base, "link.json"), { baseDir: base }),
    isLink,
  );
  assert.equal(refusal(path.join(base, "link.json")), isLink);
  // a folder
  assert.equal(
    refusal(path.join(base, "sub"), { baseDir: base }),
    "sub — папка, а не файл. Укажите файл арендатора.",
  );
  // not found, also behind a missing step
  assert.equal(
    refusal(path.join(base, "nope.json"), { baseDir: base }),
    "Файл не найден: nope.json. Проверьте путь.",
  );
  assert.equal(
    refusal(path.join(base, "no", "such.json"), { baseDir: base }),
    "Файл не найден: such.json. Проверьте путь.",
  );
  // the base folder may be given as a relative path
  const cwd = process.cwd();
  process.chdir(root);
  try {
    assert.ok(
      attempt(path.join("tenants", "in.json"), { baseDir: "tenants" }).value,
    );
    assert.equal(
      refusal(path.join("tenants-extra", "x.json"), { baseDir: "tenants" }),
      OUTSIDE("x.json"),
    );
  } finally {
    process.chdir(cwd);
  }
  // a base folder that is no path is a mistake of the caller, not a refusal of a file
  assert.throws(
    () => readTenantFile(path.join(base, "in.json"), { baseDir: 5 }),
    TypeError,
  );
  assert.throws(
    () => readTenantFile(path.join(base, "in.json"), { baseDir: "a\0b" }),
    TypeError,
  );
  // a path with a link above the base folder is allowed (the ancestors of the folder are not looked at)
  const alias = path.join(root, "alias");
  fs.symlinkSync(root, alias);
  assert.ok(
    attempt(path.join(alias, "tenants", "in.json"), {
      baseDir: path.join(alias, "tenants"),
    }).value,
  );
});

test("PK-L1: the empty path and a path with NUL are refused; the name in a message is shown whole, without spaces or controls", (t) => {
  const dir = makeTmp(t);
  const line = "Путь к файлу пустой или с недопустимым знаком. Проверьте путь.";
  assert.equal(refusal(""), line);
  assert.equal(refusal("a\0b"), line);
  assert.equal(refusal(path.join(dir, "bad\0name")), line);
  assert.equal(
    refusal(path.join(dir, "a b\nc.json")),
    "Файл не найден: a_b_c.json. Проверьте путь.",
  );
  const long = "x".repeat(60);
  assert.equal(
    refusal(path.join(dir, long)),
    `Файл не найден: ${"x".repeat(40)}…. Проверьте путь.`,
  );
});

test("PK-L2: failures of the system - lstat EIO, open EACCES and EPERM, open ELOOP and ENOENT become one line each; a mistake without a code of the system is a mistake of the program and goes up as it is", (t) => {
  const dir = makeTmp(t);
  const file = path.join(dir, "ok-minimal.json");
  fs.writeFileSync(file, fixtureBytes("ok-minimal.json"));
  const line = (fault) => {
    const r = withFaults([{ paths: [file], effect: "throw", ...fault }], () =>
      readTenantFile(file),
    );
    assert.equal(r.fired.length, 1, JSON.stringify(fault));
    return r.error;
  };
  const cases = [
    [
      { fn: "lstatSync", code: "EIO" },
      "Не удалось прочитать файл ok-minimal.json (EIO). Проверьте файл.",
    ],
    [
      { fn: "lstatSync", code: "ENOENT" },
      "Файл не найден: ok-minimal.json. Проверьте путь.",
    ],
    [
      { fn: "lstatSync", code: "ENOTDIR" },
      "Файл не найден: ok-minimal.json. Проверьте путь.",
    ],
    [
      { fn: "openSync", code: "EACCES" },
      "Нет права читать файл ok-minimal.json. Проверьте права.",
    ],
    [
      { fn: "openSync", code: "EPERM" },
      "Нет права читать файл ok-minimal.json. Проверьте права.",
    ],
    [
      { fn: "openSync", code: "ELOOP" },
      "ok-minimal.json — ссылка. Укажите сам файл, а не ссылку.",
    ],
    [
      { fn: "openSync", code: "ENOENT" },
      "Файл не найден: ok-minimal.json. Проверьте путь.",
    ],
    [
      { fn: "openSync", code: "EIO" },
      "Не удалось прочитать файл ok-minimal.json (EIO). Проверьте файл.",
    ],
  ];
  for (const [fault, want] of cases) {
    const error = line(fault);
    assert.ok(error instanceof PickerError, JSON.stringify(fault));
    assert.equal(error.message, want, JSON.stringify(fault));
  }
  // a mistake of the program: no code of the system - not a refusal
  for (const fn of ["lstatSync", "openSync"]) {
    const bug = line({ fn, effect: "bug" });
    assert.equal(bug instanceof PickerError, false, fn);
    assert.equal(bug.message, "injected bug");
    const withCode = line({ fn, effect: "bug-code" });
    assert.equal(withCode instanceof PickerError, false, fn);
    assert.equal(withCode.code, BUG_CODE);
  }
});

test("PK-L2: in the process of the command - an error of the system gives code 2 and one line, a mistake of the program kills the process with a stack and an empty stdout", (t) => {
  const dir = makeTmp(t);
  const file = path.join(dir, "ok-minimal.json");
  fs.writeFileSync(file, fixtureBytes("ok-minimal.json"));
  const cli = path.join(TOOLS, "src", "picker", "cli.js");
  const run = (fault) =>
    spawnSync(process.execPath, ["--import", FAULT_PATH, cli, "check", file], {
      cwd: TOOLS,
      env: {
        PATH: process.env.PATH,
        SAI_TEST_FAULTS: JSON.stringify([{ paths: [file], ...fault }]),
      },
      encoding: "utf8",
      timeout: 60000,
    });
  const eio = run({ fn: "lstatSync", effect: "throw", code: "EIO" });
  assert.equal(eio.status, 2);
  assert.equal(eio.stdout, "");
  assert.equal(
    eio.stderr,
    "picker: Не удалось прочитать файл ok-minimal.json (EIO). Проверьте файл.\n",
  );
  const denied = run({ fn: "openSync", effect: "throw", code: "EACCES" });
  assert.equal(denied.status, 2);
  assert.equal(
    denied.stderr,
    "picker: Нет права читать файл ok-minimal.json. Проверьте права.\n",
  );
  const bug = run({ fn: "lstatSync", effect: "bug" });
  // Node ends an uncaught mistake with code 1, as for a file with mistakes: what tells them
  // apart is the empty stdout and the stack in stderr
  assert.notEqual(bug.status, 0);
  assert.notEqual(bug.status, 2);
  assert.equal(bug.stdout, "");
  assert.match(bug.stderr, /injected bug/u);
  assert.match(bug.stderr, / {4}at /u, "a program mistake shows its stack");
  assert.doesNotMatch(bug.stderr, /^picker: /mu);
  // the file itself is as it was
  assert.deepEqual(fs.readFileSync(file), fixtureBytes("ok-minimal.json"));
  assert.equal(runPicker(["check", file]).code, 0);
});

test("PK-L3: the descriptor is closed when a file is refused for its size - the number of open descriptors is the same before and after 50 refusals", (t) => {
  const dir = makeTmp(t);
  const big = path.join(dir, "big.json");
  fs.writeFileSync(big, Buffer.alloc(524289, 0x20));
  const open = () => {
    for (const place of ["/dev/fd", "/proc/self/fd"]) {
      if (fs.existsSync(place)) return fs.readdirSync(place).length;
    }
    return null;
  };
  const before = open();
  assert.notEqual(before, null, "the list of descriptors is readable");
  for (let i = 0; i < 50; i++) {
    assert.equal(refusal(big), "Файл big.json больше 512 КБ. Сократите его.");
  }
  assert.equal(open(), before);
  // the same for a refusal by a pipe or a good file
  const good = path.join(dir, "ok.json");
  fs.writeFileSync(good, fixtureBytes("ok-minimal.json"));
  for (let i = 0; i < 50; i++) readTenantFile(good);
  assert.equal(open(), before);
  // and when the read itself fails
  const r = withFaults(
    [{ fn: "lstatSync", paths: [big], effect: "throw", code: "EIO", nth: 1 }],
    () => readTenantFile(big),
  );
  assert.ok(r.error instanceof PickerError);
  assert.equal(open(), before);
});
