// Records the scan sequence in headless Chromium with a synthetic camera, and re-checks accuracy.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const [root, video, truthFile, outDir, query] = process.argv.slice(2);
const types = { '.js': 'text/javascript', '.html': 'text/html', '.mind': 'application/octet-stream' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); }).listen(8767);
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: Number(process.env.DPR || 2), permissions: ['camera'] });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:8767/?reset${query || ''}`);
  await p.waitForFunction(() => /Searching/.test(document.getElementById('statusText').textContent), null, { timeout: 60000 }).catch(() => {});
  await p.screenshot({ path: `${outDir}/00-search.png` });
  const t0 = Date.now();
  await p.waitForFunction(() => /scan|ok/.test(document.getElementById('status').className), null, { timeout: 90000 });
  console.log('found after', ((Date.now() - t0) / 1000).toFixed(1), 's');
  const log = [];
  for (let i = 0; i < Number(process.env.NFR || 34); i++) {
    await p.screenshot({ path: `${outDir}/f${String(i).padStart(3, '0')}.png` });
    log.push(await p.evaluate(() => [document.getElementById('statusText').textContent, [...document.querySelectorAll('.step')].map(e => e.dataset.s + ':' + (e.className.replace('step', '').trim() || '-')).join(' '), [...document.querySelectorAll('.tag.show')].map(e => e.id.slice(4)).join(',')].join(' | ')));
    await p.waitForTimeout(Number(process.env.GAP || 150));
  }
  const seen = [...new Set(log)]; seen.forEach(l => console.log('  ', l));
  // accuracy after the sequence settles
  await p.waitForTimeout(800);
  const acc = await p.evaluate(() => {
    const T = AFRAME.THREE, cam = document.querySelector('a-scene').camera, o = window.overlay;
    const v = document.querySelector('video'), cs = v.getBoundingClientRect(), sc = document.querySelector('a-scene').getBoundingClientRect();
    const toVid = w => { const n = w.clone().project(cam); const px = (n.x + 1) / 2 * sc.width, py = (1 - n.y) / 2 * sc.height;
      return [(px - (cs.left - sc.left)) * v.videoWidth / cs.width, (py - (cs.top - sc.top)) * v.videoHeight / cs.height]; };
    const pos = o.cardLine.geometry.attributes.position, pt = i => o.cardLine.localToWorld(new T.Vector3().fromBufferAttribute(pos, i));
    return { card: [120, 80, 40, 0].map(i => toVid(pt(i))), peak: toVid(o.house.localToWorld(new T.Vector3(0, 50.8, -19.05))), status: document.getElementById('statusText').textContent };
  });
  const tr = JSON.parse(fs.readFileSync(truthFile)).frames[0], d = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1]);
  console.log('final status:', acc.status);
  console.log('card corner error px:', acc.card.map((c, i) => d(c, tr.card[i]).toFixed(1)).join(', '), '| gable peak px:', d(acc.peak, tr.gablePeak[0]).toFixed(1));
  await p.screenshot({ path: `${outDir}/zz-final.png` });
  console.log('page errors:', errs.length ? errs.slice(0, 5) : 'none');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
