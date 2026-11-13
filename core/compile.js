"use strict";
// compile(projectDir, opts): project.json -> everything a viewer needs (data.js, look.css, index.html, media list).
// Nothing is written here; exporters/build decide how to store the returned virtual file list.
const fs = require("fs");
const path = require("path");
const { loadProject, validate } = require("./project");
const { walk } = require("./fsx");
const { imageSize } = require("./imgsize");

const RUNTIME_DIR = path.join(__dirname, "..", "runtime");
// Optional flipbook engine add-on (not part of this repository). Folder layout: flipbook.js, flipbook.css, engine/book-template.js, engine/stage.js
const ADDON_FILES = ["flipbook.js", "flipbook.css", "engine/book-template.js", "engine/stage.js"];
function flipbookAddonDir() {
  const dirs = [process.env.PRESENTO_FLIPBOOK_ADDON, path.join(RUNTIME_DIR, "addons", "flipbook")].filter(Boolean);
  return dirs.find(d => ADDON_FILES.every(f => fs.existsSync(path.join(d, f)))) || null;
}
const MEDIA_OUT = "content/media/";
const EYEBROW = { gallery: "Collection", films: "Motion", panoramas: "Immersive", flipbook: "Identity", social: "Social", links: "Tools" };
const IMG_MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

function pad2(n) { return ("0" + n).slice(-2); }
function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"; }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

/**
 * opts.mode     "auto" | "desktop" | "touch"   (sets config.input; desktop = pointer)
 * opts.include  null (everything) | ["sectionId", "sectionId/subId", ...]
 * opts.runtime  runtime folder (default ../runtime)
 */
function compile(projectDir, opts) {
  opts = opts || {};
  const project = opts.project || loadProject(projectDir);
  const v = validate(project);
  const warnings = v.warnings.slice(), errors = v.errors.slice();
  const files = new Map();          // dest -> {dest, abs | buf}
  const addMedia = (rel) => {
    if (!rel) return null;
    rel = String(rel).replace(/\\/g, "/");
    if (!/^media\//.test(rel) || rel.split("/").includes("..")) { errors.push("media path must be inside media/: " + rel); return rel; }
    const abs = path.join(projectDir, rel);
    const dest = MEDIA_OUT + rel.slice(6);
    if (!files.has(dest)) {
      if (!fs.existsSync(abs)) errors.push("missing media file: " + rel);
      else files.set(dest, { dest, abs, size: fs.statSync(abs).size, media: true });
    }
    return dest;
  };
  const S = project.settings || {};
  const include = opts.include ? new Set(opts.include) : null;

  // ---------- sections ----------
  function leafOut(sec, leaf, isSub) {
    const base = { id: isSub ? leaf.id : "main", title: leaf.title || sec.title, type: leaf.type };
    if (isSub && leaf.blurb != null) base.blurb = leaf.blurb;
    if (isSub && leaf.icon) base.icon = leaf.icon;
    const vis = (leaf.items || []).filter(it => !it.hidden);
    if (leaf.type === "gallery") {
      base.items = vis.map(it => {
        const file = it.cropFile || it.file;
        const o = { src: addMedia(file), title: it.title || "", caption: it.caption || "" };
        if (it.thumb) o.thumb = addMedia(it.thumb);
        let w = it.w, h = it.h;
        if ((!w || !h) && !it.cropFile) { try { const sz = imageSize(path.join(projectDir, file)); if (sz) { w = sz.w; h = sz.h; } } catch (e) {} }
        if (it.cropFile && it.cropW && it.cropH) { w = it.cropW; h = it.cropH; }
        if (!w || !h) warnings.push("no size for " + file + " (masonry will assume 16:9)");
        else { o.w = w; o.h = h; }
        const ordered = {}; ["src", "thumb", "w", "h", "title", "caption"].forEach(k => { if (o[k] !== undefined) ordered[k] = o[k]; });
        return ordered;
      });
    } else if (leaf.type === "films") {
      base.items = vis.map(it => {
        const o = { title: it.title || "", meta: it.meta || "", src: addMedia(it.file), poster: it.poster ? addMedia(it.poster) : "", desc: it.caption || it.desc || "" };
        if (it.start != null) o.start = +it.start;
        if (it.end != null) o.end = +it.end;
        return o;
      });
    } else if (leaf.type === "panoramas") {
      base.items = vis.map(it => {
        const id = it.id || slug(it.title);
        const o = { id, title: it.title || "", meta: it.meta || "", image: addMedia(it.file) };
        if (it.thumb) o.thumb = addMedia(it.thumb);
        if (it.focus) o.focus = it.focus;
        ["yaw", "pitch", "hfov", "w", "h"].forEach(k => { if (it[k] != null) o[k] = it[k]; });
        if (it.caption) o.caption = it.caption;
        if (it.autoRotate === false) o.autoRotate = false;
        if (it.view360) {                      // file:// WebGL refuses images, so the 360 view loads the pano as a data: URL from a generated script
          const abs = path.join(projectDir, it.file), ext = abs.split(".").pop().toLowerCase();
          const dest = MEDIA_OUT + "_pano/" + id + ".js";
          if (fs.existsSync(abs)) {
            const b64 = fs.readFileSync(abs).toString("base64");
            const js = 'window.STUDIO_PANOS=window.STUDIO_PANOS||{};window.STUDIO_PANOS[' + JSON.stringify(id) + ']="data:' + (IMG_MIME[ext] || "image/jpeg") + ";base64," + b64 + '";';
            files.set(dest, { dest, buf: Buffer.from(js, "utf8"), size: Buffer.byteLength(js) });
            o.dataScript = dest;
          }
        }
        return o;
      });
    } else if (leaf.type === "flipbook") {
      base.items = vis.map(it => {
        const o = Object.assign({}, it);
        delete o.hidden; delete o.file; delete o.pdf; delete o.pdfPages;
        o.pages = (it.pages || []).map(addMedia);
        if (it.thumbs && it.thumbs.length === o.pages.length) { o.pages = o.pages.map((src, i) => ({ src, thumb: addMedia(it.thumbs[i]) })); }
        delete o.thumbs;
        if (!o.meta) o.meta = o.pages.length + " pages";
        return o;
      });
    } else if (leaf.type === "links") {
      base.items = vis.map(it => ({ title: it.title || "", image: it.file ? addMedia(it.file) : "", url: it.url, meta: it.meta || "" }));
    } else if (leaf.type === "social") {
      const s = JSON.parse(JSON.stringify(leaf.social || {}));
      if (s.profile && s.profile.avatar) s.profile.avatar = addMedia(s.profile.avatar);
      (s.highlights || []).forEach(h => { if (h.cover) h.cover = addMedia(h.cover); (h.stories || []).forEach(st => { st.src = addMedia(st.src); }); });
      (s.posts || []).forEach(p => { p.images = (p.images || []).map(addMedia); });
      s.highlights = s.highlights || []; s.posts = s.posts || [];
      base.social = s;
    }
    return base;
  }

  const sections = [], tiles = [];
  const seq = (project.sections || []).map((s, i) => ({ s, i })).sort((a, b) => ((a.s.order != null ? a.s.order : a.i) - (b.s.order != null ? b.s.order : b.i)) || (a.i - b.i)).map(x => x.s);
  seq.forEach(sec => {
    if (sec.hidden) return;
    const kids = sec.children && sec.children.length ? sec.children.slice().sort((a, b) => (a.order != null && b.order != null) ? a.order - b.order : 0) : null;
    let leaves;
    if (kids) {
      leaves = kids.filter(c => !c.hidden && (!include || include.has(sec.id) || include.has(sec.id + "/" + c.id)));
    } else leaves = (!include || include.has(sec.id)) ? [sec] : [];
    if (!leaves.length) return;
    const idx = tiles.length + 1;
    const out = {
      id: sec.id, title: sec.title,
      eyebrow: sec.eyebrow != null ? sec.eyebrow : pad2(idx) + " — " + (EYEBROW[leaves[0].type] || "Collection"),
      blurb: sec.blurb || "",
      subs: leaves.map(l => leafOut(sec, l, !!kids))
    };
    if (kids && sec.defaultSub && leaves.some(l => l.id === sec.defaultSub)) out.defaultSub = sec.defaultSub;
    sections.push(out);

    // landing panel
    const cv = sec.cover || {};
    let pv = {};
    if (cv.file) {
      if (cv.kind === "video") { pv = { type: "video", src: addMedia(cv.file) }; if (cv.start) pv.start = +cv.start; if (cv.poster) pv.poster = addMedia(cv.poster); }
      else pv = { type: "image", src: addMedia(cv.file) };
    } else {
      const first = out.subs.find(s => s.items && s.items.length);
      if (first) {
        const it = first.items[0];
        if (first.type === "gallery") pv = { type: "image", src: it.thumb || it.src };
        else if (first.type === "films") pv = { type: "video", src: it.src, poster: it.poster, start: it.start || undefined };
        else if (first.type === "panoramas") pv = { type: "image", src: it.thumb || it.image };
        else if (first.type === "links") pv = { type: "image", src: it.image };
        else if (first.type === "flipbook") pv = { type: "image", src: it.pages[0] };
      }
      warnings.push("section '" + sec.id + "' has no cover; using its first item");
    }
    tiles.push({ id: sec.id, title: sec.title, blurb: sec.tileBlurb != null ? sec.tileBlurb : sec.blurb || "", icon: sec.icon || "grid", preview: pv });
  });

  // ---------- brand / config / contact ----------
  const B = S.brand || {};
  const brand = { name: project.name, logo: B.logo ? addMedia(B.logo) : null, wordmark: B.wordmark || (String(project.name).split(" ").length === 2 ? String(project.name).split(" ") : [project.name, ""]),tagline: B.tagline || "", taglines: B.taglines || [] };
  if (B.rotateSeconds > 0) brand.rotateSeconds = Math.max(3, Math.min(20, +B.rotateSeconds));
  const intro = S.intro || {};
  const bg = S.background || {};
  const config = {};
  if (intro.enabled === false) config.intro = false;
  else if (intro.video) { config.intro = { video: addMedia(intro.video), videoHandoff: intro.handoff != null ? intro.handoff : 0 }; if (intro.allowSkip === false) config.intro.allowSkip = false; }
  else config.intro = intro.allowSkip === false ? { allowSkip: false } : true;
  config.transition = Object.assign({ out: 420, in: 1300, stagger: 55, overlap: 160 }, S.transition);
  config.motion = Object.assign({ scale: 1.6 }, S.motion);
  if (S.loader) config.loader = S.loader;
  config.startGate = S.startGate !== false;
  config.input = opts.mode === "touch" ? "touch" : opts.mode === "desktop" ? "pointer" : "auto";
  config.panelsDemo = S.panelsDemo || false;
  config.attractVideos = (bg.videos || []).map(x => addMedia(typeof x === "string" ? x : x.file));
  config.attractStart = bg.start != null ? bg.start : 0;
  config.attractLook = bg.look || { gray: 1, dim: 0.42 };
  if (!config.attractVideos.length) config.attractScreen = false;
  config.kiosk = { idleReturnMinutes: S.idleReturnMinutes || 0 };

  if (opts.preview) { config.startGate = false; config.intro = false; config.attractScreen = false; config.preview = true; }      // live preview: straight to the landing page; the page can be driven by postMessage
  const contact = S.contact || { heading: "", subline: "", items: [] };

  const data = { version: 2, brand, config, home: { tiles }, contact, sections };
  const title = project.name;
  const dataJs = "/* generated by the project compiler - do not edit */\nwindow.STUDIO_DATA = " + JSON.stringify(data, null, 1) + ";\n";

  // ---------- Look tokens -> css/look.css ----------
  const L = project.look || {};
  const root = [], touch = [];
  if (L.bg) root.push("--page-bg: " + cssColor(L.bg, errors, "look.bg"));
  if (L.accent) root.push("--mint: " + cssColor(L.accent, errors, "look.accent"));
  if (L.font) { const fn = String(L.font).replace(/["\\;{}]/g, ""); root.push('--font: "' + fn + '", ' + (/serif/i.test(fn) ? 'Georgia, "Times New Roman", serif' : '"Segoe UI", system-ui, sans-serif')); }
  if (L.ink) {                                                       // ink = text / icon / hairline colour. A light ink means a dark theme ("Night"): glass and solid surfaces turn faint white
    const hex = cssColor(L.ink, errors, "look.ink").replace("#", ""), f = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex.slice(0, 6);
    const rgb = [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16));
    root.push("--ink-rgb: " + rgb.join(" "));
    if (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 150) {
      root.push("--glass: rgba(255,255,255,.08)", "--glass-edge: rgba(255,255,255,.16)", "--glass-a: .08", "--glass-ea: .16", "--solid: rgba(255,255,255,.10)");
      const bg = String(L.bg || "#0B1F22").replace("#", ""), b6 = bg.length === 3 ? bg.split("").map(c => c + c).join("") : bg.slice(0, 6);
      const mix = (i, k) => Math.round(parseInt(b6.slice(i, i + 2), 16) + (255 - parseInt(b6.slice(i, i + 2), 16)) * k).toString(16).padStart(2, "0");
      root.push("--bg1: #" + mix(0, .07) + mix(2, .07) + mix(4, .07), "--bg2: #" + b6);     // flipbook desk
      root.push("--ivory-2: #" + mix(0, .05) + mix(2, .05) + mix(4, .05));
    }
  }
  if (L.buttons === "round") root.push("--btn-r: 16px", "--btn-r-ic: 16px");
  else if (L.buttons === "square") root.push("--btn-r: 4px", "--btn-r-ic: 4px");
  if (L.logoSize != null) { const k = num(L.logoSize, 0.3, 3, errors, "look.logoSize"); root.push("--logo-fs: calc(44px * " + k + ")", "--logo-h: calc(53px * " + k + ")"); touch.push("--logo-fs: calc(48px * " + k + ")", "--logo-h: calc(58px * " + k + ")"); }
  if (L.panelHeight != null) { const h = num(L.panelHeight, 20, 100, errors, "look.panelHeight"); root.push("--pn-h: min(" + h + "vh, calc(100vh - var(--top) - var(--bot)))"); }
  if (L.panelGap != null) { const g = num(L.panelGap, 0, 80, errors, "look.panelGap"); root.push("--pn-gap: " + g + "px"); touch.push("--pn-gap: " + g + "px"); }
  if (L.labelShadow != null) root.push("--lbl-sh: " + num(L.labelShadow, 0, 3, errors, "look.labelShadow"));
  const lookCss = "/* generated from the project's Look tokens */\n" + (root.length ? ":root { " + root.join("; ") + "; }\n" : "") + (touch.length ? "html.is-touch { " + touch.join("; ") + "; }\n" : "");

  // ---------- runtime + generated files ----------
  const rt = opts.runtime || RUNTIME_DIR;
  walk(rt).forEach(rel => {
    if (rel === "index.html" || rel === "css/look.css") return;
    files.set(rel, { dest: rel, abs: path.join(rt, rel), size: fs.statSync(path.join(rt, rel)).size, runtime: true });
  });
  const addon = flipbookAddonDir();
  let indexHtml = fs.readFileSync(path.join(rt, "index.html"), "utf8").replace(/\{\{TITLE\}\}/g, esc(title));
  if (addon) {
    ADDON_FILES.forEach(f => { const abs = path.join(addon, f), dest = "addons/flipbook/" + f; files.set(dest, { dest, abs, size: fs.statSync(abs).size, runtime: true }); });
    indexHtml = indexHtml.replace("<!--ADDON:FLIPBOOK-CSS-->", '<link rel="stylesheet" href="addons/flipbook/flipbook.css">')
      .replace("<!--ADDON:FLIPBOOK-->", '<script src="addons/flipbook/engine/book-template.js"></script>\n<script src="addons/flipbook/engine/stage.js"></script>\n<script src="addons/flipbook/flipbook.js"></script>');
  } else {
    indexHtml = indexHtml.replace("<!--ADDON:FLIPBOOK-CSS-->", "").replace("<!--ADDON:FLIPBOOK-->", '<script src="js/sections/flipbook-stub.js"></script>');
  }
  const gen = (dest, text) => files.set(dest, { dest, buf: Buffer.from(text, "utf8"), size: Buffer.byteLength(text), generated: true });
  if (opts.preview) {
    const phoneHtml = '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="css/base.css"><link rel="stylesheet" href="css/graphics.css"><link rel="stylesheet" href="css/touch.css"><link rel="stylesheet" href="css/look.css"><style>html,body{margin:0;height:100%;overflow:hidden;background:transparent}#bg,#bar{display:none}#host{position:absolute;left:50%;top:50%;transform-origin:50% 50%}</style></head><body><div id="host"></div>' +
      '<script src="content/data.js"></script><script src="js/core/util.js"></script><script src="js/core/input.js"></script><script src="js/core/icons.js"></script><script src="js/core/fly.js"></script><script src="js/core/ui.js"></script><script src="js/sections/phone.js"></script>' +
      '<script>(function(){var q=new URLSearchParams(location.search),sec=null;(BS.data.sections||[]).forEach(function(s){s.subs.forEach(function(u){if(u.social&&(!q.get("sec")||q.get("sec")===s.id)&&!sec)sec=u.social})});' +
      'var host=document.getElementById("host");if(!sec){host.textContent="";return}var ph=BS.phone.create(sec);host.appendChild(ph.wrap);window.__phone=ph;' +
      'function fit(){var w=ph.wrap.offsetWidth||BS.phone.W,h=ph.wrap.offsetHeight||BS.phone.H,s=Math.min(innerWidth/(w+20),innerHeight/(h+20));host.style.transform="translate(-50%,-50%) scale("+s+")"}fit();addEventListener("resize",fit);setTimeout(fit,300)})()</script></body></html>';
    gen("phone.html", phoneHtml);
  }
  gen("index.html", indexHtml); gen("css/look.css", lookCss); gen("content/data.js", dataJs);

  if (errors.length) { const e = new Error("Project has errors:\n - " + errors.join("\n - ")); e.errors = errors; throw e; }
  const list = [...files.values()].sort((a, b) => a.dest < b.dest ? -1 : 1);
  return { project, title, data, dataJs, lookCss, indexHtml, files: list, warnings, mediaBytes: list.filter(f => f.media).reduce((a, f) => a + f.size, 0) };
}

function cssColor(c, errors, what) { c = String(c).trim(); if (!/^#[0-9a-fA-F]{3,8}$/.test(c) && !/^(rgb|hsl)a?\([0-9 ,.%]+\)$/.test(c)) { errors.push(what + ": not a colour: " + c); return "#000"; } return c; }
function num(v, lo, hi, errors, what) { v = +v; if (!isFinite(v) || v < lo || v > hi) { errors.push(what + " must be a number " + lo + ".." + hi); return lo; } return v; }

module.exports = { compile, RUNTIME_DIR, MEDIA_OUT, flipbookAddonDir };
