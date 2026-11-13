/* 360° overlay (vendored Pannellum). BS.pano360.open(tour, {onClose}) — tour: {id, title, meta, image, dataScript?, yaw, pitch, hfov}
   Opened from the flat panorama view; closing it (Esc / button) returns to that flat view.
   file:// note: WebGL refuses file:// images, so tour.dataScript (a .js that sets window.STUDIO_PANOS[id] = "data:image/jpeg;base64,…") is loaded first. */
(function () {
  "use strict";
  var el = BS.el;
  var S = null;

  BS.pano360 = {
    isOpen: function () { return !!S; },
    /* can this tour be shown in 360° here? (needs the data-URI script; without it the button is hidden) */
    available: function (t) { return !!(t && t.dataScript && window.pannellum); },

    open: function (t, opts) {
      if (S || !BS.pano360.available(t)) return;
      opts = opts || {};
      var host = el("div.pv-host");
      var loading = el("div.pv-loading.on", el("span.spin"), el("span", { text: "Loading 360°…" }));
      var info = el("div.pv-info.glass-dark", el("i.dot"), el("div.pv-title", el("b", { text: t.title || "" }), el("small", { text: (t.meta ? t.meta + " · " : "") + "360°" })));
      var back = el("button.pv-back.glass-dark", { type: "button", "aria-label": "Back to flat view" }, el("i", { html: BS.icon("panorama") }), el("span", { text: "Flat view" }));
      var hint = el("div.pv-hint.glass-dark", el("i", { html: BS.icon("drag") }), el("span", { text: "Drag to look around · scroll or pinch to zoom" }));
      var bZoomOut = el("button.pl-ico", { type: "button", "aria-label": "Zoom out", html: BS.icon("zoomOut") });
      var bZoomIn = el("button.pl-ico", { type: "button", "aria-label": "Zoom in", html: BS.icon("zoomIn") });
      var bRot = el("button.pl-ico.on", { type: "button", "aria-label": "Auto-rotate", html: BS.icon("rotate") });
      var bFs = el("button.pl-ico", { type: "button", "aria-label": "Fullscreen", html: BS.icon("fullscreen") });
      var ctl = el("div.pv-ctl.glass-dark", bZoomOut, bZoomIn, bRot, bFs);
      var root = el("div.pv", { role: "dialog", "aria-modal": "true", "aria-label": "360° view" }, host, loading, info, back, hint, ctl);
      BS.$("#overlays").appendChild(root);
      var me = S = { root: root, closing: false };

      var viewer = null, rotating = t.autoRotate !== false, dead = false;
      var esc = BS.pushEsc(close);
      var navH = BS.nav.push({ label: (t.title || "") + " · 360°", onBack: function () { close(); } });

      function onKey(e) {
        if (!viewer || BS.escStack[BS.escStack.length - 1] !== esc) return;
        var y = viewer.getYaw(), p = viewer.getPitch(), st = 14;
        if (e.key === "ArrowLeft") viewer.setYaw(y - st, 250); else if (e.key === "ArrowRight") viewer.setYaw(y + st, 250);
        else if (e.key === "ArrowUp") viewer.setPitch(p + st, 250); else if (e.key === "ArrowDown") viewer.setPitch(p - st, 250);
        else if (e.key === "+" || e.key === "=") viewer.setHfov(viewer.getHfov() - 12, 300); else if (e.key === "-") viewer.setHfov(viewer.getHfov() + 12, 300);
        else return;
        e.preventDefault(); e.stopPropagation();
      }
      function fsc() { bFs.innerHTML = BS.icon(document.fullscreenElement === root ? "exitFs" : "fullscreen"); }

      function close() {
        if (me.closing) return; me.closing = true; dead = true;
        BS.popEsc(esc); BS.nav.pop(navH);
        document.removeEventListener("keydown", onKey, true);
        document.removeEventListener("fullscreenchange", fsc);
        if (document.fullscreenElement === root) document.exitFullscreen().catch(function () {});
        BS.animate(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: "ease-in", fill: "forwards" }).done.then(function () {
          if (viewer) { try { viewer.destroy(); } catch (e) {} }
          root.remove(); if (S === me) S = null; opts.onClose && opts.onClose();
        });
      }

      back.addEventListener("click", close);
      bZoomIn.addEventListener("click", function () { viewer && viewer.setHfov(viewer.getHfov() - 18, 450); });
      bZoomOut.addEventListener("click", function () { viewer && viewer.setHfov(viewer.getHfov() + 18, 450); });
      bRot.addEventListener("click", function () { rotating = !rotating; bRot.classList.toggle("on", rotating); if (viewer) { if (rotating) viewer.startAutoRotate(-3); else viewer.stopAutoRotate(); } });
      bFs.addEventListener("click", function () { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen().catch(function () {}); });
      document.addEventListener("fullscreenchange", fsc);
      /* arrow keys pan the view while this overlay is on top */
      document.addEventListener("keydown", onKey, true);
      root.addEventListener("pointerdown", function () { hint.classList.add("gone"); }, { once: true });
      setTimeout(function () { hint.classList.add("gone"); }, 8000);

      BS.animate(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "ease-out", fill: "backwards" });
      [info, back, ctl].forEach(function (n, k) {
        BS.animate(n, [{ opacity: 0, transform: n === ctl ? "translateY(20px)" : "translateY(-14px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 160 + k * 70, easing: BS.springs.soft.easing, fill: "backwards" });
      });

      BS.loadScript(t.dataScript).then(function () { return (window.STUDIO_PANOS && window.STUDIO_PANOS[t.id]) || t.image; }, function () { return t.image; }).then(function (src) {
        if (dead) return;
        try {
          viewer = pannellum.viewer(host, {
            type: "equirectangular", panorama: src, autoLoad: true, showControls: false, showFullscreenCtrl: false, showZoomCtrl: false,
            yaw: t.yaw || 0, pitch: t.pitch || 0, hfov: t.hfov || 100, minHfov: 45, maxHfov: 120, compass: false,
            autoRotate: t.autoRotate === false ? 0 : -3, autoRotateInactivityDelay: 4000, mouseZoom: true, draggable: true, friction: .12
          });
          viewer.on("load", function () { if (dead) return; loading.classList.remove("on"); BS.animate(host, [{ opacity: 0, transform: "scale(1.04)" }, { opacity: 1, transform: "none" }], { duration: 900, easing: "ease-out", fill: "none" }); });
          viewer.on("error", function (m) { loading.classList.add("on"); loading.lastChild.textContent = "Could not load panorama (" + m + ")"; });
        } catch (e) { loading.lastChild.textContent = "360° viewer unavailable"; console.error(e); }
      });
    }
  };
})();
