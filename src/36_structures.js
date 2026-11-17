// ===================== Built structures: bridges, gap jumps, tunnels, arches, signs =====================
function inRavineS(s, pad) { for (const q of CR.F.ravines) if (Math.abs(s - q.s) < q.hw + (pad || 0)) return q; return null; }
function signTex(lines, bg, fg, w, h) {
  return textTex(w || 256, h || 160, (g, W2, H2) => {
    g.fillStyle = bg; g.fillRect(0, 0, W2, H2); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(5, 5, W2 - 10, H2 - 10);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = lines.length > 1 ? 54 : 70; g.font = `900 ${fs}px "Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif`;
    lines.forEach((t, i) => g.fillText(t, W2 / 2, H2 / 2 + (i - (lines.length - 1) / 2) * (fs + 8)));
  });
}
function addSign(grp, s, sd, tex, wm, hm) {
  const fr = frameAt(s, {}), l = sd * (fr.w + 3.4), p = worldAt(s, l), h = H(s, l, p.x, p.z, true);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(wm, hm), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  b.position.set(p.x, h + 1.4 + hm / 2, p.z); b.rotation.y = fr.psi + Math.PI; grp.add(b);
  const post = new THREE.Mesh(GEO.box, new THREE.MeshLambertMaterial({ color: lc(0x4a4a4a) })); post.position.set(p.x, h + 0.7, p.z); post.scale.set(0.1, 1.4, 0.1); grp.add(post);
}
function partsMesh(grp, parts, mat, s) {
  if (!parts.length) return null;
  const m = new THREE.Mesh(mergeParts(parts), mat || new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.castShadow = true; m.receiveShadow = true; m.userData.chunkS = s; grp.add(m); WORLD.userData.chunks.push(m); return m;
}
// a box beam between two world points
function beam(parts, col, ax, ay, az, bx, by, bz, th) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz); if (len < 0.01) return;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  m.compose(new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, new THREE.Vector3(th, len, th));
  parts.push({ geo: GEO.box, color: col, m });
}

// ---------- ravines: plank bridges and jump gaps ----------
function plankTex() {
  if (!TEX.plank) {
    const S = 256, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry32(21);
    for (let k = 0; k < 8; k++) {
      const y = k * 32, tone = 0.8 + r() * 0.3;
      g.fillStyle = `rgb(${Math.floor(176 * tone)},${Math.floor(128 * tone)},${Math.floor(80 * tone)})`; g.fillRect(0, y + 1, S, 30);
      for (let i = 0; i < 22; i++) { g.fillStyle = 'rgba(70,40,18,.25)'; g.fillRect(r() * S, y + 2 + r() * 28, 20 + r() * 70, 1.4); }
      g.fillStyle = 'rgba(40,24,10,.95)'; g.fillRect(0, y, S, 3);
      g.fillStyle = '#3a2412'; for (const x of [10, S - 10]) { g.beginPath(); g.arc(x, y + 16, 3, 0, TAU); g.fill(); }
    }
    TEX.plank = canvasTex(c, true);
  }
}
function buildRavines(grp) {
  plankTex();
  const wood = 0x7a5636, woodD = 0x5a3e26, rope = 0xd8c9a0;
  const warnB = signTex(['せまい', '橋'], '#f2c21a', '#1a1a1a'), warnG = signTex(['ジャンプ', 'で 越えろ'], '#f2c21a', '#1a1a1a');
  for (const q of CR.F.ravines) {
    const parts = [], fr = {}, sA = q.s - q.hw - 1.6, sB = q.s + q.hw + 1.6;
    for (const sd of [-1, 1]) addSign(grp, q.s - q.hw - (q.deck ? 62 : 95), sd, q.deck ? warnB : warnG, 2.0, 1.25);
    if (q.deck) {
      // deck
      const dmat = new THREE.MeshLambertMaterial({ map: TEX.plank });
      const nr = Math.ceil((sB - sA) / 2) + 1, pos = [], uv = [], idx = [];
      for (let j = 0; j < nr; j++) {
        const s = Math.min(sB, sA + j * 2); frameAt(s, fr);
        for (const sd of [-1, 1]) { const l = sd * (q.bw + 0.2); pos.push(fr.x + fr.rx * l, fr.y + 0.06, fr.z + fr.rz * l); uv.push(sd > 0 ? 1 : 0, s / 2.4); }
        if (j) { const o = j * 2; idx.push(o - 2, o - 1, o, o - 1, o + 1, o); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      if (g.attributes.normal.getY(0) < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
      g.computeBoundingSphere();
      const dm = new THREE.Mesh(g, dmat); dm.receiveShadow = true; dm.castShadow = true; grp.add(dm); WORLD.userData.chunks.push(dm);
      // beams, posts, ropes
      const P = (s, l, dy) => { frameAt(s, fr); return [fr.x + fr.rx * l, fr.y + 0.06 + dy, fr.z + fr.rz * l]; };
      for (const sd of [-1, 1]) {
        const l = sd * (q.bw + 0.12);
        beam(parts, woodD, ...P(sA, l, -0.22), ...P(sB, l, -0.22), 0.34);
        let prev = null;
        for (let s = sA; s <= sB + 0.01; s += (sB - sA) / Math.round((sB - sA) / 2.6)) {
          const a = P(s, l, 0), t = [a[0], a[1] + 1.05, a[2]];
          beam(parts, wood, a[0], a[1] - 0.1, a[2], t[0], t[1], t[2], 0.12);
          if (prev) { beam(parts, rope, prev[0], prev[1] - 0.05, prev[2], t[0], t[1] - 0.05, t[2], 0.05); beam(parts, rope, prev[0], prev[1] - 0.55, prev[2], t[0], t[1] - 0.55, t[2], 0.04); }
          prev = t;
        }
      }
      // trestles down to the ravine floor
      const nT = Math.max(2, Math.round((sB - sA) / 6.5));
      for (let k = 1; k < nT; k++) {
        const s = sA + (sB - sA) * k / nT, L = P(s, -(q.bw + 0.1), 0), Rr = P(s, q.bw + 0.1, 0), dy = L[1];
        const fl = H(s, -(q.bw + 1.2), L[0], L[2], true), fr2 = H(s, q.bw + 1.2, Rr[0], Rr[2], true), sp = 1.1;
        frameAt(s, fr);
        const Lb = [fr.x - fr.rx * (q.bw + sp), fl - 0.3, fr.z - fr.rz * (q.bw + sp)], Rb = [fr.x + fr.rx * (q.bw + sp), fr2 - 0.3, fr.z + fr.rz * (q.bw + sp)];
        beam(parts, woodD, L[0], dy - 0.3, L[2], Lb[0], Lb[1], Lb[2], 0.3); beam(parts, woodD, Rr[0], dy - 0.3, Rr[2], Rb[0], Rb[1], Rb[2], 0.3);
        const ym = (dy + Math.max(fl, fr2)) / 2;
        beam(parts, wood, L[0], dy - 0.5, L[2], Rb[0], ym, Rb[2], 0.16); beam(parts, wood, Rr[0], dy - 0.5, Rr[2], Lb[0], ym, Lb[2], 0.16);
        beam(parts, woodD, L[0], dy - 0.4, L[2], Rr[0], dy - 0.4, Rr[2], 0.26);
      }
      // funnel fences from the trail edges to the bridge
      for (const end of [-1, 1]) for (const sd of [-1, 1]) {
        const s0 = end < 0 ? sA - 20 : sB + 20, s1 = end < 0 ? sA : sB; let prev = null;
        for (let k = 0; k <= 5; k++) {
          const s = lerp(s0, s1, k / 5); frameAt(s, fr);
          const l = sd * lerp(fr.w + 1.2, q.bw + 0.35, Math.pow(k / 5, 0.8)), x = fr.x + fr.rx * l, z = fr.z + fr.rz * l, h = H(s, l, x, z, 2);
          beam(parts, wood, x, h - 0.2, z, x, h + 1.1, z, 0.14);
          if (prev) { beam(parts, k % 2 ? 0xf2f2f2 : 0xff6a10, prev[0], prev[1] + 0.95, prev[2], x, h + 0.95, z, 0.1); beam(parts, wood, prev[0], prev[1] + 0.5, prev[2], x, h + 0.5, z, 0.08); }
          prev = [x, h, z];
        }
      }
    } else {
      // gap: flags at the lip and on the landing
      for (const [s, col] of [[q.s - q.hw - 0.6, 0xff6a10], [q.s + q.hw + 1.5, 0x3fb55a]]) for (const sd of [-1, 1]) {
        frameAt(s, fr); const l = sd * (fr.w + 0.9), x = fr.x + fr.rx * l, z = fr.z + fr.rz * l, h = H(s, l, x, z, 2);
        beam(parts, 0xdddddd, x, h - 0.2, z, x, h + 3.4, z, 0.08);
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshLambertMaterial({ color: lc(col), side: THREE.DoubleSide }));
        fl.position.set(x + fr.tx * 0.55, h + 3.0, z + fr.tz * 0.55); fl.rotation.y = fr.psi + Math.PI / 2; grp.add(fl); SCN.anim.push({ m: fl, t: s + sd, base: fr.psi + Math.PI / 2 });
      }
    }
    partsMesh(grp, parts, null, q.s);
  }
}

// ---------- tunnels ----------
function buildTunnels(grp) {
  const T = THEME, rockC = lc(T.rock[1]).multiplyScalar(0.55), fr = {};
  for (const q of CR.F.tunnels) {
    const step = 3, nr = Math.ceil((q.s1 - q.s0) / step) + 1, NA = 13;
    // inner shell
    const pos = [], col = [], idx = [];
    for (let j = 0; j < nr; j++) {
      const s = Math.min(q.s1, q.s0 + j * step); frameAt(s, fr); const a = fr.w + 2.6;
      for (let k = 0; k < NA; k++) {
        const ph = Math.PI * k / (NA - 1), lat = -a * Math.cos(ph), hh = TUN.b * Math.sin(ph), n = 0.82 + 0.3 * hash01(j * 31 + k, 7);
        pos.push(fr.x + fr.rx * lat, fr.y + hh - 0.3, fr.z + fr.rz * lat); col.push(rockC.r * n, rockC.g * n, rockC.b * n);
        if (j && k) { const o = j * NA + k; idx.push(o - NA - 1, o - NA, o - 1, o - NA, o, o - 1); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const shell = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); shell.castShadow = true; grp.add(shell); WORLD.userData.chunks.push(shell);
    // cap: the top of the rock spur, level with the ground either side
    const NC = 9, cp = [], cc = [], ci = [], tc = new THREE.Color();
    for (let j = 0; j < nr; j++) {
      const s = Math.min(q.s1, q.s0 + j * step); frameAt(s, fr); const e = fr.w + 9;
      const pl = worldAt(s, -e), hl = H(s, -e, pl.x, pl.z, true), pr = worldAt(s, e), hr2 = H(s, e, pr.x, pr.z, true);
      for (let k = 0; k < NC; k++) {
        const u = k / (NC - 1), lat = lerp(-e, e, u), x = fr.x + fr.rx * lat, z = fr.z + fr.rz * lat;
        const h = lerp(hl, hr2, u) + 1.2 * (1 - (2 * u - 1) * (2 * u - 1)) + vnoise(x * 0.2, z * 0.2) * 0.4;
        cp.push(x, h, z); terrainColor(T, x, z, h, 0.1, e, fr.w, s, 0, tc); cc.push(tc.r, tc.g, tc.b);
        if (j && k) { const o = j * NC + k; ci.push(o - NC - 1, o - 1, o - NC, o - NC, o - 1, o); }
      }
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    const cuv = []; for (let i = 0; i < cp.length; i += 3) cuv.push(cp[i] / 7, cp[i + 2] / 7); cg.setAttribute('uv', new THREE.Float32BufferAttribute(cuv, 2));
    cg.setIndex(ci); cg.computeVertexNormals();
    if (cg.attributes.normal.getY(NC + 1) < 0) { for (let k = 0; k < ci.length; k += 3) { const t = ci[k + 1]; ci[k + 1] = ci[k + 2]; ci[k + 2] = t; } cg.setIndex(ci); cg.computeVertexNormals(); }
    cg.computeBoundingSphere();
    const cap = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.ground })); cap.castShadow = true; cap.receiveShadow = true; grp.add(cap); WORLD.userData.chunks.push(cap);
    // portal faces
    const rock2 = lc(T.rock[0]);
    for (const end of [0, 1]) {
      const s = end ? q.s1 : q.s0, j = end ? nr - 1 : 0; frameAt(s, fr); const e = fr.w + 9, a = fr.w + 2.6, NP = 25, pp = [], pc = [], pi = [];
      for (let k = 0; k < NP; k++) {
        const u = k / (NP - 1), lat = lerp(-e, e, u), x = fr.x + fr.rx * lat, z = fr.z + fr.rz * lat;
        const top = cp[(j * NC) * 3 + 1] * (1 - u) + cp[(j * NC + NC - 1) * 3 + 1] * u + 1.2 * (1 - (2 * u - 1) * (2 * u - 1)) + 0.1;
        const bot = fr.y - 0.5 + (Math.abs(lat) < a ? TUN.b * Math.sqrt(1 - (lat / a) * (lat / a)) + 0.2 : 0);
        const n1 = 0.75 + 0.35 * hash01(k, 3 + end), n2 = 0.75 + 0.35 * hash01(k, 9 + end);
        pp.push(x, bot, z, x, Math.max(top, bot), z); pc.push(rock2.r * n1 * 0.8, rock2.g * n1 * 0.8, rock2.b * n1 * 0.8, rock2.r * n2, rock2.g * n2, rock2.b * n2);
        if (k) { const o = k * 2; pi.push(o - 2, o - 1, o, o - 1, o + 1, o); }
      }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(pc, 3)); pg.setIndex(pi); pg.computeVertexNormals(); pg.computeBoundingSphere();
      const pm = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); pm.castShadow = true; grp.add(pm); WORLD.userData.chunks.push(pm);
    }
    // lamps along the roof
    const lamps = [], lmat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 }); lmat.fog = false;
    for (let s = q.s0 + 6; s < q.s1 - 3; s += 11) { frameAt(s, fr); lamps.push(part(GEO.box, 0xffffff, fr.x, fr.y + TUN.b - 0.55, fr.z, 0, fr.psi, 0, 1.3, 0.12, 0.3)); }
    if (lamps.length) { const lm = new THREE.Mesh(mergeParts(lamps), lmat); grp.add(lm); WORLD.userData.chunks.push(lm); }
    const st = signTex(['トンネル'], '#1c3a6a', '#ffffff', 256, 96);
    for (const sd of [-1, 1]) addSign(grp, q.s0 - 40, sd, st, 2.0, 0.75);
  }
}
// ---------- wooden kickers and fire rings ----------
function buildKickers(grp) {
  if (!TEX.plank) return;
  const fr = {}, wood = 0x7a5636, woodD = 0x5a3e26;
  SCN.rings = [];
  const ringGeo = new THREE.TorusGeometry(1, 0.07, 6, 28), ringMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
  const pmat = new THREE.MeshLambertMaterial({ map: TEX.plank });
  for (const f of CR.F.ramps) {
    if (f.kind !== 'wood') continue;
    const parts = [], n = 9, pos = [], uv = [], idx = [];
    let base0 = 0;
    for (let j = 0; j <= n; j++) {
      const s = f.s - f.Lr + f.Lr * j / n; frameAt(s, fr);
      const top = [];
      for (const sd of [-1, 1]) {
        const l = f.lc + sd * f.hwr, x = fr.x + fr.rx * l, z = fr.z + fr.rz * l, lin = f.lc + sd * (f.hwr - 0.6);
        const y = H(s - 0.001, lin, fr.x + fr.rx * lin, fr.z + fr.rz * lin, 2) + 0.16, yb = fr.y - 0.1;
        pos.push(x, y, z); uv.push(sd > 0 ? 1 : 0, s / 2.4); top.push([x, y, z, yb]);
        if (j && j % 2 === 0) beam(parts, woodD, x, yb, z, x, y - 0.05, z, 0.18);
      }
      if (j) { const o = j * 2; idx.push(o - 2, o - 1, o, o - 1, o + 1, o); }
      if (j) for (const k of [0, 1]) { const a = f._pt[k], t = top[k]; beam(parts, wood, a[0], a[1] - 0.12, a[2], t[0], t[1] - 0.12, t[2], 0.2); if (j % 2 === 0) beam(parts, wood, a[0], a[3] + 0.1, a[2], t[0], t[1] - 0.3, t[2], 0.1); }
      if (j === n) { beam(parts, woodD, top[0][0], top[0][1] - 0.15, top[0][2], top[1][0], top[1][1] - 0.15, top[1][2], 0.24); beam(parts, wood, top[0][0], top[0][3] + 0.3, top[0][2], top[1][0], top[1][1] - 0.4, top[1][2], 0.14); beam(parts, wood, top[1][0], top[1][3] + 0.3, top[1][2], top[0][0], top[0][1] - 0.4, top[0][2], 0.14); base0 = top[0][3]; }
      f._pt = top;
    }
    delete f._pt; void base0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    g.computeBoundingSphere();
    const dm = new THREE.Mesh(g, pmat); dm.receiveShadow = true; dm.castShadow = true; grp.add(dm); WORLD.userData.chunks.push(dm);
    partsMesh(grp, parts, null, f.s);
    if (f.ring) {
      const rg = f.ring; frameAt(rg.s, fr);
      rg.x = fr.x + fr.rx * f.lc; rg.z = fr.z + fr.rz * f.lc; rg.y = yAtS(f.s) + rg.dy;
      const m = new THREE.Mesh(ringGeo, ringMat); m.scale.setScalar(rg.r); m.position.set(rg.x, rg.y, rg.z); m.rotation.y = fr.psi; m.userData.sharedGeo = true; grp.add(m);
      const posts = [];
      for (const sd of [-1, 1]) { const l = f.lc + sd * (rg.r + 0.1), x = fr.x + fr.rx * l, z = fr.z + fr.rz * l; beam(posts, 0x3a3a3a, x, fr.y - 0.2, z, x, rg.y, z, 0.14); }
      partsMesh(grp, posts, null, rg.s);
      rg.rx = fr.rx; rg.rz = fr.rz; SCN.rings.push(rg);
    }
  }
}
// flames round the rings (only the ones near the camera)
function updateRings(dt) {
  if (!SCN.rings) return;
  for (const g of SCN.rings) {
    const d = Math.hypot(g.x - camera.position.x, g.z - camera.position.z); if (d > 130) continue;
    const n = Math.floor(dt * 70 + Math.random());
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, c = Math.cos(a) * g.r, sn = Math.sin(a) * g.r;
      PS.fire.emit(g.x + g.rx * c, g.y + sn, g.z + g.rz * c, (Math.random() - 0.5) * 0.6, 1.4 + Math.random() * 1.6, (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.3, 0.42, 0.08, 1, 0.32 + Math.random() * 0.3, 0.06, 0.8, -1, 0.5); }
  }
}
function ringFx(g, r) { for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, c = Math.cos(a) * g.r, sn = Math.sin(a) * g.r; PS.fire.emit(g.x + g.rx * c, g.y + sn, g.z + g.rz * c, r.vx * 0.5 + (Math.random() - 0.5) * 3, 1 + Math.random() * 3, r.vz * 0.5 + (Math.random() - 0.5) * 3, 0.5 + Math.random() * 0.4, 0.7, 0.1, 1, 0.75, 0.2, 1, -1, 0.6); } }
// checkpoint arches at 1/4, 1/2 and 3/4 of the course
function buildCheckpoints(grp) {
  CR.cps = [];
  const big = { bigjump: 1, jump: 1, crest: 1, drop: 1, bridge: 1, gap: 1, tunnel: 1, water: 1, rockfall: 1, geyser: 1 };
  for (let k = 1; k <= 3; k++) {
    let s = CR.sStart + CR.len * k / 4, n = 0;
    const bad = (q) => tunnelAt(q) || tunnelAt(q + 14) || tunnelAt(q - 14) || inRavineS(q, 30) || CR.marks.some((m) => big[m.type] && Math.abs(m.s - q) < 42);
    while (n < 40 && bad(s)) { s += 9; n++; }
    if (n >= 40 || s > CR.sFin - 120) continue;
    const fr = frameAt(s, {}), w = fr.w + 2.6, gp = new THREE.Group(), y0 = H(s, 0, fr.x, fr.z, true);
    const mat = new THREE.MeshLambertMaterial({ color: lc(0x2a2c30) }), mat2 = new THREE.MeshLambertMaterial({ color: lc(0xffb347) });
    for (const sd of [-1, 1]) {
      const gy = H(s, sd * w, fr.x + fr.rx * sd * w, fr.z + fr.rz * sd * w, true) - y0;
      const p = new THREE.Mesh(GEO.box, mat); p.position.set(-sd * w, gy + 3.6, 0); p.scale.set(0.4, 7.2, 0.4); p.castShadow = true; p.userData.sharedGeo = true; gp.add(p);
      const b = new THREE.Mesh(GEO.box, mat2); b.position.set(-sd * w, gy + 0.5, 0); b.scale.set(0.8, 1.0, 0.8); b.userData.sharedGeo = true; gp.add(b);
    }
    const tex = textTex(1024, 128, (g, W2, H2) => { g.fillStyle = '#ffb347'; g.fillRect(0, 0, W2, H2); g.fillStyle = '#16181b'; g.fillRect(0, 12, W2, H2 - 24); g.fillStyle = '#ffcf6a'; g.font = 'italic 900 76px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CHECK POINT  ' + k + ' / 3', W2 / 2, H2 / 2 + 4); });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(2 * w, 2 * w / 8), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    bm.position.set(0, 6.6, -0.2); bm.rotation.y = Math.PI; gp.add(bm);
    gp.position.set(fr.x, y0, fr.z); gp.rotation.y = fr.psi; grp.add(gp);
    CR.cps.push(s);
  }
}
function buildStructures(grp) { buildRavines(grp); buildTunnels(grp); buildKickers(grp); buildCheckpoints(grp); }
