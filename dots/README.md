# Blue-dot hotspots

Live: https://dhruvkorasala100.github.io/from-the-other-room-ar/dots/  (QR: `qr.png`, `qr.svg`)

Point the phone at the open book. Two glowing buttons sit on the two blue ink dots:

| dot | where | opens |
| --- | --- | --- |
| page | flat page beside the house (lower left when first found) | `images/bicycle.jpg` |
| wall | wall of the house (upper right when first found) | `images/walking.jpg` |

- `app.js` – start page, camera (opened by MindAR, `../shapes/lib/`), hotspots, pop-ups, smoothing.
- `detector.js` – finds blue ink dots: darker and bluer than the paper around them, with plain, even paper in a ring around each dot.
- `tracker.js` – first lock (page = lower left, wall = upper right, same pair on 3 frames), then each dot follows its own detection; a lost dot is looked for relative to the other one; both gone for 1.5 s starts over.
- `?debug` – shows every detection (yellow rings), the frame size and the time per frame.

Tests (Chromium with a fake camera): `tools/dots/`.
