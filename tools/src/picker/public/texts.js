// The languages and the texts of the picker site. The file runs in the browser and in
// Node, so it has no dependencies and no calls to the platform. Everything it exports
// is frozen.

export const LANGUAGES = Object.freeze(["ru", "kk", "en"]);
export const DEFAULT_LANGUAGE = "ru";

// The name of each language in that language.
export const LANGUAGE_NAMES = Object.freeze({
  ru: "Русский",
  kk: "Қазақша",
  en: "English",
});

// A text of the site: a key -> { ru, kk, en }. A placeholder {name} is the same in all
// three languages. Later work adds its keys here (prefixes lead_, advice_).
export const TEXTS = Object.freeze({
  language_switcher_label: Object.freeze({
    ru: "Язык",
    kk: "Тіл",
    en: "Language",
  }),
  server_not_found: Object.freeze({
    ru: "Страница не найдена.",
    kk: "Бет табылмады.",
    en: "Page not found.",
  }),
  server_forbidden: Object.freeze({
    ru: "Запрос отклонён.",
    kk: "Сұрау қабылданбады.",
    en: "Request denied.",
  }),
  server_method: Object.freeze({
    ru: "Так обращаться к этой странице нельзя.",
    kk: "Бұл бетке бұлай жүгінуге болмайды.",
    en: "This page cannot be accessed that way.",
  }),
  server_wrong_type: Object.freeze({
    ru: "Запрос не принят: неверный тип данных.",
    kk: "Сұрау қабылданбады: деректер түрі дұрыс емес.",
    en: "Request not accepted: unsupported data type.",
  }),
  server_too_large: Object.freeze({
    ru: "Запрос слишком большой. Сократите ответы и попробуйте ещё раз.",
    kk: "Сұрау тым үлкен. Жауаптарды қысқартып, қайталап көріңіз.",
    en: "The request is too large. Shorten the answers and try again.",
  }),
  server_slow: Object.freeze({
    ru: "Запрос пришёл слишком поздно. Отправьте его ещё раз.",
    kk: "Сұрау тым кеш келді. Оны қайта жіберіңіз.",
    en: "The request took too long to arrive. Send it again.",
  }),
  server_bad_request: Object.freeze({
    ru: "Запрос не удалось прочитать. Отправьте ответы ещё раз.",
    kk: "Сұрауды оқу мүмкін болмады. Жауаптарды қайта жіберіңіз.",
    en: "The request could not be read. Send the answers again.",
  }),
  server_extra_field: Object.freeze({
    ru: "В запросе лишнее поле {field}. Удалите его.",
    kk: "Сұрауда артық {field} өрісі бар. Оны алып тастаңыз.",
    en: "The request has an extra field {field}. Remove it.",
  }),
  server_no_answers: Object.freeze({
    ru: "В запросе нет ответов. Отправьте их ещё раз.",
    kk: "Сұрауда жауаптар жоқ. Оларды қайта жіберіңіз.",
    en: "The request has no answers. Send them again.",
  }),
  server_answers_invalid: Object.freeze({
    ru: "Ответы не подходят к этой анкете. Пройдите анкету ещё раз.",
    kk: "Жауаптар бұл сауалнамаға сәйкес келмейді. Сауалнаманы қайта толтырыңыз.",
    en: "The answers do not fit this questionnaire. Go through it again.",
  }),
  server_internal: Object.freeze({
    ru: "Что-то пошло не так. Попробуйте ещё раз позже.",
    kk: "Бірдеңе дұрыс болмады. Кейінірек қайталап көріңіз.",
    en: "Something went wrong. Please try again later.",
  }),
  card_gives: Object.freeze({
    ru: "В конце вы увидите, что вы получите: что входит, чем это поможет и что делать дальше.",
    kk: "Соңында нені алатыныңызды көресіз: не кіретінін, қалай көмектесетінін және әрі қарай не істеу керегін.",
    en: "At the end you will see what you get: what is included, how it helps, and next steps.",
  }),
  card_ask: Object.freeze({
    ru: "Ответьте на вопросы, и сайт подберёт вам решение.",
    kk: "Сұрақтарға жауап беріңіз, сайт сізге шешім таңдап береді.",
    en: "Answer the questions, and the site will pick a solution for you.",
  }),
  card_count: Object.freeze({
    ru: "Вопросов: от {min} до {max}",
    kk: "Сұрақтар: {min} бастап {max} дейін",
    en: "Questions: from {min} to {max}",
  }),
  card_count_same: Object.freeze({
    ru: "Вопросов: {count}",
    kk: "Сұрақтар: {count}",
    en: "Questions: {count}",
  }),
  card_start: Object.freeze({
    ru: "Пройти опрос",
    kk: "Сауалнамадан өту",
    en: "Take the survey",
  }),
  card_continue: Object.freeze({
    ru: "Продолжить",
    kk: "Жалғастыру",
    en: "Continue",
  }),
  card_restart: Object.freeze({
    ru: "Начать заново",
    kk: "Қайтадан бастау",
    en: "Start over",
  }),
  card_changed: Object.freeze({
    ru: "Анкета изменилась. Начните, пожалуйста, заново.",
    kk: "Сауалнама өзгерді. Қайтадан бастаңыз.",
    en: "The questionnaire has changed. Please start again.",
  }),
  progress_label: Object.freeze({
    ru: "Вопрос {current} из {total}",
    kk: "{total} сұрақтың {current}-і",
    en: "Question {current} of {total}",
  }),
  progress_name: Object.freeze({
    ru: "Ход опроса",
    kk: "Сауалнама барысы",
    en: "Survey progress",
  }),
  quiz_next: Object.freeze({
    ru: "Далее",
    kk: "Әрі қарай",
    en: "Next",
  }),
  quiz_back: Object.freeze({
    ru: "Назад",
    kk: "Артқа",
    en: "Back",
  }),
  quiz_skip: Object.freeze({
    ru: "Пропустить",
    kk: "Өткізіп жіберу",
    en: "Skip",
  }),
  quiz_show_result: Object.freeze({
    ru: "Показать результат",
    kk: "Нәтижені көрсету",
    en: "Show the result",
  }),
  quiz_required: Object.freeze({
    ru: "Ответьте на этот вопрос, чтобы продолжить.",
    kk: "Жалғастыру үшін осы сұраққа жауап беріңіз.",
    en: "Answer this question to continue.",
  }),
  quiz_number_range: Object.freeze({
    ru: "Введите целое число от {min} до {max}.",
    kk: "{min} мен {max} арасындағы бүтін санды енгізіңіз.",
    en: "Enter a whole number from {min} to {max}.",
  }),
  quiz_number_hint: Object.freeze({
    ru: "От {min} до {max}",
    kk: "{min} бастап {max} дейін",
    en: "From {min} to {max}",
  }),
  quiz_loading: Object.freeze({
    ru: "Загружаем анкету",
    kk: "Сауалнама жүктелуде",
    en: "Loading the questionnaire",
  }),
  quiz_sending: Object.freeze({
    ru: "Подбираем решение",
    kk: "Шешім таңдалуда",
    en: "Picking a solution",
  }),
  net_lost_saved: Object.freeze({
    ru: "Нет связи. Ваши ответы сохранены. Попробуйте ещё раз.",
    kk: "Байланыс жоқ. Жауаптарыңыз сақталды. Қайталап көріңіз.",
    en: "No connection. Your answers are saved. Please try again.",
  }),
  net_lost_unsaved: Object.freeze({
    ru: "Нет связи. Не закрывайте страницу, ответы пока только здесь. Попробуйте ещё раз.",
    kk: "Байланыс жоқ. Бетті жаппаңыз, жауаптар әзірге тек осында. Қайталап көріңіз.",
    en: "No connection. Do not close the page, the answers are only here for now. Please try again.",
  }),
  net_retry: Object.freeze({
    ru: "Повторить",
    kk: "Қайталау",
    en: "Try again",
  }),
  result_soon: Object.freeze({
    ru: "Результат скоро появится на этой странице.",
    kk: "Нәтиже осы бетте жақында шығады.",
    en: "The result will appear on this page soon.",
  }),
});

// A value is right when it is exactly one of LANGUAGES.
function isLanguage(value) {
  return typeof value === "string" && LANGUAGES.includes(value);
}

// chooseLanguage({ query, stored, available }) -> "ru" | "kk" | "en". The first right
// value of the address, then of the stored choice, else the default; a language that
// the file does not have gives the default (the second value is not tried). Nothing
// else is read, so a header of the request has no effect. It never throws.
export function chooseLanguage(input = {}) {
  try {
    if (input === null || typeof input !== "object") return DEFAULT_LANGUAGE;
    const { query, stored, available } = input;
    let wanted = DEFAULT_LANGUAGE;
    if (isLanguage(query)) wanted = query;
    else if (isLanguage(stored)) wanted = stored;
    if (!Array.isArray(available) || !available.includes(wanted))
      return DEFAULT_LANGUAGE;
    return wanted;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
