/* Boot: wait for the bundled font, then start the shell (landing intro). */
(function () {
  "use strict";
  if ((window.STUDIO_DATA.config || {}).preview) window.addEventListener("message", function (e) {      // live preview only (never set in exports): the editor drives the page
    var d = e.data || {}; if (d.type === "go" && window.BS && BS.pages[d.page]) BS.router.go(d.page, d.params || {}, { force: true }); else if (d.type === "home") BS.router.home();
  });
  function go() { BS.shell.start().catch(function (e) { console.error("boot failed", e); document.body.classList.remove("booting"); }); }
  var fonts = document.fonts;
  var ready = fonts && fonts.load
    ? Promise.race([Promise.all([fonts.load("600 24px Urbanist"), fonts.load("200 24px Urbanist"), fonts.load("400 16px Urbanist"), fonts.load("500 16px Urbanist"), fonts.load("400 16px \"DM Sans\""), fonts.load("700 16px \"DM Sans\""), fonts.load("300 16px \"DM Sans\"")]), new Promise(function (r) { setTimeout(r, 2000); })])
    : Promise.resolve();
  var gate = window.__GATE;                         // set by the optional PIN gate (exports): the viewer starts only after it opens
  (gate && gate.then ? gate : Promise.resolve()).then(function () { ready.then(go, go); });
})();
