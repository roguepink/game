// ===================== Views, lens drops, speed lines, tyre tracks, light in tunnels, sky traffic =====================
const VIEW = { mode: 0, names: ['うしろから', 'ひろく', 'ライダー目線'], dist: [4.2, 7.4], ht: [3.1, 4.5], fov: [49, 56], la: [14, 16] };
function setView(m) {
  VIEW.mode = ((m % 3) + 3) % 3; SAVE.view = VIEW.mode; writeSave(); CAM.cut = true;
  if (GAME.state === 'race' || GAME.state === 'countdown') showMsg('視点: ' + VIEW.names[VIEW.mode], 's');
}
// rider's-eye view: the camera rides on the bike and turns with it (flips included)
const _fpq = new THREE.Quaternion(), _fpy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), _fpx = new THREE.Quaternion(), _fpz = new THREE.Quaternion(), _fpv = new THREE.Vector3(), _ax = new THREE.Vector3();
const FPV = { y: 1.82, z: -0.26, pitch: -0.3, level: 0.55 };
function fpCam(r, dt) {
  const b = r.b; b.root.updateMatrixWorld(true);
  _fpv.set(0, FPV.y + r.stand * 0.2 - r.crouch * 0.1, FPV.z + r.stand * 0.08).applyMatrix4(b.root.matrixWorld);
  CAM.pos.copy(_fpv);
  // the head stays more level than the bike in a lean
  _fpq.copy(b.root.quaternion).multiply(_fpz.setFromAxisAngle(_ax.set(0, 0, 1), -FPV.level * (r.roll + r.whip * 0.75))).multiply(_fpy).multiply(_fpx.setFromAxisAngle(_ax.set(1, 0, 0), FPV.pitch));
  if (CAM.cut) camera.quaternion.copy(_fpq); else camera.quaternion.slerp(_fpq, 1 - Math.exp(-(r.trick ? 30 : 14) * dt));
  CAM.fov = CAM.cut ? 76 : damp(CAM.fov, 76 + Math.max(0, r.spd) * 0.2 + (r.boostT > 0 ? 7 : 0), 4, dt);
  if (r.grounded) CAM.shake = Math.max(CAM.shake, SP[r.surf].rough * clamp(r.spd / 30, 0, 1) * 0.1);
}
function fpVisible(r, fp) { const R = r.b.rider; if (R.fp === fp) return; R.fp = fp; R.helmet.visible = !fp; R.torso.visible = !fp; R.pelvis.visible = !fp; }

// ---------- lens: water drops and mud on the camera ----------
const LENS = { cv: null, g: null, drops: [], dirty: false };
function initLens() { LENS.cv = document.getElementById('lens'); LENS.g = LENS.cv ? LENS.cv.getContext('2d') : null; }
function lensSplash(kind, n) {
  if (!LENS.g || Q.level === 0) return;
  for (let i = 0; i < n && LENS.drops.length < 46; i++) {
    const mud = kind === 'mud';
    LENS.drops.push({ x: Math.random() * 640, y: Math.random() * 300, r: mud ? 5 + Math.random() * 13 : 4 + Math.random() * 10, vy: mud ? 2 + Math.random() * 6 : 14 + Math.random() * 40, life: mud ? 2.6 + Math.random() * 1.6 : 1.5 + Math.random() * 1.4, max: 0, mud, sq: 0.7 + Math.random() * 0.6 });
    LENS.drops[LENS.drops.length - 1].max = LENS.drops[LENS.drops.length - 1].life;
  }
}
function updateLens(dt) {
  const g = LENS.g; if (!g) return;
  if (!LENS.drops.length) { if (LENS.dirty) { g.clearRect(0, 0, 640, 360); LENS.dirty = false; } return; }
  g.clearRect(0, 0, 640, 360); LENS.dirty = true;
  for (let i = LENS.drops.length - 1; i >= 0; i--) {
    const d = LENS.drops[i]; d.life -= dt; if (d.life <= 0 || d.y > 380) { LENS.drops.splice(i, 1); continue; }
    d.y += d.vy * dt; const a = Math.min(1, d.life / (d.max * 0.45));
    if (d.mud) {
      g.fillStyle = `rgba(66,46,28,${0.78 * a})`; g.beginPath(); g.ellipse(d.x, d.y, d.r, d.r * d.sq, 0.4, 0, TAU); g.fill();
      g.fillStyle = `rgba(40,27,16,${0.6 * a})`; g.beginPath(); g.ellipse(d.x + d.r * 0.2, d.y + d.r * 0.15, d.r * 0.55, d.r * 0.5 * d.sq, 0, 0, TAU); g.fill();
    } else {
      const gr = g.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.x, d.y, d.r);
      gr.addColorStop(0, `rgba(255,255,255,${0.5 * a})`); gr.addColorStop(0.55, `rgba(200,225,240,${0.16 * a})`); gr.addColorStop(0.9, `rgba(30,50,60,${0.22 * a})`); gr.addColorStop(1, 'rgba(30,50,60,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(d.x, d.y, d.r * 0.85, d.r * (1 + d.vy * 0.004), 0, 0, TAU); g.fill();
    }
  }
}

// ---------- tyre tracks ----------
const TRK = { N: 110, mat: null };
function initTracks() {
  TRK.mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  TRK.mat.userData.shared = true;
  for (const r of GAME.racers) {
    const N = TRK.N, pos = new Float32Array(N * 2 * 3), idx = [];
    for (let i = 0; i < N - 1; i++) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
    const m = new THREE.Mesh(g, TRK.mat); m.frustumCulled = false; m.renderOrder = 1; scene.add(m);
    r.trk = { m, pos, lx: 0, lz: 0, open: false };
  }
}
function resetTracks() { for (const r of GAME.racers) if (r.trk) { r.trk.pos.fill(0); r.trk.open = false; r.trk.m.geometry.attributes.position.needsUpdate = true; } }
function trackPush(t, ax, ay, az, bx, by, bz) {
  const p = t.pos; p.copyWithin(0, 6);
  const o = p.length - 6; p[o] = ax; p[o + 1] = ay; p[o + 2] = az; p[o + 3] = bx; p[o + 4] = by; p[o + 5] = bz;
  t.m.geometry.attributes.position.needsUpdate = true;
}
const _tq = {};
function updateTrack(r) {
  const t = r.trk; if (!t) return;
  const on = r.grounded && !r.crash && r.surf !== SURF.WATER && Math.abs(r.spd) > 1.5 && !tunnelDark(r);
  const fx = Math.sin(r.psi), fz = Math.cos(r.psi), x = r.x - fx * 0.72, z = r.z - fz * 0.72;
  if (!on) { if (t.open) { trackPush(t, t.lx, t.ly, t.lz, t.lx, t.ly, t.lz); t.open = false; } return; }
  if (t.open && Math.hypot(x - t.lx, z - t.lz) < 0.7) return;
  queryLocal(x, z, r.q.i, 4, _tq);
  const hw = r.surf === SURF.MUD || r.surf === SURF.SAND ? 0.17 : 0.11, ax = x - fz * hw, az = z + fx * hw, bx = x + fz * hw, bz = z - fx * hw;
  const y = H(_tq.s, _tq.l, x, z, 2) + 0.05;
  if (!t.open) trackPush(t, x, y, z, x, y, z);
  trackPush(t, ax, y, az, bx, y, bz); t.lx = x; t.ly = y; t.lz = z; t.open = true;
}
function tunnelDark(r) { return CR.F.tunnels.length > 0 && !!tunnelAt(r.q.s); }

// ---------- per-frame screen effects ----------
const FX = { tun: 0, spd: 0, el: null, hemi0: 1, exp0: 1 };
function initFx() { FX.el = document.getElementById('speedfx'); initLens(); initTracks(); }
function updateFx(dt, dtv) {
  const tr = CAM.target || GAME.player, st = GAME.state, play = st === 'race' || st === 'countdown' || st === 'finish' || st === 'title';
  // eyes adjust inside tunnels: the tunnel goes dark, the way out glows
  const inT = tr && !tr.crash && tunnelDark(tr) ? 1 : 0;
  FX.tun = damp(FX.tun, inT, inT ? 3.5 : 2.2, dt);
  hemi.intensity = FX.hemi0 * (1 - 0.42 * FX.tun); renderer.toneMappingExposure = FX.exp0 * (1 + 0.6 * FX.tun);
  // speed lines
  const v = tr ? Math.max(0, tr.spd) : 0, want = play && tr && !tr.crash ? clamp((v - 25.5) / 7, 0, 1) * 0.3 + (tr.boostT > 0 ? 0.5 : 0) : 0;
  FX.spd = damp(FX.spd, want, 5, dt);
  if (FX.el) { const o = FX.spd < 0.02 ? 0 : Math.round(FX.spd * 50) / 50; if (o !== FX.elO) { FX.el.style.opacity = o; if ((o > 0) !== (FX.elO > 0)) FX.el.style.display = o > 0 ? 'block' : 'none'; FX.elO = o; } }
  if (dtv > 0) { for (const r of GAME.racers) { const dc = Math.hypot(r.x - camera.position.x, r.z - camera.position.z); if (dc < 130) updateTrack(r); } }
  updateLens(dt);
  updateSky(dt);
}

// ---------- sky traffic: a camera helicopter and balloons ----------
const SKY = { heli: null, rotor: null, tail: null, balloons: [] };
function buildSky(grp) {
  const R = mulberry32(STAGE.seed + 404);
  if (!SKY.geoH) {
    SKY.geoH = mergeParts([
      part(GEO.sphere, 0xe8e8e8, 0, 0, 0.3, 0, 0, 0, 0.75, 0.8, 1.5), part(GEO.sphere, 0x1c2a3a, 0, 0.1, 1.1, 0, 0, 0, 0.6, 0.55, 0.8),
      part(GEO.box, 0xd7262e, 0, 0.1, -1.9, 0, 0, 0, 0.22, 0.3, 2.6), part(GEO.box, 0xd7262e, 0, 0.55, -3.1, 0.5, 0, 0, 0.1, 0.9, 0.5),
      part(GEO.cyl, 0x333333, 0, 0.95, 0.2, 0, 0, 0, 0.09, 0.4, 0.09), part(GEO.box, 0x333333, 0.6, -0.95, 0.3, 0, 0, 0, 0.08, 0.08, 2.2), part(GEO.box, 0x333333, -0.6, -0.95, 0.3, 0, 0, 0, 0.08, 0.08, 2.2),
      part(GEO.sphereLo, 0x111111, 0, -0.75, 1.5, 0, 0, 0, 0.28, 0.28, 0.28),
    ]);
    SKY.geoR = mergeParts([part(GEO.box, 0x222222, 0, 0, 0, 0, 0, 0, 7.6, 0.05, 0.3), part(GEO.box, 0x222222, 0, 0, 0, 0, Math.PI / 2, 0, 7.6, 0.05, 0.3)]);
    SKY.geoB = mergeParts([
      part(GEO.sphere, 0xff7a1a, 0, 3.2, 0, 0, 0, 0, 2.6, 3.1, 2.6), part(GEO.sphere, 0xf4f4f0, 0, 3.2, 0, 0, 0, 0, 2.63, 1.0, 2.63), part(GEO.cone, 0xff7a1a, 0, 0.7, 0, Math.PI, 0, 0, 1.5, 1.8, 1.5),
      part(GEO.box, 0x6a4a2a, 0, -0.9, 0, 0, 0, 0, 0.8, 0.7, 0.8),
    ]);
    SKY.mat = new THREE.MeshLambertMaterial({ vertexColors: true }); SKY.mat.userData.shared = true;
    for (const k of ['geoH', 'geoR', 'geoB']) SKY[k].userData = { shared: true };
  }
  const h = new THREE.Group(), body = new THREE.Mesh(SKY.geoH, SKY.mat), rot = new THREE.Mesh(SKY.geoR, SKY.mat);
  body.userData.sharedGeo = true; rot.userData.sharedGeo = true; rot.position.y = 1.2; h.add(body, rot); grp.add(h);
  SKY.heli = h; SKY.rotor = rot; SKY.hp = null;
  SKY.balloons.length = 0;
  if (!THEME.lava) for (let k = 0; k < 4; k++) {
    const s = CR.sStart + (k + 0.5) / 4 * CR.len, fr = frameAt(s, {}), l = (R() < 0.5 ? -1 : 1) * (120 + R() * 220), m = new THREE.Mesh(SKY.geoB, SKY.mat);
    m.userData.sharedGeo = true; const sc = 2 + R() * 1.6; m.scale.setScalar(sc); m.position.set(fr.x + fr.rx * l, fr.y + 60 + R() * 70, fr.z + fr.rz * l); grp.add(m); SKY.balloons.push({ m, y: m.position.y, ph: R() * 6 });
  }
}
const _hv = new THREE.Vector3();
function updateSky(dt) {
  const h = SKY.heli; if (!h || !CR) return;
  const lead = GAME.order && GAME.order.length ? (GAME.order.find((r) => !r.finished) || GAME.order[0]) : GAME.player;
  const s = Math.min(CR.L - 5, lead.q.s + 85), fr = frameAt(s, _tq), side = Math.sin(GAME.t * 0.13) * 14;
  _hv.set(fr.x + fr.rx * side, fr.y + 17 + Math.sin(GAME.t * 0.7) * 1.5, fr.z + fr.rz * side);
  if (!SKY.hp) { SKY.hp = true; h.position.copy(_hv); } else h.position.lerp(_hv, 1 - Math.exp(-0.9 * dt));
  h.rotation.set(0.12, Math.atan2(lead.x - h.position.x, lead.z - h.position.z), Math.sin(GAME.t * 0.5) * 0.06, 'YXZ');
  SKY.rotor.rotation.y += dt * 38;
  for (const b of SKY.balloons) b.m.position.y = b.y + Math.sin(GAME.t * 0.25 + b.ph) * 2.5;
}
