import { randomUUID } from "node:crypto";

// The id of one request (ARCH §16). Never taken from the request: a client value would reach the log.
/** @returns {string} */
export function newRequestId() {
  return randomUUID();
}
