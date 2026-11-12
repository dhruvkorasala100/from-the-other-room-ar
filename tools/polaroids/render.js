const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1320 } });
  const base = 'file://' + path.resolve('polaroid.html');
  const items = [['walk_sq.jpg', 'నా చెయ్యి పట్టుకుని నాతో నడిచారు.', 'polaroid-india.png'], ['bike_sq.jpg', 'I was still finding my balance.', 'polaroid-america.png']];
  // pick one font size that keeps both captions within two lines
  let size = 96;
  for (; size > 40; size -= 2) {
    let ok = true;
    for (const [img, text] of items) {
      await p.goto(`${base}?img=${img}&text=${encodeURIComponent(text)}&size=${size}`); await p.evaluate(() => document.fonts.ready);
      const lines = await p.evaluate(() => { const c = document.getElementById('cap'); const r = document.createRange(); r.selectNodeContents(c); return Math.round(r.getBoundingClientRect().height / (parseFloat(getComputedStyle(c).fontSize) * 1.28)); });
      if (lines > 2) ok = false;
    }
    if (ok) break;
  }
  for (const [img, text, out] of items) {
    await p.goto(`${base}?img=${img}&text=${encodeURIComponent(text)}&size=${size}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
    const fams = await p.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ':' + f.unicodeRange.slice(0, 12)));
    await (await p.$('#p')).screenshot({ path: out });
    console.log(out, 'font px', size, '=', (size / 20).toFixed(1), 'mm', '| fonts loaded', fams);
  }
  await b.close();
})();
