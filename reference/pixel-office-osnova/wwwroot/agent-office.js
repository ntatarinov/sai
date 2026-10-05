'use strict';

/* Agent Office — визуализация фактической работы агентной системы.
 *
 * Граница ответственности (решение по REQ-OSN-003): эта страница ничем не
 * управляет и ничего не придумывает. Она читает поток событий, записанный
 * оркестратором по ходу реальной работы, и показывает его как офис, журнал и
 * отчёт по требованию — из одного источника, а не из трёх разных. */

/* =================================================================== состояние */

let TOKEN = localStorage.getItem('osnova_token') || null;
let MODE = 'LIVE';
let PLAYING = true;
let SPEED = 1;
let FILTER = '';

let EVENTS = [];        // все загруженные события
let CURSOR = 0;         // сколько событий уже проиграно
let LAST_ID = 0;        // максимальный Id, полученный с сервера
let REQS = [];
let SELECTED = null;    // выбранный агент

const CELL = 24;
const COLS = 40, ROWS = 25;

/* =================================================================== планировка
 *
 * Сетка проходимости: '.' пол, '#' стена, 'D' стол (непроходим), 'M' переговорная,
 * 'C' кофе-поинт, 'S' серверная. Персонажи не ходят сквозь стены и столы. */

const MAP = [
  '########################################',
  '#......................#...............#',
  '#..DD....DD....DD......#....MMMMMM.....#',
  '#..DD....DD....DD......#....MMMMMM.....#',
  '#......................#....MMMMMM.....#',
  '#......................#...............#',
  '#..DD....DD....DD......#...............#',
  '#..DD....DD....DD......#####....########',
  '#......................................#',
  '#......................................#',
  '#..DD....DD....DD......................#',
  '#..DD....DD....DD......#########...CC..#',
  '#......................#.......#...CC..#',
  '#......................#..SSS..#.......#',
  '#..DD....DD....DD......#..SSS..#.......#',
  '#..DD....DD....DD......#.......#.......#',
  '#......................#########.......#',
  '#......................................#',
  '#......................................#',
  '#......................................#',
  '#......................................#',
  '#......................................#',
  '#......................................#',
  '#......................................#',
  '########################################'
];

const walkable = (x, y) =>
  x >= 0 && y >= 0 && x < COLS && y < ROWS &&
  MAP[y][x] !== '#' && MAP[y][x] !== 'D' && MAP[y][x] !== 'S';

/* Рабочие места: стол занимает 2×2, агент садится слева снизу от него. */
const DESKS = [
  { role: 'Orchestrator',     desk: [3, 2],  seat: [5, 3] },
  { role: 'BusinessAnalyst',  desk: [9, 2],  seat: [11, 3] },
  { role: 'Architect',        desk: [15, 2], seat: [17, 3] },
  { role: 'BackendDev',       desk: [3, 6],  seat: [5, 7] },
  { role: 'FrontendDev',      desk: [9, 6],  seat: [11, 7] },
  { role: 'TestEngineer',     desk: [15, 6], seat: [17, 7] },
  { role: 'SecurityReviewer', desk: [3, 10], seat: [5, 11] },
  { role: 'Reviewer',         desk: [9, 10], seat: [11, 11] },
  { role: 'ReleaseValidator', desk: [15, 10], seat: [17, 11] },
  { role: 'DomainResearcher', desk: [3, 14], seat: [5, 15] },
  { role: 'Accountant',       desk: [9, 14], seat: [11, 15] },
  { role: 'ErpSpecialist',    desk: [15, 14], seat: [17, 15] }
];

const MEETING = { x: 28, y: 2, w: 6, h: 3 };
const MEETING_SEATS = [[28, 5], [30, 5], [32, 5], [29, 1], [31, 1], [33, 5]];

const ROLE_RU = {
  Orchestrator: 'Оркестратор', BusinessAnalyst: 'Бизнес-аналитик', Architect: 'Архитектор',
  BackendDev: 'Разработчик бэкенда', FrontendDev: 'Разработчик фронтенда',
  SecurityReviewer: 'Ревьюер безопасности', Reviewer: 'Ревьюер кода',
  TestEngineer: 'Инженер тестирования', DomainResearcher: 'Исследователь предметной области',
  Accountant: 'Бухгалтер', ErpSpecialist: 'Специалист по ERP', ReleaseValidator: 'Валидатор релиза'
};
const ROLE_SHORT = {
  Orchestrator: 'ORCH', BusinessAnalyst: 'BA', Architect: 'ARCH', BackendDev: 'BE',
  FrontendDev: 'FE', SecurityReviewer: 'SEC', Reviewer: 'REV', TestEngineer: 'QA',
  DomainResearcher: 'RES', Accountant: 'ACC', ErpSpecialist: 'ERP', ReleaseValidator: 'RV'
};
const ROLE_COLOR = {
  Orchestrator: '#e8b64c', BusinessAnalyst: '#5aa9ff', Architect: '#b48ce8',
  BackendDev: '#48c98a', FrontendDev: '#4fd0c0', SecurityReviewer: '#ef6b5e',
  Reviewer: '#f08a5d', TestEngineer: '#7ed957', DomainResearcher: '#9aa7ff',
  Accountant: '#f0c674', ErpSpecialist: '#c98ad4', ReleaseValidator: '#6bd4ef'
};

const KIND_RU = {
  RequirementCreated: 'требование заведено', TaskAssigned: 'задача назначена',
  WorkStarted: 'начал работу', Research: 'исследует', Question: 'обращается',
  Answer: 'отвечает', Meeting: 'совещание', Decision: 'решение',
  Implementation: 'реализует', Review: 'review', TestRun: 'тестирует',
  DefectFound: 'найден дефект', TaskCompleted: 'задача выполнена',
  RequirementCompleted: 'требование выполнено'
};

/* Состояние агента: что он делает и как это выглядит. */
const STATE_BY_KIND = {
  RequirementCreated: 'thinking', TaskAssigned: 'assigning', WorkStarted: 'working',
  Research: 'researching', Question: 'asking', Answer: 'answering',
  Meeting: 'meeting', Decision: 'thinking', Implementation: 'coding',
  Review: 'reviewing', TestRun: 'testing', DefectFound: 'blocked',
  TaskCompleted: 'completed', RequirementCompleted: 'completed'
};

/* =================================================================== агенты */

class Agent {
  constructor(role, seat) {
    this.role = role;
    this.home = { x: seat[0], y: seat[1] };
    this.x = seat[0]; this.y = seat[1];       // клетки, дробные при движении
    this.path = [];
    this.state = 'idle';
    this.bubble = null;
    this.bubbleUntil = 0;
    this.active = false;                       // участвовал ли в работе
    this.lastEvent = null;
    this.events = 0;
    this.bob = Math.random() * Math.PI * 2;
  }

  goTo(cx, cy) {
    const p = findPath(Math.round(this.x), Math.round(this.y), cx, cy);
    if (p) this.path = p;
  }

  say(text, ms = 4200) {
    this.bubble = text;
    this.bubbleUntil = performance.now() + ms;
  }

  update(dt) {
    this.bob += dt * 3;
    if (this.path.length) {
      const [tx, ty] = this.path[0];
      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      const step = dt * 3.4 * SPEED;
      if (dist <= step) { this.x = tx; this.y = ty; this.path.shift(); }
      else { this.x += dx / dist * step; this.y += dy / dist * step; }
      this.state = 'walking';
    } else if (this.state === 'walking') {
      this.state = this.atHome() ? 'working' : 'talking';
    }
    if (this.bubble && performance.now() > this.bubbleUntil) this.bubble = null;
  }

  atHome() {
    return Math.abs(this.x - this.home.x) < .4 && Math.abs(this.y - this.home.y) < .4;
  }
}

const AGENTS = new Map();
DESKS.forEach(d => AGENTS.set(d.role, new Agent(d.role, d.seat)));

/* =================================================================== поиск пути */

function findPath(sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];
  const key = (x, y) => y * COLS + x;
  const prev = new Map();
  const seen = new Set([key(sx, sy)]);
  let frontier = [[sx, sy]];

  while (frontier.length) {
    const next = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!walkable(nx, ny) || seen.has(key(nx, ny))) continue;
        seen.add(key(nx, ny));
        prev.set(key(nx, ny), [x, y]);
        if (nx === tx && ny === ty) {
          const path = [];
          let cur = [nx, ny];
          while (!(cur[0] === sx && cur[1] === sy)) {
            path.push(cur);
            cur = prev.get(key(cur[0], cur[1]));
          }
          return path.reverse();
        }
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return null;   // цель недостижима — агент остаётся на месте, а не телепортируется
}

/* =================================================================== отрисовка */

const cv = document.getElementById('office');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

function px(v) { return Math.round(v * CELL); }

function drawOffice() {
  ctx.fillStyle = '#0f1520';
  ctx.fillRect(0, 0, cv.width, cv.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = MAP[y][x];
      const X = px(x), Y = px(y);
      if (c === '#') {
        ctx.fillStyle = '#26344a'; ctx.fillRect(X, Y, CELL, CELL);
        ctx.fillStyle = '#2f3f59'; ctx.fillRect(X, Y, CELL, 3);
      } else if (c === 'D') {
        ctx.fillStyle = '#1a2433'; ctx.fillRect(X, Y, CELL, CELL);
        ctx.fillStyle = '#6b4f37'; ctx.fillRect(X + 1, Y + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = '#805e42'; ctx.fillRect(X + 1, Y + 1, CELL - 2, 3);
      } else if (c === 'M') {
        ctx.fillStyle = '#1b2a3d'; ctx.fillRect(X, Y, CELL, CELL);
        ctx.fillStyle = '#2a3e57'; ctx.fillRect(X + 1, Y + 1, CELL - 2, CELL - 2);
      } else if (c === 'C') {
        ctx.fillStyle = '#1a2433'; ctx.fillRect(X, Y, CELL, CELL);
        ctx.fillStyle = '#4a3a2c'; ctx.fillRect(X + 4, Y + 6, CELL - 8, CELL - 10);
        ctx.fillStyle = '#c98f5a'; ctx.fillRect(X + 6, Y + 8, CELL - 12, 4);
      } else if (c === 'S') {
        ctx.fillStyle = '#141d2a'; ctx.fillRect(X, Y, CELL, CELL);
        ctx.fillStyle = '#23334a'; ctx.fillRect(X + 3, Y + 2, CELL - 6, CELL - 4);
        ctx.fillStyle = '#48c98a'; ctx.fillRect(X + 5, Y + 5, 3, 2);
        ctx.fillStyle = '#e8b64c'; ctx.fillRect(X + 5, Y + 10, 3, 2);
      } else {
        ctx.fillStyle = (x + y) % 2 ? '#131b27' : '#151e2b';
        ctx.fillRect(X, Y, CELL, CELL);
      }
    }
  }

  // мониторы на столах
  for (const d of DESKS) {
    const X = px(d.desk[0]) + 4, Y = px(d.desk[1]) + 2;
    ctx.fillStyle = '#0d1420'; ctx.fillRect(X, Y, 16, 12);
    const a = AGENTS.get(d.role);
    const lit = a && ['working', 'coding', 'researching', 'reviewing', 'testing'].includes(a.state);
    ctx.fillStyle = lit ? (ROLE_COLOR[d.role] || '#5aa9ff') : '#1b2740';
    ctx.fillRect(X + 2, Y + 2, 12, 8);
  }

  // подписи зон
  ctx.fillStyle = '#6b83a3';
  ctx.font = '9px system-ui';
  ctx.fillText('ПЕРЕГОВОРНАЯ', px(MEETING.x) + 4, px(MEETING.y) - 3);
  ctx.fillText('СЕРВЕРНАЯ', px(26), px(13) - 3);
  ctx.fillText('КОФЕ', px(35) + 2, px(11) - 3);
}

function drawAgent(a) {
  if (!a.active) return;
  const X = px(a.x), Y = px(a.y);
  const bob = a.state === 'walking' ? Math.sin(a.bob * 2) * 1.2 : Math.sin(a.bob) * .6;
  const color = ROLE_COLOR[a.role] || '#5aa9ff';

  // тень
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(X + 5, Y + CELL - 4, 14, 3);

  // тело
  ctx.fillStyle = color;
  ctx.fillRect(X + 6, Y + 9 + bob, 12, 11);
  // голова
  ctx.fillStyle = '#f0d0b0';
  ctx.fillRect(X + 8, Y + 2 + bob, 8, 8);
  // волосы
  ctx.fillStyle = '#3a2c22';
  ctx.fillRect(X + 8, Y + 2 + bob, 8, 3);

  // индикатор состояния
  const ind = {
    blocked: '#ef6b5e', meeting: '#b48ce8', asking: '#e8b64c',
    answering: '#5aa9ff', testing: '#7ed957', completed: '#48c98a'
  }[a.state];
  if (ind) {
    ctx.fillStyle = ind;
    ctx.beginPath(); ctx.arc(X + CELL - 5, Y + 3, 3.2, 0, Math.PI * 2); ctx.fill();
  }

  // выделение выбранного
  if (SELECTED === a.role) {
    ctx.strokeStyle = '#5aa9ff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(X + 3, Y + 1, CELL - 6, CELL - 3);
  }

  // короткая метка роли
  ctx.fillStyle = '#93a7c4'; ctx.font = '8px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(ROLE_SHORT[a.role] || '', X + CELL / 2, Y + CELL + 6);
  ctx.textAlign = 'left';
}

function drawBubbles() {
  for (const a of AGENTS.values()) {
    if (!a.bubble || !a.active) continue;
    const text = a.bubble.length > 42 ? a.bubble.slice(0, 41) + '…' : a.bubble;
    ctx.font = '10px system-ui';
    const w = ctx.measureText(text).width + 14;
    let bx = px(a.x) + CELL / 2 - w / 2;
    let by = px(a.y) - 24;
    bx = Math.max(2, Math.min(cv.width - w - 2, bx));
    by = Math.max(2, by);

    ctx.fillStyle = 'rgba(22,31,46,.96)';
    ctx.strokeStyle = ROLE_COLOR[a.role] || '#5aa9ff';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, w, 18, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#dbe4f0';
    ctx.fillText(text, bx + 7, by + 12);
  }
}

function frame(ts) {
  const dt = Math.min(.05, (ts - (frame.last || ts)) / 1000);
  frame.last = ts;
  if (PLAYING) for (const a of AGENTS.values()) a.update(dt);
  drawOffice();
  for (const a of AGENTS.values()) drawAgent(a);
  drawBubbles();
  requestAnimationFrame(frame);
}

/* =================================================================== проигрывание */

/* Один шаг: берём следующее реальное событие и показываем то, что оно означает.
 * Никаких случайных перемещений «для красоты» — движение происходит, только если
 * событие действительно требует, чтобы агент подошёл к другому. */
function playNext() {
  const list = visibleEvents();
  // На паузе и в конце потока насос не останавливается, а ждёт: в режиме LIVE
  // события могут дописаться позже, и офис должен их подхватить сам.
  if (!PLAYING || CURSOR >= list.length) {
    clearTimeout(scheduleNext.t);
    scheduleNext.t = setTimeout(playNext, 1200);
    return;
  }

  const e = list[CURSOR++];
  const actor = AGENTS.get(e.actor);
  if (!actor) { scheduleNext(); return; }

  actor.active = true;
  actor.state = STATE_BY_KIND[e.kind] || 'working';
  actor.lastEvent = e;
  actor.events++;
  actor.say(e.topic);

  // Агент, оставшийся у чужого стола или в переговорной, возвращается к себе,
  // как только снова берётся за собственную работу.
  const deskWork = ['WorkStarted', 'Research', 'Implementation', 'Review',
                    'TestRun', 'TaskCompleted', 'Decision'];
  if (deskWork.includes(e.kind) && !actor.atHome()) actor.goTo(actor.home.x, actor.home.y);

  if (e.kind === 'Question' && e.target) {
    const target = AGENTS.get(e.target);
    if (target) {
      target.active = true;
      const seat = DESKS.find(d => d.role === e.target).seat;
      actor.goTo(seat[0] + 1, seat[1]);      // подходит к столу коллеги, не на него
      target.state = 'answering';
    }
  } else if (e.kind === 'Answer' && e.target) {
    const back = AGENTS.get(e.target);
    if (back) { back.active = true; back.goTo(back.home.x, back.home.y); }
  } else if (e.kind === 'Meeting') {
    const roles = (e.participants || '').split(',').map(s => s.trim()).filter(Boolean);
    roles.forEach((role, i) => {
      const ag = AGENTS.get(role);
      if (!ag) return;
      ag.active = true;
      ag.state = 'meeting';
      const seat = MEETING_SEATS[i % MEETING_SEATS.length];
      ag.goTo(seat[0], seat[1]);
    });
  } else if (e.kind === 'TaskAssigned' && e.target) {
    const t = AGENTS.get(e.target);
    if (t) { t.active = true; t.state = 'assigned'; t.say('Принял: ' + e.topic, 3200); }
  } else if (['TaskCompleted', 'RequirementCompleted'].includes(e.kind)) {
    for (const a of AGENTS.values())
      if (a.active && a.state === 'meeting') a.goTo(a.home.x, a.home.y);
  }

  pushFeed(e);
  renderLegend();
  scheduleNext();
}

/* Темп воспроизведения зависит от скорости: на 4× события идут вчетверо чаще.
 * Событие, требующее перехода по офису, держится дольше — иначе персонаж не
 * успевает дойти и показанное расходится с журналом. */
function scheduleNext() {
  clearTimeout(scheduleNext.t);
  const last = visibleEvents()[CURSOR - 1];
  const slow = last && ['Question', 'Meeting'].includes(last.kind);
  scheduleNext.t = setTimeout(playNext, (slow ? 4200 : 2000) / SPEED);
}

function visibleEvents() {
  return FILTER ? EVENTS.filter(e => e.requirement === FILTER) : EVENTS;
}

/* =================================================================== журнал */

function pushFeed(e) {
  const feed = document.getElementById('feed');
  const div = document.createElement('div');
  div.className = 'ev k-' + e.kind;
  const time = fmtTime(e.at);
  const who = ROLE_RU[e.actor] || e.actor;
  const to = e.target ? ' → ' + (ROLE_RU[e.target] || e.target) : '';
  div.innerHTML = `<span class="t">${time}</span>
    <span class="req">${esc(e.requirement)}</span>
    <span class="topic"><span class="who">${esc(who)}${esc(to)}</span> — ${esc(KIND_RU[e.kind] || e.kind)}</span>
    <span class="det">${esc(e.topic)}</span>`;
  div.onclick = () => openRequirement(e.requirement);
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
  document.getElementById('feedCount').textContent =
    `${feed.children.length} из ${visibleEvents().length}`;
}

function renderLegend() {
  const active = [...AGENTS.values()].filter(a => a.active);
  document.getElementById('legend').innerHTML = active.map(a =>
    `<span title="${esc(ROLE_RU[a.role])}"><i style="background:${ROLE_COLOR[a.role]}"></i>${
      esc(ROLE_RU[a.role])} <span class="muted">· ${a.events}</span></span>`).join('');
}

const esc = v => (v ?? '').toString()
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* =================================================================== данные */

const api = async (path) => {
  const res = await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + TOKEN } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};

async function loadRequirements() {
  REQS = await api('/agent-office/requirements');
  const sel = document.getElementById('reqFilter');
  const keep = sel.value;
  sel.innerHTML = '<option value="">Все требования</option>' +
    REQS.map(r => `<option value="${esc(r.code)}">${esc(r.code)} — ${esc(r.title)}</option>`).join('');
  sel.value = keep;   // появление нового требования не должно сбрасывать фильтр
  renderRequirements();
}

async function loadAll() {
  await loadRequirements();

  const evs = await api('/agent-office/events');
  EVENTS = evs;
  LAST_ID = evs.length ? evs[evs.length - 1].id : 0;
}

/** Дочитывает только новые события: страница опрашивает источник, а не наоборот.
 *  Если среди них есть событие по требованию, которого страница ещё не знает,
 *  перечитывается и список требований — иначе новая задача появилась бы в журнале,
 *  но не в панели справа. */
async function pollNew() {
  if (MODE !== 'LIVE') return;
  try {
    const fresh = await api('/agent-office/events?after=' + LAST_ID);
    if (!fresh.length) return;

    EVENTS = EVENTS.concat(fresh);
    LAST_ID = fresh[fresh.length - 1].id;

    const known = new Set(REQS.map(r => r.code));
    if (fresh.some(e => !known.has(e.requirement))) await loadRequirements();
    else await refreshRequirementProgress();
  } catch { /* источник временно недоступен — офис продолжает показывать загруженное */ }
}

/** Обновляет счётчики задач и статусы, не трогая выбранный фильтр. */
async function refreshRequirementProgress() {
  REQS = await api('/agent-office/requirements');
  renderRequirements();
}

function renderRequirements() {
  document.getElementById('inspectorBody').innerHTML = REQS.map(r => {
    const pct = r.tasks ? Math.round(r.tasksDone / r.tasks * 100) : 0;
    return `<div class="req-row" onclick="openRequirement('${esc(r.code)}')">
      <span class="code">${esc(r.code)}</span>
      <span class="st st-${esc(r.status)}" style="float:right">${esc(statusRu(r.status))}</span>
      <span class="ttl">${esc(r.title)}</span>
      <div class="bar-track"><i style="width:${pct}%"></i></div>
      <span class="muted" style="font-size:11px">задач ${r.tasksDone}/${r.tasks} ·
        агентов ${r.agents.length}</span></div>`;
  }).join('');
}

const statusRu = s => ({
  Done: 'выполнено', InProgress: 'в работе', PartiallyDone: 'частично',
  Draft: 'черновик', Rejected: 'отклонено'
}[s] || s);

/* =================================================================== требование */

async function openRequirement(code) {
  let r;
  try { r = await api('/agent-office/requirements/' + encodeURIComponent(code)); }
  catch { return; }   // отладочный сценарий требования не имеет — открывать нечего
  const body = document.getElementById('modalBody');

  body.innerHTML = `
    <h2>${esc(r.code)} — ${esc(r.title)}</h2>
    <div class="muted">${esc(statusRu(r.status))} · заведено
      ${fmtDateTimeLong(r.createdAt)}
      ${r.completedAt ? ' · завершено ' + fmtDateTimeLong(r.completedAt) : ''}</div>

    <h3>Исходный запрос</h3>
    <div class="quote">${esc(r.originalRequest)}</div>

    <h3>Как система это поняла</h3>
    <div class="quote">${esc(r.formalizedStatement)}</div>

    <h3>Кто работал и что сделал</h3>
    <table><thead><tr><th>Задача</th><th>Агент</th><th>Что делал</th><th>Итог</th></tr></thead>
      <tbody>${r.tasks.map(t => `<tr>
        <td><b>${esc(t.code)}</b><br><span class="st st-${esc(t.status)}">${esc(statusRu(t.status))}</span></td>
        <td>${esc(ROLE_RU[t.agent] || t.agent)}</td>
        <td>${esc(t.title)}</td>
        <td class="muted">${esc(t.result) || '—'}</td></tr>`).join('')}</tbody></table>

    ${r.decisions.length ? `<h3>Принятые решения</h3>
      ${r.decisions.map(d => `<div class="dec">
        <div class="q">${esc(d.question)}</div>
        <dl><dt>Рассмотренные варианты</dt><dd>${esc(d.options)}</dd>
        <dt>Решение</dt><dd><b>${esc(d.decision)}</b></dd>
        <dt>Обоснование</dt><dd>${esc(d.reason)}</dd>
        ${d.impact ? `<dt>Что это меняет</dt><dd>${esc(d.impact)}</dd>` : ''}
        <dt>Участники</dt><dd class="muted">${esc(d.agents)}</dd></dl></div>`).join('')}` : ''}

    <h3>Хронология</h3>
    <div class="tl">${r.timeline.map(e => `<div class="tl-item ${
      ['Decision', 'DefectFound', 'RequirementCompleted', 'Meeting'].includes(e.kind) ? 'hot' : ''}">
      <span class="muted">${fmtTime(e.at)}</span>
      <b>${esc(ROLE_RU[e.actor] || e.actor)}</b>${e.target ? ' → ' + esc(ROLE_RU[e.target] || e.target) : ''}
      — ${esc(KIND_RU[e.kind] || e.kind)}<br>
      ${esc(e.topic)}${e.detail ? `<br><span class="muted">${esc(e.detail)}</span>` : ''}
    </div>`).join('')}</div>

    ${r.result ? `<h3>Что теперь работает</h3><div class="quote">${esc(r.result)}</div>` : ''}
    ${r.remaining ? `<h3>Что осталось</h3><div class="quote">${esc(r.remaining)}</div>` : ''}`;

  document.getElementById('modal').classList.add('open');
}

function closeModal() { document.getElementById('modal').classList.remove('open'); }

/* =================================================================== карточка агента */

cv.addEventListener('click', ev => {
  const rect = cv.getBoundingClientRect();
  const x = (ev.clientX - rect.left) / rect.width * cv.width / CELL;
  const y = (ev.clientY - rect.top) / rect.height * cv.height / CELL;
  let hit = null;
  for (const a of AGENTS.values()) {
    if (a.active && Math.abs(a.x + .5 - x) < .9 && Math.abs(a.y + .5 - y) < 1.1) hit = a;
  }
  if (!hit) { SELECTED = null; return; }
  SELECTED = hit.role;
  showAgentCard(hit);
});

async function showAgentCard(a) {
  const agents = await api('/agent-office/agents');
  const info = agents.find(x => x.role === a.role) || {};
  const own = EVENTS.filter(e => e.actor === a.role || e.target === a.role).slice(-10).reverse();

  document.getElementById('modalBody').innerHTML = `
    <h2>${esc(ROLE_RU[a.role] || a.role)}</h2>
    <div class="muted">Рабочее место в офисе · событий ${info.eventsCount ?? a.events}</div>

    <h3>Текущее состояние</h3>
    <table><tbody>
      <tr><td class="muted">Состояние</td><td><b>${esc(stateRu(a.state))}</b></td></tr>
      <tr><td class="muted">Задач всего</td><td>${info.tasksTotal ?? 0}</td></tr>
      <tr><td class="muted">Выполнено</td><td>${info.tasksDone ?? 0}</td></tr>
      ${info.current ? `<tr><td class="muted">Сейчас в работе</td>
        <td>${esc(info.current.requirement)} · ${esc(info.current.code)} — ${esc(info.current.title)}</td></tr>` : ''}
      ${a.lastEvent ? `<tr><td class="muted">Последнее действие</td>
        <td>${esc(KIND_RU[a.lastEvent.kind] || a.lastEvent.kind)} — ${esc(a.lastEvent.topic)}</td></tr>` : ''}
    </tbody></table>

    <h3>Последние события</h3>
    <div class="tl">${own.length === 0 ? '<span class="muted">Событий пока нет.</span>'
      : own.map(e => `<div class="tl-item">
      <span class="muted">${fmtTime(e.at)}
        · ${esc(e.requirement)}</span><br>
      ${esc(KIND_RU[e.kind] || e.kind)}: ${esc(e.topic)}
      ${e.detail ? `<br><span class="muted">${esc(e.detail)}</span>` : ''}</div>`).join('')}</div>`;

  document.getElementById('modal').classList.add('open');
}

const stateRu = s => ({
  idle: 'простой', working: 'работает за компьютером', coding: 'пишет код',
  researching: 'исследует', reviewing: 'проводит review', testing: 'тестирует',
  walking: 'идёт по офису', asking: 'обращается к коллеге', answering: 'отвечает',
  meeting: 'на совещании', blocked: 'заблокирован', completed: 'завершил задачу',
  assigned: 'получил задачу', talking: 'разговаривает', thinking: 'обдумывает'
}[s] || s);

/* =================================================================== управление */

function togglePlay() {
  PLAYING = !PLAYING;
  document.getElementById('btnPlay').textContent = PLAYING ? 'Пауза' : 'Продолжить';
}
function setSpeed(v) {
  SPEED = v;
  document.querySelectorAll('.sp').forEach(b =>
    b.classList.toggle('on', +b.dataset.sp === v));
}
function applyFilter() {
  FILTER = document.getElementById('reqFilter').value;
  resetPlayback();
}
function resetPlayback() {
  CURSOR = 0;
  document.getElementById('feed').innerHTML = '';
  for (const a of AGENTS.values()) {
    a.active = false; a.state = 'idle'; a.bubble = null; a.events = 0;
    a.path = []; a.x = a.home.x; a.y = a.home.y;
  }
  renderLegend();
}

/** Режим симуляции существует только для отладки интерфейса и честно помечен:
 *  он не выдаёт придуманные события за настоящие. */
function toggleMode() {
  MODE = MODE === 'LIVE' ? 'SIMULATION' : 'LIVE';
  const badge = document.getElementById('srcBadge');
  badge.textContent = MODE;
  badge.classList.toggle('sim', MODE === 'SIMULATION');
  document.getElementById('btnMode').textContent = 'Режим: ' + MODE;
  if (MODE === 'SIMULATION') {
    EVENTS = buildSimulation();
    FILTER = '';
    document.getElementById('reqFilter').value = '';
    resetPlayback();
  } else {
    loadAll().then(resetPlayback);
  }
}

function buildSimulation() {
  const now = Date.now();
  const mk = (i, kind, actor, topic, target, participants) => ({
    id: 90000 + i, at: new Date(now + i * 6000).toISOString(), kind, actor, target,
    participants, topic, detail: 'Демонстрационное событие для отладки интерфейса.',
    requirement: 'SIM-000', requirementTitle: 'Отладочный сценарий'
  });
  return [
    mk(1, 'RequirementCreated', 'Orchestrator', 'Отладочное требование заведено'),
    mk(2, 'TaskAssigned', 'Orchestrator', 'Исследование процесса', 'BusinessAnalyst'),
    mk(3, 'Research', 'BusinessAnalyst', 'Изучаю предметную область'),
    mk(4, 'Question', 'BusinessAnalyst', 'Уточняю правила учёта', 'Accountant'),
    mk(5, 'Answer', 'Accountant', 'Правило подтверждено', 'BusinessAnalyst'),
    mk(6, 'Meeting', 'Architect', 'Обсуждение архитектурной развилки', null,
       'Architect, BusinessAnalyst, BackendDev, Accountant'),
    mk(7, 'Decision', 'Architect', 'Выбран вариант с двумя операциями'),
    mk(8, 'Implementation', 'BackendDev', 'Реализация проведения'),
    mk(9, 'TestRun', 'TestEngineer', 'Прогон тестов'),
    mk(10, 'DefectFound', 'TestEngineer', 'Найден дефект в проверке'),
    mk(11, 'Question', 'TestEngineer', 'Уточняю ожидаемое поведение', 'BackendDev'),
    mk(12, 'Implementation', 'BackendDev', 'Дефект исправлен'),
    mk(13, 'TestRun', 'TestEngineer', 'Повторный прогон — зелёный'),
    mk(14, 'RequirementCompleted', 'Orchestrator', 'Отладочное требование завершено')
  ];
}

/* =================================================================== вход */

async function gateLogin() {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: document.getElementById('login').value,
        password: document.getElementById('password').value
      })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'Ошибка входа');
    TOKEN = body.token;
    localStorage.setItem('osnova_token', TOKEN);
    boot();
  } catch (e) { document.getElementById('gateErr').textContent = e.message; }
}

async function boot() {
  try {
    await loadAll();
  } catch {
    document.getElementById('authGate').style.display = '';
    document.getElementById('app').style.display = 'none';
    return;
  }
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('app').style.display = '';
  document.getElementById('tzLabel').textContent = 'время — ' + ORG_TIME_ZONE_LABEL;
  setSpeed(1);
  resetPlayback();
  requestAnimationFrame(frame);
  playNext();
  setInterval(pollNew, 5000);
}

if (TOKEN) boot();
