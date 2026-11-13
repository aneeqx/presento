"use strict";
const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, Menu } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

if (process.env.PRESENTO_CDP) app.commandLine.appendSwitch("remote-debugging-port", process.env.PRESENTO_CDP);   // test aid: drive the real window with Playwright
if (process.env.PRESENTO_DATA) app.setPath("userData", process.env.PRESENTO_DATA);

const core = (m) => require(path.join(__dirname, "..", "core", m));
const exp = (m) => require(path.join(__dirname, "..", "exporters", m));
const { loadProject, saveProject, emptyProject } = core("project");
const { compile } = core("compile");
const media = require("./lib/media");
const preview = require("./lib/previewServer");
const share = require("./lib/share");
const pdfLib = require("./lib/pdf");

let win = null;
const DEFAULT_ROOT = path.join(app.getPath("documents"), "Presento Projects");   // installed app: Documents/Presento Projects, outside the install folder, so uninstall never touches projects

/* ---------------- settings: projects folder + recent folders ---------------- */
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
function readSettings() { try { return JSON.parse(fs.readFileSync(settingsFile(), "utf8")); } catch (e) { return {}; } }
function writeSettings(s) { fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2)); }
function root() { return readSettings().root || process.env.PRESENTO_ROOT || DEFAULT_ROOT; }
function remember(dir) { const s = readSettings(); s.recents = [dir, ...(s.recents || []).filter(d => d !== dir)].slice(0, 30); writeSettings(s); }

function summarize(dir) {
  try {
    const p = loadProject(dir), st = fs.statSync(path.join(dir, "project.json"));
    let items = 0, cover = null;
    const secs = (p.sections || []);
    secs.forEach(s => { (s.children && s.children.length ? s.children : [s]).forEach(l => { items += (l.items || []).length + (l.social ? (l.social.posts || []).length : 0); }); });
    for (const s of secs) {
      const c = s.cover && s.cover.file ? (s.cover.kind === "video" ? s.cover.poster : s.cover.file) : null;
      if (c) { cover = c; break; }
      const l = (s.children && s.children.length ? s.children : [s]).find(x => (x.items || []).length);
      if (l) { const it = l.items[0]; cover = it.thumb || it.poster || it.file; if (cover) break; }
    }
    return { dir, name: p.name, sections: secs.filter(s => !s.hidden).length, hidden: secs.filter(s => s.hidden).length, items, mtime: st.mtimeMs, cover: cover ? path.join(dir, cover) : null };
  } catch (e) { return null; }
}

function listProjects() {
  const s = readSettings(), dirs = new Set(s.recents || []);
  const r = root();
  try { fs.readdirSync(r, { withFileTypes: true }).forEach(e => { if (e.isDirectory() && fs.existsSync(path.join(r, e.name, "project.json"))) dirs.add(path.join(r, e.name)); }); } catch (e) { /* root missing */ }
  return [...dirs].map(summarize).filter(Boolean).sort((a, b) => b.mtime - a.mtime);
}
function templates() { return []; }      // no built-in templates: start from a blank presentation or open an existing project folder
function uniqueDir(name) {
  const base = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim() || "Presentation", r = root(); fs.mkdirSync(r, { recursive: true });
  let d = path.join(r, base.toLowerCase().replace(/\s+/g, "-")), i = 2; const b0 = d;
  while (fs.existsSync(d)) d = b0 + "-" + i++;
  return d;
}
function rename(dir, name) { const p = loadProject(dir); p.name = name; p.id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || p.id; saveProject(dir, p); }

/* ---------------- IPC ---------------- */
const H = (name, fn) => ipcMain.handle(name, async (e, ...a) => { try { return { ok: true, v: await fn(...a) }; } catch (err) { return { ok: false, error: err.message || String(err) }; } });

H("app:info", () => ({ flipbookAddon: !!core("compile").flipbookAddonDir(), exportDir: process.env.PRESENTO_EXPORTS || path.join(app.getPath("documents"), "Presento Exports"), root: root(), templates: templates(), version: app.getVersion(), platform: process.platform }));
H("projects:list", () => listProjects());
H("projects:setRoot", async () => {
  const r = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"], title: "Choose the folder that holds your projects", defaultPath: root() });
  if (r.canceled) return null; const s = readSettings(); s.root = r.filePaths[0]; writeSettings(s); return s.root;
});
H("projects:create", async ({ kind, name, templateDir }) => {
  const dir = uniqueDir(name);
  if (kind === "template") { await fs.promises.cp(templateDir, dir, { recursive: true }); rename(dir, name); }
  else { fs.mkdirSync(path.join(dir, "media"), { recursive: true }); saveProject(dir, emptyProject(name)); }
  remember(dir); return dir;
});
H("projects:duplicate", async (dir) => {
  const p = loadProject(dir), nd = uniqueDir(p.name + " copy");
  await fs.promises.cp(dir, nd, { recursive: true }); rename(nd, p.name + " copy"); remember(nd); return nd;
});
H("projects:rename", (dir, name) => rename(dir, name));
H("projects:delete", async (dir) => { await shell.trashItem(dir); const s = readSettings(); s.recents = (s.recents || []).filter(d => d !== dir); writeSettings(s); });
H("projects:openFolder", async () => {
  const r = await dialog.showOpenDialog(win, { properties: ["openDirectory"], title: "Open a presentation folder" });
  if (r.canceled) return null; const dir = r.filePaths[0];
  if (!fs.existsSync(path.join(dir, "project.json"))) throw new Error("That folder has no project.json, so it is not a presentation project.");
  remember(dir); return dir;
});
H("project:load", (dir) => { remember(dir); return loadProject(dir); });
H("project:save", (dir, project) => { saveProject(dir, project); return Date.now(); });
H("shell:reveal", (p) => { fs.existsSync(p) ? shell.showItemInFolder(p) : shell.openPath(path.dirname(p)); });
H("shell:open", (p) => shell.openPath(p));
H("dialog:pick", async ({ kind }) => {
  if (kind === "folder") { const r = await dialog.showOpenDialog(win, { properties: ["openDirectory"] }); return r.canceled ? null : r.filePaths; }
  const filters = kind === "pdf" ? [{ name: "PDF", extensions: ["pdf"] }] : kind === "video" ? [{ name: "Video", extensions: ["mp4", "m4v", "mov", "webm"] }] : kind === "image" ? [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"] }] : [{ name: "Media", extensions: ["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff", "mp4", "m4v", "mov", "webm", "pdf"] }];
  const r = await dialog.showOpenDialog(win, { properties: ["openFile", "multiSelections"], filters });
  return r.canceled ? null : r.filePaths;
});

/* media import */
let importCancel = false;
H("media:cancel", () => { importCancel = true; });
H("media:import", async ({ dir, rel, type, paths }) => {
  importCancel = false;
  const target = { dir: path.join(dir, rel), rel, type };
  return await media.importFiles(dir, target, paths, (p) => win && win.webContents.send("media:progress", p), () => importCancel);
});
H("media:remove", (dir, rels) => { rels.forEach(r => { if (r) try { fs.unlinkSync(path.join(dir, r)); } catch (e) { /* already gone */ } }); });
H("video:frame", async ({ dir, file, t, name }) => {
  const dest = path.join(dir, path.dirname(file), "posters"); fs.mkdirSync(dest, { recursive: true });
  const base = path.basename(file, path.extname(file)) + "-cover-" + Math.round((t || 0) * 10) + ".jpg";
  const r = await media.writePoster(path.join(dir, file), path.join(dest, base), t);
  if (!r) throw new Error("could not read that frame");
  return path.posix.join(path.dirname(file).split(path.sep).join("/"), "posters", base);
});
H("video:probe", async ({ dir, file }) => {
  const { probeMp4 } = require("./lib/mp4"); return probeMp4(path.join(dir, file));
});
H("image:crop", ({ dir, file, rect }) => {
  const src = path.join(dir, file), img = nativeImage.createFromPath(src);
  if (img.isEmpty()) throw new Error("this image could not be read");
  const s = img.getSize();
  const x = Math.round(rect.x * s.width), y = Math.round(rect.y * s.height);
  const w = Math.max(1, Math.min(s.width - x, Math.round(rect.w * s.width))), h = Math.max(1, Math.min(s.height - y, Math.round(rect.h * s.height)));
  const out = img.crop({ x, y, width: w, height: h });
  const cdir = path.join(path.dirname(src), "crops"); fs.mkdirSync(path.join(cdir, "thumbs"), { recursive: true });
  const base = path.basename(file, path.extname(file)) + "-crop";
  let n = base, i = 2; while (fs.existsSync(path.join(cdir, n + ".png"))) n = base + "-" + i++;
  fs.writeFileSync(path.join(cdir, n + ".png"), out.toPNG());                           // lossless
  media.writeThumb(path.join(cdir, n + ".png"), path.join(cdir, "thumbs", n + ".jpg"), 640);
  const relDir = path.dirname(file).split(path.sep).join("/");
  return { cropFile: relDir + "/crops/" + n + ".png", thumb: relDir + "/crops/thumbs/" + n + ".jpg", w, h, sourceW: s.width, sourceH: s.height };
});

/* preview */
H("preview:publish", async ({ dir, mode, token }) => {
  const c = compile(dir, { mode: mode || "desktop", preview: true });
  return { url: await preview.publish(token || "main", c), warnings: c.warnings };
});

/* flipbook: PDF -> pages */
let pdfCancel = false;
H("pdf:cancel", () => { pdfCancel = true; });
H("pdf:import", async (o) => { pdfCancel = false; return await pdfLib.importPdf(o, (p) => win && win.webContents.send("pdf:progress", p), () => pdfCancel); });
H("file:read", (p) => fs.readFileSync(p));
H("url:test", (u) => new Promise((resolve) => {
  const { net } = require("electron"); let done = false; const fin = (r) => { if (!done) { done = true; resolve(r); } };
  try { const req = net.request({ method: "HEAD", url: u, redirect: "follow" }); req.on("response", (r) => fin({ ok: r.statusCode < 400, status: r.statusCode })); req.on("error", (e) => fin({ ok: false, error: e.message })); req.end(); setTimeout(() => fin({ ok: false, error: "no answer in 8 s" }), 8000); } catch (e) { fin({ ok: false, error: e.message }); }
}));

/* network share */
H("share:start", (o) => share.start(o));
H("share:stop", () => share.stop().then(() => share.status()));
H("share:status", () => share.status());
H("share:qr", (t) => share.qr(t));

/* estimates per section for the export dialog */
H("export:estimate", async ({ dir }) => {
  const p = loadProject(dir), out = [];
  const b64 = (n) => Math.ceil(n / 3) * 4 + 120;
  const measure = (include) => { try { const c = compile(dir, { include, mode: "desktop" }); return { media: c.mediaBytes, html: c.files.reduce((a, f) => a + b64(f.size), 0) + 400000, items: c.data.sections.reduce((a, s) => a + s.subs.reduce((b, u) => b + (u.items ? u.items.length : 0), 0), 0) }; } catch (e) { return { media: 0, html: 0, items: 0, error: e.message }; } };
  const all = measure(null);
  (p.sections || []).forEach(s => {
    const m = s.hidden ? { media: 0, html: 0, items: 0 } : measure([s.id]);
    const subs = (s.children || []).map(c => ({ id: c.id, title: c.title, hidden: !!c.hidden, media: (s.hidden || c.hidden) ? 0 : measure([s.id + "/" + c.id]).media }));
    out.push({ id: s.id, title: s.title, hidden: !!s.hidden, media: m.media, subs });
  });
  return { sections: out, total: all };
});

/* export */
let exportCancel = false;
H("export:cancel", () => { exportCancel = true; });
H("export:run", async ({ dir, format, mode, pin, include, outDir, zip, browser }) => {
  exportCancel = false;
  const p = loadProject(dir);
  const { safeName } = exp("common");
  const send = (ch, d) => win && win.webContents.send(ch, d);
  fs.mkdirSync(outDir, { recursive: true });
  const name = safeName(p.name), suffix = mode === "touch" ? "Touch" : "Desktop";
  const out = format === "exe" ? path.join(outDir, name) : path.join(outDir, name + " - " + suffix + (format === "zip" ? ".zip" : ".html"));
  const opts = { mode, pin: pin || null, include: include || null, browser: browser !== false, zipFolder: !!zip, cancelled: () => exportCancel,
    onStep: (s, d) => send("export:step", { step: s, detail: d }), onProgress: (n, pos) => send("export:progress", { file: n, bytes: pos }) };
  const { run } = exp("cli");
  const r = await run(dir, format, Object.assign({ out }, opts, { zip: !!zip, mode, pin: pin || undefined, include: include ? include.join(",") : undefined }));
  return r;
});

/* ---------------- window + launch splash ---------------- */
const ICON = path.join(__dirname, "renderer", "brand", "presento.ico");
let splash = null, splashDone = false, mainReady = false, splashSkipped = false;
function showMain() { if (win && !win.isDestroyed() && !win.isVisible()) { win.show(); win.focus(); } if (splash && !splash.isDestroyed()) splash.destroy(); splash = null; }
function maybeHandOver() { if (mainReady && (splashDone || splashSkipped || !splash)) showMain(); }
ipcMain.on("splash:skip", () => { splashSkipped = true; maybeHandOver(); });
ipcMain.on("app:ready", () => { mainReady = true; maybeHandOver(); });
function createSplash() {
  splash = new BrowserWindow({ width: 520, height: 320, frame: false, transparent: true, resizable: false, movable: true, show: false, center: true, skipTaskbar: false, alwaysOnTop: true, hasShadow: false, icon: ICON, title: "Presento",
    webPreferences: { preload: path.join(__dirname, "splash-preload.js"), contextIsolation: true, nodeIntegration: false } });
  splash.loadFile(path.join(__dirname, "renderer", "brand", "splash-wrap.html"));
  splash.once("ready-to-show", () => { splash.show(); setTimeout(() => { splashDone = true; maybeHandOver(); }, 5200); });      // 4.8 s of motion + 0.3 s hold
  splash.on("closed", () => { splash = null; });
}
function createWindow() {
  Menu.setApplicationMenu(null);
  const noSplash = !!process.env.PRESENTO_NOSPLASH;
  win = new BrowserWindow({ width: 1600, height: 940, minWidth: 1000, minHeight: 620, backgroundColor: "#120F0E", autoHideMenuBar: true, title: "Presento", icon: ICON, show: noSplash,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.on("closed", () => { win = null; });
  if (noSplash) { mainReady = true; } else createSplash();
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { media.destroyGrabber(); share.stop(); app.quit(); });
app.on("before-quit", () => { share.stop(); pdfLib.destroy(); });
