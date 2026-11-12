// Plays a synthetic camera video into the AR page and checks the hotspots against the true dot positions.
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const [video, truthFile, shotPrefix, vw = '390', vh = '844'] = process.argv.slice(2);
const truth = JSON.parse(fs.readFileSync(truthFile));
const root = '/home/claude/from-the-other-room-ar';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html'; fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); }).listen(8791);
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] });
  const ctx = await b.newContext({ viewport: { width: +vw, height: +vh }, deviceScaleFactor: 2, hasTouch: true, permissions: ['camera'] });
  await ctx.addInitScript(`window.MINDAR_VIDEO_W=${truth.W}; window.MINDAR_VIDEO_H=${truth.H};`);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8791/dots/' + (process.env.Q || ''));
  await p.screenshot({ path: shotPrefix + '_start.png' });
  await p.click('#start');
  await p.waitForFunction(() => window.__dots && window.__dots.frames > 0, null, { timeout: 15000 });
  const tStart = Date.now();
  const samples = [];
  while (Date.now() - tStart < 30000) {
    const s = await p.evaluate(() => {
      const v = document.querySelector('#stage video'); const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      const g = c.getContext('2d'); g.drawImage(v, 0, 0); let f = 0;
      for (let b = 0; b < 8; b++) { const d = g.getImageData(c.width / 2 - 160 + b * 40 + 18, c.height - 20, 1, 1).data; if (d[0] > 128) f |= 1 << b; }
      const W = innerWidth, H = innerHeight, s = Math.max(W / v.videoWidth, H / v.videoHeight);
      const st = window.__dots;
      return { f, s, ox: (W - v.videoWidth * s) / 2, oy: (H - v.videoHeight * s) / 2, page: st.page, wall: st.wall, locked: st.locked, ms: st.ms, vw: v.videoWidth, vh: v.videoHeight,
        hint: !document.getElementById('hint').classList.contains('off') };
    });
    s.t = Date.now() - tStart; samples.push(s);
    await p.waitForTimeout(80);
  }
  // score
  let rows = { page: [], wall: [] }, wrongVisible = 0, swapped = 0, awayShown = 0, missingWhenPresent = { page: 0, wall: 0 }, present = 0;
  for (const s of samples) {
    const T = truth.frames[s.f]; if (!T) continue;
    for (const k of ['page', 'wall']) {
      const h = s[k];
      if (!T[k]) { if (h && h.visible) awayShown++; continue; }
      const gx = T[k][0] * s.s + s.ox, gy = T[k][1] * s.s + s.oy;
      const inView = gx > 0 && gy > 0 && gx < +vw && gy < +vh;
      if (!h || !h.visible) { if (inView) missingWhenPresent[k]++; continue; }
      const e = Math.hypot(h.x - gx, h.y - gy); rows[k].push(e);
      const o = k === 'page' ? 'wall' : 'page'; const ogx = T[o][0] * s.s + s.ox, ogy = T[o][1] * s.s + s.oy;
      if (Math.hypot(h.x - ogx, h.y - ogy) < e) swapped++;
    }
    if (T.page) present++;
  }
  const stat = a => a.length ? `n=${a.length} median ${med(a).toFixed(1)}px p90 ${pct(a, .9).toFixed(1)}px max ${Math.max(...a).toFixed(1)}px` : 'n=0';
  function med(a) { return pct(a, .5); } function pct(a, q) { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(q * b.length))]; }
  console.log(path.basename(video), `video ${samples[0].vw}x${samples[0].vh}, detect ${samples.at(-1).ms.toFixed(1)} ms/frame, ${samples.length} samples`);
  console.log('  page error:', stat(rows.page)); console.log('  wall error:', stat(rows.wall));
  console.log('  swapped:', swapped, '| shown while pointed away:', awayShown, '| missing while dot on screen:', JSON.stringify(missingWhenPresent), 'of', present);
  // timeline around the away segment
  const tl = samples.map(s => `${s.f}:${s.page?.visible ? 'P' : '-'}${s.wall?.visible ? 'W' : '-'}${s.hint ? 'h' : ''}`).join(' ');
  fs.writeFileSync(shotPrefix + '_timeline.txt', tl);
  // taps: wait for a frame where both are visible, tap page, check, close, tap wall
  await p.waitForFunction(() => window.__dots.page?.visible && window.__dots.wall?.visible, null, { timeout: 20000 });
  await p.screenshot({ path: shotPrefix + '_both.png' });
  const pp = await p.evaluate(() => window.__dots.page); await p.mouse.click(pp.x, pp.y);
  await p.waitForTimeout(400);
  const o1 = await p.evaluate(() => ({ open: window.__dots.open, src: document.getElementById('photo').getAttribute('src'), vis: !document.getElementById('popup').hidden, playing: !document.querySelector('#stage video').paused }));
  await p.screenshot({ path: shotPrefix + '_page_photo.png' });
  await p.click('#close'); await p.waitForTimeout(300);
  await p.waitForFunction(() => window.__dots.page?.visible && window.__dots.wall?.visible, null, { timeout: 20000 });
  const wp = await p.evaluate(() => window.__dots.wall); await p.mouse.click(wp.x, wp.y);
  await p.waitForTimeout(400);
  const o2 = await p.evaluate(() => ({ open: window.__dots.open, src: document.getElementById('photo').getAttribute('src'), vis: !document.getElementById('popup').hidden, playing: !document.querySelector('#stage video').paused }));
  await p.screenshot({ path: shotPrefix + '_wall_photo.png' });
  await p.click('#close'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ popup: !document.getElementById('popup').hidden, frames: window.__dots.frames }));
  await p.waitForTimeout(500);
  const after2 = await p.evaluate(() => window.__dots.frames);
  console.log('  tap page ->', JSON.stringify(o1)); console.log('  tap wall ->', JSON.stringify(o2));
  console.log('  after close: popup', after.popup, '| camera still processing:', after2 > after.frames);
  console.log('  errors:', errs.slice(0, 3));
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
