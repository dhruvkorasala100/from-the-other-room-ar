# Stress frames: far away, close up, daylight/cool cast, dim, motion blur, perspective tilt, JPEG noise.
import numpy as np, cv2, json
src = cv2.imread('/home/claude/dots/book_full.jpg'); PAD = 700
src = cv2.copyMakeBorder(src, PAD, PAD, PAD, PAD, cv2.BORDER_REFLECT)
D = {'page': (0.3330 * 4032 + PAD, 0.498 * 3024 + PAD), 'wall': (0.6550 * 4032 + PAD, 0.383 * 3024 + PAD)}
mid = ((D['page'][0] + D['wall'][0]) / 2, (D['page'][1] + D['wall'][1]) / 2)
W, H = 720, 1280; rng = np.random.default_rng(2)
cases = []
for ww in (1700, 2300, 3000, 3600): cases.append(dict(ww=ww))
for ww in (2300, 3000):
    for cast in ('cool', 'warm', 'dim', 'bright'): cases.append(dict(ww=ww, cast=cast))
    for blur in (5, 9, 15): cases.append(dict(ww=ww, blur=blur))
    for tilt in (-0.25, 0.25): cases.append(dict(ww=ww, tilt=tilt))
    cases.append(dict(ww=ww, jpeg=35))
truth = []; names = []
for i, c in enumerate(cases):
    s = W / c['ww']
    A = np.array([[s, 0, W / 2 - mid[0] * s], [0, s, H / 2 - mid[1] * s], [0, 0, 1]])
    if 'tilt' in c:  # perspective: squash one side
        t = c['tilt']; P = cv2.getPerspectiveTransform(np.float32([[0, 0], [W, 0], [W, H], [0, H]]), np.float32([[W * max(0, t) * .4, 0], [W - W * max(0, -t) * .4, 0], [W, H], [0, H]]))
        A = P @ A
    fr = cv2.warpPerspective(src, A, (W, H), flags=cv2.INTER_AREA).astype(np.float32)
    cast = c.get('cast')
    if cast == 'cool': fr *= np.float32([1.25, 1.0, 0.8])     # BGR: daylight
    if cast == 'warm': fr *= np.float32([0.85, 0.97, 1.08])
    if cast == 'dim': fr = fr * 0.45
    if cast == 'bright': fr = np.clip(fr * 1.6, 0, 255)
    fr = np.clip(fr, 0, 255).astype(np.uint8)
    if 'blur' in c:
        k = np.zeros((c['blur'], c['blur']), np.float32); k[c['blur'] // 2, :] = 1 / c['blur']; fr = cv2.filter2D(fr, -1, k)
    noise = 7 if cast == 'dim' else 3
    fr = np.clip(fr.astype(np.float32) + rng.normal(0, noise, fr.shape), 0, 255).astype(np.uint8)
    if 'jpeg' in c: fr = cv2.imdecode(cv2.imencode('.jpg', fr, [cv2.IMWRITE_JPEG_QUALITY, c['jpeg']])[1], 1)
    t = {}
    for k, (x, y) in D.items():
        p = A @ np.array([x, y, 1.0]); t[k] = [float(p[0] / p[2]), float(p[1] / p[2])]
    truth.append(t); names.append(' '.join(f'{k}={v}' for k, v in c.items()))
    cv2.imwrite(f'/home/claude/ar/test/dots/f{i:03d}.png', fr)
json.dump({'W': W, 'H': H, 'frames': truth, 'names': names}, open('/home/claude/ar/test/dots/stress.json', 'w'))
print(len(cases))
