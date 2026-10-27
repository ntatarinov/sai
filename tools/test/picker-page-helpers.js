// Helpers of the tests of the page of the picker site (design REQ-057, 17). Not a test
// file. The page is run as it is in Node: its real modules, a model of the document
// (picker-page-dom.js), and a network, a storage, an address and a history that the test
// controls and records. The expected values are built here from the tenant files and from
// the requirement, never from the modules of the page.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { PICKER } from "./picker-helpers.js";
import {
  INDEX_HTML,
  choose,
  click,
  documentFromFile,
  pressEnter,
  raw,
  typeNumber,
} from "./picker-page-dom.js";
import {
  LANGS,
  SERVER_TEXTS,
  demoBytes,
  expectedQuestionnaire,
  expectedResult,
  legacyBytes,
  sha256,
} from "./picker-server-helpers.js";
import { visibleQuestionIds } from "./picker-helpers.js";

export { LANGS, SERVER_TEXTS };
export { choose, click, pressEnter, raw, typeNumber };

// Two nodes are the same node. (assert.equal on nodes would print the whole document into
// the message of a failure.)
export function same(actual, expected, message) {
  assert.ok(actual === expected, message ?? "not the same node");
}

export const PUBLIC = `${PICKER}/public`;
export const publicUrl = (name) => pathToFileURL(`${PUBLIC}/${name}`).href;

// ---------------------------------------------------------------- the texts of the page

// The texts of the page that the requirement and the design fix (design REQ-057, 14), as
// the readers of the texts left them: key -> [ru, kk, en]. The oracle of the tests;
// texts.js is compared with it, not the other way round.
export const PAGE_TEXTS = {
  card_gives: [
    "В конце вы увидите, что вы получите: что входит, чем это поможет и что делать дальше.",
    "Соңында нені алатыныңызды көресіз: не кіретінін, қалай көмектесетінін және әрі қарай не істеу керегін.",
    "At the end you will see what you get: what is included, how it helps, and next steps.",
  ],
  card_ask: [
    "Ответьте на вопросы, и сайт подберёт вам решение.",
    "Сұрақтарға жауап беріңіз, сайт сізге шешім таңдап береді.",
    "Answer the questions, and the site will pick a solution for you.",
  ],
  card_count: [
    "Вопросов: от {min} до {max}",
    "Сұрақтар: {min} бастап {max} дейін",
    "Questions: from {min} to {max}",
  ],
  card_count_same: [
    "Вопросов: {count}",
    "Сұрақтар: {count}",
    "Questions: {count}",
  ],
  card_start: ["Пройти опрос", "Сауалнамадан өту", "Take the survey"],
  card_continue: ["Продолжить", "Жалғастыру", "Continue"],
  card_restart: ["Начать заново", "Қайтадан бастау", "Start over"],
  card_changed: [
    "Анкета изменилась. Начните, пожалуйста, заново.",
    "Сауалнама өзгерді. Өтінеміз, қайтадан бастаңыз.",
    "The questionnaire has changed. Please start again.",
  ],
  progress_label: [
    "Вопрос {current} из {total}",
    "Сұрақ {current} / {total}",
    "Question {current} of {total}",
  ],
  progress_name: ["Ход опроса", "Сауалнама барысы", "Survey progress"],
  quiz_next: ["Далее", "Әрі қарай", "Next"],
  quiz_back: ["Назад", "Артқа", "Back"],
  quiz_skip: ["Пропустить", "Өткізіп жіберу", "Skip"],
  quiz_show_result: [
    "Показать результат",
    "Нәтижені көрсету",
    "Show the result",
  ],
  quiz_required: [
    "Ответьте на этот вопрос, чтобы продолжить.",
    "Жалғастыру үшін осы сұраққа жауап беріңіз.",
    "Answer this question to continue.",
  ],
  quiz_number_range: [
    "Введите целое число от {min} до {max}.",
    "{min} мен {max} арасындағы бүтін санды енгізіңіз.",
    "Enter a whole number from {min} to {max}.",
  ],
  quiz_number_hint: [
    "От {min} до {max}",
    "{min} бастап {max} дейін",
    "From {min} to {max}",
  ],
  quiz_loading: [
    "Загружаем анкету",
    "Сауалнама жүктелуде",
    "Loading the questionnaire",
  ],
  quiz_sending: ["Подбираем решение", "Шешім таңдалуда", "Picking a solution"],
  net_lost_saved: [
    "Нет связи. Ваши ответы сохранены. Попробуйте ещё раз.",
    "Байланыс жоқ. Жауаптарыңыз сақталды. Қайталап көріңіз.",
    "No connection. Your answers are saved. Please try again.",
  ],
  net_lost_unsaved: [
    "Нет связи. Не закрывайте страницу, ответы пока только здесь. Попробуйте ещё раз.",
    "Байланыс жоқ. Бетті жаппаңыз, жауаптар әзірге тек осында. Қайталап көріңіз.",
    "No connection. Please don't close the page: your answers are only stored here for now. Please try again.",
  ],
  net_retry: ["Повторить", "Қайталау", "Try again"],
  result_soon: [
    "Результат скоро появится на этой странице.",
    "Нәтиже осы бетте жақында шығады.",
    "The result will appear on this page soon.",
  ],
};
export const LANGUAGE_LABELS = { ru: "Русский", kk: "Қазақша", en: "English" };
export const SWITCHER_LABEL = { ru: "Язык", kk: "Тіл", en: "Language" };

// The text of a key in a language with the {name} placeholders filled in.
export function pageText(key, lang, values = {}) {
  return PAGE_TEXTS[key][LANGS.indexOf(lang)].replace(
    /\{([a-z]+)\}/gu,
    (whole, name) => (name in values ? String(values[name]) : whole),
  );
}

// ---------------------------------------------------------------- the sites (tenants)

const hasOwn = (o, k) => Object.hasOwn(o, k);

// A site is what the fake server knows about one tenant: the body of the questionnaire in
// every language and the check of a set of answers.
//   { id, languages, version, plain, body(lang), result(lang, answers) -> body | null }
function fileSite(id, bytes) {
  const plain = JSON.parse(bytes.toString("utf8"));
  const version = sha256(bytes);
  const v2 = ["sai-picker-tenant/2", "sai-picker-tenant/3"].includes(
    plain.schema,
  );
  return {
    id,
    plain,
    version,
    languages: v2 ? [...LANGS] : ["ru"],
    body: (lang) => expectedQuestionnaire(plain, lang, version),
    result: (lang, answers) => expectedResult(plain, lang, answers),
  };
}

export const demoSite = (id) => fileSite(id, demoBytes(id));
export const legacySite = (id) => fileSite(id, legacyBytes(id));

export const RESULT_OK = Object.freeze({
  clear_leader: true,
  recommended: [],
  no_match_text: null,
  hypotheses: [],
});

const textIn = (value, lang) =>
  typeof value === "string" ? value : (value[lang] ?? value.ru);

// A site made of a list of questions of the public form. `name` and `intro` may be a
// string or a { ru, kk, en } object.
export function customSite({
  id = "custom-one",
  name = "Custom",
  intro = "An introduction.",
  questions,
  languages = ["ru"],
  version = sha256(Buffer.from(`${id}:${JSON.stringify(questions)}`)),
}) {
  const body = (lang) => {
    const shown = languages.includes(lang) ? lang : "ru";
    return {
      version,
      lang: shown,
      languages: [...languages],
      name: textIn(name, shown),
      intro: textIn(intro, shown),
      questions_min: questions.filter((q) => !hasOwn(q, "show_if")).length,
      questions_max: questions.length,
      questions: JSON.parse(JSON.stringify(questions)),
      ai: false,
      leads: null,
    };
  };
  return {
    id,
    plain: { questions },
    version,
    languages,
    body,
    result: (lang, answers) => {
      const seen = visibleQuestionIds({ questions }, answers);
      for (const key of Object.keys(answers)) if (!seen.has(key)) return null;
      return { ...RESULT_OK };
    },
  };
}

// Builders of questions of the public form.
export function single(id, title, optionIds, extra = {}) {
  return {
    id,
    title,
    type: "single",
    required: true,
    options: optionIds.map((o) => ({ id: o, label: `${title}: ${o}` })),
    ...extra,
  };
}
export function multiple(id, title, optionIds, extra = {}) {
  return { ...single(id, title, optionIds, extra), type: "multiple" };
}
export function number(id, title, min, max, extra = {}) {
  return { id, title, type: "number", required: true, min, max, ...extra };
}

// The reference file S1 of design 5.3: six questions of "single" with the options p and
// q, all required; b is shown at a = p, c at a = q, e at d = p.
export function s1Site() {
  const on = (question, option) => [{ question, any_of: [option] }];
  return customSite({
    id: "file-s1",
    name: "S1",
    questions: [
      single("a", "Question a", ["p", "q"]),
      single("b", "Question b", ["p", "q"], { show_if: on("a", "p") }),
      single("c", "Question c", ["p", "q"], { show_if: on("a", "q") }),
      single("d", "Question d", ["p", "q"]),
      single("e", "Question e", ["p", "q"], { show_if: on("d", "p") }),
      single("f", "Question f", ["p", "q"]),
    ],
  });
}

// ---------------------------------------------------------------- the network

const NOT_FOUND = {
  error: "not_found",
  message: "Страница не найдена. / Бет табылмады. / Page not found.",
};
const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function responseOf(spec) {
  if (spec.text !== undefined)
    return new Response(spec.text, {
      status: spec.status ?? 200,
      headers: spec.headers ?? { "content-type": "text/html" },
    });
  return new Response(JSON.stringify(spec.body ?? null), {
    status: spec.status ?? 200,
    headers: jsonHeaders,
  });
}

// The fake of fetch. The default answers are those of the server (design REQ-056, 5.3).
// A test adds one-shot rules (`on`), standing rules (`always`) and holds (`hold`), which
// keep a request open until the test answers it.
function createNet(sites, locationOf) {
  const net = {
    sites: new Map(sites.map((site) => [site.id, site])),
    requests: [],
    timeouts: [],
    rules: [],
    holds: [],
    get posts() {
      return net.requests.filter((r) => r.method === "POST");
    },
    get gets() {
      return net.requests.filter((r) => r.method === "GET");
    },
    count: (method, lang) =>
      net.requests.filter(
        (r) => r.method === method && (lang === undefined || r.lang === lang),
      ).length,
    // One answer for the next request that the matcher accepts.
    on(match, behaviour) {
      net.rules.push({ match, behaviour, once: true });
    },
    always(match, behaviour) {
      net.rules.push({ match, behaviour, once: false });
    },
    // The next request that the matcher accepts is kept open: { request, respond }.
    hold(match) {
      const hold = {
        request: null,
        respond: null,
        answered: false,
        match,
      };
      net.holds.push(hold);
      return hold;
    },
    clearLog() {
      net.requests.length = 0;
    },
  };

  const resolved = (target) => {
    const base = `http://127.0.0.1:1${locationOf().pathname}`;
    return new URL(target, base);
  };

  const fallback = (req) => {
    const m = /^\/t\/([^/]+)\/api\/(questionnaire|result)$/u.exec(req.path);
    const site = m === null ? undefined : net.sites.get(m[1]);
    if (site === undefined) return { status: 404, body: NOT_FOUND };
    const lang = req.lang;
    if (m[2] === "questionnaire") {
      if (req.method !== "GET")
        return { status: 405, body: { error: "method" } };
      return { status: 200, body: site.body(lang) };
    }
    if (req.method !== "POST")
      return { status: 405, body: { error: "method" } };
    if (req.headers["content-type"] !== "application/json")
      return { status: 415, body: { error: "wrong_type" } };
    const keys = Object.keys(req.body ?? {});
    if (req.body === undefined || keys.length !== 1 || keys[0] !== "answers")
      return { status: 400, body: { error: "bad_request" } };
    const out = site.result(lang, req.body.answers);
    if (out === null)
      return {
        status: 400,
        body: {
          error: "answers_invalid",
          message: SERVER_TEXTS.server_answers_invalid[LANGS.indexOf(lang)],
        },
      };
    return { status: 200, body: out };
  };

  const decide = (req) => {
    for (const hold of net.holds) {
      if (hold.request === null && hold.match(req)) {
        hold.request = req;
        return new Promise((resolve) => {
          hold.respond = (behaviour) => {
            hold.answered = true;
            resolve(behaviour);
          };
        });
      }
    }
    for (let i = 0; i < net.rules.length; i += 1) {
      const rule = net.rules[i];
      if (!rule.match(req)) continue;
      if (rule.once) net.rules.splice(i, 1);
      return rule.behaviour;
    }
    return fallback(req);
  };

  net.fetch = async (target, init = {}) => {
    const url = resolved(String(target));
    const headers = {};
    for (const [k, v] of Object.entries(init.headers ?? {}))
      headers[k.toLowerCase()] = v;
    const bodyText = init.body === undefined ? undefined : String(init.body);
    let body;
    if (bodyText !== undefined) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = undefined;
      }
    }
    const req = {
      n: net.requests.length + 1,
      target: String(target),
      method: init.method ?? "GET",
      path: url.pathname,
      search: url.search,
      lang: url.searchParams.get("lang"),
      init,
      headers,
      signal: init.signal,
      bodyText,
      body,
    };
    net.requests.push(req);
    let behaviour = decide(req);
    const abort = new Promise((_, reject) => {
      const signal = init.signal;
      if (signal === undefined || signal === null) return;
      const fail = () => reject(signal.reason);
      if (signal.aborted) fail();
      else signal.addEventListener("abort", fail, { once: true });
    });
    behaviour = await Promise.race([Promise.resolve(behaviour), abort]);
    if (typeof behaviour === "function") behaviour = await behaviour(req);
    if (behaviour === "network") throw new TypeError("Failed to fetch");
    return responseOf(behaviour);
  };
  return net;
}

// ---------------------------------------------------------------- the storage

// The fake of localStorage: it records every call, holds the values in a map, and refuses
// on demand. Any other property is a mistake of the page and is recorded and thrown.
function createStorage(options = {}) {
  const data = new Map(Object.entries(options.initial ?? {}));
  const log = [];
  const state = {
    data,
    log,
    misuse: [],
    failGet: options.failGet === true,
    failSet: options.failSet === true,
    failRemove: options.failRemove === true,
    gets: () => log.filter((e) => e.op === "getItem"),
    sets: () => log.filter((e) => e.op === "setItem"),
    removes: () => log.filter((e) => e.op === "removeItem"),
    keys: () => [...data.keys()],
    json: (key) => (data.has(key) ? JSON.parse(data.get(key)) : null),
    snapshot: () => Object.fromEntries(data),
  };
  const refusal = () => new DOMException("denied", "SecurityError");
  const target = {
    getItem(key) {
      log.push({ op: "getItem", key });
      if (state.failGet) throw refusal();
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      log.push({ op: "setItem", key, value });
      if (state.failSet) throw new DOMException("quota", "QuotaExceededError");
      data.set(String(key), String(value));
    },
    removeItem(key) {
      log.push({ op: "removeItem", key });
      if (state.failRemove) throw refusal();
      data.delete(key);
    },
  };
  state.api = new Proxy(target, {
    get(t, prop) {
      if (typeof prop === "symbol") return undefined;
      if (!Object.hasOwn(t, prop)) {
        state.misuse.push(String(prop));
        throw new TypeError(`model: localStorage.${prop} is not allowed`);
      }
      return t[prop];
    },
  });
  return state;
}

// ---------------------------------------------------------------- the page

export async function settle(turns = 5) {
  for (let i = 0; i < turns; i += 1)
    await new Promise((resolve) => setImmediate(resolve));
}

const worlds = new WeakMap();
const GLOBALS = [
  "document",
  "location",
  "history",
  "localStorage",
  "fetch",
  "scrollTo",
  "alert",
  "confirm",
  "prompt",
];
const CONSOLE = ["log", "info", "warn", "error", "debug", "trace"];

function strict(name, target, allowed, misuse) {
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop === "symbol") return undefined;
      if (!allowed.includes(prop)) {
        misuse.push(`${name}.${prop}`);
        throw new TypeError(
          `model: ${name}.${prop} is not part of the surface`,
        );
      }
      return t[prop];
    },
    set(t, prop) {
      misuse.push(`${name}.${String(prop)}=`);
      throw new TypeError(`model: ${name}.${String(prop)} may not be written`);
    },
  });
}

// Loads the page and starts it. options:
//   sites     list of sites (default: the two demo tenants)
//   path      the address path (default /t/<first site id>/)
//   search, hash
//   storage   { initial, failGet, failSet, failRemove } or `null` for a storage that
//             throws at every access (the property localStorage itself refuses)
//   start     false to install the world without starting the page
export async function loadPage(t, options = {}) {
  const sites = options.sites ?? [
    demoSite("uchet-pro"),
    demoSite("svet-marketing"),
  ];
  const page = {
    sites,
    log: [],
    misuse: [],
    dialogs: [],
    consoleCalls: [],
    rejections: [],
    scrolls: [],
    loc: {
      pathname: options.path ?? `/t/${sites[0].id}/`,
      search: options.search ?? "",
      hash: options.hash ?? "",
    },
    replaces: [],
  };
  page.net = createNet(sites, () => page.loc);
  page.storage =
    options.storage === null ? null : createStorage(options.storage ?? {});
  page.refusingStorage = options.storage === null;
  const timeoutOf = (ms) => {
    const controller = new AbortController();
    page.net.timeouts.push({ ms, controller });
    return controller.signal;
  };

  // What the world was before the first page of this test; it is put back once, when the
  // test ends, however many pages the test loads.
  let base = worlds.get(t);
  if (base === undefined) {
    base = {
      saved: new Map(
        GLOBALS.map((name) => [
          name,
          Object.getOwnPropertyDescriptor(globalThis, name),
        ]),
      ),
      timeout: Object.getOwnPropertyDescriptor(AbortSignal, "timeout"),
      console: new Map(CONSOLE.map((name) => [name, console[name]])),
      handlers: [],
    };
    worlds.set(t, base);
    t.after(() => {
      for (const handler of base.handlers)
        process.off("unhandledRejection", handler);
      for (const [name, descriptor] of base.saved) {
        if (descriptor === undefined) delete globalThis[name];
        else Object.defineProperty(globalThis, name, descriptor);
      }
      Object.defineProperty(AbortSignal, "timeout", base.timeout);
      for (const [name, fn] of base.console) console[name] = fn;
    });
  }
  const onRejection = (reason) => page.rejections.push(reason);
  process.on("unhandledRejection", onRejection);
  base.handlers.push(onRejection);
  const put = (name, value) =>
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
      enumerable: true,
    });

  page.doc = documentFromFile(INDEX_HTML, page.log);
  put("document", page.doc.api);
  put(
    "location",
    strict("location", page.loc, ["pathname", "search", "hash"], page.misuse),
  );
  put(
    "history",
    strict(
      "history",
      {
        replaceState: (state, title, url) => {
          page.replaces.push({ state, title, url });
          page.log.push({ op: "replaceState", url });
          const next = new URL(
            String(url),
            `http://127.0.0.1:1${page.loc.pathname}${page.loc.search}`,
          );
          page.loc.pathname = next.pathname;
          page.loc.search = next.search;
          page.loc.hash = next.hash;
        },
      },
      ["replaceState"],
      page.misuse,
    ),
  );
  if (page.refusingStorage) {
    Object.defineProperty(globalThis, "localStorage", {
      get() {
        throw new DOMException("denied", "SecurityError");
      },
      configurable: true,
    });
  } else put("localStorage", page.storage.api);
  put("fetch", (target, init) => page.net.fetch(target, init));
  put("scrollTo", (args) => {
    page.scrolls.push(args);
    page.log.push({ op: "scroll", args });
  });
  for (const name of ["alert", "confirm", "prompt"])
    put(name, (...args) => {
      page.dialogs.push({ name, args });
    });
  Object.defineProperty(AbortSignal, "timeout", {
    value: timeoutOf,
    configurable: true,
    writable: true,
  });
  for (const name of CONSOLE)
    console[name] = (...args) => {
      page.consoleCalls.push({ name, args });
    };

  Object.defineProperties(page, Object.getOwnPropertyDescriptors(pageApi));
  if (options.start !== false) await page.run();
  return page;
}

// ---------------------------------------------------------------- driving the page

const pageApi = {
  async run() {
    const { start } = await import(publicUrl("app.js"));
    start();
    await settle();
  },

  // A new load of the page: a new document, the same storage, the same address.
  async reload(changes = {}) {
    this.doc = documentFromFile(INDEX_HTML, this.log);
    Object.defineProperty(globalThis, "document", {
      value: this.doc.api,
      configurable: true,
      writable: true,
      enumerable: true,
    });
    if (changes.search !== undefined) this.loc.search = changes.search;
    if (changes.hash !== undefined) this.loc.hash = changes.hash;
    if (changes.path !== undefined) this.loc.pathname = changes.path;
    await this.run();
  },

  settle,

  get app() {
    return this.doc.byId("app");
  },
  get live() {
    return this.doc.byId("live");
  },
  get panel() {
    return this.app.find('[data-part="panel"]');
  },
  get screen() {
    return this.panel?.attr("data-screen") ?? null;
  },
  get lang() {
    return this.doc.html.attr("lang");
  },
  get text() {
    return this.app.text;
  },
  get active() {
    return this.doc.activeElement;
  },
  find(selector) {
    return this.app.find(selector);
  },
  all(selector) {
    return this.app.all(selector);
  },
  part(name) {
    return this.app.find(`[data-part="${name}"]`);
  },
  action(name) {
    return this.app.find(`[data-action="${name}"]`);
  },
  langButton(code) {
    return this.app.find(`[data-part="lang"][lang="${code}"]`);
  },
  get langButtons() {
    return this.app.all('[data-part="lang"]');
  },
  get title() {
    return this.doc.head.find("title")?.text ?? "";
  },

  // ---- the visitor (each waits for the page to settle)
  async click(target) {
    const node = typeof target === "string" ? this.must(target) : target;
    click(node);
    await settle();
  },
  async tap(action) {
    await this.click(this.must(`[data-action="${action}"]`));
  },
  async choose(input) {
    choose(input);
    await settle();
  },
  async type(input, text) {
    typeNumber(input, text);
    await settle();
  },
  async enter(input) {
    pressEnter(input);
    await settle();
  },
  must(selector) {
    const node = this.app.find(selector);
    if (node === null)
      throw new Error(`nothing for ${selector} on ${this.screen}`);
    return node;
  },

  // ---- the question on the screen
  get qTitle() {
    return this.app.find("#q-title")?.text ?? null;
  },
  get inputs() {
    return this.app.all('[data-part="fieldset"] input');
  },
  // The question of the site on the screen (found by its title in the language).
  currentQuestion(site) {
    const title = this.qTitle;
    if (title === null) return null;
    return (
      site.body(this.lang).questions.find((q) => q.title === title) ?? null
    );
  },
  // The progress shown: { k, n, text, fill }.
  get progress() {
    const bar = this.app.find('[data-part="bar"]');
    if (bar === null) return null;
    return {
      k: Number(bar.attr("aria-valuenow")),
      n: Number(bar.attr("aria-valuemax")),
      min: bar.attr("aria-valuemin"),
      valuetext: bar.attr("aria-valuetext"),
      label: bar.attr("aria-label"),
      text: this.part("progress-text")?.text ?? null,
      fill: bar.find('[data-part="bar-fill"]')?.style.width ?? null,
    };
  },
  // The values of the answers chosen in the field: single -> string, multiple -> list in
  // the order of the options on the screen, number -> the text of the field.
  chosen() {
    const inputs = this.inputs;
    if (inputs.length === 0) return undefined;
    const type = inputs[0].attr("type");
    if (type === "number") return inputs[0].value;
    const values = inputs.filter((i) => i.checked).map((i) => i.value);
    return type === "radio" ? (values[0] ?? null) : values;
  },
  // Gives the answer to the question on the screen (single: the id; multiple: the list
  // of ids that must be on; number: the number).
  async answer(value) {
    const inputs = this.inputs;
    const type = inputs[0].attr("type");
    if (type === "number") {
      await this.type(inputs[0], String(value));
      return;
    }
    if (type === "radio") {
      await this.choose(inputs.find((i) => i.value === value));
      return;
    }
    for (const input of inputs) {
      const wanted = value.includes(input.value);
      if (input.checked !== wanted) choose(input);
    }
    await settle();
  },
  // What the state of the storage holds for a tenant now.
  stored(id) {
    return this.storage.json(`sai-picker:${id}`);
  },
  // Everything that must stay empty in a clean run.
  strays() {
    return {
      console: this.consoleCalls,
      rejections: this.rejections,
      dialogs: this.dialogs,
      misuse: this.misuse,
      storageMisuse: this.storage === null ? [] : this.storage.misuse,
    };
  },
};

// ---------------------------------------------------------------- oracles

// N by the rule of decisions/0077, item 4, written from the requirement: a question is
// counted if it is visible now or if one of its conditions refers to a question that is
// not above the current one. `currentIndex` is the position of the current question in
// the file.
export function expectedProgress(questions, answers, currentId) {
  const seen = visibleQuestionIds({ questions }, answers);
  const index = new Map(questions.map((q, i) => [q.id, i]));
  const current = index.get(currentId);
  let n = 0;
  for (const q of questions) {
    if (seen.has(q.id)) n += 1;
    else if (
      (q.show_if ?? []).some(
        (c) => index.has(c.question) && index.get(c.question) >= current,
      )
    )
      n += 1;
  }
  const visible = questions.filter((q) => seen.has(q.id));
  return { k: visible.findIndex((q) => q.id === currentId) + 1, n };
}

export function progressText(lang, k, n) {
  return pageText("progress_label", lang, { current: k, total: n });
}

// A forward walk through the questionnaire with the answers from `rng`; the visitor
// presses "Next" or "Skip". Returns the steps { id, k, n, answered } and the answers.
export async function walkForward(page, site, rng, options = {}) {
  const steps = [];
  const given = {};
  for (let guard = 0; guard < 60; guard += 1) {
    if (page.screen !== "question") break;
    const question = page.currentQuestion(site);
    const progress = page.progress;
    const step = { id: question.id, k: progress.k, n: progress.n };
    steps.push(step);
    const skip = !question.required && rng.next() < (options.omitRate ?? 0.4);
    const buttonAction = page.action("show-result") ? "show-result" : "next";
    if (skip) {
      await page.tap("skip");
      delete given[question.id];
      step.answered = false;
    } else {
      const value = randomAnswer(question, rng);
      await page.answer(value);
      given[question.id] = value;
      step.answered = true;
      if (buttonAction === "show-result" && options.stopAtResult === true) {
        step.last = true;
        break;
      }
      await page.tap(buttonAction);
    }
    step.last = buttonAction === "show-result";
    if (buttonAction === "show-result") break;
  }
  return { steps, given };
}

export function randomAnswer(question, rng) {
  if (question.type === "single") return rng.pick(question.options).id;
  if (question.type === "multiple") {
    const ids = question.options.map((o) => o.id);
    const chosen = ids.filter(() => rng.next() < 0.5);
    return chosen.length > 0 ? chosen : [rng.pick(ids)];
  }
  const edges = [question.min, question.max, 0, 100, 499, 500, 501];
  if (rng.next() < 0.3) {
    const inside = edges.filter((v) => v >= question.min && v <= question.max);
    if (inside.length > 0) return rng.pick(inside);
  }
  return question.min + rng.int(question.max - question.min + 1);
}
