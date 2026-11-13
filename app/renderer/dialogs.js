/* Dialogs: new project, confirm, export (config / progress / report), crop, full preview. */
(function () {
  "use strict";
  var A = window.A, S = A.S, ic = A.ic, esc = A.esc;

  /* ---------- generic ---------- */
  A.dialogs.confirm = function () {
    var d = S.dialog;
    return '<div class="scrim"><div class="dlg" style="width:520px"><div class="dh"><div><h2>' + esc(d.title) + "</h2><p>" + esc(d.text) + '</p></div></div><div class="df"><span class="grow"></span><span class="pill" data-act="dlg-close" role="button" tabindex="0">Cancel</span><span class="pill ' + (d.danger ? "danger" : "pri") + '" data-act="' + d.act + '" data-v="' + esc(d.v || "") + '" role="button" tabindex="0">' + esc(d.label) + "</span></div></div></div>";
  };
  A.dialogs.newproject = function () {
    var d = S.dialog, tpls = S.info ? S.info.templates : [];
    var opts = '<div class="opt' + (d.kind2 === "blank" ? " on" : "") + '" data-act="np-kind" data-v="blank" role="button" tabindex="0"><span class="ico">' + ic("plus", 22) + "</span><div><b>Blank presentation</b><span class=\"d\">no sections; add your own</span></div></div>" +
      tpls.map(function (t) { return '<div class="opt' + (d.kind2 === "t:" + t.dir ? " on" : "") + '" data-act="np-kind" data-v="t:' + esc(t.dir) + '" role="button" tabindex="0"><span class="ico">' + ic("layout", 22) + "</span><div><b>" + esc(t.name) + '</b><span class="d">copies its structure and media</span></div></div>'; }).join("");
    return '<div class="scrim"><div class="dlg" style="width:640px"><div class="dh"><div><h2>New project</h2><p>a project is a plain folder: project.json + media</p></div><span class="x" data-act="dlg-close" role="button" tabindex="0">' + ic("close", 16) + '</span></div><div class="db"><div class="field"><label>name</label><input class="in" id="np-name" value="' + esc(d.name || "") + '" placeholder="e.g. Harbour Residences" maxlength="60" autofocus></div><div class="lbl" style="margin-top:14px">start from</div>' + opts + '</div><div class="df"><span class="grow"></span><span class="pill" data-act="dlg-close" role="button" tabindex="0">Cancel</span><span class="pill pri" data-act="np-create" role="button" tabindex="0">Create ' + ic("tick", 16) + "</span></div></div></div>";
  };

  /* ---------- export ---------- */
  var FORMATS = [["exe", "app", "Windows app (.exe + data file)", "A folder with a small .exe and one encrypted data file. Double-click, PIN, fullscreen. No install. Recommended."], ["html", "code", "Single HTML", "Everything embedded in one file. Only practical for small decks."], ["zip", "archive", "ZIP · HTML + assets", "Folder you can host or copy. Same as today's exports."]];
  function sizeOf(e) {                                   // bytes for the ticked parts
    var est = e.est; if (!est) return 0, 0;
    var t = 0;
    est.sections.forEach(function (s) {
      if (s.hidden || !e.inc[s.id]) return;
      if (s.subs.length) s.subs.forEach(function (c) { if (!c.hidden && e.inc[s.id + "/" + c.id] !== false) t += c.media; }); else t += s.media;
    });
    return t;
  }
  A.exportEst = function (e) { var m = sizeOf(e), html = Math.round(m * 4 / 3) + 800000; return { exe: m + 900000, zip: m + 700000, html: html, media: m }; };
  A.dialogs.export = function () {
    var e = S.dialog, st = e.step || "config";
    if (st === "progress") return progress(e);
    if (st === "report") return report(e);
    var est = A.exportEst(e), items = 0;
    var htmlLevel = est.html > 1073741824 ? "bad" : est.html > 314572800 ? "warn" : "ok";
    var rows = FORMATS.map(function (f) { var bad = f[0] === "html" && htmlLevel === "bad"; return '<div class="opt' + (e.format === f[0] ? " on" : "") + (bad ? " bad" : "") + '" data-act="exp-format" data-v="' + f[0] + '" role="button" tabindex="0"><span class="ico">' + ic(f[1], 22) + "</span><div><b>" + f[2] + '</b><span class="d">' + f[3] + '</span></div><div class="sz"><b>' + A.fmtBytes(est[f[0]]) + "</b><br>" + (bad ? "too large" : "estimated") + "</div></div>"; }).join("");
    var alert = "";
    if (e.format === "html" && htmlLevel === "bad") alert = '<div class="alert bad">' + ic("warning", 18) + "<span><b>" + A.fmtBytes(est.html) + " is too big for one HTML file.</b> Browsers fail above about 1 GB, and warn from 300 MB. Untick sections, or use the .exe / ZIP. Export is disabled.</span></div>";
    else if (e.format === "html" && htmlLevel === "warn") alert = '<div class="alert">' + ic("warning", 18) + "<span><b>" + A.fmtBytes(est.html) + " is large for one HTML file.</b> It may open slowly or fail in some browsers.</span></div>";
    var pinBoxes = [0, 1, 2, 3].map(function (i) { return '<input class="pinin" maxlength="1" inputmode="numeric" data-pin="' + i + '" value="' + esc((e.pin || "")[i] || "") + '"' + (e.pinOn ? "" : " disabled") + ">"; }).join("");
    var inc = e.est ? e.est.sections.map(function (s) {
      var hidden = s.hidden, on = !hidden && e.inc[s.id];
      var html = '<div class="r ' + (hidden ? "off" : "") + '" data-act="exp-inc" data-v="' + esc(s.id) + '" role="button" tabindex="0"><span class="chk ' + (on ? "on" : "") + '">' + (on ? ic("tick", 12) : "") + '</span><span class="nm">' + esc(s.title) + '</span><span class="sz">' + (hidden ? "hidden" : s.media ? A.fmtBytes(s.media) : "link") + "</span></div>";
      s.subs.forEach(function (c) { var son = on && e.inc[s.id + "/" + c.id] !== false && !c.hidden; html += '<div class="r sub ' + (c.hidden || !on ? "off" : "") + '" data-act="exp-inc" data-v="' + esc(s.id + "/" + c.id) + '" role="button" tabindex="0"><span class="chk ' + (son ? "on" : "") + '">' + (son ? ic("tick", 12) : "") + '</span><span class="nm">' + esc(c.title) + '</span><span class="sz">' + (c.hidden ? "hidden" : A.fmtBytes(c.media)) + "</span></div>"; });
      return html;
    }).join("") : '<div class="mono hint">measuring…</div>';
    var nSec = e.est ? e.est.sections.filter(function (s) { return !s.hidden && e.inc[s.id]; }).length : 0;
    var mins = Math.max(1, Math.round(est.media / 1073741824 * 0.7 + (e.browser ? 1.2 : 0.2)));
    var cantHtml = e.format === "html" && htmlLevel === "bad", noPin = e.pinOn && (e.pin || "").length !== 4;
    return '<div class="scrim"><div class="dlg" style="width:1120px;max-height:94vh"><div class="dh"><div><h2>Export</h2><p>' + esc(S.project.name) + " · " + nSec + ' sections ticked</p></div><span class="x" data-act="dlg-close" role="button" tabindex="0">' + ic("close", 16) + '</span></div><div class="db" style="display:grid;grid-template-columns:1fr 330px;gap:30px;overflow:auto"><div><div class="lbl">format</div>' + rows + alert +
      '<div style="display:flex;gap:26px;margin-top:16px"><div><div class="lbl">viewer</div><span class="seg"><span class="' + (e.mode === "desktop" ? "on" : "") + '" data-act="exp-mode" data-v="desktop" role="button" tabindex="0">' + ic("desktop", 15) + 'Desktop</span><span class="' + (e.mode === "touch" ? "on" : "") + '" data-act="exp-mode" data-v="touch" role="button" tabindex="0">' + ic("tablet", 15) + 'Touch</span></span></div><div style="flex:1"><div class="lbl">pin · 4 digits</div><div style="display:flex;gap:14px;align-items:center"><span class="tog' + (e.pinOn ? "" : " off") + '" data-act="exp-pin" role="button" tabindex="0"></span><div class="pinbox2">' + pinBoxes + "</div></div></div></div>" +
      '<div class="alert info" style="margin-top:14px">' + ic("lock", 16) + "<span>The PIN keeps casual viewers out. It is not real security: 10,000 combinations. In the .exe data file the media is encrypted; in HTML / ZIP the files stay readable.</span></div>" +
      '<div class="lbl" style="margin-top:16px">save to</div><div class="pathchip"><span style="color:var(--accent)">' + ic("folder", 18) + '</span><div style="min-width:0"><b style="word-break:break-all">' + esc(e.outDir || "") + '</b></div><span class="grow" style="flex:1"></span><span class="pill sm" data-act="exp-folder" role="button" tabindex="0">Change</span></div>' +
      (e.format === "exe" ? '<div class="row" style="margin-top:8px"><span>Also zip the folder for sending</span><span class="tog' + (e.zip ? "" : " off") + '" data-act="exp-zip" role="button" tabindex="0"></span></div>' : "") +
      '<div class="row"><span>Run the full open-test afterwards (slower)</span><span class="tog' + (e.browser ? "" : " off") + '" data-act="exp-browser" role="button" tabindex="0"></span></div></div>' +
      '<div><div class="lbl">include</div><div class="inc">' + inc + "</div></div></div>" +
      '<div class="df"><div class="est"><b>' + A.fmtBytes(est[e.format]) + "</b> · about " + mins + ' min' + (cantHtml ? " · blocked above 1 GB" : "") + '</div><span class="grow"></span><span class="pill" data-act="dlg-close" role="button" tabindex="0">Cancel</span><span class="pill pri' + (cantHtml || noPin || !nSec ? " dis" : "") + '" data-act="exp-go" role="button" tabindex="0">Export ' + ic("export", 16) + "</span></div></div></div>";
  };
  function progress(e) {
    var steps = [["collect", "Collect media"], ["build", "Build viewer"], ["pack", e.format === "exe" ? "Pack and encrypt" + (e.pinOn ? " (PIN)" : "") : e.format === "html" ? "Embed media" : "Write the ZIP"], ["check", "Check the result"]];
    var order = steps.map(function (s) { return s[0]; }), cur = Math.max(0, order.indexOf(e.cur || "collect"));
    var total = A.exportEst(e).media || 1, pct = e.cur === "check" ? 92 : e.cur === "pack" ? Math.min(90, 8 + Math.round((e.bytes || 0) / total * 80)) : e.cur === "build" ? 6 : 2;
    if (e.finishing) pct = 100;
    var secs = Math.round((Date.now() - e.t0) / 1000);
    return '<div class="scrim"><div class="dlg" style="width:760px"><div class="dh"><div><h2>Exporting…</h2><p>' + esc(FORMATS.filter(function (f) { return f[0] === e.format; })[0][2]) + " · " + (e.mode === "touch" ? "Touch" : "Desktop") + (e.pinOn ? " · PIN on" : "") + '</p></div></div><div class="db"><div style="display:flex;align-items:baseline;gap:12px;margin-bottom:12px"><span style="font:300 56px var(--font);letter-spacing:-.04em" id="expPct">' + pct + '</span><span style="font:400 18px var(--mono);color:var(--muted)">%</span><span class="mono" style="margin-left:auto;font:400 12px var(--mono);color:var(--muted)" id="expTime">' + secs + ' s</span></div><div class="prog" style="margin-bottom:20px"><i id="expBar" style="width:' + pct + '%"></i></div><div class="steps">' + steps.map(function (s, i) {
      var cls = i < cur ? "done" : i === cur ? "cur" : "wait";
      return '<div class="stp ' + cls + '"><span class="m">' + (i < cur ? ic("tick", 13) : i === cur ? '<span class="spin"></span>' : "") + "</span>" + s[1] + '<span class="t" id="stp-' + s[0] + '">' + (i === cur ? esc((e.detail || "") + (e.file ? " · " + e.file.split("/").pop() : "")) : "") + "</span></div>";
    }).join("") + '</div></div><div class="df"><span class="grow"></span><span class="pill" data-act="exp-cancel" role="button" tabindex="0">Cancel export</span></div></div></div>';
  }
  function report(e) {
    var r = e.result, err = e.error;
    if (err) return '<div class="scrim"><div class="dlg" style="width:760px"><div class="dh"><div><h2>' + (e.cancelled ? "Export cancelled" : "Export failed") + '</h2><p>' + esc(err) + '</p></div><span class="x" data-act="dlg-close" role="button" tabindex="0">' + ic("close", 16) + '</span></div><div class="df"><span class="grow"></span><span class="pill pri" data-act="dlg-close" role="button" tabindex="0">Close</span></div></div></div>';
    var ok = r.check.ok;
    var cards = r.check.checks.map(function (c) { var cls = c.ok ? "" : c.skipped ? " w" : " bad"; return '<div class="ckc' + cls + '"><span class="m">' + ic(c.ok ? "tick" : "warning", 15) + "</span><div><b>" + esc(c.name.charAt(0).toUpperCase() + c.name.slice(1)) + (c.skipped ? " (skipped)" : c.ok ? "" : " (FAILED)") + "</b><span>" + esc(c.detail) + "</span></div></div>"; }).join("");
    var notes = (r.warnings || []).slice(0, 3).map(function (w) { return '<div class="ckc w" style="grid-column:1 / 3"><span class="m">' + ic("warning", 15) + "</span><div><b>Note</b><span>" + esc(w) + "</span></div></div>"; }).join("");
    var main = r.file, shown = e.format === "exe" ? r.dir : r.file;
    return '<div class="scrim"><div class="dlg" style="width:940px;max-height:94vh"><div class="dh"><div><h2>' + (ok ? "Export finished" : "Export finished, a check failed") + "</h2><p>" + esc(FORMATS.filter(function (f) { return f[0] === e.format; })[0][2]) + " · " + (e.mode === "touch" ? "Touch" : "Desktop") + (e.pinOn ? " · PIN on" : "") + " · " + Math.round((Date.now() - e.t0) / 1000) + ' s</p></div><span class="x" data-act="dlg-close" role="button" tabindex="0">' + ic("close", 16) + '</span></div><div class="db" style="overflow:auto"><div class="pathchip"><span style="color:var(--accent)">' + ic(e.format === "exe" ? "app" : e.format === "html" ? "code" : "archive", 20) + "</span><div style=\"min-width:0\"><b>" + esc(main.split("\\").pop()) + '</b><div style="margin-top:2px;color:var(--muted);word-break:break-all">' + esc(shown) + " · " + A.fmtBytes(r.bytes) + (r.zip ? " · also " + esc(r.zip.split("\\").pop()) : "") + '</div></div><span class="grow" style="flex:1"></span><span class="pill sm" data-act="exp-reveal" role="button" tabindex="0">' + ic("folder", 14) + 'Show in folder</span><span class="pill sm" data-act="exp-copy" role="button" tabindex="0">' + ic("copy", 14) + 'Copy path</span></div><div class="lbl" style="margin-top:22px">check report</div><div class="ck">' + cards + notes + '</div></div><div class="df"><span class="pill" data-act="exp-test" role="button" tabindex="0">Open a test run</span>' + (ok ? "" : '<span class="pill" data-act="exp-again" role="button" tabindex="0">Re-run export</span>') + '<span class="grow"></span><span class="pill pri' + (ok ? "" : " dis") + '" data-act="dlg-close" role="button" tabindex="0">Done ' + ic("tick", 16) + "</span></div></div></div>";
  }

  /* ---------- crop ---------- */
  A.dialogs.crop = function () {
    var d = S.dialog, it = A.curItem(); if (!it) return "";
    var r = d.rect, W = d.sw || 0, H = d.sh || 0, pw = Math.round(r.w * W), ph = Math.round(r.h * H);
    var below = pw && pw < 1920 && ph < 1080;
    var asp = [["free", "Free"], ["orig", "Original"], ["16:9", "16:9"], ["4:3", "4:3"], ["1:1", "1:1"], ["9:16", "9:16"]].map(function (a) { return '<span class="' + (d.aspect === a[0] ? "on" : "") + '" data-act="crop-aspect" data-v="' + a[0] + '" role="button" tabindex="0">' + a[1] + "</span>"; }).join("");
    return '<div class="scrim"><div class="dlg" style="width:1180px;height:700px"><div class="dh"><div><h2>Crop image</h2><p>' + esc((it.file || "").split("/").pop()) + " · " + W + " × " + H + '</p></div><span class="x" data-act="dlg-close" role="button" tabindex="0">' + ic("close", 16) + '</span></div><div class="db" style="flex:1;display:grid;grid-template-columns:1fr 300px;gap:24px;min-height:0"><div class="cropwrap" id="cropwrap"><img id="cropimg" src="' + A.mediaUrl(it.file) + '" draggable="false"><div id="cropmask"></div><div class="crect" id="crect"><i class="v1"></i><i class="v2"></i><i class="h1"></i><i class="h2"></i><i class="hdl a" data-c="nw"></i><i class="hdl b" data-c="ne"></i><i class="hdl c" data-c="sw"></i><i class="hdl d" data-c="se"></i><i class="eh t" data-c="n"></i><i class="eh b" data-c="s"></i><i class="eh l" data-c="w"></i><i class="eh r" data-c="e"></i></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:22px"><div><div class="lbl">aspect</div><div class="asp">' + asp + '</div></div><div><div class="lbl">result</div><div class="big2" id="cropres">' + pw.toLocaleString("en-US") + " × " + ph.toLocaleString("en-US") + '</div><div class="mono hint" id="cropnote">' + Math.round(r.w * 100) + " % of the original width" + (below ? " · below full HD" : "") + '</div></div><div class="alert info">' + ic("info", 16) + "<span>Saved as a <b>lossless PNG copy</b>. The original stays in the project and can be restored any time.</span></div></div></div>" +
      '<div class="df"><span class="pill sm ghostb" data-act="crop-reset" role="button" tabindex="0">Reset</span><span class="grow"></span><span class="pill" data-act="dlg-close" role="button" tabindex="0">Cancel</span><span class="pill pri" data-act="crop-save" role="button" tabindex="0">Save crop ' + ic("tick", 16) + "</span></div></div></div>";
  };

  /* ---------- full preview ---------- */
  A.SIZES = [["1920x1080", "1080p · 1920×1080"], ["3840x2160", "4K scaled · 3840×2160"], ["1280x720", "720p · 1280×720"], ["1024x768", "Projector · 1024×768"], ["1180x820", "Tablet · 1180×820"]];
  A.dialogs.preview = function () {
    return '<div class="pvfull"><header class="gl top" style="grid-template-columns:auto 1fr auto"><div class="tl"><span class="ib bk" data-act="dlg-close" role="button" tabindex="0">' + ic("chev", 16) + '</span><span class="crumb"><i></i><b>Preview</b></span></div><div style="display:flex;justify-content:center;gap:10px"><span class="seg"><span class="' + (S.mode === "desktop" ? "on" : "") + '" data-act="mode" data-v="desktop" role="button" tabindex="0">' + ic("desktop", 15) + 'Desktop</span><span class="' + (S.mode === "touch" ? "on" : "") + '" data-act="mode" data-v="touch" role="button" tabindex="0">' + ic("tablet", 15) + 'Touch</span></span><span class="pill" data-act="size-menu" role="button" tabindex="0">' + esc((A.SIZES.filter(function (s) { return s[0] === S.size; })[0] || [0, S.size])[1]) + " " + ic("chev", 13) + '</span><span class="pill' + (S.pvFit === false ? "" : " on") + '" data-act="pv-fit" role="button" tabindex="0">' + (S.pvFit === false ? "100 %" : "Fit") + '</span></div><div class="tr"><span class="pill" data-act="pv-restart" role="button" tabindex="0">' + ic("arrowRight", 14) + ' Restart</span><span class="pill pri" data-act="dlg-close" role="button" tabindex="0">Close <span style="opacity:.5">esc</span></span></div></header><div class="gl pvstage" id="pvstage"><div class="devbox" id="devbox"></div><span class="tag pvtag">live viewer · exactly what is exported</span></div></div>';
  };
  /* ---------- share popover (SPEC-APP 3.10) ---------- */
  A.sharePop = function () {
    var sh = S.share, st = sh.st, on = st.on, ads = st.adapters || [];
    var cur = on ? st.ip : (sh.ip || (ads[0] && ads[0].ip) || "");
    var qr = on && sh.qr ? '<svg class="qr" viewBox="-1 -1 ' + (sh.qr.n + 2) + " " + (sh.qr.n + 2) + '" fill="#161212" shape-rendering="crispEdges"><rect x="-1" y="-1" width="' + (sh.qr.n + 2) + '" height="' + (sh.qr.n + 2) + '" fill="#fff"/><path d="' + sh.qr.path + '"/></svg>' : '<div class="qr off"></div>';
    var fw = st.firewall, fwChip = !on ? "" : fw === "allowed" || fw === "off" ? '<span class="chp ok">' + ic("tick", 12) + (fw === "off" ? "firewall off" : "firewall allowed") + "</span>" : fw === "checking" || !fw ? '<span class="chp">checking firewall…</span>' : '<span class="chp warn">' + ic("warning", 12) + "allow Presento in the Windows prompt</span>";
    var pinBoxes = [0, 1, 2, 3].map(function (i) { return '<input class="pinin sm" maxlength="1" inputmode="numeric" data-spin="' + i + '" value="' + esc((sh.pin || "")[i] || "") + '"' + (sh.pinOn ? "" : " disabled") + ">"; }).join("");
    var devs = (st.devices || []).map(function (d) { return '<div class="dev-row"><span class="m">' + ic(/iPad|tablet/i.test(d.label) ? "tablet" : "desktop", 17) + "</span>" + esc(d.label) + " · " + esc(d.ip) + "<em>" + (d.ago < 5 ? "just now" : d.ago < 90 ? d.ago + " s" : Math.round(d.ago / 60) + " min") + (d.live ? "" : " · idle") + "</em></div>"; }).join("") || '<div class="mono hint">nobody yet</div>';
    return '<div class="menu-scrim" data-act="share-open"></div><div class="pop" style="left:96px;bottom:84px;z-index:70"><div class="ch"><div><h2 style="font-size:22px">Share on network</h2><div class="mono hint">anyone on this network can view</div></div><span class="tog' + (on ? "" : " off") + '" data-act="share-toggle" role="button" tabindex="0"></span></div>' +
      '<div class="field"><label>network</label><select class="in sel" id="share-adapter"' + (on ? " disabled" : "") + ">" + ads.map(function (a) { return '<option value="' + a.ip + '"' + (a.ip === cur ? " selected" : "") + ">" + esc(a.name) + " · " + a.ip + "</option>"; }).join("") + (ads.length ? "" : "<option>no network found</option>") + "</select></div>" +
      '<div class="url"><span style="color:var(--accent)">' + ic("wifi", 16) + '</span><span id="share-url" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">' + (on ? esc(st.url) : "starts when you switch it on") + '</span><span class="pill' + (on ? "" : " dis") + '" data-act="share-copy" role="button" tabindex="0">' + ic("copy", 14) + "Copy</span></div>" +
      '<div style="display:flex;gap:16px;align-items:center">' + qr + '<div style="font-size:13px;color:var(--muted);line-height:1.5">Scan with a phone or tablet on the same Wi-Fi.<div style="margin-top:10px">' + fwChip + "</div></div></div>" +
      '<div class="row"><span>Viewer</span><span class="seg sm"><span class="' + (sh.mode === "touch" ? "" : "on") + '" data-act="share-mode" data-v="desktop" role="button" tabindex="0">Desktop</span><span class="' + (sh.mode === "touch" ? "on" : "") + '" data-act="share-mode" data-v="touch" role="button" tabindex="0">Touch</span></span></div>' +
      '<div class="row"><span>Require PIN</span><span style="display:flex;gap:8px;align-items:center"><span class="tog' + (sh.pinOn ? "" : " off") + '" data-act="share-pin" role="button" tabindex="0"></span><span class="pinbox2">' + pinBoxes + "</span></span></div>" +
      '<div class="lbl" style="margin:2px 0 -6px">watching now · ' + (st.devices || []).filter(function (d) { return d.live; }).length + "</div>" + devs +
      '<div class="alert info">' + ic("info", 16) + "<span>Sharing stops when you close Presento. Not reachable from the internet. The PIN is a gate for casual viewers only.</span></div>" +
      '<span class="pill' + (on ? "" : " dis") + '" style="justify-content:center" data-act="share-stop" role="button" tabindex="0">Stop sharing</span></div>';
  };
})();
