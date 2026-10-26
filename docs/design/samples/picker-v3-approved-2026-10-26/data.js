/* Данные арендаторов и тексты интерфейса. Весь облик сайта берётся отсюда:
   название, цвета, табличка на двери, команда, вопросы, предложения. */
(function () {
  'use strict';
  var L = function (ru, kk, en) { return { ru: ru, kk: kk, en: en }; };

  /* ---------- Интерфейс платформы (общие подписи, три языка) ---------- */
  var UI = {
    ru: {
      brand: 'Работает на платформе Sai', skip: 'К основному содержимому', lang: 'Язык', theme: 'Свет',
      th_auto: 'Авто', th_day: 'День', th_night: 'Ночь',
      start_cta: 'Начать — {n} вопросов', start_meta: 'Около 2 минут · без регистрации · цена сразу на экране',
      resume: 'Продолжить с вопроса {i}', restart: 'Сначала',
      q_of: 'Вопрос {i} из {n}', dk: 'Не знаю', dk_sub: 'возьмём типовой вариант',
      back: 'Назад', back_t: 'Исправить предыдущий ответ', enough: 'Хватит, покажите результат',
      own: 'Своё число', own_ph: 'Напр. 7 500', ok: 'ОК', says: '{name}, {role}',
      rc_live: 'Ваш чек собирается', rc_final: 'Ваш чек', rc_hint0: 'Ответьте на вопрос — здесь появятся строки и цена.',
      rc_get: 'Что входит', rc_price: 'Ориентир по цене', rc_effort: 'Трудозатраты', rc_fit: 'Соответствие задаче',
      rc_prec: 'Точность', rc_prec_v: '{k} из {n} ответов', assumed: 'по умолчанию',
      rc_note: 'Ориентир, не оферта. Точную смету подтвердим после уточнения.',
      unit_d: 'чел.-дн.', sheet_toggle: 'Что входит', sheet_close: 'Свернуть',
      res_title: 'Готово — вот что мы собрали', res_sub: 'Ответы можно поправить одним нажатием.',
      act_print: 'Печать', act_csv: 'Excel (CSV)', act_pdf: 'PDF',
      req_title: 'Передать команде', req_lead: 'Один контакт — и мы напишем сегодня.',
      req_label: 'Телефон или @ник в Telegram', req_ph: '+7 701 000 00 00', req_send: 'Отправить',
      req_wa: 'Написать в WhatsApp', req_name_add: 'Добавить имя', req_name: 'Имя (необязательно)',
      req_err: 'Укажите телефон (+7 …) или @ник.', req_note: 'Больше ничего не нужно. Дальше откроется «Мой запрос».',
      my_title: 'Мой запрос', my_id: 'Номер', my_sent: 'Отправлен', my_link: 'Личная ссылка — сохраните её',
      my_copy: 'Скопировать', my_copied: 'Скопировано', my_private: 'Страница открывается только по этой ссылке.',
      st: ['Заявка принята', 'Готовим документы', 'Готовим спецификацию', 'Готово'],
      st_short: ['Приём', 'Документы', 'Спецификация', 'Готово'],
      st_desc: ['Мы получили вашу заявку и ответы. Ничего делать не нужно.',
        'Собираем документы по вашим ответам: описание решения и перечень работ.',
        'Уточняем состав работ, сроки и стоимость, чтобы дать точный расчёт.',
        'Спецификация готова — мы свяжемся с вами и передадим её.'],
      now: 'Сейчас', done: 'Сделано', wait: 'Впереди',
      board: 'Заявки', op: 'Оператор', next: 'Дальше', empty: 'Пусто', who: 'Кто', open: 'Подробнее',
      you: 'Вы', tenant: 'Демо: компания', stage_demo: 'Демо: этап',
      kk_note: 'Черновик перевода на казахский: нужна проверка носителем языка.',
      tz: 'Астана, UTC+5', print_title: 'Предварительный расчёт', print_for: 'Подготовлено для запроса',
      csv_h: ['Позиция', 'Описание', 'Чел.-дн.'], csv_total: 'Итого, чел.-дн.', csv_range: 'Ориентир, ₸',
      wa_msg: 'Здравствуйте! Прошёл подбор на сайте «{name}». Запрос {id}. Ориентир {range}, {days} чел.-дн. Свяжитесь, пожалуйста.',
      sr_ans: 'Принято: {opt}. Ориентир {range}.', sr_back: 'Вернулись к вопросу {i}.',
      pass: 'ответ', stamp: 'ГОТОВО', hello: 'Здравствуйте!', ready_say: 'Всё готово — вот ваш чек.',
      busy_say: ['Записала.', 'Принято.', 'Сверяю…', 'Считаю…'], stage_on: 'Этап {i} из 4: {name}',
      priv_count: 'Всего заявок', moved: 'Передано дальше', age_now: 'только что', age_min: '{n} мин назад', age_h: '{n} ч назад', age_d: '{n} дн назад',
      det_answers: 'Ответы', det_contact: 'Контакт', det_wa: 'Открыть WhatsApp', office_alt: 'Офис компании: команда работает над вашим запросом',
      total: 'Итого', demo_hint: 'Демо-режим: данные хранятся только в этом браузере.'
    },
    kk: {
      brand: 'Sai платформасында жұмыс істейді', skip: 'Негізгі мазмұнға өту', lang: 'Тіл', theme: 'Жарық',
      th_auto: 'Авто', th_day: 'Күн', th_night: 'Түн',
      start_cta: 'Бастау — {n} сұрақ', start_meta: 'Шамамен 2 минут · тіркелусіз · баға бірден экранда',
      resume: '{i}-сұрақтан жалғастыру', restart: 'Басынан',
      q_of: '{i}-сұрақ / {n}', dk: 'Білмеймін', dk_sub: 'әдеттегі нұсқаны аламыз',
      back: 'Артқа', back_t: 'Алдыңғы жауапты түзету', enough: 'Жеткілікті, нәтижені көрсетіңіз',
      own: 'Басқа сан', own_ph: 'Мыс. 7 500', ok: 'ОК', says: '{name}, {role}',
      rc_live: 'Чегіңіз құрастырылуда', rc_final: 'Сіздің чегіңіз', rc_hint0: 'Сұраққа жауап беріңіз — мұнда жолдар мен баға пайда болады.',
      rc_get: 'Не кіреді', rc_price: 'Бағаның шамасы', rc_effort: 'Еңбек шығыны', rc_fit: 'Тапсырмаға сәйкестік',
      rc_prec: 'Дәлдік', rc_prec_v: '{k} / {n} жауап', assumed: 'әдепкі бойынша',
      rc_note: 'Бұл шама, оферта емес. Нақты смета нақтылаудан кейін расталады.',
      unit_d: 'адам-күн', sheet_toggle: 'Не кіреді', sheet_close: 'Жабу',
      res_title: 'Дайын — міне, біз жинағанымыз', res_sub: 'Жауаптарды бір басумен түзетуге болады.',
      act_print: 'Басып шығару', act_csv: 'Excel (CSV)', act_pdf: 'PDF',
      req_title: 'Командаға жіберу', req_lead: 'Бір байланыс — біз бүгін жазамыз.',
      req_label: 'Телефон немесе Telegram @аты', req_ph: '+7 701 000 00 00', req_send: 'Жіберу',
      req_wa: 'WhatsApp-қа жазу', req_name_add: 'Атын қосу', req_name: 'Аты (міндетті емес)',
      req_err: 'Телефонды (+7 …) немесе @атын көрсетіңіз.', req_note: 'Басқа ештеңе керек емес. Одан әрі «Менің сұрауым» ашылады.',
      my_title: 'Менің сұрауым', my_id: 'Нөмір', my_sent: 'Жіберілді', my_link: 'Жеке сілтеме — сақтап қойыңыз',
      my_copy: 'Көшіру', my_copied: 'Көшірілді', my_private: 'Бет тек осы сілтеме арқылы ашылады.',
      st: ['Өтінім қабылданды', 'Құжаттарды дайындап жатырмыз', 'Спецификацияны дайындап жатырмыз', 'Дайын'],
      st_short: ['Қабылдау', 'Құжаттар', 'Спецификация', 'Дайын'],
      st_desc: ['Өтініміңіз бен жауаптарыңызды алдық. Ештеңе істеудің қажеті жоқ.',
        'Жауаптарыңыз бойынша құжаттарды жинаймыз: шешімнің сипаттамасы мен жұмыстар тізімі.',
        'Жұмыс құрамын, мерзім мен құнын нақтылап жатырмыз.',
        'Спецификация дайын — сізбен байланысып, тапсырамыз.'],
      now: 'Қазір', done: 'Орындалды', wait: 'Алда',
      board: 'Өтінімдер', op: 'Оператор', next: 'Әрі қарай', empty: 'Бос', who: 'Кім', open: 'Толығырақ',
      you: 'Сіз', tenant: 'Демо: компания', stage_demo: 'Демо: кезең',
      kk_note: 'Аударма жобасы, ана тілі иесінің тексеруі қажет · черновик, нужна проверка носителем языка.',
      tz: 'Астана, UTC+5', print_title: 'Алдын ала есеп', print_for: 'Сұрау үшін дайындалды',
      csv_h: ['Позиция', 'Сипаттама', 'Адам-күн'], csv_total: 'Барлығы, адам-күн', csv_range: 'Шама, ₸',
      wa_msg: 'Сәлеметсіз бе! «{name}» сайтында таңдаудан өттім. Сұрау {id}. Шама {range}, {days} адам-күн. Байланысыңызшы.',
      sr_ans: 'Қабылданды: {opt}. Шама {range}.', sr_back: '{i}-сұраққа оралдық.',
      pass: 'жауап', stamp: 'ДАЙЫН', hello: 'Сәлеметсіз бе!', ready_say: 'Бәрі дайын — міне, чегіңіз.',
      busy_say: ['Жазып алдым.', 'Қабылданды.', 'Салыстырып жатырмын…', 'Есептеп жатырмын…'], stage_on: '{i}-кезең / 4: {name}',
      priv_count: 'Барлық өтінім', moved: 'Әрі берілді', age_now: 'енді ғана', age_min: '{n} мин бұрын', age_h: '{n} сағ бұрын', age_d: '{n} күн бұрын',
      det_answers: 'Жауаптар', det_contact: 'Байланыс', det_wa: 'WhatsApp ашу', office_alt: 'Компания кеңсесі: команда сұрауыңызбен жұмыс істеп жатыр',
      total: 'Барлығы', demo_hint: 'Демо-режим: деректер тек осы браузерде сақталады.'
    },
    en: {
      brand: 'Powered by the Sai platform', skip: 'Skip to main content', lang: 'Language', theme: 'Light',
      th_auto: 'Auto', th_day: 'Day', th_night: 'Night',
      start_cta: 'Start — {n} questions', start_meta: 'About 2 minutes · no sign-up · the price shows up right away',
      resume: 'Continue from question {i}', restart: 'Start over',
      q_of: 'Question {i} of {n}', dk: 'Not sure', dk_sub: 'we will take the usual option',
      back: 'Back', back_t: 'Change the previous answer', enough: 'Enough — show my result',
      own: 'Own number', own_ph: 'e.g. 7,500', ok: 'OK', says: '{name}, {role}',
      rc_live: 'Your quote is being assembled', rc_final: 'Your quote', rc_hint0: 'Answer a question and lines with a price will appear here.',
      rc_get: 'What is included', rc_price: 'Price range', rc_effort: 'Effort', rc_fit: 'Fit for your task',
      rc_prec: 'Accuracy', rc_prec_v: '{k} of {n} answers', assumed: 'default',
      rc_note: 'A guide, not an offer. We confirm the exact estimate after clarifying.',
      unit_d: 'person-days', sheet_toggle: 'What is included', sheet_close: 'Close',
      res_title: 'Done — here is what we put together', res_sub: 'Any answer can be changed with one tap.',
      act_print: 'Print', act_csv: 'Excel (CSV)', act_pdf: 'PDF',
      req_title: 'Send it to the team', req_lead: 'One contact and we will write today.',
      req_label: 'Phone or Telegram @handle', req_ph: '+7 701 000 00 00', req_send: 'Send',
      req_wa: 'Message on WhatsApp', req_name_add: 'Add a name', req_name: 'Name (optional)',
      req_err: 'Enter a phone (+7 …) or an @handle.', req_note: 'Nothing else is needed. “My request” opens next.',
      my_title: 'My request', my_id: 'Number', my_sent: 'Sent', my_link: 'Your private link — keep it',
      my_copy: 'Copy', my_copied: 'Copied', my_private: 'The page opens only through this link.',
      st: ['Request received', 'Preparing documents', 'Preparing the specification', 'Ready'],
      st_short: ['Reception', 'Documents', 'Specification', 'Ready'],
      st_desc: ['We have your request and answers. There is nothing you need to do.',
        'We are putting documents together from your answers: the solution and a list of work.',
        'We are fixing the scope, timing and cost to give you an exact estimate.',
        'The specification is ready — we will contact you and hand it over.'],
      now: 'Now', done: 'Done', wait: 'Upcoming',
      board: 'Requests', op: 'Operator', next: 'Move on', empty: 'Empty', who: 'Who', open: 'Details',
      you: 'You', tenant: 'Demo: company', stage_demo: 'Demo: stage',
      kk_note: '',
      tz: 'Astana, UTC+5', print_title: 'Preliminary estimate', print_for: 'Prepared for request',
      csv_h: ['Item', 'Description', 'Person-days'], csv_total: 'Total, person-days', csv_range: 'Range, KZT',
      wa_msg: 'Hello! I went through the picker on “{name}”. Request {id}. Range {range}, {days} person-days. Please get in touch.',
      sr_ans: 'Got it: {opt}. Range {range}.', sr_back: 'Back to question {i}.',
      pass: 'answer', stamp: 'READY', hello: 'Hello!', ready_say: 'All set — here is your quote.',
      busy_say: ['Noted.', 'Got it.', 'Checking…', 'Counting…'], stage_on: 'Stage {i} of 4: {name}',
      priv_count: 'All requests', moved: 'Passed on', age_now: 'just now', age_min: '{n} min ago', age_h: '{n} h ago', age_d: '{n} d ago',
      det_answers: 'Answers', det_contact: 'Contact', det_wa: 'Open WhatsApp', office_alt: 'The company office: the team is working on your request',
      total: 'Total', demo_hint: 'Demo mode: data stays only in this browser.'
    }
  };

  /* ---------- Арендатор 1: интегратор учёта товарных остатков ---------- */
  var STOCK = {
    id: 'stock', ref: 'СК', name: 'Складеон', initial: 'С',
    tag: L('учёт товара под ключ', 'тауар есебі кілтімен', 'stock control, turnkey'),
    industry: L('Интегратор учёта товарных остатков', 'Тауар қалдықтарын есепке алу интеграторы', 'Stock-control integrator'),
    headline: L('Соберём решение для вашего склада — пока вы отвечаете', 'Қоймаңызға шешімді жауап беріп жатқанда құрастырамыз', 'We assemble your warehouse solution while you answer'),
    pitch: L('Складеон подключает учёт остатков к 1С и SAP. Ответьте на 5 вопросов: команда соберёт предложение и цену на ваших глазах.',
      'Складеон қалдықтар есебін 1С және SAP жүйелеріне қосады. 5 сұраққа жауап беріңіз: команда ұсыныс пен бағаны көз алдыңызда жинайды.',
      'Skladeon connects stock records to 1C and SAP. Answer 5 questions and the team assembles an offer and a price in front of you.'),
    pkg: 'Склад-Контроль', rate: 48000, wa: '77010000000',
    pal: {
      accent: '#e0731f', btn: '#e0731f', onBtn: '#1b1208', accT: '#9a4306', accTN: '#ffb06b', accent2: '#1f7a8c',
      day: { bg: '#f6eddc', paper: '#fbf5e8', ink: '#17343a', ink2: '#4a5d60', line: '#17343a',
        wall: '#eadcc2', wallB: '#dcc8a6', trim: '#b99a6a', floorA: '#e6d4b4', floorB: '#dec9a5', sky: '#bfe3ee', wood: ['#a97646', '#c28f5a', '#d9ab74'] },
      night: { bg: '#0d1b1e', paper: '#13282c', ink: '#f2ead8', ink2: '#a9bcbf', line: '#e8d9b8',
        wall: '#1b363c', wallB: '#142a2f', trim: '#2c5059', floorA: '#13252a', floorB: '#112024', sky: '#0b1626', wood: ['#4a3626', '#6b4f37', '#805e42'] }
    },
    team: [
      { name: 'Айгерим', role: L('приём заявок', 'өтінімдерді қабылдау', 'reception'), skin: '#f0cfae', hair: '#2b1d17', style: 'long', shirt: '#e0731f' },
      { name: 'Данияр', role: L('документы', 'құжаттар', 'documents'), skin: '#e7bd96', hair: '#1f1a17', style: 'short', shirt: '#1f7a8c' },
      { name: 'Руслан', role: L('спецификация', 'спецификация', 'specification'), skin: '#f0cfae', hair: '#6a4a2c', style: 'cap', shirt: '#c99a2e' },
      { name: 'Мадина', role: L('выдача результата', 'нәтижені беру', 'handover'), skin: '#e7bd96', hair: '#241915', style: 'bun', shirt: '#2f5560' }
    ],
    say: [L('Добро пожаловать!', 'Қош келдіңіз!', 'Welcome!'), L('Подключаю 1С…', '1С қосып жатырмын…', 'Linking 1C…'), L('Считаю позиции…', 'Позицияларды санап жатырмын…', 'Counting items…'), L('Печать готова.', 'Баспа дайын.', 'Printing done.')],
    base: ['base', 'reports', 'train'],
    lines: {
      base: [L('Приход, расход и остатки', 'Кіріс, шығыс және қалдықтар', 'Receipts, issues and stock levels'), L('Учёт товара по складу с историей движения', 'Қойма бойынша тауар есебі, қозғалыс тарихымен', 'Stock records by warehouse with movement history'), 4],
      reports: [L('Отчёты по остаткам', 'Қалдықтар есептері', 'Stock reports'), L('Остатки, оборачиваемость, залежавшийся товар', 'Қалдықтар, айналым, тұрып қалған тауар', 'Levels, turnover, dead stock'), 2],
      train: [L('Обучение сотрудников', 'Қызметкерлерді оқыту', 'Staff training'), L('Две встречи по два часа и памятка', 'Екі сағаттан екі кездесу және жадынама', 'Two 2-hour sessions and a cheat sheet'), 1],
      transfer: [L('Перемещения между складами', 'Қоймалар арасындағы жылжыту', 'Transfers between warehouses'), L('Накладные перемещения и товар в пути', 'Жылжыту жүкқұжаттары, жолдағы тауар', 'Transfer notes and goods in transit'), 3],
      multi: [L('Единые остатки по всем складам', 'Барлық қоймалар бойынша бірыңғай қалдық', 'One stock view across warehouses'), L('Сводный остаток и резервы', 'Жиынтық қалдық және резервтер', 'Combined stock and reservations'), 3],
      retail: [L('Связь с кассой и магазинами', 'Касса және дүкендермен байланыс', 'Link to tills and shops'), L('Остатки магазинов обновляются после продажи', 'Сатылымнан кейін дүкен қалдығы жаңарады', 'Shop levels update after each sale'), 4],
      x1c: [L('Обмен с 1С:Предприятие', '1С:Кәсіпорынмен алмасу', 'Exchange with 1C:Enterprise'), L('Двусторонний обмен документами и справочниками', 'Құжаттар мен анықтамалықтармен екі жақты алмасу', 'Two-way exchange of documents and catalogues'), 3],
      xsap: [L('Обмен с SAP Business One', 'SAP Business One-мен алмасу', 'Exchange with SAP Business One'), L('Интеграционный слой и проверка проводок', 'Интеграциялық қабат, проводкаларды тексеру', 'Integration layer and posting checks'), 6],
      ximp: [L('Перенос данных из Excel', 'Excel-ден деректерді көшіру', 'Moving data out of Excel'), L('Очистка таблиц, загрузка справочников, сверка', 'Кестелерді тазалау, анықтамалықтар, салыстыру', 'Cleaning sheets, loading catalogues, reconciling'), 4],
      catalog: [L('Каталог номенклатуры', 'Номенклатура каталогы', 'Item catalogue'), L('Группы, характеристики, единицы измерения', 'Топтар, сипаттамалар, өлшем бірліктері', 'Groups, attributes, units of measure'), 2],
      abc: [L('ABC-анализ и прогноз закупок', 'ABC-талдау және сатып алу болжамы', 'ABC analysis and purchase forecast'), L('Что залежалось и что заканчивается', 'Не тұрып қалды, не бітуде', 'What is stuck and what runs out'), 3],
      scan: [L('Работа со сканером штрихкодов', 'Штрихкод сканерімен жұмыс', 'Barcode scanner workflow'), L('Приёмка и отбор по штрихкоду, печать этикеток', 'Штрихкод бойынша қабылдау, жапсырма басу', 'Receiving and picking by barcode, label printing'), 2],
      tsd: [L('Инвентаризация с терминалом (ТСД)', 'Терминалмен түгендеу (ТЖТ)', 'Stock-take with a handheld terminal'), L('Подсчёт без бумаги, расхождения видны сразу', 'Қағазсыз санау, айырмашылық бірден көрінеді', 'Paperless counting, differences show at once'), 5],
      sheets: [L('Печатные ведомости учёта', 'Есептің баспа ведомостері', 'Printed count sheets'), L('Формы инвентаризации и накладные для подписи', 'Түгендеу нысандары және қол қоюға арналған жүкқұжаттар', 'Count forms and delivery notes to sign'), 1],
      hotline: [L('Поддержка по телефону', 'Телефон бойынша қолдау', 'Phone support'), L('Рабочие дни 9:00–18:00, ответ за 2 часа', 'Жұмыс күндері 9:00–18:00, жауап 2 сағатта', 'Working days 9:00–18:00, reply within 2 hours'), 1],
      dedic: [L('Закреплённый специалист', 'Бекітілген маман', 'Dedicated specialist'), L('Один человек на связи три месяца после запуска', 'Іске қосудан кейін үш ай бір адам байланыста', 'One person on call for three months after launch'), 3]
    },
    questions: [
      { id: 'sites', kind: 'choice', st: 0, title: L('Сколько у вас складов?', 'Қанша қоймаңыз бар?', 'How many warehouses do you run?'), def: 'one',
        opts: [
          { id: 'one', label: L('Один склад', 'Бір қойма', 'One warehouse'), icon: { t: 'shelf', n: 1 }, prop: { t: 'shelf', n: 1 }, lines: [] },
          { id: 'few', label: L('Два–три склада', 'Екі–үш қойма', 'Two or three'), icon: { t: 'shelf', n: 2 }, prop: { t: 'shelf', n: 2 }, lines: ['transfer'] },
          { id: 'many', label: L('Больше трёх', 'Үштен көп', 'More than three'), icon: { t: 'shelf', n: 3 }, prop: { t: 'shelf', n: 3 }, lines: ['transfer', 'multi'] },
          { id: 'shop', label: L('Склад и магазины', 'Қойма және дүкендер', 'Warehouse and shops'), icon: { t: 'shop' }, prop: { t: 'shelf', n: 2, shop: 1 }, lines: ['transfer', 'retail'] }
        ] },
      { id: 'sys', kind: 'choice', st: 1, title: L('Где сейчас ведёте учёт?', 'Қазір есепті қайда жүргізесіз?', 'Where do you keep stock records today?'), def: 's1c',
        opts: [
          { id: 's1c', label: L('1С:Предприятие', '1С:Кәсіпорын', '1C:Enterprise'), icon: { t: 'screen', x: '1С' }, prop: { t: 'monitor', x: '1С' }, lines: ['x1c'] },
          { id: 'sap', label: L('SAP Business One', 'SAP Business One', 'SAP Business One'), icon: { t: 'screen', x: 'SAP' }, prop: { t: 'monitor', x: 'SAP' }, lines: ['xsap'] },
          { id: 'xls', label: L('Excel и тетради', 'Excel және дәптерлер', 'Excel and notebooks'), icon: { t: 'screen', x: 'XLS' }, prop: { t: 'monitor', x: 'XLS' }, lines: ['ximp'] },
          { id: 'none', label: L('Пока нигде', 'Әзірге еш жерде', 'Nowhere yet'), icon: { t: 'screen', x: '?' }, prop: { t: 'monitor', x: '?' }, lines: ['ximp'] }
        ] },
      { id: 'sku', kind: 'number', st: 2, unit: L('позиций', 'позиция', 'items'), title: L('Сколько наименований товара?', 'Тауардың неше атауы бар?', 'How many different items do you stock?'), def: 'b2',
        chips: [500, 3000, 10000, 50000],
        opts: [
          { id: 'b1', max: 1000, label: L('до 1 000', '1 000-ға дейін', 'up to 1,000'), icon: { t: 'boxes', n: 1 }, prop: { t: 'boxes', n: 1 }, lines: [] },
          { id: 'b2', max: 5000, label: L('до 5 000', '5 000-ға дейін', 'up to 5,000'), icon: { t: 'boxes', n: 2 }, prop: { t: 'boxes', n: 2 }, lines: ['catalog'] },
          { id: 'b3', max: 20000, label: L('до 20 000', '20 000-ға дейін', 'up to 20,000'), icon: { t: 'boxes', n: 3 }, prop: { t: 'boxes', n: 3 }, lines: ['catalog', 'abc'] },
          { id: 'b4', max: 1e12, label: L('больше 20 000', '20 000-нан көп', 'over 20,000'), icon: { t: 'boxes', n: 4 }, prop: { t: 'boxes', n: 4 }, lines: ['catalog', 'abc'] }
        ] },
      { id: 'count', kind: 'choice', st: 2, title: L('Чем считаете остатки?', 'Қалдықты немен санайсыз?', 'How do you count stock?'), def: 'scan',
        opts: [
          { id: 'scan', label: L('Штрихкод-сканер', 'Штрихкод сканері', 'Barcode scanner'), icon: { t: 'scanner' }, prop: { t: 'scanner' }, lines: ['scan'] },
          { id: 'tsd', label: L('Терминал сбора данных', 'Деректер жинау терминалы', 'Handheld terminal'), icon: { t: 'tsd' }, prop: { t: 'tsd' }, lines: ['tsd'] },
          { id: 'paper', label: L('Вручную, на бумаге', 'Қолмен, қағазда', 'By hand, on paper'), icon: { t: 'clip' }, prop: { t: 'clip' }, lines: ['sheets'] }
        ] },
      { id: 'support', kind: 'choice', st: 3, title: L('Нужна ли поддержка после запуска?', 'Іске қосқаннан кейін қолдау керек пе?', 'Do you need support after launch?'), def: 'self',
        opts: [
          { id: 'self', label: L('Справимся сами', 'Өзіміз істейміз', 'We will manage'), icon: { t: 'bell' }, prop: { t: 'bell' }, lines: [] },
          { id: 'phone', label: L('Звонок в рабочее время', 'Жұмыс уақытында қоңырау', 'A call in working hours'), icon: { t: 'phone' }, prop: { t: 'phone' }, lines: ['hotline'] },
          { id: 'dedic', label: L('Свой специалист', 'Өз маманымыз', 'Our own specialist'), icon: { t: 'headset' }, prop: { t: 'headset' }, lines: ['dedic'] }
        ] }
    ],
    demo: [
      ['Нурлан Сейтов', '+7 701 555 12 40', { sites: 'few', sys: 's1c', sku: 8000, count: 'scan', support: 'phone' }, 0, 7],
      ['Ольга Миронова', '@olga_mironova', { sites: 'one', sys: 'xls', sku: 1200, count: 'paper', support: 'self' }, 0, 95],
      ['Жанат Омаров', '+7 707 222 41 90', { sites: 'shop', sys: 'sap', sku: 30000, count: 'tsd', support: 'dedic' }, 1, 340],
      ['Светлана Ким', '+7 705 330 18 07', { sites: 'many', sys: 's1c', sku: 15000, count: 'tsd', support: 'phone' }, 1, 1500],
      ['Арман Бектемиров', '+7 700 980 66 12', { sites: 'one', sys: 's1c', sku: 500, count: 'scan', support: 'self' }, 2, 3100],
      ['ТОО «Алтын Ас»', '+7 747 100 20 30', { sites: 'few', sys: 'none', sku: 4000, count: 'scan', support: 'phone' }, 2, 4400],
      ['Мария Лебедева', '@marialeb', { sites: 'shop', sys: 's1c', sku: 9000, count: 'scan', support: 'dedic' }, 3, 8900]
    ]
  };

  /* ---------- Арендатор 2: маркетинговое агентство ---------- */
  var AGENCY = {
    id: 'agency', ref: 'ЛВ', name: 'Лидвейв', initial: 'Л',
    tag: L('клиенты из интернета', 'интернеттен келетін клиенттер', 'customers from the internet'),
    industry: L('Маркетинговое агентство', 'Маркетингтік агенттік', 'Marketing agency'),
    headline: L('Соберём план привлечения клиентов — пока вы отвечаете', 'Клиент тарту жоспарын жауап беріп жатқанда құрастырамыз', 'We assemble your customer plan while you answer'),
    pitch: L('Лидвейв приводит клиентов из Instagram, Google и 2ГИС. Ответьте на 5 вопросов: команда соберёт план и цену запуска на ваших глазах.',
      'Лидвейв клиенттерді Instagram, Google және 2ГИС арқылы әкеледі. 5 сұраққа жауап беріңіз: команда жоспар мен баға жинайды.',
      'Leadway brings customers from Instagram, Google and 2GIS. Answer 5 questions and the team assembles a plan and a launch price in front of you.'),
    pkg: 'Лид-Поток', rate: 40000, wa: '77020000000',
    pal: {
      accent: '#e0356f', btn: '#c4205a', onBtn: '#ffffff', accT: '#b01a52', accTN: '#ff8fb3', accent2: '#5b3fd6',
      day: { bg: '#f7edf3', paper: '#fcf6fa', ink: '#2a1840', ink2: '#5b4a6b', line: '#2a1840',
        wall: '#f0dcea', wallB: '#e2c4d8', trim: '#b98aa8', floorA: '#ead7e4', floorB: '#e3cddd', sky: '#cfd8ff', wood: ['#b07a58', '#c8926c', '#dcae8a'] },
      night: { bg: '#150d20', paper: '#201432', ink: '#f6e9f1', ink2: '#bfaed0', line: '#e9cfe0',
        wall: '#2d1a40', wallB: '#22132f', trim: '#4a2c66', floorA: '#1a1027', floorB: '#170e23', sky: '#0b1020', wood: ['#52382f', '#74513f', '#8a6450'] }
    },
    team: [
      { name: 'Алия', role: L('приём заявок', 'өтінімдерді қабылдау', 'reception'), skin: '#f0cfae', hair: '#1f1a17', style: 'bun', shirt: '#e0356f' },
      { name: 'Тимур', role: L('каналы и документы', 'арналар мен құжаттар', 'channels and documents'), skin: '#e7bd96', hair: '#2b1d17', style: 'short', shirt: '#5b3fd6' },
      { name: 'Динара', role: L('план и бюджет', 'жоспар мен бюджет', 'plan and budget'), skin: '#f0cfae', hair: '#6a4a2c', style: 'long', shirt: '#d98a1b' },
      { name: 'Ерлан', role: L('выдача результата', 'нәтижені беру', 'handover'), skin: '#e7bd96', hair: '#1f1a17', style: 'cap', shirt: '#2a6f9a' }
    ],
    say: [L('Привет! Чем помочь?', 'Сәлем! Қалай көмектесейін?', 'Hi! How can we help?'), L('Смотрю каналы…', 'Арналарды қарап жатырмын…', 'Checking channels…'), L('Считаю бюджет…', 'Бюджетті есептеп жатырмын…', 'Counting budget…'), L('Отчёт напечатан.', 'Есеп басылды.', 'Report printed.')],
    base: ['strategy', 'tracking', 'launch'],
    lines: {
      strategy: [L('Стратегия и план запуска', 'Стратегия және іске қосу жоспары', 'Strategy and launch plan'), L('Кому, что и через какие каналы говорим', 'Кімге, не және қандай арна арқылы айтамыз', 'Who we speak to, with what, through which channels'), 3],
      tracking: [L('Сквозная аналитика', 'Сквозной талдау', 'End-to-end analytics'), L('Видно заявки и цену каждого клиента', 'Өтінімдер мен әр клиент құны көрінеді', 'Every lead and its cost visible'), 3],
      launch: [L('Запуск первых объявлений', 'Алғашқы жарнамаларды іске қосу', 'First ads live'), L('Тексты, картинки и настройка показа', 'Мәтіндер, суреттер және көрсетуді баптау', 'Copy, visuals and targeting set-up'), 2],
      o_srv: [L('Страница под услугу', 'Қызметке арналған бет', 'Service landing page'), L('Одна страница, одна цель — заявка', 'Бір бет, бір мақсат — өтінім', 'One page, one goal: a request'), 3],
      o_goods: [L('Витрина товаров', 'Тауарлар витринасы', 'Product showcase'), L('Карточки, фото и кнопка «купить»', 'Карточкалар, фото және «сатып алу» түймесі', 'Cards, photos and a buy button'), 4],
      o_real: [L('Каталог объектов', 'Объектілер каталогы', 'Property catalogue'), L('Подбор по району, цене и площади', 'Аудан, баға және ауданы бойынша таңдау', 'Search by area, price and size'), 4],
      o_edu: [L('Страница курса и запись', 'Курс беті және жазылу', 'Course page and sign-up'), L('Программа, цена и запись на пробное', 'Бағдарлама, баға және сынақ сабаққа жазылу', 'Programme, price and trial booking'), 3],
      c_ig: [L('Instagram: таргет и контент', 'Instagram: таргет және контент', 'Instagram: ads and content'), L('Посты, сторис и реклама на вашу аудиторию', 'Постар, сторис және аудиторияңызға жарнама', 'Posts, stories and ads for your audience'), 4],
      c_g: [L('Google Ads и карточка 2ГИС', 'Google Ads және 2ГИС картасы', 'Google Ads and a 2GIS listing'), L('Вас находят, когда ищут вашу услугу', 'Қызметті іздегенде сізді табады', 'You show up when people search'), 4],
      c_tt: [L('TikTok: ролики и реклама', 'TikTok: бейнелер және жарнама', 'TikTok: videos and ads'), L('Короткие ролики и запуск рекламы', 'Қысқа бейнелер және жарнама', 'Short videos and ad launch'), 5],
      ads: [L('Ведение рекламных кабинетов', 'Жарнама кабинеттерін жүргізу', 'Ad account management'), L('Ставки, аудитории, ежедневный контроль', 'Ставкалар, аудиториялар, күнделікті бақылау', 'Bids, audiences, daily control'), 3],
      abt: [L('Проверка нескольких вариантов', 'Бірнеше нұсқаны тексеру', 'Testing several variants'), L('Что работает лучше — по цифрам', 'Қайсысы жақсы — сандар бойынша', 'What works better, by the numbers'), 2],
      buyer: [L('Отдельный специалист по закупке трафика', 'Трафик сатып алу маманы', 'A dedicated media buyer'), L('Для больших бюджетов', 'Үлкен бюджеттер үшін', 'For larger budgets'), 4],
      i_wa: [L('Автоответ в WhatsApp', 'WhatsApp автоматты жауабы', 'WhatsApp auto-reply'), L('Быстрые ответы и передача менеджеру', 'Жылдам жауаптар, менеджерге беру', 'Quick replies and handover to a manager'), 2],
      i_call: [L('Скрипт звонка и пропущенные', 'Қоңырау скрипті және өткізілгендер', 'Call script and missed calls'), L('Что говорить и как не терять звонки', 'Не айту керек, қоңырауды жоғалтпау', 'What to say and how not to lose calls'), 2],
      i_form: [L('Форма на сайте с передачей в CRM', 'Сайттағы форма, CRM-ге беру', 'Site form feeding a CRM'), L('Заявка сразу попадает в таблицу', 'Өтінім бірден кестеге түседі', 'A request lands in the table at once'), 3],
      i_crm: [L('Простая CRM для заявок', 'Өтінімдерге арналған қарапайым CRM', 'A simple CRM for leads'), L('Все заявки в одном месте', 'Барлық өтінім бір жерде', 'All leads in one place'), 3],
      r_m: [L('Отчёт раз в месяц', 'Айына бір рет есеп', 'Monthly report'), L('Заявки, цена заявки, выводы', 'Өтінімдер, өтінім бағасы, қорытынды', 'Leads, cost per lead, conclusions'), 1],
      r_w: [L('Отчёт каждую неделю', 'Апта сайын есеп', 'Weekly report'), L('Короткий разбор и план на неделю', 'Қысқа талдау және апталық жоспар', 'A short review and next-week plan'), 2],
      r_m2: [L('Личный менеджер на связи', 'Жеке менеджер байланыста', 'A personal manager on call'), L('Один человек, быстрый ответ', 'Бір адам, жылдам жауап', 'One person, quick answers'), 3]
    },
    questions: [
      { id: 'offer', kind: 'choice', st: 0, title: L('Что вы продвигаете?', 'Нені жылжытасыз?', 'What are you promoting?'), def: 'srv',
        opts: [
          { id: 'srv', label: L('Услуги', 'Қызметтер', 'Services'), icon: { t: 'poster', g: 'tool' }, prop: { t: 'poster', g: 'tool' }, lines: ['o_srv'] },
          { id: 'goods', label: L('Товары', 'Тауарлар', 'Goods'), icon: { t: 'poster', g: 'box' }, prop: { t: 'poster', g: 'box' }, lines: ['o_goods'] },
          { id: 'real', label: L('Недвижимость', 'Жылжымайтын мүлік', 'Property'), icon: { t: 'poster', g: 'house' }, prop: { t: 'poster', g: 'house' }, lines: ['o_real'] },
          { id: 'edu', label: L('Обучение', 'Оқыту', 'Education'), icon: { t: 'poster', g: 'cap' }, prop: { t: 'poster', g: 'cap' }, lines: ['o_edu'] }
        ] },
      { id: 'chan', kind: 'choice', st: 1, title: L('Где ищем клиентов?', 'Клиентті қайдан іздейміз?', 'Where do we look for customers?'), def: 'ig',
        opts: [
          { id: 'ig', label: L('Instagram', 'Instagram', 'Instagram'), icon: { t: 'screen', x: 'IG' }, prop: { t: 'monitor', x: 'IG' }, lines: ['c_ig'] },
          { id: 'g', label: L('Google и 2ГИС', 'Google және 2ГИС', 'Google and 2GIS'), icon: { t: 'screen', x: 'GIS' }, prop: { t: 'monitor', x: 'GIS' }, lines: ['c_g'] },
          { id: 'tt', label: L('TikTok', 'TikTok', 'TikTok'), icon: { t: 'screen', x: 'TT' }, prop: { t: 'monitor', x: 'TT' }, lines: ['c_tt'] },
          { id: 'all', label: L('Всё сразу', 'Бәрі бірден', 'All at once'), icon: { t: 'screen', x: 'ALL' }, prop: { t: 'monitor', x: 'ALL' }, lines: ['c_ig', 'c_g', 'c_tt'] }
        ] },
      { id: 'budget', kind: 'number', st: 2, unit: L('₸ в месяц', '₸ айына', 'KZT a month'), title: L('Рекламный бюджет в месяц, ₸?', 'Айлық жарнама бюджеті, ₸?', 'Monthly ad budget, KZT?'), def: 'b2',
        chips: [200000, 500000, 1000000, 3000000],
        opts: [
          { id: 'b1', max: 300000, label: L('до 300 000 ₸', '300 000 ₸-ға дейін', 'up to 300,000 KZT'), icon: { t: 'coins', n: 1 }, prop: { t: 'coins', n: 1 }, lines: [] },
          { id: 'b2', max: 700000, label: L('до 700 000 ₸', '700 000 ₸-ға дейін', 'up to 700,000 KZT'), icon: { t: 'coins', n: 2 }, prop: { t: 'coins', n: 2 }, lines: ['ads'] },
          { id: 'b3', max: 2000000, label: L('до 2 000 000 ₸', '2 000 000 ₸-ға дейін', 'up to 2,000,000 KZT'), icon: { t: 'coins', n: 3 }, prop: { t: 'coins', n: 3 }, lines: ['ads', 'abt'] },
          { id: 'b4', max: 1e13, label: L('больше 2 000 000 ₸', '2 000 000 ₸-дан көп', 'over 2,000,000 KZT'), icon: { t: 'coins', n: 4 }, prop: { t: 'coins', n: 4 }, lines: ['ads', 'abt', 'buyer'] }
        ] },
      { id: 'intake', kind: 'choice', st: 2, title: L('Как принимаете заявки?', 'Өтінімдерді қалай қабылдайсыз?', 'How do requests reach you?'), def: 'wa',
        opts: [
          { id: 'wa', label: L('WhatsApp', 'WhatsApp', 'WhatsApp'), icon: { t: 'cell', x: 'WA' }, prop: { t: 'cell', x: 'WA' }, lines: ['i_wa'] },
          { id: 'call', label: L('Звонки', 'Қоңыраулар', 'Phone calls'), icon: { t: 'phone' }, prop: { t: 'phone' }, lines: ['i_call'] },
          { id: 'form', label: L('Форма на сайте', 'Сайттағы форма', 'Site form'), icon: { t: 'screen', x: 'CRM' }, prop: { t: 'laptop', x: 'CRM' }, lines: ['i_form'] },
          { id: 'none', label: L('Пока никак', 'Әзірге ешқалай', 'No system yet'), icon: { t: 'clip' }, prop: { t: 'clip' }, lines: ['i_crm'] }
        ] },
      { id: 'report', kind: 'choice', st: 3, title: L('Как часто нужен отчёт?', 'Есеп қаншалықты жиі керек?', 'How often do you want a report?'), def: 'm',
        opts: [
          { id: 'm', label: L('Раз в месяц', 'Айына бір рет', 'Monthly'), icon: { t: 'chart', n: 2 }, prop: { t: 'chart', n: 2 }, lines: ['r_m'] },
          { id: 'w', label: L('Каждую неделю', 'Апта сайын', 'Weekly'), icon: { t: 'chart', n: 4 }, prop: { t: 'chart', n: 4 }, lines: ['r_w'] },
          { id: 'pm', label: L('Личный менеджер', 'Жеке менеджер', 'A personal manager'), icon: { t: 'headset' }, prop: { t: 'headset', chart: 1 }, lines: ['r_w', 'r_m2'] }
        ] }
    ],
    demo: [
      ['Дамир Ахметов', '+7 701 810 44 12', { offer: 'srv', chan: 'ig', budget: 500000, intake: 'wa', report: 'm' }, 0, 12],
      ['Ирина Соколова', '@irina_s', { offer: 'goods', chan: 'all', budget: 1500000, intake: 'form', report: 'w' }, 0, 130],
      ['Асем Қуанышева', '+7 777 321 90 05', { offer: 'edu', chan: 'tt', budget: 250000, intake: 'wa', report: 'm' }, 1, 600],
      ['Виктор Ли', '+7 705 440 31 18', { offer: 'real', chan: 'g', budget: 3000000, intake: 'call', report: 'pm' }, 1, 1900],
      ['Кафе «Сумка»', '+7 707 600 11 77', { offer: 'srv', chan: 'ig', budget: 300000, intake: 'none', report: 'w' }, 2, 3300],
      ['Рустем Нуров', '@rustem_n', { offer: 'goods', chan: 'g', budget: 800000, intake: 'form', report: 'm' }, 3, 7200]
    ]
  };

  window.SAI = { L: L, UI: UI, TENANTS: { stock: STOCK, agency: AGENCY } };
})();
