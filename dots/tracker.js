// Keeps the two dots apart: "page" (on the flat page) and "wall" (on the house).
//
// First lock: the page dot is the lower-left one, the wall dot the upper-right one,
// and the same pair has to be seen on a few frames in a row.
// After that each dot follows its own nearest detection. A dot that drops out is
// looked for again where it should be relative to the other dot. If both are gone
// for a while, the tracker starts over with the first-lock rule.
//
// All positions are in "long-side units": pixels of the processed frame divided by
// its long side, so distances mean the same in portrait and landscape.

const SHOW_AFTER = 2;     // frames in a row before a button appears
const HIDE_MS = 350;      // a button disappears after its dot has been missing this long
const RESET_MS = 1500;    // both dots missing this long: start over with the first-lock rule
const LOCK_FRAMES = 3;
const STRONG = 0.3;       // detection strength needed to lock on, or to bring back a dot on its own

export function createDotTracker() {
  const mk = (id) => ({ id, x: 0, y: 0, vx: 0, vy: 0, hits: 0, misses: 999, lastHit: -1e9, visible: false, known: false });
  const tracks = { page: mk("page"), wall: mk("wall") };
  let locked = false, pending = null, offset = null; // offset = wall - page

  function firstLock(c) {
    const top = c.filter((d) => d.score >= STRONG).slice(0, 8);
    let best = null;
    for (const a of top) for (const b of top) {
      if (a === b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d < 0.05 || d > 0.85) continue;
      if ((dx - dy) / Math.SQRT2 < 0.3 * d) continue; // wall roughly up and to the right of page
      const s = a.score + b.score;
      if (!best || s > best.s) best = { page: a, wall: b, s };
    }
    if (!best) { pending = null; return; }
    if (pending && Math.hypot(best.page.x - pending.page.x, best.page.y - pending.page.y) < 0.04 &&
        Math.hypot(best.wall.x - pending.wall.x, best.wall.y - pending.wall.y) < 0.04) {
      pending = { ...best, n: pending.n + 1 };
    } else pending = { ...best, n: 1 };
    if (pending.n >= LOCK_FRAMES) {
      locked = true;
      for (const k of ["page", "wall"]) {
        const t = tracks[k], d = pending[k];
        Object.assign(t, { x: d.x, y: d.y, vx: 0, vy: 0, hits: SHOW_AFTER, misses: 0, lastHit: now, visible: true, known: true });
      }
      offset = { x: pending.wall.x - pending.page.x, y: pending.wall.y - pending.page.y };
      pending = null;
    }
  }

  // where to look for a dot this frame, how far from there to accept it, and how strong it must be
  function predict(t, other) {
    const otherHere = other.known && other.misses === 0;
    if (t.misses > 2 && otherHere && offset) {
      // lost: look where it should be relative to the dot we can still see
      const sgn = t.id === "wall" ? 1 : -1;
      return { x: other.x + sgn * offset.x, y: other.y + sgn * offset.y, gate: Math.min(0.2, 0.08 + 0.004 * t.misses), min: 0.2 };
    }
    if (t.misses === 0) {
      return { x: t.x + t.vx, y: t.y + t.vy, gate: 0.07, min: 0 };
    }
    // briefly lost, and the other dot is not helping: only nearby, strong detections
    return { x: t.x, y: t.y, gate: t.misses < 4 ? 0.07 : 0.06, min: t.visible ? 0.2 : STRONG };
  }

  let now = 0;
  function update(cands, time = performance.now()) {
    now = time;
    if (!locked) {
      firstLock(cands);
      return snapshot();
    }
    const P = tracks.page, Wt = tracks.wall;
    const pp = predict(P, Wt), pw = predict(Wt, P);
    const options = [null, ...cands.slice(0, 10)];
    let best = null;
    for (const a of options) for (const b of options) {
      if (a && a === b) continue;
      if ((a && a.score < pp.min) || (b && b.score < pw.min)) continue;
      const da = a ? Math.hypot(a.x - pp.x, a.y - pp.y) : pp.gate;
      const db = b ? Math.hypot(b.x - pw.x, b.y - pw.y) : pw.gate;
      if (da > pp.gate || db > pw.gate) continue;
      if (a && b && offset) {
        // never let the two swap places
        const ox = b.x - a.x, oy = b.y - a.y;
        if (ox * offset.x + oy * offset.y < 0) continue;
      }
      const cost = da + db - (a ? 0.02 : 0) - (b ? 0.02 : 0);
      if (!best || cost < best.cost) best = { a, b, cost };
    }
    apply(P, best && best.a);
    apply(Wt, best && best.b);
    if (best && best.a && best.b) {
      const ox = best.b.x - best.a.x, oy = best.b.y - best.a.y;
      offset = offset ? { x: offset.x * 0.7 + ox * 0.3, y: offset.y * 0.7 + oy * 0.3 } : { x: ox, y: oy };
    }
    if (now - P.lastHit > RESET_MS && now - Wt.lastHit > RESET_MS) reset();
    return snapshot();
  }

  function apply(t, d) {
    if (d) {
      const vx = d.x - t.x, vy = d.y - t.y;
      t.vx = t.misses ? 0 : t.vx * 0.5 + vx * 0.5; t.vy = t.misses ? 0 : t.vy * 0.5 + vy * 0.5;
      t.x = d.x; t.y = d.y; t.hits++; t.misses = 0; t.lastHit = now;
      if (t.hits >= SHOW_AFTER) t.visible = true;
    } else {
      t.hits = 0; t.misses++;
      t.vx *= 0.6; t.vy *= 0.6;
      if (now - t.lastHit > HIDE_MS) t.visible = false;
    }
  }

  function reset() {
    locked = false; pending = null; offset = null;
    for (const k in tracks) Object.assign(tracks[k], mk(k));
  }

  function snapshot() {
    return {
      locked,
      page: { ...tracks.page },
      wall: { ...tracks.wall }
    };
  }

  return { update, reset, get locked() { return locked; } };
}
