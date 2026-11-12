# From the Other Room · phone AR

Phone-browser AR for the white paper pop-up house (Robert Sabuda box-house template).

## Main version: artwork base (`index.html`)
1. Print `artwork-base.pdf` on US Letter at **100% / Actual size**.
2. Open the card flat on the **back half** of the print, inside the white corner ticks, fold on the tick at the card's front edge, house front corner toward you. Tape the card's two outer edges.
3. Open the site on the phone, allow the camera, point at the artwork in front of the house.

Sequence: scan (artwork → card → walls → roof) → the whole house turns red → the printed black line carries on across the card and up the long wall to the roof while the artwork spreads over the house → white covers the house, card and base.
"Adjust fit" switches to a plain red alignment overlay. URL options: `?reset` · `?fov=63` · `?speed=0.5` · `?smooth=steady|balanced|responsive`.

The artwork (IMG_6944) is printed rotated 180° so the red circle sits just in front of the card. The phone tracks the visible front strip (page x 8–208 mm, y 118–268 mm).

## White room (`white.html`)
Point the phone at the open pop-up book: everything except the book fades to white, then the house slowly turns red
(a multiply tint over the live camera, so the paper's folds and shadows stay). Uses the same page tracking images as
`polaroids.html`; the house's outline comes from the Sabuda geometry placed relative to the tracked page.
Timings are in `TIME` at the top. `?debug` shows the computed house outline (red) and page zone (green).

## Polaroid prototype (`polaroids.html`)
Point the phone at the open pop-up book: a Polaroid floats above each red page and always faces the phone
(upright when seen from the side, tilted back when seen from above, caption toward the front of the book).
Left page: India, "నా చెయ్యి పట్టుకుని నాతో నడిచారు." Right page: America, "I was still finding my balance."
No printed target: each painted page is its own tracking image, learned from a straight-down photo and an angled photo
(`polaroids/pages/*-top.jpg`, `*-angled.jpg`, compiled into `targets/pages-v3.mind`; one Polaroid per page either way). Captions are pre-rendered into the Polaroid images (Noto Sans Telugu / Noto Sans).
The bundled MindAR is patched to request a 1280×720 camera stream (Safari defaults to 640×480).

## Other pages
- `mat.html` + `placement-mat.pdf`: earlier test with a generated pattern and a static red overlay.
- `try.html`: no printing; recolours the white paper in the live camera image (no 3D tracking).

## Quick try, no printing: `try.html`
Open `/try.html`, point at the house, tap Play. It recolours the white paper in the live camera image (room-light corrected, keeps only the paper you point at, fills shaded walls framed by paper). No 3D tracking, so marks follow the screen, not a specific wall.

## Precise version with the printed mat: `index.html`
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
