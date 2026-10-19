// The whole check of a tenant file (design REQ-054, 5.10 and 7.4): bytes -> UTF-8 ->
// JSON -> rules -> lines. Without the disk, except for checkFile, which reads one file.
import { parseJson } from "./json.js";
import { decodeTenantBytes, PickerError, readTenantFile } from "./load.js";
import { show } from "./places.js";
import { formatIssues, issueLine } from "./report.js";
import { validateTenant } from "./validate.js";

// cli.js imports only this file.
export { show };

const JSON_TEXTS = new Map([
  ["end", "Файл закончился раньше времени. Проверьте скобки и кавычки."],
  ["char", "Здесь неожиданный знак. Проверьте запятые, кавычки и скобки."],
  ["trailing", "После данных есть лишний текст. Удалите его."],
  [
    "control",
    "В строке есть перенос или служебный знак. Запишите его как \\n.",
  ],
  ["depth", "Слишком глубокая вложенность. Упростите файл."],
]);
const NOT_UTF8 = "Файл не в кодировке UTF-8. Сохраните его как UTF-8.";

function jsonResult(fileName, line, column, text) {
  const place = `строка ${line}, знак ${column}`;
  return {
    exitCode: 1,
    stdout: [issueLine(fileName, place, "E_JSON", text)],
    stderr: [],
  };
}

function jsonText(failure) {
  if (failure.kind === "dup")
    return `Поле ${show(failure.key)} записано дважды. Оставьте одно.`;
  return JSON_TEXTS.get(failure.kind);
}

// checkBytes(bytes, fileName) -> { exitCode: 0 | 1, stdout, stderr, tenant? }
export function checkBytes(bytes, fileName) {
  const decoded = decodeTenantBytes(bytes);
  if (!decoded.ok)
    return jsonResult(fileName, decoded.line, decoded.column, NOT_UTF8);
  const parsed = parseJson(decoded.text);
  if (!parsed.ok)
    return jsonResult(fileName, parsed.line, parsed.column, jsonText(parsed));
  const issues = validateTenant(parsed.value, { fileName });
  if (issues.length > 0) {
    return {
      exitCode: 1,
      stdout: formatIssues(fileName, issues, parsed.positions),
      stderr: [],
    };
  }
  const tenant = parsed.value;
  return {
    exitCode: 0,
    stdout: [
      `Файл арендатора ${tenant.id} в порядке: вопросов ${tenant.questions.length}, решений ${tenant.solutions.length}, правил ${tenant.rules.length}.`,
    ],
    stderr: [],
    tenant,
  };
}

// checkFile(file, { baseDir }) -> the result of checkBytes, or exit code 2 when the file
// cannot be read.
export function checkFile(file, options = {}) {
  try {
    const { bytes, fileName } = readTenantFile(file, options);
    return checkBytes(bytes, fileName);
  } catch (err) {
    if (!(err instanceof PickerError)) throw err;
    return { exitCode: 2, stdout: [], stderr: [`picker: ${err.message}`] };
  }
}
