# Synthetic phone video of the placement mat. World: X right, Y away from viewer, Z up (mm). Mat page top-left = (0,0).
import numpy as np, cv2, json, subprocess, sys
S = 6  # raster px per mm
subprocess.run(['pdftoppm', '-r', str(round(S*25.4)), '-png', '-singlefile', '/home/claude/ar/build/placement-mat.pdf', '/home/claude/ar/test/mat'], check=True)
mat = cv2.imread('/home/claude/ar/test/mat.png')
W, H, FOVY = 720, 1280, float(sys.argv[1]) if len(sys.argv) > 1 else 45.0
AMP = float(sys.argv[2]) if len(sys.argv) > 2 else 45.0
OUT = sys.argv[3] if len(sys.argv) > 3 else 'mat'
f = (H/2) / np.tan(np.radians(FOVY)/2); K = np.array([[f, 0, W/2], [0, f, H/2], [0, 0, 1]])
M = np.array([[1/S, 0, 0], [0, -1/S, 0], [0, 0, 1]])
def cam(dx):
    C = np.array([139.7 + dx, -(215.9 + 120), 250.0]); L = np.array([139.7, -100.0, 0.0])
    fw = (L - C) / np.linalg.norm(L - C); r = np.cross(fw, [0, 0, 1]); r /= np.linalg.norm(r); d = np.cross(fw, r)
    R = np.stack([r, d, fw]); t = -R @ C; return R, t
def project(R, t, pts):
    P = (K @ (R @ np.array(pts, float).T + t[:, None])); return (P[:2] / P[2]).T
L = json.load(open('/home/claude/ar/build/layout.json')); cd = L['card']
card = [(cd['x'], -cd['y']), (cd['x'] + cd['w'], -cd['y']), (cd['x'] + cd['w'], -(cd['y'] + cd['d'])), (cd['x'], -(cd['y'] + cd['d']))]
N = 48; truth = []
bg = np.full((H, W, 3), (88, 120, 160), np.uint8)  # wood-ish table
for i in range(N):
    dx = AMP * np.sin(2 * np.pi * i / N); R, t = cam(dx)
    Hm = K @ np.column_stack([R[:, 0], R[:, 1], t]) @ M
    fr = cv2.warpPerspective(mat, Hm, (W, H), borderMode=cv2.BORDER_TRANSPARENT, dst=bg.copy())
    fr = cv2.GaussianBlur(fr, (3, 3), 0)
    cv2.imwrite(f'/home/claude/ar/test/frames/f{i:03d}.png', fr)
    truth.append({'dx': dx, 'card': project(R, t, [(x, y, 0) for x, y in card]).tolist(),
                  'gablePeak': project(R, t, [(139.7 - 19.05*0.70711, -(cd['y'] + cd['d'] - 31.7) + 19.05*0.70711, 50.8)]).tolist()})
json.dump({'W': W, 'H': H, 'fovy': FOVY, 'frames': truth}, open(f'/home/claude/ar/test/{OUT}.json', 'w'))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '12', '-i', '/home/claude/ar/test/frames/f%03d.png', '-pix_fmt', 'yuv420p', f'/home/claude/ar/test/{OUT}.y4m'], check=True)
print('ok', FOVY)
