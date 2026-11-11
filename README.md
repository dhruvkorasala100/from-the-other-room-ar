# From the Other Room · phone AR

Phone-browser AR for the white paper pop-up house (Robert Sabuda box-house template).
Point a phone at the printed placement mat and the overlay sits on the real card.

**Stage 1 (now):** visible scan sequence (pattern → card → walls → roof → "House identified") that settles into a static red overlay, plus an "Adjust fit" calibration drawer.
**Stage 2 (next):** red wash → black acrylic marks across the ground → streak climbs the wall → white acrylic covers the house.

## Use
1. Print `placement-mat.pdf` on US Letter at **100% / Actual size** (the 40 mm bar should measure 40 mm).
2. Open the card flat on the mat inside the corner marks, fold on the tick marks, house front corner toward the image. Tape the two outer edges.
3. Open the site on the phone, allow the camera, point at the image.
4. Calibrate with the panel, tap **Copy values**, paste them into `ALIGN_DEFAULT` in `index.html`.

URL options: `?reset` ignores saved values · `?scanspeed=0.5` slows the scan · `?fov=63` sets camera FOV · `?smooth=steady|balanced|responsive`.

## Files
- `index.html` – the AR page. All alignment values are in `ALIGN_DEFAULT` at the top.
- `lib/` – A-Frame 1.5.0 and MindAR 1.2.5. **MindAR is patched**: its hard-coded 45° camera FOV now reads `window.MINDAR_FOVY`.
- `targets/mat-v1.mind` – compiled tracking target for the mat image.
- `tools/` – scripts that generated the target, compiled it, built the mat, and the headless camera test.

## Geometry (template at 100%)
Footprint 50.8 × 38.1 mm at 45° across the fold, front corner 31.7 mm behind the card's front edge · eave 38.1 mm · ridge 50.8 mm · roof faces 34.9 mm slope × 57.1 mm ridge with rounded outer corners · card 190.5 × 104.8 mm.
