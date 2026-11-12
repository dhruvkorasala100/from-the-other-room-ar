const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const truth = JSON.parse(fs.readFileSync(process.argv[2]));
const root = '/home/claude/from-the-other-room-ar';
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]);
  let f = u.startsWith('/fr/') ? path.join('/home/claude/ar/test/dots', u.slice(4)) : path.join(root, u);
  if (u === '/t.html') { r.writeHead(200, {'Content-Type':'text/html'}); return r.end('<script type="module">import {createDotDetector} from "/dots/detector.js"; window.D=createDotDetector({longSide:480}); window.ready=1;</script>'); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'image/png' }); r.end(d); }); }).listen(8792);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:8792/t.html'); await p.waitForFunction(() => window.ready);
  let line = [];
  for (let i = 0; i < truth.frames.length; i++) {
    const c = await p.evaluate(async (src) => { const im = new Image(); im.src = src; await im.decode(); return D.detect(im).map(d => [d.x * im.width, d.y * im.height, d.score, d.ringStd, d.dotL / d.ringL]); }, `/fr/f${String(i).padStart(3, '0')}.png`);
    const T = truth.frames[i]; let s = '';
    for (const k of ['page', 'wall']) { if (!T[k]) { s += '.'; continue; } const m = c.find(d => Math.hypot(d[0] - T[k][0], d[1] - T[k][1]) < 8); s += m ? k[0].toUpperCase() : '-'; }
    const extra = c.filter(d => !['page', 'wall'].some(k => T[k] && Math.hypot(d[0] - T[k][0], d[1] - T[k][1]) < 8));
    line.push(`${i}:${s}${extra.length ? '+' + extra.map(d => `(${d[0].toFixed(0)},${d[1].toFixed(0)} s${d[2].toFixed(2)})`).join('') : ''}`);
    if (process.env.V && s.includes('-')) { const near = c.map(d=>d.map(v=>+v.toFixed(3))); }
  }
  console.log(line.join(' ')); await b.close(); srv.close();
})();
