"""Captures splash.html frame by frame (deterministic seek), writes frames/, a contact sheet and a final-vs-static diff.
uv run --with playwright --with pillow python capture.py
"""
import os, sys, pathlib
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageChops

H = os.path.dirname(os.path.abspath(__file__))
FR = os.path.join(H, "frames")
os.makedirs(FR, exist_ok=True)
for f in os.listdir(FR):
    os.remove(os.path.join(FR, f))
W, HT, FPS, DUR, HOLD = 1920, 1080, 60, 4800, 300
url = pathlib.Path(os.path.join(H, "splash.html")).as_uri()
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
total = int((DUR + HOLD) / 1000 * FPS)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--disable-gpu"])
    pg = b.new_page(viewport={"width": W, "height": HT})
    pg.goto(url + "?freeze=1")
    pg.wait_for_timeout(300)
    for i in range(total):
        t = min(i * 1000 / FPS, DUR)
        pg.evaluate("ms => window.__seek(ms)", t)
        pg.screenshot(path=os.path.join(FR, "f%04d.png" % i))
    # exact static final for the no-jump check
    pg.goto(url + "?static=1")
    pg.wait_for_timeout(300)
    pg.screenshot(path=os.path.join(H, "static-final.png"))
    b.close()

last = Image.open(os.path.join(FR, "f%04d.png" % (total - 1))).convert("RGB")
stat = Image.open(os.path.join(H, "static-final.png")).convert("RGB")
diff = ImageChops.difference(last, stat)
bbox = diff.getbbox()
mx = max(diff.getextrema()[c][1] for c in range(3))
print("frames", total, "final-vs-static bbox", bbox, "max channel diff", mx)

# contact sheet: 12 frames across the timeline
times = [250, 550, 900, 1250, 1600, 2000, 2500, 3000, 3400, 3800, 4300, 4800]
cols, tw = 4, 480
th = int(tw * HT / W)
sheet = Image.new("RGB", (cols * tw, 3 * (th + 22)), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for n, t in enumerate(times):
    i = min(round(t * FPS / 1000), total - 1)
    im = Image.open(os.path.join(FR, "f%04d.png" % i)).convert("RGB").resize((tw, th), Image.LANCZOS)
    x, y = (n % cols) * tw, (n // cols) * (th + 22)
    sheet.paste(im, (x, y + 22))
    d.text((x + 8, y + 5), "%d ms" % t, fill=(220, 220, 220))
sheet.save(os.path.join(H, "contact-sheet.png"))
