// The version of a tenant file (design REQ-056, 5.2): the sha256 of the bytes that were
// checked, not of a text built again from the parsed file.
import { createHash } from "node:crypto";

// fingerprintOf(bytes) -> 64 signs, lower case hex.
export function fingerprintOf(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
