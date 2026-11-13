/* Generic section pages. Every entry of data.sections becomes a router page (id = section id).
   A section holds 1..n "subs"; each sub has a page type (gallery | films | panoramas | flipbook | social | links).
   One sub = no chips; several = chips that swap the pane. Types live in BS.sectionTypes (mount + count + tile). */
(function () {
  "use strict";
  var el = BS.el;
  var T = BS.sectionTypes = {};

  /* ---------------- shared helpers ---------------- */

  /* balanced masonry by aspect ratio. items: [{src, w, h, title, thumb}] */
  BS.masonry = function (pane, items, opts) {
    opts = opts || {};
    var wrap = el("div.masonry");
    pane.appendChild(wrap);
    var cols = 0;
    function layout() {
      var w = wrap.clientWidth || Math.max(600, window.innerWidth - 400);
      var n = BS.clamp(Math.floor(w / (opts.minCol || 330)), 1, 4);
      if (n === cols) return;
      cols = n; wrap.innerHTML = "";
      var cs = [], hs = [];
      for (var i = 0; i < n; i++) { var c = el("div.mcol"); cs.push(c); hs.push(0); wrap.appendChild(c); }
      items.forEach(function (it, idx) {
        var w0 = it.w || 16, h0 = it.h || 9, ar = w0 / h0, k = hs.indexOf(Math.min.apply(null, hs));
        hs[k] += 1 / ar;
        var b = el("button.m-item", { type: "button", "aria-label": it.title || "Open image", style: { aspectRatio: w0 + " / " + h0 }, dataset: { fly: "" } },
          el("img", { src: it.thumb || it.src, alt: it.title || "", draggable: "false", decoding: "async" }),
          it.title ? el("div.m-cap.glass", el("span", { text: it.title }), el("i", { html: BS.icon("expand") })) : null);
        b.addEventListener("click", function () { opts.onOpen && opts.onOpen(idx, b); });
        cs[k].appendChild(b);
      });
    }
    layout();
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { layout(); }); ro.observe(wrap); }
    return function () { ro && ro.disconnect(); };
  };

  /* video cards -> cinematic player. items: [{title, meta, src, poster, start?, end?}] */
  BS.videoGrid = function (pane, items) {
    var grid = el("div.vgrid");
    items.forEach(function (it, i) {
      grid.appendChild(BS.ui.videoCard(it, {
        featured: items.length % 2 === 1 && i === 0 && items.length > 1,
        onOpen: function (item, card) { BS.player.open(items, i, card); }
      }));
    });
    pane.appendChild(grid);
  };

  function cnt(n, one, many) { return BS.ui.count(n, one, many); }

  /* ---------------- page types ---------------- */
  T.gallery = {
    count: function (s) { return cnt(s.items.length, "image", "images"); },
    tile: function (s) { return { n: s.items.length, one: "image", many: "images" }; },
    mount: function (pane, s) {
      return BS.masonry(pane, s.items, { onOpen: function (i, node) { BS.lightbox.open(s.items, i, node); } });
    }
  };

  T.films = {
    count: function (s) { return cnt(s.items.length, "film", "films"); },
    tile: function (s) { return { n: s.items.length, one: "film", many: "films" }; },
    mount: function (pane, s) { BS.videoGrid(pane, s.items); }
  };

  /* panoramas are flat (unwrapped equirectangular, 2:1) images; grid = wide crops -> lightbox shows the WHOLE flat panorama;
     "View in 360°" opens the Pannellum view (only when the item has a dataScript: file:// WebGL needs it). */
  T.panoramas = {
    count: function (s) { return cnt(s.items.length, "panorama", "panoramas"); },
    tile: function (s) { return { n: s.items.length, one: "panorama", many: "panoramas" }; },
    mount: function (pane, s) {
      var tours = s.items;
      var items = tours.map(function (t) { return { src: t.image, w: t.w || 2, h: t.h || 1, title: t.title, caption: t.caption || t.meta || "" }; });
      var grid = el("div.ptgrid");
      tours.forEach(function (t, i) {
        var can = BS.pano360.available(t);
        var card = el("button.ptcard" + (tours.length % 2 === 1 && i === 0 && tours.length > 1 ? ".featured" : ""), { type: "button", dataset: { fly: "" }, "aria-label": "Open panorama: " + t.title },
          el("img", { src: t.thumb || t.image, alt: "", draggable: "false", style: t.focus ? { objectPosition: t.focus } : {} }),
          el("div.pc-shade"),
          can ? el("span.pc-badge.glass-dark", el("i", { html: BS.icon("view360") }), el("span", { text: "360°" })) : null,
          el("div.pc-label.glass-dark", el("span.vc-title", { text: t.title }), el("span.vc-meta", { text: t.meta || "" })),
          el("span.pc-open", { html: BS.icon("arrowRight") }));
        card.addEventListener("click", function () {
          BS.lightbox.open(items, i, card.querySelector("img"), {
            actions: [{
              label: "View in 360°", icon: "view360",
              show: function (it, k) { return BS.pano360.available(tours[k]); },
              onClick: function (it, k) { BS.pano360.open(tours[k]); }
            }]
          });
        });
        grid.appendChild(card);
      });
      pane.appendChild(grid);
    }
  };

  /* links: a card per external page; opens in a new window (the URL is not shown anywhere in the UI) */
  T.links = {
    count: function (s) { return cnt(s.items.length, "tool", "tools"); },
    tile: function () { return null; },                      // links are not counted on the landing panel
    mount: function (pane, s) {
      var list = s.items, grid = el("div.ptgrid");
      list.forEach(function (t, i) {
        var card = el("button.ptcard" + (list.length % 2 === 1 && i === 0 && list.length > 1 ? ".featured" : ""), { type: "button", dataset: { fly: "" }, "aria-label": t.title },
          el("img", { src: t.image, alt: "", draggable: "false" }), el("div.pc-shade"),
          el("div.pc-label.glass-dark", el("span.vc-title", { text: t.title }), el("span.vc-meta", { text: "Opens in a new window" })),
          el("span.pc-open", { html: BS.icon("arrowUpRight") }));
        card.addEventListener("click", function () { window.open(t.url, "_blank", "noopener"); });
        grid.appendChild(card);
      });
      pane.appendChild(grid);
    }
  };

  /* flipbook / social live in profiles.js / social.js: BS.sectionTypes.flipbook / .social */

  /* "N images" / "N panoramas · N films" for the landing panel: counts per type, first-appearance order, links omitted */
  BS.sectionCount = function (sec) {
    var order = [], by = {};
    sec.subs.forEach(function (s) {
      var t = T[s.type] && T[s.type].tile && T[s.type].tile(s); if (!t) return;
      var k = t.many; if (!by[k]) { by[k] = { n: 0, one: t.one, many: t.many }; order.push(k); }
      by[k].n += t.n;
    });
    if (!order.length) { var l = sec.subs.filter(function (s) { return s.type === "links"; }); if (l.length) return cnt(l.reduce(function (a, s) { return a + s.items.length; }, 0), "link", "links"); }
    return order.map(function (k) { return cnt(by[k].n, by[k].one, by[k].many); }).join(" · ");
  };

  /* ---------------- the page ---------------- */
  function makePage(sec) {
    var multi = sec.subs.length > 1;
    function find(id) { return sec.subs.filter(function (x) { return x.id === id; })[0]; }
    function crumb(p) { var s = multi && p && p.sub && find(p.sub); return sec.title + (s ? " / " + s.title : ""); }
    return {
      title: sec.title,
      crumb: crumb,
      mount: function (root, params) {
        var active = (params && params.sub && find(params.sub) && params.sub) || sec.defaultSub || sec.subs[0].id;
        if (!find(active)) active = sec.subs[0].id;
        var f = BS.ui.frame(root, {
          eyebrow: sec.eyebrow, title: sec.title, blurb: sec.blurb,
          chips: multi ? sec.subs.map(function (s) { return { id: s.id, title: s.title, count: s.type === "gallery" ? s.items.length : null }; }) : [],
          onChip: function (id) { select(id); }
        });
        root.classList.add("sec-" + sec.id);
        root._frame = f; root._select = select;
        function render(pane) {
          var s = find(active), t = T[s.type];
          f.setBlurb(s.blurb != null ? s.blurb : sec.blurb);
          f.setMeta(t ? t.count(s) : "");
          return t ? t.mount(pane, s) : null;
        }
        function select(id) {
          if (id === active && f.pane.children.length) return;
          active = id; f.setActive(id);
          BS.router.current && (BS.router.current.params = Object.assign({}, BS.router.current.params, { sub: id }));
          BS.$("#crumb").textContent = crumb({ sub: id });
          BS.ui.swap(f.pane, render);
        }
        f.setActive(active);
        f.pane._cleanup = render(f.pane);
        return function () { f.pane._cleanup && f.pane._cleanup(); };
      },
      onKey: function (e, root) {
        if (!multi || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return false;
        var f = root._frame;
        var cur = Object.keys(f.chips).filter(function (k) { return f.chips[k].classList.contains("on"); })[0];
        var i = sec.subs.map(function (s) { return s.id; }).indexOf(cur);
        root._select(sec.subs[(i + (e.key === "ArrowRight" ? 1 : -1) + sec.subs.length) % sec.subs.length].id); return true;
      }
    };
  }

  (BS.data.sections || []).forEach(function (sec) { if (sec.subs && sec.subs.length) BS.registerPage(sec.id, makePage(sec)); });
})();
