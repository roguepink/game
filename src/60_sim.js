// ===================== Race simulation =====================
const BIKE = { vmax: 31, acc: 10.5, coast: 2.6, brake: 15 };
const GAME = { state: 'boot', t: 0, raceT: 0, racers: [], player: null, paused: false, timeScale: 1, countT: 0, finCount: 0, resultsT: 0, demo: true, introT: 0, finT: 0 };
const KEYS = {}, TOUCH = { on: false, l: false, r: false, a: false, t: false };

function createRacer(i) {
  const rd = RIDERS[i];
  const b = makeBike(rd);
  scene.add(b.root); scene.add(b.blob);
  const r = {
    i, rd, isPlayer: i === 0, b, x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, psi: 0, spd: 0, q: { s: 0, l: 0, fi: 0, d: 0, i: 0 },
    grounded: true, airT: 0, pitch: 0, roll: 0, surf: 0, gh: 0, ghPrev: 0, inp: { thr: 0, steer: 0, brake: 0 }, steerS: 0,
    crash: null, finished: false, finishT: 0, place: 0, prog: 0, wobble: 0, stand: 0.5, crouch: 0, compF: 0, compR: 0, compV: 0, cS: 0,
    rpm: 0.15, gear: 1, spin: { f: 0, r: 0 }, hitCD: new Map(), ghost: 0, wrongT: 0, stuckT: 0, yawRate: 0, lastNice: 0,
    ai: { vmul: 1, skill: 1, err: 0, lane: 0, planT: 0, look: 30, react: 0 }, stats: { crash: 0, hits: 0, nice: 0, maxAir: 0, tricks: 0, best: '' },
    engine: null, popT: 0, inWater: false, splashCD: 0, dustAcc: 0, gritAcc: 0, landFx: 0,
    trick: null, flipA: 0, spinA: 0, whip: 0, whipT: 0, airTricks: [], boostT: 0, style: 0, wheelie: 0, trickPrev: false, aiPlan: 0, aiAir: false, sideSlope: 0,
  };
  return r;
}
function setupRacers(demo) {
  const ai = stageAI(STAGE_I);
  // grid: three rivals in front, the player in the middle of the second row
  const slots = [[0, -3.0], [0, 0], [0, 3.0], [1, -3.0], [1, 3.0]], order = [1, 2, 3, 4, 5];
  for (const r of GAME.racers) {
    let row, l;
    if (r.isPlayer) { row = 1; l = 0; } else { const k = order.indexOf(r.i); row = slots[k][0]; l = slots[k][1]; }
    placeRacer(r, CR.sStart - 3 - row * 6, l, 0);
    r.finished = false; r.finishT = 0; r.place = 0; r.crash = null; r.ghost = 0; r.wobble = 0; r.stats = { crash: 0, hits: 0, nice: 0, maxAir: 0, tricks: 0, best: '' };
    r.trick = null; r.flipA = 0; r.spinA = 0; r.whip = 0; r.whipT = 0; r.airTricks = []; r.boostT = 0; r.style = 0; r.wheelie = 0; r.aiPlan = 0;
    r.hitCD.clear(); r.wrongT = 0; r.stuckT = 0; r.lastNice = 0;
    if (r.isPlayer) { r.ai.vmul = 1; r.ai.skill = demo ? 0.97 : 1; r.ai.err = demo ? 0.05 : 0; r.auto = demo; }
    else { r.ai.vmul = ai.vmul + r.rd.vm; r.ai.skill = clamp(ai.skill + r.rd.sk, 0.4, 1); r.ai.err = clamp(ai.err - r.rd.sk * 0.5, 0, 0.5); r.auto = true; }
    r.ai.lane = l; r.ai.planT = 0; r.ai.seed = (r.i * 7919 + STAGE.seed * 31) % 1000;
    if (r.b.rider.grp.parent !== r.b.body) r.b.body.add(r.b.rider.grp);
    r.b.rider.grp.position.set(0, 0, 0); r.b.rider.grp.rotation.set(0, 0, 0);
  }
  GAME.finCount = 0;
}
function placeRacer(r, s, l, spd) {
  const fr = frameAt(s, {}), p = worldAt(s, l);
  r.x = p.x; r.z = p.z; r.psi = fr.psi; r.spd = spd; r.vx = Math.sin(r.psi) * spd; r.vz = Math.cos(r.psi) * spd; r.vy = 0;
  queryLocal(r.x, r.z, Math.round(s / CR.ds), 20, r.q);
  r.gh = H(r.q.s, r.q.l, r.x, r.z, false); r.ghPrev = r.gh; r.y = r.gh; r.grounded = true; r.airT = 0; r.pitch = 0; r.roll = 0; r.steerS = 0;
  r.prog = r.q.s - CR.sStart;
  r.trick = null; r.flipA = 0; r.spinA = 0; r.whip = 0; r.whipT = 0; r.airTricks.length = 0; r.wheelie = 0; r.aiPlan = 0; r.aiAir = false;
}

// ---------- AI ----------
const _wq = {};
function hash01(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function laneCost(r, lc, look, spd) {
  const s0 = r.q.s, w = wAtS(s0 + 10), OB = CR.OB, ai = r.ai;
  let cost = 0.1 * Math.abs(lc - r.q.l) + 0.03 * Math.abs(lc);
  // lateral reach: the bike has to turn before it moves sideways, so reach grows ~t^2
  const acc = Math.max(3, spd * (0.42 + 0.18 * ai.skill)), vlat = r.vlat || 0;
  for (let i = obsFrom(s0 + 0.5); i < OB.length && OB[i].s < s0 + look; i++) {
    const o = OB[i]; if (o.gone) continue;
    if (hash01(i + 17, ai.seed) < ai.err) continue;          // this rider does not notice it in time
    const ds = o.s - s0, tt = ds / Math.max(spd, 4);
    const t2 = Math.max(0, tt - 0.12 - (1 - ai.skill) * 0.15), reach = Math.min(0.5 * acc * t2 * t2, 2.2 + spd * 0.3 * t2);
    const l0 = r.q.l + vlat * Math.min(tt, 0.25);
    const lp = l0 + clamp(lc - l0, -reach, reach);   // where we will be when we reach it
    const near = 1 + 2.5 / (1 + ds * 0.15);
    if (o.type === 'log' || o.type === 'fence') {
      if (lp > o.l0 - 0.7 && lp < o.l1 + 0.7) cost += (o.full ? 0 : o.type === 'fence' ? 2.4 : 3.2) * near;
      continue;
    }
    const margin = o.r + (o.crashV ? 0.95 : 0.7) + (1 - ai.skill) * 0.25;
    const d = Math.abs(lp - o.l);
    if (d < margin) {
      const pen = o.crashV ? (o.type === 'stump' ? 14 : 40) : o.type === 'hay' ? 9 : o.type === 'crate' ? 5 : 6;
      cost += pen * near * (1 - d / margin * 0.5);
    }
  }
  // boulders rolling across: where will they be when we get there?
  for (const d of DYN.rolls) { const ds = d.s - s0; if (ds < -1 || ds > look) continue; const lr = rollL(d, GAME.t + ds / Math.max(spd, 6)); if (lr !== null && Math.abs(lc - lr) < d.r + 2.0) cost += 45 * (1 + 2.5 / (1 + ds * 0.15)); }
  // surfaces: mud and deep water are slow
  for (let k = 8; k <= Math.min(look, 40); k += 8) {
    const ss = s0 + k, z = zoneSurf(ss, lc);
    if (z === SURF.MUD) cost += 0.9; else if (z === SURF.SAND && SURF[THEME.base] !== SURF.SAND) cost += 0.25;
    const wy = waterY(ss, lc); if (wy > -1e8) { const p = worldAt(ss, lc, _wq); if (wy - H(ss, lc, p.x, p.z, false) > 0.15) cost += 0.25; }
  }
  if (Math.abs(lc) > w - 0.4) cost += 2;
  // a plank bridge ahead: only the lanes on the deck are any good
  for (const q of CR.F.ravines) { if (!q.deck) continue; const d2 = q.s - q.hw - s0; if (d2 < -2 * q.hw - 2 || d2 > look + 25) continue; const ov = Math.abs(lc) - (q.bw - 0.9); if (ov > 0) cost += 60 + ov * 12; }
  // don't ride into another bike
  for (const o of GAME.racers) {
    if (o === r || o.crash) continue;
    const ds = o.q.s - s0; if (ds < -1 || ds > 10) continue;
    if (Math.abs(o.q.l - lc) < 1.3) cost += 1.4 * (1 - ds / 12);
  }
  return cost;
}
function aiControl(r, dt) {
  const ai = r.ai, spd = Math.max(r.spd, 0);
  ai.planT -= dt;
  const look = 14 + spd * (0.75 + 0.55 * ai.skill);
  if (ai.planT <= 0) {
    ai.planT = 0.1 + (1 - ai.skill) * 0.12;
    const w = wAtS(r.q.s + 10);
    let best = ai.lane, bc = laneCost(r, ai.lane, look, spd) - 0.25;   // a little hysteresis
    for (let lc = -w + 0.7; lc <= w - 0.7; lc += 0.5) { const c = laneCost(r, lc, look, spd); if (c < bc) { bc = c; best = lc; } }
    ai.lane = best; ai.cost = bc;
  }
  // steer to a point ahead on the chosen lane
  const Ld = 3.5 + spd * 0.24, fr = frameAt(r.q.s + Ld, _wq);
  const want = fr.psi - Math.atan2(ai.lane - r.q.l - (r.vlat || 0) * 0.22, Ld);
  const err = wrapPi(r.psi - want);
  let steer = clamp(err * 3.4, -1, 1);
  // throttle
  let thr = 1, brake = 0;
  if (ai.cost > 30 && spd > 9) { thr = 0; brake = 1; }       // can't get round it: scrub speed
  if (!r.grounded) {
    // in the air: nose down for a downhill landing, throttle (nose up) for a flat one
    const ahead = r.q.s + Math.max(4, spd * 0.5), p1 = worldAt(ahead, r.q.l, _wq), h1 = H(ahead, r.q.l, p1.x, p1.z, false), p2 = worldAt(ahead + 4, r.q.l, _wq), h2 = H(ahead + 4, r.q.l, p2.x, p2.z, false);
    const slope = Math.atan2(h2 - h1, 4), traj = Math.atan2(r.vy, Math.max(spd, 1));
    const nose = traj * 0.7 + 0.2;    // with throttle held
    thr = Math.abs(nose - slope) < Math.abs(traj * 0.7 - 0.24 - slope) ? 1 : 0;
    if (ai.skill < 0.85 && hash01(Math.floor(GAME.t * 2), ai.seed) < 0.2) thr = 1 - thr;
    // tricks: only when there is clearly enough air for them
    if (!r.aiAir && r.airT > 0.14) {
      r.aiAir = true;
      const T = airTimeLeft(r), h = hash01(Math.floor(r.q.s), ai.seed + 5);
      r.aiPlan = T > 1.75 ? 2 : T > 0.98 && h < 0.45 + 0.45 * ai.skill ? 1 : 0;
      r.aiKind = hash01(Math.floor(r.q.s) + 3, ai.seed) < 0.3 ? 'spin' : 'flip';
      r.aiWhip = r.aiPlan === 0 && T > 0.7 && h < 0.5 ? (h < 0.25 ? 1 : -1) : 0; r.aiWhipT = T;
    }
    r.inp.trick = false;
    if (r.aiPlan > 0 && !r.trick && r.airT > 0.16) { r.inp.trick = true; r.inp.trickKind = r.aiKind; r.aiPlan--; }
    if (r.aiWhip && r.airT < r.aiWhipT * 0.6) steer = r.aiWhip;
  } else { r.aiAir = false; r.inp.trick = false; }
  if (r.finished) { thr = r.q.s > CR.sFin + 25 ? 0 : 0.5; brake = r.q.s > CR.sFin + 70 && spd > 3 ? 0.6 : 0; }
  r.inp.thr = thr; r.inp.steer = steer; r.inp.brake = brake;
}
function playerControl(r) {
  const k = KEYS;
  const thr = (k.ArrowUp || k.KeyW || k.Space || TOUCH.a || GP.thr) ? 1 : 0;
  let steer = ((k.ArrowRight || k.KeyD || TOUCH.r) ? 1 : 0) - ((k.ArrowLeft || k.KeyA || TOUCH.l) ? 1 : 0);
  if (GP.steer) steer = GP.steer;
  r.inp.thr = thr; r.inp.steer = steer; r.inp.brake = (k.ArrowDown || k.KeyS || GP.brake) ? 1 : 0;
  r.inp.trick = !!(k.ArrowDown || k.KeyS || k.ShiftLeft || k.ShiftRight || k.KeyX || TOUCH.t || GP.trick); r.inp.trickKind = null;
}
// seconds until the bike comes down (ballistic path against the ground ahead)
const _aq = {};
function airTimeLeft(r) {
  for (let t = 0.06; t < 3.2; t += 0.06) {
    const x = r.x + r.vx * t, z = r.z + r.vz * t, y = r.y + r.vy * t - 0.5 * GRAV * t * t;
    queryLocal(x, z, r.q.i + Math.round(r.spd * t / CR.ds), 8, _aq);
    if (y <= H(_aq.s, _aq.l, x, z, false)) return t;
  }
  return 3.2;
}
const TRICK = { flip: ['バックフリップ', 300], front: ['フロントフリップ', 350], spin: ['360スピン', 250], whip: ['ウィップ', 100] };
function trickDone(r, key) {
  const [name, pts] = TRICK[key];
  r.airTricks.push(key); r.stats.tricks++; r.style += pts * (1 + 0.5 * (r.airTricks.length - 1));
  if (!r.stats.best || pts > TRICK[r.stats.bestKey || 'whip'][1]) { r.stats.best = name; r.stats.bestKey = key; }
  if (r.isPlayer) { showMsg(name + (r.airTricks.length > 1 ? ' ×' + r.airTricks.length : '') + '！', 'good'); AU.sfx('trick', 0.9); }
}
function airTricks(r, dt) {
  const inp = r.inp, press = inp.trick && !r.trickPrev; r.trickPrev = inp.trick;
  if (r.trick) {
    const tk = r.trick; tk.t += dt;
    const u = Math.min(1, tk.t / tk.dur), a = (u * u * (3 - 2 * u) * 0.35 + u * 0.65) * TAU;
    if (tk.kind === 'spin') r.spinA = tk.dir * a; else r.flipA = tk.dir * a;
    if (u >= 1) { r.flipA = 0; r.spinA = 0; r.trick = null; trickDone(r, tk.kind === 'spin' ? 'spin' : tk.dir > 0 ? 'flip' : 'front'); }
  } else if (press && r.airT > 0.1) {
    const kind = inp.trickKind || (Math.abs(inp.steer) > 0.5 ? 'spin' : 'flip');
    r.trick = { kind, t: 0, dur: kind === 'spin' ? 0.6 : 0.66, dir: kind === 'spin' ? (inp.steer >= 0 ? -1 : 1) : (inp.thr > 0 || r.auto ? 1 : -1) };
    r.whip *= 0.3;
  }
  // whip: lay the bike sideways while the stick is held
  const wt = r.trick ? 0 : inp.steer * 0.8;
  r.whip = damp(r.whip, wt, wt === 0 ? 7 : 5, dt);
  if (Math.abs(r.whip) > 0.42) r.whipT += dt;
}

// ---------- physics ----------
const _fq = {};
function groundAhead(r, d) {   // physics ground height d metres along the heading
  const x = r.x + Math.sin(r.psi) * d, z = r.z + Math.cos(r.psi) * d;
  queryLocal(x, z, r.q.i, 4, _fq);
  return H(_fq.s, _fq.l, x, z, false);
}
function groundRough(r, d) {
  const x = r.x + Math.sin(r.psi) * d, z = r.z + Math.cos(r.psi) * d;
  queryLocal(x, z, r.q.i, 4, _fq);
  return H(_fq.s, _fq.l, x, z, 2);
}
function stepRacer(r, dt) {
  if (r.crash) { stepCrash(r, dt); return; }
  if (r.ghost > 0) r.ghost -= dt;
  if (r.wobble > 0) r.wobble = Math.max(0, r.wobble - dt);
  if (r.boostT > 0) r.boostT = Math.max(0, r.boostT - dt);
  const sp = SP[r.surf], inp = r.inp;
  r.steerS = damp(r.steerS, inp.steer, r.auto ? 9 : 11, dt);
  let fx = Math.sin(r.psi), fz = Math.cos(r.psi);
  let vf = r.vx * fx + r.vz * fz, vl = r.vx * -fz + r.vz * fx;
  const onGround = r.grounded || r.airT < 0.08;
  const psi0 = r.psi;
  if (onGround) {
    let vmax = BIKE.vmax * sp.v * r.ai.vmul * (r.wobble > 0 ? 0.92 : 1) * (r.boostT > 0 ? 1.17 : 1);
    if (r.finished) vmax *= 0.6;
    if (r.boostT > 0 && vf < vmax) vf += 7 * dt;
    const thr = inp.thr;
    if (thr > 0) {
      if (vf < vmax) vf += BIKE.acc * sp.a * thr * (1 - (vf / vmax) * (vf / vmax) * 0.96) * dt;
      else vf -= (vf - vmax) * 1.4 * dt;
    } else vf -= (BIKE.coast + 0.05 * Math.max(vf, 0)) * (1 + (1 - sp.v) * 1.5) * dt;
    if (inp.brake) vf -= BIKE.brake * dt * (vf > 0 ? 1 : 0.2);
    if (vf > vmax) vf -= (vf - vmax) * 0.8 * dt;
    // slope
    const ga = groundAhead(r, 1.2), gb = groundAhead(r, -1.2), slope = (ga - gb) / 2.4;
    vf -= GRAV * clamp(slope, -0.7, 0.7) * 0.7 * dt;
    vf = Math.max(vf, -2.5);
    // side slope (berms, cambers) pulls the bike downhill
    {
      const ti = r.q.i, rx = -CR.tz[ti], rz = CR.tx[ti], q = r.q;
      const gl = (H(q.s, q.l + 0.7, r.x + rx * 0.7, r.z + rz * 0.7, false) - H(q.s, q.l - 0.7, r.x - rx * 0.7, r.z - rz * 0.7, false)) / 1.4;
      const a = clamp(-GRAV * gl * 0.6, -7, 7) * dt, lf = rx * fx + rz * fz, ll = rx * -fz + rz * fx;
      vf += a * lf; vl += a * ll; r.sideSlope = gl;
    }
    // steering
    const av = Math.abs(vf), rate = lerp(1.75, 0.85, clamp(av / 30, 0, 1)) * (0.6 + 0.4 * clamp(sp.grip / 6, 0, 1.15)) * Math.min(1, av / 2.5);
    r.psi -= r.steerS * rate * dt * (vf >= 0 ? 1 : -1);
    // lateral grip (lets the bike slide on loose ground)
    const grip = sp.grip * (r.wobble > 0 ? 0.55 : 1), vl2 = vl * Math.exp(-grip * dt);
    vf += Math.abs(vl - vl2) * 0.3 * Math.sign(vf || 1); vl = vl2;
  } else {
    r.psi -= r.steerS * 0.32 * dt;
    vf -= 0.0035 * vf * Math.abs(vf) * dt;
  }
  r.yawRate = -wrapPi(r.psi - psi0) / dt;
  r.vx = fx * vf - fz * vl; r.vz = fz * vf + fx * vl;
  r.spd = vf;
  r.x += r.vx * dt; r.z += r.vz * dt;
  queryLocal(r.x, r.z, r.q.i, 6, r.q);
  { const ti = r.q.i; r.vlat = r.vx * -CR.tz[ti] + r.vz * CR.tx[ti]; }
  // course tape: soft boundary
  const w = wAtS(r.q.s), lim = w + 2.6;
  if (Math.abs(r.q.l) > lim) {
    const fr = frameAt(r.q.s, _fq), sd = Math.sign(r.q.l), over = Math.abs(r.q.l) - lim;
    r.x -= fr.rx * sd * over; r.z -= fr.rz * sd * over;
    const vOut = (r.vx * fr.rx + r.vz * fr.rz) * sd;
    if (vOut > 0) { r.vx -= fr.rx * sd * vOut * 1.3; r.vz -= fr.rz * sd * vOut * 1.3; }
    r.vx *= 1 - 1.8 * dt; r.vz *= 1 - 1.8 * dt; r.wobble = Math.max(r.wobble, 0.2);
    queryLocal(r.x, r.z, r.q.i, 6, r.q);
  }
  // vertical
  const gh = H(r.q.s, r.q.l, r.x, r.z, false);
  const grate = (gh - r.ghPrev) / dt; r.ghPrev = gh; r.gh = gh;
  if (r.grounded) {
    // leave the ground when it falls away faster than gravity can pull the bike down (dt-independent)
    const aG = (grate - r.vy) / dt;
    if (aG < -GRAV * 1.03 && vf > 6) { r.grounded = false; r.airT = 0; r.vy -= GRAV * dt; r.y = Math.max(r.y + r.vy * dt, gh + 0.002); r.airY0 = r.y; }
    else { r.y = gh; r.vy = clamp(grate, -30, 30); }
  } else {
    r.vy -= GRAV * dt; r.y += r.vy * dt; r.airT += dt;
    r.stats.maxAir = Math.max(r.stats.maxAir, r.y - gh);
    airTricks(r, dt);
    if (r.y <= gh) land(r, gh, grate);
    if (r.crash) return;
  }
  // pitch / roll
  if (r.grounded) {
    const hf = groundAhead(r, 0.75), hb = groundAhead(r, -0.72);
    const tgt = Math.atan2(hf - hb, 1.47);
    r.pitch = damp(r.pitch, tgt, 16, dt);
    // wheelie off the line and out of slow corners; nose dips on the brakes
    const wh = inp.thr > 0 && vf > 0.6 && vf < 14 && !inp.brake ? 0.5 * (1 - vf / 14) * (r.boostT > 0 ? 1.4 : 1) : inp.brake && vf > 6 ? -0.07 : r.boostT > 1.0 ? 0.16 : 0;
    r.wheelie = damp(r.wheelie, wh, wh > r.wheelie ? 5 : 7, dt);
    r.whip = damp(r.whip, 0, 12, dt); r.trickPrev = inp.trick;
  } else {
    const traj = Math.atan2(r.vy, Math.max(Math.abs(vf), 1));
    const tgt = traj * 0.7 + (inp.thr > 0 ? 0.2 : -0.24);
    r.pitch = damp(r.pitch, tgt, 2.1, dt);
    r.wheelie = damp(r.wheelie, 0, 4, dt);
  }
  const lean = clamp(Math.atan(Math.max(vf, 0) * r.yawRate / GRAV) * 1.1, -0.75, 0.75) + (r.wobble > 0 ? Math.sin(GAME.t * 23) * r.wobble * 0.25 : 0);
  r.roll = damp(r.roll, onGround ? lean : lean * 0.4, 7, dt);
  // surface + water
  const wv = wAtS(r.q.s);
  r.surf = surfAt(r.q.s, r.q.l, wv, gh);
  const inW = r.surf === SURF.WATER;
  if (inW && !r.inWater && r.grounded && vf > 5) splash(r, clamp(vf / 25, 0.3, 1.2));
  r.inWater = inW;
  // fell into a ravine: out of the race for a moment, back on the far side
  { const rv = ravineAt(r.q.s, r.q.l); if (rv && r.y < rv.y0 - 2.6) { r.respawnS = rv.s + rv.hw + 8; crash(r, 'fall'); if (r.isPlayer) showMsg('谷に落ちた！', 'bad'); return; } }
  // fire rings over the big kickers
  { const B = CR.B[Math.floor(r.q.s / BKT)];
    if (B) for (let k = 0; k < B.length; k++) { const f = B[k]; if (f.ft !== 'ramp' || !f.ring) continue; const g = f.ring;
      if (r.sPrev < g.s && r.q.s >= g.s && r.sPrev > g.s - 6) {
        const d = Math.hypot(r.q.l - f.lc, r.y + 0.7 - g.y);
        if (d < g.r - 0.25) { r.style += 200; r.boostT = Math.max(r.boostT, 1.1); r.stats.rings = (r.stats.rings || 0) + 1; ringFx(g, r); if (r.isPlayer) { showMsg('リング通過！', 'good'); AU.sfx('boost', 0.8); } }
      } }
    r.sPrev = r.q.s; }
  // obstacles, progress, rpm
  collideObstacles(r, dt); if (r.crash) return;
  collideDynamic(r); if (r.crash) return;
  r.prog = r.q.s - CR.sStart;
  updateRpm(r, dt);
  // stuck / wrong way / out of world
  if (r.y < gh - 4 || !isFinite(r.x + r.z + r.y + r.vx + r.vz)) respawn(r);
  const dirDot = Math.sin(r.psi) * CR.tx[r.q.i] + Math.cos(r.psi) * CR.tz[r.q.i];
  r.wrongT = dirDot < -0.2 && Math.abs(vf) > 2 ? r.wrongT + dt : Math.max(0, r.wrongT - dt * 2);
  if (inp.thr > 0 && Math.abs(vf) < 1.2 && GAME.state === 'race') r.stuckT += dt; else r.stuckT = Math.max(0, r.stuckT - dt);
  if (r.stuckT > 3.5 || r.wrongT > 6) respawn(r);
  for (const [o, t] of r.hitCD) { if (GAME.t - t > 1.5) r.hitCD.delete(o); }
}
function updateRpm(r, dt) {
  // 5-speed box: rpm climbs through each gear, drops on the shift
  const v = Math.max(0, r.spd), top = [0, 9, 15, 21, 27, 40];
  let g = r.gear;
  while (g < 5 && v > top[g] * 0.97) g++;
  while (g > 1 && v < top[g - 1] * 0.8) g--;
  if (g !== r.gear) { if (g > r.gear && r.isPlayer) AU.sfx('shift', 0.6); r.gear = g; }
  const lo = top[g - 1] * 0.8, span = top[g] - lo;
  let target = clamp((v - lo) / span, 0, 1) * 0.78 + 0.18;
  if (!r.grounded) target = r.inp.thr > 0 ? 1.0 : 0.3;
  else if (r.inp.thr > 0) target += 0.08;
  if (r.surf === SURF.MUD || r.surf === SURF.SAND) target += r.inp.thr * 0.08;
  r.rpm = damp(r.rpm, target, r.grounded ? 9 : 4, dt);
}
function land(r, gh, grate) {
  const impact = grate - r.vy, air = r.airT;
  r.y = gh; r.vy = grate; r.grounded = true;
  const hf = groundAhead(r, 0.75), hb = groundAhead(r, -0.72), gp = Math.atan2(hf - hb, 1.47);
  const err = Math.abs(r.pitch - gp);
  r.compV += Math.min(impact, 16) * 0.22;
  let vf = r.spd, sloppy = false;
  // came down in the middle of a trick
  if (r.trick) {
    const u = r.trick.t / r.trick.dur, rem = Math.min(u, 1 - u) * TAU, wasFlip = r.trick.kind !== 'spin';
    r.trick = null; r.flipA = 0; r.spinA = 0;
    if (rem > (wasFlip ? 0.95 : 1.25)) { r.airTricks.length = 0; r.whipT = 0; crash(r, 'trick'); return; }
    sloppy = true;
  }
  if (Math.abs(r.whip) > 0.5) sloppy = true; else if (r.whipT > 0.32) trickDone(r, 'whip');
  r.whipT = 0;
  if (air > 0.3) {
    if (err > 0.95 && air > 0.55) { r.airTricks.length = 0; crash(r, 'land'); return; }
    if (err < 0.2 && air > 0.45 && !sloppy) { vf += 1.2; r.style += 50; if (r.isPlayer && GAME.t - r.lastNice > 1.2 && !r.airTricks.length) { r.lastNice = GAME.t; r.stats.nice++; showMsg(air > 0.9 ? 'ナイスランディング！' : 'ナイス着地', 'good'); AU.sfx('nice', 0.8); } }
    else if (err > 0.45 || sloppy) { vf *= 0.8; r.wobble = 0.7; if (r.isPlayer) showMsg('着地が乱れた', 'bad s'); }
    if (impact > 14) vf *= 1 - Math.min(0.3, (impact - 14) * 0.03);
    if (air > 1.3) r.style += 100;
  }
  // tricks landed clean: boost
  if (r.airTricks.length) {
    if (!sloppy && err < 0.6) { r.boostT = Math.min(2.6, 0.9 + 0.55 * r.airTricks.length); if (r.isPlayer) { showMsg('ブースト！', 'good s'); AU.sfx('boost', 1); } else AU.sfx('boost', soundVol(r) * 0.5); }
    r.airTricks.length = 0;
  }
  r.spd = vf; const fx = Math.sin(r.psi), fz = Math.cos(r.psi), vl = r.vx * -fz + r.vz * fx; r.vx = fx * vf - fz * vl; r.vz = fz * vf + fx * vl;
  r.landFx = clamp(impact / 9, 0.2, 1.6) * (air > 0.2 ? 1 : 0.4);
  const vol = soundVol(r);
  if (air > 0.18) AU.sfx('land', clamp(impact / 10, 0.25, 1.1) * vol);
  if (r.isPlayer) CAM.shake = Math.max(CAM.shake, clamp(impact / 12, 0.1, 0.9));
  landDust(r, r.landFx);
}
function soundVol(r) { const d = Math.hypot(r.x - camera.position.x, r.z - camera.position.z); return r === CAM.target ? 1 : clamp(1 - d / 110, 0, 1) * 0.7; }

// ---------- obstacles ----------
function collideObstacles(r, dt) {
  if (r.ghost > 0) return;
  const OB = CR.OB, s = r.q.s, l = r.q.l;
  for (let i = obsFrom(s - 2.5); i < OB.length && OB[i].s < s + 2.5; i++) {
    const o = OB[i]; if (o.gone || r.hitCD.has(o)) continue;
    let hit = false;
    if (o.type === 'log' || o.type === 'fence') {
      if (l < o.l0 - 0.25 || l > o.l1 + 0.25) continue;
      if (Math.abs(s + 0.5 - o.s) > o.r + 0.35) continue;
      if (r.y > (o.type === 'fence' ? o.top - 0.1 : o.y + o.r * 1.7)) continue;
      hit = true;
    } else {
      const d = Math.hypot((s + 0.4 - o.s) * 0.9, l - o.l);
      if (d > o.r + 0.42) continue;
      if (r.y > o.top - 0.12) continue;
      hit = true;
    }
    if (!hit) continue;
    r.hitCD.set(o, GAME.t); r.stats.hits++;
    hitObstacle(r, o);
    if (r.crash) return;
  }
}
function hitObstacle(r, o) {
  const vf = Math.max(0, r.spd), vol = soundVol(r);
  const fx = Math.sin(r.psi), fz = Math.cos(r.psi);
  const setV = (nv) => { const vl = r.vx * -fz + r.vz * fx; r.spd = nv; r.vx = fx * nv - fz * vl; r.vz = fz * nv + fx * vl; };
  const pushSide = (k) => { const fr = frameAt(r.q.s, _fq), sd = r.q.l >= o.l ? 1 : -1; r.vx += fr.rx * sd * k; r.vz += fr.rz * sd * k; };
  const hop = (vy) => { if (r.grounded) { r.grounded = false; r.airT = 0.05; r.vy = vy; r.y += 0.05; } else r.vy = Math.max(r.vy, vy * 0.6); };
  switch (o.type) {
    case 'rock':
      setV(vf * 0.84); hop(1.6 + vf * 0.055); pushSide(1.6); r.wobble = Math.max(r.wobble, 0.4);
      AU.sfx('rock', vol); chips(r, o, 8); if (r.isPlayer) CAM.shake = Math.max(CAM.shake, 0.35);
      break;
    case 'log':
      if (vf > 10) { setV(vf * (o.full ? 0.95 : 0.88)); hop(1.8 + vf * (o.tree ? 0.12 : 0.09)); r.wobble = Math.max(r.wobble, o.tree ? 0.45 : 0.25); }
      else { setV(Math.max(2.5, vf * 0.4)); hop(2.6); r.wobble = 0.5; }
      AU.sfx('log', vol); chips(r, o, 5); if (r.isPlayer) CAM.shake = Math.max(CAM.shake, 0.4);
      break;
    case 'stump':
      if (vf > o.crashV) { crash(r, 'obj', o); return; }
      setV(vf * 0.45); hop(2.4); pushSide(2); r.wobble = 0.7; AU.sfx('bump', vol);
      break;
    case 'hay':
      setV(vf * 0.42); pushSide(3.5); r.wobble = 0.6; AU.sfx('hay', vol); hayBits(r, o);
      break;
    case 'crate':
      o.gone = true; if (o.mesh) o.mesh.visible = false; setV(vf * 0.74); r.wobble = Math.max(r.wobble, 0.4); AU.sfx('smash', vol); r.style += 30;
      spawnDebris(o.x, o.y + 0.4, o.z, 12, 0xb08a58, fx * vf, fz * vf, 0.5, 0.42, 0.12, r.q.i); spawnDebris(o.x, o.y + 0.4, o.z, 4, 0x6a4a2a, fx * vf, fz * vf, 0.7, 0.1, 0.1, r.q.i);
      if (r.isPlayer) CAM.shake = Math.max(CAM.shake, 0.5);
      break;
    case 'fence': {
      o.gone = true; if (o.mesh) o.mesh.visible = false; setV(vf * 0.84); r.wobble = Math.max(r.wobble, 0.3); AU.sfx('smash', vol * 0.8);
      const p0 = worldAt(o.s, o.l0), p1 = worldAt(o.s, o.l1);
      for (let k = 0; k < 5; k++) { const u = (k + 0.5) / 5; spawnDebris(lerp(p0.x, p1.x, u), o.y + 0.5, lerp(p0.z, p1.z, u), 2, k % 2 ? 0xff6a10 : 0xf2f2f2, fx * vf, fz * vf, 1.0, 0.14, 0.06, r.q.i); }
      if (r.isPlayer) CAM.shake = Math.max(CAM.shake, 0.4);
      break; }
    case 'barrel':
      o.gone = true; setV(vf * 0.7); r.wobble = 0.45; AU.sfx('clang', vol);
      SCN.dyn.push({ o, vx: fx * vf * 0.7 + (Math.random() - 0.5) * 3, vy: 3 + vf * 0.12, vz: fz * vf * 0.7 + (Math.random() - 0.5) * 3, wx: (Math.random() - 0.5) * 12, wz: (Math.random() - 0.5) * 12 });
      break;
    default:   // boulder, tree, cactus
      if (vf > o.crashV) { crash(r, 'obj', o); return; }
      setV(-1.5); pushSide(2.5); r.wobble = 0.8; AU.sfx('bump', vol); chips(r, o, 6);
  }
  if (r.isPlayer && !r.crash) { const M = { rock: '岩にヒット', hay: 'わらにつっこんだ', barrel: 'ドラム缶を倒した', stump: '切り株にヒット', crate: '木箱をふきとばした', fence: '柵をつきやぶった' }; if (M[o.type]) showMsg(M[o.type], 'bad s'); }
}

// ---------- crash & respawn ----------
function crash(r, kind, o) {
  if (r.crash) return;
  r.stats.crash++;
  if (GAME.crashLog) GAME.crashLog.push({ who: r.rd.short, kind, type: o ? o.type : '', s: Math.round(r.q.s), l: +r.q.l.toFixed(1), ol: o ? +(o.l || 0).toFixed(1) : 0, v: +r.spd.toFixed(1), air: !r.grounded, pitch: +r.pitch.toFixed(2), lane: +r.ai.lane.toFixed(1), cost: +(r.ai.cost || 0).toFixed(1) });
  const b = r.b, vf = Math.max(4, r.spd);
  const fx = Math.sin(r.psi), fz = Math.cos(r.psi);
  // detach the rider into the world
  b.root.updateMatrixWorld(true);
  const rg = b.rider.grp; const m = rg.matrixWorld.clone();
  scene.add(rg); m.decompose(rg.position, rg.quaternion, rg.scale);
  r.crash = {
    t: 0, kind,
    rv: new THREE.Vector3(fx * vf * 0.75 + (Math.random() - 0.5) * 2, 3 + vf * 0.12, fz * vf * 0.75 + (Math.random() - 0.5) * 2), rw: new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 9),
    bv: new THREE.Vector3(fx * vf * 0.35, 2 + vf * 0.06, fz * vf * 0.35), bw: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3, (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 4)),
    bq: new THREE.Quaternion().copy(b.root.quaternion), bp: new THREE.Vector3(r.x, r.y, r.z),
  };
  if (o && o.type !== 'log' && kind === 'obj') { r.crash.bv.multiplyScalar(-0.35); r.crash.bv.y = 2.5; }
  r.spd = 0; r.vx = 0; r.vz = 0;
  AU.sfx('crash', soundVol(r));
  crashDust(r);
  if (kind === 'fall') { r.crash.bv.set(fx * vf * 0.6, r.vy, fz * vf * 0.6); r.crash.rv.set(fx * vf * 0.6, r.vy + 1, fz * vf * 0.6); }
  if (r.isPlayer) { if (kind !== 'fall') showMsg('クラッシュ！', 'bad'); CAM.shake = 1; flash(0.25); }
}
const _cq = {}, _eu = new THREE.Euler(), _qq = new THREE.Quaternion(), _vv2 = new THREE.Vector3();
function stepCrash(r, dt) {
  const c = r.crash; c.t += dt;
  const rg = r.b.rider.grp, root = r.b.root;
  // rider
  c.rv.y -= GRAV * dt; rg.position.addScaledVector(c.rv, dt);
  queryLocal(rg.position.x, rg.position.z, r.q.i, 10, _cq);
  const hm = c.kind === 'fall' ? 1 : 2, gy = H(_cq.s, _cq.l, rg.position.x, rg.position.z, hm);
  if (rg.position.y < gy + 0.25) { rg.position.y = gy + 0.25; c.rv.y = Math.abs(c.rv.y) * 0.25; c.rv.x *= 0.75; c.rv.z *= 0.75; c.rw.multiplyScalar(0.7); }
  _qq.setFromEuler(_eu.set(c.rw.x * dt, c.rw.y * dt, c.rw.z * dt)); rg.quaternion.multiply(_qq);
  // bike
  c.bv.y -= GRAV * dt; c.bp.addScaledVector(c.bv, dt);
  queryLocal(c.bp.x, c.bp.z, r.q.i, 10, _cq);
  const gb = H(_cq.s, _cq.l, c.bp.x, c.bp.z, hm);
  if (c.bp.y < gb + 0.2) { c.bp.y = gb + 0.2; c.bv.y = Math.abs(c.bv.y) * 0.2; c.bv.x *= 0.7; c.bv.z *= 0.7; c.bw.multiplyScalar(0.6); }
  _qq.setFromEuler(_eu.set(c.bw.x * dt, c.bw.y * dt, c.bw.z * dt)); c.bq.multiply(_qq);
  r.x = c.bp.x; r.z = c.bp.z; r.y = c.bp.y; r.q.i = _cq.i; r.q.s = _cq.s; r.q.l = _cq.l;
  r.rpm = damp(r.rpm, 0.12, 3, dt);
  if (c.t > 1.3) respawn(r);
}
function respawn(r) {
  const OB = CR.OB;
  let s = clamp(r.respawnS !== undefined ? r.respawnS : r.q.s - 2, CR.sStart, CR.L - 30); r.respawnS = undefined;
  // find a lane clear of obstacles for the next 8 m
  const w = wAtS(s);
  let best = 0, bc = 1e9;
  for (let l = -w + 1; l <= w - 1; l += 0.5) {
    let c = Math.abs(l) * 0.05;
    for (let i = obsFrom(s - 2); i < OB.length && OB[i].s < s + 9; i++) { const o = OB[i]; if (o.gone) continue; if (o.l0 !== undefined ? (l > o.l0 - 0.6 && l < o.l1 + 0.6) : Math.abs(l - o.l) < o.r + 1.0) c += 10; }
    if (c < bc) { bc = c; best = l; }
  }
  if (r.crash) { r.b.body.add(r.b.rider.grp); r.b.rider.grp.position.set(0, 0, 0); r.b.rider.grp.quaternion.identity(); r.b.rider.grp.scale.set(1, 1, 1); }
  r.crash = null;
  placeRacer(r, s, best, 5);   // restart rolling so the time lost stays short
  r.ghost = 1.4; r.wobble = 0; r.stuckT = 0; r.wrongT = 0; r.ai.lane = best; r.ai.planT = 0;
}

// ---------- race update ----------
function updateRace(dt) {
  const racing = GAME.state === 'race' || GAME.state === 'finish' || GAME.state === 'title' || GAME.state === 'results';
  for (const r of GAME.racers) {
    if (!racing) { r.inp.thr = GAME.state === 'countdown' ? (r.auto ? (GAME.countT < 1.2 ? 1 : 0.4 + 0.3 * Math.sin(GAME.t * 7 + r.i)) : r.inp.thr) : 0; r.inp.steer = 0; continue; }
    if (r.auto || r.finished) aiControl(r, dt); else playerControl(r);
  }
  if (!racing) { for (const r of GAME.racers) { if (r.isPlayer && !r.auto) playerControl(r); updateRpmIdle(r, dt); r.inp.steer = 0; } return; }
  for (const r of GAME.racers) stepRacer(r, dt);
  // bike-to-bike contact
  const R = GAME.racers;
  for (let a = 0; a < R.length; a++) for (let b = a + 1; b < R.length; b++) {
    const A = R[a], B = R[b]; if (A.crash || B.crash || A.ghost > 0 || B.ghost > 0) continue;
    const dx = B.x - A.x, dz = B.z - A.z, d2 = dx * dx + dz * dz;
    if (d2 > 1.6 || Math.abs(A.y - B.y) > 1) continue;
    const d = Math.sqrt(d2) || 0.01, push = (1.26 - d) * 0.5; if (push <= 0) continue;
    const nx = dx / d, nz = dz / d;
    A.x -= nx * push; A.z -= nz * push; B.x += nx * push; B.z += nz * push;
    const rel = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
    if (rel < 0) { A.vx += nx * rel * 0.5; A.vz += nz * rel * 0.5; B.vx -= nx * rel * 0.5; B.vz -= nz * rel * 0.5; }
    A.wobble = Math.max(A.wobble, 0.25); B.wobble = Math.max(B.wobble, 0.25);
  }
  // finish line
  for (const r of R) {
    if (!r.finished && r.q.s >= CR.sFin && !r.crash) {
      r.finished = true; r.finishT = GAME.raceT; r.place = ++GAME.finCount;
      if (r.isPlayer && GAME.state === 'race') onPlayerFinish();
    }
  }
  rankRacers();
  // rubber band (light) for rivals while the player races
  if (GAME.state === 'race' && !GAME.player.finished) {
    const base = stageAI(STAGE_I).vmul;
    for (const r of R) { if (r.isPlayer) continue; const gap = r.prog - GAME.player.prog; r.ai.vmul = base + r.rd.vm + (gap > 70 ? -0.025 : gap < -90 ? 0.03 : 0); }
  }
}
function updateRpmIdle(r, dt) { const tgt = r.inp.thr > 0 ? 0.55 + 0.4 * r.inp.thr : 0.14; r.rpm = damp(r.rpm, tgt, 6, dt); }
function rankRacers() {
  const arr = GAME.racers.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.place - b.place;
    if (a.finished) return -1; if (b.finished) return 1;
    return b.prog - a.prog;
  });
  arr.forEach((r, k) => { r.rank = k + 1; });
  GAME.order = arr;
}
// estimated finishing order for riders still out on course when results show
function finalOrder() {
  const fin = GAME.racers.filter((r) => r.finished).sort((a, b) => a.place - b.place);
  const rest = GAME.racers.filter((r) => !r.finished).map((r) => {
    const rem = Math.max(0, CR.sFin - r.q.s), v = 22 * r.ai.vmul;
    return { r, est: GAME.raceT + rem / v + (r.crash ? 2 : 0) };
  }).sort((a, b) => a.est - b.est);
  rest.forEach((e) => { e.r.estT = e.est; });
  return fin.map((r) => ({ r, t: r.finishT, est: false })).concat(rest.map((e) => ({ r: e.r, t: e.est, est: true })));
}
