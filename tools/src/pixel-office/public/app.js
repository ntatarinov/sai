// The page of Pixel Office (design 4.6-4.13): the header with the link to the
// server, the line "Сейчас" and the buttons of walking; the office with its
// legend and the card of an agent; the journal with its filters; the panel of
// tasks. Everything is built from one array of journal lines. The page only
// reads: its one network function sends GET. Every text that comes from the
// journal is put into the page as text (textContent), never as markup.
//
// The module touches the world only through the object `env` that it is given
// (document, fetch, clocks, timers, frames, the size of the window), so a test
// can replace all of it.

import {
  MASK_LABEL,
  POLL_MS,
  POLL_TIMEOUT_MS,
  STALE_AFTER_MS,
  parseLine,
} from "./schema.js";
import { ageOf, buildModel, showsAge, showsSessionEvent } from "./model.js";
import { buildHistory } from "./history.js";
import { MAIN_KEY, bubblesAt, buildOffice, roleKey } from "./office-model.js";
import { buildInstanceCard, defaultInstance } from "./instance-card.js";
import { buildMainCard, defaultMainSel, mainChoiceOpens } from "./main-card.js";
import { createSim } from "./office-sim.js";
import { eventDetails } from "./event-details.js";
import { createGuide } from "./guide.js";
import { createTour } from "./tour.js";
import { createHints } from "./hints.js";
import { escapeTarget, guideSections, within } from "./guide-model.js";
import { roleCode, roleName, shortId } from "./words.js";
import {
  MIN_CELL_PX,
  canvasPoint,
  drawOffice,
  fitCanvas,
  hitOffice,
  labelLines,
  labelWidths,
} from "./office-view.js";
import {
  FILTERS,
  TONES,
  JOURNAL_LIMIT,
  LIST_LIMIT,
  journalOptions,
  journalQuery,
  taskOfRow,
  journalRows,
  nowLine,
  taskPanel,
} from "./panels.js";
import {
  ageText,
  fmtDateTime,
  fmtTime,
  fmtTimeSec,
  tzLabel,
} from "./format.js";
import {
  CANVAS_UNSUPPORTED,
  CARD_CLOSE,
  CARD_EMPTY,
  CARD_HEADINGS,
  CARD_SESSIONS,
  EMPTY_HINT,
  EMPTY_JOURNAL,
  FILTER_LABELS,
  HEADER_BADGE,
  HISTORY_BADGE,
  HISTORY_CLOSE,
  HISTORY_COL_AGENT,
  HISTORY_COL_DOES,
  HISTORY_COL_RESULT,
  HISTORY_COL_TASK,
  HISTORY_EMPTY_CELL,
  HISTORY_ERROR,
  HISTORY_LOADING,
  HISTORY_META_FINISHED,
  HISTORY_META_STARTED,
  HISTORY_NOTE_AUTO,
  HISTORY_NOTE_BY,
  HISTORY_NOTE_MISSING,
  HISTORY_NO_TASKS,
  HISTORY_OPEN,
  HISTORY_SECTION_REQUEST,
  HISTORY_SECTION_TIMELINE,
  HISTORY_SECTION_UNDERSTOOD,
  HISTORY_SECTION_WORK,
  HISTORY_TASK_N,
  HISTORY_TEXT_DISABLED,
  HISTORY_TRUNCATED,
  JOURNAL_COUNT,
  JOURNAL_TITLE,
  JOURNAL_ZONE,
  LABEL_ENDED,
  LABEL_FIRST_EVENT,
  LABEL_LAST_EVENT,
  LABEL_STARTED,
  LEGEND_IDLE,
  LEGEND_IDLE_MAIN,
  LEGEND_WORKING,
  LIVE,
  MAIN_ROW,
  NOT_FROM_HOOKS,
  NOW_EMPTY,
  NOW_LIST_LABEL,
  NOW_ALL_LABEL,
  NOW_COUNT,
  NOW_HIDE,
  NOW_SHOW_ALL,
  ROW_LESS,
  ROW_MORE,
  NOW_PREFIX,
  NO_CONNECTION,
  NO_READ_KEY,
  NO_DATA,
  OFFICE_NAME,
  OFFICE_SCROLL_LABEL,
  PAUSE,
  RESUME,
  SECTION_CURRENT,
  SECTION_HISTORY,
  SECTION_STARTS,
  SESSION_RUNNING,
  SESSION_STALE,
  SESSION_WORD,
  SHOWN_NOTE,
  SPEED_LABELS,
  STATE_LABELS,
  GO_CARD_EVENTS,
  GO_ITEM_AGENT,
  GO_PANEL,
  MAIN_CARD,
  AGENT_NOT_FOUND,
  FILTERS_BUTTON,
  FILTERS_CHOSEN,
  FILTERS_EMPTY,
  FILTERS_RESET,
  FILTER_AGENT_LABEL,
  FILTER_ALL,
  FILTER_SESSION_LABEL,
  FILTER_TYPE_LABEL,
  GO_TO,
  NOT_IN_PANEL,
  NO_WINDOW,
  SEARCH_LABEL,
  SHOW_EARLIER,
  TASK_MARK,
  TASK_MARK_CLEAR,
  TASK_MARK_MAIN,
  ROLE_CODE_TITLE,
  AGENT_NOT_RECORDED,
  CARD_BLOCKS,
  CARD_INSTANCE,
  CARD_SESSION,
  COPY,
  COPY_FAIL,
  COPY_LABEL_AGENT,
  COPY_LABEL_SESSION,
  COPY_OK,
  EVENT_TABLE,
  FRESH_LIMIT,
  GIVEN_BY,
  GIVEN_NOTE,
  INSTANCES_COUNT,
  LAST_START,
  LAUNCHER_NO_LINK,
  LAUNCHER_NOT_RECORDED,
  MAIN_LABEL,
  RETURN_NOTE,
  SERVER_STARTED,
  STATE_ROWS,
  TASK_DESC_BY,
  TASK_NO_DESC,
  TASK_NO_LINK,
  TASK_SEVERAL,
  UNKNOWN_ERRORS,
  UNKNOWN_MESSAGES,
  WORKPLACE_DESK,
  WORKPLACE_IDLE,
  WORKPLACE_WORKING,
  DETAIL_LABELS,
  DETAILS_CLOSE,
  SESSION_FULL,
  SESSION_UNKNOWN,
  TASK_NOW,
  TIME_UNKNOWN,
  TASKS_TITLE,
  EMPTY_STEPS,
  EMPTY_STEPS_TITLE,
  MAIN_ABOUT,
  GUIDE_MARK,
  GUIDE_OPEN,
  OFFICE_EMPTY,
  TASKS_EMPTY,
} from "./texts.js";

const API_EVENTS = "/api/events";
const APP_NAME = "sai-pixel-office";
// The model is rebuilt when the data changed and at least this often: the
// mark "future" of the reading rule depends on the clock.
const REFRESH_MS = 10000;
// A frame is never longer than this for the movement: after a pause of the tab
// the characters do not jump.
const MAX_FRAME_SECONDS = 0.05;
// The wide layout (the same thresholds as the @media rule of style.css).
const WIDE_MIN_WIDTH = 1240;
const WIDE_MIN_HEIGHT = 640;
// A list that is not further than this from its bottom stays at the bottom.
const BOTTOM_SLACK = 24;
const SPEED_IDS = Object.freeze([1, 2, 4]);

function fill(template, values) {
  let text = template;
  for (const [name, value] of Object.entries(values)) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}

function sameStarts(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].time !== b[i].time) return false;
    if (a[i].journal_lines !== b[i].journal_lines) return false;
  }
  return true;
}

// The shape of an answer of the server (design 4.6). A foreign server on this
// port gives a failure, not an empty page.
function validShape(body) {
  return (
    body !== null &&
    typeof body === "object" &&
    body.app === APP_NAME &&
    Number.isInteger(body.lines) &&
    body.lines >= 0 &&
    Number.isInteger(body.from) &&
    body.from >= 0 &&
    Array.isArray(body.events) &&
    Array.isArray(body.server_starts)
  );
}

export function createApp(env) {
  const {
    document,
    fetchFn,
    nowFn,
    setIntervalFn,
    clearIntervalFn,
    setTimeoutFn,
    clearTimeoutFn,
    requestFrameFn,
    AbortControllerCtor,
    viewportFn,
    addResizeListener,
    clipboardFn,
    storageFn,
  } = env;

  // The one array of journal lines: element i is line i of the file, null for
  // a line that is not valid. It is changed in place, so there is one array.
  const entries = [];
  let serverStarts = [];
  let model = buildModel(entries, serverStarts, nowFn());
  let office = buildOffice(model);
  let rows = journalRows(model, office);
  let history = buildHistory(model);
  let sim = createSim();
  sim.sync(office);

  let started = false;
  let stopped = false;
  let intervalId = null;
  let inFlight = false;
  // "none" before any answer, "live" while the last poll succeeded, "down"
  // when it failed (design 4.9).
  let link = "none";
  // The first consistent answer has been applied.
  let loaded = false;
  let historyDone = false;
  let lastRebuildAt = -Infinity;
  let filter = "all";
  let paused = false;
  let speed = 1;
  let selectedKey = null;
  // The open card: null, {kind: "main"} or {kind: "instance", key} (REQ-044).
  let card = null;
  // The character whose legend button gets the focus when the card closes
  // (the role of the card shown last).
  let cardReturnKey = null;
  // What opened the first card of a chain of cards (design D13): {kind:
  // "legend" | "journal" | "panel", key?, index?, focus?} or null.
  let cardOpener = null;
  // The caption after "Скопировать": {key, target, ok} or null.
  let copied = null;
  let journalShown = false;
  // The line of the row of the journal whose details are open, or null.
  let journalOpen = null;
  // The navigation of the journal (REQ-046): the filters besides "Всё /
  // Работа / Офис", the search and how many rows are shown.
  const journalQueryState = {
    session: null,
    agent: null,
    type: null,
    task: null,
    search: "",
    shown: JOURNAL_LIMIT,
  };
  let filtersOpen = false;
  // The variants of the lists as drawn last (they are rebuilt only when they
  // change, so an open list is not replaced under the mouse).
  let filterOptionsKey = null;
  // The button "Показать более ранние" as drawn last, or null.
  let earlierButton = null;
  // The item of the panel "Задачи" a transition led to (data-target), or null.
  let panelTarget = null;
  // The items of the panel by their key, as drawn last.
  const panelItems = new Map();
  // The list of the rows of "Сейчас" now on the page, or null.
  let nowList = null;
  // The full list of "Сейчас" over the page is open (REQ-049).
  let nowAllOpen = false;
  // The window of history: the key of the open request (null: closed), the
  // time and session of that request (a key that later names another line is
  // an error, not another request), and what opened it: {kind: "journal",
  // index} or {kind: "task", key}.
  let historyKey = null;
  let historyOf = null;
  let historyOpener = null;
  // The buttons "открыть историю запроса" of the panel of tasks by the key of
  // their item, as drawn last.
  const taskButtons = new Map();
  // The buttons "агент" of the panel of tasks by the key of their item.
  const agentButtons = new Map();
  // The legend buttons by the key of the character and the rows of the journal
  // as drawn last: the page finds its own elements without searching the DOM.
  const legendButtons = new Map();
  let journalItems = [];
  let ctx = null;
  let cellPx = MIN_CELL_PX;
  let lastFrameAt = null;
  // The model is rebuilt: modelVersion grows. The office is drawn: drawnVersion
  // takes the version it was drawn from. If they differ at a tick of the
  // polling, no frame has drawn the new model and the page draws it itself.
  let modelVersion = 0;
  let drawnVersion = -1;
  const reported = new Set();
  const els = {};
  let elsReady = false;
  // The guide "Как пользоваться" next to the page (REQ-050): it opens only
  // when no card and no window of history is open, closes the full list of
  // "Сейчас" when it opens, and the canvas is fitted again after it opens and
  // closes (the office gets narrower or wider).
  const guide = createGuide({
    document,
    sections: () => guideSections(),
    canOpen: () => card === null && historyKey === null,
    beforeOpen: () => {
      closeNowAll(false);
      tour.close();
    },
    onLayout: () => guarded("холст", fit),
    onTourStart: () => {
      guide.close();
      tour.open();
    },
    // The button of the empty journal that opened the guide, if it is still
    // in the journal (the journal is drawn again); else the button of the
    // header.
    openerElement: (opener) =>
      opener?.kind === "empty" &&
      emptyGuideButton !== null &&
      within(emptyGuideButton, els.journal)
        ? emptyGuideButton
        : (els.guideOpen ?? null),
  });
  // The button "Как пользоваться" of the empty journal drawn last, or null.
  let emptyGuideButton = null;
  // The buttons "?" and their hints (REQ-053).
  const hints = createHints({ document });
  // The invitation in the header and the tour (REQ-052): the facts of the
  // page choose the text of a step, the targets are the panels themselves.
  // storageFn is given to the tour as it is; this module never calls it.
  const tour = createTour({
    document,
    storageFn,
    facts: () => ({
      characters: office.characters.length,
      nowShown: els.now?.hidden === false,
      rows: rows.length,
      items: model.list.length,
    }),
    targets: () => ({
      office: els.officePanel ?? null,
      now: els.now ?? null,
      journal: els.journal?.parentNode ?? null,
      tasks: els.tasks?.parentNode ?? null,
      guide: els.guideOpen ?? null,
    }),
    focusAfter: () => els.guideOpen ?? null,
    beforeOpen: () => hints.close(),
    // The line about the tour after "Не сейчас" goes away by itself.
    setTimeoutFn,
    clearTimeoutFn,
    // The header got wider or narrower: the button "Показать всех (N)"
    // follows the rows that fit now.
    onLayout: () => guarded("строка «Сейчас»", () => updateShowAll()),
  });

  // ------------------------------------------------------------ helpers

  const byId = (id) => document.getElementById(id);

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.classList.add(className);
    if (text !== undefined) el.textContent = text;
    return el;
  }

  // A data attribute through the attribute and, where there is one, through
  // dataset, so both ways of reading it see the same value.
  function setData(el, name, value) {
    const text = String(value);
    el.setAttribute(`data-${name}`, text);
    if (el.dataset !== undefined && el.dataset !== null) {
      el.dataset[name] = text;
    }
  }

  // One line on the console for each different message: an error that repeats
  // in every frame must not fill the console (design 4.5).
  function reportOnce(what, err) {
    const message = err instanceof Error ? err.message : String(err);
    if (reported.has(`${what}: ${message}`)) return;
    reported.add(`${what}: ${message}`);
    console.error(`Pixel Office: ${what}: ${message}`);
  }

  // The element that has the focus of the keyboard, or null.
  function focusedElement() {
    return document.activeElement ?? null;
  }

  function characterOf(key) {
    return office.characters.find((c) => c.key === key);
  }

  // ------------------------------------------------------------ network

  // The only network function of the page: GET, an address on this server
  // (relative), a limit of POLL_TIMEOUT_MS for the whole request, enforced by
  // our own timer (design 4.6).
  function getJson(url) {
    const controller = new AbortControllerCtor();
    let timer = null;
    const work = (async () => {
      const res = await fetchFn(url, {
        method: "GET",
        signal: controller.signal,
      });
      const ok =
        res.status === undefined ? res.ok === true : res.status === 200;
      if (!ok) {
        const failure = new Error(`HTTP ${res.status}`);
        failure.status = res.status;
        throw failure;
      }
      return res.json();
    })();
    // An answer that comes after the limit is of no interest and must not
    // become an unhandled rejection.
    work.catch(() => {});
    const limit = new Promise((_resolve, reject) => {
      timer = setTimeoutFn(() => {
        controller.abort();
        reject(new Error("timeout"));
      }, POLL_TIMEOUT_MS);
    });
    return Promise.race([work, limit]).finally(() => clearTimeoutFn(timer));
  }

  function setLink(state) {
    if (link === state) return;
    const first = link === "none";
    link = state;
    guarded("шапка", renderLink);
    // Before the first answer the list of the journal tells about the link.
    if (!loaded) guarded("журнал", renderJournal);
    // The open window of history tells about a lost link.
    if (historyKey !== null) guarded("история", renderHistory);
    // The first result of the link, an answer or a failure: the invitation to
    // the tour is offered (REQ-052).
    if (first) guarded("тур", () => tour.offer());
  }

  // Applies a consistent answer. from = 0: the array is replaced; from =
  // entries.length: the lines are appended. Elements that are not valid lines
  // are kept as null, so the length and the numbers of the lines do not change.
  // Returns true if anything changed.
  function applyAnswer(body) {
    const lines = body.events.map((item) =>
      item === null ? null : parseLine(item),
    );
    const startsNow = body.server_starts.filter(
      (s) => s !== null && typeof s === "object",
    );
    let changed = !sameStarts(serverStarts, startsNow);
    serverStarts = startsNow;
    if (body.from === 0) {
      if (entries.length > 0 || lines.length > 0) changed = true;
      if (entries.length > 0) {
        // The journal was replaced (deleted or cut): the routes of the old one
        // are forgotten and the new one is shown as history.
        sim = createSim();
        sim.setPaused(paused);
        sim.setSpeed(speed);
        historyDone = false;
      }
      entries.length = 0;
    } else if (lines.length > 0) {
      changed = true;
    }
    for (const line of lines) entries.push(line);
    return changed;
  }

  // One request to the server, and, if its answer does not fit the array that
  // the page has, one more at once; the second such answer is a failure.
  async function requestCycle() {
    let misfits = 0;
    for (;;) {
      let body;
      try {
        body = await getJson(`${API_EVENTS}?after=${entries.length}`);
      } catch (err) {
        // The server is not there, did not answer in time, or answered with
        // something that is not JSON: the page keeps what it has. 401: the
        // browser has no read key yet (ISS-0122), the link of the command
        // gives it.
        setLink(err?.status === 401 ? "denied" : "down");
        return;
      }
      if (!validShape(body)) {
        setLink("down");
        return;
      }
      if (body.from === 0 || body.from === entries.length) {
        const changed = applyAnswer(body);
        const first = !loaded;
        loaded = true;
        setLink("live");
        if (changed || first) rebuild(true);
        return;
      }
      misfits += 1;
      if (misfits >= 2) {
        setLink("down");
        return;
      }
    }
  }

  // Polls the server: one request in flight at a time. A call while a request
  // is on its way returns at once.
  async function poll() {
    if (stopped || inFlight) return;
    resolveEls();
    inFlight = true;
    try {
      await requestCycle();
    } catch (err) {
      // A defect of the page itself, not of the network: it is reported once
      // and the polling goes on.
      reportOnce("ошибка опроса", err);
    } finally {
      inFlight = false;
    }
  }

  // ------------------------------------------------------------ the model

  function rebuild(fromAnswer) {
    try {
      const now = nowFn();
      model = buildModel(entries, serverStarts, now);
      office = buildOffice(model);
      rows = journalRows(model, office);
      history = buildHistory(model);
      sim.sync(office);
      sim.enqueue(office.routes, { seen: !historyDone });
      if (fromAnswer) historyDone = true;
      lastRebuildAt = now;
      modelVersion += 1;
    } catch (err) {
      reportOnce("ошибка построения страницы", err);
      return;
    }
    renderAll();
    // After the legend is drawn: the place for the canvas depends on its
    // height (design 4.13).
    guarded("холст", fit);
  }

  function guarded(what, render) {
    try {
      render();
    } catch (err) {
      reportOnce(`ошибка отрисовки: ${what}`, err);
    }
  }

  // All the views are rebuilt from the one model: they cannot disagree. A
  // failure of one of them is reported and does not stop the others.
  function renderAll() {
    guarded("шапка", renderLink);
    guarded("строка «Сейчас»", renderNow);
    guarded("легенда", renderLegend);
    guarded("журнал", renderJournal);
    guarded("задачи", renderTasks);
    guarded("карточка", renderCard);
    guarded("история", renderHistory);
    guarded("офис", renderOfficeNote);
    guarded("тур", () => tour.refresh());
  }

  // The empty office (REQ-053, criterion 4): after an answer, with a canvas
  // and no characters, the note under the canvas tells when they come. Without
  // a canvas the note keeps the text of decorate.
  function renderOfficeNote() {
    if (!els.officeNote || !ctx) return;
    const empty = loaded && office.characters.length === 0;
    els.officeNote.textContent = empty ? OFFICE_EMPTY : "";
    els.officeNote.hidden = !empty;
  }

  // ------------------------------------------------------------ header

  function renderLink() {
    if (els.link) setData(els.link, "state", link);
    if (els.linkStatus) {
      let text = "";
      if (link === "live") text = LIVE;
      else if (link === "down") text = NO_CONNECTION;
      else if (link === "denied") text = NO_READ_KEY;
      els.linkStatus.textContent = text;
    }
  }

  // One row of the block "Сейчас": the name of the role and, for a task with a
  // description, " — " and the description, each as text.
  function nowRowEl(row) {
    const el = make("span", "now-row");
    el.setAttribute("role", "listitem");
    setData(el, "key", row.key);
    setData(el, "kind", row.kind);
    if (row.kind === "main" || row.description === null) {
      el.appendChild(make("span", "now-role", row.text));
    } else {
      el.appendChild(make("span", "now-role", row.role));
      el.appendChild(make("span", "now-sep", " — "));
      el.appendChild(make("span", "now-desc", row.description));
    }
    return el;
  }

  // "в работе: N", the button "Показать всех (N)" / "Скрыть" and the open full
  // list (REQ-049, criterion 1). The numbers are the count of the model.
  function renderNowSide(line) {
    const n = line.count;
    if (els.nowCount) {
      els.nowCount.textContent = n >= 1 ? fill(NOW_COUNT, { n }) : "";
      els.nowCount.hidden = n === 0;
    }
    if (n === 0 && nowAllOpen) {
      // The work is over while the list is open: it closes, the focus goes to
      // "Пауза" if it was in the list or on its button.
      const focused = focusedElement();
      const inside =
        focused !== null &&
        (focused === els.nowAll ||
          focused === els.nowShowAll ||
          els.nowAll?.contains?.(focused) === true);
      closeNowAll(false);
      if (inside) els.pause?.focus();
    }
    if (nowAllOpen && els.nowAll) {
      els.nowAll.replaceChildren(...line.rows.map(nowRowEl));
    }
    updateShowAll(n);
  }

  // The button is seen when the rows do not fit in the block (or the list is
  // open, to close it).
  function updateShowAll(count = nowLine(model).count) {
    const button = els.nowShowAll;
    if (!button) return;
    const overflow =
      nowList !== null && nowList.scrollHeight > nowList.clientHeight;
    button.hidden = !(count >= 1 && (nowAllOpen || overflow));
    button.textContent = nowAllOpen
      ? NOW_HIDE
      : fill(NOW_SHOW_ALL, { n: count });
    button.setAttribute("aria-expanded", nowAllOpen ? "true" : "false");
  }

  function openNowAll() {
    if (!els.nowAll) return;
    const line = nowLine(model);
    if (line.count === 0) return;
    nowAllOpen = true;
    els.nowAll.replaceChildren(...line.rows.map(nowRowEl));
    els.nowAll.scrollTop = 0;
    els.nowAll.hidden = false;
    if (els.nowAllCatcher) els.nowAllCatcher.hidden = false;
    updateShowAll(line.count);
  }

  // Closes the full list; focusButton: the focus goes back to the button.
  function closeNowAll(focusButton) {
    if (!nowAllOpen) return;
    nowAllOpen = false;
    if (els.nowAll) {
      els.nowAll.hidden = true;
      els.nowAll.replaceChildren();
    }
    if (els.nowAllCatcher) els.nowAllCatcher.hidden = true;
    updateShowAll();
    if (focusButton && els.nowShowAll && !els.nowShowAll.hidden) {
      els.nowShowAll.focus();
    }
  }

  function renderNow() {
    if (!els.now) return;
    if (!loaded) {
      els.now.hidden = true;
      return;
    }
    const line = nowLine(model);
    if (els.nowText) {
      // The list is built anew; its scroll and the focus of the keyboard on it
      // are kept between rebuilds.
      const old = nowList;
      const hadFocus = old !== null && old === focusedElement();
      const scroll = old === null ? 0 : old.scrollTop;
      const label = make("span", "now-label", NOW_PREFIX);
      let body;
      if (line.busy) {
        body = make("span", "now-list");
        body.setAttribute("id", "now-list");
        body.setAttribute("role", "list");
        body.setAttribute("tabindex", "0");
        body.setAttribute("aria-label", NOW_LIST_LABEL);
        for (const row of line.rows) body.appendChild(nowRowEl(row));
      } else {
        body = make("span", "now-empty", line.text.slice(NOW_PREFIX.length));
      }
      els.nowText.replaceChildren(label, body);
      nowList = line.busy ? body : null;
      if (nowList !== null && old !== null) {
        nowList.scrollTop = scroll;
        if (hadFocus) nowList.focus();
      }
    }
    els.now.title = line.title;
    setData(els.now, "busy", line.busy ? "true" : "false");
    setData(els.now, "unconfirmed", line.unconfirmed >= 1 ? "true" : "false");
    els.now.hidden = false;
    // Measured after the block is shown: a hidden list has no height.
    renderNowSide(line);
  }

  function renderControls() {
    if (els.pause) {
      els.pause.textContent = paused ? RESUME : PAUSE;
      els.pause.setAttribute("aria-pressed", paused ? "true" : "false");
    }
    for (const m of SPEED_IDS) {
      const button = els.speeds[m];
      if (button)
        button.setAttribute("aria-pressed", m === speed ? "true" : "false");
    }
  }

  function setPaused(value) {
    paused = value === true;
    sim.setPaused(paused);
    guarded("кнопки", renderControls);
  }

  function setSpeed(m) {
    if (!SPEED_IDS.includes(m)) return;
    speed = m;
    sim.setSpeed(m);
    guarded("кнопки", renderControls);
  }

  // ------------------------------------------------------------ legend

  function legendButton(key) {
    return legendButtons.get(key) ?? null;
  }

  function renderLegend() {
    if (!els.legend) return;
    // The buttons are replaced: the key of the button with the focus is kept,
    // and the new button of the same character gets the focus back.
    const focused = focusedElement();
    let focusKey = null;
    for (const [key, button] of legendButtons) {
      if (button === focused) focusKey = key;
    }
    legendButtons.clear();
    if (!loaded) {
      els.legend.replaceChildren();
      return;
    }
    const items = office.characters.map((c) => {
      const li = make("li", "legend-entry");
      const button = make("button", "legend-item");
      button.setAttribute("type", "button");
      setData(button, "key", c.key);
      setData(button, "state", c.working ? "working" : "idle");
      button.setAttribute(
        "aria-pressed",
        c.key === selectedKey ? "true" : "false",
      );
      const swatch = make("span", "swatch");
      if (c.working) setData(swatch, "color", c.color);
      let state = LEGEND_IDLE;
      if (c.working) state = LEGEND_WORKING;
      else if (c.kind === "main") state = LEGEND_IDLE_MAIN;
      button.appendChild(swatch);
      // One name of the role everywhere (REQ-048): the code only in the
      // tooltip, when it differs from the name.
      const name = make("span", "name", c.label);
      const code = c.kind === "main" ? null : roleCode(c.full);
      if (code !== null) name.setAttribute("title", codeTitle(code));
      button.appendChild(name);
      button.appendChild(make("span", "state", state));
      button.addEventListener("click", () =>
        openCard(c.key, { kind: "legend", key: c.key }),
      );
      li.appendChild(button);
      legendButtons.set(c.key, button);
      return li;
    });
    els.legend.replaceChildren(...items);
    if (focusKey !== null) legendButton(focusKey)?.focus();
  }

  // ------------------------------------------------------------ journal

  // The parts of a row of the journal, the same in the journal and in the
  // card: the line of time, "who" and session (and the mark), the words of the
  // event, the description and the caption of a service message. All as text.
  // "код роли: <code>": put together by split and join, not String.replace
  // (the code comes from the journal).
  function codeTitle(code) {
    return ROLE_CODE_TITLE.split("{code}").join(code);
  }

  function rowParts(view, into, open) {
    const meta = make("span", "row-meta");
    const time = fmtTimeSec(view.time);
    meta.appendChild(make("span", "time", time === "" ? TIME_UNKNOWN : time));
    meta.appendChild(make("span", "who", view.who));
    meta.appendChild(
      make(
        "span",
        "session",
        view.session_id === null ? SESSION_UNKNOWN : shortId(view.session_id),
      ),
    );
    // The value of source is shown only in the technical fields (REQ-048).
    if (view.marked) meta.appendChild(make("span", "mark", NOT_FROM_HOOKS));
    // The word "подробнее" / "свернуть" and the arrow (only a decoration) of a
    // row with details (REQ-049, criterion 2).
    if (open !== null) {
      const more = make("span", "row-more", open ? ROW_LESS : ROW_MORE);
      const arrow = make("span", "row-arrow", open ? " ▾" : " ▸");
      arrow.setAttribute("aria-hidden", "true");
      more.appendChild(arrow);
      meta.appendChild(more);
    }
    into.appendChild(meta);
    const main = make("span", "row-main");
    main.appendChild(make("span", "event", view.words));
    into.appendChild(main);
    if (view.description !== "") {
      into.appendChild(make("span", "row-desc", view.description));
    }
  }

  function rowItem(view) {
    const li = make("li", "row");
    setData(li, "index", view.index);
    setData(li, "tone", view.tone);
    setData(li, "marked", view.marked ? "true" : "false");
    setData(li, "kind", view.kind);
    return li;
  }

  // A row without details and without buttons: the rows of the card.
  function journalRow(view) {
    const li = rowItem(view);
    rowParts(view, li, null);
    return li;
  }

  // One field of the details: its caption and its value element.
  function detailField(box, name, label) {
    const row = make("div", "detail");
    setData(row, "field", name);
    row.appendChild(make("span", "detail-label", label));
    const value = make("span", "detail-value");
    row.appendChild(value);
    box.appendChild(row);
    return value;
  }

  // An element <details> of the details of an event; its summary takes the
  // focus by the name "part:<part>".
  function detailMore(part, caption, focus, parts) {
    const more = make("details", "detail-more");
    setData(more, "part", part);
    const summary = make("summary", undefined, caption);
    setData(summary, "focus", `part:${part}`);
    more.appendChild(summary);
    focus.set(`part:${part}`, summary);
    parts.set(part, more);
    return more;
  }

  // The details of the open row (REQ-045, criterion 3; design 5.1).
  function detailsOf(index, focus, parts) {
    const box = make("div", "event-details");
    box.setAttribute("id", `event-${index}`);
    const d = eventDetails(model, history, index);
    if (d === null) return box;
    // The main first (REQ-049, criterion 2): what happened and what it does not
    // prove, each caption over its value; then the other fields.
    const what = detailField(box, "what", DETAIL_LABELS.what);
    what.appendChild(make("span", "detail-words", d.words));
    what.appendChild(make("span", "detail-meaning", d.meaning));
    detailField(box, "not_proved", DETAIL_LABELS.not_proved).textContent =
      d.not_proved;
    detailField(box, "when", DETAIL_LABELS.when).textContent = d.when;
    detailField(box, "source", DETAIL_LABELS.source).textContent = d.source;
    const session = detailField(box, "session", DETAIL_LABELS.session);
    if (d.session === null) {
      session.textContent = SESSION_UNKNOWN;
    } else {
      session.appendChild(make("span", "session-short", d.session.short));
      const more = detailMore("session", SESSION_FULL, focus, parts);
      more.appendChild(make("span", "full-id", d.session.full));
      session.appendChild(more);
    }
    detailField(box, "agent", DETAIL_LABELS.agent).textContent = d.agent;
    const agentLinks = linksRow(index, "agent", d.links.agent, focus);
    if (d.links.notes.agent === "missing") {
      agentLinks.appendChild(make("span", "detail-note", AGENT_NOT_FOUND));
    }
    if (agentLinks.children.length > 0) box.appendChild(agentLinks);
    const task = detailField(box, "task", DETAIL_LABELS.task);
    if (d.task.state === null) {
      task.textContent = d.task.text;
    } else {
      task.appendChild(
        make("span", "task-name", `${d.task.text} · ${TASK_NOW}: `),
      );
      const badge = make(
        "span",
        "state-badge",
        STATE_LABELS[d.task.state] ?? d.task.state,
      );
      setData(badge, "state", d.task.state);
      task.appendChild(badge);
    }
    // The transitions of the task: a row of its own after the field, not in
    // its value (design D9).
    const taskLinks = linksRow(index, "task", [], focus);
    const go = (link) => taskLinks.appendChild(linkButton(index, link, focus));
    const to = d.links.task.find((l) => l.go === "card-instance");
    if (to !== undefined) go(to);
    const panelLink = d.links.task.find((l) => l.go === "panel");
    if (panelLink !== undefined) go(panelLink);
    else if (d.links.notes.panel === "missing") {
      taskLinks.appendChild(
        make("span", "detail-note", fill(NOT_IN_PANEL, { n: LIST_LIMIT })),
      );
    }
    const events = d.links.task.find((l) => l.go === "task-events");
    if (events !== undefined) go(events);
    const windowLink = d.links.task.find((l) => l.go === "history");
    if (windowLink !== undefined) go(windowLink);
    else if (d.links.notes.window === "missing") {
      taskLinks.appendChild(make("span", "detail-note", NO_WINDOW));
    }
    if (taskLinks.children.length > 0) box.appendChild(taskLinks);
    if (d.note !== null) {
      maskedInto(
        detailField(box, "note_text", DETAIL_LABELS.note_text),
        d.note.text,
      ).classList.add("history-note-text");
      if (d.note.req_id !== null) {
        detailField(box, "req", DETAIL_LABELS.req).textContent = d.note.req_id;
      }
      if (d.note.request_time !== null) {
        const value = detailField(
          box,
          "request_time",
          DETAIL_LABELS.request_time,
        );
        const shown = fmtDateTime(d.note.request_time);
        value.appendChild(make("span", undefined, shown || TIME_UNKNOWN));
        if (d.note.auto) value.appendChild(historyAutoMark());
      }
    }
    if (d.mark !== null) {
      detailField(box, "mark", DETAIL_LABELS.mark).textContent = d.mark;
    }
    const tech = detailMore("tech", DETAIL_LABELS.tech, focus, parts);
    const list = make("ul", "detail-tech");
    for (const [key, value] of d.tech) {
      const li = make("li");
      li.appendChild(make("span", "tech-key", `${key}: `));
      li.appendChild(make("span", "tech-value", value));
      list.appendChild(li);
    }
    tech.appendChild(list);
    box.appendChild(tech);
    const close = make("button", "ctl", DETAILS_CLOSE);
    close.classList.add("details-close");
    close.setAttribute("type", "button");
    setData(close, "focus", "close");
    close.addEventListener("click", () => closeEvent(true));
    focus.set("close", close);
    box.appendChild(close);
    return box;
  }

  // One transition of the details of an event (design 4.3): a button that
  // looks like a link. The focus name is "go:<go>"; "кому" is "go:to".
  function linkButton(index, link, focus) {
    const name = link.label === GO_TO ? "go:to" : `go:${link.go}`;
    const button = make("button", "detail-link", link.label);
    button.setAttribute("type", "button");
    setData(button, "focus", name);
    setData(button, "go", link.go);
    focus.set(name, button);
    button.addEventListener("click", () => follow(index, link, name));
    return button;
  }

  function linksRow(index, field, links, focus) {
    const row = make("div", "detail-links");
    setData(row, "for", field);
    for (const link of links) row.appendChild(linkButton(index, link, focus));
    return row;
  }

  function follow(index, link, name) {
    const opener = { kind: "journal", index, focus: name };
    if (link.go === "card-instance") {
      openInstance(link.target, "link", opener);
    } else if (link.go === "card-main") {
      openMain(link.target, "link", opener);
    } else if (link.go === "panel") {
      goPanel(link.target);
    } else if (link.go === "task-events") {
      goTaskEvents(link.target, index);
    } else if (link.go === "history") {
      openHistory(link.target, { kind: "journal", index, focus: name });
    }
  }

  // A row of the journal panel (REQ-045, design 5.1): the row itself is a
  // button that opens and closes the details of the event under it; a message
  // of the owner with a window has a separate button that opens the window
  // (REQ-008). Returns the row with its focusable elements and its <details>.
  function journalPanelRow(view) {
    const li = rowItem(view);
    const focus = new Map();
    const parts = new Map();
    const open = journalOpen === view.index;
    const toggle = make("button", "row-toggle");
    toggle.setAttribute("type", "button");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-controls", `event-${view.index}`);
    setData(toggle, "focus", "toggle");
    rowParts(view, toggle, open);
    toggle.addEventListener("click", () => toggleEvent(view.index));
    li.appendChild(toggle);
    focus.set("toggle", toggle);
    const key = `req:${view.index}`;
    if (
      view.event === "UserPromptSubmit" &&
      view.prompt_kind === "owner" &&
      history.byKey.has(key)
    ) {
      li.classList.add("opens-history");
      setData(li, "request", key);
      const button = make("button", "history-open", HISTORY_OPEN);
      button.setAttribute("type", "button");
      setData(button, "request", key);
      setData(button, "focus", "history");
      const opener = { kind: "journal", index: view.index };
      button.addEventListener("click", () => openHistory(key, opener));
      li.appendChild(button);
      focus.set("history", button);
    }
    const details = open ? detailsOf(view.index, focus, parts) : null;
    if (details !== null) li.appendChild(details);
    li.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || journalOpen !== view.index) return;
      if (typeof event.preventDefault === "function") event.preventDefault();
      if (typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }
      // The one order of Escape of the page (design REQ-050-053 4.1): the
      // open list "Показать всех" closes before the details of a row; the
      // focus stays on the row, so the next Escape closes the details.
      escapeStep("row");
    });
    return { index: view.index, li, focus, parts, details };
  }

  function journalNote(reason) {
    const li = make("li", "journal-empty");
    setData(li, "reason", reason);
    if (reason === "empty") {
      li.appendChild(make("span", "empty-title", EMPTY_JOURNAL));
      li.appendChild(make("span", "empty-hint", EMPTY_HINT));
      // What to do for the first events, and the way to the guide (REQ-053,
      // criterion 3).
      li.appendChild(make("p", "empty-steps-title", EMPTY_STEPS_TITLE));
      const steps = make("ol", "empty-steps");
      for (const text of EMPTY_STEPS) steps.appendChild(make("li", "", text));
      li.appendChild(steps);
      const button = make("button", "guide-open-empty");
      button.classList.add("ctl");
      button.setAttribute("type", "button");
      button.setAttribute("aria-label", GUIDE_OPEN);
      const mark = make("span", "guide-mark", GUIDE_MARK);
      mark.setAttribute("aria-hidden", "true");
      button.appendChild(mark);
      button.appendChild(make("span", "guide-open-text", GUIDE_OPEN));
      button.addEventListener("click", () => guide.open({ kind: "empty" }));
      li.appendChild(button);
      emptyGuideButton = button;
    } else if (reason === "filtered") {
      // One text for any empty choice, the former "Работа" / "Офис" too (D10).
      li.appendChild(make("span", "empty-title", FILTERS_EMPTY));
      const reset = make("button", "filter", FILTERS_RESET);
      reset.setAttribute("type", "button");
      reset.addEventListener("click", () => resetFilters(true));
      li.appendChild(reset);
    } else {
      li.textContent = reason === "no-connection" ? NO_CONNECTION : NO_DATA;
    }
    return li;
  }

  // The first row visible from the top: its line and its distance from the
  // top of the visible part.
  function anchorOf(list) {
    const top = list.scrollTop;
    for (const { index, li } of journalItems) {
      if (li.offsetTop + li.offsetHeight > top) {
        return { index, offset: li.offsetTop - top };
      }
    }
    return null;
  }

  // The element with the focus inside a row of the journal: the line of the
  // row and the name of the element, or null.
  function journalFocus() {
    const focused = focusedElement();
    if (focused === null) return null;
    for (const item of journalItems) {
      for (const [name, el] of item.focus) {
        if (el === focused) return { index: item.index, name };
      }
    }
    return null;
  }

  // keep: the line of a row whose place on the screen stays (the open row, or
  // the row just opened or closed); reveal: scroll so that this row is seen.
  function renderJournal(toBottom = false, keep = null, reveal = false) {
    const zone = fill(JOURNAL_ZONE, { tz: tzLabel() });
    const list = els.journal;
    if (!loaded) {
      // Before the first answer the search and the filters are there with
      // only "все …" (description, section 11).
      guarded("фильтры журнала", renderJournalTools);
      if (els.journalMeta) els.journalMeta.textContent = zone;
      if (list) {
        list.replaceChildren(
          ...(link === "down" ? [journalNote("no-connection")] : []),
        );
      }
      journalItems = [];
      return;
    }
    guarded("фильтры журнала", renderJournalTools);
    const picked = journalQuery(
      rows,
      { base: filter, ...journalQueryState },
      { model, history },
    );
    if (els.journalMeta) {
      els.journalMeta.textContent =
        zone +
        fill(JOURNAL_COUNT, { n: picked.rows.length, N: picked.matching });
    }
    if (!list) return;
    // A row whose details are open but which is no longer shown closes.
    if (
      journalOpen !== null &&
      !picked.rows.some((view) => view.index === journalOpen)
    ) {
      journalOpen = null;
    }
    const atBottom =
      list.scrollHeight - list.clientHeight - list.scrollTop <= BOTTOM_SLACK;
    const anchor = anchorOf(list);
    const keepIndex = keep ?? journalOpen;
    const kept = journalItems.find((item) => item.index === keepIndex);
    const keptOffset =
      kept === undefined ? null : kept.li.offsetTop - list.scrollTop;
    // The rows are replaced: the element with the focus and the open parts of
    // the details are given back to the new rows.
    const focus = journalFocus();
    const emptyFocused =
      emptyGuideButton !== null && emptyGuideButton === focusedElement();
    const earlierFocused =
      earlierButton !== null && earlierButton === focusedElement();
    const openParts = new Map();
    for (const item of journalItems) {
      if (item.index !== journalOpen) continue;
      for (const [part, el] of item.parts)
        openParts.set(part, el.open === true);
    }
    journalItems = picked.rows.map(journalPanelRow);
    for (const item of journalItems) {
      if (item.index !== journalOpen) continue;
      for (const [part, el] of item.parts) {
        if (openParts.get(part) === true) el.open = true;
      }
    }
    let items = journalItems.map((item) => item.li);
    earlierButton = null;
    if (picked.matching > picked.rows.length) {
      // "Показать более ранние" stands first, over the earliest shown row.
      const li = make("li", "journal-earlier");
      earlierButton = make("button", "ctl", SHOW_EARLIER);
      earlierButton.setAttribute("type", "button");
      earlierButton.addEventListener("click", () => showEarlier());
      li.appendChild(earlierButton);
      items = [li, ...items];
    }
    if (rows.length === 0) items = [journalNote("empty")];
    else {
      emptyGuideButton = null;
      if (picked.rows.length === 0) items = [journalNote("filtered")];
    }
    list.replaceChildren(...items);
    // The button of the empty journal had the focus: the new one gets it, or
    // the list when the journal is no longer empty.
    if (emptyFocused) {
      if (emptyGuideButton !== null) {
        emptyGuideButton.focus({ preventScroll: true });
      } else list.focus({ preventScroll: true });
    }
    const now = journalItems.find((item) => item.index === keepIndex);
    if (!journalShown || toBottom) {
      list.scrollTop = list.scrollHeight;
    } else if (now !== undefined && keptOffset !== null) {
      list.scrollTop = now.li.offsetTop - keptOffset;
    } else if (atBottom || anchor === null) {
      list.scrollTop = list.scrollHeight;
    } else {
      const same = journalItems.find((item) => item.index === anchor.index);
      list.scrollTop =
        same === undefined ? 0 : same.li.offsetTop - anchor.offset;
    }
    // The empty journal is read from its top (description REQ-050-053 8.1).
    if (rows.length === 0) list.scrollTop = 0;
    // After the details open (REQ-049, criterion 2): if the row with its
    // details is not seen whole, the top of the details goes to the top of the
    // visible part of the list.
    if (reveal && now !== undefined) {
      const top = now.li.offsetTop;
      const bottom = top + now.li.offsetHeight;
      const seen =
        top >= list.scrollTop && bottom <= list.scrollTop + list.clientHeight;
      if (!seen) {
        list.scrollTop = now.details !== null ? now.details.offsetTop : top;
      }
    }
    journalShown = true;
    if (earlierFocused) {
      // The focus stays on the button; when all is shown, on the first row.
      if (earlierButton !== null) earlierButton.focus({ preventScroll: true });
      else {
        journalItems[0]?.focus.get("toggle")?.focus({ preventScroll: true });
      }
    }
    if (focus !== null) {
      const item = journalItems.find((it) => it.index === focus.index);
      const el = item?.focus.get(focus.name) ?? item?.focus.get("toggle");
      // The scroll was set above; the focus must not move it.
      if (el !== undefined) el.focus({ preventScroll: true });
      else list.focus({ preventScroll: true });
    }
  }

  // Opens the details of a row (the details open before close): the focus
  // stays on the row.
  function openEvent(index) {
    journalOpen = index;
    guarded("журнал", () => renderJournal(false, index, true));
    journalItems
      .find((item) => item.index === index)
      ?.focus.get("toggle")
      ?.focus({ preventScroll: true });
  }

  // Closes the open details; focusRow: the focus goes to its row.
  function closeEvent(focusRow) {
    const index = journalOpen;
    if (index === null) return;
    journalOpen = null;
    guarded("журнал", () => renderJournal(false, index, false));
    if (focusRow) {
      journalItems
        .find((item) => item.index === index)
        ?.focus.get("toggle")
        ?.focus();
    }
  }

  function toggleEvent(index) {
    if (journalOpen === index) closeEvent(true);
    else openEvent(index);
  }

  function renderFilters() {
    for (const name of FILTERS) {
      const button = els.filters[name];
      if (button) {
        button.setAttribute("aria-pressed", name === filter ? "true" : "false");
      }
    }
  }

  function setFilter(name) {
    filter = FILTERS.includes(name) ? name : "all";
    journalQueryState.shown = JOURNAL_LIMIT;
    guarded("фильтры", renderFilters);
    guarded("журнал", () => renderJournal(true));
  }

  // The search, the lists of the filters, "Сбросить фильтры" and the mark
  // "Задача" (REQ-046, design 3.10). A chosen variant that is no longer in the
  // journal falls back to "все …". Before the first answer the lists have only
  // "все …" (description, section 11).
  function renderJournalTools() {
    const q = journalQueryState;
    const options = loaded
      ? journalOptions(rows, model, office)
      : { sessions: [], agents: [], types: [] };
    const lists = [
      [
        "session",
        els.filterSession,
        FILTER_ALL.session,
        options.sessions.map((o) => [o.id, o.label]),
      ],
      [
        "agent",
        els.filterAgent,
        FILTER_ALL.agent,
        options.agents.map((o) => [o.value, o.label]),
      ],
      [
        "type",
        els.filterType,
        FILTER_ALL.type,
        options.types.map((o) => [o.value, o.label]),
      ],
    ];
    const key = JSON.stringify(lists.map((l) => l[3]));
    for (const [name, select, all, variants] of lists) {
      if (q[name] !== null && !variants.some(([value]) => value === q[name])) {
        q[name] = null;
        q.shown = JOURNAL_LIMIT;
      }
      if (!select) continue;
      if (key !== filterOptionsKey) {
        const first = make("option", undefined, all);
        first.setAttribute("value", "");
        first.value = "";
        const opts = [first];
        for (const [value, label] of variants) {
          const option = make("option", undefined, label);
          option.setAttribute("value", value);
          option.value = value;
          opts.push(option);
        }
        select.replaceChildren(...opts);
      }
      select.value = q[name] ?? "";
    }
    filterOptionsKey = key;
    if (q.task !== null && !taskExists(q.task)) {
      q.task = null;
      q.shown = JOURNAL_LIMIT;
    }
    const chosen = q.session !== null || q.agent !== null || q.type !== null;
    const any = chosen || q.task !== null || q.search.trim() !== "";
    if (els.journalFilters) {
      els.journalFilters.textContent =
        !filtersOpen && chosen ? FILTERS_CHOSEN : FILTERS_BUTTON;
      els.journalFilters.setAttribute(
        "aria-expanded",
        filtersOpen ? "true" : "false",
      );
      setData(els.journalFilters, "chosen", chosen ? "true" : "false");
    }
    if (els.journalFilterLine) els.journalFilterLine.hidden = !filtersOpen;
    if (els.journalReset) els.journalReset.hidden = !any;
    if (els.journalTaskMark) {
      if (q.task === null) {
        els.journalTaskMark.hidden = true;
        els.journalTaskMark.replaceChildren();
      } else {
        const focusedClear =
          focusedElement() !== null &&
          focusedElement() === els.journalTaskMark.lastChild;
        const text = make("span", "task-mark-text", taskMarkText(q.task));
        const clear = make("button", "task-mark-clear", "×");
        clear.setAttribute("type", "button");
        clear.setAttribute("aria-label", TASK_MARK_CLEAR);
        clear.title = TASK_MARK_CLEAR;
        clear.addEventListener("click", () => {
          journalQueryState.task = null;
          journalQueryState.shown = JOURNAL_LIMIT;
          guarded("журнал", () => renderJournal(true));
          els.journalSearch?.focus();
        });
        els.journalTaskMark.replaceChildren(text, clear);
        els.journalTaskMark.hidden = false;
        if (focusedClear) clear.focus();
      }
    }
  }

  function taskExists(ref) {
    if (ref.kind === "task") return model.tasks.some((t) => t.key === ref.key);
    return model.mainRows.some((r) => r.key === ref.key);
  }

  // "Задача: <название роли> <8 знаков>" or "Задача: Основная сессия"; the
  // template is put together by split and join (the role comes from the
  // journal).
  function taskMarkText(ref) {
    if (ref.kind !== "task") return TASK_MARK_MAIN;
    const task = model.tasks.find((t) => t.key === ref.key);
    return TASK_MARK.split("{role}")
      .join(roleName(task === undefined ? "" : task.role))
      .split("{id}")
      .join(shortId(ref.key));
  }

  // Any change of a filter or of the search shows the last JOURNAL_LIMIT rows
  // again.
  function changeQuery(name, value) {
    journalQueryState[name] = value;
    journalQueryState.shown = JOURNAL_LIMIT;
    guarded("журнал", () => renderJournal(true));
  }

  // "Сбросить фильтры": every filter, the mark "Задача" and the search go,
  // "Всё / Работа / Офис" becomes "Всё".
  function resetFilters(focusSearch) {
    const q = journalQueryState;
    q.session = null;
    q.agent = null;
    q.type = null;
    q.task = null;
    q.search = "";
    q.shown = JOURNAL_LIMIT;
    if (els.journalSearch) els.journalSearch.value = "";
    filter = "all";
    guarded("фильтры", renderFilters);
    guarded("журнал", () => renderJournal(true));
    if (focusSearch) els.journalSearch?.focus();
  }

  // "Показать более ранние": JOURNAL_LIMIT more rows above; the rows on the
  // screen keep their place.
  function showEarlier() {
    const list = els.journal;
    const anchor = list ? anchorOf(list) : null;
    journalQueryState.shown += JOURNAL_LIMIT;
    guarded("журнал", () =>
      renderJournal(false, anchor === null ? null : anchor.index),
    );
  }

  // "события этой задачи" (design 4.3): the filter "Задача", the other filters
  // and the search go, "Всё"; the open details stay open and keep the focus if
  // their row is in the task, else the focus goes to the mark.
  function goTaskEvents(ref, fromIndex = null, openLast = false) {
    const q = journalQueryState;
    q.session = null;
    q.agent = null;
    q.type = null;
    q.search = "";
    q.task = ref;
    q.shown = JOURNAL_LIMIT;
    if (els.journalSearch) els.journalSearch.value = "";
    filter = "all";
    guarded("фильтры", renderFilters);
    const inTask =
      fromIndex !== null &&
      taskOfRow(model, history, fromIndex).some(
        (r) => r.kind === ref.kind && r.key === ref.key,
      );
    if (!inTask && fromIndex !== null && journalOpen === fromIndex) {
      journalOpen = null;
    }
    guarded("журнал", () =>
      renderJournal(false, inTask ? fromIndex : null, inTask),
    );
    if (openLast && journalItems.length > 0) {
      // From a card: the last row of the task is open and its row has the
      // focus (REQ-047, criterion 2 (б)).
      const last = journalItems[journalItems.length - 1].index;
      journalOpen = last;
      guarded("журнал", () => renderJournal(false, last, true));
      journalItems
        .find((item) => item.index === last)
        ?.focus.get("toggle")
        ?.focus({ preventScroll: true });
    } else if (inTask) {
      journalItems
        .find((item) => item.index === fromIndex)
        ?.focus.get("go:task-events")
        ?.focus({ preventScroll: true });
    } else {
      els.journalTaskMark?.lastChild?.focus?.();
    }
  }

  // "к задаче в панели" (design 4.3, description 6.2): the item gets the mark
  // data-target, the body of the panel scrolls so that it is seen whole and
  // the item gets the focus.
  function goPanel(key) {
    if (card !== null) closeCard();
    panelTarget = key;
    guarded("задачи", renderTasks);
    const el = panelItems.get(key);
    const body = els.tasks;
    if (el === undefined) return;
    if (body) {
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (top < body.scrollTop) body.scrollTop = top;
      else if (bottom > body.scrollTop + body.clientHeight) {
        body.scrollTop = Math.min(top, bottom - body.clientHeight);
      }
    }
    el.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ tasks

  function timeSpan(className, label, iso) {
    const span = make("span", className, fmtTime(iso));
    setData(span, "label", label);
    return span;
  }

  // The age of the last event as a separate span; none if it is unknown.
  function ageSpan(ms) {
    const text = ageText(ms);
    return text === "" ? null : make("span", "age", text);
  }

  // The contents of an item of the list (a task or a row of the main
  // session); the same in the panel and in the card.
  function itemInto(el, item) {
    setData(el, "kind", item.kind);
    setData(el, "key", item.key);
    setData(el, "state", item.state);
    const head = make("div", "item-head");
    let role;
    if (item.kind === "main") {
      role = make("span", "item-role", MAIN_ROW);
      setData(role, "color", 0);
    } else {
      const character = characterOf(roleKey(item.role));
      role = make("span", "item-role", roleName(item.role));
      setData(role, "color", character === undefined ? 0 : character.color);
      const code = roleCode(item.role);
      if (code !== null) role.setAttribute("title", codeTitle(code));
    }
    head.appendChild(role);
    head.appendChild(
      make("span", "item-state", STATE_LABELS[item.state] ?? item.state),
    );
    el.appendChild(head);
    if (item.kind === "task") {
      if (typeof item.description === "string" && item.description !== "") {
        el.appendChild(make("span", "item-desc", item.description));
      }
    }
    const time = make("div", "item-time");
    time.appendChild(timeSpan("started", LABEL_STARTED, item.started_at));
    if (showsSessionEvent(item.state)) {
      time.appendChild(
        timeSpan("last-event", LABEL_LAST_EVENT, item.session_last_event_at),
      );
      // After a restart the age says nothing about the work, so none is shown.
      if (showsAge(item.state)) {
        const age = ageSpan(item.age_ms);
        if (age !== null) time.appendChild(age);
      }
    } else if (item.state === "completed") {
      time.appendChild(timeSpan("ended", LABEL_ENDED, item.ended_at));
    }
    time.appendChild(make("span", "session", shortId(item.session_id)));
    el.appendChild(time);
    return el;
  }

  function sessionCard(card) {
    const div = make("div", "session-card");
    setData(div, "session", shortId(card.session_id));
    setData(div, "running", card.running ? "true" : "false");
    if (card.word !== null) {
      setData(div, "word", card.word);
      const badge = make(
        "span",
        "session-badge",
        card.word === "running" ? SESSION_RUNNING : SESSION_STALE,
      );
      setData(badge, "state", card.word);
      div.appendChild(badge);
    }
    const line = make("span", "session-line");
    line.appendChild(make("span", "session-word", SESSION_WORD));
    line.appendChild(make("span", "session-id", shortId(card.session_id)));
    div.appendChild(line);
    const times = make("div", "session-times");
    times.appendChild(
      timeSpan("first-event", LABEL_FIRST_EVENT, card.first_event_at),
    );
    times.appendChild(
      timeSpan("last-event", LABEL_LAST_EVENT, card.last_event_at),
    );
    const age = ageSpan(card.age_ms);
    if (age !== null) times.appendChild(age);
    div.appendChild(times);
    return div;
  }

  function sectionTitle(name, text) {
    const h3 = make("h3", "section-title", text);
    setData(h3, "section", name);
    return h3;
  }

  // An item of the panel of tasks: the contents of itemInto (the same as in the
  // card of an agent) and, last, a separate button that opens the window of
  // the request the item belongs to; the item itself is not a button
  // (REQ-008, design 7.5).
  function panelItem(item) {
    const el = itemInto(make("div", "item"), item);
    panelItems.set(item.key, el);
    if (item.key === panelTarget) {
      setData(el, "target", "true");
      el.setAttribute("tabindex", "-1");
    }
    // "агент": the card of this instance or of the main session on this row
    // (REQ-047, criterion 3 (е)).
    const agent = make("button", "item-agent", GO_ITEM_AGENT);
    agent.setAttribute("type", "button");
    const opener = { kind: "panel", key: item.key };
    agent.addEventListener("click", () => {
      if (item.kind === "task") openInstance(item.key, "link", opener);
      else {
        openMain({ row: item.key, session: item.session_id }, "link", opener);
      }
    });
    el.appendChild(agent);
    agentButtons.set(item.key, agent);
    const key =
      item.kind === "task"
        ? history.windowOfTask.get(item.key)
        : history.windowOfMainRow.get(item.key);
    if (key === undefined) return el;
    const button = make("button", "history-open", HISTORY_OPEN);
    button.setAttribute("type", "button");
    setData(button, "request", key);
    const historyOpenerOf = { kind: "task", key: item.key };
    button.addEventListener("click", () => openHistory(key, historyOpenerOf));
    el.appendChild(button);
    taskButtons.set(item.key, button);
    return el;
  }

  function renderTasks() {
    const body = els.tasks;
    if (!body) return;
    // The buttons are replaced: the button with the focus gets it back.
    const focused = focusedElement();
    let focusKey = null;
    let agentFocusKey = null;
    for (const [key, button] of taskButtons) {
      if (button === focused) focusKey = key;
    }
    for (const [key, button] of agentButtons) {
      if (button === focused) agentFocusKey = key;
    }
    taskButtons.clear();
    agentButtons.clear();
    panelItems.clear();
    if (!loaded) {
      body.replaceChildren();
      return;
    }
    const panel = taskPanel(model);
    const out = panel.running.map(sessionCard);
    out.push(sectionTitle("current", SECTION_CURRENT));
    if (panel.current.length === 0) {
      // No task and no line of the main session at all (REQ-053, criterion
      // 5): the text tells when the first element comes.
      const text = model.list.length === 0 ? TASKS_EMPTY : NOW_EMPTY;
      out.push(make("p", "section-empty", text));
    }
    for (const item of panel.current) out.push(panelItem(item));
    if (panel.unconfirmed_note !== null) {
      const note = make("p", "unconfirmed-note", panel.unconfirmed_note.text);
      setData(note, "section", "unconfirmed");
      out.push(note);
    }
    out.push(sectionTitle("history", SECTION_HISTORY));
    if (panel.history.length === 0) {
      out.push(make("p", "section-empty", NO_DATA));
    }
    for (const entry of panel.history) {
      out.push(
        entry.kind === "session" ? sessionCard(entry) : panelItem(entry),
      );
    }
    if (panel.total > panel.shown) {
      out.push(
        make(
          "p",
          "tasks-note",
          fill(SHOWN_NOTE, { n: panel.shown, N: panel.total }),
        ),
      );
    }
    out.push(sectionTitle("starts", SECTION_STARTS));
    if (panel.starts.length === 0) {
      out.push(make("p", "section-empty", NO_DATA));
    } else {
      const ul = make("ul", "starts");
      for (const s of panel.starts) {
        ul.appendChild(make("li", undefined, fmtDateTime(s.time)));
      }
      out.push(ul);
    }
    body.replaceChildren(...out);
    if (focusKey !== null) taskButtons.get(focusKey)?.focus();
    if (agentFocusKey !== null) agentButtons.get(agentFocusKey)?.focus();
  }

  // ------------------------------------------------------------ card

  // total: how many items the section has before its limit; when it is more
  // than shown, the note "показано n из N" stands under the list.
  function cardSection(name, heading, items, total = items.length) {
    const section = make("section", "card-section");
    setData(section, "list", name);
    section.appendChild(make("h4", undefined, heading));
    const ul = make("ul");
    if (items.length === 0) ul.appendChild(make("li", "empty", CARD_EMPTY));
    for (const item of items) ul.appendChild(item);
    section.appendChild(ul);
    if (total > items.length) {
      section.appendChild(
        make(
          "p",
          "tasks-note",
          fill(SHOWN_NOTE, { n: items.length, N: total }),
        ),
      );
    }
    return section;
  }

  // The five sections of the card of a role (REQ-007, REQ-042): the card of
  // the main session and the part "Вся роль" of the card of an instance.
  function roleSections(data) {
    const viewByIndex = new Map(rows.map((r) => [r.index, r]));
    return [
      cardSection(
        "in-progress",
        CARD_HEADINGS.in_progress,
        data.in_progress.map((item) => itemInto(make("li", "item"), item)),
      ),
      cardSection(
        "unconfirmed",
        CARD_HEADINGS.unconfirmed,
        data.unconfirmed.map((item) => itemInto(make("li", "item"), item)),
        data.unconfirmed_total,
      ),
      cardSection(
        "recent-completed",
        CARD_HEADINGS.recent_completed,
        data.recent_completed.map((item) => itemInto(make("li", "item"), item)),
      ),
      cardSection(
        "unrecorded",
        CARD_HEADINGS.unrecorded,
        data.unrecorded.map((item) => itemInto(make("li", "item"), item)),
        data.unrecorded_total,
      ),
      cardSection(
        "recent-events",
        CARD_HEADINGS.recent_events,
        data.recent_events
          .map((row) => viewByIndex.get(row.index))
          .filter((view) => view !== undefined)
          .map(journalRow),
      ),
    ];
  }

  // A date and time with seconds, or TIME_UNKNOWN; with the age when asked.
  function whenAge(iso, withAge) {
    const shown = fmtDateTime(iso);
    if (shown === "") return TIME_UNKNOWN;
    if (!withAge) return shown;
    const age = ageText(ageOf(iso, model.now_ms));
    return age === "" ? shown : `${shown} · ${age}`;
  }

  function stateBadge(state) {
    const badge = make("span", "state-badge", STATE_LABELS[state] ?? state);
    setData(badge, "state", state);
    return badge;
  }

  // The words of an act of an agent: a start, a repeated start or a stop.
  function actWords(kind) {
    if (kind === "resume") return EVENT_TABLE.agent_resume.act;
    if (kind === "stop") return EVENT_TABLE.agent_stop.act;
    return EVENT_TABLE.agent_start.act;
  }

  // The card being built: its focusable elements by name and its <details>
  // by part, so the next rebuild can give back the focus and the open parts.
  let cardFocus = new Map();
  let cardParts = new Map();
  let cardBody = null;

  function focusable(el, name) {
    setData(el, "focus", name);
    cardFocus.set(name, el);
    return el;
  }

  function cardButton(className, text, name, onClick) {
    const button = make("button", className, text);
    button.setAttribute("type", "button");
    focusable(button, name);
    button.addEventListener("click", onClick);
    return button;
  }

  function cardMore(part, caption) {
    const more = make("details", "card-more");
    setData(more, "part", part);
    more.appendChild(focusable(make("summary", undefined, caption), part));
    cardParts.set(part, more);
    return more;
  }

  function blockTitle(text) {
    return make("h4", "card-block", text);
  }

  function copyRow(data, target) {
    const row = make("div", "copy-row");
    setData(row, "target", target);
    row.appendChild(
      make(
        "span",
        "copy-label",
        target === "agent" ? CARD_INSTANCE : CARD_SESSION,
      ),
    );
    row.appendChild(
      make(
        "span",
        "full-id",
        target === "agent" ? data.agent.full : data.session.full,
      ),
    );
    const button = cardButton("ctl", COPY, `copy-${target}`, () => {
      copyId(target);
    });
    button.classList.add("copy");
    button.setAttribute(
      "aria-label",
      target === "agent" ? COPY_LABEL_AGENT : COPY_LABEL_SESSION,
    );
    row.appendChild(button);
    if (
      copied !== null &&
      copied.key === data.key &&
      copied.target === target
    ) {
      const result = make(
        "span",
        "copy-result",
        copied.ok ? COPY_OK : COPY_FAIL,
      );
      setData(result, "ok", copied.ok ? "true" : "false");
      row.appendChild(result);
    }
    return row;
  }

  function cardHead(data) {
    const head = make("div", "card-head");
    const swatch = make("span", "card-swatch");
    setData(swatch, "color", data.color);
    const title = make("h3", "card-title", data.title);
    title.setAttribute("id", "card-title");
    head.appendChild(swatch);
    head.appendChild(title);
    // What the role does, right under its name (REQ-051, criterion 8).
    head.appendChild(make("p", "card-about", data.about));
    const idsLine = make("p", "card-ids");
    idsLine.appendChild(make("span", undefined, `${CARD_INSTANCE} `));
    idsLine.appendChild(make("b", "card-id", data.agent.short));
    idsLine.appendChild(make("span", undefined, ` · ${CARD_SESSION} `));
    idsLine.appendChild(make("b", "card-id", data.session.short));
    head.appendChild(idsLine);
    const more = cardMore("ids", CARD_BLOCKS.ids);
    more.appendChild(copyRow(data, "agent"));
    more.appendChild(copyRow(data, "session"));
    if (data.code !== null) {
      more.appendChild(make("p", "code-row", codeTitle(data.code)));
    }
    head.appendChild(more);
    if (link === "down")
      head.appendChild(make("p", "card-offline", NO_CONNECTION));
    return head;
  }

  // One of the three lines of "Состояние": its caption, its value and the
  // lines of its basis.
  function stateRow(name, value, basis) {
    const row = make("div", "state-row");
    setData(row, "row", name);
    row.appendChild(make("span", "state-label", STATE_ROWS[name]));
    const first = make("span", "state-value");
    if (typeof value === "string") first.textContent = value;
    else first.appendChild(value);
    row.appendChild(first);
    for (const line of basis)
      row.appendChild(make("span", "state-basis", line));
    return row;
  }

  function taskBasis(st) {
    const out = [];
    if (showsAge(st.state)) {
      const minutes = String(STALE_AFTER_MS / 60000);
      const time = whenAge(st.session_last_event_at, true);
      out.push(
        `${LABEL_LAST_EVENT} ${time} · ${FRESH_LIMIT.split("{m}").join(minutes)}`,
      );
      if (st.last_start !== null) {
        out.push(
          `${actWords(st.last_start.kind)} · ${whenAge(st.last_start.at, false)}`,
        );
      }
    } else if (st.state === "restarted") {
      out.push(
        SERVER_STARTED.split("{time}").join(whenAge(st.server_start_at, false)),
      );
    } else if (st.state === "completed") {
      out.push(`${EVENT_TABLE.agent_stop.act} · ${whenAge(st.stop_at, false)}`);
    } else if (st.state === "unrecorded") {
      out.push(
        `${EVENT_TABLE.session_end.words} · ${whenAge(st.session_end_at, false)}`,
      );
    }
    return out;
  }

  function instanceButton(item, name, how) {
    const button = cardButton("instance", undefined, name, () =>
      openInstance(item.key, how),
    );
    setData(button, "key", item.key);
    if (item.current === true) button.setAttribute("aria-current", "true");
    const head = make("span", "instance-head");
    head.appendChild(make("span", "instance-id", item.short));
    head.appendChild(stateBadge(item.state));
    button.appendChild(head);
    let time = `${LAST_START} ${whenAge(item.last_start_at, false)}`;
    if (item.session_last_event_at !== null) {
      time += ` · ${LABEL_LAST_EVENT} ${whenAge(
        item.session_last_event_at,
        false,
      )}`;
      const age = ageText(item.age_ms);
      if (age !== "") time += ` · ${age}`;
    }
    button.appendChild(make("span", "instance-time", time));
    button.appendChild(
      make("span", "instance-desc", item.description ?? TASK_NO_DESC),
    );
    return button;
  }

  function instanceColumn(data) {
    const section = make("section", "card-instance");
    section.appendChild(blockTitle(CARD_BLOCKS.task));
    const t = data.current_task;
    if (t.kind === "described") {
      section.appendChild(make("p", "task-desc", t.text));
      section.appendChild(make("p", "task-note", TASK_DESC_BY));
    } else {
      const text =
        t.kind === "several"
          ? TASK_SEVERAL
          : t.kind === "no_link"
            ? TASK_NO_LINK
            : TASK_NO_DESC;
      section.appendChild(make("p", "task-none", text));
    }
    section.appendChild(blockTitle(CARD_BLOCKS.state));
    const st = data.task_state;
    section.appendChild(stateRow("task", stateBadge(st.state), taskBasis(st)));
    const ev = data.agent_event;
    section.appendChild(
      stateRow(
        "agent",
        ev === null
          ? TIME_UNKNOWN
          : `${actWords(ev.kind)} · ${whenAge(ev.at, true)}`,
        [AGENT_NOT_RECORDED],
      ),
    );
    section.appendChild(
      stateRow(
        "workplace",
        data.workplace.working
          ? WORKPLACE_WORKING.split("{n}").join(String(data.workplace.count))
          : WORKPLACE_IDLE,
        [WORKPLACE_DESK],
      ),
    );
    section.appendChild(blockTitle(CARD_BLOCKS.launcher));
    const l = data.launcher;
    if (l.kind === "subagent" && l.has_task) {
      const button = cardButton(
        "card-link",
        `${l.name} · ${l.short}`,
        "launcher",
        () => openInstance(l.key, "link"),
      );
      setData(button, "key", l.key);
      section.appendChild(button);
    } else if (l.kind === "main" && data.links.main_row !== null) {
      // "Основная сессия": the card of the main session on the row of the
      // request in whose window the task began (REQ-047, criterion 2 (г)).
      const line = make("p", "card-launcher");
      line.appendChild(
        cardButton("card-link", MAIN_LABEL, "launcher", () =>
          openMain(data.links.main_row, "link"),
        ),
      );
      section.appendChild(line);
    } else {
      let text = MAIN_LABEL;
      if (l.kind === "subagent")
        text = `${l.name} · ${l.short} — ${LAUNCHER_NOT_RECORDED}`;
      else if (l.kind === "none") {
        text = l.reason === "several" ? TASK_SEVERAL : LAUNCHER_NO_LINK;
      }
      section.appendChild(make("p", "card-launcher", text));
    }
    // The transitions stand right after "Кто запустил", before the phrases of
    // what is not known, so they are seen at once whatever the clock makes of
    // the lines above (decisions/0060). The phrases are not focusable: the
    // order of Tab stays "Кто запустил" -> the transitions.
    section.appendChild(
      cardLinks(data.links.panel, data.key, { kind: "task", key: data.key }),
    );
    section.appendChild(make("p", "card-unknown", UNKNOWN_MESSAGES));
    section.appendChild(make("p", "card-unknown", UNKNOWN_ERRORS));
    return section;
  }

  function instancesColumn(data) {
    const section = make("section", "card-instances");
    const title = blockTitle(CARD_BLOCKS.instances);
    title.appendChild(
      make(
        "span",
        "card-count",
        INSTANCES_COUNT.split("{N}").join(String(data.instances.total)),
      ),
    );
    section.appendChild(title);
    const list = (items) => {
      const ul = make("ul", "instances");
      for (const item of items) {
        const li = make("li");
        li.appendChild(instanceButton(item, `instance:${item.key}`, "switch"));
        ul.appendChild(li);
      }
      return ul;
    };
    section.appendChild(list(data.instances.shown));
    if (data.instances.rest.length > 0) {
      section.appendChild(
        make(
          "p",
          "tasks-note",
          fill(SHOWN_NOTE, {
            n: data.instances.shown.length,
            N: data.instances.total,
          }),
        ),
      );
      const more = cardMore("more", CARD_BLOCKS.more);
      more.appendChild(list(data.instances.rest));
      section.appendChild(more);
    }
    return section;
  }

  function emptyLine() {
    return make("p", "card-empty", CARD_EMPTY);
  }

  function instanceParts(data) {
    const given = cardMore("given", CARD_BLOCKS.given);
    if (data.given.length === 0) given.appendChild(emptyLine());
    for (const g of data.given) {
      const item = make("div", "card-entry");
      const by =
        g.by.kind === "main" ? MAIN_LABEL : `${g.by.name} · ${g.by.short}`;
      item.appendChild(
        make(
          "span",
          "entry-line",
          `${whenAge(g.at, false)} · ${GIVEN_BY}${by}`,
        ),
      );
      item.appendChild(
        make("span", "entry-desc", g.description ?? TASK_NO_DESC),
      );
      item.appendChild(make("span", "entry-note", GIVEN_NOTE));
      given.appendChild(item);
    }
    const starts = cardMore("starts", CARD_BLOCKS.starts);
    if (data.starts.length === 0) starts.appendChild(emptyLine());
    for (const st of data.starts) {
      starts.appendChild(
        make(
          "p",
          "entry-line",
          `${actWords(st.kind)} · ${whenAge(st.at, false)}`,
        ),
      );
    }
    const returns = cardMore("returns", CARD_BLOCKS.returns);
    if (data.returns.length === 0) {
      const line = make("p", "entry-line");
      line.appendChild(stateBadge(data.task_state.state));
      returns.appendChild(line);
    }
    for (const r of data.returns) {
      returns.appendChild(
        make(
          "p",
          "entry-line",
          `${EVENT_TABLE.agent_stop.act}${RETURN_NOTE} · ${whenAge(r.at, false)}`,
        ),
      );
    }
    const launched = cardMore("launched", CARD_BLOCKS.launched);
    if (data.launched.length === 0) launched.appendChild(emptyLine());
    for (const item of data.launched) {
      if (item.has_task) {
        const button = cardButton(
          "instance",
          undefined,
          `launched:${item.key}`,
          () => openInstance(item.key, "link"),
        );
        setData(button, "key", item.key);
        const head = make("span", "instance-head");
        head.appendChild(
          make("span", "instance-id", `${item.name} · ${item.short}`),
        );
        head.appendChild(stateBadge(item.state));
        button.appendChild(head);
        launched.appendChild(button);
      } else {
        launched.appendChild(
          make("p", "entry-line", `${item.name} · ${item.short}`),
        );
      }
    }
    const role = cardMore("role", CARD_BLOCKS.role);
    if (data.role_card !== null) {
      for (const section of roleSections(data.role_card)) {
        role.appendChild(section);
      }
    }
    return [given, starts, returns, launched, role];
  }

  // The line of transitions of a card (REQ-047, criterion 2): "к задаче в
  // панели" (or the text about the limit of the panel) and "события в
  // журнале". Both close the card. No button of the card opens the window of
  // history (decision 0014).
  function cardLinks(inPanel, key, ref) {
    const line = make("div", "card-links");
    if (inPanel) {
      line.appendChild(
        cardButton("ctl", GO_PANEL, "go:panel", () => goPanel(key)),
      );
    } else {
      line.appendChild(
        make("p", "card-note", fill(NOT_IN_PANEL, { n: LIST_LIMIT })),
      );
    }
    line.appendChild(
      cardButton("ctl", GO_CARD_EVENTS, "go:events", () => {
        closeCard();
        goTaskEvents(ref, null, true);
      }),
    );
    return line;
  }

  // The lines of the basis of "Задача" of the card of the main session
  // (design 4.7).
  function mainBasis(row) {
    const b = row.basis;
    const words = (c) => EVENT_TABLE[c]?.words ?? "";
    if (row.state === "in_progress" || row.state === "stale") {
      const minutes = String(STALE_AFTER_MS / 60000);
      return [
        `${LABEL_LAST_EVENT} ${whenAge(b.session_last_event_at, true)} · ${FRESH_LIMIT.split("{m}").join(minutes)}`,
        `${words(b.start.case)} · ${whenAge(b.start.at, false)}`,
      ];
    }
    if (row.state === "completed") {
      return [`${EVENT_TABLE.stop.words} · ${whenAge(b.stop_at, false)}`];
    }
    if (row.state === "unrecorded") {
      return b.closed === null
        ? []
        : [`${words(b.closed.case)} · ${whenAge(b.closed.at, false)}`];
    }
    if (row.state === "restarted") {
      return [
        MAIN_CARD.server_started
          .split("{time}")
          .join(whenAge(b.server_start_at, false)),
      ];
    }
    return [];
  }

  // The card of the main session (REQ-047, criterion 1; description 8).
  function mainCardTree(data, body) {
    const head = make("div", "card-head");
    const swatch = make("span", "card-swatch");
    setData(swatch, "color", 0);
    const title = make("h3", "card-title", MAIN_LABEL);
    title.setAttribute("id", "card-title");
    head.appendChild(swatch);
    head.appendChild(title);
    head.appendChild(make("p", "card-about", MAIN_ABOUT));
    const idsLine = make("p", "card-ids");
    idsLine.appendChild(make("span", undefined, `${CARD_SESSION} `));
    idsLine.appendChild(make("b", "card-id", data.session.short));
    head.appendChild(idsLine);
    const more = cardMore("ids", MAIN_CARD.full_session);
    more.appendChild(
      copyRow(
        { key: data.key, agent: data.session, session: data.session },
        "session",
      ),
    );
    head.appendChild(more);
    if (link === "down") {
      head.appendChild(make("p", "card-offline", NO_CONNECTION));
    }
    body.appendChild(head);
    const parts = [];
    if (data.row === null) {
      body.appendChild(make("p", "task-none", MAIN_CARD.no_requests));
    } else {
      const section = make("section", "card-instance");
      section.appendChild(blockTitle(CARD_BLOCKS.state));
      section.appendChild(
        stateRow("task", stateBadge(data.row.state), mainBasis(data.row)),
      );
      section.appendChild(
        make("p", "card-history-note", MAIN_CARD[data.history_note]),
      );
      section.appendChild(
        stateRow(
          "workplace",
          data.workplace.working
            ? MAIN_CARD.workplace_working
                .split("{n}")
                .join(String(data.workplace.count))
            : MAIN_CARD.workplace_idle,
          [MAIN_CARD.desk],
        ),
      );
      section.appendChild(
        cardLinks(data.links.panel, data.row.key, {
          kind: "main",
          key: data.row.key,
        }),
      );
      body.appendChild(section);
      const launched = cardMore("launched", MAIN_CARD.launched);
      if (data.launched.length === 0) launched.appendChild(emptyLine());
      for (const item of data.launched) {
        const button = cardButton(
          "instance",
          undefined,
          `launched:${item.key}`,
          () => openInstance(item.key, "link"),
        );
        setData(button, "key", item.key);
        const line = make("span", "instance-head");
        line.appendChild(
          make("span", "instance-id", `${item.name} · ${item.short}`),
        );
        line.appendChild(stateBadge(item.state));
        button.appendChild(line);
        launched.appendChild(button);
      }
      parts.push(launched);
      const rowsPart = cardMore("rows", MAIN_CARD.other_rows);
      if (data.other_rows.total === 0) rowsPart.appendChild(emptyLine());
      for (const r of data.other_rows.shown) {
        const name = `row:${r.key}`;
        const button = cardButton("instance", undefined, name, () =>
          openMain(
            { row: r.key, session: data.session.full },
            "switch",
            null,
            name,
          ),
        );
        setData(button, "key", r.key);
        const line = make("span", "instance-head");
        line.appendChild(
          make(
            "span",
            "instance-id",
            `${EVENT_TABLE[r.case]?.words ?? ""} · ${whenAge(r.at, false)}`,
          ),
        );
        line.appendChild(stateBadge(r.state));
        button.appendChild(line);
        rowsPart.appendChild(button);
      }
      if (data.other_rows.total > data.other_rows.shown.length) {
        rowsPart.appendChild(
          make(
            "p",
            "tasks-note",
            fill(SHOWN_NOTE, {
              n: data.other_rows.shown.length,
              N: data.other_rows.total,
            }),
          ),
        );
      }
      parts.push(rowsPart);
    }
    const sessionsPart = cardMore("sessions", MAIN_CARD.other_sessions);
    if (data.sessions.length === 0) sessionsPart.appendChild(emptyLine());
    for (const other of data.sessions) {
      const name = `session:${other.id}`;
      const button = cardButton("instance", undefined, name, () => {
        const first = model.list.find(
          (item) => item.kind === "main" && item.session_id === other.id,
        );
        openMain(
          { row: first === undefined ? null : first.key, session: other.id },
          "switch",
          null,
          name,
        );
      });
      const line = make("span", "instance-head");
      line.appendChild(make("span", "instance-id", other.label));
      if (other.running) {
        line.appendChild(make("span", "session-running", SESSION_RUNNING));
      }
      button.appendChild(line);
      sessionsPart.appendChild(button);
    }
    parts.push(sessionsPart);
    const all = cardMore("role", MAIN_CARD.all);
    if (data.role_card !== null) {
      all.appendChild(
        make(
          "span",
          "card-working",
          `${CARD_SESSIONS}${data.role_card.sessions_running}`,
        ),
      );
      for (const section of roleSections(data.role_card)) {
        all.appendChild(section);
      }
    }
    parts.push(all);
    for (const part of parts) body.appendChild(part);
  }

  // The new contents of the card, built whole before anything is replaced; null
  // when what the card showed is gone from the model.
  function buildCardTree() {
    if (card === null) return null;
    const close = make("button", "card-close", "×");
    close.setAttribute("type", "button");
    close.setAttribute("aria-label", CARD_CLOSE);
    focusable(close, "close");
    close.addEventListener("click", () => closeCard());
    const body = make("div", "card-body");
    if (card.kind === "main") {
      const data = buildMainCard(model, office, history, card.sel);
      if (data === null) return null;
      mainCardTree(data, body);
      return { close, body, kind: "main", columns: "1" };
    }
    const data = buildInstanceCard(model, office, card.key, history);
    if (data === null) return null;
    body.appendChild(cardHead(data));
    const columns = make("div", "card-columns");
    columns.appendChild(instanceColumn(data));
    if (data.instances.total > 1) columns.appendChild(instancesColumn(data));
    body.appendChild(columns);
    for (const part of instanceParts(data)) body.appendChild(part);
    return {
      close,
      body,
      kind: "instance",
      columns: data.instances.total > 1 ? "2" : "1",
    };
  }

  // Draws the card again from the model (design 6.2): the open parts, the
  // element with the focus and the scroll of the body are kept, unless `fresh`
  // says what to reset: {parts: null | Set of parts to close, focus, scrollTop}.
  function renderCard(fresh = null) {
    const overlay = els.overlay;
    const el = els.card;
    if (!overlay || !el) return;
    const focused = focusedElement();
    let focusName = null;
    for (const [name, item] of cardFocus)
      if (item === focused) focusName = name;
    const openParts = new Map();
    for (const [part, details] of cardParts)
      openParts.set(part, details.open === true);
    const scroll = cardBody === null ? 0 : cardBody.scrollTop;
    const oldFocus = cardFocus;
    const oldParts = cardParts;
    cardFocus = new Map();
    cardParts = new Map();
    let tree;
    try {
      tree = buildCardTree();
    } catch (err) {
      // What was drawn stays on the screen.
      cardFocus = oldFocus;
      cardParts = oldParts;
      throw err;
    }
    if (tree === null) {
      const hadCard = card !== null;
      const focusInside = focusName !== null;
      card = null;
      copied = null;
      cardFocus = new Map();
      cardParts = new Map();
      cardBody = null;
      el.replaceChildren();
      overlay.hidden = true;
      if (hadCard) {
        // What the card showed is gone: the choice is dropped too.
        selectedKey = null;
        releaseModal();
        if (focusInside) returnFocus();
        cardReturnKey = null;
      }
      return;
    }
    setData(el, "kind", tree.kind);
    setData(el, "columns", tree.columns);
    el.replaceChildren(tree.close, tree.body);
    cardBody = tree.body;
    els.cardClose = tree.close;
    for (const [part, details] of cardParts) {
      const keepOpen =
        fresh === null
          ? openParts.get(part) === true
          : fresh.parts !== null &&
            !fresh.parts.has(part) &&
            openParts.get(part) === true;
      if (keepOpen) details.open = true;
    }
    overlay.hidden = false;
    if (fresh === null) {
      cardBody.scrollTop = scroll;
      if (focusName !== null) (cardFocus.get(focusName) ?? tree.close).focus();
    } else {
      cardBody.scrollTop = 0;
      (cardFocus.get(fresh.focus) ?? tree.close).focus();
    }
  }

  function setModal() {
    pageBody()?.setAttribute("data-modal", "card");
  }

  function releaseModal() {
    if (historyKey === null) pageBody()?.removeAttribute("data-modal");
  }

  // The focus after the card closes (design D13, decision 0059, point 2): the
  // button that opened the first card of the chain — a legend button, a button
  // of the details of an event, the button "агент" of the panel; a press on the
  // canvas counts as the legend button of the role of that first card. If the
  // button is gone, the legend button of the role of the card shown last; else
  // the scrolling area of the office.
  function returnFocus() {
    const opener = cardOpener;
    let target = null;
    if (opener !== null && opener.kind === "journal") {
      target =
        journalItems
          .find((item) => item.index === opener.index)
          ?.focus.get(opener.focus) ?? null;
    } else if (opener !== null && opener.kind === "panel") {
      target = agentButtons.get(opener.key) ?? null;
    } else if (opener !== null && opener.kind === "legend") {
      target = legendButton(opener.key);
    }
    if (target === null && cardReturnKey !== null) {
      target = legendButton(cardReturnKey);
    }
    if (target !== null) target.focus();
    else els.officeScroll?.focus();
  }

  // Selects a character (its frame on the canvas, its legend button pressed)
  // and opens its card: the card of the main session or of the default
  // instance of the role. A key without a character or without an instance
  // closes the card and drops the choice.
  function openCard(key, opener = null) {
    resolveEls();
    closeNowAll(false);
    let next = null;
    if (key !== null && key !== undefined && characterOf(key) !== undefined) {
      if (key === MAIN_KEY) {
        const choice = defaultMainSel(model);
        if (choice !== null) next = { kind: "main", sel: choice };
      } else {
        const instance = defaultInstance(model, key);
        if (instance !== null) next = { kind: "instance", key: instance };
      }
    }
    copied = null;
    if (next === null) {
      const wasOpen = card !== null;
      selectedKey = null;
      card = null;
      guarded("легенда", renderLegend);
      guarded("карточка", () => renderCard());
      if (wasOpen) releaseModal();
      cardReturnKey = null;
      cardOpener = null;
      return;
    }
    selectedKey = key;
    cardReturnKey = key;
    // A press on the canvas returns the focus to the legend button of the
    // role, as the legend does.
    cardOpener = opener ?? { kind: "legend", key };
    card = next;
    cardParts = new Map();
    setModal();
    guarded("легенда", renderLegend);
    guarded("карточка", () =>
      renderCard({ parts: null, focus: "close", scrollTop: 0 }),
    );
  }

  // Shows another instance in the open card (design 6.4): "switch" from the
  // list of the instances of the role keeps the open parts of the role and the
  // focus on the pressed item; "link" is like a new opening.
  function openInstance(taskKey, how, opener = null) {
    closeNowAll(false);
    const task = model.tasks.find((t) => t.key === taskKey);
    if (task === undefined) return;
    if (card === null) {
      // The first card of a chain: what opened it gets the focus back.
      cardOpener = opener;
      cardParts = new Map();
      setModal();
    }
    const roleChanged = selectedKey !== roleKey(task.role);
    selectedKey = roleKey(task.role);
    cardReturnKey = selectedKey;
    card = { kind: "instance", key: taskKey };
    copied = null;
    if (roleChanged) guarded("легенда", renderLegend);
    guarded("карточка", () =>
      renderCard(
        how === "switch"
          ? {
              parts: new Set(["ids", "given", "starts", "returns", "launched"]),
              focus: `instance:${taskKey}`,
              scrollTop: 0,
            }
          : { parts: null, focus: "close", scrollTop: 0 },
      ),
    );
  }

  // The card of the main session on a row (or a session without rows):
  // "link" is like a new opening, "switch" (another row or session in the same
  // card) closes only "кого запустила в этом запросе" and keeps the focus on
  // the pressed item if it is still there. It opens only where the one rule
  // mainChoiceOpens allows (the same rule decides the transitions of linksOf).
  function openMain(choice, how, opener = null, focusName = null) {
    resolveEls();
    closeNowAll(false);
    if (!mainChoiceOpens(model, choice)) return;
    if (card === null) {
      cardOpener = opener;
      cardParts = new Map();
      setModal();
    }
    const roleChanged = selectedKey !== MAIN_KEY;
    selectedKey = MAIN_KEY;
    cardReturnKey = MAIN_KEY;
    card = { kind: "main", sel: choice };
    copied = null;
    if (roleChanged) guarded("легенда", renderLegend);
    guarded("карточка", () =>
      renderCard(
        how === "switch"
          ? {
              parts: new Set(["launched"]),
              focus: focusName ?? "close",
              scrollTop: 0,
            }
          : { parts: null, focus: "close", scrollTop: 0 },
      ),
    );
  }

  // Copies the full identifier of the instance (design 6.4): only the value,
  // one call of writeText; no clipboard, a refusal or an exception is a
  // failure, and the value stays on the screen.
  async function copyId(target) {
    if (card === null) return;
    const shown = card;
    let key;
    let value;
    if (shown.kind === "main") {
      const data = buildMainCard(model, office, history, shown.sel);
      if (data === null) return;
      key = data.key;
      value = data.session.full;
    } else {
      key = shown.key;
      const data = buildInstanceCard(model, office, key, history);
      if (data === null) return;
      value = target === "agent" ? data.agent.full : data.session.full;
    }
    let ok = false;
    try {
      const clip = typeof clipboardFn === "function" ? clipboardFn() : null;
      if (
        clip !== null &&
        typeof clip === "object" &&
        typeof clip.writeText === "function"
      ) {
        await clip.writeText(value);
        ok = true;
      }
    } catch {
      // The clipboard refused: the person selects the value by hand.
      ok = false;
    }
    copied = { key, target, ok };
    if (card === shown) guarded("карточка", () => renderCard());
  }

  function selectCharacter(key) {
    openCard(key);
  }

  // Closes the card; the character stays selected. The focus goes to the
  // legend button of the role of the card (opened by the legend or the
  // canvas), else to the scrolling area of the office.
  function closeCard() {
    resolveEls();
    if (card === null) return;
    card = null;
    copied = null;
    guarded("карточка", () => renderCard());
    releaseModal();
    returnFocus();
    cardReturnKey = null;
    cardOpener = null;
  }

  // The controls of the card for Tab (design 6.3): every button and summary in
  // the order of the tree, except the contents of a closed <details> (its own
  // summary counts) and hidden elements.
  function cardControls() {
    const out = [];
    const walk = (node) => {
      for (const child of Array.from(node.children ?? [])) {
        if (child.hidden === true) continue;
        const tag = String(child.tagName).toUpperCase();
        if (tag === "BUTTON" || tag === "SUMMARY") {
          out.push(child);
          continue;
        }
        if (tag === "DETAILS" && child.open !== true) {
          const summary = Array.from(child.children ?? []).find(
            (c) => String(c.tagName).toUpperCase() === "SUMMARY",
          );
          if (summary !== undefined) out.push(summary);
          continue;
        }
        walk(child);
      }
    };
    if (els.card) walk(els.card);
    return out;
  }

  function cycleCardFocus(back) {
    const controls = cardControls();
    if (controls.length === 0) return;
    const at = controls.indexOf(focusedElement());
    let next;
    if (at === -1) next = back ? controls.length - 1 : 0;
    else next = (at + (back ? -1 : 1) + controls.length) % controls.length;
    controls[next].focus();
  }

  // ------------------------------------------------------------ history

  // The body element of the page: the attribute data-modal on it stops the
  // page under the window from scrolling (a style attribute is not used).
  function pageBody() {
    return document.body ?? els.historyOverlay?.parentNode ?? null;
  }

  // A text of the journal with every label "[скрыто]" in its own span; all of
  // it as text, never as markup.
  function maskedInto(el, text) {
    const parts = text.split(MASK_LABEL);
    parts.forEach((part, k) => {
      if (k > 0) el.appendChild(make("span", "history-masked", MASK_LABEL));
      if (part !== "") el.appendChild(make("span", undefined, part));
    });
    return el;
  }

  function historyState(state) {
    const span = make("span", "history-state", STATE_LABELS[state] ?? state);
    setData(span, "state", state);
    return span;
  }

  function historyAutoMark() {
    return make("span", "history-auto", ` · ${HISTORY_NOTE_AUTO}`);
  }

  function historySection(name, heading) {
    const section = make("section", "history-section");
    setData(section, "section", name);
    section.appendChild(make("h3", "history-heading", heading));
    return section;
  }

  function historyMeta(request) {
    const meta = make("p", "history-meta");
    meta.appendChild(historyState(request.state));
    meta.appendChild(make("span", undefined, " · "));
    meta.appendChild(
      make(
        "span",
        "history-started",
        `${HISTORY_META_STARTED} ${fmtDateTime(request.started_at)}`,
      ),
    );
    // Without a Stop the words of the state already stand first: "finished"
    // would be false for a request still in work, and repeating the state
    // adds nothing.
    if (request.finished_at !== null) {
      meta.appendChild(make("span", undefined, " · "));
      meta.appendChild(
        make(
          "span",
          "history-finished",
          `${HISTORY_META_FINISHED} ${fmtDateTime(request.finished_at)}`,
        ),
      );
    }
    return meta;
  }

  function requestSection(request) {
    if (request.text === null) {
      const line = make("p", "history-disabled", HISTORY_TEXT_DISABLED);
      setData(line, "section", "request");
      return line;
    }
    const section = historySection("request", HISTORY_SECTION_REQUEST);
    section.appendChild(maskedInto(make("div", "history-quote"), request.text));
    if (request.truncated) {
      section.appendChild(
        make(
          "p",
          "history-truncated",
          fill(HISTORY_TRUNCATED, { n: Array.from(request.text).length }),
        ),
      );
    }
    return section;
  }

  function understoodSection(request) {
    const section = historySection("understood", HISTORY_SECTION_UNDERSTOOD);
    const note = request.note;
    if (note === null) {
      section.appendChild(make("p", "history-missing", HISTORY_NOTE_MISSING));
      return section;
    }
    const by = make("p", "history-by");
    by.appendChild(
      make("span", undefined, `${HISTORY_NOTE_BY} · ${fmtTimeSec(note.time)}`),
    );
    if (note.auto) {
      by.appendChild(historyAutoMark());
    }
    section.appendChild(by);
    section.appendChild(maskedInto(make("div", "history-quote"), note.text));
    return section;
  }

  // A cell of the table with the caption of its column, shown only when the
  // table is a stack of cards in a narrow window.
  function historyCell(column, value, className) {
    const td = make("td");
    setData(td, "column", column);
    td.appendChild(make("span", "history-cell-label", column));
    td.appendChild(make("span", className, value));
    return td;
  }

  function resultOf(task) {
    let text = `${LABEL_STARTED} ${fmtTime(task.started_at)}`;
    if (task.state === "completed") {
      text += ` · ${LABEL_ENDED} ${fmtTime(task.ended_at)}`;
    } else if (showsSessionEvent(task.state)) {
      text += ` · ${LABEL_LAST_EVENT} ${fmtTime(task.session_last_event_at)}`;
    }
    return text;
  }

  function workSection(request) {
    const section = historySection("work", HISTORY_SECTION_WORK);
    if (request.tasks.length === 0) {
      section.appendChild(make("p", "history-none", HISTORY_NO_TASKS));
      return section;
    }
    const table = make("table", "history-table");
    const head = make("thead");
    const headRow = make("tr");
    for (const column of [
      HISTORY_COL_TASK,
      HISTORY_COL_AGENT,
      HISTORY_COL_DOES,
      HISTORY_COL_RESULT,
    ]) {
      headRow.appendChild(make("th", undefined, column));
    }
    head.appendChild(headRow);
    table.appendChild(head);
    const bodyRows = make("tbody");
    for (const task of request.tasks) {
      const tr = make("tr");
      setData(tr, "key", task.key);
      setData(tr, "state", task.state);
      const first = make("td");
      first.appendChild(
        make("span", "history-task", fill(HISTORY_TASK_N, { n: task.ordinal })),
      );
      first.appendChild(historyState(task.state));
      tr.appendChild(first);
      tr.appendChild(historyCell(HISTORY_COL_AGENT, task.name, "history-role"));
      tr.appendChild(
        task.description === null
          ? historyCell(HISTORY_COL_DOES, HISTORY_EMPTY_CELL, "history-empty")
          : historyCell(HISTORY_COL_DOES, task.description, "history-does"),
      );
      tr.appendChild(
        historyCell(HISTORY_COL_RESULT, resultOf(task), "history-result"),
      );
      bodyRows.appendChild(tr);
    }
    table.appendChild(bodyRows);
    section.appendChild(table);
    return section;
  }

  function timelineSection(request) {
    const section = historySection("timeline", HISTORY_SECTION_TIMELINE);
    const list = make("ol", "history-timeline");
    for (const item of request.timeline) {
      const li = make("li", "history-event");
      setData(li, "kind", item.kind);
      const kind = model.entries[item.index]?.hook_event_name;
      setData(
        li,
        "tone",
        item.kind === "note" ? "note" : (TONES[kind] ?? "session"),
      );
      const line = make("span", "history-event-line");
      line.appendChild(make("span", "time", fmtTimeSec(item.time)));
      line.appendChild(make("span", undefined, " · "));
      line.appendChild(make("span", "who", item.who));
      line.appendChild(make("span", undefined, " — "));
      if (item.kind === "note" && item.auto === true) {
        line.appendChild(make("span", "what", HISTORY_NOTE_BY));
        line.appendChild(historyAutoMark());
      } else {
        line.appendChild(make("span", "what", item.what));
      }
      li.appendChild(line);
      if (item.detail !== null) {
        li.appendChild(
          item.kind === "note"
            ? maskedInto(make("span", "history-note-text"), item.detail)
            : make("span", "history-detail", item.detail),
        );
      }
      list.appendChild(li);
    }
    section.appendChild(list);
    return section;
  }

  // The request that the window shows, or null when it is gone from the data
  // or its key now names another line.
  function openRequest() {
    const request = history.byKey.get(historyKey);
    if (request === undefined || historyOf === null) return null;
    if (
      request.time !== historyOf.time ||
      request.session_id !== historyOf.session_id
    ) {
      return null;
    }
    return request;
  }

  // Draws the open window again from the model; the scroll position of the
  // body is kept, "×" and the body are not replaced, so the focus stays.
  function renderHistory() {
    const body = els.historyBody;
    if (!body || historyKey === null) return;
    const top = body.scrollTop;
    const out = [make("span", "history-badge", HISTORY_BADGE)];
    const request = loaded ? openRequest() : null;
    if (!loaded) {
      const line = make("p", "history-loading", HISTORY_LOADING);
      line.setAttribute("id", "history-title");
      out.push(line);
    } else if (request === null) {
      const line = make("p", "history-error", HISTORY_ERROR);
      line.setAttribute("id", "history-title");
      out.push(line);
    } else {
      const title = make("h2", "history-title", request.title);
      title.setAttribute("id", "history-title");
      out.push(title, historyMeta(request));
      if (link === "down") {
        out.push(make("p", "history-offline", NO_CONNECTION));
      }
      out.push(
        requestSection(request),
        understoodSection(request),
        workSection(request),
        timelineSection(request),
      );
    }
    body.replaceChildren(...out);
    body.scrollTop = top;
  }

  // Opens the window of a request. Only one window is open at a time: an
  // open card of an agent closes first (the choice of the character stays,
  // the focus is not given back to it).
  function openHistory(key, opener) {
    resolveEls();
    if (!els.historyOverlay || !els.historyBody) return;
    closeNowAll(false);
    const request = history.byKey.get(key);
    if (request === undefined) return;
    if (card !== null) {
      card = null;
      copied = null;
      cardReturnKey = null;
      cardOpener = null;
      guarded("карточка", () => renderCard());
    }
    historyKey = key;
    historyOf = { time: request.time, session_id: request.session_id };
    historyOpener = opener ?? null;
    els.historyBody.scrollTop = 0;
    guarded("история", renderHistory);
    els.historyOverlay.hidden = false;
    pageBody()?.setAttribute("data-modal", "history");
    els.historyClose?.focus();
  }

  // The element that opened the window, found again after the panels were
  // drawn anew; else the list of the journal.
  function historyOpenerElement() {
    const opener = historyOpener;
    if (opener !== null && opener.kind === "journal") {
      const row = journalItems.find((item) => item.index === opener.index);
      const button = row?.focus.get(opener.focus ?? "history");
      if (button !== undefined) return button;
    } else if (opener !== null && opener.kind === "task") {
      const button = taskButtons.get(opener.key);
      if (button !== undefined) return button;
    }
    return els.journal ?? null;
  }

  function closeHistory() {
    resolveEls();
    if (historyKey === null) return;
    historyKey = null;
    historyOf = null;
    if (els.historyOverlay) els.historyOverlay.hidden = true;
    els.historyBody?.replaceChildren();
    pageBody()?.removeAttribute("data-modal");
    historyOpenerElement()?.focus();
    historyOpener = null;
  }

  // ------------------------------------------------------------ the office

  // The rectangle of an element, or null when there is none or it is empty.
  function rectOf(el) {
    if (typeof el.getBoundingClientRect !== "function") return null;
    const r = el.getBoundingClientRect();
    const ok =
      r !== null &&
      typeof r === "object" &&
      Number.isFinite(r.width) &&
      Number.isFinite(r.height) &&
      Number.isFinite(r.top) &&
      Number.isFinite(r.bottom) &&
      r.width > 0 &&
      r.height > 0;
    return ok ? r : null;
  }

  // The place for the canvas and its size: a whole number of pixels per cell,
  // not less than MIN_CELL_PX (design 4.13, 4.15, 8). Width and height are
  // attributes of the canvas, not a style. The gap above the legend is read
  // from the scroll area of the canvas: a scrolled canvas may reach below it.
  function fit() {
    const canvas = els.office;
    const holder = els.officeScroll ?? canvas;
    const inner = els.officeInner;
    if (!ctx || !canvas || !inner) return;
    const view = typeof viewportFn === "function" ? viewportFn() : null;
    const wide =
      view === null ||
      (view.width >= WIDE_MIN_WIDTH && view.height >= WIDE_MIN_HEIGHT);
    // At a scale above 1 the panel has fractional sizes: the rectangles are
    // read first (design 4.14, rule 5); the whole-number sizes are the way
    // out for an element that has no rectangle.
    const box = rectOf(inner);
    const legendBox = els.legend ? rectOf(els.legend) : null;
    const canvasBox = box ? rectOf(holder) : null;
    const byRect =
      box !== null &&
      (els.legend === null || (legendBox !== null && canvasBox !== null));
    const areaWidth = byRect ? box.width : inner.clientWidth;
    let height = Infinity;
    if (wide) {
      height = byRect ? box.height : inner.clientHeight;
      if (height > 0) {
        let legendHeight = 0;
        let gap = 0;
        if (els.legend) {
          if (byRect) {
            legendHeight = legendBox.height;
            gap = legendBox.top - canvasBox.bottom;
          } else {
            legendHeight = els.legend.offsetHeight || 0;
            gap =
              els.legend.offsetTop - (holder.offsetTop + holder.offsetHeight);
          }
          if (!Number.isFinite(gap) || gap < 0) gap = 0;
        }
        // A legend that takes the whole panel leaves no place: the canvas then
        // takes the smallest cell instead of the default one.
        height = Math.max(1, height - legendHeight - gap);
      }
    }
    const size = fitCanvas(office.layout, { width: areaWidth, height });
    cellPx = size.cellPx;
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
      drawOnce();
    }
  }

  // Draws the office as it is now. data-drawn is set only after the drawing is
  // complete: it tells that the office is alive, not that the page was loaded.
  function drawOnce() {
    if (!ctx) return;
    const version = modelVersion;
    try {
      const count = drawOffice(ctx, office, {
        positions: sim.positions(),
        selectedKey,
        bubbles: bubblesAt(office, nowFn()),
        cellPx,
      });
      setData(els.office, "drawn", count);
      drawnVersion = version;
    } catch (err) {
      reportOnce("ошибка рисования офиса", err);
    }
  }

  function onFrame(timestamp) {
    if (stopped) return;
    const now = Number.isFinite(timestamp) ? timestamp : nowFn();
    const dt =
      lastFrameAt === null
        ? 0
        : Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - lastFrameAt) / 1000));
    lastFrameAt = now;
    try {
      sim.tick(dt);
    } catch (err) {
      reportOnce("ошибка движения персонажей", err);
    }
    drawOnce();
    requestFrameFn(onFrame);
  }

  function onCanvasClick(event) {
    const point = canvasPoint(event, els.office, office.layout, cellPx);
    const key = hitOffice(
      office,
      sim.positions(),
      point.px,
      point.py,
      labelWidths(ctx, office),
      labelLines(ctx, office),
    );
    openCard(key);
  }

  // ------------------------------------------------------------ start

  function onTick() {
    if (stopped) return;
    if (ctx && drawnVersion !== modelVersion) drawOnce();
    poll().then(() => {
      if (!stopped && nowFn() - lastRebuildAt >= REFRESH_MS) rebuild(false);
    });
  }

  function onVisibility() {
    if (stopped) return;
    if (document.visibilityState === "visible") poll();
  }

  // One press of Escape closes one thing: the first open one in the one order
  // of the page (design REQ-050-053 4.1, escapeTarget). origin is "document"
  // or "row" (the handler of the open row of the journal). Returns whether
  // there was something to close.
  function escapeStep(origin) {
    const active = focusedElement();
    const openRow =
      journalOpen === null
        ? null
        : (journalItems.find((item) => item.index === journalOpen)?.li ?? null);
    const target = escapeTarget({
      history: historyKey !== null,
      card: card !== null,
      hint: hints.isOpen(),
      tour: tour.isOpen(),
      nowAll: nowAllOpen,
      guide: guide.isOpen(),
      focusInGuide: guide.holds(active),
      invite: tour.inviteShown(),
      focusInInvite: tour.inviteHolds(active),
      row: journalOpen !== null,
      focusInRow: origin === "row" || within(active, openRow),
    });
    if (target === "history") closeHistory();
    else if (target === "card") closeCard();
    else if (target === "hint") hints.close();
    else if (target === "tour") tour.close();
    else if (target === "nowAll") closeNowAll(origin === "document");
    else if (target === "guide") guide.close();
    else if (target === "invite") tour.dismissInvite();
    else if (target === "row") closeEvent(true);
    return target !== null;
  }

  // One handler of the keys of the page. While the window of history is open
  // it takes the keys: Esc closes only it, Tab and Shift+Tab go round "×" and
  // the body of the window. While a card is open, Esc closes it and Tab goes
  // round the card. Otherwise Esc follows the one order of the page; Tab is
  // never taken (the guide traps no focus).
  function onKey(event) {
    if (historyKey !== null) {
      const prevent = () => {
        if (typeof event.preventDefault === "function") event.preventDefault();
      };
      if (event.key === "Escape") {
        prevent();
        closeHistory();
      } else if (event.key === "Tab") {
        prevent();
        const active = focusedElement();
        let next = event.shiftKey === true ? els.historyBody : els.historyClose;
        if (active === els.historyClose) next = els.historyBody;
        else if (active === els.historyBody) next = els.historyClose;
        next?.focus();
      }
      return;
    }
    if (card === null) {
      if (event.key === "Escape" && escapeStep("document")) {
        if (typeof event.preventDefault === "function") event.preventDefault();
      }
      return;
    }
    if (event.key === "Escape") {
      if (typeof event.preventDefault === "function") event.preventDefault();
      closeCard();
    } else if (event.key === "Tab") {
      if (typeof event.preventDefault === "function") event.preventDefault();
      cycleCardFocus(event.shiftKey === true);
    }
  }

  // The elements of the page, found once by the identifiers of index.html.
  function resolveEls() {
    if (elsReady) return;
    elsReady = true;
    els.link = byId("link");
    els.linkStatus = byId("link-status");
    els.badge = byId("source-badge");
    els.now = byId("now");
    els.nowText = byId("now-text");
    els.nowAll = byId("now-all");
    els.nowAllCatcher = byId("now-all-catcher");
    els.pause = byId("pause");
    els.speeds = {};
    for (const m of SPEED_IDS) els.speeds[m] = byId(`speed-${m}`);
    els.officePanel = byId("office-panel");
    els.officeInner = byId("office-inner");
    els.officeScroll = byId("office-scroll");
    els.office = byId("office");
    els.officeNote = byId("office-note");
    els.legend = byId("legend");
    els.journalTitle = byId("journal-title");
    els.filters = {};
    for (const name of FILTERS) els.filters[name] = byId(`filter-${name}`);
    els.journalMeta = byId("journal-meta");
    els.journalSearch = byId("journal-search");
    els.journalFilters = byId("journal-filters");
    els.journalFilterLine = byId("journal-filter-line");
    els.filterSession = byId("filter-session");
    els.filterAgent = byId("filter-agent");
    els.filterType = byId("filter-type");
    els.journalReset = byId("journal-reset");
    els.journalTaskMark = byId("journal-task-mark");
    els.journal = byId("journal");
    els.tasksTitle = byId("tasks-title");
    els.tasks = byId("tasks");
    els.overlay = byId("card-overlay");
    els.card = byId("card");
    els.historyOverlay = byId("history-overlay");
    els.history = byId("history");
    els.historyClose = byId("history-close");
    els.historyBody = byId("history-body");
    els.guideOpen = byId("guide-open");
    els.guide = byId("guide");
    els.tourInvite = byId("tour-invite");
    els.tour = byId("tour");
    els.tourLater = byId("tour-later");
    els.officeHint = byId("office-hint");
  }

  // The constant captions are set once more from texts.js, the listeners are
  // attached, the canvas is prepared.
  function decorate() {
    resolveEls();
    if (els.badge) els.badge.textContent = HEADER_BADGE;
    if (els.officePanel)
      els.officePanel.setAttribute("aria-label", OFFICE_NAME);
    if (els.officeScroll)
      els.officeScroll.setAttribute("aria-label", OFFICE_SCROLL_LABEL);
    if (els.journalTitle) els.journalTitle.textContent = JOURNAL_TITLE;
    if (els.tasksTitle) els.tasksTitle.textContent = TASKS_TITLE;
    if (els.pause) {
      els.pause.addEventListener("click", () => setPaused(!paused));
    }
    for (const m of SPEED_IDS) {
      const button = els.speeds[m];
      if (!button) continue;
      button.textContent = SPEED_LABELS[m];
      button.addEventListener("click", () => setSpeed(m));
    }
    for (const name of FILTERS) {
      const button = els.filters[name];
      if (!button) continue;
      button.textContent = FILTER_LABELS[name];
      button.addEventListener("click", () => setFilter(name));
    }
    if (els.overlay) {
      els.overlay.addEventListener("click", (event) => {
        if (event.target === els.overlay) closeCard();
      });
    }
    if (els.historyClose) {
      els.historyClose.textContent = "×";
      els.historyClose.setAttribute("aria-label", HISTORY_CLOSE);
      els.historyClose.title = HISTORY_CLOSE;
      els.historyClose.addEventListener("click", () => closeHistory());
    }
    if (els.historyOverlay) {
      els.historyOverlay.addEventListener("click", (event) => {
        if (event.target === els.historyOverlay) closeHistory();
      });
    }
    if (els.office) {
      ctx = els.office.getContext("2d");
      const supported = ctx !== null && ctx !== undefined;
      if (!supported) ctx = null;
      els.office.hidden = !supported;
      if (els.officeNote) {
        els.officeNote.textContent = supported ? "" : CANVAS_UNSUPPORTED;
        els.officeNote.hidden = supported;
      }
      if (supported) els.office.addEventListener("click", onCanvasClick);
    }
    // "в работе: N" and "Показать всех (N)": made once, next to #now-text, so
    // the text of #now-text stays what it was (design D7).
    if (els.now && !els.nowSide) {
      const side = make("span", "now-side");
      const count = make("span", "now-count");
      count.hidden = true;
      const button = make("button", "now-show-all");
      button.setAttribute("type", "button");
      button.setAttribute("aria-controls", "now-all");
      button.setAttribute("aria-expanded", "false");
      button.hidden = true;
      button.addEventListener("click", () => {
        if (nowAllOpen) closeNowAll(true);
        else openNowAll();
      });
      side.appendChild(count);
      side.appendChild(button);
      els.now.appendChild(side);
      els.nowSide = side;
      els.nowCount = count;
      els.nowShowAll = button;
    }
    if (els.nowAll) els.nowAll.setAttribute("aria-label", NOW_ALL_LABEL);
    // The navigation of the journal (REQ-046).
    if (els.journalSearch) {
      els.journalSearch.setAttribute("aria-label", SEARCH_LABEL);
      els.journalSearch.setAttribute("placeholder", SEARCH_LABEL);
      els.journalSearch.addEventListener("input", () => {
        changeQuery("search", String(els.journalSearch.value ?? ""));
      });
    }
    if (els.journalFilters) {
      els.journalFilters.textContent = FILTERS_BUTTON;
      els.journalFilters.addEventListener("click", () => {
        filtersOpen = !filtersOpen;
        guarded("фильтры журнала", renderJournalTools);
      });
    }
    for (const [select, name, label] of [
      [els.filterSession, "session", FILTER_SESSION_LABEL],
      [els.filterAgent, "agent", FILTER_AGENT_LABEL],
      [els.filterType, "type", FILTER_TYPE_LABEL],
    ]) {
      if (!select) continue;
      select.setAttribute("aria-label", label);
      select.addEventListener("change", () => {
        const value = String(select.value ?? "");
        changeQuery(name, value === "" ? null : value);
      });
    }
    if (els.journalReset) {
      els.journalReset.textContent = FILTERS_RESET;
      els.journalReset.addEventListener("click", () => resetFilters(true));
    }
    if (els.nowAllCatcher) {
      // A press outside the list only closes it (nothing under it opens).
      els.nowAllCatcher.addEventListener("click", (event) => {
        if (typeof event?.preventDefault === "function") event.preventDefault();
        closeNowAll(true);
      });
    }
    if (els.guide) {
      guide.mount({
        button: els.guideOpen,
        aside: els.guide,
        page: pageBody(),
      });
    }
    tour.mount({
      invite: els.tourInvite,
      box: els.tour,
      later: els.tourLater,
    });
    // The buttons "?" (design D4): in "Сейчас" last (after .now-side), in the
    // line of the heading of the journal right after the heading, in the head
    // of "Задачи" after its heading, in the block before the legend.
    hints.mount({
      now: (button, tip) => {
        if (!els.now) return;
        els.now.appendChild(button);
        els.now.appendChild(tip);
      },
      journal: (button, tip) => {
        const row = els.journalTitle?.parentNode;
        if (!row) return;
        const rest = Array.from(row.children).filter(
          (child) => child !== els.journalTitle,
        );
        row.replaceChildren(els.journalTitle, button, tip, ...rest);
      },
      tasks: (button, tip) => {
        const head = els.tasksTitle?.parentNode;
        if (!head) return;
        head.appendChild(button);
        head.appendChild(tip);
      },
      office: (button, tip) => {
        if (!els.officeHint) return;
        els.officeHint.appendChild(button);
        els.officeHint.appendChild(tip);
      },
    });
    guarded("кнопки", renderControls);
    guarded("фильтры", renderFilters);
  }

  // The first load, then the polling. The page keeps polling even if the first
  // load failed: when the server comes back, the page loads everything.
  async function start() {
    if (started) return;
    started = true;
    decorate();
    intervalId = setIntervalFn(onTick, POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("keydown", onKey);
    if (typeof addResizeListener === "function") {
      addResizeListener(() => {
        guarded("холст", fit);
        guarded("строка «Сейчас»", () => updateShowAll());
      });
    }
    renderAll();
    guarded("холст", fit);
    if (ctx) requestFrameFn(onFrame);
    await poll();
  }

  function stop() {
    stopped = true;
    if (intervalId !== null) clearIntervalFn(intervalId);
    intervalId = null;
  }

  return {
    start,
    poll,
    stop,
    getModel: () => model,
    getOffice: () => office,
    getSim: () => sim,
    setFilter,
    setPaused,
    setSpeed,
    selectCharacter,
    closeCard,
    getHistory: () => history,
    openHistory,
    closeHistory,
  };
}
