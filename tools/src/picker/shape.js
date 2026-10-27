// The four helpers that read the shape of a JSON value for the check of a tenant file
// (design REQ-069, 4.1). They were part of validate.js and moved here unchanged, so
// that validate.js and v3-check.js can both use them without importing each other.
// `ctx` is the context of validate.js. Nothing here reads the disk, the clock or the
// environment, and no value that comes from JSON makes these helpers throw.
import { show } from "./places.js";

export function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// One row of a field table: { name, required, check(path, value) }.
export function field(name, required, check) {
  return { name, required, check };
}

// An object with known fields: the extra keys first, then the fields in the order of
// the table. A field is { name, required, check(path, value) }.
export function checkObject(ctx, path, value, fields) {
  if (!isObject(value)) {
    ctx.wrong(path, "object");
    return;
  }
  const known = new Set(fields.map((f) => f.name));
  for (const key of Object.keys(value)) {
    if (!known.has(key))
      ctx.add(
        "E_FIELD",
        [...path, key],
        `Лишнее поле ${show(key)}. Удалите его.`,
      );
  }
  for (const f of fields) {
    const fieldPath = [...path, f.name];
    if (Object.hasOwn(value, f.name)) f.check(fieldPath, value[f.name]);
    else if (f.required)
      ctx.add("E_FIELD", fieldPath, `Нет поля ${f.name}. Добавьте его.`);
  }
}

// The items of a list of objects, each checked by `each(path, item, index)`.
export function checkItems(ctx, path, value, min, max, each) {
  if (ctx.list(path, value, min, max))
    value.forEach((item, i) => each([...path, i], item, i));
}
