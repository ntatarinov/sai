// The texts of the public pages, key → { ru, kk, en } (the code design of the public landing, 4.1;
// ARCH §17): data only. A page script sets every text by textContent in the language of the page;
// the static pages hold the ru value. A placeholder {name} is filled by the page. The keys with the
// prefix order_ are the order texts, which the public set of the build leaves out; no other key
// starts with it. Every value keeps the text rules of ../text-rules.js and the word lists of the
// lint in its language.
import { SOURCE_LANGS } from "./lang.js";

export const LANGS = SOURCE_LANGS;

export const TEXTS = Object.freeze({
  // The frame of every page: the skip link, the header bar, the test-mode strip and the footer.
  skip_link: Object.freeze({
    ru: "Перейти к основному содержанию",
    kk: "Басты мазмұнға өту",
    en: "Skip to main content",
  }),
  brand_name: Object.freeze({ ru: "Sai", kk: "Sai", en: "Sai" }),
  brand_tile: Object.freeze({ ru: "S", kk: "S", en: "S" }),
  lang_group: Object.freeze({ ru: "Язык", kk: "Тіл", en: "Language" }),
  lang_ru: Object.freeze({ ru: "RU", kk: "RU", en: "RU" }),
  lang_kk: Object.freeze({ ru: "ҚАЗ", kk: "ҚАЗ", en: "ҚАЗ" }),
  lang_en: Object.freeze({ ru: "EN", kk: "EN", en: "EN" }),
  theme_name: Object.freeze({ ru: "Тема", kk: "Тақырып", en: "Theme" }),
  theme_auto: Object.freeze({ ru: "Авто", kk: "Авто", en: "Auto" }),
  theme_light: Object.freeze({ ru: "Светлая", kk: "Ашық", en: "Light" }),
  theme_dark: Object.freeze({ ru: "Тёмная", kk: "Қараңғы", en: "Dark" }),
  test_mode: Object.freeze({
    ru: "Sai работает в тестовом режиме: вход по приглашению, заказы не принимаются.",
    kk: "Sai сынақ режимінде жұмыс істейді: кіру шақыру бойынша, тапсырыстар қабылданбайды.",
    en: "Sai is running in test mode: sign-in by invitation, orders are not accepted.",
  }),
  ai_disclosure: Object.freeze({
    ru: "Работу в Sai выполняют ИИ-агенты (искусственный интеллект). Их ответы могут быть неточными.",
    kk: "Sai-дағы жұмысты ЖИ-агенттер (жасанды интеллект) орындайды. Олардың жауаптары дәл болмауы мүмкін.",
    en: "The work in Sai is done by AI agents (artificial intelligence). Their answers may be inaccurate.",
  }),
  nav_landing: Object.freeze({ ru: "Главная", kk: "Басты бет", en: "Home" }),
  nav_how: Object.freeze({
    ru: "Как это работает",
    kk: "Бұл қалай жұмыс істейді",
    en: "How it works",
  }),
  nav_demo: Object.freeze({
    ru: "Демо-опрос",
    kk: "Демо-сауалнама",
    en: "Demo survey",
  }),
  to_landing: Object.freeze({
    ru: "На главную",
    kk: "Басты бетке",
    en: "Go to the home page",
  }),
  kk_note: Object.freeze({
    ru: "Перевод на казахский язык ещё проверяется и может быть неточным.",
    kk: "Қазақ тіліне аударма әлі тексерілуде және дәл болмауы мүмкін.",
    en: "The Kazakh translation is still being checked and may be inaccurate.",
  }),

  // The page titles.
  closed_test: Object.freeze({
    ru: "Sai — закрытое тестирование",
    kk: "Sai — жабық тестілеу",
    en: "Sai — closed testing",
  }),
  title_how: Object.freeze({
    ru: "Как это работает — Sai",
    kk: "Бұл қалай жұмыс істейді — Sai",
    en: "How it works — Sai",
  }),
  title_demo: Object.freeze({
    ru: "Демо-опрос — Sai",
    kk: "Демо-сауалнама — Sai",
    en: "Demo survey — Sai",
  }),
  title_404: Object.freeze({
    ru: "Страница не найдена — Sai",
    kk: "Бет табылмады — Sai",
    en: "Page not found — Sai",
  }),

  // The stage scene: the stage words and the role titles of the four desks, the door, «Вы», the
  // caption, the text list and the live lines.
  stage_1: Object.freeze({ ru: "Принято", kk: "Қабылданды", en: "Accepted" }),
  stage_2: Object.freeze({
    ru: "Готовим документацию",
    kk: "Құжаттама дайындалуда",
    en: "Preparing documentation",
  }),
  stage_3: Object.freeze({
    ru: "Готовим спецификацию",
    kk: "Спецификация дайындалуда",
    en: "Preparing specification",
  }),
  stage_4: Object.freeze({
    ru: "Готово к просмотру",
    kk: "Қарауға дайын",
    en: "Ready to view",
  }),
  role_1: Object.freeze({
    ru: "Руководитель проекта",
    kk: "Жоба жетекшісі",
    en: "Project manager",
  }),
  role_2: Object.freeze({ ru: "Аналитик", kk: "Талдаушы", en: "Analyst" }),
  role_3: Object.freeze({
    ru: "Разработчик",
    kk: "Әзірлеуші",
    en: "Developer",
  }),
  role_4: Object.freeze({ ru: "Проверяющий", kk: "Тексеруші", en: "Reviewer" }),
  you: Object.freeze({ ru: "Вы", kk: "Сіз", en: "You" }),
  scene_caption: Object.freeze({
    ru: "Картинка показывает этапы работы, а не движения людей.",
    kk: "Сурет адам қимылын емес, жұмыс кезеңдерін көрсетеді.",
    en: "The picture shows work stages, not people’s movements.",
  }),
  scene_alt: Object.freeze({
    ru: "Пиксельный офис Sai: дверь и четыре стола с этапами работы",
    kk: "Sai пиксельдік кеңсесі: есік және жұмыс кезеңдері бар төрт үстел",
    en: "Sai's pixel office: a door and four desks, one for each stage of work",
  }),
  door_tagline: Object.freeze({
    ru: "ИИ-команда",
    kk: "ЖИ-команда",
    en: "AI team",
  }),
  you_at_door: Object.freeze({
    ru: "Вы у двери",
    kk: "Сіз есік алдындасыз",
    en: "You are at the door",
  }),
  you_at_desk: Object.freeze({
    ru: "Вы у стола {n}: {stage}",
    kk: "Сіз {n}-үстелдің жанындасыз: {stage}",
    en: "You are at desk {n}: {stage}",
  }),
  desk_line: Object.freeze({
    ru: "{n} · {stage} — {role}",
    kk: "{n} · {stage} — {role}",
    en: "{n} · {stage} — {role}",
  }),
  live_answer: Object.freeze({
    ru: "Ответ принят: {option}",
    kk: "Жауап қабылданды: {option}",
    en: "Answer accepted: {option}",
  }),
  live_back: Object.freeze({
    ru: "Назад к вопросу {i}",
    kk: "{i}-сұраққа оралу",
    en: "Back to question {i}",
  }),
  live_result: Object.freeze({
    ru: "Результат готов: {kind}",
    kk: "Нәтиже дайын: {kind}",
    en: "Result ready: {kind}",
  }),
  live_desk: Object.freeze({
    ru: "Стол {n}: {stage}",
    kk: "{n}-үстел: {stage}",
    en: "Desk {n}: {stage}",
  }),

  // The landing: the hero and the four stages.
  landing_h1: Object.freeze({
    ru: "ИИ-команда для вашей идеи",
    kk: "Идеяңызға арналған ЖИ-команда",
    en: "An AI team for your idea",
  }),
  landing_pitch: Object.freeze({
    ru: "Вы описываете идею своими словами, а ИИ-агенты уточняют её, пишут ТЗ и после вашего одобрения собирают результат.",
    kk: "Идеяны өз сөзіңізбен сипаттайсыз, ал ЖИ-агенттер оны нақтылап, ТТ жазады және сіз мақұлдаған соң нәтижені құрастырады.",
    en: "You describe your idea in your own words. AI agents clarify it, write the requirements and, once you approve, build the result.",
  }),
  cta_demo: Object.freeze({
    ru: "Пройти демо-опрос",
    kk: "Демо-сауалнамадан өту",
    en: "Take the demo survey",
  }),
  cta_how: Object.freeze({
    ru: "Как это работает",
    kk: "Бұл қалай жұмыс істейді",
    en: "How it works",
  }),
  stages_title: Object.freeze({
    ru: "Четыре этапа работы",
    kk: "Жұмыстың төрт кезеңі",
    en: "Four stages of work",
  }),
  stage_1_sub: Object.freeze({
    ru: "Идея и короткий опрос",
    kk: "Идея және қысқа сауалнама",
    en: "Idea and a short interview",
  }),
  stage_2_sub: Object.freeze({
    ru: "Техническое задание и правки",
    kk: "Техникалық тапсырма мен түзетулер",
    en: "Requirements and edits",
  }),
  stage_3_sub: Object.freeze({
    ru: "Задачи и разработка по ТЗ",
    kk: "Тапсырмалар, ТТ бойынша әзірлеу",
    en: "Tasks and development based on the requirements",
  }),
  stage_4_sub: Object.freeze({
    ru: "Вы проверяете и принимаете работу",
    kk: "Сіз жұмысты тексеріп, қабылдайсыз",
    en: "You check and accept the work",
  }),

  // «How it works»: the intro, the text of each stage and the topic panels.
  how_eyebrow: Object.freeze({
    ru: "Как это работает",
    kk: "Бұл қалай жұмыс істейді",
    en: "How it works",
  }),
  how_h1: Object.freeze({
    ru: "От идеи до готового результата",
    kk: "Идеядан дайын нәтижеге дейін",
    en: "From an idea to a finished result",
  }),
  how_pitch: Object.freeze({
    ru: "Четыре этапа: идея, техническое задание, разработка и проверка. На каждом этапе видно, кто работает и что решаете вы.",
    kk: "Төрт кезең: идея, техникалық тапсырма, әзірлеу және тексеру. Әр кезеңде кім жұмыс істеп жатқаны және сіз нені шешетініңіз көрінеді.",
    en: "Four stages: the idea, the requirements, development and review. At each stage you can see who is working and what you decide.",
  }),
  how_stage_1_text: Object.freeze({
    ru: "Вы описываете идею своими словами. ИИ-аналитик задаёт уточняющие вопросы, пока задача не станет ясной.",
    kk: "Сіз идеяны өз сөзіңізбен сипаттайсыз. ЖИ-талдаушы міндет анық болғанша нақтылау сұрақтарын қояды.",
    en: "You describe your idea in your own words. The AI analyst asks clarifying questions until the task is clear.",
  }),
  how_stage_2_text: Object.freeze({
    ru: "По вашим ответам ИИ-аналитик пишет техническое задание. Вы читаете его, комментируете и правите, а когда всё верно, утверждаете.",
    kk: "Жауаптарыңыз бойынша ЖИ-талдаушы техникалық тапсырма жазады. Сіз оны оқып, пікір қалдырып, түзетесіз, ал бәрі дұрыс болғанда бекітесіз.",
    en: "Based on your answers, the AI analyst writes the requirements. You read them, comment on them and make edits, and when everything is right, you approve them.",
  }),
  how_stage_3_text: Object.freeze({
    ru: "Когда разработка запущена, руководитель проекта делит утверждённое ТЗ на задачи, а разработчик собирает по ним продукт.",
    kk: "Әзірлеу іске қосылғанда жоба жетекшісі бекітілген ТТ-ны тапсырмаларға бөледі, ал әзірлеуші солар бойынша өнімді құрастырады.",
    en: "Once development has started, the project manager splits the approved requirements into tasks. The developer builds the product from them.",
  }),
  how_stage_4_text: Object.freeze({
    ru: "Проверяющий сверяет работу с ТЗ. Затем вы открываете результат, проверяете его и принимаете или просите исправить.",
    kk: "Тексеруші жұмысты ТТ-мен салыстырады. Содан кейін сіз нәтижені ашып, тексересіз және қабылдайсыз немесе түзетуді сұрайсыз.",
    en: "The reviewer checks the work against the requirements. Then you open the result, check it and accept it or ask for fixes.",
  }),
  how_what_title: Object.freeze({
    ru: "Что такое Sai",
    kk: "Sai деген не",
    en: "What Sai is",
  }),
  how_what_text: Object.freeze({
    ru: "Sai — команда ИИ-агентов для бизнеса. Вы описываете идею, а агенты уточняют её, пишут техническое задание и собирают результат. Сейчас Sai работает в закрытом тестовом режиме.",
    kk: "Sai — бизнеске арналған ЖИ-агенттер командасы. Сіз идеяны сипаттайсыз, ал агенттер оны нақтылап, техникалық тапсырма жазады және нәтижені құрастырады. Қазір Sai жабық сынақ режимінде жұмыс істейді.",
    en: "Sai is a team of AI agents for business. You describe an idea, and the agents clarify it, write the requirements and build the result. Sai is currently running in closed test mode.",
  }),
  how_ai_title: Object.freeze({
    ru: "Что умеют ИИ-агенты и чего не умеют",
    kk: "ЖИ-агенттер не істей алады және не істей алмайды",
    en: "What AI agents can and cannot do",
  }),
  how_ai_text: Object.freeze({
    ru: "ИИ-агенты задают вопросы, пишут техническое задание и код, проверяют работу друг друга. Они не делают серверы, вход по паролю, приём оплаты и мобильные приложения. Агенты могут ошибаться, поэтому ТЗ утверждаете вы, и результат принимаете тоже вы.",
    kk: "ЖИ-агенттер сұрақтар қояды, техникалық тапсырма мен код жазады, бір-бірінің жұмысын тексереді. Олар серверлерді, құпиясөзбен кіруді, төлем қабылдауды және мобильді қосымшаларды жасамайды. Агенттер қателесуі мүмкін, сондықтан ТТ-ны сіз бекітесіз, нәтижені де сіз қабылдайсыз.",
    en: "AI agents ask questions, write the requirements and the code, and check each other’s work. They do not build servers, password sign-in, payment processing or mobile apps. Agents can make mistakes, so you approve the requirements and you are the one who accepts the result.",
  }),
  idea_title: Object.freeze({
    ru: "Как описать идею",
    kk: "Идеяны қалай сипаттау керек",
    en: "How to describe an idea",
  }),
  idea_text: Object.freeze({
    ru: "Напишите простыми словами, для кого это, что человек должен сделать и что увидеть в итоге. О технике не думайте: уточняющие вопросы задаст ИИ-аналитик.",
    kk: "Қарапайым сөздермен жазыңыз: бұл кімге арналған, адам не істеуі керек және соңында не көреді. Техникалық жағы туралы ойламаңыз: нақтылау сұрақтарын ЖИ-талдаушы қояды.",
    en: "Write in plain words who it is for. Say what a person needs to do and what they should see at the end. Do not worry about the technical side: the AI analyst will ask clarifying questions.",
  }),
  idea_example: Object.freeze({
    ru: "Пример хорошего описания: «Страница для моей студии йоги: расписание занятий, тренеры и запись по телефону».",
    kk: "Жақсы сипаттаманың мысалы: «Йога студиям үшін бет: сабақтар кестесі, жаттықтырушылар және телефон арқылы жазылу».",
    en: "Example of a good description: “A page for my yoga studio: class schedule, instructors and booking by phone.”",
  }),
  idea_invited: Object.freeze({
    ru: "В тестовом режиме идеи описывают только приглашённые участники.",
    kk: "Сынақ режимінде идеяларды тек шақырылған қатысушылар сипаттайды.",
    en: "In test mode, only invited participants describe ideas.",
  }),
  how_interview_title: Object.freeze({
    ru: "Как проходит опрос",
    kk: "Сауалнама қалай өтеді",
    en: "How the interview goes",
  }),
  how_interview_text: Object.freeze({
    ru: "ИИ-аналитик задаёт вопросы по вашей идее по одному. К каждому есть готовые ответы в одно нажатие, вариант «Не знаю» и поле для своего ответа. Опрос заканчивается, когда всё ясно, или раньше, если вы так решите.",
    kk: "ЖИ-талдаушы идеяңыз бойынша сұрақтарды бір-бірден қояды. Әр сұраққа бір басумен таңдалатын дайын жауаптар, «Білмеймін» нұсқасы және өз жауабыңызға арналған өріс бар. Сауалнама бәрі анық болғанда аяқталады, ал сіз шешсеңіз — одан ертерек.",
    en: "The AI analyst asks questions about your idea one at a time. Each question comes with ready-made answers you can choose with one tap. There is also a “Not sure” option and a field for your own answer. The interview ends when everything is clear, or earlier if you choose.",
  }),
  how_spec_title: Object.freeze({
    ru: "Как создаётся техническое задание",
    kk: "Техникалық тапсырма қалай жасалады",
    en: "How the requirements are written",
  }),
  how_spec_text: Object.freeze({
    ru: "По ответам ИИ-аналитик пишет первую версию ТЗ: цели, экраны, данные, ограничения и открытые вопросы. У каждого пункта видно, из какого ответа он взят, а догадки отмечены отдельно.",
    kk: "Жауаптар бойынша ЖИ-талдаушы ТТ-ның бірінші нұсқасын жазады: мақсаттар, экрандар, деректер, шектеулер және ашық сұрақтар. Әр тармақтың қай жауаптан алынғаны көрінеді, ал болжамдар бөлек белгіленеді.",
    en: "From the answers, the AI analyst writes the first version of the requirements. It covers goals, screens, data, constraints and open questions. Each item shows which answer it came from, and assumptions are marked separately.",
  }),
  how_fix_title: Object.freeze({
    ru: "Как проверить и исправить ТЗ",
    kk: "ТТ-ны қалай тексеріп, түзетуге болады",
    en: "How to check and fix the requirements",
  }),
  how_fix_text: Object.freeze({
    ru: "Прочитайте ТЗ, оставьте комментарий к любому разделу или исправьте текст сами. Каждая правка даёт новую версию с причиной изменения, и две версии можно сравнить рядом.",
    kk: "ТТ-ны оқып, кез келген бөлімге пікір қалдырыңыз немесе мәтінді өзіңіз түзетіңіз. Әр түзету өзгеріс себебі көрсетілген жаңа нұсқа береді, ал екі нұсқаны қатар салыстыруға болады.",
    en: "Read the requirements, leave a comment on any section or edit the text yourself. Each edit makes a new version with the reason for the change. Two versions can be compared side by side.",
  }),
  how_approve_title: Object.freeze({
    ru: "Как утвердить требования",
    kk: "Талаптарды қалай бекітуге болады",
    en: "How to approve the requirements",
  }),
  how_approve_text: Object.freeze({
    ru: "Когда ТЗ вас устраивает, вы утверждаете эту версию. Утверждённая версия больше не меняется: новая правка станет следующей версией и потребует нового утверждения.",
    kk: "ТТ сізді қанағаттандырғанда, осы нұсқаны бекітесіз. Бекітілген нұсқа енді өзгермейді: жаңа түзету келесі нұсқа болады және қайта бекітуді қажет етеді.",
    en: "When you are happy with the requirements, you approve this version. An approved version no longer changes: a new edit becomes the next version and needs approval again.",
  }),
  how_start_title: Object.freeze({
    ru: "Как запускается разработка",
    kk: "Әзірлеу қалай іске қосылады",
    en: "How development starts",
  }),
  how_start_text: Object.freeze({
    ru: "Разработка начинается только с утверждённого ТЗ. В тестовом режиме её запускает только владелец Sai и подтверждает запуск своим паролем.",
    kk: "Әзірлеу тек бекітілген ТТ бойынша басталады. Сынақ режимінде оны тек Sai иесі іске қосады және іске қосуды өз құпиясөзімен растайды.",
    en: "Development starts only from approved requirements. In test mode, only the owner of Sai starts it and confirms the start with a password.",
  }),
  how_office_title: Object.freeze({
    ru: "Для чего нужен пиксельный офис",
    kk: "Пиксельдік кеңсе не үшін қажет",
    en: "What the pixel office is for",
  }),
  how_office_text: Object.freeze({
    ru: "У каждого проекта есть свой закрытый пиксельный офис. Он показывает только настоящую работу агентов над этим проектом и открывается только тем, у кого есть доступ. Картинка на этой странице лишь показывает этапы работы.",
    kk: "Әр жобаның өз жабық пиксельдік кеңсесі бар. Ол агенттердің осы жоба бойынша нақты жұмысын ғана көрсетеді және тек рұқсаты барларға ашылады. Осы беттегі сурет тек жұмыс кезеңдерін көрсетеді.",
    en: "Each project has its own private pixel office. It shows only the agents’ real work on that project and opens only to people with access. The picture on this page only shows the stages of work.",
  }),
  how_result_title: Object.freeze({
    ru: "Как получить, проверить и принять результат",
    kk: "Нәтижені қалай алуға, тексеруге және қабылдауға болады",
    en: "How to get, check and accept the result",
  }),
  how_result_text: Object.freeze({
    ru: "Готовый результат открывается для просмотра в отдельной вкладке и скачивается архивом. Сверьте его с утверждённым ТЗ: если всё верно, примите работу, если нет, опишите, что исправить.",
    kk: "Дайын нәтиже бөлек қойындыда қарау үшін ашылады және мұрағат түрінде жүктеп алынады. Оны бекітілген ТТ-мен салыстырыңыз: бәрі дұрыс болса, жұмысты қабылдаңыз, болмаса, нені түзету керегін жазыңыз.",
    en: "The finished result opens for viewing in a separate tab and can be downloaded as an archive. Compare it with the approved requirements. If everything is right, accept the work; if not, describe what to fix.",
  }),

  // The demo survey: its states and messages, the live strip, the result and the «Описать идею»
  // panel.
  demo_loading: Object.freeze({
    ru: "Загружаем вопросы…",
    kk: "Сұрақтар жүктелуде…",
    en: "Loading the questions…",
  }),
  demo_error: Object.freeze({ ru: "Ошибка", kk: "Қате", en: "Error" }),
  demo_failed: Object.freeze({
    ru: "Не удалось загрузить данные",
    kk: "Деректерді жүктеу мүмкін болмады",
    en: "Could not load the data",
  }),
  demo_offline: Object.freeze({
    ru: "Нет связи с сервером",
    kk: "Сервермен байланыс жоқ",
    en: "No connection to the server",
  }),
  demo_what_now: Object.freeze({
    ru: "Попробуйте ещё раз или вернитесь на главную.",
    kk: "Қайталап көріңіз немесе басты бетке өтіңіз.",
    en: "Try again or go back to the home page.",
  }),
  demo_retry: Object.freeze({
    ru: "Повторить",
    kk: "Қайталау",
    en: "Try again",
  }),
  demo_question_of: Object.freeze({
    ru: "Вопрос {i} из {n}",
    kk: "Сұрақ {i} / {n}",
    en: "Question {i} of {n}",
  }),
  demo_back: Object.freeze({ ru: "Назад", kk: "Артқа", en: "Back" }),
  demo_unsure: Object.freeze({
    ru: "Не знаю",
    kk: "Білмеймін",
    en: "Not sure",
  }),
  demo_your_answers: Object.freeze({
    ru: "Ваши ответы",
    kk: "Жауаптар",
    en: "Your answers",
  }),
  demo_k_of_n: Object.freeze({
    ru: "{k} из {n}",
    kk: "{k} / {n}",
    en: "{k} of {n}",
  }),
  demo_start_hint: Object.freeze({
    ru: "Ответьте на вопрос — здесь появятся ваши ответы.",
    kk: "Сұраққа жауап беріңіз — жауаптарыңыз осында шығады.",
    en: "Answer a question — your answers will appear here.",
  }),
  demo_enough: Object.freeze({
    ru: "Хватит, к результату",
    kk: "Жеткілікті, нәтижеге өту",
    en: "That’s enough, show the result",
  }),
  demo_not_sure: Object.freeze({
    ru: "Не знаю",
    kk: "Білмеймін",
    en: "Not sure",
  }),
  demo_close: Object.freeze({ ru: "Закрыть", kk: "Жабу", en: "Close" }),
  demo_result_title: Object.freeze({
    ru: "Результат по вашим ответам",
    kk: "Жауаптарыңыз бойынша нәтиже",
    en: "Result based on your answers",
  }),
  demo_result_sub: Object.freeze({
    ru: "Любой ответ можно изменить одним нажатием.",
    kk: "Кез келген жауапты бір басумен өзгертуге болады.",
    en: "You can change any answer with one tap.",
  }),
  demo_receipt_head: Object.freeze({
    ru: "Sai · демо-опрос",
    kk: "Sai · демо-сауалнама",
    en: "Sai · demo survey",
  }),
  demo_fits: Object.freeze({
    ru: "Подходит",
    kk: "Сәйкес келеді",
    en: "Good fit",
  }),
  demo_accuracy: Object.freeze({
    ru: "Учтено ответов",
    kk: "Ескерілген жауаптар",
    en: "Answers counted",
  }),
  demo_also_fits: Object.freeze({
    ru: "Также подходит: {names}",
    kk: "Сондай-ақ сәйкес келеді: {names}",
    en: "Also a good fit: {names}",
  }),
  demo_putting: Object.freeze({
    ru: "Собираем результат…",
    kk: "Нәтиже дайындалуда…",
    en: "Putting the result together…",
  }),
  demo_includes: Object.freeze({
    ru: "Что входит",
    kk: "Не кіреді",
    en: "What it includes",
  }),
  demo_not_fit: Object.freeze({
    ru: "Лучше другое решение, если",
    kk: "Басқа шешім қажет болатын жағдайлар",
    en: "Another solution is better if",
  }),
  nobuild_title: Object.freeze({
    ru: "Чего Sai пока не делает",
    kk: "Sai әзірге не істемейді",
    en: "What Sai does not build yet",
  }),
  nobuild_1: Object.freeze({
    ru: "Серверы, API и базы данных",
    kk: "Серверлер, API және дерекқорлар",
    en: "Servers, APIs and databases",
  }),
  nobuild_2: Object.freeze({
    ru: "Вход по логину и паролю",
    kk: "Логин мен құпиясөз арқылы кіру",
    en: "Sign-in with a login and password",
  }),
  nobuild_3: Object.freeze({
    ru: "Приём оплаты",
    kk: "Төлем қабылдау",
    en: "Accepting payments",
  }),
  nobuild_4: Object.freeze({
    ru: "Настоящая отправка писем и сообщений в мессенджеры",
    kk: "Хаттар мен мессенджер хабарламаларын нақты жіберу",
    en: "Sending real emails and messenger messages",
  }),
  nobuild_5: Object.freeze({
    ru: "Связь с внешними системами учёта и CRM",
    kk: "Сыртқы есеп жүйелерімен және CRM-мен байланыс",
    en: "Connections to external accounting and CRM systems",
  }),
  nobuild_6: Object.freeze({
    ru: "Сбор данных с чужих сайтов",
    kk: "Бөгде сайттардан деректер жинау",
    en: "Collecting data from third-party websites",
  }),
  nobuild_7: Object.freeze({
    ru: "Расширения для браузера",
    kk: "Браузерге арналған кеңейтімдер",
    en: "Browser extensions",
  }),
  nobuild_8: Object.freeze({
    ru: "Мобильные приложения",
    kk: "Мобильді қосымшалар",
    en: "Mobile apps",
  }),
  nobuild_9: Object.freeze({
    ru: "То, что требует секретных ключей или паролей",
    kk: "Құпия кілт немесе құпиясөз қажет ететін нәрселер",
    en: "Anything that needs secret keys or passwords",
  }),
  nobuild_10: Object.freeze({
    ru: "То, что нарушает правила использования ИИ",
    kk: "ЖИ-ді пайдалану ережелерін бұзатын нәрселер",
    en: "Anything that breaks the rules for using AI",
  }),
  idea_panel_title: Object.freeze({
    ru: "Хотите описать свою идею?",
    kk: "Идеяңызды сипаттағыңыз келе ме?",
    en: "Would you like to describe your idea?",
  }),
  idea_panel_lead: Object.freeze({
    ru: "Сейчас идею описать в Sai нельзя: по кнопке откроется подсказка, как о ней рассказать.",
    kk: "Қазір Sai-да идеяны сипаттау мүмкін емес: түймені басқанда оны қалай айту керегі туралы кеңес ашылады.",
    en: "You cannot describe an idea in Sai yet: the button opens tips on how to describe it.",
  }),
  describe_idea: Object.freeze({
    ru: "Описать идею",
    kk: "Идеяны сипаттау",
    en: "Describe your idea",
  }),
  now_title: Object.freeze({
    ru: "Что работает сейчас",
    kk: "Қазір не жұмыс істейді",
    en: "What works now",
  }),
  now_demo_t: Object.freeze({
    ru: "Демо-опрос",
    kk: "Демо-сауалнама",
    en: "Demo survey",
  }),
  now_demo_s: Object.freeze({
    ru: "Пять вопросов и подсказка, какой вид продукта вам подойдёт.",
    kk: "Бес сұрақ және қандай өнім түрі сізге сәйкес келетіні туралы кеңес.",
    en: "Five questions and a hint at which kind of product fits you.",
  }),
  now_idea_t: Object.freeze({
    ru: "Опрос по вашей идее и ТЗ",
    kk: "Идеяңыз бойынша сауалнама және ТТ",
    en: "Survey on your idea and the requirements",
  }),
  now_idea_s: Object.freeze({
    ru: "ИИ-аналитик задаёт вопросы и пишет техническое задание (ТЗ).",
    kk: "ЖИ-талдаушы сұрақтар қояды және техникалық тапсырма (ТТ) жазады.",
    en: "The AI analyst asks questions and writes the requirements.",
  }),
  now_build_t: Object.freeze({
    ru: "Сборка и результат",
    kk: "Құрастыру және нәтиже",
    en: "Build and result",
  }),
  now_build_s: Object.freeze({
    ru: "Разработчик собирает продукт, вы принимаете работу.",
    kk: "Әзірлеуші өнімді құрастырады, сіз жұмысты қабылдайсыз.",
    en: "The developer builds the product and you accept the work.",
  }),
  stat_on: Object.freeze({
    ru: "Работает",
    kk: "Жұмыс істейді",
    en: "Working",
  }),
  stat_off: Object.freeze({
    ru: "Пока нет",
    kk: "Әзірге жоқ",
    en: "Not yet",
  }),
  now_closing: Object.freeze({
    ru: "Даты запуска пока нет. Описать идею смогут только приглашённые участники. Способа получить приглашение пока нет. Готовый продукт посетителям пока не выдаётся.",
    kk: "Іске қосу датасы әзірге жоқ. Идеяны тек шақырылған қатысушылар сипаттай алады. Шақыру алудың жолы әзірге жоқ. Дайын өнім келушілерге әзірге берілмейді.",
    en: "No launch date is set yet. Only invited participants will be able to describe an idea. There is no way to get an invitation yet. Finished products are not handed out to visitors yet.",
  }),
  how_plan_note: Object.freeze({
    ru: "Ниже описано, как работа будет устроена, когда этапы запустятся.",
    kk: "Төменде кезеңдер басталғанда жұмыс қалай өтетіні сипатталған.",
    en: "Below is how the work will go once the stages start.",
  }),
  how_stage_1_note: Object.freeze({
    ru: "Название этапа описывает будущий проект. Заказы сейчас не принимаются.",
    kk: "Кезеңнің атауы болашақ жобаны сипаттайды. Тапсырыстар қазір қабылданбайды.",
    en: "The stage name describes a future project. Orders are not accepted now.",
  }),
  demo_accuracy_note: Object.freeze({
    ru: "Чем больше ответов, тем надёжнее подсказка. «Не знаю» считается за половину.",
    kk: "Жауап неғұрлым көп болса, кеңес соғұрлым сенімді. «Білмеймін» жарты болып саналады.",
    en: "The more answers, the more reliable the hint. “Not sure” counts as half.",
  }),
  demo_needs_js: Object.freeze({
    ru: "Для демо-опроса нужен JavaScript",
    kk: "Демо-сауалнама үшін JavaScript қажет",
    en: "The demo survey needs JavaScript",
  }),
  demo_needs_js_text: Object.freeze({
    ru: "Включите JavaScript в браузере и обновите страницу.",
    kk: "Браузерде JavaScript-ті қосып, бетті жаңартыңыз.",
    en: "Turn on JavaScript in your browser and reload the page.",
  }),

  // The 404 page.
  notfound_title: Object.freeze({
    ru: "Страница не найдена",
    kk: "Бет табылмады",
    en: "Page not found",
  }),
  notfound_pitch: Object.freeze({
    ru: "Такой страницы нет. Проверьте адрес или вернитесь на главную.",
    kk: "Мұндай бет жоқ. Мекенжайды тексеріңіз немесе басты бетке өтіңіз.",
    en: "This page does not exist. Check the address or go back to the home page.",
  }),

  // The order texts (local only while gate G8 holds «б»): the landing block of what can be
  // ordered, the panel of «how it works», the footer link and the examples page with its two
  // lists and three example requests.
  order_landing_title: Object.freeze({
    ru: "Что можно заказать в Sai",
    kk: "Sai-да неге тапсырыс беруге болады",
    en: "What you can order from Sai",
  }),
  order_examples_link: Object.freeze({
    ru: "Посмотреть примеры запросов",
    kk: "Сұрау мысалдарын қарау",
    en: "See example requests",
  }),
  order_how_title: Object.freeze({
    ru: "Что можно заказать и какие услуги даёт Sai",
    kk: "Неге тапсырыс беруге болады және Sai қандай қызметтер көрсетеді",
    en: "What you can order and which services Sai offers",
  }),
  order_how_text: Object.freeze({
    ru: "Агенты Sai собирают небольшие веб-продукты, которые работают прямо в браузере. Это лендинги, сайты-визитки и портфолио, каталоги, калькуляторы и формы, простые панели и одностраничные приложения. Платформа ведёт всю работу: опрос, техническое задание, разработку, проверки и выдачу результата.",
    kk: "Sai агенттері тікелей браузерде жұмыс істейтін шағын веб-өнімдер құрастырады. Бұлар — лендингтер, визитка-сайттар мен портфолио, каталогтар, калькуляторлар мен формалар, қарапайым панельдер және бір беттік қосымшалар. Платформа бүкіл жұмысты жүргізеді: сауалнама, техникалық тапсырма, әзірлеу, тексерулер және нәтижені беру.",
    en: "Sai agents build small web products that run right in the browser. These are landing pages, business-card and portfolio sites, catalogs, calculators and forms, simple dashboards and single-page apps. The platform runs the whole job: the interview, the requirements, development, checks and delivery of the result.",
  }),
  order_nav_examples: Object.freeze({
    ru: "Примеры запросов",
    kk: "Сұрау мысалдары",
    en: "Example requests",
  }),
  order_title_examples: Object.freeze({
    ru: "Примеры запросов — Sai",
    kk: "Сұрау мысалдары — Sai",
    en: "Example requests — Sai",
  }),
  order_examples_h1: Object.freeze({
    ru: "Примеры запросов",
    kk: "Сұрау мысалдары",
    en: "Example requests",
  }),
  order_examples_pitch: Object.freeze({
    ru: "Что агенты Sai уже собирают и чего пока не делают. Ниже три примера запросов.",
    kk: "Sai агенттері қазір не құрастырады және әзірге не істемейді. Төменде үш сұрау мысалы берілген.",
    en: "What Sai agents already build and what they do not build yet. Below are three example requests.",
  }),
  order_example_label: Object.freeze({
    ru: "Пример запроса",
    kk: "Сұрау мысалы",
    en: "Example request",
  }),
  order_gets_label: Object.freeze({
    ru: "Что вы получите",
    kk: "Сіз не аласыз",
    en: "What you get",
  }),
  order_not_label: Object.freeze({
    ru: "Что не входит",
    kk: "Не кірмейді",
    en: "What is not included",
  }),
  order_can_title: Object.freeze({
    ru: "Что можно заказать",
    kk: "Неге тапсырыс беруге болады",
    en: "What you can order",
  }),
  order_can_1: Object.freeze({
    ru: "Лендинги — сайты из одной страницы",
    kk: "Лендингтер — бір беттен тұратын сайттар",
    en: "Landing pages — one-page websites",
  }),
  order_can_2: Object.freeze({
    ru: "Сайты-визитки и портфолио",
    kk: "Визитка-сайттар мен портфолио",
    en: "Business-card and portfolio sites",
  }),
  order_can_3: Object.freeze({
    ru: "Небольшие каталоги со встроенными данными",
    kk: "Деректері ішіне енгізілген шағын каталогтар",
    en: "Small catalogs with built-in data",
  }),
  order_can_4: Object.freeze({
    ru: "Калькуляторы, тесты и формы с результатом на экране или в браузере",
    kk: "Нәтижесі экранда немесе браузерде қалатын калькуляторлар, тесттер мен формалар",
    en: "Calculators, quizzes and forms whose result stays on the screen or in the browser",
  }),
  order_can_5: Object.freeze({
    ru: "Простые панели показателей на примерных данных",
    kk: "Үлгі деректердегі қарапайым көрсеткіштер панельдері",
    en: "Simple dashboards with sample data",
  }),
  order_can_6: Object.freeze({
    ru: "Небольшие одностраничные приложения",
    kk: "Шағын бір беттік қосымшалар",
    en: "Small single-page apps",
  }),
  order_cannot_title: Object.freeze({
    ru: "Что пока нельзя заказать",
    kk: "Әзірге неге тапсырыс беруге болмайды",
    en: "What you cannot order yet",
  }),
  order_cannot_1: Object.freeze({
    ru: "Серверы, API и базы данных",
    kk: "Серверлер, API және дерекқорлар",
    en: "Servers, APIs and databases",
  }),
  order_cannot_2: Object.freeze({
    ru: "Вход по паролю и приём оплаты",
    kk: "Құпиясөзбен кіру және төлем қабылдау",
    en: "Password sign-in and accepting payments",
  }),
  order_cannot_3: Object.freeze({
    ru: "Настоящая отправка писем и сообщений в мессенджеры",
    kk: "Хаттар мен мессенджер хабарламаларын нақты жіберу",
    en: "Sending real emails and messenger messages",
  }),
  order_cannot_4: Object.freeze({
    ru: "Мобильные приложения",
    kk: "Мобильді қосымшалар",
    en: "Mobile apps",
  }),
  order_cannot_5: Object.freeze({
    ru: "Связь с внешними системами учёта и CRM",
    kk: "Сыртқы есеп жүйелерімен және CRM-мен байланыс",
    en: "Connections to external accounting and CRM systems",
  }),
  order_example_1_kind: Object.freeze({
    ru: "Лендинг",
    kk: "Лендинг",
    en: "Landing page",
  }),
  order_example_1_request: Object.freeze({
    ru: "«Нужна одна страница для моего цветочного магазина: букеты, адрес и как с нами связаться.»",
    kk: "«Гүл дүкеніме бір бет керек: гүл шоқтары, мекенжай және бізбен байланысу жолы.»",
    en: "“I need one page for my flower shop: bouquets, the address and how to reach us.”",
  }),
  order_example_1_gets_1: Object.freeze({
    ru: "Одна страница с разделами о магазине",
    kk: "Дүкен туралы бөлімдері бар бір бет",
    en: "One page with sections about the shop",
  }),
  order_example_1_gets_2: Object.freeze({
    ru: "Галерея букетов с описаниями",
    kk: "Сипаттамалары бар гүл шоқтарының галереясы",
    en: "A gallery of bouquets with descriptions",
  }),
  order_example_1_gets_3: Object.freeze({
    ru: "Адрес и телефон для связи",
    kk: "Байланысуға арналған мекенжай мен телефон",
    en: "The address and a contact phone number",
  }),
  order_example_1_not_1: Object.freeze({
    ru: "Приём заказов и оплаты на сайте",
    kk: "Сайтта тапсырыстар мен төлем қабылдау",
    en: "Taking orders and payments on the site",
  }),
  order_example_1_not_2: Object.freeze({
    ru: "Отправка писем покупателям",
    kk: "Сатып алушыларға хат жіберу",
    en: "Sending emails to customers",
  }),
  order_example_2_kind: Object.freeze({
    ru: "Каталог",
    kk: "Каталог",
    en: "Catalog",
  }),
  order_example_2_request: Object.freeze({
    ru: "«Хочу каталог из полусотни товаров мастерской: с поиском по названию и фильтром по виду.»",
    kk: "«Шеберханамның елуге жуық тауарынан тұратын каталог керек: атауы бойынша іздеу және түрі бойынша сүзгі.»",
    en: "“I want a catalog of about fifty products from my workshop. It needs search by name and a filter by type.”",
  }),
  order_example_2_gets_1: Object.freeze({
    ru: "Страница каталога с карточками товаров",
    kk: "Тауар карточкалары бар каталог беті",
    en: "A catalog page with product cards",
  }),
  order_example_2_gets_2: Object.freeze({
    ru: "Поиск по названию",
    kk: "Атауы бойынша іздеу",
    en: "Search by name",
  }),
  order_example_2_gets_3: Object.freeze({
    ru: "Фильтр по виду товара",
    kk: "Тауар түрі бойынша сүзгі",
    en: "A filter by product type",
  }),
  order_example_2_not_1: Object.freeze({
    ru: "Корзина и оплата",
    kk: "Себет және төлем",
    en: "Cart and payment",
  }),
  order_example_2_not_2: Object.freeze({
    ru: "Связь со складской программой",
    kk: "Қойма бағдарламасымен байланыс",
    en: "Connection to warehouse software",
  }),
  order_example_3_kind: Object.freeze({
    ru: "Калькулятор",
    kk: "Калькулятор",
    en: "Calculator",
  }),
  order_example_3_request: Object.freeze({
    ru: "«Нужен калькулятор площади для ремонта: человек вводит размеры комнаты и сразу видит площадь стен и пола.»",
    kk: "«Жөндеуге арналған аудан калькуляторы керек: адам бөлменің өлшемдерін енгізіп, қабырға мен еденнің ауданын бірден көреді.»",
    en: "“I need a renovation area calculator: people enter room sizes and instantly see wall and floor area.”",
  }),
  order_example_3_gets_1: Object.freeze({
    ru: "Поля для размеров комнаты",
    kk: "Бөлме өлшемдеріне арналған өрістер",
    en: "Fields for room dimensions",
  }),
  order_example_3_gets_2: Object.freeze({
    ru: "Расчёт площади стен и пола",
    kk: "Қабырға мен еден ауданын есептеу",
    en: "Wall and floor area calculation",
  }),
  order_example_3_gets_3: Object.freeze({
    ru: "Результат остаётся на экране",
    kk: "Нәтиже экранда қалады",
    en: "The result stays on the screen",
  }),
  order_example_3_not_1: Object.freeze({
    ru: "Отправка расчёта на почту",
    kk: "Есептеуді электрондық поштаға жіберу",
    en: "Sending the calculation by email",
  }),
  order_example_3_not_2: Object.freeze({
    ru: "Сохранение расчётов на сервере",
    kk: "Есептеулерді серверде сақтау",
    en: "Saving calculations on a server",
  }),

  // The account pages (setup, login, reset, admin two-step sign-in): titles, headings, labels, buttons.
  auth_title_setup: Object.freeze({
    ru: "Первая настройка — Sai",
    kk: "Алғашқы баптау — Sai",
    en: "First setup — Sai",
  }),
  auth_title_login: Object.freeze({
    ru: "Вход — Sai",
    kk: "Кіру — Sai",
    en: "Sign in — Sai",
  }),
  auth_title_reset: Object.freeze({
    ru: "Новый пароль — Sai",
    kk: "Жаңа құпиясөз — Sai",
    en: "New password — Sai",
  }),
  auth_title_totp: Object.freeze({
    ru: "Двухфакторный вход — Sai",
    kk: "Екі факторлы кіру — Sai",
    en: "Two-step sign-in — Sai",
  }),
  auth_h_setup: Object.freeze({
    ru: "Первая настройка",
    kk: "Алғашқы баптау",
    en: "First setup",
  }),
  auth_h_login: Object.freeze({ ru: "Вход", kk: "Кіру", en: "Sign in" }),
  auth_h_reset: Object.freeze({
    ru: "Новый пароль",
    kk: "Жаңа құпиясөз",
    en: "New password",
  }),
  auth_h_totp: Object.freeze({
    ru: "Двухфакторный вход администратора",
    kk: "Әкімшінің екі факторлы кіруі",
    en: "Administrator two-step sign-in",
  }),
  auth_h_enrol: Object.freeze({ ru: "Включить", kk: "Қосу", en: "Turn on" }),
  auth_h_off: Object.freeze({ ru: "Отключить", kk: "Өшіру", en: "Turn off" }),
  auth_f_token: Object.freeze({
    ru: "Код установки",
    kk: "Орнату коды",
    en: "Setup code",
  }),
  auth_f_email: Object.freeze({
    ru: "Электронная почта",
    kk: "Электрондық пошта",
    en: "Email",
  }),
  auth_f_name: Object.freeze({ ru: "Имя", kk: "Аты", en: "Name" }),
  auth_f_password: Object.freeze({
    ru: "Пароль",
    kk: "Құпиясөз",
    en: "Password",
  }),
  auth_f_language: Object.freeze({ ru: "Язык", kk: "Тіл", en: "Language" }),
  auth_f_code: Object.freeze({
    ru: "Код из приложения или резервный код",
    kk: "Қолданбадағы код немесе қосалқы код",
    en: "Code from the app or a backup code",
  }),
  auth_f_code_next: Object.freeze({
    ru: "Следующий код из приложения или резервный код",
    kk: "Қолданбадағы келесі код немесе қосалқы код",
    en: "Next code from the app or a backup code",
  }),
  auth_f_new_password: Object.freeze({
    ru: "Новый пароль",
    kk: "Жаңа құпиясөз",
    en: "New password",
  }),
  auth_f_repeat: Object.freeze({
    ru: "Повторите новый пароль",
    kk: "Жаңа құпиясөзді қайталаңыз",
    en: "Repeat the new password",
  }),
  auth_label_error: Object.freeze({ ru: "Ошибка", kk: "Қате", en: "Error" }),
  auth_hint_password: Object.freeze({
    ru: "Не короче 10 символов. Простые и известные пароли не подходят.",
    kk: "Кемінде 10 таңба. Қарапайым және белгілі құпиясөздер жарамайды.",
    en: "At least 10 characters. Simple and well-known passwords are refused.",
  }),
  auth_b_setup: Object.freeze({
    ru: "Создать учётную запись",
    kk: "Тіркелгі жасау",
    en: "Create the account",
  }),
  auth_b_login: Object.freeze({ ru: "Войти", kk: "Кіру", en: "Sign in" }),
  auth_b_logout: Object.freeze({ ru: "Выйти", kk: "Шығу", en: "Sign out" }),
  auth_b_reset: Object.freeze({
    ru: "Сохранить пароль",
    kk: "Құпиясөзді сақтау",
    en: "Save the password",
  }),
  auth_b_start: Object.freeze({
    ru: "Начать подключение",
    kk: "Қосуды бастау",
    en: "Start setup",
  }),
  auth_b_check: Object.freeze({
    ru: "Проверить пароль",
    kk: "Құпиясөзді тексеру",
    en: "Check the password",
  }),
  auth_b_confirm: Object.freeze({
    ru: "Подтвердить код",
    kk: "Кодты растау",
    en: "Confirm the code",
  }),
  auth_b_off: Object.freeze({ ru: "Отключить", kk: "Өшіру", en: "Turn off" }),
  auth_done_setup: Object.freeze({
    ru: "Готово: учётная запись администратора создана.",
    kk: "Дайын: әкімші тіркелгісі жасалды.",
    en: "Done: the administrator account is created.",
  }),
  auth_done_reset: Object.freeze({
    ru: "Готово: новый пароль сохранён.",
    kk: "Дайын: жаңа құпиясөз сақталды.",
    en: "Done: the new password is saved.",
  }),
  auth_to_login: Object.freeze({
    ru: "Перейти ко входу",
    kk: "Кіруге өту",
    en: "Go to sign in",
  }),
  auth_signed_in: Object.freeze({
    ru: "Вы вошли как {name}.",
    kk: "Сіз {name} ретінде кірдіңіз.",
    en: "You are signed in as {name}.",
  }),
  auth_to_totp: Object.freeze({
    ru: "Двухфакторный вход",
    kk: "Екі факторлы кіру",
    en: "Two-step sign-in",
  }),
  auth_mismatch: Object.freeze({
    ru: "Пароли не совпадают.",
    kk: "Құпиясөздер сәйкес келмейді.",
    en: "The passwords do not match.",
  }),
  auth_totp_enrol_note: Object.freeze({
    ru: "Добавьте ключ или адрес в приложение-аутентификатор, затем введите код из приложения.",
    kk: "Кілтті немесе мекенжайды аутентификатор қолданбасына қосыңыз, содан кейін қолданбадағы кодты енгізіңіз.",
    en: "Add the key or the address to an authenticator app, then enter the code from the app.",
  }),
  auth_totp_secret: Object.freeze({
    ru: "Ключ для приложения",
    kk: "Қолданбаға арналған кілт",
    en: "Key for the app",
  }),
  auth_totp_link: Object.freeze({
    ru: "Адрес для приложения",
    kk: "Қолданбаға арналған мекенжай",
    en: "Address for the app",
  }),
  auth_totp_on: Object.freeze({
    ru: "Двухфакторный вход включён.",
    kk: "Екі факторлы кіру қосылды.",
    en: "Two-step sign-in is turned on.",
  }),
  auth_totp_off_done: Object.freeze({
    ru: "Двухфакторный вход отключён.",
    kk: "Екі факторлы кіру өшірілді.",
    en: "Two-step sign-in is turned off.",
  }),
  auth_totp_codes_h: Object.freeze({
    ru: "Резервные коды",
    kk: "Қосалқы кодтар",
    en: "Backup codes",
  }),
  auth_totp_save: Object.freeze({
    ru: "Сохраните эти коды сейчас: повторно они показаны не будут.",
    kk: "Бұл кодтарды қазір сақтаңыз: қайта көрсетілмейді.",
    en: "Save these codes now: they will not be shown again.",
  }),
  auth_totp_off_next: Object.freeze({
    ru: "Пароль принят. Введите следующий код из приложения или резервный код.",
    kk: "Құпиясөз қабылданды. Қолданбадағы келесі кодты немесе қосалқы кодты енгізіңіз.",
    en: "Password accepted. Enter the next code from the app or a backup code.",
  }),

  // Plain words for every code the account routes can answer (AUTH_CODES of the server).
  auth_err_not_found: Object.freeze({
    ru: "Страница не найдена.",
    kk: "Бет табылмады.",
    en: "Page not found.",
  }),
  auth_err_body_too_large: Object.freeze({
    ru: "Запрос слишком большой.",
    kk: "Сұраныс тым үлкен.",
    en: "The request is too large.",
  }),
  auth_err_site_closed: Object.freeze({
    ru: "Сервис временно остановлен владельцем.",
    kk: "Қызметті иесі уақытша тоқтатты.",
    en: "The service is paused by the owner.",
  }),
  auth_err_bad_json: Object.freeze({
    ru: "Запрос не удалось прочитать. Обновите страницу и повторите.",
    kk: "Сұранысты оқу мүмкін болмады. Бетті жаңартып, қайталаңыз.",
    en: "The request could not be read. Refresh the page and try again.",
  }),
  auth_err_bad_body: Object.freeze({
    ru: "Проверьте введённые данные: одно из полей заполнено неверно.",
    kk: "Енгізілген деректерді тексеріңіз: өрістердің бірі қате толтырылған.",
    en: "Check what you entered: one of the fields is wrong.",
  }),
  auth_err_server_error: Object.freeze({
    ru: "Что-то пошло не так на нашей стороне. Попробуйте позже.",
    kk: "Біздің жағымызда бірдеңе дұрыс болмады. Кейінірек қайталаңыз.",
    en: "Something went wrong on our side. Try again later.",
  }),
  auth_err_server_config: Object.freeze({
    ru: "Вход пока не настроен. Попробуйте позже.",
    kk: "Кіру әлі бапталмаған. Кейінірек қайталаңыз.",
    en: "Sign-in is not set up yet. Try again later.",
  }),
  auth_err_auth_required: Object.freeze({
    ru: "Нужно войти.",
    kk: "Алдымен кіру керек.",
    en: "You need to sign in.",
  }),
  auth_err_invalid_credentials: Object.freeze({
    ru: "Неверная почта или пароль.",
    kk: "Пошта немесе құпиясөз қате.",
    en: "The email or the password is wrong.",
  }),
  auth_err_totp_required: Object.freeze({
    ru: "Введите код из приложения или резервный код.",
    kk: "Қолданбадағы кодты немесе қосалқы кодты енгізіңіз.",
    en: "Enter the code from the app or a backup code.",
  }),
  auth_err_totp_invalid: Object.freeze({
    ru: "Код не подошёл. Введите другой.",
    kk: "Код сәйкес келмеді. Басқасын енгізіңіз.",
    en: "The code was not accepted. Enter another one.",
  }),
  auth_err_origin_refused: Object.freeze({
    ru: "Запрос отклонён. Откройте страницу заново.",
    kk: "Сұраныс қабылданбады. Бетті қайта ашыңыз.",
    en: "The request was refused. Open the page again.",
  }),
  auth_err_csrf_refused: Object.freeze({
    ru: "Сессия устарела. Обновите страницу и повторите.",
    kk: "Сессия ескірді. Бетті жаңартып, қайталаңыз.",
    en: "The session is out of date. Refresh the page and try again.",
  }),
  auth_err_reauth_required: Object.freeze({
    ru: "Подтвердите пароль ещё раз.",
    kk: "Құпиясөзді қайта растаңыз.",
    en: "Confirm the password again.",
  }),
  auth_err_unsupported_type: Object.freeze({
    ru: "Запрос отклонён. Обновите страницу и повторите.",
    kk: "Сұраныс қабылданбады. Бетті жаңартып, қайталаңыз.",
    en: "The request was refused. Refresh the page and try again.",
  }),
  auth_err_password_rules: Object.freeze({
    ru: "Пароль не подходит: он слишком короткий, слишком длинный или слишком известный.",
    kk: "Құпиясөз жарамайды: тым қысқа, тым ұзын немесе тым белгілі.",
    en: "The password is not accepted: too short, too long or too well known.",
  }),
  auth_err_unknown_purpose: Object.freeze({
    ru: "Это действие недоступно.",
    kk: "Бұл әрекет қолжетімсіз.",
    en: "This action is not available.",
  }),
  auth_err_reset_invalid: Object.freeze({
    ru: "Ссылка недействительна или уже использована. Попросите новую.",
    kk: "Сілтеме жарамсыз немесе қолданылып қойған. Жаңасын сұраңыз.",
    en: "The link is not valid or was already used. Ask for a new one.",
  }),
  auth_err_totp_state: Object.freeze({
    ru: "Сейчас это действие недоступно: проверьте, включён ли двухфакторный вход.",
    kk: "Қазір бұл әрекет қолжетімсіз: екі факторлы кіру қосулы ма, тексеріңіз.",
    en: "This action is not available now: check whether two-step sign-in is on.",
  }),
  auth_err_locked: Object.freeze({
    ru: "Слишком много неудачных попыток. Попробуйте позже.",
    kk: "Сәтсіз әрекеттер тым көп. Кейінірек қайталаңыз.",
    en: "Too many failed attempts. Try again later.",
  }),
  auth_err_reauth_locked: Object.freeze({
    ru: "Слишком много неудачных проверок пароля. Попробуйте позже.",
    kk: "Құпиясөзді сәтсіз тексеру тым көп. Кейінірек қайталаңыз.",
    en: "Too many failed password checks. Try again later.",
  }),
  auth_err_rate_limited: Object.freeze({
    ru: "Слишком много запросов. Попробуйте позже.",
    kk: "Сұраныстар тым көп. Кейінірек қайталаңыз.",
    en: "Too many requests. Try again later.",
  }),
  auth_err_db_unavailable: Object.freeze({
    ru: "Сервис сейчас недоступен. Попробуйте позже.",
    kk: "Қызмет қазір қолжетімсіз. Кейінірек қайталаңыз.",
    en: "The service is unavailable now. Try again later.",
  }),
});
