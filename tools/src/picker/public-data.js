// What the picker site gives to a visitor (design REQ-056, 5.3). Both forms are built field
// by field: a field that is not named here is not copied, so a new field of the tenant
// file or of the engine result does not reach the visitor by itself. The inputs are never
// changed; nothing here reads the disk, the clock or the environment.

function has(object, key) {
  return Object.hasOwn(object, key);
}

function publicOption(option) {
  return { id: option.id, label: option.label };
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
  if (has(question, "show_if"))
    out.show_if = question.show_if.map(publicCondition);
  return out;
}

// null when the file has no leads or they are not enabled.
function publicLeads(leads) {
  if (leads === undefined || leads === null || leads.enabled !== true)
    return null;
  return {
    contact_fields: leads.contact_fields.slice(),
    consent_text: leads.consent_text,
    operator_name: leads.operator_name,
    privacy_contact: leads.privacy_contact,
    retention_days: leads.retention_days,
  };
}

// publicQuestionnaire(view, { version, lang, languages }) -> a new plain object with the
// ten fields of the questionnaire. `view` is a checked tenant file in the language `lang`.
export function publicQuestionnaire(view, { version, lang, languages }) {
  const hidden = view.questions.filter((q) => has(q, "show_if"));
  return {
    version,
    lang,
    languages: languages.slice(),
    name: view.name,
    intro: view.intro,
    questions_min: view.questions.length - hidden.length,
    questions_max: view.questions.length,
    questions: view.questions.map(publicQuestion),
    ai: false,
    leads: has(view, "leads") ? publicLeads(view.leads) : null,
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
