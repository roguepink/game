// ===================== Renderer / textures / terrain / trail / water =====================
let renderer, scene, camera, sun, hemi, skyMesh, glCanvas, WORLD = null;
const TEX = {};
const Q = { level: 2, pixelRatio: 1, shadows: true, grass: 1 };
const SKYU = { cTop: { value: new THREE.Color() }, cMid: { value: new THREE.Color() }, cHor: { value: new THREE.Color() }, fogCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() } };

function initGL(canvas) {
  glCanvas = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, HGT, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcccccc, 150, 1500);
  camera = new THREE.PerspectiveCamera(64, W / HGT, 0.3, 3400);
  window.__onStageW = (sw) => { W = sw; renderer.setSize(W, HGT, false); camera.aspect = W / HGT; camera.updateProjectionMatrix(); };
  hemi = new THREE.HemisphereLight(0xffffff, 0x666655, 0.6); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 5; sc.far = 300;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  scene.add(sun); scene.add(sun.target);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: SKYU,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = vec4(p.xy, p.w * 0.99995, p.w); }',
    fragmentShader: `varying vec3 vDir; uniform vec3 cTop, cMid, cHor, fogCol, sunDir, sunCol;
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(cHor, cMid, smoothstep(0.0, 0.2, h));
        c = mix(c, cTop, smoothstep(0.16, 0.8, h));
        c = mix(c, fogCol, 1.0 - smoothstep(-0.03, 0.09, h));
        float sd = max(dot(d, sunDir), 0.0);
        c += sunCol * (pow(sd, 1400.0) * 9.0 + pow(sd, 14.0) * 0.16 + pow(sd, 3.0) * 0.05);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat);
  skyMesh.renderOrder = -10; skyMesh.frustumCulled = false;
  scene.add(skyMesh);
}
function applyTheme() {
  const T = THEME;
  SKYU.cTop.value.copy(lc(T.sky[0])); SKYU.cMid.value.copy(lc(T.sky[1])); SKYU.cHor.value.copy(lc(T.sky[2]));
  SKYU.fogCol.value.copy(lc(T.fog[0]));
  const sd = new THREE.Vector3(T.sun[0], T.sun[1], T.sun[2]).normalize(); SKYU.sunDir.value.copy(sd);
  SKYU.sunCol.value.copy(lc(T.sunCol));
  scene.fog.color.copy(lc(T.fog[0])); scene.fog.near = T.fog[1]; scene.fog.far = T.fog[2] * 1.9;
  sun.color.copy(lc(T.sunCol)); sun.intensity = T.sunI;
  hemi.color.copy(lc(T.hemi[0])); hemi.groundColor.copy(lc(T.hemi[1])); hemi.intensity = T.hemi[2];
  renderer.toneMappingExposure = T.exp;
  renderer.setClearColor(lc(T.fog[0]), 1);
}

// ---------- canvas textures ----------
function canvasTex(c, rep, srgb) {
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.wrapS = rep ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.wrapT = rep ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  return t;
}
function speckle(g, S, r, n, cols, smin, smax, alpha) {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, s = smin + r() * (smax - smin);
    g.globalAlpha = alpha; g.fillStyle = cols[Math.floor(r() * cols.length)];
    for (const oy of [-S, 0, S]) for (const ox of [-S, 0, S]) { g.beginPath(); g.ellipse(x + ox, y + oy, s, s * (0.6 + r() * 0.4), r() * 3, 0, TAU); g.fill(); }
  }
  g.globalAlpha = 1;
}
function blotch(g, S, r, n, light, dark, rmin, rmax) {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rad = rmin + r() * (rmax - rmin), l = r() < 0.5;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, l ? light : dark); gr.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = gr;
    for (const oy of [-S, 0, S]) for (const ox of [-S, 0, S]) { g.save(); g.translate(ox, oy); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); }
  }
}
function raggedEdges(g, S, depth, seed) {
  g.globalCompositeOperation = 'destination-out';
  for (let y = 0; y < S; y++) {
    const a = y / S * TAU;
    const eL = depth * (0.55 + 0.25 * Math.sin(a * 3 + seed) + 0.12 * Math.sin(a * 11 + seed * 2) + 0.08 * Math.sin(a * 23));
    const eR = depth * (0.55 + 0.25 * Math.sin(a * 4 + seed * 3) + 0.12 * Math.sin(a * 9 + 1) + 0.08 * Math.sin(a * 19 + 2));
    g.fillRect(0, y, eL, 1); g.fillRect(S - eR, y, eR, 1);
  }
  g.globalCompositeOperation = 'source-over';
}
function makeTextures() {
  // trail dirt (neutral, tinted by material colour)
  {
    const S = 512, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry32(5);
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, S, S);
    blotch(g, S, r, 120, 'rgba(255,255,255,.22)', 'rgba(60,60,60,.18)', 20, 70);
    // packed racing line + tyre tracks
    for (const u of [0.3, 0.42, 0.58, 0.7]) {
      for (let k = 0; k < 3; k++) {
        const off = (r() - 0.5) * 22; g.strokeStyle = 'rgba(70,70,70,.20)'; g.lineWidth = 5 + r() * 5;
        g.beginPath(); for (let y = 0; y <= S; y += 8) { const x = u * S + off + Math.sin(y / S * TAU * (1 + k) + k) * 9; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      }
    }
    speckle(g, S, r, 2600, ['#9a9a9a', '#e8e8e8', '#7a7a7a', '#f6f6f6'], 0.6, 1.8, 0.55);
    for (let i = 0; i < 160; i++) {
      const x = r() * S, y = r() * S, rw = 2.5 + r() * 5;
      g.fillStyle = 'rgba(40,40,40,.35)'; g.beginPath(); g.ellipse(x + 1.2, y + 1.6, rw, rw * 0.7, 0, 0, TAU); g.fill();
      g.fillStyle = r() < 0.5 ? '#f0f0f0' : '#b8b8b8'; g.beginPath(); g.ellipse(x, y, rw, rw * 0.7, r() * 3, 0, TAU); g.fill();
    }
    raggedEdges(g, S, 52, 1.3);
    TEX.trail = canvasTex(c, true);
  }
  // gravel
  {
    const S = 512, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry32(6);
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 5200; i++) {
      const x = r() * S, y = r() * S, s = 1.6 + r() * 3.6, v = Math.floor(130 + r() * 125);
      g.fillStyle = 'rgba(30,30,30,.4)'; g.beginPath(); g.ellipse(x + 0.8, y + 1.1, s, s * 0.75, 0, 0, TAU); g.fill();
      g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(x, y, s, s * (0.55 + r() * 0.4), r() * 3, 0, TAU); g.fill();
    }
    for (const u of [0.36, 0.64]) { g.fillStyle = 'rgba(60,60,60,.16)'; g.fillRect(u * S - 18, 0, 36, S); }
    raggedEdges(g, S, 40, 2.1);
    TEX.gravel = canvasTex(c, true);
  }
  // sand
  {
    const S = 512, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry32(7);
    g.fillStyle = '#e2e2e2'; g.fillRect(0, 0, S, S);
    blotch(g, S, r, 60, 'rgba(255,255,255,.25)', 'rgba(140,140,140,.18)', 30, 90);
    for (let k = 0; k < 46; k++) {
      const y0 = r() * S; g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(120,120,120,.22)'; g.lineWidth = 2 + r() * 2;
      g.beginPath(); for (let x = 0; x <= S; x += 8) { const y = y0 + Math.sin(x / S * TAU * 2 + k) * 6; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    }
    for (const u of [0.34, 0.5, 0.66]) { g.strokeStyle = 'rgba(90,90,90,.28)'; g.lineWidth = 12; g.beginPath(); for (let y = 0; y <= S; y += 8) { const x = u * S + Math.sin(y / S * TAU * 2 + u * 9) * 14; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    speckle(g, S, r, 1500, ['#cfcfcf', '#f8f8f8'], 0.5, 1.2, 0.5);
    raggedEdges(g, S, 60, 3.3);
    TEX.sand = canvasTex(c, true);
  }
  // mud
  {
    const S = 512, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry32(8);
    g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, S, S);
    blotch(g, S, r, 90, 'rgba(160,160,160,.3)', 'rgba(20,20,20,.35)', 16, 60);
    for (const u of [0.33, 0.47, 0.6, 0.7]) { g.strokeStyle = 'rgba(25,25,25,.45)'; g.lineWidth = 9 + r() * 8; g.beginPath(); for (let y = 0; y <= S; y += 8) { const x = u * S + Math.sin(y / S * TAU * 3 + u * 7) * 10; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    for (let i = 0; i < 60; i++) { const x = r() * S, y = r() * S, w = 6 + r() * 22; g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(x, y, w, w * 0.3, 0.2, 0, TAU); g.fill(); }
    raggedEdges(g, S, 70, 4.1);
    TEX.mud = canvasTex(c, true);
  }
  // rock garden ground
  {
    const S = 512, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry32(9);
    g.fillStyle = '#a0a0a0'; g.fillRect(0, 0, S, S);
    blotch(g, S, r, 80, 'rgba(255,255,255,.2)', 'rgba(40,40,40,.25)', 20, 60);
    for (let i = 0; i < 420; i++) {
      const x = r() * S, y = r() * S, s = 4 + r() * 14, v = Math.floor(120 + r() * 120), n = 5 + Math.floor(r() * 3);
      g.fillStyle = 'rgba(20,20,20,.45)'; g.beginPath(); for (let k = 0; k < n; k++) { const a = k / n * TAU, rr2 = s * (0.7 + r() * 0.4); g.lineTo(x + 2 + Math.cos(a) * rr2, y + 3 + Math.sin(a) * rr2 * 0.8); } g.fill();
      g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); for (let k = 0; k < n; k++) { const a = k / n * TAU, rr2 = s * (0.7 + r() * 0.4); g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2 * 0.8); } g.fill();
    }
    raggedEdges(g, S, 46, 5.7);
    TEX.rockz = canvasTex(c, true);
  }
  // terrain detail (grey, multiplies vertex colours)
  {
    const S = 512, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry32(33);
    g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, S, S);
    blotch(g, S, r, 140, 'rgba(255,255,255,.16)', 'rgba(0,0,0,.12)', 14, 60);
    for (let i = 0; i < 9000; i++) { const x = r() * S, y = r() * S; g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.16)'; g.fillRect(x, y, 1.3, 1.3 + r() * 3.5); }
    TEX.ground = canvasTex(c, true);
  }
  // water ripples (alpha)
  {
    const S = 256, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry32(12);
    g.fillStyle = 'rgba(255,255,255,1)'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 70; k++) {
      const y0 = r() * S, a = 2 + r() * 5; g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,1)' : 'rgba(150,170,180,1)'; g.lineWidth = 1 + r() * 2.5;
      g.beginPath(); for (let x = -10; x <= S + 10; x += 6) { const y = y0 + Math.sin(x / S * TAU * (1 + Math.floor(r() * 2)) + k) * a; x > -10 ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    }
    for (let i = 0; i < 180; i++) { const x = r() * S, y = r() * S; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(x, y, 2 + r() * 6, 1); }
    TEX.water = canvasTex(c, true);
  }
  // soft particle
  {
    const c = mkCanvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); TEX.soft = canvasTex(c, false, false);
  }
  // billowy smoke / dust puff
  {
    const S = 128, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry32(14);
    for (let i = 0; i < 22; i++) {
      const a = r() * TAU, d = r() * 26, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, rad = 18 + r() * 22;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }
    TEX.puff = canvasTex(c, false, false);
  }
  // droplet / grit
  {
    const c = mkCanvas(32, 32), g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.9)'); gr.addColorStop(0.75, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); TEX.drop = canvasTex(c, false, false);
  }
  // grass blades card
  {
    const Wc = 128, Hc = 128, c = mkCanvas(Wc, Hc), g = c.getContext('2d'), r = mulberry32(15);
    for (let i = 0; i < 46; i++) {
      const x = 8 + r() * 112, h = 50 + r() * 74, bend = (r() - 0.5) * 30, v = Math.floor(150 + r() * 105);
      g.strokeStyle = `rgb(${v},${v},${Math.floor(v * 0.9)})`; g.lineWidth = 2 + r() * 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, Hc); g.quadraticCurveTo(x + bend * 0.3, Hc - h * 0.5, x + bend, Hc - h); g.stroke();
    }
    TEX.grass = canvasTex(c, false);
  }
  // cloud
  {
    const c = mkCanvas(256, 128), g = c.getContext('2d'), r = mulberry32(44);
    for (let i = 0; i < 26; i++) {
      const x = 30 + r() * 196, y = 70 + (r() - 0.6) * 30, rad = 16 + r() * 30;
      const gr = g.createRadialGradient(x, y - rad * 0.3, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.7, 'rgba(250,250,252,.7)'); gr.addColorStop(1, 'rgba(240,244,250,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-atop'; const gr2 = g.createLinearGradient(0, 60, 0, 120); gr2.addColorStop(0, 'rgba(200,205,215,0)'); gr2.addColorStop(1, 'rgba(170,178,190,.7)'); g.fillStyle = gr2; g.fillRect(0, 60, 256, 68);
    TEX.cloud = canvasTex(c, false);
  }
  // contact shadow blob
  {
    const c = mkCanvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(0.55, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); TEX.blob = canvasTex(c, false, false);
  }
  // course tape
  {
    const c = mkCanvas(64, 16), g = c.getContext('2d');
    for (let x = 0; x < 64; x += 16) { g.fillStyle = '#ff6a10'; g.fillRect(x, 0, 8, 16); g.fillStyle = '#f4f4f0'; g.fillRect(x + 8, 0, 8, 16); }
    TEX.tape = canvasTex(c, true);
  }
}

// ---------- terrain ribbon ----------
const TCOL = (function () {
  const P = [0]; for (let l = 1; l <= 14; l += 1) P.push(l); for (let l = 16.5; l <= 40; l += 2.5) P.push(l); for (let l = 45; l <= 100; l += 5) P.push(l); for (let l = 110; l <= 240; l += 10) P.push(l);
  const out = []; for (let i = P.length - 1; i > 0; i--) out.push(-P[i]); for (const p of P) out.push(p); return out;
})();
const EXT = 420;   // terrain continues past both course ends so the world has no edge in view
const _fr = {};
// world position + ground for ribbon vertices; s may run past the course ends
function ribbonPoint(s, l, out) {
  const sc = clamp(s, 0, CR.L - 0.01);
  frameAt(sc, _fr);
  const ex = s - sc;
  l = foldClip(sc, l, out); out.l = l;
  out.x = _fr.x + _fr.tx * ex + _fr.rx * l; out.z = _fr.z + _fr.tz * ex + _fr.rz * l;
  const capH = 0.0011 * ex * ex;
  out.w = _fr.w;
  out.h = H(sc, l, out.x, out.z, true) + capH;
  // near the fold both sides must agree on the height
  if (out.pa >= 0) out.h += 0.5 * (CR.y[out.pa] - _fr.y) * smooth(out.lm - 35, out.lm, Math.abs(l));
  return out;
}
let TPAL = null;
function terrainColor(T, x, z, h, slope, l, w, s, wet, out) {
  const P = TPAL;
  const n1 = fbm(x * 0.018 + 3, z * 0.018 + 9, 3), n2 = vnoise(x * 0.11, z * 0.11), al = Math.abs(l);
  out.copy(P.g1).lerp(P.g2, clamp(0.5 + n1 * 0.9, 0, 1));
  out.lerp(P.g3, smooth(30, 160, al) * 0.6);
  // worn shoulder
  out.lerp(P.dirt, (1 - smooth(0.2, 3.4, al - w + n2 * 0.8)) * 0.85);
  // rock on steep ground, strata on walls
  let rk = smooth(0.5, 0.85, slope + n1 * 0.1);
  if (T.terr.wall > 20) rk = Math.max(rk, smooth(T.terr.wallD - 6, T.terr.wallD + 10, al) * 0.9);
  if (rk > 0) { P.tmp.copy(P.r1).lerp(P.r2, 0.5 + 0.5 * Math.sin(h * 0.55 + n1 * 2)); out.lerp(P.tmp, rk); }
  if (T.snowY !== null) out.lerp(P.snow, smooth(T.snowY, T.snowY + 14, h + n1 * 10) * (1 - smooth(0.85, 1.1, slope)));
  if (wet > 0) out.lerp(P.wet, wet);
  out.multiplyScalar(0.9 + n2 * 0.1);
  return out;
}
function buildTerrain(grp) {
  const T = THEME, cols = TCOL, nc = cols.length, rs = 2.5;
  const s0 = -EXT, s1 = CR.L + EXT, nr = Math.ceil((s1 - s0) / rs) + 1;
  const P = new Float32Array(nr * nc * 3), Hh = new Float32Array(nr * nc), CL = new Float32Array(nr * nc * 3), WET = new Float32Array(nr * nc);
  const pt = {};
  for (let j = 0; j < nr; j++) {
    const s = s0 + j * rs;
    for (let i = 0; i < nc; i++) {
      const l = cols[i]; ribbonPoint(s, l, pt);
      let h = pt.h;
      if (Math.abs(l) < pt.w - 0.4 && s > 0 && s < CR.L) h -= 0.16;   // sits under the trail ribbon
      const id = j * nc + i;
      P[id * 3] = pt.x; P[id * 3 + 1] = h; P[id * 3 + 2] = pt.z; Hh[id] = h;
      const sc = clamp(s, 0, CR.L - 0.01), wy = waterY(sc, pt.l);
      WET[id] = wy > -1e8 ? smooth(1.2, -0.1, h - wy) * 0.8 : 0;
    }
  }
  // normals from the grid
  const NR = new Float32Array(nr * nc * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
  const tmpC = new THREE.Color();
  TPAL = { g1: lc(T.grass[0]), g2: lc(T.grass[1]), g3: lc(T.grass[2]), dirt: lc(T.dirt), r1: lc(T.rock[0]), r2: lc(T.rock[1]), snow: lc(0xf2f5f8), wet: lc(T.dirt).multiplyScalar(0.55), tmp: new THREE.Color() };
  for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
    const id = j * nc + i, il = j * nc + Math.max(0, i - 1), ir = j * nc + Math.min(nc - 1, i + 1), iu = Math.max(0, j - 1) * nc + i, id2 = Math.min(nr - 1, j + 1) * nc + i;
    a.set(P[ir * 3] - P[il * 3], P[ir * 3 + 1] - P[il * 3 + 1], P[ir * 3 + 2] - P[il * 3 + 2]);
    b.set(P[id2 * 3] - P[iu * 3], P[id2 * 3 + 1] - P[iu * 3 + 1], P[id2 * 3 + 2] - P[iu * 3 + 2]);
    n.crossVectors(b, a).normalize(); if (n.y < 0) n.negate();
    NR[id * 3] = n.x; NR[id * 3 + 1] = n.y; NR[id * 3 + 2] = n.z;
    const s = s0 + j * rs, w = wAtS(clamp(s, 0, CR.L));
    terrainColor(T, P[id * 3], P[id * 3 + 2], Hh[id], 1 - n.y, cols[i], w, s, WET[id], tmpC);
    if (CR.F.tunnels.length && Math.abs(cols[i]) < w + 9) { const tq = tunnelAt(s); if (tq) tmpC.multiplyScalar(0.4 + 0.6 * Math.max(smooth(tq.s0 + 9, tq.s0, s), smooth(tq.s1 - 9, tq.s1, s))); }
    CL[id * 3] = tmpC.r; CL[id * 3 + 1] = tmpC.g; CL[id * 3 + 2] = tmpC.b;
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.ground });
  const CH = 40;
  for (let j0 = 0; j0 < nr - 1; j0 += CH) {
    const j1 = Math.min(j0 + CH, nr - 1), vh = j1 - j0 + 1, nv = vh * nc;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    for (let j = 0; j < vh; j++) for (let i = 0; i < nc; i++) {
      const g = (j0 + j) * nc + i, l = j * nc + i;
      for (let k = 0; k < 3; k++) { pos[l * 3 + k] = P[g * 3 + k]; nor[l * 3 + k] = NR[g * 3 + k]; col[l * 3 + k] = CL[g * 3 + k]; }
      uv[l * 2] = P[g * 3] / 7; uv[l * 2 + 1] = P[g * 3 + 2] / 7;
    }
    const idx = [];
    for (let j = 0; j < vh - 1; j++) for (let i = 0; i < nc - 1; i++) { const q = j * nc + i; idx.push(q, q + 1, q + nc, q + 1, q + nc + 1, q + nc); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.userData.chunkS = s0 + (j0 + CH / 2) * rs;
    grp.add(m); WORLD.userData.chunks.push(m);
  }
}

// ---------- trail ribbon + surface overlays ----------
function ribbonMesh(sA, sB, lFn, ncol, rowStep, yOff, mat, vScale, colorFn) {
  const nr = Math.max(2, Math.ceil((sB - sA) / rowStep) + 1), nv = nr * ncol;
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = colorFn ? new Float32Array(nv * 3) : null;
  const fr = {}, c = new THREE.Color();
  for (let j = 0; j < nr; j++) {
    const s = Math.min(sB, sA + j * rowStep); frameAt(s, fr);
    const [la, lb] = lFn(s, fr.w);
    for (let i = 0; i < ncol; i++) {
      const u = i / (ncol - 1), l = la + (lb - la) * u, x = fr.x + fr.rx * l, z = fr.z + fr.rz * l, id = j * ncol + i;
      pos[id * 3] = x; pos[id * 3 + 1] = H(s, l, x, z, true) + yOff; pos[id * 3 + 2] = z;
      uv[id * 2] = u; uv[id * 2 + 1] = s / vScale;
      if (col) { colorFn(s, l, fr.w, c); col[id * 3] = c.r; col[id * 3 + 1] = c.g; col[id * 3 + 2] = c.b; }
    }
  }
  const idx = [];
  for (let j = 0; j < nr - 1; j++) {
    if (inRavineS(Math.min(sB, sA + j * rowStep), 0.2) || inRavineS(Math.min(sB, sA + (j + 1) * rowStep), 0.2)) continue;   // the trail stops at the edge
    for (let i = 0; i < ncol - 1; i++) { const q = j * ncol + i; idx.push(q, q + 1, q + ncol, q + 1, q + ncol + 1, q + ncol); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.userData.chunkS = (sA + sB) / 2;
  return m;
}
const SURF_TEX = () => ({ [SURF.DIRT]: TEX.trail, [SURF.GRAVEL]: TEX.gravel, [SURF.SAND]: TEX.sand, [SURF.MUD]: TEX.mud, [SURF.ROCK]: TEX.rockz });
function surfColor(type) {
  const T = THEME;
  if (type === SURF.GRAVEL) return T.base === 'GRAVEL' ? lc(T.trailCol).multiplyScalar(1.05) : lc(0xa7a399);
  if (type === SURF.SAND) return T.base === 'SAND' ? lc(T.trailCol).multiplyScalar(1.0) : lc(0xd6bc8c);
  if (type === SURF.MUD) return lc(0x5a4330);
  if (type === SURF.ROCK) return lc(T.rock[0]).lerp(lc(T.trailCol), 0.35);
  return lc(T.trailCol);
}
function buildTrail(grp) {
  const base = SURF[THEME.base], tx = SURF_TEX();
  const mat = new THREE.MeshLambertMaterial({ map: tx[base], color: surfColor(base), alphaTest: 0.45, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const wetC = new THREE.Color();
  const colorFn = (s, l, w, c) => {
    const wy = waterY(s, l); c.setRGB(1, 1, 1);
    const tq = CR.F.tunnels.length ? tunnelAt(s) : null; if (tq) c.multiplyScalar(0.42 + 0.58 * Math.max(smooth(tq.s0 + 9, tq.s0, s), smooth(tq.s1 - 9, tq.s1, s)));
    if (wy > -1e8) { const fr = frameAt(s, _fr2), x = fr.x + fr.rx * l, z = fr.z + fr.rz * l, d = H(s, l, x, z, false) - wy; c.lerp(wetC.setRGB(0.5, 0.48, 0.45), smooth(1.4, 0.0, d)); }
  };
  const CH = 100;
  for (let a = 0; a < CR.L; a += CH) {
    const m = ribbonMesh(a, Math.min(CR.L, a + CH), (s, w) => [-w - 1.5, w + 1.5], 15, 1.0, 0.02, mat, 7.5, colorFn);
    grp.add(m); WORLD.userData.chunks.push(m);
  }
  // surface overlays
  const mats = {};
  for (const zn of CR.F.zones) {
    if (zn.type === base) continue;
    if (!mats[zn.type]) mats[zn.type] = new THREE.MeshLambertMaterial({ map: tx[zn.type], color: surfColor(zn.type), alphaTest: 0.45, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const lFn = (s, w) => {
      const lo = Math.max(zn.l0, -w - 1.3), hi = Math.min(zn.l1, w + 1.3), c = (lo + hi) / 2, tp = smooth(zn.s0, zn.s0 + 5, s) * (1 - smooth(zn.s1 - 5, zn.s1, s)) * 0.7 + 0.3;
      return [c + (lo - c) * tp, c + (hi - c) * tp];
    };
    for (let a = zn.s0; a < zn.s1; a += 100) { const m = ribbonMesh(a, Math.min(zn.s1, a + 100), lFn, 9, 1.0, 0.045, mats[zn.type], 6.5); grp.add(m); WORLD.userData.chunks.push(m); }
  }
}
const _fr2 = {};

// ---------- water ----------
function buildWater(grp) {
  const T = THEME;
  const mat = new THREE.MeshPhongMaterial({ color: lc(T.water), specular: lc(0x9fb8c4), shininess: 70, map: TEX.water, transparent: true, opacity: 0.84, depthWrite: false, side: THREE.DoubleSide });
  mat.map = TEX.water.clone(); mat.map.needsUpdate = true; mat.map.__own = true;
  WORLD.userData.waterMat = mat;
  const addGrid = (nu, nv, fn) => {
    const pos = new Float32Array(nu * nv * 3), uv = new Float32Array(nu * nv * 2), o = {};
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { fn(i / (nu - 1), j / (nv - 1), o); const id = j * nu + i; pos[id * 3] = o.x; pos[id * 3 + 1] = o.y; pos[id * 3 + 2] = o.z; uv[id * 2] = o.u; uv[id * 2 + 1] = o.v; }
    const idx = []; for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const q = j * nu + i; idx.push(q, q + nu, q + 1, q + 1, q + nu, q + nu + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    // front faces must face up (DoubleSide flips the normal on back faces)
    if (g.attributes.normal.getY(Math.floor(nu / 2)) < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.renderOrder = 2; m.receiveShadow = true; grp.add(m); return m;
  };
  const fr = {};
  for (const c of CR.F.creeks) {
    const uh = c.hw + 14;
    addGrid(9, 61, (a, b, o) => {
      let l = -200 + b * 400; l = foldClip(c.s, l, o);
      const u = -uh + a * 2 * uh, s = clamp(c.s + u + c.mea * Math.sin(l * 0.021 + c.ph), 0, CR.L - 0.01);
      frameAt(s, fr); o.x = fr.x + fr.rx * l; o.z = fr.z + fr.rz * l; o.y = c.wy; o.u = l / 9; o.v = u / 9;
    });
  }
  // ravine floors: a stream, or lava on the volcano
  if (CR.F.ravines.length) {
    const lava = !!T.lava;
    const rm = lava ? new THREE.MeshBasicMaterial({ color: 0xff6a18, map: mat.map }) : mat;
    const sv = mat; void sv;
    for (const c of CR.F.ravines) {
      const uh = c.hw + c.flare + 3, m = addGrid(7, 61, (a, b, o) => {
        let l = -200 + b * 400; l = foldClip(c.s, l, o);
        const u = -uh + a * 2 * uh, s = clamp(c.s + u + c.mea * Math.sin(l * 0.03 + c.ph) * smooth(12, 45, Math.abs(l)), 0, CR.L - 0.01);
        frameAt(s, fr); o.x = fr.x + fr.rx * l; o.z = fr.z + fr.rz * l; o.y = c.wy; o.u = l / 9; o.v = u / 9;
      });
      if (lava) { m.material = rm; m.receiveShadow = false; }
    }
  }
  for (const r of CR.F.rivers) {
    for (let a0 = r.s0 - 12; a0 < r.s1 + 12; a0 += 60) {
      const a1 = Math.min(r.s1 + 12, a0 + 60);
      addGrid(7, Math.ceil((a1 - a0) / 3) + 1, (a, b, o) => {
        const s = a0 + (a1 - a0) * b; frameAt(s, fr); const l = (-1 + 2 * a) * (fr.w + 14);
        o.x = fr.x + fr.rx * l; o.z = fr.z + fr.rz * l; o.y = r.wy; o.u = l / 9; o.v = s / 9;
      });
    }
  }
  for (const p of CR.F.puddles) {
    addGrid(9, 9, (a, b, o) => {
      const ang = a * TAU, rad = b * p.r * 1.12, s = p.s + Math.cos(ang) * rad, l = p.l + Math.sin(ang) * rad;
      frameAt(s, fr); o.x = fr.x + fr.rx * l; o.z = fr.z + fr.rz * l; o.y = p.wy; o.u = l / 6; o.v = s / 6;
    });
  }
}

function disposeWorld() {
  if (!WORLD) return;
  const mats = new Set(), geos = new Set();
  WORLD.traverse((o) => {
    if (o.geometry && !o.userData.sharedGeo) geos.add(o.geometry);
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (!m.userData.shared) mats.add(m); });
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => { if (m.map && m.map.__own) m.map.dispose(); m.dispose(); });
  scene.remove(WORLD); WORLD = null;
}
function cullChunks(camPos) {
  if (!WORLD) return;
  const far = scene.fog.far + 250;
  for (const m of WORLD.userData.chunks) {
    const bs = m.geometry.boundingSphere; if (!bs) continue;
    const dx = bs.center.x - camPos.x, dz = bs.center.z - camPos.z;
    m.visible = Math.sqrt(dx * dx + dz * dz) - bs.radius < (m.userData.near || far);
  }
}
