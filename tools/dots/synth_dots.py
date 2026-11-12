# Synthetic portrait phone video of the open book (IMG_6967) with known blue-dot positions.
# Frame index is written as an 8-bit black/white code at the bottom so the test can sync.
import numpy as np, cv2, json, subprocess, sys
out = sys.argv[1] if len(sys.argv) > 1 else 'portrait'
W, H = (720, 1280) if out == 'portrait' else (1280, 720)
src = cv2.imread('/home/claude/dots/book_full.jpg')            # 4032x3024
PAD = 700
src = cv2.copyMakeBorder(src, PAD, PAD, 0, 0, cv2.BORDER_REFLECT)
DOTS = {'page': (0.3330 * 4032, 0.498 * 3024 + PAD), 'wall': (0.6550 * 4032, 0.383 * 3024 + PAD)}
away = cv2.imread('/home/claude/dots/neg/IMG_6940.jpg')
away = cv2.resize(away, (W, H)) if out == 'portrait' else cv2.resize(cv2.rotate(away, cv2.ROTATE_90_CLOCKWISE), (W, H))
mid = ((DOTS['page'][0] + DOTS['wall'][0]) / 2, (DOTS['page'][1] + DOTS['wall'][1]) / 2)
ww = 2300 if out == 'portrait' else 3000          # source window width
rng = np.random.default_rng(1)
FPS, N = 10, 130
def pose(i):
    dx, zoom, rot = 0.0, 1.0, 0.0
    if 30 <= i < 50: dx = 100 * (i - 30) / 20
    elif 50 <= i < 65: dx, zoom, rot = 100, 1 + 0.12 * (i - 50) / 15, 6 * (i - 50) / 15
    elif 65 <= i < 85: dx, zoom, rot = 100, 1.12, 6
    elif i >= 85: dx = -80
    return dx, zoom, rot
truth = []
for i in range(N):
    dx, zoom, rot = pose(i)
    s = W / ww * zoom
    A = cv2.getRotationMatrix2D((mid[0] + dx, mid[1]), rot, s)
    A[0, 2] += W / 2 - (mid[0] + dx); A[1, 2] += H / 2 - mid[1]
    fr = cv2.warpAffine(src, A, (W, H), flags=cv2.INTER_AREA)
    a = 0.0
    if 65 <= i < 85: a = min(1, (i - 64) / 3)
    if a > 0: fr = cv2.addWeighted(fr, 1 - a, away, a, 0)
    fr = cv2.GaussianBlur(fr, (3, 3), 0.8)
    fr = np.clip(fr.astype(np.float32) + rng.normal(0, 3.0, fr.shape), 0, 255).astype(np.uint8)
    for b in range(8):                                        # frame code
        v = 255 if (i >> b) & 1 else 0
        cv2.rectangle(fr, (W // 2 - 160 + b * 40, H - 36), (W // 2 - 160 + b * 40 + 36, H - 4), (v, v, v), -1)
    t = {}
    for k, (x, y) in DOTS.items():
        p = A @ np.array([x, y, 1.0]); t[k] = None if a >= 0.5 else [float(p[0]), float(p[1])]
    truth.append(t)
    cv2.imwrite(f'/home/claude/ar/test/dots/f{i:03d}.png', fr)
json.dump({'W': W, 'H': H, 'frames': truth}, open(f'/home/claude/ar/test/dots/{out}.json', 'w'))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', '/home/claude/ar/test/dots/f%03d.png', '-pix_fmt', 'yuv420p', f'/home/claude/ar/test/dots/{out}.y4m'], check=True)
cv2.imwrite(f'/home/claude/ar/test/dots/{out}_sample.jpg', cv2.imread('/home/claude/ar/test/dots/f040.png'))
print('ok', out, truth[0], truth[40])
