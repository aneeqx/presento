/* iPhone mockup running a clickable Instagram-STYLE app (generic look, no brand assets).
   BS.phone.create(socialData) → { wrap, back(), canBack(), destroy() }   — everything comes from data.js → graphics.social */
(function () {
  "use strict";
  var el = BS.el, ic = BS.icon;
  var W = 440, H = 956, BZ = 14;                 // screen size + bezel → frame 468 × 984

  function initials(n) { return (n || "?").replace(/[^a-z0-9]/gi, "").slice(0, 1).toUpperCase(); }
  function hue(n) { var h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360; return h; }
  function avatarDot(name, size) {
    var hh = 150 + (hue(name) % 50);
    return el("span.ig-dot", { text: initials(name), style: { width: size + "px", height: size + "px", background: "hsl(" + hh + ",42%,34%)", fontSize: Math.round(size * .42) + "px" } });
  }
  function num(s) { var n = parseInt(String(s).replace(/[^0-9]/g, ""), 10); return isNaN(n) || /[kKmM]/.test(String(s)) ? null : n; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  function statusBar() {
    return el("div.ph-status",
      el("span.ph-time", { text: "9:41" }),
      el("span.ph-icons", {
        html: '<svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.500" width="3.200" height="6.500" rx="1" fill="currentColor"/><rect x="10" y="3" width="3.200" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3.200" height="12" rx="1" fill="currentColor"/></svg>' +
          '<svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.500 2.200a8.500 8.500 0 0 1 6 2.500l1.200-1.300A10.300 10.300 0 0 0 8.500.4 10.300 10.300 0 0 0 1.300 3.400l1.200 1.300a8.500 8.500 0 0 1 6-2.500zm0 3.600a4.900 4.900 0 0 1 3.400 1.400l1.200-1.300a6.700 6.700 0 0 0-9.200 0l1.200 1.300a4.900 4.900 0 0 1 3.400-1.400zm0 3.500a1.500 1.500 0 1 0 0 3 1.500 1.500 0 0 0 0-3z" fill="currentColor"/></svg>' +
          '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="22" height="12" rx="3.800" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="19" height="9" rx="2.500" fill="currentColor"/><path d="M24 4.500v4c.9-.3 1.600-1.200 1.600-2s-.7-1.700-1.600-2z" fill="currentColor" opacity=".5"/></svg>'
      }));
  }

  function create(D) {
    var P = D.profile, posts = D.posts || [], hls = D.highlights || [];
    var state = { view: "profile", story: null, escs: [] };
    var screen = el("div.ph-screen");
    var igRoot = el("div.ig");
    var profile = el("div.ig-view.v-profile"), postV = el("div.ig-view.v-post");
    var tab = el("div.ig-tabbar");
    var storyHost = el("div.ig-story-host");

    /* ----------------------------- profile ----------------------------- */
    var scroll = el("div.ig-scroll");
    var stats = P.stats || {};
    var postCount = stats.posts != null ? stats.posts : posts.length;
    scroll.appendChild(el("div.ig-top",
      el("div.ig-uname", el("span", { text: P.username }), P.verified ? el("i.ig-ver", { html: ic("check") }) : null, el("i.ig-chev", { html: ic("chevD") })),
      el("div.ig-top-r", el("i", { html: ic("plusSq") }), el("i", { html: ic("menu") }))));
    var avatar = el("div.ig-ring", el("img", { src: P.avatar, alt: P.name, draggable: "false" }));
    scroll.appendChild(el("div.ig-head", avatar,
      el("div.ig-stats",
        el("div", el("b", { text: String(postCount) }), el("span", { text: "posts" })),
        el("div", el("b", { text: String(stats.followers || 0) }), el("span", { text: "followers" })),
        el("div", el("b", { text: String(stats.following || 0) }), el("span", { text: "following" })))));
    scroll.appendChild(el("div.ig-bio",
      el("b", { text: P.name }), P.category ? el("div.ig-cat", { text: P.category }) : null,
      (P.bio || []).map(function (l) { return el("div", { text: l }); }),
      P.link ? el("div.ig-link", { text: P.link }) : null));
    scroll.appendChild(el("div.ig-btns", el("span.ig-btn.sec", { text: "Following" }), el("span.ig-btn.sec", { text: "Message" }), el("span.ig-btn.sec.sq", { html: ic("userPlus") })));
    var hlRow = el("div.ig-hl"), hlBtns = [];
    hls.forEach(function (h) {
      var c = el("button.ig-hl-i", { type: "button", "aria-label": "Highlight " + h.title }, el("span.ig-hl-ring", el("img", { src: h.cover, alt: "", draggable: "false" })), el("span.ig-hl-t", { text: h.title }));
      c.addEventListener("click", function () { openStory(h, c.querySelector(".ig-hl-ring")); });
      hlRow.appendChild(c); hlBtns.push(c);
    });
    scroll.appendChild(hlRow);
    scroll.appendChild(el("div.ig-tabs", el("i.on.ico-active", { html: ic("grid3") }), el("i", { html: ic("reel") }), el("i", { html: ic("tag") })));
    var grid = el("div.ig-grid");
    posts.forEach(function (p, i) {
      var cell = el("button.ig-cell", { type: "button", "aria-label": "Open post " + (i + 1) }, el("img", { src: p.images[0], alt: "", draggable: "false", loading: "eager" }), p.images.length > 1 ? el("i.ig-multi", { html: ic("layers") }) : null);
      cell.addEventListener("click", function () { openPost(i); });
      grid.appendChild(cell);
    });
    scroll.appendChild(grid);
    profile.appendChild(scroll);

    /* ----------------------------- post feed ----------------------------- */
    var postScroll = el("div.ig-scroll.ig-feed");
    var postBar = el("div.ig-pbar", el("button.ig-back", { type: "button", "aria-label": "Back", html: ic("chevL"), on: { click: function () { back(); } } }),
      el("div.ig-ptitle", el("small", { text: P.username }), el("b", { text: "Posts" })), el("span.ig-pspace"));
    var feedEls = [];
    posts.forEach(function (p) { var n = buildPost(p); feedEls.push(n); postScroll.appendChild(n); });
    postV.appendChild(postBar); postV.appendChild(postScroll);

    function buildPost(p) {
      var liked = false, likeN = num(p.likes);
      var likesEl = el("div.ig-likes", { text: p.likes + " likes" });
      var heartBtn = el("button.ig-act", { type: "button", "aria-label": "Like", html: ic("heart") });
      var saveBtn = el("button.ig-act", { type: "button", "aria-label": "Save", html: ic("bookmark") });
      saveBtn.addEventListener("click", function () { var on = saveBtn.classList.toggle("ico-active"); saveBtn.setAttribute("aria-pressed", String(on)); });
      function setLike(v) {
        if (v === liked) return; liked = v;
        heartBtn.classList.toggle("liked", liked); heartBtn.classList.toggle("ico-active", liked);
        BS.animate(heartBtn, [{ transform: "scale(1)" }, { transform: "scale(1.16)", offset: .4 }, { transform: "scale(1)" }], { duration: 600, easing: BS.motion.out, fill: "none" });
        if (likeN != null) likesEl.textContent = fmt(likeN + (liked ? 1 : 0)) + " likes";
      }
      heartBtn.addEventListener("click", function () { setLike(!liked); });
      var media = carousel(p.images, function () { setLike(true); });
      var cm = p.comments || [];
      var commentsWrap = el("div.ig-comments");
      function renderComments(all) {
        commentsWrap.innerHTML = "";
        (all ? cm : cm.slice(0, 2)).forEach(function (c) { commentsWrap.appendChild(el("div.ig-c", el("b", { text: c.user }), " " + c.text)); });
      }
      renderComments(false);
      var viewAll = cm.length > 2 ? el("button.ig-viewall", { type: "button", text: "View all " + cm.length + " comments" }) : (cm.length ? null : el("div.ig-viewall.dim", { text: "No comments yet" }));
      if (viewAll && viewAll.tagName === "BUTTON") viewAll.addEventListener("click", function () { renderComments(true); viewAll.remove(); });
      return el("article.ig-post",
        el("div.ig-ph", el("span.ig-ph-av", el("img", { src: P.avatar, alt: "", draggable: "false" })), el("div.ig-ph-t", el("b", { text: P.username }), p.location ? el("small", { text: p.location }) : null), el("i", { html: ic("more") })),
        media,
        el("div.ig-acts", heartBtn, el("button.ig-act", { type: "button", html: ic("comment"), "aria-label": "Comment" }), el("button.ig-act", { type: "button", html: ic("send"), "aria-label": "Share" }), el("span.ig-grow"), saveBtn),
        likesEl,
        el("div.ig-cap", el("b", { text: P.username }), " " + (p.caption || "")),
        viewAll, commentsWrap,
        el("div.ig-time", { text: (p.time || "").toUpperCase() }));
    }

    function carousel(images, onDouble) {
      var i = 0, n = images.length;
      var track = el("div.ig-track", images.map(function (s) { return el("div.ig-slide", el("img", { src: s, alt: "", draggable: "false" })); }));
      var dots = n > 1 ? el("div.ig-dots", images.map(function () { return el("i"); })) : null;
      var badge = n > 1 ? el("div.ig-badge", { text: "1/" + n }) : null;
      var burst = el("i.ig-burst", { html: ic("heartFill") });
      var box = el("div.ig-car", track, badge, burst);
      function set(k, instant) {
        i = BS.clamp(k, 0, n - 1);
        track.style.transition = instant ? "none" : "";
        track.style.transform = "translateX(" + (-i * 100) + "%)";
        if (dots) BS.$$("i", dots).forEach(function (d, j) { d.classList.toggle("on", j === i); });
        if (badge) badge.textContent = (i + 1) + "/" + n;
      }
      set(0, true);
      var sx = 0, dx = 0, down = false, moved = false, last = 0;
      box.addEventListener("pointerdown", function (e) { down = true; moved = false; sx = e.clientX; dx = 0; box.setPointerCapture(e.pointerId); });
      box.addEventListener("pointermove", function (e) {
        if (!down || n < 2) return; dx = e.clientX - sx; if (Math.abs(dx) > 6) moved = true;
        var sc = box.getBoundingClientRect().width / box.offsetWidth || 1;
        track.style.transition = "none"; track.style.transform = "translateX(calc(" + (-i * 100) + "% + " + (dx / sc) + "px))";
      });
      function end() {
        if (!down) return; down = false;
        if (Math.abs(dx) > 50) set(i + (dx < 0 ? 1 : -1)); else set(i);
        if (!moved) {
          var now = performance.now();
          if (now - last < 320) { onDouble(); BS.animate(burst, [{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1.15)", offset: .35 }, { opacity: 0, transform: "scale(1.3)" }], { duration: 800, fill: "none" }); }
          last = now;
        }
      }
      box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
      var wrap = el("div.ig-media", box, dots);
      return wrap;
    }

    /* ----------------------------- navigation inside the phone ----------------------------- */
    function openPost(i) {
      if (state.view !== "profile") return;
      state.view = "post";
      postV.style.display = "";
      postScroll.scrollTop = 0;
      var target = feedEls[i];
      BS.raf().then(function () { postScroll.scrollTop = target.offsetTop - 4; });
      BS.animate(postV, [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], { duration: 640, easing: BS.springs.soft.easing, fill: "forwards" });
      BS.animate(profile, [{ transform: "translateX(0)", filter: "brightness(1)" }, { transform: "translateX(-26%)", filter: "brightness(.9)" }], { duration: 640, easing: BS.springs.soft.easing, fill: "forwards" });
      var esc = BS.pushEsc(function () { back(); }); state.escs.push(esc);
    }
    function closePost() {
      state.view = "profile";
      var e = state.escs.pop(); e && BS.popEsc(e);
      var a = BS.animate(postV, [{ transform: "translateX(0)" }, { transform: "translateX(100%)" }], { duration: 520, easing: BS.springs.soft.easing, fill: "forwards" });
      BS.animate(profile, [{ transform: "translateX(-26%)", filter: "brightness(.9)" }, { transform: "translateX(0)", filter: "brightness(1)" }], { duration: 520, easing: BS.springs.soft.easing, fill: "forwards" });
      a.done.then(function () { if (state.view === "profile") postV.style.display = "none"; });
    }

    function openStory(h, origin) {
      if (state.story) return;
      var items = h.stories || [], idx = 0, prog = 0, paused = false, raf = 0, last = 0, DUR = 4500, closing = false;
      var img = el("img.ig-simg", { src: items[0].src, alt: "", draggable: "false" });
      var bars = el("div.ig-bars", items.map(function () { return el("div.ig-bar", el("i")); }));
      var time = el("small", { text: items[0].time || "" });
      var closeB = el("button.ig-sclose", { type: "button", "aria-label": "Close story", html: ic("close") });
      var head = el("div.ig-shead", el("span.ig-ph-av", el("img", { src: P.avatar, alt: "", draggable: "false" })), el("b", { text: h.title === P.name ? P.username : P.username }), time, el("span.ig-grow"), closeB);
      var foot = el("div.ig-sfoot", el("span.ig-sinput", { text: "Send message" }), el("i", { html: ic("heart") }), el("i", { html: ic("send") }));
      var root = el("div.ig-story", img, el("div.ig-sshade"), bars, head, foot);
      storyHost.appendChild(root);
      screen.classList.add("dark-status");
      var sr = screen.getBoundingClientRect(), r = origin.getBoundingClientRect(), sc = sr.width / W || 1;
      var cx = (r.left + r.width / 2 - sr.left) / sc, cy = (r.top + r.height / 2 - sr.top) / sc;
      root.animate([{ clipPath: "circle(24px at " + cx + "px " + cy + "px)", opacity: .6 }, { clipPath: "circle(1100px at " + cx + "px " + cy + "px)", opacity: 1 }], { duration: BS.reduced() ? 1 : 620, easing: "cubic-bezier(.3,.7,.2,1)", fill: "none" });
      state.story = root;
      function paint() {
        BS.$$(".ig-bar i", bars).forEach(function (b, j) { b.style.transform = "scaleX(" + (j < idx ? 1 : j === idx ? prog : 0) + ")"; });
      }
      function show(k, dir) {
        if (k < 0) { prog = 0; paint(); return; }
        if (k >= items.length) { close(); return; }
        idx = k; prog = 0; time.textContent = items[k].time || "";
        var nimg = el("img.ig-simg", { src: items[k].src, alt: "", draggable: "false" });
        root.insertBefore(nimg, img.nextSibling);
        var old = img; img = nimg;
        BS.animate(nimg, [{ opacity: 0, transform: "scale(1.04)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: "ease-out", fill: "none" });
        setTimeout(function () { old.remove(); }, 400);
        paint();
      }
      function tick(now) {
        if (closing) return;
        var dt = Math.min(64, now - last); last = now;
        if (!paused) { prog += dt / DUR; if (prog >= 1) { show(idx + 1); } }
        paint(); raf = requestAnimationFrame(tick);
      }
      last = performance.now(); raf = requestAnimationFrame(tick);
      var holdT = 0, held = false, sx0 = 0, sy0 = 0, swiped = false, gi = hls.indexOf(h);
      root.addEventListener("pointerdown", function (e) {
        if (e.target.closest("button,.ig-sfoot")) return;
        held = false; swiped = false; sx0 = e.clientX; sy0 = e.clientY;
        holdT = setTimeout(function () { held = true; paused = true; root.classList.add("held"); }, 220);
      });
      if (BS.touch) root.addEventListener("pointermove", function (e) {
        if (swiped || (!holdT && !held)) return;
        if (Math.hypot(e.clientX - sx0, e.clientY - sy0) > 14 && !held) { clearTimeout(holdT); holdT = 0; swiped = true; }       // moving: it is a swipe, not a hold or a tap
      });
      function swapGroup(dir) {                                                   // jump to the neighbouring highlight group
        var k = gi + dir;
        if (k < 0 || k >= hls.length) { if (dir > 0) close(); return; }
        closing = true; cancelAnimationFrame(raf); BS.popEsc(esc); root.remove(); state.story = null;
        openStory(hls[k], hlBtns[k].querySelector(".ig-hl-ring"));
      }
      function up(e) {
        clearTimeout(holdT); if (paused) { paused = false; root.classList.remove("held"); }
        if (BS.touch && swiped) {
          var dx = e.clientX - sx0, dy = e.clientY - sy0;
          if (Math.abs(dy) > Math.abs(dx) && dy > 70) close();                      // swipe down: close
          else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) swapGroup(dx < 0 ? 1 : -1);
          return;
        }
        if (held || (e.target.closest && e.target.closest("button,.ig-sfoot"))) return;
        var rr = root.getBoundingClientRect(), x = (e.clientX - rr.left) / rr.width;
        if (x < .32) show(idx - 1); else show(idx + 1);
      }
      root.addEventListener("pointerup", up);
      root.addEventListener("pointercancel", function () { clearTimeout(holdT); paused = false; });
      closeB.addEventListener("click", function (e) { e.stopPropagation(); close(); });
      var esc = BS.pushEsc(close);
      async function close() {
        if (closing) return; closing = true; cancelAnimationFrame(raf); BS.popEsc(esc);
        var a = root.animate([{ clipPath: "circle(1100px at " + cx + "px " + cy + "px)", opacity: 1 }, { clipPath: "circle(24px at " + cx + "px " + cy + "px)", opacity: .4 }], { duration: BS.reduced() ? 1 : 440, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" });
        await a.finished; root.remove(); state.story = null; screen.classList.remove("dark-status");
      }
      state.story.closeFn = close;
    }

    function back() {
      if (state.story) { state.story.closeFn(); return true; }
      if (state.view === "post") { closePost(); return true; }
      return false;
    }

    /* ----------------------------- tab bar + assemble ----------------------------- */
    tab.appendChild(el("i", { html: ic("homeApp") })); tab.appendChild(el("i", { html: ic("search") })); tab.appendChild(el("i", { html: ic("plusSq") })); tab.appendChild(el("i", { html: ic("reel") }));
    var me = el("i.me", el("img", { src: P.avatar, alt: "", draggable: "false" })); me.addEventListener("click", function () { back(); }); tab.appendChild(me);
    postV.style.display = "none";
    igRoot.appendChild(profile); igRoot.appendChild(postV); igRoot.appendChild(tab);
    screen.appendChild(igRoot); screen.appendChild(storyHost);
    screen.appendChild(el("div.ph-island", el("i.ph-lens")));
    screen.appendChild(statusBar());
    screen.appendChild(el("div.ph-home"));

    var phone = el("div.phone",
      el("i.ph-btn.act"), el("i.ph-btn.vup"), el("i.ph-btn.vdn"), el("i.ph-btn.pwr"), screen);
    var wrap = el("div.phone-wrap", { role: "img", "aria-label": "iPhone showing the " + P.name + " profile" }, phone);

    function fit() {
      var avail = window.innerHeight - 104 - 30;
      var ps = BS.clamp(avail / (H + BZ * 2), .42, 1.12);
      wrap.style.setProperty("--ps", ps.toFixed(4));
    }
    fit(); window.addEventListener("resize", fit);

    return {
      wrap: wrap, back: back, canBack: function () { return state.view !== "profile" || !!state.story; },
      destroy: function () { window.removeEventListener("resize", fit); state.escs.forEach(function (e) { BS.popEsc(e); }); if (state.story) { BS.escStack.length = 0; } }
    };
  }

  BS.phone = { create: create, W: W, H: H, BZ: BZ };
})();
