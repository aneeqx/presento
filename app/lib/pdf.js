"use strict";
// PDF -> flipbook pages. The PDF is copied into the project untouched (MD5-verified); every page becomes a lossless PNG at 300 dpi
// (longest side capped at 8192 px). Links and bookmarks found in the PDF become clickable areas and the contents list.
const fs = require("fs");
const path = require("path");
const { BrowserWindow, nativeImage } = require("electron");
const { md5File, mkdirp } = require("../../core/fsx");
const { writeThumb } = require("./media");

let win = null;
async function grabber() {
  if (win && !win.isDestroyed()) return win;
  win = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { webSecurity: false, backgroundThrottling: false, contextIsolation: false } });
  await win.loadFile(path.join(__dirname, "pdfgrab.html"));
  for (let i = 0; i < 100; i++) { if (await win.webContents.executeJavaScript("!!window.__ready")) break; await new Promise(r => setTimeout(r, 100)); }
  return win;
}
const call = (w, expr) => w.webContents.executeJavaScript(expr);
function uniq(dir, name) { let n = name, i = 2; const e = path.extname(name), b = path.basename(name, e); while (fs.existsSync(path.join(dir, n))) n = b + " (" + i++ + ")" + e; return n; }

/** opts: {dir, rel, pdf, password, dpi, only} -> {pdf, pdfName, pages:[rel], thumbs:[rel], aspect, toc, links, n, pageSize} */
async function importPdf(opts, emit, cancelled) {
  const w = await grabber(), dir = path.join(opts.dir, opts.rel); mkdirp(dir);
  const url = require("url").pathToFileURL(opts.pdf).href;
  const meta = await call(w, "window.openPdf(" + JSON.stringify(url) + "," + JSON.stringify(opts.password || null) + ")");
  if (meta.error) { const e = new Error(meta.error === "password" ? "This PDF is password protected." : meta.error === "damaged" ? "This PDF is damaged or not a PDF." : meta.error); e.code = meta.error; throw e; }
  if (!meta.n) throw new Error("This PDF has no pages.");
  const name = uniq(dir, path.basename(opts.pdf).replace(/[<>:"/\\|?*]/g, "_")), pdfDest = path.join(dir, name);
  fs.copyFileSync(opts.pdf, pdfDest);
  if ((await md5File(opts.pdf)) !== (await md5File(pdfDest))) throw new Error("copy of the PDF does not match the original");
  const base = path.basename(name, ".pdf").replace(/\s+/g, "-"), pdir = path.join(dir, base + "-pages"), tdir = path.join(pdir, "thumbs"); mkdirp(tdir);
  const relPages = [], relThumbs = [], t0 = Date.now();
  const relBase = opts.rel + "/" + path.basename(pdir);
  for (let i = 1; i <= meta.n; i++) {
    if (cancelled && cancelled()) throw new Error("cancelled");
    emit && emit({ page: i, total: meta.n, seconds: (Date.now() - t0) / 1000, name });
    const r = await call(w, "window.renderPng(" + i + "," + (opts.dpi || 300) + ",8192)");
    const fn = "p-" + String(i).padStart(3, "0") + ".png";
    fs.writeFileSync(path.join(pdir, fn), Buffer.from(r.dataUrl.split(",")[1], "base64"));
    writeThumb(path.join(pdir, fn), path.join(tdir, "p-" + String(i).padStart(3, "0") + ".jpg"), 420);
    relPages.push(relBase + "/" + fn); relThumbs.push(relBase + "/thumbs/p-" + String(i).padStart(3, "0") + ".jpg");
  }
  const links = await call(w, "window.readLinks()"), toc = await call(w, "window.readOutline()");
  const p0 = meta.pages[0];
  return { pdf: opts.rel + "/" + name, pdfName: name, pages: relPages, thumbs: relThumbs, aspect: +(p0.w / p0.h).toFixed(5), toc, links, n: meta.n, pageSize: p0, bytes: fs.statSync(pdfDest).size };
}
function destroy() { if (win && !win.isDestroyed()) win.destroy(); win = null; }
module.exports = { importPdf, destroy };
