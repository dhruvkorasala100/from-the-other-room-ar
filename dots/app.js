import { createDotDetector } from "./detector.js";
import { createDotTracker } from "./tracker.js";

// Which photo each dot opens.
const PHOTOS = {
  page: { src: "./images/bicycle.jpg", alt: "Riding a bicycle with training wheels" },
  wall: { src: "./images/walking.jpg", alt: "Walking while holding someone's hand" }
};

const DEBUG = new URLSearchParams(location.search).has("debug");
const $ = (id) => document.getElementById(id);

const intro = $("intro"), arView = $("ar"), stage = $("stage");
const startBtn = $("start"), message = $("message"), hint = $("hint");
const popup = $("popup"), photo = $("photo");
const spots = { page: $("spot-page"), wall: $("spot-wall") };
const debugCanvas = $("debug");

// MindAR opens the rear camera (its own camera setup, with the HD request patched in).
// The dots themselves are found by detector.js: two ink dots on plain paper give
// MindAR's image tracker nothing to hold on to.
const mindarReady = import("mindar-image-three").then(({ MindARThree }) => {
  class CameraOnly extends MindARThree {
    resize() {}        // the video is laid out with CSS (object-fit: cover)
  }
  return CameraOnly;
});

let ar = null, video = null, running = false, frameHandle = 0;
let detector = null, tracker = null;
let popupOpen = false, lastSeen = 0;
const filters = { page: makeFilter(), wall: makeFilter() };

const state = { page: null, wall: null, locked: false, candidates: [], ms: 0, frames: 0 };
window.__dots = state; // read by the automated tests

startBtn.addEventListener("click", start);
$("exit").addEventListener("click", stop);
$("close").addEventListener("click", closePhoto);
popup.addEventListener("click", (e) => { if (e.target === popup) closePhoto(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePhoto(); });
spots.page.addEventListener("click", () => openPhoto("page"));
spots.wall.addEventListener("click", () => openPhoto("wall"));
document.addEventListener("visibilitychange", () => { if (!document.hidden && video) video.play().catch(() => {}); });

async function start() {
  if (running) return;
  message.hidden = true;

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return fail("This view can't use the camera. Open the link in Safari (iPhone) or Chrome (Android).");
  }

  startBtn.disabled = true;
  startBtn.lastChild.textContent = " Opening camera…";

  // remember why the camera failed (MindAR swallows the error)
  let cameraError = null;
  const md = navigator.mediaDevices, original = md.getUserMedia.bind(md);
  md.getUserMedia = (c) => original(c).catch((e) => { cameraError = e; throw e; });

  try {
    const CameraOnly = await mindarReady;
    ar = new CameraOnly({ container: stage, imageTargetSrc: "", maxTrack: 1, uiLoading: "no", uiScanning: "no", uiError: "no" });
    ar.renderer.domElement.remove();
    ar.cssRenderer.domElement.remove();
    ar.renderer.dispose();

    intro.hidden = true;
    arView.hidden = false;
    document.body.classList.add("in-ar");

    await ar._startVideo();
    video = ar.video;
    video.muted = true;
    await video.play().catch(() => {});

    detector = createDotDetector({ longSide: 480 });
    tracker = createDotTracker();
    filters.page.reset(); filters.wall.reset();
    lastSeen = performance.now();
    running = true;
    debugCanvas.hidden = !DEBUG;
    loop();
  } catch (error) {
    console.error(error, cameraError);
    teardown();
    intro.hidden = false;
    const name = cameraError?.name || error?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      fail(
        "Camera access is turned off for this page. " +
        (/iPhone|iPad|iPod/.test(navigator.userAgent)
          ? "On iPhone: tap “aA” in the address bar › Website Settings › Camera › Allow, then tap View in AR again."
          : "On Android: tap the icon left of the address › Permissions › Camera › Allow, then tap View in AR again.")
      );
    } else if (name === "NotFoundError" || name === "OverconstrainedError") {
      fail("No camera was found on this device.");
    } else if (name === "NotReadableError") {
      fail("The camera is busy in another app. Close it and try again.");
    } else {
      fail("The camera couldn't start. Reload the page and try again.");
    }
  } finally {
    md.getUserMedia = original;
    startBtn.disabled = false;
    startBtn.lastChild.textContent = " View in AR";
  }
}

function fail(text) {
  message.textContent = text;
  message.hidden = false;
}

function stop() {
  teardown();
  intro.hidden = false;
}

function teardown() {
  running = false;
  if (frameHandle && video?.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameHandle);
  cancelAnimationFrame(frameHandle);
  frameHandle = 0;
  if (video) {
    video.srcObject?.getTracks().forEach((t) => t.stop());
    video.remove();
  }
  if (ar?.video && ar.video !== video) ar.video.remove();
  video = null; ar = null;
  closePhoto();
  for (const k in spots) spots[k].classList.remove("on");
  arView.hidden = true;
  document.body.classList.remove("in-ar");
}

// ---------- per frame ----------

let lastTime = -1;
function loop() {
  if (!running) return;
  if (video.requestVideoFrameCallback) frameHandle = video.requestVideoFrameCallback(onFrame);
  else frameHandle = requestAnimationFrame(() => { if (video.currentTime !== lastTime) { lastTime = video.currentTime; onFrame(); } else loop(); });
}

function onFrame() {
  if (!running) return;
  const t0 = performance.now();
  const vw = video.videoWidth, vh = video.videoHeight;
  if (vw && vh) {
    const long = Math.max(vw, vh);
    // detector gives 0..1 per axis; the tracker works in long-side units
    const cands = detector.detect(video).map((c) => ({ ...c, x: (c.x * vw) / long, y: (c.y * vh) / long }));
    const snap = tracker.update(cands, t0);
    state.ms = state.ms * 0.9 + (performance.now() - t0) * 0.1;
    state.frames++;
    state.locked = snap.locked;
    state.candidates = cands.map((c) => toScreen(c.x * long, c.y * long, vw, vh));
    for (const k of ["page", "wall"]) place(k, snap[k], long, vw, vh, t0);
    if (DEBUG) drawDebug(cands, snap, long, vw, vh);
  }
  const anyOn = state.page?.visible || state.wall?.visible;
  if (anyOn) lastSeen = t0;
  hint.classList.toggle("off", popupOpen || anyOn || t0 - lastSeen < 1200);
  loop();
}

// video pixel -> screen pixel, matching object-fit: cover
function toScreen(vx, vy, vw, vh) {
  const W = stage.clientWidth, H = stage.clientHeight;
  const s = Math.max(W / vw, H / vh);
  return { x: vx * s + (W - vw * s) / 2, y: vy * s + (H - vh * s) / 2 };
}

function place(key, track, long, vw, vh, now) {
  const el = spots[key];
  if (!track.visible) {
    el.classList.remove("on");
    state[key] = { visible: false };
    filters[key].reset();        // snap straight to the dot when it comes back
    return;
  }
  const p = toScreen(track.x * long, track.y * long, vw, vh);
  const f = filters[key].filter(p.x, p.y, now / 1000);
  const W = stage.clientWidth, H = stage.clientHeight;
  const inView = f.x > -20 && f.y > -20 && f.x < W + 20 && f.y < H + 20;
  el.style.transform = `translate3d(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px, 0)`;
  el.classList.toggle("on", inView && !popupOpen);
  state[key] = { visible: inView, x: f.x, y: f.y, rawX: p.x, rawY: p.y };
}

// ---------- photos ----------

function openPhoto(key) {
  if (popupOpen) return;
  popupOpen = true;
  photo.src = PHOTOS[key].src;
  photo.alt = PHOTOS[key].alt;
  popup.hidden = false;
  state.open = key;
  for (const k in spots) spots[k].classList.remove("on");
  $("close").focus({ preventScroll: true });
}

function closePhoto() {
  if (!popupOpen) return;
  popupOpen = false;
  popup.hidden = true;
  state.open = null;
}

// ---------- smoothing (One Euro filter: steady when still, quick when moving) ----------

function makeFilter(minCutoff = 1.4, beta = 0.012, dCutoff = 1.2) {
  let x = null, y = null, dx = 0, dy = 0, t = 0;
  const alpha = (cut, dt) => 1 / (1 + 1 / (2 * Math.PI * cut * dt));
  return {
    reset() { x = y = null; },
    filter(nx, ny, nt) {
      if (x === null) { x = nx; y = ny; t = nt; return { x, y }; }
      const dt = Math.max(1 / 120, nt - t); t = nt;
      const ad = alpha(dCutoff, dt);
      dx += ad * ((nx - x) / dt - dx); dy += ad * ((ny - y) / dt - dy);
      const a = alpha(minCutoff + beta * Math.hypot(dx, dy), dt);
      x += a * (nx - x); y += a * (ny - y);
      return { x, y };
    }
  };
}

// ---------- ?debug overlay ----------

function drawDebug(cands, snap, long, vw, vh) {
  const W = stage.clientWidth, H = stage.clientHeight, dpr = devicePixelRatio || 1;
  if (debugCanvas.width !== W * dpr) { debugCanvas.width = W * dpr; debugCanvas.height = H * dpr; }
  const g = debugCanvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  g.lineWidth = 1.5;
  for (const c of cands) {
    const p = toScreen(c.x * long, c.y * long, vw, vh);
    g.strokeStyle = "rgba(255,200,0,.9)";
    g.beginPath(); g.arc(p.x, p.y, 14, 0, 7); g.stroke();
  }
  for (const k of ["page", "wall"]) {
    const t = snap[k]; if (!t.known) continue;
    const p = toScreen(t.x * long, t.y * long, vw, vh);
    g.fillStyle = "#fff"; g.font = "12px ui-monospace, monospace";
    g.fillText(`${k} ${t.visible ? "on" : "off"} m${t.misses}`, p.x + 22, p.y - 18);
  }
  g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(70, 18, 230, 22);
  g.fillStyle = "#fff";
  g.fillText(`${vw}x${vh} · ${state.ms.toFixed(1)} ms · ${cands.length} cand · ${snap.locked ? "locked" : "searching"}`, 78, 33);
}
