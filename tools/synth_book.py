import numpy as np, cv2, json, subprocess, sys, os
S = 5; WW, HH = 300, 330; Yb = 110.0
FOVY = float(sys.argv[1]); AMP = float(sys.argv[2]); OUT = sys.argv[3]; DIST = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
world = np.full((HH * S, WW * S, 3), (215, 222, 228), np.uint8)
subprocess.run(['pdftoppm', '-r', str(round(S * 25.4)), '-png', '-singlefile', '/home/claude/pol/build/book-target.pdf', '/home/claude/ar/test/booksheet'], check=True)
sheet = cv2.imread('/home/claude/ar/test/booksheet.png'); sx, sy = round(10.3 * S), round((Yb - 14) * S)
h, w = sheet.shape[:2]; world[sy:sy + h, sx:sx + w] = sheet[:min(h, world.shape[0] - sy), :min(w, world.shape[1] - sx)]
rng = np.random.default_rng(3); bw, bh = round(190.5 * S), round(104.8 * S)
red = np.zeros((bh, bw, 3), np.float32); red[:] = (60, 40, 190)
noise = cv2.GaussianBlur(rng.random((bh, bw)).astype(np.float32), (0, 0), 6); red *= (0.75 + 0.5 * noise[..., None])
cracks = (cv2.GaussianBlur(rng.random((bh, bw)).astype(np.float32), (0, 0), 2) > 0.53); red[cracks] *= 0.35
bx, by = round((150 - 95.25) * S), round((Yb - 104.8) * S); world[by:by + bh, bx:bx + bw] = red.astype(np.uint8)
W, H = 720, 1280; f = (H / 2) / np.tan(np.radians(FOVY) / 2); K = np.array([[f, 0, W / 2], [0, f, H / 2], [0, 0, 1]])
M = np.array([[1 / S, 0, 0], [0, -1 / S, 0], [0, 0, 1]])
def cam(dx):
    C = np.array([150 + dx, -(HH + 120 * DIST), 300.0 * DIST]); L = np.array([150, -125.0, 0.0])
    fw = (L - C) / np.linalg.norm(L - C); r = np.cross(fw, [0, 0, 1]); r /= np.linalg.norm(r); d = np.cross(fw, r)
    R = np.stack([r, d, fw]); return R, -R @ C
def project(R, t, pts): P = K @ (R @ np.array(pts, float).T + t[:, None]); return (P[:2] / P[2]).T
os.makedirs('/home/claude/ar/test/frames', exist_ok=True); truth = []
for i in range(36):
    dx = AMP * np.sin(2 * np.pi * i / 36); R, t = cam(dx)
    fr = cv2.warpPerspective(world, K @ np.column_stack([R[:, 0], R[:, 1], t]) @ M, (W, H), borderValue=(200, 205, 210))
    cv2.imwrite(f'/home/claude/ar/test/frames/k{i:03d}.png', cv2.GaussianBlur(fr, (3, 3), 0))
    truth.append({'left': project(R, t, [(150 - 56, -(Yb - 40), 0.6)]).tolist()[0], 'right': project(R, t, [(150 + 62, -(Yb - 40), 0.6)]).tolist()[0],
                  'fold': project(R, t, [(150, -Yb, 0)]).tolist()[0]})
json.dump({'frames': truth}, open(f'/home/claude/ar/test/{OUT}.json', 'w'))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '12', '-i', '/home/claude/ar/test/frames/k%03d.png', '-pix_fmt', 'yuv420p', f'/home/claude/ar/test/{OUT}.y4m'], check=True)
print('ok')
