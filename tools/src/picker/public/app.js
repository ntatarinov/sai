// The control of the page: the state, the moves between the screens, the focus, the
// live region and the storage of the browser. The page knows nothing by itself: the
// questions, their texts and the result come from the server.
import {
  bodyAnswers,
  entryQuestion,
  firstVisible,
  isLastVisible,
  nextVisible,
  openQuestion,
  previousVisible,
  progress,
  pruneAnswers,
  readNumber,
  setAnswer,
  verdict,
} from "./flow.js";
import { getQuestionnaire, postResult } from "./net.js";
import { renderResult } from "./result.js";
import { say } from "./say.js";
import {
  buildCard,
  buildFailure,
  buildHead,
  buildLoading,
  buildNet,
  buildQuestion,
  clearField,
  clearMessage,
  setHeadLanguage,
  setBusy,
  setHeadNet,
  setNetBlock,
  setNext,
  setProgress,
  showMessage,
} from "./screens.js";
import { clearSaved, readSaved, tenantIdOf, writeSaved } from "./store.js";
import { LANGUAGES, chooseLanguage } from "./texts.js";

function noAnswers() {
  return Object.create(null);
}

// Starts the page: reads the address and the storage, asks for the questionnaire and
// shows the screens. Everything the page holds lives inside this call, so it can be
// started again as a new load of the page.
export function start() {
  const root = document.getElementById("app");
  const live = document.getElementById("live");
  if (!root) return;
  const id = tenantIdOf(location.pathname);
  const read = readSaved(id);
  const saved = read.saved;
  const wanted = new URLSearchParams(location.search).get("lang");
  const state = {
    id,
    lang: chooseLanguage({
      query: wanted ?? undefined,
      stored: saved.lang ?? undefined,
      available: LANGUAGES,
    }),
    q: null,
    screen: "loading",
    answers: noAnswers(),
    current: null,
    notice: false,
    storageOk: read.ok,
    sending: false,
    ticket: 0,
    draft: null,
    message: null,
    net: null,
  };
  // The nodes of the question that is on the screen, and its last K and N.
  const ui = { head: null, question: null, last: { k: 0, n: 0 } };
  document.documentElement.lang = state.lang;

  function t(key, values) {
    return say(key, state.lang, values);
  }

  function announce(text) {
    if (live) live.textContent = text;
  }

  // The storage: the first refusal switches it off for the rest of the life of the page.
  function save() {
    if (!state.storageOk || state.q === null) return;
    const done = writeSaved(state.id, {
      version: state.q.version,
      lang: state.lang,
      current: state.current,
      answers: state.answers,
    });
    if (!done) state.storageOk = false;
  }

  function wipe() {
    if (!state.storageOk) return;
    if (!clearSaved(state.id)) state.storageOk = false;
  }

  function show(node) {
    root.replaceChildren(node);
  }

  function toTop() {
    scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  function focusNode(node) {
    node.focus({ preventScroll: true });
  }

  function hasSaved() {
    if (!state.storageOk) return false;
    if (Object.keys(state.answers).length > 0) return true;
    return (
      state.current !== null &&
      state.current !== firstVisible(state.q.questions)
    );
  }

  function questionById(qid) {
    return state.q.questions.find((question) => question.id === qid);
  }

  function ownAnswer(qid) {
    return Object.hasOwn(state.answers, qid) ? state.answers[qid] : undefined;
  }

  // The text and the button of the block of the net for an outcome of the net.
  function netBlock(kind, outcome) {
    if (outcome.kind === "network") {
      return buildNet({
        kind,
        text: state.storageOk ? t("net_lost_saved") : t("net_lost_unsaved"),
        action: "retry",
        label: t("net_retry"),
      });
    }
    // The questionnaire has no answers to refuse: only the result and the language do.
    const invalid = kind !== "load" && outcome.code === "answers_invalid";
    return buildNet({
      kind,
      text:
        outcome.message ??
        t(invalid ? "server_answers_invalid" : "server_internal"),
      action: invalid ? "restart" : "retry",
      label: t(invalid ? "card_restart" : "net_retry"),
    });
  }

  // ---- loading and the card

  function showLoading() {
    state.screen = "loading";
    show(buildLoading(state.lang));
    announce(t("quiz_loading"));
  }

  async function load(afterBlock) {
    showLoading();
    const outcome = await getQuestionnaire(state.lang);
    if (outcome.kind === "ok") accept(outcome.body, afterBlock);
    else showFailure(outcome);
  }

  // The questionnaire came: the saved answers are used only for the same version.
  function accept(body, afterBlock) {
    state.q = body;
    state.lang = body.lang;
    document.documentElement.lang = state.lang;
    document.title = body.name;
    ui.head = makeHead();
    const questions = body.questions;
    state.answers = noAnswers();
    state.current = null;
    state.notice = false;
    if (saved.version !== null && saved.version !== body.version) {
      const first = firstVisible(questions);
      const hadAny =
        Object.keys(saved.answers).length > 0 ||
        (saved.current !== null && saved.current !== first);
      state.notice = hadAny;
      if (hadAny) save();
    } else if (saved.version !== null) {
      state.answers = pruneAnswers(questions, saved.answers);
      if (
        saved.current !== null &&
        progress(questions, state.answers, saved.current).k > 0
      )
        state.current = saved.current;
    }
    showCard(afterBlock);
  }

  // The header of the questionnaire on the page, with the handlers of its buttons.
  function makeHead() {
    const head = buildHead({
      name: state.q.name,
      lang: state.lang,
      languages: state.q.languages,
    });
    for (const code of Object.keys(head.langs))
      head.langs[code].addEventListener("click", () => changeLanguage(code));
    return head;
  }

  function showCard(withFocus) {
    state.screen = "card";
    state.net = null;
    setHeadNet(ui.head, null);
    ui.question = null;
    const refs = buildCard({
      lang: state.lang,
      q: state.q,
      head: ui.head,
      notice: state.notice,
      hasSaved: hasSaved(),
    });
    if (refs.start) refs.start.addEventListener("click", onStart);
    if (refs.continue) refs.continue.addEventListener("click", onContinue);
    if (refs.restart) refs.restart.addEventListener("click", onRestart);
    show(refs.panel);
    if (withFocus) focusNode(refs.title);
  }

  function showFailure(outcome) {
    state.screen = "failure";
    const block = netBlock("load", outcome);
    block.button.addEventListener("click", () =>
      onNetAction("load", block.button.getAttribute("data-action")),
    );
    show(buildFailure(block.node));
    focusNode(block.button);
  }

  // ---- the questions

  // Puts the screen of the question on the page; the focus and the storage are the
  // business of the caller.
  function showQuestion(qid) {
    state.current = qid;
    state.draft = null;
    state.message = null;
    state.net = null;
    setHeadNet(ui.head, null);
    renderQuestion();
  }

  // Builds the screen of the current question from the state (the draft of a number
  // field and the message stay as they are).
  function renderQuestion() {
    state.screen = "question";
    const qid = state.current;
    const question = questionById(qid);
    const { k, n } = progress(state.q.questions, state.answers, qid);
    const refs = buildQuestion({
      lang: state.lang,
      head: ui.head,
      question,
      answers: state.answers,
      draft: state.draft,
      hasBack: previousVisible(state.q.questions, state.answers, qid) !== null,
      isLast: isLastVisible(state.q.questions, state.answers, qid),
      k,
      n,
    });
    ui.question = refs;
    ui.last = { k, n };
    refs.form.addEventListener("submit", onSubmit);
    if (refs.back) refs.back.addEventListener("click", onBack);
    if (refs.skip) refs.skip.addEventListener("click", onSkip);
    const kind = question.type === "number" ? "input" : "change";
    for (const input of refs.inputs) input.addEventListener(kind, onAnswer);
    show(refs.panel);
  }

  // A move to a question: the top of the page, the focus on its title, the line of the
  // progress in the live region.
  function go(qid, write) {
    showQuestion(qid);
    toTop();
    focusNode(ui.question.qTitle);
    announce(ui.question.progressText.textContent);
    if (write) save();
  }

  function onStart() {
    state.notice = false;
    state.answers = noAnswers();
    go(firstVisible(state.q.questions), false);
  }

  function onContinue() {
    go(entryQuestion(state.q.questions, state.answers, state.current), true);
  }

  function onRestart() {
    wipe();
    state.answers = noAnswers();
    state.notice = false;
    go(firstVisible(state.q.questions), false);
  }

  // The answer was changed: the answer of the state, the button, the line of progress.
  function onAnswer() {
    if (state.sending) return;
    const refs = ui.question;
    const question = questionById(state.current);
    let raw;
    state.draft = null;
    if (question.type === "number") {
      const input = refs.numberInput;
      const parsed = readNumber(input.value, input.validity.badInput === true);
      const inside =
        parsed.state === "ok" &&
        parsed.value >= question.min &&
        parsed.value <= question.max;
      if (inside) raw = parsed.value;
      if (parsed.state !== "empty" && !inside)
        state.draft = { id: question.id, text: input.value };
    } else {
      const values = refs.inputs
        .filter((input) => input.checked)
        .map((input) => input.value);
      if (values.length > 0)
        raw = question.type === "single" ? values[0] : values;
    }
    state.answers = setAnswer(
      state.q.questions,
      state.answers,
      question.id,
      raw,
    );
    state.message = null;
    clearMessage(refs);
    setNext(
      refs,
      state.lang,
      isLastVisible(state.q.questions, state.answers, question.id),
    );
    const { k, n } = progress(state.q.questions, state.answers, question.id);
    const text = setProgress(refs, state.lang, k, n);
    if (k !== ui.last.k || n !== ui.last.n) announce(text);
    ui.last = { k, n };
    save();
  }

  function onSubmit(event) {
    event.preventDefault();
    advance(false);
  }

  function onSkip() {
    advance(true);
  }

  function onBack() {
    if (state.sending) return;
    go(previousVisible(state.q.questions, state.answers, state.current), true);
  }

  // The text of the message beside the question for the kind in the state.
  function messageText(question) {
    if (state.message === "required") return t("quiz_required");
    return t("quiz_number_range", { min: question.min, max: question.max });
  }

  // "Next" (and Enter): the answer is checked, then the next question or the result.
  // "Skip" clears the answer and goes on without the check.
  function advance(skipped) {
    if (state.sending) return;
    const refs = ui.question;
    const question = questionById(state.current);
    if (skipped) {
      state.answers = setAnswer(
        state.q.questions,
        state.answers,
        question.id,
        undefined,
      );
      state.draft = null;
      state.message = null;
      clearField(refs);
      clearMessage(refs);
      save();
    } else {
      const numberState =
        question.type === "number"
          ? readNumber(
              refs.numberInput.value,
              refs.numberInput.validity.badInput === true,
            )
          : undefined;
      const outcome = verdict(question, ownAnswer(question.id), numberState);
      if (!outcome.ok) {
        state.message = outcome.message;
        showMessage(refs, messageText(question));
        focusNode(refs.inputs[0]);
        return;
      }
    }
    const next = nextVisible(state.q.questions, state.answers, question.id);
    if (next !== null) go(next, true);
    else send();
  }

  // ---- the result

  async function send() {
    if (state.sending) return;
    const open = openQuestion(state.q.questions, state.answers);
    if (open !== null) {
      go(open, true);
      state.message = "required";
      showMessage(ui.question, t("quiz_required"));
      return;
    }
    const refs = ui.question;
    // What goes in the request is what the result is shown for: the answers are taken
    // once, the fields are shut while the request is on its way, and a change of the
    // language that is still on its way is dropped.
    const sent = bodyAnswers(state.q.questions, state.answers);
    state.sending = true;
    state.ticket += 1;
    setBusy(refs, true);
    refs.next.setAttribute("aria-disabled", "true");
    setNetBlock(refs, null);
    announce(t("quiz_sending"));
    const outcome = await postResult(state.lang, sent);
    state.sending = false;
    setBusy(refs, false);
    if (outcome.kind === "ok") {
      showResult(outcome.body, sent);
      return;
    }
    refs.next.removeAttribute("aria-disabled");
    state.net = { kind: "result" };
    const block = netBlock("result", outcome);
    block.button.addEventListener("click", () =>
      onNetAction("result", block.button.getAttribute("data-action")),
    );
    setHeadNet(ui.head, null);
    setNetBlock(refs, block);
    focusNode(block.button);
  }

  function showResult(body, sent) {
    state.screen = "result";
    state.net = null;
    setHeadNet(ui.head, null);
    ui.question = null;
    const out = renderResult({
      lang: state.lang,
      name: state.q.name,
      result: body,
      answers: sent,
      questionnaire: state.q,
      say: t,
      head: ui.head.node,
      onEdit: () => go(state.current ?? firstVisible(state.q.questions), true),
      onRestart,
    });
    show(out.node);
    toTop();
    focusNode(out.focus);
  }

  // ---- the language

  // The page is on the language of the new questionnaire: the document, the address
  // without a new entry in the history, the header and the storage.
  function commitLanguage() {
    state.lang = state.q.lang;
    document.documentElement.lang = state.lang;
    document.title = state.q.name;
    const params = new URLSearchParams(location.search);
    params.set("lang", state.lang);
    history.replaceState(
      null,
      "",
      location.pathname + "?" + params.toString() + location.hash,
    );
    save();
  }

  // The screen again on the new language, the same question, answers and numbers; the
  // focus stays on the button of the language.
  function redraw() {
    setHeadLanguage(ui.head, state.lang, state.q.name);
    setHeadNet(ui.head, null);
    state.net = null;
    if (state.screen === "card") showCard(false);
    else if (state.screen === "question") {
      renderQuestion();
      if (state.message !== null)
        showMessage(ui.question, messageText(questionById(state.current)));
    }
    focusNode(ui.head.langs[state.lang]);
  }

  // A press on a button of a language. The last press wins: the answer of an earlier
  // one is dropped. While the result is asked for, the buttons do nothing; a press
  // whose answer comes after the result was asked for, or after the visitor left the
  // screen of the result, is dropped too, so the page and the result stay on one
  // language and the result is never opened over a screen of newer answers.
  async function changeLanguage(lang) {
    if (state.sending || lang === state.lang) return;
    state.ticket += 1;
    const ticket = state.ticket;
    const from = state.screen;
    setHeadNet(ui.head, null);
    const outcome = await getQuestionnaire(lang);
    if (ticket !== state.ticket) return;
    if (from === "result" && state.screen !== "result") return;
    if (outcome.kind !== "ok") {
      langFailed(lang, outcome);
      return;
    }
    const body = outcome.body;
    if (body.version !== state.q.version) {
      newVersion(body);
      return;
    }
    if (from === "result") {
      if (state.screen !== "result") return;
      const sent = bodyAnswers(body.questions, state.answers);
      const posted = await postResult(body.lang, sent);
      if (ticket !== state.ticket || state.screen !== "result") return;
      if (posted.kind !== "ok") {
        langFailed(lang, posted);
        return;
      }
      state.q = body;
      commitLanguage();
      setHeadLanguage(ui.head, state.lang, body.name);
      showResult(posted.body, sent);
      focusNode(ui.head.langs[state.lang]);
      return;
    }
    state.q = body;
    commitLanguage();
    redraw();
  }

  // The language did not change: the block under the header, the language stays.
  function langFailed(lang, outcome) {
    state.net = { kind: "lang", lang };
    const block = netBlock("lang", outcome);
    block.button.addEventListener("click", () =>
      onNetAction("lang", block.button.getAttribute("data-action")),
    );
    if (ui.question !== null) setNetBlock(ui.question, null);
    setHeadNet(ui.head, block);
    focusNode(block.button);
  }

  // The questionnaire of the new language is another version: what was saved is
  // cleared, the card with the notice is shown (as when the page is loaded).
  function newVersion(body) {
    const first = firstVisible(state.q.questions);
    const hadAny =
      Object.keys(state.answers).length > 0 ||
      (state.current !== null && state.current !== first);
    state.q = body;
    state.answers = noAnswers();
    state.current = null;
    state.notice = hadAny;
    state.screen = "card";
    commitLanguage();
    ui.head = makeHead();
    showCard(false);
    focusNode(ui.head.langs[state.lang]);
  }

  // The button of a block of the net: "Try again" repeats the request, "Start over"
  // (the server refused the answers) clears what was saved and opens the card.
  function onNetAction(kind, action) {
    if (action === "restart") {
      wipe();
      state.answers = noAnswers();
      state.current = null;
      state.notice = false;
      showCard(true);
      return;
    }
    if (kind === "load") load(true);
    else if (kind === "lang") changeLanguage(state.net.lang);
    else send();
  }

  load(false);
}
