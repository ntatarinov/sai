import fs from "node:fs";
import path from "node:path";
import { E2eError, safeText } from "./errors.js";

// Where a Chrome or Chromium program is looked for when SAI_CHROME is not set.
// The first is a full path, the other four are names looked up in PATH.
export const CHROME_PLACES = Object.freeze([
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
]);

function isExecutableFile(absolutePath) {
  try {
    if (!fs.statSync(absolutePath).isFile()) return false;
    fs.accessSync(absolutePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function setEnding() {
  return "The other places are not tried when SAI_CHROME is set. Give the full path of a Chrome or Chromium program, or unset SAI_CHROME.";
}

function listPlaces() {
  return CHROME_PLACES.map((place, i) => {
    const where = path.isAbsolute(place) ? place : `${place} (in PATH)`;
    return `  ${i + 1}) ${where}`;
  }).join("\n");
}

// findChrome -> { path, from: "SAI_CHROME" | "place", place? }
// SAI_CHROME set (even empty) means: it is the only place; no fallback.
export function findChrome({
  env = process.env,
  exists = isExecutableFile,
} = {}) {
  if (Object.hasOwn(env, "SAI_CHROME") && env.SAI_CHROME !== undefined) {
    const value = env.SAI_CHROME;
    if (typeof value !== "string" || value === "") {
      throw new E2eError(
        "CHROME_NOT_FOUND",
        `SAI_CHROME is set but empty. ${setEnding()}`,
      );
    }
    if (!path.isAbsolute(value)) {
      throw new E2eError(
        "CHROME_NOT_FOUND",
        `SAI_CHROME must be a full path, got "${safeText(value)}". ${setEnding()}`,
      );
    }
    if (!exists(value)) {
      throw new E2eError(
        "CHROME_NOT_FOUND",
        `SAI_CHROME is set to "${safeText(value)}" but there is no executable file there. ${setEnding()}`,
      );
    }
    return { path: value, from: "SAI_CHROME" };
  }

  const dirs = String(env.PATH ?? "")
    .split(path.delimiter)
    .filter((dir) => dir !== "");
  for (const place of CHROME_PLACES) {
    if (path.isAbsolute(place)) {
      if (exists(place)) return { path: place, from: "place", place };
      continue;
    }
    for (const dir of dirs) {
      const candidate = path.join(dir, place);
      if (exists(candidate)) return { path: candidate, from: "place", place };
    }
  }
  throw new E2eError(
    "CHROME_NOT_FOUND",
    `no Chrome or Chromium found. Set SAI_CHROME to the full path of one, or install one in a place that is searched. Places tried (${CHROME_PLACES.length}):\n${listPlaces()}`,
  );
}
