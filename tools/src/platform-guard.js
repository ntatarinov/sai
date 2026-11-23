// The platform rule of tools/ (REQ-110 criteria 12-19; design
// docs/design/ISS-0132-platform-guard.md, section 2; decisions/0127 and 0134). A pure
// module in the pattern of node-floor.js: it loads no other module and reads neither the
// disk nor the environment; the guard reads the running platform only as the default of
// its second argument. Every platform not in the list is refused (fail closed).

// The allow-list: the only place that names the run hosts in code.
export const SUPPORTED_PLATFORMS = Object.freeze(["linux", "darwin"]);

// A platform is shown in the refusal line as given only in this shape, so the line stays
// one line and holds no control character (the shape of node-floor.js, a copy).
const SHOWN_SHAPE = /^[0-9A-Za-z.+-]{1,64}$/u;
const UNKNOWN_PLATFORM = "неизвестная платформа";

// True only for a text equal to an element of the list; case and spaces count.
export function isSupportedPlatform(platform) {
  return typeof platform === "string" && SUPPORTED_PLATFORMS.includes(platform);
}

// The refusal line without its line end.
export function platformRefusal(platform) {
  const shown =
    typeof platform === "string" && SHOWN_SHAPE.test(platform)
      ? platform
      : UNKNOWN_PLATFORM;
  return `Эта команда работает только на Linux и macOS, а запущена на ${shown}: команда остановлена, ничего не записано и не запущено. Windows — только клиент; подробности — tools/README.md, раздел «Platforms».`;
}

// False when the platform is supported, and then `stderr` is not touched. Else writes the
// refusal line and its line end in one write and returns true; the caller stops at once
// with its exit code. A write that throws is swallowed: the exit code still says it.
export function refuseUnsupportedPlatform(stderr, platform = process.platform) {
  if (isSupportedPlatform(platform)) return false;
  try {
    stderr.write(`${platformRefusal(platform)}\n`);
  } catch {
    // The stderr of the command is closed; nothing more can be said.
  }
  return true;
}
