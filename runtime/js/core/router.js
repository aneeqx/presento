/* Page router. Every page change (forward, back, home) runs: fly-out → logo loader → fly-in. */
(function () {
  "use strict";
  var R = BS.router = { current: null, stack: [], busy: false };
  var stage, loaderEl;

  function cfg() { return Object.assign({ out: 420, in: 1300, stagger: 55, overlap: 160 }, (BS.data.config || {}).transition); }

  /* page-change loader = the official logo animation, sped up (config.loader.rate, default 1.8), starting after its blank lead-in (config.loader.start, 0.6 s),
     blended onto the page like the intro. Falls back to the SVG logo if the video is unavailable. */
  /* page-change loader = the official logo video, sped up (SPEC-R7 §5): pre-seeked to config.loader.start (0.40 s, past the blank lead-in), played at
     config.loader.rate (1.8) up to config.loader.end (2.0 s = lockup complete), held config.loader.hold ms; shown at ~60 % fly-out, fades out while the page flies in. */
  BS.loader = {
    cfg: null, video: null,
    build: function () {
      loaderEl = BS.$("#loader"); loaderEl.innerHTML = "";
      var lc = BS.loader.cfg = Object.assign({ video: ((BS.data.config || {}).intro || {}).video, rate: 1.8, start: .4, end: 2.0, hold: 120, scale: .66, showAt: 260 }, (BS.data.config || {}).loader);
      loaderEl.style.setProperty("--ld-scale", lc.scale);
      if (lc.video) {
        var v = BS.el("video.ld-video", { muted: true, playsinline: true, preload: "auto", "aria-hidden": "true", tabindex: "-1" });
        v.muted = true; v.src = lc.video;
        v.addEventListener("loadedmetadata", function () { try { v.currentTime = lc.start; } catch (e) {} });
        v.addEventListener("error", function () { BS.loader.video = null; v.remove(); BS.loader.fallback(); });
        loaderEl.appendChild(v); BS.loader.video = v;
      } else BS.loader.fallback();
    },
    fallback: function () {
      if (BS.$(".ld", loaderEl)) return;
      var ld = BS.el("div.ld"), lg = BS.el("div.ld-logo"); BS.renderLogo(lg, false); ld.appendChild(lg); loaderEl.appendChild(ld);
    },
    duration: function () { var c = BS.loader.cfg; return BS.loader.video && !BS.reduced() ? (c.end - c.start) / c.rate * 1000 + c.hold : 600; },
    show: function () {
      var v = BS.loader.video, c = BS.loader.cfg;
      if (v) { try { v.pause(); v.currentTime = c.start; v.playbackRate = c.rate; var p = v.play(); p && p.catch(function () {}); } catch (e) {} }
      loaderEl.getAnimations().forEach(function (a) { a.cancel(); });
      loaderEl.style.opacity = 0;
      BS.animate(loaderEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: BS.motion.out, fill: "forwards" });
    },
    hide: function () {
      var v = BS.loader.video;
      BS.animate(loaderEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: BS.motion.io, fill: "forwards" }).done.then(function () { if (v) v.pause(); });
    }
  };

  function mount(id, params) {
    var def = BS.pages[id];
    var root = BS.el("section.page.pre", { dataset: { page: id } });
    var cleanup = def.mount(root, params || {}) || null;
    stage.appendChild(root);
    return { id: id, params: params || {}, root: root, cleanup: cleanup, def: def };
  }

  R.init = function () { stage = BS.$("#stage"); BS.loader.build(); };

  /* initial entry (after the landing intro): no fly-out / loader, just fly in */
  R.enter = async function (id, params) {
    R.busy = true; stage.classList.add("busy");
    R.current = mount(id, params);
    await BS.raf();
    BS.shell.update(id, params, R.stack.length);
    if (BS.reduced()) await BS.fly.in(R.current.root, cfg().in, cfg().stagger);
    else {                                                                 // first entry: panels rise from below, staggered from the left
      R.current.root.classList.remove("pre");
      var items = BS.$$(".tile", R.current.root), runs = items.map(function (t, i) {
        return BS.animate(t, [{ opacity: 0, transform: "translateY(6vh)" }, { opacity: 1, transform: "none" }], { duration: 1300, delay: 500 + i * 90, easing: BS.motion.soft, fill: "backwards" }).done;
      });
      await Promise.all(runs);
    }
    R.current.def.ready && R.current.def.ready(R.current.root);
    R.busy = false; stage.classList.remove("busy"); if (R.queued) { var q = R.queued; R.queued = null; setTimeout(q, 0); }
  };

  R.go = async function (id, params, opts) {
    opts = opts || {};
    if (!BS.pages[id]) return;
    if (R.busy) { R.queued = function () { R.go(id, params, opts); }; return; }          // a click mid-transition is queued, not dropped
    var cur = R.current;
    if (cur && cur.id === id && !opts.force) return;
    var c = cfg();
    R.busy = true; stage.classList.add("busy");
    if (cur && !opts.back && !opts.replace) R.stack.push({ id: cur.id, params: cur.params });

    var outDone = cur ? BS.fly.out(cur.root, c.out) : Promise.resolve();
    var tShow = 0;
    if (cur) { await BS.sleep(BS.loader.cfg.showAt || 260); BS.loader.show(); tShow = performance.now(); }
    await outDone;
    if (cur) {
      try { cur.cleanup && cur.cleanup(); } catch (e) { console.error(e); }
      cur.root.remove();
    }
    window.scrollTo(0, 0);
    R.current = mount(id, params);
    BS.shell.update(id, params, R.stack.length);
    await BS.raf();
    if (cur) await BS.sleep(Math.max(0, BS.loader.duration() - (performance.now() - tShow)));
    BS.loader.hide();
    await BS.fly.in(R.current.root, c.in, c.stagger);
    R.current.def.ready && R.current.def.ready(R.current.root);
    R.busy = false; stage.classList.remove("busy"); if (R.queued) { var q = R.queued; R.queued = null; setTimeout(q, 0); }
  };

  R.back = function () {
    if (R.busy) { R.queued = function () { R.back(); }; return; }
    var prev = R.stack.pop();
    if (!prev) return;
    // go() pushes unless opts.back → avoid re-push
    R.go(prev.id, prev.params, { back: true });
  };
  R.home = function () {
    if (R.busy) { R.queued = function () { R.home(); }; return; }
    if (!R.current || R.current.id === "home") return;
    R.stack = [];
    R.go("home", {}, { back: true });
  };
})();
