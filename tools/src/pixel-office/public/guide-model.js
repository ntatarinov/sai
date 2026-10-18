// The rules of the guide "Как пользоваться" that need no page (REQ-050, design
// REQ-050-053 3.2): the sections of the guide, the one order of Escape of the
// whole page and "is this node inside that one". Pure: no DOM calls, no clock,
// no Node; only the texts of texts.js.

import {
  GUIDE_GLOSSARY,
  GUIDE_ROLE_ABOUT,
  GUIDE_ROLES,
  GUIDE_SECTIONS,
  GUIDE_TEAM,
  KEYS_HINT,
  KEYS_TOUR,
  ROLE_NAMES,
  TOUR_STEPS,
} from "./texts.js";

// The items added to the list of the section "Клавиши" right after the item
// "Escape — …" (it is the last item of that list), in this order.
const KEYS_ADDED = Object.freeze([KEYS_TOUR, KEYS_HINT]);

// True when root is on the path node, node.parentNode, ... (node itself too).
// The fake page of the tests has no contains(), so the path is walked.
export function within(node, root) {
  if (node === null || node === undefined) return false;
  if (root === null || root === undefined) return false;
  let at = node;
  while (at !== null && at !== undefined) {
    if (at === root) return true;
    at = at.parentNode;
  }
  return false;
}

// The section "Роли команды": the lead paragraph, then the groups; an item
// is "<name> — <description>". A code without a name or a description is left
// out, so the section is never broken; roleTableProblems tells about it.
function rolesSection(roleNames) {
  const groups = GUIDE_ROLES.groups.map((group) => ({
    title: group.title,
    items: group.codes
      .filter(
        (code) =>
          Object.hasOwn(roleNames, code) &&
          Object.hasOwn(GUIDE_ROLE_ABOUT, code),
      )
      .map((code) => `${roleNames[code]} — ${GUIDE_ROLE_ABOUT[code]}`),
  }));
  return {
    key: GUIDE_ROLES.key,
    title: GUIDE_ROLES.title,
    blocks: [
      { kind: "p", text: GUIDE_ROLES.lead },
      { kind: "groups", groups },
    ],
  };
}

// The one list of the section "Клавиши" with the items of the tour and of the
// hints after "Escape — …".
function keysBlock(block) {
  if (block.kind !== "ul") return block;
  return { kind: "ul", items: [...block.items, ...KEYS_ADDED] };
}

// The sections of the guide in their order (design 3.2): "page", then the
// sections about the team and the roles (REQ-051), the other sections of
// REQ-050 and the glossary last. roleNames: the names of the roles by code.
export function guideSections(roleNames = ROLE_NAMES) {
  const of = (section) => ({
    key: section.key,
    title: section.title,
    blocks:
      section.key === "keys" ? section.blocks.map(keysBlock) : section.blocks,
  });
  const [first, ...rest] = GUIDE_SECTIONS.map(of);
  return [
    first,
    of(GUIDE_TEAM),
    rolesSection(roleNames),
    ...rest,
    {
      key: GUIDE_GLOSSARY.key,
      title: GUIDE_GLOSSARY.title,
      blocks: [{ kind: "dl", pairs: GUIDE_GLOSSARY.pairs }],
    },
  ];
}

// What does not agree between the names of the roles, the groups and the
// descriptions: an empty list when all agree (REQ-051, criterion 2). Never
// throws.
export function roleTableProblems(roleNames, groups, about) {
  const out = [];
  const names =
    roleNames !== null && typeof roleNames === "object" ? roleNames : {};
  const texts = about !== null && typeof about === "object" ? about : {};
  const list = Array.isArray(groups) ? groups : [];
  const codes = [];
  for (const group of list) {
    if (
      group !== null &&
      typeof group === "object" &&
      Array.isArray(group.codes)
    ) {
      codes.push(...group.codes);
    }
  }
  const counts = new Map();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  for (const code of Object.keys(names)) {
    if (!counts.has(code)) out.push(`no group: ${code}`);
  }
  for (const code of Object.keys(names)) {
    if (!Object.hasOwn(texts, code)) out.push(`no description: ${code}`);
  }
  for (const [code, n] of counts) {
    if (n > 1) out.push(`repeated: ${code}`);
  }
  for (const code of counts.keys()) {
    if (!Object.hasOwn(names, code)) out.push(`not a role: ${code}`);
  }
  for (const code of Object.keys(texts)) {
    if (!Object.hasOwn(names, code)) out.push(`extra description: ${code}`);
  }
  return out;
}

// What a step of the tour shows (design 3.2): its title, its text or the
// text instead, the target to mark and its buttons. step: 1...6, else null.
// facts: {characters, nowShown, rows, items}.
export function tourStepView(step, facts) {
  if (!Number.isInteger(step) || step < 1 || step > TOUR_STEPS.length) {
    return null;
  }
  const f = facts !== null && typeof facts === "object" ? facts : {};
  let target = null;
  let fallback = false;
  if (step === 2) {
    if (f.characters > 0) target = "office";
    else fallback = true;
  } else if (step === 3) {
    if (f.nowShown === true) target = "now";
    else fallback = true;
  } else if (step === 4) {
    target = "journal";
    fallback = f.rows === 0;
  } else if (step === 5) {
    target = "tasks";
    fallback = f.items === 0;
  } else if (step === 6) {
    target = "guide";
  }
  const texts = TOUR_STEPS[step - 1];
  let buttons = ["close", "back", "skip", "next"];
  if (step === 1) buttons = ["close", "skip", "next"];
  else if (step === TOUR_STEPS.length) buttons = ["close", "back", "last"];
  return {
    step,
    title: texts.title,
    text: fallback ? texts.fallback : texts.text,
    fallback,
    target,
    buttons,
  };
}

// The one order of Escape of the page (design 4.1): one press closes the first
// open thing of this list, or nothing. f holds booleans: what is open and
// where the focus is.
export function escapeTarget(f) {
  if (f.history) return "history";
  if (f.card) return "card";
  if (f.hint) return "hint";
  if (f.tour) return "tour";
  if (f.nowAll) return "nowAll";
  if (f.guide && f.focusInGuide) return "guide";
  if (f.invite && f.focusInInvite) return "invite";
  if (f.row && f.focusInRow) return "row";
  if (f.guide) return "guide";
  return null;
}
