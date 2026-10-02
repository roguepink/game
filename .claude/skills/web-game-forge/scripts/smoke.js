// Smoke test: boot, wait, screenshot, press keys, fail on any console error / pageerror.
// usage: node smoke.js /abs/index.html [outdir] ; env PW_MODULE, THREE_LOCAL (path to local three.min.js)
const h0 = require('./harness'); const fs = require('fs');
(async () => {
  const out = process.argv[3] || '.'; fs.mkdirSync(out, { recursive: true });
  const route = process.env.THREE_LOCAL ? [[/three(\.min)?\.js/, process.env.THREE_LOCAL]] : [];
  const h = await h0.open(process.argv[2], { route, quiet: true });
  await h.p.waitForTimeout(4000); await h.p.screenshot({ path: out + '/1_title.png' });
  await h.p.keyboard.press('Enter'); await h.p.waitForTimeout(1500);
  for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'Space', 'Shift']) { await h.p.keyboard.down(k); await h.p.waitForTimeout(600); await h.p.keyboard.up(k); }
  await h.p.waitForTimeout(3000); await h.p.screenshot({ path: out + '/2_play.png' });
  const bad = h.logs.filter((l) => /error|PAGEERROR|warn/i.test(l));
  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'OK no console errors'); await h.close(); process.exit(bad.length ? 1 : 0);
})();
