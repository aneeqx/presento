"""Takes the README screenshots from generated placeholder content only (tests/fixtures.js). uv run --with playwright --with pillow python tests/screenshots.py"""
import os, sys, json, asyncio, tempfile, shutil, subprocess, time, io
sys.path.insert(0, os.path.dirname(__file__))
from app_lib import launch, connect, async_playwright
from PIL import Image
OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "screenshots")
async def main():
    os.makedirs(OUT, exist_ok=True)
    # a neutral working folder so no user name or temp path shows up in the screenshots (override with PRESENTO_SHOTS_DIR)
    tmp = os.environ.get("PRESENTO_SHOTS_DIR") or os.path.join(os.path.splitdrive(os.getcwd())[0] + os.sep, "Presento Sample")
    shutil.rmtree(tmp, ignore_errors=True); root = os.path.join(tmp, "projects"); os.makedirs(root)
    subprocess.run(["node", "-e", "require(%s).make(%s, 'Sample Studio')" % (json.dumps(os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures.js")), json.dumps(os.path.join(root, "sample-studio")))], check=True)
    p = launch(root, os.path.join(tmp, "data"), os.path.join(tmp, "exports"))
    try:
        async with async_playwright() as pw:
            b, pg = await connect(pw); await pg.set_viewport_size({"width": 1600, "height": 940})
            async def until(expr, t=60):
                t0 = time.time()
                while time.time() - t0 < t:
                    if await pg.evaluate("!!(" + expr + ")"): return
                    await pg.wait_for_timeout(250)
                raise TimeoutError(expr)
            async def shot(name, wait=900):
                await pg.wait_for_timeout(wait); png = await pg.screenshot(); im = Image.open(io.BytesIO(png)).convert("RGB")
                im = im.resize((1120, 658), Image.LANCZOS).quantize(colors=160, method=Image.MEDIANCUT, dither=Image.NONE); im.save(os.path.join(OUT, name + ".png"), optimize=True)
            await pg.wait_for_timeout(1500); await shot("projects")
            await pg.evaluate("document.querySelector('[data-act=open-project]').click()"); await until("A.S.screen==='content'"); await shot("content")
            await pg.evaluate("A.S.sel={sec:'panoramas',sub:null,item:0}; A.render()"); await pg.wait_for_timeout(2500); await shot("panorama-editor", 1200)
            await pg.evaluate("A.S.sel={sec:'book',sub:null,item:0}; A.render()"); await shot("flipbook-editor")
            await pg.evaluate("A.S.screen='look'; A.S.dialog=null; A.render()"); await pg.wait_for_timeout(4500); await shot("look", 1500)
            await pg.evaluate("A.S.screen='content'; A.S.sel={sec:'gallery',sub:null,item:null}; A.render(); document.querySelector('[data-act=export]').click()"); await until("A.S.dialog&&A.S.dialog.est"); await shot("export")
            await b.close()
    finally: p.kill(); shutil.rmtree(tmp, ignore_errors=True)
asyncio.run(main())
