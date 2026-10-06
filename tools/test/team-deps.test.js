// Sai Team core: no dependencies at run time, only Node's own modules (design
// REQ-009, TM-49).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { TEAM_SRC, TOOLS_DIR } from "./team-helpers.js";

function sourcesOf(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourcesOf(file));
    else if (entry.name.endsWith(".js")) out.push(file);
  }
  return out;
}

const SPECIFIER =
  /(?:\bimport\s+(?:[\w*{}\s,$]+?\s+from\s+)?|\bexport\s+(?:[\w*{}\s,$]+?)\s+from\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

test("TM-49 package.json has no dependencies and has the script team", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(TOOLS_DIR, "package.json"), "utf8"),
  );
  assert.equal(Object.hasOwn(pkg, "dependencies"), false);
  assert.equal(Object.hasOwn(pkg, "optionalDependencies"), false);
  assert.equal(Object.hasOwn(pkg, "peerDependencies"), false);
  assert.equal(pkg.scripts.team, "node src/team/cli.js");
});

test("TM-49 the imports of tools/src/team are node: modules or relative; node:sqlite is not used; from pixel-office only mask.js", () => {
  const files = sourcesOf(TEAM_SRC);
  assert.ok(files.length >= 12, `only ${files.length} files`);
  let imports = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, /\brequire\s*\(/, file);
    for (const match of text.matchAll(SPECIFIER)) {
      const specifier = match[1];
      imports += 1;
      assert.ok(
        specifier.startsWith("node:") ||
          specifier.startsWith("./") ||
          specifier.startsWith("../"),
        `${path.basename(file)}: "${specifier}" is not a module of Node or a relative path`,
      );
      assert.notEqual(specifier, "node:sqlite", file);
      assert.ok(!/sqlite/i.test(specifier), file);
      if (specifier.startsWith(".")) {
        const target = path.resolve(path.dirname(file), specifier);
        const pixel = path.join(TOOLS_DIR, "src", "pixel-office");
        if (target.startsWith(pixel + path.sep)) {
          assert.equal(
            target,
            path.join(pixel, "mask.js"),
            `${path.basename(file)} imports ${specifier}`,
          );
        }
        assert.ok(fs.existsSync(target), `${specifier} does not exist`);
      }
    }
  }
  assert.ok(imports > 20);
});
