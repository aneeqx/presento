"""Drives the real app (Electron) over CDP: new project, add a section, import generated images, flipbook section shows the add-on notice, preview, export.
Needs: npm install in app/, `uv run --with playwright python tests/app_smoke.py`.  Everything lives in a temp folder."""
import os, sys, json, asyncio, tempfile, subprocess, time
sys.path.insert(0, os.path.dirname(__file__))
from app_lib import launch, connect, async_playwright
async def main():
    tmp = tempfile.mkdtemp(prefix="presento-app-")
    subprocess.run(["node", os.path.join(os.path.dirname(__file__), "fixtures.js"), os.path.join(tmp, "fx")], check=True)
    root = os.path.join(tmp, "projects"); os.makedirs(root)
    p = launch(root, os.path.join(tmp, "data"), os.path.join(tmp, "exports"))
    try:
        async with async_playwright() as pw:
            b, pg = await connect(pw); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.set_viewport_size({"width": 1600, "height": 940})
            async def until(expr, t=60):
                t0 = time.time()
                while time.time() - t0 < t:
                    if await pg.evaluate("!!(" + expr + ")"): return
                    await pg.wait_for_timeout(250)
                raise TimeoutError(expr)
            await pg.click("[data-act=new-project]"); await pg.fill("#np-name", "Smoke Test"); await pg.click("[data-act=np-kind][data-v=blank]"); await pg.click("[data-act=np-create]"); await until("A.S.screen==='content'")
            await pg.click("[data-act=add-section]"); await pg.fill('[data-bind="sec.title"]', "Images")
            fx = os.path.join(tmp, "fx", "media", "gallery")
            await pg.evaluate("A.startImport(%s)" % json.dumps([os.path.join(fx, f) for f in sorted(os.listdir(fx))])); await pg.wait_for_timeout(400); await until("!A.S.importing", 60)
            n = await pg.evaluate("A.curLeaf().items.length"); print("imported images:", n); assert n == 6
            await pg.click("[data-act=add-section]"); await pg.fill('[data-bind="sec.title"]', "Book"); await pg.click("[data-act=set-type][data-v=flipbook]"); await pg.wait_for_timeout(500)
            notice = await pg.evaluate("document.body.innerText.includes('Flipbook engine not installed')"); print("flipbook add-on notice shown:", notice)
            assert notice == (not await pg.evaluate("A.S.info.flipbookAddon"))
            r = await pg.evaluate("api.publishPreview({dir: A.S.dir, mode: 'desktop', token: 't'}).then(r => r.url)"); print("preview served at", r)
            ex = await pg.evaluate("api.runExport({dir: A.S.dir, format: 'zip', mode: 'desktop', pin: null, include: null, outDir: %s, zip: false, browser: false}).then(r => r.check.ok)" % json.dumps(os.path.join(tmp, "exports"))); print("zip export checks ok:", ex); assert ex
            print("page errors:", errs); assert not errs
            await b.close()
    finally: p.kill()
asyncio.run(main())
