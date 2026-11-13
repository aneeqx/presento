/* Presento renderer: events, actions, import flow, trim timeline, crop tool, preview portal, export flow, startup. */
(function () {
  "use strict";
  var A = window.A, S = A.S, api = window.api, esc = A.esc;
  var Act = A.actions;

  /* ================= selection / project open ================= */
  function selectFirst() {
    var s = A.secs()[0]; S.sel = { sec: s ? s.id : null, sub: s && s.children && s.children.length ? s.children[0].id : null, item: null };
  }
  function openProject(dir) {
    return api.load(dir).then(function (p) { S.dir = dir; S.project = p; S.attn = []; S.importLog = null; S.saved = "saved"; S.savedAt = Date.now(); S.filter = "all"; selectFirst(); S.screen = "content"; S.dialog = null; A.render(); }, A.err);
  }
  function refreshProjects() { return api.listProjects().then(function (l) { S.projects = l; }); }
  function goHome() { return A.flush().then(refreshProjects).then(function () { S.screen = "home"; S.project = null; S.dir = null; S.dialog = null; A.render(); }); }
  function item() { return A.curItem(); }
  function book_len() { var l = A.curLeaf(); var b = l.items[S.sel.item || 0]; return b ? b.pages.length : 0; }
  function toggle(obj, key) { obj[key] = !obj[key]; }

  /* ================= actions ================= */
  Act["nav"] = function (t) { var to = t.dataset.to; if (to === "home") return goHome(); if (!S.project) return; S.screen = to; S.dialog = null; if (to === "content") S.sel.item = null; A.render(); };
  Act["mode"] = function (t) { S.mode = t.dataset.v; A.render(); A.onProjectChanged(true); };
  Act["size-menu"] = function (t, e) { A.openMenu(e, A.SIZES.map(function (s) { return { label: s[1], act: "set-size", v: s[0] }; })); };
  Act["set-size"] = function (t) { S.size = t.dataset.v; S.menu = null; A.render(); };
  Act["menu-close"] = function () { S.menu = null; A.render(); };
  Act["dlg-close"] = function () { if (S.dialog && S.dialog.kind === "export" && S.dialog.step === "progress") return; S.dialog = null; A.render(); };
  Act["preview"] = function () { S.dialog = { kind: "preview" }; A.render(); A.onProjectChanged(true); };
  Act["pv-fit"] = function () { S.pvFit = S.pvFit === false; A.render(); };
  Act["pv-restart"] = function () { A.onProjectChanged(true); };

  /* ----- projects home ----- */
  Act["open-project"] = function (t) { return openProject(t.dataset.v); };
  Act["dup-project"] = function (t) { A.toast("Duplicating…"); return api.duplicateProject(t.dataset.v).then(refreshProjects).then(function () { S.toast = null; A.render(); A.toast("Duplicated."); }, A.err); };
  Act["proj-menu"] = function (t, e) { e.stopPropagation(); var d = t.dataset.v; A.openMenu(e, [{ label: "Open", act: "open-project", v: d }, { label: "Duplicate", act: "dup-project", v: d }, { label: "Show in folder", act: "reveal-project", v: d }, { label: "Rename", act: "rename-project", v: d }, { label: "Delete (to Recycle Bin)", act: "delete-project", v: d, danger: 1 }]); };
  Act["reveal-project"] = function (t) { S.menu = null; A.render(); api.reveal(t.dataset.v + "\\project.json"); };
  Act["rename-project"] = function (t) { S.menu = null; var p = S.projects.filter(function (x) { return x.dir === t.dataset.v; })[0]; S.dialog = { kind: "rename", dir: t.dataset.v, name: p ? p.name : "" }; A.render(); };
  Act["rename-do"] = function () { var n = A.$("#rn-name").value.trim(); if (!n) return; api.renameProject(S.dialog.dir, n).then(refreshProjects).then(function () { S.dialog = null; A.render(); }, A.err); };
  Act["delete-project"] = function (t) { S.menu = null; S.dialog = { kind: "confirm", title: "Delete this project?", text: "The whole folder, media included, moves to the Recycle Bin.", label: "Delete", danger: 1, act: "delete-project-do", v: t.dataset.v }; A.render(); };
  Act["delete-project-do"] = function (t) { api.deleteProject(t.dataset.v).then(refreshProjects).then(function () { S.dialog = null; A.render(); }, A.err); };
  Act["set-root"] = function () { api.setRoot().then(function (d) { if (!d) return; return api.info().then(function (i) { S.info = i; return refreshProjects(); }).then(function () { A.render(); }); }, A.err); };
  Act["open-folder"] = function () { api.openFolder().then(function (d) { if (d) return openProject(d); }, A.err); };
  Act["new-project"] = function () { S.dialog = { kind: "newproject", name: "", kind2: S.info && S.info.templates.length ? "t:" + S.info.templates[0].dir : "blank" }; A.render(); };
  Act["new-blank"] = function () { S.dialog = { kind: "newproject", name: "", kind2: "blank" }; A.render(); };
  Act["new-from-template"] = function (t) { S.dialog = { kind: "newproject", name: "", kind2: "t:" + t.dataset.v }; A.render(); };
  Act["np-kind"] = function (t) { S.dialog.name = A.$("#np-name").value; S.dialog.kind2 = t.dataset.v; A.render(); var i = A.$("#np-name"); i && i.focus(); };
  Act["np-create"] = function () {
    var d = S.dialog, name = A.$("#np-name").value.trim(); if (!name) { A.toast("Give the project a name."); return; }
    var tdir = d.kind2.indexOf("t:") === 0 ? d.kind2.slice(2) : null;
    A.toast(tdir ? "Copying the template…" : "Creating…");
    api.createProject({ kind: tdir ? "template" : "blank", name: name, templateDir: tdir }).then(function (dir) { return refreshProjects().then(function () { return openProject(dir); }); }, A.err);
  };
  A.dialogs.rename = function () { var d = S.dialog; return '<div class="scrim"><div class="dlg" style="width:520px"><div class="dh"><div><h2>Rename project</h2></div></div><div class="db"><div class="field"><label>name</label><input class="in" id="rn-name" value="' + esc(d.name) + '" maxlength="60"></div></div><div class="df"><span class="grow"></span><span class="pill" data-act="dlg-close" role="button" tabindex="0">Cancel</span><span class="pill pri" data-act="rename-do" role="button" tabindex="0">Rename</span></div></div></div>'; };

  /* ----- structure ----- */
  Act["sel-sec"] = function (t) { var s = A.secs().filter(function (x) { return x.id === t.dataset.sec; })[0]; if (!s) return; S.sel = { sec: s.id, sub: s.children && s.children.length ? (S.sel.sec === s.id && S.sel.sub ? S.sel.sub : s.children[0].id) : null, item: null }; S.filter = "all"; A.render(); };
  Act["sel-sub"] = function (t) { S.sel = { sec: t.dataset.sec, sub: t.dataset.sub, item: null }; S.filter = "all"; A.render(); };
  Act["sel-item"] = function (t) { S.sel.item = +t.dataset.i; A.render(); };
  Act["item-close"] = function () { S.sel.item = null; A.render(); };
  Act["toggle-hide"] = function (t, e) {
    e.stopPropagation(); var s = A.secs().filter(function (x) { return x.id === t.dataset.sec; })[0]; if (!s) return;
    var tgt = t.dataset.sub ? s.children.filter(function (c) { return c.id === t.dataset.sub; })[0] : s; toggle(tgt, "hidden"); A.touch(); A.render();
  };
  Act["add-section"] = function () {
    var secs = A.secs(), id = A.uid("new-section", secs.map(function (s) { return s.id; }));
    secs.push({ id: id, title: "New section", blurb: "", icon: "grid", hidden: false, type: "gallery", items: [] });
    S.sel = { sec: id, sub: null, item: null }; S.screen = "content"; A.touch(); A.render();
    setTimeout(function () { var i = A.$('[data-bind="sec.title"]'); if (i) { i.focus(); i.select(); } }, 50);
  };
  Act["add-sub"] = function () {
    var s = A.curSec(); if (!s) return;
    if (!(s.children && s.children.length)) {                                          // a leaf becomes a parent: its content moves into the first sub-section
      var first = { id: A.slug(s.title) === s.id ? "main" : "main", title: s.title, type: s.type, hidden: false };
      if (s.social) first.social = s.social; else first.items = s.items || [];
      delete s.type; delete s.items; delete s.social; s.children = [first];
    }
    var id = A.uid("new-sub", s.children.map(function (c) { return c.id; }));
    s.children.push({ id: id, title: "New sub-section", type: "gallery", hidden: false, items: [] });
    S.sel = { sec: s.id, sub: id, item: null }; A.touch(); A.render();
  };
  Act["delete-leaf"] = function () {
    var s = A.curSec(), l = A.curLeaf(), isSub = s.children && s.children.length && S.sel.sub;
    S.dialog = { kind: "confirm", title: "Delete " + (isSub ? "sub-section “" + l.title + "”" : "section “" + s.title + "”") + "?", text: "Its items are removed from the presentation. The files stay in the project's media folder.", label: "Delete", danger: 1, act: "delete-leaf-do" }; A.render();
  };
  Act["delete-leaf-do"] = function () {
    var s = A.curSec(), secs = A.secs(), isSub = s.children && s.children.length && S.sel.sub;
    if (isSub) { s.children = s.children.filter(function (c) { return c.id !== S.sel.sub; }); if (!s.children.length) { delete s.children; s.type = "gallery"; s.items = []; } S.sel = { sec: s.id, sub: s.children ? s.children[0].id : null, item: null }; }
    else { var i = secs.indexOf(s); secs.splice(i, 1); var n = secs[Math.min(i, secs.length - 1)]; S.sel = { sec: n ? n.id : null, sub: n && n.children ? n.children[0].id : null, item: null }; }
    S.dialog = null; A.touch(); A.render();
  };
  Act["move-sec"] = function (t) {
    var d = +t.dataset.v, s = A.curSec(); if (!s) return;
    var arr = s.children && s.children.length && S.sel.sub ? s.children : A.secs(), cur = arr === A.secs() ? s : A.curLeaf(), i = arr.indexOf(cur), j = i + d;
    if (j < 0 || j >= arr.length) return; arr.splice(i, 1); arr.splice(j, 0, cur); A.touch(); A.render();
  };
  Act["set-icon"] = function (t) { A.curSec().icon = t.dataset.v; A.touch(); A.render(); };
  Act["set-type"] = function (t) {
    var l = A.curLeaf(), v = t.dataset.v; if (l.type === v) return;
    if (A.itemCount(l)) { A.toast("Empty the section first: items of one type can't become another."); return; }
    l.type = v; if (v === "social") { l.social = { profile: { username: "", name: "", category: "", avatar: "", bio: [], link: "", verified: false, stats: { followers: "", following: "" } }, highlights: [], posts: [] }; delete l.items; } else { delete l.social; l.items = l.items || []; }
    A.touch(); A.render();
  };
  Act["filter"] = function (t) { S.filter = t.dataset.v; A.render(); };
  Act["pick-cover"] = function () {
    var s = A.curSec(); api.pick({ kind: "image" }).then(function (paths) {
      if (!paths) return; return api.importMedia({ dir: S.dir, rel: "media/" + s.id, type: "gallery", paths: [paths[0]] }).then(function (r) {
        if (r.items[0]) { s.cover = { kind: "image", file: r.items[0].file }; A.touch(); A.render(); } else A.toast((r.warnings[0] || {}).msg || "Could not use that file.");
      });
    }, A.err);
  };

  /* ----- items ----- */
  Act["item-hide"] = function () { var it = item(); toggle(it, "hidden"); A.touch(); A.render(); };
  Act["item-delete"] = function () { S.dialog = { kind: "confirm", title: "Remove “" + item().title + "”?", text: "It is removed from the presentation. The file stays in the project's media folder.", label: "Remove", danger: 1, act: "item-delete-do" }; A.render(); };
  Act["item-delete-do"] = function () { var l = A.curLeaf(); l.items.splice(S.sel.item, 1); S.sel.item = null; S.dialog = null; A.touch(); A.render(); };
  Act["item-move"] = function (t) { var l = A.curLeaf(), i = S.sel.item, j = i + +t.dataset.v; if (j < 0 || j >= l.items.length) return; var it = l.items.splice(i, 1)[0]; l.items.splice(j, 0, it); S.sel.item = j; A.touch(); A.render(); };
  Act["use-frame"] = function () {
    var v = A.$("#vid"), it = item(); if (!v) return;
    api.videoFrame({ dir: S.dir, file: it.file, t: v.currentTime }).then(function (rel) { it.poster = rel; A.touch(); A.render(); A.toast("Cover frame set."); }, A.err);
  };
  Act["attn-keep"] = function (t) { S.attn.splice(+t.dataset.i, 1); A.render(); };
  Act["attn-dismiss"] = Act["attn-keep"];
  Act["attn-remove"] = function (t) {
    var x = S.attn[+t.dataset.i]; S.attn.splice(+t.dataset.i, 1);
    if (x && x.rel) A.secs().forEach(function (s) { A.leaves(s).forEach(function (l) { if (l.items) l.items = l.items.filter(function (it) { return it.file !== x.rel; }); }); });
    if (x && x.rel) api.removeMedia(S.dir, [x.rel]);
    S.sel.item = null; A.touch(); A.render();
  };

  /* ================= import ================= */
  function toProjectItem(l, im, warns) {
    if (l.type === "films") return { file: im.file, poster: im.poster || undefined, title: im.title, meta: im.meta, caption: "", duration: im.duration, w: im.w, h: im.h, codec: im.codec || undefined, fixedFastStart: im.fixedFastStart || undefined };
    if (l.type === "panoramas") return { file: im.file, thumb: im.thumb || undefined, title: im.title, meta: "", w: im.w, h: im.h };
    if (l.type === "links") return { file: im.file, thumb: im.thumb || undefined, title: im.title, url: "https://", warn: "Set the link address" };
    return { file: im.file, thumb: im.thumb || undefined, w: im.w, h: im.h, title: im.title, caption: "" };
  }
  function startImport(paths) {
    var l = A.curLeaf(), sec = A.curSec();
    if (!l) { A.toast("Add a section first."); return; }
    if (S.importing) { A.toast("An import is already running."); return; }
    if (l.type === "flipbook" || paths.some(function (p) { return /\.pdf$/i.test(p); })) { return A.importPdfFiles(paths); }
    if (l.type === "social") { A.toast("Drop images onto a post or highlight in the Social editor."); return; }
    var rel = "media/" + sec.id + (sec.children && sec.children.length ? "/" + l.id : "");
    S.importing = { total: paths.length, i: 0, name: "", phase: "starting", bytes: 0, seconds: 0, pending: [] };
    S.importLog = null; S.screen = "content"; A.render();
    var off = api.onImportProgress(function (p) {
      var im = S.importing; if (!im) return;
      im.total = p.total; im.i = p.i; im.name = p.name; im.phase = p.phase; im.bytes = p.bytes; im.seconds = p.seconds;
      im.pending = new Array(Math.max(0, Math.min(4, p.total - p.i)));
      var card = A.$("#impcard"); if (card) card.outerHTML = A.importCard(); else A.render();
    });
    api.importMedia({ dir: S.dir, rel: rel, type: l.type, paths: paths }).then(function (r) {
      off();
      var warns = r.warnings;
      r.items.forEach(function (im) {
        var it = toProjectItem(l, im, warns);
        var w = warns.filter(function (x) { return x.rel && x.rel === im.file && x.action === "keep-remove"; })[0]; if (w) it.warn = w.msg;
        (l.items = l.items || []).push(it);
      });
      S.attn = S.attn.concat(warns.filter(function (x) { return x.level !== "info" || true; }));
      S.importLog = r.log; S.importing = null; A.touch(); A.render();
      A.toast("Imported " + r.items.length + " of " + r.total + (warns.length ? " · " + warns.length + " notes" : ""));
    }, function (e) { off(); S.importing = null; A.err(e); A.render(); });
  }
  A.startImport = startImport;
  Act["import-pick"] = function () { api.pick({ kind: A.curLeaf() && A.curLeaf().type === "films" ? "video" : "media" }).then(function (p) { if (p && p.length) startImport(p); }, A.err); };
  Act["import-folder"] = function () { api.pick({ kind: "folder" }).then(function (p) { if (p && p.length) startImport(p); }, A.err); };
  Act["import-cancel"] = function () { api.cancelImport(); };

  /* ================= look ================= */
  function look() { return S.project.look || (S.project.look = {}); }
  Act["look-tab"] = function (t) { S.lookTab = t.dataset.v; A.render(); A.onProjectChanged(true); };
  Act["set-look"] = function (t) { look()[t.dataset.k] = t.dataset.v; A.touch(); A.render(); };
  Act["preset"] = function (t) { var p = A.PRESETS.filter(function (x) { return x.id === t.dataset.v; })[0]; look().bg = p.bg; look().accent = p.accent; if (p.ink) look().ink = p.ink; else delete look().ink; A.touch(); A.render(); };
  Act["look-reset"] = function () { S.project.look = { bg: "#F9F9F7", accent: "#2FED97", font: "Urbanist", logoSize: 1, panelHeight: null, panelGap: null, labelShadow: 1 }; A.touch(); A.render(); };

  /* ================= settings ================= */
  function st() { return S.project.settings || (S.project.settings = {}); }
  Act["settings-tab"] = function (t) { S.settingsTab = t.dataset.v; A.render(); };
  function pickImport(kind, rel, type, then) {
    return api.pick({ kind: kind }).then(function (p) {
      if (!p) return; return api.importMedia({ dir: S.dir, rel: rel, type: type, paths: [p[0]] }).then(function (r) {
        if (!r.items[0]) { A.toast((r.warnings[0] || {}).msg || "Could not use that file."); return; }
        then(r.items[0]); A.touch(); A.render();
      });
    }).catch(A.err);
  }
  Act["pick-brand-logo"] = function () { pickImport("image", "media/brand", "gallery", function (it) { (st().brand = st().brand || {}).logo = it.file; }); };
  Act["clear-brand-logo"] = function () { delete st().brand.logo; A.touch(); A.render(); };
  Act["pick-intro"] = function () { pickImport("video", "media/brand", "films", function (it) { var i = st().intro = st().intro || {}; i.video = it.file; i.enabled = true; if (i.handoff == null) i.handoff = 0; }); };
  Act["clear-intro"] = function () { st().intro = { enabled: false, video: null, handoff: 0 }; A.touch(); A.render(); };
  Act["tog-intro"] = function () { var i = st().intro = st().intro || {}; i.enabled = i.enabled === false; A.touch(); A.render(); };
  Act["fold-tree"] = function () { S.fold = !S.fold; try { localStorage.setItem("fold", S.fold ? "1" : "0"); } catch (e) { /* ignore */ } A.render(); };
  Act["set-wall"] = function (t) { var st2 = S.project.studio = S.project.studio || {}; if (t.dataset.v === "follow") st2.wallpaper = "follow"; else delete st2.wallpaper; A.touch(); A.render(); };
  Act["tog-skip"] = function () { var i = st().intro = st().intro || {}; if (i.allowSkip === false) delete i.allowSkip; else i.allowSkip = false; A.touch(); A.render(); };
  Act["tog-gate"] = function () { st().startGate = st().startGate === false; A.touch(); A.render(); };
  Act["tag-add"] = function () { var b = st().brand = st().brand || {}; (b.taglines = b.taglines || []).push("New tagline"); A.touch(); A.render(); };
  Act["tag-del"] = function (t) { st().brand.taglines.splice(+t.dataset.i, 1); A.touch(); A.render(); };
  Act["tag-up"] = function (t) { var a = st().brand.taglines, i = +t.dataset.i; if (i > 0) { a.splice(i - 1, 0, a.splice(i, 1)[0]); A.touch(); A.render(); } };
  Act["bg-add"] = function () { pickImport("video", "media/background", "films", function (it) { var b = st().background = st().background || { videos: [] }; (b.videos = b.videos || []).push({ file: it.file }); }); };
  Act["bg-del"] = function (t) { st().background.videos.splice(+t.dataset.i, 1); A.touch(); A.render(); };
  Act["ct-add"] = function () { var c = st().contact = st().contact || { heading: "", subline: "", items: [] }; (c.items = c.items || []).push({ label: "Phone", value: "" }); A.touch(); A.render(); };
  Act["ct-del"] = function (t) { st().contact.items.splice(+t.dataset.i, 1); A.touch(); A.render(); };
  function hrefFor(v) { v = String(v).trim(); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "mailto:" + v; if (/^\+?[\d\s().-]{7,}$/.test(v)) return "tel:" + v.replace(/[^\d+]/g, ""); if (/^(https?:\/\/|www\.)/i.test(v)) return /^www\./i.test(v) ? "https://" + v : v; return ""; }

  /* ================= crop ================= */
  Act["crop-open"] = function () {
    var it = item(), im = new Image();
    im.onload = function () { S.dialog = { kind: "crop", rect: it.crop ? { x: it.crop.x, y: it.crop.y, w: it.crop.w, h: it.crop.h } : { x: 0, y: 0, w: 1, h: 1 }, sw: im.naturalWidth, sh: im.naturalHeight, aspect: "free" }; A.render(); };
    im.onerror = function () { A.toast("This image could not be opened."); };
    im.src = A.mediaUrl(it.file);
  };
  Act["crop-reset"] = function () { S.dialog.rect = { x: 0, y: 0, w: 1, h: 1 }; S.dialog.aspect = "free"; A.render(); };
  Act["crop-aspect"] = function (t) { var d = S.dialog; d.aspect = t.dataset.v; var ar = aspectVal(d); if (ar) { var r = d.rect, W = d.sw, H = d.sh, cx = r.x + r.w / 2, cy = r.y + r.h / 2, w = r.w, h = w * W / (ar * H); if (h > 1) { h = 1; w = h * ar * H / W; } if (w > 1) { w = 1; h = w * W / (ar * H); } d.rect = { x: Math.min(1 - w, Math.max(0, cx - w / 2)), y: Math.min(1 - h, Math.max(0, cy - h / 2)), w: w, h: h }; } A.render(); };
  function aspectVal(d) { if (d.aspect === "orig") return d.sw / d.sh; var m = /^(\d+):(\d+)$/.exec(d.aspect); return m ? +m[1] / +m[2] : 0; }
  Act["crop-save"] = function () {
    var d = S.dialog, it = item(), l = A.curLeaf();
    api.crop({ dir: S.dir, file: it.file, rect: d.rect }).then(function (r) {
      if (!it.cropFile && it.thumb) it.thumbOrig = it.thumb;
      it.crop = { x: +d.rect.x.toFixed(5), y: +d.rect.y.toFixed(5), w: +d.rect.w.toFixed(5), h: +d.rect.h.toFixed(5) };
      it.cropFile = r.cropFile; it.cropW = r.w; it.cropH = r.h; it.thumb = r.thumb;
      S.dialog = null; A.touch(); A.render(); A.toast("Saved a lossless PNG copy (" + r.w + " × " + r.h + "). The original is kept.");
    }, A.err);
  };
  Act["crop-restore"] = function () { var it = item(); delete it.crop; delete it.cropFile; delete it.cropW; delete it.cropH; if (it.thumbOrig) { it.thumb = it.thumbOrig; delete it.thumbOrig; } A.touch(); A.render(); };

  function mountCrop() {
    var wrap = A.$("#cropwrap"), img = A.$("#cropimg"), box = A.$("#crect"); if (!wrap || !img || !box) return;
    var d = S.dialog;
    function fit() {                                                         // place the rectangle over the displayed image
      var wr = wrap.getBoundingClientRect(), br = img.getBoundingClientRect(), r = d.rect, k = Math.min(br.width / d.sw, br.height / d.sh), cw = d.sw * k, ch = d.sh * k;
      var ir = { left: br.left + (br.width - cw) / 2, top: br.top + (br.height - ch) / 2, width: cw, height: ch };
      d.ir = ir;
      box.style.left = (ir.left - wr.left + r.x * ir.width) + "px"; box.style.top = (ir.top - wr.top + r.y * ir.height) + "px"; box.style.width = r.w * ir.width + "px"; box.style.height = r.h * ir.height + "px";
      var pw = Math.round(r.w * d.sw), ph = Math.round(r.h * d.sh);
      var res = A.$("#cropres"); if (res) res.textContent = pw.toLocaleString("en-US") + " × " + ph.toLocaleString("en-US");
      var nt = A.$("#cropnote"); if (nt) nt.textContent = Math.round(r.w * 100) + " % of the original width" + (pw < 1920 && ph < 1080 ? " · below full HD" : "");
    }
    img.addEventListener("load", fit); if (img.complete) fit(); window.addEventListener("resize", fit);
    var drag = null;
    box.addEventListener("pointerdown", function (e) {
      drag = { c: e.target.dataset.c || "move", x: e.clientX, y: e.clientY, r: Object.assign({}, d.rect), ir: d.ir }; box.setPointerCapture(e.pointerId); e.preventDefault();
    });
    box.addEventListener("pointermove", function (e) {
      if (!drag) return; var dx = (e.clientX - drag.x) / drag.ir.width, dy = (e.clientY - drag.y) / drag.ir.height, o = drag.r, c = drag.c;
      var l = o.x, t = o.y, r = o.x + o.w, b = o.y + o.h, min = 0.02;
      if (c === "move") { l = Math.min(1 - o.w, Math.max(0, o.x + dx)); t = Math.min(1 - o.h, Math.max(0, o.y + dy)); r = l + o.w; b = t + o.h; }
      else { if (/w/.test(c)) l = Math.min(r - min, Math.max(0, o.x + dx)); if (/e/.test(c)) r = Math.max(l + min, Math.min(1, o.x + o.w + dx)); if (/n/.test(c)) t = Math.min(b - min, Math.max(0, o.y + dy)); if (/s/.test(c)) b = Math.max(t + min, Math.min(1, o.y + o.h + dy)); }
      var ar = aspectVal(d);
      if (ar && c !== "move") {                                              // keep the ratio: width leads on corners/sides e-w, height on n-s
        var W = d.sw, H = d.sh, w = r - l, h = b - t;
        if (c === "n" || c === "s") { w = h * H * ar / W; if (/n|s/.test(c)) { var cx = (l + r) / 2; l = cx - w / 2; r = cx + w / 2; } }
        else { h = w * W / (ar * H); if (c === "e" || c === "w") { var cy = (t + b) / 2; t = cy - h / 2; b = cy + h / 2; } else if (/n/.test(c)) t = b - h; else b = t + h; }
        if (l < 0 || r > 1 || t < 0 || b > 1) return;
      }
      d.rect = { x: l, y: t, w: r - l, h: b - t }; fit();
    });
    box.addEventListener("pointerup", function () { drag = null; });
  }

  /* ================= trim timeline ================= */
  var stripCache = {};
  function mountTrim() {
    var vid = A.$("#vid"), strip = A.$("#strip"), it = item(), l = A.curLeaf(); if (!vid || !strip || !it || l.type !== "films") return;
    var dur = it.duration || 0;
    function paint() {
      var s = it.start || 0, e = it.end || dur, f1 = dur ? s / dur * 100 : 0, f2 = dur ? e / dur * 100 : 100;
      A.$("#cutL").style.width = f1 + "%"; var cr = A.$("#cutR"); cr.style.left = f2 + "%"; A.$("#wsel").style.left = f1 + "%"; A.$("#wsel").style.width = (f2 - f1) + "%";
      A.$("#hdS").style.left = f1 + "%"; A.$("#hdE").style.left = f2 + "%";
      var rng = A.$("#rngT"); if (rng) { rng.querySelector("i").style.left = f1 + "%"; rng.querySelector("i").style.width = (f2 - f1) + "%"; rng.querySelectorAll("b")[0].style.left = f1 + "%"; rng.querySelectorAll("b")[1].style.left = f2 + "%"; }
      var a = A.$("#trimS"), b = A.$("#trimE"), p = A.$("#trimP"); if (a && document.activeElement !== a) a.value = A.fmtTime(s, true); if (b && document.activeElement !== b) b.value = A.fmtTime(e, true); if (p) p.textContent = A.fmtTime(e - s, true);
    }
    function commit(s, e) {
      s = Math.max(0, Math.min(s, dur)); e = Math.max(0, Math.min(e, dur));
      if (e - s < 0.2) { if (s > it.end || 0) s = Math.max(0, e - 0.2); else e = Math.min(dur, s + 0.2); }
      if (s <= 0.04) delete it.start; else it.start = +s.toFixed(2);
      if (e >= dur - 0.04) delete it.end; else it.end = +e.toFixed(2);
      paint(); A.touch();
    }
    A.trim = { set: commit };
    vid.addEventListener("loadedmetadata", function () { if (!it.duration && vid.duration) { it.duration = +vid.duration.toFixed(3); dur = it.duration; A.touch(); A.render(); } });
    vid.addEventListener("timeupdate", function () {
      var e = it.end || dur; if (e && vid.currentTime >= e - 0.03 && !vid.paused) { vid.pause(); vid.currentTime = e; }
      var tc = A.$("#vtc"); if (tc) tc.textContent = A.fmtTime(vid.currentTime, true) + " / " + A.fmtTime(dur, true);
      var ph = A.$("#phd"); if (ph && dur) ph.style.left = (vid.currentTime / dur * 100) + "%";
    });
    vid.addEventListener("play", function () { A.$(".pp").style.opacity = 0; }); vid.addEventListener("pause", function () { A.$(".pp").style.opacity = ""; });
    vid.addEventListener("click", function () { Act["vid-toggle"](); });
    function fracOf(e) { var r = strip.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); }
    var drag = null;
    strip.addEventListener("pointerdown", function (e) {
      var h = e.target.dataset && e.target.dataset.h; drag = h || "play"; strip.setPointerCapture(e.pointerId);
      if (drag === "play") vid.currentTime = fracOf(e) * dur; e.preventDefault();
    });
    strip.addEventListener("pointermove", function (e) {
      if (!drag) return; var t = fracOf(e) * dur;
      if (drag === "play") vid.currentTime = t; else if (drag === "s") { commit(Math.min(t, (it.end || dur) - 0.2), it.end || dur); } else { commit(it.start || 0, Math.max(t, (it.start || 0) + 0.2)); }
    });
    strip.addEventListener("pointerup", function () { drag = null; });
    ["trimS", "trimE"].forEach(function (id) {
      var inp = A.$("#" + id); if (!inp) return;
      inp.addEventListener("change", function () { var v = A.parseTime(inp.value); if (v == null) { paint(); return; } if (id === "trimS") commit(v, it.end || dur); else commit(it.start || 0, v); });
    });
    // filmstrip: a few decoded frames behind the handles (cached per file)
    var key = it.file;
    function fill(frames) { var f = document.createElement("div"); f.className = "frames"; f.innerHTML = frames.map(function (u) { return '<img src="' + u + '" draggable="false">'; }).join(""); strip.insertBefore(f, strip.firstChild); }
    if (stripCache[key]) fill(stripCache[key]);
    else if (dur) buildStrip(A.mediaUrl(it.file), dur, 12).then(function (fr) { stripCache[key] = fr; var cur = A.$("#strip"); if (cur === strip) fill(fr); });
  }
  function buildStrip(url, dur, n) {
    return new Promise(function (resolve) {
      var v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.src = url; var out = [], i = 0;
      var c = document.createElement("canvas"); c.width = 160; c.height = 90; var g = c.getContext("2d");
      function next() { if (i >= n) { resolve(out); return; } v.currentTime = Math.min(dur - 0.1, (i + 0.5) / n * dur); }
      v.addEventListener("loadedmetadata", next);
      v.addEventListener("seeked", function () { g.drawImage(v, 0, 0, c.width, c.height); out.push(c.toDataURL("image/jpeg", 0.6)); i++; next(); });
      v.addEventListener("error", function () { resolve(out); });
    });
  }
  Act["vid-toggle"] = function () { var v = A.$("#vid"), it = item(); if (!v) return; if (v.paused) { var e = it.end || it.duration; if (v.currentTime >= e - 0.05 || v.currentTime < (it.start || 0) - 0.05) v.currentTime = it.start || 0; else if (v.currentTime < (it.start || 0)) v.currentTime = it.start || 0; v.play(); } else v.pause(); };
  Act["trim-reset"] = function () { var it = item(); delete it.start; delete it.end; A.touch(); A.render(); };

  /* ================= preview portal (a persistent iframe positioned over #devbox; survives re-renders) ================= */
  var host = document.createElement("div"); host.id = "pvhost"; host.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;z-index:45;display:none;overflow:hidden;border-radius:22px";
  var frame = document.createElement("iframe"); frame.style.cssText = "border:0;display:block;transform-origin:0 0;background:#F9F9F7"; host.appendChild(frame); document.body.appendChild(host);
  var pv = { url: null, mode: null, ver: 0, dirty: true, busy: false };
  A.onProjectChanged = function (force) { pv.dirty = true; if (A.$("#devbox") || A.$("#phonebox")) ensurePreview(force); };
  function ensurePreview(force) {
    if (pv.busy) return; if (!pv.dirty && !force && pv.mode === S.mode) return;
    pv.busy = true; pv.dirty = false; pv.mode = S.mode;
    api.publishPreview({ dir: S.dir, mode: S.mode, token: "p" + (++pv.ver) }).then(function (r) {
      pv.busy = false; pv.url = r.url; if (A.$("#devbox")) { frame.src = r.url + "index.html"; frame.onload = function () { gotoTab(); position(); }; } if (A.$("#phonebox")) { frame2.src = r.url + "phone.html"; frame2.onload = position; }
      var w = A.$("#pverr"); if (w) w.remove();
      if (pv.dirty) ensurePreview();
    }, function (e) { pv.busy = false; A.toast("Preview: " + e.message); });
  }
  function gotoTab() {
    if (S.screen !== "look" || (S.dialog && S.dialog.kind === "preview")) { if (S.dialog && S.dialog.kind === "preview") setTimeout(function () { try { frame.contentWindow.postMessage({ type: "home" }, "*"); } catch (e) { /* not loaded */ } }, 700); return; }
    var secs = A.secs().filter(function (s) { return !s.hidden; }), msg = S.lookTab === "contact" ? { type: "go", page: "contact" } : S.lookTab === "section" && secs[0] ? { type: "go", page: secs[0].id } : { type: "home" };
    setTimeout(function () { try { frame.contentWindow.postMessage(msg, "*"); } catch (e) { /* not loaded */ } }, 700);
  }
  function position() {
    var box = A.$("#devbox"), stage = box && box.parentElement;
    if (!box) { host.style.display = "none"; return; }
    var sz = S.size.split("x"), W = +sz[0], H = +sz[1], sr = stage.getBoundingClientRect();
    var availW = sr.width - 60, availH = sr.height - (S.screen === "look" ? 60 : 70);
    var sc = S.pvFit === false && S.dialog && S.dialog.kind === "preview" ? 1 : Math.min(1, availW / W, availH / H);
    box.style.width = W * sc + "px"; box.style.height = H * sc + "px";
    var r = box.getBoundingClientRect();
    host.style.display = "block"; host.style.left = r.left + "px"; host.style.top = r.top + "px"; host.style.width = r.width + "px"; host.style.height = r.height + "px";
    frame.style.width = W + "px"; frame.style.height = H + "px"; frame.style.transform = "scale(" + sc + ")";
    host.style.zIndex = S.dialog && S.dialog.kind === "preview" ? 55 : 45;
  }
  var host2 = document.createElement("div"); host2.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;z-index:45;display:none;overflow:hidden;border-radius:18px";
  var frame2 = document.createElement("iframe"); frame2.style.cssText = "border:0;width:100%;height:100%;background:transparent"; host2.appendChild(frame2); document.body.appendChild(host2);
  function position2() { var bx = A.$("#phonebox"); if (!bx) { host2.style.display = "none"; return; } var r = bx.getBoundingClientRect(); host2.style.display = "block"; host2.style.left = r.left + "px"; host2.style.top = r.top + "px"; host2.style.width = r.width + "px"; host2.style.height = r.height + "px"; host2.style.zIndex = S.dialog ? 40 : 45; }
  A.position2 = position2;
  window.addEventListener("resize", function () { position(); position2(); });

  /* ================= export ================= */
  Act["export"] = function () {
    var e = S.dialog = { kind: "export", step: "config", format: "exe", mode: S.mode, pinOn: false, pin: "", inc: {}, est: null, outDir: S.info.exportDir, zip: false, browser: true };
    A.render();
    api.estimate({ dir: S.dir }).then(function (est) { if (S.dialog !== e) return; e.est = est; est.sections.forEach(function (s) { e.inc[s.id] = !s.hidden; }); A.render(); }, A.err);
  };
  Act["exp-format"] = function (t) { S.dialog.format = t.dataset.v; A.render(); };
  Act["exp-mode"] = function (t) { S.dialog.mode = t.dataset.v; A.render(); };
  Act["exp-pin"] = function () { S.dialog.pinOn = !S.dialog.pinOn; A.render(); if (S.dialog.pinOn) { var p = A.$('[data-pin="0"]'); p && p.focus(); } };
  Act["exp-zip"] = function () { S.dialog.zip = !S.dialog.zip; A.render(); };
  Act["exp-browser"] = function () { S.dialog.browser = !S.dialog.browser; A.render(); };
  Act["exp-folder"] = function () { api.pick({ kind: "folder" }).then(function (p) { if (p) { S.dialog.outDir = p[0]; A.render(); } }); };
  Act["exp-inc"] = function (t) {
    var e = S.dialog, id = t.dataset.v, parts = id.split("/"), sec = e.est.sections.filter(function (s) { return s.id === parts[0]; })[0];
    if (sec.hidden) return;
    if (parts.length === 1) { var on = !e.inc[id]; e.inc[id] = on; sec.subs.forEach(function (c) { e.inc[id + "/" + c.id] = on; }); }
    else { e.inc[id] = e.inc[id] === false; e.inc[parts[0]] = true; if (!sec.subs.some(function (c) { return e.inc[parts[0] + "/" + c.id] !== false && !c.hidden; })) e.inc[parts[0]] = false; }
    A.render();
  };
  function includeList(e) {
    var all = true, list = [];
    e.est.sections.forEach(function (s) {
      if (s.hidden) return; if (!e.inc[s.id]) { all = false; return; }
      var subs = s.subs.filter(function (c) { return !c.hidden; });
      if (!subs.length || subs.every(function (c) { return e.inc[s.id + "/" + c.id] !== false; })) list.push(s.id);
      else { all = false; subs.forEach(function (c) { if (e.inc[s.id + "/" + c.id] !== false) list.push(s.id + "/" + c.id); }); }
    });
    return all ? null : list;
  }
  var offStep = null, offProg = null, tick = 0;
  function runExport() {
    var e = S.dialog; e.step = "progress"; e.cur = "collect"; e.detail = ""; e.bytes = 0; e.t0 = Date.now(); A.render();
    offStep = api.onExportStep(function (p) { e.cur = p.step; e.detail = p.detail || ""; A.render(); });
    offProg = api.onExportProgress(function (p) {
      e.bytes = p.bytes; e.file = p.file; var total = A.exportEst(e).media || 1, pct = Math.min(90, 8 + Math.round(p.bytes / total * 80));
      var b = A.$("#expBar"), n = A.$("#expPct"), t = A.$("#stp-pack"); if (b) b.style.width = pct + "%"; if (n) n.textContent = pct; if (t) t.textContent = (e.detail || "") + " · " + String(p.file).split("/").pop();
    });
    tick = setInterval(function () { var t = A.$("#expTime"); if (t) t.textContent = Math.round((Date.now() - e.t0) / 1000) + " s"; }, 1000);
    var inc = includeList(e);
    api.runExport({ dir: S.dir, format: e.format, mode: e.mode, pin: e.pinOn ? e.pin : null, include: inc, outDir: e.outDir, zip: e.zip, browser: e.browser }).then(function (r) {
      cleanupExport(); e.result = r; e.finishing = true; A.render(); setTimeout(function () { e.step = "report"; A.render(); }, 350);
    }, function (err) { cleanupExport(); e.step = "report"; e.error = err.message; e.cancelled = /cancel/i.test(err.message); A.render(); });
  }
  function cleanupExport() { clearInterval(tick); offStep && offStep(); offProg && offProg(); }
  Act["exp-go"] = function () { var e = S.dialog; if (e.format === "html" && A.exportEst(e).html > 1073741824) return; if (e.pinOn && (e.pin || "").length !== 4) return; runExport(); };
  Act["exp-cancel"] = function () { api.cancelExport(); };
  Act["exp-again"] = function () { runExport(); };
  Act["exp-reveal"] = function () { var r = S.dialog.result; api.reveal(r.file); };
  Act["exp-copy"] = function () { navigator.clipboard.writeText(S.dialog.format === "exe" ? S.dialog.result.dir : S.dialog.result.file).then(function () { A.toast("Path copied."); }); };
  Act["exp-test"] = function () { var r = S.dialog.result; if (S.dialog.format === "exe") A.toast("Starting the app fullscreen. Close it with Alt+F4."); api.openPath(r.file); };


  /* ================= network share ================= */
  var shareTimer = 0;
  function shareStatus() { return api.shareStatus().then(function (st) { S.share.st = st; if (st.on && (!S.share.qr || S.share.qrUrl !== st.url)) { S.share.qrUrl = st.url; return api.shareQr(st.url).then(function (q) { S.share.qr = q; }); } }); }
  function shareRefresh() { return shareStatus().then(function () { if (S.share.open || S.share.st.on) A.render(); }, function () {}); }
  function sharePoll() { clearInterval(shareTimer); shareTimer = setInterval(function () { if (S.share.st.on) shareRefresh(); }, 3000); }
  function shareStart() {
    if (!S.project) { A.toast("Open a project to share it."); return Promise.resolve(); }
    var sh = S.share; if (sh.pinOn && (sh.pin || "").length !== 4) { A.toast("Enter 4 digits for the PIN."); return Promise.resolve(); }
    return A.flush().then(function () { return api.shareStart({ dir: S.dir, mode: sh.mode || S.mode, pin: sh.pinOn ? sh.pin : null, ip: sh.ip || (A.$("#share-adapter") || {}).value || null }); }).then(function (st) { S.share.st = st; S.share.qr = null; return shareStatus(); }).then(function () { sharePoll(); A.render(); }, A.err);
  }
  Act["share-open"] = function () { S.share.open = !S.share.open; if (S.share.open && !S.share.mode) S.share.mode = S.mode; shareStatus().then(function () { A.render(); }, function () { A.render(); }); };
  Act["share-toggle"] = function () { if (S.share.st.on) return Act["share-stop"](); return shareStart(); };
  Act["share-stop"] = function () { return api.shareStop().then(function (st) { S.share.st = st; S.share.qr = null; A.render(); }, A.err); };
  Act["share-copy"] = function () { navigator.clipboard.writeText(S.share.st.url).then(function () { A.toast("Link copied."); }); };
  Act["share-mode"] = function (t) { S.share.mode = t.dataset.v; if (S.share.st.on) return shareStart(); A.render(); };
  Act["share-pin"] = function () { S.share.pinOn = !S.share.pinOn; if (!S.share.pinOn && S.share.st.on) return shareStart(); A.render(); };
  document.addEventListener("input", function (e) {
    var t = e.target; if (t.dataset.spin == null) return;
    var i = +t.dataset.spin, d = t.value.replace(/\D/g, "").slice(-1); t.value = d; var arr = (S.share.pin || "").split(""); arr[i] = d; S.share.pin = arr.join("").slice(0, 4);
    if (d && i < 3) { var nx = A.$('[data-spin="' + (i + 1) + '"]'); nx && nx.focus(); }
    else if (S.share.pin.length === 4 && S.share.st.on === false) { /* applied when switched on */ }
    else if (S.share.pin.length === 4 && S.share.st.on) shareStart();
  });
  document.addEventListener("change", function (e) { if (e.target.id === "share-adapter") S.share.ip = e.target.value; });

  /* ================= delegated events ================= */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t) { return; }
    var fn = Act[t.dataset.act]; if (!fn) return;
    if (t.classList.contains("dis")) return;
    var r = fn(t, e); if (r && r.catch) r.catch(A.err);
  });
  document.addEventListener("keydown", function (e) {
    var tg = e.target, typing = tg && /^(INPUT|TEXTAREA)$/.test(tg.tagName);
    if (e.key === "Escape") { if (S.menu) { S.menu = null; A.render(); } else if (S.dialog) Act["dlg-close"](); return; }
    if ((e.key === "Enter" || e.key === " ") && tg && tg.getAttribute && tg.getAttribute("role") === "button" && tg.dataset.act) { e.preventDefault(); tg.click(); return; }
    if (e.key === "Enter" && tg && tg.id === "np-name") { Act["np-create"](); return; }
    if (e.key === "Enter" && tg && tg.id === "rn-name") { Act["rename-do"](); return; }
    if (typing) return;
    var it = item(), v = A.$("#vid");
    if (it && v && A.trim) {
      var dur = it.duration || v.duration || 0;
      if (e.key === "[") { A.trim.set(v.currentTime, it.end || dur); e.preventDefault(); }
      else if (e.key === "]") { A.trim.set(it.start || 0, v.currentTime); e.preventDefault(); }
      else if (e.key === ",") { v.pause(); v.currentTime = Math.max(0, v.currentTime - 1 / 25); e.preventDefault(); }
      else if (e.key === ".") { v.pause(); v.currentTime = Math.min(dur, v.currentTime + 1 / 25); e.preventDefault(); }
      else if (e.key === " ") { Act["vid-toggle"](); e.preventDefault(); }
    }
  });
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.dataset.bind) {
      var parts = t.dataset.bind.split("."), root = parts[0], path = parts.slice(1).join("."), obj = A.bindRoots && A.bindRoots[root] ? A.bindRoots[root]() : root === "sec" ? A.curSec() : root === "leaf" ? A.curLeaf() : root === "item" ? item() : root === "settings" ? (S.project.settings = S.project.settings || {}) : S.project;
      var v = t.value; if (t.dataset.num) { v = v === "" ? "" : +v; if (v !== "" && !isFinite(v)) return; }
      if (root === "project" && path === "name" && !v.trim()) return;
      A.setPath(obj, path, v); A.touch();
      if (root === "sec" && path === "title") {
        var rowEl = A.$('.tr2[data-sec="' + CSS.escape(obj.id) + '"][data-kind="sec"]');
        if (!obj.children && !A.itemCount(obj) && v.trim()) {                       // an empty section's id follows its name (it names the media folder), until it has content
          var oid = obj.id, ids = A.secs().filter(function (x) { return x !== obj; }).map(function (x) { return x.id; });
          obj.id = A.uid(v, ids); if (S.sel.sec === oid) S.sel.sec = obj.id; if (rowEl) rowEl.dataset.sec = obj.id;
        }
        var row = rowEl && rowEl.querySelector(".nm"); if (row) row.textContent = v;
      }
      if (root === "leaf" && path === "title") { var r2 = A.$('.tr2[data-sub="' + CSS.escape(obj.id) + '"] .nm'); if (r2) r2.textContent = v; }
    } else if (t.dataset.look) {
      var k = t.dataset.look, val = t.value;
      if (t.type === "range") {
        t.style.setProperty("--p", Math.round((+t.value - +t.min) / (+t.max - +t.min) * 100) + "%");
        if (k === "rotate") { var rv = +val; (st().brand = st().brand || {}).rotateSeconds = rv > 0 ? Math.max(3, rv) : 0; var lr = A.$("#v-rotate"); if (lr) lr.textContent = rv ? Math.max(3, rv) + " s" : "off"; }
        else if (k === "idle") { st().idleReturnMinutes = +val; var lab = A.$("#v-idle"); if (lab) lab.textContent = +val ? val + " min" : "off"; }
        else { look()[k] = +val; var fm = { logoSize: function (v) { return Math.round(44 * v) + " px"; }, panelHeight: function (v) { return v + " %"; }, panelGap: function (v) { return v + " px"; }, labelShadow: function (v) { return v < .05 ? "off" : v < .8 ? "soft" : v < 1.3 ? "normal" : "strong"; } }[k]; var l2 = A.$("#v-" + k); if (l2 && fm) l2.textContent = fm(+val); }
        A.touch();
      }
    } else if (t.dataset.tag != null) { st().brand.taglines[+t.dataset.tag] = t.value; A.touch(); }
    else if (t.dataset.ct != null) { var c = st().contact.items[+t.dataset.ct]; c[t.dataset.f] = t.value; if (t.dataset.f === "value") { var h = hrefFor(t.value); if (h) c.href = h; else delete c.href; } A.touch(); }
    else if (t.dataset.pin != null) {
      var e2 = S.dialog, i = +t.dataset.pin, d = t.value.replace(/\D/g, "").slice(-1); t.value = d;
      var arr = (e2.pin || "").split(""); arr[i] = d; e2.pin = arr.join("").slice(0, 4);
      if (d && i < 3) { var nx = A.$('[data-pin="' + (i + 1) + '"]'); nx && nx.focus(); }
      var go = A.$('[data-act="exp-go"]'); if (go) go.classList.toggle("dis", e2.pin.length !== 4);
    }
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset.look && t.type !== "range" && /^(bg|accent)$/.test(t.dataset.look)) { var v = t.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) { look()[t.dataset.look] = v.toUpperCase(); A.touch(); A.render(); } else A.toast("Use a colour like #F9F9F7."); }
  });
  // drag and drop: files from Explorer into the centre; reorder rows and tiles
  var dragging = null;
  document.addEventListener("dragstart", function (e) {
    var t = e.target.closest && e.target.closest("[draggable][data-kind]"); if (!t) return;
    dragging = { kind: t.dataset.kind, sec: t.dataset.sec, sub: t.dataset.sub, i: +t.dataset.i }; t.classList.add("lift"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "row");
  });
  document.addEventListener("dragend", function () { dragging = null; A.$$(".lift,.dbefore,.dafter").forEach(function (n) { n.classList.remove("lift", "dbefore", "dafter"); }); S.dragOver = false; var a = A.$(".e-app"); a && a.classList.remove("dragover"); });
  document.addEventListener("dragover", function (e) {
    var files = e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0;
    if (files) { e.preventDefault(); var z = e.target.closest && e.target.closest(".dz-all, .media, .dz"); var a = A.$(".e-app"); a && a.classList.toggle("dragover", !!z); return; }
    if (!dragging) return;
    var tgt = e.target.closest && e.target.closest("[draggable][data-kind='" + dragging.kind + "']"); if (!tgt) return;
    e.preventDefault(); A.$$(".dbefore,.dafter").forEach(function (n) { n.classList.remove("dbefore", "dafter"); });
    var r = tgt.getBoundingClientRect(), after = dragging.kind === "item" ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    tgt.classList.add(after ? "dafter" : "dbefore"); tgt._after = after;
  });
  document.addEventListener("drop", function (e) {
    var a = A.$(".e-app"); a && a.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length && !dragging) {
      e.preventDefault(); if (!(e.target.closest && e.target.closest(".dz-all, .media, .dz"))) return;
      var paths = Array.prototype.map.call(e.dataTransfer.files, function (f) { return api.pathOf(f); }).filter(Boolean); if (paths.length) startImport(paths); return;
    }
    if (!dragging) return;
    var tgt = e.target.closest && e.target.closest("[draggable][data-kind='" + dragging.kind + "']"); if (!tgt) return; e.preventDefault();
    var after = !!tgt._after, d = dragging; dragging = null;
    function move(arr, from, to) { var x = arr.splice(from, 1)[0]; if (to > from) to--; arr.splice(Math.max(0, Math.min(arr.length, to)), 0, x); }
    if (d.kind === "sec") { var secs = A.secs(), from = secs.map(function (s) { return s.id; }).indexOf(d.sec), to = secs.map(function (s) { return s.id; }).indexOf(tgt.dataset.sec) + (after ? 1 : 0); move(secs, from, to); }
    else if (d.kind === "sub") { var s = A.secs().filter(function (x) { return x.id === d.sec; })[0]; if (tgt.dataset.sec !== d.sec) return; var ids = s.children.map(function (c) { return c.id; }); move(s.children, ids.indexOf(d.sub), ids.indexOf(tgt.dataset.sub) + (after ? 1 : 0)); }
    else if (d.kind === "post" || d.kind === "hl" || d.kind === "pimg") { var to2 = +tgt.dataset.i + (after ? 1 : 0); if (to2 > d.i) to2--; A.socMove(d.kind, d.i, Math.max(0, to2)); return; }
    else if (d.kind === "page") { A.flipMovePage(d.i, Math.max(0, Math.min(book_len() - 1, +tgt.dataset.i + (after ? 1 : 0) - (+tgt.dataset.i + (after ? 1 : 0) > d.i ? 1 : 0)))); return; }
    else if (d.kind === "item") { var l = A.curLeaf(), cur = S.sel.item != null ? l.items[S.sel.item] : null; move(l.items, d.i, +tgt.dataset.i + (after ? 1 : 0)); if (cur) S.sel.item = l.items.indexOf(cur); }
    A.touch(); A.render();
  });

  /* ================= after each render ================= */
  A.after = function () {
    if (S.dialog && S.dialog.kind === "crop") mountCrop();
    if (S.screen === "content" && !S.dialog) mountTrim();
    position(); position2(); if ((A.$("#devbox") || A.$("#phonebox")) && (pv.dirty || pv.mode !== S.mode || !pv.url || (A.$("#phonebox") && !frame2.src))) ensurePreview(true);
    A.after2 && A.after2();
    var bt = A.$(".bento"); if (bt) bt.classList.toggle("folded", !!S.fold);
    tabify();
    var np = A.$("#np-name"); if (np && !np.dataset.f) { np.dataset.f = 1; np.focus(); }
    var rn = A.$("#rn-name"); if (rn && !rn.dataset.f) { rn.dataset.f = 1; rn.focus(); rn.select(); }
  };

  /* ================= startup ================= */
  /* laptop layout: below 1500 px the right column's cards become one tabbed card */
  function tabify() {
    var r = A.$(".bento>.right"); if (!r || window.innerWidth >= 1500) return;
    var cards = Array.prototype.filter.call(r.children, function (c) { return c.classList.contains("card"); }); if (cards.length < 2) return;
    var l = A.curLeaf(), key = S.screen + ":" + (l ? l.type : "") + ":" + (S.sel.item != null ? "item" : "sec"), cur = S.rtab[key] || 0; if (cur >= cards.length) cur = 0;
    var bar = document.createElement("div"); bar.className = "rtabs";
    cards.forEach(function (c, i) {
      var h = c.querySelector(".ch h3, .ch h2"), t = c.dataset.tab || (h && h.textContent) || ("part " + (i + 1)); t = t.split(" ·")[0];
      var bt2 = document.createElement("span"); bt2.textContent = t; bt2.setAttribute("role", "button"); if (i === cur) bt2.className = "on";
      bt2.onclick = function () { S.rtab[key] = i; A.render(); }; bar.appendChild(bt2); c.style.display = i === cur ? "" : "none";
    });
    r.insertBefore(bar, r.firstChild);
  }
  setInterval(function () { var c = A.$(".ctr em"); if (c && S.saved === "saved" && S.project) c.textContent = "saved · " + A.ago(S.savedAt); }, 30000);
  api.info().then(function (info) { S.info = info; return refreshProjects(); }).then(function () { A.render(); window.__ready = true; setTimeout(function () { api.appReady(); }, 100); }, A.err);
  window.addEventListener("beforeunload", function () { A.flush(); });
})();
