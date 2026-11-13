/* Flipbook placeholder: used when the optional flipbook engine add-on is not installed (see README, "Flipbook add-on").
   Books stay in the project and keep working in the editor; the presentation shows this notice instead of the book. */
(function () {
  "use strict";
  var el = BS.el;
  BS.flipbook = {
    installed: false,
    open: function (book) {
      var host = BS.$("#overlays"), root = el("div.fb-missing", { role: "dialog", "aria-modal": "true" },
        el("div.fb-card", el("h3", { text: "Flipbook engine not installed" }), el("p", { text: "\u201C" + ((book && book.title) || "This book") + "\u201D is stored in the project, but the optional flipbook add-on is not installed, so it cannot be shown here." }),
          el("button.btn-pill", { type: "button", text: "Close" })));
      root.style.cssText = "position:fixed;inset:0;z-index:300;display:grid;place-items:center;background:rgba(10,8,8,.55);backdrop-filter:blur(8px)";
      var card = BS.$(".fb-card", root); card.style.cssText = "max-width:460px;padding:28px 30px;border-radius:28px;background:rgba(255,255,255,.92);color:#161212;font-family:var(--font);box-shadow:0 40px 80px -24px rgba(0,0,0,.6)";
      BS.$("h3", card).style.cssText = "margin:0 0 10px;font-weight:500;font-size:22px"; BS.$("p", card).style.cssText = "margin:0 0 18px;line-height:1.5;opacity:.75";
      var esc = BS.pushEsc(close); function close() { BS.popEsc(esc); root.remove(); }
      BS.$("button", card).addEventListener("click", close); root.addEventListener("click", function (e) { if (e.target === root) close(); });
      host.appendChild(root);
    }
  };
})();
