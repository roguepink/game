// Headless-Chromium harness. usage: const h = await require('./harness').open('/abs/index.html');
// CDN script (three etc.) can be routed to a local copy: open(file,{route:[[/three(\.min)?\.js/, '/path/three.min.js']]})
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const fs = require('fs');
exports.open = async function (file, opts = {}) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: opts.viewport || { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => { logs.push(m.text()); if (!opts.quiet) console.log('console:', m.text().slice(0, 300)); });
  p.on('pageerror', (e) => { logs.push('PAGEERROR ' + e.message); console.log('PAGEERROR:', e.message); });
  for (const [re, local] of opts.route || []) await p.route(re, (r) => r.fulfill({ body: fs.readFileSync(local), contentType: 'application/javascript' }));
  await p.goto('file://' + file);
  return { b, p, logs, close: () => b.close() };
};
