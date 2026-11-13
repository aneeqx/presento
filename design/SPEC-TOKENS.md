# Presento · colour tokens: accent change to light magenta (round 6)

**Change for the build bot (one line):** in the app theme set `--accent: #B8447C; --accent-ink: #FFF0F6;` (was `#FF8A2B` / `#1A0F05`), replace every literal `rgba(255,138,43,a)` with `rgba(184,68,124,a)`, set error to `#FF7A5C` (was `#FF9A88`, text on error tints `#FFB09C` was `#FFB5A8`), and use `--accent` instead of any literal orange. Nothing else changes.

| Token | Before | After | Why |
|---|---|---|---|
| `--accent` | `#FF8A2B` | **`#B8447C`** | a lighter tone of the logo magenta (the logo's own magenta stays as its designer set it; I had only the board `logo/concepts3/magenta-25.png`, not the final hex). Hue ≈ 331°. |
| `--accent-ink` | `#1A0F05` | **`#FFF0F6`** | dark aubergine, never pure black; ink on accent contrast ≈ 6 : 1 (computed from the hex values, not measured on screen) |
| accent glow / ring tints | `rgba(255,138,43,.09–.7)` | `rgba(184,68,124,…)` | same alphas |
| error | `#FF9A88` | **`#FF7A5C`** | salmon was too close to pink; the new coral red sits about 55° away in hue |
| error text on tint | `#FFB5A8` | `#FFB09C` | follows |
| warning `#FFC36B`, success `#9BE8BD` | | unchanged | amber and mint are far from pink |
| wallpaper top-right glow | orange 16 % | pink 16 % | follows the accent |
| avatar ring second stop | `#ffd29a` | `#E3A3C2` | follows |
| lime alternative `#C6F135` | | unchanged | still a one-variable swap |

**Where the accent is used** (unchanged): active rail disc, selected outline and ring, toggles (on), slider fill, trim handles, progress bars and spinner, checkbox fill, focus ring, drop line, hotspot areas, small “node” of every icon, badge chips.

**Rules that stop confusion with errors**
1. Error is never shown by colour alone: warning triangle + a word (“too large”, “failed”).
2. Error uses coral red `#FF7A5C` on a red tint; the accent is never used as text colour for a status.
3. An option can be both selected and in error (Single HTML, too large): the border is the error colour, the icon disc stays accent. Seen in `after-export-error.png`; the two read apart.

**Not done / not checked:** the lime variant was not re-rendered; pixel contrast was not measured with a tool; the Presento logo's real magenta was not available, so the accent is matched by eye to the board (`#B8447C` is lighter and slightly less saturated than the logo's pink). When the final hex lands in `design/logo/final/`, tell me and I will nudge the hue to match. The orange in the Look panel's *presentation* accent swatches (`#FF8A2B`) is a choice offered for the client presentation, not the app, and is deliberately unchanged.

Screenshots (before / after, 1600 × 940) in `screenshots/accent/`: `before-workspace.png` / `after-workspace.png`, `before-export.png` / `after-export.png`, `before-share.png` / `after-share.png`, plus `after-export-error.png` (accent next to error).
