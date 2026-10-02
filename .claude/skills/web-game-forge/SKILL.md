---
name: web-game-forge
description: Build a polished single-file browser game (index.html, three.js via CDN, no external assets, everything generated in code, 1280x720, auto-demo on open, keyboard play) end to end, then test it in headless Chromium and fix problems before delivering. Use when the user asks to make a game / "ゲームを作って" / a Mario-Kart-style, action, racing or arcade game as a web page or Artifact.
---

# web-game-forge

Hands-off game production. Do not ask questions; pick sensible defaults, state them at the end, and finish in one go.

## Fixed contract (from the proven workflow)
- One `index.html`. Only external library: three.js r128 (`three.min.js`) from cdnjs, with jsDelivr and unpkg as fallbacks. For 2D games, no library at all (Canvas2D).
- No images, audio or font files. Textures from canvas, models from merged primitives with vertex colours, sound from WebAudio synthesis.
- Fixed 1280x720 stage scaled to fit (`template/head.html`). Keyboard first; touch/gamepad as bonus.
- Opens into an auto-demo (attract mode), not a static title. Any key/click starts play.
- Original characters, names and items. Never use real IP names.
- Japanese UI text unless asked otherwise. Pop, readable HUD.

## Workflow
1. **Decide the spec yourself** from the request: genre, camera, art style, 1 hero feature, 3-5 mechanics, 1 course/level. If the user gave screenshots, derive the genre/feel from them. See `references/spec-template.md`.
2. **Split the source into parts** (`parts/00_head.html`, `10_util.js`, level/track, render, scenery, entities, fx+audio, sim, ui, `80_main.js`, `99_tail.html`), joined by `scripts/build.sh`. Keep each part under ~600 lines so edits stay cheap. Work in the scratchpad, output `index.html` into the repo.
3. **Build in this order**: stage + renderer + level geometry -> player movement -> camera -> HUD -> opponents/AI or enemies -> items/hazards -> particles + audio -> demo director -> game flow (title/countdown/play/finish/results/pause).
4. **Expose a debug hook** `window.__g` (state, `stepN(n)`, `shot()`) so tests can drive the simulation deterministically. Use a variable-step loop with sub-steps <= 1/50 s.
5. **Test in headless Chromium** (`scripts/harness.js`, `scripts/smoke.js`). If the CDN is blocked in the sandbox, install `three@0.128.0` locally and route the CDN URL to it. Run everything in `references/checklist.md`. Look at screenshots yourself.
6. **Fix, rebuild, retest** until the checklist passes. Never deliver untested.
7. **Deliver**: commit `index.html` (+ README with controls), push, open a draft PR, optionally publish an Artifact. Final report: link, controls, what was verified, and honestly what was NOT verifiable (real GPU speed, sound, hand feel).

## Hard-won rules
- Cap triangles (~350k for a 3D scene); chunk + frustum/distance cull instanced scenery; use fog.
- Never let the camera enter geometry: clamp, raycast/terrain lift, blend yaw.
- Wrap Gamepad, fullscreen and localStorage in try/catch (sandboxed iframes throw).
- Pause on blur. Cap `dt`. Guard timers/transitions with state checks.
- Particles: cap point size; scale emission by dt.
- Auto-play must work for the demo: AI drives the player during attract mode.
- Artifact variant: no `<script src>` outside the allowed CDNs, no inline-handler CSP issues; test under an emulated CSP.
- Tune by measurement: simulate laps/levels with the AI and print stats (time, off-track %, NaN checks) rather than guessing.

## Files
- `references/spec-template.md` - what to decide / how users should phrase the request.
- `references/checklist.md` - acceptance tests.
- `references/architecture.md` - module layout and techniques from the kart-racer reference build.
- `scripts/build.sh`, `scripts/harness.js`, `scripts/smoke.js`, `template/head.html`.
- Reference implementation: `index.html` at the repo root of the repo this skill came from (off-road motorbike kart racer, ~180 KB).
