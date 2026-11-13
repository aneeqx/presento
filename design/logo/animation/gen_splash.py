"""Generates splash.html from geom.json (written by ../final/build.py). Flat 2D, CSS only, no libraries, no text.
Motion is spring-based (CSS linear() easing sampled from a damped spring), so every pull overshoots and jiggles before it settles."""
import json, math, os
H = os.path.dirname(os.path.abspath(__file__))
g = json.load(open(os.path.join(H, "geom.json")))
U = 8
mb = g["mark_bounds"]                       # 13,7 .. 51,60
x0, _, LW, LH = g["lock_vb"]
mw, mh = (mb[2] - mb[0]) * U, (mb[3] - mb[1]) * U
mleft, mtop = (mb[0] - x0) * U, mb[1] * U
sw, sh = LW * U, LH * U
ext = g["ext"][0] * U
N = 40
TOTAL = 4800.0


def spring(zeta, n=90):
    """step response of a damped spring, settling (to 0.5 %) by t=1, as a CSS linear() easing"""
    w = math.log(200) / zeta
    wd = w * math.sqrt(1 - zeta * zeta)
    pts = []
    for k in range(n + 1):
        t = k / n
        y = 1 - math.exp(-zeta * w * t) * (math.cos(wd * t) + (zeta * w / wd) * math.sin(wd * t))
        pts.append(1.0 if k == n else y)
    return "linear(" + ",".join("%.4f" % p for p in pts) + ")"


JIG = spring(0.28)       # loose, jelly
MID = spring(0.38)
SOFT = spring(0.55)
HOLD = "steps(1,end)"
EASE = "cubic-bezier(.22,1,.36,1)"


def pct(ms):
    return "%.3f%%" % (ms / TOTAL * 100)


def kf(name, frames):
    """frames: [(ms, 'css props', 'easing of the segment that starts here')]"""
    out = "@keyframes %s{\n" % name
    for ms, props, ease in frames:
        out += "  %s{%s%s}\n" % (pct(ms), props, (";animation-timing-function:" + ease) if ease else "")
    return out + "}\n"


def rect(cls, x, y, w, h, origin):
    return '<i class="p %s" style="left:%spx;top:%spx;width:%spx;height:%spx;transform-origin:%s"></i>' % (cls, (x - mb[0]) * U, (y - mb[1]) * U, w * U, h * U, origin)


pieces = (rect("stem", 13, 7, 16, 47, "0 100%") +
          rect("block", 28, 7, 17, 32, "0 50%") +                 # the whole square is stretched out to the right
          rect("h punch", 29, 16, 9, 11, "50% 50%"))              # then the square hole is punched through it
layers = "".join('<svg class="L" style="--i:%.4f" viewBox="%s %s %s %s"><path d="%s"/></svg>' % ((i + 1) / N, mb[0], mb[1], mb[2] - mb[0], mb[3] - mb[1], g["face_solid_d"]) for i in range(N))
vb = "%s %s %s %s" % (mb[0], mb[1], mb[2] - mb[0], mb[3] - mb[1])
pw, ph = 8 / 16.0, 8 / 47.0                 # the first pixel is 8x8 units

# ---- timeline (ms). segments overlap a little so it flows instead of stopping between moves
POP = (100, 360)
SX = (420, 700)
SY = (700, 1150)
BLOCK = (1050, 1420)
PUNCH = (1400, 1760)
FACE_DONE = 1850
EXX = (1850, 2650)          # the extrusion is the slow part
EXY = (2300, 3100)
JELLY = (3100, 3750)
SWAP = 3180
SHIFT = (3150, 3900)
LET0, LETSTEP, LETDUR = 3300, 65, 760
CNT0, CNTDUR = 4180, 560

S = lambda a, b: "scale(%.4f,%.4f)" % (a, b)
css_kf = ""
css_kf += kf("stem", [
    (0, "opacity:0;transform:" + S(0, 0), HOLD),
    (POP[0] - 1, "opacity:0;transform:" + S(0, 0), HOLD),
    (POP[0], "opacity:1;transform:" + S(0, 0), JIG),
    (POP[1], "opacity:1;transform:" + S(pw, ph), HOLD),
    (SX[0], "opacity:1;transform:" + S(pw, ph), JIG),
    (SX[1], "opacity:1;transform:" + S(1, ph), JIG),
    (SY[1], "opacity:1;transform:" + S(1, 1), ""),
    (TOTAL, "opacity:1;transform:" + S(1, 1), ""),
])
for nm, seg, a, b, ease in [("block", BLOCK, S(0, 1), S(1, 1), JIG), ("punch", PUNCH, S(0, 0), S(1, 1), JIG)]:
    css_kf += kf(nm, [
        (0, "opacity:0;transform:" + a, HOLD),
        (seg[0] - 1, "opacity:0;transform:" + a, HOLD),
        (seg[0], "opacity:1;transform:" + a, ease),
        (seg[1], "opacity:1;transform:" + b, ""),
        (TOTAL, "opacity:1;transform:" + b, ""),
    ])
css_kf += kf("piecesOut", [(0, "opacity:1", HOLD), (FACE_DONE, "opacity:0", ""), (TOTAL, "opacity:0", "")])
css_kf += kf("faceIn", [(0, "opacity:0", HOLD), (FACE_DONE, "opacity:1", ""), (TOTAL, "opacity:1", "")])
# extrusion: pulled out along X, then along Y, each with its own spring (two custom properties on two elements)
css_kf += kf("extX", [(0, "--kx:0", HOLD), (EXX[0], "--kx:0", JIG), (EXX[1], "--kx:1", ""), (TOTAL, "--kx:1", "")])
css_kf += kf("extY", [(0, "--ky:0", HOLD), (EXY[0], "--ky:0", JIG), (EXY[1], "--ky:1", ""), (TOTAL, "--ky:1", "")])
css_kf += kf("layersVis", [(0, "opacity:0", HOLD), (FACE_DONE, "opacity:1", HOLD), (SWAP, "opacity:0", ""), (TOTAL, "opacity:0", "")])
css_kf += kf("sweepVis", [(0, "opacity:0", HOLD), (SWAP, "opacity:1", ""), (TOTAL, "opacity:1", "")])
# when the extrusion lands the whole mark squashes and wobbles back
css_kf += kf("jelly", [(0, "transform:scale(1,1)", HOLD), (JELLY[0], "transform:scale(1.07,.93)", JIG), (JELLY[1], "transform:scale(1,1)", ""), (TOTAL, "transform:scale(1,1)", "")])
shx = int(sw / 2 - (mleft + mw / 2))
css_kf += kf("shift", [
    (0, "transform:scale(1.9) translateX(%dpx)" % shx, HOLD),
    (SHIFT[0], "transform:scale(1.9) translateX(%dpx)" % shx, SOFT),
    (SHIFT[1], "transform:scale(1) translateX(0)", ""),
    (TOTAL, "transform:scale(1) translateX(0)", ""),
])
css_kf += ("@keyframes letter{0%{opacity:0;transform:scale(1,.04);animation-timing-function:" + JIG + "}100%{opacity:1;transform:scale(1,1)}}") + chr(10)
css_kf += ("@keyframes punchc{0%{transform:scale(0);animation-timing-function:" + JIG + "}100%{transform:scale(1)}}") + chr(10)

D = "%dms linear both" % TOTAL
html = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Presento launch splash</title>
<style>
/* Presento launch splash. Flat 2D, CSS only, no libraries, no text.
   One square pixel is stretched and pulled out into the P, then extruded in magenta; every pull is a loose spring.
   ?loop=1 repeats for review, ?static=1 shows the final logo, ?freeze=1 pauses for frame capture. */
@property --kx{syntax:'<number>';inherits:true;initial-value:1}
@property --ky{syntax:'<number>';inherits:true;initial-value:1}
:root{--mag:%(mag)s;--paper:%(paper)s;--bg:#0E0B0A}
*{box-sizing:border-box}
html,body{margin:0;height:100%%;background:var(--bg);overflow:hidden}
.fit{position:absolute;left:50%%;top:50%%;width:%(sw)spx;height:%(sh)spx;transform:translate(-50%%,-50%%) scale(var(--s,1))}
.shift{position:absolute;inset:0}
.mk{position:absolute;left:%(mleft)spx;top:%(mtop)spx;width:%(mw)spx;height:%(mh)spx;transform-origin:50%% 100%%}
.mk>*{position:absolute;left:0;top:0}
.p{position:absolute;display:block;background:var(--paper)}.p.h{background:var(--bg)}
.pieces{inset:0;width:100%%;height:100%%}
.L,.S,.F{width:%(mw)spx;height:%(mh)spx;overflow:visible}
.L path,.S path{fill:var(--mag)}
.L{position:absolute;left:0;top:0;transform:translate(calc(var(--i) * var(--kx) * %(ext)spx),calc(var(--i) * var(--ky) * %(ext)spx))}
.F path{fill:var(--paper);fill-rule:evenodd}
.layers{opacity:0}.S{opacity:0}.F{opacity:0}
.word{position:absolute;inset:0;width:100%%;height:100%%;overflow:visible}
.word .l,.word .c{transform-box:fill-box;transform-origin:50%% 100%%}.word .c{transform-origin:50%% 50%%}
.word path{fill:var(--paper)}.word .c{fill:var(--mag)}
.done .mk{transform:scale(1,1)}.done .shift{transform:scale(1) translateX(0)}
.done .layers{opacity:0}.done .S,.done .F{opacity:1}.done .pieces{opacity:0}

.play .shift{animation:shift %(D)s}
.play .mk{animation:extX %(D)s,jelly %(D)s}
.play .layers{animation:extY %(D)s,layersVis %(D)s}
.play .pieces{animation:piecesOut %(D)s}
.play .stem{animation:stem %(D)s}.play .block{animation:block %(D)s}.play .punch{animation:punch %(D)s}
.play .F{animation:faceIn %(D)s}
.play .S{animation:sweepVis %(D)s}
.play .word .l{animation:letter %(LD)sms linear both;animation-delay:calc(var(--n) * %(LS)sms + %(L0)sms)}
.play .word .c{animation:punchc %(CD)sms linear both;animation-delay:%(C0)sms}
.freeze *{animation-play-state:paused !important}
@media (prefers-reduced-motion:reduce){.play *{animation:none !important}.S,.F{opacity:1}.pieces{opacity:0}.word{clip-path:none}}
%(css_kf)s
</style></head>
<body>
<div class="fit" id="fit"><div class="shift">
  <div class="mk">
    <div class="layers">%(layers)s</div>
    <svg class="S" viewBox="%(vb)s"><path d="%(ext_d)s"/></svg>
    <div class="pieces">%(pieces)s</div>
    <svg class="F" viewBox="%(vb)s"><path d="%(face_d)s"/></svg>
  </div>
  <svg class="word" viewBox="%(lvb)s"><g transform="translate(%(wx).3f %(wy).3f) scale(%(wk)s)">%(letters)s<path class="c" d="%(counter_d)s"/></g></svg>
</div></div>
<script>
(function () {
  var q = new URLSearchParams(location.search), fit = document.getElementById("fit"), root = document.documentElement;
  function size() { var s = Math.min(innerWidth * 0.72 / %(sw)s, innerHeight * 0.6 / %(sh)s); fit.style.setProperty("--s", s); }
  size(); addEventListener("resize", size);
  var loop = q.get("loop") === "1";
  if (q.get("static") === "1") { root.classList.add("done"); return; }
  function run() {
    root.classList.remove("play"); void root.offsetWidth; root.classList.add("play");
    var a = document.getAnimations().filter(function (x) { return x.animationName === "shift"; })[0];
    if (a && a.finished) a.finished.then(function () { if (loop) setTimeout(run, 1000); }).catch(function () {});
  }
  if (q.get("freeze") === "1") {
    root.classList.add("play", "freeze");
    window.__seek = function (ms) { document.getAnimations().forEach(function (a) { a.pause(); a.currentTime = ms; }); };
  } else run();
})();
</script>
</body></html>
""" % dict(mag=g["magenta"], paper=g["paper"], sw=sw, sh=sh, mleft=mleft, mtop=mtop, mw=mw, mh=mh, ext=ext, layers=layers, pieces=pieces, vb=vb,
           ext_d=g["ext_d"], face_d=g["face_d"], lvb="%s 0 %s %s" % (x0, LW, LH), wx=g["word_x"], wy=g["word_y"], wk=g["wk"],
           letters="".join('<path class="l" style="--n:%d" d="%s"/>' % (i, d) for i, d in enumerate(g["letters_d"])), counter_d=g["counter_d"], css_kf=css_kf, D=D, LD=LETDUR, LS=LETSTEP, L0=LET0, CD=CNTDUR, C0=CNT0)
open(os.path.join(H, "splash.html"), "w", encoding="utf8").write(html)
print("splash.html", len(html) // 1024, "KB")
