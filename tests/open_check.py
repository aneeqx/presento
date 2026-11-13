"""Opens a finished export in a real browser, passes the PIN gate if any, walks every section, and reports page errors / broken images / failed requests.
uv run --with playwright python tests/open_check.py <zip|html|exe> <path> <pin|-> [--shots dir]
Prints one JSON line: {"ok": bool, "detail": "..."}.   exe: launched with --windowed and driven over CDP (WebView2 remote debugging).
"""
import asyncio, json, os, pathlib, subprocess, sys, tempfile, zipfile, shutil, time, urllib.request
from playwright.async_api import async_playwright

CHROME = os.environ.get("PROOF_BROWSER", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
KIND, PATH, PIN = sys.argv[1], sys.argv[2], sys.argv[3]
SHOTS = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None

JS_WALK = """async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const idle = async () => { for (let i = 0; i < 400 && BS.router.busy; i++) await wait(100); await wait(900); };
  const out = {sections: [], broken: []};
  const ids = [...document.querySelectorAll('.page.home .tile')].map(t => t.dataset.id);
  for (const id of ids) {
    BS.router.go(id, {}); await wait(300); await idle();
    const chips = document.querySelectorAll('.page .chip');
    const rec = {id, chips: chips.length, items: 0};
    const count = () => document.querySelectorAll('.page .m-item, .page .vcard, .page .ptcard, .page .pf-card, .page .sg-item').length;
    rec.items = count();
    for (let i = 0; i < chips.length; i++) { document.querySelectorAll('.page .chip')[i].click(); await wait(2200); rec.items += count(); }
    for (const im of document.querySelectorAll('.page img')) if (im.complete && im.naturalWidth === 0) out.broken.push(id + ':' + (im.getAttribute('src') || '').slice(-60));
    out.sections.push(rec);
    BS.router.home(); await wait(300); await idle();
  }
  return out;
}"""


async def drive(pg, errs):
    vp = await pg.evaluate("[innerWidth, innerHeight]"); w, h = vp[0], vp[1]
    await pg.wait_for_timeout(1200)
    if PIN != "-":
        await pg.wait_for_selector("#pin-gate", timeout=20000)
        for d in PIN:
            await pg.keyboard.press(d)
        await pg.wait_for_selector("#pin-gate", state="detached", timeout=20000)
    await pg.mouse.click(w / 2, h / 2)                           # viewer start gate
    await pg.wait_for_function("window.BS && BS.router", timeout=30000)
    for _ in range(80):                                           # attract screen needs a tap; no-attract goes straight to home
        if await pg.evaluate("BS.router.current && BS.router.current.id === 'home' && !BS.router.busy"):
            break
        if await pg.evaluate("document.body.classList.contains('in-attract') || !!document.querySelector('#gate')"):
            await pg.mouse.click(w / 2, h / 2)                   # only tap while the start gate / attract screen is up: a tap on the landing page would open a section
        await pg.wait_for_timeout(1500)
    else:
        raise RuntimeError("never reached the landing page")
    await pg.wait_for_timeout(1500)
    walk = await pg.evaluate(JS_WALK)
    if SHOTS:
        pathlib.Path(SHOTS).mkdir(parents=True, exist_ok=True)
        await pg.screenshot(path=os.path.join(SHOTS, KIND + "-home.png"))
    return walk


async def main():
    tmp = tempfile.mkdtemp(prefix="oc_")
    errs, failed = [], []
    proc = None
    try:
        async with async_playwright() as p:
            if KIND == "exe":
                port = 9333
                env = dict(os.environ, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=%d --autoplay-policy=no-user-gesture-required" % port)
                cmd = [os.path.abspath(PATH), "--windowed"] + (["--payload", os.path.abspath(os.environ["PKG_PAYLOAD"])] if os.environ.get("PKG_PAYLOAD") else [])
                proc = subprocess.Popen(cmd, env=env)
                t0 = time.time(); ok = False
                while time.time() - t0 < 40:
                    try:
                        urllib.request.urlopen("http://127.0.0.1:%d/json/version" % port, timeout=1); ok = True; break
                    except Exception:
                        time.sleep(0.5)
                if not ok: raise RuntimeError("exe did not expose a browser within 40 s")
                b = await p.chromium.connect_over_cdp("http://127.0.0.1:%d" % port)
                ctx = b.contexts[0]
                pg = ctx.pages[0] if ctx.pages else await ctx.wait_for_event("page")
            else:
                b = await p.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])
                ctx = await b.new_context(viewport={"width": 1920, "height": 1080})
                pg = await ctx.new_page()
                if KIND == "zip":
                    with zipfile.ZipFile(PATH) as z: z.extractall(tmp)
                    top = [d for d in os.listdir(tmp)][0]
                    url = pathlib.Path(tmp, top, "index.html").as_uri()
                else:
                    url = pathlib.Path(PATH).resolve().as_uri()
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: m.type == "error" and not m.text.startswith("Failed to load resource") and errs.append("console: " + m.text))
            pg.on("response", lambda r: r.status >= 400 and "favicon" not in r.url and failed.append("%d %s" % (r.status, r.url[-70:])))
            pg.on("requestfailed", lambda r: (r.failure or "") and "ERR_ABORTED" not in (r.failure or "") and failed.append(r.url[-80:] + " " + str(r.failure)))
            if KIND != "exe":
                await pg.goto(url)
            else:
                await pg.set_viewport_size({"width": 1920, "height": 1080}) if False else None
            walk = await drive(pg, errs)
            try: await b.close()
            except Exception: pass
        n_items = sum(s["items"] for s in walk["sections"])
        ok = not errs and not failed and not walk["broken"] and n_items > 0
        detail = "%d sections walked, %d items shown; page errors: %d; failed requests: %d; broken images: %d%s" % (
            len(walk["sections"]), n_items, len(errs), len(failed), len(walk["broken"]),
            ("  -> " + "; ".join((errs + failed + walk["broken"])[:4])) if not ok else "")
        print(json.dumps({"ok": ok, "detail": detail}))
    except Exception as e:
        print(json.dumps({"ok": False, "detail": "browser check failed: %s %s" % (type(e).__name__, str(e)[:300])}))
    finally:
        if proc and proc.poll() is None: proc.kill()
        shutil.rmtree(tmp, ignore_errors=True)

asyncio.run(main())
