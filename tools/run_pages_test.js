const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const [root, video, shot, vw, vh] = process.argv.slice(2);
const types = { '.js': 'text/javascript', '.html': 'text/html', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); }).listen(8776);
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: +vw || 360, height: +vh || 640 }, deviceScaleFactor: 2, permissions: ['camera'] })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(process.env.LIVE || 'http://localhost:8776/polaroids.html');
  const t0 = Date.now(); let seen = new Set();
  while (Date.now() - t0 < 15000) {
    const vis = await p.evaluate(() => [...document.querySelectorAll('[mindar-image-target]')].map((e, i) => e.object3D.visible ? i : -1).filter(i => i >= 0)).catch(() => []);
    vis.forEach(i => seen.add(i)); if (seen.size === 2) break; await p.waitForTimeout(300);
  }
  await p.waitForTimeout(1500);
  const now = await p.evaluate(() => [...document.querySelectorAll('[mindar-image-target]')].map(e => e.object3D.visible));
  console.log(path.basename(video), '| pages ever found:', [...seen].map(i => i ? 'right' : 'left').join('+') || 'none', '| visible at end:', now.map((v, i) => (i ? 'right ' : 'left ') + v).join(', '), '| errors:', errs.length);
  await p.screenshot({ path: shot }); await b.close(); srv.close();
})();
