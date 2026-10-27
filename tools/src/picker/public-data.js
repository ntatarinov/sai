// What the picker site gives to a visitor (design REQ-056, 5.3). Both forms are built field
// by field: a field that is not named here is not copied, so a new field of the tenant
// file or of the engine result does not reach the visitor by itself. The inputs are never
// changed; nothing here reads the disk, the clock or the environment.
import { fallbackLook } from "./limits.js";

function has(object, key) {
  return Object.hasOwn(object, key);
}

// The office object of an option (design REQ-069, 5.5): the fields it has, in this order.
function publicObject(object) {
  const out = { id: object.id };
  for (const key of ["level", "tag", "glyph"]) {
    if (has(object, key)) out[key] = object[key];
  }
  return out;
}

function publicOption(option) {
  const out = { id: option.id, label: option.label };
  if (has(option, "object")) out.object = publicObject(option.object);
  return out;
}

function publicCondition(condition) {
  const out = { question: condition.question };
  for (const key of ["any_of", "none_of"]) {
    if (has(condition, key)) out[key] = condition[key].slice();
  }
  for (const key of ["min", "max"]) {
    if (has(condition, key)) out[key] = condition[key];
  }
  return out;
}

function publicQuestion(question) {
  const out = { id: question.id, title: question.title };
  if (has(question, "help")) out.help = question.help;
  out.type = question.type;
  out.required = question.required;
  if (has(question, "options"))
    out.options = question.options.map(publicOption);
  for (const key of ["min", "max", "unit"]) {
    if (has(question, key)) out[key] = question[key];
  }
  if (has(question, "chips")) out.chips = question.chips.slice();
  if (has(question, "desk")) out.desk = question.desk;
  if (has(question, "show_if"))
    out.show_if = question.show_if.map(publicCondition);
  return out;
}

// null when the file has no leads or they are not enabled. In a file of the form /3 the
// number for the WhatsApp button is always there (a string or null); the limits of the
// lead server stay on the server.
function publicLeads(leads, isV3) {
  if (leads === undefined || leads === null || leads.enabled !== true)
    return null;
  const whatsapp = has(leads, "whatsapp") ? leads.whatsapp : null;
  return {
    contact_fields: leads.contact_fields.slice(),
    ...(isV3 ? { whatsapp } : {}),
    consent_text: leads.consent_text,
    operator_name: leads.operator_name,
    privacy_contact: leads.privacy_contact,
    retention_days: leads.retention_days,
  };
}

// publicLook(look) -> a new plain object with the six fields of the look of a tenant (design
// REQ-069, 7.2); `look` is the section of a checked file of the form /3 in one language.
export function publicLook(look) {
  const colors = {};
  for (const theme of ["light", "dark"])
    colors[theme] = {
      accent: look.colors[theme].accent,
      accent2: look.colors[theme].accent2,
    };
  return {
    mark: look.mark,
    tagline: has(look, "tagline") ? look.tagline : null,
    industry: look.industry,
    headline: look.headline,
    colors,
    team: look.team.map((staff) => ({
      name: staff.name,
      role: staff.role,
      says: staff.says,
      figure: staff.figure,
      shirt: staff.shirt,
    })),
  };
}

// The look of any tenant, never null: the file's own look for the form /3, the
// fallback look made from the name for /1 and /2. `view` is a checked tenant in one language.
export function lookOfView(view) {
  return has(view, "look") ? publicLook(view.look) : fallbackLook(view.name);
}

// The look of the file itself, or null for a file of the form /1 or /2.
export function ownLookOfView(view) {
  return has(view, "look") ? publicLook(view.look) : null;
}

// publicQuestionnaire(view, { version, lang, languages }) -> a new plain object with the
// ten fields of the questionnaire (eleven for a file of the form /3: `look` comes after
// `name`). `view` is a checked tenant file in the language `lang`.
export function publicQuestionnaire(view, { version, lang, languages }) {
  const hidden = view.questions.filter((q) => has(q, "show_if"));
  const isV3 = has(view, "look");
  return {
    version,
    lang,
    languages: languages.slice(),
    name: view.name,
    ...(isV3 ? { look: publicLook(view.look) } : {}),
    intro: view.intro,
    questions_min: view.questions.length - hidden.length,
    questions_max: view.questions.length,
    questions: view.questions.map(publicQuestion),
    ai: false,
    leads: has(view, "leads") ? publicLeads(view.leads, isV3) : null,
  };
}

// publicResult(result) -> the result of the engine without `ranking`: the points and the
// ids of the solutions that are not recommended stay on the server (ISS-0077, 7).
export function publicResult(result) {
  const out = {};
  for (const key of Object.keys(result)) {
    if (key !== "ranking") out[key] = result[key];
  }
  return out;
}
