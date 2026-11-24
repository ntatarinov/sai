import { createHash, randomBytes } from "node:crypto";

// setup-token (REQ-114 criterion 2; the code design M2AUTH, 4.16): prints a one-time setup token (32 random
// bytes in base64url, 43 characters) and its sha256 in hex, two lines, and exits 0. Only the second line
// goes into SETUP_TOKEN_HASH of the host; the first is typed once on /setup.html. It takes no argument,
// reads no environment and writes no file.

if (process.argv.length > 2) {
  process.stderr.write("setup-token: refused: no argument is taken\n");
  process.exitCode = 2;
} else {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token, "utf8").digest("hex");
  process.stdout.write(`${token}\n${hash}\n`);
}
