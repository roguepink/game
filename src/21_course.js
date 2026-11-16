// ===================== Course (point-to-point, generated per stage) =====================
const SURF = { DIRT: 0, GRAVEL: 1, SAND: 2, MUD: 3, GRASS: 4, WATER: 5, ROCK: 6 };
const SURF_NAME = ['ダート', '砂利', '砂', '泥', '草地', '水', 'ガレ場'];
// v: top speed, a: acceleration, grip: lateral grip (1/s), rough: vibration
const SP = [
  { v: 1.00, a: 1.00, grip: 7.0, rough: 0.45 },
  { v: 0.95, a: 0.92, grip: 3.3, rough: 0.75 },
  { v: 0.78, a: 0.70, grip: 3.0, rough: 0.3 },
  { v: 0.66, a: 0.58, grip: 2.4, rough: 0.35 },
  { v: 0.80, a: 0.82, grip: 4.8, rough: 0.6 },
  { v: 0.60, a: 0.60, grip: 4.2, rough: 0.35 },
  { v: 0.80, a: 0.82, grip: 5.0, rough: 1.15 },
];
let CR = null, STAGE = null, THEME = null, STAGE_I = 0;
const CR_DBG = {};
const PRE = 60, RUNOUT = 260, BKT = 40;   // bucket size for feature lookup

function pickW(mix, R) {
  let tot = 0; for (const k in mix) tot += mix[k];
  let x = R() * tot; for (const k in mix) { x -= mix[k]; if (x <= 0) return k; }
  return Object.keys(mix)[0];
}

function buildCourse(si) {
  STAGE_I = si; STAGE = STAGES[si]; THEME = THEMES[STAGE.theme];
  const T = THEME, tt = T.terr, R = mulberry32(STAGE.seed);
  const L = STAGE.len, Ltot = PRE + L + RUNOUT, ds = 2, N = Math.ceil(Ltot / ds) + 1;
  const sStart = PRE, sFin = PRE + L;
  const X = new Float32Array(N), Z = new Float32Array(N), Y = new Float32Array(N), Wd = new Float32Array(N), PSI = new Float32Array(N), KAP = new Float32Array(N), BANK = new Float32Array(N);
  // ---- heading: gentle meanders plus banked sweepers (radius 52..92 m) ----
  const waves = [];
  for (let k = 0; k < 3; k++) { const lam = 520 + R() * 900; waves.push({ lam, ph: R() * TAU, amp: lam / (TAU * 300 * 3) * (0.7 + 0.3 * R()) * tt.twist }); }
  // set pieces (bridges, gap jumps, tunnels) get a straight of their own, spread along the stage
  const setP = (STAGE.set || []).map((type, k, A) => {
    const c = sStart + 330 + (k + 0.5) / A.length * (L - 620), half = type === 'gap' ? [150, 75] : type === 'tunnel' ? [115, 115] : [112, 72];
    return { type, a: c - half[0], b: c + half[1], pad: type === 'tunnel' ? 70 : 45, done: false };
  });
  const turns = [];
  {
    const R2 = mulberry32(STAGE.seed * 3 + 11);
    let st = sStart + 250 + R2() * 120, dir = R2() < 0.5 ? -1 : 1, head = 0;
    const gapT = 300 / tt.twist;
    while (st < sFin - 300) {
      const Rr = 52 + R2() * 40, ang = 0.6 + R2() * 0.8;
      if (Math.abs(head + dir * ang) > 1.15) dir = -dir;
      const len = ang * Rr + 26;
      if (st + len > sFin - 220) break;
      const bl = setP.find((q) => st + len > q.a - q.pad && st < q.b + q.pad);
      if (bl) { st = bl.b + bl.pad + 4; continue; }
      turns.push({ s0: st, s1: st + len, k: dir / Rr, R: Rr, dir });
      head += dir * ang;
      const ess = R2() < 0.4;   // S-bend: the opposite turn follows at once
      st += len + (ess ? 14 + R2() * 20 : gapT * (0.6 + R2() * 0.9));
      dir = ess ? -dir : (R2() < 0.5 ? -dir : dir);
    }
  }
  const turnK = (s) => { let k = 0; for (const t of turns) if (s > t.s0 && s < t.s1) k += t.k * smooth(t.s0, t.s0 + 26, s) * (1 - smooth(t.s1 - 26, t.s1, s)); return k; };
  // straight enough for cross-trail features (creeks, ravines, tunnels, jumps)?
  const isStraight = (a, b, pad) => { for (const t of turns) if (t.s1 > a - (pad || 0) && t.s0 < b + (pad || 0)) return false; return true; };
  let x = 0, z = 0, pt = 0; const wph = R() * TAU;
  for (let i = 0; i < N; i++) {
    const s = i * ds; let p = 0;
    for (const wv of waves) p += wv.amp * (Math.sin(TAU * s / wv.lam + wv.ph) - Math.sin(wv.ph));
    p *= smooth(sStart + 30, sStart + 280, s);
    const kt = turnK(s); pt += kt * ds; p += pt;
    PSI[i] = p; X[i] = x; Z[i] = z;
    x += Math.sin(p) * ds; z += Math.cos(p) * ds;
    let w = 6.3 + 0.9 * Math.sin(s / 170 + wph) + 0.5 * Math.sin(s / 61 + wph * 2) + 1.7 * Math.min(1, Math.abs(kt) * 60);
    w = lerp(10.5, w, smooth(sStart + 20, sStart + 160, s));
    w = lerp(w, 9.5, smooth(sFin - 90, sFin - 20, s));
    Wd[i] = w;
  }
  for (let i = 0; i < N; i++) { const a = Math.max(0, i - 2), b = Math.min(N - 1, i + 2); KAP[i] = (PSI[b] - PSI[a]) / ((b - a) * ds); BANK[i] = clamp(KAP[i] * 22, -0.36, 0.36); }
  // ---- base elevation ----
  const hw = [];
  for (let k = 0; k < 4; k++) { const lam = 160 + R() * 380; hw.push({ lam, ph: R() * TAU, A: tt.hill * (1.2 + 2.2 * R()) * (lam / 400) }); }
  // long climbs and descents (mountain feel)
  { const R3 = mulberry32(STAGE.seed * 5 + 7), cl = tt.climb === undefined ? 5 + 6 * tt.hill : tt.climb;
    hw.push({ lam: 800 + R3() * 500, ph: R3() * TAU, A: cl }, { lam: 430 + R3() * 200, ph: R3() * TAU, A: cl * 0.45 }); }
  for (let i = 0; i < N; i++) {
    const s = i * ds; let y = 0;
    for (const h of hw) y += h.A * Math.sin(TAU * s / h.lam + h.ph);
    y *= smooth(sStart - 30, sStart + 140, s) * (1 - smooth(sFin - 120, sFin - 10, s));
    Y[i] = 20 + y + tt.trend * s;
  }
  // ---- plan sections ----
  const F = { ramps: [], whoops: [], creeks: [], rivers: [], puddles: [], zones: [], crests: [], drops: [], marks: [], excl: [], ravines: [], tunnels: [], dyn: [] };
  const OB = [];
  const wAtS = (s) => Wd[clamp(Math.round(s / ds), 0, N - 1)];
  const excl = (a, b) => F.excl.push([a, b]);
  const isExcl = (s, pad) => { for (const e of F.excl) if (s > e[0] - (pad || 0) && s < e[1] + (pad || 0)) return true; return false; };
  // gap check: an obstacle may not close the trail; keep a free lane >= 3 m
  function canPlace(o) {
    const s = o.s, near = [];
    for (const p of OB) if (Math.abs(p.s - s) < 12) near.push(p);
    for (const p of near) {
      if (o.l0 !== undefined || p.l0 !== undefined) continue;
      if (Math.hypot(p.s - s, p.l - o.l) < p.r + o.r + 0.8) return false;
    }
    const w = wAtS(s) - 0.3, iv = [];
    for (const p of near.concat([o])) {
      if (p.l0 !== undefined) iv.push([p.l0 - 0.4, p.l1 + 0.4]);
      else iv.push([p.l - p.r - 0.45, p.l + p.r + 0.45]);
    }
    iv.sort((a, b) => a[0] - b[0]);
    let cur = -w, best = 0;
    for (const v of iv) { if (v[0] > cur) best = Math.max(best, v[0] - cur); cur = Math.max(cur, v[1]); }
    best = Math.max(best, w - cur);
    return best >= 3.2;
  }
  function addOb(o, force) {
    if (o.s < sStart + 110 || o.s > sFin - 40) return false;
    if (!force && !canPlace(o)) return false;
    OB.push(o); return true;
  }
  const mkRock = (s, l, big) => {
    if (big) { const r = 1.2 + R() * 0.85; return { type: 'boulder', s, l, r, h: r * 1.05, crashV: 11, k: Math.floor(R() * 6), rot: R() * TAU }; }
    const r = 0.45 + R() * 0.32; return { type: 'rock', s, l, r, h: r * 0.8, k: Math.floor(R() * 6), rot: R() * TAU };
  };
  const mkScatter = (type, s, l) => {
    switch (type) {
      case 'rock': return mkRock(s, l, false);
      case 'boulder': return mkRock(s, l, true);
      case 'stump': return { type: 'stump', s, l, r: 0.45 + R() * 0.12, h: 0.6 + R() * 0.35, crashV: 15, rot: R() * TAU };
      case 'hay': return { type: 'hay', s, l, r: 0.95, h: 1.5, rot: R() * TAU };
      case 'cactus': return { type: 'cactus', s, l, r: 0.42, h: 2.6 + R() * 1.8, crashV: 10, rot: R() * TAU };
      case 'barrel': return { type: 'barrel', s, l, r: 0.4, h: 1.1, rot: R() * TAU };
      case 'log': { const len = 3 + R() * 1.8, c = l; return { type: 'log', s, l: c, l0: c - len / 2, l1: c + len / 2, r: 0.27 + R() * 0.1, h: 0.5, short: true, rot: (R() - 0.5) * 0.5 }; }
    }
    return mkRock(s, l, false);
  };
  const ndx = (n) => (R() * 2 - 1) * n;

  let s = sStart + 170;
  const sEnd = sFin - 120;
  const dens = STAGE.dens;
  let lastType = '';
  while (s < sEnd) {
    let type = pickW(STAGE.mix, R);
    if (type === lastType && R() < 0.6) type = pickW(STAGE.mix, R);
    // the next set piece: nothing may run into its straight
    const sp = setP.find((q) => !q.done);
    let spNow = false;
    if (sp) {
      const room = sp.a - s, LEN = { river: 290, sand: 160, mud: 140, crest: 125, rocks: 115, trees: 115, logs: 110 };
      if (room < 60) { s = Math.max(s, sp.a); type = sp.type === 'tunnel' ? 'tunnel' : 'ravine'; sp.done = true; spNow = true; }
      else if (room < (LEN[type] || 95)) { s = sp.a; type = sp.type === 'tunnel' ? 'tunnel' : 'ravine'; sp.done = true; spNow = true; }
    }
    // jumps and water crossings need a straight piece of trail
    if (!spNow && (type === 'tunnel' || type === 'ravine')) type = 'plain';
    if (!spNow) { const NEED = { jump: [70, 6], crest: [110, 6], drop: [70, 6], creek: [80, 60], river: [270, 50], ravine: [150, 45], tunnel: [130, 70] };
      let nd = NEED[type], tries = 0;
      while (nd && !isStraight(s - 10, s + nd[0], nd[1]) && tries++ < 6) { type = pickW(STAGE.mix, R); nd = NEED[type]; }
      if (nd && !isStraight(s - 10, s + nd[0], nd[1])) type = 'plain'; }
    lastType = type;
    let used = 40;
    if (type === 'jump') {
      const kr = R(), w = wAtS(s);
      let f;
      if (kr < 0.24) f = { kind: 'kicker', s: s + 10, H: 0.9 + R() * 0.6, Lr: 6 + R() * 2, Ld: 2.6 };
      else if (kr < 0.46) f = { kind: 'table', s: s + 12, H: 1.6 + R() * 0.8, Lr: 9 + R() * 2, Lt: 10 + R() * 6, Ld: 9 };
      else if (kr < 0.64) f = { kind: 'double', s: s + 10, H: 1.5 + R() * 0.7, Lr: 7, Ld: 4.5, gap: 9 + R() * 4, Lr2: 4.5, Ld2: 9 };
      else {
        // a big wooden kicker on one side of the trail: take it for air and tricks, or ride round it
        const Lr = 12 + R() * 2, hwr = 3.3, lim = Math.max(0, w - hwr - 1.6);
        f = { kind: 'wood', s: s + Lr + 14, H: 2.7 + R() * 0.8, Lr, lc: (R() < 0.5 ? -1 : 1) * R() * lim, hwr };
        if (R() < 0.7) f.ring = { s: f.s + 9.5, r: 2.5, dy: f.H + 2.1 };
      }
      const len = f.kind === 'table' ? f.Lt + f.Ld : f.kind === 'double' ? f.Ld + f.gap + f.Lr2 + f.Ld2 : f.kind === 'wood' ? 1 : f.Ld;
      f.a = f.s - f.Lr - 1; f.b = f.s + len + 1;
      F.ramps.push(f); excl(f.s - f.Lr - (f.kind === 'wood' ? 30 : 12), f.s + len + (f.kind === 'wood' ? 55 : 30)); F.marks.push({ s: f.s, type: f.kind === 'wood' ? 'bigjump' : 'jump' });
      used = f.Lr + len + (f.kind === 'wood' ? 70 : 26);
      void w;
    } else if (type === 'crest') {
      const Hc = (3.5 + R() * 3.5) * Math.min(1.3, tt.hill), Lu = 40 + R() * 20, Ld = 30 + R() * 10;
      F.crests.push({ s: s + Lu, Hc, Lu, Ld }); excl(s + Lu - 6, s + Lu + 50); F.marks.push({ s: s + Lu, type: 'crest' });
      used = Lu + Ld + 10;
    } else if (type === 'drop') {
      const D = 2.4 + R() * 1.6;
      F.drops.push({ s: s + 20, D }); excl(s + 6, s + 56); F.marks.push({ s: s + 20, type: 'drop' });
      used = 60;
    } else if (type === 'ravine') {
      // a deep cut across the trail: either a narrow plank bridge, or a lip to jump it
      const bridge = sp.type === 'bridge', ph = R() * TAU;
      if (bridge) {
        const hw = 7 + R() * 4, f = { s: s + 55 + hw, hw, D: 9 + R() * 5, deck: true, bw: 2.5 + R() * 0.5, flare: 5 + R() * 6, mea: 6 + R() * 8, ph };
        F.ravines.push(f); excl(f.s - hw - 55, f.s + hw + 26); F.marks.push({ s: f.s, type: 'bridge' });
        used = 2 * hw + 86;
      } else {
        const vexp = BIKE.vmax * SP[SURF[T.base]].v * stageAI(si).vmul * 0.92, range = vexp * vexp * 0.58 / GRAV;
        const hw = clamp(0.3 * range, 3, 6.5), f = { s: s + 95 + hw, hw, D: 9 + R() * 5, deck: false, bw: 0, flare: 7 + R() * 6, mea: 6 + R() * 8, ph };
        F.ravines.push(f);
        const rp = { kind: 'lip', s: f.s - hw - 0.4, H: 1.6 + R() * 0.4, Lr: 9 }; rp.a = rp.s - rp.Lr - 1; rp.b = rp.s + 1; F.ramps.push(rp);
        F.drops.push({ s: f.s - hw, D: 0.9, len: 2 * hw });
        excl(f.s - hw - 80, f.s + hw + 36); F.marks.push({ s: f.s, type: 'gap' });
        used = 2 * hw + 135;
      }
    } else if (type === 'tunnel') {
      const len = 46 + R() * 34, f = { s0: s + 30, s1: s + 30 + len, Hr: 11 + R() * 5 };
      F.tunnels.push(f); excl(f.s0 - 16, f.s0 + 6); excl(f.s1 - 6, f.s1 + 16); F.marks.push({ s: f.s0 + len / 2, type: 'tunnel' });
      used = len + 62;
    } else if (type === 'creek') {
      const c = { s: s + 34, hw: 4.5 + R() * 2.5, D: 2.2 + R() * 0.8, wd: 0.45 + R() * 0.15, mea: 4 + R() * 6, ph: R() * TAU };
      F.creeks.push(c); excl(c.s - c.hw - 8, c.s + c.hw + 8); F.marks.push({ s: c.s, type: 'water' });
      used = 72;
    } else if (type === 'river') {
      const len = 90 + R() * 70, r = { s0: s + 40, s1: s + 40 + len, wd: 0.42 };
      F.rivers.push(r); F.marks.push({ s: r.s0 + 20, type: 'water' }, { s: r.s0 + len * 0.6, type: 'water' });
      // a few rocks in the river bed
      for (let k = 0; k < Math.round(len / 30 * dens); k++) addOb(mkRock(r.s0 + 10 + R() * (len - 20), ndx(wAtS(r.s0) - 1.5), R() < 0.4));
      excl(r.s0 - 40, r.s0 + 6); excl(r.s1 - 6, r.s1 + 40);
      used = len + 90;
    } else if (type === 'rocks') {
      const len = 50 + R() * 45, s0 = s + 6;
      F.zones.push({ type: SURF.ROCK, s0, s1: s0 + len, l0: -20, l1: 20 });
      const n = Math.round(len / 4.2 * (0.7 + 0.3 * dens));
      for (let k = 0; k < n; k++) { const ss = s0 + R() * len; addOb(mkRock(ss, ndx(wAtS(ss) - 0.4), R() < 0.22 + 0.04 * dens)); }
      F.marks.push({ s: s0 + len / 2, type: 'rocks' });
      used = len + 12;
    } else if (type === 'whoops') {
      const len = 40 + R() * 30, f = { s0: s + 4, s1: s + 4 + len, P: 6.5 + R() * 1.5, A: 0.35 + R() * 0.25 };
      f.s1 = f.s0 + Math.round(len / f.P) * f.P;
      F.whoops.push(f); F.marks.push({ s: f.s0 + 10, type: 'whoops' });
      used = len + 10;
    } else if (type === 'logs') {
      const n = 2 + Math.floor(R() * 3); let ss = s + 8;
      for (let k = 0; k < n; k++) {
        const w = wAtS(ss), full = R() < 0.22, fromL = R() < 0.5, cover = (0.45 + R() * 0.25) * 2 * w;
        const o = full ? { type: 'log', s: ss, l0: -w - 1.5, l1: w + 1.5, r: 0.22 + R() * 0.06, h: 0.5, full: true }
          : { type: 'log', s: ss, l0: fromL ? -w - 3 : w - cover, l1: fromL ? -w + cover : w + 3, r: 0.34 + R() * 0.14, h: 0.75, tree: true, fromL };
        o.l = (o.l0 + o.l1) / 2; o.rot = (R() - 0.5) * 0.35;
        if (full) addOb(o, true); else if (!addOb(o)) { const c = (o.l0 + o.l1) / 2; o.l0 = c + (o.l0 - c) * 0.75; o.l1 = c + (o.l1 - c) * 0.75; addOb(o); }
        ss += 14 + R() * 10;
      }
      F.marks.push({ s: s + 10, type: 'logs' });
      used = ss - s + 6;
    } else if (type === 'puddles') {
      const n = 3 + Math.floor(R() * 3); let ss = s + 6;
      for (let k = 0; k < n; k++) { const w = wAtS(ss), r = 2 + R() * 2.4; F.puddles.push({ s: ss, l: ndx(Math.max(0, w - r * 0.7)), r, dep: 0.22 + R() * 0.12 }); ss += 9 + R() * 12; }
      F.marks.push({ s: s + 10, type: 'water' });
      used = ss - s + 4;
    } else if (type === 'sand') {
      const len = 70 + R() * 70;
      F.zones.push({ type: SURF.SAND, s0: s, s1: s + len, l0: -20, l1: 20 });
      used = len + 6;
    } else if (type === 'mud') {
      const len = 60 + R() * 60, w = wAtS(s + len / 2), side = R();
      // leave a cleaner lane: mud on the left, right or centre
      let l0 = -20, l1 = 20;
      if (side < 0.36) l1 = w - 3.4; else if (side < 0.72) l0 = -w + 3.4; else { l0 = -w + 2.2; l1 = w - 2.2; }
      F.zones.push({ type: SURF.MUD, s0: s, s1: s + len, l0, l1 });
      for (let k = 0; k < 3; k++) { const ss = s + 8 + R() * (len - 16); F.puddles.push({ s: ss, l: clamp((l0 + l1) / 2 + ndx(1.5), -w + 1.5, w - 1.5), r: 1.8 + R() * 1.5, dep: 0.22, mud: true }); }
      F.marks.push({ s: s + 12, type: 'mud' });
      used = len + 8;
    } else if (type === 'trees') {
      const len = 60 + R() * 40, n = Math.round(len / 14);
      for (let k = 0; k < n; k++) { const ss = s + 6 + k * (len / n) + ndx(3); addOb({ type: 'tree', s: ss, l: ndx(wAtS(ss) - 0.8), r: 0.4, h: 11, crashV: 8, rot: R() * TAU }); }
      F.marks.push({ s: s + 15, type: 'trees' });
      used = len + 8;
    } else if (type === 'hay') {
      let ss = s + 8; const n = 3 + Math.floor(R() * 2); let side = R() < 0.5 ? -1 : 1;
      for (let k = 0; k < n; k++) { const w = wAtS(ss); addOb({ type: 'hay', s: ss, l: side * (w - 2.9 - R()), r: 0.95, h: 1.5, rot: R() * TAU }); side = -side; ss += 11 + R() * 4; }
      F.marks.push({ s: s + 10, type: 'hay' });
      used = ss - s + 4;
    } else if (type === 'barrels') {
      let ss = s + 8; const n = 2 + Math.floor(R() * 2);
      for (let k = 0; k < n; k++) {
        const l = ndx(wAtS(ss) - 2);
        for (let j = 0; j < 3; j++) addOb({ type: 'barrel', s: ss + ndx(0.4), l: l + (j - 1) * 0.9, r: 0.4, h: 1.1, rot: R() * TAU });
        ss += 14 + R() * 8;
      }
      F.marks.push({ s: s + 10, type: 'barrels' });
      used = ss - s + 4;
    } else if (type === 'crates') {
      // stacks of wooden crates: smash through (slow) or weave round
      let ss = s + 8; const n = 3 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) { const w = wAtS(ss); addOb({ type: 'crate', s: ss, l: ndx(w - 1.8), r: 1.0, h: 1.7, rot: (R() - 0.5) * 0.5 }); ss += 9 + R() * 7; }
      F.marks.push({ s: s + 10, type: 'crates' });
      used = ss - s + 4;
    } else if (type === 'fences') {
      // plank barriers across part of the trail, alternating sides
      let ss = s + 8; const n = 2 + Math.floor(R() * 2); let side = R() < 0.5 ? -1 : 1;
      for (let k = 0; k < n; k++) {
        const w = wAtS(ss), len = w * (0.9 + R() * 0.35), o = { type: 'fence', s: ss, l0: side < 0 ? -w - 0.5 : w + 0.5 - len, l1: side < 0 ? -w - 0.5 + len : w + 0.5, r: 0.12, h: 1.1, rot: 0 };
        o.l = (o.l0 + o.l1) / 2; addOb(o, true); side = -side; ss += 16 + R() * 8;
      }
      F.marks.push({ s: s + 10, type: 'fences' });
      used = ss - s + 6;
    } else if (type === 'rockfall') {
      // boulders rolling across the trail from the slope
      const n = 2 + Math.floor(R() * 2); let ss = s + 20;
      for (let k = 0; k < n; k++) { F.dyn.push({ kind: 'roll', s: ss, r: 0.9 + R() * 0.5, P: 4.6 + R() * 2.2, ph: R() * 8, dir: R() < 0.5 ? -1 : 1, k: Math.floor(R() * 6) }); ss += 16 + R() * 14; }
      excl(s + 8, ss + 4); F.marks.push({ s: s + 24, type: 'rockfall' });
      used = ss - s + 10;
    } else if (type === 'geyser') {
      const n = 3 + Math.floor(R() * 3); let ss = s + 14;
      for (let k = 0; k < n; k++) { const w = wAtS(ss); F.dyn.push({ kind: 'geyser', s: ss, l: ndx(w - 2), P: 4.6 + R() * 1.2, ph: R() * 6 }); ss += 10 + R() * 9; }
      excl(s + 6, ss + 4); F.marks.push({ s: s + 20, type: 'geyser' });
      used = ss - s + 8;
    } else { used = 50 + R() * 40; }
    s += used + (24 + R() * 40) / (0.7 + 0.3 * dens);
  }
  // ---- scattered obstacles across the whole stage ----
  {
    let ss = sStart + 130;
    while (ss < sFin - 50) {
      ss += (100 / (5 * dens)) * (0.5 + R());
      if (isExcl(ss, 0)) continue;
      let inWater = false; for (const c of F.creeks) if (Math.abs(ss - c.s) < c.hw + 6) inWater = true;
      for (const c of F.ravines) if (Math.abs(ss - c.s) < c.hw + 10) inWater = true;
      if (inWater) continue;
      const type = pickW(STAGE.obst, R), w = wAtS(ss);
      addOb(mkScatter(type, ss, ndx(w - 0.6)));
    }
  }
  // remove obstacles that ended up inside exclusion zones (jump faces / landings)
  for (let i = OB.length - 1; i >= 0; i--) { const o = OB[i]; if (isExcl(o.s, o.r) && o.type !== 'rock') OB.splice(i, 1); }

  // ---- passability: a line must exist that a bike can follow at speed (<= ~14 deg) ----
  {
    const LN = 41, L0 = -10, LD = 0.5, step = 2, crashT = (o) => !!o.crashV;
    OB.sort((a, b) => a.s - b.s);
    let guard = 0;
    for (let pass = 0; pass < 400 && guard < 400; pass++) {
      let reach = new Uint8Array(LN).fill(1), stuckAt = -1, j0 = 0;
      for (let ss = sStart + 60; ss < sFin; ss += step) {
        const w = wAtS(ss) - 0.5, nr = new Uint8Array(LN);
        while (j0 < OB.length && OB[j0].s < ss - 4) j0++;
        let any = false;
        for (let k = 0; k < LN; k++) {
          const l = L0 + k * LD;
          if (Math.abs(l) > w) continue;
          if (!(reach[k] || (k > 0 && reach[k - 1]) || (k < LN - 1 && reach[k + 1]))) continue;
          let blocked = false;
          for (let j = j0; j < OB.length && OB[j].s < ss + 4; j++) { const o = OB[j]; if (!crashT(o)) continue; if (Math.abs(o.s - ss) < o.r + 0.6 && Math.abs(l - o.l) < o.r + 0.55) { blocked = true; break; } }
          if (!blocked) { nr[k] = 1; any = true; }
        }
        if (!any) { stuckAt = ss; break; }
        reach = nr;
      }
      if (stuckAt < 0) break;
      // drop the biggest crash obstacle around the dead end
      let bi = -1, br = -1;
      for (let j = 0; j < OB.length; j++) { const o = OB[j]; if (crashT(o) && o.s > stuckAt - 14 && o.s < stuckAt + 3 && o.r > br) { br = o.r; bi = j; } }
      if (bi < 0) break;
      OB.splice(bi, 1); guard++;
    }
    CR_DBG.removed = guard;
  }
  // ---- profile modifications ----
  for (let i = 0; i < N; i++) {
    const s2 = i * ds;
    for (const c of F.crests) {
      const u = s2 - c.s;
      if (u > -c.Lu && u <= 0) Y[i] += c.Hc * Math.pow((u + c.Lu) / c.Lu, 1.6);
      else if (u > 0 && u < c.Ld) Y[i] += c.Hc * Math.pow(1 - u / c.Ld, 1.5);
    }
    for (const d of F.drops) Y[i] -= d.D * smooth(d.s, d.s + (d.len || 4), s2);
  }
  for (const r of F.rivers) {
    let mn = 1e9; for (let i = Math.max(0, Math.floor((r.s0 - 34) / ds)); i < Math.min(N, Math.ceil((r.s1 + 34) / ds)); i++) mn = Math.min(mn, Y[i]);
    r.bed = mn - 0.8;
    for (let i = 0; i < N; i++) { const s2 = i * ds, wgt = smooth(r.s0 - 34, r.s0 - 4, s2) * (1 - smooth(r.s1 + 4, r.s1 + 34, s2)); if (wgt > 0) Y[i] = lerp(Y[i], r.bed, wgt); }
  }
  for (const c of F.creeks) {
    const Lc = 26;
    for (let i = 0; i < N; i++) { const u = i * ds - c.s; if (Math.abs(u) < Lc) Y[i] -= c.D * 0.5 * (1 + Math.cos(Math.PI * u / Lc)); }
  }
  // smooth elevation (keeps crest lips sharp enough to fly off)
  let Ys = Y;
  for (let p = 0; p < 2; p++) { const B = new Float32Array(N); for (let i = 0; i < N; i++) { let a = 0, n = 0; for (let k = -3; k <= 3; k++) { const j = i + k; if (j >= 0 && j < N) { a += Ys[j]; n++; } } B[i] = a / n; } Ys = B; }
  // frame
  const TX = new Float32Array(N), TZ = new Float32Array(N);
  for (let i = 0; i < N; i++) { TX[i] = Math.sin(PSI[i]); TZ[i] = Math.cos(PSI[i]); }
  // spatial hash for global queries
  const HC = 24, map = new Map(), key = (cx, cz) => (cx + 4096) * 8192 + (cz + 4096);
  for (let i = 0; i < N; i++) { const k = key(Math.floor(X[i] / HC), Math.floor(Z[i] / HC)); let a = map.get(k); if (!a) map.set(k, (a = [])); a.push(i); }
  F.dyn.sort((a, b) => a.s - b.s);
  CR = { N, ds, L: Ltot, sStart, sFin, len: L, x: X, z: Z, y: Ys, w: Wd, psi: PSI, kap: KAP, bank: BANK, turns, tx: TX, tz: TZ, hash: { map, HC, key }, F, OB };
  computeFold();
  // ---- feature buckets ----
  const NB = Math.ceil(Ltot / BKT) + 1; CR.B = []; for (let i = 0; i < NB; i++) CR.B.push([]);
  const reg = (f, a, b) => { for (let k = Math.max(0, Math.floor(a / BKT)); k <= Math.min(NB - 1, Math.floor(b / BKT)); k++) CR.B[k].push(f); };
  for (const f of F.ramps) { f.ft = 'ramp'; reg(f, f.a, f.b); }
  for (const f of F.whoops) { f.ft = 'whoop'; reg(f, f.s0, f.s1); }
  for (const f of F.creeks) { f.ft = 'creek'; f.bed = lerpArr(Ys, f.s / ds); f.wy = f.bed + f.wd; reg(f, f.s - f.hw - 30, f.s + f.hw + 30); }
  for (const f of F.rivers) { f.ft = 'river'; f.wy = f.bed + f.wd; reg(f, f.s0 - 40, f.s1 + 40); }
  for (const f of F.puddles) { f.ft = 'puddle'; reg(f, f.s - f.r * 1.5, f.s + f.r * 1.5); }
  for (const f of F.zones) { f.ft = 'zone'; reg(f, f.s0, f.s1); }
  for (const f of F.ravines) { f.ft = 'ravine'; f.y0 = lerpArr(Ys, f.s / ds); f.floor = f.y0 - f.D; f.wy = f.floor + 0.5; f.deckY = f.y0 + 0.06; reg(f, f.s - f.hw - f.flare - 26, f.s + f.hw + f.flare + 26); }
  for (const f of F.tunnels) { f.ft = 'tunnel'; reg(f, f.s0 - 16, f.s1 + 16); }
  // puddle water levels need the final ground
  for (const p of F.puddles) { const c = worldAt(p.s, p.l); p.wy = H(p.s, p.l, c.x, c.z, false) + p.dep * 0.55; }
  for (const c of F.creeks) {   // the water must cover the trail at the crossing
    const lo = Math.min(H(c.s, 0, CR.x[Math.round(c.s / ds)], CR.z[Math.round(c.s / ds)], false), c.bed); c.wy = Math.max(c.wy, lo + c.wd);
  }
  OB.sort((a, b) => a.s - b.s);
  CR.marks = F.marks.sort((a, b) => a.s - b.s);
  return CR;
}

// ---- where the terrain ribbon would fold over itself (inside of turns): clip rows at the medial axis ----
function computeFold() {
  const N = CR.N, X = CR.x, Z = CR.z, ds = CR.ds, LM = 250;
  const lm = [new Float32Array(N).fill(1e9), new Float32Array(N).fill(1e9)], pa = [new Int32Array(N).fill(-1), new Int32Array(N).fill(-1)];
  const Wn = Math.round(300 / ds), cnt = new Int32Array(N + 1);
  for (let i = 0; i < N; i++) cnt[i + 1] = cnt[i] + (Math.abs(CR.kap[i]) > 0.002 ? 1 : 0);
  const W2 = Math.round(420 / ds);
  let pj = -1;
  const owned = (i, nx, nz, l) => {
    const px = X[i] + nx * l, pz = Z[i] + nz * l, lim = (l - 0.75) * (l - 0.75);
    for (let j = Math.max(0, i - W2); j < Math.min(N, i + W2); j += 2) { const dx = X[j] - px, dz = Z[j] - pz; if (dx * dx + dz * dz < lim) { pj = j; return false; } }
    return true;
  };
  for (let i = 0; i < N; i++) {
    if (cnt[Math.min(N, i + Wn)] - cnt[Math.max(0, i - Wn)] === 0) continue;
    for (let sd = 0; sd < 2; sd++) {
      const sg = sd ? -1 : 1, nx = -CR.tz[i] * sg, nz = CR.tx[i] * sg;
      if (owned(i, nx, nz, LM)) continue;
      let lo = 1, hi = LM;
      for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (owned(i, nx, nz, m)) lo = m; else hi = m; }
      owned(i, nx, nz, hi); lm[sd][i] = lo; pa[sd][i] = pj;
    }
  }
  CR.lm = lm; CR.pa = pa;
}
// clip a lateral offset to the fold limit; returns the usable l (out.clip is set when it was cut)
function foldClip(s, l, out) {
  const i = clamp(Math.round(s / CR.ds), 0, CR.N - 1), sd = l < 0 ? 1 : 0, m = CR.lm[sd][i], al = Math.abs(l);
  out.clip = al > m - 3; out.lm = m; out.pa = CR.pa[sd][i];
  return al > m + 4 ? (l < 0 ? -(m + 4) : m + 4) : l;
}

// ---- array helpers ----
function lerpArr(A, fi) { const n = A.length; fi = clamp(fi, 0, n - 1.0001); const i = Math.floor(fi), f = fi - i; return A[i] * (1 - f) + A[i + 1] * f; }
const yAtS = (s) => lerpArr(CR.y, s / CR.ds);
const wAtS = (s) => lerpArr(CR.w, s / CR.ds);
function frameAt(s, out) {
  out = out || {};
  const fi = clamp(s / CR.ds, 0, CR.N - 1.0001), i = Math.floor(fi), f = fi - i;
  out.x = CR.x[i] * (1 - f) + CR.x[i + 1] * f; out.z = CR.z[i] * (1 - f) + CR.z[i + 1] * f;
  const tx = CR.tx[i] * (1 - f) + CR.tx[i + 1] * f, tz = CR.tz[i] * (1 - f) + CR.tz[i + 1] * f, n = Math.hypot(tx, tz) || 1;
  out.tx = tx / n; out.tz = tz / n; out.rx = -out.tz; out.rz = out.tx; out.psi = Math.atan2(out.tx, out.tz);
  out.y = CR.y[i] * (1 - f) + CR.y[i + 1] * f; out.w = CR.w[i] * (1 - f) + CR.w[i + 1] * f;
  return out;
}
const _fa = {};
function worldAt(s, l, out) { frameAt(s, _fa); out = out || {}; out.x = _fa.x + _fa.rx * l; out.z = _fa.z + _fa.rz * l; return out; }

// ---- track-space queries (no wrap: open course) ----
function refineQuery(x, z, i, out) {
  const N = CR.N, X = CR.x, Z = CR.z;
  let best = 1e18, bs = i, bl = 0;
  for (let k = -1; k <= 0; k++) {
    const a = clamp(i + k, 0, N - 2), b = a + 1;
    const ax = X[a], az = Z[a], ex = X[b] - ax, ez = Z[b] - az, el2 = ex * ex + ez * ez;
    let t = ((x - ax) * ex + (z - az) * ez) / el2;
    if (a > 0 && t < 0) t = 0; if (b < N - 1 && t > 1) t = 1;
    const dx = x - (ax + ex * t), dz = z - (az + ez * t), d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; bs = a + t; const el = Math.sqrt(el2); bl = (dx * -ez + dz * ex) / el; }
  }
  out.fi = clamp(bs, 0, N - 1.0001); out.s = out.fi * CR.ds; out.l = bl; out.d = Math.sqrt(best); out.i = Math.round(out.fi);
  return out;
}
function queryLocal(x, z, hint, range, out) {
  const N = CR.N, X = CR.x, Z = CR.z;
  let bi = clamp(hint, 0, N - 1), bd = 1e18;
  for (let k = -range; k <= range; k++) {
    const i = hint + k; if (i < 0 || i >= N) continue;
    const dx = x - X[i], dz = z - Z[i], d = dx * dx + dz * dz;
    if (d < bd) { bd = d; bi = i; }
  }
  return refineQuery(x, z, bi, out);
}
function queryGlobal(x, z, out) {
  const { map, HC, key } = CR.hash, X = CR.x, Z = CR.z;
  const cx = Math.floor(x / HC), cz = Math.floor(z / HC);
  let bi = -1, bd = 1e18;
  for (let r = 1; r <= 14 && bi < 0; r++) {
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      if (r > 1 && Math.abs(a) < r && Math.abs(b) < r) continue;
      const arr = map.get(key(cx + a, cz + b)); if (!arr) continue;
      for (let m = 0; m < arr.length; m++) { const i = arr[m], dx = x - X[i], dz = z - Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
    }
  }
  if (bi < 0) { out.d = 1e9; out.s = 0; out.l = 0; out.i = 0; out.fi = 0; return out; }
  return refineQuery(x, z, bi, out);
}

// ---- ground height in track space ----
function featH(s, l, w, al) {
  const lat = 1 - smooth(w - 0.6, w + 2.2, al);
  if (lat <= 0) return 0;
  const B = CR.B[Math.floor(s / BKT)]; if (!B) return 0;
  let h = 0;
  for (let k = 0; k < B.length; k++) {
    const f = B[k];
    if (f.ft === 'ramp') {
      if (s < f.a || s > f.b) continue;
      const u = s - f.s;
      if (f.kind === 'wood') { if (u > -f.Lr && u <= 0) h += f.H * Math.pow((u + f.Lr) / f.Lr, 1.55) * (1 - smooth(f.hwr - 0.25, f.hwr + 0.25, Math.abs(l - f.lc))); continue; }
      if (u > -f.Lr && u <= 0) h += f.H * Math.pow((u + f.Lr) / f.Lr, 1.7);
      else if (f.kind === 'lip') { /* the ground simply ends at the lip */ }
      else if (f.kind === 'kicker') { if (u > 0 && u < f.Ld) h += f.H * (1 - smooth(0, f.Ld, u)); }
      else if (f.kind === 'table') { if (u > 0 && u <= f.Lt) h += f.H; else if (u > f.Lt && u < f.Lt + f.Ld) h += f.H * (1 - smooth(0, f.Ld, u - f.Lt)); }
      else {   // double: take-off, gap, landing ramp
        if (u > 0 && u < f.Ld) h += f.H * (1 - smooth(0, f.Ld, u));
        const v = u - f.Ld - f.gap, H2 = f.H * 0.92;
        if (v > -f.Lr2 && v <= 0) h += H2 * smooth(-f.Lr2, 0, v);
        else if (v > 0 && v < f.Ld2) h += H2 * (1 - smooth(0, f.Ld2, v));
      }
    } else if (f.ft === 'whoop') {
      if (s < f.s0 || s > f.s1) continue;
      const env = smooth(f.s0, f.s0 + 5, s) * (1 - smooth(f.s1 - 5, f.s1, s));
      h += f.A * 0.5 * (1 - Math.cos(TAU * (s - f.s0) / f.P)) * env;
    }
  }
  return h * lat;
}
function roughK(s, l) {
  const B = CR.B[Math.floor(s / BKT)]; if (!B) return 1;
  for (let k = 0; k < B.length; k++) { const f = B[k]; if (f.ft === 'zone' && f.type === SURF.ROCK && s > f.s0 && s < f.s1) return 2.6 * smooth(f.s0, f.s0 + 6, s) * (1 - smooth(f.s1 - 6, f.s1, s)) + 1; }
  return 1;
}
// H: ground height. rough=false gives the physics ground (no fine bumps), true the visual ground.
function H(s, l, x, z, rough) {
  const fi = clamp(s / CR.ds, 0, CR.N - 1.0001), i = Math.floor(fi), f = fi - i;
  const yc = CR.y[i] * (1 - f) + CR.y[i + 1] * f, w = CR.w[i] * (1 - f) + CR.w[i + 1] * f;
  const tt = THEME.terr, al = Math.abs(l);
  // trail
  let hr = yc + 0.07 * (1 - Math.min(1, (l * l) / (w * w)));
  const ru = (al - 1.7) / 0.45; hr -= 0.08 * Math.exp(-ru * ru);
  hr += featH(s, l, w, al);
  const bk = CR.bank[i] * (1 - f) + CR.bank[i + 1] * f;
  if (bk !== 0) hr += bk * clamp(l, -w - 2.5, w + 2.5);
  if (rough) hr += (vnoise(x * 0.9, z * 0.9) * 0.035 + vnoise(x * 0.31 + 7.1, z * 0.31) * 0.06) * roughK(s, l);
  // surroundings
  const e = Math.max(0, al - w);
  let hs = yc + tt.bank * Math.pow(e, 1.25) + tt.valley * 0.55 * Math.pow(Math.max(0, e - 14), 2)
    + tt.wall * smooth(tt.wallD, tt.wallD + 26, al) * (0.7 + 0.3 * vnoise(x * 0.02, z * 0.02))
    + fbm(x * 0.0042 + 3.1, z * 0.0042 - 1.7, 4) * tt.far * 1.25 * smooth(14, 170, al)
    + fbm(x * 0.013 - 5.2, z * 0.013 + 2.3, 3) * tt.far * 0.32 * smooth(8, 70, al)
    + vnoise(x * 0.06, z * 0.06) * tt.near * smooth(w + 1, w + 18, al);
  if (rough) hs += vnoise(x * 0.4, z * 0.4) * 0.12 * smooth(w, w + 6, al);
  hs = Math.max(hs, yc - 0.3 - e * 0.05);
  const B = CR.B[Math.floor(s / BKT)];
  // a rock spur across the trail: the tunnel goes through it
  if (B) for (let k = 0; k < B.length; k++) { const q = B[k]; if (q.ft === 'tunnel') hs += q.Hr * smooth(q.s0 - 15, q.s0 - 1, s) * (1 - smooth(q.s1 + 1, q.s1 + 15, s)) * (1 - smooth(90, 150, al)) * (0.86 + 0.14 * vnoise(x * 0.05, z * 0.05)); }
  const t = smooth(w + 0.6, w + 8, al);
  let h = hr + (hs - hr) * t;
  // water carving
  if (B) for (let k = 0; k < B.length; k++) {
    const q = B[k];
    if (q.ft === 'ravine') {
      const u = s - q.s - q.mea * Math.sin(l * 0.03 + q.ph) * smooth(12, 45, al), a = Math.abs(u), hwl = q.hw + q.flare * smooth(9, 42, al);
      if (a < hwl + 3) {
        if (rough !== true && rough !== 1 && q.deck && al < q.bw && a < hwl + 1.5) { h = yc + 0.06; continue; }   // on the bridge
        const fc = 1 - smooth(hwl - 0.3, hwl + 1.6, a), tgt = q.floor + 1.6 * (a / hwl) * (a / hwl) + (rough ? vnoise(x * 0.35, z * 0.35) * 0.35 : 0);
        if (tgt < h) h = h + (tgt - h) * fc;
      }
    } else if (q.ft === 'creek') {
      const u = s - q.s - q.mea * Math.sin(l * 0.021 + q.ph), a = Math.abs(u);
      if (a < q.hw + 13) {
        const fc = 1 - smooth(q.hw - 1.5, q.hw + 12, a), tgt = q.bed + Math.max(0, a - q.hw) * 0.28 + (rough ? vnoise(x * 0.5, z * 0.5) * 0.06 : 0);
        if (tgt < h) h = h + (tgt - h) * fc;
      }
    } else if (q.ft === 'river') {
      const fs = smooth(q.s0 - 10, q.s0 + 2, s) * (1 - smooth(q.s1 - 2, q.s1 + 10, s));
      if (fs > 0) {
        const fl = 1 - smooth(w + 3, w + 9, al), tgt = q.bed + Math.max(0, al - w) * 0.1 + (rough ? vnoise(x * 0.6, z * 0.6) * 0.05 : 0);
        if (tgt < h) h = h + (tgt - h) * fs * fl;
      }
    } else if (q.ft === 'puddle') {
      const d = Math.hypot(s - q.s, l - q.l) / q.r;
      if (d < 1.4) h -= q.dep * (1 - smooth(0.55, 1.35, d));
    }
  }
  return h;
}
// water surface level at a track point (or -1e9)
function waterY(s, l) {
  const B = CR.B[Math.floor(s / BKT)]; if (!B) return -1e9;
  let wy = -1e9;
  for (let k = 0; k < B.length; k++) {
    const q = B[k];
    if (q.ft === 'creek') { const u = s - q.s - q.mea * Math.sin(l * 0.021 + q.ph); if (Math.abs(u) < q.hw + 16) wy = Math.max(wy, q.wy); }
    else if (q.ft === 'river') { if (s > q.s0 - 12 && s < q.s1 + 12) wy = Math.max(wy, q.wy); }
    else if (q.ft === 'puddle') { if (Math.hypot(s - q.s, l - q.l) < q.r * 1.15) wy = Math.max(wy, q.wy); }
    else if (q.ft === 'ravine') { const u = s - q.s - q.mea * Math.sin(l * 0.03 + q.ph) * smooth(12, 45, Math.abs(l)); if (Math.abs(u) < q.hw + q.flare + 3) wy = Math.max(wy, q.wy); }
  }
  return wy;
}
function zoneSurf(s, l) {
  const B = CR.B[Math.floor(s / BKT)]; if (!B) return -1;
  for (let k = 0; k < B.length; k++) { const q = B[k]; if (q.ft === 'zone' && s >= q.s0 && s <= q.s1 && l >= q.l0 && l <= q.l1) return q.type; }
  for (let k = 0; k < B.length; k++) { const q = B[k]; if (q.ft === 'puddle' && q.mud && Math.hypot(s - q.s, l - q.l) < q.r) return SURF.MUD; }
  return -1;
}
function surfAt(s, l, w, gh) {
  if (waterY(s, l) - gh > 0.08) return SURF.WATER;
  const al = Math.abs(l);
  const z = zoneSurf(s, l);
  if (al > w + 0.9) return z === SURF.SAND ? SURF.SAND : SURF[THEME.off];
  if (z >= 0) return z;
  return SURF[THEME.base];
}
// the ravine (if any) a track point is over, and the tunnel it is inside
function ravineAt(s, l) {
  const B = CR.B[Math.floor(s / BKT)]; if (!B) return null;
  for (let k = 0; k < B.length; k++) { const q = B[k]; if (q.ft !== 'ravine') continue; const al = Math.abs(l), u = s - q.s - q.mea * Math.sin(l * 0.03 + q.ph) * smooth(12, 45, al); if (Math.abs(u) < q.hw + q.flare * smooth(9, 42, al)) return q; }
  return null;
}
function tunnelAt(s) {
  const B = CR.B[Math.floor(s / BKT)]; if (!B) return null;
  for (let k = 0; k < B.length; k++) { const q = B[k]; if (q.ft === 'tunnel' && s > q.s0 && s < q.s1) return q; }
  return null;
}
const TUN = { b: 6.4 };
function tunnelArch(lat, w) { const a = w + 2.6, q = lat / a; return q * q >= 1 ? 0 : TUN.b * Math.sqrt(1 - q * q); }
// obstacles in an s range (sorted list)
function obsFrom(s) { const A = CR.OB; let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].s < s) lo = m + 1; else hi = m; } return lo; }
