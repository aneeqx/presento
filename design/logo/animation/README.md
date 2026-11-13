# Presento launch splash

Flat 2D. One square pixel is stretched and pulled out into the P, then extruded in magenta, and the wordmark wipes in. Every pull is a loose spring (overshoots and wobbles, then settles), at 60 fps.

- `splash.html`: self-contained (CSS keyframes with `linear()` spring easing, inline SVG, no libraries, no text). Plays once on a dark page. `?loop=1` repeats for review (1 s pause), `?static=1` shows the final lockup, `?freeze=1` pauses for frame capture (`window.__seek(ms)`). `prefers-reduced-motion` shows the final logo with no motion. Scales to the window (about 72 % of the width).
- `presento-splash.mp4` (H.264) and `presento-splash.webm` (VP9): 1920x1080, 60 fps, 4.8 s of motion plus a 0.3 s hold.
- `contact-sheet.png`: 12 frames across the timeline.
- Regenerate: `uv run --with shapely --with pillow --with fonttools --with brotli python ../final/build.py`, then `python gen_splash.py`, then `uv run --with playwright --with pillow python capture.py`, then ffmpeg on `frames/`.

Timeline (ms): the face build is quick: 100 the pixel pops in (jelly) · 420 it widens · 700 it is stretched up into the stem · 1050 the whole bowl square is stretched out to the right · 1400 the square hole is punched through it · 1850 the extrusion is the slow part: pulled out along X (1850-2650), then along Y (2300-3100), each on a loose spring · 3100 the mark squashes and wobbles as the extrusion lands, then steps back from 1.9x to lockup size · 3300 the wordmark: each letter is pulled up from its baseline with a spring (fade-in plus stretch), 65 ms apart, and the counter of the o pops in last like the punched hole (4180) · 4800 end.

Notes: the build runs 1.9x larger and centred, then eases into the lockup position. Pieces hand over to the exact face outline at 2900 ms and the stacked extrusion layers to the exact swept shape at 3600 ms, both while static, so there is no visible jump. The last frame matches a separate static render apart from edge anti-aliasing (edge pixels differ by up to about 86/255, no change of shape or position).
