# Feature-rich, non-repeating tracking image: ink-like marks, high contrast, many corners.
import random, math
from PIL import Image, ImageDraw, ImageFilter
random.seed(11)
W_MM, H_MM, DPI = 160, 80, 300
W, H = round(W_MM/25.4*DPI), round(H_MM/25.4*DPI)
im = Image.new('L', (W, H), 255); d = ImageDraw.Draw(im)
def rp(): return (random.uniform(0, W), random.uniform(0, H))
# big soft-edged blocks in mid greys
for _ in range(26):
    x, y = rp(); w, h = random.uniform(60, 320), random.uniform(40, 260)
    a = random.uniform(0, math.pi)
    pts = [(x+math.cos(a+t)*w*(0.6+random.random()*0.5), y+math.sin(a+t)*h*(0.6+random.random()*0.5)) for t in [0, 1.7, 3.1, 4.6]]
    d.polygon(pts, fill=random.choice([40, 90, 150, 200]))
# brush-like strokes
for _ in range(70):
    x, y = rp(); n = random.randint(3, 7); pts = [(x, y)]
    for _ in range(n):
        x += random.uniform(-160, 160); y += random.uniform(-110, 110); pts.append((x, y))
    d.line(pts, fill=random.choice([0, 0, 30, 255]), width=random.randint(4, 26), joint='curve')
# scattered dots, triangles, rings
for _ in range(260):
    x, y = rp(); r = random.uniform(4, 34); k = random.random()
    c = random.choice([0, 0, 0, 255, 60])
    if k < .4: d.ellipse([x-r, y-r, x+r, y+r], fill=c)
    elif k < .75: d.polygon([(x+r*math.cos(t), y+r*math.sin(t)) for t in [random.uniform(0, 6.28) for _ in range(3)]], fill=c)
    else: d.ellipse([x-r, y-r, x+r, y+r], outline=c, width=max(3, int(r/4)))
# hatching patches with varied angles
for _ in range(16):
    cx, cy = rp(); s = random.uniform(70, 180); a = random.uniform(0, math.pi); gap = random.uniform(9, 20)
    for i in range(int(s/gap)):
        o = -s/2 + i*gap
        p0 = (cx + o*math.cos(a+1.57) - s/2*math.cos(a), cy + o*math.sin(a+1.57) - s/2*math.sin(a))
        p1 = (cx + o*math.cos(a+1.57) + s/2*math.cos(a), cy + o*math.sin(a+1.57) + s/2*math.sin(a))
        d.line([p0, p1], fill=0, width=4)
im = im.filter(ImageFilter.UnsharpMask(2, 120, 2))
# solid frame so the edge is unambiguous
fw = 24; d = ImageDraw.Draw(im); d.rectangle([0, 0, W-1, H-1], outline=0, width=fw)
im.save('/home/claude/ar/build/target_print.png', dpi=(DPI, DPI))
sm = im.copy(); sm.thumbnail((1000, 1000)); sm.convert('RGB').save('/home/claude/ar/build/target.jpg', quality=95)
print(W, H, sm.size)
