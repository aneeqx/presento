"use strict";
// Single HTML file: css/js inlined, every media file base64-embedded in <script type="application/x-b64"> blocks (decoded lazily to blob: URLs in the browser).
// Warn above 300 MB, refuse above 1 GB (browsers cannot open much more than that).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { prepare, safeName, Scanner, fmtBytes } = require("./common");
const { imageSizeBuffer } = require("../core/imgsize");

const WARN = 300 * 1048576, REFUSE = 1024 * 1048576;

function b64len(n) { return Math.ceil(n / 3) * 4; }

/** Size estimate without writing anything (used by the UI before export). */
function estimateHtml(projectDir, opts) {
  const { files } = prepare(projectDir, opts);
  const bytes = files.reduce((a, f) => a + b64len(f.size) + 120, 0) + 400000;
  return { bytes, text: fmtBytes(bytes), level: bytes > REFUSE ? "refuse" : bytes > WARN ? "warn" : "ok" };
}

const LOADER = `(function(){
var dom=new Promise(function(r){if(document.readyState!=="loading")r();else document.addEventListener("DOMContentLoaded",r)});
var g=window.__GATE;window.__GATE=g&&g.then?Promise.all([g,dom]):dom;      // start the viewer only once the embedded media tables are parsed (and the PIN gate, if any, is open)
var urls={},els=null;
function table(){if(!els){els={};[].forEach.call(document.querySelectorAll('script[type="application/x-b64"]'),function(e){els[e.getAttribute("data-p")]=e})}return els}
function blobUrl(p){if(urls[p])return urls[p];var e=table()[p];if(!e)return p;var s=e.textContent,parts=[],step=4*1024*1024;
for(var i=0;i<s.length;i+=step){var bin=atob(s.substr(i,step)),u=new Uint8Array(bin.length);for(var j=0;j<bin.length;j++)u[j]=bin.charCodeAt(j);parts.push(u)}
return (urls[p]=URL.createObjectURL(new Blob(parts,{type:e.getAttribute("data-t")})))}
function lazy(o,k,p){var v;Object.defineProperty(o,k,{enumerable:true,configurable:true,get:function(){return v||(v=blobUrl(p))},set:function(x){Object.defineProperty(o,k,{value:x,writable:true,enumerable:true,configurable:true})}})}
function walk(o){if(!o||typeof o!=="object")return;Object.keys(o).forEach(function(k){var v=o[k];if(typeof v==="string"&&v.indexOf("content/media/")===0)lazy(o,k,v);else walk(v)})}
walk(window.STUDIO_DATA);
})();`;

async function exportHtml(projectDir, outFile, opts) {
  opts = opts || {};
  const { compiled, files } = prepare(projectDir, opts);
  if (opts.onStep) opts.onStep("collect", files.length + " files");
  const est = files.reduce((a, f) => a + b64len(f.size) + 120, 0) + 400000;
  if (est > REFUSE) { const e = new Error("Too large for a single HTML file: about " + fmtBytes(est) + " (the limit is 1 GB). Use the ZIP or the .exe instead, or untick sections."); e.code = "TOO_LARGE"; throw e; }
  const warnings = compiled.warnings.slice();
  if (est > WARN) warnings.push("Large single HTML (" + fmtBytes(est) + "): it may be slow or fail to open in some browsers.");

  const byDest = new Map(files.map(f => [f.dest, f]));
  const text = (dest) => { const f = byDest.get(dest); if (!f) throw new Error("missing runtime file " + dest); return (f.buf || fs.readFileSync(f.abs)).toString("utf8"); };
  let html = text("index.html");
  const used = new Set(["index.html"]);

  // inline stylesheets (font urls become data URIs)
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
    used.add(href);
    let css = text(href);
    const base = path.posix.dirname(href);
    css = css.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/g, (mm, u) => {
      if (/^(data:|#|https?:)/.test(u)) return mm;
      const dest = path.posix.normalize(path.posix.join(base, u));
      const f = byDest.get(dest); if (!f) return mm;
      used.add(dest);
      const ext = dest.split(".").pop().toLowerCase();
      return "url(data:" + ({ woff2: "font/woff2", woff: "font/woff", png: "image/png", svg: "image/svg+xml", jpg: "image/jpeg" }[ext] || "application/octet-stream") + ";base64," + (f.buf || fs.readFileSync(f.abs)).toString("base64") + ")";
    });
    return "<style>" + css.replace(/<\/style/gi, "<\\/style") + "</style>";
  });
  // inline scripts; after data.js comes the lazy-media loader
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
    used.add(src);
    const js = text(src).replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
    return "<script>" + js + "</script>" + (src === "content/data.js" ? "\n<script>" + LOADER + "</script>" : "");
  });
  html = html.replace(/<!--[\s\S]*?-->/g, c => c.includes("{{") ? c : "");           // drop authoring comments
  const mediaFiles = files.filter(f => f.dest.startsWith("content/media/") && !used.has(f.dest));
  const end = html.lastIndexOf("</body>");
  if (end < 0) throw new Error("index.html has no </body>");
  const head = html.slice(0, end), tailHtml = html.slice(end);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const out = fs.createWriteStream(outFile, { highWaterMark: 4 << 20 });
  let pos = 0, err = null; out.on("error", e => { err = e; });
  const put = (b) => { if (err) throw err; const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, "utf8"); pos += buf.length; return new Promise(r => { if (out.write(buf)) r(); else out.once("drain", r); }); };
  const mimeOf = require("../core/fsx").mime;
  const table = [];
  if (opts.onStep) opts.onStep("pack", "embedding");
  await put(head);
  for (const f of mediaFiles) {
    if (opts.cancelled && opts.cancelled()) throw new Error("cancelled"); if (opts.onProgress) opts.onProgress(f.dest, pos);
    await put('<script type="application/x-b64" data-p="' + f.dest + '" data-t="' + mimeOf(f.dest).split(";")[0] + '">');
    const start = pos;
    if (f.buf) await put(f.buf.toString("base64"));
    else {
      const fh = await fs.promises.open(f.abs, "r"); const chunk = Buffer.allocUnsafe(3 * 1024 * 1024); let p = 0;
      try { for (;;) { const { bytesRead } = await fh.read(chunk, 0, chunk.length, p); if (!bytesRead) break; await put(chunk.subarray(0, bytesRead).toString("base64")); p += bytesRead; } } finally { await fh.close(); }
    }
    table.push({ dest: f.dest, start, end: pos, abs: f.abs, buf: f.buf, size: f.size });
    await put("</script>\n");
  }
  await put(tailHtml);
  await new Promise((r, j) => { out.end(); out.on("finish", r); out.on("error", j); });
  if (opts.onStep) opts.onStep("check", "");
  const check = await checkHtml(outFile, table, opts);
  return { file: outFile, bytes: pos, warnings, check, mediaFiles: mediaFiles.length };
}

/** Post-export check: decode every embedded file straight out of the finished HTML and compare with its source; scan for the forbidden word. */
async function checkHtml(file, table, opts) {
  const checks = [], add = (n, ok, d) => checks.push({ name: n, ok, detail: d });
  const fd = await fs.promises.open(file, "r");
  const sc = new Scanner();
  try {
    const bad = []; let imgOk = 0, imgBad = [];
    for (const t of table) {
      const h = crypto.createHash("md5"); const parts = []; let first = null;
      for (let p = t.start; p < t.end;) {
        const n = Math.min(3 * 1024 * 1024 * 4 / 3 | 0, t.end - p), b = Buffer.alloc(n); await fd.read(b, 0, n, p);
        const dec = Buffer.from(b.toString("latin1"), "base64"); h.update(dec); sc.feed(dec);
        if (!first) first = dec; p += n;
      }
      const src = t.buf ? crypto.createHash("md5").update(t.buf).digest("hex") : await md5(t.abs);
      if (h.digest("hex") !== src) bad.push(t.dest);
      if (/\.(jpe?g|png|webp|gif)$/i.test(t.dest) && t.abs) {
        const a = imageSizeBuffer(first), b = imageSizeBuffer(fs.readFileSync(t.abs).subarray(0, 8 << 20));
        if (a && b && a.w === b.w && a.h === b.h) imgOk++; else imgBad.push(t.dest);
      }
    }
    add("all embedded files present and identical", bad.length === 0, bad.length ? bad.slice(0, 5).join("; ") : table.length + " embedded files decoded from the HTML and compared with their sources");
    add("image resolutions intact", imgBad.length === 0, imgBad.length ? imgBad.join("; ") : imgOk + " images, pixel sizes match the originals");
    await require("./common").scanFile(file, sc);
    add("no forbidden word anywhere", sc.hits === 0, sc.hits + " occurrences (HTML text and decoded media scanned)");
  } finally { await fd.close(); }
  if (opts && opts.browser !== false) checks.push(await require("./check").browserCheck({ kind: "html", path: file, pin: opts.pin }));
  return { ok: checks.every(c => c.ok || c.skipped), checks };
}

function md5(f) { return require("../core/fsx").md5File(f); }

module.exports = { exportHtml, estimateHtml, WARN, REFUSE };
