# Shapes prototype (MindAR)

Point the phone at the open book. The photo of walking hand in hand floats above the circle tag;
the training-wheels photo floats above the triangle tag. Built like "The Words Between Us":
`index.html` + `sketch.js` + `style.css` + `targets.mind`, using `MindARThree`.

- `targets.mind`: 4 targets compiled from `target-images/` (0 circle with page around it, 1 triangle with page,
  2 circle close-up, 3 triangle close-up). One photo per shape; the with-page target wins if both match.
- `lib/`: three.js 0.160 and MindAR 1.2.5 bundled locally. MindAR is patched to request a 1280x720 camera
  (Safari defaults to 640x480) and to read the camera field of view from `window.MINDAR_FOVY`.
- Photo size and float height: `PHOTO_W`, `PHOTO_H`, `HOVER` in `sketch.js`.
