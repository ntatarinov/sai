// Проверка поведения офиса на реальных данных: события берутся из запущенного
// API, а не выдумываются здесь. Canvas и DOM подменены заглушками — проверяется
// логика перемещений, а не пиксели.
const fs = require('fs'), vm = require('vm');
const BASE = process.env.OSNOVA_URL || 'http://localhost:5080';

const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });
const el = () => ({ innerHTML: '', textContent: '', value: '', style: {},
  children: [], classList: { add: noop, remove: noop, toggle: noop },
  appendChild(c) { this.children.push(c); }, scrollTop: 0, scrollHeight: 0,
  addEventListener: noop, onclick: null, querySelectorAll: () => [] });

const ctxObj = {
  document: {
    getElementById: (() => { const m = {}; return id => (m[id] ||= el()); })(),
    createElement: el, querySelectorAll: () => []
  },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  performance: { now: () => Date.now() },
  requestAnimationFrame: noop,
  setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0,
  // относительные пути страницы разворачиваем в адрес запущенного сервера
  fetch: (u, o) => global.fetch(u.startsWith('http') ? u : BASE + u, o),
  console, Math, Date, JSON, Error, Promise
};
ctxObj.window = ctxObj;
vm.createContext(ctxObj);

// canvas
ctxObj.document.getElementById('office').getContext = () => noop;
ctxObj.document.getElementById('office').width = 960;
ctxObj.document.getElementById('office').height = 600;
ctxObj.document.getElementById('office').addEventListener = noop;

// `let`/`const` верхнего уровня в vm не попадают на объект контекста, поэтому для
// теста объявления переводятся в `var`. Код при этом не меняется по смыслу.
const load = name => {
  const src = fs.readFileSync(require('path').join(__dirname, '../../src/Osnova.Api/wwwroot', name), 'utf8')
    .replace(/^(let|const) /gm, 'var ')
    .replace(/^class (\w+)/gm, 'var $1 = class $1');
  vm.runInContext(src, ctxObj);
};
// Порядок тот же, что на странице: форматирование времени грузится первым.
ctxObj.Intl = Intl;
load('format.js');
load('agent-office.js');

const S = ctxObj;
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  OK   ' : '  ПРОВАЛ ') + msg); if (!ok) failures++; };

// шаг времени: прокручиваем движение, пока агенты не дойдут
const settle = (sec = 12) => { for (let i = 0; i < sec * 60; i++) for (const a of S.AGENTS.values()) a.update(1 / 60); };
const at = (a, x, y) => Math.abs(a.x - x) < .6 && Math.abs(a.y - y) < .6;

(async () => {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'admin', password: 'admin123' })
  }).then(r => r.json());
  S.TOKEN = login.token;

  await S.loadAll();
  console.log(`загружено событий: ${S.EVENTS.length}, требований: ${S.REQS.length}\n`);

  // --- сценарий 1: обращение одного агента к другому ---------------------
  console.log('Обращение агента к агенту (REQ-OSN-003):');
  S.FILTER = 'REQ-OSN-003';
  S.resetPlayback();
  S.PLAYING = true;

  const fe = S.AGENTS.get('FrontendDev'), sec = S.AGENTS.get('SecurityReviewer');
  const secSeat = S.DESKS.find(d => d.role === 'SecurityReviewer').seat;

  const list = () => S.EVENTS.filter(e => e.requirement === S.FILTER);
  const playUntil = kind => {
    while (S.CURSOR < list().length) {
      const e = list()[S.CURSOR];
      S.playNext();
      if (e.kind === kind) return e;
    }
    return null;
  };

  check(at(fe, fe.home.x, fe.home.y), 'до обращения разработчик за своим столом');

  const q = playUntil('Question');
  check(!!q && q.target === 'SecurityReviewer', `событие Question -> ${q && q.target}`);
  check(fe.path.length > 0, `построен маршрут к столу коллеги (${fe.path.length} клеток)`);
  settle();
  check(at(fe, secSeat[0] + 1, secSeat[1]),
    `разработчик дошёл к столу ревьюера (${fe.x.toFixed(1)}, ${fe.y.toFixed(1)}), ожидалось (${secSeat[0] + 1}, ${secSeat[1]})`);
  check(sec.state === 'answering', `ревьюер переведён в состояние ответа (${sec.state})`);

  playUntil('Answer');
  settle();
  check(at(fe, fe.home.x, fe.home.y), 'после ответа разработчик вернулся за свой стол');

  // --- сценарий 2: совещание --------------------------------------------
  console.log('\nСовещание (REQ-OSN-002):');
  S.FILTER = 'REQ-OSN-002';
  S.resetPlayback();
  const m = playUntil('Meeting');
  const parts = m.participants.split(',').map(s => s.trim());
  check(parts.length >= 3, `участников в событии: ${parts.length} (${m.participants})`);
  settle(16);
  const inRoom = parts.filter(p => {
    const a = S.AGENTS.get(p);
    return a && a.x >= S.MEETING.x - 1 && a.x <= S.MEETING.x + S.MEETING.w &&
           a.y >= S.MEETING.y - 2 && a.y <= S.MEETING.y + S.MEETING.h + 2;
  });
  check(inRoom.length === parts.length,
    `в переговорной собрались ${inRoom.length} из ${parts.length}: ${inRoom.join(', ')}`);
  const outside = [...S.AGENTS.values()].filter(a => a.active && !parts.includes(a.role) &&
    a.x >= S.MEETING.x && a.x <= S.MEETING.x + S.MEETING.w);
  check(outside.length === 0, `непричастные агенты на совещание не пришли (${outside.length} нарушений)`);

  // --- сценарий 3: никто не проходит сквозь стены и столы ----------------
  console.log('\nПроходимость:');
  S.FILTER = '';
  S.resetPlayback();
  let violations = 0;
  for (let step = 0; step < S.EVENTS.length; step++) {
    S.playNext();
    for (let i = 0; i < 400; i++) {
      for (const a of S.AGENTS.values()) {
        a.update(1 / 60);
        if (!a.active) continue;
        const c = S.MAP[Math.round(a.y)] && S.MAP[Math.round(a.y)][Math.round(a.x)];
        if (c === '#' || c === 'D' || c === 'S') violations++;
      }
    }
  }
  check(violations === 0, `сквозь стены и столы никто не прошёл (${violations} нарушений)`);

  // --- сценарий 4: в офисе только те, кто реально работал ----------------
  console.log('\nСостав офиса:');
  const activeRoles = [...S.AGENTS.values()].filter(a => a.active).map(a => a.role).sort();
  const realRoles = [...new Set(S.EVENTS.flatMap(e => [e.actor, e.target,
    ...(e.participants || '').split(',').map(s => s.trim())].filter(Boolean)))].sort();
  const extra = activeRoles.filter(r => !realRoles.includes(r));
  check(extra.length === 0, `показаны только участвовавшие роли (${activeRoles.length} из ${realRoles.length}); лишних: ${extra.length}`);

  const totalEvents = [...S.AGENTS.values()].reduce((s, a) => s + a.events, 0);
  check(totalEvents === S.EVENTS.length,
    `проиграны все события: ${totalEvents} из ${S.EVENTS.length}`);

  // --- сценарий 5: время в поясе организации, а не устройства ------------
  console.log('\nЧасовой пояс:');
  check(S.ORG_TIME_ZONE === 'Asia/Almaty', `пояс организации задан именем: ${S.ORG_TIME_ZONE}`);
  check(S.fmtTime('2026-09-20T04:00:00Z') === '09:00',
    `04:00 UTC показывается как 09:00 по Алматы (получено ${S.fmtTime('2026-09-20T04:00:00Z')})`);
  check(S.fmtDate('2026-09-30T19:40:00Z') === '01.10.2026',
    `граница суток: 30.09 19:40 UTC — это уже 1 октября по Алматы (получено ${S.fmtDate('2026-09-30T19:40:00Z')})`);

  // Устройство в другом поясе не должно менять показанное время. Проверяется
  // запуском в отдельном процессе с подменённым TZ — иначе проверка на машине
  // из того же пояса ничего не доказывает.
  const { execFileSync } = require('child_process');
  const probe = JSON.stringify(require('path').join(__dirname, '../../src/Osnova.Api/wwwroot/format.js'));
  // 'use strict' в начале файла делает eval строгим, и его объявления не выходят
  // наружу. В браузере это не мешает — там это обычный скрипт, — но в пробнике
  // директиву приходится снять.
  const out = execFileSync(process.execPath, ['-e',
    `eval(require('fs').readFileSync(${probe},'utf8')` +
    `.replace("'use strict';","").replace(/^const /gm,'var '));` +
    `console.log(fmtTime('2026-09-20T04:00:00Z'))`],
    { env: { ...process.env, TZ: 'Pacific/Auckland' }, encoding: 'utf8' }).trim();
  check(out === '09:00', `устройство в поясе Pacific/Auckland видит то же время: ${out}`);

  console.log(failures === 0 ? '\nИТОГ: все проверки пройдены' : `\nИТОГ: провалов ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
