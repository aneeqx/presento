# SPEC-APP — Presento Phase 1 (design direction E · Glass bento, approved by the product owner)

Windows desktop app, single user. Presento has its **own** design language and never borrows the presentation's (ivory / teal / mint, Line icons). Nothing of Presento appears in an export.
Mockups: `mockups/app.html?s=<screen>` (one file, 15 screens, `&acc=lime` for the lime accent). Screenshots: `screenshots/app-<screen>.png` (1600 × 940). Direction history: `directions/` (A–E). Presentation landing for 5–12 sections: `SPEC-LANDING-N.md`.

> **Status.** All screens below were rendered in headless Chrome as static states and looked at. Motion, drag, real window resizing, real blur performance, and any window narrower than 1600 px are **not** verified. The accent is orange; lime is a one-variable switch. The QR code in the share sheet is a placeholder pattern, not a real code.

## 1 · The look

| | |
|---|---|
| **Surface** | Every panel is frosted glass over a **wallpaper**: the project's cover image (or a chosen image / plain colour), blurred 46 px, brightness .62, saturation 1.15, with a dark vertical wash and a soft accent glow top-right. The wallpaper changes with the project, and optionally cross-fades to the selected item (600 ms, `--ease`). Always keep the dark wash: if the blurred image is too light (mean luminance > 0.45), darken further so white text stays ≥ 4.5 : 1. *Not tested on very bright or busy images.* |
| **Cards** | Glass `rgba(24,20,19,.46)` + 1 px `rgba(255,255,255,.11)` edge + backdrop blur 30 / saturate 1.5 + inner top highlight. Radii: outer cards **30**, rail 34, inner blocks 20, controls pill / 14–16. Gap between cards **12**, window padding 12. |
| **Accent** | One colour: **light magenta `#B8447C`** (ink on it `#FFF0F6`), a lighter tone of the logo magenta (changed from orange `#FF8A2B`, see `SPEC-TOKENS.md`). Used only for: selected tile outline, the active rail item, primary slider fill, toggles (on), trim handles, progress, focus. Lime `#C6F135` is the same role if preferred. **The accent never follows the wallpaper.** |
| **Neutrals** | text `#F3EEE9`, muted 62 %, hairline 10 %, selection / “white” controls `#FFFFFF` on `#161212` (Export, Open, active segment, selected row, selected type). |
| **Status** | success `#9BE8BD` on a 14 % tint, warning `#FFC36B` on a 12 % tint, error `#FF7A5C` (coral red) on a 12 % tint. Never mint / pink for status, and never the accent for an error: errors always carry the warning icon and a word. |
| **Type** | Space Grotesk (UI, titles: 300 for page titles, 400 / 500 for labels) + Space Mono (all numbers, timecodes, file names, section labels, 11–12 px, lowercase). Scale: 11 mono label · 12.5 meta · 13.5 body · 15 buttons / rows · 22 card title · 28–32 dialog / empty-state title · 52 hero title. Weights 300–600 only. |
| **Icons** | Presento's own set: 1.55 px hairline, round caps and joins, 24 grid, one **solid accent node** on the key point (the “datum”). No fills except the half-disc of `swatch`. 21 px in the rail, 18 px in rows, 15 px in pills, ≥ 14 px anywhere. Active icon: node and stroke flip to the ink colour on an accent or white disc. Full set to date is in `mockups/app.js` (`IC`, ~45 icons); `directions/dir.js` holds the original 10. |
| **Motion** | One easing: `cubic-bezier(.22,1,.36,1)`. Hover / colour 250–350 ms. Geometry (re-tiling, panel open / close, FLIP list moves) 450–650 ms. No bounce, no overshoot. Reduced motion: fades only. See §7. |

## 2 · Shell and navigation (every project screen)

```
┌rail┐ ┌ top bar (pill) ────────────────────────────────────────────────┐
│    │ │ ‹ ● Project   |  Screen title · status  |  Desktop/Touch  size  Preview  Export │
│ P  │ └─────────────────────────────────────────────────────────────────┘
│ ▢  │ ┌ structure ┐ ┌ centre (hero / media / form / preview) ┐ ┌ inspector cards ┐
│ ▣  │ │ landing   │ │                                       │ │ stacked glass   │
│ ⚙  │ │ sections  │ │                                       │ │ cards           │
│ ▤  │ │ + sub     │ └───────────────────────────────────────┘ └─────────────────┘
│ ⌗  │ └───────────┘
│ ≋  │
│ ▷  │
└────┘
```

- **Rail (68 px, left, pill):** logo mark; **Projects**, **Content**, **Look**, **Settings**, **Design** (Phase 2 slot, small dot = “soon”); bottom: **Share** (network), **Preview**. Active item = accent disc.
- **Top bar (56 px, pill):** back (to Projects), project name with accent dot, centre capsule with the current page + status (“saved · 2 min ago”, “importing 104 files”), right: Desktop / Touch segment, screen size menu, **Preview**, **Export** (white pill, the one primary action).
- **Left card = structure** on Content / Look: *Landing* row (“6 + 1 hidden”), then sections (icon, name, item count, eye), sub-sections indented 34 px with a hairline guide, **+ Section / + Sub** pills at the bottom. Selected row = white pill with ink text and an accent icon node. Hidden = 42 % opacity with a crossed-out eye. **Drag to reorder:** the dragged row lifts (white, −1.2°, +10 px, big shadow, grip visible) and an accent insertion line with a dot marks the gap (`app-section.png`). **Hide / unhide:** the eye. **Rename:** double-click or in the inspector. Delete: inspector, with confirm.
- **Centre** depends on the page (below). **Right column** is a stack of glass cards (never one tall panel), each with a mono label and a tag.
- **Settings** swaps the left card for a presentation nav; **Look** keeps structure and adds the live preview.
- **Design (Phase 2)**: a workspace of its own (`app-design.png`): layers (left), canvas (centre, dot grid, artboard), design properties (right). In Phase 1 the three windows are ghosted (50 %) behind a “Phase 2 · Design studio” card. The shell needs **no change** for Phase 2: it swaps the three cards.
- **Command launcher (`ctrl k`)**, see `directions/d-launcher-dark.png` for the idea: fuzzy search over sections, items and actions (“trim teaser”, “export · single .exe”, “share on network”). It is a Phase 1 nice-to-have, not mocked in E.
- **Window:** must work on a laptop screen. Minimum **1280 × 720** (a 1366 × 768 or 1920 × 1080 laptop at 125–150 % scaling). Below about 1500 px wide the right column collapses into tabs inside one card, and the structure card can fold to icons. *(Decided by the product owner: laptop is the smallest target. The collapsed layout is not designed or rendered yet; the mockups are 1600 × 940.)*

## 3 · Screens

### 3.1 Projects home — `app-home.png`
- **Continue** hero (wide card, project cover, name 52 / 300, mono meta: edited, sections, items, size, last export) with **Open** (white) and **Duplicate**.
- **Start from** card: *Starter template*, *Blank presentation*, *Open existing folder* (a project is a plain folder, `project.json` + media).
- Recent projects as cards with the project's cover as a thumbnail, name, “5 sections · 3 days ago”; a dashed **New project** tile. Hover: card lifts 3 px, image scales 1.04 (1.2 s). “⋯” menu on each card: Open · Duplicate · Show in folder · Rename · Delete (confirm, “moves to Recycle Bin”).
- Top bar: search (“ctrl k”), Open folder, New project.

### 3.2 Content · section page — `app-section.png`
- Centre card: title, filter segment (**All / Warnings n / Hidden**), **Import**; below a slim drop strip (“Drop files or folders · originals are copied untouched”), then a 4-column grid of 4:3 tiles: thumbnail, duration or type badge top-right, title under, a warning badge (“⚠ check”) top-left where relevant, **+ Add item** tile. Selected tile = 2 px accent outline + soft glow. Whole centre is a drop target; during a drag it gets an accent glow ring.
- Right column: **Section** (name, landing blurb, icon picker of 12 Line-set-style glyphs), **Page type** (Gallery · Films · Panoramas · Flipbook · Social · Links), **Landing card** (cover image / loop, Show on landing, Include in export).

### 3.3 Media grid states
- **Empty** — `app-empty.png`: large dashed drop area with a white disc, “Drop files here”, one sentence on what happens, **Browse files** and **Import folder**, format chips (JPG · PNG, TIF → lossless PNG, MP4 · MOV · WEBM, PDF → flipbook, up to 4K · no limit). Inspector warns when the section is hidden and empty. Note how the wallpaper changed with the section's image.
- **Importing** — `app-importing.png`: a progress card (“Importing 38 of 104”, speed, time left, current file, byte-identical check on) with Pause / Cancel; tiles appear as they finish; in progress = blurred poster with a progress ring and %; queued = shimmer skeleton; warnings appear on the tile and in **needs attention** (right): *villa-walkthrough.mov — HEVC plays only where a codec is installed [Keep] [Remove]*, *intro-old.avi — not supported [Remove]*, *render-final.psd — unsupported, skipped [Dismiss]*. **Import log** card: copied, thumbnails, posters, TIF → PNG, fast-start fixed, originals verified identical. Unsupported files are never silently dropped.

### 3.4 Video item — `app-video.png`
- **Hero** card: the real video frame, 16 : 9, letterboxed on the blurred poster; a floating tool pill (**Trim · Crop · Hide · Link · Delete**) at the top right; timecode and resolution badges.
- **Trim timeline** under the video: filmstrip, the playing range outlined in the accent, **two pill handles** (start / end), a white playhead, ticks. Outside the range is dimmed and greyscale. Handles and playhead follow the pointer 1 : 1. Keyboard: `[` / `]` set start / end at the playhead, `,` `.` step a frame.
- Right: **trim · no re-encode** (start, end, plays — mono numerals, editable, a dual slider), **properties** (title, caption, show in presentation), **file** (chips: *original untouched*, *fast-start fixed*, codec, resolution, size; cover frame, order; **Use frame as cover**).
- The media strip below the hero is the section's items (selected = outlined) with the drop tile first.
- Nothing is re-encoded: the player seeks. The file stays byte-identical; the UI must always say so.

### 3.5 Crop dialog — `app-crop.png`
Modal over the blurred project. Large image with a crop rectangle (rule-of-thirds lines, **accent L-shaped corner handles**, edge pill handles), everything outside dimmed. Right: **aspect** (Free · Original · 16:9 · 4:3 · 1:1 · 9:16), **result** size (“3,034 × 1,707 · 79 % of the original width”), a note “Saved as a lossless PNG copy. The original stays in the project and can be restored”, **Replace in section** toggle, Rotate. Footer: Reset · Cancel · **Save crop**. Warn if the result is below 1080p.

### 3.6 Settings — `app-settings.png`
Left nav: **Intro video · Taglines · Landing background · Contact page · Behaviour**. Centre cards: *Intro video* (poster, replace, play on start, allow skip, loader uses intro), *Taglines* (reorderable list with grip, add, delete, rotate-every slider), *Contact page* (heading, lines, logo). Right: **live preview** of the contact page (rendered with the presentation's real fonts and colours) and **behaviour** (idle return, attract screen).

### 3.7 Look (basic) — `app-look.png`
Centre: the real viewer in a device frame (Landing / Section page / Contact tabs), updating live; below, **preset** cards (Ivory · Mint current, Night, Sand, Mono). Right cards: **colour** (background swatches + hex, accent swatches + hex), **type** (Urbanist / DM Sans / Inter / Serif chips), **size & space** sliders (logo size, panel height, panel spacing, label shadow) + button style segment (Pill / Round / Square), **reset**. These map to the viewer's existing tokens, so they are safe. The full studio is Phase 2.

### 3.8 Preview — `app-preview.png`
Full-window: the live viewer in a bezel (exactly what is exported). Controls: Desktop / Touch, size menu (1080p, 4K scaled, projector, tablet 1180 × 820), Fit 100 %, Restart, Close (`esc`). Touch mode emulates touch input.

### 3.9 Export
Opened by **Export**. Glass dialog, 1120 px:
- **Format** (3 big rows with an icon disc, a sentence, and the size estimate): **Single .exe** (recommended), **Single HTML**, **ZIP · HTML + assets**. Selected = accent border and disc.
- **Viewer:** Desktop / Touch. **PIN:** toggle + four boxes (focused box has the accent ring). Always show the honest note: *the PIN keeps casual viewers out; it is not real security (10,000 combinations); the .exe is encrypted, HTML / ZIP are readable*.
- **Include:** the structure with ticks and a size per section / sub-section (hidden sections are unticked and dimmed). Footer: big size estimate + “about n min on this PC”, Cancel, **Export**.
- **HTML limits** — `app-export-html.png`: estimate turns error-coloured and the row says “too large”; a red alert explains (“browsers fail above about 1 GB, warn from 300 MB”); **Export is disabled above 1 GB**. Between 300 MB and 1 GB: amber alert, Export enabled.
- **Progress** — `app-export-progress.png`: big % numeral, bar, a steps list (Collect media · Build viewer · Pack and encrypt · Check the result) with the current file and bytes, Cancel export.
- **Check report** — `app-export-report.png`: file name and path with **Show in folder** / **Copy path**; four checks (*all files present*, *resolutions intact*, *no tool traces — “Presento” not found in n files*, *opens without errors*) each with what was measured; notes in amber (e.g. an HEVC video); **Open a test run**, **Done**. A failed check is red and blocks the “Done” (it offers Re-run / Show details).

### 3.10 Share on network — `app-share.png`
Popover above the rail's Share button: master toggle, the **URL** with Copy, a QR (so a tablet can join), the network adapter menu, Require PIN, **watching now** (devices with last-seen), a note (“stops when you close Presento; not reachable from the internet”), firewall status chip, **Stop sharing**. While sharing, the rail icon shows the accent and the top bar shows a small “sharing · 2 watching” chip.

## 4 · Components (build bot)

Glass card · tag chip · pill button (default / white primary / accent / ghost, 34–46 px) · segment (white active) · toggle (accent on, 42 × 24) · slider (3 px track, accent range, 16 px white knob) · field (14 px radius, mono label above) · swatch / picker · tile (4 : 3, 18 px radius) · progress bar (8 px, accent) and ring · alert (info / warning / error) · dialog (34 px radius, scrim blur 8) · popover · tree row · filmstrip with handles. All in `mockups/app.css` / `app-extra.css`; names there are working names only.

## 5 · States to cover in code
Hover (lift 3 px, tile image scale) · pressed (scale .97) · focus (2 px accent ring, 3 px offset, also on keyboard nav) · selected · disabled (35 % opacity) · drag-over (accent glow ring on the drop target) · dragging (lifted row / tile) · loading (shimmer) · error · empty · long names (ellipsis, full name in a tooltip).

## 6 · Accessibility and limits
Text on glass ≥ 4.5 : 1 through the dark wash (§1); never convey status by colour alone (icon + word); every action reachable by keyboard; min target 34 px (pills) in this mouse-driven app. Phase 1 does not support touch input *in Presento itself*.

## 7 · Motion spec
- Page changes re-tile the cards (FLIP, stagger 40 ms): never a cut.
- Selection: the outline glides 350 ms. Tree reorder: other rows glide to make the gap.
- Dialogs: scrim fades 250 ms, dialog rises 12 px over 450 ms.
- Wallpaper cross-fade 600 ms. Progress bars ease; numerals tick without animation.
- Hover motion only on pointer devices; reduced motion → opacity only.
*Described, not proven: nothing was timed or recorded.*

## 8 · Decisions and open items
**Decided by the product owner:** accent changed from orange to light magenta `#B8447C` (the product owner, round 6) (lime stays a one-variable alternative); wallpaper following the selected item is an **option, off by default**; smallest target is a laptop screen (§2); direction E approved.
**Open:**
1. ~~Laptop layout~~ **designed and rendered** in `SPEC-EDITORS.md` §5 (`screenshots/editors/lap-*.png`).
2. **Command launcher (`ctrl k`)**: a search box that opens over the app so you can type an action (“trim teaser”, “export”, “share”) or jump to a section or file instead of clicking. the product owner did not know it; recommendation: **not in Phase 1**, add later (it is one extra screen, no layout impact).
3. The “P” in the rail and the QR in the share sheet are placeholders.
