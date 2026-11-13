/* Shared UI building blocks: page frame (glass side panel + main), chips, action pill, video card, inner content swap */
(function () {
  "use strict";
  var el = BS.el;
  var ui = BS.ui = {};

  /* action pill: Deep Teal pill with the icon in a round chip INSIDE it (label · chip; "back" mirrors it).
     Hover: the arrow slides out and a fresh one slides in, the chip turns mint with a soft glow. No merged shapes. */
  ui.pill = function (label, icon, cls, props) {
    var tag = (props && props.tag) || "button";
    if (props) { props = Object.assign({}, props); delete props.tag; }
    var svg = BS.icon(icon || "arrowRight");
    return el(tag + ".btn-pill" + (cls ? "." + cls.split(" ").join(".") : ""), Object.assign(tag === "button" ? { type: "button" } : {}, props || {}),
      el("span.bp-label", { text: label }),
      el("span.bp-ico", el("i.a1", { html: svg }), el("i.a2", { html: svg })));
  };
  ui.blob = ui.pill;                                   // old name, kept so nothing else breaks

  ui.chip = function (title, count) {
    return el("button.chip", { type: "button" }, el("i.dot"), el("span", title), count != null ? el("span.n", String(count)) : null);
  };

  /* standard section frame: sticky glass side panel (title, blurb, chips) + main area */
  ui.frame = function (root, o) {
    root.classList.add("frame");
    var chipsEl = el("div.chips");
    var chipMap = {};
    (o.chips || []).forEach(function (c) {
      var chip = ui.chip(c.title, c.count);
      chip.addEventListener("click", function () { o.onChip && o.onChip(c.id); });
      chipsEl.appendChild(chip); chipMap[c.id] = chip;
    });
    var blurb = el("p.lead", { text: o.blurb || "" });
    var meta = el("div.side-meta", { text: o.meta || "" });
    var side = el("aside.side.glass", { dataset: { fly: "" } },
      el("div.side-top", el("span.eyebrow", { text: o.eyebrow || "" }), el("h1.display", { text: o.title || "" })),
      blurb,
      (o.chips || []).length ? chipsEl : null,
      meta);
    /* safety net: if a (long) title still overflows the card, shrink it until it fits */
    var h1 = side.querySelector("h1");
    function fit() { h1.style.fontSize = ""; var w = h1.clientWidth; if (w > 0 && h1.scrollWidth > w + 1) h1.style.fontSize = Math.floor(parseFloat(getComputedStyle(h1).fontSize) * w / h1.scrollWidth * .97) + "px"; }
    var lastW = -1;
    if (window.ResizeObserver) new ResizeObserver(function () { var w = side.clientWidth; if (w === lastW) return; lastW = w; requestAnimationFrame(fit); }).observe(side);
    var pane = el("div.pane");
    var main = el("div.main", pane);
    root.appendChild(side); root.appendChild(main);
    var api = {
      side: side, main: main, pane: pane, chips: chipMap,
      setActive: function (id) { Object.keys(chipMap).forEach(function (k) { chipMap[k].classList.toggle("on", k === id); }); },
      setBlurb: function (t) { blurb.textContent = t; },
      setMeta: function (t) { meta.textContent = t; }
    };
    return api;
  };

  /* swap the content of a pane with a soft blur/slide transition; build(pane) may return a cleanup fn */
  ui.swap = async function (pane, build) {
    if (pane._busy) return;
    pane._busy = true;
    if (pane.children.length) {
      await BS.animate(pane, [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(10px)" }], { duration: 320, easing: BS.motion.in, fill: "forwards" }).done;
    }
    pane.getAnimations().forEach(function (a) { a.cancel(); });
    try { pane._cleanup && pane._cleanup(); } catch (e) { console.error(e); }
    pane.innerHTML = "";
    pane._cleanup = build(pane) || null;
    pane._busy = false;
    await BS.raf();
    BS.animate(pane, [{ opacity: 0, transform: "translateY(22px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 800, easing: BS.motion.soft, fill: "none" });
  };

  /* video card (16:9): poster, hover = muted silent preview, click = cinematic player */
  ui.videoCard = function (item, o) {
    o = o || {};
    var poster = el("img.vc-poster", { src: item.poster || "", alt: "", draggable: "false" });
    var st = +item.start || 0, en = +item.end || 0, trimmed = st > 0 || en > 0;
    var vid = el("video.vc-video", { muted: true, loop: !trimmed, playsinline: true, preload: "metadata", tabindex: "-1" });
    vid.muted = true;
    if (item.src) vid.src = item.src;
    if (trimmed) {                                           // hover preview stays inside item.start .. item.end
      var back = function () { try { vid.currentTime = st; } catch (e) {} };
      vid.addEventListener("loadedmetadata", back);
      vid.addEventListener("timeupdate", function () { if (en && vid.currentTime >= en) { back(); } });
      vid.addEventListener("ended", function () { back(); if (card.classList.contains("live")) { var q = vid.play(); q && q.catch(function () {}); } });
    }
    var card = el("button.vcard" + (o.featured ? ".featured" : ""), { type: "button", dataset: { fly: "" }, "aria-label": "Play " + item.title },
      poster, vid,
      el("div.vc-shade"),
      el("div.vc-play", el("span.play-btn", { html: BS.icon("playFill") })),
      el("div.vc-label.glass-dark", el("span.vc-title", { text: item.title }), el("span.vc-meta", { text: item.meta || "" })));
    var pv = null;
    card.addEventListener("pointerenter", function (e) { if (BS.touch) return; pv = vid.play(); if (pv) pv.catch(function () {}); card.classList.add("live"); });
    card.addEventListener("pointerleave", function () { card.classList.remove("live"); setTimeout(function () { if (!card.classList.contains("live")) { vid.pause(); } }, 400); });
    card.addEventListener("click", function () { o.onOpen && o.onOpen(item, card); });
    return card;
  };

  ui.count = function (n, one, many) { return n + " " + (n === 1 ? one : many); };
})();
