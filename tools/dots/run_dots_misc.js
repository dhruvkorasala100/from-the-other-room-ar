const pw = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const root = '/home/claude/from-the-other-room-ar';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html'; fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); }).listen(8795);
(async () => {
  // denied camera (Chromium)
  if (!process.env.WK) { const b = await pw.chromium.launch({ args: ['--use-fake-device-for-media-stream', '--deny-permission-prompts'] });
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    await ctx.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => errs.push(m.text()));
    await p.goto('http://localhost:8795/dots/'); await p.click('#start');
    await p.waitForSelector('#message:not([hidden])', { timeout: 10000 });
    console.log('denied ->', await p.textContent('#message'), '| intro visible:', await p.isVisible('#intro'), errs);
    await p.screenshot({ path: process.argv[2] + '_denied.png' }); await b.close(); }
  // WebKit: page + MindAR module load
  if (process.env.WK) { const b = await pw.webkit.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('http://localhost:8795/dots/');
    const ok = await p.evaluate(async () => { const m = await import('mindar-image-three'); return typeof m.MindARThree; });
    const det = await p.evaluate(async () => { const { createDotDetector } = await import('./detector.js'); const im = new Image(); im.src = '/dots/images/bicycle.jpg'; await im.decode(); return createDotDetector().detect(im).length; });
    console.log('webkit -> MindARThree', ok, '| detector runs, blobs on bicycle photo:', det, '| errors', errs); await b.close(); }
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
