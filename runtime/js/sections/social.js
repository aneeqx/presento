/* Graphics → Social Media: post gallery (lightbox) + realistic iPhone running the Instagram-style app */
(function () {
  "use strict";
  var el = BS.el;

  BS.sectionTypes.social = {
    count: function (s) { return BS.ui.count(s.social.posts.length, "post", "posts") + " · " + BS.ui.count(s.social.highlights.length, "highlight", "highlights"); },
    tile: function (s) { return { n: s.social.posts.length, one: "post", many: "posts" }; },
    mount: function (pane, s) {
      var S = s.social;
      var items = S.posts.map(function (p, i) { return { src: p.images[0], w: 900, h: 900, title: "Post " + BS.pad2(i + 1), caption: p.caption }; });
      var gal = el("div.sg-grid");
      items.forEach(function (it, i) {
        var b = el("button.sg-item", { type: "button", "aria-label": it.title, dataset: { fly: "", i: BS.pad2(i + 1) } },
          el("img", { src: it.src, alt: "", draggable: "false" }),
          S.posts[i].images.length > 1 ? el("i.sg-multi.glass-dark", { text: "1/" + S.posts[i].images.length }) : null,
          el("div.m-cap.glass", el("span", { text: it.title }), el("i", { html: BS.icon("expand") })));
        b.addEventListener("click", function () { BS.lightbox.open(items, i, b); });
        gal.appendChild(b);
      });
      var left = el("div.sg",
        el("div.sg-head", el("span.eyebrow", { text: "Post gallery" }), el("p.lead", { text: "Tap a post to view it large. Or try the phone → tap a post, a highlight, or the back arrow." })),
        gal);
      var phone = BS.phone.create(S);
      var right = el("div.phone-col", { dataset: { fly: "" } }, phone.wrap);
      var wrap = el("div.social", left, right);
      pane.appendChild(wrap);
      pane._phone = phone;
      return function () { phone.destroy(); };
    }
  };
})();
