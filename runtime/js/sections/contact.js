/* Contact / ending screen (route "contact"). All text comes from data.js `contact`. */
(function () {
  "use strict";
  var el = BS.el;
  BS.registerPage("contact", {
    title: "Contact",
    crumb: function () { return "Contact"; },
    mount: function (root) {
      var C = BS.data.contact || {}, B = BS.data.brand || {};
      root.classList.add("contact");
      var bg = el("div.ct-bg", el("i.ct-sheen"), el("i.ct-lines"), el("i.ct-vig"));
      var head = el("h1.ct-h", { text: C.heading || "" }), sub = el("p.ct-sub", { text: C.subline || "" });
      var items = (C.items || []).map(function (it) {
        var v = it.href ? el("a.ct-v", { href: it.href, text: it.value, target: it.href.indexOf("http") === 0 ? "_blank" : null, rel: "noopener" }) : el("span.ct-v", { text: it.value });
        return el("div.ct-g", el("span.ct-l", { text: it.label }), v);
      });
      var info = el("div.ct-info", items);
      var logo = B.logo ? el("div.ct-brand", el("img.ct-logo", { src: B.logo, alt: B.name || "", draggable: "false" }), el("div.ct-tag", { text: BS.taglineText() })) : null;
      root.appendChild(bg); root.appendChild(el("div.ct-body", head, sub, info, logo));
      [bg, head, sub, logo, bg.querySelector(".ct-lines")].concat(items).forEach(function (n) { if (n) n.style.opacity = 0; });      // hidden until ready(): the entrance runs ONCE (it used to restart after the page-in and flash)
      root._parts = { head: head, sub: sub, groups: items, logo: logo, bg: bg, lines: bg.querySelector(".ct-lines") };
    },
    ready: function (root) {
      var P = root._parts, M = BS.motion;
      function enter(n, from, opts) {
        if (!n) return;
        var a = BS.animate(n, [Object.assign({ opacity: 0 }, from || {}), { opacity: 1, transform: "none" }], Object.assign({ fill: "both" }, opts));
        a.done.then(function () { n.style.opacity = 1; try { a.cancel(); } catch (e) {} });
      }
      var up = { transform: "translateY(18px)" };
      enter(P.bg, null, { duration: M.l, easing: M.out });
      enter(P.head, up, { duration: M.l, easing: M.soft });
      enter(P.sub, up, { duration: M.l, delay: 120, easing: M.soft });
      P.groups.forEach(function (g, i) { enter(g, up, { duration: M.l, delay: 400 + i * 90, easing: M.soft }); });
      enter(P.logo, null, { duration: M.xl, delay: 700, easing: M.out });
      enter(P.lines, null, { duration: M.xl, delay: 900, easing: M.out });
    }
  });
})();
