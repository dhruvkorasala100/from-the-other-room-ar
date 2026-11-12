const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const root = '/home/claude/from-the-other-room-ar';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]);
  let f = u.startsWith('/img/') ? path.join('/home/claude/dots', u.slice(5)) : path.join(root, u);
  if (u === '/t.html') { r.writeHead(200, {'Content-Type':'text/html'}); return r.end('<script type="module">import {createDotDetector} from "/dots/detector.js"; window.D=createDotDetector({longSide:480}); window.ready=1;</script>'); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); }).listen(8790);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:8790/t.html'); await p.waitForFunction(() => window.ready);
  const files = ['book.jpg', ...fs.readdirSync('/home/claude/dots/neg').map(f => 'neg/' + f)];
  for (const f of files) {
    const res = await p.evaluate(async (src) => { const im = new Image(); im.src = src; await im.decode(); const t = performance.now(); const c = D.detect(im); return { ms: performance.now() - t, c: c.slice(0, 4).map(d => [Math.round(d.x * 1000), Math.round(d.y * 1000), d.area, ...[d.score, d.ringStd, d.ringL, d.dotL, d.dotBR, d.cool].map(v=>+v.toFixed(3))]) }; }, '/img/' + f);
    console.log(f.padEnd(20), res.ms.toFixed(0) + 'ms', JSON.stringify(res.c));
  }
  await b.close(); srv.close();
})();
