// Headless end-to-end check: serve /site, feed a synthetic camera, wait for tracking,
// compare projected overlay points against ground truth, and screenshot.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const [root, video, truthFile, shot] = process.argv.slice(2);
const types = { '.js': 'text/javascript', '.html': 'text/html', '.mind': 'application/octet-stream', '.pdf': 'application/pdf' };
const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); });
}).listen(8766);
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, permissions: ['camera'] });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8766/?reset' + (process.argv[6] || ''));
  const t0 = Date.now();
  const found = await p.waitForFunction(() => document.getElementById('status').classList.contains('on'), null, { timeout: 90000 }).then(() => true).catch(() => false);
  console.log('targetFound:', found, 'after', ((Date.now() - t0) / 1000).toFixed(1), 's');
  if (!found) { await p.screenshot({ path: shot }); console.log('errors:', errs.slice(0, 5)); await b.close(); srv.close(); return; }
  await p.waitForTimeout(2500);
  const samples = [];
  for (let i = 0; i < 6; i++) {
    samples.push(await p.evaluate(() => {
      const T = AFRAME.THREE, cam = document.querySelector('a-scene').camera, o = window.overlay;
      const v = document.querySelector('video'), cs = v.getBoundingClientRect(), sc = document.querySelector('a-scene').getBoundingClientRect();
      const toVid = w => { const n = w.clone().project(cam); const px = (n.x + 1) / 2 * sc.width, py = (1 - n.y) / 2 * sc.height;
        return [(px - (cs.left - sc.left)) * v.videoWidth / cs.width, (py - (cs.top - sc.top)) * v.videoHeight / cs.height]; };
      o.el.object3D.updateMatrixWorld(true);
      const pos = o.cardLines.geometry.attributes.position, pt = i => o.cardLines.localToWorld(new T.Vector3().fromBufferAttribute(pos, i));
      // card corners in truth order: back-left, back-right, front-right, front-left
      const card = [pt(5), pt(3), pt(1), pt(0)].map(toVid);
      const peak = toVid(o.house.localToWorld(new T.Vector3(0, 50.8, -19.05)));
      const base = toVid(o.house.localToWorld(new T.Vector3(0, 0, -19.05)));
      window.__dbg = {peak, base};
      return { card, peak, base, visible: o.el.object3D.parent.visible, vw: v.videoWidth, vh: v.videoHeight };
    }));
    await p.waitForTimeout(400);
  }
  await p.screenshot({ path: shot });
  if (truthFile) {
    const tr = JSON.parse(fs.readFileSync(truthFile)).frames[0];
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const s = samples[samples.length - 1];
    console.log('video', s.vw + 'x' + s.vh, 'anchor visible', s.visible);
    console.log('card corner error px (BL,BR,FR,FL):', s.card.map((c, i) => d(c, tr.card[i]).toFixed(1)).join(', '));
    console.log('peak pred', s.peak.map(v=>v.toFixed(1)), 'truth', tr.gablePeak[0].map(v=>v.toFixed(1)), 'base pred', s.base.map(v=>v.toFixed(1)));
    console.log('gable peak error px:', d(s.peak, tr.gablePeak[0]).toFixed(1));
    const jit = samples.map(x => x.peak); const mx = jit.reduce((a, c) => [a[0] + c[0] / jit.length, a[1] + c[1] / jit.length], [0, 0]);
    console.log('peak jitter across samples, max px from mean:', Math.max(...jit.map(c => d(c, mx))).toFixed(2));
    // moving camera: match each sample to its nearest ground-truth frame (frames aren't synced)
    const all = JSON.parse(fs.readFileSync(truthFile)).frames;
    const best = samples.map(sm => Math.min(...all.map(fr => Math.max(d(sm.peak, fr.gablePeak[0]), ...sm.card.map((c, i) => d(c, fr.card[i]))))));
    console.log('per-sample worst-point error vs nearest frame px:', best.map(v => v.toFixed(1)).join(', '), '| visible in all:', samples.every(s => s.visible));
  }
  console.log('page errors:', errs.length ? errs.slice(0, 5) : 'none');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
