/* Офис подбора решения — логика. Всё берётся из данных арендатора (data.js). */
(function () {
  'use strict';
  var SAI = window.SAI, UI = SAI.UI, TENANTS = SAI.TENANTS, Office = window.Office;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var root = document.documentElement;
  var qs = new URLSearchParams(location.search);

  /* ---------- форматы Казахстана ---------- */
  var THIN = ' ', NB = ' ';
  function grp(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, THIN); }
  function fmtInt(n) { return grp(String(Math.round(n))); }
  function fmtKzt(n) { return fmtInt(n) + NB + '₸'; }
  function fmtDays(n) { var s = (Math.round(n * 10) / 10).toFixed(1).replace('.', ','); return s.replace(/,0$/, ''); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function astana(ms) { return new Date(ms + 5 * 3600e3); }
  function fmtDate(ms) { var d = astana(ms); return p2(d.getUTCDate()) + '.' + p2(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }
  function fmtTime(ms) { var d = astana(ms); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); }
  function fmtStamp(ms) { return fmtDate(ms) + ', ' + fmtTime(ms) + ' · ' + t('tz'); }

  /* ---------- состояние ---------- */
  var LANG = ['ru', 'kk', 'en'].indexOf(qs.get('lang')) >= 0 ? qs.get('lang') : (ls('sai3.lang') || 'ru');
  var THEME = qs.get('theme') === 'light' ? 'day' : (qs.get('theme') === 'dark' ? 'night' : (ls('sai3.theme') || 'auto'));
  var TEN = TENANTS[qs.get('tenant')] || TENANTS[ls('sai3.tenant')] || TENANTS.stock;
  var A = {}, ROUTE = { name: 'start' }, LOCK = false, REDUCE = false, EDIT = false, SHEET = false;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } return null; }
  function t(k, v) { var s = (UI[LANG][k] !== undefined ? UI[LANG][k] : UI.ru[k]); if (v && typeof s === 'string') for (var x in v) s = s.replace('{' + x + '}', v[x]); return s; }
  function tl(o) { return o ? (o[LANG] || o.ru) : ''; }
  function loadAns() { try { A = JSON.parse(ls('sai3.ans.' + TEN.id) || '{}') || {}; } catch (e) { A = {}; } }
  function saveAns() { ls('sai3.ans.' + TEN.id, JSON.stringify(A)); }
  var Q = function (id) { return TEN.questions.filter(function (q) { return q.id === id; })[0]; };
  function optOf(q, a) { // выбранный вариант (или по умолчанию)
    var id = a;
    if (q.kind === 'number' && typeof a === 'number') { for (var i = 0; i < q.opts.length; i++) if (a <= q.opts[i].max) { id = q.opts[i].id; break; } }
    for (var j = 0; j < q.opts.length; j++) if (q.opts[j].id === id) return q.opts[j];
    return null;
  }
  function given(q, a) { a = a === undefined ? A[q.id] : a; return a !== undefined && a !== '?'; }

  /* ---------- расчёт ---------- */
  function compute(T, ans, fill) {
    var n = T.questions.length, known = 0, ids = T.base.slice(), asm = {}, labels = [];
    T.questions.forEach(function (q) {
      var a = ans[q.id], o = null, ass = false;
      if (a === undefined) { if (fill) { o = optOf(q, q.def); ass = true; } }
      else if (a === '?') { o = optOf(q, q.def); ass = true; known += .5; }
      else { o = optOf(q, a); known += 1; }
      if (o) { o.lines.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); if (ass) asm[id] = 1; }); labels.push({ q: q, o: o, a: a, ass: ass }); }
      if (a === undefined && fill) known += .5;
    });
    var lines = ids.map(function (id) { var d = T.lines[id]; return { id: id, label: d[0], desc: d[1], days: d[2], ass: !!asm[id] }; });
    var days = lines.reduce(function (s, l) { return s + l.days; }, 0), est = days * T.rate;
    var spread = Math.max(.1, .38 - .28 * (known / n));
    var lo = Math.floor(est * (1 - spread) / 10000) * 10000, hi = Math.ceil(est * (1 + spread * 1.25) / 10000) * 10000;
    var fit = Math.min(97, Math.round(58 + 8 * known));
    return { lines: lines, days: days, est: est, lo: lo, hi: hi, fit: fit, known: known, n: n, labels: labels, spread: spread };
  }
  function answeredCount() { return TEN.questions.filter(function (q) { return A[q.id] !== undefined; }).length; }
  function nextUnanswered() { for (var i = 0; i < TEN.questions.length; i++) if (A[TEN.questions[i].id] === undefined) return i; return -1; }
  function rangeText(r) { return fmtInt(r.lo) + THIN + '–' + THIN + fmtInt(r.hi) + NB + '₸'; }
  function summaryText(res) { return res.labels.map(function (x) { return tl(x.o.label); }).join(' · '); }

  /* ---------- арендатор, тема, язык ---------- */
  function mixHex(a, b, t) { var f = function (h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }, A1 = f(a), B1 = f(b); return '#' + [0, 1, 2].map(function (i) { var v = Math.round(A1[i] + (B1[i] - A1[i]) * t); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function effTheme() { if (THEME === 'day' || THEME === 'night') return THEME; return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'night' : 'day'; }
  function applyTokens() {
    var th = effTheme(), P = TEN.pal, m = th === 'night' ? P.night : P.day, st = root.style;
    root.dataset.th = th; root.lang = LANG;
    st.setProperty('--card', mixHex(m.paper, '#ffffff', th === 'night' ? .07 : .55));
    st.setProperty('--bg', m.bg); st.setProperty('--paper', m.paper); st.setProperty('--ink', m.ink); st.setProperty('--ink2', m.ink2); st.setProperty('--line', m.line);
    st.setProperty('--btn', P.btn); st.setProperty('--onbtn', P.onBtn); st.setProperty('--acc', P.accent); st.setProperty('--acct', th === 'night' ? P.accTN : P.accT);
    st.setProperty('--acc2', P.accent2); st.setProperty('--wall', m.wall); st.setProperty('--floor', m.floorA); st.setProperty('--floor2', m.floorB);
    st.setProperty('--shadow', th === 'night' ? 'rgba(0,0,0,.55)' : 'rgba(40,30,20,.28)');
    Office.setTheme(th);
  }
  function applyTenant() {
    loadAns(); Office.setTenant(TEN); Office.setLang(LANG); applyTokens();
    $('#bname').textContent = TEN.name; $('#mark').textContent = TEN.initial; document.title = TEN.name + ' — ' + tl(TEN.industry);
    ls('sai3.tenant', TEN.id);
  }
  function chrome() {
    $('#skip').textContent = t('skip');
    $('#langs').setAttribute('aria-label', t('lang'));
    $('#langs').innerHTML = ['ru', 'kk', 'en'].map(function (l) { return '<button type="button" data-lang="' + l + '" aria-pressed="' + (l === LANG) + '"' + (l !== LANG ? ' lang="' + l + '"' : '') + '>' + { ru: 'RU', kk: 'ҚАЗ', en: 'EN' }[l] + '</button>'; }).join('');
    var th = THEME;
    $('#themelabel').textContent = t('th_' + (th === 'auto' ? 'auto' : th));
    $('#themebtn').setAttribute('aria-label', t('theme') + ': ' + t('th_' + th));
    $('#stage').setAttribute('aria-label', t('office_alt'));
    Office.setLang(LANG);
    footer();
  }
  function footer() {
    var f = $('#foot'), tens = Object.keys(TENANTS).map(function (k) { return '<button type="button" data-ten="' + k + '" aria-pressed="' + (k === TEN.id) + '">' + esc(TENANTS[k].name) + '</button>'; }).join('');
    var stg = '';
    if (ROUTE.name === 'my') stg = '<span class="fl">' + t('stage_demo') + '</span><div class="seg" role="group">' + [0, 1, 2, 3].map(function (i) { return '<button type="button" data-stg="' + i + '" aria-pressed="' + (i === curStage()) + '">' + (i + 1) + '</button>'; }).join('') + '</div>';
    f.innerHTML = '<div class="wrap foot-in"><span class="plat"><i class="pxs" aria-hidden="true"></i>' + esc(t('brand')) + '</span><div class="demo"><span class="fl">' + t('tenant') + '</span><div class="seg" role="group">' + tens + '</div>' + stg +
      (ROUTE.name === 'board' ? '<a class="lnk" href="#/">' + esc(TEN.name) + '</a>' : '<a class="lnk" href="#/board">' + t('op') + '</a>') + '</div>' +
      (LANG === 'kk' ? '<p class="kk">' + esc(t('kk_note')) + '</p>' : '') + '</div>';
  }

  /* ---------- размеры сцены ---------- */
  function fit() {
    var vw = root.clientWidth, vh = window.innerHeight, narrow = vw < 760, strip = ROUTE.name === 'board';
    var s = (vw >= 1300 && vh >= 700) ? 4 : ((vw >= 1000 && vh >= 640) ? 3 : 2), H;
    if (strip) H = narrow ? 70 : (s >= 3 ? 70 : 78);
    else H = Math.max(vh < 600 ? 84 : (s === 4 ? 88 : 92), Math.min(150, Math.round(vh * (narrow ? 0.25 : 0.44) / s)));
    var W = Math.floor(vw / s);
    root.style.setProperty('--px', s + 'px'); root.dataset.s = s;
    $('#stage').style.height = (H * s) + 'px';
    Office.resize(W, H, s, strip);
    placeTail();
  }

  /* ---------- маршрутизатор ---------- */
  function parse() {
    var h = (location.hash || '#/').replace(/^#\/?/, ''), p = h.split('?')[0].split('/');
    var r = { name: p[0] || 'start', arg: p[1] ? decodeURIComponent(p[1]) : p[1], flag: p[2], q: new URLSearchParams(h.split('?')[1] || '') };
    return r;
  }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function route() {
    ROUTE = parse(); SHEET = false;
    var n = TEN.questions.length;
    if (ROUTE.name === 'ask') {
      var idx = parseInt(ROUTE.arg, 10);
      if (!(idx >= 1 && idx <= n)) { var nu = nextUnanswered(); idx = nu < 0 ? 1 : nu + 1; }
      ROUTE.idx = idx - 1; EDIT = ROUTE.flag === 'e';
    }
    root.dataset.view = ROUTE.name; $('#stage').setAttribute('role', ROUTE.name === 'board' ? 'group' : 'img'); fit();
    var m = $('#main'); m.className = 'panel v-' + ROUTE.name;
    ({ start: vStart, ask: vAsk, result: vResult, my: vMy, board: vBoard }[ROUTE.name] || vStart)(m);
    footer(); window.scrollTo(0, 0);
    var hd = $('#main h1, #main h2'); if (hd) { hd.setAttribute('tabindex', '-1'); try { hd.focus({ preventScroll: true }); } catch (e) { } }
  }

  /* ---------- общие кусочки ---------- */
  function syncOffice() {
    var list = [];
    TEN.questions.forEach(function (q) { var a = A[q.id]; if (a === undefined) return; var o = optOf(q, a); if (o && o.prop) list.push({ qid: q.id, st: q.st, prop: o.prop }); });
    Office.setAnswers(list, answeredCount());
  }
  function icons(scope) {
    $$('canvas[data-ic]', scope).forEach(function (cv) { try { Office.drawIcon(cv, JSON.parse(cv.getAttribute('data-ic')), effTheme()); } catch (e) { } });
  }
  function avatarHTML(i) { return '<canvas class="avatar" width="24" height="23" data-av="' + i + '" aria-hidden="true"></canvas>'; }
  function avatars(scope) { $$('canvas[data-av]', scope).forEach(function (cv) { Office.drawAvatar(cv, TEN.team[+cv.getAttribute('data-av')]); }); }
  function announce(s) { var l = $('#live'); l.textContent = ''; setTimeout(function () { l.textContent = s; }, 30); }
  function pips(k, n) { var s = ''; for (var i = 0; i < n; i++) s += '<i class="' + (k >= i + 1 ? 'on' : (k > i ? 'half' : '')) + '"></i>'; return s; }
  function bandHTML(res) {
    var w = Math.max(8, Math.round((res.hi - res.lo) / res.hi * 100)); return '<span class="band" aria-hidden="true"><i style="left:' + Math.round((100 - w) / 2) + '%;width:' + w + '%"></i></span>';
  }
  function sumHTML(res, final) {
    return '<div class="sum"><div class="sm-price"><span class="lbl">' + t('rc_price') + '</span><b class="num">' + rangeText(res) + '</b>' + bandHTML(res) + '</div>' +
      '<div class="sm-m"><span class="lbl">' + t('rc_effort') + '</span><b class="num">' + fmtDays(res.days) + NB + t('unit_d') + '</b></div>' +
      '<div class="sm-m"><span class="lbl">' + t('rc_fit') + '</span><b class="num">' + res.fit + '%</b></div>' +
      '<div class="sm-m"><span class="lbl">' + t('rc_prec') + '</span><b class="pp" aria-label="' + t('rc_prec_v', { k: Math.floor(res.known), n: res.n }) + '">' + pips(res.known, res.n) + '</b></div></div>';
  }
  function linesHTML(res, newIds) {
    return '<ul class="rl">' + res.lines.map(function (l) {
      return '<li' + (newIds && newIds.indexOf(l.id) >= 0 ? ' class="new"' : '') + '><span class="rn"><b>' + esc(tl(l.label)) + '</b><small>' + esc(tl(l.desc)) + (l.ass ? ' · <em>' + t('assumed') + '</em>' : '') + '</small></span><span class="rd num">' + fmtDays(l.days) + NB + t('unit_d') + '</span></li>';
    }).join('') + '</ul>';
  }
  function placeTail() {
    var a = $('.ask'); if (!a || ROUTE.name !== 'ask') return;
    var G = Office.geom(), x = (Office.stationX(TEN.questions[ROUTE.idx].st) - Office.camX()) * G.s, r = a.getBoundingClientRect();
    a.style.setProperty('--tx', Math.max(30, Math.min(r.width - 30, x - r.left)) + 'px');
  }

  /* ---------- экран 1: начало ---------- */
  function vStart(m) {
    Office.interactive(false); Office.mode('start'); Office.setAnswers([], 0);
    var n = TEN.questions.length, have = answeredCount(), nu = nextUnanswered();
    m.innerHTML = '<div class="wrap"><div class="intro"><p class="eyebrow">' + esc(tl(TEN.industry)) + '</p><h1>' + esc(tl(TEN.headline)) + '</h1><p class="pitch">' + esc(tl(TEN.pitch)) + '</p>' +
      '<div class="cta"><button class="btn big" type="button" id="go">' + esc(t('start_cta', { n: n })) + '</button>' +
      (have > 0 && nu >= 0 ? '<button class="btn ghost" type="button" id="resume">' + esc(t('resume', { i: nu + 1 })) + '</button><button class="lnk b" type="button" id="reset">' + t('restart') + '</button>' : '') + '</div>' +
      '<p class="meta">' + esc(t('start_meta')) + '</p></div>' +
      '<ul class="team">' + TEN.team.map(function (p, i) { return '<li>' + avatarHTML(i) + '<b>' + esc(p.name) + '</b><span>' + esc(tl(p.role)) + '</span></li>'; }).join('') + '</ul></div>';
    avatars(m);
    $('#go').onclick = function () { A = {}; saveAns(); go('#/ask/1'); };
    if ($('#resume')) $('#resume').onclick = function () { go('#/ask/' + (nu + 1)); };
    if ($('#reset')) $('#reset').onclick = function () { A = {}; saveAns(); route(); };
    Office.say(0, tl(TEN.say[0]), 3200);
    syncOffice();
  }

  /* ---------- экран 2: вопрос + живой чек ---------- */
  function vAsk(m) {
    var q = TEN.questions[ROUTE.idx], n = TEN.questions.length, P = TEN.team[q.st], cur = A[q.id];
    Office.interactive(false); Office.mode('ask', { focus: q.st }); syncOffice();
    var res = compute(TEN, A, false), cards = '';
    var selId = (cur !== undefined && cur !== '?') ? (optOf(q, cur) || {}).id : null;
    q.opts.forEach(function (o, i) {
      var lab = tl(o.label), sub = '';
      if (q.kind === 'number') { lab = fmtInt(q.chips[i]); }
      cards += '<button class="card" type="button" data-opt="' + (q.kind === 'number' ? 'n:' + q.chips[i] : o.id) + '" aria-pressed="' + (selId === o.id && (q.kind !== 'number' || typeof cur === 'number' && q.chips.indexOf(cur) === i)) + '" aria-keyshortcuts="' + (i + 1) + '"><span class="kb" aria-hidden="true">' + (i + 1) + '</span><canvas class="ic" width="56" height="28" data-ic=\'' + JSON.stringify(o.icon) + '\' aria-hidden="true"></canvas><span class="cl">' + esc(lab) + '</span>' + (sub ? '<span class="cs">' + esc(sub) + '</span>' : '') + '</button>';
    });
    if (q.kind === 'number') cards += '<form class="own card-own" id="own"><label for="ownv">' + t('own') + '</label><span class="ownrow"><input id="ownv" inputmode="numeric" autocomplete="off" placeholder="' + esc(t('own_ph')) + '" value="' + (typeof cur === 'number' && q.chips.indexOf(cur) < 0 ? fmtInt(cur) : '') + '"><button class="btn small" type="submit">' + t('ok') + '</button></span></form>';
    cards += '<button class="card dk" type="button" data-opt="?" aria-pressed="' + (cur === '?') + '" aria-keyshortcuts="0"><span class="kb" aria-hidden="true">0</span><span class="cl">' + t('dk') + '</span><span class="cs">' + t('dk_sub') + '</span></button>';
    var enough = answeredCount() > 0;
    m.innerHTML = '<div class="wrap ask-wrap"><div class="ask"><div class="ask-h"><div class="spk">' + avatarHTML(q.st) + '<div class="who"><b>' + esc(P.name) + '</b><span>' + esc(tl(P.role)) + '</span></div></div>' +
      '<h2>' + esc(tl(q.title)) + '</h2>' +
      '<div class="prog"><span class="pg" aria-hidden="true">' + pips(ROUTE.idx + 1, n) + '</span><span class="pt">' + esc(t('q_of', { i: ROUTE.idx + 1, n: n })) + '</span></div>' +
      '<button class="btn ghost back" type="button" id="back" title="' + esc(t('back_t')) + '"><span aria-hidden="true">‹</span> ' + t('back') + '</button></div>' +
      '<div class="cards" role="group" aria-label="' + esc(tl(q.title)) + '" data-n="' + (q.opts.length + 1 + (q.kind === 'number' ? 1 : 0)) + '">' + cards + '</div></div>' +
      ticketHTML(res, enough) + '</div>';
    avatars(m); icons(m); placeTail();
    $$('.card[data-opt]', m).forEach(function (b) {
      b.onclick = function () { var v = b.getAttribute('data-opt'); pick(q, v === '?' ? '?' : (v.indexOf('n:') === 0 ? parseInt(v.slice(2), 10) : v), b); };
    });
    if ($('#own')) $('#own').onsubmit = function (e) { e.preventDefault(); var v = parseInt($('#ownv').value.replace(/[^\d]/g, ''), 10); if (v > 0) pick(q, v); else $('#ownv').focus(); };
    $('#back').onclick = function () { back(); };
    bindTicket(m);
  }
  function ticketHTML(res, enough) {
    var asked = answeredCount();
    var lines = asked === 0 ? '<p class="tk-hint">' + esc(t('rc_hint0')) + '</p>' : '<ul class="tk-lines">' + res.lines.slice().reverse().slice(0, 7).map(function (l, i) { return '<li' + (i === 0 && asked ? ' class="new"' : '') + '>' + esc(tl(l.label)) + '</li>'; }).join('') + (res.lines.length > 7 ? '<li class="more">+' + (res.lines.length - 7) + '</li>' : '') + '</ul>';
    return '<aside class="ticket" id="ticket" aria-label="' + esc(t('rc_live')) + '"><div class="tk-cap"><span class="tk-eff num">' + fmtDays(res.days) + NB + t('unit_d') + ' · ' + res.fit + '%</span><button class="lnk tgl" type="button" id="tgl" aria-expanded="false">' + t('sheet_toggle') + ' <span aria-hidden="true">▴</span></button></div>' + sumHTML(res) + lines +
      '<div class="tk-sheet" id="sheet"><div class="sh-h"><b>' + esc(t('rc_live')) + '</b><button class="lnk" type="button" id="shx">' + t('sheet_close') + '</button></div>' + linesHTML(res) + '</div>' +
      (enough ? '<button class="btn enough" type="button" id="enough">' + esc(t('enough')) + '</button>' : '') + '</aside>';
  }
  function bindTicket(m) {
    var tg = $('#tgl'), tk = $('#ticket');
    if (tg) tg.onclick = function () { SHEET = !SHEET; tk.classList.toggle('open', SHEET); tg.setAttribute('aria-expanded', SHEET); };
    if ($('#shx')) $('#shx').onclick = function () { SHEET = false; tk.classList.remove('open'); tg.setAttribute('aria-expanded', 'false'); tg.focus(); };
    if ($('#enough')) $('#enough').onclick = function () { go('#/result'); };
  }
  function pick(q, v, btn) {
    if (LOCK) return; LOCK = true;
    A[q.id] = v; saveAns();
    if (btn) { $$('.card', btn.parentNode).forEach(function (b) { b.setAttribute('aria-pressed', b === btn); }); btn.classList.add('hit'); }
    var o = optOf(q, v), P = TEN.team[q.st];
    var nu = nextUnanswered(); syncOffice();
    Office.react(q.st, tl(TEN.say[q.st]), 1500);
    var nextSt = nu >= 0 ? TEN.questions[nu].st : 3; Office.courier(q.st, nextSt);
    var res = compute(TEN, A, false);
    announce(t('sr_ans', { opt: v === '?' ? t('dk') : (typeof v === 'number' ? fmtInt(v) : tl(o.label)), range: rangeText(res) }));
    // обновить чек на месте
    var tk = $('#ticket'); if (tk) { var wasOpen = tk.classList.contains('open'); tk.outerHTML = ticketHTML(res, true); bindTicket($('#main')); if (wasOpen) { $('#ticket').classList.add('open'); } flash(); }
    setTimeout(function () {
      LOCK = false;
      if (EDIT) { EDIT = false; go('#/result'); return; }
      if (nu >= 0) go('#/ask/' + (nu + 1)); else go('#/result');
    }, REDUCE ? 60 : 480);
  }
  function flash() { var tk = $('#ticket'); if (tk) { tk.classList.remove('pulse'); void tk.offsetWidth; tk.classList.add('pulse'); } }
  function back() {
    if (ROUTE.idx <= 0) { go('#/'); return; }
    announce(t('sr_back', { i: ROUTE.idx })); go('#/ask/' + ROUTE.idx);
  }

  /* ---------- экран 3: результат и заявка ---------- */
  function vResult(m) {
    Office.interactive(false); Office.mode('result'); syncOffice();
    var res = compute(TEN, A, true), now = Date.now();
    var chips = res.labels.map(function (x) {
      var qi = TEN.questions.indexOf(x.q), lab = x.q.kind === 'number' && typeof x.a === 'number' ? fmtInt(x.a) + ' ' + tl(x.q.unit) : tl(x.o.label);
      return '<li><button class="chip" type="button" data-edit="' + (qi + 1) + '" title="' + esc(tl(x.q.title)) + '"><b>' + esc(lab) + '</b>' + (x.ass ? '<em>' + t('assumed') + '</em>' : '') + '</button></li>';
    }).join('');
    m.innerHTML = '<div class="wrap res"><div class="r-sum"><h2>' + esc(t('res_title')) + '</h2><p class="sub">' + esc(t('res_sub')) + '</p>' +
      '<article class="receipt"><header class="rc-h"><span class="rc-t">' + esc(TEN.name + ' · ' + TEN.pkg) + '</span><span class="num">' + fmtDate(now) + '</span></header>' + sumHTML(res, true) + '</article></div>' +
      '<form class="req" id="req" novalidate><h3>' + esc(t('req_title')) + '</h3><p class="sub">' + esc(t('req_lead')) + '</p>' +
      '<label for="contact">' + esc(t('req_label')) + '</label><input id="contact" name="contact" type="text" autocomplete="tel" placeholder="' + esc(t('req_ph')) + '" aria-describedby="cerr">' +
      '<p class="err" id="cerr" role="alert"></p>' +
      '<button class="btn big" type="submit" id="send">' + esc(t('req_send')) + '</button>' +
      '<button class="btn wa" type="button" id="wa"><i class="waic" aria-hidden="true"></i>' + esc(t('req_wa')) + '</button>' +
      '<div class="nm"><button class="lnk" type="button" id="addname" aria-expanded="false">+ ' + esc(t('req_name_add')) + '</button><div id="namebox" hidden><label for="rname">' + esc(t('req_name')) + '</label><input id="rname" type="text" autocomplete="name"></div></div>' +
      '<p class="fine">' + esc(t('req_note')) + '</p></form>' +
      '<div class="r-ans"><ul class="chips">' + chips + '</ul></div>' +
      '<div class="r-lines"><h3>' + esc(t('rc_get')) + '</h3>' + linesHTML(res) + '<p class="fine">' + esc(t('rc_note')) + '</p>' +
      '<div class="acts"><button class="lnk act" type="button" id="aprint">' + t('act_print') + '</button><button class="lnk act" type="button" id="acsv">' + t('act_csv') + '</button><button class="lnk act" type="button" id="apdf">' + t('act_pdf') + '</button></div></div></div>';
    Office.stamp(); Office.courier(Math.max(0, TEN.questions[TEN.questions.length - 1].st), 3);
    announce(t('res_title') + ' ' + rangeText(res));
    $$('.chip', m).forEach(function (b) { b.onclick = function () { go('#/ask/' + b.getAttribute('data-edit') + '/e'); }; });
    var fine = window.matchMedia && matchMedia('(pointer:fine)').matches;
    if (fine && !qs.get('nofocus')) $('#contact').focus({ preventScroll: true });
    $('#addname').onclick = function () { var bx = $('#namebox'); bx.hidden = !bx.hidden; this.setAttribute('aria-expanded', !bx.hidden); if (!bx.hidden) $('#rname').focus(); };
    $('#req').onsubmit = function (e) { e.preventDefault(); sendReq('form', res); };
    $('#wa').onclick = function () { sendReq('wa', res); };
    $('#aprint').onclick = $('#apdf').onclick = function () { doPrint(res); };
    $('#acsv').onclick = function () { doCsv(res); };
  }
  function validContact(v) {
    v = (v || '').trim(); if (/^@?[A-Za-z0-9_]{4,32}$/.test(v) && /^@/.test(v)) return true; if (/t\.me\//i.test(v)) return true;
    var d = v.replace(/[^\d]/g, ''); return /^[+\d][\d\s\-()]*$/.test(v) && d.length >= 10 && d.length <= 12;
  }
  function reqs() { try { return JSON.parse(ls('sai3.reqs.' + TEN.id) || 'null') || seed(); } catch (e) { return seed(); } }
  function saveReqs(a) { ls('sai3.reqs.' + TEN.id, JSON.stringify(a)); }
  function seed() {
    var now = Date.now(), a = TEN.demo.map(function (d, i) { return { id: TEN.ref + '-2026-' + (1040 + i * 7), name: d[0], contact: d[1], ans: d[2], stage: d[3], at: now - d[4] * 60000, via: i % 3 === 2 ? 'wa' : 'form', tok: 'demo' + i }; });
    saveReqs(a); return a;
  }
  function newId(a) { return TEN.ref + '-2026-' + (1040 + a.length * 7 + 1); }
  function sendReq(via, res) {
    var c = $('#contact'), v = c.value.trim();
    if (via === 'form' && !validContact(v)) { $('#cerr').textContent = t('req_err'); c.setAttribute('aria-invalid', 'true'); c.focus(); return; }
    var a = reqs(), id = newId(a), tok = Math.random().toString(36).slice(2, 10);
    var r = { id: id, name: ($('#rname') || {}).value || '', contact: via === 'wa' ? (v || 'WhatsApp') : v, ans: JSON.parse(JSON.stringify(A)), stage: 0, at: Date.now(), via: via, tok: tok, mine: 1 };
    a.push(r); saveReqs(a);
    if (via === 'wa') {
      var msg = t('wa_msg', { name: TEN.name, id: id, range: rangeText(res), days: fmtDays(res.days) });
      try { window.open('https://wa.me/' + TEN.wa + '?text=' + encodeURIComponent(msg), '_blank', 'noopener'); } catch (e) { }
    }
    ls('sai3.my.' + TEN.id, id);
    go('#/my/' + id);
  }

  /* ---------- печать и выгрузка ---------- */
  function doPrint(res) {
    var rows = res.lines.map(function (l) { return '<tr><td>' + esc(tl(l.label)) + '</td><td>' + esc(tl(l.desc)) + '</td><td class="r">' + fmtDays(l.days) + '</td></tr>'; }).join('');
    $('#printdoc').innerHTML = '<h1>' + esc(TEN.name) + ' — ' + esc(t('print_title')) + '</h1><p>' + esc(TEN.pkg) + ' · ' + fmtStamp(Date.now()) + '</p><p><b>' + esc(t('rc_price')) + ':</b> ' + rangeText(res) + '<br><b>' + esc(t('rc_effort')) + ':</b> ' + fmtDays(res.days) + ' ' + esc(t('unit_d')) + '<br><b>' + esc(t('rc_fit')) + ':</b> ' + res.fit + '%</p><table><tbody>' + rows + '</tbody></table><p>' + esc(summaryText(res)) + '</p><p><small>' + esc(t('rc_note')) + '</small></p>';
    window.print();
  }
  function doCsv(res) {
    var q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; }, h = UI[LANG].csv_h;
    var rows = [h.map(q).join(';')].concat(res.lines.map(function (l) { return [q(tl(l.label)), q(tl(l.desc)), q(fmtDays(l.days))].join(';'); }));
    rows.push([q(t('csv_total')), '""', q(fmtDays(res.days))].join(';')); rows.push([q(t('csv_range')), '""', q(res.lo + ' – ' + res.hi)].join(';'));
    var blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'raschet-' + TEN.ref + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- экран 4: мой запрос ---------- */
  function findReq(id) { return reqs().filter(function (r) { return r.id === id; })[0]; }
  function curStage() { var r = ROUTE.name === 'my' ? findReq(ROUTE.arg) : null; var o = ROUTE.q && ROUTE.q.get('stage'); if (o !== null && o !== undefined && o !== '') return Math.max(0, Math.min(3, +o - 1)); return r ? r.stage : 0; }
  function vMy(m) {
    Office.interactive(false); var r = findReq(ROUTE.arg);
    if (!r) { Office.mode('start'); m.innerHTML = '<div class="wrap"><div class="intro"><h1>' + esc(t('my_title')) + '</h1><p class="pitch">404</p><a class="btn big" href="#/">' + esc(TEN.name) + '</a></div></div>'; return; }
    var st = curStage(), ids = ls('sai3.my.' + TEN.id);
    var prevA = A; A = r.ans; syncOffice(); A = prevA;
    Office.mode('my', { stage: st });
    var link = location.href.split('#')[0] + '#/my/' + r.id + '?k=' + r.tok;
    m.innerHTML = '<div class="wrap my"><div class="my-main"><p class="eyebrow">' + esc(t('my_title')) + ' · <span class="num">' + esc(r.id) + '</span></p>' +
      '<h2 class="stg">' + esc(t('st')[st]) + '</h2><p class="pitch">' + esc(t('st_desc')[st]) + '</p>' +
      '<ol class="steps" aria-label="' + esc(t('stage_on', { i: st + 1, name: t('st')[st] })) + '">' + t('st').map(function (s, i) { return '<li class="' + (i < st ? 'done' : (i === st ? 'now' : 'wait')) + '"' + (i === st ? ' aria-current="step"' : '') + '><span class="sn">' + (i < st ? '✓' : (i + 1)) + '</span><span>' + esc(s) + '</span><em>' + (i < st ? t('done') : (i === st ? t('now') : t('wait'))) + '</em></li>'; }).join('') + '</ol></div>' +
      '<div class="my-link"><label for="plink">' + esc(t('my_link')) + '</label><div class="lk"><input id="plink" readonly value="' + esc(link) + '"><button class="btn" type="button" id="copy">' + esc(t('my_copy')) + '</button></div><p class="fine">' + esc(t('my_private')) + '</p><p class="fine num">' + esc(t('my_sent')) + ': ' + fmtStamp(r.at) + '</p></div></div>';
    $('#copy').onclick = function () { var i = $('#plink'); i.select(); try { navigator.clipboard.writeText(i.value); } catch (e) { try { document.execCommand('copy'); } catch (e2) { } } this.textContent = t('my_copied'); var b = this; setTimeout(function () { b.textContent = t('my_copy'); }, 1800); };
    $('#plink').onfocus = function () { this.select(); };
    announce(t('stage_on', { i: st + 1, name: t('st')[st] }));
    Office.say(st, tl(TEN.say[st]), 3000);
  }

  /* ---------- экран 5: доска оператора ---------- */
  var BTAB = 0;
  function age(ms) { var d = Math.max(0, Math.round((Date.now() - ms) / 60000)); if (d < 2) return t('age_now'); if (d < 90) return t('age_min', { n: d }); if (d < 2880) return t('age_h', { n: Math.round(d / 60) }); return t('age_d', { n: Math.round(d / 1440) }); }
  function vBoard(m) {
    var list = reqs(), cnt = [0, 0, 0, 0]; list.forEach(function (r) { cnt[r.stage]++; });
    Office.counts(cnt); Office.mode('strip'); Office.interactive(true); Office.setAnswers([], 0);
    Office.onPlate(function (i) { BTAB = i; $$('.col', m).forEach(function (c, k) { c.classList.toggle('on', k === i); }); $$('.tabs button').forEach(function (b, k) { b.setAttribute('aria-selected', k === i); }); });
    var cols = [0, 1, 2, 3].map(function (i) {
      var items = list.filter(function (r) { return r.stage === i; }).sort(function (a, b) { return b.at - a.at; });
      return '<section class="col' + (i === BTAB ? ' on' : '') + '" data-col="' + i + '" aria-labelledby="ch' + i + '"><h3 id="ch' + i + '"><span class="num">' + (i + 1) + '</span> ' + esc(t('st')[i]) + ' <em class="num">' + items.length + '</em></h3>' +
        (items.length ? items.map(function (r) { return kcard(r, i); }).join('') : '<p class="empty">' + t('empty') + '</p>') + '</section>';
    }).join('');
    m.innerHTML = '<div class="wrap"><div class="bh"><h2>' + esc(t('board')) + ' · ' + esc(TEN.name) + '</h2><span class="num">' + t('priv_count') + ': ' + list.length + '</span></div>' +
      '<div class="tabs" role="tablist">' + [0, 1, 2, 3].map(function (i) { return '<button type="button" role="tab" data-tab="' + i + '" aria-selected="' + (i === BTAB) + '" aria-label="' + esc(t('st')[i]) + ': ' + cnt[i] + '"><i class="tn num">' + (i + 1) + '</i><span class="tt">' + esc(t('st_short')[i]) + '</span> <b class="num">' + cnt[i] + '</b></button>'; }).join('') + '</div>' +
      '<div class="board">' + cols + '</div></div>';
    $$('.tabs button', m).forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-tab'); BTAB = i; $$('.col', m).forEach(function (c, k) { c.classList.toggle('on', k === i); }); $$('.tabs button', m).forEach(function (x, k) { x.setAttribute('aria-selected', k === i); }); }; });
    $$('.kc', m).forEach(function (c) {
      var id = c.getAttribute('data-id');
      var nx = $('.next', c); if (nx) nx.onclick = function () { var a = reqs(); a.forEach(function (r) { if (r.id === id && r.stage < 3) r.stage++; }); saveReqs(a); announce(t('moved')); var keep = BTAB; vBoard(m); Office.say(Math.min(3, keep + 1), tl(TEN.say[Math.min(3, keep + 1)]), 1600); var again = $('.kc[data-id="' + id + '"] .next') || $('.kc[data-id="' + id + '"] .det'); if (again) again.focus(); };
      var dt = $('.det', c); dt.onclick = function () { var d = $('.kd', c); d.hidden = !d.hidden; dt.setAttribute('aria-expanded', !d.hidden); };
    });
    fit2(m);
  }
  function fit2() { }
  function kcard(r, i) {
    var res = compute(TEN, r.ans, true), short = res.labels.slice(0, 3).map(function (x) { return x.q.kind === 'number' ? fmtInt(r.ans[x.q.id] || 0) : tl(x.o.label); }).join(' · ');
    var det = res.labels.map(function (x) { return '<li><span>' + esc(tl(x.q.title)) + '</span> <b>' + esc(x.q.kind === 'number' && typeof x.a === 'number' ? fmtInt(x.a) : tl(x.o.label)) + '</b></li>'; }).join('');
    var wa = 'https://wa.me/' + (r.contact.replace(/[^\d]/g, '') || TEN.wa);
    return '<article class="kc" data-id="' + esc(r.id) + '"><header><span class="kid num">' + esc(r.id) + '</span><span class="age">' + age(r.at) + '</span></header><b class="kn">' + esc(r.name || r.contact) + '</b>' + (r.name ? '<span class="kct num">' + esc(r.contact) + '</span>' : '') + '<p class="ks">' + esc(short) + '</p><div class="kp num">' + rangeText(res) + '</div><div class="kp2 num">' + fmtDays(res.days) + NB + t('unit_d') + ' · ' + res.fit + '%</div>' +
      '<div class="ka">' + (i < 3 ? '<button class="btn small next" type="button">' + t('next') + ' →</button>' : '<span class="okmark">' + t('done') + '</span>') + '<button class="lnk det" type="button" aria-expanded="false">' + t('open') + '</button></div>' +
      '<div class="kd" hidden><p class="lbl">' + t('det_answers') + '</p><ul>' + det + '</ul><p class="lbl">' + t('det_contact') + '</p><p class="num">' + esc(r.contact) + '</p><a class="lnk" href="' + esc(wa) + '" target="_blank" rel="noopener">' + t('det_wa') + '</a></div></article>';
  }

  /* ---------- события страницы ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button, a, [role=button]'); if (!b) return;
    if (e.detail > 0 && e.isTrusted) window.__taps = (window.__taps || 0) + 1;
    if (b.dataset.lang) { LANG = b.dataset.lang; ls('sai3.lang', LANG); chrome(); applyTokens(); route(); }
    else if (b.dataset.ten) { setTenant(b.dataset.ten); }
    else if (b.dataset.stg !== undefined) { var r = findReq(ROUTE.arg); if (r) { var a = reqs(); a.forEach(function (x) { if (x.id === r.id) x.stage = +b.dataset.stg; }); saveReqs(a); if (ROUTE.q && ROUTE.q.get('stage')) go('#/my/' + r.id); else route(); } }
    else if (b.id === 'themebtn') { THEME = { auto: 'day', day: 'night', night: 'auto' }[THEME]; ls('sai3.theme', THEME); applyTokens(); chrome(); Office.redraw(); route(); }
  });
  function setTenant(id) {
    if (!TENANTS[id] || id === TEN.id) return; TEN = TENANTS[id]; qs.set('tenant', id);
    try { history.replaceState(null, '', '?' + qs.toString() + (location.hash || '')); } catch (e) { }
    applyTenant(); chrome();
    if (ROUTE.name === 'my' || ROUTE.name === 'result') { go('#/'); } else route();
  }
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (ROUTE.name === 'ask' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (tag !== 'input' && tag !== 'textarea') {
        var k = e.key;
        if (/^[0-9]$/.test(k)) { var cs = $$('.card[data-opt]'), bt = k === '0' ? $('.card.dk') : cs[+k - 1]; if (bt && !(k !== '0' && bt.classList.contains('dk'))) { e.preventDefault(); bt.click(); } }
        else if (k === 'Backspace' || k === 'ArrowLeft' && tag !== 'button') { e.preventDefault(); back(); }
        else if ((k === 'ArrowRight' || k === 'ArrowLeft') && tag === 'button' && e.target.classList.contains('card')) { var all = $$('.card[data-opt]'), ix = all.indexOf(e.target), nx = all[ix + (k === 'ArrowRight' ? 1 : -1)]; if (nx) { e.preventDefault(); nx.focus(); } }
        else if (k === 'Enter' && e.shiftKey && $('#enough')) { $('#enough').click(); }
      } else if (e.key === 'Escape') { e.target.blur(); }
    }
    if (e.key === 'Escape' && SHEET) { SHEET = false; var tk = $('#ticket'); if (tk) tk.classList.remove('open'); }
  });
  window.addEventListener('hashchange', route);
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { fit(); placeTail(); }, 120); });
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-reduced-motion: reduce)'); REDUCE = mq.matches || qs.get('still') === '1'; Office.reduce(REDUCE); if (REDUCE) root.classList.add('still');
    var dm = matchMedia('(prefers-color-scheme: dark)'); (dm.addEventListener ? dm.addEventListener.bind(dm, 'change') : function () { })(function () { if (THEME === 'auto') { applyTokens(); Office.redraw(); route(); } });
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : function () { })(function () { REDUCE = mq.matches; Office.reduce(REDUCE); root.classList.toggle('still', REDUCE); });
  }

  /* ---------- запуск ---------- */
  Office.init($('#world'), $('#cv'));
  applyTenant(); chrome(); route();
  window.__sai = { go: go, route: route, tenant: function () { return TEN; }, compute: function () { return compute(TEN, A, true); }, answers: function () { return A; } };
})();
