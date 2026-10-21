// The stub of the page of the picker site (design REQ-056, 5.5): one sentence in the
// language of the visitor. The page of the questionnaire and the result replaces this
// file (REQ-057).
import { LANGUAGES, TEXTS, chooseLanguage } from "./texts.js";

const wanted = new URLSearchParams(location.search).get("lang");
const lang = chooseLanguage({
  query: wanted ?? undefined,
  available: LANGUAGES,
});
document.documentElement.lang = lang;
const app = document.getElementById("app");
if (app) app.textContent = TEXTS.page_stub_notice[lang];
