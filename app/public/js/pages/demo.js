// The page script of the demo survey (the code design of the public landing, 4.5; the look 7.9 -
// 7.15, 7.18, 7.21, 8.4, 9.13, 9.15, 10, 11 and 12). It starts as the other pages do: the texts
// of the page in its language, the language switch, the theme button and the stage scene in the
// demo's load state. Then it runs the survey of the five questions of Sai's own intake, which the
// server gives in the language of the page: one tap per answer, «Назад» and «Не знаю», the live
// strip of the answers given, and the result of the server's engine for the answers, with the list
// of what Sai does not build yet and the way to describe an idea. A tap walks the visitor's figure
// by the step table of the look, and the speaker of each question is the person of its asking
// desk, drawn again after each change of the theme. The answers live only in the memory of this
// page: nothing is stored and nothing goes into the address; the server gets them only in the body
// of the result request, where «Не знаю» is a missing key. Every failed request shows a message
// with «Повторить». Elements are made with createElement and texts set with textContent; the one
// style write is the tail of the question panel.

import { QUESTION_DESKS, cameraOffset } from "../../office/stage-scene.js";
import { INERT, mountStage, pageGeometry } from "../../office/view.js";
import { LANGS, TEXTS } from "../../shared/i18n/texts.js";
import {
  REDUCED_MOTION,
  applyTexts,
  currentLang,
  drawAvatars,
  el,
  fill,
  mountLangSwitch,
  syncKkNote,
  text,
  wordsFor,
} from "../dom.js";
import { drawnTheme, mountTheme } from "../theme.js";

/** @typedef {{ readonly [key: string]: { readonly [lang: string]: string } }} Texts */
/** @typedef {import("../../office/view.js").StageView} StageView */
/** @typedef {Window & typeof globalThis} PageWindow the window of the page, with its classes */

/**
 * An option of a question, as the server gives it.
 * @typedef {{ id: string, label: string }} Option
 */

/**
 * A question of the survey.
 * @typedef {{ id: string, title: string, options: readonly Option[] }} Question
 */

/**
 * The questionnaire in the language it was asked in.
 * @typedef {{ lang: string, questions: readonly Question[] }} Survey
 */

/**
 * A kind of product the engine recommends: its name, its summary, what it includes and when
 * another one is better.
 * @typedef {object} Kind
 * @property {string} name
 * @property {string} summary
 * @property {readonly string[]} includes
 * @property {readonly string[]} notFit
 */

/**
 * The result of the engine for the answers: the kinds recommended, the first one first, whether the
 * first one leads clearly, and the text of no match when no kind is recommended.
 * @typedef {{ clearLeader: boolean, recommended: readonly Kind[], noMatchText: string }} Outcome
 */

/** @typedef {"offline" | "failed"} Failure */

/**
 * What a request gave: the JSON of an answer with the status 200, or why there is none.
 * @typedef {{ ok: true, value: unknown } | { ok: false, failure: Failure }} Fetched
 */

/**
 * What the survey shows: a question (also when it was opened from a chip of the result, «edit»),
 * or the result.
 * @typedef {{ kind: "question", i: number, edit: boolean } | { kind: "result" }} View
 */

/**
 * The result request that counts and where it is: running, failed, or answered.
 * @typedef {{ token: number, lang: string }} Asked
 * @typedef {Asked & { state: "loading" }} ResultLoading
 * @typedef {Asked & { state: "failed", failure: Failure }} ResultFailed
 * @typedef {Asked & { state: "ready", outcome: Outcome }} ResultReady
 * @typedef {ResultLoading | ResultFailed | ResultReady} ResultState
 */

/**
 * The parts of the view on the page that the survey acts on later.
 * @typedef {object} Shown
 * @property {boolean} question whether a question is shown (then the keys of the look's 12 act)
 * @property {HTMLElement | null} ask the question panel, whose tail points at its asking desk
 * @property {number} desk the asking desk of the panel
 * @property {readonly HTMLElement[]} options the option cards, in their order
 * @property {HTMLElement | null} unsure the card «Не знаю»
 * @property {readonly HTMLElement[]} cards the option cards and «Не знаю», in this order
 * @property {HTMLElement | null} ticket the live strip
 * @property {HTMLElement | null} toggle the button of the phone sheet
 * @property {HTMLElement | null} enough the button «enough, to the result»
 * @property {HTMLElement | null} heading the heading that takes the focus of a new view
 * @property {HTMLElement | null} resultWrap the result
 * @property {HTMLElement | null} resultSum the part of the result with the receipt
 * @property {HTMLElement | null} receiptBody the body of the receipt
 */

/** The page's time limit of each demo request, in ms (the code design, 4.5). */
export const DEMO_TIMEOUT_MS = 8000;

/** The two demo routes of the server. */
const QUESTIONNAIRE_ROUTE = "/api/demo/questionnaire";
const RESULT_ROUTE = "/api/demo/result";

/** The demo asks five questions, at the desks of the step table (the look's 9.13). */
const QUESTIONS = 5;

/** The loading message of the questionnaire is shown only when its answer takes longer (8.4). */
const LOADING_AFTER_MS = 300;

/** After a tap on an answer the next view opens after this many ms (7.10), or with reduced motion. */
const NEXT_MS = 480;
const NEXT_REDUCED_MS = 60;

/** The live region is emptied first and written this many ms later, so a repeated text is said. */
const ANNOUNCE_MS = 30;

/** The live strip shows at most this many answers, then «+N» (7.11). */
const MAX_LINES = 7;

/** The tail of the question panel stays this far from its edges, and points this far left of the
 * centre of its desk, in logical px (7.9, 9.13). */
const TAIL_EDGE = 30;
const TAIL_BACK = 8;

/** How far (px) a line of the speaker may end beyond its column before the speaker takes its own row. */
const SPEAKER_SLACK = 0.1;

/** The desk of the result (9.13). */
const RESULT_DESK = 4;

/** Astana time is UTC+5 (decision 0083 item 8). */
const ASTANA_MS = 5 * 60 * 60 * 1000;

/** The ten items of the list «Чего Sai пока не делает», by their number in the texts module. */
const NOT_BUILT = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

/** The three rows of the status block (the look 7.22): the keys of the title and of the line, and whether the part works. */
const NOW_ROWS = Object.freeze([
  Object.freeze({ title: "now_demo_t", line: "now_demo_s", on: true }),
  Object.freeze({ title: "now_idea_t", line: "now_idea_s", on: false }),
  Object.freeze({ title: "now_build_t", line: "now_build_s", on: false }),
]);

/**
 * The answer «Не знаю» in the memory of the page; it is never sent: the body of the result request
 * leaves its question out.
 * @type {unique symbol}
 */
const UNSURE = Symbol("unsure");

/** @typedef {string | typeof UNSURE} Answer */

/** No view on the page yet. */
/** @type {Shown} */
const NOTHING_SHOWN = Object.freeze({
  question: false,
  ask: null,
  desk: 1,
  options: [],
  unsure: null,
  cards: [],
  ticket: null,
  toggle: null,
  enough: null,
  heading: null,
  resultWrap: null,
  resultSum: null,
  receiptBody: null,
});

/** @type {Texts} */
const texts = TEXTS;

/**
 * The date of a moment in Astana time (UTC+5), as «dd.mm.yyyy», with no Intl (decision 0083 item 8).
 * @param {number} ms the moment, in ms since 1970 UTC
 * @returns {string}
 */
export function astanaDate(ms) {
  const day = new Date(ms + ASTANA_MS);
  const two = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${two(day.getUTCDate())}.${two(day.getUTCMonth() + 1)}.${day.getUTCFullYear()}`;
}

/**
 * Whether a value is a plain object (not null, not a list).
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Whether a value is a text with something besides white space.
 * @param {unknown} value
 * @returns {value is string}
 */
function filled(value) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Whether a value is a list of texts.
 * @param {unknown} value
 * @returns {value is string[]}
 */
function isTextList(value) {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * The questionnaire in an answer of the server, or null when the body is not the questionnaire: five
 * questions, each with its own id, a title and two to four options with their own ids and labels
 * (the shape of the questionnaire route, the code design 4.7).
 * @param {unknown} body
 * @param {string} lang the language it was asked in
 * @returns {Survey | null}
 */
function readSurvey(body, lang) {
  if (!isObject(body) || !Array.isArray(body.questions)) return null;
  if (body.questions.length !== QUESTIONS) return null;
  /** @type {Question[]} */
  const questions = [];
  const questionIds = new Set();
  for (const q of body.questions) {
    if (!isObject(q) || !filled(q.id) || !filled(q.title)) return null;
    if (questionIds.has(q.id) || !Array.isArray(q.options)) return null;
    if (q.options.length < 2 || q.options.length > 4) return null;
    questionIds.add(q.id);
    /** @type {Option[]} */
    const options = [];
    const optionIds = new Set();
    for (const o of q.options) {
      if (!isObject(o) || !filled(o.id) || !filled(o.label)) return null;
      if (optionIds.has(o.id)) return null;
      optionIds.add(o.id);
      options.push({ id: o.id, label: o.label });
    }
    questions.push({ id: q.id, title: q.title, options });
  }
  return { lang, questions };
}

/**
 * The result in an answer of the server, or null when the body is not the result: the kinds
 * recommended, each with a name, a summary and the lists of what it includes and when another one
 * is better, or, with no kind, the text of no match (the shape of the result route, 4.7).
 * @param {unknown} body
 * @returns {Outcome | null}
 */
function readOutcome(body) {
  if (!isObject(body) || !Array.isArray(body.recommended)) return null;
  /** @type {Kind[]} */
  const recommended = [];
  for (const s of body.recommended) {
    if (!isObject(s) || !filled(s.name) || typeof s.summary !== "string")
      return null;
    if (!isTextList(s.includes) || !isTextList(s.not_suitable_when))
      return null;
    recommended.push({
      name: s.name,
      summary: s.summary,
      includes: s.includes,
      notFit: s.not_suitable_when,
    });
  }
  const noMatch = body.no_match_text;
  if (recommended.length === 0 && !filled(noMatch)) return null;
  return {
    clearLeader: body.clear_leader !== false,
    recommended,
    noMatchText: recommended.length === 0 && filled(noMatch) ? noMatch : "",
  };
}

/**
 * Asks the server and reads the JSON of its answer, within DEMO_TIMEOUT_MS. A request that fails
 * with no answer (no connection, an address that cannot be reached, the time limit) is "offline"; an
 * answer whose status is not 200 or whose body is not JSON is "failed" (the code design, section 5,
 * E1 - E3). It never throws.
 * @param {PageWindow} win
 * @param {string} url
 * @param {RequestInit} init
 * @returns {Promise<Fetched>}
 */
async function fetchJson(win, url, init) {
  /** @type {Response} */
  let answer;
  try {
    answer = await win.fetch(url, {
      ...init,
      signal: AbortSignal.timeout(DEMO_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, failure: "offline" };
  }
  if (answer.status !== 200) return { ok: false, failure: "failed" };
  try {
    return { ok: true, value: await answer.json() };
  } catch (err) {
    return {
      ok: false,
      failure: err instanceof SyntaxError ? "failed" : "offline",
    };
  }
}

/**
 * Where the tail of the question panel points: the x of the asking desk on the screen, in CSS px from
 * the left edge of the window — (cx[desk] − 8) · s minus the camera offset (the look's 9.13 and
 * 9.14), by the geometry the stage view takes for this window (pageGeometry of view.js, the one
 * place that reads it). Null when no geometry fits.
 * @param {Document} doc
 * @param {number} desk
 * @returns {number | null}
 */
function tailX(doc, desk) {
  const geom = pageGeometry(doc);
  if (geom === null) return null;
  const camera = cameraOffset(geom, desk);
  const cx = geom.cx[desk - 1];
  if (camera === null || cx === undefined) return null;
  const stage = doc.getElementById("stage");
  const left = stage === null ? 0 : stage.getBoundingClientRect().left;
  return left + (cx - TAIL_BACK - camera) * geom.s;
}

/**
 * Pips of a count out of n (the look's 7.9 and 7.11): a full pip for each whole unit, a half pip for a
 * half, then empty ones; seen only, the text beside them says the count.
 * @param {string} cls "pg" in the question head, "pp" in the strip and the receipt
 * @param {number} value
 * @param {number} n
 * @returns {HTMLElement}
 */
function pips(cls, value, n) {
  const items = [];
  for (let k = 0; k < n; k += 1)
    items.push(
      el("i", {
        cls: value >= k + 1 ? "on" : value > k ? "half" : undefined,
      }),
    );
  return el("span", { cls, attrs: { "aria-hidden": "true" } }, items);
}

/**
 * Opens or closes the phone sheet of the live strip.
 * @param {HTMLElement} ticket
 * @param {HTMLElement} toggle
 * @param {boolean} open
 */
function setSheet(ticket, toggle, open) {
  ticket.classList.toggle("open", open);
  toggle.setAttribute("aria-expanded", String(open));
}

/**
 * The survey of the demo in the main element of the page: the question panel with the live strip,
 * or the result; the messages of a request that is slow or fails in their place. It asks for the
 * questionnaire at once, in the language of the page, and again in a new language after a switch.
 * @param {Document} doc
 * @param {PageWindow} win
 * @param {{ lang: string, stage: StageView, main: HTMLElement, live: HTMLElement | null }} parts
 * @returns {{ setLang: (lang: string) => void }}
 */
function mountSurvey(doc, win, parts) {
  const { stage, main, live } = parts;
  let lang = parts.lang;
  /** The questionnaire read last, in its language. @type {Survey | null} */
  let survey = null;
  /** The questionnaire request that counts: the one of the page's language, while it runs. */
  /** @type {{ token: number, lang: string } | null} */
  let asking = null;
  /** @type {{ lang: string, failure: Failure } | null} */
  let surveyFailed = null;
  let loadingShown = false;
  /** @type {number | null} */
  let loadingTimer = null;
  /** The answers of this page only. @type {Map<string, Answer>} */
  const answers = new Map();
  /** The questions answered, the newest answer first. @type {string[]} */
  let newest = [];
  /** @type {View} */
  let view = { kind: "question", i: 1, edit: false };
  /** @type {ResultState | null} */
  let result = null;
  /** While a tapped answer waits for its next view, another tap does nothing. */
  let locked = false;
  let tokens = 0;
  let spoken = 0;
  /** @type {Shown} */
  let shown = NOTHING_SHOWN;

  /** @param {string} key */
  const t = (key) => text(texts, key, lang);

  /** @param {string} message */
  const announce = (message) => {
    if (live === null) return;
    const mine = (spoken += 1);
    live.textContent = "";
    win.setTimeout(() => {
      if (mine === spoken) live.textContent = message;
    }, ANNOUNCE_MS);
  };

  const reduced = () => win.matchMedia(REDUCED_MOTION).matches;

  /** The asking desk of the view: that of its question, desk 4 for the result. */
  const deskOfView = () =>
    view.kind === "question"
      ? (QUESTION_DESKS[view.i - 1] ?? RESULT_DESK)
      : RESULT_DESK;

  /**
   * The text of an answer in the strip, the sheet and the chips: the label of the chosen option, or
   * «Не знаю» (also for a question not answered).
   * @param {Question} q
   */
  const answerText = (q) => {
    const answer = answers.get(q.id);
    if (typeof answer !== "string") return t("demo_not_sure");
    const option = q.options.find((o) => o.id === answer);
    return option === undefined ? t("demo_not_sure") : option.label;
  };

  /**
   * The count of the strip (7.11): an option 1, «Не знаю» one half, a question not answered 0.
   * @param {Survey} s
   */
  const stripCount = (s) =>
    s.questions.reduce((sum, q) => {
      const answer = answers.get(q.id);
      if (typeof answer === "string") return sum + 1;
      return answer === UNSURE ? sum + 0.5 : sum;
    }, 0);

  /**
   * The count of the receipt (7.12): an option 1, «Не знаю» and a question not answered one half.
   * @param {Survey} s
   */
  const receiptCount = (s) =>
    s.questions.reduce(
      (sum, q) => sum + (typeof answers.get(q.id) === "string" ? 1 : 0.5),
      0,
    );

  /** The body of the result request: the chosen option of each answered question, and no other key. */
  const answersBody = () => {
    if (survey === null) return {};
    /** @type {Array<[string, string]>} */
    const chosen = [];
    for (const q of survey.questions) {
      const answer = answers.get(q.id);
      if (typeof answer === "string") chosen.push([q.id, answer]);
    }
    return Object.fromEntries(chosen);
  };

  /**
   * The speaker of the question takes its own row (the class "own" on the head of the question, whose
   * rule is in the phone layout of site.css) only where its title or its stage line does not fit
   * beside «Назад» in the visitor's font (the owner's ruling of the look, section 7.9): the head is
   * laid out beside, each line of the speaker is measured, and a line that ends beyond its column
   * puts the speaker on its own row. No window width is a threshold. A title breaks at spaces only,
   * so a line that breaks does fit; one word wider than the column does not.
   */
  const fitSpeaker = () => {
    const head = shown.ask?.querySelector(".ask-h") ?? null;
    if (head === null) return;
    head.classList.remove("own");
    const column = head.querySelector(".who");
    if (column === null) return;
    const edge = column.getBoundingClientRect().right;
    const range = doc.createRange();
    const beyond = Array.from(column.children).some((line) => {
      range.selectNodeContents(line);
      return range.getBoundingClientRect().right > edge + SPEAKER_SLACK;
    });
    if (beyond) head.classList.add("own");
  };

  /** Points the tail of the shown question panel at its asking desk, as seen now. */
  const placeTail = () => {
    const ask = shown.ask;
    if (ask === null) return;
    const x = tailX(doc, shown.desk);
    if (x === null) return;
    const box = ask.getBoundingClientRect();
    const at = Math.max(
      TAIL_EDGE,
      Math.min(box.width - TAIL_EDGE, x - box.left),
    );
    ask.style.setProperty("--tx", `${Math.round(at)}px`);
  };

  /**
   * Puts a view on the page in the place of the one shown (a new element, so the look's rise plays),
   * then the tail, the speaker, the scroll and the focus.
   * @param {HTMLElement} wrap
   * @param {Shown} next
   * @param {{ focus?: boolean, scroll?: boolean }} how
   */
  const put = (wrap, next, how) => {
    wrap.id = "demo";
    const old = doc.getElementById("demo");
    if (old !== null) old.replaceWith(wrap);
    else main.append(wrap);
    main.className =
      next.resultWrap === null ? "panel v-ask" : "panel v-result";
    shown = next;
    fitSpeaker();
    placeTail();
    if (next.question) drawAvatars(doc, win, drawnTheme(doc, win));
    if (how.scroll === true) win.scrollTo(0, 0);
    if (how.focus === true && next.heading !== null)
      next.heading.focus({ preventScroll: true });
  };

  /**
   * A message block (the look 7.18) for a request that runs: its line only.
   * @param {string} key
   */
  const loadingBlock = (key) =>
    el("div", { cls: "msg" }, [el("p", { cls: "msg-title", text: t(key) })]);

  /**
   * A message block for a request that failed: the label, the title, what to do, «Повторить» and the
   * link to the landing.
   * @param {Failure} failure
   * @param {() => void} retry
   */
  const failureBlock = (failure, retry) => {
    const again = el("button", {
      cls: "btn",
      attrs: { type: "button" },
      text: t("demo_retry"),
    });
    again.addEventListener("click", retry);
    return el("div", { cls: "msg" }, [
      el("span", { cls: "lbl", text: t("demo_error") }),
      el("p", {
        cls: "msg-title",
        text: t(failure === "offline" ? "demo_offline" : "demo_failed"),
      }),
      el("p", { cls: "msg-text", text: t("demo_what_now") }),
      el("div", { cls: "msg-acts" }, [
        again,
        el("a", { cls: "lnk", attrs: { href: "/" }, text: t("to_landing") }),
      ]),
    ]);
  };

  /**
   * The question panel with a message block in it, in the place of the question (the look 8.4 state
   * 1 and its 11), its tail at the desk of the view.
   * @param {HTMLElement} block
   * @param {{ focus?: boolean, scroll?: boolean }} how
   */
  const putPanel = (block, how) => {
    const ask = el("div", { cls: "ask" }, [block]);
    put(
      el("div", { cls: "wrap ask-wrap" }, [ask]),
      { ...NOTHING_SHOWN, ask, desk: deskOfView() },
      how,
    );
  };

  /**
   * An answer card (7.10): its key and its label.
   * @param {string} key "1" to "4", or "0" for «Не знаю»
   * @param {string} label
   * @param {boolean} pressed
   */
  const card = (key, label, pressed) =>
    el(
      "button",
      {
        cls: key === "0" ? "card dk" : "card",
        attrs: {
          type: "button",
          "aria-pressed": String(pressed),
          "aria-keyshortcuts": key,
        },
      },
      [
        el("span", { cls: "kb", attrs: { "aria-hidden": "true" }, text: key }),
        el("span", { cls: "cl", text: label }),
      ],
    );

  /**
   * The live strip of the answers given (7.11), with its phone bar, its sheet and «enough».
   * @param {Survey} s
   */
  const strip = (s) => {
    const count = stripCount(s);
    const given = newest.filter((id) => answers.has(id));
    const byId = new Map(s.questions.map((q) => [q.id, q]));
    /** @type {HTMLElement[]} */
    const chips = [];
    for (const [k, id] of given.slice(0, MAX_LINES).entries()) {
      const q = byId.get(id);
      if (q !== undefined)
        chips.push(
          el("li", {
            cls: k === 0 ? "new" : undefined,
            text: answerText(q),
          }),
        );
    }
    if (given.length > MAX_LINES)
      chips.push(
        el("li", { cls: "more", text: `+${given.length - MAX_LINES}` }),
      );
    const lines =
      given.length === 0
        ? el("p", { cls: "tk-hint", text: t("demo_start_hint") })
        : el("ul", { cls: "tk-lines" }, chips);
    const toggle = el(
      "button",
      {
        cls: "lnk tgl",
        attrs: {
          type: "button",
          "aria-expanded": "false",
          "aria-controls": "sheet",
        },
      },
      [
        el("span", { text: t("demo_your_answers") }),
        el("span", { attrs: { "aria-hidden": "true" }, text: "▴" }),
      ],
    );
    const close = el("button", {
      cls: "lnk",
      attrs: { type: "button" },
      text: t("demo_close"),
    });
    const rows = s.questions
      .filter((q) => answers.has(q.id))
      .map((q) =>
        el("li", {}, [
          el("span", { cls: "rn" }, [
            el("b", { text: answerText(q) }),
            el("small", { text: q.title }),
          ]),
        ]),
      );
    const enough =
      given.length === 0
        ? null
        : el("button", {
            cls: "btn enough",
            attrs: { type: "button" },
            text: t("demo_enough"),
          });
    const ticket = el(
      "aside",
      {
        cls: "ticket",
        id: "ticket",
        attrs: { "aria-label": t("demo_your_answers") },
      },
      [
        el("div", { cls: "tk-sum" }, [
          el("span", { cls: "lbl", text: t("demo_your_answers") }),
          pips("pp", count, QUESTIONS),
          el("span", {
            cls: "pt",
            text: fill(t("demo_k_of_n"), {
              k: Math.floor(count),
              n: QUESTIONS,
            }),
          }),
        ]),
        lines,
        toggle,
        el("div", { cls: "tk-sheet", id: "sheet" }, [
          el("div", { cls: "sh-h" }, [
            el("b", { text: t("demo_your_answers") }),
            close,
          ]),
          el("ul", { cls: "rl" }, rows),
        ]),
        ...(enough === null ? [] : [enough]),
      ],
    );
    toggle.addEventListener("click", () =>
      setSheet(ticket, toggle, !ticket.classList.contains("open")),
    );
    close.addEventListener("click", () => {
      setSheet(ticket, toggle, false);
      toggle.focus();
    });
    if (enough !== null) enough.addEventListener("click", onEnough);
    return { ticket, toggle, enough };
  };

  /** The strip shown again after an answer, in place, the sheet left as it was. */
  const refreshStrip = () => {
    const old = shown.ticket;
    if (old === null || survey === null) return;
    const open = old.classList.contains("open");
    const next = strip(survey);
    old.replaceWith(next.ticket);
    if (open) setSheet(next.ticket, next.toggle, true);
    shown = {
      ...shown,
      ticket: next.ticket,
      toggle: next.toggle,
      enough: next.enough,
    };
  };

  /**
   * Question i (7.9 – 7.11): the speaker of its asking desk, the title, the progress, «Назад», the
   * answer cards and the live strip.
   * @param {Survey} s
   * @param {number} i
   * @param {{ focus?: boolean, scroll?: boolean }} how
   */
  const showQuestion = (s, i, how) => {
    const q = s.questions[i - 1];
    if (q === undefined) return;
    const desk = QUESTION_DESKS[i - 1] ?? RESULT_DESK;
    const answer = answers.get(q.id);
    const options = q.options.map((o, k) =>
      card(String(k + 1), o.label, answer === o.id),
    );
    const unsure = card("0", t("demo_unsure"), answer === UNSURE);
    const cards = [...options, unsure];
    options.forEach((button, k) => {
      const option = q.options[k];
      if (option !== undefined)
        button.addEventListener("click", () => onAnswer(i, option.id, button));
    });
    unsure.addEventListener("click", () => onAnswer(i, UNSURE, unsure));
    const back = el(
      "button",
      { cls: "btn ghost back", attrs: { type: "button" } },
      [
        el("span", { attrs: { "aria-hidden": "true" }, text: "‹" }),
        " ",
        t("demo_back"),
      ],
    );
    back.addEventListener("click", goBack);
    const heading = el("h2", { attrs: { tabindex: "-1" }, text: q.title });
    const ask = el("div", { cls: "ask" }, [
      el("div", { cls: "ask-h" }, [
        el("div", { cls: "spk" }, [
          el("canvas", {
            attrs: {
              "data-avatar": String(desk),
              width: "24",
              height: "26",
              "aria-hidden": "true",
            },
          }),
          el("div", { cls: "who" }, [
            el("b", { text: t(`role_${desk}`) }),
            el("span", { text: t(`stage_${desk}`) }),
          ]),
        ]),
        heading,
        el("div", { cls: "prog" }, [
          pips("pg", i, QUESTIONS),
          el("span", {
            cls: "pt",
            text: fill(t("demo_question_of"), { i, n: QUESTIONS }),
          }),
        ]),
        back,
      ]),
      el(
        "div",
        { cls: "cards", attrs: { role: "group", "aria-label": q.title } },
        cards,
      ),
    ]);
    const liveStrip = strip(s);
    put(
      el("div", { cls: "wrap ask-wrap" }, [ask, liveStrip.ticket]),
      {
        ...NOTHING_SHOWN,
        question: true,
        ask,
        desk,
        options,
        unsure,
        cards,
        ticket: liveStrip.ticket,
        toggle: liveStrip.toggle,
        enough: liveStrip.enough,
        heading,
      },
      how,
    );
  };

  /**
   * A list of the result (7.14): its heading and one row per text.
   * @param {string} title
   * @param {readonly string[]} items
   */
  const list = (title, items) =>
    el("section", {}, [
      el("h3", { text: title }),
      el(
        "ul",
        { cls: "rl" },
        items.map((item) =>
          el("li", {}, [el("span", { cls: "rn" }, [el("b", { text: item })])]),
        ),
      ),
    ]);

  /** The list «Чего Sai пока не делает», on every result. */
  const notBuilt = () =>
    list(
      t("nobuild_title"),
      NOT_BUILT.map((n) => t(`nobuild_${n}`)),
    );

  /** The status block (the look 7.22): three rows, each a mark and a title with its line, and one closing paragraph. */
  const statusBlock = () =>
    el(
      "section",
      { cls: "info now", attrs: { "aria-labelledby": "now-title" } },
      [
        el("h3", { id: "now-title", text: t("now_title") }),
        el(
          "ul",
          { cls: "rl" },
          NOW_ROWS.map((row) =>
            el("li", {}, [
              el("span", {
                cls: row.on ? "stat on" : "stat",
                text: t(row.on ? "stat_on" : "stat_off"),
              }),
              el("span", { cls: "rn" }, [
                el("b", { text: t(row.title) }),
                el("small", { text: t(row.line) }),
              ]),
            ]),
          ),
        ),
        el("p", { text: t("now_closing") }),
      ],
    );

  /** The body of the receipt and the lists, by the state of the result request (8.4 states 3, 4). */
  const fillReceipt = () => {
    const body = shown.receiptBody;
    const wrap = shown.resultWrap;
    const sum = shown.resultSum;
    if (body === null || wrap === null || sum === null || survey === null)
      return;
    if (result === null || result.lang !== lang) return;
    wrap.classList.remove("nomatch");
    for (const old of wrap.querySelectorAll(".r-lines")) old.remove();
    if (result.state === "loading") {
      body.replaceChildren(loadingBlock("demo_putting"));
      return;
    }
    if (result.state === "failed") {
      body.replaceChildren(
        failureBlock(result.failure, () => {
          askResult();
          fillReceipt();
          if (shown.heading !== null)
            shown.heading.focus({ preventScroll: true });
        }),
      );
      return;
    }
    const outcome = result.outcome;
    const first = outcome.recommended[0];
    if (first === undefined) {
      body.replaceChildren(
        el("p", { cls: "rc-nomatch", text: outcome.noMatchText }),
      );
      wrap.classList.add("nomatch");
      sum.after(el("div", { cls: "r-lines" }, [notBuilt()]));
      announce(fill(t("live_result"), { kind: outcome.noMatchText }));
      return;
    }
    const count = receiptCount(survey);
    const lines = [
      el("div", { cls: "rc-fit" }, [
        el("span", { cls: "lbl", text: t("demo_fits") }),
        el("p", { cls: "rc-kind", text: first.name }),
      ]),
    ];
    if (filled(first.summary))
      lines.push(el("p", { cls: "rc-text", text: first.summary }));
    if (!outcome.clearLeader && outcome.recommended.length > 1)
      lines.push(
        el("p", {
          cls: "rc-also",
          text: fill(t("demo_also_fits"), {
            names: outcome.recommended
              .slice(1)
              .map((kind) => kind.name)
              .join(", "),
          }),
        }),
      );
    lines.push(
      el("div", { cls: "rc-acc" }, [
        el("span", { cls: "lbl", text: t("demo_accuracy") }),
        el("div", { cls: "prog" }, [
          pips("pp", count, QUESTIONS),
          el("span", {
            cls: "pt",
            text: fill(t("demo_k_of_n"), {
              k: Math.floor(count),
              n: QUESTIONS,
            }),
          }),
        ]),
        el("p", { text: t("demo_accuracy_note") }),
      ]),
    );
    body.replaceChildren(...lines);
    const sections = [];
    if (first.includes.length > 0)
      sections.push(list(t("demo_includes"), first.includes));
    if (first.notFit.length > 0)
      sections.push(list(t("demo_not_fit"), first.notFit));
    sections.push(notBuilt());
    wrap.append(el("div", { cls: "r-lines" }, sections));
    announce(fill(t("live_result"), { kind: first.name }));
  };

  /** Asks for the result of the answers, in the language of the page. */
  const askResult = () => {
    tokens += 1;
    const token = tokens;
    const want = lang;
    result = { token, lang: want, state: "loading" };
    fetchJson(win, `${RESULT_ROUTE}?lang=${encodeURIComponent(want)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: answersBody() }),
    }).then((got) => {
      if (result === null || result.token !== token) return;
      const outcome = got.ok ? readOutcome(got.value) : null;
      result =
        outcome === null
          ? {
              token,
              lang: want,
              state: "failed",
              failure: got.ok ? "failed" : got.failure,
            }
          : { token, lang: want, state: "ready", outcome };
      if (view.kind === "result") fillReceipt();
    });
  };

  /**
   * The result (8.4 states 3 and 4; 7.12 – 7.15, 7.22): the heading, the receipt, the status block
   * and the panel «Описать идею» and the answer chips; the receipt waits for the result request,
   * which is made here when the result of the page's language is not there yet.
   * @param {Survey} s
   * @param {{ focus?: boolean, scroll?: boolean }} how
   */
  const showResult = (s, how) => {
    const heading = el("h2", {
      attrs: { tabindex: "-1" },
      text: t("demo_result_title"),
    });
    const body = el("div", { cls: "rc-body" });
    const sum = el("div", { cls: "r-sum" }, [
      heading,
      el("p", { cls: "sub", text: t("demo_result_sub") }),
      el("article", { cls: "receipt" }, [
        el("header", { cls: "rc-h" }, [
          el("span", { text: t("demo_receipt_head") }),
          el("span", { cls: "num", text: astanaDate(Date.now()) }),
        ]),
        body,
      ]),
    ]);
    const idea = el("section", { cls: "idea" }, [
      el("h3", { text: t("idea_panel_title") }),
      el("p", { cls: "sub", text: t("idea_panel_lead") }),
      el("a", {
        cls: "btn big",
        attrs: { href: "/how.html#describe-idea" },
        text: t("describe_idea"),
      }),
    ]);
    const side = el("div", { cls: "r-side" }, [statusBlock(), idea]);
    const chips = s.questions.map((q, k) => {
      const chip = el(
        "button",
        {
          cls: "chip",
          attrs: {
            type: "button",
            "aria-label": `${q.title}: ${answerText(q)}`,
          },
        },
        [el("b", { text: answerText(q) })],
      );
      chip.addEventListener("click", () => editQuestion(k + 1));
      return el("li", {}, [chip]);
    });
    const wrap = el("div", { cls: "wrap res" }, [
      sum,
      side,
      el("div", { cls: "r-ans" }, [el("ul", { cls: "chips" }, chips)]),
    ]);
    put(
      wrap,
      {
        ...NOTHING_SHOWN,
        heading,
        resultWrap: wrap,
        resultSum: sum,
        receiptBody: body,
      },
      how,
    );
    if (result === null || result.lang !== lang) askResult();
    fillReceipt();
  };

  /**
   * Shows the view of the survey: while the questionnaire of the page's language is not there, the
   * question panel with its loading message (after 300 ms) or its failure; then the question or the
   * result.
   * @param {{ focus?: boolean, scroll?: boolean }} how
   */
  const show = (how) => {
    if (survey === null || survey.lang !== lang) {
      if (surveyFailed !== null && surveyFailed.lang === lang)
        putPanel(
          failureBlock(surveyFailed.failure, () => {
            askSurvey({ focus: true });
            show({});
          }),
          how,
        );
      else if (loadingShown) putPanel(loadingBlock("demo_loading"), how);
      else put(el("div", { cls: "wrap ask-wrap" }), NOTHING_SHOWN, {});
      return;
    }
    if (view.kind === "question") showQuestion(survey, view.i, how);
    else showResult(survey, how);
  };

  /** Stops the timer of the questionnaire's loading message. */
  const stopLoadingTimer = () => {
    if (loadingTimer !== null) win.clearTimeout(loadingTimer);
    loadingTimer = null;
  };

  /**
   * Asks for the questionnaire in the language of the page; its loading message comes after 300 ms.
   * @param {{ focus: boolean }} how whether the view it opens takes the focus
   */
  const askSurvey = (how) => {
    tokens += 1;
    const token = tokens;
    const want = lang;
    asking = { token, lang: want };
    surveyFailed = null;
    loadingShown = false;
    stopLoadingTimer();
    loadingTimer = win.setTimeout(() => {
      loadingTimer = null;
      if (asking === null || asking.token !== token) return;
      loadingShown = true;
      show({});
    }, LOADING_AFTER_MS);
    fetchJson(win, `${QUESTIONNAIRE_ROUTE}?lang=${encodeURIComponent(want)}`, {
      method: "GET",
    }).then((got) => {
      if (asking === null || asking.token !== token) return;
      asking = null;
      stopLoadingTimer();
      loadingShown = false;
      const read = got.ok ? readSurvey(got.value, want) : null;
      if (read === null)
        surveyFailed = {
          lang: want,
          failure: got.ok ? "failed" : got.failure,
        };
      else survey = read;
      show({ focus: how.focus && read !== null });
    });
  };

  /** Opens the result of the answers given so far (the fifth answer, «enough» or a changed answer). */
  const openResult = () => {
    view = { kind: "result" };
    result = null;
    show({ focus: true, scroll: true });
  };

  /**
   * A tap on an answer of question i: the card pressed at once, the strip and the live region at
   * once, the figure walks to the desk of the next view (9.13), and the next view opens after 480 ms
   * (60 ms with reduced motion).
   * @param {number} i
   * @param {Answer} answer
   * @param {HTMLElement} button
   */
  const onAnswer = (i, answer, button) => {
    if (locked || view.kind !== "question" || view.i !== i || survey === null)
      return;
    const q = survey.questions[i - 1];
    if (q === undefined) return;
    locked = true;
    answers.set(q.id, answer);
    newest = [q.id, ...newest.filter((id) => id !== q.id)];
    for (const other of shown.cards)
      other.setAttribute("aria-pressed", String(other === button));
    button.classList.add("hit");
    refreshStrip();
    announce(
      fill(t("live_answer"), {
        option: answer === UNSURE ? t("demo_unsure") : answerText(q),
      }),
    );
    const toResult = view.edit || i >= QUESTIONS;
    stage.tap(toResult ? { kind: "result" } : { kind: "question", i: i + 1 });
    win.setTimeout(
      () => {
        locked = false;
        if (toResult) {
          openResult();
          return;
        }
        view = { kind: "question", i: i + 1, edit: false };
        show({ focus: true, scroll: true });
      },
      reduced() ? NEXT_REDUCED_MS : NEXT_MS,
    );
  };

  /** «Назад»: the question before, with its answer kept; on question 1 the landing (7.9). */
  const goBack = () => {
    if (locked || view.kind !== "question") return;
    if (view.i <= 1) {
      win.location.assign("/");
      return;
    }
    const i = view.i - 1;
    stage.tap({ kind: "question", i });
    view = { kind: "question", i, edit: false };
    show({ focus: true, scroll: true });
    announce(fill(t("live_back"), { i }));
  };

  /** «enough, to the result»: the result of the answers given so far. */
  const onEnough = () => {
    if (locked || view.kind !== "question") return;
    stage.tap({ kind: "result" });
    openResult();
  };

  /**
   * A chip of the result: question k, whose next answer returns to the result (7.13).
   * @param {number} k
   */
  const editQuestion = (k) => {
    if (view.kind !== "result") return;
    stage.tap({ kind: "question", i: k });
    view = { kind: "question", i: k, edit: true };
    show({ focus: true, scroll: true });
  };

  // The keys of a question (the look's 12): 1 - 4 press the cards and 0 «Не знаю»; Backspace goes
  // back wherever the focus is, and ArrowLeft when the focus is on no button; on a card ArrowLeft and
  // ArrowRight move to the card before or after; Shift+Enter is «enough»; Escape closes the sheet.
  doc.addEventListener("keydown", (e) => {
    const ticket = shown.ticket;
    const toggle = shown.toggle;
    if (
      e.key === "Escape" &&
      ticket !== null &&
      toggle !== null &&
      ticket.classList.contains("open")
    ) {
      const inside = ticket
        .querySelector(".tk-sheet")
        ?.contains(doc.activeElement);
      setSheet(ticket, toggle, false);
      if (inside === true) toggle.focus();
      return;
    }
    if (!shown.question || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key;
    const target = e.target;
    const onButton = target instanceof win.HTMLButtonElement;
    if (/^[0-9]$/.test(key)) {
      const button =
        key === "0" ? shown.unsure : shown.options[Number(key) - 1];
      if (button !== undefined && button !== null) {
        e.preventDefault();
        button.click();
      }
      return;
    }
    if (key === "Backspace" || (key === "ArrowLeft" && !onButton)) {
      e.preventDefault();
      goBack();
      return;
    }
    if ((key === "ArrowLeft" || key === "ArrowRight") && onButton) {
      const at = shown.cards.indexOf(target);
      if (at < 0) return;
      const next = shown.cards[at + (key === "ArrowRight" ? 1 : -1)];
      if (next !== undefined) {
        e.preventDefault();
        next.focus();
      }
      return;
    }
    if (key === "Enter" && e.shiftKey && shown.enough !== null) {
      e.preventDefault();
      shown.enough.click();
    }
  });
  win.addEventListener("resize", () => {
    fitSpeaker();
    placeTail();
  });

  askSurvey({ focus: true });

  return {
    setLang(next) {
      lang = next;
      spoken += 1;
      if (survey !== null && survey.lang === lang) {
        asking = null;
        surveyFailed = null;
        loadingShown = false;
        stopLoadingTimer();
      } else if (asking === null || asking.lang !== lang)
        askSurvey({ focus: false });
      show({});
    },
  };
}

/**
 * Starts the page: its texts in the language of the page, the language switch, the theme button,
 * the stage scene in the demo's load state, the note of the footer and the survey.
 * @param {Document} doc
 * @param {PageWindow} win
 * @returns {void}
 */
function start(doc, win) {
  let lang = currentLang(LANGS);
  /** @type {StageView} */
  let stage = INERT;
  const live = doc.getElementById("live");

  applyTexts(doc, texts, lang);
  syncKkNote(doc, texts, lang);

  const theme = mountTheme(doc, {
    texts,
    lang,
    onChange: (drawn) => {
      stage.refresh("theme");
      drawAvatars(doc, win, drawn);
    },
  });

  if (doc.getElementById("stage") !== null)
    stage = mountStage(doc, { words: wordsFor(texts, lang), page: "demo" });

  const main = doc.getElementById("main");
  const survey =
    main === null ? null : mountSurvey(doc, win, { lang, stage, main, live });

  mountLangSwitch(doc, {
    langs: LANGS,
    current: lang,
    onChange: (next) => {
      lang = next;
      applyTexts(doc, texts, lang);
      theme.setLang(lang);
      syncKkNote(doc, texts, lang);
      // The live region spoke in the earlier language; the page keeps one language.
      if (live !== null) live.textContent = "";
      stage.setWords(wordsFor(texts, lang));
      if (survey !== null) survey.setLang(lang);
    },
  });
}

// The page runs in a browser; in Node (a test that imports the module for astanaDate) nothing starts.
if (typeof document !== "undefined") start(document, window);
