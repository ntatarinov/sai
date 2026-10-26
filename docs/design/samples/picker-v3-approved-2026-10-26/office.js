/* Пиксельный офис арендатора: сцена на canvas (логические пиксели, масштаб целым числом),
   подписи и пузыри — слоем HTML поверх. Язык рисунка взят у Pixel Office Sai:
   плоские цветные блоки, клетчатый пол, деревянные столы со светлой кромкой, ноутбуки/мониторы,
   фигуры «блок цвета + голова с волосами», пузыри с цветной рамкой.
   Ничего из внутренностей системы здесь не показывается: только ответы посетителя и четыре этапа запроса. */
(function () {
  'use strict';
  var c, K, T, lang = 'ru';
  var world, cv, ctx, stat, sctx, lite, lctx, overlay;
  var G = { W: 400, H: 100, s: 3, Rw: 400, view: 400, wallH: 40, deskTop: 60, lane: 24, doorW: 46, sp: 90, cx: [] };
  var S = {
    mode: 'start', focus: -1, stage: 0, theme: 'day', reduce: false, strip: false,
    props: [], propsKey: '', light: [0, 0, 0, 0], lightT: [0, 0, 0, 0],
    visitor: { x: 20, tx: 20, walking: false, on: true }, busy: [0, 0, 0, 0], emote: [null, null, null, null],
    couriers: [], paper: 0, counts: [0, 0, 0, 0], stamp: 0, wave: 0, cam: 0, t0: 0, answered: 0
  };
  var els = { plates: [], sign: null, you: null, bubbles: [], stamp: null, badges: [] };
  var raf = 0, lastDraw = 0, onPlate = null, mouseTick = 0;

  /* ---------- вспомогательное ---------- */
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function mix(a, b, t) { var A = hex(a), B = hex(b); return '#' + [0, 1, 2].map(function (i) { var v = Math.round(A[i] + (B[i] - A[i]) * t); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function shade(a, t) { return t < 0 ? mix(a, '#000000', -t) : mix(a, '#ffffff', t); }
  function R(x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); }
  function now() { return performance.now(); }

  function palette() {
    var n = S.theme === 'night', tp = T.pal, m = n ? tp.night : tp.day;
    return {
      night: n, wall: m.wall, wallB: m.wallB, trim: m.trim, fA: m.floorA, fB: m.floorB, sky: m.sky,
      wD: m.wood[0], wM: m.wood[1], wL: m.wood[2], acc: tp.accent, acc2: tp.accent2,
      rug: n ? shade(tp.accent2, -0.45) : mix(tp.accent2, m.floorA, 0.62), rugE: n ? shade(tp.accent, -0.35) : tp.accent,
      metal: n ? '#8a97ad' : '#9aa6bb', dark: '#0d1420', paper: n ? '#d9d4c6' : '#fbf8ef', cardA: '#c98f5a', cardB: '#a8723f', cardT: '#e8cfa0',
      chair: n ? '#3c4b6a' : mix(tp.accent2, '#ffffff', 0.15), scr: '#10283a', scrOff: n ? '#18283b' : '#2a3b52', lamp: '#ffd98a',
      ink: m.ink, green: '#3fae6a', red: '#d8473f', gold: '#e8b64c'
    };
  }

  /* ---------- 3x5 пиксельный шрифт для значков на мониторах ---------- */
  var F = {
    '1': '.#.|##.|.#.|.#.|###', '2': '##.|..#|.#.|#..|###', 'C': '###|#..|#..|#..|###', 'S': '###|#..|###|..#|###',
    'A': '.#.|#.#|###|#.#|#.#', 'P': '##.|#.#|##.|#..|#..', 'X': '#.#|#.#|.#.|#.#|#.#', 'L': '#..|#..|#..|#..|###',
    '?': '##.|..#|.#.|...|.#.', 'I': '###|.#.|.#.|.#.|###', 'G': '###|#..|#.#|#.#|###', 'T': '###|.#.|.#.|.#.|.#.',
    'W': '#.#|#.#|#.#|###|#.#', 'R': '##.|#.#|##.|#.#|#.#', 'M': '#.#|###|###|#.#|#.#'
  };
  function glyphs(x, y, text, col) {
    text = text.replace('С', 'C').replace('Г', 'G');
    for (var i = 0; i < text.length; i++) {
      var g = F[text[i]]; if (!g) continue; var rows = g.split('|');
      for (var r = 0; r < 5; r++) for (var q = 0; q < 3; q++) if (rows[r][q] === '#') R(x + i * 4 + q, y + r, 1, 1, col);
    }
  }
  function glyphW(t) { return t.length * 4 - 1; }

  /* ---------- предметы: (x, y) — левый верхний угол; f — кадр ---------- */
  var PR = {};
  PR.shelf = { w: 18, h: 28, draw: function (x, y, o, f) {
    var n = o.n || 1, i, j, colors = ['#c98f5a', '#a8723f', '#d9a96b', '#6aa3b5', '#e0735a'];
    for (i = 0; i < n; i++) {
      var X = x + i * 18;
      R(X, y, 2, 28, K.metal); R(X + 16, y, 2, 28, K.metal);
      for (j = 0; j < 3; j++) {
        var by = y + 8 + j * 9; R(X + 2, by + 5, 14, 2, K.wL); R(X + 2, by + 7, 14, 1, K.wD);
        R(X + 3, by, 5, 5, colors[(i + j) % 5]); R(X + 3, by, 5, 1, shade(colors[(i + j) % 5], .25));
        R(X + 9, by + 1, 5, 4, colors[(i * 2 + j + 2) % 5]); R(X + 9, by + 1, 5, 1, shade(colors[(i * 2 + j + 2) % 5], .25));
      }
      R(X, y + 2, 18, 2, K.wM);
    }
    if (o.shop) { var w = n * 18; for (i = 0; i < w; i += 3) R(x + i, y - 5, 3, 5, (i / 3) % 2 ? K.paper : K.acc); R(x, y - 1, w, 1, K.wD); }
  } };
  PR.shop = { w: 18, h: 14, draw: function (x, y) {
    for (var i = 0; i < 18; i += 3) R(x + i, y, 3, 5, (i / 3) % 2 ? K.paper : K.acc);
    R(x + 1, y + 5, 16, 1, K.wD); R(x + 2, y + 6, 14, 8, K.dark); R(x + 3, y + 7, 5, 7, K.scr); R(x + 10, y + 7, 5, 4, K.gold);
  } };
  PR.boxes = { w: 20, h: 22, draw: function (x, y, o) {
    var pos = { 1: [[0, 15]], 2: [[0, 15], [10, 15]], 3: [[0, 15], [10, 15], [5, 8]], 4: [[0, 15], [10, 15], [0, 8], [10, 8], [5, 1]] }[o.n || 1];
    pos.forEach(function (p) { var X = x + p[0], Y = y + p[1]; R(X, Y, 10, 7, K.cardB); R(X + 1, Y + 1, 8, 5, K.cardA); R(X + 4, Y, 2, 7, K.cardT); R(X + 1, Y + 1, 8, 1, shade(K.cardA, .25)); });
  } };
  PR.monitor = { w: 17, h: 15, draw: function (x, y, o, f, busy) {
    R(x, y, 17, 12, K.dark); R(x + 1, y + 1, 15, 10, o.on === false ? K.scrOff : K.scr);
    R(x + 6, y + 12, 5, 2, K.metal); R(x + 4, y + 14, 9, 1, K.metal);
    if (o.on === false) { R(x + 2, y + 2, 3, 1, shade(K.scrOff, .2)); return; }
    if (o.x) { var gw = glyphW(o.x.replace('С', 'C')); glyphs(x + 1 + Math.floor((15 - gw) / 2), y + 3, o.x, '#ffffff');
      R(x + 2, y + 9, 13, 1, K.acc); }
    else { for (var i = 0; i < 4; i++) { var l = 5 + ((i * 5 + (busy ? f : 0) * 3) % 8); R(x + 2, y + 2 + i * 2, l, 1, i % 2 ? K.acc : '#9fd0e6'); } }
  } };
  PR.screen = PR.monitor;
  PR.laptop = { w: 16, h: 11, draw: function (x, y, o) {
    R(x + 1, y, 14, 8, K.dark); R(x + 2, y + 1, 12, 6, K.scr); R(x, y + 8, 16, 2, K.metal); R(x + 5, y + 8, 6, 1, shade(K.metal, -.2));
    if (o.x) glyphs(x + 2, y + 2, o.x, '#ffffff');
  } };
  PR.scanner = { w: 12, h: 11, draw: function (x, y, o, f) {
    R(x + 1, y + 4, 4, 7, '#3a4660'); R(x, y, 10, 5, '#2c3547'); R(x + 1, y + 1, 8, 1, '#4a5876');
    R(x + 9, y + 1, 1, 3, f % 2 ? '#ff5a5a' : '#8a1f1f');
    if (f % 2) { R(x + 10, y + 2, 2, 1, '#ff5a5a'); }
  } };
  PR.tsd = { w: 9, h: 12, draw: function (x, y, o, f) {
    R(x, y, 9, 12, '#2c3547'); R(x + 1, y + 1, 7, 5, '#7cd0a8'); R(x + 2, y + 2, 4, 1, '#2c6a50'); R(x + 2, y + 4, 5, 1, '#2c6a50');
    for (var i = 0; i < 3; i++) for (var j = 0; j < 2; j++) R(x + 1 + i * 3, y + 7 + j * 2, 2, 1, '#8895b0');
    if (f % 2) R(x + 6, y + 2, 1, 1, '#ffffff');
  } };
  PR.clip = { w: 10, h: 13, draw: function (x, y) {
    R(x, y + 1, 10, 12, K.wD); R(x + 1, y + 2, 8, 10, K.paper); R(x + 3, y, 4, 3, K.metal);
    for (var i = 0; i < 4; i++) R(x + 2, y + 4 + i * 2, 6 - (i % 2), 1, '#8a97ad');
  } };
  PR.bell = { w: 10, h: 8, draw: function (x, y) {
    R(x, y + 6, 10, 2, K.wD); R(x + 2, y + 2, 6, 4, K.gold); R(x + 3, y, 4, 2, K.gold); R(x + 3, y + 2, 1, 3, shade(K.gold, .4)); R(x + 4, y - 1, 2, 1, K.metal);
  } };
  PR.phone = { w: 14, h: 8, draw: function (x, y, o, f) {
    R(x, y + 4, 14, 4, '#2c3547'); R(x + 1, y + 5, 12, 1, '#4a5876'); R(x + 5, y + 6, 4, 1, '#8895b0');
    R(x, y + 1, 14, 3, '#3a4660'); R(x, y, 3, 2, '#3a4660'); R(x + 11, y, 3, 2, '#3a4660');
    if (f % 4 === 0) { R(x + 5, y - 2, 1, 1, K.gold); R(x + 8, y - 3, 1, 1, K.gold); }
  } };
  PR.cell = { w: 8, h: 13, draw: function (x, y, o) {
    R(x, y, 8, 13, '#1c2434'); R(x + 1, y + 1, 6, 10, '#2fbf6a'); R(x + 2, y + 3, 4, 3, '#ffffff'); R(x + 2, y + 6, 1, 1, '#ffffff'); R(x + 3, y + 9, 2, 1, '#ffffff');
  } };
  PR.headset = { w: 12, h: 10, draw: function (x, y, o) {
    R(x + 2, y, 8, 1, '#2c3547'); R(x + 1, y + 1, 1, 5, '#2c3547'); R(x + 10, y + 1, 1, 5, '#2c3547');
    R(x, y + 5, 3, 4, K.acc); R(x + 9, y + 5, 3, 4, K.acc); R(x + 1, y + 8, 5, 1, '#2c3547');
  } };
  PR.poster = { w: 16, h: 21, draw: function (x, y, o) {
    R(x, y, 16, 21, K.wD); R(x + 1, y + 1, 14, 19, K.paper); R(x + 1, y + 1, 14, 4, K.acc);
    var g = {
      tool: ['.......#.', '......###', '.....##.#', '....###..', '...###...', '..###....', '.###.....', '###......', '##.......'],
      box: ['.#######.', '#.......#', '#########', '#...#...#', '#...#...#', '#...#...#', '#...#...#', '#...#...#', '#########'],
      house: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.##...##.', '.##.#.##.', '.##.#.##.', '.#######.'],
      cap: ['.........', '..#####..', '.#######.', '#########', '.#######.', '....#..#.', '....#..#.', '...###.#.', '........#'.slice(0, 9)]
    }[o.g || 'tool'];
    g.forEach(function (r, j) { for (var i = 0; i < 9; i++) if (r[i] === '#') R(x + 3 + i, y + 7 + j, 1, 1, K.ink); });
  } };
  PR.coins = { w: 25, h: 22, draw: function (x, y, o) {
    var h = [3, 5, 7, 9];
    for (var i = 0; i < (o.n || 1); i++) {
      var X = x + i * 6 + (4 - (o.n || 1)) * 0, cnt = h[i];
      for (var j = 0; j < cnt; j++) { var Y = y + 21 - (j + 1) * 2; R(X, Y, 5, 2, j % 2 ? '#c8962a' : K.gold); R(X, Y, 5, 1, shade(K.gold, .35)); }
    }
  } };
  PR.chart = { w: 22, h: 17, draw: function (x, y, o) {
    R(x, y, 22, 17, K.wD); R(x + 1, y + 1, 20, 15, K.paper);
    var n = o.n || 2, i; for (i = 0; i < n; i++) { var bh = 3 + Math.round((i + 1) * 9 / n); R(x + 3 + i * Math.floor(17 / n), y + 14 - bh, Math.max(2, Math.floor(17 / n) - 2), bh, i % 2 ? K.acc2 : K.acc); }
    R(x + 2, y + 14, 18, 1, K.ink);
  } };
  PR.pin = { w: 20, h: 15, draw: function (x, y) {
    R(x, y, 20, 15, K.wD); R(x + 1, y + 1, 18, 13, '#c9a073'); R(x + 3, y + 3, 6, 7, K.paper); R(x + 11, y + 2, 6, 5, '#f4d777'); R(x + 11, y + 8, 6, 5, K.paper);
    R(x + 5, y + 2, 1, 1, K.red); R(x + 13, y + 1, 1, 1, K.green);
  } };
  PR.binders = { w: 22, h: 14, draw: function (x, y) {
    R(x, y + 12, 22, 2, K.wM); var cols = [K.acc, K.acc2, '#6aa3b5', K.gold, K.acc];
    for (var i = 0; i < 5; i++) { R(x + 1 + i * 4, y + 1 + (i % 2), 3, 11 - (i % 2), cols[i]); R(x + 1 + i * 4, y + 1 + (i % 2), 1, 11 - (i % 2), shade(cols[i], .3)); }
  } };
  PR.blueprint = { w: 22, h: 15, draw: function (x, y) {
    R(x, y, 22, 15, '#2f6fa6'); R(x + 1, y + 1, 20, 13, '#3b86c4');
    for (var i = 0; i < 4; i++) R(x + 3, y + 3 + i * 3, 16 - i * 2, 1, '#cfe6f7'); R(x + 14, y + 8, 5, 4, '#cfe6f7'); R(x + 15, y + 9, 3, 2, '#3b86c4');
  } };
  PR.cert = { w: 16, h: 13, draw: function (x, y) {
    R(x, y, 16, 13, K.wD); R(x + 1, y + 1, 14, 11, K.paper); R(x + 4, y + 3, 8, 1, K.ink); R(x + 4, y + 5, 8, 1, '#8a97ad'); R(x + 6, y + 8, 4, 3, K.acc);
  } };
  PR.printer = { w: 16, h: 13, draw: function (x, y, o) {
    var n = o.n || 0, h = Math.min(11, n * 2 + 2);
    R(x + 4, y + 8 - h, 8, h, K.paper); for (var i = 0; i < h; i += 3) R(x + 5, y + 8 - h + i + 1, 5 - (i % 2), 1, '#8a97ad');
    R(x, y + 8, 16, 5, '#cdd3de'); R(x, y + 8, 16, 1, '#eef1f6'); R(x, y + 12, 16, 1, '#9aa6bb'); R(x + 3, y + 9, 10, 1, '#2c3547'); R(x + 13, y + 10, 2, 1, K.green);
  } };
  PR.mug = { w: 6, h: 6, draw: function (x, y, o, f) { R(x, y, 5, 5, '#f2f2f2'); R(x + 5, y + 1, 1, 3, '#f2f2f2'); R(x + 1, y + 1, 3, 1, '#6a4a2c'); if (f % 4 < 2) R(x + 2, y - 2, 1, 1, '#ffffffaa'); } };
  PR.plant = { w: 10, h: 16, draw: function (x, y) {
    R(x + 2, y + 11, 6, 5, '#8a5a3c'); R(x + 2, y + 11, 6, 1, '#a8723f'); R(x + 3, y + 3, 4, 8, '#2e9a55'); R(x, y + 5, 4, 3, '#41a15f'); R(x + 6, y + 2, 4, 4, '#41a15f'); R(x + 4, y, 2, 3, '#41a15f');
  } };
  PR.folder = { w: 14, h: 10, draw: function (x, y) {
    R(x, y + 1, 14, 9, '#d8b46a'); R(x, y, 6, 2, '#d8b46a'); R(x + 1, y + 3, 12, 6, '#ecd08e'); R(x + 5, y + 5, 4, 2, K.acc);
  } };
  PR.stampTool = { w: 8, h: 11, draw: function (x, y) { R(x + 2, y, 4, 4, '#6a4a2c'); R(x + 3, y + 4, 2, 3, '#6a4a2c'); R(x, y + 7, 8, 4, K.red); R(x, y + 7, 8, 1, shade(K.red, .3)); } };

  /* ---------- человек ---------- */
  function person(px, dt, P, pose, f, g) {
    // px — центр, dt — верх стола; g — сколько лишних пикселей поднять руку и т.п.
    var sk = P.skin, skD = shade(sk, -.14), hr = P.hair, sh = P.shirt, shD = shade(sh, -.22), shL = shade(sh, .18);
    var lean = pose === 'attend' && (f % 6 < 3) ? 1 : 0, head = dt - 19 + lean;
    // кресло
    R(px - 9, dt - 14, 18, 16, K.chair); R(px - 9, dt - 14, 18, 2, shade(K.chair, .25)); R(px - 9, dt - 2, 18, 2, shade(K.chair, -.25));
    // руки (боковые части) и торс
    R(px - 6, dt - 9 + lean, 12, 9, sh); R(px - 6, dt - 9 + lean, 12, 2, shL); R(px - 6, dt - 3, 12, 3, shD);
    var raised = pose === 'wave' || pose === 'present', wx = (f % 2) * 1;
    R(px - 8, dt - 8, 2, 8, shD);
    if (raised && pose === 'wave') { R(px + 6, dt - 15, 2, 9, shD); R(px + 5 + wx, dt - 18, 3, 3, sk); }
    else R(px + 6, dt - 8, 2, 8, shD);
    // шея и голова
    R(px - 1, dt - 11 + lean, 2, 3, skD);
    R(px - 4, head, 8, 9, sk); R(px - 4, head + 8, 8, 1, skD);
    // волосы
    var st = P.style;
    R(px - 4, head - 1, 8, 4, hr);
    if (st === 'short') { R(px - 5, head + 1, 1, 3, hr); R(px + 4, head + 1, 1, 3, hr); }
    if (st === 'long') { R(px - 5, head, 1, 11, hr); R(px + 4, head, 1, 11, hr); R(px - 6, head + 8, 2, 4, hr); R(px + 4, head + 8, 2, 4, hr); R(px - 5, head - 1, 10, 3, hr); }
    if (st === 'bun') { R(px - 2, head - 4, 4, 3, hr); R(px - 3, head - 2, 6, 1, hr); R(px - 5, head + 1, 1, 3, hr); R(px + 4, head + 1, 1, 3, hr); }
    if (st === 'cap') { R(px - 5, head - 2, 10, 4, shD); R(px - 5, head + 2, 11, 1, shD); R(px - 3, head - 3, 6, 1, shD); R(px - 5, head + 3, 1, 2, hr); R(px + 4, head + 3, 1, 2, hr); }
    // лицо
    var blink = f % 14 === 0;
    if (!blink) { R(px - 2, head + 4, 1, 2, '#1d1712'); R(px + 1, head + 4, 1, 2, '#1d1712'); } else { R(px - 2, head + 5, 1, 1, '#1d1712'); R(px + 1, head + 5, 1, 1, '#1d1712'); }
    R(px - 3, head + 6, 1, 1, '#e8a08c'); R(px + 2, head + 6, 1, 1, '#e8a08c');
    if (pose === 'attend' || pose === 'wave' || pose === 'present') { R(px - 1, head + 7, 2, 1, (f % 4 < 2) ? '#8a3a30' : skD); } else R(px - 1, head + 7, 2, 1, skD);
  }
  function hands(px, dt, pose, f) {
    var sk = '#e9c4a0', y = dt + 1, a = 0, b = 0;
    if (pose === 'busy') { a = f % 2; b = (f + 1) % 2; } else if (pose === 'type') { a = (f >> 1) % 2; b = ((f >> 1) + 1) % 2; }
    R(px - 5, y + a, 2, 2, sk); R(px + 3, y + b, 2, 2, sk);
  }

  function visitor(x, feet, f, walking, dir) {
    var y = feet - 22, acc = K.acc2 === K.acc ? K.acc : K.acc2, jk = shade(acc, K.night ? 0.05 : -0.05), jkD = shade(jk, -.25);
    var step = walking ? (f % 2) : 0, bob = walking && f % 2 ? 1 : 0;
    R(x - 5, feet - 1, 10, 1, 'rgba(0,0,0,.22)');
    R(x - 3, y + 15, 3, 7 - step, '#2d3446'); R(x + 1, y + 15, 3, 7 - (walking ? 1 - step : 0), '#2d3446');
    R(x - 3, y + 21 - step, 3, 1, '#161b26'); R(x + 1, y + 21 - (walking ? 1 - step : 0), 3, 1, '#161b26');
    R(x - 5, y + 7 + bob, 10, 9, jk); R(x - 5, y + 7 + bob, 10, 2, shade(jk, .2)); R(x - 5, y + 14 + bob, 10, 2, jkD);
    R(x - 6, y + 8 + bob, 1, 7, jkD); R(x + 5, y + 8 + bob, 1, 7, jkD);
    R(x - 3, y + 9 + bob, 6, 6, shade(jk, -.12)); R(x - 3, y + 9 + bob, 6, 1, shade(jk, .1));  // рюкзак со спины
    R(x - 3, y + 1 + bob, 6, 7, '#3a2c22'); R(x - 3, y + 7 + bob, 6, 1, '#d9b08a'); R(x - 4, y + 2 + bob, 1, 4, '#3a2c22'); R(x + 3, y + 2 + bob, 1, 4, '#3a2c22');
    R(x - 3, y + bob, 6, 2, '#2a1f18');
  }

  /* ---------- геометрия ---------- */
  function layout(W, H, s, strip) {
    G.W = W; G.H = H; G.s = s; G.view = W; G.Rw = Math.max(W, strip ? 330 : 350);
    G.wallH = Math.round(H * (strip ? 0.40 : 0.40));
    G.deskTop = G.wallH + (strip ? 18 : 20);
    G.lane = H - (G.deskTop + 14);
    G.doorW = strip ? 6 : 46;
    G.sp = (G.Rw - G.doorW - (strip ? 8 : 16)) / 4; G.cx = [];
    for (var i = 0; i < 4; i++) G.cx.push(Math.round(G.doorW + G.sp * (i + .5)));
  }

  /* ---------- статический слой ---------- */
  function drawStatic() {
    c = sctx; K = palette(); K.night = S.theme === 'night';
    var Rw = G.Rw, H = G.H, wh = G.wallH, i, j;
    R(0, 0, Rw, wh, K.wall); R(0, 0, Rw, 2, shade(K.wall, K.night ? -.3 : -.1)); R(0, wh - 7, Rw, 7, K.wallB); R(0, wh - 8, Rw, 1, K.trim); R(0, wh, Rw, 1, K.trim);
    // клетчатый пол
    for (j = 0; j * 8 < H - wh; j++) for (i = 0; i * 8 < Rw; i++) R(i * 8, wh + 1 + j * 8, 8, 8, (i + j) % 2 ? K.fB : K.fA);
    // дорожка для посетителя
    if (!S.strip) {
      var ry = H - 17, rh = 14;
      R(0, ry, Rw, rh, K.rug); R(0, ry, Rw, 1, K.rugE); R(0, ry + rh - 1, Rw, 1, K.rugE);
      for (i = 0; i < Rw; i += 6) R(i, ry + 3, 3, 1, K.rugE), R(i + 3, ry + rh - 4, 3, 1, K.rugE);
    }
    // окна между столами
    var wy = 5, wH = Math.max(14, wh - 17);
    [1, 3].forEach(function (k) {
      var wx = Math.round(G.doorW + G.sp * k) - 11;
      if (S.strip && k === 3 && false) return;
      R(wx - 1, wy - 1, 24, wH + 2, K.trim); R(wx, wy, 22, wH, K.sky);
      if (K.night) {
        R(wx + 14, wy + 3, 4, 4, '#f4ecc8'); R(wx + 16, wy + 3, 2, 3, K.sky); [[3, 2], [8, 8], [6, 4], [18, 11], [11, 3]].forEach(function (p) { if (p[1] < wH - 2) R(wx + p[0], wy + p[1], 1, 1, '#ffffff'); });
      } else {
        R(wx + 3, wy + 3, 7, 2, '#ffffff'); R(wx + 5, wy + 2, 4, 1, '#ffffff'); R(wx + 12, wy + 6 < wH ? wy + 7 : wy + 3, 6, 2, '#ffffff'); R(wx + 15, wy + 1, 3, 3, '#ffe9a0');
      }
      R(wx + 10, wy, 2, wH, K.trim); R(wx, wy + Math.floor(wH / 2), 22, 1, K.trim);
      if (!K.night && !S.strip) { c.globalAlpha = .16; for (i = 0; i < 4; i++) R(wx + 2 + i * 3, wh + 1 + i * 2, 14, 10, '#fff2b8'); c.globalAlpha = 1; }
    });
    // дверь
    if (!S.strip) {
      var dx = 7, dw = 34, dh = wh - 6;
      R(dx - 2, 4, dw + 4, dh + 3, K.trim); R(dx, 5, dw, dh + 1, K.acc2); R(dx, 5, dw, 2, shade(K.acc2, .25)); R(dx + 3, 18 < dh ? 20 : 12, dw - 6, Math.max(6, dh - 20), shade(K.acc2, -.2));
      R(dx + dw - 5, 5 + Math.floor(dh / 2), 2, 3, K.gold); R(dx - 2, wh, dw + 4, 2, K.trim);
      R(dx - 5, wh + 2, dw + 10, 5, K.rugE); R(dx - 4, wh + 3, dw + 8, 3, K.rug);
    }
    // стойки и кресла — позади людей не нужны; тени столов
    for (i = 0; i < 4; i++) { var cx = G.cx[i]; c.globalAlpha = .22; R(cx - 26, G.deskTop + 14, 54, 3, '#000000'); c.globalAlpha = 1; }
    // растение у правого края
    PR.plant.draw(Rw - 14, wh - 10, {});
  }

  /* ---------- слот предметов ---------- */
  function placeProp(i, p, age, f) {
    var cx = G.cx[i], dt = G.deskTop, pr = PR[p.t], o = p, x, y;
    if (!pr) return;
    var py = 0, e = 0;
    if (!S.reduce && age < 520) { e = 1 - age / 520; py = -Math.round(e * e * 14); }
    switch (p.t) {
      case 'shelf': x = cx - Math.round((o.n || 1) * 18 / 2); y = G.wallH + 5 - pr.h + py + (o.shop ? 6 : 0); break;
      case 'shop': x = cx - 9; y = 8 + py; break;
      case 'poster': x = cx - 8; y = Math.max(4, G.wallH - 21 - 2) + py; break;
      case 'chart': x = cx - 11 + 6; y = Math.max(5, G.wallH - 22) + py; break;
      case 'boxes': x = cx - 56; y = dt + 14 - pr.h + 1 + py; break;
      case 'coins': x = cx - 56; y = dt + 14 - pr.h + 1 + py; break;
      case 'monitor': x = cx + 4; y = dt - 15 + py; break;
      case 'laptop': x = cx - 25; y = dt - 10 + py; break;
      case 'headset': x = cx - 24; y = dt - 9 + py; break;
      default: x = cx - 24; y = dt - pr.h + 1 + py;
    }
    pr.draw(x, y, o, f, S.busy[i] > now());
    if (!S.reduce && age < 700) { var a = age / 700; c.globalAlpha = 1 - a; var q = Math.round(2 + a * 6); R(x + pr.w + 1, y - q + 2, 1, 3, '#fff'); R(x + pr.w, y - q + 3, 3, 1, '#fff'); R(x - q, y + 2, 1, 1, '#fff'); c.globalAlpha = 1; }
  }

  /* ---------- кадр ---------- */
  function drawFrame(t) {
    var i, H = G.H, Rw = G.Rw, dt = G.deskTop, wh = G.wallH;
    c = ctx; K = palette();
    ctx.clearRect(0, 0, Rw, H); ctx.drawImage(stat, 0, 0);
    var f = Math.floor(t / 250), f2 = Math.floor(t / 110), nowT = now();
    var hasProp = {}; S.props.forEach(function (p) { hasProp[p.st + p.t] = 1; });
    var wallSlot = [0, 0, 0, 0]; S.props.forEach(function (p) { if (p.t === 'shelf' || p.t === 'poster' || p.t === 'chart') wallSlot[p.st] = 1; });

    // настенный декор по умолчанию + часы
    var dec = [PR.pin, PR.binders, PR.blueprint, PR.cert];
    for (i = 0; i < 4; i++) { if (!wallSlot[i]) { var d = dec[i]; d.draw(G.cx[i] - Math.round(d.w / 2) + (i === 3 ? 6 : 0), Math.max(5, wh - d.h - 8), {}, f); } }
    // часы (астанинское время)
    var ck = Math.round(G.doorW + G.sp * 2), cyk = Math.max(14, Math.min(20, wh - 14));
    R(ck - 8, cyk - 8, 16, 16, K.wD); R(ck - 7, cyk - 7, 14, 14, K.paper); R(ck - 1, cyk - 1, 2, 2, K.ink);
    var ast = new Date(Date.now() + 5 * 3600e3), hh = ast.getUTCHours() % 12, mm = ast.getUTCMinutes();
    var am = mm / 60 * 2 * Math.PI, ah = (hh + mm / 60) / 12 * 2 * Math.PI;
    for (var k = 1; k <= 5; k++) R(ck + Math.round(Math.sin(am) * k) , cyk - Math.round(Math.cos(am) * k), 1, 1, K.ink);
    for (k = 1; k <= 3; k++) R(ck + Math.round(Math.sin(ah) * k), cyk - Math.round(Math.cos(ah) * k), 1, 1, K.acc);

    // предметы на стене/полу (позади людей)
    S.props.forEach(function (p) { if (p.t === 'shelf' || p.t === 'poster' || p.t === 'chart' || p.t === 'boxes' || p.t === 'coins' || p.t === 'shop') placeProp(p.st, p, nowT - p.born, f); });
    // принтер на станции «Готово»
    PR.printer.draw(G.cx[3] + 30, dt - 1, { n: S.answered }, f);
    // столы и люди
    for (i = 0; i < 4; i++) {
      var cx = G.cx[i], P = T.team[i], pose = 'type', busy = S.busy[i] > nowT, px = cx - 8;
      if (S.mode === 'start' || (S.mode === 'result' && i !== 3)) pose = (S.mode === 'start') ? 'wave' : 'type';
      if (S.mode === 'start' && ((f + i) % 6) > 3) pose = 'type';
      if (S.mode === 'ask' && S.focus === i) pose = 'attend';
      if (S.mode === 'result' && i === 3) pose = 'present';
      if (S.mode === 'my') pose = i === S.stage ? 'busy' : 'type';
      if (S.mode === 'strip') pose = S.counts[i] > 0 ? 'busy' : 'type';
      if (busy) pose = 'busy';
      var ff = pose === 'busy' ? f2 : f;
      if (S.reduce) ff = 0;
      person(px, dt, P, pose, ff, 0);
      // стол
      R(cx - 26, dt, 52, 5, K.wL); R(cx - 26, dt, 52, 1, shade(K.wL, .25)); R(cx - 26, dt + 5, 52, 9, K.wM); R(cx - 26, dt + 13, 52, 1, K.wD);
      R(cx - 25, dt + 5, 2, 9, K.wD); R(cx + 23, dt + 5, 2, 9, K.wD); R(cx - 26, dt + 5, 52, 1, K.wD);
      // монитор (по умолчанию) и мелочи
      var mon = null; S.props.forEach(function (p) { if (p.t === 'monitor' && p.st === i) mon = p; });
      if (!mon) PR.monitor.draw(cx + 4, dt - 15, i === 1 && S.mode !== 'my' ? { x: '' } : {}, ff, busy || (S.mode === 'my' && i === S.stage));
      if (i === 1 || i === 0) PR.mug.draw(cx + 21, dt - 5, {}, f);
      hands(px, dt, pose, ff);
      // лампа
      var lampOn = S.light[i] > .35;
      R(cx + 21, dt - 12, 2, 8, K.metal); R(cx + 18, dt - 13, 5, 2, K.metal); R(cx + 16, dt - 12, 3, 2, lampOn ? K.lamp : '#7a8499');
      // предметы на столе
      S.props.forEach(function (p) { if (p.st === i && ['monitor', 'laptop', 'scanner', 'tsd', 'clip', 'bell', 'phone', 'cell', 'headset'].indexOf(p.t) >= 0) placeProp(i, p, nowT - p.born, f); });
      if (i === 1 && !S.props.some(function (p) { return p.t === 'clip' && p.st === 1; })) { /* стопка бумаг */ R(cx - 24, dt - 4, 10, 4, K.paper); R(cx - 24, dt - 6, 9, 2, '#e8e3d4'); R(cx - 23, dt - 7, 8, 1, K.paper); }
      if (i === 2 && !S.props.some(function (p) { return p.st === 2 && ['scanner', 'tsd', 'clip', 'phone', 'cell', 'laptop'].indexOf(p.t) >= 0; })) { R(cx - 24, dt - 3, 9, 3, K.paper); R(cx - 22, dt - 5, 9, 2, '#e8e3d4'); }
      if (i === 0 && !S.props.some(function (p) { return p.st === 0 && p.t === 'bell'; })) PR.bell.draw(cx - 24, dt - 7, {}, f);
      if (i === 3 && !S.props.some(function (p) { return p.st === 3 && ['bell', 'phone', 'headset'].indexOf(p.t) >= 0; })) { R(cx - 24, dt - 5, 8, 5, K.red); R(cx - 24, dt - 5, 8, 1, shade(K.red, .3)); }
      // «Готово» + флажок выполненного этапа
      if (S.mode === 'my' && i < S.stage) { R(cx - 4, dt - 36, 9, 9, K.green); R(cx - 3, dt - 35, 7, 7, shade(K.green, .15)); R(cx - 2, dt - 32, 1, 2, '#fff'); R(cx - 1, dt - 31, 1, 2, '#fff'); R(cx, dt - 32, 1, 1, '#fff'); R(cx + 1, dt - 33, 1, 1, '#fff'); R(cx + 2, dt - 34, 1, 1, '#fff'); }
      if (S.mode === 'result' && i === 3) PR.stampTool.draw(px + 6, dt - 21 - (f % 4 === 3 && !S.reduce ? 2 : 0), {}, f);
    }
    // метка запроса (папка) в «Мой запрос»
    if (S.mode === 'my' && S.stage < 4) {
      var mcx = G.cx[S.stage] - 8, bobm = S.reduce ? 0 : (Math.floor(t / 400) % 2);
      PR.folder.draw(mcx - 7, dt - 38 - bobm, {}, f);
      R(mcx - 1, dt - 27 - bobm, 3, 1, K.acc); R(mcx, dt - 26 - bobm, 1, 1, K.acc);
    }
    if (S.mode === 'result') { var rc = G.cx[3] - 8; PR.folder.draw(rc - 22, dt - 20, {}, f); }
    // курьеры (листок между столами)
    S.couriers = S.couriers.filter(function (q) {
      var a = (nowT - q.t0) / q.dur; if (a >= 1) return false; if (a < 0) return true;
      var x = q.x0 + (q.x1 - q.x0) * a, y = q.y0 + (q.y1 - q.y0) * a - Math.sin(a * Math.PI) * 14;
      R(x - 3, y - 3, 7, 6, K.paper); R(x - 3, y - 3, 7, 1, '#fff'); R(x - 2, y - 1, 5, 1, '#8a97ad'); R(x - 2, y + 1, 4, 1, '#8a97ad'); return true;
    });
    // свет: затемнение с проёмами
    for (i = 0; i < 4; i++) S.light[i] += (S.lightT[i] - S.light[i]) * (S.reduce ? 1 : .14);
    var dim = S.theme === 'night' ? .5 : .15;
    lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, Rw, H);
    lctx.fillStyle = S.theme === 'night' ? '#050a14' : '#3a2a18'; lctx.globalAlpha = dim; lctx.fillRect(0, 0, Rw, H); lctx.globalAlpha = 1;
    lctx.globalCompositeOperation = 'destination-out';
    for (i = 0; i < 4; i++) {
      var L = S.light[i]; if (L < .02) continue; var lx = G.cx[i];
      [[.4, 1], [.4, .8], [.5, .6]].forEach(function (b, bi) {
        var half = 30 + bi * 0 + (bi === 0 ? 26 : bi === 1 ? 16 : 6);
        lctx.fillStyle = 'rgba(0,0,0,' + (b[0] * L) + ')';
        for (var y = 0; y < H; y += 2) { var w = Math.round(half * (0.55 + 0.45 * (y / H))) * 1; lctx.fillRect(lx - w - 6, y, 2 * w + 12 - (bi === 2 ? 0 : 0), 2); }
      });
    }
    lctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lite, 0, 0);
    // тёплый круг лампы ночью
    if (S.theme === 'night') for (i = 0; i < 4; i++) if (S.light[i] > .35) { ctx.globalAlpha = .16 * S.light[i]; R(G.cx[i] - 20, dt - 2, 40, 6, K.lamp); R(G.cx[i] - 28, dt + 14, 56, 4, K.lamp); ctx.globalAlpha = 1; }
    // посетитель
    var v = S.visitor;
    if (v.on && !S.strip) {
      var dtt = (nowT - (v.last || nowT)) / 1000; v.last = nowT;
      if (Math.abs(v.tx - v.x) > .6) { var dir = v.tx > v.x ? 1 : -1; v.x += dir * Math.min(Math.abs(v.tx - v.x), (S.reduce ? 1e4 : 72) * dtt); v.walking = true; } else { v.x = v.tx; v.walking = false; }
      visitor(Math.round(v.x), H - 3, S.reduce ? 0 : Math.floor(t / 160), v.walking && !S.reduce);
    }
        positionDynamic();
  }

  /* ---------- слой HTML поверх сцены ---------- */
  function px(v) { return Math.round(v * G.s) + 'px'; }
  function positionStatic() {
    if (!els.sign) return;
    var s = G.s;
    els.sign.style.left = px(7); els.sign.style.top = px(Math.max(7, G.wallH - 27)); els.sign.style.width = px(34);
    els.sign.hidden = S.strip;
    for (var i = 0; i < 4; i++) {
      var p = els.plates[i]; p.style.left = px(G.cx[i] - 25); p.style.top = px(G.deskTop + 6); p.style.width = px(50); p.style.height = px(8);
      var b = els.badges[i]; b.style.left = px(G.cx[i] - 8); b.style.top = px(G.deskTop - 40);
    }
  }
  function positionDynamic() {
    var v = S.visitor, y = els.you;
    if (y) { y.hidden = !(v.on && !S.strip) || S.mode === 'my'; y.style.left = px(v.x); y.style.top = px(G.H - 3 - 22 - 11); }
    for (var i = 0; i < 4; i++) {
      var e = S.emote[i], b = els.bubbles[i];
      if (e && e.until > now()) {
        b.hidden = false; b.textContent = e.text; var half = Math.min(100, e.text.length * 3.8 + 14) / G.s, cxl = G.cx[i] - 8;
        cxl = Math.max(S.cam + half + 1, Math.min(S.cam + G.view - half - 1, cxl)); b.style.left = px(cxl); b.style.top = px(G.deskTop - 34);
      }
      else if (!b.hidden) b.hidden = true;
    }
    if (els.stamp) { els.stamp.style.left = px(G.cx[3] - 62); els.stamp.style.top = px(Math.max(6, G.wallH - 26)); }
  }

  /* ---------- публичное ---------- */
  function mk(cls, tag, parent) { var e = document.createElement(tag || 'div'); e.className = cls; parent.appendChild(e); return e; }
  var Office = {
    init: function (worldEl, canvas) {
      world = worldEl; cv = canvas; ctx = cv.getContext('2d'); stat = document.createElement('canvas'); sctx = stat.getContext('2d'); lite = document.createElement('canvas'); lctx = lite.getContext('2d');
      overlay = mk('ov', 'div', world);
      els.sign = mk('sign', 'div', overlay); els.you = mk('you', 'div', overlay);
      for (var i = 0; i < 4; i++) {
        (function (i) {
          var p = mk('plate', 'div', overlay); p.dataset.st = i; els.plates.push(p);
          p.addEventListener('click', function () { if (onPlate && p.dataset.live === '1') onPlate(i); });
          els.bubbles.push(Object.assign(mk('say', 'div', overlay), { hidden: true }));
          els.badges.push(Object.assign(mk('badge', 'div', overlay), { hidden: true }));
        })(i);
      }
      els.stamp = Object.assign(mk('stamp', 'div', overlay), { hidden: true });
    },
    onPlate: function (fn) { onPlate = fn; },
    setTenant: function (t) { T = t; S.propsKey = ''; this.redraw(); },
    setLang: function (l) { lang = l; this.labels(); },
    setTheme: function (th) { S.theme = th; this.redraw(); },
    reduce: function (r) { S.reduce = !!r; },
    resize: function (W, H, s, strip) {
      S.strip = !!strip; layout(W, H, s, strip);
      [cv, stat, lite].forEach(function (k) { k.width = G.Rw; k.height = G.H; });
      cv.style.width = px(G.Rw); cv.style.height = px(G.H); world.style.width = px(G.Rw); world.style.height = px(G.H);
      world.style.setProperty('--s', s + 'px'); this.redraw(); this.cam(true);
    },
    redraw: function () { if (!T || !stat) return; drawStatic(); positionStatic(); this.labels(); this.tick(true); },
    labels: function () {
      if (!T) return; var ui = window.SAI.UI[lang];
      els.sign.innerHTML = '<b></b><i></i>'; els.sign.firstChild.textContent = T.name; els.sign.lastChild.textContent = T.tag[lang];
      for (var i = 0; i < 4; i++) { els.plates[i].textContent = (i + 1) + ' · ' + ui.st_short[i]; }
      els.you.textContent = ui.you;
    },
    interactive: function (on) {
      els.plates.forEach(function (p) { p.dataset.live = on ? '1' : '0'; if (on) { p.setAttribute('role', 'button'); p.tabIndex = 0; } else { p.removeAttribute('role'); p.removeAttribute('tabindex'); } });
      if (!els._kd) { els._kd = 1; els.plates.forEach(function (p, i) { p.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && p.dataset.live === '1') { e.preventDefault(); onPlate && onPlate(i); } }); }); }
    },
    mode: function (m, o) {
      o = o || {}; S.mode = m; S.focus = o.focus === undefined ? -1 : o.focus; S.stage = o.stage || 0;
      for (var i = 0; i < 4; i++) {
        var lit = 0;
        if (m === 'start') lit = .75; else if (m === 'ask') lit = i === S.focus ? 1 : 0; else if (m === 'result') lit = i === 3 ? 1 : .25; else if (m === 'my') lit = i === S.stage ? 1 : (i < S.stage ? .4 : 0); else if (m === 'strip') lit = S.counts[i] > 0 ? .9 : .3;
        S.lightT[i] = lit;
      }
      if (m === 'start') { S.visitor.tx = 24; S.visitor.on = true; }
      if (m === 'ask' && S.focus >= 0) S.visitor.tx = G.cx[S.focus] - 37;
      if (m === 'result') S.visitor.tx = G.cx[3] - 37;
      if (m === 'my' || m === 'strip') S.visitor.on = false; else S.visitor.on = true;
      var cls = ['', '', '', ''];
      if (m === 'ask' && S.focus >= 0) cls[S.focus] = 'now'; else if (m === 'result') cls[3] = 'now';
      else if (m === 'my') for (var j = 0; j < 4; j++) cls[j] = j < S.stage ? 'done' : (j === S.stage ? 'now' : 'wait');
      else if (m === 'strip') for (var j2 = 0; j2 < 4; j2++) cls[j2] = S.counts[j2] > 0 ? 'now' : 'wait';
      els.plates.forEach(function (p, j) { p.className = 'plate' + (cls[j] ? ' ' + cls[j] : ''); });
      els.stamp.hidden = m !== 'result';
      this.cam(false); this.wake();
    },
    cam: function (instant) {
      if (!world) return;
      var target = 0;
      if (G.Rw > G.view) {
        var fc = S.mode === 'start' ? 70 : (S.focus >= 0 ? G.cx[S.focus] : (S.mode === 'my' ? G.cx[Math.min(3, S.stage)] : (S.mode === 'result' ? G.cx[3] : G.Rw / 2)));
        target = Math.max(0, Math.min(G.Rw - G.view, Math.round(fc - G.view / 2)));
      }
      S.cam = target;
      world.style.transition = (instant || S.reduce) ? 'none' : 'transform .7s cubic-bezier(.3,.7,.2,1)';
      world.style.transform = 'translateX(' + (-target * G.s) + 'px)';
    },
    camX: function () { return S.cam; },
    stationX: function (i) { return G.cx[i] - 8; },
    geom: function () { return G; },
    setAnswers: function (list, answered) {
      // list: [{st, prop}] — обновляем, помечая новые/изменённые
      var key = {}, prev = {}, out = [], nowT = now();
      S.props.forEach(function (p) { prev[p.qid] = p; });
      list.forEach(function (a) {
        var q = prev[a.qid], same = q && JSON.stringify(q.spec) === JSON.stringify(a.prop);
        var o = Object.assign({}, a.prop, { st: a.st, qid: a.qid, spec: a.prop, born: same ? q.born : nowT });
        out.push(o);
      });
      S.props = out; S.answered = answered || 0; this.wake();
    },
    react: function (st, text, ms) {
      S.busy[st] = now() + (ms || 1500); S.emote[st] = { text: text, until: now() + (ms || 1500) + 400 }; this.wake();
    },
    courier: function (a, b) {
      if (a === b || a < 0 || b < 0) return;
      S.couriers.push({ t0: now() + 250, dur: 700, x0: G.cx[a], y0: G.deskTop - 6, x1: G.cx[b], y1: G.deskTop - 6 }); this.wake();
    },
    say: function (st, text, ms) { S.emote[st] = { text: text, until: now() + (ms || 2200) }; this.wake(); },
    counts: function (arr) { S.counts = arr; els.badges.forEach(function (b, i) { b.hidden = !S.strip; b.textContent = arr[i]; b.dataset.zero = arr[i] === 0 ? '1' : '0'; }); },
    stamp: function () { var e = els.stamp; if (!e) return; e.textContent = window.SAI.UI[lang].stamp; e.hidden = false; e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); },
    drawIcon: function (canvas, spec, th) {
      var saveC = c, saveK = K, saveT = S.theme; S.theme = th || S.theme; K = palette();
      var pr = PR[spec.t]; if (!pr) { S.theme = saveT; K = saveK; return; }
      var w = pr.w, h = pr.h; if (spec.t === 'shelf') w = 18 * (spec.n || 1);
      var k = (h <= 14 && w <= 28) ? 4 : ((h <= 18 && w <= 36) ? 3 : 2), cw = Math.floor(112 / k), ch = Math.floor(56 / k);
      canvas.width = cw; canvas.height = ch; canvas.style.width = (cw * k) + 'px'; canvas.style.height = (ch * k) + 'px';
      var g = canvas.getContext('2d'); c = g; g.clearRect(0, 0, cw, ch);
      pr.draw(Math.floor((cw - w) / 2), Math.floor((ch - h) / 2) + (spec.t === 'shelf' && spec.shop ? 3 : 0), spec, 0, false);
      c = saveC; K = saveK; S.theme = saveT;
    },
    drawAvatar: function (canvas, P) {
      var saveC = c, saveK = K; K = palette(); var g = canvas.getContext('2d'); c = g; g.clearRect(0, 0, canvas.width, canvas.height);
      g.save(); g.translate(canvas.width / 2, canvas.height - 1); person(0, 0, P, 'attend', 1, 0); g.restore(); c = saveC; K = saveK;
    },
    wake: function () { if (!raf) { raf = requestAnimationFrame(loop); } },
    tick: function (force) { if (!T || !ctx) return; drawFrame(now()); }
  };
  function settled() {
    var i; for (i = 0; i < 4; i++) if (Math.abs(S.light[i] - S.lightT[i]) > .02) return false;
    var n = now(); if (S.couriers.length) return false; if (Math.abs(S.visitor.tx - S.visitor.x) > .6) return false;
    for (i = 0; i < 4; i++) if (S.busy[i] > n || (S.emote[i] && S.emote[i].until > n)) return false;
    return !S.props.some(function (p) { return n - p.born < 800; });
  }
  function loop(t) {
    raf = 0; if (document.hidden) { return; }
    var min = S.reduce ? 100 : 40; if (t - lastDraw >= min) { lastDraw = t; drawFrame(now()); }
    // анимация жизни: работаем, пока сцена видна (экономия — 25 кадров/с); при reduce — только по событиям
    if (!S.reduce) raf = requestAnimationFrame(loop); else if (!settled()) raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) Office.wake(); });
  window.Office = Office;
})();
