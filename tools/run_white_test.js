const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const [root, video, outPrefix, vw, vh] = process.argv.slice(2);
const types = { '.js': 'text/javascript', '.html': 'text/html', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); }).listen(8780);
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: +vw, height: +vh }, deviceScaleFactor: 1, permissions: ['camera'] })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto((process.env.LIVE || 'http://localhost:8780/white.html') + (process.env.Q || ''));
  await p.waitForFunction(() => document.getElementById('hint').classList.contains('hide'), null, { timeout: 30000 }).catch(() => console.log('never recognised'));
  for (const [t, name] of [[0.8, 'a'], [2.5, 'b'], [6, 'c'], [11.5, 'd']]) { await p.waitForTimeout(t * 1000 - (name === 'a' ? 0 : 0)); await p.screenshot({ path: `${outPrefix}-${name}.png` }); }
  const u = await p.evaluate(() => { const c = document.querySelector('a-scene').components['white-room']; return { white: c.U.uWhite.value.toFixed(2), red: c.U.uRed.value.toFixed(2) }; });
  console.log(path.basename(video), 'end state', JSON.stringify(u), '| errors:', errs.slice(0, 3));
  await b.close(); srv.close();
})();
