/* Home: bento grid of 4 tiles with focus-shift hover (hovered grows, others shrink/dim/blur + directional motion blur that settles) */
(function () {
  "use strict";
  var el = BS.el, SVGNS = "http://www.w3.org/2000/svg";

  /* per-tile directional blur filter */
  function makeFilter(i) {
    var defs = BS.$("#mb-defs");
    var f = document.createElementNS(SVGNS, "filter");
    f.setAttribute("id", "mb-" + i); f.setAttribute("x", "-8%"); f.setAttribute("y", "-8%"); f.setAttribute("width", "116%"); f.setAttribute("height", "116%");
    var g = document.createElementNS(SVGNS, "feGaussianBlur"); g.setAttribute("stdDeviation", "0 0");
    f.appendChild(g); defs.appendChild(f);
    return { f: f, g: g };
  }

  function motionBlur(tile, sx, sy) {
    return;                                   // panels: no animated blur radius (jank); dimmed panels fade in a pre-blurred layer instead (.tile-blur)
    if (BS.reduced()) return;
    var media = tile._media, g = tile._mb.g;
    cancelAnimationFrame(tile._raf);
    var t0 = performance.now(), dur = 520;
    media.style.filter = "url(#" + tile._mb.f.id + ")";
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3), k = 1 - e;
      g.setAttribute("stdDeviation", (sx * k).toFixed(2) + " " + (sy * k).toFixed(2));
      if (p < 1) tile._raf = requestAnimationFrame(step); else media.style.filter = "";
    })(t0);
  }

  function wireFocus(bento, tiles) {
    var hovered = null;
    function center(t) { var r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    function setHover(t) {
      if (t === hovered) return;
      var prev = hovered; hovered = t;
      bento.classList.toggle("is-focus", !!t); bento.dataset.on = t ? String(tiles.indexOf(t)) : "";
      if (bento._layout) bento._layout(t); tiles.forEach(function (x) { x.classList.toggle("ico-active", x === t); });
      var hc = t && center(t), pc = prev && center(prev);
      tiles.forEach(function (tile) {
        var on = tile === t;
        tile.classList.toggle("on", on);
        var c = center(tile), dx = 0, dy = 0, bx = 0, by = 0;
        if (t && !on) {                                   // pushed away from the hovered tile
          var vx = c.x - hc.x, vy = c.y - hc.y, L = Math.hypot(vx, vy) || 1;
          dx = vx / L; dy = vy / L; bx = Math.abs(dx) * 9; by = Math.abs(dy) * 9;
        } else if (t && on && pc) {                       // the grown tile: blur along the path from the previous tile
          var ux = c.x - pc.x, uy = c.y - pc.y, M = Math.hypot(ux, uy) || 1;
          bx = Math.abs(ux / M) * 6; by = Math.abs(uy / M) * 6;
        } else if (!t && tile._dx != null) {              // everything relaxes back
          bx = Math.abs(tile._dx) * 6; by = Math.abs(tile._dy) * 6;
        }
        tile._dx = dx; tile._dy = dy;
        tile.style.setProperty("--dx", dx.toFixed(3)); tile.style.setProperty("--dy", dy.toFixed(3));
        if (bx || by) motionBlur(tile, bx, by);
      });
    }
    tiles.forEach(function (tile) {
      if (!BS.touch) tile.addEventListener("pointerenter", function () { setHover(tile); });
      tile.addEventListener("focus", function () { setHover(tile); });
      tile.addEventListener("blur", function () { setTimeout(function () { if (!bento.contains(document.activeElement)) setHover(null); }, 0); });
    });
    if (!BS.touch) bento.addEventListener("pointerleave", function () { setHover(null); });
    return { setHover: setHover, current: function () { return hovered; } };
  }

  /* TOUCH: there is no hover, so pressing a tile does the focus-shift; lifting the finger on the tile opens it; sliding off (or a cancelled touch) cancels. */
  function tileOf(n) { var t = n.closest && n.closest(".tile"); if (t) return t; var h = n.closest && n.closest(".hit"); return h ? h._tile : null; }
  function wireTouch(bento, tiles, api, open) {
    var down = null, idleT = 0, IDLE = ((BS.data.config || {}).selectIdle || 20) * 1000;
    function armIdle() { clearTimeout(idleT); idleT = setTimeout(function () { api.setHover(null); }, IDLE); }
    function tileAt(x, y) { var e = document.elementFromPoint(x, y); var t = e && tileOf(e); return t && bento.contains(t) ? t : null; }
    bento.addEventListener("pointerdown", function (e) {
      if (e.button > 0) return;
      var t = tileOf(e.target); if (!t) return;
      down = { tile: t, was: api.current() === t, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      try { bento.setPointerCapture(e.pointerId); } catch (err) {}
      if (!down.was) api.setHover(t);                                  // press = select (live)
      armIdle();
    });
    bento.addEventListener("pointermove", function (e) {              // scrub: the panel under the finger is the focused one
      if (!down || e.pointerId !== down.id) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) down.moved = true;
      var t = tileAt(e.clientX, e.clientY);
      if (t && t !== api.current()) api.setHover(t);
      armIdle();
    });
    function up(e) {
      if (!down || e.pointerId !== down.id) return;
      var d = down; down = null;
      d.tile._skipClick = true; setTimeout(function () { d.tile._skipClick = false; }, 600);
      if (e.type === "pointerup" && !d.moved && d.was && api.current() === d.tile) open(d.tile);     // second tap (or its Explore button) opens; scrub / first tap never open
    }
    bento.addEventListener("pointerup", up); bento.addEventListener("pointercancel", up);
    document.addEventListener("pointerdown", function (e) { if (!bento.isConnected) return; if (!e.target.closest || !tileOf(e.target)) api.setHover(null); }, true);   // tap outside clears
  }

  /* optional attract loop (config.attract, touch build): after `idle` seconds the focus-shift drifts across the tiles; the first touch stops it */
  function attract(tiles, api, root) {
    var ac = BS.data.config && BS.data.config.panelsDemo;
    if (!ac) return function () {};
    ac = Object.assign({ idle: 20, step: 3.5 }, typeof ac === "object" ? ac : {});
    var timer = 0, running = false, k = 0;
    function arm() { clearTimeout(timer); timer = setTimeout(start, ac.idle * 1000); }
    function start() {
      var cur = BS.router.current;
      if (BS.router.busy || BS.escStack.length || !cur || cur.root !== root) { arm(); return; }
      running = true; k = 0; step();
    }
    function step() {
      if (!running) return;
      var cur = BS.router.current; if (!cur || cur.root !== root || BS.escStack.length) { stop(); return; }
      api.setHover(tiles[k % tiles.length]); k++;
      timer = setTimeout(step, ac.step * 1000);
    }
    function stop() { clearTimeout(timer); if (running) { running = false; api.setHover(null); } arm(); }
    document.addEventListener("pointerdown", stop, true); document.addEventListener("keydown", stop, true);
    arm();
    return function () { clearTimeout(timer); running = false; document.removeEventListener("pointerdown", stop, true); document.removeEventListener("keydown", stop, true); };
  }

  BS.registerPage("home", {
    title: "Home",
    mount: function (root) {
      var D = BS.data, secs = {}; (D.sections || []).forEach(function (x) { secs[x.id] = x; });
      root.classList.add("home");
      var tiles = [];
      var bento = el("div.bento"), N = D.home.tiles.length, ROWS = N >= 6 ? 2 : 1, TOT = 2 + .65 * (N - 1);
      var split = ROWS === 2 ? [Math.ceil(N / 2), Math.floor(N / 2)] : [N];                 // 6 = 3+3, 7 = 4+3, 8 = 4+4 ... 12 = 6+6 (SPEC-LANDING-N)
      bento.dataset.n = N; bento.dataset.rows = ROWS;
      var rowEls = [];
      if (ROWS === 2) split.forEach(function (k, r) {
        var re = el("div.row"); re.style.setProperty("--k", k);
        re.style.setProperty("--pn-mw", "calc((100vw - 2 * var(--edge) - " + (k - 1) + " * var(--pn-gap)) / (2 + .65 * " + (k - 1) + ") * 2)");        // media layer = focused size, centred: never re-crops
        rowEls.push(re); bento.appendChild(re);
      });
      else bento.style.setProperty("--pn-mw", "calc((100vw - 2 * var(--edge) - " + (N - 1) + " * var(--pn-gap)) / " + TOT.toFixed(2) + " * 2)");
      bento.style.setProperty("--pn-n", N);
      function rowOf(i) { return i < split[0] ? 0 : 1; }
      bento._layout = function (t) {
        var idx = t ? tiles.indexOf(t) : -1;
        if (ROWS === 1) { bento.style.gridTemplateColumns = t ? tiles.map(function (x) { return x === t ? "var(--pn-on)" : "var(--pn-off)"; }).join(" ") : ""; return; }
        var fr = t ? rowOf(idx) : -1;
        bento.style.gridTemplateRows = t ? (fr === 0 ? "1.2fr .8fr" : ".8fr 1.2fr") : "";
        rowEls.forEach(function (re, r) {
          re.classList.toggle("focused", r === fr);
          if (r !== fr) { re.style.gridTemplateColumns = ""; return; }
          var base = r === 0 ? 0 : split[0];
          re.style.gridTemplateColumns = tiles.slice(base, base + split[r]).map(function (x) { return x === t ? "var(--pn-on)" : "var(--pn-off)"; }).join(" ");
        });
      };
      D.home.tiles.forEach(function (t, i) {
        var big = false;                       // landing = four equal vertical panels
        var pv = t.preview || {};
        var media;
        if (pv.type === "video") {
          media = el("video.tile-el", { muted: true, autoplay: true, playsinline: true, preload: "auto", poster: pv.poster || "" });
          media.muted = true; media.src = pv.src;
          if (pv.start) {                                                    // skip the white title card; loop back to `start`, not 0
            var st = +pv.start;
            media.addEventListener("loadedmetadata", function () { media.currentTime = st; });
            media.addEventListener("ended", function () { media.currentTime = st; var q = media.play(); q && q.catch(function () {}); });
          } else media.loop = true;
          var p = media.play(); p && p.catch(function () {});
        } else media = el("img.tile-el", { src: pv.src || "", alt: "", draggable: "false" });
        var blurSrc = pv.type === "video" ? pv.poster : pv.src;
        var tileMedia = el("div.tile-media", media, blurSrc ? el("img.tile-blur", { src: blurSrc, alt: "", draggable: "false" }) : null);
        var tile = el("div.tile.t-" + t.id + (big ? ".big" : ".sm"), { role: "button", tabindex: "0", "aria-label": t.title, dataset: { fly: "", id: t.id } },
          tileMedia, el("div.tile-shade"),
          el("span.tile-count.glass-dark", { text: secs[t.id] ? BS.sectionCount(secs[t.id]) : "" }),
          el("div.tile-ico", { html: BS.icon(t.icon && BS.icon.has(t.icon) ? t.icon : "grid") }),
          el("div.tile-vt", el("span.eyebrow", { text: BS.pad2(i + 1) }), el("h3", { text: t.title })),
          el("div.tile-ttl", el("h3", { text: t.title })),
          el("div.tile-label.glass", el("span.eyebrow", { text: BS.pad2(i + 1) }), el("h2", { text: t.title }), el("p", { text: t.blurb || "" })),
          el("div.tile-cta", BS.ui.pill("Explore", "arrowRight", big ? "" : "round", { tag: "span" })));
        tile._media = tileMedia; tile._mb = makeFilter(i);
        function open() { BS.router.go(t.id, {}); }
        tile.addEventListener("click", function () { if (tile._skipClick) return; open(); });
        tile.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
        tiles.push(tile); (ROWS === 2 ? rowEls[rowOf(i)] : bento).appendChild(tile);
      });
      root.appendChild(bento);
      var api = wireFocus(bento, tiles);
      if (ROWS === 2) {                                   // hit areas on the REST geometry: the live rows resize under the pointer, so hit-testing must not use them
        var hits = el("div.hits"), intent = 0;
        split.forEach(function (k, r) {
          var hr = el("div.hrow"); hr.style.setProperty("--k", k);
          for (var c = 0; c < k; c++) (function (tile) {
            var h = el("div.hit"); h._tile = tile;
            if (!BS.touch) h.addEventListener("pointerenter", function () { clearTimeout(intent); intent = setTimeout(function () { api.setHover(tile); }, 90); });
            h.addEventListener("click", function () { if (tile._skipClick) return; BS.router.go(tile.dataset.id, {}); });
            hr.appendChild(h);
          })(tiles[(r === 0 ? 0 : split[0]) + c]);
          hits.appendChild(hr);
        });
        if (!BS.touch) bento.addEventListener("pointerleave", function () { clearTimeout(intent); });
        bento.appendChild(hits);
      }
      var stopAttract = function () {};
      if (BS.touch) {
        wireTouch(bento, tiles, api, function (tile) { BS.router.go(tile.dataset.id, {}); });
        BS.raf().then(function () { stopAttract = attract(tiles, api, root); });
      }
      root._tiles = tiles;
      return function () { stopAttract(); BS.$("#mb-defs").innerHTML = ""; tiles.forEach(function (t) { cancelAnimationFrame(t._raf); }); };
    },
    /* arrows move focus between tiles (keyboard presenting) */
    onKey: function (e, root) {
      var tiles = root._tiles; if (!tiles) return false;
      var bento = root.querySelector(".bento"), rows = +bento.dataset.rows, n = tiles.length, per = rows === 2 ? Math.ceil(n / 2) : n;
      var i = tiles.indexOf(document.activeElement), next = -1;
      if (e.key === "ArrowRight") next = i < 0 ? 0 : (rows === 2 && (i + 1 === per || i + 1 === n) ? i : (i + 1) % n);
      else if (e.key === "ArrowLeft") next = i < 0 ? n - 1 : (rows === 2 && (i === 0 || i === per) ? i : (i - 1 + n) % n);
      else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && rows === 2) {
        if (i < 0) next = 0; else if (i < per && e.key === "ArrowDown") next = Math.min(per + i, n - 1); else if (i >= per && e.key === "ArrowUp") next = i - per; else next = i;
      } else if (e.key === "ArrowDown") next = i < 0 ? 0 : (i + 1) % n; else if (e.key === "ArrowUp") next = i < 0 ? n - 1 : (i - 1 + n) % n;
      if (next >= 0) { tiles[next].focus(); return true; }
      return false;
    }
  });
})();
