/* Presento renderer core: state, helpers, project mutations, autosave, shell (rail + top bar). Plain JS, no framework: render() rebuilds the markup from S. */
(function () {
  "use strict";
  var ic = PI.ic;
  var A = window.A = { S: {}, ic: ic };
  var S = A.S = {
    screen: "home", dir: null, project: null, projects: [], info: null, templates: [],
    sel: { sec: null, sub: null, item: null }, filter: "all", settingsTab: "brand", lookTab: "landing",
    mode: "desktop", size: "1920x1080", fold: (function () { try { return localStorage.getItem("fold") === "1"; } catch (e) { return false; } })(), rtab: {}, share: { open: false, st: { on: false }, pinOn: false, pin: "", ip: null, qr: null }, dialog: null, saved: "", savedAt: 0, attn: [], importing: null, importLog: null, menu: null, toast: null, dragOver: false
  };

  /* ---------- tiny helpers ---------- */
  A.esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  A.$ = function (sel, root) { return (root || document).querySelector(sel); };
  A.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  A.fileUrl = function (abs) { return abs ? encodeURI("file:///" + String(abs).replace(/\\/g, "/")).replace(/#/g, "%23").replace(/\?/g, "%3F") : ""; };
  A.mediaUrl = function (rel) { return rel && S.dir ? A.fileUrl(S.dir + "/" + rel) : ""; };
  A.fmtBytes = function (n) { return n >= 1073741824 ? (n / 1073741824).toFixed(1) + " GB" : n >= 1048576 ? Math.round(n / 1048576) + " MB" : Math.max(0, Math.round(n / 1024)) + " KB"; };
  A.fmtTime = function (s, frac) { s = Math.max(0, s || 0); var m = Math.floor(s / 60), r = s - m * 60; return String(m).padStart(2, "0") + ":" + (frac ? r.toFixed(1).padStart(4, "0") : String(Math.floor(r)).padStart(2, "0")); };
  A.parseTime = function (t) { t = String(t).trim(); var m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(t); if (m) return +m[1] * 60 + +m[2]; return isFinite(+t) && t !== "" ? +t : null; };
  A.ago = function (ms) { var d = (Date.now() - ms) / 1000; return d < 90 ? "just now" : d < 3600 ? Math.round(d / 60) + " min ago" : d < 86400 ? Math.round(d / 3600) + " h ago" : d < 604800 ? Math.round(d / 86400) + " days ago" : Math.round(d / 604800) + " weeks ago"; };
  A.slug = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"; };
  A.toast = function (msg) { S.toast = msg; A.render(); clearTimeout(A._tt); A._tt = setTimeout(function () { S.toast = null; A.render(); }, 3500); };
  A.err = function (e) { A.toast(e && e.message ? e.message : String(e)); console.error(e); };

  /* ---------- project accessors ---------- */
  A.secs = function () { return S.project ? S.project.sections : []; };
  A.curSec = function () { return A.secs().filter(function (s) { return s.id === S.sel.sec; })[0] || null; };
  A.leaves = function (sec) { return sec.children && sec.children.length ? sec.children : [sec]; };
  A.curLeaf = function () { var s = A.curSec(); if (!s) return null; if (s.children && s.children.length) return s.children.filter(function (c) { return c.id === S.sel.sub; })[0] || s.children[0]; return s; };
  A.curItem = function () { var l = A.curLeaf(); return l && S.sel.item != null && l.items ? l.items[S.sel.item] : null; };
  A.itemCount = function (l) { return l.social ? (l.social.posts || []).length : (l.items || []).length; };
  A.secCount = function (s) { return A.leaves(s).reduce(function (a, l) { return a + A.itemCount(l); }, 0); };
  A.TYPES = [["gallery", "image", "Gallery"], ["films", "film", "Films"], ["panoramas", "panorama", "Panoramas"], ["flipbook", "page", "Flipbook"], ["social", "type", "Social"], ["links", "link", "Links"]];
  A.TYPE_ICON = { gallery: "image", films: "film", panoramas: "panorama", flipbook: "page", social: "type", links: "link" };
  A.PICKS = ["secStills", "secAnimations", "secProptech", "secGraphics", "interior", "building", "phone", "bookClosed", "panorama", "cube", "grid", "layers"];
  A.uid = function (base, taken) { var id = A.slug(base), n = id, i = 2; while (taken.indexOf(n) >= 0 || ["home", "contact", "attract"].indexOf(n) >= 0) n = id + "-" + i++; return n; };

  /* ---------- autosave ---------- */
  var timer = 0;
  A.touch = function () {
    S.saved = "saving"; clearTimeout(timer);
    timer = setTimeout(function () { A.flush(); }, 450);
    var c = A.$(".ctr em"); if (c) c.textContent = "saving…";
    A.schedulePreview();
  };
  A.flush = function () {
    clearTimeout(timer); if (!S.project || !S.dir) return Promise.resolve();
    return window.api.save(S.dir, S.project).then(function (t) { S.saved = "saved"; S.savedAt = t; var c = A.$(".ctr em"); if (c) c.textContent = "saved · just now"; }, A.err);
  };
  var pvTimer = 0;
  A.schedulePreview = function () { clearTimeout(pvTimer); pvTimer = setTimeout(function () { if (A.onProjectChanged) A.onProjectChanged(); }, 900); };

  /* ---------- bound inputs: data-bind="a.b.c" writes into the project without a re-render while typing ---------- */
  A.getPath = function (o, path) { return path.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); };
  A.setPath = function (o, path, v) { var ks = path.split("."), last = ks.pop(); var t = ks.reduce(function (a, k) { if (a[k] == null || typeof a[k] !== "object") a[k] = {}; return a[k]; }, o); if (v === "" || v == null) delete t[last]; else t[last] = v; };

  /* ---------- wallpaper ---------- */
  A.wallUrl = function () {
    if (S.screen === "home") { var p = S.projects[0]; return p && p.cover ? A.fileUrl(p.cover) : ""; }
    var p = S.project; if (!p) return "";
    if (p.studio && p.studio.wallpaper === "follow" && S.screen === "content" && S.sel.item != null) {
      var cl = A.curLeaf(), ci = A.curItem();
      if (cl && ci) { var pic = ci.cropFile ? (ci.thumb || ci.cropFile) : (ci.thumb || ci.poster || (ci.pages && (ci.thumbs ? ci.thumbs[0] : ci.pages[0])) || ci.file); if (pic && !/\.(mp4|mov|webm|m4v)$/i.test(pic)) return A.mediaUrl(pic); }
    }
    for (var i = 0; i < p.sections.length; i++) { var s = p.sections[i]; var c = s.cover && s.cover.file ? (s.cover.kind === "video" ? s.cover.poster : s.cover.file) : null; if (c) return A.mediaUrl(c); }
    var l = p.sections.map(function (s) { return A.leaves(s)[0]; }).filter(function (l) { return l && l.items && l.items.length; })[0];
    if (l) { var it = l.items[0]; return A.mediaUrl(it.thumb || it.poster || it.file); }
    return "";
  };

  /* ---------- shell ---------- */
  A.rail = function () {
    var a = S.screen, dlg = S.dialog && S.dialog.kind;
    function rb(icon, id, tip, extra) { return '<span class="rb' + (a === id && !dlg ? " on" : "") + (extra || "") + '" data-act="nav" data-to="' + id + '" title="' + tip + '" role="button" tabindex="0">' + ic(icon, 21) + "</span>"; }
    return '<aside class="gl rail"><div class="logo" title="Presento"><img src="brand/mark.svg" alt="Presento"></div>' + rb("folder", "home", "Projects") + (S.project ? rb("image", "content", "Content") + rb("sliders", "look", "Look") + rb("page", "settings", "Settings") : "") + rb("layout", "design", "Design (Phase 2)", " soon") +
      '<span class="sp"></span><span class="rb' + (S.share.st.on ? " sharing on" : S.share.open ? " on" : "") + '" data-act="share-open" title="Share on network" role="button" tabindex="0">' + ic("wifi", 21) + "</span>" + (S.project ? '<span class="rb' + (dlg === "preview" ? " on" : "") + '" data-act="preview" title="Preview" role="button" tabindex="0">' + ic("play", 19) + "</span>" : "") + "</aside>";
  };
  A.top = function (title, status, right) {
    var proj = S.project;
    return '<header class="gl top"><div class="tl">' + (S.screen === "home" ? "" : '<span class="ib bk" data-act="nav" data-to="home" title="Back to projects" role="button" tabindex="0">' + ic("chev", 16) + "</span>") +
      '<span class="crumb"><i></i><b>' + A.esc(S.screen === "home" ? "Projects" : proj ? proj.name : "") + '</b></span></div><div class="ctr"><b>' + A.esc(title) + "</b><em>" + A.esc(status || "") + '</em></div><div class="tr">' + (right || "") + "</div></header>";
  };
  A.topRight = function () {
    var sizes = { "1920x1080": "1920×1080", "3840x2160": "4K", "1280x720": "1280×720", "1024x768": "Projector 1024×768", "1180x820": "Tablet 1180×820" };
    return '<span class="seg"><span class="' + (S.mode === "desktop" ? "on" : "") + '" data-act="mode" data-v="desktop" role="button" tabindex="0">' + ic("desktop", 15) + 'Desktop</span><span class="' + (S.mode === "touch" ? "on" : "") + '" data-act="mode" data-v="touch" role="button" tabindex="0">' + ic("tablet", 15) + 'Touch</span></span>' +
      '<span class="pill" data-act="size-menu" role="button" tabindex="0">' + (sizes[S.size] || S.size) + " " + ic("chev", 13) + '</span><span class="pill" data-act="preview" role="button" tabindex="0">' + ic("play", 13) + 'Preview</span><span class="pill pri" data-act="export" role="button" tabindex="0">Export ' + ic("export", 16) + "</span>";
  };
  A.statusText = function () { if (S.share.st.on) return "sharing · " + S.share.st.devices.filter(function (d) { return d.live; }).length + " watching"; return S.saved === "saving" ? "saving…" : S.importing ? "importing " + S.importing.total + " files" : S.saved === "saved" ? "saved · " + A.ago(S.savedAt) : ""; };

  /* ---------- render ---------- */
  A.render = function () {
    var root = A.$("#root"), wall = A.wallUrl();
    var scr = A.screens[S.screen] ? A.screens[S.screen]() : "";
    var dlg = S.dialog ? A.dialogs[S.dialog.kind]() : "";
    var menu = (S.menu ? A.menuHtml() : "") + (S.share.open ? A.sharePop() : "");
    var keep = A.$(".wall") ? A.$(".wall").style.backgroundImage : "";
    A.paintWall(wall);
    root.innerHTML = '<div class="e-app' + (S.dragOver ? " dragover" : "") + '">' + A.rail() + scr + dlg + menu + (S.toast ? '<div class="toast">' + A.esc(S.toast) + "</div>" : "") + "</div>";
    if (A.after) A.after();
  };
  A.menuHtml = function () {
    var m = S.menu; return '<div class="menu-scrim" data-act="menu-close"></div><div class="menu gl" style="left:' + m.x + "px;top:" + m.y + 'px">' + m.items.map(function (it) { return '<div class="mi' + (it.danger ? " dn" : "") + '" data-act="' + it.act + '" data-v="' + A.esc(it.v || "") + '" role="button" tabindex="0">' + A.esc(it.label) + "</div>"; }).join("") + "</div>";
  };
  A.openMenu = function (e, items) { var r = e.target.getBoundingClientRect(); S.menu = { x: Math.min(r.left, window.innerWidth - 220), y: r.bottom + 6, items: items }; A.render(); };
  /* wallpaper: two persistent layers that cross-fade (600 ms) when the picture changes */
  var wl = null, wlCur = "", wlTop = 0;
  A.paintWall = function (url) {
    if (!wl) {
      wl = [document.createElement("div"), document.createElement("div")]; var w2 = document.createElement("div"); w2.className = "wall2";
      wl.forEach(function (d) { d.className = "wall"; d.style.cssText = "opacity:0;transition:opacity .6s cubic-bezier(.22,1,.36,1)"; document.body.insertBefore(d, document.body.firstChild); }); document.body.insertBefore(w2, wl[1].nextSibling);
    }
    if (url === wlCur) return; wlCur = url; wlTop = 1 - wlTop;
    var on = wl[wlTop], off = wl[1 - wlTop]; on.style.backgroundImage = url ? "url(" + url + ")" : ""; on.style.opacity = url ? 1 : 0; off.style.opacity = 0;
  };
  A.screens = {}; A.dialogs = {}; A.actions = {};
})();
