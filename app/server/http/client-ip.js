// The client address (REQ-114 criterion 9; the code design M2AUTH, 4.10). On the Node server it is the socket
// address; on Vercel it is the x-forwarded-for value, which the platform overwrites (C8), when that value is
// exactly one IP literal. No other header is read. The text is checked by this module's own closed rules
// (node:net is not allowed under server/): an IPv4 literal in dotted decimal, or an IPv6 literal of hex groups
// with at most one "::" and an optional IPv4 tail; an IPv4-mapped IPv6 address gives its IPv4 form; IPv6 is
// lower case. Anything else (a zone id, a port, a list, a name) is null, which the callers count in the
// shared bucket "unknown".

const IPV4 =
  /^(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/;
const GROUP = /^[0-9a-f]{1,4}$/;
const MAPPED = /^::ffff:([0-9.]+)$/;

/**
 * @param {string} text lower case
 * @returns {boolean}
 */
function isIpv6(text) {
  if (text.length < 2 || text.length > 45) return false;
  const halves = text.split("::");
  if (halves.length > 2) return false;
  /** @type {string[]} */
  const groups = [];
  for (const half of halves) {
    if (half === "") continue;
    groups.push(...half.split(":"));
  }
  let count = 0;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (i === groups.length - 1 && g.includes(".")) {
      if (!IPV4.test(g)) return false;
      count += 2;
    } else if (GROUP.test(g)) count += 1;
    else return false;
  }
  return halves.length === 2 ? count <= 7 : count === 8;
}

/**
 * @param {unknown} text
 * @returns {string | null} the normalised address, or null
 */
export function normalise(text) {
  if (typeof text !== "string") return null;
  if (IPV4.test(text)) return text;
  const lower = text.toLowerCase();
  if (!isIpv6(lower)) return null;
  const mapped = lower.match(MAPPED);
  if (mapped && IPV4.test(mapped[1])) return mapped[1];
  return lower;
}

/**
 * The client address of a request to the Vercel function: the one x-forwarded-for value, or null.
 * @param {Headers} headers
 * @returns {string | null}
 */
export function vercelClientIp(headers) {
  const value = headers.get("x-forwarded-for");
  if (value === null) return null;
  return normalise(value.trim());
}
