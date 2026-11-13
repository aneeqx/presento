/* Shell: logo renderer, glass bar, landing intro (logo animation → dock), global keyboard, fullscreen */
(function () {
  "use strict";
  var el = BS.el;
  var shell = BS.shell = {};
  var logoEl, backBtn, crumbEl, homeBtn, fsBtn, finishBtn, restartBtn;

  /* wordmark (or image logo from data.js). split=true wraps each letter for the intro animation */
  BS.renderLogo = function (c, split) {
    var b = BS.data.brand || {};
    c.innerHTML = "";
    if (b.logo) { c.appendChild(el("img", { src: b.logo, alt: b.name || "", draggable: "false" })); return; }
    c.appendChild(el("i.lg-orb"));
    var w = b.wordmark || [b.name || "Presentation", ""];
    [["lg-a", w[0]], ["lg-b", w[1]]].forEach(function (p) {
      var s = el("span." + p[0]);
      if (split) p[1].split("").forEach(function (ch) { s.appendChild(el("span.lg-ch", { text: ch })); });
      else s.textContent = p[1];
      c.appendChild(s);
    });
  };

  /* ONE navigation bar for every page and overlay (SPEC-R7 §2). Zones never move: Back (L) · logo (C) · label + Home + Fullscreen (R).
     Overlays push an entry: Back then closes the overlay, the label slot shows its counter / title, Home hides, the bar turns dark if asked. */
  var navStack = [], pageId = "home", pageText = "";
  function setLabel(text) {
    if (!crumbEl) return;
    if (crumbEl.textContent === text) return;
    BS.animate(crumbEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).done.then(function () {
      crumbEl.textContent = text;
      BS.animate(crumbEl, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: BS.motion.out, fill: "forwards" });
    });
  }
  function paintNav() {
    var top = navStack[navStack.length - 1];
    // R12: every bar button stays visible on every page (fixed positions); ones with nowhere to go are just disabled
    backBtn.classList.remove("hide"); backBtn.disabled = !top && pageId === "home";
    homeBtn.style.visibility = ""; homeBtn.disabled = !!top || pageId === "home";
    if (finishBtn) { finishBtn.style.visibility = ""; finishBtn.disabled = !top && pageId === "contact"; finishBtn.classList.toggle("mint", !!(top && top.dark)); }
    BS.$("#bar").classList.toggle("on-dark", !!(top && top.dark)); document.body.classList.toggle("nav-dark", !!(top && top.dark));
    setLabel(top ? (top.label || "") : pageText);
  }
  BS.nav = {
    push: function (o) { var h = { label: o.label || "", onBack: o.onBack, dark: o.dark !== false }; navStack.push(h); paintNav(); return h; },
    pop: function (h) { var i = navStack.indexOf(h); if (i >= 0) navStack.splice(i, 1); paintNav(); },
    label: function (h, t) { h.label = t; if (navStack[navStack.length - 1] === h) setLabel(t); }
  };
  shell.update = function (id, params, depth) {
    var def = BS.pages[id] || {};
    pageId = id; pageText = id === "home" ? "" : (def.crumb ? def.crumb(params) : def.title || id);
    paintNav();
  };

  function wireBar() {
    var oldBack = BS.$("#btn-back"); backBtn = BS.ui.pill("Back", "arrowLeft", "back light", { id: "btn-back", "aria-label": "Back" }); oldBack.replaceWith(backBtn);   // R12: labelled pill beside Finish
    backBtn.addEventListener("click", function () { var t = navStack[navStack.length - 1]; if (t && t.onBack) t.onBack(); else BS.router.back(); });
    crumbEl = BS.$("#crumb");
    var oldFin = BS.$("#btn-finish");
    finishBtn = BS.ui.pill("Finish", "tick", "finish", { id: "btn-finish", "aria-label": "Finish" });
    oldFin.replaceWith(finishBtn);
    finishBtn.addEventListener("click", async function () {                 // Finish -> Contact, through the normal page transition
      if (BS.router.busy) return;
      for (var n = 0; BS.escStack.length && n < 12; n++) { BS.escStack[BS.escStack.length - 1](); await BS.sleep(80); }
      if (n) await BS.sleep(700);
      BS.router.go("contact", {});
    });
    restartBtn = BS.$("#btn-restart"); restartBtn.innerHTML = BS.icon("replay");
    restartBtn.addEventListener("click", function () { location.reload(); });                 // restart the presentation from the gate
    homeBtn = BS.$("#btn-home"); homeBtn.innerHTML = BS.icon("home");
    homeBtn.addEventListener("click", function () { BS.router.home(); });
    fsBtn = BS.$("#btn-fs"); fsBtn.innerHTML = BS.icon("fullscreen");
    fsBtn.addEventListener("click", function () {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(function () {});
    });
    document.addEventListener("fullscreenchange", function () { fsBtn.innerHTML = BS.icon(document.fullscreenElement ? "exitFs" : "fullscreen"); });
    logoEl = BS.$("#logo");
    logoEl.addEventListener("click", function () { if (logoEl.classList.contains("clickable")) BS.router.home(); });
  }

  function wireKeys() {
    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target && e.target.tagName;
      if (t === "INPUT" || t === "TEXTAREA") return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (BS.escStack.length) BS.escStack[BS.escStack.length - 1]();
        else BS.router.back();
      } else if (BS.escStack.length) {
        return;                                    // an overlay is open: it owns the keyboard
      } else if (e.key === "Backspace") { e.preventDefault(); BS.router.back(); }
      else if (e.key === "Home") { BS.router.home(); }
      else if (e.key.indexOf("Arrow") === 0) {
        var cur = BS.router.current;
        if (cur && cur.def.onKey && !BS.router.busy) { if (cur.def.onKey(e, cur.root) !== false) e.preventDefault(); }
      }
    });
  }

  /* ------------------------------------------------------------------------------------------------
     OFFICIAL LOGO ANIMATION (content/brand/intro.mp4, 3840x2160, 4 s, byte-identical to the brand file)
     The landing intro plays it full-bleed (object-fit: contain), keyed onto the page (white -> multiply, see css #intro-video),
     then at config.intro.videoHandoff the real SVG logo fades in EXACTLY on top of the video's final lockup and the video fades out.
     Falls back to the CSS intro if the video errors, cannot autoplay or stalls; a click / tap / key skips.
     BOX = ink bounding box of the final lockup in the video frame (measured from the file's last frame: x 700-3137, y 899-1260 of 3840x2160). */
  var BOX = { x0: 700 / 3840, x1: 3137 / 3840, y0: 899 / 2160, y1: 1260 / 2160 };
  var STALL_MS = 1500;

  function videoOpts(cfg) {
    var ic = cfg.intro;
    if (!ic || typeof ic !== "object" || !ic.video) return null;
    return { video: ic.video, handoff: +ic.videoHandoff > 0 ? +ic.videoHandoff : 2.7, allowSkip: ic.allowSkip !== false };
  }

  /* rendered rect (viewport px) of the final lockup, given how the video is letter-boxed (contain) */
  function lockupRect(v) {
    var vw = window.innerWidth, vh = window.innerHeight, ar = (v.videoWidth && v.videoHeight) ? v.videoWidth / v.videoHeight : 16 / 9;
    var w = vw, h = vw / ar; if (h > vh) { h = vh; w = vh * ar; }
    var l = (vw - w) / 2, t = (vh - h) / 2;
    return { l: l + w * BOX.x0, t: t + h * BOX.y0, w: w * (BOX.x1 - BOX.x0), h: h * (BOX.y1 - BOX.y0) };
  }

  /* resolves {ok:true, S, top, left} once the SVG logo sits (visible) exactly on the video's lockup, or {ok:false} to fall back */
  function playIntroVideo(o, logoEl, logoImg) {
    return new Promise(function (resolve) {
      var v = el("video#intro-video", { muted: true, playsinline: true, preload: "auto", "aria-hidden": "true", tabindex: "-1" });
      v.muted = true; v.defaultMuted = true; v.disablePictureInPicture = true;
      var finished = false, skipped = false, lastT = -1, lastAdv = performance.now(), poll = 0, raf = 0;
      function cleanup() { clearInterval(poll); cancelAnimationFrame(raf); document.removeEventListener("keydown", onSkip, true); document.removeEventListener("pointerdown", onSkip, true); }
      function fail(why) { if (finished) return; finished = true; cleanup(); try { v.pause(); } catch (e) {} v.remove(); if (why) console.warn("intro video: " + why + " - using the CSS intro"); resolve({ ok: false }); }
      function onSkip() { if (!o.allowSkip) return; skipped = true; handoff(); }
      document.addEventListener("keydown", onSkip, true); document.addEventListener("pointerdown", onSkip, true);
      v.addEventListener("error", function () { fail("error"); });
      v.addEventListener("stalled", function () { /* the poll below decides */ });

      async function handoff() {
        if (finished) return; finished = true; cleanup();
        var r = lockupRect(v);
        logoEl.style.fontSize = "100px"; var pr = logoImg.getBoundingClientRect(), ar = pr.width / pr.height || 600.09 / 88.86;   // the rendered aspect (naturalWidth/Height are rounded for an SVG)
        var S = (r.w / ar) / 1.2;                                              // the <img> is 1.2em tall: width = r.w, height = r.w / aspect
        var top = r.t + r.h / 2, left = r.l + r.w / 2;
        logoEl.style.top = top + "px"; logoEl.style.left = left + "px"; logoEl.style.fontSize = S + "px";
        if (skipped) { logoImg.style.opacity = 1; v.remove(); resolve({ ok: true, S: S, top: top, left: left }); return; }
        /* SVG logo fades in over the (still playing, identical) lockup, then the video fades out underneath: ink coverage never dips */
        await BS.animate(logoImg, [{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: "ease-in-out", fill: "forwards" }).done;
        logoImg.style.opacity = 1; logoImg.getAnimations().forEach(function (a) { a.cancel(); });
        await BS.animate(v, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "ease-out", fill: "forwards" }).done;
        v.remove();
        resolve({ ok: true, S: S, top: top, left: left });
      }
      function tick() {
        if (finished) return;
        var dur = v.duration || 4, at = Math.min(o.handoff, Math.max(0.5, dur - 0.1));
        if (v.currentTime >= at || v.ended) { handoff(); return; }
        raf = requestAnimationFrame(tick);
      }
      poll = setInterval(function () {                                         // stall watchdog: no progress for STALL_MS (also covers "never started")
        var now = performance.now();
        if (v.currentTime !== lastT) { lastT = v.currentTime; lastAdv = now; }
        else if (now - lastAdv > STALL_MS && !v.ended) fail("no progress for " + STALL_MS + " ms");
      }, 250);
      v.src = o.video;
      document.body.appendChild(v);
      var p = v.play();
      if (p && p.catch) p.catch(function (e) { if (e && e.name === "AbortError") return; fail("autoplay refused (" + (e && e.name) + ")"); });      // AbortError = something paused it; the stall watchdog decides
      raf = requestAnimationFrame(tick);
    });
  }

  /* landing intro: the official logo animation (video) -> SVG logo handoff -> dock; CSS wordmark intro as the fallback */
  async function intro() {
    var cfg = BS.data.config || {};
    var fast = BS.reduced() || cfg.intro === false;
    BS.renderLogo(logoEl, true);
    var logoImg = BS.$("img", logoEl);                       // real logo (data.js brand.logo): animated only from the outside (clip-path / opacity / transform)
    if (logoImg && logoImg.decode) { try { await logoImg.decode(); } catch (e) { /* use whatever loaded */ } }
    var barMidY = parseFloat(getComputedStyle(logoEl).top) || 52;           // docked position = the CSS top (follows --bar-top / --bar-h in both input modes)
    var S = 0, startTop = "50%", startLeft = "50%";
    var vopts = fast ? null : videoOpts(cfg);
    if (logoImg) logoImg.style.opacity = 0;
    var vres = vopts && logoImg ? await playIntroVideo(vopts, logoEl, logoImg) : null;
    var viaVideo = !!(vres && vres.ok);
    var skipped = false, skipRes, skipP = new Promise(function (r) { skipRes = r; }), anims = [], orb = null, chars = [];
    if (viaVideo) { S = vres.S; startTop = vres.top + "px"; startLeft = vres.left + "px"; }
    else {
    var natural = logoEl.offsetWidth || 130;
    S = BS.clamp(23 * (window.innerWidth * 0.34 / natural), 60, 150);
    logoEl.style.top = "50%"; logoEl.style.fontSize = S + "px";
    orb = BS.$(".lg-orb", logoEl); chars = BS.$$(".lg-ch", logoEl);
    function skip() { if (cfg.intro && cfg.intro.allowSkip === false) return; skipped = true; skipRes(); }
    document.addEventListener("keydown", skip, { once: true }); document.addEventListener("pointerdown", skip, { once: true });
    function wait(ms) { return Promise.race([BS.sleep(fast ? 1 : ms), skipP]); }

    chars.forEach(function (c) { c.style.opacity = 0; });
    if (orb) orb.style.opacity = 0;
    if (logoImg) logoImg.style.opacity = 0;
    if (!fast && logoImg) {
      await wait(250);
      /* whole-logo reveal: a left-to-right clip-path wipe with a small rise; the artwork itself is never touched */
      anims.push(BS.animate(logoImg, [{ opacity: 0, clipPath: "inset(0 100% 0 0)", transform: "translateY(.28em) scale(.965)" }, { opacity: 1, clipPath: "inset(0 0% 0 0)", transform: "none" }], { duration: 1500, easing: "cubic-bezier(.22,.8,.2,1)", fill: "forwards" }));
      await wait(1500);
      if (!skipped) await wait(650);
    } else if (!fast) {
      await wait(250);
      if (orb) anims.push(BS.animate(orb, [{ opacity: 0, transform: "scale(0)" }, { opacity: 1, transform: "scale(1)" }], { duration: 900, easing: BS.springs.bouncy.easing, fill: "forwards" }));
      await wait(200);
      var sp = BS.springs.soft;
      chars.forEach(function (c, i) {
        anims.push(BS.animate(c, [{ opacity: 0, transform: "translateY(.55em) scale(.9)", filter: "blur(14px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 1100, delay: i * 55, easing: sp.easing, fill: "forwards" }));
      });
      await wait(1100 + chars.length * 55 * 0.5);
      if (!skipped) await wait(650);
    }
    anims.forEach(function (a) { try { a.finish(); } catch (e) {} });
    chars.forEach(function (c) { c.style.opacity = 1; c.getAnimations().forEach(function (a) { a.cancel(); }); });
    if (orb) { orb.style.opacity = 1; orb.getAnimations().forEach(function (a) { a.cancel(); }); }
    if (logoImg) { logoImg.style.opacity = 1; logoImg.getAnimations().forEach(function (a) { a.cancel(); }); }
    document.removeEventListener("keydown", skip); document.removeEventListener("pointerdown", skip);
    }

    AT.S = S; AT.top = startTop; AT.left = startLeft; AT.barTop = barMidY;
    if (!fast && cfg.attractScreen !== false) {                              // attract screen: logo stays centred, goes white over the greyed showreel; a tap enters the panels
      await attractShow(false);
      await waitTap();
      await attractLeave(true);
    } else {
      document.body.classList.remove("booting");
      await dockLogo(fast ? 1 : 1000);
      await BS.router.enter("home", {});
    }
    logoEl.classList.add("clickable");
  }

  /* ------------------------------------------------------------------------------------------------
     START GATE: fullscreen can only be requested from a user gesture, so the page opens on a minimal "Click / tap to start".
     config.startGate (default true); a fullscreen refusal never blocks the start. */
  function gate() {
    if ((BS.data.config || {}).startGate === false) return Promise.resolve();
    return new Promise(function (resolve) {
      var g = el("div#gate", { role: "button", tabindex: "0", "aria-label": "Start" }, el("span.gate-t", { text: BS.touch ? "Tap to start" : "Click to start" }));
      document.body.appendChild(g);
      function go(e) {
        if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
        document.removeEventListener("click", go, true); document.removeEventListener("keydown", go, true);
        var de = document.documentElement, fs = null;
        try { if (de.requestFullscreen && !document.fullscreenElement) fs = de.requestFullscreen(); } catch (err) { fs = null; }
        Promise.resolve(fs).catch(function () { /* denied: carry on */ }).then(function () { return BS.sleep(fs ? 450 : 0); }).then(function () {
          BS.animate(g, [{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: "forwards" }).done.then(function () { g.remove(); resolve(); });
        });
      }
      document.addEventListener("click", go, true); document.addEventListener("keydown", go, true);      // click = pointerup-based activation: valid for requestFullscreen with a finger too
    });
  }

  /* ------------------------------------------------------------------------------------------------
     ATTRACT SCREEN: full-bleed muted showreel loop (config.attractVideos, played back-to-back, next one preloaded), greyed with CSS filters
     (config.attractLook {gray, dim}); the logo (SVG, never edited) is turned white with a CSS filter. A tap/click/key goes to the panels.
     Kiosk idle-return comes back here. */
  var AT = { S: 0, top: "50%", left: "50%", barTop: 52, on: false, built: false, vids: null };
  var M = BS.motion;

  /* SPEC-R7 §4. Layers: ivory page (under) / .at-media (showreel, greyed with static CSS filters + vignette + flat dim) / logo (above: the unmodified SVG and a
     white copy of it made with a CSS filter, crossfaded by opacity) / hint. */
  function buildAttract() {
    if (AT.built) return; AT.built = true;
    var cfgs = BS.data.config || {}, list = cfgs.attractVideos || [];
    var root = el("div#attract", { "aria-hidden": "true" }), media = el("div.at-media");
    var hint = el("div.at-hint", el("i.at-dot"), el("span", { text: BS.touch ? "Tap to begin" : "Click to begin" }), el("b.at-rule"));
    if (list.length) {
      var mk = function () { var v = el("video", { muted: true, playsinline: true, preload: "auto", tabindex: "-1" }); v.muted = true; return v; };
      var A = mk(), B = mk(), cur = A, nxt = B, i = 0, swapping = false, n = list.length, ST = (cfgs.attractStart != null ? +cfgs.attractStart : 10);
      A.addEventListener("loadedmetadata", function () { if (i === 0 && A.currentTime < ST) A.currentTime = ST; }, { once: true });
      A.src = list[0]; if (n > 1) B.src = list[1]; else A.loop = true;
      media.appendChild(A); media.appendChild(B);
      AT.vids = {
        warm: function () { root.style.visibility = "visible"; if (cur.readyState >= 1 && cur.currentTime < ST) cur.currentTime = ST; cur.classList.add("on"); var p = cur.play(); p && p.catch(function () {}); },     // decoding + playing at opacity 0 before the crossfade
        ready: function () { return new Promise(function (r) { var t0 = performance.now(); (function chk() { if ((cur.readyState >= 3 && cur.currentTime > 0.05) || performance.now() - t0 > 2000) r(); else setTimeout(chk, 40); })(); }); },
        play: function () { cur.classList.add("on"); var p = cur.play(); p && p.catch(function () {}); },
        pause: function () { A.pause(); B.pause(); }
      };
      setInterval(function () {                                              // seamless hand-over: the preloaded next part starts just before this one ends
        if (!AT.on || n < 2 || swapping || !cur.duration || cur.currentTime < cur.duration - .25) return;
        swapping = true; nxt.currentTime = ((i + 1) % n === 0) ? ST : 0; var p = nxt.play(); p && p.catch(function () {}); nxt.classList.add("on");
        setTimeout(function () { cur.classList.remove("on"); cur.pause(); i = (i + 1) % n; cur.src = list[(i + 1) % n]; cur.load(); var t = cur; cur = nxt; nxt = t; swapping = false; }, 700);
      }, 100);
    }
    media.appendChild(el("div.at-vignette")); media.appendChild(el("div.at-dim"));
    var tag = el("div.at-tagline"), rot = +((BS.data.brand || {}).rotateSeconds) || 0, tl = (BS.data.brand || {}).taglines || [];
    if (rot > 0 && tl.length > 1) {                                           // one tagline at a time, 600 ms cross-fade, no movement; reduced motion shows the first and stops
      var one = el("span", { text: tl[0] }); tag.appendChild(one); var ti = 0;
      if (!BS.reduced()) setInterval(function () {
        if (!AT.on) return; ti = (ti + 1) % tl.length;
        var a = one.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }); a.onfinish = function () { one.textContent = tl[ti]; var b = one.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: "forwards" }); b.onfinish = function () { try { a.cancel(); b.cancel(); } catch (e) {} one.style.opacity = 1; }; };
      }, Math.max(3, rot) * 1000);
    } else BS.taglineParts().forEach(function (w) { tag.appendChild(el("span", { text: w })); tag.appendChild(document.createTextNode(" ")); });
    root.appendChild(media); root.appendChild(tag); root.appendChild(hint);
    AT.tag = tag;
    document.body.appendChild(root);
    AT.el = root; AT.media = media; AT.hint = hint;
  }

  /* the white logo copy (CSS filter on a second <img> of the same file; the SVG itself is never edited) */
  function whiteCopy() {
    var img = BS.$("img", logoEl); if (!img) return null;
    if (!AT.white) { AT.white = img.cloneNode(); AT.white.className = "logo-white"; AT.white.style.opacity = 0; logoEl.appendChild(AT.white); }
    return AT.white;
  }

  /* logo transform between "centred at video size" and "docked in the bar": one transform (translate + scale), no top/left/font-size animation */
  function cssNum(n, d) { var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)); return isFinite(v) ? v : d; }
  function dockVec() {                                                      // target = the docked box at the top-left (SPEC-R12 §2): left edge on --bar-edge, centre on --bar-top + --logo-h/2
    var r = logoEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var fs = cssNum("--logo-fs", 38), edge = cssNum("--bar-edge", 32), top = cssNum("--bar-top", 28), lh = cssNum("--logo-h", fs * 1.2), sc = fs / AT.S;
    return { dx: edge + r.width * sc / 2 - cx, dy: top + lh / 2 - cy, s: sc };
  }
  function tf(v) { return "translate(" + v.dx + "px," + v.dy + "px) translate(-50%,-50%) scale(" + v.s + ")"; }
  var TF0 = "translate(0px,0px) translate(-50%,-50%) scale(1)";

  async function attractShow(fromDocked) {
    buildAttract();
    var img = BS.$("img", logoEl), white = whiteCopy(), reduced = BS.reduced();
    logoEl.classList.remove("clickable", "docked"); document.body.classList.add("in-attract");
    AT.el.style.visibility = "visible"; AT.on = true; AT.el.style.opacity = 1;
    var T = reduced ? 1 : null;
    if (fromDocked) {                                                       // from the bar back to the centre
      logoEl.style.top = AT.top; logoEl.style.left = AT.left; logoEl.style.fontSize = AT.S + "px";
      var v = dockVec(); var mv = logoEl.animate([{ transform: tf(v) }, { transform: TF0 }], { duration: T || 1400, easing: M.soft, fill: "forwards" });
      mv.finished.then(function () { logoEl.style.transform = ""; mv.cancel(); });
    }
    AT.vids && await AT.vids.ready();                                      // already decoded + playing (opacity 0) before the crossfade starts
    AT.vids && AT.vids.play();
    // ONE moment: logo -> white and showreel in share start time, duration and easing
    var XD = 1400;
    var x1 = BS.animate(img, [{ opacity: 1 }, { opacity: 0 }], { duration: XD, easing: M.io, fill: "forwards" }).done;
    BS.animate(white, [{ opacity: 0 }, { opacity: 1 }], { duration: XD, easing: M.io, fill: "forwards" });
    var x2 = BS.animate(AT.media, [{ opacity: 0 }, { opacity: 1 }], { duration: XD, easing: M.io, fill: "forwards" }).done;
    // taglines: Innovative, Immersive & Creative reveal in sequence once the logo is white (+1000 ms), under the logo
    var lr = logoEl.getBoundingClientRect(); AT.tag.style.top = (lr.bottom + window.innerHeight * .034) + "px";
    BS.$$("span", AT.tag).forEach(function (w, i) { BS.animate(w, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 1200, delay: 1000 + i * 450, easing: M.soft, fill: "backwards" }); });
    AT.tag.style.opacity = 1;
    // step 3: hint (+2400, fade 800)
    var hx = BS.animate(AT.hint, [{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 2400, easing: M.out, fill: "forwards" });
    hx.done.then(function () { if (!AT.on) return; hx.cancel(); AT.hint.style.opacity = 1; AT.hint.classList.add("pulse"); });
    await Promise.all([x1, x2]);
  }

  function waitTap() {
    return new Promise(function (resolve) {
      var armed = false; setTimeout(function () { armed = true; }, 900);
      function go(e) {
        if (!armed || (e.type === "keydown" && (e.key === "Control" || e.key === "Shift" || e.key === "Alt"))) return;
        document.removeEventListener("pointerdown", go, true); document.removeEventListener("keydown", go, true); resolve();
      }
      document.addEventListener("pointerdown", go, true); document.addEventListener("keydown", go, true);
    });
  }

  /* plain dock for the no-attract path (reduced motion / intro:false): one transform */
  async function dockLogo(dur) {
    var v = dockVec(), dock = logoEl.animate([{ transform: TF0 }, { transform: tf(v) }], { duration: dur, easing: M.soft, fill: "forwards" });
    await dock.finished;
    logoEl.style.top = ""; logoEl.style.left = ""; logoEl.style.fontSize = ""; logoEl.style.transform = ""; dock.cancel(); logoEl.classList.add("docked");
  }

  /* exit: hint out, showreel out (ivory beneath), logo back to colour then docks, bar unfurls, panels rise */
  async function attractLeave(first) {
    var img = BS.$("img", logoEl), white = AT.white, bar = BS.$("#bar"), reduced = BS.reduced();
    AT.on = false; AT.hint.classList.remove("pulse"); AT.hint.style.opacity = "";
    BS.animate(AT.hint, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: "forwards" });
    BS.animate(AT.tag, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: "forwards" }).done.then(function () { AT.tag.style.opacity = 0; });
    var out = BS.animate(AT.media, [{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: M.io, fill: "forwards" }).done;
    if (img) BS.animate(img, [{ opacity: 0 }, { opacity: 1 }], { duration: 800, easing: M.io, fill: "forwards" });
    if (white) BS.animate(white, [{ opacity: 1 }, { opacity: 0 }], { duration: 800, easing: M.io, fill: "forwards" });
    await BS.sleep(reduced ? 1 : 800);
    var v = dockVec();
    var dock = logoEl.animate([{ transform: TF0 }, { transform: tf(v) }], { duration: reduced ? 1 : 1400, easing: M.soft, fill: "forwards" }).finished;
    bar.style.transition = "none"; document.body.classList.remove("booting"); document.body.classList.remove("in-attract");
    BS.animate(bar, [{ clipPath: "inset(0 38% 0 38% round 999px)", opacity: 0 }, { clipPath: "inset(0 0% 0 0% round 999px)", opacity: 1, offset: .4 }, { clipPath: "inset(0 0% 0 0% round 999px)", opacity: 1 }], { duration: 1100, delay: 200, easing: M.soft, fill: "backwards" });
    if (first) { BS.router.enter("home", {}); }
    await Promise.all([dock, out]);
    logoEl.style.top = ""; logoEl.style.left = ""; logoEl.style.fontSize = ""; logoEl.style.transform = ""; logoEl.getAnimations().forEach(function (a) { a.cancel(); }); logoEl.classList.add("docked");
    bar.style.transition = ""; AT.el.style.visibility = "hidden"; AT.vids && AT.vids.pause();
    if (img) { img.getAnimations().forEach(function (a) { a.cancel(); }); img.style.opacity = 1; }
    if (white) { white.getAnimations().forEach(function (a) { a.cancel(); }); white.style.opacity = 0; }
    logoEl.classList.add("clickable");
    if (first) await new Promise(function (r) { var t = setInterval(function () { if (!BS.router.busy) { clearInterval(t); r(); } }, 50); });
  }

  /* kiosk return: close overlays, go to the landing panels underneath, bring the attract screen back */
  shell.toAttract = async function () {
    if (AT.on || !AT.built) return;
    for (var n = 0; BS.escStack.length && n < 12; n++) { BS.escStack[BS.escStack.length - 1](); await BS.sleep(60); }
    await BS.sleep(400);
    var cur = BS.router.current; if (cur && cur.id !== "home") BS.router.home();
    await attractShow(true);
    await waitTap();
    await attractLeave(false);
  };

  /* kiosk option (config.kiosk.idleReturnMinutes, default 0 = off): no input for N minutes -> close any overlay and return to the landing page.
     A film that is playing in the player counts as activity. */
  function wireKiosk() {
    var mins = +((BS.data.config || {}).kiosk || {}).idleReturnMinutes || 0;
    if (!(mins > 0)) return;
    var t = 0;
    function reset() { clearTimeout(t); t = setTimeout(fire, mins * 60000); }
    async function fire() {
      var watching = BS.$$("#overlays video").some(function (v) { return !v.paused && !v.ended; });
      if (watching || BS.router.busy) { reset(); return; }
      for (var n = 0; BS.escStack.length && n < 12; n++) { BS.escStack[BS.escStack.length - 1](); await BS.sleep(60); }
      await BS.sleep(500);
      if (AT.built && (BS.data.config || {}).attractScreen !== false) { shell.toAttract(); reset(); return; }
      var cur = BS.router.current;
      if (cur && cur.id !== "home") BS.router.home();
      reset();
    }
    ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"].forEach(function (ev) { document.addEventListener(ev, reset, { capture: true, passive: true }); });
    reset();
    shell.kioskFire = fire;                                                      // (exposed for testing)
  }

  shell.start = async function () {
    /* SPEC-R7 §1.1: springs retired. Everything is critically damped (c >= 2*sqrt(k)): nothing overshoots */
    BS.springs.soft = BS.spring(100, 20); BS.springs.fly = BS.springs.soft; BS.springs.land = BS.springs.soft;
    BS.springs.dock = BS.spring(80, 18); BS.springs.bouncy = BS.springs.soft;
    document.documentElement.style.setProperty("--spring", BS.motion.soft);
    wireBar(); wireKeys();
    BS.router.init();
    await gate();
    if ((BS.data.config || {}).attractScreen !== false) { buildAttract(); AT.vids && AT.vids.warm(); }
    await intro();
    wireKiosk();
  };
})();
