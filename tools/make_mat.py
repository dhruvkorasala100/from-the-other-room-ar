# Letter landscape placement mat. All units mm; layout shared with the AR page.
import json
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
L = dict(page=[279.4, 215.9], card=dict(w=190.5, d=104.8, x=44.45, y=9.0),
         target=dict(w=160.0, h=80.0, x=59.7, y=120.8), cornerFromCardFront=31.7)
json.dump(L, open('/home/claude/ar/build/layout.json', 'w'), indent=1)
PW, PH = L['page']; c = canvas.Canvas('/home/claude/ar/build/placement-mat.pdf', pagesize=(PW*mm, PH*mm))
Y = lambda y: (PH - y) * mm      # top-down mm -> PDF points
X = lambda x: x * mm
cd, t = L['card'], L['target']
# card outline (light) and bold corner marks just outside it
c.setStrokeGray(0.75); c.setLineWidth(0.4); c.setDash(2, 2)
c.rect(X(cd['x']), Y(cd['y'] + cd['d']), cd['w']*mm, cd['d']*mm); c.setDash()
c.setStrokeGray(0); c.setLineWidth(1.4); g, leg = 1.2, 12
for cx, sx in ((cd['x'], -1), (cd['x'] + cd['w'], 1)):
    for cy, sy in ((cd['y'], -1), (cd['y'] + cd['d'], 1)):
        ox, oy = cx + sx*g, cy + sy*g
        c.line(X(ox), Y(oy), X(ox - sx*leg), Y(oy)); c.line(X(ox), Y(oy), X(ox), Y(oy - sy*leg))
# fold ticks above and below the card on the centre line
fx = cd['x'] + cd['w']/2; c.setLineWidth(1.4)
c.line(X(fx), Y(cd['y'] - 1.5), X(fx), Y(cd['y'] - 4.5))
c.line(X(fx), Y(cd['y'] + cd['d'] + 1.2), X(fx), Y(cd['y'] + cd['d'] + 5.8))
c.setFont('Helvetica', 7); c.setFillGray(0.55)
c.drawCentredString(X(fx), Y(cd['y'] + cd['d']/2 - 6), 'POP-UP CARD GOES HERE, OPENED FLAT')
c.drawCentredString(X(fx), Y(cd['y'] + cd['d']/2), 'centre fold on the tick marks, house front corner toward the image')
c.drawCentredString(X(fx), Y(cd['y'] + cd['d']/2 + 6), 'tape the two outer edges of the card down')
# tracking image at exact size
c.drawImage('/home/claude/ar/build/target_print.png', X(t['x']), Y(t['y'] + t['h']), t['w']*mm, t['h']*mm)
# side notes + scale check
c.setFillGray(0.2); c.setFont('Helvetica-Bold', 7.5)
c.drawString(X(8), Y(128), 'PRINT AT 100%'); c.setFont('Helvetica', 6.6)
for i, s in enumerate(['"Actual size", not', '"Fit to page".', '', 'This bar should', 'measure 40 mm:']):
    c.drawString(X(8), Y(134 + i*4.2), s)
c.setLineWidth(1.2); c.line(X(8), Y(158), X(48), Y(158))
for x in (8, 48): c.line(X(x), Y(156), X(x), Y(160))
c.setFont('Helvetica-Bold', 7.5); c.drawString(X(224), Y(128), 'VIEWER SIDE')
c.setFont('Helvetica', 6.6)
for i, s in enumerate(['Stand on this side.', 'Keep the image flat,', 'uncreased and fully', 'in view of the', 'camera.']):
    c.drawString(X(224), Y(134 + i*4.2), s)
c.setFont('Helvetica', 6); c.setFillGray(0.5)
c.drawString(X(8), Y(209), 'From the Other Room  ·  AR placement mat v1  ·  target 160 × 80 mm')
c.save(); print('ok')
