// The consent sentences of the invitation page (the code design M2PROJ, 4.7, 4.8): the five keys of the
// texts module and the one function that joins them. The page hashes the joined text of the language it
// shows; the server hashes its own copy of the same text with the same function, and the two digests must
// be equal. Pure: it reads only the texts given to it.

/** The five keys of the consent sentences, in the order they are shown. */
export const CONSENT_KEYS = Object.freeze([
  "consent_s1",
  "consent_s2",
  "consent_s3",
  "consent_s4",
  "consent_s5",
]);

/**
 * The five sentences of a language joined by one space (U+0020), or null when any of them is missing or
 * empty in that language.
 * @param {Readonly<Record<string, Readonly<Record<string, string>>>>} texts the table of the texts module
 * @param {string} lang
 * @returns {string | null}
 */
export function consentText(texts, lang) {
  /** @type {string[]} */
  const parts = [];
  for (const key of CONSENT_KEYS) {
    const entry = Object.hasOwn(texts, key) ? texts[key] : undefined;
    const value =
      entry !== undefined && Object.hasOwn(entry, lang) ? entry[lang] : "";
    if (typeof value !== "string" || value === "") return null;
    parts.push(value);
  }
  return parts.join(" ");
}
