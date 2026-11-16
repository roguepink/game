// ===================== UI: HUD, menus, input, save data =====================
const els = {};
const GP = { thr: 0, steer: 0, brake: 0, btn: [] };
const SAVE = { unlocked: 1, best: {} };
const SAVE_KEY = 'gritTrail.v1';
function loadSave() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (d && typeof d.unlocked === 'number') { SAVE.unlocked = clamp(d.unlocked, 1, STAGES.length); SAVE.best = d.best || {}; } } catch (e) { /* storage unavailable */ } }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { /* storage unavailable */ } }
const $ = (id) => document.getElementById(id);
function fmtT(t) { if (!isFinite(t)) return '--:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
const hexCss = (c) => '#' + c.toString(16).padStart(6, '0');

function initDom() {
  ['gl', 'hud', 'stNo', 'stName', 'posBox', 'posNum', 'posOf', 'qual', 'board', 'prog', 'progFill', 'progTxt', 'timeTxt', 'speedNum', 'rpm', 'surfTxt', 'msg', 'count', 'wrong', 'title', 'intro', 'introBox', 'select', 'pause', 'results', 'help', 'touch', 'fade', 'loading', 'loadmsg', 'flash', 'letter', 'stage', 'ctrls', 'tbL', 'tbR', 'tbA', 'tbP', 'pzRetry', 'pzTitle', 'demoTag'].forEach((k) => { els[k] = $(k); });
  els.rpmI = els.rpm.querySelector('i');
  els.ctrls.innerHTML = '<span><span class="kb">↑</span>/<span class="kb">Space</span> アクセル</span><span><span class="kb">←</span><span class="kb">→</span> 左右</span><span><span class="kb">↓</span> ブレーキ</span><span><span class="kb">H</span> 操作説明</span><span><span class="kb">M</span> 音</span><span><span class="kb">F</span> 全画面</span>';
  els.help.innerHTML = '<div class="panel"><h3>あそびかた</h3>' +
    '<div><b>アクセルを押している間だけ加速</b>、離すと減速します。<kbd>↑</kbd> / <kbd>W</kbd> / <kbd>Space</kbd>（スマホは画面右側を押す）</div>' +
    '<div><kbd>←</kbd> <kbd>→</kbd>（スマホは左下のボタン）で左右に曲がって障害物をよける。<kbd>↓</kbd> でブレーキ</div>' +
    '<div><b>岩・倒木・切り株・サボテン</b>にスピードを出したまま当たるとクラッシュ。小石や丸太は乗り越えられますが減速します</div>' +
    '<div><b>空中でアクセル</b>を押すと前輪が上がり、離すと下がります。着地面に車体を合わせると<b>ナイス着地</b>で加速</div>' +
    '<div>泥・砂・水はスピードが落ちます。ラインを選んで避けると速い。2位以内でゴールすると次のステージへ</div>' +
    '<div style="margin-top:8px;font-size:17px;color:var(--dim)"><kbd>P</kbd> ポーズ　<kbd>R</kbd> リトライ　<kbd>Esc</kbd> タイトル　<kbd>M</kbd> サウンド　<kbd>F</kbd> 全画面　<kbd>Q</kbd> 画質（今: <span id="qlv"></span>）　<kbd>H</kbd> 閉じる</div></div>';
}
function setLoad(p, msg) { els.loadmsg.textContent = msg; els.loading.querySelector('#loadbar i').style.width = Math.round(p * 100) + '%'; }

// ---------- messages ----------
let msgQ = 0;
function showMsg(text, cls) {
  if (GAME.state === 'title') return;
  const d = document.createElement('span'); d.className = 'm ' + (cls || ''); d.textContent = text;
  els.msg.appendChild(d); msgQ++;
  while (els.msg.childNodes.length > 2) els.msg.removeChild(els.msg.firstChild);
  setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 1450);
}
function flash(a) { els.flash.style.transition = 'none'; els.flash.style.opacity = a; requestAnimationFrame(() => { els.flash.style.transition = 'opacity .45s'; els.flash.style.opacity = 0; }); }
function fade(on) { els.fade.classList.toggle('on', on); }

// ---------- HUD ----------
let hudT = 0, lastRank = 0;
function buildHudForStage() {
  els.stNo.textContent = STAGE_I + 1; els.stName.textContent = STAGE.name;
  els.prog.querySelectorAll('.pdot').forEach((d) => d.remove());
  for (const r of GAME.racers) { const d = document.createElement('div'); d.className = 'pdot' + (r.isPlayer ? ' me' : ''); d.style.background = hexCss(r.rd.col); els.prog.appendChild(d); r.dot = d; }
  els.board.innerHTML = '';
  for (let k = 0; k < GAME.racers.length; k++) { const d = document.createElement('div'); d.className = 'brow'; d.innerHTML = '<b></b><i class="sw"></i><span class="nm"></span><span class="gp"></span>'; els.board.appendChild(d); }
  els.posOf.textContent = '/' + GAME.racers.length;
}
function updateHUD(dt) {
  if (!CR) return;
  const p = GAME.player, st = GAME.state;
  const show = st === 'race' || st === 'countdown' || st === 'finish';
  els.hud.classList.toggle('on', show); els.stage.classList.toggle('play', show && !GAME.paused || st === 'intro');
  if (!show) return;
  hudT += dt;
  els.speedNum.textContent = Math.round(Math.max(0, p.spd) * 3.6);
  els.rpmI.style.width = Math.round(clamp(p.rpm, 0, 1) * 100) + '%';
  els.surfTxt.textContent = p.crash ? '' : (p.grounded ? SURF_NAME[p.surf] : 'AIR') + '  ' + p.gear + '速';
  els.timeTxt.textContent = fmtT(GAME.raceT);
  const rank = p.finished ? p.place : p.rank || 6;
  if (rank !== lastRank) { els.posNum.textContent = rank; els.posBox.classList.remove('bump'); void els.posBox.offsetWidth; els.posBox.classList.add('bump'); lastRank = rank; }
  els.posBox.classList.toggle('out', rank > 2);
  els.qual.textContent = rank <= 2 ? '✔ 次のステージへ進める順位' : '2位以内でゴールしよう';
  els.qual.className = 'sh ' + (rank <= 2 ? 'ok' : 'ng');
  // progress bar
  const L = CR.len;
  for (const r of GAME.racers) { if (r.dot) r.dot.style.left = (clamp(r.prog / L, 0, 1) * 100).toFixed(2) + '%'; }
  els.progFill.style.width = (clamp(p.prog / L, 0, 1) * 100).toFixed(2) + '%';
  els.progTxt.textContent = p.finished ? 'FINISH' : 'ゴールまで ' + Math.max(0, Math.round(L - p.prog)) + ' m';
  // standings (refresh 5x per second)
  if (hudT > 0.2 && GAME.order) {
    hudT = 0;
    const rows = els.board.children;
    GAME.order.forEach((r, k) => {
      const row = rows[k]; if (!row) return;
      row.className = 'brow' + (r.isPlayer ? ' me' : '') + (k === 1 ? ' cut' : '');
      row.children[0].textContent = k + 1; row.children[1].style.background = hexCss(r.rd.col); row.children[2].textContent = r.rd.name;
      let gp = '';
      if (r.finished) gp = fmtT(r.finishT);
      else if (!r.isPlayer) { const d = r.prog - p.prog; gp = (d >= 0 ? '+' : '−') + Math.abs(Math.round(d)) + 'm'; }
      row.children[3].textContent = gp;
    });
  }
  els.wrong.style.display = p.wrongT > 1.2 && st === 'race' ? 'block' : 'none';
}

// ---------- countdown ----------
function countdownShow(n) {
  els.count.innerHTML = '';
  const d = document.createElement('span'); d.className = 'c' + (n === 'GO!' ? ' go' : ''); d.textContent = n; els.count.appendChild(d);
}

// ---------- title / stage select ----------
let selI = 0;
function showTitle(on) { els.title.classList.toggle('off', !on); els.title.style.display = on ? 'block' : 'none'; }
function openSelect() {
  GAME.menu = 'select';
  selI = clamp(Math.min(SAVE.unlocked - 1, selI || SAVE.unlocked - 1), 0, STAGES.length - 1);
  showTitle(false);
  const cards = STAGES.map((st, i) => {
    const T = THEMES[st.theme], lock = i >= SAVE.unlocked, b = SAVE.best[i];
    const grad = `linear-gradient(160deg, ${hexCss(T.sky[1])}, ${hexCss(T.grass[0])} 70%, ${hexCss(T.trailCol)})`;
    const ai = stageAI(i), lvl = Math.round(((ai.vmul - 0.80) / 0.162) * 9) + 1;
    return `<div class="card${lock ? ' lock' : ''}${b && b.place <= 2 ? ' clr' : ''}" data-i="${i}"><div class="sw" style="background:${grad}"></div><div class="no">${i + 1}</div><div class="nm">${st.name}</div><div class="ds">${(st.len / 1000).toFixed(1)}km ・ ${st.desc}</div>` +
      `<div class="bt">${b ? 'BEST ' + b.place + '位 ' + fmtT(b.time) : ''}</div><div class="lv">敵 Lv.${lvl}</div></div>`;
  }).join('');
  els.select.innerHTML = `<div id="selBack">◀ タイトル</div><h2>ステージを選ぶ<small>2位以内でゴールすると次のステージが開きます</small></h2><div id="cards">${cards}</div><div id="selHint">←→↑↓ で選んで Enter / タップでスタート</div>`;
  els.select.style.display = 'block';
  els.select.querySelectorAll('.card').forEach((c) => {
    c.addEventListener('pointerdown', (e) => { e.stopPropagation(); const i = +c.dataset.i; if (i >= SAVE.unlocked) { AU.sfx('bump', 0.4); return; } selI = i; markSel(); startStage(i); });
  });
  $('selBack').addEventListener('pointerdown', (e) => { e.stopPropagation(); closeSelect(); });
  markSel();
}
function markSel() { els.select.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', +c.dataset.i === selI)); }
function closeSelect() { GAME.menu = null; els.select.style.display = 'none'; if (GAME.state === 'title') showTitle(true); }
function selectKey(code) {
  if (code === 'ArrowRight' || code === 'KeyD') selI = Math.min(SAVE.unlocked - 1, selI + 1);
  else if (code === 'ArrowLeft' || code === 'KeyA') selI = Math.max(0, selI - 1);
  else if (code === 'ArrowDown' || code === 'KeyS') selI = Math.min(SAVE.unlocked - 1, selI + 5);
  else if (code === 'ArrowUp' || code === 'KeyW') selI = Math.max(0, selI - 5);
  else if (code === 'Enter' || code === 'Space') { startStage(selI); return; }
  else if (code === 'Escape' || code === 'Backspace') { closeSelect(); return; }
  AU.sfx('ui', 0.5); markSel();
}

// ---------- intro card ----------
function showIntro(on) {
  if (on) {
    const ai = stageAI(STAGE_I), lvl = Math.round(((ai.vmul - 0.80) / 0.162) * 9) + 1;
    els.introBox.innerHTML = `<div class="k">STAGE ${STAGE_I + 1} / ${STAGES.length}</div><div class="n">${STAGE.name}</div><div class="d">${STAGE.en} ・ ${(STAGE.len / 1000).toFixed(1)} km ・ ${STAGE.desc}</div><div class="r">ライバル Lv.${lvl} ／ 2位以内で次のステージへ</div>`;
  }
  els.intro.classList.toggle('on', on); els.letter.classList.toggle('on', on);
}

// ---------- results ----------
let resBtns = [], resSel = 0;
function showResults() {
  GAME.state = 'results'; GAME.resultsT = 0;
  const fo = finalOrder(), p = GAME.player, place = p.place || fo.findIndex((e) => e.r === p) + 1;
  const pass = place <= 2, last = STAGE_I === STAGES.length - 1;
  if (pass) { SAVE.unlocked = Math.max(SAVE.unlocked, Math.min(STAGES.length, STAGE_I + 2)); }
  const b = SAVE.best[STAGE_I];
  if (!b || place < b.place || (place === b.place && p.finishT < b.time)) SAVE.best[STAGE_I] = { place, time: p.finishT };
  writeSave();
  const rows = fo.map((e, k) => `<div class="row${e.r.isPlayer ? ' me' : ''}${k < 2 ? ' q' : ''}"><b>${k + 1}</b><i class="sw" style="background:${hexCss(e.r.rd.col)}"></i><span class="nb">#${e.r.rd.num}</span><span class="nm">${e.r.rd.name}</span><span class="tm">${e.est ? '(' + fmtT(e.t) + ')' : fmtT(e.t)}</span></div>`).join('');
  let title, note, btns;
  if (pass && last) { title = '全ステージ制覇！'; note = `${place}位でフィニッシュ。グランドエンデューロ完走、おめでとう！`; btns = [['title', 'タイトルへ', true], ['retry', 'もう一度走る']]; }
  else if (pass) { title = place === 1 ? '優勝！' : '2位でクリア！'; note = `ステージ${STAGE_I + 2}「${STAGES[STAGE_I + 1].name}」が開きました。クラッシュ ${p.stats.crash}回 ・ ナイス着地 ${p.stats.nice}回`; btns = [['next', '次のステージへ', true], ['retry', 'リトライ'], ['select', 'ステージ選択']]; }
  else { title = place + '位 … 2位以内に入れず'; note = `クラッシュ ${p.stats.crash}回。岩や倒木を避け、泥や水の少ないラインを選ぶのがコツ。`; btns = [['retry', 'リトライ', true], ['select', 'ステージ選択']]; }
  els.results.innerHTML = `<div class="panel"><div class="hd"><h2 class="${pass ? 'ok' : 'ng'}">${title}</h2><span class="st">STAGE ${STAGE_I + 1} ${STAGE.name}</span></div>${rows}<div class="note">${note}</div><div class="btns">${btns.map((x, i) => `<button class="btn${x[2] ? ' pri' : ''}" data-a="${x[0]}" data-k="${i}">${x[1]}</button>`).join('')}</div></div>`;
  els.results.style.display = 'block';
  resBtns = Array.from(els.results.querySelectorAll('.btn')); resSel = 0; markRes();
  resBtns.forEach((bt) => bt.addEventListener('pointerdown', (e) => { e.stopPropagation(); resultAction(bt.dataset.a); }));
  AU.sfx(pass ? 'win' : 'lose', 0.9);
}
function markRes() { resBtns.forEach((b, i) => b.classList.toggle('sel', i === resSel)); }
function resultAction(a) {
  if (GAME.resultsT < 0.6) return;
  AU.sfx('ui', 0.6);
  els.results.style.display = 'none';
  if (a === 'next') startStage(Math.min(STAGES.length - 1, STAGE_I + 1));
  else if (a === 'retry') startStage(STAGE_I);
  else if (a === 'select') { enterTitle(); openSelect(); }
  else enterTitle();
}

// ---------- pause / help ----------
function setPaused(p) {
  if (GAME.state !== 'race' && GAME.state !== 'countdown') p = false;
  GAME.paused = p; els.pause.style.display = p ? 'block' : 'none';
  if (AU.ctx) { if (p) AU.ctx.suspend(); else AU.resume(); }
}
function toggleHelp() {
  const on = els.help.style.display !== 'block';
  els.help.style.display = on ? 'block' : 'none';
  const q = $('qlv'); if (q) q.textContent = ['低', '中', '高'][Q.level];
  if (GAME.state === 'race') setPaused(on);
}

// ---------- input ----------
let anyInput = false;
function onUserGesture() { if (!AU.started) AU.init(); AU.unhush(); AU.resume(); }
function goFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) return;
  try {
    const fs = el.requestFullscreen || el.webkitRequestFullscreen; if (!fs) return;
    const r = fs.call(el, { navigationUI: 'hide' });
    const lock = () => { try { const p = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (err) { /* optional */ } };
    if (r && r.then) r.then(lock, () => {}); else lock();
  } catch (err) { /* fullscreen is optional */ }
}
function initInput() {
  window.addEventListener('keydown', (e) => {
    onUserGesture();
    const c = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
    if (e.repeat && KEYS[c]) return;
    KEYS[c] = true;
    if (els.help.style.display === 'block' && (c === 'KeyH' || c === 'Escape' || c === 'Enter')) { toggleHelp(); return; }
    if (c === 'KeyM') { AU.setMuted(!AU.muted); return; }
    if (c === 'KeyF') { try { const d = document, el = d.documentElement; const r = !d.fullscreenElement ? (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el) : (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d); if (r && r.catch) r.catch(() => {}); } catch (err) { /* optional */ } return; }
    if (c === 'KeyQ') { Q.level = (Q.level + 2) % 3; applyQuality(); showMsg('画質: ' + ['低', '中', '高'][Q.level], 's'); return; }
    if (c === 'KeyH') { toggleHelp(); return; }
    if (GAME.menu === 'select') { selectKey(c); return; }
    const st = GAME.state;
    if (st === 'title') { if (!GAME.loading) { AU.sfx('ui', 0.6); openSelect(); } return; }
    if (st === 'results') {
      if (c === 'ArrowRight' || c === 'KeyD') { resSel = (resSel + 1) % resBtns.length; markRes(); AU.sfx('ui', 0.4); }
      else if (c === 'ArrowLeft' || c === 'KeyA') { resSel = (resSel + resBtns.length - 1) % resBtns.length; markRes(); AU.sfx('ui', 0.4); }
      else if (c === 'Enter' || c === 'Space') resultAction(resBtns[resSel].dataset.a);
      else if (c === 'Escape') resultAction('title');
      return;
    }
    if (c === 'KeyP' || (c === 'Escape' && !GAME.paused && (st === 'race' || st === 'countdown'))) { setPaused(!GAME.paused); return; }
    if (c === 'Escape' && GAME.paused) { setPaused(false); enterTitle(); return; }
    if (c === 'KeyR' && (st === 'race' || st === 'countdown' || st === 'finish')) { setPaused(false); startStage(STAGE_I); return; }
  });
  window.addEventListener('keyup', (e) => { KEYS[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; TOUCH.l = TOUCH.r = TOUCH.a = false; if (GAME.state === 'race' || GAME.state === 'countdown') setPaused(true); AU.hush(); });
  window.addEventListener('focus', () => AU.unhush());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (GAME.state === 'race' || GAME.state === 'countdown') setPaused(true); AU.hush(); }
    else AU.unhush();
  });
  window.addEventListener('pagehide', () => AU.hush());
  window.addEventListener('pageshow', () => AU.unhush());
  // phone back button while full screen only leaves full screen (the page stays visible): stop the sound until the next tap
  const fsExit = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement || !TOUCH.on) return;
    if (GAME.state === 'race' || GAME.state === 'countdown') setPaused(true);
    AU.hush('fs');
  };
  document.addEventListener('fullscreenchange', fsExit); document.addEventListener('webkitfullscreenchange', fsExit);
  // pointer / touch
  const st = els.stage;
  st.addEventListener('pointerdown', (e) => {
    onUserGesture();
    if (e.pointerType === 'touch') { if (!TOUCH.on) { TOUCH.on = true; st.classList.add('touch'); } goFullscreen(); }
    if (GAME.menu === 'select') return;
    if (GAME.state === 'title' && !GAME.loading) { AU.sfx('ui', 0.6); openSelect(); }
  });
  const bind = (el, key) => {
    const on = (v) => (e) => { e.preventDefault(); e.stopPropagation(); onUserGesture(); TOUCH[key] = v; el.classList.toggle('on', v); };
    el.addEventListener('pointerdown', on(true)); el.addEventListener('pointerup', on(false)); el.addEventListener('pointercancel', on(false)); el.addEventListener('pointerleave', on(false));
  };
  bind(els.tbL, 'l'); bind(els.tbR, 'r'); bind(els.tbA, 'a');
  els.tbP.addEventListener('pointerdown', (e) => { e.stopPropagation(); setPaused(!GAME.paused); });
  els.pause.addEventListener('pointerdown', (e) => { if (e.target === els.pause || e.target.classList.contains('pbox')) setPaused(false); });
  els.pzRetry.addEventListener('pointerdown', (e) => { e.stopPropagation(); setPaused(false); startStage(STAGE_I); });
  els.pzTitle.addEventListener('pointerdown', (e) => { e.stopPropagation(); setPaused(false); enterTitle(); });
  els.help.addEventListener('pointerdown', () => toggleHelp());
}
function pollGamepad() {
  let pads = []; try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { pads = []; }
  const gp = pads && Array.from(pads).find((p) => p && p.connected);
  if (!gp) { GP.thr = 0; GP.steer = 0; GP.brake = 0; return; }
  const btn = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4));
  const ax = gp.axes[0] || 0;
  GP.steer = Math.abs(ax) > 0.15 ? clamp(ax, -1, 1) : (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0);
  GP.thr = btn(0) || btn(7) ? 1 : 0; GP.brake = btn(1) || btn(6) ? 1 : 0;
  const prev = GP.btn; GP.btn = [btn(0), btn(9), btn(12), btn(13), btn(14), btn(15)];
  const press = (k) => GP.btn[k] && !prev[k];
  if (press(0) || press(1)) {
    onUserGesture();
    if (GAME.menu === 'select') selectKey('Enter');
    else if (GAME.state === 'title') openSelect();
    else if (GAME.state === 'results') resultAction(resBtns[resSel].dataset.a);
    else if (press(1)) setPaused(!GAME.paused);
  }
  if (GAME.menu === 'select') { if (press(4)) selectKey('ArrowLeft'); if (press(5)) selectKey('ArrowRight'); }
}

// ---------- quality ----------
function applyQuality() {
  const stageRect = els.stage.getBoundingClientRect(); const k = stageRect.width / W || 1;
  const dpr = window.devicePixelRatio || 1;
  const base = clamp(k * dpr, 0.6, 2);
  const pr = Math.min(base, [0.7, 1.0, 1.5][Q.level]);
  Q.pixelRatio = pr; renderer.setPixelRatio(pr); renderer.setSize(W, HGT, false);
  const sh = Q.level >= 1;
  if (Q._sh !== sh) { Q._sh = sh; Q.shadows = sh; renderer.shadowMap.enabled = sh; sun.castShadow = sh; scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); }); }
  const sz = Q.level >= 2 ? 2048 : 1024; if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
}
