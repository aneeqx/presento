/* Presentation viewer — core utilities. Everything hangs off window.BS (no modules: must run from file://) */
(function () {
  "use strict";
  var BS = window.BS = { data: window.STUDIO_DATA || {}, pages: {}, escStack: [] };

  BS.reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  BS.reduced = function () { return BS.reducedQuery.matches; };
  BS.$ = function (s, r) { return (r || document).querySelector(s); };
  BS.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  BS.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  BS.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  BS.raf = function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); };

  /* el("div.class#id", {attrs, on:{click}, style:{}, html, text}, children...) */
  BS.el = function (sel, props) {
    var m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
    var node = document.createElement(m[1] || "div");
    (m[2] || "").replace(/([.#])([\w-]+)/g, function (_, t, n) { if (t === ".") node.classList.add(n); else node.id = n; });
    var start = 1;
    if (props && typeof props === "object" && !(props instanceof Node) && !Array.isArray(props)) {
      start = 2;
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
        else if (k === "on") Object.keys(v).forEach(function (e) { node.addEventListener(e, v[e]); });
        else if (k === "dataset") Object.assign(node.dataset, v);
        else if (v === true) node.setAttribute(k, "");
        else if (v !== false && v != null) node.setAttribute(k, v);
      });
    }
    for (var i = start; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  };
  function append(node, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { append(node, x); });
    else node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }

  /* ---- spring easing: simulate a damped spring, emit a CSS linear() easing ---- */
  BS.spring = function (stiffness, damping, mass) {
    var k = stiffness || 170, c = damping || 15, m = mass || 1;
    var w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
    function x(t) {
      if (z < 1) { var wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); }
      return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    }
    var T = 0, step = 0.005, settled = 0;
    for (var t = 0; t < 4; t += step) { if (Math.abs(1 - x(t)) < 0.0015) { settled += step; if (settled > 0.08) { T = t; break; } } else settled = 0; T = t; }
    var pts = [], n = 48;
    for (var i = 0; i <= n; i++) pts.push((Math.round(x(T * i / n) * 1000) / 1000));
    pts[n] = 1;
    return { easing: "linear(" + pts.join(",") + ")", duration: Math.round(T * 1000) };
  };
  BS.springs = {};
  /* "Innovative, Immersive & Creative" from data.js brand.taglines */
  BS.taglineParts = function () {            // three separate words, joined by a centred dot (never "&")
    return ((BS.data.brand || {}).taglines || []).map(function (w, i) { return i ? "· " + w : w; });
  };
  BS.taglineText = function () { return BS.taglineParts().join(" "); };
  /* motion tokens (mirror of the CSS --dur-* / --ease-* in css/base.css, SPEC-R7 §1.4) */
  BS.motion = { xs: 240, s: 400, m: 700, l: 1100, xl: 1600, stagger: 55,
    out: "cubic-bezier(.22,.61,.36,1)", io: "cubic-bezier(.65,0,.35,1)", soft: "cubic-bezier(.16,1,.3,1)", in: "cubic-bezier(.4,0,1,1)" };

  /* WAAPI wrapper (respects reduced motion; resolves even if cancelled) */
  BS.animate = function (el, frames, opts) {
    opts = Object.assign({ duration: 400, easing: "ease", fill: "both" }, opts || {});
    if (BS.reduced()) { opts.duration = 1; opts.delay = 0; }
    else if (BS.motionK && BS.motionK !== 1) { opts.duration *= BS.motionK; if (opts.delay) opts.delay *= BS.motionK; }      // motion token: config.motion.scale
    var a = el.animate(frames, opts);
    a.done = new Promise(function (res) { a.onfinish = res; a.oncancel = res; });
    return a;
  };

  /* Esc stack: overlays / inner views push a closer; Esc calls the top one first */
  BS.pushEsc = function (fn) { BS.escStack.push(fn); return fn; };
  BS.popEsc = function (fn) { var i = BS.escStack.lastIndexOf(fn); if (i >= 0) BS.escStack.splice(i, 1); };

  BS.registerPage = function (id, def) { BS.pages[id] = def; };

  /* load a classic <script> on demand (works on file://) */
  var loaded = {};
  BS.loadScript = function (src) {
    if (loaded[src]) return loaded[src];
    return (loaded[src] = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("load " + src)); }; document.head.appendChild(s);
    }));
  };

  BS.fmtTime = function (s) { if (!isFinite(s)) return "0:00"; s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); };
  BS.pad2 = function (n) { return ("0" + n).slice(-2); };
})();
