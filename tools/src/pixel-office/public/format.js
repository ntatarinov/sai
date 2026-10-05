// Time display (design 2.3). The journal stores UTC; the page shows the clock
// and the time zone of this computer. The zone is read from Intl at every call,
// so the functions stay correct if the zone of the program changes.
// Pure ES module: no DOM and no Node API.

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
