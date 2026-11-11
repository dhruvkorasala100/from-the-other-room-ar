const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const [root, video, outDir, tag] = process.argv.slice(2);
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': u.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); }); }).listen(8768);
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 480 }, permissions: ['camera'] });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8768/try.html');
  await p.click('#go'); await p.waitForTimeout(1500);
  await p.click('#see'); await p.waitForTimeout(400); await p.screenshot({ path: `${outDir}/${tag}-mask.png` }); await p.click('#see');
  await p.click('#play'); const t0 = Date.now();
  for (const s of [0.2, 1.4, 3.6, 5.5, 7.5, 10.2, 11.8, 14.2]) {
    const wait = s * 1000 - (Date.now() - t0); if (wait > 0) await p.waitForTimeout(wait);
    await p.screenshot({ path: `${outDir}/${tag}-t${String(s).replace('.', '_')}.png` });
  }
  console.log(tag, 'hint at end:', await p.textContent('#hint'), '| errors:', errs.length ? errs.slice(0, 3) : 'none');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
