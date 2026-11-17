// ===================== Utilities =====================
let W = window.__SW || 1280; const HGT = 720;   // W grows on wide screens (see fit())
const TAU = Math.PI * 2;
const GRAV = 21;       // gravity (a bit stronger than real so jumps feel snappy at game speed)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapPi = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const sign = (v) => (v < 0 ? -1 : 1);

function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(20241002);          // world generation RNG (deterministic)
const frand = Math.random;               // gameplay randomness
const rr = (a, b) => a + (b - a) * frand();

// ---- value noise ----
const PERM = new Uint8Array(512);
(function () {
  const r = mulberry32(777), p = [];
  for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();
function hash2(ix, iz) { return PERM[(PERM[ix & 255] + iz) & 255] / 255; }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
function fbm(x, z, oct) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f) * a; n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// ---- tiny helpers for building geometry ----
function hex(c) { return new THREE.Color(c); }
// colours are authored in sRGB; the renderer works in linear space with sRGB output
function lc(c) { return (c instanceof THREE.Color ? c.clone() : new THREE.Color(c)).convertSRGBToLinear(); }
// merge [{geo, color(hex|Color), m(Matrix4)}] into one vertex-coloured BufferGeometry
function mergeParts(parts) {
  let vc = 0, ic = 0;
  const gs = parts.map((p) => {
    let g = p.geo.index ? p.geo : p.geo; // keep indexed
    vc += g.attributes.position.count;
    ic += g.index ? g.index.count : g.attributes.position.count;
    return g;
  });
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), col = new Float32Array(vc * 3);
  const idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  const v = new THREE.Vector3(), nm = new THREE.Matrix3(), n = new THREE.Vector3();
  parts.forEach((p, k) => {
    const g = gs[k];
    const c = p.color instanceof THREE.Color ? p.color.clone().convertSRGBToLinear() : lc(p.color);
    const m = p.m || new THREE.Matrix4();
    nm.getNormalMatrix(m);
    const P = g.attributes.position, N = g.attributes.normal, GC = g.attributes.color;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      nor[(vo + i) * 3] = n.x; nor[(vo + i) * 3 + 1] = n.y; nor[(vo + i) * 3 + 2] = n.z;
      const sh = p.shade === undefined ? 1 : p.shade;
      if (GC) { col[(vo + i) * 3] = c.r * sh * GC.getX(i); col[(vo + i) * 3 + 1] = c.g * sh * GC.getY(i); col[(vo + i) * 3 + 2] = c.b * sh * GC.getZ(i); }
      else { col[(vo + i) * 3] = c.r * sh; col[(vo + i) * 3 + 1] = c.g * sh; col[(vo + i) * 3 + 2] = c.b * sh; }
    }
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo; io += g.index.count; }
    else { for (let i = 0; i < P.count; i++) idx[io + i] = vo + i; io += P.count; }
    vo += P.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v3 = new THREE.Vector3(), _s3 = new THREE.Vector3();
// part descriptor: geometry + colour + position + euler rotation + scale
function part(geo, color, px, py, pz, rx, ry, rz, sx, sy, sz, shade) {
  _e.set(rx || 0, ry || 0, rz || 0, 'XYZ');
  _q.setFromEuler(_e);
  _v3.set(px || 0, py || 0, pz || 0);
  _s3.set(sx === undefined ? 1 : sx, sy === undefined ? (sx === undefined ? 1 : sx) : sy, sz === undefined ? (sx === undefined ? 1 : sx) : sz);
  return { geo, color, m: new THREE.Matrix4().compose(_v3, _q, _s3), shade };
}
// cached primitive geometries
const GEO = {
  sphere: new THREE.SphereGeometry(1, 12, 8),
  sphereLo: new THREE.SphereGeometry(1, 8, 6),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10, 1),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 7, 1),
  cone: new THREE.ConeGeometry(1, 1, 8, 1),
  coneLo: new THREE.ConeGeometry(1, 1, 7, 1),
  coneOpen: new THREE.ConeGeometry(1, 1, 7, 1, true),
  cylOpen: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  torus: new THREE.TorusGeometry(1, 0.22, 8, 22),
  dodec: new THREE.DodecahedronGeometry(1, 0),
};
// lumpy rock geometry (displaced icosahedron), cached by seed
const ROCKGEO = [];
function rockGeo(k, detail) {
  const key = k + (detail === 0 ? 1000 : 0);
  if (ROCKGEO[key]) return ROCKGEO[key];
  const g = new THREE.IcosahedronGeometry(1, detail === 0 ? 0 : 1), P = g.attributes.position, r = mulberry32(900 + k * 17), v = new THREE.Vector3();
  const sx = 0.8 + r() * 0.5, sy = 0.55 + r() * 0.35, sz = 0.8 + r() * 0.5;
  const map = new Map();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const key = Math.round(v.x * 1000) + ',' + Math.round(v.y * 1000) + ',' + Math.round(v.z * 1000);
    let d = map.get(key); if (d === undefined) { d = 0.78 + r() * 0.36; map.set(key, d); }
    const flat = v.y < -0.3 ? 0.55 : 1;   // flatter base so rocks sit on the ground
    P.setXYZ(i, v.x * d * sx, v.y * d * sy * flat, v.z * d * sz);
  }
  g.computeVertexNormals();
  ROCKGEO[key] = g; return g;
}
// ---- canvas helper ----
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
