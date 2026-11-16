// ===================== Camera: chase cam + demo/broadcast director =====================
const CAM = { target: null, yaw: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), shake: 0, fov: 64, shot: null, shotT: 0, cut: true, lookY: 0 };
const _cv = new THREE.Vector3(), _cl = new THREE.Vector3(), _cq2 = {};
function camGround(x, z, hint) { queryLocal(x, z, hint, 30, _cq2); if (_cq2.d > 400) queryGlobal(x, z, _cq2); return H(_cq2.s, _cq2.l, x, z, true); }
function dampAngle(a, b, k, dt) { return a + wrapPi(b - a) * (1 - Math.exp(-k * dt)); }
function targetPos(r, out) { if (r.crash) return out.copy(r.b.rider.grp.position); return out.set(r.x, r.y, r.z); }

function chaseCam(r, dt, o) {
  o = o || {};
  const spd = Math.max(0, r.spd);
  let yawT = r.psi;
  if (!r.crash && spd > 4) yawT = dampAngle(r.psi, Math.atan2(r.vx, r.vz), 1, 0.5);
  if (r.crash) yawT = CAM.yaw;
  CAM.yaw = CAM.cut ? yawT : dampAngle(CAM.yaw, yawT, 4.2, dt);
  const fx = Math.sin(CAM.yaw), fz = Math.cos(CAM.yaw);
  // wide view at the start, in the air and in a crash; tight and close while riding
  // (only real jumps count: small hops over rocks keep the tight view)
  const air = !r.grounded && r.airT > 0.35 && r.y - r.gh > 1.0, start = GAME.state === 'countdown' || (GAME.state === 'race' && GAME.raceT < 2.5);
  const wantW = r.crash ? 0.7 : start ? 1 : air ? clamp((r.airT - 0.35) * 2.5, 0, 0.85) : 0;
  CAM.wide = CAM.cut ? wantW : damp(CAM.wide || 0, wantW, wantW > (CAM.wide || 0) ? 2.4 : 2.2, dt);
  const Wd = CAM.wide;
  const dist = (o.dist || lerp(4.2, 6.0, Wd)) + clamp(spd, 0, 32) * 0.02, ht = (o.ht || lerp(3.1, 3.0, Wd)) + spd * 0.006;
  targetPos(r, _cl);
  _cv.set(_cl.x - fx * dist, 0, _cl.z - fz * dist);
  // follow the rider's height loosely so jumps read as jumps
  CAM.lookY = CAM.cut ? _cl.y : damp(CAM.lookY, _cl.y, r.grounded ? 9 : 3.2, dt);
  _cv.y = CAM.lookY + ht;
  const g = camGround(_cv.x, _cv.z, r.q.i) + 1.1; if (_cv.y < g) _cv.y = g;
  // inside a tunnel the camera stays under the roof
  let roof = 1e9; if (CR.F.tunnels.length && tunnelAt(_cq2.s)) roof = yAtS(_cq2.s) + tunnelArch(_cq2.l, wAtS(_cq2.s)) - 1.0;
  if (_cv.y > roof) _cv.y = roof;
  if (CAM.cut) CAM.pos.copy(_cv); else { CAM.pos.x = damp(CAM.pos.x, _cv.x, 14, dt); CAM.pos.z = damp(CAM.pos.z, _cv.z, 14, dt); CAM.pos.y = damp(CAM.pos.y, _cv.y, 8, dt); if (CAM.pos.y < g) CAM.pos.y = g; if (CAM.pos.y > roof) CAM.pos.y = roof; }
  // looks down at the trail well ahead of the bike, so the rider no longer hides what is coming
  const la = lerp(14, 6, Wd);
  CAM.look.set(_cl.x + fx * la, CAM.lookY + lerp(-0.2, 0.8, Wd), _cl.z + fz * la);
  CAM.fov = CAM.cut ? lerp(49, 64, Wd) : damp(CAM.fov, lerp(49, 64, Wd) + spd * 0.1, 3, dt);
  // vibration from the ground
  if (r.grounded && !r.crash) CAM.shake = Math.max(CAM.shake, SP[r.surf].rough * clamp(spd / 30, 0, 1) * 0.12);
}
// ---- director shots for the demo / finish ----
function pickShot(kind, r) {
  const sh = { kind, r, t: 0, dur: 4 + Math.random() * 3, side: Math.random() < 0.5 ? -1 : 1 };
  if (kind === 'track') {
    const m = CR.marks.find((mk) => mk.s > r.q.s + 45 && mk.s < r.q.s + 160 && mk.type !== 'tunnel');
    const s = m ? m.s + (Math.random() - 0.3) * 10 : r.q.s + 70 + Math.random() * 40;
    const w = wAtS(s), l = sh.side * (w + 4 + Math.random() * 4), p = worldAt(s, l);
    sh.p = new THREE.Vector3(p.x, H(s, l, p.x, p.z, true) + 1.2 + Math.random() * 1.8, p.z); sh.s = s; sh.dur = 9;
  }
  return sh;
}
function directorPick(focus) {
  const R = GAME.racers.filter((r) => !r.crash);
  let r = focus || R[Math.floor(Math.random() * R.length)] || GAME.racers[0];
  if (!focus && Math.random() < 0.5) { const lead = GAME.order ? GAME.order.filter((x) => !x.finished)[0] : null; if (lead) r = lead; }
  const kinds = ['chase', 'heli', 'track', 'front', 'track', 'aerial', 'chase'];
  CAM.shot = pickShot(kinds[Math.floor(Math.random() * kinds.length)], r); CAM.cut = true; CAM.target = r;
}
function directorCam(dt) {
  if (!CAM.shot) directorPick();
  const sh = CAM.shot, r = sh.r; sh.t += dt;
  if (sh.kind !== 'chase' && CR.F.tunnels.length && (tunnelAt(r.q.s) || tunnelAt(r.q.s + 25))) { sh.kind = 'chase'; CAM.cut = true; }
  targetPos(r, _cl);
  const fx = Math.sin(r.psi), fz = Math.cos(r.psi), rx = -fz, rz = fx;
  if (sh.kind === 'chase') chaseCam(r, dt);
  else if (sh.kind === 'heli') {
    _cv.set(_cl.x + rx * 10 * sh.side + fx * (3 - sh.t * 0.6), 0, _cl.z + rz * 10 * sh.side + fz * (3 - sh.t * 0.6));
    _cv.y = Math.max(_cl.y + 3.5, camGround(_cv.x, _cv.z, r.q.i) + 2);
    if (CAM.cut) CAM.pos.copy(_cv); else CAM.pos.lerp(_cv, 1 - Math.exp(-6 * dt));
    CAM.look.set(_cl.x + fx * 2, _cl.y + 0.8, _cl.z + fz * 2); CAM.fov = damp(CAM.fov, 50, 3, dt);
  } else if (sh.kind === 'front') {
    _cv.set(_cl.x + fx * 9 + rx * 1.5 * sh.side, 0, _cl.z + fz * 9 + rz * 1.5 * sh.side);
    _cv.y = Math.max(_cl.y + 0.8, camGround(_cv.x, _cv.z, r.q.i) + 0.6);
    if (CAM.cut) CAM.pos.copy(_cv); else CAM.pos.lerp(_cv, 1 - Math.exp(-8 * dt));
    CAM.look.set(_cl.x, _cl.y + 0.9, _cl.z); CAM.fov = damp(CAM.fov, 52, 3, dt);
  } else if (sh.kind === 'aerial') {
    _cv.set(_cl.x - fx * 15 + rx * 6 * sh.side, 0, _cl.z - fz * 15 + rz * 6 * sh.side);
    _cv.y = Math.max(_cl.y + 8, camGround(_cv.x, _cv.z, r.q.i) + 4);
    if (CAM.cut) CAM.pos.copy(_cv); else CAM.pos.lerp(_cv, 1 - Math.exp(-5 * dt));
    CAM.look.set(_cl.x + fx * 6, _cl.y, _cl.z + fz * 6); CAM.fov = damp(CAM.fov, 58, 3, dt);
  } else if (sh.kind === 'track') {
    CAM.pos.copy(sh.p); CAM.look.lerp(_cv.set(_cl.x, _cl.y + 0.7, _cl.z), CAM.cut ? 1 : 1 - Math.exp(-10 * dt));
    const d = CAM.pos.distanceTo(_cl); CAM.fov = damp(CAM.fov, clamp(900 / Math.max(d, 8), 18, 60), 4, dt);
    if (r.q.s > sh.s + 25) sh.t = sh.dur;
  }
  CAM.cut = false;
  if (!sh.keep && (sh.t > sh.dur || (r.crash && sh.t > 3.2) || r.finished)) directorPick();
}
function introCam(dt) {
  const t = clamp(GAME.introT / 3.4, 0, 1), e = t * t * (3 - 2 * t);
  const s = lerp(CR.sStart + 150, CR.sStart - 16, e), h = lerp(28, 3.2, e), l = lerp(18, 3, e);
  const p = worldAt(s, l), y0 = yAtS(clamp(s, 0, CR.L));
  CAM.pos.set(p.x, y0 + h, p.z);
  const g = worldAt(CR.sStart - 6, 0); CAM.look.set(g.x, yAtS(CR.sStart) + 1, g.z);
  CAM.fov = 56;
}
function resultsCam(dt) {
  const r = GAME.player; targetPos(r, _cl);
  const a = GAME.t * 0.16 + r.psi;
  _cv.set(_cl.x + Math.sin(a) * 7.5, 0, _cl.z + Math.cos(a) * 7.5); _cv.y = Math.max(_cl.y + 2.2, camGround(_cv.x, _cv.z, r.q.i) + 1.2);
  CAM.pos.lerp(_cv, 1 - Math.exp(-3 * dt)); CAM.look.lerp(_cl.set(_cl.x, _cl.y + 0.9, _cl.z), 1 - Math.exp(-4 * dt)); CAM.fov = damp(CAM.fov, 48, 2, dt);
}
function updateCamera(dt) {
  const st = GAME.state;
  if (!CR) return;
  if (st === 'title') directorCam(dt);
  else if (st === 'intro') introCam(dt);
  else if (st === 'countdown' || st === 'race') { CAM.target = GAME.player; chaseCam(GAME.player, dt); CAM.cut = false; }
  else if (st === 'finish') { if (!CAM.shot || !CAM.shot.keep) { CAM.shot = pickShot(Math.random() < 0.5 ? 'front' : 'heli', GAME.player); CAM.shot.dur = 99; CAM.shot.keep = true; CAM.cut = true; CAM.target = GAME.player; } directorCam(dt); }
  else if (st === 'results') resultsCam(dt);
  camera.position.copy(CAM.pos);
  if (CAM.shake > 0.002) {
    const k = CAM.shake * 0.12;
    camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; camera.position.z += (Math.random() - 0.5) * k;
    CAM.shake *= Math.exp(-5 * dt);
  }
  camera.lookAt(CAM.look);
  // lean the view with the bike
  { const tr = CAM.target, st2 = GAME.state, want = tr && !tr.crash && (st2 === 'race' || st2 === 'countdown' || (CAM.shot && CAM.shot.kind === 'chase')) ? -tr.roll * 0.42 : 0;
    CAM.roll = damp(CAM.roll || 0, want, 5, dt); if (Math.abs(CAM.roll) > 0.002) camera.rotateZ(CAM.roll); }
  if (Math.abs(camera.fov - CAM.fov) > 0.05) { camera.fov = CAM.fov; camera.updateProjectionMatrix(); }
  skyMesh.position.copy(camera.position);
  // sun + shadow box follow the action
  const f = CAM.target ? targetPos(CAM.target, _cl) : CAM.look;
  const sd = SKYU.sunDir.value;
  sun.target.position.set(f.x, f.y, f.z); sun.position.set(f.x + sd.x * 120, f.y + sd.y * 120, f.z + sd.z * 120);
}
