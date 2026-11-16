// ===================== Moving things: debris, rolling boulders, geysers, birds, tumbleweeds =====================
const DYN = { debris: null, deb: [], rolls: [], geysers: [], birds: [], weeds: [], heli: null };
const _dm = new THREE.Object3D(), _dc = new THREE.Color();

// ---------- debris (one instanced mesh for all flying bits) ----------
function initDebris() {
  const N = 72, im = new THREE.InstancedMesh(GEO.box, new THREE.MeshLambertMaterial({ vertexColors: false }), N);
  im.frustumCulled = false; im.castShadow = true; im.userData.sharedGeo = true;
  for (let i = 0; i < N; i++) { _dm.scale.setScalar(0); _dm.updateMatrix(); im.setMatrixAt(i, _dm.matrix); im.setColorAt(i, _dc.setRGB(1, 1, 1)); DYN.deb.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, sx: 1, sy: 1, sz: 1, hint: 0 }); }
  DYN.debris = im; DYN.head = 0; scene.add(im);
}
function spawnDebris(x, y, z, n, hex, vx, vz, sx, sy, sz, hint) {
  const c = lc(hex);
  for (let k = 0; k < n; k++) {
    const i = DYN.head; DYN.head = (DYN.head + 1) % DYN.deb.length; const d = DYN.deb[i];
    d.life = 2.2 + Math.random(); d.x = x + (Math.random() - 0.5) * 1.2; d.y = y + Math.random() * 1.2; d.z = z + (Math.random() - 0.5) * 1.2;
    d.vx = vx * (0.4 + Math.random() * 0.6) + (Math.random() - 0.5) * 5; d.vy = 3 + Math.random() * 5; d.vz = vz * (0.4 + Math.random() * 0.6) + (Math.random() - 0.5) * 5;
    d.rx = Math.random() * 6; d.ry = Math.random() * 6; d.rz = Math.random() * 6; d.wx = (Math.random() - 0.5) * 14; d.wy = (Math.random() - 0.5) * 14; d.wz = (Math.random() - 0.5) * 14;
    const v = 0.7 + Math.random() * 0.6; d.sx = sx * v; d.sy = sy * v; d.sz = sz * v; d.hint = hint || 0;
    DYN.debris.setColorAt(i, _dc.copy(c).multiplyScalar(0.8 + Math.random() * 0.4));
  }
  if (DYN.debris.instanceColor) DYN.debris.instanceColor.needsUpdate = true;
}
const _dq = {};
function updateDebris(dt) {
  const im = DYN.debris; if (!im) return; let any = false;
  for (let i = 0; i < DYN.deb.length; i++) {
    const d = DYN.deb[i]; if (d.life <= 0) continue; any = true;
    d.life -= dt; d.vy -= GRAV * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt;
    queryLocal(d.x, d.z, d.hint, 12, _dq); d.hint = _dq.i;
    const gy = H(_dq.s, _dq.l, d.x, d.z, 2) + d.sy * 0.5;
    if (d.y < gy) { d.y = gy; d.vy = Math.abs(d.vy) * 0.3; d.vx *= 0.6; d.vz *= 0.6; d.wx *= 0.5; d.wy *= 0.5; d.wz *= 0.5; }
    const k = d.life > 0 ? Math.min(1, d.life * 3) : 0;
    _dm.position.set(d.x, d.y, d.z); _dm.rotation.set(d.rx, d.ry, d.rz); _dm.scale.set(d.sx * k, d.sy * k, d.sz * k); _dm.updateMatrix(); im.setMatrixAt(i, _dm.matrix);
  }
  if (any || DYN.dirty) { im.instanceMatrix.needsUpdate = true; DYN.dirty = any; }
}

// ---------- rolling boulders ----------
function rollL(d, t) {   // lateral position, or null while it is out of play
  const u = (((t + d.ph) % d.P) + d.P) % d.P / d.P; if (u > 0.72) return null;
  return d.dir * lerp(-d.ext, d.ext, u / 0.72);
}
function buildDynamic(grp) {
  DYN.rolls.length = 0; DYN.geysers.length = 0; DYN.birds.length = 0; DYN.weeds.length = 0;
  const T = THEME, R = mulberry32(STAGE.seed * 17 + 5), fr = {};
  const rmat = new THREE.MeshLambertMaterial({ color: lc(T.rock[0]).lerp(lc(T.rock[1]), 0.4), map: TEX.ground });
  const warn = CR.F.dyn.some((d) => d.kind === 'roll') ? signTex(['落石', '注意'], '#f2c21a', '#1a1a1a') : null;
  const gwarn = CR.F.dyn.some((d) => d.kind === 'geyser') ? signTex(['間欠泉'], '#f2c21a', '#1a1a1a', 256, 96) : null;
  let lastSign = -1e9;
  for (const d of CR.F.dyn) {
    if (d.kind === 'roll') {
      frameAt(d.s, fr); d.ext = fr.w + 10;
      const m = new THREE.Mesh(rockGeo(d.k), rmat); m.userData.sharedGeo = true; m.castShadow = true; m.scale.set(d.r * 1.1, d.r * 1.35, d.r * 1.1); grp.add(m); d.mesh = m; d.ax = new THREE.Vector3(fr.tx, 0, fr.tz); d.ang = 0;
      DYN.rolls.push(d);
      if (d.s - lastSign > 80) { for (const sd of [-1, 1]) addSign(grp, d.s - 55, sd, warn, 1.8, 1.1); lastSign = d.s; }
    } else if (d.kind === 'geyser') {
      const p = worldAt(d.s, d.l); d.x = p.x; d.z = p.z; d.y = H(d.s, d.l, p.x, p.z, 2);
      const parts = []; for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; parts.push(part(rockGeo(k % 6, 0), 0x3a3634, d.x + Math.cos(a) * 1.25, d.y + 0.05, d.z + Math.sin(a) * 1.25, 0, a, 0, 0.42, 0.3, 0.42)); }
      parts.push(part(GEO.cyl, 0x1a1816, d.x, d.y + 0.03, d.z, 0, 0, 0, 1.15, 0.06, 1.15));
      partsMesh(grp, parts, null, d.s); DYN.geysers.push(d);
      if (d.s - lastSign > 60) { for (const sd of [-1, 1]) addSign(grp, d.s - 45, sd, gwarn, 1.8, 0.7); lastSign = d.s; }
    }
  }
  // tumbleweeds on the dry stages
  if (T.veg.dry > 0.9 && T.veg.pine === 0) {
    const wmat = new THREE.MeshLambertMaterial({ color: lc(0x9a8456), wireframe: true });
    for (let k = 0; k < 7; k++) { const m = new THREE.Mesh(GEO.ico1, wmat); m.userData.sharedGeo = true; grp.add(m); DYN.weeds.push({ m, s: 0, l: 0, v: 0, r: 0.5 + R() * 0.35, on: false, ang: 0 }); }
  }
  // flocks of birds resting by the trail
  if (!T.lava) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, 0, 0, -0.18, 0.55, 0.06, -0.05, 0, 0, 0.18, -0.55, 0.06, -0.05, 0, 0, -0.18], 3)); g.computeVertexNormals();
    const bm = new THREE.MeshBasicMaterial({ color: T.snowY !== null ? 0x2a2a2e : 0x1e1e22, side: THREE.DoubleSide });
    DYN.birdGeo = g; g.__own = true;
    for (let f = 0; f < 3; f++) { const fl = { s: 0, l: 0, state: 0, t: 0, b: [] }; for (let k = 0; k < 7; k++) { const m = new THREE.Mesh(g, bm); m.userData.sharedGeo = true; grp.add(m); fl.b.push({ m, ox: (R() - 0.5) * 5, oz: (R() - 0.5) * 5, vx: 0, vy: 0, vz: 0, ph: R() * 6 }); } DYN.birds.push(fl); placeFlock(fl, CR.sStart + 260 + f * 240); }
  }
}
function placeFlock(fl, s) {
  s = Math.min(s, CR.sFin - 60); const w = wAtS(s), sd = Math.random() < 0.5 ? -1 : 1; fl.s = s; fl.l = sd * (w - 1.5 - Math.random() * 2); fl.state = 0; fl.t = 0;
  const p = worldAt(s, fl.l), fr = frameAt(s, {});
  for (const b of fl.b) { const x = p.x + b.ox, z = p.z + b.oz; queryLocal(x, z, Math.round(s / CR.ds), 8, _dq); b.m.position.set(x, H(_dq.s, _dq.l, x, z, 2) + 0.12, z); b.m.rotation.set(0, fr.psi + b.ph, 0); b.m.scale.set(0.5, 1, 1); b.m.visible = true; }
}
function updateDynamic(dt, t) {
  updateDebris(dt);
  // boulders
  for (const d of DYN.rolls) {
    const l = rollL(d, GAME.t), m = d.mesh;
    if (l === null) { m.visible = false; d.l = null; continue; }
    const p = worldAt(d.s, l), y = H(d.s, l, p.x, p.z, 2);
    if (d.l !== null && d.l !== undefined) d.ang += (l - d.l) / d.r;
    d.l = l; d.x = p.x; d.z = p.z; d.y = y; m.visible = true; m.position.set(p.x, y + d.r * 0.85, p.z); m.quaternion.setFromAxisAngle(d.ax, -d.ang);
    if (Math.random() < dt * 12 && Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < 120) { const dc = dustCol(SURF.DIRT); PS.dust.emit(p.x, y + 0.3, p.z, (Math.random() - 0.5) * 2, 0.6, (Math.random() - 0.5) * 2, 1.2, 0.8, 2.6, dc[0], dc[1], dc[2], 0.3, 0, 1.4); }
  }
  // geysers
  for (const d of DYN.geysers) {
    const u = (((GAME.t + d.ph) % d.P) + d.P) % d.P / d.P; d.on = u < 0.42; d.pre = u > 0.9;
    const near = Math.hypot(d.x - camera.position.x, d.z - camera.position.z) < 150;
    if (!near) continue;
    if (d.on) { const n = Math.floor(dt * 46 + Math.random()); for (let i = 0; i < n; i++) PS.mist.emit(d.x + (Math.random() - 0.5) * 0.8, d.y + 0.3, d.z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.6, 9 + Math.random() * 6, (Math.random() - 0.5) * 1.6, 0.9 + Math.random() * 0.5, 1.0, 3.6, 0.95, 0.96, 0.97, 0.5, 6, 0.4); }
    else if (d.pre && Math.random() < dt * 20) PS.mist.emit(d.x, d.y + 0.2, d.z, (Math.random() - 0.5), 1.5, (Math.random() - 0.5), 0.6, 0.5, 1.4, 0.95, 0.96, 0.97, 0.35, 0, 1);
  }
  // tumbleweeds blow across in front of the leader
  if (DYN.weeds.length && GAME.order) {
    const lead = CAM.target || GAME.player;
    for (const w of DYN.weeds) {
      if (!w.on) { if (Math.random() < dt * 0.25) { w.on = true; w.s = Math.min(CR.sFin - 20, lead.q.s + 50 + Math.random() * 90); w.dir = Math.random() < 0.5 ? -1 : 1; w.l = -w.dir * (wAtS(w.s) + 16); w.v = 4 + Math.random() * 4; } else { w.m.visible = false; continue; } }
      w.l += w.dir * w.v * dt; w.s += dt * 1.2; w.ang += w.v / w.r * dt;
      if (Math.abs(w.l) > wAtS(w.s) + 18 || w.s < lead.q.s - 30) { w.on = false; w.m.visible = false; continue; }
      const p = worldAt(w.s, w.l), y = H(w.s, w.l, p.x, p.z, 2), hop = Math.abs(Math.sin(w.ang * 0.35)) * 0.5;
      w.m.visible = true; w.m.position.set(p.x, y + w.r + hop, p.z); w.m.scale.setScalar(w.r); w.m.rotation.set(w.ang, w.dir * 0.4, w.ang * 0.3);
    }
  }
  // birds: fly off when a bike comes close, settle again further up the trail
  for (const fl of DYN.birds) {
    if (fl.state === 0) {
      let hit = null; for (const r of GAME.racers) { const ds = fl.s - r.q.s; if (ds > -2 && ds < 30 + r.spd * 0.4) { hit = r; break; } }
      if (hit) { fl.state = 1; fl.t = 0; const fr = frameAt(fl.s, {}), sd = Math.sign(fl.l) || 1; for (const b of fl.b) { b.vx = fr.rx * sd * (4 + Math.random() * 5) + fr.tx * (3 + Math.random() * 4); b.vz = fr.rz * sd * (4 + Math.random() * 5) + fr.tz * (3 + Math.random() * 4); b.vy = 4 + Math.random() * 4; } }
    } else {
      fl.t += dt;
      for (const b of fl.b) { const m = b.m; m.position.x += b.vx * dt; m.position.y += b.vy * dt; m.position.z += b.vz * dt; b.vy = Math.max(1.2, b.vy - dt * 0.8); m.rotation.y = Math.atan2(b.vx, b.vz); m.scale.x = 0.35 + 0.65 * Math.abs(Math.sin(fl.t * 14 + b.ph)); }
      if (fl.t > 9) { let lead = 0; for (const r of GAME.racers) lead = Math.max(lead, r.q.s); if (lead + 200 < CR.sFin - 60) placeFlock(fl, lead + 160 + Math.random() * 260); else { for (const b of fl.b) b.m.visible = false; fl.state = 2; } }
    }
  }
}
// bikes against the moving hazards
function collideDynamic(r) {
  if (r.ghost > 0) return;
  for (const d of DYN.rolls) {
    if (d.l === null || d.l === undefined || Math.abs(d.s - r.q.s) > d.r + 1.2) continue;
    if (Math.hypot(d.s - r.q.s - 0.3, d.l - r.q.l) > d.r + 0.5 || r.y > d.y + d.r * 1.7) continue;
    if (r.hitCD.has(d)) continue; r.hitCD.set(d, GAME.t); r.stats.hits++;
    if (r.spd > 8) { crash(r, 'obj', { type: 'rolling', l: d.l }); if (r.isPlayer) showMsg('落石に当たった！', 'bad'); return; }
    r.spd *= 0.4; r.wobble = 0.8; AU.sfx('bump', soundVol(r));
  }
  for (const d of DYN.geysers) {
    if (!d.on || !r.grounded || Math.abs(d.s - r.q.s) > 1.8 || Math.abs(d.l - r.q.l) > 1.5) continue;
    r.grounded = false; r.airT = 0.01; r.vy = 10.5; r.y += 0.1; r.style += 100;
    if (r.isPlayer) { showMsg('間欠泉でジャンプ！', 'good'); CAM.shake = Math.max(CAM.shake, 0.6); } AU.sfx('splash', soundVol(r) * 0.7);
  }
}
