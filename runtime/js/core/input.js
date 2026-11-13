/* Input mode: one codebase, two builds.
   config.input = "auto" (default, (pointer: coarse) decides) | "touch" | "pointer".
   Sets <html class="is-touch"> or <html class="is-pointer"> and BS.touch (boolean).
   All touch-only CSS lives under html.is-touch (css/touch.css) and all touch-only JS behaviour is guarded by BS.touch,
   so the pointer (mouse) build is unchanged. */
(function () {
  "use strict";
  var cfg = String((BS.data.config || {}).input || "auto").toLowerCase();
  var mq = window.matchMedia("(pointer: coarse)");
  function decide() { return cfg === "touch" ? true : cfg === "pointer" ? false : mq.matches; }

  function apply() {
    BS.touch = decide();
    var c = document.documentElement.classList;
    c.toggle("is-touch", BS.touch); c.toggle("is-pointer", !BS.touch);
  }
  apply();
  /* motion tokens: every JS animation duration (BS.animate) and every CSS transition (calc(.6s * var(--m-k))) is scaled by config.motion.scale (default 1.6 = slower, smoother) */
  var mo = (BS.data.config || {}).motion || {};
  BS.motionK = +mo.scale > 0 ? +mo.scale : 1.6;
  document.documentElement.style.setProperty("--m-k", String(BS.motionK));
  BS.input = { mode: cfg, isTouch: function () { return BS.touch; } };
  if (cfg === "auto" && mq.addEventListener) mq.addEventListener("change", apply);     // e.g. a detachable keyboard

  /* hygiene that CSS alone cannot do (touch build only) */
  document.addEventListener("contextmenu", function (e) { if (BS.touch) e.preventDefault(); });          // no long-press menu
  document.addEventListener("gesturestart", function (e) { if (BS.touch) e.preventDefault(); });         // iOS Safari pinch-zoom of the page
  document.addEventListener("dragstart", function (e) { if (BS.touch) e.preventDefault(); });            // no image ghost drag
  document.addEventListener("selectstart", function (e) { if (BS.touch) e.preventDefault(); });          // no text selection
  if (BS.touch) {
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp) vp.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
  }
})();
