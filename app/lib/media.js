"use strict";
// Media import: the quality rules live here.
//  * originals are copied byte-for-byte (MD5-verified); nothing is resized or re-encoded
//  * thumbnails (grids only) and video posters are separate files
//  * TIF/TIFF -> lossless PNG (8-bit samples are kept exactly; 16-bit is flagged)
//  * mp4/mov whose index sits at the end get a lossless "fast-start" fix (the index moves, the media data is byte-identical and hash-checked)
//  * anything unsupported is reported, never silently dropped
const fs = require("fs");
const path = require("path");
const { BrowserWindow, nativeImage } = require("electron");
const { md5File, mkdirp } = require("../../core/fsx");
const { imageSize } = require("../../core/imgsize");
const { probeMp4, makeFastStart } = require("./mp4");

const IMG = /\.(jpe?g|png|webp|gif|svg)$/i, TIF = /\.tiff?$/i, VID = /\.(mp4|m4v|mov|webm)$/i, PDF = /\.pdf$/i;

function expand(paths) {                                    // folders -> files (recursive), stable natural order
  const out = [];
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) fs.readdirSync(p).sort(natural).forEach(n => walk(path.join(p, n)));
    else out.push(p);
  };
  paths.forEach(walk);
  return out;
}
function natural(a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }); }
function pretty(file) { return path.basename(file, path.extname(file)).replace(/[_]+/g, " ").replace(/\s+/g, " ").trim(); }
function safe(n) { return n.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_"); }
function uniq(dir, name) {
  let n = name, i = 2; const ext = path.extname(name), base = path.basename(name, ext);
  while (fs.existsSync(path.join(dir, n))) n = base + " (" + i++ + ")" + ext;
  return n;
}
function fmtDur(s) { s = Math.round(s); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }

/* ---------- poster / frame grabbing: a hidden window decodes the video (Chromium, H.264 included) ---------- */
let grabWin = null;
async function grabber() {
  if (grabWin && !grabWin.isDestroyed()) return grabWin;
  grabWin = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { webSecurity: false, backgroundThrottling: false, contextIsolation: false } });
  await grabWin.loadFile(path.join(__dirname, "grab.html"));
  return grabWin;
}
async function grabFrame(videoFile, t, maxW) {
  const w = await grabber();
  const url = require("url").pathToFileURL(videoFile).href;
  return await w.webContents.executeJavaScript("window.grab(" + JSON.stringify(url) + "," + (t == null ? "null" : +t) + "," + (maxW || 960) + ")");
}
async function writePoster(videoFile, destJpg, t) {
  const r = await grabFrame(videoFile, t, 960);
  if (!r || !r.dataUrl) return null;
  fs.writeFileSync(destJpg, Buffer.from(r.dataUrl.split(",")[1], "base64"));
  return r;
}
function destroyGrabber() { if (grabWin && !grabWin.isDestroyed()) grabWin.destroy(); grabWin = null; }

/* ---------- thumbnails ---------- */
function writeThumb(srcImage, destJpg, maxW) {
  const img = nativeImage.createFromPath(srcImage);
  if (img.isEmpty()) return false;
  const s = img.getSize();
  const out = s.width > maxW ? img.resize({ width: maxW, quality: "good" }) : img;
  fs.writeFileSync(destJpg, out.toJPEG(84));
  return true;
}

/* ---------- TIFF -> PNG ---------- */
function tiffToPng(src, dest) {
  const UTIF = require("utif"), { PNG } = require("pngjs");
  const buf = fs.readFileSync(src);
  const ifds = UTIF.decode(buf); if (!ifds.length) throw new Error("unreadable TIFF");
  const page = ifds[0]; UTIF.decodeImage(buf, page);
  const rgba = UTIF.toRGBA8(page);
  const png = new PNG({ width: page.width, height: page.height });
  Buffer.from(rgba.buffer, rgba.byteOffset, rgba.length).copy(png.data);
  fs.writeFileSync(dest, PNG.sync.write(png));
  const bits = page.t258 ? page.t258[0] : 8;
  return { w: page.width, h: page.height, bits };
}

/**
 * target: {dir: absolute media folder for this section, rel: project-relative prefix ("media/renders"), type: gallery|films|panoramas|links}
 * emit(progress) is called per file/phase. Returns {items, warnings, log}.
 */
async function importFiles(projectDir, target, inputPaths, emit, cancelled) {
  const files = expand(inputPaths);
  const log = { copied: 0, thumbnails: 0, posters: 0, tif: 0, faststart: 0, verified: 0, bytes: 0 }, warnings = [], items = [];
  const wantVideo = target.type === "films", wantImage = target.type === "gallery" || target.type === "panoramas" || target.type === "links";
  const dir = target.dir; mkdirp(dir);
  const t0 = Date.now();
  for (let i = 0; i < files.length; i++) {
    if (cancelled && cancelled()) { warnings.push({ file: "", level: "warn", msg: "Import cancelled. Files already copied are kept." }); break; }
    const src = files[i], name = path.basename(src);
    const prog = (phase) => emit && emit({ i: i + 1, total: files.length, name, phase, bytes: log.bytes, seconds: (Date.now() - t0) / 1000 });
    prog("copying");
    try {
      if (PDF.test(name)) { warnings.push({ file: name, level: "warn", msg: "PDF becomes a flipbook. The flipbook editor comes in a later round, so it was skipped.", action: "dismiss" }); continue; }
      const isImg = IMG.test(name), isTif = TIF.test(name), isVid = VID.test(name);
      if (!isImg && !isTif && !isVid) { warnings.push({ file: name, level: "error", msg: "Unsupported format. Skipped, not copied.", action: "dismiss" }); continue; }
      if ((isImg || isTif) && !wantImage) { warnings.push({ file: name, level: "warn", msg: "This section is a " + target.type + " page; images can't be added here. Skipped.", action: "dismiss" }); continue; }
      if (isVid && !wantVideo) { warnings.push({ file: name, level: "warn", msg: "This section is a " + target.type + " page; videos can't be added here. Skipped.", action: "dismiss" }); continue; }

      if (isImg || isTif) {
        let destName, w, h;
        if (isTif) {
          destName = uniq(dir, safe(path.basename(name, path.extname(name)) + ".png"));
          const r = tiffToPng(src, path.join(dir, destName)); w = r.w; h = r.h; log.tif++;
          if (r.bits > 8) warnings.push({ file: name, level: "warn", msg: r.bits + "-bit TIFF: the PNG holds 8 bits per channel.", action: "dismiss" });
        } else {
          destName = uniq(dir, safe(name));
          fs.copyFileSync(src, path.join(dir, destName));
          const [a, b] = await Promise.all([md5File(src), md5File(path.join(dir, destName))]);
          if (a !== b) throw new Error("copy does not match the original");
          log.verified++;
          const sz = imageSize(path.join(dir, destName)); if (sz) { w = sz.w; h = sz.h; }
        }
        log.copied++; log.bytes += fs.statSync(path.join(dir, destName)).size;
        prog("thumbnail");
        const tdir = path.join(dir, "thumbs"); mkdirp(tdir);
        const tname = path.basename(destName, path.extname(destName)) + ".jpg";
        let thumb = null;
        try { if (writeThumb(path.join(dir, destName), path.join(tdir, tname), 640)) { thumb = target.rel + "/thumbs/" + tname; log.thumbnails++; } } catch (e) { /* grid falls back to the full image */ }
        if (w && w < 1920 && h < 1080) warnings.push({ file: name, level: "info", msg: w + "×" + h + " is below full HD.", action: "dismiss" });
        items.push({ kind: "image", file: target.rel + "/" + destName, thumb, w, h, title: pretty(name), caption: "", source: name });
      } else {
        const destName = uniq(dir, safe(name)), destPath = path.join(dir, destName);
        const probe = /\.(mp4|m4v|mov)$/i.test(name) ? probeMp4(src) : null;
        let fixed = false;
        if (probe && !probe.fastStart) {
          prog("fast-start");
          const r = makeFastStart(src, destPath);
          if (r.fixed) { fixed = true; log.faststart++; } else if (r.reason && !/already/.test(r.reason)) warnings.push({ file: name, level: "info", msg: "Start-up flag not changed: " + r.reason + ".", action: "dismiss" });
        }
        if (!fixed) {
          fs.copyFileSync(src, destPath);
          const [a, b] = await Promise.all([md5File(src), md5File(destPath)]);
          if (a !== b) throw new Error("copy does not match the original");
          log.verified++;
        }
        log.copied++; log.bytes += fs.statSync(destPath).size;
        if (probe && /^(hvc1|hev1)$/.test(probe.codec)) warnings.push({ file: name, level: "warn", msg: "HEVC (H.265): plays only where a codec is installed.", action: "keep-remove", rel: target.rel + "/" + destName });
        if (probe && probe.codec && /^(apch|apcn|apcs|ap4h|ap4x)$/.test(probe.codec)) warnings.push({ file: name, level: "warn", msg: "ProRes: most browsers can't play it.", action: "keep-remove", rel: target.rel + "/" + destName });
        if (/\.webm$/i.test(name)) warnings.push({ file: name, level: "info", msg: "WebM plays in Chrome and Edge but not in Safari.", action: "dismiss" });
        prog("poster");
        let poster = null, dur = probe ? probe.duration : 0, vw = probe ? probe.width : 0, vh = probe ? probe.height : 0;
        const pdir = path.join(dir, "posters"); mkdirp(pdir);
        const pname = path.basename(destName, path.extname(destName)) + ".jpg";
        try {
          const r = await writePoster(destPath, path.join(pdir, pname), dur ? Math.min(1.5, dur * 0.1) : 1);
          if (r) { poster = target.rel + "/posters/" + pname; log.posters++; if (!dur) dur = r.dur; if (!vw) { vw = r.w; vh = r.h; } }
        } catch (e) { /* no poster: card shows a placeholder */ }
        if (!poster) warnings.push({ file: name, level: "warn", msg: "No poster frame could be made (the video did not decode here).", action: "dismiss" });
        items.push({ kind: "video", file: target.rel + "/" + destName, poster, duration: dur, w: vw, h: vh, codec: probe ? probe.codec : "", fixedFastStart: fixed, title: pretty(name), meta: (dur ? fmtDur(dur) : "") + (vh ? " · " + (vh >= 2160 ? "4K" : vh + "p") : ""), caption: "", source: name });
      }
    } catch (e) {
      warnings.push({ file: name, level: "error", msg: "Could not import: " + e.message, action: "dismiss" });
    }
  }
  return { items, warnings, log, total: files.length };
}

module.exports = { importFiles, expand, writePoster, grabFrame, writeThumb, destroyGrabber, fmtDur };
