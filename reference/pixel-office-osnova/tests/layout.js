// Статическая проверка планировки: каждое рабочее место должно быть достижимо
// из любого другого, и ни одно место не должно стоять на столе или в стене.
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '../../src/Osnova.Api/wwwroot/agent-office.js'), 'utf8');

// синтаксис
try { new Function(src.replace(/^'use strict';/, '')); console.log('синтаксис: OK'); }
catch (e) { console.log('СИНТАКСИС СЛОМАН:', e.message); process.exit(1); }

const MAP = eval(src.match(/const MAP = (\[[\s\S]*?\]);/)[1]);
const DESKS = eval(src.match(/const DESKS = (\[[\s\S]*?\n\];)/)[1].replace(/;$/, ''));
const MEETING_SEATS = eval(src.match(/const MEETING_SEATS = (\[.*?\]\];)/s)[1].replace(/;$/, ''));

const COLS = MAP[0].length, ROWS = MAP.length;
console.log(`карта: ${COLS}x${ROWS}, ширина строк одинакова: ${MAP.every(r => r.length === COLS)}`);

const walkable = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS &&
  MAP[y][x] !== '#' && MAP[y][x] !== 'D' && MAP[y][x] !== 'S';

let bad = 0;
const points = [];
for (const d of DESKS) {
  const ok = walkable(d.seat[0], d.seat[1]);
  const approach = walkable(d.seat[0] + 1, d.seat[1]);   // клетка, куда подходит коллега
  const onDesk = MAP[d.desk[1]][d.desk[0]] === 'D';
  if (!ok || !approach || !onDesk) {
    console.log(`  ПРОБЛЕМА ${d.role}: место=${ok} подход=${approach} стол=${onDesk}`); bad++;
  }
  points.push([d.seat, d.role]);
}
MEETING_SEATS.forEach((s, i) => {
  if (!walkable(s[0], s[1])) { console.log(`  ПРОБЛЕМА место в переговорной #${i} (${s})`); bad++; }
  else points.push([s, 'meeting#' + i]);
});

// связность: обход от первого рабочего места
const key = (x, y) => y * COLS + x;
const seen = new Set([key(...points[0][0])]);
let front = [points[0][0]];
while (front.length) {
  const next = [];
  for (const [x, y] of front)
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (walkable(nx, ny) && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); next.push([nx, ny]); }
    }
  front = next;
}
for (const [p, name] of points)
  if (!seen.has(key(p[0], p[1]))) { console.log(`  НЕДОСТИЖИМО: ${name} (${p})`); bad++; }

console.log(bad === 0
  ? `планировка: OK — ${DESKS.length} рабочих мест и ${MEETING_SEATS.length} мест в переговорной связны`
  : `планировка: ${bad} проблем`);
process.exit(bad === 0 ? 0 : 1);
