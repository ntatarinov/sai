// GD, GR, TU, HN: the guide "Как пользоваться", the sections about the team,
// the invitation and the tour, the hints "?" and the empty states of Pixel
// Office (REQ-050…REQ-053; design docs/design/REQ-050-053-guide.md, section
// 7). The page runs on the fake DOM of the helpers; the texts of the
// requirements are literals here, not read from the constants under test.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mock, test } from "node:test";
import * as TX from "../src/pixel-office/public/texts.js";
import {
  escapeTarget,
  guideSections,
  roleTableProblems,
  tourStepView,
  within,
} from "../src/pixel-office/public/guide-model.js";
import { renderGuideSections } from "../src/pixel-office/public/guide.js";
import { HINT_KEYS } from "../src/pixel-office/public/hints.js";
import {
  FakeDocument,
  PUBLIC,
  T0,
  agentFiles,
  cssCascade,
  cssValue,
  fakeStorage,
  indexHtml,
  lineAt,
  makePage,
  parseCss,
  setPanelRects,
} from "./pixel-office-helpers.js";

// Table 1 of the description of REQ-050 in docs/requirements.yaml, word for word
// (the outer quotes «…» are not part of a text).
const T1 = {
  GUIDE_OPEN: "Как пользоваться",
  GUIDE_MARK: "?",
  GUIDE_TITLE: "Как пользоваться Pixel Office",
  GUIDE_CLOSE_TEXT: "Закрыть",
  GUIDE_CLOSE: "Закрыть справку",
  GUIDE_LEAD:
    "Коротко: что видно на странице и как её читать. Нажмите на название раздела, чтобы перейти к нему.",
  GUIDE_TOC: "Разделы",
  GUIDE_SECTIONS: [
    {
      key: "page",
      title: "Что это за страница",
      blocks: [
        {
          kind: "p",
          text: "Pixel Office показывает, что делает команда ИИ-агентов Sai. Здесь видно, кто сейчас работает, над какой задачей и что уже произошло.",
        },
        {
          kind: "p",
          text: "Страница только показывает. Она ничего не запускает, не останавливает и не меняет. Цель команде вы пишете в разговоре с Claude Code, открытом в папке sai/.",
        },
        {
          kind: "p",
          text: "Всё на странице строится из событий, которые присылает Claude Code. Страница не придумывает событий. Сомнительная строка помечена словами «не подтверждена» и ни на что не влияет.",
        },
        {
          kind: "p",
          text: "Новое событие появляется в течение 5 секунд, обновлять страницу не нужно. Видны только разговоры, открытые в папке sai/. Страница открывается только на этом компьютере.",
        },
      ],
    },
    {
      key: "office",
      title: "Офис",
      blocks: [
        {
          kind: "p",
          text: "Офис — комнаты со столами и персонажами. У каждой роли, которой дали задачу, есть свой стол и персонаж. Стол «Основная сессия» — это ваш разговор с Claude Code.",
        },
        {
          kind: "p",
          text: "Цвет — это роль, а не состояние. Стол и персонаж одной роли — одного цвета. Экран ноутбука светится, пока у роли есть задача «в работе».",
        },
        {
          kind: "p",
          text: "Персонаж идёт к чужому столу в двух случаях. Первый: он передаёт задание другому агенту. Второй: агент закончил работу и несёт ответ тому, кто его запустил.",
        },
        {
          kind: "p",
          text: "О других встречах агентов Claude Code не сообщает, поэтому в офисе их нет.",
        },
        {
          kind: "p",
          text: "Облачко над персонажем называет последнее событие, например «Только что получил задачу» или «Вернул ответ».",
        },
        {
          kind: "p",
          text: "На доске в переговорной — до трёх ролей с задачами в открытых сейчас разговорах. Остальные роли собраны в метку +N.",
        },
        {
          kind: "p",
          text: "У каждой роли на доске четыре числа задач: жёлтое — «в работе», зелёное — «закончила работу, итог не записан». Красное — «окончание не записано», серое — «сервер перезапускался, события не записывались». Кухня и серверная — только обстановка.",
        },
        {
          kind: "p",
          text: "Под офисом — легенда: кнопка на каждую роль со словом «работает» или «свободен». У основной сессии — «свободна». Нажмите на кнопку легенды, персонажа, стол или подпись — откроется карточка роли.",
        },
        {
          kind: "p",
          text: "Кнопки «Пауза», «1×», «2×» и «4×» в шапке управляют только ходьбой персонажей. Журнал и «Задачи» при паузе обновляются как обычно.",
        },
      ],
    },
    {
      key: "now",
      title: "Сейчас",
      blocks: [
        {
          kind: "p",
          text: "Блок «Сейчас» в шапке — строка на каждого, кто сейчас «в работе»: название роли и задача. Строка «Основная сессия — обрабатывает запрос» значит: разговор с Claude Code отвечает на сообщение.",
        },
        {
          kind: "p",
          text: "Рядом — «в работе: N». Если строки не помещаются, нажмите «Показать всех (N)». Закрыть список — «Скрыть» или Escape.",
        },
        {
          kind: "p",
          text: "Когда работы нет, блок пишет «в работе ничего нет». Слова «без свежих данных: N» значат: о части задач давно нет событий. Это не конец работы и не ошибка.",
        },
      ],
    },
    {
      key: "journal",
      title: "Журнал",
      blocks: [
        {
          kind: "p",
          text: "Журнал — все события от Claude Code, по строке на событие. Новые строки — внизу. Время — по часам этого компьютера.",
        },
        {
          kind: "p",
          text: "Нажмите на строку — откроются подробности. С клавиатуры: выберите строку клавишей Tab и нажмите Enter. Главное в подробностях — «Что произошло» и «Чего это не доказывает».",
        },
        {
          kind: "p",
          text: "«Чего это не доказывает» — о чём событие молчит. Например, «Агент закончил работу и вернул ответ» не значит, что задание сделано верно.",
        },
        {
          kind: "p",
          text: "Пометка «не подтверждена» значит: Pixel Office не признал строку настоящим событием. На работу она не влияет.",
        },
        {
          kind: "p",
          text: "Кнопки «Всё», «Работа» и «Офис» сужают список. «Работа» — сообщения, ответы и работа агентов. «Офис» — события, от которых персонажи пошли по офису.",
        },
        {
          kind: "p",
          text: "Поле «Поиск в журнале» ищет по словам строк, названиям ролей и описаниям задач. Кнопка «Фильтры» открывает выбор «Сессия», «Агент» и «Тип события». Кнопка «Сбросить фильтры» снимает всё, что вы выбрали.",
        },
        {
          kind: "p",
          text: "Над строками — «N из M»: показано N строк из M подходящих. Сначала видны последние 200; кнопка «Показать более ранние» добавляет ещё.",
        },
        {
          kind: "p",
          text: "Чтобы увидеть все события одной задачи, откройте её строку и нажмите «события этой задачи». Другие переходы в подробностях — «открыть агента», «к задаче в панели» и «открыть историю запроса».",
        },
      ],
    },
    {
      key: "tasks",
      title: "Задачи",
      blocks: [
        {
          kind: "p",
          text: "Панель «Задачи» — список работы. Элемент — одна задача: работа одного агента или один ваш запрос к основной сессии. Разделы панели — «Текущие», «История» и «Запуски сервера».",
        },
        {
          kind: "p",
          text: "У элемента — название роли, описание задачи, время и слово состояния. Описание пишет тот, кто передал задание.",
        },
        {
          kind: "p",
          text: "В «Запуски сервера» видно, когда запускался сервер Pixel Office. Пока он не работал, события не записывались.",
        },
        {
          kind: "p",
          text: "Кнопка «агент» открывает карточку. Кнопка «открыть историю запроса» показывает весь ваш запрос и всю работу по нему. В панели — последние 300 элементов.",
        },
        {
          kind: "p",
          text: "События одной задачи: нажмите «агент», а в карточке — «события в журнале».",
        },
      ],
    },
    {
      key: "cards",
      title: "Карточки агентов",
      blocks: [
        {
          kind: "p",
          text: "Карточка роли открывается нажатием на персонажа, его стол, подпись или кнопку легенды. Сразу видно, кто это, и строки «Задача», «Агент» и «Рабочее место»: состояние и на чём оно основано.",
        },
        {
          kind: "p",
          text: "Ниже — раскрытия с подробностями: «Кто запустил», «Кого запустил», «Все запуски этой роли». Кнопки «к задаче в панели» и «события в журнале» закрывают карточку и ведут к задаче и её событиям.",
        },
        {
          kind: "p",
          text: "Карточка «Основная сессия» показывает один запрос: когда он пришёл и в каком он состоянии. В ней же видно, кого основная сессия запустила в этом запросе. Закрыть карточку — кнопкой × или Escape.",
        },
      ],
    },
    {
      key: "history",
      title: "Окно «Просмотр истории»",
      blocks: [
        {
          kind: "p",
          text: "Окно «Просмотр истории» собирает всё об одном вашем запросе. В нём разделы «Исходный запрос», «Как оркестратор понял», «Кто работал и что сделал» и «Хронология».",
        },
        {
          kind: "p",
          text: "Текст запроса виден, только если его хранение включено. Иначе в окне — «текст не сохраняется». Ответов агентов в окне нет: их текст Pixel Office не хранит.",
        },
        {
          kind: "p",
          text: "Окно открывается кнопкой «открыть историю запроса» в журнале или в панели «Задачи». Закрыть — «Закрыть» или Escape.",
        },
      ],
    },
    {
      key: "states",
      title: "Цвета и состояния",
      blocks: [
        {
          kind: "p",
          text: "У задачи одно из пяти состояний:",
        },
        {
          kind: "ul",
          items: [
            "«в работе» (жёлтое) — по задаче приходят свежие события.",
            "«нет свежих данных» (серое) — событий нет дольше 60 минут. Это не конец и не ошибка.",
            "«закончила работу, итог не записан» (зелёное) — агент вернул ответ. Текст ответа страница не хранит, поэтому итог не записан. Удалась ли работа, страница не знает.",
            "«окончание не записано» (красноватое) — разговор закрылся или пришёл новый запрос, а сообщения о конце работы не было.",
            "«сервер перезапускался, события не записывались» (серое) — после начала задачи сервер Pixel Office запускали заново. Агент при этом мог работать дальше.",
          ],
        },
        {
          kind: "p",
          text: "Точка в шапке зелёная — «на связи»: страница получает события. Красная — «Нет связи с сервером Pixel Office». Страница показывает загруженное и догрузит пропущенное, когда связь вернётся. Серая — ответа сервера ещё не было.",
        },
        {
          kind: "p",
          text: "Цвет стола, персонажа и квадрата в легенде — это роль. Квадрат серый, когда роль свободна.",
        },
      ],
    },
    {
      key: "keys",
      title: "Клавиши",
      blocks: [
        {
          kind: "ul",
          items: [
            "Tab и Shift+Tab — перейти к следующей или предыдущей кнопке, полю или строке. Выбранный клавишей Tab элемент обведён рамкой.",
            "Enter или пробел — нажать кнопку, открыть строку журнала или карточку роли.",
            "Стрелки — выбрать вариант в списках «Сессия», «Агент», «Тип события» и листать списки.",
            "Escape — закрыть то, что открыто: окно истории, карточку, список «Показать всех (N)», справку или подробности строки. Одно нажатие закрывает одно.",
          ],
        },
        {
          kind: "p",
          text: "Своих клавиш-сокращений у страницы нет.",
        },
      ],
    },
    {
      key: "limits",
      title: "Чего страница не показывает",
      blocks: [
        {
          kind: "ul",
          items: [
            "Что агент написал в ответе: текст ответа не хранится.",
            "Что агент делает внутри: чтение файлов, команды, правки. Claude Code об этом не сообщает.",
            "Разговоры агентов между собой. Известны только передачи задания и окончания работы.",
            "Ошибки и то, что агент ждёт человека. Claude Code сейчас об этом не сообщает. Если команде нужно ваше решение, оркестратор спросит вас в разговоре с Claude Code.",
            "Разговоры из других папок и всё, что было, пока сервер Pixel Office не работал.",
            "Сколько работы осталось. Полоски хода нет: журнал этого не знает.",
          ],
        },
      ],
    },
  ],
};

// Table 2 of the description of REQ-051 in docs/requirements.yaml, word for word
// (the outer quotes «…» are not part of a text).
const T2 = {
  GUIDE_TEAM: {
    key: "team",
    title: "Как работать с командой агентов",
    blocks: [
      {
        kind: "ol",
        items: [
          "Цель — словами. Откройте Claude Code в папке sai/ и напишите, что нужно, как коллеге. Pixel Office для этого не нужен.",
          "Оркестратор разбивает цель на шаги. Он выбирает, как идти к цели, и раздаёт шаги ролям. На странице это строки «Задание передано агенту».",
          "Роли делают и проверяют друг друга. У каждой работы есть проверяющая роль. Например, код проверяют «Проверка безопасности» и «Ревью кода». Без согласия проверяющего работа дальше не идёт.",
          "Где нужно ваше решение. Некоторые решения может принять только владелец. Например, разрешить выпуск сделанных изменений или отступить от обязательных правил проверки. Тогда оркестратор спрашивает вас в разговоре с Claude Code. Pixel Office этих вопросов не показывает.",
          "Как следить. «Сейчас» — кто занят. Журнал — что произошло. «Задачи» — список работы. Итог работы оркестратор пишет в разговоре с Claude Code.",
        ],
      },
    ],
  },
  GUIDE_ROLES: {
    key: "roles",
    title: "Роли команды",
    lead: "Ниже — все роли команды Sai: название, как на странице, и что роль делает. Роль появляется в офисе, когда ей дали задачу. Роль не из этого списка страница показывает так, как её назвал Claude Code.",
    groups: [
      {
        title: "Ведение работы",
        codes: ["ORCH", "DOC-UPDATER"],
      },
      {
        title: "Требования",
        codes: ["REQ-ANALYST", "REQ-VALIDATOR"],
      },
      {
        title: "Проект и интерфейс",
        codes: [
          "CODE-DESIGNER",
          "CODE-DESIGN-VALIDATOR",
          "GUI-DESIGN-ANALYST",
          "DESIGN-QA-VALIDATOR",
        ],
      },
      {
        title: "Код",
        codes: [
          "BACKEND-DEV",
          "FRONTEND-DEV",
          "CODE-FIXER",
          "SECURITY-REVIEWER",
          "REVIEWER",
          "ISSUE-FIXER",
        ],
      },
      {
        title: "Тесты и приёмка",
        codes: [
          "TEST-DESIGNER",
          "TEST-DESIGN-VALIDATOR",
          "TEST-RUNNER",
          "TEST-FIXER",
          "BA-ANALYST",
          "UAT-RUNNER",
          "RELEASE-VALIDATOR",
          "RELEASE-FINALIZER",
        ],
      },
      {
        title: "Аудит",
        codes: [
          "AUDIT-SCOUT",
          "AUDIT-PLANNER",
          "ARCHITECTURE-AUDITOR",
          "COVERAGE-AUDITOR",
          "DEPENDENCY-AUDITOR",
          "DOC-AUDITOR",
          "SECURITY-AUDITOR",
          "AUDIT-COMPILER",
          "AUDIT-TRIAGE",
        ],
      },
      {
        title: "Идеи и бизнес-план",
        codes: [
          "IDEA-ANALYST",
          "IDEA-JUDGE",
          "VERDICT-EXECUTOR",
          "MARKET-RESEARCHER",
          "PLAN-WRITER",
          "PLAN-VALIDATOR",
        ],
      },
    ],
  },
  GUIDE_ROLE_ABOUT: {
    ORCH: "Принимает вашу цель и раздаёт шаги ролям. Следит за проверками и отчитывается вам.",
    "DOC-UPDATER":
      "Ведёт учёт: отмечает, что сделано, обновляет документы и записывает ошибки в работе команды.",
    "REQ-ANALYST":
      "Записывает вашу просьбу как требование: что должно получиться и как это проверить.",
    "REQ-VALIDATOR":
      "Проверяет требование: можно ли проверить каждое условие. Без его согласия работа не начинается.",
    "CODE-DESIGNER":
      "До начала программирования описывает, как будет устроен код и чем его проверят.",
    "CODE-DESIGN-VALIDATOR":
      "Проверяет этот план до начала программирования: всё ли учтено и понятно ли, что строить.",
    "GUI-DESIGN-ANALYST":
      "Подробно описывает экран: что где стоит, какие тексты и что происходит при нажатиях.",
    "DESIGN-QA-VALIDATOR":
      "Открывает собранную страницу и сравнивает её с утверждённым описанием экрана.",
    "BACKEND-DEV":
      "Пишет код, который работает на сервере, и служебные команды.",
    "FRONTEND-DEV":
      "Строит страницы, в том числе эту, по проверенному плану и описанию экрана.",
    "CODE-FIXER":
      "Исправляет код по замечаниям проверяющих и исправляет найденные ошибки.",
    "SECURITY-REVIEWER":
      "Проверяет новый код: нет ли в нём паролей и ключей, утечек данных и опасного ввода.",
    REVIEWER:
      "Смотрит, настоящее ли это решение и нет ли лишней работы. Ревью — это проверка кода другим участником.",
    "ISSUE-FIXER":
      "Повторяет ошибку и находит её причину. Сам ничего не исправляет.",
    "TEST-DESIGNER":
      "Пишет тесты: на каждое условие требования — своя проверка.",
    "TEST-DESIGN-VALIDATOR":
      "Проверяет, что тесты настоящие и действительно ловят ошибки.",
    "TEST-RUNNER": "Запускает все проверки и разбирает каждую неудачу.",
    "TEST-FIXER":
      "Разбирает неудачную проверку и исправляет то, что неверно, ничего не удаляя.",
    "BA-ANALYST":
      "Описывает языком владельца, как проверить работу на деле, и подписывает итог такой проверки.",
    "UAT-RUNNER":
      "Проверяет работу на запущенной системе по этим описаниям и записывает, что получилось.",
    "RELEASE-VALIDATOR":
      "Последняя проверка перед выпуском: сам заново проверяет каждое условие, не доверяя чужим отчётам.",
    "RELEASE-FINALIZER":
      "Сохраняет изменения и пишет отчёт о выпуске. Изменения выпускаются только после вашего подтверждения.",
    "AUDIT-SCOUT":
      "Решает, какие части проекта проверить в очередном аудите и на что смотреть.",
    "AUDIT-PLANNER":
      "Составляет план аудита: какую часть с какой стороны проверять.",
    "ARCHITECTURE-AUDITOR":
      "Проверяет, как устроен код: соблюдены ли принятые решения и нет ли лишнего кода.",
    "COVERAGE-AUDITOR":
      "Ищет условия требований и исправленные ошибки, которые не проверены тестами.",
    "DEPENDENCY-AUDITOR":
      "Проверяет чужие программные части, которые использует проект: версии, известные дыры в защите и условия использования.",
    "DOC-AUDITOR":
      "Проверяет, что документы совпадают с тем, что сделано на самом деле.",
    "SECURITY-AUDITOR":
      "Ищет в проекте пароли и ключи, опасный ввод и выдуманные события.",
    "AUDIT-COMPILER":
      "Собирает находки аудита, сам перепроверяет важные и пишет итог для владельца.",
    "AUDIT-TRIAGE":
      "Заводит записи об ошибках по подтверждённым находкам аудита, без повторов.",
    "IDEA-ANALYST":
      "Оценивает идеи с одной стороны: рынок, исполнение или подходит ли идея владельцу.",
    "IDEA-JUDGE":
      "Выбирает идею по оценкам аналитиков. Это совет: решает владелец.",
    "VERDICT-EXECUTOR":
      "Перепроверяет итоговый выбор идеи и записывает его как совет или возвращает на пересмотр.",
    "MARKET-RESEARCHER":
      "Ищет в интернете факты о рынке, ценах и конкурентах. У каждого факта — ссылка и дата.",
    "PLAN-WRITER":
      "Пишет бизнес-план только по проверенным фактам. У каждого числа — источник или пометка, что это допущение.",
    "PLAN-VALIDATOR":
      "Сам открывает источники и проверяет каждое число исследования или плана.",
  },
  GUIDE_GLOSSARY: {
    key: "glossary",
    title: "Словарь",
    pairs: [
      [
        "Агент",
        "Программа с искусственным интеллектом (ИИ), которая делает одну часть работы. У каждого агента есть роль.",
      ],
      [
        "Роль",
        "Чем занимается агент, например «Проверка безопасности». Название роли одно на всей странице.",
      ],
      [
        "Задача",
        "Одна часть работы: один запуск агента или один запрос основной сессии. В панели «Задачи» — по элементу на каждую.",
      ],
      [
        "Запрос",
        "Ваше сообщение в разговоре с Claude Code. По одному запросу может быть много задач.",
      ],
      [
        "Запуск",
        "Один запуск агента со своим номером. У одной роли может быть много запусков.",
      ],
      [
        "Номер запуска, номер разговора",
        "Первые 8 знаков длинного номера. В карточке это выглядит так: номер запуска 3f2a9c1b. Номер отличает один запуск или разговор от другого.",
      ],
      [
        "Разговор (сессия)",
        "Один разговор с Claude Code. «Основная сессия» — разговор, в котором вы пишете цель.",
      ],
      [
        "Оркестратор",
        "Главная роль команды. Принимает цель, раздаёт шаги ролям и следит за проверками.",
      ],
      [
        "Журнал",
        "Список событий от Claude Code по порядку, с настоящим временем.",
      ],
      [
        "Событие",
        "Одно сообщение от Claude Code о том, что произошло. Например, агент вернул ответ.",
      ],
      [
        "Ворота проверок",
        "Шаг, на котором проверяющая роль решает, может ли работа идти дальше.",
      ],
      [
        "Планка качества",
        "Минимум качества, ниже которого работа не опускается. Исключение может дать только владелец.",
      ],
      [
        "Claude Code",
        "Программа, в которой работают агенты Sai. Pixel Office получает события от неё.",
      ],
      [
        "Сервер Pixel Office",
        "Программа на этом компьютере. Она собирает события и показывает эту страницу.",
      ],
      [
        "Требование",
        "Запись того, что должно получиться, и условий, по которым это проверяют.",
      ],
      ["Код", "Текст программы. Из него собраны Sai и эта страница."],
      [
        "Тест",
        "Программа-проверка: она сама проверяет, что код делает то, что нужно.",
      ],
      ["Аудит", "Плановая проверка всего проекта по частям."],
    ],
  },
};

// Table 3 of the description of REQ-052 in docs/requirements.yaml, word for word
// (the outer quotes «…» are not part of a text).
const T3 = {
  TOUR_INVITE_LABEL: "Приглашение в тур",
  TOUR_INVITE: "Впервые здесь? Покажу за минуту, что где.",
  TOUR_INVITE_SHOW: "Показать",
  TOUR_INVITE_LATER: "Не сейчас",
  TOUR_STEP: "Шаг {n} из {N}",
  TOUR_NEXT: "Далее",
  TOUR_BACK: "Назад",
  TOUR_SKIP: "Пропустить",
  TOUR_LAST: "Закрыть тур",
  TOUR_CLOSE: "Закрыть тур",
  GUIDE_TOUR_START: "Показать тур по странице",
  KEYS_TOUR: "Escape закрывает и тур по странице — на любом шаге.",
  TOUR_STEPS: [
    {
      title: "Это Pixel Office",
      text: "Здесь видно, что делает команда ИИ-агентов Sai. Страница только показывает и ничего не запускает. Что нужно сделать, вы пишете в Claude Code. Подробнее — в справке «Как пользоваться».",
      fallback: null,
    },
    {
      title: "Офис",
      text: "У каждой роли с задачей — стол и персонаж своего цвета. Стол «Основная сессия» — ваш разговор с Claude Code. Нажмите на персонажа — откроется карточка роли.",
      fallback:
        "Это офис. Сейчас в нём никого. Стол «Основная сессия» появится, когда откроется разговор с Claude Code в папке sai/. Столы ролей появятся, когда ролям дадут задачи.",
    },
    {
      title: "Сейчас",
      text: "Здесь — кто занят прямо сейчас: строка на каждого, кто «в работе». Если строк много, нажмите «Показать всех (N)».",
      fallback:
        "В шапке будет блок «Сейчас» — кто занят прямо сейчас. Он появится после первого ответа сервера Pixel Office.",
    },
    {
      title: "Журнал",
      text: "Каждое событие от Claude Code — отдельная строка, новые внизу. Нажмите на строку: «подробнее» покажет, что произошло и о чём событие молчит. Поиск и «Фильтры» помогают найти нужное.",
      fallback:
        "Это журнал. Событий пока нет. Откройте Claude Code в папке sai/ и напишите цель. Первые строки появятся здесь в течение 5 секунд.",
    },
    {
      title: "Задачи",
      text: "Список работы: по элементу на каждую задачу агента и на каждый ваш запрос. Отсюда открывается окно «Просмотр истории» запроса.",
      fallback:
        "Это список работы. Пока он пуст: элементы появятся с первыми событиями от Claude Code.",
    },
    {
      title: "Справка — здесь",
      text: "Кнопка «Как пользоваться» открывает справку: о странице, о команде и словарь. Там же можно снова запустить этот тур. Escape закрывает тур в любой момент.",
      fallback: null,
    },
  ],
};

// Table 4 of the description of REQ-053 in docs/requirements.yaml, word for word
// (the outer quotes «…» are not part of a text).
const T4 = {
  HINT_MARK: "?",
  HINT_LABEL: "Подсказка: {name}",
  HINT_NAMES: {
    now: "Сейчас",
    journal: "Журнал",
    tasks: "Задачи",
    office: "Офис и доска",
  },
  HINT_CLOSE:
    "Закрыть подсказку: нажмите «?» ещё раз, нажмите в другом месте страницы или Escape.",
  HINTS: {
    now: "Строка на каждого, кто сейчас «в работе»: название роли и задача. «в работе: N» — сколько их. Строка исчезает, когда агент вернул ответ или о задаче давно нет событий.",
    journal:
      "Каждое событие от Claude Code — строка с настоящим временем. Нажмите на строку, чтобы увидеть подробности. «Фильтры» и поиск сужают список. Строка с пометкой «не подтверждена» ни на что не влияет.",
    tasks:
      "Элемент — одна задача: работа одного агента или один ваш запрос. Слово состояния, например «в работе», говорит, идёт ли задача. События одной задачи: нажмите «агент», а в карточке — «события в журнале».",
    office:
      "У каждой роли с задачей — стол и персонаж своего цвета. Экран ноутбука светится, пока роль работает. Числа на доске — сколько задач у роли. Жёлтое — «в работе», зелёное — агент вернул ответ, красное — конец работы не записан, серое — сервер перезапускали.",
  },
  EMPTY_STEPS_TITLE: "Чтобы здесь появились события:",
  EMPTY_STEPS: [
    "Откройте Claude Code в папке sai/.",
    "Если Claude Code спросит, доверять ли папке, — подтвердите.",
    "Напишите в разговоре цель обычными словами.",
    "Первые строки появятся здесь в течение 5 секунд. Обновлять страницу не нужно.",
  ],
  KEYS_HINT: "Escape закрывает и открытую подсказку «?».",
  OFFICE_EMPTY:
    "В офисе пока никого. Стол «Основная сессия» появится, когда откроется разговор с Claude Code в папке sai/. Столы ролей появятся, когда ролям дадут задачи.",
  TASKS_EMPTY:
    "Задач пока нет. Элемент появится, когда основная сессия получит запрос или агенту передадут задание.",
};

const S = (n) => T0 + n * 1000;
const SERVICE = /undefined|null|NaN|\[object/;
const KEY = "pixel-office-tour";
const closedStore = () => fakeStorage({ [KEY]: "closed" });
const plain = (v) => JSON.parse(JSON.stringify(v));

async function started(entries = [], o = {}) {
  const page = makePage({ entries: [...entries], ...o });
  await page.start();
  return page;
}
// A key pressed on the document; returns whether a listener prevented it.
function key(page, name, extra = {}) {
  let prevented = false;
  page.doc.fire("keydown", {
    key: name,
    ...extra,
    preventDefault() {
      prevented = true;
    },
  });
  return prevented;
}
const esc = (page) => key(page, "Escape");
// A key pressed on an element, as a browser delivers it: the keydown goes
// from the element up through its parents to the document (bubbling), unless
// a listener stops it. Returns whether any listener prevented it.
function keyFrom(page, el, name, extra = {}) {
  let prevented = false;
  let stopped = false;
  const event = {
    key: name,
    target: el,
    ...extra,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {
      stopped = true;
    },
  };
  for (
    let at = el;
    at !== null && at !== undefined && !stopped;
    at = at.parentNode
  ) {
    for (const fn of at.listeners.get("keydown") ?? []) {
      fn({ ...event, currentTarget: at });
    }
  }
  if (!stopped) page.doc.fire("keydown", event);
  return prevented;
}
const focused = (page) => page.doc.focused;
const openBtn = (page) => page.el("guide-open");
const guideEl = (page) => page.el("guide");
const guideOpen = (page) => guideEl(page).hidden === false;
// The element the page puts data-modal and data-guide on (body).
const bodyEl = (page) => page.el("history-overlay").parentNode;
const tourEl = (page) => page.el("tour");
const tourOpen = (page) => tourEl(page).hidden === false;
const tourBtn = (page, name) =>
  name === "x"
    ? tourEl(page).byClass("tour-x")[0]
    : tourEl(page).find((e) => e.dataset.tour === name);
const tourStep = (page) =>
  tourOpen(page) ? Number(tourEl(page).dataset.step) : null;
const inviteShown = (page) => page.el("tour-invite").hidden === false;
const marked = (page) =>
  page.doc.root.all((e) => e.getAttribute("data-tour-target") === "true");
const hintBtn = (page, name) =>
  page.doc.root.find(
    (e) =>
      e.classes.has("hint-btn") &&
      e.getAttribute("aria-describedby") === `hint-${name}`,
  );
const hintTip = (page, name) => page.el(`hint-${name}`);
const hintOpen = (page, name) => hintTip(page, name).hidden === false;
const rowAt = (page, i) =>
  page.rows().find((r) => r.dataset.index === String(i));
const toggleAt = (page, i) => rowAt(page, i).byClass("row-toggle")[0];
const detailsOpen = (page, i) =>
  rowAt(page, i).byClass("event-details").length === 1;
const cardOpen = (page) => page.el("card-overlay").hidden === false;
// The text a person sees: no hidden element.
function seen(el) {
  if (el.hidden === true) return "";
  if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) return "";
  if (el.children.length === 0) return el.textContent;
  return el.children.map(seen).join(" ");
}
// A click on the character of a role, as the office test does it.
function clickCharacter(page, characterKey) {
  const office = page.app.getOffice();
  page.canvas.rect = {
    left: 0,
    top: 0,
    width: office.layout.width * 24,
    height: office.layout.height * 24,
  };
  const pos = page.app
    .getSim()
    .positions()
    .find((p) => p.key === characterKey);
  page.canvas.click({
    clientX: (pos.x + 0.5) * 24 - office.layout.min_x * 24,
    clientY: (pos.y + 0.5) * 24,
  });
}
// The main session with a request and two roles: Plan in work, Explore
// finished (the "Сейчас" block, the journal and "Задачи" have content).
function twoRoles() {
  return [
    lineAt("SessionStart", "S1", S(1)),
    lineAt("UserPromptSubmit", "S1", S(2), { prompt_kind: "owner" }),
    lineAt("PostToolUse", "S1", S(3), {
      tool_use_id: "tu-a1",
      launched_agent_id: "a1-00001",
      subagent_type: "Plan",
      description: "Образец плана",
    }),
    lineAt("SubagentStart", "S1", S(4), {
      agent_id: "a1-00001",
      agent_type: "Plan",
    }),
    lineAt("PostToolUse", "S1", S(5), {
      tool_use_id: "tu-b1",
      launched_agent_id: "b1-00001",
      subagent_type: "Explore",
      description: "Образец поиска",
    }),
    lineAt("SubagentStart", "S1", S(6), {
      agent_id: "b1-00001",
      agent_type: "Explore",
    }),
    lineAt("SubagentStop", "S1", S(7), {
      agent_id: "b1-00001",
      agent_type: "Explore",
    }),
  ];
}

// ------------------------------------------- the rules of the texts (owner)

// Every string value of texts.js, nested ones too.
function allStrings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (v !== null && typeof v === "object") {
    for (const x of Object.values(v)) allStrings(x, out);
  }
  return out;
}
const CONSTANT_STRINGS = allStrings(TX);
// Spaces, colons and "·" off both ends (decision N1 of ORCH: also " · ").
const strip = (s) => s.replace(/^[\s:·]+|[\s:·]+$/g, "");
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The quotes «…» of a text; of nested quotes only the inner pair counts.
const quotesOf = (text) => [...text.matchAll(/«([^«»]*)»/g)].map((m) => m[1]);
// The rule of truth: a quote is a string constant (a place {x} of the
// constant matches any text) or one of `extra` (titles, terms).
function isConstant(quote, extra = []) {
  const q = strip(quote);
  for (const c of [...CONSTANT_STRINGS, ...extra]) {
    const v = strip(c);
    if (v === q) return true;
    if (/\{[a-zA-Z]+\}/.test(v)) {
      const parts = v.split(/\{[a-zA-Z]+\}/).map(reEscape);
      if (new RegExp(`^${parts.join(".+")}$`).test(q)) return true;
    }
  }
  return false;
}
// A phrase ends at ".", "!", "?" or "…" followed by a space or the end; a
// word is a part between spaces with a letter or a digit.
const phrasesOf = (text) =>
  text
    .split(/(?<=[.!?…])(?:\s+|$)/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
const wordsOf = (phrase) =>
  phrase.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const THOU =
  /(^|[^\p{L}])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои)(?![\p{L}])/iu;
const UNCLEAR_STEMS = [
  "репозитори",
  "коммит",
  "мерж",
  "бэкенд",
  "фронтенд",
  "вердикт",
  "дефект",
  "деплой",
  "релиз",
  "хранилищ",
  "фокус",
];
const UNCLEAR_WORDS = /\b(API|JSON|CSS|UAT|localStorage)\b/i;
// The problems of one text by the rules of understanding (criterion 4 of
// REQ-050): long phrases, "ты", unclear words (not counting the role names).
function clarityProblems(text) {
  const out = [];
  for (const phrase of phrasesOf(text)) {
    const n = wordsOf(phrase).length;
    if (n > 18) out.push(`${n} words: ${phrase}`);
  }
  if (THOU.test(text)) out.push(`"ты": ${text}`);
  let bare = text;
  for (const name of Object.values(TX.ROLE_NAMES))
    bare = bare.split(name).join(" ");
  const low = bare.toLowerCase();
  for (const stem of UNCLEAR_STEMS) {
    if (low.includes(stem)) out.push(`'${stem}': ${text}`);
  }
  if (UNCLEAR_WORDS.test(bare)) out.push(`latin word: ${text}`);
  return out;
}
// Every text of a block or of a list of sections.
function textsOf(sections) {
  const out = [];
  for (const s of sections) {
    out.push(s.title);
    for (const b of s.blocks) {
      if (b.kind === "p") out.push(b.text);
      if (b.kind === "ul" || b.kind === "ol") out.push(...b.items);
      if (b.kind === "dl") out.push(...b.pairs.flat());
      if (b.kind === "groups") {
        for (const g of b.groups) out.push(g.title, ...g.items);
      }
    }
  }
  return out;
}
function deepFrozen(v, where = "") {
  if (v === null || typeof v !== "object") return;
  assert.ok(Object.isFrozen(v), `not frozen: ${where}`);
  for (const [k, x] of Object.entries(v)) deepFrozen(x, `${where}.${k}`);
}

// ===================================================================== REQ-050

test("GD-01: the button 'Как пользоваться' - in index.html the last child of header.top, after div.controls and outside it; type, aria-label, aria-controls, aria-expanded, no aria-haspopup; the mark '?' with aria-hidden; the texts are the constants; the order of the controls of the header is 'Пауза', '1×', '2×', '4×', 'Как пользоваться'", async () => {
  const doc = new FakeDocument(indexHtml());
  const header = doc.root.find(
    (e) => e.tagName === "HEADER" && e.classes.has("top"),
  );
  const button = doc.getElementById("guide-open");
  assert.ok(header.children[header.children.length - 1] === button);
  const controls = header.children.find((e) => e.classes.has("controls"));
  assert.ok(controls !== undefined);
  assert.ok(
    header.children.indexOf(controls) < header.children.indexOf(button),
  );
  assert.equal(within(button, controls), false);
  assert.equal(button.tagName, "BUTTON");
  assert.equal(button.getAttribute("type"), "button");
  assert.equal(button.getAttribute("aria-label"), "Как пользоваться");
  assert.equal(button.getAttribute("aria-controls"), "guide");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(button.hasAttribute("aria-haspopup"), false);
  const mark = button.byClass("guide-mark")[0];
  assert.equal(mark.getAttribute("aria-hidden"), "true");
  assert.equal(mark.textContent, T1.GUIDE_MARK);
  assert.equal(button.byClass("guide-open-text")[0].textContent, T1.GUIDE_OPEN);
  // the order of the stops of Tab in the header (the invitation is hidden)
  const visibleButtons = (root) =>
    root.all(
      (e) =>
        e.tagName === "BUTTON" &&
        !(() => {
          for (let at = e; at !== null; at = at.parentNode) {
            if (at.hidden === true) return true;
          }
          return false;
        })(),
    );
  const label = (b) => b.getAttribute("aria-label") ?? b.textContent.trim();
  assert.deepEqual(visibleButtons(header).map(label), [
    "Пауза",
    "1×",
    "2×",
    "4×",
    "Как пользоваться",
  ]);
  // the page after the start: the texts again from texts.js, the same order
  // at the end of the header (the hint "?" of "Сейчас" stands before them)
  const page = await started([], { storageFn: closedStore });
  const live = page.doc.root.find(
    (e) => e.tagName === "HEADER" && e.classes.has("top"),
  );
  assert.deepEqual(visibleButtons(live).map(label).slice(-5), [
    "Пауза",
    "1×",
    "2×",
    "4×",
    "Как пользоваться",
  ]);
  assert.equal(openBtn(page).getAttribute("aria-label"), TX.GUIDE_OPEN);
  assert.equal(openBtn(page).getAttribute("aria-expanded"), "false");
  assert.equal(
    openBtn(page).byClass("guide-open-text")[0].textContent,
    TX.GUIDE_OPEN,
  );
});

test("GD-02: the guide is next to the page - opened by a press and by Enter, no role dialog, no aria-modal, no backdrop; the focus on its heading; head, lead, table of contents, sections in order; Tab is not taken; a button of the table puts the focus on its section; a filter and a card work while it is open; 'Закрыть' hides it and gives the focus back; a second press closes; with the focus outside the closing keeps it; opening closes 'Показать всех'; with a card open it does not open; aria-expanded follows", async () => {
  const page = await started(twoRoles(), {
    storageFn: closedStore,
    now: S(30),
  });
  const button = openBtn(page);
  const aside = guideEl(page);
  assert.equal(aside.hidden, true);
  assert.equal(aside.getAttribute("aria-labelledby"), "guide-title");
  button.click();
  assert.equal(guideOpen(page), true);
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(bodyEl(page).getAttribute("data-guide"), "open");
  assert.equal(aside.hasAttribute("role"), false);
  assert.equal(aside.hasAttribute("aria-modal"), false);
  // no backdrop of the guide anywhere
  assert.equal(
    page.doc.root.all(
      (e) =>
        /guide/.test(e.id + e.className) &&
        /overlay|backdrop|catcher|shade/.test(e.id + e.className),
    ).length,
    0,
  );
  const title = page.el("guide-title");
  assert.ok(focused(page) === title);
  assert.equal(title.tagName, "H2");
  assert.equal(title.getAttribute("tabindex"), "-1");
  assert.equal(title.textContent, "Как пользоваться Pixel Office");
  // the parts in order: head (title, "Закрыть"), body (lead, tour button,
  // table of contents, sections)
  const [head, body] = aside.children;
  assert.ok(head.classes.has("guide-head") && body.classes.has("guide-body"));
  const close = head.children[1];
  assert.equal(close.textContent, "Закрыть");
  assert.equal(close.getAttribute("aria-label"), "Закрыть справку");
  assert.equal(body.children[0].textContent, T1.GUIDE_LEAD);
  const nav = body.children.find((e) => e.tagName === "NAV");
  assert.equal(nav.getAttribute("aria-label"), "Разделы");
  assert.equal(nav.children[0].textContent, "Разделы");
  const sections = body.children.filter((e) => e.tagName === "SECTION");
  const keys = guideSections().map((s) => s.key);
  assert.deepEqual(
    sections.map((s) => s.dataset.section),
    keys,
  );
  assert.deepEqual(
    nav.all((e) => e.tagName === "BUTTON").map((b) => b.textContent),
    guideSections().map((s) => s.title),
  );
  assert.ok(body.children.indexOf(nav) < body.children.indexOf(sections[0]));
  for (const s of sections) {
    assert.equal(s.children[0].tagName, "H3");
    assert.equal(s.children[0].getAttribute("tabindex"), "-1");
  }
  // Tab is not taken: the focus is not trapped
  const last = sections[sections.length - 1];
  last.children[0].focus();
  assert.equal(keyFrom(page, focused(page), "Tab"), false);
  close.focus();
  assert.equal(keyFrom(page, focused(page), "Tab", { shiftKey: true }), false);
  title.focus();
  assert.equal(keyFrom(page, focused(page), "Tab", { shiftKey: true }), false);
  assert.equal(key(page, "Tab"), false);
  assert.equal(guideOpen(page), true);
  // a button of the table: the heading of the section scrolled and focused
  const journalHeading = sections.find((s) => s.dataset.section === "journal")
    .children[0];
  const scrolls = [];
  journalHeading.scrollIntoView = (o) => scrolls.push(o);
  nav.find((e) => e.dataset.section === "journal").click();
  assert.ok(focused(page) === journalHeading);
  assert.equal(journalHeading.textContent, "Журнал");
  assert.deepEqual(scrolls, [{ block: "start" }]);
  // the page works next to it: "Работа", a character
  page.el("filter-work").click();
  assert.equal(page.el("filter-work").getAttribute("aria-pressed"), "true");
  assert.equal(guideOpen(page), true);
  clickCharacter(page, "role:Plan");
  assert.equal(cardOpen(page), true);
  assert.equal(guideOpen(page), true);
  esc(page);
  assert.equal(cardOpen(page), false);
  assert.equal(guideOpen(page), true);
  // "Закрыть": hidden, the focus on the button, aria-expanded false
  title.focus();
  close.click();
  assert.equal(guideOpen(page), false);
  assert.ok(focused(page) === button);
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(bodyEl(page).hasAttribute("data-guide"), false);
  // Enter opens, a second press closes
  button.fire("keydown", { key: "Enter" });
  assert.equal(guideOpen(page), true);
  button.click();
  assert.equal(guideOpen(page), false);
  // the focus outside the guide: closing does not move it
  button.click();
  page.el("filter-all").focus();
  button.click();
  assert.equal(guideOpen(page), false);
  assert.ok(focused(page) === page.el("filter-all"));
  // the content is built once
  button.click();
  assert.equal(guideEl(page).byClass("guide-body").length, 1);
  button.click();
  // with a card open the guide does not open
  page
    .legend()
    .find((b) => b.dataset.key === "role:Plan")
    .click();
  assert.equal(cardOpen(page), true);
  button.click();
  assert.equal(guideOpen(page), false);
  assert.equal(button.getAttribute("aria-expanded"), "false");
  esc(page);
});

test("GD-02: opening the guide closes the open list 'Показать всех (N)'", async () => {
  const page = makePage({
    entries: [
      lineAt("SessionStart", "S0", S(1)),
      lineAt("UserPromptSubmit", "S0", S(2)),
      ...["Plan", "Explore", "general-purpose"].map((role, i) =>
        lineAt("SubagentStart", "S0", S(3 + i), {
          agent_id: `n${i}`,
          agent_type: role,
        }),
      ),
    ],
    storageFn: closedStore,
    now: S(30),
  });
  page.doc.onCreate = (el) => {
    if (el.tagName === "SPAN") {
      el.rowHeight = 18;
      el.clientHeight = 36;
    }
  };
  await page.start();
  const showAll = page.el("now").byClass("now-show-all")[0];
  assert.equal(showAll.hidden, false);
  showAll.click();
  assert.equal(page.el("now-all").hidden, false);
  openBtn(page).click();
  assert.equal(guideOpen(page), true);
  assert.equal(page.el("now-all").hidden, true);
});

test("GD-03: the guide changes nothing and one order of Escape - with the filter 'Агент', a search, an open row and a scroll, a new event adds one row and the guide keeps its text; a card over it and Escape; the focus in the open row: Escape the row, then the guide; the focus in the guide: Escape the guide; 'Показать всех' and the guide: Escape the list; after closing the filters, search, row, choice and scrollTop are as before; only GET; escapeTarget by table 4.1; the canvas is fitted after opening and closing", async () => {
  const page = await started(twoRoles(), {
    storageFn: closedStore,
    now: S(30),
  });
  const filterAgent = page.el("filter-agent");
  filterAgent.value = "role:Plan";
  filterAgent.fire("change");
  const search = page.el("journal-search");
  search.value = "plan";
  search.fire("input");
  const rowsBefore = page.rows().map((r) => r.dataset.index);
  assert.ok(rowsBefore.length >= 1);
  const open = rowsBefore[rowsBefore.length - 1];
  toggleAt(page, open).click();
  page.el("journal").scrollTop = 0;
  const state = () => ({
    agent: page.el("filter-agent").value,
    search: page.el("journal-search").value,
    rows: page.rows().map((r) => r.dataset.index),
    open: detailsOpen(page, open),
    work: page.el("filter-work").getAttribute("aria-pressed"),
    selected: page
      .legend()
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.dataset.key),
    scroll: [page.el("journal").scrollTop, page.el("tasks").scrollTop],
    tasks: page.items().length,
    characters: page.app.getOffice().characters.length,
    now: page.el("now").byClass("now-row").length,
  });
  const before = state();
  openBtn(page).click();
  const text = guideEl(page).textContent;
  // nothing changes while the guide is open without events
  await page.tick(10_000);
  assert.deepEqual(state(), before);
  // a new event: one row more (of the chosen agent), the guide the same
  await page.push(
    lineAt("SubagentStop", "S1", S(8), {
      agent_id: "a1-00001",
      agent_type: "Plan",
    }),
  );
  assert.equal(page.rows().length, before.rows.length + 1);
  assert.equal(guideEl(page).textContent, text);
  assert.equal(guideOpen(page), true);
  // a card over the guide: Escape closes the card only
  page
    .legend()
    .find((b) => b.dataset.key === "role:Plan")
    .click();
  assert.equal(cardOpen(page), true);
  assert.equal(guideOpen(page), true);
  esc(page);
  assert.equal(cardOpen(page), false);
  assert.equal(guideOpen(page), true);
  // the focus in the open row: Escape the row (on the row), then the guide
  toggleAt(page, open).focus();
  // the handler of Escape of a row is on its li (the fake DOM has no bubbling)
  rowAt(page, open).fire("keydown", { key: "Escape" });
  assert.equal(detailsOpen(page, open), false);
  assert.equal(guideOpen(page), true);
  assert.equal(esc(page), true);
  assert.equal(guideOpen(page), false);
  // the focus in the guide: Escape closes it, the focus back on the button
  openBtn(page).click();
  page.el("guide-title").focus();
  esc(page);
  assert.equal(guideOpen(page), false);
  assert.ok(focused(page) === openBtn(page));
  // after all of it: the filters, the search, the choice and the scroll
  const after = state();
  assert.equal(after.agent, before.agent);
  assert.equal(after.search, before.search);
  assert.deepEqual(after.scroll, before.scroll);
  assert.equal(after.work, before.work);
  assert.equal(after.characters, before.characters);
  // only GET
  for (const c of page.server.calls) assert.equal(c.init.method, "GET");
  // escapeTarget: table 4.1 on every combination of the 11 booleans
  const names = [
    "history",
    "card",
    "hint",
    "tour",
    "nowAll",
    "guide",
    "focusInGuide",
    "invite",
    "focusInInvite",
    "row",
    "focusInRow",
  ];
  const oracle = (f) => {
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
  };
  for (let mask = 0; mask < 1 << names.length; mask++) {
    const f = Object.fromEntries(
      names.map((n, i) => [n, (mask & (1 << i)) !== 0]),
    );
    assert.equal(escapeTarget(f), oracle(f), JSON.stringify(f));
  }
  // the nine rows of table 4.1, each alone
  assert.equal(
    escapeTarget({ guide: true, focusInGuide: true, nowAll: false }),
    "guide",
  );
  assert.equal(
    escapeTarget({ row: true, focusInRow: true, guide: true }),
    "row",
  );
  assert.equal(
    escapeTarget({ row: true, focusInRow: false, guide: true }),
    "guide",
  );
  assert.equal(escapeTarget({ row: true, focusInRow: false }), null);
  assert.equal(escapeTarget({ invite: true, focusInInvite: false }), null);
  assert.equal(escapeTarget({}), null);
});

test("GD-03: the list 'Показать всех' and the guide with the focus outside it - Escape closes the list first, then the guide", async () => {
  const page = makePage({
    entries: [
      lineAt("SessionStart", "S0", S(1)),
      lineAt("UserPromptSubmit", "S0", S(2)),
      ...["Plan", "Explore", "general-purpose"].map((role, i) =>
        lineAt("SubagentStart", "S0", S(3 + i), {
          agent_id: `n${i}`,
          agent_type: role,
        }),
      ),
    ],
    storageFn: closedStore,
    now: S(30),
  });
  page.doc.onCreate = (el) => {
    if (el.tagName === "SPAN") {
      el.rowHeight = 18;
      el.clientHeight = 36;
    }
  };
  await page.start();
  openBtn(page).click();
  const showAll = page.el("now").byClass("now-show-all")[0];
  showAll.click();
  assert.equal(page.el("now-all").hidden, false);
  assert.equal(guideOpen(page), true);
  showAll.focus();
  esc(page);
  assert.equal(page.el("now-all").hidden, true);
  assert.equal(guideOpen(page), true);
  esc(page);
  assert.equal(guideOpen(page), false);
  assert.equal(esc(page), false, "nothing left to close");
});

test("GD-03: the canvas is fitted again after the guide opens and closes - the office gets narrower and wider", async () => {
  const page = makePage({
    entries: twoRoles(),
    storageFn: closedStore,
    now: S(30),
    viewport: { width: 1470, height: 784 },
  });
  setPanelRects(page, { width: 1000, height: 700, legend: 40, gap: 10 });
  await page.start();
  const wide = page.canvas.width;
  // what the guide does to the layout: the panel of the office gets narrower
  setPanelRects(page, { width: 600, height: 700, legend: 40, gap: 10 });
  openBtn(page).click();
  const narrow = page.canvas.width;
  assert.ok(narrow < wide, `${narrow} < ${wide}`);
  setPanelRects(page, { width: 1000, height: 700, legend: 40, gap: 10 });
  openBtn(page).click();
  assert.equal(guideOpen(page), false);
  assert.equal(page.canvas.width, wide);
});

test("GD-03: the nine rows of table 4.1 on the page - one press closes one thing, the first open one: the window of history, the card, a hint, the tour, the list 'Показать всех', the guide with the focus in it, the invitation with the focus in it, the open row with the focus in it, the guide", async () => {
  const entries = [
    ...twoRoles(),
    lineAt("SubagentStart", "S1", S(8), {
      agent_id: "c1-00001",
      agent_type: "general-purpose",
    }),
  ];
  const page = makePage({
    entries,
    storageFn: () => fakeStorage(),
    now: S(30),
  });
  page.doc.onCreate = (el) => {
    if (el.tagName === "SPAN") {
      el.rowHeight = 18;
      el.clientHeight = 36;
    }
  };
  await page.start();
  const nowAllOpen = () => page.el("now-all").hidden === false;
  const historyOpen = () => page.el("history-overlay").hidden === false;
  const showAll = page.el("now").byClass("now-show-all")[0];
  // 7: the invitation with the focus in it (the row open, the focus not in
  // it) goes first; the row stays
  toggleAt(page, 3).click();
  page.el("tour-invite-later").focus();
  esc(page);
  assert.equal(inviteShown(page), false);
  assert.equal(detailsOpen(page, 3), true);
  // 1: the window of history over the guide; then 9: the guide
  openBtn(page).click();
  const opener = rowAt(page, 1).byClass("history-open")[0];
  opener.click();
  assert.equal(historyOpen(), true);
  esc(page);
  assert.equal(historyOpen(), false);
  assert.equal(guideOpen(page), true);
  assert.ok(focused(page) === opener);
  // 8 before 9: the focus in the open row
  toggleAt(page, 3).focus();
  esc(page);
  assert.equal(detailsOpen(page, 3), false);
  assert.equal(guideOpen(page), true);
  // 3: a hint before the list and the guide
  showAll.click();
  hintBtn(page, "journal").click();
  esc(page);
  assert.equal(hintOpen(page, "journal"), false);
  assert.equal(nowAllOpen(), true);
  assert.equal(guideOpen(page), true);
  // 5: the list before the guide (the focus outside the guide)
  page.el("filter-all").focus();
  esc(page);
  assert.equal(nowAllOpen(), false);
  assert.equal(guideOpen(page), true);
  // 6: the guide with the focus in it before the invitation and the row
  toggleAt(page, 3).click();
  page.el("guide-title").focus();
  esc(page);
  assert.equal(guideOpen(page), false);
  assert.equal(detailsOpen(page, 3), true);
  assert.ok(focused(page) === openBtn(page));
  // 4: the tour before the list and the row
  openBtn(page).click();
  guideEl(page).byClass("guide-tour-start")[0].click();
  page.el("now").byClass("now-show-all")[0].click();
  assert.equal(nowAllOpen(), true);
  esc(page);
  assert.equal(tourOpen(page), false);
  assert.equal(nowAllOpen(), true);
  esc(page);
  assert.equal(nowAllOpen(), false);
  assert.equal(detailsOpen(page, 3), true);
  // 2: the card before everything below it
  openBtn(page).click();
  page
    .legend()
    .find((b) => b.dataset.key === "role:Plan")
    .click();
  esc(page);
  assert.equal(cardOpen(page), false);
  assert.equal(guideOpen(page), true);
  // 9: the guide with the focus elsewhere, then nothing
  page.el("filter-all").focus();
  esc(page);
  assert.equal(guideOpen(page), false);
  assert.ok(focused(page) === page.el("filter-all"));
  // the row with the focus outside it is not closed by Escape of the page
  assert.equal(esc(page), false);
  assert.equal(detailsOpen(page, 3), true);
});

test("GD-04: the texts of the guide - the literals of table 1 (deeply frozen constants); the order of the sections; the text of headings, paragraphs and items on the page; the rule of truth; phrases of 18 words at most, 'вы', no unclear words, an example «…» in every section but 'limits'; no old words, no sides of the screen; the commands of the criterion", async () => {
  for (const [name, value] of Object.entries(T1)) {
    assert.deepEqual(plain(TX[name]), value, name);
  }
  deepFrozen(TX.GUIDE_SECTIONS, "GUIDE_SECTIONS");
  // the order: page, team, roles, office ... limits, glossary
  assert.deepEqual(
    guideSections().map((s) => s.key),
    [
      "page",
      "team",
      "roles",
      "office",
      "now",
      "journal",
      "tasks",
      "cards",
      "history",
      "states",
      "keys",
      "limits",
      "glossary",
    ],
  );
  // the page: headings, paragraphs and items of each section of table 1
  const page = await started([], { storageFn: closedStore });
  openBtn(page).click();
  for (const section of T1.GUIDE_SECTIONS) {
    const box = guideEl(page).find(
      (e) => e.tagName === "SECTION" && e.dataset.section === section.key,
    );
    assert.equal(box.children[0].textContent, section.title, section.key);
    const shown = box.children.slice(1).map((e) =>
      e.tagName === "P"
        ? { kind: "p", text: e.textContent }
        : {
            kind: e.tagName.toLowerCase(),
            items: e.children.map((li) => li.textContent),
          },
    );
    const expected = section.blocks.map((b) =>
      section.key === "keys" && b.kind === "ul"
        ? { kind: "ul", items: [...b.items, T3.KEYS_TOUR, T4.KEYS_HINT] }
        : b,
    );
    assert.deepEqual(shown, expected, section.key);
  }
  // the rule of truth over all the texts of table 1
  const titles = guideSections().map((s) => s.title);
  const texts = [...textsOf(T1.GUIDE_SECTIONS), T1.GUIDE_LEAD, T1.GUIDE_TITLE];
  const untrue = [];
  for (const t of texts) {
    for (const q of quotesOf(t)) {
      if (!isConstant(q, titles)) untrue.push(`«${q}» in: ${t}`);
    }
  }
  assert.deepEqual(untrue, []);
  // understanding
  assert.deepEqual(texts.flatMap(clarityProblems), []);
  for (const section of T1.GUIDE_SECTIONS) {
    if (section.key === "limits") continue;
    assert.ok(
      textsOf([section]).some((t) => quotesOf(t).length > 0),
      `an example in ${section.key}`,
    );
  }
  // the text of the panel: no old words, no sides of the screen
  const panel = guideEl(page).textContent;
  assert.doesNotMatch(
    panel,
    /хук|LIVE|REAL|SIMULATION|экземпляр|субагент|session_id|сессии Claude Code/i,
  );
  assert.doesNotMatch(panel, /слева|справа|вверху/i);
  // the commands of the criterion, run here
  for (const name of fs.readdirSync(PUBLIC)) {
    const text = fs.readFileSync(path.join(PUBLIC, name), "utf8");
    for (const line of text.split("\n")) {
      if (line.includes("HISTORY_META_FINISHED")) continue;
      assert.doesNotMatch(line, /заверш|готов|выполнен|успешн/i, name);
    }
  }
  // the rule itself on invented texts
  assert.equal(isConstant("Показать всех (N)"), true);
  assert.equal(isConstant("N из M"), true);
  assert.equal(isConstant("Выдуманная надпись"), false);
  assert.equal(clarityProblems(`${"слово ".repeat(19)}.`).length, 1);
  assert.equal(clarityProblems("Нажмите, если тебе нужно.").length, 1);
  assert.equal(clarityProblems("Смотрите хранилище.").length, 1);
  assert.deepEqual(clarityProblems(`${"слово ".repeat(17)}конец.`), []);
});

// The pairs of colours of the rules of a part of the page: every color and
// background of its selectors as tokens of :root.
function contrastPairs(rules, test) {
  const tokens = new Map();
  for (const r of rules) {
    if (r.media === null && r.selectors.includes(":root")) {
      for (const [n, v] of r.list) tokens.set(n, v);
    }
  }
  const hex = (v) => {
    const m = /^var\((--[a-z0-9-]+)\)$/.exec(v ?? "");
    const h = m ? tokens.get(m[1]) : v;
    if (typeof h !== "string" || !/^#[0-9a-f]{6}$/i.test(h)) return null;
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const lum = ([r, g, b]) => {
    const c = (x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  return {
    tokens,
    hex,
    ratio,
    rules: rules.filter((r) => r.selectors.some(test)),
  };
}

test("GD-05: the colours of the guide - every pair of text and background of its rules reaches 4.5 to 1; no transition or animation in its rules", () => {
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  const isGuide = (s) => /\.guide|#guide|data-guide/.test(s);
  const { hex, ratio, rules: own } = contrastPairs(rules, isGuide);
  assert.ok(own.length >= 6, `${own.length} rules of the guide`);
  const panelBg = hex(cssValue(cssCascade(rules, ".guide"), "background"));
  assert.ok(panelBg !== null, "the guide has a background token");
  let pairs = 0;
  for (const r of own) {
    const color = hex(new Map(r.list).get("color"));
    if (color === null) continue;
    const bg = hex(new Map(r.list).get("background")) ?? panelBg;
    pairs += 1;
    assert.ok(
      ratio(color, bg) >= 4.5,
      `${r.selectors.join()}: ${ratio(color, bg)}`,
    );
  }
  assert.ok(pairs >= 3, `${pairs} pairs`);
  for (const r of own) {
    for (const [name] of r.list) {
      assert.equal(
        /^(transition|animation)/.test(name),
        false,
        r.selectors.join(),
      );
    }
  }
});

test("GD-06: bad conditions do not break the guide - the link lost with the guide open, no answer yet, an empty journal, twenty openings, 450 rows: no exception, no service word, one #guide, one Escape closes it once", async () => {
  const errors = mock.method(console, "error", () => {});
  try {
    // no answer yet
    const early = makePage({ entries: [], storageFn: closedStore });
    early.server.mode = "hang";
    await early.start();
    openBtn(early).click();
    assert.equal(guideOpen(early), true);
    assert.equal(
      guideEl(early).byClass("guide-section").length,
      guideSections().length,
    );
    // an empty journal; the link lost while it is open
    const page = await started([], { storageFn: closedStore });
    openBtn(page).click();
    const text = guideEl(page).textContent;
    page.server.mode = "fail";
    await page.tick(2000);
    await page.tick(10_000);
    assert.equal(page.el("link").dataset.state, "down");
    assert.equal(page.text("link-status"), "Нет связи с сервером Pixel Office");
    assert.equal(guideOpen(page), true);
    assert.equal(guideEl(page).textContent, text);
    // twenty openings and closings; the content is built once and stays (no
    // element is made again, the heading is the same element)
    const heading = page.el("guide-title");
    const made = page.doc.created.length;
    for (let i = 0; i < 20; i++) openBtn(page).click();
    assert.equal(page.doc.created.length, made, "nothing built again");
    assert.ok(page.el("guide-title") === heading);
    assert.equal(guideOpen(page), true, "an even number of presses");
    openBtn(page).click();
    assert.equal(guideOpen(page), false);
    for (let i = 0; i < 20; i++) {
      openBtn(page).click();
      page.el("guide-title").focus();
      esc(page);
    }
    assert.equal(page.doc.root.all((e) => e.id === "guide").length, 1);
    assert.equal(guideEl(page).byClass("guide-body").length, 1);
    openBtn(page).click();
    assert.equal(esc(page), true);
    assert.equal(guideOpen(page), false);
    assert.equal(esc(page), false, "the second Escape closes nothing");
    // 450 rows
    const many = [lineAt("SessionStart", "S1", S(1))];
    for (let i = 1; i < 450; i++)
      many.push(lineAt("UserPromptSubmit", "S1", S(1) + i * 100));
    const big = await started(many, { storageFn: closedStore, now: S(100) });
    openBtn(big).click();
    assert.equal(guideOpen(big), true);
    for (const p of [early, page, big]) {
      assert.doesNotMatch(seen(p.doc.root), SERVICE);
    }
    assert.equal(errors.mock.calls.length, 0, "reportOnce was not called");
  } finally {
    errors.mock.restore();
  }
});

test("GD-07: the guide only reads - only GET, no new row of the journal from what is done with it; no way to markup and no address in the code of the page; the server and the packages are those of the base", async () => {
  const page = await started(twoRoles(), {
    storageFn: closedStore,
    now: S(30),
  });
  const rows = page.rows().length;
  const calls = page.server.calls.length;
  openBtn(page).click();
  for (const b of guideEl(page).all((e) => e.tagName === "BUTTON")) {
    if (b.classes.has("guide-tour-start")) continue;
    b.click();
  }
  openBtn(page).click();
  openBtn(page).click();
  assert.equal(page.rows().length, rows);
  assert.equal(page.server.calls.length, calls, "no request from the guide");
  await page.tick(2000);
  for (const c of page.server.calls) assert.equal(c.init.method, "GET");
  assert.equal(page.server.entries.length, twoRoles().length);
  assert.equal(page.doc.htmlWrites, 0);
  assert.equal(page.doc.styleTouches, 0);
  for (const name of fs.readdirSync(PUBLIC)) {
    const text = fs.readFileSync(path.join(PUBLIC, name), "utf8");
    assert.doesNotMatch(
      text,
      /innerHTML|outerHTML|insertAdjacentHTML|document[.]write/,
      name,
    );
    assert.doesNotMatch(text, /https?:\/\//, name);
  }
});

// ===================================================================== REQ-051

test("GR-01: the section 'Как работать с командой агентов' stands right after 'Что это за страница', its button in the table of contents too; one ol of five items, the literals of table 2", async () => {
  assert.deepEqual(plain(TX.GUIDE_TEAM), T2.GUIDE_TEAM);
  const keys = guideSections().map((s) => s.key);
  assert.equal(keys.indexOf("team"), keys.indexOf("page") + 1);
  const page = await started([], { storageFn: closedStore });
  openBtn(page).click();
  const nav = guideEl(page).find((e) => e.tagName === "NAV");
  const tocKeys = nav
    .all((e) => e.tagName === "BUTTON")
    .map((b) => b.dataset.section);
  assert.equal(tocKeys.indexOf("team"), tocKeys.indexOf("page") + 1);
  assert.equal(
    nav.find((e) => e.dataset.section === "team").textContent,
    "Как работать с командой агентов",
  );
  const box = guideEl(page).find(
    (e) => e.tagName === "SECTION" && e.dataset.section === "team",
  );
  assert.equal(box.children[0].textContent, "Как работать с командой агентов");
  const lists = box.children.filter((e) =>
    ["OL", "UL", "P"].includes(e.tagName),
  );
  assert.equal(lists.length, 1);
  assert.equal(lists[0].tagName, "OL");
  assert.deepEqual(
    lists[0].children.map((li) => li.textContent),
    T2.GUIDE_TEAM.blocks[0].items,
  );
  assert.equal(lists[0].children.length, 5);
});

test("GR-02: the section 'Роли команды' right after the team - the lead, seven groups of h4 and ul; every code of ROLE_NAMES in exactly one group; the descriptions have the keys of ROLE_NAMES; an item is the name, ' — ' and the description; 37 files of roles and 37 codes; a copy of ROLE_NAMES with an extra code or a code taken out makes the check of agreement fail", async () => {
  assert.deepEqual(plain(TX.GUIDE_ROLES), T2.GUIDE_ROLES);
  assert.deepEqual(plain(TX.GUIDE_ROLE_ABOUT), T2.GUIDE_ROLE_ABOUT);
  deepFrozen(TX.GUIDE_ROLES, "GUIDE_ROLES");
  deepFrozen(TX.GUIDE_ROLE_ABOUT, "GUIDE_ROLE_ABOUT");
  const keys = guideSections().map((s) => s.key);
  assert.equal(keys.indexOf("roles"), keys.indexOf("team") + 1);
  const codes = TX.GUIDE_ROLES.groups.flatMap((g) => g.codes);
  assert.equal(new Set(codes).size, codes.length, "no code twice");
  assert.deepEqual([...codes].sort(), Object.keys(TX.ROLE_NAMES).sort());
  assert.deepEqual(
    Object.keys(TX.GUIDE_ROLE_ABOUT).sort(),
    Object.keys(TX.ROLE_NAMES).sort(),
  );
  assert.equal(agentFiles().length, Object.keys(TX.ROLE_NAMES).length);
  assert.equal(agentFiles().length, 37);
  assert.deepEqual(
    roleTableProblems(
      TX.ROLE_NAMES,
      TX.GUIDE_ROLES.groups,
      TX.GUIDE_ROLE_ABOUT,
    ),
    [],
  );
  // the page: the lead, then h4 + ul per group, the items
  const page = await started([], { storageFn: closedStore });
  openBtn(page).click();
  const box = guideEl(page).find(
    (e) => e.tagName === "SECTION" && e.dataset.section === "roles",
  );
  assert.equal(box.children[0].textContent, "Роли команды");
  assert.equal(box.children[1].tagName, "P");
  assert.equal(box.children[1].textContent, T2.GUIDE_ROLES.lead);
  const rest = box.children.slice(2);
  assert.equal(rest.length, 14);
  T2.GUIDE_ROLES.groups.forEach((group, i) => {
    const h4 = rest[2 * i];
    const ul = rest[2 * i + 1];
    assert.equal(h4.tagName, "H4");
    assert.equal(h4.textContent, group.title);
    assert.equal(ul.tagName, "UL");
    assert.deepEqual(
      ul.children.map((li) => li.textContent),
      group.codes.map(
        (code) => `${TX.ROLE_NAMES[code]} — ${T2.GUIDE_ROLE_ABOUT[code]}`,
      ),
    );
  });
  // a role that is not described or not grouped makes the check fail
  const extra = { ...TX.ROLE_NAMES, NEW_ROLE: "Новая роль" };
  assert.deepEqual(
    roleTableProblems(extra, TX.GUIDE_ROLES.groups, TX.GUIDE_ROLE_ABOUT),
    ["no group: NEW_ROLE", "no description: NEW_ROLE"],
  );
  const fewer = { ...TX.ROLE_NAMES };
  delete fewer.ORCH;
  assert.deepEqual(
    roleTableProblems(fewer, TX.GUIDE_ROLES.groups, TX.GUIDE_ROLE_ABOUT),
    ["not a role: ORCH", "extra description: ORCH"],
  );
  const twice = TX.GUIDE_ROLES.groups.map((g, i) =>
    i === 1 ? { ...g, codes: [...g.codes, "ORCH"] } : g,
  );
  assert.deepEqual(
    roleTableProblems(TX.ROLE_NAMES, twice, TX.GUIDE_ROLE_ABOUT),
    ["repeated: ORCH"],
  );
  // the section never breaks: a code without a name is left out
  const items = guideSections(extra)
    .find((s) => s.key === "roles")
    .blocks[1].groups.flatMap((g) => g.items);
  assert.equal(items.length, 37);
  assert.deepEqual(roleTableProblems(null, null, null), []);
});

test("GR-03: the section 'Словарь' is the last one and its button the last of the table; one dl of eighteen pairs, the literals of table 2", async () => {
  assert.deepEqual(plain(TX.GUIDE_GLOSSARY), T2.GUIDE_GLOSSARY);
  const sections = guideSections();
  assert.equal(sections[sections.length - 1].key, "glossary");
  assert.equal(sections[sections.length - 2].key, "limits");
  const page = await started([], { storageFn: closedStore });
  openBtn(page).click();
  const nav = guideEl(page).find((e) => e.tagName === "NAV");
  const tocButtons = nav.all((e) => e.tagName === "BUTTON");
  assert.equal(tocButtons[tocButtons.length - 1].textContent, "Словарь");
  const boxes = guideEl(page).all((e) => e.tagName === "SECTION");
  const box = boxes[boxes.length - 1];
  assert.equal(box.dataset.section, "glossary");
  assert.equal(box.children[0].textContent, "Словарь");
  const dl = box.children.filter((e) => e.tagName !== "H3");
  assert.equal(dl.length, 1);
  assert.equal(dl[0].tagName, "DL");
  const pairs = [];
  for (let i = 0; i < dl[0].children.length; i += 2) {
    assert.equal(dl[0].children[i].tagName, "DT");
    assert.equal(dl[0].children[i + 1].tagName, "DD");
    pairs.push([
      dl[0].children[i].textContent,
      dl[0].children[i + 1].textContent,
    ]);
  }
  assert.equal(pairs.length, 18);
  assert.deepEqual(pairs, T2.GUIDE_GLOSSARY.pairs);
});

test("GR-04: the texts of table 2 are true and plain - every quote is a constant, a title of a section, a group or a term; phrases of 18 words at most, 'вы', no unclear words (role names aside); an example in the team section; the sixteen terms are in the glossary; no old words in the three sections", async () => {
  const team = TX.GUIDE_TEAM;
  const roles = guideSections().find((s) => s.key === "roles");
  const glossary = guideSections().find((s) => s.key === "glossary");
  const extra = [
    ...guideSections().map((s) => s.title),
    ...TX.GUIDE_ROLES.groups.map((g) => g.title),
    ...TX.GUIDE_GLOSSARY.pairs.map(([term]) => term),
  ];
  const texts = [
    ...textsOf([team, glossary]),
    TX.GUIDE_ROLES.lead,
    ...Object.values(TX.GUIDE_ROLE_ABOUT),
  ];
  const untrue = [];
  for (const t of texts) {
    for (const q of quotesOf(t))
      if (!isConstant(q, extra)) untrue.push(`«${q}» in: ${t}`);
  }
  assert.deepEqual(untrue, []);
  assert.deepEqual(texts.flatMap(clarityProblems), []);
  assert.ok(team.blocks[0].items.some((t) => quotesOf(t).length > 0));
  const terms = TX.GUIDE_GLOSSARY.pairs.map(([term]) => term);
  for (const term of [
    "Агент",
    "Роль",
    "Задача",
    "Запуск",
    "Разговор (сессия)",
    "Оркестратор",
    "Журнал",
    "Событие",
    "Ворота проверок",
    "Планка качества",
    "Claude Code",
    "Сервер Pixel Office",
    "Требование",
    "Код",
    "Тест",
    "Аудит",
  ]) {
    assert.ok(terms.includes(term), term);
  }
  const page = await started([], { storageFn: closedStore });
  openBtn(page).click();
  for (const k of ["team", "roles", "glossary"]) {
    const box = guideEl(page).find(
      (e) => e.tagName === "SECTION" && e.dataset.section === k,
    );
    assert.doesNotMatch(
      box.textContent,
      /хук|LIVE|REAL|экземпляр|субагент|session_id|сессии Claude Code/i,
      k,
    );
  }
  assert.equal(roles.blocks.length, 2);
});

test("GR-05: the levels of headings h2 -> h3 -> h4, the ol and the dl; a copy of ROLE_NAMES where ORCH is <img src=x onerror=alert(1)> shows the item literally and makes no element img; the three sections have no colour outside the rules of the guide; no way to markup in the code", async () => {
  const page = await started([], { storageFn: closedStore });
  openBtn(page).click();
  const levels = guideEl(page)
    .all((e) => /^H[1-6]$/.test(e.tagName))
    .map((e) => Number(e.tagName[1]));
  assert.equal(levels[0], 2);
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] <= levels[i - 1] + 1, `no level skipped at ${i}`);
    assert.ok(levels[i] >= 3, "only the title is h2");
  }
  assert.ok(levels.includes(4));
  const section = (k) =>
    guideEl(page).find(
      (e) => e.tagName === "SECTION" && e.dataset.section === k,
    );
  assert.equal(section("team").all((e) => e.tagName === "OL").length, 1);
  assert.equal(section("glossary").all((e) => e.tagName === "DL").length, 1);
  assert.equal(section("roles").all((e) => e.tagName === "H4").length, 7);
  // a hostile role name in a copy of ROLE_NAMES: text, no element
  const IMG = "<img src=x onerror=alert(1)>";
  const doc = new FakeDocument("<html><body></body></html>");
  const built = renderGuideSections(
    doc,
    guideSections({ ...TX.ROLE_NAMES, ORCH: IMG }),
    () => {},
  );
  const roles = built.sections.find((s) => s.dataset.section === "roles");
  const item = roles.all((e) => e.tagName === "LI")[0];
  assert.equal(item.textContent, `${IMG} — ${TX.GUIDE_ROLE_ABOUT.ORCH}`);
  assert.equal(doc.created.filter((e) => e.tagName === "IMG").length, 0);
  assert.equal(doc.htmlWrites, 0);
  // the two spans of an item of a role: the name and the rest (review)
  assert.deepEqual(
    item.children.map((e) => [e.tagName, e.textContent]),
    [
      ["SPAN", IMG],
      ["SPAN", ` — ${TX.GUIDE_ROLE_ABOUT.ORCH}`],
    ],
  );
  assert.ok(item.children[0].classes.has("guide-role-name"));
  // colours: the rules that colour the elements of the three sections are
  // rules of the guide
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  for (const r of rules) {
    const colours = r.list.some(([n]) => /^(color|background)/.test(n));
    if (!colours) continue;
    for (const s of r.selectors) {
      if (/guide-role-name|guide-section|\.guide /.test(s)) {
        assert.match(s, /\.guide|#guide/, s);
      }
      assert.doesNotMatch(s, /^(h4|dl|dt|dd|ol)$/, `a bare selector ${s}`);
    }
  }
  for (const name of fs.readdirSync(PUBLIC)) {
    const text = fs.readFileSync(path.join(PUBLIC, name), "utf8");
    assert.doesNotMatch(
      text,
      /innerHTML|outerHTML|insertAdjacentHTML|document[.]write/,
    );
  }
});

// ===================================================================== REQ-052

// The colours of the rules of one part: every colour against the background
// of its own rule or of the base selector of the part.
function contrastOf(test, baseSelector) {
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  const { hex, ratio, rules: own } = contrastPairs(rules, test);
  const base = hex(cssValue(cssCascade(rules, baseSelector), "background"));
  assert.ok(base !== null, `${baseSelector} has a background token`);
  const low = [];
  let pairs = 0;
  for (const r of own) {
    const map = new Map(r.list);
    const color = hex(map.get("color"));
    if (color === null) continue;
    const bg = hex(map.get("background")) ?? base;
    pairs += 1;
    if (ratio(color, bg) < 4.5)
      low.push(`${r.selectors.join()}: ${ratio(color, bg)}`);
  }
  return { rules, own, pairs, low, hex, ratio, base };
}

test("TU-01: the invitation instead of the tour and the memory of the browser - an empty storage: after the first answer and after the first failure the invitation is seen, no tour, the focus unchanged; 'Не сейчас' writes 'closed'; a new start with the same storage shows nothing; 'Показать' opens step 1; closing the tour writes 'closed'; Escape in the invitation writes 'closed'; the tour from the guide removes the invitation; 'closed' before the start shows nothing; without storage, a throwing storage, null, getItem or setItem that throw - the invitation at each start, the tour works, no exception", async () => {
  const errors = mock.method(console, "error", () => {});
  try {
    // the first answer
    let store = fakeStorage();
    let page = await started([], { storageFn: () => store });
    assert.equal(inviteShown(page), true);
    assert.equal(tourOpen(page), false);
    assert.ok(focused(page) === null, "the focus is not taken");
    assert.deepEqual(store.calls, [["getItem", KEY]]);
    const invite = page.el("tour-invite");
    assert.equal(invite.getAttribute("role"), "region");
    assert.equal(invite.getAttribute("aria-label"), "Приглашение в тур");
    assert.equal(page.el("tour-invite-text").textContent, T3.TOUR_INVITE);
    assert.equal(page.el("tour-invite-show").textContent, "Показать");
    assert.equal(page.el("tour-invite-later").textContent, "Не сейчас");
    // the invitation stands right before "Как пользоваться"; the order of Tab
    const header = invite.parentNode;
    assert.ok(
      header.children[header.children.indexOf(invite) + 1] === openBtn(page),
    );
    const order = header
      .all((e) => e.tagName === "BUTTON")
      .filter((b) => {
        for (let at = b; at !== null; at = at.parentNode)
          if (at.hidden) return false;
        return true;
      })
      .map((b) => b.getAttribute("aria-label") ?? b.textContent.trim())
      .slice(-4);
    assert.deepEqual(order, [
      "4×",
      "Показать",
      "Не сейчас",
      "Как пользоваться",
    ]);
    // the next answers offer nothing more
    await page.tick(2000);
    assert.deepEqual(store.calls, [["getItem", KEY]]);
    // "Не сейчас": gone, written
    page.el("tour-invite-later").click();
    assert.equal(inviteShown(page), false);
    assert.equal(store.values.get(KEY), "closed");
    assert.deepEqual(store.calls.at(-1), ["setItem", KEY, "closed"]);
    // a new start with the same storage: nothing
    page = await started([], { storageFn: () => store });
    assert.equal(inviteShown(page), false);
    assert.equal(tourOpen(page), false);
    // the first failure of the link also offers it
    store = fakeStorage();
    page = makePage({ entries: [], storageFn: () => store });
    page.server.mode = "fail";
    await page.start();
    assert.equal(page.el("link").dataset.state, "down");
    assert.equal(inviteShown(page), true);
    // "Показать": the invitation goes (without a record), the tour at step 1
    page.el("tour-invite-show").click();
    assert.equal(inviteShown(page), false);
    assert.equal(tourStep(page), 1);
    assert.equal(store.values.has(KEY), false);
    tourBtn(page, "x").click();
    assert.equal(tourOpen(page), false);
    assert.equal(store.values.get(KEY), "closed");
    // Escape with the focus in the invitation
    store = fakeStorage();
    page = await started([], { storageFn: () => store });
    page.el("tour-invite-later").focus();
    assert.equal(esc(page), true);
    assert.equal(inviteShown(page), false);
    assert.equal(store.values.get(KEY), "closed");
    assert.ok(focused(page) === openBtn(page));
    // the invitation seen, the tour from the guide, closed: the invitation goes
    store = fakeStorage();
    page = await started([], { storageFn: () => store });
    openBtn(page).click();
    guideEl(page).byClass("guide-tour-start")[0].click();
    assert.equal(tourStep(page), 1);
    tourBtn(page, "skip").click();
    assert.equal(inviteShown(page), false);
    assert.equal(store.values.get(KEY), "closed");
    // "closed" before the start
    page = await started([], { storageFn: closedStore });
    assert.equal(inviteShown(page), false);
    assert.equal(tourOpen(page), false);
    // another value under the key is not "closed": the invitation is shown
    store = fakeStorage({ [KEY]: "other" });
    page = await started([], { storageFn: () => store });
    assert.equal(inviteShown(page), true);
    assert.equal(tourOpen(page), false);
    // no storage in every way: the invitation at every start
    const failing = [
      ["no storageFn", {}],
      [
        "storageFn throws",
        {
          storageFn: () => {
            throw new Error("denied");
          },
        },
      ],
      ["storageFn gives null", { storageFn: () => null }],
      [
        "getItem throws",
        {
          storageFn: () => {
            const st = fakeStorage();
            st.failGet = true;
            return st;
          },
        },
      ],
      [
        "setItem throws",
        {
          storageFn: () => {
            const st = fakeStorage({ other: "x" });
            st.failSet = true;
            return st;
          },
        },
      ],
    ];
    for (const [why, o] of failing) {
      for (let round = 0; round < 2; round++) {
        const p = await started([], o);
        assert.equal(inviteShown(p), true, `${why}, start ${round + 1}`);
        p.el("tour-invite-show").click();
        assert.equal(tourStep(p), 1, why);
        tourBtn(p, "next").click();
        assert.equal(tourStep(p), 2, why);
        tourBtn(p, "skip").click();
        assert.equal(tourOpen(p), false, why);
        assert.equal(inviteShown(p), false, why);
        // not back on this page
        await p.tick(2000);
        assert.equal(inviteShown(p), false, why);
      }
      const q = await started([], o);
      q.el("tour-invite-later").click();
      assert.equal(inviteShown(q), false, why);
      await q.tick(2000);
      assert.equal(inviteShown(q), false, `${why}: not before a reload`);
    }
    assert.equal(errors.mock.calls.length, 0, "reportOnce was not called");
  } finally {
    errors.mock.restore();
  }
});

test("TU-02: the steps, texts and buttons of table 3 - the literals; 'Далее' from 1 to 6 and 'Назад' from 6 to 1: the counter, the title and the set of buttons of each step; tourStepView by table 3.2; the rule of truth over the texts of table 3", async () => {
  for (const [name, value] of Object.entries(T3)) {
    assert.deepEqual(plain(TX[name]), value, name);
  }
  deepFrozen(TX.TOUR_STEPS, "TOUR_STEPS");
  const page = await started(twoRoles(), {
    storageFn: () => fakeStorage(),
    now: S(30),
  });
  page.el("tour-invite-show").click();
  const visible = () =>
    [
      ["x", "×"],
      ["back", "Назад"],
      ["skip", "Пропустить"],
      ["next", "Далее"],
      ["last", "Закрыть тур"],
    ]
      .filter(([n]) => tourBtn(page, n).hidden !== true)
      .map(([, label]) => label);
  const expectedButtons = (n) => {
    if (n === 1) return ["×", "Пропустить", "Далее"];
    if (n === 6) return ["×", "Назад", "Закрыть тур"];
    return ["×", "Назад", "Пропустить", "Далее"];
  };
  const check = (n) => {
    assert.equal(tourStep(page), n);
    assert.equal(
      tourEl(page).byClass("tour-count")[0].textContent,
      `Шаг ${n} из 6`,
    );
    assert.equal(page.el("tour-title").textContent, T3.TOUR_STEPS[n - 1].title);
    assert.equal(page.el("tour-text").textContent, T3.TOUR_STEPS[n - 1].text);
    assert.deepEqual(visible(), expectedButtons(n), `step ${n}`);
  };
  check(1);
  for (let n = 2; n <= 6; n++) {
    tourBtn(page, "next").click();
    check(n);
  }
  for (let n = 5; n >= 1; n--) {
    tourBtn(page, "back").click();
    check(n);
  }
  assert.equal(tourBtn(page, "x").getAttribute("aria-label"), "Закрыть тур");
  tourBtn(page, "next").click();
  tourBtn(page, "skip").click();
  assert.equal(tourOpen(page), false);
  page.el("guide-open").click();
  guideEl(page).byClass("guide-tour-start")[0].click();
  for (let n = 2; n <= 6; n++) tourBtn(page, "next").click();
  tourBtn(page, "last").click();
  assert.equal(tourOpen(page), false);
  // tourStepView by the table of design 3.2
  const full = { characters: 2, nowShown: true, rows: 3, items: 2 };
  const none = { characters: 0, nowShown: false, rows: 0, items: 0 };
  const view = (n, f) => {
    const v = tourStepView(n, f);
    return [v.target, v.fallback, v.buttons.join(",")];
  };
  assert.deepEqual(view(1, full), [null, false, "close,skip,next"]);
  assert.deepEqual(view(2, full), ["office", false, "close,back,skip,next"]);
  assert.deepEqual(view(2, none), [null, true, "close,back,skip,next"]);
  assert.deepEqual(view(3, full), ["now", false, "close,back,skip,next"]);
  assert.deepEqual(view(3, { ...full, nowShown: false }), [
    null,
    true,
    "close,back,skip,next",
  ]);
  assert.deepEqual(view(4, full), ["journal", false, "close,back,skip,next"]);
  assert.deepEqual(view(4, none), ["journal", true, "close,back,skip,next"]);
  assert.deepEqual(view(5, full), ["tasks", false, "close,back,skip,next"]);
  assert.deepEqual(view(5, none), ["tasks", true, "close,back,skip,next"]);
  assert.deepEqual(view(6, none), ["guide", false, "close,back,last"]);
  assert.equal(tourStepView(2, none).text, T3.TOUR_STEPS[1].fallback);
  for (const bad of [0, 7, 1.5, "2", null, undefined]) {
    assert.equal(tourStepView(bad, full), null, String(bad));
  }
  // the rule of truth over table 3
  const titles = guideSections().map((s) => s.title);
  const texts = [
    T3.TOUR_INVITE,
    T3.KEYS_TOUR,
    ...T3.TOUR_STEPS.flatMap((s) => [s.title, s.text, s.fallback ?? ""]),
  ];
  const untrue = [];
  for (const t of texts) {
    for (const q of quotesOf(t))
      if (!isConstant(q, titles)) untrue.push(`«${q}» in: ${t}`);
  }
  assert.deepEqual(untrue, []);
  assert.deepEqual(texts.flatMap(clarityProblems), []);
});

test("TU-03: the real element is marked and the text instead - an empty journal before the first answer: steps 2 and 3 unmarked with the text instead, 4 and 5 marked with it; after the answer step 3 has #now; a journal with the main session and two roles: steps 2-6 mark their own element with the main text; 'Далее' takes the old mark off; closing leaves none; the first character at step 2 of an empty office brings the main text and the mark; a journal with only a row of the main session gives the main text at step 5; scrollIntoView with block 'nearest'", async () => {
  const targetsOf = (page) => ({
    office: page.el("office-panel"),
    now: page.el("now"),
    journal: page.el("journal").parentNode,
    tasks: page.el("tasks").parentNode,
    guide: openBtn(page),
  });
  const watch = (page) => {
    const calls = [];
    for (const [name, el] of Object.entries(targetsOf(page))) {
      el.scrollIntoView = (o) => calls.push([name, o]);
    }
    return calls;
  };
  const expect = (page, n, target, fallback) => {
    assert.equal(tourStep(page), n);
    const t = T3.TOUR_STEPS[n - 1];
    assert.equal(
      page.el("tour-text").textContent,
      fallback ? t.fallback : t.text,
      `step ${n}`,
    );
    const m = marked(page);
    if (target === null) assert.equal(m.length, 0, `step ${n} unmarked`);
    else {
      assert.equal(m.length, 1, `step ${n} one mark`);
      assert.ok(m[0] === targetsOf(page)[target], `step ${n} marks ${target}`);
    }
  };
  // before the first answer: the tour from the guide
  const early = makePage({ entries: [], storageFn: closedStore });
  early.server.mode = "hang";
  await early.start();
  const earlyCalls = watch(early);
  openBtn(early).click();
  guideEl(early).byClass("guide-tour-start")[0].click();
  expect(early, 1, null, false);
  tourBtn(early, "next").click();
  expect(early, 2, null, true);
  tourBtn(early, "next").click();
  expect(early, 3, null, true);
  tourBtn(early, "next").click();
  expect(early, 4, "journal", true);
  tourBtn(early, "next").click();
  expect(early, 5, "tasks", true);
  assert.deepEqual(earlyCalls, [
    ["journal", { block: "nearest" }],
    ["tasks", { block: "nearest" }],
  ]);
  // after the answer, the journal empty: #now is shown (its own text)
  const empty = await started([], { storageFn: () => fakeStorage() });
  empty.el("tour-invite-show").click();
  tourBtn(empty, "next").click();
  expect(empty, 2, null, true);
  tourBtn(empty, "next").click();
  expect(empty, 3, "now", false);
  tourBtn(empty, "next").click();
  expect(empty, 4, "journal", true);
  tourBtn(empty, "next").click();
  expect(empty, 5, "tasks", true);
  tourBtn(empty, "next").click();
  expect(empty, 6, "guide", false);
  tourBtn(empty, "last").click();
  assert.equal(marked(empty).length, 0);
  // the main session and two roles
  const page = await started(twoRoles(), {
    storageFn: () => fakeStorage(),
    now: S(30),
  });
  const calls = watch(page);
  page.el("tour-invite-show").click();
  expect(page, 1, null, false);
  const order = [
    [2, "office"],
    [3, "now"],
    [4, "journal"],
    [5, "tasks"],
    [6, "guide"],
  ];
  for (const [n, target] of order) {
    tourBtn(page, "next").click();
    expect(page, n, target, false);
  }
  assert.deepEqual(
    calls.map(([name, o]) => [name, o.block]),
    order.map(([, t]) => [t, "nearest"]),
  );
  tourBtn(page, "back").click();
  expect(page, 5, "tasks", false);
  assert.equal(openBtn(page).hasAttribute("data-tour-target"), false);
  tourBtn(page, "x").click();
  assert.equal(marked(page).length, 0);
  // the first character at step 2 of an empty office
  const grow = await started([], { storageFn: () => fakeStorage() });
  grow.el("tour-invite-show").click();
  tourBtn(grow, "next").click();
  expect(grow, 2, null, true);
  await grow.push(lineAt("SessionStart", "S1", S(1)));
  expect(grow, 2, "office", false);
  // only a row of the main session: step 5 has its main text
  const mainOnly = await started(
    [
      lineAt("SessionStart", "S1", S(1)),
      lineAt("UserPromptSubmit", "S1", S(2)),
    ],
    { storageFn: () => fakeStorage(), now: S(10) },
  );
  mainOnly.el("tour-invite-show").click();
  for (let n = 2; n <= 5; n++) tourBtn(mainOnly, "next").click();
  expect(mainOnly, 5, "tasks", false);
  // the journal replaced by an empty one at step 4: the text instead
  tourBtn(mainOnly, "back").click();
  expect(mainOnly, 4, "journal", false);
  mainOnly.server.entries = [];
  await mainOnly.tick(2000);
  expect(mainOnly, 4, "journal", true);
});

test("TU-04: the keyboard without a trap - the focus on 'Далее' at the opening; Tab from the last button of step 3 is not taken and the tour stays; 'Далее' from step 5 puts the focus on 'Закрыть тур'; 'Назад' keeps the focus or goes to 'Далее'; Escape at steps 1, 4 and 6 with the focus in the tour closes it, the focus on 'Как пользоваться'; Escape with the focus on 'Работа' closes it and keeps the focus; role dialog, aria-modal false, aria-live", async () => {
  const page = await started(twoRoles(), {
    storageFn: () => fakeStorage(),
    now: S(30),
  });
  const box = tourEl(page);
  assert.equal(box.getAttribute("role"), "dialog");
  assert.equal(box.getAttribute("aria-modal"), "false");
  assert.equal(box.getAttribute("aria-labelledby"), "tour-title");
  assert.equal(box.getAttribute("aria-describedby"), "tour-text");
  const live = box.byClass("tour-live")[0];
  assert.equal(live.getAttribute("aria-live"), "polite");
  assert.ok(within(page.el("tour-title"), live));
  assert.ok(within(page.el("tour-text"), live));
  assert.ok(within(box.byClass("tour-count")[0], live));
  const open = () => {
    page.el("tour-invite-show").hidden !== true &&
    !page.el("tour-invite").hidden
      ? page.el("tour-invite-show").click()
      : (() => {
          openBtn(page).click();
          guideEl(page).byClass("guide-tour-start")[0].click();
        })();
  };
  open();
  assert.ok(focused(page) === tourBtn(page, "next"));
  tourBtn(page, "next").click();
  assert.ok(
    focused(page) === tourBtn(page, "next"),
    "stays on the pressed one",
  );
  tourBtn(page, "back").click();
  assert.equal(tourStep(page), 1);
  assert.ok(
    focused(page) === tourBtn(page, "next"),
    "'Назад' is gone at step 1",
  );
  tourBtn(page, "next").click();
  tourBtn(page, "next").click();
  // step 3: the last button is "Далее"; Tab is not taken
  assert.equal(tourStep(page), 3);
  tourBtn(page, "next").focus();
  assert.equal(keyFrom(page, focused(page), "Tab"), false);
  tourBtn(page, "x").focus();
  assert.equal(keyFrom(page, focused(page), "Tab", { shiftKey: true }), false);
  assert.equal(key(page, "Tab"), false);
  assert.equal(tourOpen(page), true);
  tourBtn(page, "back").click();
  assert.ok(focused(page) === tourBtn(page, "back"));
  tourBtn(page, "next").click();
  tourBtn(page, "next").click();
  tourBtn(page, "next").click();
  assert.equal(tourStep(page), 5);
  tourBtn(page, "next").click();
  assert.equal(tourStep(page), 6);
  assert.ok(focused(page) === tourBtn(page, "last"));
  // Escape at steps 1, 4 and 6 with the focus in the tour
  for (const n of [1, 4, 6]) {
    if (!tourOpen(page)) open();
    while (tourStep(page) < n) tourBtn(page, "next").click();
    while (tourStep(page) > n) tourBtn(page, "back").click();
    tourBtn(page, "x").focus();
    assert.equal(esc(page), true);
    assert.equal(tourOpen(page), false, `step ${n}`);
    assert.ok(focused(page) === openBtn(page), `step ${n}`);
  }
  // Escape with the focus outside the tour: closed, the focus stays
  open();
  page.el("filter-work").focus();
  esc(page);
  assert.equal(tourOpen(page), false);
  assert.ok(focused(page) === page.el("filter-work"));
});

test("TU-05: the tour does not get in the way - with the filter 'Агент' and an open row, the tour, a new event: one row more, the same step; 'Работа' works and the tour stays; a card over it and Escape: the same step; 'Как пользоваться' opens the guide and closes the tour with 'closed'; without presses the tour changes no value and no scroll, and scrolls no target on refresh; no backdrop; only GET", async () => {
  const store = fakeStorage();
  const page = await started(twoRoles(), {
    storageFn: () => store,
    now: S(30),
  });
  const filterAgent = page.el("filter-agent");
  filterAgent.value = "role:Plan";
  filterAgent.fire("change");
  const rows = page.rows().map((r) => r.dataset.index);
  const open = rows[rows.length - 1];
  toggleAt(page, open).click();
  const scrolls = [];
  for (const el of [
    page.el("office-panel"),
    page.el("now"),
    page.el("journal").parentNode,
    page.el("tasks").parentNode,
    openBtn(page),
  ]) {
    el.scrollIntoView = () => scrolls.push(el);
  }
  page.el("tour-invite-show").click();
  tourBtn(page, "next").click();
  tourBtn(page, "next").click();
  assert.equal(tourStep(page), 3);
  const state = () => ({
    agent: page.el("filter-agent").value,
    work: page.el("filter-work").getAttribute("aria-pressed"),
    open: detailsOpen(page, open),
    selected: page
      .legend()
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.dataset.key),
    scroll: [page.el("journal").scrollTop, page.el("tasks").scrollTop],
  });
  const before = state();
  const scrolled = scrolls.length;
  await page.tick(10_000);
  assert.deepEqual(state(), before, "no change without presses");
  assert.equal(scrolls.length, scrolled, "no scroll on refresh");
  await page.push(
    lineAt("SubagentStop", "S1", S(8), {
      agent_id: "a1-00001",
      agent_type: "Plan",
    }),
  );
  assert.equal(page.rows().length, rows.length + 1);
  assert.equal(tourStep(page), 3);
  assert.equal(scrolls.length, scrolled, "no scroll on a new event");
  page.el("filter-work").click();
  assert.equal(page.el("filter-work").getAttribute("aria-pressed"), "true");
  assert.equal(tourStep(page), 3);
  clickCharacter(page, "role:Plan");
  assert.equal(cardOpen(page), true);
  assert.equal(tourStep(page), 3);
  esc(page);
  assert.equal(cardOpen(page), false);
  assert.equal(tourStep(page), 3);
  // no backdrop of the tour
  assert.equal(
    page.doc.root.all(
      (e) =>
        /tour/.test(e.id + e.className) &&
        /overlay|backdrop|catcher|shade/.test(e.id + e.className),
    ).length,
    0,
  );
  // the guide closes the tour and writes "closed"
  openBtn(page).click();
  assert.equal(guideOpen(page), true);
  assert.equal(tourOpen(page), false);
  assert.equal(store.values.get(KEY), "closed");
  for (const c of page.server.calls) assert.equal(c.init.method, "GET");
});

test("TU-06: the tour again from the guide - KEYS_TOUR right after 'Escape — …' in 'Клавиши'; with 'closed' stored: guide -> 'Показать тур по странице' closes the guide, step 1; Escape closes the tour, writes 'closed' again, the focus on 'Как пользоваться'; the button stands after the lead and before the table of contents", async () => {
  const keys = guideSections().find((s) => s.key === "keys").blocks[0].items;
  const at = keys.findIndex((t) => t.startsWith("Escape — "));
  assert.equal(
    keys[at + 1],
    "Escape закрывает и тур по странице — на любом шаге.",
  );
  const store = closedStore();
  const page = await started([], { storageFn: () => store });
  assert.equal(inviteShown(page), false);
  openBtn(page).click();
  const body = guideEl(page).byClass("guide-body")[0];
  const start = body.byClass("guide-tour-start")[0];
  assert.equal(start.textContent, "Показать тур по странице");
  assert.equal(start.getAttribute("type"), "button");
  const kids = body.children;
  assert.ok(kids[kids.indexOf(start) - 1].classes.has("guide-lead"));
  assert.equal(kids[kids.indexOf(start) + 1].tagName, "NAV");
  press(start, "Enter");
  assert.equal(guideOpen(page), false);
  assert.equal(tourStep(page), 1);
  const writes = store.calls.filter(([n]) => n === "setItem").length;
  esc(page);
  assert.equal(tourOpen(page), false);
  assert.equal(store.calls.filter(([n]) => n === "setItem").length, writes + 1);
  assert.equal(store.values.get(KEY), "closed");
  assert.ok(focused(page) === openBtn(page));
});
const press = (el, name) => el.fire("keydown", { key: name });

test("TU-07: the look of the tour - the texts of its rules reach 4.5 to 1 against its background; the mark of a step is a frame of 0.1875rem in --warn with 3 to 1 against the panels; no transition or animation in the rules of the tour and of the mark", () => {
  const isTour = (s) => /\.tour|#tour|data-tour/.test(s);
  const { rules, own, pairs, low, hex, ratio } = contrastOf(isTour, ".tour");
  assert.ok(pairs >= 4, `${pairs} pairs`);
  assert.deepEqual(low, []);
  const mark = cssValue(cssCascade(rules, "[data-tour-target]"), "box-shadow");
  assert.match(mark, /0\.1875rem var\(--warn\)/);
  const warn = hex("var(--warn)");
  for (const bg of ["var(--panel)", "var(--panel-2)", "var(--bg)"]) {
    assert.ok(ratio(warn, hex(bg)) >= 3, `--warn on ${bg}`);
  }
  for (const r of own) {
    for (const [name] of r.list) {
      assert.equal(
        /^(transition|animation)/.test(name),
        false,
        r.selectors.join(),
      );
    }
  }
});

test("TU-08: bad conditions do not break the tour - the link lost during the tour, the journal replaced by an empty one at step 4, setItem throws at closing, twenty openings from the guide: one tour and at most one mark; a pinned hint closes when the tour opens; a hint opened during the tour closes first with Escape, then the tour; Escape with the tour open does not close the open row", async () => {
  const errors = mock.method(console, "error", () => {});
  try {
    const page = await started(twoRoles(), {
      storageFn: () => fakeStorage(),
      now: S(30),
    });
    // a pinned hint "Журнал", then "Показать": the hint is hidden
    hintBtn(page, "journal").click();
    assert.equal(hintOpen(page, "journal"), true);
    page.el("tour-invite-show").click();
    assert.equal(tourStep(page), 1);
    assert.equal(hintOpen(page, "journal"), false);
    // a hint during the tour: Escape the hint, then the tour
    hintBtn(page, "tasks").click();
    assert.equal(hintOpen(page, "tasks"), true);
    esc(page);
    assert.equal(hintOpen(page, "tasks"), false);
    assert.equal(tourOpen(page), true);
    // Escape with the tour does not close an open row
    toggleAt(page, 3).click();
    assert.equal(detailsOpen(page, 3), true);
    esc(page);
    assert.equal(tourOpen(page), false);
    assert.equal(detailsOpen(page, 3), true);
    // the link lost during the tour: the step and the text stay
    openBtn(page).click();
    guideEl(page).byClass("guide-tour-start")[0].click();
    tourBtn(page, "next").click();
    const text = page.el("tour-text").textContent;
    page.server.mode = "fail";
    await page.tick(2000);
    await page.tick(10_000);
    assert.equal(page.el("link").dataset.state, "down");
    assert.equal(tourStep(page), 2);
    assert.equal(page.el("tour-text").textContent, text);
    // the journal replaced by an empty one at step 4
    page.server.mode = "ok";
    tourBtn(page, "next").click();
    tourBtn(page, "next").click();
    assert.equal(tourStep(page), 4);
    page.server.entries = [];
    await page.tick(2000);
    assert.equal(page.el("tour-text").textContent, T3.TOUR_STEPS[3].fallback);
    assert.equal(marked(page).length, 1);
    // twenty openings from the guide
    for (let i = 0; i < 20; i++) {
      openBtn(page).click();
      guideEl(page).byClass("guide-tour-start")[0].click();
      tourBtn(page, "next").click();
      assert.ok(marked(page).length <= 1);
      if (i % 2 === 0) tourBtn(page, "x").click();
    }
    assert.equal(page.doc.root.all((e) => e.id === "tour").length, 1);
    assert.equal(
      page.doc.root.all((e) => e.classes.has("tour-buttons")).length,
      1,
    );
    assert.ok(marked(page).length <= 1);
    // setItem throws at closing: the tour closes, no exception
    const bad = fakeStorage();
    bad.failSet = true;
    const p2 = await started([], { storageFn: () => bad });
    p2.el("tour-invite-show").click();
    tourBtn(p2, "skip").click();
    assert.equal(tourOpen(p2), false);
    for (const p of [page, p2]) assert.doesNotMatch(seen(p.doc.root), SERVICE);
    assert.equal(errors.mock.calls.length, 0, "reportOnce was not called");
  } finally {
    errors.mock.restore();
  }
});

// ===================================================================== REQ-053

const HINT_LABELS = {
  now: "Подсказка: Сейчас",
  journal: "Подсказка: Журнал",
  tasks: "Подсказка: Задачи",
  office: "Подсказка: Офис и доска",
};

test("HN-01: four hints - aria-label and aria-describedby to a tooltip; mouseenter / mouseleave, focus / blur; a press pins (it stays after mouseleave), a second press closes; Escape closes with the focus on its button and leaves the open row; pinned, the focus on the search, Escape: closed, the focus and the row stay; pinned, a press on a row closes it and opens the row, a press inside it keeps it; a second hint closes the first; 'Показать' closes a pinned one; during the tour Escape closes the hint first; the last line is HINT_CLOSE; KEYS_HINT after KEYS_TOUR; the literals of table 4", async () => {
  for (const [name, value] of Object.entries(T4)) {
    assert.deepEqual(plain(TX[name]), value, name);
  }
  deepFrozen(TX.HINTS, "HINTS");
  assert.deepEqual([...HINT_KEYS], ["now", "journal", "tasks", "office"]);
  const keys = guideSections().find((s) => s.key === "keys").blocks[0].items;
  assert.equal(keys.indexOf(T4.KEYS_HINT), keys.indexOf(T3.KEYS_TOUR) + 1);
  const page = await started(twoRoles(), {
    storageFn: () => fakeStorage(),
    now: S(30),
  });
  for (const name of HINT_KEYS) {
    const b = hintBtn(page, name);
    const tip = hintTip(page, name);
    assert.equal(b.tagName, "BUTTON");
    assert.equal(b.getAttribute("type"), "button");
    assert.equal(b.textContent, "?");
    assert.equal(b.getAttribute("aria-label"), HINT_LABELS[name]);
    assert.equal(tip.getAttribute("role"), "tooltip");
    assert.equal(tip.hidden, true);
    assert.deepEqual(
      tip.children.map((p) => p.textContent),
      [T4.HINTS[name], T4.HINT_CLOSE],
    );
    b.fire("mouseenter");
    assert.equal(hintOpen(page, name), true, `${name}: mouseenter`);
    // the mouse leaves the "?" (also onto the hint itself): closed (review)
    b.fire("mouseleave");
    assert.equal(hintOpen(page, name), false, `${name}: mouseleave`);
    b.fire("focus");
    assert.equal(hintOpen(page, name), true);
    b.fire("blur");
    assert.equal(hintOpen(page, name), false);
    b.click();
    assert.equal(hintOpen(page, name), true);
    assert.equal(b.getAttribute("data-pinned"), "true");
    b.fire("mouseleave");
    b.fire("blur");
    assert.equal(hintOpen(page, name), true, `${name}: pinned stays`);
    b.click();
    assert.equal(hintOpen(page, name), false);
    assert.equal(b.getAttribute("data-pinned"), "false");
  }
  // Escape with the focus on the button: closed, the focus there, the open
  // row stays open
  toggleAt(page, 3).click();
  const now = hintBtn(page, "now");
  now.focus();
  now.click();
  assert.equal(esc(page), true);
  assert.equal(hintOpen(page, "now"), false);
  assert.ok(focused(page) === now);
  assert.equal(detailsOpen(page, 3), true);
  // pinned, the focus on the search: Escape closes the hint only
  hintBtn(page, "journal").click();
  page.el("journal-search").focus();
  esc(page);
  assert.equal(hintOpen(page, "journal"), false);
  assert.ok(focused(page) === page.el("journal-search"));
  assert.equal(detailsOpen(page, 3), true);
  // pinned: a press inside the hint keeps it; a press on a row closes it and
  // the press works on the page
  hintBtn(page, "office").click();
  page.doc.fire("click", { target: hintTip(page, "office").children[0] });
  assert.equal(hintOpen(page, "office"), true);
  page.doc.fire("click", { target: hintBtn(page, "office") });
  assert.equal(hintOpen(page, "office"), true);
  toggleAt(page, 2).click();
  page.doc.fire("click", { target: toggleAt(page, 2) });
  assert.equal(hintOpen(page, "office"), false);
  assert.equal(detailsOpen(page, 2), true);
  // a second hint closes the first
  hintBtn(page, "now").fire("mouseenter");
  hintBtn(page, "tasks").fire("focus");
  assert.equal(hintOpen(page, "now"), false);
  assert.equal(hintOpen(page, "tasks"), true);
  assert.equal(
    page.doc.root.all((e) => e.getAttribute("role") === "tooltip" && !e.hidden)
      .length,
    1,
  );
  hintBtn(page, "tasks").fire("blur");
  // "Показать" closes a pinned hint; a hint during the tour goes first
  hintBtn(page, "journal").click();
  page.el("tour-invite-show").click();
  assert.equal(hintOpen(page, "journal"), false);
  hintBtn(page, "tasks").click();
  esc(page);
  assert.equal(hintOpen(page, "tasks"), false);
  assert.equal(tourOpen(page), true);
  esc(page);
  assert.equal(tourOpen(page), false);
});

test("HN-02: the places of the hints - in #now, in the line of the heading of the journal right after it, in the head of 'Задачи' after its heading, in div.office-hint inside #office-inner right before ul#legend; the legend keeps its number of items", async () => {
  const page = await started(twoRoles(), {
    storageFn: closedStore,
    now: S(30),
  });
  assert.ok(hintBtn(page, "now").parentNode === page.el("now"));
  const journalRow = page.el("journal-title").parentNode;
  assert.ok(hintBtn(page, "journal").parentNode === journalRow);
  assert.equal(
    journalRow.children.indexOf(hintBtn(page, "journal")),
    journalRow.children.indexOf(page.el("journal-title")) + 1,
  );
  const tasksHead = page.el("tasks-title").parentNode;
  assert.ok(hintBtn(page, "tasks").parentNode === tasksHead);
  assert.ok(
    tasksHead.children.indexOf(hintBtn(page, "tasks")) >
      tasksHead.children.indexOf(page.el("tasks-title")),
  );
  const officeHint = page.el("office-hint");
  assert.ok(officeHint.classes.has("office-hint"));
  assert.ok(hintBtn(page, "office").parentNode === officeHint);
  const inner = page.el("office-inner");
  assert.ok(officeHint.parentNode === inner);
  assert.ok(
    inner.children[inner.children.indexOf(officeHint) + 1] ===
      page.el("legend"),
  );
  assert.equal(within(hintBtn(page, "office"), page.el("legend")), false);
  assert.equal(
    page.el("legend").children.length,
    page.app.getOffice().characters.length,
  );
  // one hint per button
  for (const name of HINT_KEYS) {
    assert.equal(page.doc.root.all((e) => e.id === `hint-${name}`).length, 1);
  }
});

test("HN-03: the empty journal teaches - the texts in order, an ol of four steps, the button 'Как пользоваться' opens the guide and Escape gives the focus back to it (also after the journal is drawn again); filters without rows, no link before the answer and the first row show no steps; the empty journal is read from its top", async () => {
  const page = makePage({ entries: [], storageFn: closedStore });
  page.el("journal").clientHeight = 10;
  await page.start();
  const note = page.el("journal").byClass("journal-empty")[0];
  assert.equal(note.dataset.reason, "empty");
  assert.deepEqual(
    note.children.map((e) => [e.tagName, e.className]),
    [
      ["SPAN", "empty-title"],
      ["SPAN", "empty-hint"],
      ["P", "empty-steps-title"],
      ["OL", "empty-steps"],
      ["BUTTON", "guide-open-empty ctl"],
    ],
  );
  assert.equal(note.children[0].textContent, "Событий от Claude Code пока нет");
  assert.equal(note.children[1].textContent, TX.EMPTY_HINT);
  assert.equal(note.children[2].textContent, "Чтобы здесь появились события:");
  assert.deepEqual(
    note.children[3].children.map((li) => li.textContent),
    T4.EMPTY_STEPS,
  );
  const button = note.children[4];
  assert.equal(button.getAttribute("type"), "button");
  assert.equal(button.getAttribute("aria-label"), "Как пользоваться");
  assert.equal(button.textContent, "?Как пользоваться");
  assert.equal(page.el("journal").scrollTop, 0, "read from the top");
  button.click();
  assert.equal(guideOpen(page), true);
  // the journal is drawn again while the guide is open
  await page.tick(10_000);
  const fresh = () => page.el("journal").byClass("guide-open-empty")[0];
  assert.equal(esc(page), true);
  assert.equal(guideOpen(page), false);
  assert.ok(
    focused(page) === fresh(),
    "the focus on the button of the empty journal",
  );
  // the first row: no steps
  await page.push(lineAt("SessionStart", "S1", S(1)));
  assert.equal(page.el("journal").byClass("empty-steps").length, 0);
  // filters without rows: the old text, no steps
  page.el("filter-type").value = "stop";
  page.el("filter-type").fire("change");
  const filtered = page.el("journal").byClass("journal-empty")[0];
  assert.equal(filtered.dataset.reason, "filtered");
  assert.equal(filtered.byClass("empty-steps").length, 0);
  assert.equal(filtered.byClass("guide-open-empty").length, 0);
  // no link before the first answer: the old text, no steps
  const down = makePage({ entries: [], storageFn: closedStore });
  down.server.mode = "fail";
  await down.start();
  const n = down.el("journal").byClass("journal-empty")[0];
  assert.equal(n.dataset.reason, "no-connection");
  assert.equal(n.textContent, TX.NO_CONNECTION);
  assert.equal(down.el("journal").byClass("empty-steps").length, 0);
});

test("HN-04: the empty office teaches - after an answer with an empty journal #office-note is seen with OFFICE_EMPTY; a SessionStart hides it; without a canvas it keeps CANVAS_UNSUPPORTED; before the first answer it is hidden", async () => {
  const early = makePage({ entries: [], storageFn: closedStore });
  early.server.mode = "hang";
  await early.start();
  assert.equal(early.el("office-note").hidden, true);
  assert.equal(early.el("office-note").textContent, "");
  const page = await started([], { storageFn: closedStore });
  assert.equal(page.el("office-note").hidden, false);
  assert.equal(page.el("office-note").textContent, T4.OFFICE_EMPTY);
  await page.push(lineAt("SessionStart", "S1", S(1)));
  assert.equal(page.el("office-note").hidden, true);
  const bare = makePage({ entries: [], storageFn: closedStore, canvas: false });
  await bare.start();
  assert.equal(bare.el("office-note").hidden, false);
  assert.equal(bare.el("office-note").textContent, TX.CANVAS_UNSUPPORTED);
});

test("HN-05: the empty panel 'Задачи' teaches - an empty journal: TASKS_EMPTY in 'Текущие' and no NOW_EMPTY, 'Нет данных' in 'История' and 'Запуски сервера'; one finished task: NOW_EMPTY and no TASKS_EMPTY", async () => {
  const page = await started([], { storageFn: closedStore });
  const empties = page
    .el("tasks")
    .byClass("section-empty")
    .map((p) => p.textContent);
  assert.deepEqual(empties, [T4.TASKS_EMPTY, "Нет данных", "Нет данных"]);
  assert.equal(page.text("tasks").includes(TX.NOW_EMPTY), false);
  const done = await started(
    [
      lineAt("SessionStart", "S1", S(1)),
      lineAt("SubagentStart", "S1", S(2), {
        agent_id: "d1",
        agent_type: "Plan",
      }),
      lineAt("SubagentStop", "S1", S(3), {
        agent_id: "d1",
        agent_type: "Plan",
      }),
    ],
    { storageFn: closedStore, now: S(10) },
  );
  const first = done.el("tasks").byClass("section-empty")[0].textContent;
  assert.equal(first, "в работе ничего нет");
  assert.equal(done.text("tasks").includes(T4.TASKS_EMPTY), false);
});

test("HN-06: the texts of table 4 are true and plain, the hints and empty states are text and do not break - phrases, 'вы', no unclear words, a quote in every hint; the rule of truth; the colours of the hints and empty states; no transition; the link lost with a pinned hint; the journal replaced by an empty one shows the three empty states; twenty openings keep one tooltip per button; only GET; no exception", async () => {
  const texts = [
    ...Object.values(T4.HINTS),
    T4.HINT_CLOSE,
    T4.EMPTY_STEPS_TITLE,
    ...T4.EMPTY_STEPS,
    T4.KEYS_HINT,
    T4.OFFICE_EMPTY,
    T4.TASKS_EMPTY,
  ];
  assert.deepEqual(texts.flatMap(clarityProblems), []);
  for (const [name, t] of Object.entries(T4.HINTS)) {
    assert.ok(quotesOf(t).length > 0, `a quote in the hint ${name}`);
  }
  const titles = guideSections().map((s) => s.title);
  const untrue = [];
  for (const t of texts) {
    for (const q of quotesOf(t))
      if (!isConstant(q, titles)) untrue.push(`«${q}» in: ${t}`);
  }
  assert.deepEqual(untrue, []);
  // colours
  const hints = contrastOf((s) => /\.hint-/.test(s), ".hint-tip");
  assert.ok(hints.pairs >= 2);
  assert.deepEqual(hints.low, []);
  const empty = contrastOf(
    (s) => /empty-steps|guide-open-empty|office-note/.test(s),
    ".panel",
  );
  assert.deepEqual(empty.low, []);
  for (const r of [...hints.own, ...empty.own]) {
    for (const [name] of r.list) {
      assert.equal(
        /^(transition|animation)/.test(name),
        false,
        r.selectors.join(),
      );
    }
  }
  // bad conditions
  const errors = mock.method(console, "error", () => {});
  try {
    const page = await started(twoRoles(), {
      storageFn: closedStore,
      now: S(30),
    });
    hintBtn(page, "journal").click();
    const text = hintTip(page, "journal").textContent;
    page.server.mode = "fail";
    await page.tick(2000);
    await page.tick(10_000);
    assert.equal(hintOpen(page, "journal"), true);
    assert.equal(hintTip(page, "journal").textContent, text);
    hintBtn(page, "journal").click();
    // the journal replaced by an empty one: three empty states
    page.server.mode = "ok";
    page.server.entries = [];
    await page.tick(2000);
    assert.equal(page.el("journal").byClass("empty-steps").length, 1);
    assert.equal(page.el("office-note").textContent, T4.OFFICE_EMPTY);
    assert.equal(
      page.el("tasks").byClass("section-empty")[0].textContent,
      T4.TASKS_EMPTY,
    );
    // twenty openings and closings of each hint
    const rows = page.rows().length;
    for (let i = 0; i < 20; i++) {
      for (const name of HINT_KEYS) {
        hintBtn(page, name).click();
        if (i % 2 === 0) esc(page);
        else hintBtn(page, name).click();
      }
    }
    for (const name of HINT_KEYS) {
      assert.equal(page.doc.root.all((e) => e.id === `hint-${name}`).length, 1);
      assert.equal(hintOpen(page, name), false);
    }
    assert.equal(page.rows().length, rows);
    for (const c of page.server.calls) assert.equal(c.init.method, "GET");
    assert.equal(page.doc.htmlWrites, 0);
    assert.doesNotMatch(seen(page.doc.root), SERVICE);
    assert.equal(errors.mock.calls.length, 0, "reportOnce was not called");
  } finally {
    errors.mock.restore();
  }
});

test("HN-02: a hint stands over the page by its own button (decision N2 of ORCH: position fixed with the anchor of its button, the plain value first) and the narrow rule hides only the text of the button of the header (N4)", () => {
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  assert.equal(cssValue(cssCascade(rules, ".hint-tip"), "position"), "fixed");
  for (const name of HINT_KEYS) {
    const anchor = cssCascade(
      rules,
      `.hint-btn[aria-describedby="hint-${name}"]`,
    );
    assert.equal(cssValue(anchor, "anchor-name"), `--hint-${name}`);
    const place = cssCascade(rules, `#hint-${name}`);
    const side = name === "office" ? "bottom" : "top";
    const pair = place.filter(([n]) => n === side).map(([, v]) => v);
    assert.equal(pair.length, 2, name);
    assert.equal(pair[0].includes("anchor"), false, `${name}: plain first`);
    assert.ok(pair[1].includes(`anchor(--hint-${name} `), name);
    const lefts = place.filter(([n]) => n === "left").map(([, v]) => v);
    assert.equal(lefts[lefts.length - 1], `anchor(--hint-${name} left)`);
  }
  const NARROW = "@media (max-width: 599px)";
  const hiding = rules.filter(
    (r) =>
      r.media === NARROW &&
      r.selectors.some((s) => /guide-open-text/.test(s)) &&
      r.list.some(([n, v]) => n === "display" && v === "none"),
  );
  assert.deepEqual(
    hiding.flatMap((r) => r.selectors),
    [".guide-open .guide-open-text"],
  );
});

test("TU-01: the invitation shown or removed measures the line 'Сейчас' again (decision N5 of ORCH) - 'Показать всех (N)' follows the room the header leaves", async () => {
  const page = makePage({
    entries: [
      lineAt("SessionStart", "S0", S(1)),
      lineAt("UserPromptSubmit", "S0", S(2)),
      ...["Plan", "Explore"].map((role, i) =>
        lineAt("SubagentStart", "S0", S(3 + i), {
          agent_id: `m${i}`,
          agent_type: role,
        }),
      ),
    ],
    storageFn: () => fakeStorage(),
    now: S(30),
  });
  page.doc.onCreate = (el) => {
    if (el.tagName === "SPAN") {
      el.rowHeight = 18;
      el.clientHeight = 36;
    }
  };
  await page.start();
  const showAll = page.el("now").byClass("now-show-all")[0];
  assert.equal(inviteShown(page), true);
  assert.equal(showAll.hidden, false);
  // the header gets wider when the invitation goes: the rows fit now
  page.el("now-text").byClass("now-list")[0].clientHeight = 200;
  page.el("tour-invite-later").click();
  assert.equal(inviteShown(page), false);
  assert.equal(showAll.hidden, true);
});

// ============================================================ rework r2 (13.8)

// The texts of the cards of table 2 (criterion 8 REQ-051), word for word.
const T2_CARD = {
  ROLE_ABOUT_UNKNOWN: "Описания этой роли нет: так её назвал Claude Code.",
  MAIN_ABOUT:
    "Ваш разговор с Claude Code. Он принимает ваши сообщения и запускает агентов.",
  CARD_INSTANCE: "номер запуска",
  CARD_SESSION: "номер разговора",
  WORKPLACE_DESK:
    "Стол в офисе — просто место роли на рисунке. Настоящих компьютеров страница не показывает.",
  MAIN_DESK:
    "Стол в офисе — просто место основной сессии на рисунке. Настоящих компьютеров страница не показывает.",
  AGENT_NOT_RECORDED:
    "Что агент делает внутри — читает файлы, запускает команды, вносит правки, — Claude Code не сообщает.",
  FRESH_LIMIT:
    "если событий нет дольше {m} минут, страница пишет «нет свежих данных»: работа могла идти, но подтверждений нет",
  HANDOFF:
    "Агент может поручить часть работы другой роли. Эта строка — такое поручение: основная сессия или агент запустили агента этой роли. Описание написал тот, кто поручил (до 100 знаков). Если запустивший ждёт ответа, строка приходит после конца работы агента; если нет — сразу при запуске.",
  TASK_MARK: "Задача: {role} номер {id}",
  FILTER_SESSION_OPTION: "Сессия номер {id} · с {time}",
};
// The texts of the line about the tour (table 3, criterion 1 REQ-052).
const T3_LATER = {
  TOUR_LATER_NOTE:
    "Тур можно открыть позже: «Как пользоваться» → «Показать тур по странице».",
  TOUR_LATER_CLOSE: "Скрыть подсказку о туре",
};

test("GR-06: the card is plain to a non-programmer - right under the title of a card of an instance the description of its role (GUIDE_ROLE_ABOUT), for a role out of the table, an empty role and <img> the text ROLE_ABOUT_UNKNOWN, for the main session MAIN_ABOUT; 'номер запуска … · номер разговора …'; the phrases about the desk, the agent, the age and the handoff by table 2; 'номер' in the mark 'Задача'", async () => {
  assert.equal(TX.ROLE_ABOUT_UNKNOWN, T2_CARD.ROLE_ABOUT_UNKNOWN);
  assert.equal(TX.MAIN_ABOUT, T2_CARD.MAIN_ABOUT);
  assert.equal(TX.CARD_INSTANCE, T2_CARD.CARD_INSTANCE);
  assert.equal(TX.CARD_SESSION, T2_CARD.CARD_SESSION);
  assert.equal(TX.WORKPLACE_DESK, T2_CARD.WORKPLACE_DESK);
  assert.equal(TX.MAIN_CARD.desk, T2_CARD.MAIN_DESK);
  assert.equal(TX.AGENT_NOT_RECORDED, T2_CARD.AGENT_NOT_RECORDED);
  assert.equal(TX.FRESH_LIMIT, T2_CARD.FRESH_LIMIT);
  assert.equal(TX.EVENT_TABLE.handoff.meaning, T2_CARD.HANDOFF);
  assert.equal(TX.GIVEN_NOTE, T2_CARD.HANDOFF, "one text for both places");
  assert.equal(TX.TASK_MARK, T2_CARD.TASK_MARK);
  assert.equal(TX.FILTER_SESSION_OPTION, T2_CARD.FILTER_SESSION_OPTION);
  assert.deepEqual(
    Object.values(T2_CARD).flatMap((t) =>
      clarityProblems(t.replace(/\{\w+\}/g, "X")),
    ),
    [],
  );
  const SEC = "Sai Security Reviewer (SECURITY-REVIEWER)";
  const IMG = "<img src=x onerror=alert(1)>";
  const entries = [
    lineAt("SessionStart", "S1", S(1)),
    lineAt("UserPromptSubmit", "S1", S(2), { prompt_kind: "owner" }),
    lineAt("PostToolUse", "S1", S(3), {
      tool_use_id: "tu-s1",
      launched_agent_id: "sec-0001",
      subagent_type: SEC,
      description: "Образец проверки",
    }),
    lineAt("SubagentStart", "S1", S(4), {
      agent_id: "sec-0001",
      agent_type: SEC,
    }),
    lineAt("SubagentStart", "S1", S(5), {
      agent_id: "exp-0001",
      agent_type: "Explore",
    }),
    lineAt("SubagentStart", "S1", S(6), { agent_id: "unk-0001" }),
    lineAt("SubagentStart", "S1", S(7), {
      agent_id: "img-0001",
      agent_type: IMG,
    }),
    lineAt("SubagentStart", "S1", S(8), {
      agent_id: "orc-0001",
      agent_type: "Sai Orchestrator (ORCH)",
    }),
  ];
  const page = await started(entries, { storageFn: closedStore, now: S(30) });
  const card = () => page.el("card");
  const about = () => {
    const head = card().byClass("card-head")[0];
    const title = head.byClass("card-title")[0];
    const next = head.children[head.children.indexOf(title) + 1];
    assert.ok(
      next.classes.has("card-about"),
      "the description right after the title",
    );
    return next.textContent;
  };
  const open = (key) =>
    page
      .legend()
      .find((b) => b.dataset.key === key)
      .click();
  open(`role:${SEC}`);
  assert.equal(about(), T2.GUIDE_ROLE_ABOUT["SECURITY-REVIEWER"]);
  assert.equal(about().includes("SECURITY-REVIEWER"), false);
  const ids = card().byClass("card-ids")[0].textContent;
  assert.ok(ids.startsWith("номер запуска "), ids);
  assert.ok(ids.includes(" · номер разговора "), ids);
  assert.equal(ids, "номер запуска sec-0001 · номер разговора S1");
  // the lines of the state: the agent, the age with the minutes
  const basis = card()
    .byClass("state-basis")
    .map((e) => e.textContent);
  assert.ok(basis.includes(T2_CARD.AGENT_NOT_RECORDED));
  assert.ok(
    basis.some((t) => t.endsWith(T2_CARD.FRESH_LIMIT.replace("{m}", "60"))),
  );
  assert.ok(basis.includes(T2_CARD.WORKPLACE_DESK));
  // "Задание передано": the new text of the handoff
  const given = card().find((e) => e.dataset.part === "given");
  given.children[0].click();
  assert.deepEqual(
    given.byClass("entry-note").map((e) => e.textContent),
    [T2_CARD.HANDOFF],
  );
  assert.ok(
    T2_CARD.HANDOFF.startsWith(
      "Агент может поручить часть работы другой роли.",
    ),
  );
  esc(page);
  for (const key of [
    "role:Explore",
    `role:${TX.ROLE_UNKNOWN}`,
    `role:${IMG}`,
  ]) {
    open(key);
    assert.equal(about(), T2_CARD.ROLE_ABOUT_UNKNOWN, key);
    esc(page);
  }
  assert.equal(page.created("img").length, 0);
  // a description of several phrases is shown whole (not its first phrase)
  open("role:Sai Orchestrator (ORCH)");
  assert.equal(about(), T2.GUIDE_ROLE_ABOUT.ORCH);
  assert.ok(phrasesOf(about()).length >= 2, "the description has two phrases");
  esc(page);
  // the main session
  open("main");
  assert.equal(about(), T2_CARD.MAIN_ABOUT);
  assert.equal(card().byClass("card-ids")[0].textContent, "номер разговора S1");
  const desk = card()
    .byClass("state-basis")
    .map((e) => e.textContent);
  assert.ok(desk.includes(T2_CARD.MAIN_DESK));
  esc(page);
  // the details of the handoff row in the journal: the same text
  toggleAt(page, 2).click();
  assert.ok(
    rowAt(page, 2)
      .find((e) => e.dataset.field === "what")
      .textContent.includes(T2_CARD.HANDOFF),
  );
  // "номер" in the mark of the filter "Задача" and in the sessions
  toggleAt(page, 3).click();
  rowAt(page, 3)
    .find((e) => e.dataset.focus === "go:task-events")
    .click();
  assert.equal(
    page.el("journal-task-mark").byClass("task-mark-text")[0].textContent,
    "Задача: Проверка безопасности номер sec-0001",
  );
  assert.ok(
    page
      .el("filter-session")
      .children.some((o) => o.textContent.startsWith("Сессия номер S1 · с ")),
  );
});

test("TU-01: the line about the tour (criterion 1 REQ-052, design D20) - after 'Не сейчас' and after Escape in the invitation a line TOUR_LATER_NOTE with '×' in a live region, the focus on 'Как пользоваться'; after 10 s it is gone, '×' removes it at once; it stands before the invitation; not after closing the tour; a tour opened before 10 s removes it; gone by the timer with the focus on its '×', the focus goes to 'Как пользоваться'; not in the order of Escape", async () => {
  assert.equal(TX.TOUR_LATER_NOTE, T3_LATER.TOUR_LATER_NOTE);
  assert.equal(TX.TOUR_LATER_CLOSE, T3_LATER.TOUR_LATER_CLOSE);
  const lineEl = (p) => p.el("tour-later");
  const lineShown = (p) => lineEl(p).children.length > 0;
  let page = await started([], { storageFn: () => fakeStorage() });
  const later = lineEl(page);
  assert.equal(later.getAttribute("aria-live"), "polite");
  assert.equal(lineShown(page), false);
  // the place: the line before the invitation, the invitation right before
  // "Как пользоваться"
  const header = later.parentNode;
  const kids = header.children;
  assert.ok(kids[kids.indexOf(later) + 1] === page.el("tour-invite"));
  assert.ok(kids[kids.indexOf(page.el("tour-invite")) + 1] === openBtn(page));
  page.el("tour-invite-later").focus();
  page.el("tour-invite-later").click();
  assert.equal(inviteShown(page), false);
  assert.equal(lineShown(page), true);
  assert.equal(
    later.byClass("tour-later-text")[0].textContent,
    T3_LATER.TOUR_LATER_NOTE,
  );
  const x = later.byClass("tour-later-x")[0];
  assert.equal(x.getAttribute("aria-label"), T3_LATER.TOUR_LATER_CLOSE);
  assert.equal(x.getAttribute("type"), "button");
  assert.ok(focused(page) === openBtn(page));
  // not in the order of Escape
  assert.equal(esc(page), false);
  assert.equal(lineShown(page), true);
  page.clock.advance(9000);
  assert.equal(lineShown(page), true, "still there at 9 s");
  page.clock.advance(2000);
  assert.equal(lineShown(page), false, "gone at 11 s");
  assert.ok(focused(page) === openBtn(page));
  // Escape in the invitation: the same line; "×" removes it at once
  page = await started([], { storageFn: () => fakeStorage() });
  page.el("tour-invite-show").focus();
  esc(page);
  assert.equal(lineShown(page), true);
  assert.ok(focused(page) === openBtn(page));
  lineEl(page).byClass("tour-later-x")[0].click();
  assert.equal(lineShown(page), false);
  assert.ok(focused(page) === openBtn(page));
  // "Не сейчас" pressed without the focus on it (a touch): the focus also
  // goes to "Как пользоваться"
  page = await started([], { storageFn: () => fakeStorage() });
  page.el("filter-all").focus();
  page.el("tour-invite-later").click();
  assert.equal(lineShown(page), true);
  assert.ok(focused(page) === openBtn(page));
  // gone by the timer with the focus on its "×": the focus to the button;
  // with the focus elsewhere it stays
  page = await started([], { storageFn: () => fakeStorage() });
  page.el("tour-invite-later").click();
  lineEl(page).byClass("tour-later-x")[0].focus();
  page.clock.advance(10_000);
  assert.equal(lineShown(page), false);
  assert.ok(focused(page) === openBtn(page));
  page = await started([], { storageFn: () => fakeStorage() });
  page.el("tour-invite-later").click();
  page.el("filter-all").focus();
  page.clock.advance(10_000);
  assert.equal(lineShown(page), false);
  assert.ok(focused(page) === page.el("filter-all"));
  // a tour from the guide before 10 s removes the line, and it does not come
  // back
  page = await started([], { storageFn: () => fakeStorage() });
  page.el("tour-invite-later").click();
  assert.equal(lineShown(page), true);
  openBtn(page).click();
  guideEl(page).byClass("guide-tour-start")[0].click();
  assert.equal(tourStep(page), 1);
  assert.equal(lineShown(page), false);
  page.clock.advance(10_000);
  assert.equal(lineShown(page), false);
  // closing the tour shows no line
  tourBtn(page, "x").click();
  assert.equal(lineShown(page), false);
  const shown = await started([], { storageFn: () => fakeStorage() });
  shown.el("tour-invite-show").click();
  tourBtn(shown, "skip").click();
  assert.equal(lineShown(shown), false);
  // a second "Не сейчас" is not possible; the line of a page without storage
  const bare = await started([], {});
  bare.el("tour-invite-later").click();
  assert.equal(lineShown(bare), true);
});

test("HN-01: a touch pins a hint, hovering is for the mouse (design D21) - pointerenter of a touch and the mouseenter after it do not open; the press opens and pins it, mouseleave does not close it, a second press closes; a mouse (pointerenter of a mouse, mouseenter) opens and mouseleave closes", async () => {
  const page = await started(twoRoles(), {
    storageFn: closedStore,
    now: S(30),
  });
  for (const name of HINT_KEYS) {
    const b = hintBtn(page, name);
    b.fire("pointerenter", { pointerType: "touch" });
    b.fire("mouseenter");
    assert.equal(
      hintOpen(page, name),
      false,
      `${name}: a touch does not hover`,
    );
    b.fire("pointerdown", { pointerType: "touch" });
    b.fire("mousedown");
    assert.equal(hintOpen(page, name), false);
    b.click();
    assert.equal(hintOpen(page, name), true, `${name}: the touch pins`);
    assert.equal(b.getAttribute("data-pinned"), "true");
    b.fire("mouseleave");
    assert.equal(hintOpen(page, name), true);
    b.fire("pointerdown", { pointerType: "touch" });
    b.click();
    assert.equal(hintOpen(page, name), false, `${name}: the second touch`);
    // a mouse again
    b.fire("pointerenter", { pointerType: "mouse" });
    b.fire("mouseenter");
    assert.equal(hintOpen(page, name), true, `${name}: the mouse hovers`);
    b.fire("mouseleave");
    assert.equal(hintOpen(page, name), false);
  }
});

test("HN-02: the CSS of the hints after r2 (D22-D24) - .hint-tip takes no presses (pointer-events: none) and tries flip-block and flip-inline; in the narrow window the hints try nothing else (position-try-fallbacks: none) and no rule gives them presses back; .hint-close has no colour and size of its own (the text of the hint)", () => {
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  const NARROW = "@media (max-width: 599px)";
  assert.equal(
    cssValue(cssCascade(rules, ".hint-tip"), "pointer-events"),
    "none",
  );
  assert.equal(
    cssValue(cssCascade(rules, ".hint-tip", NARROW), "pointer-events"),
    "none",
  );
  const tries = cssValue(
    cssCascade(rules, ".hint-tip"),
    "position-try-fallbacks",
  );
  assert.match(tries, /(^|, )flip-block(,|$)/);
  assert.match(tries, /flip-inline/);
  for (const name of HINT_KEYS) {
    assert.equal(
      cssValue(
        cssCascade(rules, `#hint-${name}`, NARROW),
        "position-try-fallbacks",
      ),
      "none",
      name,
    );
    assert.equal(
      cssValue(cssCascade(rules, `#hint-${name}`), "position-try-fallbacks"),
      undefined,
    );
  }
  for (const r of rules) {
    if (!r.selectors.some((s) => /hint-tip|#hint-/.test(s))) continue;
    for (const [n, v] of r.list) {
      assert.equal(
        n === "pointer-events" && v !== "none",
        false,
        r.selectors.join(),
      );
    }
  }
  for (const r of rules) {
    if (!r.selectors.some((s) => /hint-close/.test(s))) continue;
    for (const [n] of r.list) {
      assert.equal(
        /^(color|font-size|font|opacity)$/.test(n),
        false,
        `${r.selectors.join()}: ${n}`,
      );
    }
  }
});

test("TU-07: the '×' of the tour and of the line about it is not smaller than 'Пауза' in the narrow window (2.25rem, D25); the empty line about the tour stays in the tree of accessibility - no display: none or visibility: hidden (04a)", () => {
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  const NARROW = "@media (max-width: 599px)";
  for (const sel of [".tour-x", ".tour-later-x"]) {
    assert.equal(
      cssValue(cssCascade(rules, sel, NARROW), "width"),
      "2.25rem",
      sel,
    );
    assert.equal(
      cssValue(cssCascade(rules, sel, NARROW), "height"),
      "2.25rem",
      sel,
    );
  }
  // "Пауза" is a .ctl: its height in the narrow window is the rule of .ctl
  const pause = cssValue(cssCascade(rules, ".ctl", NARROW), "height");
  assert.equal(pause, "2.25rem");
  for (const sel of [".tour-x", ".tour-later-x"]) {
    assert.equal(
      cssValue(cssCascade(rules, sel, NARROW), "height"),
      pause,
      sel,
    );
  }
  for (const media of [null, NARROW]) {
    const empty = cssCascade(rules, ".tour-later:empty", media);
    assert.ok(empty.length > 0);
    assert.notEqual(cssValue(empty, "display"), "none", String(media));
    assert.notEqual(cssValue(empty, "visibility"), "hidden", String(media));
  }
  for (const r of rules) {
    if (!r.selectors.some((s) => /tour-later/.test(s))) continue;
    for (const [n, v] of r.list) {
      assert.equal(n === "display" && v === "none", false, r.selectors.join());
      assert.equal(
        n === "visibility" && v === "hidden",
        false,
        r.selectors.join(),
      );
    }
  }
});

test("HN-06: the line how to close a hint is of the size and colour of the hint itself (D24) - the text of .hint-tip against its background reaches 4.5 to 1, and the line inherits it", () => {
  const { hints } = {
    hints: contrastOf((s) => /\.hint-/.test(s), ".hint-tip"),
  };
  assert.deepEqual(hints.low, []);
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  const close = cssCascade(rules, ".hint-close");
  assert.equal(cssValue(close, "color"), undefined);
  assert.equal(cssValue(close, "font-size"), undefined);
  assert.equal(
    cssValue(cssCascade(rules, ".hint-tip"), "color"),
    "var(--text)",
  );
  assert.equal(
    cssValue(cssCascade(rules, ".hint-tip"), "font-size"),
    "0.75rem",
  );
});

test("HN-02: the button '?' of the office does not take the presses of the legend (08g, 08h) - .office-hint keeps align-self: flex-start and no rule (in an @media too) stretches it; it takes no presses itself, only its button does; no rule gives .hint-tip presses; the line about the tour is at most 17rem wide", () => {
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  const NARROW = "@media (max-width: 599px)";
  for (const media of [null, NARROW]) {
    assert.equal(
      cssValue(cssCascade(rules, ".office-hint", media), "align-self"),
      "flex-start",
    );
    assert.equal(
      cssValue(cssCascade(rules, ".office-hint", media), "pointer-events"),
      "none",
    );
    assert.equal(
      cssValue(
        cssCascade(rules, ".office-hint > .hint-btn", media),
        "pointer-events",
      ),
      "auto",
    );
  }
  for (const r of rules) {
    const own = r.selectors.filter((sel) => /office-hint/.test(sel));
    if (own.length === 0) continue;
    for (const [n, v] of r.list) {
      assert.equal(n === "align-self" && v === "stretch", false, own.join());
      if (n === "pointer-events" && v !== "none") {
        assert.deepEqual(
          own,
          [".office-hint > .hint-btn"],
          `${own.join()}: ${v}`,
        );
      }
    }
  }
  for (const r of rules) {
    if (!r.selectors.some((sel) => /hint-tip|#hint-/.test(sel))) continue;
    for (const [n, v] of r.list) {
      assert.equal(
        n === "pointer-events" && v !== "none",
        false,
        r.selectors.join(),
      );
    }
  }
  assert.equal(
    cssValue(cssCascade(rules, ".tour-later-text"), "max-width"),
    "17rem",
  );
});
