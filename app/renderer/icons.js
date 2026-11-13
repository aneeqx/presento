/* Presento icon set (design/mockups/app.js): hairline, round caps, one solid accent node */
window.PI = (function () {
  var R = function (x, y, w, h) { return "M" + x + " " + y + "h" + w + "v" + h + "h" + -w + "z"; };
  var C = function (cx, cy, r, cl) { return '<circle class="' + cl + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>'; };
  var P = function (cl, d) { return '<path class="' + cl + '" d="' + d + '"/>'; };
  var N = function (x, y) { return P("n", R(x - 1.2, y - 1.2, 2.4, 2.4)); };
  var IC = {
    folder: P("s", "M3 5.5h6.5l2 2.5H21v12H3z") + N(3, 5.5), plus: P("s", "M12 4v16M4 12h16") + N(12, 12),
    upload: P("s", "M12 3v13M6.5 8.5L12 3l5.5 5.5M3.5 15v5.5h17V15") + N(12, 16), export: P("s", "M12 3.5v13M6.5 9L12 3.5 17.5 9M3.5 15.5V21h17v-5.5") + N(12, 16),
    play: P("s", "M7 4.5v15L19.5 12z") + N(19.5, 12), trim: P("s", "M5 4v16M19 4v16M5 12h14") + N(5, 12) + N(19, 12), crop: P("s", "M7 2v15h15M2 7h15v15") + N(7, 17) + N(17, 7),
    eye: P("s", "M1.5 12L12 5l10.5 7L12 19z") + C(12, 12, 3.3, "s") + N(12, 12), eyeOff: P("s", "M1.5 12L12 5l10.5 7L12 19z") + C(12, 12, 3.3, "s") + P("s", "M4 20L20 4"),
    sliders: P("s", "M3 8h18M3 16h18") + P("sk", R(5.5, 5, 6, 6)) + P("sk", R(12.5, 13, 6, 6)), wifi: P("s", "M3 9.5a13 13 0 0 1 18 0M6.2 13a8.5 8.5 0 0 1 11.6 0M9.2 16.3a4 4 0 0 1 5.6 0") + N(12, 19.2),
    layout: P("s", R(3, 3, 18, 18) + "M3 9h18M9 9v12") + N(3, 3), image: P("s", R(3, 4, 18, 16) + "M3 17l6-6 4 4 3-3 5 5") + N(16.9, 8.5), film: P("s", R(3, 4, 18, 16) + "M10 8.5v7l6-3.5z") + N(16, 12),
    panorama: P("s", R(2, 6, 20, 12) + "M2 16l6-5 4 3.5 3-2.5 7 5") + N(16, 10), page: P("s", "M5 2.5h9.5L19 7v14.5H5zM14.5 2.5V7H19M8.5 13h7M8.5 17h5") + N(8.5, 8),
    link: P("s", "M8 6h10v10M18 6L6 18") + N(18, 6), trash: P("s", "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6") + N(12, 6), chev: P("s", "M7 10l5 5 5-5"),
    tick: P("s", "M4.5 12.5l5 5L19.5 7"), drop: P("s", "M12 4v12M7 11l5 5 5-5M4 20h16") + N(12, 20),
    close: P("s", "M6 6l12 12M18 6L6 18"), warning: P("s", "M12 3.5L21 20H3z") + P("s", "M12 10v5") + N(12, 17.6), copy: P("s", "M9 9h11v11H9zM5 15V4h11") + N(9, 9),
    mail: P("s", R(3, 5, 18, 14) + "M3 6l9 7 9-7") + N(12, 13), type: P("s", "M5 6h14M12 6v13M9 19h6") + N(12, 6), swatch: C(12, 12, 8.5, "s") + P("f", "M12 3.5A8.5 8.5 0 0 1 12 20.5z"),
    archive: P("s", R(3, 4, 18, 5) + "M5 9v11h14V9M10 13h4") + N(12, 13), app: P("s", R(3, 5, 18, 14) + "M3 9.5h18") + N(6, 7.3), code: P("s", "M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14") + N(12, 12),
    desktop: P("s", R(3, 4, 18, 12) + "M9 20h6M12 16v4") + N(12, 10), tablet: P("s", R(3, 5, 18, 14)) + N(17.5, 12), pencil: P("s", "M4 20l1-5L16 4l4 4L9 19zM13.5 6.5l4 4") + N(4.5, 19.5),
    clock: C(12, 12, 8.5, "s") + P("s", "M12 7v5l3.5 3.5") + N(12, 12), info: C(12, 12, 8.5, "s") + P("s", "M12 11.5v5") + N(12, 8), arrowRight: P("s", "M4 12h15M13 6l6 6-6 6") + N(4, 12),
    lock: P("s", R(5, 10, 14, 10) + "M8 10V7a4 4 0 0 1 8 0v3") + N(12, 15), more: N(5, 12) + N(12, 12) + N(19, 12), grip: [9, 15].map(function (x) { return [6, 12, 18].map(function (y) { return N(x, y); }).join(""); }).join(""),
    search: C(11, 11, 6.5, "s") + P("s", "M16 16l5 5") + N(11, 11)
  };
  return { IC: IC, ic: function (n, s) { return "<svg class=\"ic\" viewBox=\"0 0 24 24\" width=\"" + (s || 20) + "\" height=\"" + (s || 20) + "\">" + (IC[n] || "") + "</svg>"; } };
})();
