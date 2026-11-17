// ===================== Scenery, obstacles, course dressing =====================
const SG = {};      // shared vegetation geometries (built once)
const SCN = { anim: [], dyn: [] };
function buildSharedGeos() {
  const P = (g, c, x, y, z, rx, ry, rz, sx, sy, sz, sh) => part(g, c, x, y, z, rx, ry, rz, sx, sy, sz, sh);
  // conifer: trunk + 6 drooping tiers
  {
    const parts = [P(GEO.cylLo, 0x5a4030, 0, 0.12, 0, 0, 0, 0, 0.045, 0.26, 0.045)];
    for (let k = 0; k < 6; k++) {
      const t = k / 5, y = 0.16 + t * 0.7, r = 0.36 * (1 - t * 0.8) + 0.04;
      parts.push(P(GEO.coneLo, k % 2 ? 0x2f4a26 : 0x3a5a2c, 0, y + 0.13, 0, 0, k * 0.7, 0, r, 0.3 - t * 0.08, r, 0.85 + t * 0.25));
    }
    SG.pine = mergeParts(parts);
  }
  // broadleaf: trunk, limbs and lumpy canopy
  {
    const r = mulberry32(31), parts = [P(GEO.cylLo, 0x5d4632, 0, 0.22, 0, 0, 0, 0, 0.05, 0.45, 0.05)];
    parts.push(P(GEO.cylLo, 0x5d4632, 0.08, 0.5, 0, 0, 0, -0.6, 0.025, 0.25, 0.025), P(GEO.cylLo, 0x5d4632, -0.07, 0.52, 0.03, 0.3, 0, 0.6, 0.025, 0.22, 0.025));
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, d = k ? 0.17 : 0; parts.push(P(rockGeo(10 + k, 0), k % 3 ? 0x4a6e2e : 0x5a7e34, Math.cos(a) * d, 0.72 + r() * 0.16 - (k ? 0.04 : -0.06), Math.sin(a) * d, 0, r() * 3, 0, 0.24, 0.2, 0.24, 0.85 + r() * 0.3)); }
    SG.broad = mergeParts(parts);
  }
  {
    const r = mulberry32(32), parts = [P(GEO.cylLo, 0xe6e2da, 0, 0.35, 0, 0, 0, 0, 0.03, 0.7, 0.03)];
    for (let k = 0; k < 4; k++) parts.push(P(GEO.cylLo, 0x2a2a2a, 0, 0.1 + k * 0.15, 0, 0, 0, 0, 0.032, 0.012, 0.032));
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; parts.push(P(rockGeo(20 + k, 0), 0x7a9a3c, Math.cos(a) * 0.1, 0.62 + k * 0.05, Math.sin(a) * 0.1, 0, r() * 3, 0, 0.14, 0.16, 0.14, 0.9 + r() * 0.25)); }
    SG.birch = mergeParts(parts);
  }
  {
    const parts = [P(GEO.cylLo, 0x6e6458, 0, 0.3, 0, 0, 0, 0.05, 0.04, 0.6, 0.04)];
    [[0.45, 0.7, 0.5], [0.55, -0.8, 2.1], [0.66, 0.6, 3.6], [0.72, -0.5, 5.0]].forEach(([y, rz, ry]) => parts.push(P(GEO.cylLo, 0x6e6458, Math.sin(rz) * 0.1 * Math.cos(ry), y + 0.07, Math.sin(rz) * 0.1 * Math.sin(ry), 0, ry, rz, 0.018, 0.28, 0.018)));
    SG.dead = mergeParts(parts);
  }
  {
    const g = 0x4f7a3a, parts = [P(GEO.cyl, g, 0, 0.5, 0, 0, 0, 0, 0.1, 1, 0.1), P(GEO.sphereLo, g, 0, 1.0, 0, 0, 0, 0, 0.1, 0.08, 0.1)];
    parts.push(P(GEO.cyl, g, 0.17, 0.48, 0, 0, 0, Math.PI / 2, 0.06, 0.16, 0.06), P(GEO.cyl, g, 0.25, 0.62, 0, 0, 0, 0, 0.06, 0.3, 0.06), P(GEO.sphereLo, g, 0.25, 0.77, 0, 0, 0, 0, 0.06, 0.05, 0.06));
    parts.push(P(GEO.cyl, g, -0.15, 0.62, 0, 0, 0, Math.PI / 2, 0.055, 0.12, 0.055), P(GEO.cyl, g, -0.21, 0.72, 0, 0, 0, 0, 0.055, 0.22, 0.055), P(GEO.sphereLo, g, -0.21, 0.83, 0, 0, 0, 0, 0.055, 0.05, 0.055));
    SG.cactus = mergeParts(parts);
  }
  {
    const r = mulberry32(34), parts = [];
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + r(); parts.push(P(rockGeo(30 + k, 0), k % 2 ? 0x4b6a2c : 0x5c7a36, Math.cos(a) * 0.3, 0.3 + r() * 0.1, Math.sin(a) * 0.3, 0, r() * 3, 0, 0.42, 0.36, 0.42, 0.85 + r() * 0.3)); }
    SG.bush = mergeParts(parts);
  }
  {
    const r = mulberry32(35), parts = [];
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; parts.push(P(rockGeo(36 + k, 0), 0x8a8a62, Math.cos(a) * 0.22, 0.18 + r() * 0.08, Math.sin(a) * 0.22, 0, r() * 3, 0, 0.22, 0.2, 0.22, 0.8 + r() * 0.35)); }
    SG.dry = mergeParts(parts);
  }
  // grass tuft: three crossed cards
  {
    const g = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * Math.PI, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, o = pos.length / 3;
      pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz); uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(o, o + 1, o + 2, o, o + 2, o + 3, o, o + 2, o + 1, o, o + 3, o + 2);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const n = []; for (let i = 0; i < pos.length / 3; i++) n.push(0, 1, 0); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    g.setIndex(idx); SG.tuft = g;
  }
  // spectator
  {
    SG.person = mergeParts([
      P(GEO.box, 0x30343a, -0.09, 0.42, 0, 0, 0, 0, 0.13, 0.84, 0.16), P(GEO.box, 0x30343a, 0.09, 0.42, 0, 0, 0, 0, 0.13, 0.84, 0.16),
      P(GEO.box, 0xffffff, 0, 1.1, 0, 0, 0, 0, 0.42, 0.56, 0.24), P(GEO.box, 0xffffff, -0.27, 1.1, 0, 0, 0, 0.12, 0.1, 0.52, 0.12), P(GEO.box, 0xffffff, 0.27, 1.1, 0, 0, 0, -0.12, 0.1, 0.52, 0.12),
      P(GEO.sphereLo, 0xd8b090, 0, 1.55, 0, 0, 0, 0, 0.12, 0.14, 0.12), P(GEO.sphereLo, 0x3a2a20, 0, 1.6, -0.02, 0, 0, 0, 0.125, 0.1, 0.125),
    ]);
  }
  // far mountain (displaced cone, colour baked per stage)
  {
    const g = new THREE.ConeGeometry(1, 1, 11, 5), Pp = g.attributes.position, r = mulberry32(77);
    for (let i = 0; i < Pp.count; i++) {
      const x = Pp.getX(i), y = Pp.getY(i) + 0.5, z = Pp.getZ(i), a = Math.atan2(z, x);
      const d = 1 + 0.18 * Math.sin(a * 3 + 1) + 0.1 * Math.sin(a * 7 + 2) + (r() - 0.5) * 0.12 * (1 - y);
      Pp.setXYZ(i, x * d, y * (1 + 0.08 * Math.sin(a * 5)), z * d);
    }
    SG.mtn = g.toNonIndexed(); SG.mtn.computeVertexNormals();
  }
  for (const k in SG) SG[k].userData = { shared: true };
}

// ---------- helpers ----------
const CHK = 150;
function chunkOf(s) { return Math.floor((s + EXT) / CHK); }
function addInstanced(grp, geo, mat, list, castShadow, near) {
  // list: [{s,x,y,z,ry,sx,sy,sz,c:THREE.Color}] -> one InstancedMesh per chunk
  const byC = new Map();
  for (const it of list) { const k = chunkOf(it.s); let a = byC.get(k); if (!a) byC.set(k, (a = [])); a.push(it); }
  const dummy = new THREE.Object3D();
  byC.forEach((arr) => {
    const im = new THREE.InstancedMesh(geo, mat, arr.length);
    im.userData.sharedGeo = true;
    let cx = 0, cz = 0;
    arr.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z); dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      dummy.scale.set(it.sx, it.sy === undefined ? it.sx : it.sy, it.sz === undefined ? it.sx : it.sz); dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix); if (it.c) im.setColorAt(i, it.c);
      cx += it.x; cz += it.z;
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    // bounding sphere for culling
    cx /= arr.length; cz /= arr.length; let rad = 0, cy = 0;
    for (const it of arr) { rad = Math.max(rad, Math.hypot(it.x - cx, it.z - cz) + (it.sy || it.sx) * 1.2); cy += it.y; }
    // r128 culls an InstancedMesh by the shared geometry's bounds, so culling is done by hand (cullInstances)
    im.frustumCulled = false;
    im.userData.bs = new THREE.Sphere(new THREE.Vector3(cx, cy / arr.length, cz), rad + 5);
    im.userData.cast = !!castShadow; im.castShadow = false; im.receiveShadow = true; im.userData.near = near;
    grp.add(im); WORLD.userData.inst.push(im);
  });
}
function nearWater(s, l, h) { const wy = waterY(s, l); return wy > -1e8 && h < wy + 0.35; }

// ---------- vegetation ----------
function buildVegetation(grp) {
  const T = THEME, V = T.veg, R = mulberry32(STAGE.seed * 7 + 3), pt = {};
  const L = { pine: [], broad: [], birch: [], dead: [], cactus: [], bush: [], dry: [], tuft: [], reed: [], rock: [] };
  const col = (hex, v) => lc(hex).multiplyScalar(1 - v / 2 + R() * v);
  const gateZone = (s, l) => (Math.abs(s - CR.sStart) < 40 || Math.abs(s - CR.sFin) < 40) && Math.abs(l) < 30;
  const place = (arr, s, l, sc, c, extra) => {
    ribbonPoint(s, l, pt);
    if (pt.clip) return false;
    const sc2 = clamp(s, 0, CR.L - 0.01);
    if (nearWater(sc2, l, pt.h)) return false;
    if (gateZone(s, l)) return false;
    // reject very steep spots for trees
    if (extra !== 'any') { const q = {}; ribbonPoint(s, l + 2.5, q); if (Math.abs(q.h - pt.h) > 2.6) return false; }
    arr.push({ s: sc2, x: pt.x, y: pt.h - 0.15, z: pt.z, ry: R() * TAU, sx: sc, c, rx: (R() - 0.5) * 0.08, rz: (R() - 0.5) * 0.08 });
    return true;
  };
  const sA = -EXT * 0.6, sB = CR.L + EXT * 0.6;
  for (let s = sA; s < sB; s += 4) {
    const w = wAtS(clamp(s, 0, CR.L));
    const side = () => (R() < 0.5 ? -1 : 1);
    const far = (k) => w + 5 + Math.pow(R(), k) * 175;
    if (R() < V.pine * 0.55) place(L.pine, s + R() * 4, side() * far(1.4), 9 + R() * 11, col(0xffffff, 0.3));
    if (R() < V.broad * 0.45) place(L.broad, s + R() * 4, side() * far(1.5), 8 + R() * 7, col(0xffffff, 0.35));
    if (R() < V.birch * 0.3) place(L.birch, s + R() * 4, side() * far(1.8), 9 + R() * 5, col(0xffffff, 0.2));
    if (R() < V.dead * 0.25) place(L.dead, s + R() * 4, side() * far(1.6), 5 + R() * 6, col(0xffffff, 0.3));
    if (R() < V.cactus * 0.3) place(L.cactus, s + R() * 4, side() * (w + 2.5 + Math.pow(R(), 1.5) * 120), 2.5 + R() * 3, col(0xffffff, 0.25));
    if (R() < V.bush * 0.7) place(L.bush, s + R() * 4, side() * (w + 3 + Math.pow(R(), 2) * 120), 0.9 + R() * 1.4, col(0xffffff, 0.35));
    if (R() < V.dry * 0.7) place(L.dry, s + R() * 4, side() * (w + 2 + Math.pow(R(), 2) * 120), 0.7 + R() * 1.0, col(0xffffff, 0.3), 'any');
    if (R() < T.rocks * 0.45) { const big = R() < 0.25; place(L.rock, s + R() * 4, side() * (w + 3 + Math.pow(R(), 1.6) * 150), big ? 2 + R() * 4 : 0.4 + R() * 1.1, col(T.rock[0], 0.3), 'any'); }
    const nt = Math.round(V.tuft * 5 * Q.grass);
    for (let k = 0; k < nt; k++) place(L.tuft, s + R() * 4, side() * (w + 0.9 + Math.pow(R(), 2.2) * 26), 0.5 + R() * 0.7, lc(T.grass[R() < 0.5 ? 0 : 2]).multiplyScalar(1.05 + R() * 0.35), 'any');
  }
  // reeds and stones along the water
  for (const c of CR.F.creeks) for (let k = 0; k < 40 * (0.3 + V.reed); k++) {
    const l = (R() - 0.5) * 120, u = (R() < 0.5 ? -1 : 1) * (c.hw + 0.5 + R() * 3), s = c.s + u + c.mea * Math.sin(l * 0.021 + c.ph);
    if (Math.abs(l) < wAtS(s) + 1.5) continue;
    const p2 = worldAt(s, l), h = H(s, l, p2.x, p2.z, true);
    if (R() < 0.55) L.reed.push({ s, x: p2.x, y: h - 0.1, z: p2.z, ry: R() * TAU, sx: 1 + R() * 0.8, sy: 1.2 + R() * 1.2, c: lc(0x7a8a46).multiplyScalar(0.9 + R() * 0.3) });
    else L.rock.push({ s, x: p2.x, y: h - 0.1, z: p2.z, ry: R() * TAU, sx: 0.4 + R() * 0.9, c: lc(T.rock[1]).multiplyScalar(0.8 + R() * 0.3) });
  }
  const vmat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const rmat = new THREE.MeshLambertMaterial({ vertexColors: false, map: TEX.ground });
  const gmat = new THREE.MeshLambertMaterial({ map: TEX.grass, alphaTest: 0.5 });
  const nearT = Math.min(900, scene.fog.far * 0.75), nearS = 320;
  addInstanced(grp, SG.pine, vmat, L.pine, true, nearT); addInstanced(grp, SG.broad, vmat, L.broad, true, nearT); addInstanced(grp, SG.birch, vmat, L.birch, true, nearT);
  addInstanced(grp, SG.dead, vmat, L.dead, true, nearT); addInstanced(grp, SG.cactus, vmat, L.cactus, true, nearT);
  addInstanced(grp, SG.bush, vmat, L.bush, true, nearS); addInstanced(grp, SG.dry, vmat, L.dry, false, nearS);
  addInstanced(grp, rockGeo(2), rmat, L.rock.filter((_, i) => i % 3 === 0), true, nearS + 200); addInstanced(grp, rockGeo(4, 0), rmat, L.rock.filter((_, i) => i % 3 === 1), true, nearS + 200); addInstanced(grp, rockGeo(5, 0), rmat, L.rock.filter((_, i) => i % 3 === 2), true, nearS + 200);
  addInstanced(grp, SG.tuft, gmat, L.tuft, false, 170); addInstanced(grp, SG.tuft, gmat, L.reed, false, 220);
}

// ---------- obstacles + stakes (merged static mesh per chunk) ----------
function obstacleParts(o, x, y, z, psi, parts, R) {
  const ry = psi + (o.rot || 0);
  switch (o.type) {
    case 'rock': case 'boulder': {
      const c = lc(THEME.rock[0]).lerp(lc(THEME.rock[1]), R() * 0.6);
      parts.push(part(rockGeo(o.k), c, x, y - o.r * 0.15, z, 0, ry, 0, o.r * 1.05, o.h * 1.15, o.r * 1.05));
      if (o.type === 'boulder' && THEME.veg.broad + THEME.veg.pine > 1) parts.push(part(rockGeo(o.k + 3), 0x5f6a3a, x, y + o.h * 0.75, z, 0, ry, 0, o.r * 0.7, o.h * 0.25, o.r * 0.7));
      break;
    }
    case 'stump': {
      parts.push(part(GEO.cylLo, 0x5b4330, x, y + o.h / 2 - 0.05, z, 0, ry, 0, o.r, o.h, o.r));
      parts.push(part(GEO.cylLo, 0xc7a27a, x, y + o.h - 0.03, z, 0, ry, 0, o.r * 0.86, 0.06, o.r * 0.86));
      for (let k = 0; k < 3; k++) { const a = ry + k * 2.1; parts.push(part(GEO.cylLo, 0x5b4330, x + Math.cos(a) * o.r, y + 0.08, z + Math.sin(a) * o.r, 0, -a, Math.PI / 2.6, 0.08, 0.5, 0.08)); }
      break;
    }
    case 'log': {
      // runs across the trail from l0 to l1 (in track frame)
      const p0 = worldAt(o.s, o.l0), p1 = worldAt(o.s, o.l1), len = Math.hypot(p1.x - p0.x, p1.z - p0.z), mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2;
      const ang = Math.atan2(p1.x - p0.x, p1.z - p0.z) + (o.rot || 0);
      const m = new THREE.Matrix4().makeRotationY(ang).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      const bark = o.full ? 0x6a5038 : 0x4e3a2a;
      parts.push({ geo: GEO.cylLo, color: bark, m: new THREE.Matrix4().makeTranslation(mx, o.y + o.r * 0.8, mz).multiply(m).multiply(new THREE.Matrix4().makeScale(o.r, len, o.r)) });
      // cut end + root plate / branches on fallen trees
      const ex = Math.sin(ang) * len / 2, ez = Math.cos(ang) * len / 2, outer = o.fromL ? -1 : 1, er = o.tree ? (outer) : 1;
      parts.push(part(GEO.cylLo, 0xcaa47a, mx - ex * er, o.y + o.r * 0.8, mz - ez * er, Math.PI / 2, ang, 0, o.r * 0.9, 0.04, o.r * 0.9));
      if (o.tree) {
        // root plate on the outside end, a few dead branches along the trunk
        parts.push(part(GEO.cylLo, 0x4a3828, mx + ex * er, o.y + o.r * 1.6, mz + ez * er, Math.PI / 2, ang, 0, o.r * 3.2, 0.25, o.r * 3.2));
        for (let k = 0; k < 4; k++) {
          const t = -0.35 + k * 0.22, bx = mx + ex * 2 * t, bz = mz + ez * 2 * t, up = R() < 0.5;
          parts.push(part(GEO.cylLo, 0x5a4634, bx, o.y + o.r * 1.4, bz, up ? 0.3 : -0.9, ang + Math.PI / 2 + (R() - 0.5), 0.5, 0.05, 1.0 + R() * 0.6, 0.05));
        }
      }
      break;
    }
    case 'hay': {
      parts.push(part(GEO.cyl, 0xcaa65a, x, y + o.r * 0.95, z, Math.PI / 2, ry, 0, o.r, 1.45, o.r));
      parts.push(part(GEO.cyl, 0xb8944a, x, y + o.r * 0.95, z, Math.PI / 2, ry, 0, o.r * 0.7, 1.47, o.r * 0.7));
      break;
    }
    case 'cactus': parts.push({ geo: SG.cactus, color: 0xffffff, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(o.h, o.h, o.h)) }); break;
    case 'tree': {
      const g = THEME.veg.pine >= THEME.veg.broad ? SG.pine : SG.broad, sc = 10 + R() * 5;
      parts.push({ geo: g, color: 0xffffff, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sc, sc, sc)) });
      parts.push(part(GEO.cylLo, 0x4e3a2a, x, y + 0.8, z, 0, 0, 0, o.r, 1.8, o.r));
      break;
    }
  }
}
function buildObstacles(grp) {
  const R = mulberry32(STAGE.seed * 13 + 1), byC = new Map(), fr = {};
  const push = (s, p) => { const k = chunkOf(s); let a = byC.get(k); if (!a) byC.set(k, (a = [])); a.push(p); };
  for (const o of CR.OB) {
    frameAt(o.s, fr);
    const p = worldAt(o.s, o.l || 0); o.x = p.x; o.z = p.z;
    if (o.type === 'log') {
      let mn = 1e9; for (let k = 0; k <= 8; k++) { const l = o.l0 + (o.l1 - o.l0) * k / 8, q = worldAt(o.s, l); mn = Math.min(mn, H(o.s, l, q.x, q.z, true)); }
      o.y = mn; o.top = mn + o.r * 1.8;
    } else { o.y = H(o.s, o.l, o.x, o.z, true); o.top = o.y + o.h; }
    if (o.type === 'fence') { let mn = 1e9; for (let k = 0; k <= 6; k++) { const l = o.l0 + (o.l1 - o.l0) * k / 6, q = worldAt(o.s, l); mn = Math.min(mn, H(o.s, l, q.x, q.z, true)); } o.y = mn; o.top = mn + o.h; }
    if (o.type === 'barrel' || o.type === 'crate' || o.type === 'fence') continue;
    const parts = []; obstacleParts(o, o.x, o.y, o.z, fr.psi, parts, R);
    for (const q of parts) push(o.s, q);
  }
  // barrels are dynamic (they get knocked over)
  const bm = new THREE.MeshLambertMaterial({ vertexColors: true });
  const bcols = [0x2f5fa8, 0xc23a2a, 0x3a7a3a, 0xd8a020];
  const bgeo = mergeParts([part(GEO.cyl, 0xffffff, 0, 0.55, 0, 0, 0, 0, 0.38, 1.1, 0.38), part(GEO.cyl, 0xdddddd, 0, 0.37, 0, 0, 0, 0, 0.385, 0.05, 0.385), part(GEO.cyl, 0xdddddd, 0, 0.76, 0, 0, 0, 0, 0.385, 0.05, 0.385)]);
  bgeo.userData.own = true;
  for (const o of CR.OB) if (o.type === 'barrel') {
    const m = new THREE.Mesh(bgeo, bm.clone()); m.material.color.copy(lc(bcols[Math.floor(R() * bcols.length)]));
    m.position.set(o.x, o.y, o.z); m.rotation.y = o.rot; m.castShadow = true; o.mesh = m; grp.add(m);
  }
  // crates and plank fences break apart when hit, so each is its own mesh
  const cgeo = mergeParts([
    part(GEO.box, 0xb08a58, -0.52, 0.5, 0, 0, 0.1, 0, 0.98, 0.98, 0.98), part(GEO.box, 0xa27c4c, 0.52, 0.5, 0.05, 0, -0.08, 0, 0.98, 0.98, 0.98), part(GEO.box, 0xb89460, 0, 1.48, 0, 0, 0.35, 0, 0.96, 0.96, 0.96),
    part(GEO.box, 0x6a4a2a, -0.52, 0.5, 0, 0, 0.1, 0, 1.02, 0.12, 1.02), part(GEO.box, 0x6a4a2a, 0.52, 0.5, 0.05, 0, -0.08, 0, 1.02, 0.12, 1.02), part(GEO.box, 0x6a4a2a, 0, 1.48, 0, 0, 0.35, 0, 1.0, 0.12, 1.0),
  ]);
  const cmat = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (const o of CR.OB) {
    if (o.type === 'crate') { frameAt(o.s, fr); const m = new THREE.Mesh(cgeo, cmat); m.position.set(o.x, o.y - 0.05, o.z); m.rotation.y = fr.psi + o.rot; m.castShadow = true; o.mesh = m; grp.add(m); }
    else if (o.type === 'fence') {
      const parts = [], p0 = worldAt(o.s, o.l0), p1 = worldAt(o.s, o.l1), n = Math.max(2, Math.round((o.l1 - o.l0) / 2.2));
      for (let k = 0; k <= n; k++) { const u = k / n, x = lerp(p0.x, p1.x, u), z = lerp(p0.z, p1.z, u); beam(parts, 0x6a4a2a, x, o.y - 0.2, z, x, o.y + 1.15, z, 0.14); }
      for (const [dy, c] of [[1.0, 0xf2f2f2], [0.62, 0xff6a10], [0.26, 0xf2f2f2]]) beam(parts, c, p0.x, o.y + dy, p0.z, p1.x, o.y + dy, p1.z, 0.16);
      const m = new THREE.Mesh(mergeParts(parts), cmat); m.castShadow = true; o.mesh = m; grp.add(m);
    }
  }
  // course stakes every 9 m on both sides + tape between them
  const tapePts = { '-1': [], '1': [] };
  for (let s = CR.sStart - 30; s < CR.sFin + 60; s += 9) {
    frameAt(s, fr);
    for (const sd of [-1, 1]) {
      const l = sd * (fr.w + 2.4), p = worldAt(s, l), h = H(s, l, p.x, p.z, true), wy = waterY(s, l);
      const inW = wy > h + 0.1 || !!inRavineS(s, 3) || !!tunnelAt(s);
      if (!inW) push(s, part(GEO.box, 0xd9c7a2, p.x, h + 0.5, p.z, 0, fr.psi, 0, 0.05, 1.0, 0.05));
      tapePts[sd].push({ s, x: p.x, y: Math.max(h, wy + 0.3) + 0.88, z: p.z, gap: inW });
    }
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  byC.forEach((parts) => {
    const g = mergeParts(parts), m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    grp.add(m); WORLD.userData.chunks.push(m);
  });
  // tape strips
  const tmat = new THREE.MeshLambertMaterial({ map: TEX.tape, side: THREE.DoubleSide });
  for (const sd of [-1, 1]) {
    const A = tapePts[sd];
    for (let a = 0; a < A.length - 1; a += 16) {
      const pos = [], uv = [], idx = []; let u = 0;
      for (let k = a; k <= Math.min(A.length - 1, a + 16); k++) {
        const p = A[k], o = pos.length / 3; pos.push(p.x, p.y, p.z, p.x, p.y - 0.07, p.z); uv.push(u, 1, u, 0); u += 9 / 1.2;
        if (k > a && !p.gap && !A[k - 1].gap) idx.push(o - 2, o - 1, o, o - 1, o + 1, o);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, tmat); m.userData.near = 320; grp.add(m); WORLD.userData.chunks.push(m);
    }
  }
}

// ---------- gates, boards, spectators ----------
function textTex(w, h, draw) { const c = mkCanvas(w, h), g = c.getContext('2d'); draw(g, w, h); const t = canvasTex(c, false); t.__own = true; return t; }
function buildGate(grp, s, finish) {
  const fr = frameAt(s, {}), w = fr.w + 3.2, gp = new THREE.Group();
  const y0 = H(s, 0, fr.x, fr.z, true);
  const mk = (geo, c, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: lc(c) })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; gp.add(m); return m; };
  for (const sd of [-1, 1]) {
    const px = -sd * w;  // local frame: x = -l
    const gy = H(s, sd * w, fr.x + fr.rx * sd * w, fr.z + fr.rz * sd * w, true) - y0;
    mk(GEO.box, 0x2a2c30, px, gy + 4.1, 0, 0.5, 8.2, 0.5);
    mk(GEO.box, finish ? 0xf0f0f0 : 0xff7a1a, px, gy + 0.6, 0, 0.9, 1.2, 0.9);
  }
  const ban = textTex(1024, 128, (g, W2, H2) => {
    if (finish) { for (let x = 0; x < W2; x += 32) for (let y = 0; y < H2; y += 32) { g.fillStyle = ((x + y) / 32) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x, y, 32, 32); } g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(200, 18, 624, 92); }
    else { g.fillStyle = '#16181b'; g.fillRect(0, 0, W2, H2); g.fillStyle = '#ff7a1a'; g.fillRect(0, 0, W2, 10); g.fillRect(0, H2 - 10, W2, 10); }
    g.fillStyle = '#fff'; g.font = 'italic 900 78px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(finish ? 'FINISH' : 'START  ―  GRIT TRAIL', W2 / 2, H2 / 2 + 4);
  });
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(2 * w, 2 * w / 8), new THREE.MeshLambertMaterial({ map: ban, side: THREE.DoubleSide }));
  bm.position.set(0, 7.4, -0.22); bm.rotation.y = Math.PI; gp.add(bm);
  mk(GEO.box, 0x2a2c30, 0, 7.4 + w / 8 + 0.15, 0, 2 * w + 0.5, 0.3, 0.4);
  gp.position.set(fr.x, y0, fr.z); gp.rotation.y = fr.psi; grp.add(gp);
  // banner flags along the start/finish straight
  const fcols = [0xff7a1a, 0xf2f2f2, 0x1f5fc8, 0xd7262e];
  for (let k = -3; k <= 3; k++) for (const sd of [-1, 1]) {
    const ss = s + k * 9, f2 = frameAt(ss, {}), l = sd * (f2.w + 4.5), p = worldAt(ss, l), h = H(ss, l, p.x, p.z, true);
    const pole = new THREE.Mesh(GEO.cylLo, new THREE.MeshLambertMaterial({ color: lc(0x999999) })); pole.position.set(p.x, h + 2.2, p.z); pole.scale.set(0.04, 4.4, 0.04); grp.add(pole);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.4), new THREE.MeshLambertMaterial({ color: lc(fcols[(k + 3 + (sd > 0 ? 1 : 0)) % 4]), side: THREE.DoubleSide }));
    fl.position.set(p.x + f2.tx * 0.4, h + 3.1, p.z + f2.tz * 0.4); fl.rotation.y = f2.psi + Math.PI / 2; grp.add(fl); SCN.anim.push({ m: fl, t: k + sd, base: f2.psi + Math.PI / 2 });
  }
}
function buildBoards(grp) {
  const R = mulberry32(STAGE.seed + 55);
  for (let d = 500; d < CR.len - 100; d += 500) {
    const s = CR.sFin - d, fr = frameAt(s, {}), sd = R() < 0.5 ? -1 : 1, l = sd * (fr.w + 3.6), p = worldAt(s, l), h = H(s, l, p.x, p.z, true);
    const tex = textTex(256, 128, (g, w2, h2) => { g.fillStyle = '#16181b'; g.fillRect(0, 0, w2, h2); g.fillStyle = '#ff7a1a'; g.fillRect(0, 0, 12, h2); g.fillStyle = '#fff'; g.font = '700 26px sans-serif'; g.fillText('GOAL', 30, 40); g.font = 'italic 900 58px Arial, sans-serif'; g.fillText(d + 'm', 28, 104); });
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    b.position.set(p.x, h + 1.6, p.z); b.rotation.y = fr.psi + Math.PI; grp.add(b);
    const post = new THREE.Mesh(GEO.box, new THREE.MeshLambertMaterial({ color: lc(0x555555) })); post.position.set(p.x, h + 0.6, p.z); post.scale.set(0.08, 1.2, 0.08); grp.add(post);
  }
}
function buildSpectators(grp) {
  const R = mulberry32(STAGE.seed + 77), list = [];
  const spots = [{ s: CR.sStart + 15, n: 40 }, { s: CR.sFin + 10, n: 60 }];
  CR.marks.forEach((m, i) => { if ((m.type === 'jump' || m.type === 'water' || m.type === 'crest') && i % 2 === 0) spots.push({ s: m.s, n: 16 + Math.floor(R() * 14) }); });
  const shirts = [0xd04030, 0x2a5aa0, 0xf0f0f0, 0x2a2a2a, 0xe0b030, 0x3a8a4a, 0x8a4ab0, 0xff8a30];
  for (const sp of spots) for (let k = 0; k < sp.n; k++) {
    const s = sp.s + (R() - 0.5) * 34, w = wAtS(clamp(s, 0, CR.L)), sd = R() < 0.5 ? -1 : 1, l = sd * (w + 4.2 + R() * 5), p = worldAt(s, l), h = H(s, l, p.x, p.z, true);
    if (nearWater(s, l, h)) continue;
    const fr = frameAt(s, {});
    list.push({ s, x: p.x, y: h - 0.05, z: p.z, ry: fr.psi + (sd > 0 ? -Math.PI / 2 : Math.PI / 2) + (R() - 0.5) * 0.8, sx: 0.92 + R() * 0.16, c: lc(shirts[Math.floor(R() * shirts.length)]) });
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  addInstanced(grp, SG.person, mat, list, false, 260);
}
function buildFarMountains(grp) {
  const T = THEME, R = mulberry32(STAGE.seed + 99), parts = [];
  const c0 = lc(T.mtn[0]), c1 = lc(T.mtn[1]), snow = lc(0xf4f6fa), q = {};
  const geo = SG.mtn, P = geo.attributes.position;
  const verts = [], cols = [];
  const v = new THREE.Vector3(), m = new THREE.Matrix4(), c = new THREE.Color();
  for (let s = -500; s < CR.L + 500; s += 170) {
    for (const sd of [-1, 1]) {
      if (R() < 0.15) continue;
      const fr = frameAt(clamp(s, 0, CR.L), {}), ex = s - clamp(s, 0, CR.L);
      let l = sd * (420 + R() * 520);
      const x = fr.x + fr.tx * ex + fr.rx * l, z = fr.z + fr.tz * ex + fr.rz * l;
      let dmin = 1e9; for (let i = 0; i < CR.N; i += 8) { const dx = CR.x[i] - x, dz = CR.z[i] - z, d2 = dx * dx + dz * dz; if (d2 < dmin) dmin = d2; }
      dmin = Math.sqrt(dmin);
      if (dmin < 330) continue;
      const hgt = (130 + R() * 280) * T.mtnH, rad = Math.min(hgt * (1.3 + R() * 0.8), dmin - 250);
      if (rad < 90) continue;
      const y0 = fr.y - 30;
      m.compose(new THREE.Vector3(x, y0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * TAU, 0)), new THREE.Vector3(rad, hgt, rad));
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i); const t = v.y; v.applyMatrix4(m);
        verts.push(v.x, v.y, v.z);
        c.copy(c0).lerp(c1, t * 0.8);
        if (T.mtnSnow && t > 0.62 - (hgt / 900) * 0.3) c.lerp(snow, smooth(0.6, 0.75, t + (i % 7) * 0.012));
        cols.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  grp.add(mesh);
  // clouds
  const cm = new THREE.SpriteMaterial({ map: TEX.cloud, transparent: true, depthWrite: false, fog: false, opacity: 0.9, color: lc(0xffffff).lerp(lc(T.fog[0]), 0.25) });
  for (let k = 0; k < T.clouds; k++) {
    const s = R() * CR.L, fr = frameAt(s, {}), l = (R() - 0.5) * 1800, sp = new THREE.Sprite(cm);
    sp.position.set(fr.x + fr.rx * l, fr.y + 260 + R() * 260, fr.z + fr.rz * l); const sc = 260 + R() * 320; sp.scale.set(sc, sc * 0.45, 1); grp.add(sp);
  }
}

function buildScenery(grp) {
  buildVegetation(grp);
  buildObstacles(grp);
  buildStructures(grp);
  buildGate(grp, CR.sStart, false); buildGate(grp, CR.sFin, true);
  buildBoards(grp); buildSpectators(grp); buildFarMountains(grp);
}
function updateScenery(dt, t) {
  if (!WORLD) return;
  const wm = WORLD.userData.waterMat; if (wm && wm.map) { wm.map.offset.x = (t * 0.03) % 1; wm.map.offset.y = (t * 0.11) % 1; }
  for (const a of SCN.anim) a.m.rotation.y = a.base + Math.sin(t * 2.3 + a.t) * 0.25;
  // knocked barrels
  for (let i = SCN.dyn.length - 1; i >= 0; i--) {
    const d = SCN.dyn[i], m = d.o.mesh;
    d.vy -= GRAV * dt; m.position.x += d.vx * dt; m.position.y += d.vy * dt; m.position.z += d.vz * dt;
    m.rotation.x += d.wx * dt; m.rotation.z += d.wz * dt;
    const q = {}; queryLocal(m.position.x, m.position.z, Math.round(d.o.s / CR.ds), 20, q);
    const gy = H(q.s, q.l, m.position.x, m.position.z, true) + 0.3;
    if (m.position.y < gy) { m.position.y = gy; d.vy = Math.abs(d.vy) * 0.3; d.vx *= 0.6; d.vz *= 0.6; d.wx *= 0.6; d.wz *= 0.6; if (Math.hypot(d.vx, d.vz) < 0.4) SCN.dyn.splice(i, 1); }
  }
}
function buildWorld() {
  disposeWorld();
  SCN.anim.length = 0; SCN.dyn.length = 0;
  WORLD = new THREE.Group(); WORLD.userData.chunks = []; WORLD.userData.inst = [];
  scene.add(WORLD);
  applyTheme();
  buildTerrain(WORLD); buildTrail(WORLD); buildWater(WORLD); buildScenery(WORLD); buildDynamic(WORLD); buildSky(WORLD);
}
const _frus = new THREE.Frustum(), _pm = new THREE.Matrix4();
function cullInstances(camPos, focus) {
  if (!WORLD) return;
  const far = scene.fog.far + 200;
  camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _frus.setFromProjectionMatrix(_pm);
  for (const m of WORLD.userData.inst) {
    const bs = m.userData.bs, d = Math.hypot(bs.center.x - camPos.x, bs.center.z - camPos.z) - bs.radius;
    m.visible = d < (m.userData.near || far) && _frus.intersectsSphere(bs);
    // only nearby chunks render into the shadow map
    const df = focus ? Math.hypot(bs.center.x - focus.x, bs.center.z - focus.z) - bs.radius : d;
    m.castShadow = m.userData.cast && Q.shadows && df < 45;
    if (m.castShadow) m.visible = m.visible || d < 60;
  }
}
