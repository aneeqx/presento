# Presento logo: usage

Chosen direction: **extruded Brute P**. A solid slab P on a solid magenta extrusion. The name "Presento" is internal; the logo only lives inside the app (rail, window/taskbar icon, installer, Start menu), never in an exported presentation.

## Colours (exact)

| Role | Value | Notes |
|------|-------|-------|
| Magenta (extrusion, "o" counter, P counter) | **`#FF3D7F`** · rgb(255, 61, 127) | The only brand colour in the mark. |
| Paper (P face and wordmark on dark) | `#F3EEE9` | Same as the app's text colour. |
| Ink (P face and wordmark on light) | `#161212` | |
| App-icon tile gradient | `#2A2321` → `#120F0E` (top to bottom), 1 px white edge at 16 % | Flat `#1B1615` in the hand-hinted 16-32 px icons. |

Magenta stays `#FF3D7F` on both dark and light backgrounds. Do not tint or recolour it per theme. If Presento's UI accent becomes a lighter tone of this magenta, the logo keeps `#FF3D7F`.

## Files

SVG (plain paths only, no masks, no live text, no filters, no external fonts):

| File | Use |
|------|-----|
| `mark.svg` | P mark on dark backgrounds (paper face, magenta extrusion) |
| `mark-on-light.svg` | P mark on light backgrounds (ink face) |
| `mark-mono-white.svg`, `mark-mono-black.svg` | one-ink version: a gap replaces the colour step between face and extrusion. Use only where one colour is mandatory (emboss, fax-like output). |
| `wordmark.svg`, `wordmark-on-light.svg`, `wordmark-mono-*.svg` | "Presento" in Space Grotesk 600 (the app's own typeface), converted to outline paths so no font is needed; the "o" counter is magenta (an empty hole in mono) |
| `lockup.svg`, `lockup-on-light.svg`, `lockup-mono-*.svg` | mark and wordmark side by side |
| `app-icon.svg` | rounded dark tile with the mark (256 grid), for the installer and Start menu |

PNG (`png/`): mark 512/1024 (dark, light, mono), wordmark 1600, lockup 1600, app icon at 16, 20, 24, 32, 40, 48, 64, 128, 256, 512, 1024. All transparent backgrounds.

`presento.ico`: sizes 16, 20, 24, 32, 40, 48, 64, 128, 256, each stored as PNG.
- **16, 20, 24 and 32 px are hand-hinted**: every edge sits on a whole pixel, the extrusion is a pixel staircase, and only the tile corners are anti-aliased. Compare `hinting-proof.png` (hinted vs plain scaled, 8× nearest).
- 40 px and up are drawn from the vector geometry.
- Read back and verified: all nine sizes are present.

## Rules

- **Clear space:** at least the width of the P's stem (16 units of the 64 grid, a quarter of the mark's width) on all sides.
- **Minimum size:** the mark alone 16 px (use the hinted icon, never scale the SVG down to 16); the lockup 96 px wide; the wordmark alone 80 px wide.
- **Rail:** use the mark (`mark.svg`) at about 28 px inside the 44 px glass disc, as in the round 1 boards. Not the app-icon tile inside a disc.
- **Never:** recolour the extrusion, rotate or skew the mark (the oblique extrusion is part of the shape), add a drop shadow, place the paper-face mark on a light background, or retype the wordmark (use the SVG; the letters are outlines of Space Grotesk 600, spacing as in the font).
- Geometry: face `13,7 → 45,39` bowl and stem on a 64 grid, extrusion offset (6, 6). The build script `build.py` regenerates everything (`uv run --with shapely --with pillow --with fonttools --with brotli python build.py`).

## Not done

- Not wired into the app (the build bot does that).
- Windows rendering of the `.ico` in the real taskbar and Start menu was not checked; the sizes were verified by reading the `.ico` file back, not in the shell.
