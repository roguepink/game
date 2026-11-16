// ===================== Particles =====================
const FOGU = { fogCol: { value: new THREE.Color(1, 1, 1) }, fogNear: { value: 150 }, fogFar: { value: 1500 } };
class Particles {
  constructor(max, tex, parent, additive) {
    this.max = max; this.head = 0; this.alive = 0;
    const m = max;
    this.px = new Float32Array(m * 3); this.vel = new Float32Array(m * 3);
    this.life = new Float32Array(m); this.maxLife = new Float32Array(m);
    this.s0 = new Float32Array(m); this.s1 = new Float32Array(m);
    this.col = new Float32Array(m * 3); this.a0 = new Float32Array(m);
    this.grav = new Float32Array(m); this.drag = new Float32Array(m); this.floor = new Float32Array(m);
    this.aColor = new Float32Array(m * 4); this.aSize = new Float32Array(m);
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.px, 3); this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.aColor, 4); this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.aSize, 1); this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr); g.setAttribute('aColor', this.colAttr); g.setAttribute('aSize', this.sizeAttr);
    this.uScale = { value: 800 };
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ map: { value: tex }, uScale: this.uScale }, FOGU),
      vertexShader: 'attribute vec4 aColor; attribute float aSize; uniform float uScale; varying vec4 vColor; varying float vDepth; void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); vDepth = -mv.z; gl_PointSize = min(aSize * uScale / max(-mv.z, 0.3), 260.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 fogCol; uniform float fogNear, fogFar; varying vec4 vColor; varying float vDepth; void main(){ vec4 t = texture2D(map, gl_PointCoord); float a = vColor.a * t.a; if (a < 0.008) discard; float f = smoothstep(fogNear, fogFar, vDepth); gl_FragColor = vec4(mix(vColor.rgb * t.rgb, fogCol, f), a * (1.0 - f * 0.6)); }',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    parent.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag, floorY) {
    const i = this.head; this.head = (this.head + 1) % this.max;
    const k = i * 3;
    this.px[k] = x; this.px[k + 1] = y; this.px[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.col[k] = r; this.col[k + 1] = g; this.col[k + 2] = b; this.a0[i] = a; this.grav[i] = grav || 0; this.drag[i] = drag || 0;
    this.floor[i] = floorY === undefined ? -1e9 : floorY;
  }
  update(dt, scale, wind) {
    this.uScale.value = scale;
    const m = this.max, wx = wind ? wind.x : 0, wz = wind ? wind.z : 0;
    let alive = 0;
    for (let i = 0; i < m; i++) {
      if (this.life[i] <= 0) { if (this.aSize[i] !== 0) { this.aSize[i] = 0; this.aColor[i * 4 + 3] = 0; } continue; }
      alive++;
      this.life[i] -= dt;
      const k = i * 3, t = 1 - this.life[i] / this.maxLife[i];
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[k] = (this.vel[k] - wx) * dr + wx; this.vel[k + 1] = this.vel[k + 1] * dr - this.grav[i] * dt; this.vel[k + 2] = (this.vel[k + 2] - wz) * dr + wz;
      this.px[k] += this.vel[k] * dt; this.px[k + 1] += this.vel[k + 1] * dt; this.px[k + 2] += this.vel[k + 2] * dt;
      if (this.px[k + 1] < this.floor[i]) { this.px[k + 1] = this.floor[i]; this.vel[k + 1] *= -0.25; this.vel[k] *= 0.5; this.vel[k + 2] *= 0.5; }
      this.aSize[i] = this.life[i] > 0 ? lerp(this.s0[i], this.s1[i], Math.sqrt(t)) : 0;
      const fade = t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92;
      const o = i * 4; this.aColor[o] = this.col[k]; this.aColor[o + 1] = this.col[k + 1]; this.aColor[o + 2] = this.col[k + 2]; this.aColor[o + 3] = this.a0[i] * fade;
    }
    this.alive = alive;
    this.posAttr.needsUpdate = true; this.colAttr.needsUpdate = true; this.sizeAttr.needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}
const PS = { dust: null, grit: null, mist: null };
const WIND = { x: 1.2, z: 0.4 };
// display-space (sRGB) particle colours per surface
const DEBRIS = {
  [SURF.DIRT]: [0.42, 0.32, 0.22], [SURF.GRAVEL]: [0.48, 0.47, 0.44], [SURF.SAND]: [0.72, 0.6, 0.42], [SURF.MUD]: [0.22, 0.16, 0.1],
  [SURF.GRASS]: [0.3, 0.38, 0.18], [SURF.WATER]: [0.85, 0.9, 0.95], [SURF.ROCK]: [0.45, 0.43, 0.4],
};
function dustCol(surf) {
  const d = THEME.dust;
  if (surf === SURF.GRAVEL) return [d[0] * 0.95 + 0.04, d[1] * 0.95 + 0.04, d[2] * 0.95 + 0.06];
  if (surf === SURF.SAND) return [0.8, 0.7, 0.54];
  if (surf === SURF.GRASS) return [d[0] * 0.9, d[1] * 0.9, d[2] * 0.8];
  return d;
}

// ===================== Audio (WebAudio, all synthesised) =====================
const AU = {
  ctx: null, master: null, sfxBus: null, noiseBuf: null, muted: false, started: false, loops: null, shaper: null,
  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try {
      const c = this.ctx = new AC();
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.85; this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
      const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
      // soft clipping curve for the engines
      const n = 1024, curve = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 3.2); }
      this.curve = curve;
      const mk = (type, f, q) => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 1; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.sfxBus); s.start(); return { g, fl }; };
      this.loops = { wind: mk('bandpass', 700, 0.5), dirt: mk('lowpass', 380, 0.8), gravel: mk('bandpass', 2600, 1.1), sand: mk('lowpass', 1200, 0.6), water: mk('bandpass', 1300, 0.6), crowd: mk('bandpass', 1100, 0.4) };
      this.started = true;
      return true;
    } catch (e) { this.ctx = null; return false; }
  },
  resume() { if (this.ctx && !this.hushed && this.ctx.state !== 'running') this.ctx.resume(); },
  // silence everything at once when the page is hidden, closed or stops drawing frames
  hush(why) {
    if (!this.ctx) return;
    if (this.hushed) { if (why !== 'stall') this.hushWhy = why; return; }
    this.hushed = true; this.hushWhy = why || 'hide';
    try { const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setValueAtTime(0, t); } catch (e) { /* ignore */ }
    try { this.ctx.suspend(); } catch (e) { /* ignore */ }
  },
  unhush() {
    if (!this.ctx || !this.hushed || document.hidden) return;
    this.hushed = false;
    try { this.master.gain.setValueAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime); } catch (e) { /* ignore */ }
    if (!GAME.paused) this.resume();
  },
  setMuted(m) { this.muted = m; if (this.master && !this.hushed) this.master.gain.setValueAtTime(m ? 0 : 0.85, this.ctx.currentTime); },
  tone(freq, dur, type, vol, when, slideTo) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, type, f0, f1, vol, when, q) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + (when || 0);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q || 1.2;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  sfx(name, v) {
    if (!this.ctx) return; v = v === undefined ? 1 : v; if (v <= 0.02) return;
    switch (name) {
      case 'count': this.tone(660, 0.18, 'square', 0.12 * v); break;
      case 'go': this.tone(1320, 0.55, 'square', 0.14 * v); this.noise(0.5, 'bandpass', 800, 2400, 0.12 * v); break;
      case 'land': this.tone(70, 0.25, 'sine', 0.55 * v, 0, 34); this.noise(0.22, 'lowpass', 700, 120, 0.5 * v); this.noise(0.08, 'bandpass', 2200, 900, 0.15 * v); break;
      case 'bump': this.noise(0.1, 'bandpass', 900, 300, 0.32 * v); this.tone(110, 0.1, 'sine', 0.28 * v, 0, 60); break;
      case 'rock': this.noise(0.14, 'bandpass', 2600, 700, 0.4 * v); this.tone(180, 0.12, 'triangle', 0.25 * v, 0, 80); break;
      case 'log': this.tone(80, 0.2, 'sine', 0.6 * v, 0, 45); this.noise(0.14, 'bandpass', 600, 220, 0.4 * v); break;
      case 'crash': this.noise(0.9, 'lowpass', 2400, 160, 0.7 * v); this.tone(330, 0.3, 'square', 0.12 * v, 0.05, 90); this.noise(0.35, 'bandpass', 4200, 1800, 0.25 * v, 0.1, 3); this.tone(1900, 0.18, 'triangle', 0.08 * v, 0.12, 1500); break;
      case 'clang': this.tone(520, 0.35, 'triangle', 0.22 * v, 0, 380); this.tone(1260, 0.22, 'sine', 0.12 * v); this.noise(0.12, 'bandpass', 3000, 1200, 0.25 * v); break;
      case 'hay': this.noise(0.3, 'lowpass', 1500, 300, 0.45 * v); break;
      case 'splash': this.noise(0.9, 'bandpass', 3400, 600, 0.55 * v, 0, 0.8); this.noise(0.45, 'lowpass', 800, 160, 0.45 * v); break;
      case 'splashS': this.noise(0.35, 'bandpass', 2800, 900, 0.25 * v, 0, 0.8); break;
      case 'shift': this.noise(0.05, 'bandpass', 1800, 900, 0.08 * v); break;
      case 'pop': this.noise(0.035, 'lowpass', 1500 + Math.random() * 900, 260, 0.3 * v, 0, 0.8); this.tone(70 + Math.random() * 30, 0.04, 'sine', 0.22 * v, 0, 40); break;
      case 'ui': this.tone(880, 0.06, 'square', 0.07 * v); this.tone(1320, 0.1, 'square', 0.07 * v, 0.04); break;
      case 'smash': this.noise(0.28, 'bandpass', 1800, 500, 0.5 * v, 0, 0.9); this.noise(0.12, 'highpass', 3500, 0, 0.2 * v); this.tone(160, 0.12, 'square', 0.12 * v, 0, 70); break;
      case 'trick': [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.15 * v, i * 0.05)); break;
      case 'boost': this.noise(0.9, 'bandpass', 500, 3200, 0.35 * v, 0, 0.7); this.tone(140, 0.7, 'sawtooth', 0.1 * v, 0, 520); break;
      case 'nice': this.tone(988, 0.1, 'triangle', 0.14 * v); this.tone(1480, 0.16, 'triangle', 0.13 * v, 0.07); break;
      case 'cheer': for (let k = 0; k < 4; k++) this.noise(1.4, 'bandpass', 900 + k * 400, 700 + k * 300, 0.12 * v, k * 0.12, 0.6); break;
      case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.16 * v, i * 0.12)); this.sfx('cheer', v); break;
      case 'lose': [392, 349, 311].forEach((f, i) => this.tone(f, 0.32, 'triangle', 0.14 * v, i * 0.18)); break;
      case 'pass': this.tone(1200, 0.06, 'sine', 0.07 * v); break;
    }
  },
  // ---- engines: single-cylinder four-stroke ----
  // One firing event = a sharp pressure pulse ringing through the exhaust (two resonances + a low thump),
  // a short noise burst and a softer intake gulp. 24 slightly different cycles are stitched into a looped
  // buffer, so the sound has the uneven "braap" of a real thumper; playbackRate follows the firing rate.
  ENG_F0: 50,
  buildEngineBuffer() {
    const c = this.ctx, sr = c.sampleRate, f0 = this.ENG_F0, R = mulberry32(4242), cycles = 24;
    const lens = []; let total = 0;
    for (let k = 0; k < cycles; k++) { const L = Math.round(sr / f0 * (1 + (R() - 0.5) * 0.05)); lens.push(L); total += L; }
    const buf = c.createBuffer(1, total, sr), d = buf.getChannelData(0);
    let o = 0, nz = 0, nz2 = 0, peak = 0;
    for (let k = 0; k < cycles; k++) {
      const L = lens[k], amp = (0.82 + R() * 0.3) * (k % 9 === 4 ? 0.7 : 1);
      const fr1 = 190 * (0.92 + R() * 0.16), fr2 = 820 * (0.88 + R() * 0.24), fth = 78 * (0.95 + R() * 0.1), ph = R() * 0.6;
      const tIn = L / sr * (0.48 + R() * 0.06);
      for (let i = 0; i < L; i++) {
        const t = i / sr;
        nz = nz * 0.55 + (R() * 2 - 1) * 0.45;          // slightly darkened noise
        nz2 = nz2 * 0.92 + (R() * 2 - 1) * 0.08;        // low rumble noise
        let v = 0.95 * Math.exp(-t / 0.0048) * Math.sin(TAU * fr1 * t + ph)
          + 0.32 * Math.exp(-t / 0.0017) * Math.sin(TAU * fr2 * t + 1.1)
          + 0.75 * Math.exp(-t / 0.0075) * Math.sin(TAU * fth * t)
          + 0.55 * Math.exp(-t / 0.0011) * nz;
        v *= amp;
        const ti = t - tIn; if (ti > 0) v += 0.16 * Math.exp(-ti / 0.004) * (Math.sin(TAU * 330 * ti) * 0.6 + nz * 0.8);   // intake
        v += nz2 * 0.5 + nz * 0.025;                      // mechanical / rumble bed
        d[o + i] = v; peak = Math.max(peak, Math.abs(v));
      }
      o += L;
    }
    for (let i = 0; i < total; i++) d[i] *= 0.9 / peak;
    // smooth the loop seam
    for (let i = 0; i < 64; i++) { const w = i / 64; d[i] = d[i] * w + d[total - 64 + i] * (1 - w); }
    this.engBuf = buf;
    const n = 1024, curve = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 2.6) / Math.tanh(2.6); }
    this.engCurve = curve;
  },
  makeEngine() {
    const c = this.ctx; if (!c) return null;
    if (!this.engBuf) this.buildEngineBuffer();
    const src = c.createBufferSource(); src.buffer = this.engBuf; src.loop = true; src.playbackRate.value = 0.3;
    const body = c.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 130; body.Q.value = 0.9; body.gain.value = 5;
    // on-throttle: driven and bright; off-throttle: muffled burble
    const gOn = c.createGain(), gOff = c.createGain(); gOn.gain.value = 0; gOff.gain.value = 1;
    const drive = c.createGain(); drive.gain.value = 2.1;
    const sh = c.createWaveShaper(); sh.curve = this.engCurve; sh.oversample = '2x';
    const lpOn = c.createBiquadFilter(); lpOn.type = 'lowpass'; lpOn.frequency.value = 1800; lpOn.Q.value = 0.8;
    const lpOff = c.createBiquadFilter(); lpOff.type = 'lowpass'; lpOff.frequency.value = 500; lpOff.Q.value = 0.7;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38;
    const air = c.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 16000;   // distance absorption
    const shift = c.createGain(); shift.gain.value = 1;
    const g = c.createGain(); g.gain.value = 0;
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    src.connect(body);
    body.connect(drive); drive.connect(sh); sh.connect(lpOn); lpOn.connect(gOn);
    body.connect(lpOff); lpOff.connect(gOff);
    gOn.connect(hp); gOff.connect(hp); hp.connect(air); air.connect(shift); shift.connect(g);
    if (pan) { g.connect(pan); pan.connect(this.sfxBus); } else g.connect(this.sfxBus);
    src.start(0, Math.random() * this.engBuf.duration);
    return { src, gOn, gOff, lpOn, lpOff, air, shift, g, pan, gear: 1, thr: 0 };
  },
  // rpm 0..1, thr 0..1, load 0..1 (mud/sand/water), dopp: doppler factor, dist: metres to the listener
  updateEngine(e, rpm, thr, vol, panv, load, gear, dopp, dist) {
    if (!e || !this.ctx) return;
    const t = this.ctx.currentTime;
    const fire = 13 + rpm * 90;                 // firing rate: ~1600 rpm idle .. ~12500 rpm
    e.src.playbackRate.setTargetAtTime(fire / this.ENG_F0 * (dopp || 1), t, 0.03);
    e.thr = e.thr + ((thr > 0 ? 1 : 0) - e.thr) * 0.5;
    e.gOn.gain.setTargetAtTime(e.thr * (1.0 + load * 0.25), t, 0.03);
    e.gOff.gain.setTargetAtTime((1 - e.thr) * (0.5 + rpm * 0.4), t, 0.05);
    e.lpOn.frequency.setTargetAtTime(1100 + rpm * 3200 + load * 500, t, 0.04);
    e.lpOff.frequency.setTargetAtTime(320 + rpm * 900, t, 0.06);
    e.air.frequency.setTargetAtTime(clamp(16000 / (1 + (dist || 0) / 18), 700, 16000), t, 0.1);
    if (gear && gear !== e.gear) {
      // a quick cut while the gear changes (up) or a blip (down)
      if (gear > e.gear) { e.shift.gain.cancelScheduledValues(t); e.shift.gain.setValueAtTime(1, t); e.shift.gain.linearRampToValueAtTime(0.3, t + 0.025); e.shift.gain.linearRampToValueAtTime(1, t + 0.11); }
      e.gear = gear;
    }
    // louder and harder on the gas
    e.g.gain.setTargetAtTime(vol * (0.12 + 0.06 * rpm + e.thr * (0.13 + 0.09 * rpm)), t, 0.04);
    if (e.pan) e.pan.pan.setTargetAtTime(clamp(panv, -1, 1), t, 0.05);
  },
  updateLoops(o) {
    if (!this.loops) return; const t = this.ctx.currentTime, L = this.loops, sp = clamp(o.spd / 30, 0, 1.3), v = o.vol;
    L.wind.g.gain.setTargetAtTime(v * (sp * sp * 0.16 + (o.air ? 0.05 : 0)), t, 0.1); L.wind.fl.frequency.setTargetAtTime(500 + sp * 1100, t, 0.1);
    const gr = o.grounded ? 1 : 0;
    L.dirt.g.gain.setTargetAtTime(v * gr * (o.surf === SURF.DIRT || o.surf === SURF.ROCK || o.surf === SURF.GRASS ? 0.05 + sp * 0.12 : 0.02), t, 0.08);
    L.gravel.g.gain.setTargetAtTime(v * gr * (o.surf === SURF.GRAVEL || o.surf === SURF.ROCK ? 0.03 + sp * 0.08 : 0), t, 0.08);
    L.sand.g.gain.setTargetAtTime(v * gr * (o.surf === SURF.SAND || o.surf === SURF.MUD ? 0.04 + sp * 0.1 : 0), t, 0.08);
    L.water.g.gain.setTargetAtTime(v * (o.surf === SURF.WATER && gr ? 0.12 + sp * 0.3 : 0), t, 0.05);
    L.crowd.g.gain.setTargetAtTime(v * o.crowd * 0.06, t, 0.3);
  },
};
