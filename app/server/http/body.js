import { HttpError } from "./errors.js";

export const BODY_LIMIT = 65536;

/**
 * Reads a request body with the limit of ARCH §14.2. The length header is checked before reading.
 * @param {Request} request
 * @param {number} [limit]
 * @returns {Promise<Uint8Array>}
 */
export async function readBody(request, limit = BODY_LIMIT) {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > limit)
    throw new HttpError("body_too_large");
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError("body_too_large");
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

/**
 * @param {Request} request
 * @param {number} [limit]
 * @returns {Promise<string>}
 */
export async function readText(request, limit = BODY_LIMIT) {
  const bytes = await readBody(request, limit);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new HttpError("bad_encoding");
  }
}
