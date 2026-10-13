// Time display (design 2.3). The journal stores UTC; the page shows the clock
// and the time zone of this computer. The zone is read from Intl at every call,
// so the functions stay correct if the zone of the program changes.
// Pure ES module: no DOM and no Node API.

import {
  AGE_DAYS,
  AGE_DAYS_HOURS,
  AGE_HOURS,
  AGE_HOURS_MINUTES,
  AGE_LESS_THAN_MINUTE,
  AGE_MINUTES,
} from "./texts.js";

const TIME = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
const TIME_SEC = { ...TIME, second: "2-digit" };
const DATE_TIME = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  ...TIME_SEC,
};

// An unreadable time gives an empty string, never an exception (Q10): the
// page must keep working on a corrupted journal line.
function show(iso, options) {
  if (typeof iso !== "string") return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", options).format(ms);
  } catch {
    // The runtime has no such locale or the value is out of range.
    return "";
  }
}

// Hours and minutes, 24-hour clock.
export function fmtTime(iso) {
  return show(iso, TIME);
}

// Hours, minutes and seconds.
export function fmtTimeSec(iso) {
  return show(iso, TIME_SEC);
}

// Date and time with seconds.
export function fmtDateTime(iso) {
  return show(iso, DATE_TIME);
}

// IANA name of the time zone of this computer.
export function tzLabel() {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    // Intl is not available: the journal itself is in UTC.
    return "UTC";
  }
}

// ------------------------------------------------------------------- age

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// The age of the last event as words, rounded down: "меньше минуты назад",
// "5 мин назад", "2 ч 34 мин назад", "1 сут 3 ч назад". A value that is not a
// finite number gives an empty string; a negative one counts as zero.
export function ageText(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "";
  const age = Math.max(0, ms);
  if (age < MS_PER_MINUTE) return AGE_LESS_THAN_MINUTE;
  if (age < MS_PER_HOUR) {
    return AGE_MINUTES.replace("{n}", String(Math.floor(age / MS_PER_MINUTE)));
  }
  if (age < MS_PER_DAY) {
    const hours = Math.floor(age / MS_PER_HOUR);
    const minutes = Math.floor((age % MS_PER_HOUR) / MS_PER_MINUTE);
    if (minutes === 0) return AGE_HOURS.replace("{h}", String(hours));
    return AGE_HOURS_MINUTES.replace("{h}", String(hours)).replace(
      "{m}",
      String(minutes),
    );
  }
  const days = Math.floor(age / MS_PER_DAY);
  const hours = Math.floor((age % MS_PER_DAY) / MS_PER_HOUR);
  if (hours === 0) return AGE_DAYS.replace("{d}", String(days));
  return AGE_DAYS_HOURS.replace("{d}", String(days)).replace(
    "{h}",
    String(hours),
  );
}
