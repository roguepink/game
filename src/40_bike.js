// ===================== Dirt bike + rider (procedural, articulated) =====================
// bike frame: origin on the ground between the tyres, +z forward, +y up, right = -x
const BK = { rake: 0.43, head: [0, 1.02, 0.46], fork: 0.716, pivot: [0, 0.5, -0.12], swing: 0.62, rF: 0.37, rR: 0.345, peg: [0.2, 0.44, -0.06] };
const MAT = {};
function bikeMaterials() {
  MAT.plastic = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: lc(0x3a3a3a) });
  MAT.metal = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: lc(0x9a9a9a) });
  MAT.dark = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.cloth = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.blob = new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false, opacity: 0.85 });
  for (const k in MAT) MAT[k].userData.shared = true;
}
function numberTex(num, bg, fg) {
  const c = mkCanvas(128, 96), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 128, 96);
  g.fillStyle = fg; g.font = 'italic 900 74px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), 64, 52);
  const t = canvasTex(c, false); return t;
}
const hexStr = (c) => '#' + c.toString(16).padStart(6, '0');
// knobby tyre: torus + knobs
function tyreGeo(R) {
  const parts = [part(GEO.torus, 0x1b1b1b, 0, 0, 0, 0, Math.PI / 2, 0, R * 0.8, R * 0.8, R * 1.15)];
  for (let k = 0; k < 26; k++) {
    const a = k / 26 * TAU, y = Math.sin(a) * R * 0.98, z = Math.cos(a) * R * 0.98;
    for (const sx of [-1, 1]) parts.push(part(GEO.box, 0x222222, sx * 0.035 * ((k % 2) ? 1 : 0.6), y, z, -a, 0, 0, 0.05, 0.035, 0.05));
  }
  return mergeParts(parts);
}
function rimGeo(R, disc) {
  const parts = [part(GEO.torus, 0xb9bcc0, 0, 0, 0, 0, Math.PI / 2, 0, R * 0.62, R * 0.62, R * 0.25), part(GEO.cyl, 0x8a8d90, 0, 0, 0, 0, 0, Math.PI / 2, 0.05, 0.16, 0.05)];
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; parts.push(part(GEO.cylLo, 0xa0a4a8, (k % 2 ? 0.03 : -0.03), Math.sin(a) * R * 0.32, Math.cos(a) * R * 0.32, Math.PI / 2 - a, 0, 0, 0.006, R * 0.6, 0.006)); }
  if (disc) parts.push(part(GEO.cyl, 0x9a9da2, 0.07, 0, 0, 0, 0, Math.PI / 2, 0.14, 0.01, 0.14));
  return mergeParts(parts);
}
const _tyreF = {}, _tyreR = {};
function makeBike(rd) {
  const col = rd.col, col2 = rd.col2;
  const root = new THREE.Group();          // yaw/pitch/roll, sits on the ground
  const body = new THREE.Group(); root.add(body);
  const P = part;
  // ---- frame / engine / plastics ----
  const plast = [
    P(GEO.box, col, 0, 0.99, 0.2, -0.08, 0, 0, 0.3, 0.2, 0.44),                         // tank
    P(GEO.box, col, 0.18, 0.9, 0.3, -0.25, 0, 0.12, 0.04, 0.28, 0.42), P(GEO.box, col, -0.18, 0.9, 0.3, -0.25, 0, -0.12, 0.04, 0.28, 0.42),   // shrouds
    P(GEO.box, 0x16181a, 0, 1.0, -0.27, 0.03, 0, 0, 0.25, 0.07, 0.8),                  // seat
    P(GEO.box, col2, 0, 0.98, -0.86, 0.26, 0, 0, 0.19, 0.03, 0.62),                    // rear fender
    P(GEO.box, col, 0.135, 0.84, -0.46, 0.15, 0, 0.1, 0.04, 0.24, 0.36), P(GEO.box, col, -0.135, 0.84, -0.46, 0.15, 0, -0.1, 0.04, 0.24, 0.36),   // side panels
    P(GEO.box, 0x111111, 0, 0.72, -0.4, 0, 0, 0, 0.2, 0.18, 0.3),                       // airbox
  ];
  const metal = [
    P(GEO.cyl, 0xb8bcc0, 0, 0.7, 0.3, 0.45, 0, 0, 0.03, 0.72, 0.03),                // down tube
    P(GEO.cyl, 0xb8bcc0, 0.09, 0.87, 0.15, 1.22, 0, 0, 0.022, 0.66, 0.022), P(GEO.cyl, 0xb8bcc0, -0.09, 0.87, 0.15, 1.22, 0, 0, 0.022, 0.66, 0.022),  // spars
    P(GEO.cyl, 0xb8bcc0, 0.1, 0.88, -0.62, 1.5, 0, 0, 0.016, 0.5, 0.016), P(GEO.cyl, 0xb8bcc0, -0.1, 0.88, -0.62, 1.5, 0, 0, 0.016, 0.5, 0.016),  // subframe
    P(GEO.cylLo, 0xc8c8c8, -0.13, 0.62, 0.22, 1.0, 0, 0.3, 0.032, 0.35, 0.032),          // header pipe
    P(GEO.cylLo, 0xc8c8c8, -0.16, 0.7, -0.22, 1.25, 0, 0.0, 0.03, 0.55, 0.03),
    P(GEO.cyl, 0xd2d4d6, -0.17, 0.84, -0.62, 1.32, 0, 0, 0.058, 0.44, 0.058),          // silencer
    P(GEO.cyl, 0x2a2a2a, -0.17, 0.89, -0.85, 1.32, 0, 0, 0.04, 0.03, 0.04),
    P(GEO.box, 0x9a9da0, 0.2, BK.peg[1], BK.peg[2], 0, 0, 0, 0.1, 0.025, 0.05), P(GEO.box, 0x9a9da0, -0.2, BK.peg[1], BK.peg[2], 0, 0, 0, 0.1, 0.025, 0.05),
    P(GEO.box, 0x8a8c90, 0.17, 0.84, 0.38, -0.2, 0, 0, 0.03, 0.26, 0.2), P(GEO.box, 0x8a8c90, -0.17, 0.84, 0.38, -0.2, 0, 0, 0.03, 0.26, 0.2),   // radiators
  ];
  const dark = [
    P(GEO.box, 0x3a3c40, 0, 0.5, 0.0, 0, 0, 0, 0.24, 0.3, 0.38),                       // crankcase
    P(GEO.box, 0x4a4c50, 0, 0.74, 0.12, -0.35, 0, 0, 0.18, 0.22, 0.18),                 // cylinder
    P(GEO.box, 0x2a2c30, 0, 0.88, 0.16, -0.35, 0, 0, 0.2, 0.06, 0.2),
    P(GEO.cyl, rd.num % 2 ? 0xe8b020 : 0xd03020, 0, 0.7, -0.33, 0.55, 0, 0, 0.045, 0.36, 0.045),   // shock spring
  ];
  [plast, metal, dark].forEach((arr, k) => { const m = new THREE.Mesh(mergeParts(arr), [MAT.plastic, MAT.metal, MAT.dark][k]); m.castShadow = true; body.add(m); });
  // number plates
  const nt = numberTex(rd.num, '#f4f4f0', '#111111'), nt2 = numberTex(rd.num, hexStr(col), hexStr(col2));
  const plateM = new THREE.MeshLambertMaterial({ map: nt }), sideM = new THREE.MeshLambertMaterial({ map: nt2 });
  for (const sd of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), sideM); pl.position.set(sd * 0.158, 0.86, -0.46); pl.rotation.set(0, sd * Math.PI / 2, 0); body.add(pl); }
  // ---- steering assembly (rotates about the raked head axis) ----
  const head = new THREE.Group(); head.position.set(BK.head[0], BK.head[1], BK.head[2]); head.rotation.x = -BK.rake; body.add(head);
  const steer = new THREE.Group(); head.add(steer);
  const stM = new THREE.Mesh(mergeParts([
    P(GEO.cyl, 0xd8b04a, 0.1, -0.2, 0.03, 0, 0, 0, 0.034, 0.48, 0.034), P(GEO.cyl, 0xd8b04a, -0.1, -0.2, 0.03, 0, 0, 0, 0.034, 0.48, 0.034),   // fork tubes (gold)
    P(GEO.box, 0x8a8c90, 0, 0.02, 0.02, 0, 0, 0, 0.3, 0.05, 0.1), P(GEO.box, 0x8a8c90, 0, -0.1, 0.02, 0, 0, 0, 0.28, 0.04, 0.09),             // triple clamps
    P(GEO.cyl, 0x2a2a2a, 0, 0.14, -0.03, 0, 0, Math.PI / 2, 0.016, 0.8, 0.016),                                                              // bar
    P(GEO.cyl, 0x111111, 0.36, 0.14, -0.03, 0, 0, Math.PI / 2, 0.022, 0.12, 0.022), P(GEO.cyl, 0x111111, -0.36, 0.14, -0.03, 0, 0, Math.PI / 2, 0.022, 0.12, 0.022),
    P(GEO.box, col2, 0, -0.05, 0.13, 0.35, 0, 0, 0.27, 0.24, 0.02),                                                                          // plate
    P(GEO.box, col2, 0, -0.42, 0.2, 0.55, 0, 0, 0.16, 0.025, 0.5),                                                                           // front fender
  ]), MAT.plastic); stM.castShadow = true; steer.add(stM);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), plateM); plate.position.set(0, -0.05, 0.145); plate.rotation.x = -0.35 + 0; steer.add(plate);
  // front wheel slides along the fork axis
  const fw = new THREE.Group(); fw.position.set(0, -BK.fork, 0.04); steer.add(fw);
  const sliders = new THREE.Mesh(mergeParts([P(GEO.cyl, 0x1e1e1e, 0.1, 0.2, 0, 0, 0, 0, 0.045, 0.42, 0.045), P(GEO.cyl, 0x1e1e1e, -0.1, 0.2, 0, 0, 0, 0, 0.045, 0.42, 0.045)]), MAT.dark); fw.add(sliders);
  const fspin = new THREE.Group(); fspin.rotation.x = BK.rake; fw.add(fspin);   // undo rake so the wheel stands upright
  if (!_tyreF.g) { _tyreF.g = tyreGeo(BK.rF); _tyreF.r = rimGeo(BK.rF, true); _tyreR.g = tyreGeo(BK.rR); _tyreR.r = rimGeo(BK.rR, false); }
  const fwheel = new THREE.Group(); fspin.add(fwheel);
  const ft = new THREE.Mesh(_tyreF.g, MAT.dark), fr = new THREE.Mesh(_tyreF.r, MAT.metal); ft.castShadow = true; fwheel.add(ft, fr);
  // ---- swingarm + rear wheel ----
  const swing = new THREE.Group(); swing.position.set(BK.pivot[0], BK.pivot[1], BK.pivot[2]); body.add(swing);
  const swM = new THREE.Mesh(mergeParts([P(GEO.box, 0xb0b4b8, 0.1, 0, -0.31, 0, 0, 0, 0.04, 0.07, 0.62), P(GEO.box, 0xb0b4b8, -0.1, 0, -0.31, 0, 0, 0, 0.04, 0.07, 0.62), P(GEO.box, 0x2a2a2a, 0.12, 0.04, -0.4, 0, 0, 0, 0.02, 0.02, 0.5)]), MAT.metal);
  swing.add(swM);
  const rwheel = new THREE.Group(); rwheel.position.set(0, 0, -BK.swing); swing.add(rwheel);
  const rt = new THREE.Mesh(_tyreR.g, MAT.dark), rr2 = new THREE.Mesh(_tyreR.r, MAT.metal); rt.castShadow = true; rwheel.add(rt, rr2);
  // contact shadow
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.3), MAT.blob); blob.rotation.x = -Math.PI / 2; blob.renderOrder = 3;
  const rider = makeRider(rd);
  body.add(rider.grp);
  return { root, body, head, steer, fw, fwheel, swing, rwheel, rider, blob, mats: [plateM, sideM, nt, nt2], comp: [0, 0] };
}

// ---------- rider ----------
function limb(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; }
function makeRider(rd) {
  const grp = new THREE.Group(), jer = rd.col, acc = rd.col2, P = part;
  const cyl = (rt, rb) => { const g = new THREE.CylinderGeometry(rt, rb, 1, 9, 1); g.translate(0, 0.5, 0); return g; };
  const gUpperArm = cyl(0.05, 0.06), gFore = cyl(0.042, 0.05), gThigh = cyl(0.075, 0.09), gShin = cyl(0.062, 0.07);
  const colorize = (g, hex) => { const n = g.attributes.position.count, c = lc(hex), a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const arms = [], legs = [];
  for (const sd of [-1, 1]) {
    const ua = limb(colorize(gUpperArm.clone(), jer), MAT.cloth), fa = limb(colorize(gFore.clone(), acc), MAT.cloth);
    const glove = limb(mergeParts([P(GEO.sphereLo, 0x1a1a1a, 0, 0, 0, 0, 0, 0, 0.055, 0.05, 0.07)]), MAT.dark);
    const th = limb(colorize(gThigh.clone(), jer), MAT.cloth), sh = limb(colorize(gShin.clone(), 0xeeeeee), MAT.plastic);
    const knee = limb(mergeParts([P(GEO.sphereLo, 0x2a2a2a, 0, 0, 0, 0, 0, 0, 0.09, 0.1, 0.09)]), MAT.dark);
    const boot = limb(mergeParts([P(GEO.box, 0xf0f0f0, 0, 0.03, 0.06, 0, 0, 0, 0.12, 0.1, 0.28), P(GEO.box, 0x1a1a1a, 0, -0.02, 0.06, 0, 0, 0, 0.125, 0.03, 0.29), P(GEO.box, acc, 0, 0.13, 0.0, 0, 0, 0, 0.13, 0.08, 0.14)]), MAT.plastic);
    grp.add(ua, fa, glove, th, sh, knee, boot);
    arms.push({ sd, ua, fa, glove }); legs.push({ sd, th, sh, knee, boot });
  }
  // torso (pelvis -> chest), built along +y, tilted each frame
  const torso = limb(mergeParts([
    P(GEO.box, jer, 0, 0.24, 0, 0, 0, 0, 0.38, 0.5, 0.25), P(GEO.box, acc, 0, 0.12, 0, 0, 0, 0, 0.385, 0.08, 0.255),
    P(GEO.sphereLo, jer, 0.2, 0.45, 0, 0, 0, 0, 0.09, 0.08, 0.1), P(GEO.sphereLo, jer, -0.2, 0.45, 0, 0, 0, 0, 0.09, 0.08, 0.1),
    P(GEO.box, 0x222222, 0, 0.32, -0.13, 0, 0, 0, 0.3, 0.3, 0.02),
  ]), MAT.cloth);
  const pelvis = limb(mergeParts([P(GEO.box, jer, 0, 0, -0.02, 0, 0, 0, 0.34, 0.2, 0.26), P(GEO.box, 0x222222, 0, 0.09, -0.02, 0, 0, 0, 0.345, 0.04, 0.265)]), MAT.cloth);
  const backNo = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.17), new THREE.MeshLambertMaterial({ map: numberTex(rd.num, hexStr(jer), hexStr(acc)) }));
  backNo.position.set(0, 0.32, -0.142); backNo.rotation.y = Math.PI; torso.add(backNo);
  const helmet = limb(mergeParts([
    P(GEO.sphere, rd.helm, 0, 0, -0.01, 0, 0, 0, 0.155, 0.16, 0.18),
    P(GEO.sphereLo, rd.helm, 0, -0.085, 0.13, 0.2, 0, 0, 0.11, 0.07, 0.1),          // chin bar
    P(GEO.box, 0x15171a, 0, -0.07, 0.205, 0.35, 0, 0, 0.07, 0.05, 0.03),            // mouth vent
    P(GEO.box, acc, 0, 0.115, 0.13, 0.22, 0, 0, 0.2, 0.014, 0.17),                  // peak
    P(GEO.box, 0x1a1a1a, 0, 0.015, 0.155, 0, 0, 0, 0.21, 0.065, 0.05),              // goggle frame
    P(GEO.box, 0xff9a30, 0, 0.015, 0.18, 0, 0, 0, 0.17, 0.045, 0.012),              // tinted lens
    P(GEO.box, 0x1a1a1a, 0, 0.015, -0.03, 0, 0, 0, 0.318, 0.035, 0.3),              // goggle strap
    P(GEO.box, acc, 0, 0.09, -0.04, 0, 0, 0, 0.05, 0.02, 0.33),                     // stripe
  ]), MAT.plastic);
  grp.add(torso, pelvis, helmet);
  return { grp, arms, legs, torso, pelvis, helmet, backNo };
}
// two-bone IK: returns the middle joint for root A, end C, lengths a,b and pole direction p (all bike-local)
const _u = new THREE.Vector3(), _vv = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3();
function ik(A, C, a, b, pole, out) {
  _u.subVectors(C, A); let d = _u.length(); if (d < 1e-4) { out.copy(A); return out; }
  _u.divideScalar(d); d = Math.min(d, a + b - 1e-3);
  const ca = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  _vv.copy(pole).addScaledVector(_u, -pole.dot(_u)).normalize();
  return out.copy(A).addScaledVector(_u, a * ca).addScaledVector(_vv, a * sa);
}
function placeSeg(m, A, B) {
  _dir.subVectors(B, A); const len = _dir.length(); if (len < 1e-4) return;
  m.position.copy(A); m.quaternion.setFromUnitVectors(_up, _dir.divideScalar(len)); m.scale.set(1, len, 1);
}
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3(), _K = new THREE.Vector3(), _pole = new THREE.Vector3(), _hc = new THREE.Vector3(), _sc = new THREE.Vector3(), _grip = new THREE.Vector3(), _m4b = new THREE.Matrix4();
// pose: {stand 0..1, crouch 0..1, leanB (+back), side (lean into turn), flail 0..1, t}
function poseRider(b, ps) {
  const R = b.rider;
  // hips
  const st = ps.stand, cr = ps.crouch;
  _hc.set(ps.side * 0.06, lerp(1.07, 1.3, st) - cr * 0.16, lerp(-0.31, -0.17, st) - cr * 0.05 - ps.leanB * 0.12);
  const beta = lerp(0.5, 0.66, st) + cr * 0.25 - ps.leanB * 0.4;          // torso forward lean
  _sc.set(_hc.x + ps.side * 0.06, _hc.y + Math.cos(beta) * 0.5, _hc.z + Math.sin(beta) * 0.5);
  R.pelvis.position.copy(_hc); R.pelvis.rotation.set(beta * 0.5, 0, -ps.side * 0.2);
  placeSeg(R.torso, _hc, _sc); R.torso.rotateY(0); R.torso.scale.set(1, 1, 1);
  R.helmet.position.set(_sc.x + ps.side * 0.03, _sc.y + 0.24 - cr * 0.03, _sc.z + 0.07); R.helmet.rotation.set(-beta * 0.35 + 0.15 + (ps.look || 0), ps.yaw || 0, -ps.side * 0.25);
  // grips follow the steering assembly
  b.head.updateMatrix(); b.steer.updateMatrix(); _m4b.multiplyMatrices(b.head.matrix, b.steer.matrix);
  for (const a of R.arms) {
    _A.set(_sc.x + a.sd * 0.2, _sc.y - 0.05, _sc.z - 0.02);
    if (ps.flail > 0) { const t = ps.t * 9 + a.sd; _grip.set(a.sd * (0.55 + 0.1 * Math.sin(t)), _A.y + 0.15 + 0.25 * Math.sin(t * 1.3), _A.z + 0.25 * Math.cos(t)); }
    else _grip.set(a.sd * 0.34, 0.15, -0.03).applyMatrix4(_m4b);
    _pole.set(a.sd * 1, 0.4, -0.7);
    ik(_A, _grip, 0.31, 0.3, _pole, _K);
    placeSeg(a.ua, _A, _K); placeSeg(a.fa, _K, _grip); a.glove.position.copy(_grip);
  }
  for (const l of R.legs) {
    _A.set(_hc.x + l.sd * 0.11, _hc.y - 0.04, _hc.z);
    if (ps.flail > 0) { const t = ps.t * 7 + l.sd * 2; _C.set(l.sd * 0.25, _A.y - 0.7 + 0.2 * Math.sin(t), _A.z + 0.3 * Math.cos(t)); }
    else {
      _C.set(l.sd * 0.19, BK.peg[1] + 0.09, BK.peg[2] - 0.03);
      // inside foot out in a hard corner
      const dab = ps.dab ? clamp(ps.dab * l.sd, 0, 1) : 0;
      if (dab > 0) { _C.x = lerp(_C.x, l.sd * 0.6, dab); _C.y = lerp(_C.y, 0.3, dab); _C.z = lerp(_C.z, 0.42, dab); }
    }
    _pole.set(l.sd * 0.3, 0.1, 1);
    ik(_A, _C, 0.45, 0.46, _pole, _K);
    placeSeg(l.th, _A, _K); placeSeg(l.sh, _K, _C); l.knee.position.copy(_K);
    l.boot.position.set(_C.x, _C.y - 0.06, _C.z); l.boot.rotation.set(0, 0, 0);
  }
}
// suspension + wheels + steering visual state
function setBikeMech(b, compF, compR, steerA, spin) {
  b.steer.rotation.y = steerA;
  b.fw.position.y = -BK.fork + compF / Math.cos(BK.rake);
  const yAx = -0.16 + compR; b.swing.rotation.x = Math.asin(clamp(yAx / BK.swing, -0.95, 0.95));
  b.body.position.y = -(compF + compR) * 0.5;
  b.fwheel.rotation.x = spin.f; b.rwheel.rotation.x = spin.r;
}
