// ===================== Main: flow, loop, boot =====================
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const tick = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
let DEMO_I = -1;

async function loadStage(i, demo, noFade) {
  GAME.loading = true;
  if (!noFade) { fade(true); await sleep(380); }
  buildCourse(i);
  buildWorld();
  FOGU.fogCol.value.set(THEME.fog[0]); FOGU.fogNear.value = scene.fog.near; FOGU.fogFar.value = scene.fog.far;
  setupRacers(demo);
  buildHudForStage();
  PS.dust.clear(); PS.grit.clear(); PS.mist.clear(); PS.fire.clear();
  CAM.cut = true; CAM.shot = null; CAM.target = GAME.player; CAM.shake = 0;
  GAME.raceT = 0; GAME.finT = 0; GAME.resultsT = 0;
  rankRacers();
  GAME.loading = false;
}
function demoPlace() {
  // drop the pack somewhere interesting along the course, already at speed
  const R = Math.random, cand = CR.marks.filter((m) => m.s > CR.sStart + 250 && m.s < CR.sFin - 400);
  const m = cand.length ? cand[Math.floor(R() * cand.length)] : { s: CR.sStart + 300 };
  const s0 = m.s - 70;
  GAME.racers.forEach((r, k) => { const w = wAtS(s0); placeRacer(r, s0 - k * 7 - R() * 4, (R() - 0.5) * (w - 2), 18 + R() * 4); r.ai.lane = r.q.l; });
  GAME.raceT = 0;
}
async function enterTitle(first) {
  GAME.menu = null; els.select.style.display = 'none'; els.results.style.display = 'none'; els.help.style.display = 'none';
  GAME.paused = false; els.pause.style.display = 'none'; showIntro(false);
  GAME.state = 'loading';
  DEMO_I = first ? 0 : (DEMO_I + 1 + Math.floor(Math.random() * 3)) % STAGES.length;
  await loadStage(DEMO_I, true, !!first);
  demoPlace();
  GAME.state = 'title'; GAME.demoT = 0; showTitle(true); fade(false);
}
async function startStage(i) {
  if (GAME.loading) return;
  GAME.menu = null; els.select.style.display = 'none'; els.results.style.display = 'none';
  GAME.paused = false; els.pause.style.display = 'none';
  showTitle(false);
  GAME.state = 'loading';
  await loadStage(i, false);
  GAME.state = 'intro'; GAME.introT = 0; showIntro(true); fade(false);
  AU.sfx('cheer', 0.5);
}
function onPlayerFinish() {
  GAME.state = 'finish'; GAME.finT = 0; GAME.player.auto = true;
  const pl = GAME.player.place;
  showMsg('FINISH  ' + pl + '位', pl <= 2 ? 'good' : 'bad');
  AU.sfx('cheer', 1);
}

function simStep(dt) {
  GAME.t += dt;
  const st = GAME.state;
  if (st === 'title') {
    GAME.demoT += dt; GAME.raceT += dt; updateRace(dt);
    const lead = GAME.order && GAME.order[0];
    if (!GAME.loading && !GAME.menu && (GAME.demoT > 80 || (lead && lead.finished && GAME.demoT > 8))) enterTitle(false);
  } else if (st === 'intro') {
    GAME.introT += dt; updateRace(dt);
    if (GAME.introT > 3.4) { GAME.state = 'countdown'; GAME.countT = 3.0; showIntro(false); countdownShow(3); AU.sfx('count', 0.9); }
  } else if (st === 'countdown') {
    const a = Math.ceil(GAME.countT); GAME.countT -= dt; const b2 = Math.ceil(GAME.countT);
    if (GAME.countT <= 0) { GAME.state = 'race'; GAME.raceT = 0; countdownShow('GO!'); AU.sfx('go', 1); setTimeout(() => { if (GAME.state !== 'countdown') els.count.innerHTML = ''; }, 900); }
    else if (b2 !== a) { countdownShow(b2); AU.sfx('count', 0.9); }
    updateRace(dt);
  } else if (st === 'race') { GAME.raceT += dt; updateRace(dt); }
  else if (st === 'finish') { GAME.raceT += dt; GAME.finT += dt; updateRace(dt); if (GAME.finT > 4.2) showResults(); }
  else if (st === 'results') { GAME.resultsT += dt; GAME.raceT += dt; updateRace(dt); }
}

// ---------- audio mix ----------
const _cr = new THREE.Vector3();
function updateAudio(dt) {
  if (!AU.ctx) return;
  const cam = camera.position, tgt = CAM.target || GAME.player;
  _cr.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const live = GAME.state !== 'loading' && !GAME.paused;
  for (const r of GAME.racers) {
    if (!r.engine) r.engine = AU.makeEngine();
    if (!r.engine) continue;
    const dx = r.x - cam.x, dz = r.z - cam.z, d = Math.hypot(dx, dz);
    let vol = r === tgt ? 1 : clamp(1 - d / 120, 0, 1) * 0.55;
    if (r.crash) vol *= 0.4;
    if (GAME.state === 'title') vol *= 0.55;
    const pan = d > 0.5 ? (dx * _cr.x + dz * _cr.z) / d : 0;
    const load = r.grounded && (r.surf === SURF.MUD || r.surf === SURF.SAND || r.surf === SURF.WATER) ? 1 : 0.3;
    // doppler for bikes passing the camera (the camera rides with the target bike)
    let dopp = 1;
    if (r !== tgt && d > 1) { const vr = ((r.vx - tgt.vx) * -dx + (r.vz - tgt.vz) * -dz) / d; dopp = clamp(343 / (343 - vr), 0.88, 1.12); }
    AU.updateEngine(r.engine, r.rpm, r.crash ? 0 : r.inp.thr, live ? vol : 0, r === tgt ? 0 : pan * 0.9, load, r.gear, dopp, r === tgt ? 0 : d);
  }
  // decel crackle
  // decel burble: a few pops when the throttle closes at high revs
  if (tgt) { if (tgt.inp.thr > 0) tgt.popT = 0.9; else tgt.popT = Math.max(0, (tgt.popT || 0) - dt); }
  if (live && tgt && !tgt.crash && tgt.inp.thr === 0 && tgt.rpm > 0.4 && tgt.popT > 0 && Math.random() < dt * 14) AU.sfx('pop', 0.55 * tgt.popT);
  const crowdD = Math.min(Math.abs(tgt.q.s - CR.sStart - 10), Math.abs(tgt.q.s - CR.sFin - 10));
  AU.updateLoops({ spd: tgt.crash ? 0 : Math.abs(tgt.spd), surf: tgt.surf, grounded: tgt.grounded && !tgt.crash, air: !tgt.grounded, vol: live ? (GAME.state === 'title' ? 0.5 : 1) : 0, crowd: 1 - smooth(20, 90, crowdD) });
}

// ---------- loop ----------
let lastT = 0, emaDt = 16.7, qTimer = 0, tAbs = 0;
function frameUpdate(dt) {
  tAbs += dt;
  const dtv = GAME.paused ? 0 : dt * GAME.timeScale;
  if (CR) {
    updateCamera(dt);
    for (const r of GAME.racers) { updateBikeVisual(r, dtv, tAbs); if (dtv > 0) emitForRacer(r, dtv); }
    const scale = (HGT * Q.pixelRatio) / (2 * Math.tan(camera.fov * Math.PI / 360));
    PS.dust.update(dtv, scale, WIND); PS.grit.update(dtv, scale); PS.mist.update(dtv, scale, WIND); PS.fire.update(dtv, scale); if (dtv > 0) updateRings(dtv);
    updateScenery(dtv, tAbs); if (dtv > 0) updateDynamic(dtv, tAbs);
    cullChunks(camera.position);
    cullInstances(camera.position, CAM.target ? CAM.target.b.root.position : null);
  }
  updateHUD(dt);
  updateAudio(dt);
}
let lastFrameWall = 0;
function frame(now) {
  requestAnimationFrame(frame);
  lastFrameWall = performance.now(); if (AU.hushed && AU.hushWhy === 'stall') AU.unhush();
  if (window.__freeze) return;
  if (!lastT) lastT = now;
  const dt = Math.min(0.05, Math.max(0.0001, (now - lastT) / 1000)); lastT = now;
  emaDt = emaDt * 0.95 + dt * 1000 * 0.05;
  qTimer += dt; if (qTimer > 4) { qTimer = 0; if (emaDt > 34 && Q.level > 0 && !GAME.loading) { Q.level--; applyQuality(); emaDt = 20; } }
  pollGamepad();
  if (!GAME.paused && !GAME.loading) {
    let rem = dt * GAME.timeScale, n = 0;
    while (rem > 1e-5 && n < 5) { const h = Math.min(rem, 1 / 60); simStep(h); rem -= h; n++; }
  }
  frameUpdate(dt);
  if (CR) renderer.render(scene, camera);
}

async function boot() {
  try { await boot2(); } catch (e) { console.error(e); const m = document.getElementById('loadmsg'); if (m) m.textContent = 'うまく起動できませんでした（WebGL が使えない可能性があります）: ' + (e && e.message ? e.message : e); }
}
async function boot2() {
  initDom(); loadSave();
  setLoad(0.08, '準備中…'); await tick();
  initGL(els.gl);
  makeTextures(); bikeMaterials(); buildSharedGeos();
  PS.dust = new Particles(2400, TEX.puff, scene); PS.grit = new Particles(2600, TEX.drop, scene); PS.mist = new Particles(500, TEX.soft, scene); PS.fire = new Particles(900, TEX.soft, scene, true); initDebris();
  setLoad(0.3, 'バイクを整備中…'); await tick();
  for (let i = 0; i < RIDERS.length; i++) GAME.racers.push(createRacer(i));
  GAME.player = GAME.racers[0];
  initInput();
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (coarse) Q.level = 1;
  if (window.__lowq) Q.level = 0;
  setLoad(0.5, 'コースを生成中…'); await tick();
  await enterTitle(true);
  applyQuality();
  window.addEventListener('resize', () => { applyQuality(); });
  for (let i = 0; i < 4; i++) simStep(1 / 60);
  frameUpdate(1 / 60); renderer.render(scene, camera);
  setLoad(1, 'スタート'); await tick();
  els.loading.style.transition = 'opacity .5s'; els.loading.style.opacity = 0; setTimeout(() => { els.loading.style.display = 'none'; }, 520);
  requestAnimationFrame(frame);
  // if the page stops drawing (closed, sent to the background, screen off) cut the sound right away
  setInterval(() => { if (lastFrameWall && performance.now() - lastFrameWall > 1000) AU.hush('stall'); }, 250);
  window.__g = {
    GAME, CAM, KEYS, TOUCH, camera, scene, renderer, Q, PS, AU, SAVE, STAGES,
    get CR() { return CR; }, CR_DBG, get THEME() { return THEME; },
    stepN(n) { for (let i = 0; i < n; i++) simStep(1 / 60); },
    stepDt(h, n) { for (let i = 0; i < n; i++) simStep(h); },
    shot() { frameUpdate(1 / 60); renderer.render(scene, camera); },
    fu(dt) { frameUpdate(dt || 1 / 60); },
    startStage, enterTitle, loadStage, placeRacer, respawn, crash, worldAt, frameAt, H, waterY, surfAt, openSelect, showResults, finalOrder, setupRacers, demoPlace,
  };
}
boot();
