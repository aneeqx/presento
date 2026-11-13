/* Graphics → Company Profiles: brochure cards; click opens the flipbook (BS.flipbook.open(pages)) */
(function () {
  "use strict";
  var el = BS.el;

  BS.sectionTypes.flipbook = {
    count: function (s) { return BS.ui.count(s.items.length, "brochure", "brochures"); },
    tile: function (s) { return { n: s.items.length, one: "profile", many: "profiles" }; },
    mount: function (pane, s) {
      var list = s.items;
      var wrap = el("div.profiles");
      list.forEach(function (p, i) {
        var cover = el("div.pf-cover", el("img", { src: (typeof p.pages[0] === "string" ? p.pages[0] : p.pages[0].src), alt: p.title, draggable: "false" }), el("i.pf-edge"), el("i.pf-shine"));
        var card = el("div.pf-card", { dataset: { fly: "" } },
          el("button.pf-book", { type: "button", "aria-label": "Open " + p.title }, cover),
          el("div.pf-info.glass",
            el("div.pf-text", el("span.eyebrow", { text: BS.pad2(i + 1) + " · " + (p.meta || "") }), el("h3", { text: p.title })),
            BS.ui.pill("Open", "arrowRight", "", { tag: "span" })));
        var open = function () { BS.flipbook.open(p); };
        card.querySelector(".pf-book").addEventListener("click", open);
        card.querySelector(".pf-info").addEventListener("click", open);
        /* gentle 3D tilt toward the pointer */
        var book = card.querySelector(".pf-book");
        book.addEventListener("pointermove", function (e) {
          if (BS.touch) return;
          var r = book.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
          cover.style.transform = "rotateY(" + (x * 18) + "deg) rotateX(" + (-y * 12) + "deg) translateZ(0)";
          cover.style.setProperty("--sx", (x + .5) * 100 + "%");
        });
        book.addEventListener("pointerleave", function () { cover.style.transform = ""; });
        wrap.appendChild(card);
      });
      pane.appendChild(wrap);
    }
  };
})();
