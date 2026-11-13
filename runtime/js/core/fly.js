/* "Show Desktop" fly-out / fly-in.
   Every element marked [data-fly] that is visible in the viewport slides off to its NEAREST screen edge
   (out), and later slides back in from that same edge with a spring (in). [data-fade] elements just fade. */
(function () {
  "use strict";
  var PAD = 70;

  function visibleRect(el, vw, vh) {
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return null;
    return r;
  }

  function plan(el, vw, vh) {
    var r = visibleRect(el, vw, vh);
    if (!r) return null;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var d = { left: cx, right: vw - cx, top: cy, bottom: vh - cy };
    var edge = "left", best = d.left;
    ["right", "top", "bottom"].forEach(function (k) { if (d[k] < best) { best = d[k]; edge = k; } });
    var dx = 0, dy = 0;
    if (edge === "left") dx = -(r.right + PAD);
    else if (edge === "right") dx = vw - r.left + PAD;
    else if (edge === "top") dy = -(r.bottom + PAD);
    else dy = vh - r.top + PAD;
    return { el: el, dx: Math.round(dx), dy: Math.round(dy), dist: best, edge: edge };
  }

  function plans(root) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var list = BS.$$("[data-fly]", root).map(function (e) { return plan(e, vw, vh); }).filter(Boolean);
    list.sort(function (a, b) { return a.dist - b.dist; });        // nearest-to-edge first
    return list;
  }

  function fades(root) { return BS.$$("[data-fade]", root); }

  BS.fly = {
    plans: plans,

    out: function (root, duration) {
      var list = plans(root), anims = [];
      if (BS.reduced()) { return BS.animate(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).done; }
      var step = Math.min(16, 70 / Math.max(list.length, 1));
      list.forEach(function (p, i) {
        anims.push(BS.animate(p.el, [{ transform: "translate3d(0,0,0)" }, { transform: "translate3d(" + p.dx + "px," + p.dy + "px,0)" }],
          { duration: duration, delay: i * step, easing: BS.motion.in, fill: "forwards" }).done);
      });
      fades(root).forEach(function (e) { anims.push(BS.animate(e, [{ opacity: 1 }, { opacity: 0 }], { duration: duration * 0.7, fill: "forwards" }).done); });
      return Promise.all(anims);
    },

    /* fly-in: calm, soft ease-out (critically damped spring, no overshoot) with a slight stagger.
       duration = config.transition.in, stagger = config.transition.stagger (ms between elements, total capped at 260ms) */
    in: function (root, duration, stagger) {
      root.classList.remove("pre");
      var list = plans(root), anims = [];
      if (BS.reduced()) { return BS.animate(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: "none" }).done; }
      var step = Math.min(stagger == null ? 55 : stagger, 450 / Math.max(list.length - 1, 1));
      list.forEach(function (p, i) {
        anims.push(BS.animate(p.el, [{ transform: "translate3d(" + p.dx + "px," + p.dy + "px,0)" }, { transform: "translate3d(0,0,0)" }],
          { duration: duration, delay: i * step, easing: BS.motion.soft, fill: "backwards" }).done);
      });
      fades(root).forEach(function (e) { anims.push(BS.animate(e, [{ opacity: 0 }, { opacity: 1 }], { duration: duration * 0.8, delay: 160, easing: "ease-out", fill: "backwards" }).done); });
      return Promise.all(anims);
    }
  };
})();
