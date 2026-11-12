import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

const TARGET_FILE = "./targets.mind";

// Target order in targets.mind (source images in target-images/):
// 0 = circle tag with the red page around it      (from the photo of the open book)
// 1 = triangle tag with the red page around it
// 2 = circle tag on its own                         (close-up)
// 3 = triangle tag on its own
//
// widthMM is the real width of each target image, so the photos come out the same size.

const SHAPES = [
  { targetIndex: 0, shape: "circle", widthMM: 52, rank: 0 },
  { targetIndex: 1, shape: "triangle", widthMM: 52, rank: 0 },
  { targetIndex: 2, shape: "circle", widthMM: 25, rank: 1 },
  { targetIndex: 3, shape: "triangle", widthMM: 24, rank: 1 }
];

const PHOTOS = {
  circle: { src: "./images/walking.jpg", name: "Walking hand in hand" },
  triangle: { src: "./images/bicycle.jpg", name: "Training wheels" }
};

// Polaroid size in mm, and how far its bottom edge floats above the shape
const PHOTO_W = 54;
const PHOTO_H = 66;
const HOVER = 6;
const FADE_SECONDS = 0.6;

const startButton = document.getElementById("start");
const status = document.getElementById("status");

let ar;
let running = false;
const entries = [];

startButton.addEventListener("click", startCamera);
window.addEventListener("pagehide", stopCamera);

async function startCamera() {
  if (running) return;
  startButton.disabled = true;
  status.textContent = "Loading the shapes…";

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser view has no camera access. Open the link in Safari or Chrome.");
    }

    ar = new MindARThree({
      container: document.getElementById("ar-stage"),
      imageTargetSrc: TARGET_FILE,
      maxTrack: 2,
      uiLoading: "no",
      uiScanning: "no",
      uiError: "no",
      filterMinCF: 0.0001,
      filterBeta: 10,
      warmupTolerance: 3,
      missTolerance: 8
    });

    const loader = new THREE.TextureLoader();
    const textures = {};
    for (const key in PHOTOS) {
      textures[key] = loader.load(PHOTOS[key].src);
      textures[key].colorSpace = THREE.SRGBColorSpace;
    }

    SHAPES.forEach((s) => createPhoto(s, textures[s.shape]));

    status.textContent = "Allow camera access…";
    await ar.start();

    running = true;
    startButton.hidden = true;
    status.textContent = "Point the camera at the circle or the triangle.";
    ar.renderer.setAnimationLoop(render);
  } catch (error) {
    console.error(error);
    stopCamera();
    startButton.disabled = false;
    startButton.textContent = "Try again";
    status.textContent =
      error?.name === "NotAllowedError"
        ? "Camera access was blocked. Allow it for this site, then try again."
        : error?.message || "Could not start the camera.";
  }
}

function createPhoto(s, texture) {
  const anchor = ar.addAnchor(s.targetIndex);

  // millimetres on the shape: x right, y toward the back of the page, z up off the page
  const mm = new THREE.Group();
  mm.scale.setScalar(1 / s.widthMM);
  anchor.group.add(mm);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO_W, PHOTO_H), material);
  photo.position.set(0, 0, HOVER + PHOTO_H / 2);
  mm.add(photo);

  const entry = { ...s, anchor, mm, photo, material, found: false, foundAt: 0 };

  anchor.onTargetFound = () => {
    entry.found = true;
    entry.foundAt = performance.now();
    updateStatus();
  };
  anchor.onTargetLost = () => {
    entry.found = false;
    updateStatus();
  };

  entries.push(entry);
}

function updateStatus() {
  const seen = new Set(entries.filter((e) => e.found).map((e) => e.shape));
  status.textContent = seen.size
    ? [...seen].map((k) => PHOTOS[k].name).join(" · ")
    : "Point the camera at the circle or the triangle.";
}

const camPos = new THREE.Vector3();
const photoPos = new THREE.Vector3();
const toCam = new THREE.Vector3();
const up = new THREE.Vector3();
const back = new THREE.Vector3();

function render() {
  const now = performance.now();
  ar.camera.getWorldPosition(camPos);

  for (const entry of entries) {
    // one photo per shape: the page view (rank 0) wins over the close-up (rank 1)
    const better = entries.some((o) => o !== entry && o.shape === entry.shape && o.found && o.rank < entry.rank);
    const active = entry.found && !better;

    const t = active ? Math.min(1, (now - entry.foundAt) / 1000 / FADE_SECONDS) : 0;
    entry.material.opacity = t * t * (3 - 2 * t);
    if (!active) continue;

    // face the phone; stay upright when seen from the side, tilt back when seen from above
    entry.mm.updateWorldMatrix(true, false);
    entry.photo.getWorldPosition(photoPos);
    up.set(0, 0, 1).transformDirection(entry.mm.matrixWorld);
    back.set(0, 1, 0).transformDirection(entry.mm.matrixWorld);
    const d = Math.abs(toCam.subVectors(camPos, photoPos).normalize().dot(up));
    entry.photo.up.copy(up).multiplyScalar(1 - d).addScaledVector(back, d).normalize();
    entry.photo.lookAt(camPos);
  }

  ar.renderer.render(ar.scene, ar.camera);
}

function stopCamera() {
  running = false;
  if (!ar) return;
  ar.renderer?.setAnimationLoop(null);
  try {
    ar.stop();
  } catch (error) {
    console.error("Stopping tracker:", error);
  }
}
