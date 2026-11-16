// ===================== Per-frame visuals: bikes, riders, dust, spray =====================
const POSE = { stand: 0, crouch: 0, leanB: 0, side: 0, flail: 0, t: 0, look: 0, yaw: 0 };
const DUSTK = { [SURF.DIRT]: 1, [SURF.GRAVEL]: 0.9, [SURF.SAND]: 1.5, [SURF.MUD]: 0, [SURF.GRASS]: 0.25, [SURF.WATER]: 0, [SURF.ROCK]: 0.5 };
function updateBikeVisual(r, dt, tAbs) {
  const b = r.b;
  if (r.crash) {
    const c = r.crash;
    b.root.position.copy(c.bp); b.root.position.y -= 0.2; b.root.quaternion.copy(c.bq);
    POSE.stand = 0.3; POSE.crouch = 0; POSE.leanB = 0; POSE.side = 0; POSE.flail = c.t < 0.9 ? 1 : 0.3; POSE.t = tAbs; POSE.look = 0; POSE.yaw = 0;
    poseRider(b, POSE);
    r.spin.f += dt * 4; r.spin.r += dt * 6; setBikeMech(b, 0, 0, 0.4, r.spin);
    b.blob.position.set(c.bp.x, r.y - 0.15, c.bp.z); b.blob.visible = true;
    b.root.visible = true;
    return;
  }
  b.root.visible = r.ghost > 0 ? (Math.floor(tAbs * 12) % 2 === 0) : true;
  // wheelie pivots on the rear tyre; flips turn about the middle of the bike
  { const fa = r.flipA, c = 0.78, fwd = c * Math.sin(fa), wy = Math.sin(Math.max(0, r.wheelie)) * 0.72;
    b.root.position.set(r.x + Math.sin(r.psi) * fwd, r.y + c * (1 - Math.cos(fa)) + wy, r.z + Math.cos(r.psi) * fwd);
    b.root.rotation.set(-(r.pitch + fa + r.wheelie), r.psi + r.whip + r.spinA, r.roll + r.whip * 0.75, 'YXZ'); }
  // suspension spring + small bumps
  r.compV += (-170 * r.cS - 15 * r.compV) * dt; r.cS += r.compV * dt;
  if (!r.grounded) r.cS = damp(r.cS, -0.05, 6, dt);
  r.cS = clamp(r.cS, -0.06, 0.24);
  let bf = 0, br = 0;
  if (r.grounded && r === CAM.target) { bf = clamp(groundRough(r, 0.75) - groundAhead(r, 0.75), -0.06, 0.1); br = clamp(groundRough(r, -0.72) - groundAhead(r, -0.72), -0.06, 0.1); }
  else if (r.grounded) { const k = SP[r.surf].rough * Math.min(1, r.spd / 20) * 0.03; bf = Math.sin(tAbs * 31 + r.i) * k; br = Math.sin(tAbs * 27 + r.i * 2) * k; }
  const v = r.spd;
  r.spin.f -= v / BK.rF * dt;
  const slip = r.grounded && r.inp.thr > 0 && (r.surf === SURF.MUD || r.surf === SURF.SAND || r.surf === SURF.GRAVEL) ? 4 : 0;
  r.spin.r -= (v + (r.grounded ? slip : (r.inp.thr > 0 ? 25 : 0))) / BK.rR * dt;
  setBikeMech(b, clamp(r.cS + bf, -0.06, 0.26), clamp(r.cS + br, -0.06, 0.26), -r.steerS * 0.32 * (1 - clamp(v / 40, 0, 0.75)), r.spin);
  // rider: stands on rough ground and in the air, crouches on landings, leans back on the gas
  const rough = SP[r.surf].rough;
  const dabW = r.grounded && Math.abs(r.roll) > 0.3 && v > 7 ? clamp((Math.abs(r.roll) - 0.3) * 6, 0, 1) : 0;
  r.dab = damp(r.dab || 0, dabW * (r.roll > 0 ? -1 : 1), 8, dt);
  const wantStand = r.trick ? 0.35 : !r.grounded ? 1 : (v > 8 && (rough > 0.6 || r.wobble > 0)) ? 0.95 : v > 14 ? 0.6 : 0.15;
  r.stand = damp(r.stand, wantStand, 3, dt);
  r.crouch = damp(r.crouch, clamp(r.cS * 3.2, 0, 1), 12, dt);
  POSE.stand = r.stand; POSE.crouch = r.trick ? 0.7 : r.crouch; POSE.dab = r.dab;
  POSE.leanB = (!r.grounded ? (r.inp.thr > 0 ? 0.25 : -0.35) : r.inp.thr > 0 && v < 14 ? 0.18 : 0) + (r.wobble > 0 ? Math.sin(tAbs * 17) * 0.2 * r.wobble : 0);
  POSE.side = clamp(-r.roll * 0.8, -0.5, 0.5); POSE.flail = 0; POSE.t = tAbs; POSE.look = clamp(r.pitch * 0.4, -0.2, 0.2); POSE.yaw = clamp(r.steerS * 0.2, -0.2, 0.2);
  // only nearby riders get the full limb update every frame
  const dc = Math.hypot(r.x - camera.position.x, r.z - camera.position.z);
  if (dc < 90 || (Math.floor(tAbs * 60) + r.i) % 4 === 0) poseRider(b, POSE);
  // contact shadow
  const hAbove = r.y - r.gh;
  b.blob.position.set(r.x, r.gh + 0.04, r.z); b.blob.rotation.set(-Math.PI / 2, 0, -r.psi);
  const bs = 1 + clamp(hAbove * 0.25, 0, 1); b.blob.scale.set(bs, bs, 1); b.blob.material.opacity = 0.85;
  b.blob.visible = hAbove < 6;
}

// ---------- particle emitters ----------
function rearContact(r, o) { const fx = Math.sin(r.psi), fz = Math.cos(r.psi); o.x = r.x - fx * 0.72; o.z = r.z - fz * 0.72; o.y = r.gh; o.fx = fx; o.fz = fz; return o; }
const _rc = {};
function emitForRacer(r, dt) {
  if (r.crash) return;
  const dc = Math.hypot(r.x - camera.position.x, r.z - camera.position.z);
  if (dc > 170) return;
  const lod = dc < 60 ? 1 : 0.45;
  const v = Math.max(0, r.spd), rc = rearContact(r, _rc), surf = r.surf;
  const rx = -rc.fz, rz = rc.fx;
  if (r.grounded) {
    // dust plume
    const dk = DUSTK[surf] * clamp(v / 26, 0, 1.2);
    if (dk > 0) {
      r.dustAcc += dt * 30 * dk * lod * (Q.level === 0 ? 0.55 : 1);
      const dcol = dustCol(surf), a = surf === SURF.SAND ? 0.42 : 0.34;
      while (r.dustAcc >= 1) {
        r.dustAcc -= 1;
        const j = (Math.random() - 0.5) * 0.8;
        PS.dust.emit(rc.x + rx * j, rc.y + 0.25, rc.z + rz * j, -rc.fx * v * 0.18 + (Math.random() - 0.5) * 1.5, 0.4 + Math.random() * 1.2, -rc.fz * v * 0.18 + (Math.random() - 0.5) * 1.5,
          2.2 + Math.random() * 2.4, 0.8, 4.2 + Math.random() * 3.2, dcol[0] * (0.9 + Math.random() * 0.15), dcol[1] * (0.9 + Math.random() * 0.15), dcol[2] * (0.9 + Math.random() * 0.15), a, -0.15, 1.1);
      }
    }
    // roost: dirt/stones thrown by the rear wheel on the gas
    const loose = surf === SURF.DIRT || surf === SURF.GRAVEL || surf === SURF.SAND || surf === SURF.MUD || surf === SURF.GRASS;
    if (loose && r.inp.thr > 0 && v > 2) {
      r.gritAcc += dt * (surf === SURF.MUD ? 50 : 34) * lod * clamp(0.4 + (1 - v / 31) * 0.9, 0.3, 1.2);
      const dcl = DEBRIS[surf], big = surf === SURF.MUD ? 1.8 : 1;
      while (r.gritAcc >= 1) {
        r.gritAcc -= 1;
        const sp = 3.5 + Math.random() * 6, up = 1.5 + Math.random() * 4, sd = (Math.random() - 0.5) * 2.4, sz = (0.05 + Math.random() * 0.09) * big;
        PS.grit.emit(rc.x, rc.y + 0.12, rc.z, -rc.fx * sp + rx * sd + r.vx * 0.5, up, -rc.fz * sp + rz * sd + r.vz * 0.5, 0.7 + Math.random() * 0.5, sz, sz, dcl[0] * (0.8 + Math.random() * 0.4), dcl[1] * (0.8 + Math.random() * 0.4), dcl[2] * (0.8 + Math.random() * 0.4), 1, GRAV, 0.2, rc.y + 0.02);
      }
    }
    // water: bow spray, rooster tail and mist
    if (surf === SURF.WATER && v > 2) {
      const n = Math.floor(dt * 130 * clamp(v / 22, 0.2, 1.3) * lod + Math.random());
      for (let k = 0; k < n; k++) {
        const side = Math.random() < 0.5 ? -1 : 1, fwd = Math.random() < 0.6;
        const px = fwd ? r.x + rc.fx * 0.8 : rc.x, pz = fwd ? r.z + rc.fz * 0.8 : rc.z;
        const lat = fwd ? side * (2.5 + Math.random() * 4) : side * Math.random() * 1.5, back = fwd ? v * 0.55 : -(2 + Math.random() * 5), up = fwd ? 1.5 + Math.random() * 3.5 : 2.5 + Math.random() * 4.5;
        const sz = 0.08 + Math.random() * 0.14;
        PS.grit.emit(px, r.gh + 0.35, pz, rc.fx * back + rx * lat, up, rc.fz * back + rz * lat, 0.6 + Math.random() * 0.5, sz, sz * 1.6, 0.88, 0.93, 0.98, 0.8, GRAV, 0.4);
      }
      if (Math.random() < dt * 22 * lod) { const sd = Math.random() < 0.5 ? -1 : 1; PS.mist.emit(r.x + rx * sd * 0.8, r.gh + 0.5, r.z + rz * sd * 0.8, rx * sd * (2 + Math.random() * 3) + r.vx * 0.3, 1 + Math.random() * 1.5, rz * sd * (2 + Math.random() * 3) + r.vz * 0.3, 0.8 + Math.random() * 0.5, 0.7, 3.4, 0.93, 0.96, 0.99, 0.42, 0.5, 1.6); }
    }
  }
}
function splash(r, k) {
  AU.sfx('splash', soundVol(r) * clamp(k, 0.3, 1));
  const n = Math.floor(80 * k);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = 2 + Math.random() * 6 * k;
    PS.grit.emit(r.x, r.gh + 0.4, r.z, Math.cos(a) * sp + r.vx * 0.4, 3 + Math.random() * 6 * k, Math.sin(a) * sp + r.vz * 0.4, 0.8 + Math.random() * 0.6, 0.07, 0.16, 0.86, 0.92, 0.97, 0.9, GRAV, 0.3);
  }
  for (let i = 0; i < 10 * k; i++) PS.mist.emit(r.x + (Math.random() - 0.5) * 2, r.gh + 0.6, r.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 1 + Math.random() * 0.6, 1.2, 4.5, 0.94, 0.96, 0.99, 0.4, 0, 1.2);
  if (r.isPlayer) CAM.shake = Math.max(CAM.shake, 0.3);
}
function landDust(r, k) {
  const surf = r.surf;
  if (surf === SURF.WATER) { splash(r, k * 0.8); return; }
  const dc = dustCol(surf), n = Math.floor(16 * k * DUSTK[surf] + 4);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = 2 + Math.random() * 4 * k;
    PS.dust.emit(r.x, r.gh + 0.3, r.z, Math.cos(a) * sp + r.vx * 0.2, 0.4 + Math.random() * 1.2, Math.sin(a) * sp + r.vz * 0.2, 1.4 + Math.random() * 1.2, 1.0, 3.6 + k * 2, dc[0], dc[1], dc[2], 0.3, -0.1, 1.6);
  }
  const dcl = DEBRIS[surf];
  for (let i = 0; i < 10 * k; i++) PS.grit.emit(r.x, r.gh + 0.15, r.z, (Math.random() - 0.5) * 5, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 5, 0.6, 0.07, 0.07, dcl[0], dcl[1], dcl[2], 1, GRAV, 0.2, r.gh);
}
function chips(r, o, n) {
  const c = o.type === 'log' || o.type === 'stump' ? [0.42, 0.32, 0.22] : [0.5, 0.48, 0.45];
  for (let i = 0; i < n; i++) PS.grit.emit(o.x, o.top || r.y + 0.3, o.z, (Math.random() - 0.5) * 5 + r.vx * 0.3, 2 + Math.random() * 3, (Math.random() - 0.5) * 5 + r.vz * 0.3, 0.7, 0.06, 0.06, c[0], c[1], c[2], 1, GRAV, 0.2, o.y);
  const dc = dustCol(r.surf); for (let i = 0; i < 4; i++) PS.dust.emit(o.x, o.y + 0.4, o.z, (Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2, 1.2, 0.8, 2.4, dc[0], dc[1], dc[2], 0.25, 0, 1.4);
}
function hayBits(r, o) { for (let i = 0; i < 30; i++) PS.grit.emit(o.x, o.y + 1, o.z, (Math.random() - 0.5) * 6 + r.vx * 0.3, 2 + Math.random() * 4, (Math.random() - 0.5) * 6 + r.vz * 0.3, 1.2, 0.06, 0.08, 0.85, 0.72, 0.38, 1, GRAV * 0.4, 1.5, o.y); }
function crashDust(r) {
  const dc = dustCol(r.surf), n = r.surf === SURF.WATER ? 0 : 22;
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 1 + Math.random() * 4; PS.dust.emit(r.x, r.gh + 0.4, r.z, Math.cos(a) * sp, 0.5 + Math.random() * 1.5, Math.sin(a) * sp, 2 + Math.random(), 1.2, 4.8, dc[0], dc[1], dc[2], 0.34, -0.1, 1.2); }
  if (r.surf === SURF.WATER) splash(r, 1);
  const dcl = DEBRIS[r.surf]; for (let i = 0; i < 18; i++) PS.grit.emit(r.x, r.gh + 0.3, r.z, (Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.8, 0.08, 0.08, dcl[0], dcl[1], dcl[2], 1, GRAV, 0.2, r.gh);
}
