// The screens of the page: they build nodes from data and give back the nodes that the
// controller of the page changes in place. They hold no state and attach no handler;
// the texts of the page come from texts.js, the texts of the tenant are put in as text.
import { el, part, setText } from "./dom.js";
import { say } from "./say.js";
import { LANGUAGE_NAMES } from "./texts.js";

function panel(screen, ...children) {
  return part("div", "panel", { "data-screen": screen }, ...children);
}

// The header: the name of the tenant (the only h1 of the page) and, when the file has
// more than one language, the group of buttons of the languages. The header is built
// once for a questionnaire and stays on every screen, so a button of a language is
// never built again and keeps the focus. data: { name, lang, languages }.
// -> { node, title, group, langs, netSlot } where `langs` is "language -> button".
export function buildHead(data) {
  const title = part("h1", "title", { tabindex: "-1" }, data.name);
  const langs = {};
  let group = null;
  if (data.languages.length > 1) {
    const buttons = data.languages.map((code) => {
      langs[code] = part(
        "button",
        "lang",
        { type: "button", "data-action": "lang", lang: code },
        LANGUAGE_NAMES[code],
      );
      return langs[code];
    });
    group = part("div", "languages", { role: "group" }, ...buttons);
  }
  const netSlot = part("div", "head-net-slot", null);
  const head = {
    node: part("header", "head", null, title, group, netSlot),
    title,
    group,
    langs,
    netSlot,
  };
  setHeadLanguage(head, data.lang, data.name);
  return head;
}

// The header on a new language: the name, the label of the group and the current button.
export function setHeadLanguage(head, lang, name) {
  setText(head.title, name);
  if (head.group !== null)
    head.group.setAttribute("aria-label", say("language_switcher_label", lang));
  for (const code of Object.keys(head.langs)) {
    if (code === lang) head.langs[code].setAttribute("aria-current", "true");
    else head.langs[code].removeAttribute("aria-current");
  }
}

// The block of the net under the header: put in, or taken away (null).
export function setHeadNet(head, block) {
  if (block === null) head.netSlot.replaceChildren();
  else head.netSlot.replaceChildren(block.node);
}

// The screen of the loading: one line, no header (the name is not known yet).
export function buildLoading(lang) {
  return panel(
    "loading",
    part("p", "loading", null, say("quiz_loading", lang)),
  );
}

// The block of a lost net or of a mistake of the server: a text and one button. The
// text is tied to the button, and the block is not an alert, so it is read once.
// block = { kind: "load" | "lang" | "result", text, action: "retry" | "restart",
// label } -> { node, button }.
export function buildNet(block) {
  const button = part(
    "button",
    "net-action",
    {
      type: "button",
      "data-action": block.action,
      "aria-describedby": "net-text",
    },
    block.label,
  );
  const node = part(
    "div",
    "net",
    { "data-kind": block.kind },
    part("p", "net-text", { id: "net-text" }, block.text),
    button,
  );
  return { node, button };
}

// The screen that stands instead of the card when the questionnaire did not come.
export function buildFailure(netNode) {
  return panel("failure", netNode);
}

// The card of the site. data: { lang, q, head, notice, hasSaved } where q is the
// questionnaire and head is the header of buildHead.
// -> { panel, title, start, continue, restart } (the buttons that are not on the card
// are null).
export function buildCard(data) {
  const { lang, q } = data;
  const head = data.head;
  const count =
    q.questions_min === q.questions_max
      ? say("card_count_same", lang, { count: q.questions_min })
      : say("card_count", lang, { min: q.questions_min, max: q.questions_max });
  const buttons = { start: null, continue: null, restart: null };
  const actions = part("div", "actions", null);
  if (data.hasSaved) {
    buttons.continue = part(
      "button",
      "continue",
      { type: "button", "data-action": "continue" },
      say("card_continue", lang),
    );
    buttons.restart = part(
      "button",
      "restart",
      { type: "button", "data-action": "restart" },
      say("card_restart", lang),
    );
    actions.append(buttons.continue, buttons.restart);
  } else {
    buttons.start = part(
      "button",
      "start",
      { type: "button", "data-action": "start" },
      say("card_start", lang),
    );
    actions.append(buttons.start);
  }
  const node = panel(
    "card",
    head.node,
    data.notice ? part("p", "notice", null, say("card_changed", lang)) : null,
    part("p", "intro", null, q.intro),
    part("p", "gives", null, say("card_gives", lang)),
    part("p", "ask", null, say("card_ask", lang)),
    part("p", "count", null, count),
    actions,
  );
  return { panel: node, title: head.title, ...buttons };
}

function optionRow(question, option, checked) {
  const input = el("input", {
    type: question.type === "single" ? "radio" : "checkbox",
    name: "answer",
    value: option.id,
  });
  input.checked = checked;
  const row = part(
    "label",
    "option",
    null,
    input,
    part("span", "mark", { "aria-hidden": "true" }),
    part("span", "option-text", null, option.label),
  );
  return { row, input };
}

function chosen(answers, question) {
  if (!Object.hasOwn(answers, question.id)) return undefined;
  return answers[question.id];
}

// The field of the answer by the kind of the question: radio buttons, check boxes or
// a field of a number. -> { node, inputs, numberInput }.
function buildField(question, answers, draft) {
  const given = chosen(answers, question);
  if (question.type === "number") {
    const input = el("input", {
      id: "q-input",
      type: "number",
      inputmode: "numeric",
      step: "1",
      min: question.min,
      max: question.max,
    });
    if (draft !== null && draft.id === question.id) input.value = draft.text;
    else if (given !== undefined) input.value = String(given);
    const hasUnit = typeof question.unit === "string" && question.unit !== "";
    const unit = part(
      "label",
      "q-unit",
      {
        for: "q-input",
        "data-hidden": hasUnit ? null : "true",
      },
      hasUnit ? question.unit : question.title,
    );
    return {
      node: part("div", "number", null, input, unit),
      inputs: [input],
      numberInput: input,
    };
  }
  const rows = question.options.map((option) => {
    const on =
      question.type === "single"
        ? given === option.id
        : Array.isArray(given) && given.includes(option.id);
    return optionRow(question, option, on);
  });
  return {
    node: part("div", "options", null, ...rows.map((row) => row.row)),
    inputs: rows.map((row) => row.input),
    numberInput: null,
  };
}

// The screen of a question. data: { lang, head, question, answers, draft, hasBack,
// isLast, k, n }. -> the nodes that the controller changes in place.
export function buildQuestion(data) {
  const { lang, question } = data;
  const head = data.head;
  const hasHelp = typeof question.help === "string" && question.help !== "";
  const progressText = part("p", "progress-text", null);
  const fill = part("div", "bar-fill", null);
  const bar = part(
    "div",
    "bar",
    {
      role: "progressbar",
      "aria-valuemin": "0",
      "aria-label": say("progress_name", lang),
    },
    fill,
  );
  const qTitle = part(
    "h2",
    "q-title",
    { id: "q-title", tabindex: "-1" },
    question.title,
  );
  const field = buildField(question, data.answers, data.draft);
  const error = part("div", "q-error", {
    id: "q-error",
    role: "alert",
    "aria-live": "assertive",
    "aria-atomic": "true",
  });
  const fieldset = part(
    "fieldset",
    "fieldset",
    { "aria-labelledby": "q-title" },
    hasHelp ? part("p", "q-help", { id: "q-help" }, question.help) : null,
    field.node,
    question.type === "number"
      ? part(
          "p",
          "q-hint",
          { id: "q-hint" },
          say("quiz_number_hint", lang, {
            min: question.min,
            max: question.max,
          }),
        )
      : null,
    error,
  );
  const back = data.hasBack
    ? part(
        "button",
        "back",
        { type: "button", "data-action": "back" },
        say("quiz_back", lang),
      )
    : null;
  const skip = question.required
    ? null
    : part(
        "button",
        "skip",
        { type: "button", "data-action": "skip" },
        say("quiz_skip", lang),
      );
  const next = part("button", "next", { type: "submit" });
  const form = part(
    "form",
    "form",
    { novalidate: "" },
    qTitle,
    fieldset,
    part("div", "actions", null, back, skip, next),
  );
  const netSlot = part("div", "net-slot", null);
  const refs = {
    panel: panel("question", head.node, progressText, bar, form, netSlot),
    title: head.title,
    qTitle,
    form,
    fieldset,
    inputs: field.inputs,
    numberInput: field.numberInput,
    error,
    back,
    skip,
    next,
    progressText,
    bar,
    fill,
    netSlot,
    hasHelp,
    type: question.type,
  };
  setProgress(refs, lang, data.k, data.n);
  setNext(refs, lang, data.isLast);
  describe(refs, false);
  return refs;
}

// The line "Question K of N" and the bar. Returns the text of the line.
export function setProgress(refs, lang, k, n) {
  const text = say("progress_label", lang, { current: k, total: n });
  setText(refs.progressText, text);
  refs.bar.setAttribute("aria-valuenow", String(k));
  refs.bar.setAttribute("aria-valuemax", String(n));
  refs.bar.setAttribute("aria-valuetext", text);
  const share = n > 0 ? (k / n) * 100 : 0;
  refs.fill.style.width = `${share.toFixed(1)}%`;
  return text;
}

// The main button is "Next", or "Show the result" when no visible question follows.
export function setNext(refs, lang, isLast) {
  refs.next.setAttribute("data-action", isLast ? "show-result" : "next");
  setText(refs.next, say(isLast ? "quiz_show_result" : "quiz_next", lang));
}

// aria-describedby of the group of the answers (of the field, for a number): the help,
// the hint of the limits and, while there is one, the message.
function describe(refs, withMessage) {
  const ids = [];
  if (refs.hasHelp) ids.push("q-help");
  if (refs.type === "number") ids.push("q-hint");
  if (withMessage) ids.push("q-error");
  const target = refs.numberInput ?? refs.fieldset;
  if (ids.length > 0) target.setAttribute("aria-describedby", ids.join(" "));
  else target.removeAttribute("aria-describedby");
}

// The message beside the question; it stays in the tree, empty when there is none.
export function showMessage(refs, text) {
  setText(refs.error, text);
  describe(refs, true);
  if (refs.numberInput !== null)
    refs.numberInput.setAttribute("aria-invalid", "true");
}

export function clearMessage(refs) {
  setText(refs.error, "");
  describe(refs, false);
  if (refs.numberInput !== null)
    refs.numberInput.removeAttribute("aria-invalid");
}

// The field is emptied (the answer was skipped).
export function clearField(refs) {
  for (const input of refs.inputs) {
    if (refs.numberInput === null) input.checked = false;
    else input.value = "";
  }
}

// The fields of the question are shut while the answers are on their way to the server,
// and open again when they are back.
export function setBusy(refs, busy) {
  if (busy) refs.fieldset.setAttribute("disabled", "");
  else refs.fieldset.removeAttribute("disabled");
}

// The block of the net under the buttons of a question: put in, or taken away (null).
export function setNetBlock(refs, block) {
  if (block === null) refs.netSlot.replaceChildren();
  else refs.netSlot.replaceChildren(block.node);
}
