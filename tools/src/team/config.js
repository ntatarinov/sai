// The settings of the executors from the environment (design REQ-010, section 2).
//
// readConfig is called once at the start of a command. A value is never printed
// or written anywhere (Q7): an error names only the variable.
import path from "node:path";
import { executorError } from "./errors.js";

export const TASK_TIMEOUT_MS_DEFAULT = 1_200_000;
export const RETRY_DELAY_MS_DEFAULT = 10_000;
export const RETRIES_MAX = 2;
export const KILL_GRACE_MS = 3000;
export const GROUP_GONE_WAIT_MS = 5000;
export const RUN_CAP_SHARE = 0.25;

const TASK_TIMEOUT_MS_MIN = 1000;
const TASK_TIMEOUT_MS_MAX = 86_400_000;
const RETRY_DELAY_MS_MAX = 600_000;
const RUN_CAP_USD_MIN = 0.01;
const RUN_CAP_USD_MAX = 100000;
const USD_PATTERN = /^[0-9]+(\.[0-9]{1,6})?$/;

// The only names of the environment a Claude Code process gets (section 5.3).
export const CHILD_ENV_ALLOW = Object.freeze([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TMPDIR",
  "TZ",
  "CLAUDE_CONFIG_DIR",
]);

function configError(name) {
  return executorError("E_CONFIG", name);
}

function intSetting(env, name, min, max, fallback) {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (typeof raw !== "string" || !/^[0-9]{1,9}$/.test(raw)) {
    throw configError(name);
  }
  const value = Number(raw);
  if (value < min || value > max) throw configError(name);
  return value;
}

function runCapSetting(env) {
  const name = "SAI_TEAM_RUN_CAP_USD";
  const raw = env[name];
  if (raw === undefined) return null;
  if (typeof raw !== "string" || raw.length > 20 || !USD_PATTERN.test(raw)) {
    throw configError(name);
  }
  const value = Number(raw);
  if (
    !Number.isFinite(value) ||
    value < RUN_CAP_USD_MIN ||
    value > RUN_CAP_USD_MAX
  ) {
    throw configError(name);
  }
  return value;
}

function claudeBinSetting(env) {
  const name = "SAI_TEAM_CLAUDE_BIN";
  const raw = env[name];
  if (raw === undefined) return "claude";
  if (typeof raw !== "string" || raw === "" || !path.isAbsolute(raw)) {
    throw configError(name);
  }
  return raw;
}

// ISS-0119: the sites that WebFetch of the Researcher may open, an allow list
// (deny by default). SAI_TEAM_WEB_DOMAINS is a comma-separated list of host
// names in lower case: labels of [a-z0-9-] that do not start or end with "-",
// at least two labels, the last one with a letter (no IP address), at most 253
// characters each and WEB_DOMAINS_MAX names; no "*", port, scheme or path. Not
// set or empty: no WebFetch at all (WebSearch stays). Anything else: E_CONFIG.
export const WEB_DOMAINS_MAX = 50;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function isDomain(name) {
  if (name.length > 253) return false;
  const labels = name.split(".");
  return (
    labels.length >= 2 &&
    labels.every((l) => DOMAIN_LABEL.test(l)) &&
    /[a-z]/.test(labels[labels.length - 1])
  );
}

function webDomainsSetting(env) {
  const name = "SAI_TEAM_WEB_DOMAINS";
  const raw = env[name];
  if (raw === undefined || raw === "") return Object.freeze([]);
  if (typeof raw !== "string") throw configError(name);
  const list = raw.split(",");
  if (list.length > WEB_DOMAINS_MAX || !list.every(isDomain)) {
    throw configError(name);
  }
  return Object.freeze([...new Set(list)]);
}

// Config = { realRuns, claudeBin, web, webDomains, taskTimeoutMs, retryDelayMs,
// runCapUsd }.
export function readConfig(env = process.env) {
  const e = env ?? {};
  return Object.freeze({
    realRuns: e.SAI_TEAM_REAL_RUNS === "1",
    claudeBin: claudeBinSetting(e),
    web: e.SAI_TEAM_WEB !== "0",
    webDomains: webDomainsSetting(e),
    taskTimeoutMs: intSetting(
      e,
      "SAI_TEAM_TASK_TIMEOUT_MS",
      TASK_TIMEOUT_MS_MIN,
      TASK_TIMEOUT_MS_MAX,
      TASK_TIMEOUT_MS_DEFAULT,
    ),
    retryDelayMs: intSetting(
      e,
      "SAI_TEAM_RETRY_DELAY_MS",
      0,
      RETRY_DELAY_MS_MAX,
      RETRY_DELAY_MS_DEFAULT,
    ),
    runCapUsd: runCapSetting(e),
  });
}
