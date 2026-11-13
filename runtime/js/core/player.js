/* Cinematic video player: dark backdrop, rounded 16:9 frame, floating glass control bar (play/pause, scrub, time, mute, fullscreen).
   BS.player.open(list, index, originEl)   list: [{src, poster, title, meta, desc}] */
(function () {
  "use strict";
  var el = BS.el;
  var P = null;

  function open(list, index, origin) {
    if (P) return;
    var host = BS.$("#overlays");
    var item = list[index];
    var bg = el("div.pl-bg");
    var video = el("video.pl-video", { playsinline: true, preload: "auto" });
    if (item.poster) video.poster = item.poster;
    video.src = item.src;
    var centerPlay = el("button.pl-center", { type: "button", "aria-label": "Play", html: '<span class="play-btn">' + BS.icon("playFill") + "</span>" });
    var frame = el("div.pl-frame", video, centerPlay);

    var playBtn = el("button.pl-play", { type: "button", "aria-label": "Play / pause", html: BS.icon("playFill") });
    var title = el("div.pl-title", { text: item.title || "" });
    var sub = el("div.pl-sub", { text: item.meta || "" });
    var cur = el("span.pl-cur", { text: "0:00" }), dur = el("span.pl-dur", { text: "0:00" });
    var buf = el("i.pl-buf"), fill = el("i.pl-fill"), knob = el("i.pl-knob");
    var track = el("div.pl-track", { role: "slider", "aria-label": "Seek", tabindex: "0" }, buf, fill, knob);
    var muteBtn = el("button.pl-ico", { type: "button", "aria-label": "Mute", html: BS.icon("volume") });
    var fsBtn = el("button.pl-ico", { type: "button", "aria-label": "Fullscreen", html: BS.icon("fullscreen") });
    var bar = el("div.pl-bar.glass-dark", playBtn,
      el("div.pl-mid", el("div.pl-meta", title, sub), track, el("div.pl-times", cur, dur)),
      el("div.pl-right", muteBtn, fsBtn));

    var closeBtn = el("button.icon-btn.glass-dark.pl-close", { type: "button", "aria-label": "Close", html: BS.icon("close") });
    var prevBtn = el("button.icon-btn.glass-dark.pl-nav", { type: "button", "aria-label": "Previous video", html: BS.icon("chevL") });
    var nextBtn = el("button.icon-btn.glass-dark.pl-nav", { type: "button", "aria-label": "Next video", html: BS.icon("chevR") });
    var top = el("div.pl-top", el("div.pl-count.glass-dark"), el("div.pl-top-r", list.length > 1 ? [prevBtn, nextBtn] : null, closeBtn));
    var root = el("div.pl", { role: "dialog", "aria-modal": "true" }, bg, frame, bar, top);
    host.appendChild(root);

    P = { root: root, video: video, i: index, list: list, origin: origin, closing: false, idleT: 0, item: item };

    /* playback trim: item.start / item.end (seconds) limit what plays; the file itself is untouched. Every time/seek value below is relative to this range. */
    function rng() {
      var d = video.duration, it = (P && P.item) || item || {}, s0 = +it.start || 0, e0 = +it.end || 0;
      if (!isFinite(d)) return { s: s0, e: e0 || 0 };
      if (!e0 || e0 > d) e0 = d;
      if (s0 >= e0) s0 = 0;
      return { s: s0, e: e0 };
    }
    function seekBy(dt) { var r = rng(); video.currentTime = BS.clamp(video.currentTime + dt, r.s, r.e || 1e9); }

    function setPlayingUI() {
      var p = !video.paused && !video.ended;
      playBtn.innerHTML = BS.icon(p ? "pause" : "playFill");
      root.classList.toggle("playing", p);
      centerPlay.style.pointerEvents = p ? "none" : "";
    }
    function toggle() {
      if (video.paused || video.ended) {
        var r = rng(); if (r.e && (video.ended || video.currentTime >= r.e - .05 || video.currentTime < r.s - .05)) video.currentTime = r.s;
        var pr = video.play(); pr && pr.catch(function () {});
      } else video.pause();
    }
    function seekFrac(f) { if (isFinite(video.duration)) { var r = rng(); video.currentTime = r.s + BS.clamp(f, 0, 1) * (r.e - r.s); } }
    function wake() {
      root.classList.remove("idle"); clearTimeout(P.idleT);
      if (BS.touch) return;                                                   // touch: the controls stay visible (nothing is hover-revealed)
      P.idleT = setTimeout(function () { if (!video.paused) root.classList.add("idle"); }, 2600);
    }

    video.addEventListener("play", setPlayingUI); video.addEventListener("pause", function () { setPlayingUI(); wake(); }); video.addEventListener("ended", function () { setPlayingUI(); root.classList.remove("idle"); });
    video.addEventListener("loadedmetadata", function () { var r = rng(); dur.textContent = BS.fmtTime(r.e - r.s); if (r.s > 0 && video.currentTime < r.s) video.currentTime = r.s; });
    video.addEventListener("timeupdate", function () {
      var r = rng(), len = (r.e - r.s) || 0, t = video.currentTime;
      if (r.e && r.e < video.duration - .01 && t >= r.e - .03 && !video.paused) { video.pause(); video.currentTime = r.e; t = r.e; setPlayingUI(); root.classList.remove("idle"); }      // trimmed end: stop like a natural end
      var f = len ? BS.clamp((t - r.s) / len, 0, 1) : 0;
      fill.style.transform = "scaleX(" + f + ")"; knob.style.left = (f * 100) + "%"; cur.textContent = BS.fmtTime(Math.max(0, t - r.s));
    });
    video.addEventListener("progress", function () { try { if (video.buffered.length) { var r = rng(), len = (r.e - r.s) || 1; buf.style.transform = "scaleX(" + BS.clamp((video.buffered.end(video.buffered.length - 1) - r.s) / len, 0, 1) + ")"; } } catch (e) {} });
    video.addEventListener("volumechange", function () { muteBtn.innerHTML = BS.icon(video.muted || video.volume === 0 ? "mute" : "volume"); });

    playBtn.addEventListener("click", toggle); centerPlay.addEventListener("click", toggle); video.addEventListener("click", toggle);
    muteBtn.addEventListener("click", function () { video.muted = !video.muted; });
    function fsToggle() { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen && root.requestFullscreen().catch(function () {}); }
    fsBtn.addEventListener("click", fsToggle);
    P.fsChange = function () { var f = !!document.fullscreenElement; root.classList.toggle("fs", f); fsBtn.innerHTML = BS.icon(f ? "exitFs" : "fullscreen"); };
    document.addEventListener("fullscreenchange", P.fsChange);
    closeBtn.addEventListener("click", close);
    root.addEventListener("click", function (e) { if (e.target === root || e.target === bg) close(); });      // backdrop beside the video closes; video + controls do not
    prevBtn.addEventListener("click", function () { nav(-1); }); nextBtn.addEventListener("click", function () { nav(1); });

    var dragging = false;
    function scrubTo(e) { var r = track.getBoundingClientRect(); seekFrac((e.clientX - r.left) / r.width); }
    track.addEventListener("pointerdown", function (e) { dragging = true; track.setPointerCapture(e.pointerId); root.classList.add("scrub"); scrubTo(e); });
    track.addEventListener("pointermove", function (e) { if (dragging) scrubTo(e); });
    track.addEventListener("pointerup", function () { dragging = false; root.classList.remove("scrub"); });
    track.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") { seekBy(5); e.stopPropagation(); } if (e.key === "ArrowLeft") { seekBy(-5); e.stopPropagation(); } });
    root.addEventListener("pointermove", wake); root.addEventListener("pointerdown", wake);      // pointerdown too: a touch tap fires no pointermove

    P.key = function (e) {
      if (!P || P.closing) return;
      if (e.key === " " || e.key === "k") { toggle(); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === "ArrowRight") { seekBy(5); wake(); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === "ArrowLeft") { seekBy(-5); wake(); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === "m") { video.muted = !video.muted; }
      else if (e.key === "f") { fsToggle(); }
      else if (e.key === "ArrowUp") { video.volume = Math.min(1, video.volume + .1); e.preventDefault(); }
      else if (e.key === "ArrowDown") { video.volume = Math.max(0, video.volume - .1); e.preventDefault(); }
      else if (e.key === "PageDown" || e.key === "n") nav(1);
      else if (e.key === "PageUp" || e.key === "p") nav(-1);
    };
    document.addEventListener("keydown", P.key, true);
    P.esc = BS.pushEsc(close);

    P.nav = BS.nav.push({ label: "", onBack: function () { close(); } });
    if (list.length > 1) { bar.insertBefore(prevBtn, playBtn); bar.insertBefore(nextBtn, playBtn.nextSibling); }      // prev / next join the bottom bar around play (SPEC-R7 §2.2)
    function setCount() { var t = BS.pad2(P.i + 1) + " / " + BS.pad2(P.list.length); P.root.querySelector(".pl-count").textContent = t; BS.nav.label(P.nav, t); }
    setCount();

    function nav(dir) {
      var n = P.i + dir;
      if (n < 0 || n >= P.list.length) return;
      P.i = n; var it = P.list[n]; P.item = it; P.origin = null;
      BS.animate(frame, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(" + (-40 * dir) + "px) scale(.97)" }], { duration: 220, easing: "ease-in", fill: "forwards" }).done.then(function () {
        video.pause(); video.poster = it.poster || ""; video.src = it.src; title.textContent = it.title || ""; sub.textContent = it.meta || "";
        dur.textContent = "0:00"; fill.style.transform = "scaleX(0)"; knob.style.left = "0%"; setCount();
        var pr = video.play(); pr && pr.catch(function () {});
        frame.getAnimations().forEach(function (a) { a.cancel(); });
        BS.animate(frame, [{ opacity: 0, transform: "translateX(" + (40 * dir) + "px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: BS.springs.soft.easing, fill: "none" });
      });
    }

    /* open animation (FLIP from the card) */
    BS.animate(bg, [{ opacity: 0 }, { opacity: 1 }], { duration: 450, fill: "forwards" });
    [bar, top].forEach(function (n, k) { BS.animate(n, [{ opacity: 0, transform: k ? "translateY(-16px)" : "translateY(30px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 260, easing: BS.springs.soft.easing, fill: "backwards" }); });
    requestAnimationFrame(function () {
      var fr = frame.getBoundingClientRect(), o = origin && origin.getBoundingClientRect();
      if (o && o.width > 4 && !BS.reduced()) {
        frame.style.transformOrigin = "0 0";
        BS.animate(frame, [{ transform: "translate(" + (o.left - fr.left) + "px," + (o.top - fr.top) + "px) scale(" + (o.width / fr.width) + "," + (o.height / fr.height) + ")", borderRadius: "32px" }, { transform: "none", borderRadius: "28px" }], { duration: 760, easing: BS.springs.soft.easing, fill: "none" });
      } else BS.animate(frame, [{ opacity: 0, transform: "scale(.92)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: BS.springs.soft.easing, fill: "none" });
      var pr = video.play(); pr && pr.catch(function () { setPlayingUI(); });
      wake();
    });

    async function close() {
      if (!P || P.closing) return;
      var s = P; s.closing = true;
      document.removeEventListener("keydown", s.key, true); document.removeEventListener("fullscreenchange", s.fsChange); BS.popEsc(s.esc); s.nav && BS.nav.pop(s.nav);
      if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (e) {} await BS.sleep(120); }
      video.pause(); clearTimeout(s.idleT);
      root.classList.remove("idle"); root.classList.add("closing");
      BS.animate(bar, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }); BS.animate(top, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      var o = s.origin && document.body.contains(s.origin) && s.origin.getBoundingClientRect();
      var fr = frame.getBoundingClientRect(), a;
      if (o && o.width > 4 && o.bottom > 0 && o.top < window.innerHeight && !BS.reduced()) {
        frame.style.transformOrigin = "0 0";
        a = BS.animate(frame, [{ transform: "none" }, { transform: "translate(" + (o.left - fr.left) + "px," + (o.top - fr.top) + "px) scale(" + (o.width / fr.width) + "," + (o.height / fr.height) + ")" }], { duration: 480, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" });
      } else a = BS.animate(frame, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.94)" }], { duration: 300, fill: "forwards" });
      BS.animate(bg, [{ opacity: 1 }, { opacity: 0 }], { duration: 440, delay: 40, fill: "forwards" });
      await a.done; await BS.sleep(60);
      video.removeAttribute("src"); video.load();
      root.remove(); if (P === s) P = null;
    }
    P.close = close;
  }

  BS.player = { open: open, isOpen: function () { return !!P; }, close: function () { P && P.close(); } };
})();
