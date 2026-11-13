/* Special editors. Each editor registers A.editors[type] = { mid(leaf), right(leaf) }; page types that only need an item inspector register A.itemEditors[type].
   Flipbook (PDF -> pages) lives here first; Social, Panoramas and Links are appended below. */
(function () {
  "use strict";
  var A = window.A, S = A.S, api = window.api, ic = A.ic, esc = A.esc, Act = A.actions;
  A.editors = {}; A.itemEditors = {};
  S.ed = S.ed || { flip: { page: 0, tab: "book", draw: false, pending: null }, social: { view: "main", post: 0, hl: 0 }, pano: {}, links: {} };

  /* ================= FLIPBOOK ================= */
  function books() { var l = A.curLeaf(); return (l && l.items) || []; }
  function book() { var b = books(); var i = S.sel.item == null ? 0 : Math.min(S.sel.item, b.length - 1); return b[i] || null; }
  A.bindRoots = A.bindRoots || {};
  A.bindRoots.book = function () { return book(); };
  A.bindRoots.bset = function () { var b = book(); return b ? (b.settings = b.settings || {}) : {}; };
  function FS() { return S.ed.flip; }
  function bsettings(b) { return Object.assign({ binding: "soft", layout: "auto", cover: true, thumbs: true, toc: true, links: true, startOpen: false }, b.settings || {}); }
  function pageThumb(b, i) { return (b.thumbs && b.thumbs[i]) || b.pages[i]; }

  function flipMid(l) {
    var b = book(), job = S.pdfJob;
    var dropText = "Drop a PDF here · each page becomes a lossless image";
    var noEngine0 = S.info && S.info.flipbookAddon === false ? '<div class="alert">' + ic("warning", 16) + "<span><b>Flipbook engine not installed.</b> Books can be built and edited here; the presentation shows a notice instead of the book until the optional add-on is installed (see README).</span></div>" : "";
    if (!b && !job) return '<section class="gl card dz-all" style="gap:12px"><div class="ch"><div><h2>' + esc(A.curSec().title) + '</h2></div></div>' + noEngine0 + '<div class="emp"><div class="bg">' + ic("page", 34) + "</div><h2>Drop a PDF here</h2><p>Each page becomes a full-resolution image (300 dpi, lossless PNG). The PDF is copied into the project untouched; its links and bookmarks become clickable areas and the contents list.</p><div class=\"tools2\" style=\"margin-top:20px\"><span class=\"pill pri\" data-act=\"flip-add\" role=\"button\" tabindex=\"0\">" + ic("upload", 15) + 'Add PDF</span></div><div class="fm"><span>PDF</span><span>300 dpi PNG pages</span><span>links + bookmarks kept</span></div></div></section>';
    var f = FS(); f.page = Math.max(0, Math.min(f.page, b ? b.pages.length - 1 : 0));
    var seg = books().length > 1 ? '<span class="seg sm">' + books().map(function (x, i) { return '<span class="' + (i === S.sel.item || (S.sel.item == null && i === 0) ? "on" : "") + '" data-act="flip-book" data-i="' + i + '" role="button" tabindex="0">' + esc(x.title || "Book " + (i + 1)) + "</span>"; }).join("") + "</span>" : "";
    var jobCard = job ? '<div class="card" id="pdfcard" style="padding:16px 18px;background:var(--glass-2);border-radius:22px;gap:10px;flex:none"><div class="row"><b style="font-weight:500">Extracting pages</b><span class="mono hint">page ' + job.page + " of " + job.total + '</span></div><div class="prog"><i style="width:' + (job.total ? Math.round(job.page / job.total * 100) : 0) + '%"></i></div><div class="mono hint">' + esc(job.name || "") + ' · lossless PNG at 300 dpi</div><div class="tools2"><span class="pill sm" data-act="pdf-cancel" role="button" tabindex="0">Cancel</span></div></div>' : "";
    if (!b) return '<section class="gl card" style="gap:12px"><div class="ch"><h2>Importing…</h2></div>' + jobCard + "</section>";
    var p = f.page, links = (b.links && b.links[p + 1]) || [];
    var areas = links.map(function (a, i) { return '<i class="larea' + (a.to ? " goto" : "") + '" data-link="' + i + '" style="left:' + a.x * 100 + "%;top:" + a.y * 100 + "%;width:" + a.w * 100 + "%;height:" + a.h * 100 + '%"><b>' + (a.to ? "p." + a.to : "link") + "</b></i>"; }).join("");
    var pend = f.pending ? '<i class="larea pend" style="left:' + f.pending.x * 100 + "%;top:" + f.pending.y * 100 + "%;width:" + f.pending.w * 100 + "%;height:" + f.pending.h * 100 + '%"></i>' : "";
    var strip = b.pages.map(function (pg, i) {
      var n = ((b.links && b.links[i + 1]) || []).length;
      return '<div class="it' + (i === p ? " sel" : "") + '" draggable="true" data-act="flip-page" data-i="' + i + '" data-kind="page" role="button" tabindex="0"><div class="th pg"><img src="' + A.mediaUrl(pageThumb(b, i)) + '" draggable="false" loading="lazy">' + (i === 0 ? '<span class="bd">cover</span>' : i === b.pages.length - 1 && b.pages.length > 2 ? '<span class="bd">back</span>' : "") + (n ? '<span class="bd lnk">' + n + " link" + (n > 1 ? "s" : "") + "</span>" : "") + '</div><div class="tt">' + (i + 1) + "</div></div>";
    }).join("") + '<div class="it" data-act="flip-addpage" role="button" tabindex="0"><div class="th pg addtile">' + ic("plus", 22) + '</div><div class="tt" style="color:var(--muted)">Add page</div></div>';
    var noEngine = S.info && S.info.flipbookAddon === false ? '<div class="alert">' + ic("warning", 16) + "<span><b>Flipbook engine not installed.</b> You can still build and edit books here; the presentation shows a notice instead of the book until the optional add-on is installed (see README).</span></div>" : "";
    return '<div class="mid" style="grid-template-rows:minmax(0,1fr) clamp(170px,26vh,230px)"><section class="gl hero"><div class="hbg" style="background-image:url(' + A.mediaUrl(pageThumb(b, 0)) + ')"></div><div class="hh"><div class="t">' + esc(b.title || "Book") + "<em>pages " + (p + 1) + " of " + b.pages.length + "</em>" + seg + '</div><div class="tools"><span class="' + (f.draw ? "on" : "") + '" data-act="flip-draw" title="Link areas">' + ic("link", 19) + '</span><span data-act="flip-reimport" title="Re-import PDF">' + ic("upload", 19) + '</span><span data-act="flip-delete" title="Delete book">' + ic("trash", 19) + '</span></div></div><div class="stage"><div class="flipstage"><span class="pgnav" data-act="flip-prev" role="button">' + ic("chev", 18) + '</span><div class="pagebox' + (f.draw ? " drawing" : "") + '" id="pagebox" style="--pa:' + (b.aspect || 0.707) + '"><img id="pageimg" src="' + A.mediaUrl(b.pages[p]) + '" draggable="false">' + areas + pend + '</div><span class="pgnav r" data-act="flip-next" role="button">' + ic("chev", 18) + "</span></div></div></section>" +
      '<section class="gl card media" style="gap:10px">' + noEngine + '<div class="ch"><h3>pages · drag to reorder</h3><span class="tag">' + b.pages.length + " pages · " + (b.pdfName ? esc(b.pdfName) : "images") + "</span></div>" + jobCard + '<div class="mrow pages">' + strip + "</div></section></div>";
  }

  function flipRight(l) {
    var b = book(); if (!b) return '<div class="right"></div>';
    var f = FS(), st = bsettings(b), tab = f.tab;
    var tabs = [["book", "Book", "page"], ["page", "Page " + (f.page + 1), "image"], ["toc", "Contents", "type"]].map(function (t) { return '<span class="' + (tab === t[0] ? "on" : "") + '" data-act="flip-tab" data-v="' + t[0] + '" role="button" tabindex="0">' + ic(t[2], 14) + t[1] + "</span>"; }).join("");
    var body = "";
    function tg(key, label, hint) { var on = key === "links" ? st.links !== false : !!st[key]; return '<div class="row"><span>' + label + (hint ? '<div class="mono hint">' + hint + "</div>" : "") + '</span><span class="tog' + (on ? "" : " off") + '" data-act="flip-tog" data-v="' + key + '" role="button" tabindex="0"></span></div>'; }
    if (tab === "book") {
      var hard = st.binding === "hard";
      body = '<div class="field"><label>title</label><input class="in" data-bind="book.title" value="' + esc(b.title || "") + '"></div><div class="field"><label>subtitle</label><input class="in" data-bind="book.subtitle" value="' + esc(b.subtitle || "") + '"></div><div class="field"><label>meta line (empty = "' + b.pages.length + ' pages")</label><input class="in" data-bind="book.meta" value="' + esc(b.meta && b.meta !== b.pages.length + " pages" ? b.meta : "") + '"></div>' +
        '<div class="row"><span>Binding</span><span class="seg sm"><span class="' + (!hard ? "on" : "") + '" data-act="flip-set" data-k="binding" data-v="soft" role="button" tabindex="0">Soft cover</span><span class="' + (hard ? "on" : "") + '" data-act="flip-set" data-k="binding" data-v="hard" role="button" tabindex="0">Hard cover</span></span></div>' +
        (hard ? '<div class="field"><label>cloth colour</label><div class="sws">' + ["#083438", "#1F3A5F", "#5A1F2B", "#2B2B2B", "#6B4F2A"].map(function (c) { return '<span class="swc' + ((st.cloth || "#083438").toLowerCase() === c.toLowerCase() ? " on" : "") + '" style="background:' + c + '" data-act="flip-set" data-k="cloth" data-v="' + c + '" role="button" tabindex="0"></span>'; }).join("") + '<input class="in hex" data-bind="bset.cloth" value="' + esc(st.cloth || "#083438") + '" maxlength="7"></div></div><div class="row"><span>Foil</span><span class="seg sm">' + ["gold", "silver", "copper"].map(function (x) { return '<span class="' + ((st.foil || "gold") === x ? "on" : "") + '" data-act="flip-set" data-k="foil" data-v="' + x + '" role="button" tabindex="0">' + x + "</span>"; }).join("") + '</span></div><div class="row"><span>Corners</span><span class="seg sm">' + ["square", "round"].map(function (x) { return '<span class="' + ((st.corners || "square") === x ? "on" : "") + '" data-act="flip-set" data-k="corners" data-v="' + x + '" role="button" tabindex="0">' + x + "</span>"; }).join("") + '</span></div><div class="field"><label>cover title (empty = book title)</label><input class="in" data-bind="bset.coverTitle" value="' + esc(st.coverTitle || "") + '"></div><div class="field"><label>cover subtitle</label><input class="in" data-bind="bset.coverSubtitle" value="' + esc(st.coverSubtitle || "") + '"></div>' : "") +
        '<div class="row"><span>Pages shown</span><span class="seg sm">' + [["auto", "Auto"], ["single", "Single"], ["spread", "Spread"]].map(function (x) { return '<span class="' + (st.layout === x[0] ? "on" : "") + '" data-act="flip-set" data-k="layout" data-v="' + x[0] + '" role="button" tabindex="0">' + x[1] + "</span>"; }).join("") + "</span></div>" +
        tg("cover", "Cover page", "page 1 is the cover, the last page the back") + tg("thumbs", "Thumbnails bar") + tg("toc", "Contents button", b.toc && b.toc.length ? "" : "needs a contents list") + tg("links", "Clickable link areas") + tg("startOpen", "Open on page 1");
    } else if (tab === "page") {
      var links = (b.links && b.links[f.page + 1]) || [];
      var rows = links.map(function (a, i) { return '<div class="frow"><span class="g">' + ic(a.to ? "arrowRight" : "link", 16) + '</span><span class="tx" style="font-size:13px">' + (a.to ? "Go to page " + a.to : esc(a.url)) + '</span><span class="x2" data-act="flip-link-del" data-i="' + i + '" role="button" tabindex="0">' + ic("close", 14) + "</span></div>"; }).join("") || '<div class="mono hint">No clickable areas on this page.</div>';
      var pend = f.pending ? '<div class="alert info">' + ic("info", 16) + "<span>New area drawn. Where should it go?</span></div><div class=\"row\"><span class=\"seg sm\"><span class=\"" + (f.pending.kind !== "page" ? "on" : "") + '" data-act="flip-pk" data-v="url" role="button" tabindex="0">Web address</span><span class="' + (f.pending.kind === "page" ? "on" : "") + '" data-act="flip-pk" data-v="page" role="button" tabindex="0">Go to page</span></span></div><div class="field"><input class="in" id="pendval" placeholder="' + (f.pending.kind === "page" ? "page number" : "https://") + '" value="' + esc(f.pending.val || "") + '"></div><div class="tools2"><span class="pill sm pri" data-act="flip-link-add" role="button" tabindex="0">Add area</span><span class="pill sm" data-act="flip-link-cancel" role="button" tabindex="0">Cancel</span></div>' : "";
      body = '<div class="mono hint">page ' + (f.page + 1) + " of " + b.pages.length + " · " + links.length + " clickable area" + (links.length === 1 ? "" : "s") + "</div>" + rows + pend + '<div class="tools2"><span class="pill sm' + (f.draw ? " on" : "") + '" data-act="flip-draw" role="button" tabindex="0">' + ic("link", 14) + (f.draw ? "Drawing: drag on the page" : "Draw a link area") + "</span></div>" +
        '<div class="row"><span>Move page</span><span class="tools2"><span class="pill sm' + (f.page === 0 ? " dis" : "") + '" data-act="flip-move" data-v="-1" role="button" tabindex="0">Earlier</span><span class="pill sm' + (f.page >= b.pages.length - 1 ? " dis" : "") + '" data-act="flip-move" data-v="1" role="button" tabindex="0">Later</span></span></div><div class="row"><span style="color:#FF7A5C">Remove this page</span><span class="pill sm" data-act="flip-page-del" role="button" tabindex="0">' + ic("trash", 14) + "Remove</span></div>";
    } else {
      var toc = b.toc || [];
      body = (toc.map(function (t, i) { return '<div class="frow' + (t.level ? " ind" : "") + '"><span class="g">' + ic("grip", 16) + '</span><input class="tx in" data-toc="' + i + '" data-f="title" value="' + esc(t.title) + '"><input class="in pg" data-toc="' + i + '" data-f="page" value="' + t.page + '" title="page"><span class="pill sm" data-act="toc-lvl" data-i="' + i + '" role="button" tabindex="0">' + (t.level ? "←" : "→") + '</span><span class="x2" data-act="toc-del" data-i="' + i + '" role="button" tabindex="0">' + ic("close", 14) + "</span></div>"; }).join("") || '<div class="mono hint">No contents entries. The PDF had no bookmarks.</div>') + '<div class="tools2"><span class="pill sm" data-act="toc-add" role="button" tabindex="0">' + ic("plus", 14) + 'Add entry</span></div><div class="mono hint">' + ((b.tocFromPdf) ? "from " + b.tocFromPdf + " pdf bookmarks · " : "") + "one indent level</div>";
    }
    var src = b.pdf ? '<section class="gl card"><div class="ch"><h3>source pdf</h3><span class="tag">kept untouched</span></div><dl class="kv"><dt>file</dt><dd>' + esc(b.pdfName || b.pdf.split("/").pop()) + "</dd><dt>pages</dt><dd>" + b.pages.length + "</dd><dt>page images</dt><dd>PNG · lossless · " + (b.pageW ? b.pageW + "×" + b.pageH : "300 dpi") + '</dd></dl><div class="tools2"><span class="pill sm" data-act="flip-reimport" role="button" tabindex="0">Re-import PDF</span><span class="pill sm" data-act="flip-show" role="button" tabindex="0">Show in folder</span></div></section>' : "";
    return '<div class="right"><section class="gl card" data-tab="Book"><div class="ch"><span class="seg sm tabs3">' + tabs + "</span></div>" + body + "</section>" + src + A.pageTypeCard(l) + "</div>";
  }
  A.pageTypeCard = function (l) {
    var types = A.TYPES.map(function (t) { return '<div class="' + (l.type === t[0] ? "on" : "") + (A.itemCount(l) && l.type !== t[0] ? " dis" : "") + '" data-act="set-type" data-v="' + t[0] + '" role="button" tabindex="0">' + ic(t[1], 18) + t[2] + "</div>"; }).join("");
    return '<section class="gl card"><div class="ch"><h3>page type</h3></div><div class="types">' + types + "</div></section>";
  };
  A.editors.flipbook = { mid: flipMid, right: flipRight };

  /* ----- actions ----- */
  Act["flip-add"] = function () { return api.pick({ kind: "pdf" }).then(function (p) { if (p && p.length) A.importPdfFiles(p); }, A.err); };
  Act["flip-book"] = function (t) { S.sel.item = +t.dataset.i; FS().page = 0; A.render(); };
  Act["flip-page"] = function (t) { FS().page = +t.dataset.i; A.render(); };
  Act["flip-prev"] = function () { FS().page = Math.max(0, FS().page - 1); A.render(); };
  Act["flip-next"] = function () { FS().page = Math.min(book().pages.length - 1, FS().page + 1); A.render(); };
  Act["flip-tab"] = function (t) { FS().tab = t.dataset.v; A.render(); };
  Act["flip-draw"] = function () { var f = FS(); f.draw = !f.draw; f.pending = null; if (f.draw) f.tab = "page"; A.render(); };
  Act["flip-set"] = function (t) { var b = book(); (b.settings = b.settings || {})[t.dataset.k] = t.dataset.v; A.touch(); A.render(); };
  Act["flip-tog"] = function (t) { var b = book(), st = bsettings(b), k = t.dataset.v; (b.settings = b.settings || {})[k] = k === "links" ? st.links === false : !st[k]; A.touch(); A.render(); };
  Act["flip-pk"] = function (t) { FS().pending.kind = t.dataset.v; var v = A.$("#pendval"); FS().pending.val = v ? v.value : ""; A.render(); };
  Act["flip-link-cancel"] = function () { FS().pending = null; A.render(); };
  Act["flip-link-add"] = function () {
    var f = FS(), b = book(), pd = f.pending, v = (A.$("#pendval") || {}).value || "", box = { x: +pd.x.toFixed(5), y: +pd.y.toFixed(5), w: +pd.w.toFixed(5), h: +pd.h.toFixed(5) };
    if (pd.kind === "page") { var n = parseInt(v, 10); if (!(n >= 1 && n <= b.pages.length)) { A.toast("Enter a page number from 1 to " + b.pages.length + "."); return; } box.to = n; }
    else { v = v.trim(); if (!v) { A.toast("Enter a web address."); return; } if (!/^[a-z]+:/i.test(v)) v = "https://" + v; box.url = v; }
    b.links = b.links || {}; (b.links[f.page + 1] = b.links[f.page + 1] || []).push(box); f.pending = null; f.draw = false; A.touch(); A.render();
  };
  Act["flip-link-del"] = function (t) { var f = FS(), b = book(), list = b.links[f.page + 1]; list.splice(+t.dataset.i, 1); if (!list.length) delete b.links[f.page + 1]; A.touch(); A.render(); };
  Act["flip-show"] = function () { api.reveal(S.dir + "\\" + book().pdf.replace(/\//g, "\\")); };
  Act["flip-delete"] = function () { S.dialog = { kind: "confirm", title: "Delete this book?", text: "The book is removed from the presentation. Its PDF and page images stay in the project's media folder.", label: "Delete", danger: 1, act: "flip-delete-do" }; A.render(); };
  Act["flip-delete-do"] = function () { var l = A.curLeaf(); l.items.splice(S.sel.item || 0, 1); S.sel.item = l.items.length ? 0 : null; S.dialog = null; A.touch(); A.render(); };
  function remap(b, order) {                                      // order[newIndex] = oldIndex; keeps links, contents and thumbs attached to their pages
    var inv = {}; order.forEach(function (o, n) { inv[o + 1] = n + 1; });
    b.pages = order.map(function (o) { return b.pages[o]; }); if (b.thumbs) b.thumbs = order.map(function (o) { return b.thumbs[o]; });
    var nl = {}; Object.keys(b.links || {}).forEach(function (k) { if (inv[k]) nl[inv[k]] = b.links[k].map(function (a) { var c = Object.assign({}, a); if (c.to) c.to = inv[c.to] || c.to; return c; }); }); b.links = nl;
    (b.toc || []).forEach(function (t) { t.page = inv[t.page] || t.page; });
  }
  A.flipMovePage = function (from, to) { var b = book(), order = b.pages.map(function (_, i) { return i; }); var x = order.splice(from, 1)[0]; order.splice(to, 0, x); remap(b, order); FS().page = to; A.touch(); A.render(); };
  Act["flip-move"] = function (t) { var f = FS(), j = f.page + +t.dataset.v; if (j < 0 || j >= book().pages.length) return; A.flipMovePage(f.page, j); };
  Act["flip-page-del"] = function () {
    var b = book(), f = FS(); if (b.pages.length < 2) { A.toast("A book needs at least one page."); return; }
    var order = b.pages.map(function (_, i) { return i; }).filter(function (i) { return i !== f.page; }); remap(b, order);
    b.links = b.links || {}; Object.keys(b.links).forEach(function (k) { b.links[k] = b.links[k].filter(function (a) { return !a.to || a.to <= b.pages.length; }); if (!b.links[k].length) delete b.links[k]; });
    f.page = Math.min(f.page, b.pages.length - 1); A.touch(); A.render();
  };
  Act["flip-addpage"] = function () {
    var b = book(), l = A.curLeaf(), sec = A.curSec(); if (!b) return;
    api.pick({ kind: "image" }).then(function (p) {
      if (!p) return; var rel = "media/" + sec.id + (sec.children && sec.children.length ? "/" + l.id : "") + "/pages";
      return api.importMedia({ dir: S.dir, rel: rel, type: "gallery", paths: p }).then(function (r) { r.items.forEach(function (it) { b.pages.push(it.file); if (b.thumbs) b.thumbs.push(it.thumb || it.file); }); A.touch(); A.render(); });
    }).catch(A.err);
  };
  Act["toc-add"] = function () { var b = book(); (b.toc = b.toc || []).push({ title: "New entry", page: FS().page + 1, level: 0 }); A.touch(); A.render(); };
  Act["toc-del"] = function (t) { book().toc.splice(+t.dataset.i, 1); A.touch(); A.render(); };
  Act["toc-lvl"] = function (t) { var e = book().toc[+t.dataset.i]; e.level = e.level ? 0 : 1; A.touch(); A.render(); };
  Act["pdf-cancel"] = function () { api.cancelPdf(); };
  document.addEventListener("input", function (e) {
    var t = e.target; if (t.dataset.toc == null) return; var b = book(), en = b.toc[+t.dataset.toc];
    if (t.dataset.f === "page") { var n = parseInt(t.value, 10); if (n >= 1 && n <= b.pages.length) en.page = n; } else en.title = t.value; A.touch();
  });
  /* drawing link areas on the page */
  A.flipAfter = function () {
    var box = A.$("#pagebox"); if (!box) return; var f = FS(), drag = null;
    if (!f.draw) return;
    box.addEventListener("pointerdown", function (e) { var r = box.getBoundingClientRect(); drag = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; box.setPointerCapture(e.pointerId); e.preventDefault(); });
    box.addEventListener("pointermove", function (e) {
      if (!drag) return; var r = box.getBoundingClientRect(), x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      f.pending = { x: Math.min(drag.x, x), y: Math.min(drag.y, y), w: Math.abs(x - drag.x), h: Math.abs(y - drag.y), kind: "url" };
      var p = A.$(".larea.pend", box); if (!p) { p = document.createElement("i"); p.className = "larea pend"; box.appendChild(p); }
      p.style.cssText = "left:" + f.pending.x * 100 + "%;top:" + f.pending.y * 100 + "%;width:" + f.pending.w * 100 + "%;height:" + f.pending.h * 100 + "%";
    });
    box.addEventListener("pointerup", function () { if (!drag) return; drag = null; if (f.pending && (f.pending.w < 0.01 || f.pending.h < 0.01)) f.pending = null; f.tab = "page"; A.render(); });
  };

  /* ----- PDF import flow ----- */
  A.importPdfFiles = function (paths, reimport) {
    var pdfs = paths.filter(function (p) { return /\.pdf$/i.test(p); }); if (!pdfs.length) { A.toast("That is not a PDF."); return; }
    var l = A.curLeaf(), sec = A.curSec(); if (!l) { A.toast("Add a section first."); return; }
    if (l.type !== "flipbook") { if (A.itemCount(l)) { A.toast("This section already holds " + l.type + ". Use an empty section for a flipbook."); return; } l.type = "flipbook"; l.items = []; delete l.social; }
    if (S.pdfJob) { A.toast("A PDF is already being imported."); return; }
    var rel = "media/" + sec.id + (sec.children && sec.children.length ? "/" + l.id : "");
    var pdf = pdfs[0]; S.pdfJob = { page: 0, total: 0, name: pdf.split("\\").pop() }; S.screen = "content"; A.render();
    var off = api.onPdfProgress(function (p) { var j = S.pdfJob; if (!j) return; j.page = p.page; j.total = p.total; j.name = p.name; var c = A.$("#pdfcard"); if (c) { c.querySelector(".prog i").style.width = Math.round(p.page / p.total * 100) + "%"; c.querySelector(".mono.hint").textContent = "page " + p.page + " of " + p.total; } });
    return api.importPdf({ dir: S.dir, rel: rel, pdf: pdf }).then(function (r) {
      off(); S.pdfJob = null;
      var title = r.pdfName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
      var b = { id: A.slug(title), title: title, subtitle: "", pages: r.pages, thumbs: r.thumbs, aspect: r.aspect, toc: r.toc, tocFromPdf: r.toc.length, links: r.links, settings: { binding: "soft", layout: "auto", cover: true, thumbs: true, toc: true, links: true, startOpen: false }, pdf: r.pdf, pdfName: r.pdfName, pageW: Math.round(r.pageSize.w * 300 / 72), pageH: Math.round(r.pageSize.h * 300 / 72) };
      if (reimport) { var o = reimport; b.title = o.title; b.subtitle = o.subtitle; b.settings = o.settings; if (o.keep) { b.toc = (o.toc || []).filter(function (t) { return t.page <= r.n; }); var nl = {}; Object.keys(o.links || {}).forEach(function (k) { if (+k <= r.n) nl[k] = o.links[k]; }); b.links = nl; } l.items[reimport.index] = b; S.sel.item = reimport.index; }
      else { l.items.push(b); S.sel.item = l.items.length - 1; }
      FS().page = 0; FS().tab = "book"; A.touch(); A.render(); A.toast("Imported " + r.n + " pages at " + Math.round(r.pageSize.w * 300 / 72) + "×" + Math.round(r.pageSize.h * 300 / 72) + " px, lossless.");
    }, function (e) { off(); S.pdfJob = null; A.render(); A.toast(e.message.indexOf("cancel") >= 0 ? "PDF import cancelled." : e.message); });
  };
  Act["flip-reimport"] = function () { var b = book(); S.dialog = { kind: "flipre", keep: true, index: S.sel.item || 0 }; A.render(); };
  A.dialogs.flipre = function () {
    var d = S.dialog, b = book();
    return '<div class="scrim"><div class="dlg" style="width:720px"><div class="dh"><div><h2>Re-import PDF</h2><p>' + esc(b.title) + " · currently " + b.pages.length + ' pages</p></div><span class="x" data-act="dlg-close" role="button" tabindex="0">' + ic("close", 16) + '</span></div><div class="db"><div class="alert info">' + ic("info", 16) + "<span>Pages are replaced by position: new pages are added or removed at the end. Title, binding and options stay. Links drawn on pages that moved may now point at the wrong place, so check them afterwards.</span></div>" +
      '<div class="row" style="margin-top:12px"><span>Keep my contents and links<div class="mono hint">entries and areas whose page still exists are kept</div></span><span class="tog' + (d.keep ? "" : " off") + '" data-act="flipre-keep" role="button" tabindex="0"></span></div></div><div class="df"><div class="est">the old PDF stays in the media folder</div><span class="grow"></span><span class="pill" data-act="dlg-close" role="button" tabindex="0">Cancel</span><span class="pill pri" data-act="flipre-go" role="button" tabindex="0">Choose PDF ' + ic("upload", 16) + "</span></div></div></div>";
  };
  Act["flipre-keep"] = function () { S.dialog.keep = !S.dialog.keep; A.render(); };
  Act["flipre-go"] = function () {
    var d = S.dialog, b = book();
    return api.pick({ kind: "pdf" }).then(function (p) { if (!p) return; S.dialog = null; A.importPdfFiles(p, { index: d.index, keep: d.keep, title: b.title, subtitle: b.subtitle, settings: b.settings, toc: b.toc, links: b.links }); }, A.err);
  };
  

  /* ================= SOCIAL ================= */
  function soc(l) { l = l || A.curLeaf(); var d = l.social = l.social || {}; d.profile = d.profile || { username: "", name: "", category: "", avatar: "", bio: [], link: "", verified: false, stats: {} }; d.profile.stats = d.profile.stats || {}; d.highlights = d.highlights || []; d.posts = d.posts || []; return d; }
  A.bindRoots.prof = function () { return soc().profile; };
  A.bindRoots.post = function () { return soc().posts[S.ed.social.post] || {}; };
  A.bindRoots.hl = function () { return soc().highlights[S.ed.social.hl] || {}; };
  function SS() { return S.ed.social; }
  function socRel() { var l = A.curLeaf(), sec = A.curSec(); return "media/" + sec.id + (sec.children && sec.children.length ? "/" + l.id : "") + "/social"; }
  function importImgs(paths) { return api.importMedia({ dir: S.dir, rel: socRel(), type: "gallery", paths: paths }).then(function (r) { r.warnings.filter(function (w) { return w.level === "error"; }).forEach(function (w) { A.toast(w.file + ": " + w.msg); }); return r.items; }); }
  A.soc = {
    setAvatar: function (paths) { return importImgs(paths.slice(0, 1)).then(function (it) { if (it[0]) { soc().profile.avatar = it[0].file; A.touch(); A.render(); } }); },
    addPosts: function (paths, carousel) {
      return importImgs(paths).then(function (items) {
        if (!items.length) return; var d = soc(), mk = function (imgs) { return { id: "p" + (d.posts.length + 1) + "-" + Date.now() % 100000, images: imgs, caption: "", likes: "0", time: "just now", comments: [] }; };
        if (carousel && items.length > 1) d.posts.unshift(mk(items.slice(0, 10).map(function (x) { return x.file; })));
        else items.slice().reverse().forEach(function (x) { d.posts.unshift(mk([x.file])); });
        SS().post = 0; SS().view = "main"; A.touch(); A.render();
      });
    },
    addPostImages: function (paths) { return importImgs(paths).then(function (items) { var p = soc().posts[SS().post]; items.forEach(function (x) { if (p.images.length < 10) p.images.push(x.file); }); A.touch(); A.render(); }); },
    addHighlight: function (cover, stories) { return importImgs([cover].concat(stories || [])).then(function (items) { var d = soc(); d.highlights.push({ id: "h" + (d.highlights.length + 1) + "-" + Date.now() % 100000, title: "Highlight", cover: items[0].file, stories: items.slice(1).map(function (x) { return { src: x.file, time: "1d" }; }) }); SS().hl = d.highlights.length - 1; A.touch(); A.render(); }); },
    addStories: function (paths) { return importImgs(paths).then(function (items) { var h = soc().highlights[SS().hl]; items.forEach(function (x) { h.stories.push({ src: x.file, time: "1d" }); }); A.touch(); A.render(); }); }
  };
  function socMid(l) {
    var d = soc(l), pf = d.profile, ss = SS();
    if (ss.view === "post" && d.posts[ss.post]) return postEditor(d);
    var avatar = pf.avatar ? '<img src="' + A.mediaUrl(pf.avatar) + '">' : '<span class="mono hint">no photo</span>';
    var prof = '<section class="gl card" style="gap:10px"><div class="ch"><h3>profile</h3><span class="tag">' + (pf.verified ? "verified" : "") + '</span></div><div class="row"><div class="avatar" data-act="soc-avatar" role="button" tabindex="0" title="Choose a photo">' + avatar + '</div><div style="flex:1;min-width:0"><div class="field"><label>name</label><input class="in" data-bind="prof.name" value="' + esc(pf.name || "") + '"></div></div></div>' +
      '<div class="field"><label>handle (no @, no spaces)</label><input class="in" data-bind="prof.username" data-handle="1" value="' + esc(pf.username || "") + '"></div><div class="field"><label>category</label><input class="in" data-bind="prof.category" value="' + esc(pf.category || "") + '"></div>' +
      '<div class="field"><label>bio · one line per row</label><textarea class="in ta" rows="3" data-bio="1">' + esc((pf.bio || []).join("\n")) + '</textarea></div><div class="field"><label>link</label><input class="in" data-bind="prof.link" value="' + esc(pf.link || "") + '"></div><div class="row"><span>Verified badge</span><span class="tog' + (pf.verified ? "" : " off") + '" data-act="soc-verified" role="button" tabindex="0"></span></div>' +
      '<div class="stats3"><div class="field"><label>posts (auto)</label><input class="in" data-bind="prof.stats.posts" placeholder="' + d.posts.length + '" value="' + esc(pf.stats.posts != null ? pf.stats.posts : "") + '"></div><div class="field"><label>followers</label><input class="in" data-bind="prof.stats.followers" value="' + esc(pf.stats.followers || "") + '"></div><div class="field"><label>following</label><input class="in" data-bind="prof.stats.following" value="' + esc(pf.stats.following || "") + '"></div></div></section>';
    var hls = d.highlights.map(function (h, i) { return '<div class="hlc' + (i === ss.hl ? " sel" : "") + '" draggable="true" data-kind="hl" data-i="' + i + '" data-act="soc-hl" data-v="' + i + '" role="button" tabindex="0"><span class="hlr">' + (h.cover ? '<img src="' + A.mediaUrl(h.cover) + '" draggable="false">' : "") + "</span><b>" + esc(h.title) + "</b><i>" + (h.stories || []).length + " stories</i></div>"; }).join("") + '<div class="hlc" data-act="soc-hl-new" role="button" tabindex="0"><span class="hlr add">' + ic("plus", 20) + "</span><b>New</b></div>";
    var hlc = '<section class="gl card" style="gap:10px"><div class="ch"><h3>highlights</h3><span class="tag">' + d.highlights.length + '</span></div><div class="hlrow">' + hls + "</div></section>";
    var tiles = d.posts.map(function (p, i) { return '<div class="sgi' + (i === ss.post ? " sel" : "") + '" draggable="true" data-kind="post" data-i="' + i + '" data-act="soc-post" data-v="' + i + '" role="button" tabindex="0"><img src="' + A.mediaUrl(p.images[0]) + '" draggable="false" loading="lazy">' + (p.images.length > 1 ? '<span class="bd">' + ic("layout", 11) + p.images.length + "</span>" : "") + '<b class="n">' + (i + 1) + "</b></div>"; }).join("") + '<div class="sgi add" data-act="soc-post-add" role="button" tabindex="0">' + ic("plus", 22) + "</div>";
    var sel = d.posts[ss.post];
    var selc = sel ? '<section class="gl card"><div class="ch"><h3>selected post</h3><span class="tag">' + (sel.images.length > 1 ? "carousel · " + sel.images.length : "single") + '</span></div><div class="mono hint">' + esc(sel.likes) + " likes · " + esc(sel.time) + " · " + esc((sel.caption || "").slice(0, 60)) + '</div><div class="tools2"><span class="pill sm pri" data-act="soc-post-open" role="button" tabindex="0">Edit post</span><span class="pill sm" data-act="soc-post-del" role="button" tabindex="0">Delete</span></div></section>' : "";
    return '<div class="mid soc2"><div class="soccol">' + prof + hlc + '</div><div class="soccol"><section class="gl card" style="gap:10px"><div class="ch"><h3>posts · first = newest</h3><span class="tag">' + d.posts.length + ' · drag to reorder</span></div><div class="sgrid" id="sgrid">' + tiles + "</div></section>" + selc + "</div></div>";
  }
  function postEditor(d) {
    var ss = SS(), p = d.posts[ss.post], imgs = p.images.map(function (x, i) { return '<div class="pimg" draggable="true" data-kind="pimg" data-i="' + i + '"><img src="' + A.mediaUrl(x) + '" draggable="false"><b>' + (i + 1) + '</b><span class="x2" data-act="soc-pimg-del" data-i="' + i + '" role="button">' + ic("close", 12) + "</span></div>"; }).join("") + (p.images.length < 10 ? '<div class="pimg add" data-act="soc-pimg-add" role="button" tabindex="0">' + ic("plus", 20) + "</div>" : "");
    var cm = (p.comments || []).map(function (c, i) { return '<div class="frow"><input class="in lb" data-cm="' + i + '" data-f="user" value="' + esc(c.user) + '" placeholder="user"><input class="tx in" data-cm="' + i + '" data-f="text" value="' + esc(c.text) + '" placeholder="comment"><span class="x2" data-act="soc-cm-del" data-i="' + i + '" role="button" tabindex="0">' + ic("close", 14) + "</span></div>"; }).join("");
    return '<div class="mid soc2 one"><div class="soccol"><section class="gl card" style="gap:10px"><div class="ch"><div style="display:flex;gap:10px;align-items:center"><span class="ib bk" data-act="soc-back" role="button" tabindex="0">' + ic("chev", 16) + "</span><h3>post " + (ss.post + 1) + '</h3></div><span class="tag">' + (p.images.length > 1 ? "carousel · " + p.images.length + " images" : "single image") + '</span></div><div class="pimgs">' + imgs + '</div></section><section class="gl card" style="gap:10px"><div class="ch"><h3>details</h3></div><div class="field"><label>caption</label><textarea class="in ta" rows="4" data-bind="post.caption">' + esc(p.caption || "") + '</textarea></div><div class="stats3"><div class="field"><label>likes</label><input class="in" data-bind="post.likes" value="' + esc(p.likes || "") + '"></div><div class="field"><label>posted</label><input class="in" data-bind="post.time" value="' + esc(p.time || "") + '"></div><div class="field"><label>location · optional</label><input class="in" data-bind="post.location" value="' + esc(p.location || "") + '"></div></div><div class="lbl" style="margin-top:6px">comments</div>' + cm + '<div class="tools2"><span class="pill sm" data-act="soc-cm-add" role="button" tabindex="0">' + ic("plus", 14) + 'Add comment</span><span class="pill sm" data-act="soc-post-del" role="button" tabindex="0">Delete post</span></div></section></div></div>';
  }
  function socRight(l) {
    var ss = SS();
    return '<div class="right"><section class="gl card phonecard"><div class="ch"><h3>live preview</h3><span class="tag">' + (ss.view === "post" ? "post " + (ss.post + 1) : "profile") + '</span></div><div class="phonebox" id="phonebox"></div><div class="mono hint">The viewer\'s own phone, updated as you edit.</div></section>' + A.pageTypeCard(l) + "</div>";
  }
  A.editors.social = { mid: socMid, right: socRight };
  Act["soc-avatar"] = function () { return api.pick({ kind: "image" }).then(function (p) { if (p) return A.soc.setAvatar(p); }, A.err); };
  Act["soc-verified"] = function () { var pf = soc().profile; pf.verified = !pf.verified; A.touch(); A.render(); };
  Act["soc-post"] = function (t) { SS().post = +t.dataset.v; A.render(); };
  Act["soc-post-open"] = function () { SS().view = "post"; A.render(); };
  Act["soc-back"] = function () { SS().view = "main"; A.render(); };
  Act["soc-post-add"] = function () { return api.pick({ kind: "image" }).then(function (p) { if (!p) return; if (p.length > 1) { S.dialog = { kind: "socposts", paths: p }; A.render(); } else A.soc.addPosts(p, false); }, A.err); };
  A.dialogs.socposts = function () { var d = S.dialog; return '<div class="scrim"><div class="dlg" style="width:560px"><div class="dh"><div><h2>' + d.paths.length + ' images</h2><p>one post with a swipeable carousel, or separate posts?</p></div></div><div class="df"><span class="grow"></span><span class="pill" data-act="socposts-go" data-v="sep" role="button" tabindex="0">Separate posts</span><span class="pill pri" data-act="socposts-go" data-v="car" role="button" tabindex="0">One carousel</span></div></div></div>'; };
  Act["socposts-go"] = function (t) { var p = S.dialog.paths; S.dialog = null; A.soc.addPosts(p, t.dataset.v === "car"); };
  Act["soc-post-del"] = function () { S.dialog = { kind: "confirm", title: "Delete this post?", text: "The post leaves the profile. Its images stay in the project's media folder.", label: "Delete", danger: 1, act: "soc-post-del-do" }; A.render(); };
  Act["soc-post-del-do"] = function () { var d = soc(); d.posts.splice(SS().post, 1); SS().post = Math.max(0, Math.min(SS().post, d.posts.length - 1)); SS().view = "main"; S.dialog = null; A.touch(); A.render(); };
  Act["soc-pimg-add"] = function () { return api.pick({ kind: "image" }).then(function (p) { if (p) return A.soc.addPostImages(p); }, A.err); };
  Act["soc-pimg-del"] = function (t, e) { e.stopPropagation(); var p = soc().posts[SS().post]; if (p.images.length < 2) { A.toast("A post needs at least one image."); return; } p.images.splice(+t.dataset.i, 1); A.touch(); A.render(); };
  Act["soc-cm-add"] = function () { var p = soc().posts[SS().post]; (p.comments = p.comments || []).push({ user: "user", text: "" }); A.touch(); A.render(); };
  Act["soc-cm-del"] = function (t) { soc().posts[SS().post].comments.splice(+t.dataset.i, 1); A.touch(); A.render(); };
  Act["soc-hl"] = function (t) { SS().hl = +t.dataset.v; S.dialog = { kind: "sochl" }; A.render(); };
  Act["soc-hl-new"] = function () { return api.pick({ kind: "image" }).then(function (p) { if (p) return A.soc.addHighlight(p[0], p.slice(1)).then(function () { S.dialog = { kind: "sochl" }; A.render(); }); }, A.err); };
  A.dialogs.sochl = function () {
    var h = soc().highlights[SS().hl]; if (!h) return "";
    var st = (h.stories || []).map(function (x, i) { return '<div class="story"><img src="' + A.mediaUrl(x.src) + '"><b>' + (i + 1) + '</b><input class="in" data-story="' + i + '" value="' + esc(x.time || "") + '" placeholder="1d"><span class="tools2"><span class="pill sm' + (i === 0 ? " dis" : "") + '" data-act="soc-story-up" data-i="' + i + '" role="button" tabindex="0">←</span><span class="pill sm" data-act="soc-story-del" data-i="' + i + '" role="button" tabindex="0">×</span></span></div>'; }).join("") + '<div class="story add" data-act="soc-story-add" role="button" tabindex="0">' + ic("plus", 22) + "</div>";
    return '<div class="scrim"><div class="dlg" style="width:760px;max-height:92vh"><div class="dh"><div><h2>Highlight</h2><p>cover, title and stories</p></div><span class="x" data-act="dlg-close" role="button" tabindex="0">' + ic("close", 16) + '</span></div><div class="db" style="overflow:auto"><div class="row"><div class="avatar" data-act="soc-hl-cover" role="button" tabindex="0">' + (h.cover ? '<img src="' + A.mediaUrl(h.cover) + '">' : "") + '</div><div class="field" style="flex:1"><label>title</label><input class="in" data-bind="hl.title" value="' + esc(h.title || "") + '"></div></div><div class="lbl" style="margin-top:14px">stories · the small field is the age shown on each</div><div class="stories">' + st + '</div></div><div class="df"><span class="pill danger" data-act="soc-hl-del" role="button" tabindex="0">Delete highlight</span><span class="grow"></span><span class="pill pri" data-act="dlg-close" role="button" tabindex="0">Done</span></div></div></div>';
  };
  Act["soc-hl-cover"] = function () { return api.pick({ kind: "image" }).then(function (p) { if (!p) return; return importImgs(p.slice(0, 1)).then(function (it) { soc().highlights[SS().hl].cover = it[0].file; A.touch(); A.render(); }); }, A.err); };
  Act["soc-story-add"] = function () { return api.pick({ kind: "image" }).then(function (p) { if (p) return A.soc.addStories(p); }, A.err); };
  Act["soc-story-del"] = function (t) { soc().highlights[SS().hl].stories.splice(+t.dataset.i, 1); A.touch(); A.render(); };
  Act["soc-story-up"] = function (t) { var a = soc().highlights[SS().hl].stories, i = +t.dataset.i; a.splice(i - 1, 0, a.splice(i, 1)[0]); A.touch(); A.render(); };
  Act["soc-hl-del"] = function () { var d = soc(); d.highlights.splice(SS().hl, 1); SS().hl = 0; S.dialog = null; A.touch(); A.render(); };
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.dataset.bio) { soc().profile.bio = t.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean); A.touch(); }
    else if (t.dataset.handle) { var v = t.value.replace(/[@\s]/g, ""); if (v !== t.value) t.value = v; soc().profile.username = v; A.touch(); }
    else if (t.dataset.story != null) { soc().highlights[SS().hl].stories[+t.dataset.story].time = t.value; A.touch(); }
    else if (t.dataset.cm != null) { soc().posts[SS().post].comments[+t.dataset.cm][t.dataset.f] = t.value; A.touch(); }
  });
  A.socMove = function (kind, from, to) { var d = soc(), arr = kind === "post" ? d.posts : kind === "hl" ? d.highlights : d.posts[SS().post].images; var x = arr.splice(from, 1)[0]; arr.splice(to, 0, x); if (kind === "post") SS().post = to; A.touch(); A.render(); };


  /* ================= PANORAMAS (item editor) ================= */
  function pv() { var it = A.curItem(); it.yaw = it.yaw == null ? 0 : it.yaw; it.pitch = it.pitch == null ? 0 : it.pitch; it.hfov = it.hfov || 100; return it; }
  var panoViewer = null, panoFile = null;
  var pvLock = false;
  function pushView(it) { if (!panoViewer) return; pvLock = true; try { panoViewer.setYaw(it.yaw, false); panoViewer.setPitch(it.pitch, false); panoViewer.setHfov(it.hfov, false); } finally { setTimeout(function () { pvLock = false; }, 80); } }
  function panoHero(l, it) {
    pv(); var x = (it.yaw + 180) / 360 * 100, y = (90 - it.pitch) / 180 * 100, w = it.hfov / 360 * 100, h = it.hfov * 9 / 16 / 180 * 100;
    var marks = [0, 90, 180, 270].map(function (d) { return '<span style="left:' + ((d / 360) * 100) + '%">' + d + "°</span>"; }).join("");
    var ratio = it.w && it.h ? it.w / it.h : 0, odd = ratio && Math.abs(ratio - 2) > 0.05;
    return '<section class="gl hero"><div class="hbg" style="background-image:url(' + A.mediaUrl(it.thumb || it.file) + ')"></div><div class="hh"><div class="t">' + esc(it.title) + "<em>panorama · " + BS.pad2((S.sel.item || 0) + 1) + '</em></div><div class="tools"><span data-act="item-hide" title="Hide">' + ic(it.hidden ? "eye" : "eyeOff", 19) + '</span><span data-act="item-delete" title="Delete">' + ic("trash", 19) + '</span><span data-act="item-close" title="Back to the grid">' + ic("close", 19) + '</span></div></div><div class="stage"><div class="panoflat" id="panoflat"><img src="' + A.mediaUrl(it.file) + '" draggable="false"><i class="horizon"></i><div class="marks">' + marks + '</div><div class="swin" id="swin" style="left:' + (x - w / 2) + "%;top:" + (y - h / 2) + "%;width:" + w + "%;height:" + h + '%"><i class="cross"></i><b></b></div></div></div><div class="panotag">' + (it.w ? "flat image · " + it.w + " × " + it.h : "flat image") + (odd ? " · not 2:1: shown flat only" : "") + (it.w && it.w < 4096 ? " · under 4096 px wide: soft in 360°" : "") + "</div></section>";
  }
  function panoRight(l, it) {
    pv(); var on = !!it.view360, rot = it.autoRotate !== false;
    return '<div class="right"><section class="gl card"><div class="ch"><h3>start view</h3><span class="tag">what a visitor sees first</span></div><div class="pano360" id="pano360"><span class="hintpill">drag to look around</span></div><div class="stats"><div class="st"><small>yaw</small><input class="num ac" data-pano="yaw" value="' + Math.round(it.yaw) + '"></div><div class="st"><small>pitch</small><input class="num ac" data-pano="pitch" value="' + Math.round(it.pitch) + '"></div><div class="st"><small>zoom</small><input class="num" data-pano="hfov" value="' + Math.round(it.hfov) + '"></div></div><div class="sl"><span>Zoom</span><input type="range" class="range" style="--p:' + Math.round((it.hfov - 60) / 60 * 100) + '%" data-pano="hfovr" min="60" max="120" step="1" value="' + Math.round(it.hfov) + '"><span class="v">' + Math.round(it.hfov) + "°</span></div></section>" +
      '<section class="gl card"><div class="ch"><h3>details</h3></div><div class="field"><label>title</label><input class="in" data-bind="item.title" value="' + esc(it.title || "") + '"></div><div class="field"><label>label (Interior, Exterior…)</label><input class="in" data-bind="item.meta" value="' + esc(it.meta || "") + '"></div><div class="field"><label>caption · optional</label><textarea class="in ta" rows="2" data-bind="item.caption">' + esc(it.caption || "") + "</textarea></div></section>" +
      '<section class="gl card"><div class="ch"><h3>viewing</h3></div><div class="row"><span>Offer "View in 360°"<div class="mono hint">prepares the extra file the viewer needs on file://</div></span><span class="tog' + (on ? "" : " off") + '" data-act="pano-360" role="button" tabindex="0"></span></div><div class="row"><span>Auto-rotate slowly<div class="mono hint">stops when someone touches it</div></span><span class="tog' + (rot ? "" : " off") + '" data-act="pano-rot" role="button" tabindex="0"></span></div></section>' +
      '<section class="gl card"><div class="ch"><h3>item</h3></div><div class="row"><span>Show in presentation</span><span class="tog' + (it.hidden ? " off" : "") + '" data-act="item-hide" role="button" tabindex="0"></span></div><div class="cta"><span class="pill' + (S.sel.item === 0 ? " dis" : "") + '" data-act="item-move" data-v="-1" role="button" tabindex="0">Earlier</span><span class="pill" data-act="item-move" data-v="1" role="button" tabindex="0">Later</span></div></section></div>';
  }
  A.itemEditors.panoramas = { hero: panoHero, right: panoRight };
  Act["pano-360"] = function () { var it = A.curItem(); it.view360 = !it.view360; A.touch(); A.render(); };
  Act["pano-rot"] = function () { var it = A.curItem(); if (it.autoRotate === false) delete it.autoRotate; else it.autoRotate = false; A.touch(); A.render(); };
  function norm(it) { it.yaw = Math.max(-180, Math.min(180, it.yaw)); it.pitch = Math.max(-90, Math.min(90, it.pitch)); }
  function paintWin(it) {
    var w = A.$("#swin"); if (!w) return; var x = (it.yaw + 180) / 360 * 100, y = (90 - it.pitch) / 180 * 100, ww = it.hfov / 360 * 100, h = it.hfov * 9 / 16 / 180 * 100;
    w.style.left = (x - ww / 2) + "%"; w.style.top = (y - h / 2) + "%"; w.style.width = ww + "%"; w.style.height = h + "%";
    ["yaw", "pitch", "hfov"].forEach(function (k) { var i = A.$('[data-pano="' + k + '"]'); if (i && document.activeElement !== i) i.value = Math.round(it[k]); });
  }
  A.panoAfter = function () {
    var box = A.$("#panoflat"), it = S.screen === "content" && A.curLeaf() && A.curLeaf().type === "panoramas" ? A.curItem() : null; if (!box || !it) { if (panoViewer) { try { panoViewer.destroy(); } catch (e) {} panoViewer = null; } return; }
    pv(); var drag = false;
    function setFromPointer(e) { var r = box.getBoundingClientRect(); it.yaw = ((e.clientX - r.left) / r.width) * 360 - 180; it.pitch = 90 - ((e.clientY - r.top) / r.height) * 180; norm(it); paintWin(it); pushView(it); }
    box.addEventListener("pointerdown", function (e) { drag = true; box.setPointerCapture(e.pointerId); setFromPointer(e); e.preventDefault(); });
    box.addEventListener("pointermove", function (e) { if (drag) setFromPointer(e); });
    box.addEventListener("pointerup", function () { if (drag) { drag = false; A.touch(); } });
    // small 360 preview (WebGL needs a same-origin image: the file is read by the app and shown from a blob)
    var host = A.$("#pano360"); if (!host || !window.pannellum) return;
    api.readFile(S.dir + "/" + it.file).then(function (buf) {
      if (A.$("#pano360") !== host) return;
      var url = URL.createObjectURL(new Blob([buf], { type: /\.png$/i.test(it.file) ? "image/png" : "image/jpeg" }));
      if (panoViewer) { try { panoViewer.destroy(); } catch (e) {} }
      panoViewer = pannellum.viewer(host, { type: "equirectangular", panorama: url, autoLoad: true, showControls: false, yaw: it.yaw, pitch: it.pitch, hfov: it.hfov, minHfov: 60, maxHfov: 120, compass: false, mouseZoom: true, friction: .12 });
      var sync = function () { if (pvLock) return; it.yaw = panoViewer.getYaw(); it.pitch = panoViewer.getPitch(); it.hfov = panoViewer.getHfov(); norm(it); paintWin(it); A.touch(); };
      var userDown = false; host.addEventListener("pointerdown", function () { userDown = true; }); host.addEventListener("pointerup", function () { if (userDown) { userDown = false; setTimeout(sync, 60); } }); host.addEventListener("wheel", function () { setTimeout(sync, 200); });
      window.__panoViewer = panoViewer;
    }, A.err);
  };
  document.addEventListener("input", function (e) {
    var t = e.target; if (!t.dataset.pano) return; var it = A.curItem(), k = t.dataset.pano;
    if (k === "hfovr") { it.hfov = +t.value; t.style.setProperty("--p", Math.round((it.hfov - 60) / 60 * 100) + "%"); var v = t.parentElement.querySelector(".v"); if (v) v.textContent = Math.round(it.hfov) + "°"; }
    else { var n = parseFloat(t.value); if (!isFinite(n)) return; it[k] = k === "hfov" ? Math.max(60, Math.min(120, n)) : n; }
    norm(it); paintWin(it); pushView(it); A.touch();
  });

  /* ================= LINKS (item inspector) ================= */
  function linkWarn(it) { var u = (it.url || "").trim(); if (!u || u === "https://") it.warn = "Set the link address"; else if (it.warn === "Set the link address") delete it.warn; }
  function linksHero(l, it) {
    return '<section class="gl hero"><div class="hbg" style="background-image:url(' + A.mediaUrl(it.file) + ')"></div><div class="hh"><div class="t">' + esc(it.title) + "<em>link · " + BS.pad2((S.sel.item || 0) + 1) + '</em></div><div class="tools"><span data-act="item-hide" title="Hide">' + ic(it.hidden ? "eye" : "eyeOff", 19) + '</span><span data-act="item-delete" title="Delete">' + ic("trash", 19) + '</span><span data-act="item-close" title="Back to the grid">' + ic("close", 19) + '</span></div></div><div class="stage"><div class="pv linkcard"><img src="' + A.mediaUrl(it.file) + '"><div class="lkl"><b>' + esc(it.title) + "</b><span>Opens in a new window</span></div></div></div></section>";
  }
  function linksRight(l, it) {
    linkWarn(it); var u = (it.url || "").trim(), https = /^https:\/\//i.test(u), http = /^http:\/\//i.test(u), empty = !u || u === "https://", t = S.ed.links.test;
    var chip = empty ? '<span class="chp warn">' + ic("warning", 12) + "address missing: cannot be exported</span>" : https ? '<span class="chp ok">' + ic("tick", 12) + "https</span>" : http ? '<span class="chp warn">' + ic("warning", 12) + "http: not encrypted</span>" : "";
    var res = t && t.url === u ? (t.ok ? '<span class="chp ok">' + ic("tick", 12) + "reachable (" + t.status + ")</span>" : '<span class="chp warn">' + ic("warning", 12) + "not reachable: " + esc(t.error || t.status) + "</span>") : "";
    return '<div class="right"><section class="gl card"><div class="ch"><h3>link</h3><span class="chp">needs internet</span></div><div class="field"><label>title</label><input class="in" data-bind="item.title" value="' + esc(it.title || "") + '"></div><div class="field"><label>web address</label><input class="in mono" data-linkurl="1" data-bind="item.url" value="' + esc(it.url || "") + '" placeholder="https://"></div><div class="row">' + chip + res + '<span class="pill sm' + (empty ? " dis" : "") + '" data-act="link-test" role="button" tabindex="0">Test</span></div><div class="mono hint">Opens in a new window; the address is never shown to the viewer.</div></section>' +
      '<section class="gl card"><div class="ch"><h3>card image</h3></div><div class="linkprev"><img src="' + A.mediaUrl(it.file) + '"></div><div class="row"><span class="mono hint">use a screenshot of the page; 16:10 works best</span><span class="pill sm" data-act="link-image" role="button" tabindex="0">Change</span></div></section>' +
      '<section class="gl card"><div class="ch"><h3>show</h3></div><div class="row"><span>Show in presentation</span><span class="tog' + (it.hidden ? " off" : "") + '" data-act="item-hide" role="button" tabindex="0"></span></div><div class="cta"><span class="pill' + (S.sel.item === 0 ? " dis" : "") + '" data-act="item-move" data-v="-1" role="button" tabindex="0">Earlier</span><span class="pill" data-act="item-move" data-v="1" role="button" tabindex="0">Later</span></div></section></div>';
  }
  A.itemEditors.links = { hero: linksHero, right: linksRight };
  Act["link-test"] = function () { var it = A.curItem(), u = it.url; S.ed.links.test = { url: u, pending: true }; return api.testUrl(u).then(function (r) { S.ed.links.test = Object.assign({ url: u }, r); A.render(); }, A.err); };
  Act["link-image"] = function () { var l = A.curLeaf(), sec = A.curSec(), it = A.curItem(); return api.pick({ kind: "image" }).then(function (p) { if (!p) return; var rel = "media/" + sec.id + (sec.children && sec.children.length ? "/" + l.id : ""); return api.importMedia({ dir: S.dir, rel: rel, type: "gallery", paths: [p[0]] }).then(function (r) { if (r.items[0]) { it.file = r.items[0].file; it.thumb = r.items[0].thumb; A.touch(); A.render(); } }); }, A.err); };
  document.addEventListener("change", function (e) {
    var t = e.target; if (!t.dataset.linkurl) return; var it = A.curItem(), v = t.value.trim();
    if (v && !/^[a-z][a-z0-9+.-]*:/i.test(v)) { v = "https://" + v; t.value = v; }
    it.url = v; linkWarn(it); A.touch();
  });

  A.after2 = function () { A.flipAfter && A.flipAfter(); A.panoAfter && A.panoAfter(); };
})();
