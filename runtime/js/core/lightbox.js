/* Full-screen lightbox: next/prev, swipe, keyboard, captions, FLIP open/close from the thumbnail.
   BS.lightbox.open(items, index, originEl, opts)  items: [{src, w, h, title, caption}]
   opts.actions: [{label, icon, show(item, i) → bool, onClick(item, i)}] = extra pills in the top bar (e.g. "View in 360°"); opts.onChange(i) */
(function () {
  "use strict";
  var el = BS.el;
  var S = null;               // active state

  var FULL = false;                                  // R13d: image fullscreen (edge to edge, UI hidden)
  function fitRect(item, vw, vh) {
    if (FULL) { var a = (item.w && item.h) ? item.w / item.h : 1.5, fw = vw, fh = fw / a; if (fh > vh) { fh = vh; fw = fh * a; } return { w: Math.round(fw), h: Math.round(fh), l: Math.round((vw - fw) / 2), t: Math.round((vh - fh) / 2) }; }
    var maxW = Math.max(200, vw - 220), maxH = Math.max(200, vh - 250);
    var ar = (item.w && item.h) ? item.w / item.h : 1.5;
    var w = maxW, h = w / ar;
    if (h > maxH) { h = maxH; w = h * ar; }
    return { w: Math.round(w), h: Math.round(h), l: Math.round((vw - w) / 2), t: Math.round(88 + (maxH - h) / 2) };
  }

  function makeImg(item) {
    var img = el("img.lb-img", { src: item.src, alt: item.title || "", draggable: "false" });
    place(img, item);
    return img;
  }
  function place(img, item) {
    var r = fitRect(item, window.innerWidth, window.innerHeight);
    img.style.width = r.w + "px"; img.style.height = r.h + "px"; img.style.left = r.l + "px"; img.style.top = r.t + "px";
  }

  /* ---- touch build: zoom / pan state (S.z = {s, tx, ty}); the picture is scaled with transform around its own centre ---- */
  var ZMAX = 6;
  function isWide(it) { return BS.touch && it.w && it.h && it.w / it.h >= 2.4; }          // very wide panoramas start filled to the screen height and pan sideways
  function wideScale(it) {
    var r = fitRect(it, window.innerWidth, window.innerHeight), maxH = Math.max(200, window.innerHeight - 250);
    return BS.clamp(maxH / r.h, 1, ZMAX);
  }
  function restZ(it) { return { s: isWide(it) ? wideScale(it) : 1, tx: 0, ty: 0 }; }
  function zStr(z) { return z.s === 1 && !z.tx && !z.ty ? "none" : "translate(" + z.tx.toFixed(1) + "px," + z.ty.toFixed(1) + "px) scale(" + z.s.toFixed(4) + ")"; }
  function restT(it) { return BS.touch ? zStr(restZ(it)) : "none"; }
  function clampZ(z, it) {
    var vw = window.innerWidth, vh = window.innerHeight, r = fitRect(it, vw, vh);
    var cx = r.l + r.w / 2, cy = r.t + r.h / 2, W = r.w * z.s, H = r.h * z.s;
    z.tx = W <= vw ? 0 : BS.clamp(z.tx, vw - cx - W / 2, W / 2 - cx);
    z.ty = H <= vh - 40 ? 0 : BS.clamp(z.ty, vh - cy - H / 2, H / 2 - cy);
    return z;
  }
  function applyZ() { S.img.style.transform = zStr(S.z); S.root.classList.toggle("lb-zoomed", S.z.s > restZ(S.items[S.i]).s * 1.06); }
  function settleZ(target, dur) {
    var from = S.img.style.transform || "none";
    S.z = clampZ(target, S.items[S.i]);
    BS.animate(S.img, [{ transform: from }, { transform: zStr(S.z) }], { duration: dur || 420, easing: BS.springs.soft.easing, fill: "none" });
    applyZ();
  }

  function setCaption() {
    var it = S.items[S.i];
    S.titleEl.textContent = it.title || "";
    S.capEl.textContent = it.caption || "";
    S.capBox.style.display = (it.title || it.caption) ? "" : "none";
    S.count.textContent = BS.pad2(S.i + 1) + " / " + BS.pad2(S.items.length);
    S.nav && BS.nav.label(S.nav, S.count.textContent);
    S.prev.classList.toggle("off", S.i === 0);
    S.next.classList.toggle("off", S.i === S.items.length - 1);
    S.acts.forEach(function (a) { a.btn.hidden = !(a.def.show ? a.def.show(it, S.i) : true); });
    S.opts.onChange && S.opts.onChange(S.i);
    [S.i - 1, S.i + 1].forEach(function (j) { if (S.items[j]) { var p = new Image(); p.src = S.items[j].src; } });
  }

  function go(dir) {
    if (!S || S.closing || S.busy) return;
    var n = S.i + dir;
    if (n < 0 || n >= S.items.length) { bump(dir); return; }
    S.busy = true;
    var old = S.img, img = makeImg(S.items[n]);
    S.i = n; S.img = img;
    if (BS.touch) { S.z = restZ(S.items[n]); img.style.transform = zStr(S.z); S.root.classList.toggle("lb-zoomed", false); }
    S.stage.appendChild(img);
    var d = 90 * dir;
    BS.animate(old, [{ opacity: 1, transform: old.style.transform || "none" }, { opacity: 0, transform: "translateX(" + (-d) + "px) scale(.96)" }], { duration: 320, easing: "cubic-bezier(.4,0,.8,.4)", fill: "forwards" }).done.then(function () { old.remove(); });
    var a = BS.animate(img, [{ opacity: 0, transform: "translateX(" + d + "px) scale(.96)" }, { opacity: 1, transform: restT(S.items[n]) }], { duration: 620, easing: BS.springs.soft.easing, fill: "none" });
    a.done.then(function () { S && (S.busy = false); });
    BS.animate(S.capBox, [{ opacity: .2, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 480, easing: "ease-out", fill: "none" });
    setCaption();
  }

  function bump(dir) {
    BS.animate(S.img, [{ transform: "none" }, { transform: "translateX(" + (-26 * dir) + "px)" }, { transform: "none" }], { duration: 420, easing: BS.springs.soft.easing, fill: "none" });
  }

  function onKey(e) {
    var topEsc = BS.escStack[BS.escStack.length - 1];
    if (!S || (topEsc !== S.esc && topEsc !== S.escFull)) return;      // something is open on top of the lightbox (e.g. the 360° view)
    if (e.key === "f" || e.key === "F") { setFull(!FULL); e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === "ArrowRight") { go(1); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === "ArrowLeft") { go(-1); e.preventDefault(); e.stopPropagation(); }
  }
  function setFull(on, quiet) {
    if (!S || FULL === on) return;
    FULL = on;
    S.root.classList.toggle("lb-full", on); document.body.classList.toggle("lb-fullimg", on);
    S.fsBtn.innerHTML = BS.icon(on ? "exitFs" : "fullscreen"); S.fsBtn.setAttribute("aria-label", on ? "Exit image full screen" : "View image full screen");
    if (on) S.escFull = BS.pushEsc(function () { setFull(false); }); else if (S.escFull) { BS.popEsc(S.escFull); S.escFull = null; }
    if (!on && !quiet && !document.fullscreenElement) { /* nothing: leaving image full screen keeps the presentation as it was */ }
    if (on && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
    if (!quiet) onResize();
  }
  function onResize() { if (!S) return; place(S.img, S.items[S.i]); if (BS.touch) { S.z = restZ(S.items[S.i]); applyZ(); } }

  /* pointer swipe */
  function bindSwipe(stage) {
    var sx = 0, dx = 0, down = false, t0 = 0, moved = false;
    stage.addEventListener("pointerdown", function (e) {
      if (S.busy || S.closing || e.target.closest("button")) return;
      S.downT = e.target; down = true; moved = false; sx = e.clientX; dx = 0; t0 = performance.now(); stage.setPointerCapture(e.pointerId);
      S.img.getAnimations().forEach(function (a) { a.cancel(); });
    });
    stage.addEventListener("pointermove", function (e) {
      if (!down) return;
      dx = e.clientX - sx; if (Math.abs(dx) > 6) moved = true;
      S.img.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 90) + "deg)"; S.img.style.opacity = String(1 - Math.min(.5, Math.abs(dx) / 900));
    });
    function end(e) {
      if (!down) return; down = false;
      var v = dx / Math.max(1, performance.now() - t0);
      var img = S.img;
      if (Math.abs(dx) > 100 || Math.abs(v) > .5) {
        var dir = dx < 0 ? 1 : -1;
        if (S.items[S.i + dir]) { img.style.transform = ""; img.style.opacity = ""; go(dir); return; }
      }
      BS.animate(img, [{ transform: img.style.transform || "none", opacity: img.style.opacity || 1 }, { transform: "none", opacity: 1 }], { duration: 520, easing: BS.springs.soft.easing, fill: "none" });
      img.style.transform = ""; img.style.opacity = "";
      if (!moved && S.downT === stage) BS.lightbox.close();      // only a press that BEGAN on the backdrop closes (pointer capture retargets the up-event to the stage)
    }
    stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
  }

  /* TOUCH gestures (pointer events, so they work with a finger, a pen or a mouse in touch mode):
     one finger  — not zoomed: swipe left/right = prev/next, swipe down = close;  zoomed: drag-pan
     two fingers — pinch-zoom (about the midpoint) and pan;  double-tap — zoom in / back out;  tap on the dim background — close */
  function bindTouch(stage) {
    var ptrs = {}, n = 0, g = null, lastTap = { t: 0, x: 0, y: 0 };
    function pts() { return Object.keys(ptrs).map(function (k) { return ptrs[k]; }); }
    function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
    function it() { return S.items[S.i]; }
    function begin1(p) { g = { mode: "one", x0: p.x, y0: p.y, t0: performance.now(), z0: Object.assign({}, S.z), axis: null, moved: false, dx: 0, dy: 0, target: p.target }; }
    stage.addEventListener("pointerdown", function (e) {
      if (!S || S.closing || e.target.closest("button")) return;
      stage.setPointerCapture(e.pointerId);
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, target: e.target }; n++;
      S.img.getAnimations().forEach(function (a) { a.cancel(); });
      var p = pts();
      if (n === 1) begin1(p[0]);
      else if (n === 2) {
        g = { mode: "pinch", d0: dist(p[0], p[1]), m0: mid(p[0], p[1]), z0: Object.assign({}, S.z), moved: true };
        S.img.style.opacity = ""; S.bg.style.opacity = "";
        S.img.style.transform = zStr(S.z);
      }
    });
    stage.addEventListener("pointermove", function (e) {
      if (!g || !ptrs[e.pointerId]) return;
      ptrs[e.pointerId].x = e.clientX; ptrs[e.pointerId].y = e.clientY;
      var p = pts(), item = it(), vw = window.innerWidth, vh = window.innerHeight;
      if (g.mode === "pinch" && n >= 2) {
        var m = mid(p[0], p[1]), s2 = BS.clamp(g.z0.s * dist(p[0], p[1]) / g.d0, .7, ZMAX);
        var r = fitRect(item, vw, vh), cx = r.l + r.w / 2, cy = r.t + r.h / 2, k = s2 / g.z0.s;
        S.z = clampZ({ s: s2, tx: m.x - cx - k * (g.m0.x - cx - g.z0.tx), ty: m.y - cy - k * (g.m0.y - cy - g.z0.ty) }, item);
        applyZ(); return;
      }
      if (g.mode !== "one") return;
      var dx = e.clientX - g.x0, dy = e.clientY - g.y0; g.dx = dx; g.dy = dy;
      if (!g.moved && Math.hypot(dx, dy) > 8) g.moved = true;
      if (S.z.s > restZ(item).s * 1.02 || isWide(item)) {                       // zoomed (or a wide panorama): drag pans
        S.z = clampZ({ s: S.z.s, tx: g.z0.tx + dx, ty: g.z0.ty + dy }, item); applyZ(); return;
      }
      if (!g.axis && g.moved) g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (g.axis === "x") {
        S.img.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 90) + "deg)"; S.img.style.opacity = String(1 - Math.min(.5, Math.abs(dx) / 900));
      } else if (g.axis === "y" && dy > 0) {
        S.img.style.transform = "translateY(" + dy + "px) scale(" + (1 - Math.min(.25, dy / 1400)) + ")"; S.bg.style.opacity = String(1 - Math.min(.9, dy / 520));
      }
    });
    function settleBack() {
      var img = S.img;
      BS.animate(img, [{ transform: img.style.transform || "none", opacity: img.style.opacity || 1 }, { transform: zStr(S.z), opacity: 1 }], { duration: 520, easing: BS.springs.soft.easing, fill: "none" });
      img.style.opacity = ""; img.style.transform = zStr(S.z);
      if (S.bg.style.opacity) { BS.animate(S.bg, [{ opacity: S.bg.style.opacity }, { opacity: 1 }], { duration: 320, fill: "none" }); S.bg.style.opacity = ""; }
    }
    function end(e) {
      if (!g || !ptrs[e.pointerId]) return;
      var up = e.type === "pointerup"; delete ptrs[e.pointerId]; n--;
      var item = it(), gg = g;
      if (gg.mode === "pinch") {
        if (n === 1) { begin1(pts()[0]); g.moved = true; }                       // one finger left: carry on panning
        else g = null;
        var minS = isWide(item) ? 1 : restZ(item).s;                               // a wide panorama may be pinched out to show it whole
        if (S.z.s < minS) settleZ({ s: minS, tx: 0, ty: 0 }); else { S.z = clampZ(S.z, item); applyZ(); }
        return;
      }
      g = null;
      var dt = Math.max(1, performance.now() - gg.t0), vx = gg.dx / dt, vy = gg.dy / dt;
      var zoomed = S.z.s > restZ(item).s * 1.02 || isWide(item);
      if (!up) { settleBack(); return; }
      if (!gg.moved) {                                                           // a tap
        var now = performance.now();
        if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {   // double-tap: zoom about the tap
          lastTap.t = 0;
          var rest = restZ(item), r = fitRect(item, window.innerWidth, window.innerHeight), cx = r.l + r.w / 2, cy = r.t + r.h / 2;
          if (S.z.s > rest.s * 1.2) settleZ({ s: rest.s, tx: 0, ty: 0 });
          else { var s2 = Math.min(ZMAX, Math.max(rest.s * 2.6, 2.4)), k = s2 / S.z.s; settleZ({ s: s2, tx: (e.clientX - cx) - k * (e.clientX - cx - S.z.tx), ty: (e.clientY - cy) - k * (e.clientY - cy - S.z.ty) }); }
          return;
        }
        lastTap = { t: now, x: e.clientX, y: e.clientY };
        if (gg.target === stage) setTimeout(function () { if (S && lastTap.t === now && !S.closing) BS.lightbox.close(); }, 330);   // tap on the dim background (waits to rule out a double-tap)
        return;
      }
      if (zoomed) return;                                                        // panning: nothing to resolve
      if (gg.axis === "x" && (Math.abs(gg.dx) > 90 || Math.abs(vx) > .55)) {
        var dir = gg.dx < 0 ? 1 : -1;
        if (S.items[S.i + dir]) { S.img.style.transform = ""; S.img.style.opacity = ""; go(dir); return; }
      }
      if (gg.axis === "y" && gg.dy > 0 && (gg.dy > 130 || vy > .6)) { BS.lightbox.close("swipe"); return; }
      settleBack();
    }
    stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
  }

  BS.lightbox = {
    isOpen: function () { return !!S; },
    open: function (items, index, origin, opts) {
      if (S) return;
      opts = opts || {};
      var host = BS.$("#overlays");
      var stage = el("div.lb-stage");
      var bg = el("div.lb-bg");
      var close = el("button.icon-btn.lb-close.glass-dark", { type: "button", "aria-label": "Close", html: BS.icon("close"), on: { click: function () { BS.lightbox.close(); } } });
      var count = el("div.lb-count.glass-dark");
      var fsBtn = el("button.icon-btn.lb-fs.glass-dark", { type: "button", "aria-label": "View image full screen", title: "Full screen", html: BS.icon("fullscreen"), on: { click: function () { setFull(!FULL); } } });
      var prev = el("button.icon-btn.lb-nav.lb-prev.glass-dark", { type: "button", "aria-label": "Previous", html: BS.icon("chevL"), on: { click: function () { go(-1); } } });
      var next = el("button.icon-btn.lb-nav.lb-next.glass-dark", { type: "button", "aria-label": "Next", html: BS.icon("chevR"), on: { click: function () { go(1); } } });
      var titleEl = el("div.lb-title"), capEl = el("div.lb-capt");
      var capBox = el("div.lb-cap.glass-dark", titleEl, capEl);
      var acts = (opts.actions || []).map(function (def, k) {
        var btn = BS.ui.pill(def.label, def.icon || "view360", "mint static", { "aria-label": def.label });
        btn.addEventListener("click", function () { if (S && !S.closing) def.onClick(S.items[S.i], S.i); });
        return { def: def, btn: btn };
      });
      var actBox = el("div.lb-actions", acts.map(function (a) { return a.btn; }));
      var root = el("div.lb", { role: "dialog", "aria-modal": "true" }, bg, stage, el("div.lb-top", count, close), fsBtn, actBox, prev, next, capBox);
      var img = makeImg(items[index]);
      stage.appendChild(img);
      var z0 = BS.touch ? restZ(items[index]) : null;
      if (z0) img.style.transform = zStr(z0);
      host.appendChild(root);
      S = { fsBtn: fsBtn, root: root, bg: bg, stage: stage, items: items, i: index, img: img, count: count, prev: prev, next: next, titleEl: titleEl, capEl: capEl, capBox: capBox, origin: origin || null, startI: index, busy: false, closing: false, acts: acts, actBox: actBox, opts: opts, z: z0 };
      setCaption();
      S.esc = BS.pushEsc(function () { BS.lightbox.close(); });
      S.nav = BS.nav.push({ label: S.count.textContent, onBack: function () { BS.lightbox.close(); } });
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("resize", onResize);
      if (BS.touch) bindTouch(stage); else bindSwipe(stage);

      BS.animate(bg, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, fill: "forwards" });
      [close, count, actBox, prev, next, capBox].forEach(function (n, k) {
        BS.animate(n, [{ opacity: 0, transform: n === capBox ? "translateY(24px)" : "scale(.8)" }, { opacity: 1, transform: "none" }], { duration: 620, delay: 120 + k * 40, easing: BS.springs.soft.easing, fill: "backwards" });
      });
      var fr = fitRect(items[index], window.innerWidth, window.innerHeight);
      var o = origin && origin.getBoundingClientRect();
      if (o && o.width > 4 && Math.abs((o.width / o.height) / (fr.w / fr.h) - 1) < .1 && !BS.reduced() && !isWide(items[index])) {
        img.style.transformOrigin = "0 0";
        BS.animate(img, [{ transform: "translate(" + (o.left - fr.l) + "px," + (o.top - fr.t) + "px) scale(" + (o.width / fr.w) + "," + (o.height / fr.h) + ")", borderRadius: "22px" }, { transform: "none", borderRadius: "20px" }], { duration: 700, easing: BS.springs.soft.easing, fill: "none" });
        origin.style.visibility = "hidden";
      } else {
        BS.animate(img, [{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: restT(items[index]) }], { duration: 600, easing: BS.springs.soft.easing, fill: "none" });
      }
    },
    close: async function (how) {
      if (!S || S.closing) return;
      if (FULL) setFull(false, true);
      var s = S; s.closing = true;
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
      BS.popEsc(s.esc); s.nav && BS.nav.pop(s.nav);
      var img = s.img, o = null;
      var swipeFrom = how === "swipe" ? { t: img.style.transform || "none" } : null;
      img.getAnimations().forEach(function (a) { a.cancel(); }); img.style.transform = swipeFrom ? swipeFrom.t : ""; img.style.opacity = "";
      var origin = s.origin;
      if (origin && document.body.contains(origin) && s.i === s.startI) o = origin.getBoundingClientRect();
      var fr = fitRect(s.items[s.i], window.innerWidth, window.innerHeight);
      [s.capBox, s.prev, s.next, s.count, s.actBox].forEach(function (n) { BS.animate(n, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }); });
      var imgA;
      if (swipeFrom) {                                                           // swipe-down close: carry on from where the finger left it
        imgA = BS.animate(img, [{ transform: swipeFrom.t, opacity: 1 }, { transform: "translateY(" + Math.round(window.innerHeight * .45) + "px) scale(.7)", opacity: 0 }], { duration: 320, easing: "cubic-bezier(.4,0,.8,.5)", fill: "forwards" });
      } else if (o && o.width > 4 && o.top < window.innerHeight && o.bottom > 0 && Math.abs((o.width / o.height) / (fr.w / fr.h) - 1) < .1 && !BS.reduced()) {
        img.style.transformOrigin = "0 0";
        imgA = BS.animate(img, [{ transform: "none" }, { transform: "translate(" + (o.left - fr.l) + "px," + (o.top - fr.t) + "px) scale(" + (o.width / fr.w) + "," + (o.height / fr.h) + ")" }], { duration: 480, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" });
      } else {
        imgA = BS.animate(img, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.94)" }], { duration: 300, fill: "forwards" });
      }
      BS.animate(s.bg, [{ opacity: 1 }, { opacity: 0 }], { duration: 440, delay: 60, fill: "forwards" });
      await imgA.done; await BS.sleep(60);
      if (origin) origin.style.visibility = "";
      s.root.remove();
      if (S === s) S = null;
    }
  };
})();
