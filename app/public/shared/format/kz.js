// The Kazakhstan formats of dates and numbers (the code design M2PROJ, 4.7): a date
// and a time in Astana time (UTC+5, no summer time) and a count with digit groups of three. The calendar is
// computed here from whole days (the civil-from-days rule of the proleptic Gregorian calendar), with no
// time-zone table and no browser or system setting, so the same moment gives the same text everywhere.

/** The shift of Astana time from UTC, in milliseconds. */
const SHIFT_MS = 5 * 3_600_000;
const DAY_MS = 86_400_000;
/** The furthest moment a time may be, in milliseconds from 1970 either way. */
const LIMIT_MS = 8_640_000_000_000_000;
/** The narrow no-break space between the digit groups. */
const GROUP_SIGN = " ";

/**
 * @param {number} n
 * @param {number} width
 * @returns {string}
 */
const pad = (n, width) => String(n).padStart(width, "0");

/**
 * The civil parts of a moment in Astana time.
 * @param {unknown} ms milliseconds from 1970-01-01T00:00:00Z
 * @returns {{ y: number, m: number, d: number, hh: number, mm: number }}
 */
function parts(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || Math.abs(ms) > LIMIT_MS)
    throw new Error("kz: the time is not a finite number of milliseconds");
  const local = Math.floor(ms) + SHIFT_MS;
  const days = Math.floor(local / DAY_MS);
  const inDay = local - days * DAY_MS;
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor(
    (doe -
      Math.floor(doe / 1460) +
      Math.floor(doe / 36_524) -
      Math.floor(doe / 146_096)) /
      365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return {
    y: yoe + era * 400 + (m <= 2 ? 1 : 0),
    m,
    d,
    hh: Math.floor(inDay / 3_600_000),
    mm: Math.floor((inDay % 3_600_000) / 60_000),
  };
}

/**
 * A count with the digits in groups of three, separated by U+202F: 1250000 is «1 250 000».
 * @param {unknown} n a non-negative safe integer
 * @returns {string}
 */
export function formatNumber(n) {
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0)
    throw new Error("kz: the number is not a non-negative safe integer");
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SIGN);
}

/**
 * The day of a moment in Astana time: 27.10.2026.
 * @param {unknown} ms
 * @returns {string}
 */
export function formatDate(ms) {
  const p = parts(ms);
  return `${pad(p.d, 2)}.${pad(p.m, 2)}.${pad(p.y, 4)}`;
}

/**
 * The time of day of a moment in Astana time: 18:53.
 * @param {unknown} ms
 * @returns {string}
 */
export function formatTime(ms) {
  const p = parts(ms);
  return `${pad(p.hh, 2)}:${pad(p.mm, 2)}`;
}

/**
 * The day and the time of a moment in Astana time: 27.10.2026, 18:53.
 * @param {unknown} ms
 * @returns {string}
 */
export function formatDateTime(ms) {
  return `${formatDate(ms)}, ${formatTime(ms)}`;
}
