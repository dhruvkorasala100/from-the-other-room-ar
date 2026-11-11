# Synthetic phone video of the artwork base with the white card lying on it.
import numpy as np, cv2, json, subprocess, sys
S = 5
L = json.load(open('/home/claude/ar/base/layout.json')); PW, PH = L['page']; cd = L['card']
art = cv2.imread('/home/claude/ar/base/base_art.jpg'); art = cv2.resize(art, (round(PW * S), round(PH * S)), interpolation=cv2.INTER_AREA)
cv2.rectangle(art, (round(cd['x'] * S), round(cd['y'] * S)), (round((cd['x'] + cd['w']) * S), round((cd['y'] + cd['d']) * S)), (236, 238, 240), -1)
W, H, FOVY = 720, 1280, float(sys.argv[1]); AMP = float(sys.argv[2]); OUT = sys.argv[3]; DIST = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
f = (H / 2) / np.tan(np.radians(FOVY) / 2); K = np.array([[f, 0, W / 2], [0, f, H / 2], [0, 0, 1]])
M = np.array([[1 / S, 0, 0], [0, -1 / S, 0], [0, 0, 1]])
def cam(dx):
    C = np.array([108 + dx, -(PH + 150 * DIST), 270.0 * DIST]); Lk = np.array([108, -125.0, 0.0])
    fw = (Lk - C) / np.linalg.norm(Lk - C); r = np.cross(fw, [0, 0, 1]); r /= np.linalg.norm(r); d = np.cross(fw, r)
    R = np.stack([r, d, fw]); return R, -R @ C
def project(R, t, pts): P = K @ (R @ np.array(pts, float).T + t[:, None]); return (P[:2] / P[2]).T
card = [(cd['x'], -cd['y']), (cd['x'] + cd['w'], -cd['y']), (cd['x'] + cd['w'], -(cd['y'] + cd['d'])), (cd['x'], -(cd['y'] + cd['d']))]
hx, hy = L['houseCorner']; k = 19.05 * 0.70711
bg = np.full((H, W, 3), (70, 90, 120), np.uint8); truth = []
import os; os.makedirs('/home/claude/ar/test/frames', exist_ok=True)
for i in range(36):
    dx = AMP * np.sin(2 * np.pi * i / 36); R, t = cam(dx)
    fr = cv2.warpPerspective(art, K @ np.column_stack([R[:, 0], R[:, 1], t]) @ M, (W, H), borderMode=cv2.BORDER_TRANSPARENT, dst=bg.copy())
    cv2.imwrite(f'/home/claude/ar/test/frames/b{i:03d}.png', cv2.GaussianBlur(fr, (3, 3), 0))
    truth.append({'card': project(R, t, [(x, y, 0) for x, y in card]).tolist(), 'gablePeak': project(R, t, [(hx - k, -(hy - k), 50.8)]).tolist()})
json.dump({'frames': truth}, open(f'/home/claude/ar/test/{OUT}.json', 'w'))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '12', '-i', '/home/claude/ar/test/frames/b%03d.png', '-pix_fmt', 'yuv420p', f'/home/claude/ar/test/{OUT}.y4m'], check=True)
print('ok')
