# Artwork base: IMG_6944 rotated 180°, letter portrait, card on the back half,
# front strip = MindAR tracking target.
import json
from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
PW, PH, DPI = 215.9, 279.4, 300
px = DPI / 25.4
L = dict(page=[PW, PH],
         card=dict(w=190.5, d=104.8, x=(PW - 190.5) / 2, y=8.0),
         target=dict(x=8.0, y=118.0, w=200.0, h=150.0),
         cornerFromCardFront=31.7,
         line=dict(cardEdge=[119.5, 112.8], front=[99.0, 205.0]))   # printed black line, page mm
cd, t = L['card'], L['target']
L['houseCorner'] = [cd['x'] + cd['w'] / 2, cd['y'] + cd['d'] - L['cornerFromCardFront']]
json.dump(L, open('/home/claude/ar/base/layout.json', 'w'), indent=1)

art = Image.open('/home/claude/ar/base/print_rot180.png').convert('RGB')      # 2550 x 3300 = full page at 300 dpi
art.save('/home/claude/ar/base/base_art.jpg', quality=92)
tg = art.crop((round(t['x'] * px), round(t['y'] * px), round((t['x'] + t['w']) * px), round((t['y'] + t['h']) * px)))
tg.save('/home/claude/ar/base/target_full.png')
sm = tg.copy(); sm.thumbnail((1000, 1000)); sm.save('/home/claude/ar/base/target.jpg', quality=95)
# smaller copy of the whole page for textures in the AR page
tex = art.copy(); tex.thumbnail((1024, 1024)); tex.save('/home/claude/ar/base/art-texture.jpg', quality=88)

c = canvas.Canvas('/home/claude/ar/base/artwork-base.pdf', pagesize=(PW * mm, PH * mm))
c.drawImage('/home/claude/ar/base/base_art.jpg', 0, 0, PW * mm, PH * mm)
X = lambda x: x * mm; Y = lambda y: (PH - y) * mm
def tick(x0, y0, x1, y1):           # white line with a dark edge so it reads on any part of the artwork
    c.setStrokeColorRGB(0, 0, 0); c.setLineWidth(2.6); c.line(X(x0), Y(y0), X(x1), Y(y1))
    c.setStrokeColorRGB(1, 1, 1); c.setLineWidth(1.2); c.line(X(x0), Y(y0), X(x1), Y(y1))
g, leg = 1.0, 8
for cx, sx in ((cd['x'], -1), (cd['x'] + cd['w'], 1)):
    for cy, sy in ((cd['y'], -1), (cd['y'] + cd['d'], 1)):
        ox, oy = cx + sx * g, cy + sy * g
        tick(ox, oy, ox - sx * leg, oy); tick(ox, oy, ox, oy - sy * leg)
fx = cd['x'] + cd['w'] / 2
tick(fx, cd['y'] + cd['d'] + 1.2, fx, cd['y'] + cd['d'] + 5.5)
c.save()
print(L['houseCorner'], tg.size)
