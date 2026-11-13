"""Helpers to launch the real Presento (Electron) and drive it with Playwright over CDP."""
import os, subprocess, time, urllib.request, asyncio, shutil
from playwright.async_api import async_playwright
APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app")
ELECTRON = os.path.join(APP, "node_modules", "electron", "dist", "electron.exe")
PORT = 9400

def launch(root, data, exports, splash=False):
    env = dict(os.environ, PRESENTO_NOSPLASH="" if splash else "1", PRESENTO_CDP=str(PORT), PRESENTO_DATA=data, PRESENTO_ROOT=root, PRESENTO_EXPORTS=exports)
    env.pop("ELECTRON_RUN_AS_NODE", None)
    p = subprocess.Popen([ELECTRON, APP], env=env, cwd=APP)
    for _ in range(80):
        try: urllib.request.urlopen("http://127.0.0.1:%d/json/version" % PORT, timeout=1); return p
        except Exception: time.sleep(.5)
    p.kill(); raise RuntimeError("Electron did not start")

async def connect(pw):
    b = await pw.chromium.connect_over_cdp("http://127.0.0.1:%d" % PORT)
    ctx = b.contexts[0]
    pg = ctx.pages[0]
    for _ in range(60):
        if await pg.evaluate("!!window.__ready"): break
        await asyncio.sleep(.5)
    return b, pg
