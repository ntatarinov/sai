// The tenants of the picker site (design REQ-056, 5.2): the folder is read once, every
// `*.json` file is checked by the rules of REQ-054, and each right file becomes one record
// of the registry. A file with mistakes is not served; its lines are returned to be shown.
// The disk is touched only here and in load.js; every call of the file system goes through
// the `fs` object (`fs.readdirSync(...)`), so that a test can make it fail.
import fs from "node:fs";
import path from "node:path";
import { checkBytes } from "./check.js";
import { MAX_TENANT_FILES } from "./config.js";
import { fingerprintOf } from "./fingerprint.js";
import { PickerError, readTenantFile } from "./load.js";
import { tame } from "./places.js";
import { publicQuestionnaire } from "./public-data.js";
import { fileLanguages, tenantInLanguage } from "./view.js";

// An error of the operating system has a string `code` and a string `syscall`.
function isOsError(err) {
  return typeof err?.code === "string" && typeof err?.syscall === "string";
}

function folderName(dir) {
  return tame(path.basename(path.resolve(dir)) || dir);
}

// The line for a folder that cannot be read; an error that is no error of the system is
// a program error and goes up as it is.
function folderRefusal(err, dir) {
  if (!isOsError(err)) throw err;
  const name = folderName(dir);
  if (err.code === "ENOENT" || err.code === "ENOTDIR")
    return `Папка арендаторов не найдена: ${name}. Проверьте путь.`;
  if (err.code === "EACCES" || err.code === "EPERM")
    return `Нет права читать папку ${name}. Проверьте права.`;
  return `Не удалось прочитать папку ${name} (${tame(err.code)}). Проверьте папку.`;
}

// inspectDirectory(dir) -> { ok: true } | { ok: false, text }: the folder is there, can be
// read and is a folder.
export function inspectDirectory(dir) {
  let stat;
  try {
    stat = fs.statSync(dir);
  } catch (err) {
    return { ok: false, text: folderRefusal(err, dir) };
  }
  if (!stat.isDirectory()) {
    return {
      ok: false,
      text: `${folderName(dir)} — не папка. Укажите папку с файлами арендаторов.`,
    };
  }
  return { ok: true };
}

// Freezes a value and everything inside it.
function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value))
    return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

// The record of a tenant whose file has passed the check (the one place where the
// languages of a file are asked, and only for a file with exit code 0): the frozen view of
// the file in each language and the ready bytes of the questionnaire in each language.
function entryOf(fileName, bytes, tenant) {
  const version = fingerprintOf(bytes);
  const languages = fileLanguages(tenant);
  const views = new Map();
  const questionnaires = new Map();
  for (const lang of languages) {
    const view = deepFreeze(tenantInLanguage(tenant, lang));
    views.set(lang, view);
    const body = publicQuestionnaire(view, { version, lang, languages });
    questionnaires.set(lang, Buffer.from(JSON.stringify(body), "utf8"));
  }
  return Object.freeze({
    id: tenant.id,
    fileName,
    version,
    languages: Object.freeze(languages),
    views,
    questionnaires,
  });
}

// The registry: get(id) -> the record or undefined (a Map, so that a name such as
// "constructor" is no tenant), ids() in the order of the file names, size.
function registryOf(entries) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return Object.freeze({
    get: (id) => byId.get(id),
    ids: () => [...byId.keys()],
    get size() {
      return byId.size;
    },
  });
}

// loadTenants(dir) -> { registry, notServed } | { error }. `error` is the one line of a
// refusal to start (the folder, or more than MAX_TENANT_FILES names). `notServed` is the
// list of { fileName, lines } of the files that are not served.
export function loadTenants(dir) {
  const inspected = inspectDirectory(dir);
  if (!inspected.ok) return { error: inspected.text };
  let listed;
  try {
    listed = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return { error: folderRefusal(err, dir) };
  }
  const names = listed
    .map((item) => item.name)
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (names.length > MAX_TENANT_FILES) {
    return {
      error: `В папке ${folderName(dir)} больше ${MAX_TENANT_FILES} файлов арендаторов. Оставьте нужные.`,
    };
  }
  const entries = [];
  const notServed = [];
  for (const name of names) {
    let read;
    try {
      read = readTenantFile(path.join(dir, name), { baseDir: dir });
    } catch (err) {
      if (!(err instanceof PickerError)) throw err;
      notServed.push({ fileName: tame(name), lines: [err.message] });
      continue;
    }
    const { bytes, fileName } = read;
    const checked = checkBytes(bytes, fileName);
    if (checked.exitCode === 0) {
      entries.push(entryOf(fileName, bytes, checked.tenant));
    } else {
      notServed.push({ fileName: tame(fileName), lines: checked.stdout });
    }
  }
  return { registry: registryOf(entries), notServed };
}
