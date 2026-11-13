"""Presento logo, final build (extruded Brute P, magenta).
Run:  uv run --with shapely --with pillow python build.py
Outputs plain-path SVGs, PNGs, a multi-size .ico and animation/geom.json. No masks, no text.
"""
import json, os, struct, io
from shapely.geometry import Polygon, LineString, LinearRing, MultiPolygon, box
from shapely.ops import unary_union
from shapely import affinity
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = HERE
ANIM = os.path.join(HERE, "..", "animation")
os.makedirs(os.path.join(OUT, "png"), exist_ok=True)
os.makedirs(ANIM, exist_ok=True)

MAGENTA = "#FF3D7F"
PAPER = "#F3EEE9"
INK = "#161212"
TILE_TOP, TILE_BOT = "#2A2321", "#120F0E"
TILE_FLAT = "#1B1615"


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- mark geometry (64 grid)
FACE_OUT = [(13, 7), (45, 7), (45, 39), (29, 39), (29, 54), (13, 54)]
FACE_HOLE = [(29, 16), (38, 16), (38, 27), (29, 27)]
EXT = (6, 6)


def sweep(poly_pts, v):
    p = Polygon(poly_pts)
    parts = [p, affinity.translate(p, v[0], v[1])]
    n = len(poly_pts)
    for i in range(n):
        a, b = poly_pts[i], poly_pts[(i + 1) % n]
        parts.append(Polygon([a, b, (b[0] + v[0], b[1] + v[1]), (a[0] + v[0], a[1] + v[1])]).buffer(0))
    return unary_union(parts).buffer(0)


def clean(g):
    return g.buffer(0).simplify(0.001)


FACE = Polygon(FACE_OUT, [FACE_HOLE])
EXTR = clean(sweep(FACE_OUT, EXT))          # magenta silhouette (solid, goes under the face)
GAP = 2.2
EXTR_MONO = clean(EXTR.difference(FACE.buffer(GAP, join_style=2, mitre_limit=10)))  # same-ink version: gap instead of colour


# ---------------------------------------------------------------- wordmark geometry (34 high)
SW = 5.0
LETTERS = {
    "P": (13, 0, lambda x: [[(x, 30), (x, 3), (x + 13, 3), (x + 13, 17), (x, 17)]]),
    "r": (10, 0, lambda x: [[(x, 30), (x, 12.5), (x + 10, 12.5)]]),
    "e": (16, 0, lambda x: [[(x, 20), (x + 16, 20), (x + 16, 12.5), (x, 12.5), (x, 27.5), (x + 16, 27.5)]]),
    "s": (16, 0, lambda x: [[(x + 16, 12.5), (x, 12.5), (x, 20), (x + 16, 20), (x + 16, 27.5), (x, 27.5)]]),
    "n": (16, 0, lambda x: [[(x, 30), (x, 12.5), (x + 16, 12.5), (x + 16, 30)]]),
    "t": (11, 4, lambda x: [[(x, 3), (x, 27.5), (x + 11, 27.5)], [(x - 4, 12.5), (x + 10, 12.5)]]),
    "o": (16, 0, lambda x: [("ring", [(x, 12.5), (x + 16, 12.5), (x + 16, 27.5), (x, 27.5)])]),
}


FONT = os.path.join(HERE, "..", "..", "directions", "fonts", "space-grotesk-latin-600-normal.woff2")


def _quad(p0, p1, p2, n=16):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [k / n for k in range(1, n + 1)]]


def _cubic(p0, p1, p2, p3, n=20):
    out = []
    for k in range(1, n + 1):
        t = k / n
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out


def glyph_rings(font, ch):
    from fontTools.pens.recordingPen import DecomposingRecordingPen
    gs = font.getGlyphSet()
    name = font.getBestCmap()[ord(ch)]
    pen = DecomposingRecordingPen(gs)
    gs[name].draw(pen)
    rings, cur = [], []
    for op, args in pen.value:
        if op == "moveTo":
            cur = [args[0]]
        elif op == "lineTo":
            cur.append(args[0])
        elif op == "qCurveTo":
            pts = list(args)
            for k in range(len(pts) - 1):
                nxt = pts[k + 1] if k == len(pts) - 2 else ((pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2)
                cur += _quad(cur[-1], pts[k], nxt)
        elif op == "curveTo":
            cur += _cubic(cur[-1], args[0], args[1], args[2])
        elif op in ("closePath", "endPath"):
            rings.append(cur)
            cur = []
    return rings, font["hmtx"][name][0]


def build_word():
    """'Presento' in Space Grotesk 600, converted to outlines. Cap height 28, baseline y=30."""
    from fontTools.ttLib import TTFont
    font = TTFont(FONT)
    cap = getattr(font["OS/2"], "sCapHeight", 700) or 700
    k = 28.0 / cap
    x, geom, counter, letters = 4.0, Polygon(), None, []
    for ch in "Presento":
        rings, adv = glyph_rings(font, ch)
        polys = []
        for r in rings:
            pts = [(x + px * k, 30 - py * k) for px, py in r]
            polys.append(Polygon(pts).buffer(0))
        g = Polygon()
        for p in polys:
            g = g.symmetric_difference(p)
        geom = geom.union(g)
        letters.append(clean(g))
        if ch == "o":
            counter = min(polys, key=lambda p: p.area)
        x += adv * k
    return clean(geom), counter, x + 4, letters


WORD, COUNTER, WORD_W, LETTER_GEOMS = build_word()
WB = WORD.bounds  # (minx, miny, maxx, maxy)


# ---------------------------------------------------------------- svg helpers
def fmt(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def ring_d(coords):
    c = list(coords)[:-1]
    return "M" + "L".join("%s %s" % (fmt(x), fmt(y)) for x, y in c) + "Z"


def path_d(g):
    polys = [g] if isinstance(g, Polygon) else list(g.geoms)
    d = ""
    for p in polys:
        d += ring_d(p.exterior.coords)
        for i in p.interiors:
            d += ring_d(i.coords)
    return d


def svg_wrap(vb, body, extra=""):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" %s>%s</svg>\n' % (vb, extra, body)


def P(g, fill):
    return '<path fill="%s" fill-rule="evenodd" d="%s"/>' % (fill, path_d(g))


MARK_VB = "0 0 64 64"


def mark_body(face_fill, ext_fill, mono=False):
    ext = EXTR_MONO if mono else EXTR
    return P(ext, ext_fill) + P(FACE, face_fill)


def mark_tight_vb():
    b = unary_union([EXTR, FACE]).bounds
    return b


def wordmark_body(fill, counter_fill):
    return P(WORD, fill) + (P(COUNTER, counter_fill) if counter_fill else "")


WK = 1.15            # word scale in the lockup (mark units)
LOCK_GAP = 17
MB = mark_tight_vb()  # mark bounds, 13..51 x 7..60
WORD_X = MB[2] + LOCK_GAP - WB[0] * WK
WORD_Y = 33.5 - ((WB[1] + WB[3]) / 2) * WK


def lockup_body(face_fill, ext_fill, word_fill, counter_fill, mono=False):
    return mark_body(face_fill, ext_fill, mono) + '<g transform="translate(%s %s) scale(%s)">%s</g>' % (fmt(WORD_X), fmt(WORD_Y), WK, wordmark_body(word_fill, counter_fill))


LOCK_W = (WB[2] - WB[0]) * WK + LOCK_GAP + (MB[2] - MB[0])
LOCK_VB = "%s 0 %s 64" % (fmt(MB[0] - 8), fmt(LOCK_W + 16))
WORD_VB = "%s %s %s %s" % (fmt(WB[0] - 3), fmt(WB[1] - 3), fmt(WB[2] - WB[0] + 6), fmt(WB[3] - WB[1] + 6))


def write(name, text):
    with open(os.path.join(OUT, name), "w", encoding="utf8") as f:
        f.write(text)


def tile_svg():
    s = 256 / 64 * 0.92   # mark height 53 * 3 = 159 of 256
    s = 3.0
    tx, ty = 128 - 32 * s, 128 - 33.5 * s
    defs = '<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>' % (TILE_TOP, TILE_BOT)
    bg = '<rect x="2" y="2" width="252" height="252" rx="58" fill="url(#t)" stroke="#FFFFFF" stroke-opacity=".16" stroke-width="2"/>'
    return svg_wrap("0 0 256 256", defs + bg + '<g transform="translate(%s %s) scale(%s)">%s</g>' % (fmt(tx), fmt(ty), s, mark_body(PAPER, MAGENTA)), 'width="256" height="256"')


write("mark.svg", svg_wrap(MARK_VB, mark_body(PAPER, MAGENTA)))                    # for dark backgrounds
write("mark-on-light.svg", svg_wrap(MARK_VB, mark_body(INK, MAGENTA)))
write("mark-mono-white.svg", svg_wrap(MARK_VB, mark_body("#FFFFFF", "#FFFFFF", True)))
write("mark-mono-black.svg", svg_wrap(MARK_VB, mark_body("#000000", "#000000", True)))
write("app-icon.svg", tile_svg())
write("wordmark.svg", svg_wrap(WORD_VB, wordmark_body(PAPER, MAGENTA)))
write("wordmark-on-light.svg", svg_wrap(WORD_VB, wordmark_body(INK, MAGENTA)))
write("wordmark-mono-white.svg", svg_wrap(WORD_VB, P(WORD, "#FFFFFF")))
write("wordmark-mono-black.svg", svg_wrap(WORD_VB, P(WORD, "#000000")))
write("lockup.svg", svg_wrap(LOCK_VB, lockup_body(PAPER, MAGENTA, PAPER, MAGENTA)))
write("lockup-on-light.svg", svg_wrap(LOCK_VB, lockup_body(INK, MAGENTA, INK, MAGENTA)))
write("lockup-mono-white.svg", svg_wrap(LOCK_VB, lockup_body("#FFFFFF", "#FFFFFF", "#FFFFFF", None, True)))
write("lockup-mono-black.svg", svg_wrap(LOCK_VB, lockup_body("#000000", "#000000", "#000000", None, True)))


# ---------------------------------------------------------------- raster helpers
def colored(col, mask, alpha=255):
    """solid colour layer whose alpha is the mask (no dark fringe on transparent backgrounds)"""
    layer = Image.new("RGBA", mask.size, hexrgb(col) + (255,))
    if alpha != 255:
        mask = mask.point(lambda v: v * alpha // 255)
    layer.putalpha(mask)
    return layer


def raster(layers, vb, px_w, ss=6, bg=None):
    """layers: [(geom, '#hex')] in viewBox units. Returns RGBA image of width px_w."""
    x0, y0, w, h = vb
    px_h = round(px_w * h / w)
    W, H = px_w * ss, px_h * ss
    out = Image.new("RGBA", (px_w, px_h), bg or (0, 0, 0, 0))
    k = W / w
    for g, col in layers:
        m = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(m)
        polys = [g] if isinstance(g, Polygon) else list(g.geoms)
        for p in polys:
            d.polygon([((x - x0) * k, (y - y0) * k) for x, y in p.exterior.coords], fill=255)
            for i in p.interiors:
                d.polygon([((x - x0) * k, (y - y0) * k) for x, y in i.coords], fill=0)
        m = m.resize((px_w, px_h), Image.LANCZOS)
        out.alpha_composite(colored(col, m))
    return out


def tile_layers_vector(px):
    """app icon at px, drawn from vector geometry (used for 40 and up)."""
    ss = 4
    S = px * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    r = S * 58 / 256
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([S * 2 / 256, S * 2 / 256, S - S * 2 / 256, S - S * 2 / 256], r, fill=255)
    grad = Image.new("RGBA", (S, S))
    t, b = hexrgb(TILE_TOP), hexrgb(TILE_BOT)
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        f = y / (S - 1)
        gd.line([(0, y), (S, y)], fill=tuple(round(t[i] + (b[i] - t[i]) * f) for i in range(3)) + (255,))
    grad.putalpha(mask)
    img.alpha_composite(grad)
    edge = Image.new("L", (S, S), 0)
    ImageDraw.Draw(edge).rounded_rectangle([S * 2 / 256, S * 2 / 256, S - S * 2 / 256, S - S * 2 / 256], r, outline=255, width=max(1, round(S * 2 / 256)))
    img.alpha_composite(colored("#FFFFFF", edge, 41))
    s = 3.0 * S / 256
    # draw mark
    k = s
    tx, ty = S / 2 - 32 * k, S / 2 - 33.5 * k
    for g, col in [(EXTR, MAGENTA), (FACE, PAPER)]:
        m = Image.new("L", (S, S), 0)
        d = ImageDraw.Draw(m)
        for p in ([g] if isinstance(g, Polygon) else list(g.geoms)):
            d.polygon([(x * k + tx, y * k + ty) for x, y in p.exterior.coords], fill=255)
            for i in p.interiors:
                d.polygon([(x * k + tx, y * k + ty) for x, y in i.coords], fill=0)
        img.alpha_composite(colored(col, m))
    return img.resize((px, px), Image.LANCZOS)


# ---------------------------------------------------------------- hand-hinted small icons
# every coordinate is a whole pixel. face polygon, counter, extrusion depth, tile corner radius.
HINTED = {
    16: dict(face=[(3, 2), (10, 2), (10, 8), (6, 8), (6, 12), (3, 12)], hole=(6, 4, 8, 6), e=2, r=4),
    20: dict(face=[(4, 3), (14, 3), (14, 10), (8, 10), (8, 15), (4, 15)], hole=(8, 6, 12, 8), e=2, r=5),
    24: dict(face=[(4, 3), (16, 3), (16, 12), (9, 12), (9, 18), (4, 18)], hole=(9, 6, 13, 9), e=3, r=6),
    32: dict(face=[(6, 4), (22, 4), (22, 16), (12, 16), (12, 24), (6, 24)], hole=(12, 8, 18, 12), e=4, r=7),
}


def hinted_icon(px):
    cfg = HINTED[px]
    ss = 8
    S = px * ss
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], cfg["r"] * ss, fill=255)
    tile.alpha_composite(colored(TILE_FLAT, m))
    img = tile.resize((px, px), Image.LANCZOS)      # only the tile corners are anti-aliased
    face = Polygon(cfg["face"])
    e = cfg["e"]
    copies = [affinity.translate(face, dx, dy) for dx in range(1, e + 1) for dy in range(1, e + 1) if abs(dx - dy) <= 1]
    ext = unary_union(copies + [face])
    hx0, hy0, hx1, hy1 = cfg["hole"]
    hole = box(hx0, hy0, hx1, hy1)
    px_img = img.load()
    for y in range(px):
        for x in range(px):
            c = box(x, y, x + 1, y + 1).representative_point()
            if face.contains(c) and not hole.contains(c):
                px_img[x, y] = hexrgb(PAPER) + (255,)
            elif ext.contains(c):
                px_img[x, y] = hexrgb(MAGENTA) + (255,)
    return img


SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
icons = {}
for s in SIZES:
    icons[s] = hinted_icon(s) if s in HINTED else tile_layers_vector(s)
    icons[s].save(os.path.join(OUT, "png", "app-icon-%d.png" % s))
tile_layers_vector(512).save(os.path.join(OUT, "png", "app-icon-512.png"))
tile_layers_vector(1024).save(os.path.join(OUT, "png", "app-icon-1024.png"))


def write_ico(path, imgs):
    blobs = []
    for s in SIZES:
        b = io.BytesIO()
        imgs[s].save(b, "PNG")
        blobs.append(b.getvalue())
    head = struct.pack("<HHH", 0, 1, len(SIZES))
    offset = 6 + 16 * len(SIZES)
    ents, data = b"", b""
    for s, blob in zip(SIZES, blobs):
        ents += struct.pack("<BBBBHHII", 0 if s >= 256 else s, 0 if s >= 256 else s, 0, 0, 1, 32, len(blob), offset)
        data += blob
        offset += len(blob)
    with open(path, "wb") as f:
        f.write(head + ents + data)


write_ico(os.path.join(OUT, "presento.ico"), icons)

# ---------------------------------------------------------------- PNG exports
mb = MB
mark_vb = (mb[0] - 3, mb[1] - 3, mb[2] - mb[0] + 6, mb[3] - mb[1] + 6)
for name, ff, ef in [("mark", PAPER, MAGENTA), ("mark-on-light", INK, MAGENTA)]:
    for w in (512, 1024):
        raster([(EXTR, ef), (FACE, ff)], mark_vb, w).save(os.path.join(OUT, "png", "%s-%d.png" % (name, w)))
raster([(EXTR_MONO, "#FFFFFF"), (FACE, "#FFFFFF")], mark_vb, 1024).save(os.path.join(OUT, "png", "mark-mono-white-1024.png"))
raster([(EXTR_MONO, "#000000"), (FACE, "#000000")], mark_vb, 1024).save(os.path.join(OUT, "png", "mark-mono-black-1024.png"))
wvb = (WB[0] - 3, WB[1] - 3, WB[2] - WB[0] + 6, WB[3] - WB[1] + 6)
raster([(WORD, PAPER), (COUNTER, MAGENTA)], wvb, 1600).save(os.path.join(OUT, "png", "wordmark-1600.png"))
raster([(WORD, INK), (COUNTER, MAGENTA)], wvb, 1600).save(os.path.join(OUT, "png", "wordmark-on-light-1600.png"))
lvb = (MB[0] - 8, 0, LOCK_W + 16, 64)


def lock_layers(ff, ef, wf, cf, mono=False):
    tw = lambda g: affinity.translate(affinity.scale(g, WK, WK, origin=(0, 0)), WORD_X, WORD_Y)
    return [(EXTR_MONO if mono else EXTR, ef), (FACE, ff), (tw(WORD), wf)] + ([] if cf is None else [(tw(COUNTER), cf)])


raster(lock_layers(PAPER, MAGENTA, PAPER, MAGENTA), lvb, 1600).save(os.path.join(OUT, "png", "lockup-1600.png"))
raster(lock_layers(INK, MAGENTA, INK, MAGENTA), lvb, 1600).save(os.path.join(OUT, "png", "lockup-on-light-1600.png"))
raster(lock_layers("#FFFFFF", "#FFFFFF", "#FFFFFF", None, True), lvb, 1600).save(os.path.join(OUT, "png", "lockup-mono-white-1600.png"))
raster(lock_layers("#000000", "#000000", "#000000", None, True), lvb, 1600).save(os.path.join(OUT, "png", "lockup-mono-black-1600.png"))

# ---------------------------------------------------------------- hinting proof sheet (nearest-neighbour x8)
sheet = Image.new("RGBA", (1200, 600), (14, 11, 10, 255))
cx = 20
d = ImageDraw.Draw(sheet)
for s in (16, 20, 24, 32):
    hint = icons[s]
    scaled = tile_layers_vector(256).resize((s, s), Image.LANCZOS)  # what plain scaling gives
    sheet.paste(hint.resize((s * 8, s * 8), Image.NEAREST), (cx, 20), hint.resize((s * 8, s * 8), Image.NEAREST))
    sheet.paste(scaled.resize((s * 8, s * 8), Image.NEAREST), (cx, 40 + 32 * 8), scaled.resize((s * 8, s * 8), Image.NEAREST))
    d.text((cx, 4), "%d hinted" % s, fill=(200, 200, 200, 255))
    d.text((cx, 28 + 32 * 8), "%d scaled" % s, fill=(200, 200, 200, 255))
    cx += s * 8 + 16
sheet.crop((0, 0, cx + 4, 40 + 64 * 8 + 4)).save(os.path.join(OUT, "hinting-proof.png"))

# ---------------------------------------------------------------- geometry for the splash
json.dump({
    "magenta": MAGENTA, "paper": PAPER, "ink": INK,
    "ext_d": path_d(EXTR), "face_d": path_d(FACE), "face_solid_d": ring_d(Polygon(FACE_OUT).exterior.coords),
    "word_d": path_d(WORD), "counter_d": path_d(COUNTER), "letters_d": [path_d(l) for l in LETTER_GEOMS],
    "mark_bounds": list(MB), "word_x": WORD_X, "word_y": WORD_Y, "wk": WK,
    "lock_vb": [MB[0] - 8, 0, LOCK_W + 16, 64], "word_bounds": list(WB), "ext": list(EXT),
}, open(os.path.join(ANIM, "geom.json"), "w"))
print("ok", LOCK_VB, "mark bounds", [round(v, 2) for v in MB], "word w", round(WORD_W, 1))
