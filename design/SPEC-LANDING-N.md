# SPEC-LANDING-N — presentation landing with 5–8 sections

Applies to the **presentation viewer** (and any exported presentation), so it uses the presentation's own design system (Urbanist, Ivory / Deep Teal / Mint, Line icons, tokens in `example-studio/design/DESIGN-SYSTEM.md` and `SPEC-R12.md`). It is not Presento's own UI.
Mockup: `mockups/landing.html?n=5..8&on=<index>&touch=0|1` (static, markup + CSS only). Screenshots: `screenshots/landing-<n>-<desktop|touch>-<rest|focus>.png` (n = 5, 6, 7, 8; desktop 1920×1080, touch 1180×820).

## 1 · Rule

| Sections | Layout | Title | Why |
|---|---|---|---|
| 1–4 | one row (today, SPEC-R12) | vertical | unchanged |
| **5** | **one row**, 5 cards (the first four squeeze to make room — *decided by the product owner*) | vertical | a 5th card still fits as a tall portrait card (342 × 626 at 1920; 223 × 476 touch) |
| **6** | **two rows, 3 + 3** | horizontal | a 6th card in one row is 283 px wide at 1920 and 170 px on touch; dimmed to 0.65× it would be 110 px, too narrow for chip + title |
| **7** | two rows, **4 + 3** (top row has more) | horizontal | |
| **8** | two rows, **4 + 4** | horizontal | |
| **9–12** | **two rows, always** (5+4, 5+5, 6+5, 6+6) | horizontal | *Decided by the product owner: two rows is the maximum.* Mocked at 9, 10, 12 (`screenshots/landing-9|10|12-*`). Density tokens for 9+: chip 46 (touch 44), icon 24 / 22, inset 18 / 14, title 22 / 19. At 12 sections on touch a dimmed card is 125 px wide: names of about 11+ characters truncate (“Social Med…” seen in the render), so keep names short or accept the ellipsis |

Rows are always full-bleed: both rows fill the content width edge to edge (no centred short row, no empty cell). In a 4 + 3 landing the bottom cards are therefore wider (583 vs 432 at 1920). Order is row-major (1 2 3 4 / 5 6 7).

## 2 · What stays the same (the "expanding feel")

- Same card recipe: radius `--r-xl` 32, shadow-1, flat 22 % dark tint on dimmed cards, pre-blurred layer (14 px, opacity only), chip top-left, glass label card bottom-left on the focused card, mint round CTA top-right, `--pn-gap` 20 (touch 16).
- Focus is still **2 : 0.65**. The focused card is 2 units wide; the other cards **in its row** are 0.65 units (`grid-template-columns: 2fr .65fr .65fr …`). Cards in the *other* row keep equal widths.
- Same timing: columns and rows transition on `--dur-l` 1100 ms, `--ease-soft`. Transform / opacity only for everything else, no overshoot.
- The media layer is fixed at the focused size and centred inside the card, so images never re-crop while the card grows (same trick as today).
- Frame: logo, bottom bar, and the cards all sit on the one `--edge` gutter; content area = between `--top` and `--bot`.

## 3 · What is new for two rows

**Rows resize too.** At rest both rows are equal. On focus the row holding the focused card takes **1.2fr** and the other row **0.8fr** (`grid-template-rows: 1.2fr .8fr`, or `.8fr 1.2fr`). So the card grows *and* gets taller, the same 2-axis expansion as one row, with the same 60 / 40 feel. Dimmed cards in the *focused* row are 88 % of the row height (the single-row version uses 74 %; two rows have less height to give), centred.

**Titles are horizontal** (cards are landscape, a vertical title would be a long thin strip): `--ttl` 26 px / 300 / −.03em (touch 24), bottom-left on the `--in` inset, with the count pill under it. On the focused card they are replaced by the glass label card (same as today). On dimmed cards the title stays, the count pill hides (as today).

**A stronger bottom scrim at rest.** Landscape photos put their bright areas behind the title, so the two-row cards use `linear-gradient(180deg, rgba(8,52,56,.10) 0, transparent 26%, rgba(8,52,56,.30) 52%, rgba(8,52,56,.78) 100%)` instead of today's 0 → .28. (First render had the title unreadable on the bright render; this value was checked on the 1920 render.)

## 4 · Numbers

Content area: 1920 × 1080 pointer → `--edge` 65, `--top` 142, `--bot` 135 → 1790 × 803. 1180 × 820 touch → `--edge` 44, `--top` 125, `--bot` 114 → 1092 × 581.

| | Rest card | Focused | Dimmed (same row) | Row heights rest → focus |
|---|---|---|---|---|
| **N=5** 1920 | 342 × 626 | 743 × 626 | 242 × 463 (74 %) | single row 626 |
| N=5 touch | 223 × 476 | 447 × 476 | 145 × 352 | single row 476 |
| **N=6** 1920 | 583 × 391 | 1060 × 470 | 345 × 413 (88 %) | 391 / 391 → 470 / 313 |
| N=6 touch | 353 × 282 | 642 × 339 | 209 × 298 | 282 / 282 → 339 / 226 |
| **N=8** 1920 | 432 × 391 | 876 × 470 | 285 × 413 | same row split |
| N=8 touch | 261 × 282 | 529 × 339 | 172 × 298 | same row split |

Density tokens (the chip and inset shrink with the card, so 5–8 never feel crammed):

| Token | N=4 (today) | N=5 | N=6–8 |
|---|---|---|---|
| `--chip` pointer / touch | 64 / 72 | 60 / 56 | 52 / 52 |
| `--ico` | 34 / 40 | 30 / 28 | 26 / 26 |
| `--in` (inset) | 28 | 24 / 20 | 22 / 18 |
| vertical title | 26 / 38 | 26 / 30 | — |
| horizontal title | — | — | 26 / 24 |

Touch targets: the whole card is the target (≥ 172 × 226 even at N=8). The mint CTA is 46 (touch 58).
Minimum dimmed width the chip + inset must fit: 145 (N=5 touch) ≥ 56 + 2 × 20 ✓; 172 (N=8 touch) ≥ 52 + 2 × 18 ✓.

## 5 · Behaviour

- **Pointer.** Hover focuses the card under the pointer; leaving the grid returns to rest.
  - **Hit-testing must use the *rest* geometry**, not the live one. Moving the pointer down from the top row, the rows resize under it (1.2 → .8) and the pointer would land on a different card mid-move and flicker. Put an invisible fixed grid of hit areas over the cards (built from the rest layout) and use that to decide focus; add a ~90 ms hover-intent delay before switching rows. *Not built or tested here: this is a design instruction for the bot.*
- **Touch.** Tap focuses (the same columns / rows animation), tap the focused card or its CTA opens. Assumes today's two-step behaviour; the bot should confirm it matches the current handler.
- **Keyboard / remote.** ← → move within a row, ↑ ↓ move to the card in the same column of the other row (clamped for the shorter row). Enter opens. Focus ring = 2 px mint, 3 px offset (unchanged).
- **Idle / attract screen:** unchanged, it returns the landing to rest.
- **Names.** Aim for ≤ 16 characters. Horizontal titles ellipsise on dimmed cards (285 px at N=8 pointer holds about 18 characters at 26 px; 172 px touch holds about 11, so "Sales Engine" is the longest that fits at 24 px). Presento should warn when a name exceeds 14 characters in a 7–8 section landing.
- **Hidden sections** do not count towards N.
- **Section icons** come from the section's chosen icon (Line set). Mockup uses `secStills secAnimations secProptech secGraphics phone cursor building film`.

## 6 · Implementation notes for the bot (markup / CSS)

- `.bento` gets `data-rows="1|2"` and `data-n`. Two rows = two `.row` children, each its own CSS grid; focus sets `data-on` on the card, and the parent sets `grid-template-columns` on its row and `grid-template-rows` on `.bento`. The reference markup and CSS are in `mockups/landing.html` (the `rows` / `cols` logic is a JS stand-in for the real focus handler).
- `.tile-media`: absolutely positioned at the **focused** card size (width = 2 units, height = 1.2 × row unit), centred, so the 1.2 / .8 row change never re-crops.
- Keep `transition` only on `grid-template-columns`, `grid-template-rows`, `height`, `opacity`. Everything else is static.
- Tokens: add `--pn-in`, `--pn-chip`, `--pn-ico`, `--ttl`, `--pn-h-off: 74 %` (one row) / `88 %` (two rows) per mode (set by `data-n` or by `.bento[data-rows]`).

## 7 · Not verified / open questions for the product owner

- **Verified:** static end states (rest, focused) for N = 5, 6, 7, 8 at 1920 × 1080 and 1180 × 820, rendered in headless Chrome. All 16 screenshots were produced; I looked at 6-desktop-rest and -focus, 5-desktop-focus, 5-touch-focus, 7-desktop-rest and 8-touch-focus (the other ten are the same code, not individually viewed). Images are posters, not live video.
- **Not verified:** the animation itself (rows and columns moving together), real touch, the hit-testing fix in §5, 4K, projector, long section names.
- **Decided (the product owner):** two rows is the maximum (no third row); 7 = 4 + 3 with the wider row at the bottom; 5 stays one row. 9–12 sections were mocked afterwards (rendered, 12-touch-focus and 9-desktop-focus viewed).
