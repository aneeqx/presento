"""Builds final/preview-sheet.png: every deliverable on dark and light, plus an .ico read-back."""
import os
from PIL import Image, ImageDraw
H = os.path.dirname(os.path.abspath(__file__))
P = lambda n: Image.open(os.path.join(H, "png", n)).convert("RGBA")
W, Ht = 1600, 1500
sheet = Image.new("RGBA", (W, Ht), (14, 11, 10, 255))
d = ImageDraw.Draw(sheet)


def put(img, x, y, w, bg=None):
    r = img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
    if bg:
        d.rectangle([x - 20, y - 20, x + w + 20, y + r.height + 20], fill=bg)
    sheet.alpha_composite(r, (x, y))
    return r.height


y = 40
h = put(P("lockup-1600.png"), 40, y, 700, (27, 22, 21, 255))
put(P("lockup-on-light-1600.png"), 840, y, 700, (243, 238, 233, 255))
y += h + 60
h = put(P("lockup-mono-white-1600.png"), 40, y, 700, (27, 22, 21, 255))
put(P("lockup-mono-black-1600.png"), 840, y, 700, (243, 238, 233, 255))
y += h + 60
x = 40
for n, bg in [("mark-1024.png", (27, 22, 21, 255)), ("mark-on-light-1024.png", (243, 238, 233, 255)), ("mark-mono-white-1024.png", (27, 22, 21, 255)), ("mark-mono-black-1024.png", (243, 238, 233, 255))]:
    put(P(n), x, y, 230, bg)
    x += 290
x = 40
y += 330
ico = Image.open(os.path.join(H, "presento.ico"))
sizes = sorted(ico.info.get("sizes", []))
d.text((40, y - 22), "presento.ico read back, sizes: %s" % sizes, fill=(200, 200, 200, 255))
for s in (16, 20, 24, 32, 40, 48, 64, 128):
    ico.size = (s, s)
    im = ico.convert("RGBA")
    big = im.resize((s * 3, s * 3), Image.NEAREST) if s <= 48 else im
    sheet.alpha_composite(big, (x, y))
    x += big.width + 24
sheet.convert("RGB").save(os.path.join(H, "preview-sheet.png"))
print(sizes)
