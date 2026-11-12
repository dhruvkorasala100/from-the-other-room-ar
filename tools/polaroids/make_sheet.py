# Letter landscape target sheet: book's front edge on the top line, fold on the arrow.
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
PW, PH = 279.4, 215.9
EDGE_Y = 14.0                 # book front edge line, mm from the sheet's top
T = dict(x=39.7, y=30.0, w=200.0, h=100.0)
cx = PW / 2
c = canvas.Canvas('/home/claude/pol/build/book-target.pdf', pagesize=(PW * mm, PH * mm))
X = lambda x: x * mm; Y = lambda y: (PH - y) * mm
c.setStrokeGray(0); c.setLineWidth(1.6); c.line(X(cx - 100), Y(EDGE_Y), X(cx + 100), Y(EDGE_Y))
p = c.beginPath(); p.moveTo(X(cx), Y(EDGE_Y + 1.2)); p.lineTo(X(cx - 3.5), Y(EDGE_Y + 7)); p.lineTo(X(cx + 3.5), Y(EDGE_Y + 7)); p.close()
c.setFillGray(0); c.drawPath(p, fill=1, stroke=0)
c.setFont('Helvetica', 7.5); c.setFillGray(.25)
c.drawString(X(cx + 7), Y(EDGE_Y + 6), 'centre fold of the book')
c.drawString(X(cx - 100), Y(EDGE_Y + 6), "Open book behind this line: its front edge sits on the line")
c.drawImage('/home/claude/ar/build/target_print.png', X(T['x']), Y(T['y'] + T['h']), T['w'] * mm, T['h'] * mm)
c.setFont('Helvetica-Bold', 7.5); c.setFillGray(.2); c.drawString(X(T['x']), Y(T['y'] + T['h'] + 9), 'PRINT AT 100% ("Actual size") ON US LETTER, LANDSCAPE')
c.setFont('Helvetica', 7); c.drawString(X(T['x']), Y(T['y'] + T['h'] + 14), 'Tape this sheet and the book to the table so neither moves. This bar should measure 50 mm:')
c.setLineWidth(1.2); y = T['y'] + T['h'] + 19; c.line(X(T['x']), Y(y), X(T['x'] + 50), Y(y))
for x in (T['x'], T['x'] + 50): c.line(X(x), Y(y - 2), X(x), Y(y + 2))
c.setFont('Helvetica', 6); c.setFillGray(.5); c.drawString(X(T['x']), Y(PH - 8), 'From the Other Room · polaroid prototype · target 200 × 100 mm, centre 66 mm in front of the book edge')
c.save(); print('ok')
