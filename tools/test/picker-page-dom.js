// A small model of the document of a browser for the tests of the page of the picker site
// (tools/src/picker/public/), in Node and without a dependency. Not a test file.
//
// It is NOT a browser: it holds no layout, no styles and no real order of the focus. It
// implements exactly the surface that the page is allowed to use (design REQ-057, 10.3):
//   document: getElementById, createElement, documentElement.lang, title;
//   element: setAttribute, getAttribute, removeAttribute, append, replaceChildren,
//     textContent, addEventListener, focus({ preventScroll }), querySelector(All), checked,
//     value, validity.badInput, style.width, lang.
// Anything else that the code of the page reads or writes on a node is a TypeError, so a
// page that reaches for innerHTML, insertAdjacentHTML, setAttribute-less style or a
// parent node turns its test red. The tests themselves work with the raw nodes (`Node`
// objects, with the richer helpers `find`, `all`, `attr`, `text`) and with the functions
// at the end of this file that act as a visitor does (click, choose, type a number).
import fs from "node:fs";
import path from "node:path";

const VOID = new Set(["meta", "link", "input", "br", "img", "hr"]);
const RAW = new Set(["script", "style"]);

// What the page may read and write on an element.
const READ_OK = new Set([
  "setAttribute",
  "getAttribute",
  "removeAttribute",
  "append",
  "replaceChildren",
  "addEventListener",
  "focus",
  "querySelector",
  "querySelectorAll",
  "textContent",
  "checked",
  "value",
  "validity",
  "style",
  "lang",
]);
const WRITE_OK = new Set(["textContent", "checked", "value", "lang"]);

const raws = new WeakMap();
const INSPECT = Symbol.for("nodejs.util.inspect.custom");

// Every field of a node, a text and the document except `tag` is hidden from the
// enumeration. `assert` prints a failed operand with its own inspection (custom
// inspection off, depth 1000), so the short name below does not help there: only fields
// that are not enumerable keep the tree out of the message. A message that printed the
// tree took 6.7 GB in one run (step 18, finding F3).
function hide(object, except = []) {
  for (const key of Object.keys(object)) {
    if (!except.includes(key))
      Object.defineProperty(object, key, { enumerable: false });
  }
}

// The raw node behind a node of the page (a proxy), or the node itself.
export function raw(node) {
  return raws.get(node) ?? node;
}

// ---- nodes ----------------------------------------------------------------------------

export class Text {
  constructor(doc, data) {
    this.doc = doc;
    this.data = data;
    this.parent = null;
    hide(this);
  }

  [INSPECT]() {
    return `<text ${JSON.stringify(this.data.slice(0, 30))}>`;
  }

  get text() {
    return this.data;
  }
}

export class Node {
  // A short name for the messages of a failed check: the tag, the id and the classes and
  // nothing else. A node holds the whole document, and a message that prints it would
  // take minutes and gigabytes (see `hide`).
  [INSPECT]() {
    const classes = (this.attr("class") ?? "").split(/\s+/u).filter(Boolean);
    return `<${this.tag}${this.id === "" ? "" : `#${this.id}`}${classes
      .map((c) => `.${c}`)
      .join("")}>`;
  }

  constructor(doc, tag) {
    this.doc = doc;
    this.tag = tag.toLowerCase();
    this.attrs = new Map();
    this.children = [];
    this.parent = null;
    this.listeners = [];
    this.checkedValue = false;
    this.valueText = "";
    this.badInput = false;
    this.style = { width: "" };
    this.proxy = makeProxy(this);
    raws.set(this.proxy, this);
    hide(this, ["tag"]);
  }

  // ---- reading, for the tests
  attr(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  has(name) {
    return this.attrs.has(name);
  }

  get id() {
    return this.attr("id") ?? "";
  }

  get text() {
    return this.children.map((c) => c.text).join("");
  }

  get elements() {
    return this.children.filter((c) => c instanceof Node);
  }

  all(selector) {
    const groups = parseSelector(selector);
    const out = [];
    walk(this, (n) => {
      if (n !== this && groups.some((match) => match(n))) out.push(n);
    });
    return out;
  }

  find(selector) {
    return this.all(selector)[0] ?? null;
  }

  // The text nodes below this one that are not empty, in the order of reading.
  textNodes() {
    const out = [];
    const visit = (n) => {
      for (const c of n.children) {
        if (c instanceof Text) {
          if (c.data !== "") out.push(c.data);
        } else visit(c);
      }
    };
    visit(this);
    return out;
  }

  // The nodes from the root to this one.
  chain() {
    const out = [];
    for (let n = this; n !== null; n = n.parent) out.push(n);
    return out;
  }

  get connected() {
    return this.chain().includes(this.doc.html);
  }

  // A control is disabled by its own attribute or by a fieldset above it.
  get disabled() {
    if (this.has("disabled")) return true;
    return this.chain().some(
      (n) => n !== this && n.tag === "fieldset" && n.has("disabled"),
    );
  }

  // ---- the surface of the page (called through the proxy)
  setAttribute(name, value) {
    const key = String(name);
    this.attrs.set(key, String(value));
    if (key === "disabled" && this.doc.activeElement !== null) {
      const active = this.doc.activeElement;
      if (active.disabled) this.doc.activeElement = this.doc.body;
    }
  }

  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  removeAttribute(name) {
    this.attrs.delete(name);
  }

  append(...items) {
    for (const item of items) this.insert(item);
  }

  replaceChildren(...items) {
    for (const child of [...this.children]) this.detach(child);
    for (const item of items) this.insert(item);
  }

  insert(item) {
    const node =
      typeof item === "string" ? new Text(this.doc, item) : raw(item);
    if (!(node instanceof Node) && !(node instanceof Text))
      throw new TypeError("model: append takes a string or a node");
    if (node.parent !== null) node.parent.detach(node);
    node.parent = this;
    this.children.push(node);
  }

  detach(child) {
    const at = this.children.indexOf(child);
    if (at !== -1) this.children.splice(at, 1);
    child.parent = null;
    const active = this.doc.activeElement;
    if (active !== null && active !== this.doc.body) {
      const gone =
        active === child ||
        (child instanceof Node && active.chain().includes(child));
      if (gone) this.doc.activeElement = this.doc.body;
    }
  }

  addEventListener(type, listener) {
    if (typeof listener !== "function")
      throw new TypeError("model: a listener is a function");
    this.listeners.push({ type: String(type), listener });
  }

  focus(options) {
    this.doc.focusCalls.push({ node: this, options });
    this.doc.log.push({ op: "focus", node: this, options });
    if (!this.connected || this.disabled) return;
    this.doc.activeElement = this;
  }

  querySelector(selector) {
    return this.find(selector)?.proxy ?? null;
  }

  querySelectorAll(selector) {
    return this.all(selector).map((n) => n.proxy);
  }

  get textContent() {
    return this.text;
  }

  set textContent(value) {
    for (const child of [...this.children]) this.detach(child);
    const text = String(value ?? "");
    if (text !== "") this.insert(text);
  }

  get checked() {
    return this.checkedValue;
  }

  set checked(value) {
    const on = Boolean(value);
    this.checkedValue = on;
    if (on && this.tag === "input" && this.attr("type") === "radio") {
      for (const peer of this.radioPeers()) peer.checkedValue = false;
    }
  }

  // The other radio buttons of the same name in the same form (or the document).
  radioPeers() {
    const name = this.attr("name");
    if (name === null) return [];
    const scope = this.chain().find((n) => n.tag === "form") ?? this.doc.html;
    return scope
      .all("input")
      .filter(
        (n) =>
          n !== this && n.attr("type") === "radio" && n.attr("name") === name,
      );
  }

  get value() {
    const type = this.attr("type");
    if (this.tag === "input" && (type === "radio" || type === "checkbox"))
      return this.has("value") ? this.attr("value") : "on";
    return this.valueText;
  }

  set value(text) {
    const type = this.attr("type");
    if (this.tag === "input" && (type === "radio" || type === "checkbox")) {
      this.attrs.set("value", String(text));
      return;
    }
    this.valueText = String(text);
    this.badInput = false;
  }

  get validity() {
    return { badInput: this.badInput };
  }

  get lang() {
    return this.attr("lang") ?? "";
  }

  set lang(value) {
    this.attrs.set("lang", String(value));
  }

  // ---- events, for the tests
  dispatch(type, extra = {}) {
    const event = {
      type,
      target: this.proxy,
      defaultPrevented: false,
      preventDefault() {
        event.defaultPrevented = true;
      },
      ...extra,
    };
    for (let n = this; n !== null; n = n.parent) {
      for (const entry of [...n.listeners]) {
        if (entry.type === type) entry.listener(event);
      }
    }
    return event;
  }
}

function walk(node, visit) {
  visit(node);
  for (const child of node.children) {
    if (child instanceof Node) walk(child, visit);
  }
}

function makeProxy(node) {
  return new Proxy(node, {
    get(target, prop) {
      if (typeof prop === "symbol" || prop === "then") return undefined;
      if (!READ_OK.has(prop))
        throw new TypeError(
          `model: "${prop}" is not part of the surface of the page`,
        );
      const value = target[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, prop, value) {
      if (!WRITE_OK.has(prop))
        throw new TypeError(
          `model: "${String(prop)}" may not be written by the page`,
        );
      target[prop] = value;
      return true;
    },
  });
}

// ---- selectors ----------------------------------------------------------------------

// Compound selectors with tag, #id, [attr], [attr="v"], descendants (" ") and children
// (">"), and groups with ",". Enough for the tests; any other form throws.
function parseCompound(text) {
  const parts = [];
  const re =
    /^(?:(\*)|([a-z][a-z0-9-]*)|#([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\])/u;
  let rest = text;
  while (rest !== "") {
    const m = re.exec(rest);
    if (m === null) throw new Error(`selector not understood: ${text}`);
    rest = rest.slice(m[0].length);
    if (m[1]) parts.push(() => true);
    else if (m[2]) parts.push((n) => n.tag === m[2]);
    else if (m[3]) parts.push((n) => n.id === m[3]);
    else if (m[5] !== undefined) parts.push((n) => n.attr(m[4]) === m[5]);
    else parts.push((n) => n.has(m[4]));
  }
  return (n) => parts.every((p) => p(n));
}

function parseSelector(selector) {
  return selector.split(",").map((group) => {
    const tokens = group
      .trim()
      .replace(/\s*>\s*/gu, " > ")
      .split(/\s+/u);
    const steps = [];
    let combinator = " ";
    for (const token of tokens) {
      if (token === ">") combinator = ">";
      else {
        steps.push({ match: parseCompound(token), combinator });
        combinator = " ";
      }
    }
    return (node) => {
      const last = steps.length - 1;
      const at = (i, n) => {
        if (!steps[i].match(n)) return false;
        if (i === 0) return true;
        if (steps[i].combinator === ">")
          return n.parent instanceof Node && at(i - 1, n.parent);
        for (let p = n.parent; p instanceof Node; p = p.parent)
          if (at(i - 1, p)) return true;
        return false;
      };
      return at(last, node);
    };
  });
}

// ---- the document -------------------------------------------------------------------

export class Doc {
  [INSPECT]() {
    return "<document>";
  }

  constructor(log = []) {
    this.log = log;
    this.focusCalls = [];
    this.activeElement = null;
    this.html = new Node(this, "html");
    this.head = new Node(this, "head");
    this.body = new Node(this, "body");
    this.html.insert(this.head.proxy);
    this.html.insert(this.body.proxy);
    this.activeElement = this.body;
    const doc = this;
    this.api = new Proxy(
      {
        getElementById: (id) => doc.byId(id)?.proxy ?? null,
        createElement: (tag) => new Node(doc, String(tag)).proxy,
        get documentElement() {
          return doc.html.proxy;
        },
        get title() {
          return doc.head.find("title")?.text ?? "";
        },
        set title(value) {
          let title = doc.head.find("title");
          if (title === null) {
            title = new Node(doc, "title");
            doc.head.insert(title.proxy);
          }
          title.textContent = value;
        },
      },
      {
        get(target, prop) {
          if (typeof prop === "symbol") return undefined;
          if (
            ![
              "getElementById",
              "createElement",
              "documentElement",
              "title",
            ].includes(prop)
          )
            throw new TypeError(
              `model: document.${prop} is not part of the surface of the page`,
            );
          return target[prop];
        },
        set(target, prop, value) {
          if (prop !== "title")
            throw new TypeError(
              `model: document.${String(prop)} may not be written`,
            );
          target[prop] = value;
          return true;
        },
      },
    );
    hide(this);
  }

  byId(id) {
    let found = null;
    walk(this.html, (n) => {
      if (found === null && n.attr("id") === id) found = n;
    });
    return found;
  }
}

// ---- the parser of the real index.html -------------------------------------------------

function attributesOf(text) {
  const out = [];
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gu;
  for (const m of text.matchAll(re))
    out.push([m[1], m[2] ?? m[3] ?? m[4] ?? ""]);
  return out;
}

// Builds the document from the text of index.html: the elements, their attributes and
// their text. Scripts are kept as elements but not run.
export function parseHtml(source, log = []) {
  const doc = new Doc(log);
  const stack = [doc.html];
  const html = source
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<!doctype[^>]*>/giu, "");
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>|([^<]+)/gu;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (match[5] !== undefined) {
      const text = match[5];
      if (text.trim() === "") continue;
      stack[stack.length - 1].insert(text.trim());
      continue;
    }
    const [, closing, name, attrText, selfClosing] = match;
    const tag = name.toLowerCase();
    if (closing) {
      while (stack.length > 1) {
        const top = stack.pop();
        if (top.tag === tag) break;
      }
      continue;
    }
    let node;
    if (tag === "html") node = doc.html;
    else if (tag === "head") node = doc.head;
    else if (tag === "body") node = doc.body;
    else {
      node = new Node(doc, tag);
      stack[stack.length - 1].insert(node.proxy);
    }
    for (const [key, value] of attributesOf(attrText))
      node.attrs.set(key, value);
    if (RAW.has(tag) && !selfClosing) {
      const close = html.toLowerCase().indexOf(`</${tag}`, re.lastIndex);
      if (close === -1) throw new Error(`unclosed <${tag}>`);
      const body = html.slice(re.lastIndex, close);
      if (body.trim() !== "") node.insert(body);
      re.lastIndex = close;
      stack.push(node);
      continue;
    }
    if (
      !VOID.has(tag) &&
      !selfClosing &&
      tag !== "html" &&
      tag !== "head" &&
      tag !== "body"
    )
      stack.push(node);
    else if (tag === "html" || tag === "head" || tag === "body")
      stack.push(node);
  }
  doc.activeElement = doc.body;
  return doc;
}

export function documentFromFile(file, log = []) {
  return parseHtml(fs.readFileSync(file, "utf8"), log);
}

export const INDEX_HTML = path.join(
  import.meta.dirname,
  "..",
  "src",
  "picker",
  "public",
  "index.html",
);

// ---- what a visitor does ---------------------------------------------------------------

// The text of a number field after the browser has read it: a text that is not a floating
// point number gives value "" and badInput (this is what a number field does).
const FLOAT = /^-?(?:\d+|\d*\.\d+)(?:[eE][-+]?\d+)?$/u;

export function typeNumber(input, text) {
  const node = raw(input);
  if (node.disabled) return false;
  const shown = String(text);
  if (shown === "") {
    node.valueText = "";
    node.badInput = false;
  } else if (FLOAT.test(shown)) {
    node.valueText = shown;
    node.badInput = false;
  } else {
    node.valueText = "";
    node.badInput = true;
  }
  node.dispatch("input");
  return true;
}

// A radio button chosen, or a check box turned over, by the visitor.
export function choose(input) {
  const node = raw(input);
  if (node.disabled) return false;
  const type = node.attr("type");
  if (type === "radio") {
    if (node.checked) return true;
    node.checked = true;
  } else if (type === "checkbox") {
    node.checked = !node.checked;
  } else throw new Error("choose: not a radio button and not a check box");
  node.dispatch("input");
  node.dispatch("change");
  return true;
}

// A click on a button (or Enter/space on it). A disabled control does nothing; a submit
// button sends its form unless the click was prevented.
export function click(button) {
  const node = raw(button);
  if (node.disabled) return false;
  const event = node.dispatch("click");
  if (
    !event.defaultPrevented &&
    node.tag === "button" &&
    node.attr("type") === "submit"
  ) {
    const form = node.chain().find((n) => n.tag === "form");
    if (form) form.dispatch("submit");
  }
  return true;
}

// Enter in a field: the form is sent (a field that is disabled gets no key).
export function pressEnter(input) {
  const node = raw(input);
  if (node.disabled) return false;
  const form = node.chain().find((n) => n.tag === "form");
  if (!form) return false;
  form.dispatch("submit");
  return true;
}
