// Finds small blue ink dots on white paper in a camera frame.
//
// A pixel counts as ink when it is darker AND bluer than the paper around it
// (compared with a blurred copy of the frame, after white-balancing to the
// brightest paper). A blob only counts as a dot when the ring around it is
// plain, even paper: that rejects text, screens, fabric and other busy areas.

export function createDotDetector({ longSide = 480, debug = false } = {}) {
  const rejects = [];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let w = 0, h = 0, n = 0;
  let R, G, B, L, IR, IG, IB, mask, paper, cool, stack;

  function alloc(nw, nh) {
    w = nw; h = nh; n = w * h;
    canvas.width = w; canvas.height = h;
    R = new Float32Array(n); G = new Float32Array(n); B = new Float32Array(n); L = new Float32Array(n);
    cool = new Float32Array(n);
    mask = new Uint8Array(n); paper = new Uint8Array(n);
    const ni = (w + 1) * (h + 1);
    IR = new Float64Array(ni); IG = new Float64Array(ni); IB = new Float64Array(ni);
    stack = new Int32Array(n);
  }

  // source: a <video>, <img> or <canvas>; returns dots in source-normalised coords (0..1)
  function detect(source) {
    const sw = source.videoWidth || source.naturalWidth || source.width;
    const sh = source.videoHeight || source.naturalHeight || source.height;
    if (!sw || !sh) return [];
    const s = longSide / Math.max(sw, sh);
    const nw = Math.round(sw * s), nh = Math.round(sh * s);
    if (nw !== w || nh !== h) alloc(nw, nh);
    ctx.drawImage(source, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;

    // white reference = mean colour of the brightest 3% of pixels
    const hist = new Uint32Array(256);
    for (let i = 0, j = 0; i < n; i++, j += 4) hist[(px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8]++;
    let cut = 255, acc = 0;
    while (cut > 0 && acc + hist[cut] < n * 0.03) acc += hist[cut--];
    let rr = 0, rg = 0, rb = 0, rc = 0;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      if (((px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8) >= cut) { rr += px[j]; rg += px[j + 1]; rb += px[j + 2]; rc++; }
    }
    rr = Math.max(40, rr / rc) / 255; rg = Math.max(40, rg / rc) / 255; rb = Math.max(40, rb / rc) / 255;

    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const r = Math.min(1.5, px[j] / 255 / rr), g = Math.min(1.5, px[j + 1] / 255 / rg), b = Math.min(1.5, px[j + 2] / 255 / rb);
      R[i] = r; G[i] = g; B[i] = b; L[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      paper[i] = L[i] > 0.3 && (mx - mn) / (mx + 1e-3) < 0.22 ? 1 : 0;
    }

    // integral images -> local paper colour (box blur ~7% of the frame)
    const W1 = w + 1;
    for (let y = 0; y < h; y++) {
      let sr = 0, sg = 0, sb = 0;
      for (let x = 0; x < w; x++) {
        const i = y * w + x; sr += R[i]; sg += G[i]; sb += B[i];
        const k = (y + 1) * W1 + x + 1;
        IR[k] = IR[k - W1] + sr; IG[k] = IG[k - W1] + sg; IB[k] = IB[k - W1] + sb;
      }
    }
    const rad = Math.round(longSide * 0.035);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - rad), y1 = Math.min(h, y + rad + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - rad), x1 = Math.min(w, x + rad + 1);
        const a = y0 * W1 + x0, b = y0 * W1 + x1, c = y1 * W1 + x0, d = y1 * W1 + x1, area = (x1 - x0) * (y1 - y0);
        const br = (IR[d] - IR[b] - IR[c] + IR[a]) / area;
        const bg = (IG[d] - IG[b] - IG[c] + IG[a]) / area;
        const bb = (IB[d] - IB[b] - IB[c] + IB[a]) / area;
        const i = y * w + x;
        const Lb = 0.299 * br + 0.587 * bg + 0.114 * bb;
        const bmx = Math.max(br, bg, bb), bmn = Math.min(br, bg, bb);
        const c0 = (B[i] - R[i]) - (bb - br);
        cool[i] = c0;
        mask[i] = (Lb - L[i] > 0.06 && c0 > 0.035 && Lb > 0.35 && (bmx - bmn) / (bmx + 1e-3) < 0.25) ? 1 : 0;
      }
    }

    // connected blobs
    rejects.length = 0;
    const why = (r, cx, cy, extra) => { if (debug) rejects.push({ r, x: (cx + 0.5) / w, y: (cy + 0.5) / h, ...extra }); };
    const maxArea = longSide * longSide * 0.004;
    const out = [];
    for (let start = 0; start < n; start++) {
      if (mask[start] !== 1) continue;
      let sp = 0, area = 0, sx = 0, sy = 0, sc = 0, sl = 0, sbr = 0, minx = w, maxx = 0, miny = h, maxy = 0;
      stack[sp++] = start; mask[start] = 2;
      while (sp) {
        const i = stack[--sp], x = i % w, y = (i / w) | 0;
        area++; sx += x; sy += y; sc += cool[i]; sl += L[i]; sbr += B[i] - R[i];
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        if (x > 0 && mask[i - 1] === 1) { mask[i - 1] = 2; stack[sp++] = i - 1; }
        if (x < w - 1 && mask[i + 1] === 1) { mask[i + 1] = 2; stack[sp++] = i + 1; }
        if (y > 0 && mask[i - w] === 1) { mask[i - w] = 2; stack[sp++] = i - w; }
        if (y < h - 1 && mask[i + w] === 1) { mask[i + w] = 2; stack[sp++] = i + w; }
      }
      const cx = sx / area, cy = sy / area, rDot = Math.sqrt(area / Math.PI);
      if (area < 3 || area > maxArea) { why('area', cx, cy, { area }); continue; }
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      if (Math.max(bw, bh) > 4 * Math.min(bw, bh) + 2) { why('shape', cx, cy, { bw, bh }); continue; }
      const r0 = Math.max(3, rDot * 1.3 + 1.5), r1 = Math.max(r0 + 4, rDot * 4);
      // the ring around the dot must be plain, even paper
      // (std after removing a smooth shading gradient, so a shaded wall still counts as plain)
      let cnt = 0, sum = 0, sum2 = 0, pap = 0, rR = 0, rG = 0, rB = 0, sdx = 0, sdy = 0, sxx = 0, syy = 0, sxy = 0, slx = 0, sly = 0;
      const ya = Math.max(0, Math.floor(cy - r1)), yb = Math.min(h - 1, Math.ceil(cy + r1));
      const xa = Math.max(0, Math.floor(cx - r1)), xb = Math.min(w - 1, Math.ceil(cx + r1));
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r0 || d > r1) continue;
        const i = y * w + x, dx = x - cx, dy = y - cy, l = L[i];
        cnt++; sum += l; sum2 += l * l; pap += paper[i]; rR += R[i]; rG += G[i]; rB += B[i];
        sdx += dx; sdy += dy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; slx += l * dx; sly += l * dy;
      }
      if (cnt < 20) { why('edge', cx, cy); continue; }
      const mean = sum / cnt;
      // least-squares plane l = mean + gx*dx + gy*dy (centred sums)
      const mx = sdx / cnt, my = sdy / cnt;
      const cxx = sxx / cnt - mx * mx, cyy = syy / cnt - my * my, cxy = sxy / cnt - mx * my;
      const clx = slx / cnt - mean * mx, cly = sly / cnt - mean * my;
      const det = cxx * cyy - cxy * cxy || 1e-9;
      const gx = (clx * cyy - cly * cxy) / det, gy = (cly * cxx - clx * cxy) / det;
      const resid = sum2 / cnt - mean * mean - (gx * clx + gy * cly);
      const std = Math.sqrt(Math.max(0, resid));
      const rmx = Math.max(rR, rG, rB), rmn = Math.min(rR, rG, rB), rsat = (rmx - rmn) / (rmx + 1e-6);
      if (std > 0.035 || pap / cnt < 0.6 || rsat > 0.3 || mean < 0.3) { why('ring', cx, cy, { std, pap: pap / cnt, rsat, mean, area }); continue; }
      // ink is clearly darker than its paper (screens and glare spots are not)
      if (sl / area > 0.82 * mean) { why('light', cx, cy, { ratio: sl / area / mean }); continue; }
      if ((sc / area) * Math.sqrt(area) < 0.15) { why('weak', cx, cy, { score: (sc / area) * Math.sqrt(area), area }); continue; }
      out.push({ x: (cx + 0.5) / w, y: (cy + 0.5) / h, area, score: (sc / area) * Math.sqrt(area), ringStd: std, ringL: mean, dotL: sl / area, dotBR: sbr / area, cool: sc / area });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  return { detect, rejects, get size() { return { w, h }; } };
}
