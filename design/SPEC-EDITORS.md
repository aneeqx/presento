# Presento · special editors, laptop layout, sizing rule (Phase 1, round 5)

Direction E, Glass bento. Same tokens, icons and components as `SPEC-APP.md`; only what is new is written here. Mockups: `mockups/app.html?s=<screen>` (code in `mockups/editors.js`, `editors.css`). Screenshots: `screenshots/editors/`. At 1600 × 940 unless the name says otherwise.

**How the mockups were checked:** every screenshot listed below was rendered in headless Chrome and looked at. Drag, drop, scrubbing and every hover/animation are **drawn, not working**: nothing was clicked or timed. The Social phone is a CSS look-alike of the viewer's phone (`phone.js`), not the real one; the build bot should mount the real viewer phone in the live preview (see 2.5).

## 0 · Where a page type lives

The **page type belongs to a section or a sub-section**, not only to a top-level section. In the a sample project: *Proptech* has subs *Sales Engine* (Links), *Panoramas*, *Videos*; *Graphics* has subs *Company Profiles* (Flipbook) and *Social Media* (Social). The structure card shows the page type name only in the page-type card on the right, never next to the row. An empty section offers the page-type card first (see `app-empty.png`); an imported PDF suggests **Flipbook**, a dropped set of 2:1 images suggests **Panoramas**.

Editors replace the **centre and right columns only**. The structure card, top bar, rail and export are unchanged.

---

## 1 · Flipbook (PDF → brochure) — `ed-flip-import.png`, `ed-flip.png`, `ed-flip-page.png`, `ed-flip-reimport.png`

The viewer reuses the optional flipbook engine add-on. The editor only writes its inputs: `pages[]`, `aspect`, `title`, `subtitle`, `meta`, `toc`, `links`, `settings`.

### 1.1 Import (drop a PDF)
- A PDF dropped on the section, or **Add PDF**, creates one book. The section can hold several books (switch with the small segment *Profile A · Capabilities* above the book).
- Each page is extracted to an image at 2× page size (A4 → 2480 × 3508 JPG, high quality). The PDF is copied into the project untouched, like every original.
- **Progress screen** (`ed-flip-import.png`): a card with the cover as soon as page 1 exists, file name, “8 pages · A4 portrait · 14.2 MB”, **Extracting pages**, a bar, “page 5 of 8 · about 12 s left”, **Cancel**. Below: the page strip fills in left to right (finished = image, current = blurred with the accent ring, waiting = shimmer “queued”). Title, cover and order are editable as soon as page 1 is done; the rest of the app stays usable.
- The right column shows **source pdf** (file, pages, size, weight, “text embedded, not selectable”) and **found in the pdf**: links and bookmarks are detected and become clickable areas (`links`) and the contents list (`toc`). The page-type card shows **Flipbook** selected.
- Errors, in words, with the file kept: *password protected* (ask for the password, never stored), *damaged*, *no pages*, *over 300 pages* (warn, allow).

### 1.2 Editing — `ed-flip.png`
- **Centre top, hero:** the real flipbook preview: an open spread (pages 2 – 3), soft spine shadow, a curl on the corner, arrows and “pages 2 – 3 of 8”. It flips like the viewer (the build bot mounts the actual book engine; the mock is a still). Tool pill: **Preview as flipbook** (on), **Link areas**, **Re-import**, **Delete book**.
- **Centre bottom, pages · drag to reorder:** thumbnails at the page ratio, number below, badges *cover* (page 1) and *back* (last), an accent badge with a link count on pages that have links. Selected = accent ring. Drag lifts the page (rotate −3°, shadow) and shows an accent drop line; neighbours glide. A dashed **+** tile adds an image page. Page 1 and the last page are the cover and back cover when *Cover page* is on.
- **Right column, one card with three tabs** (icon + word): **Book · Page n · Contents**, plus a small **source pdf** card (`Re-import PDF`, `Show` in folder).

**Book tab** (maps to the data):
| Control | Data | Notes |
|---|---|---|
| title | `title` | |
| subtitle | `subtitle` | |
| meta line | `meta` | default “n pages” (auto); typing replaces it; clearing returns to auto |
| binding: Soft cover / Hard cover | `settings.binding` | **Hard cover** adds, in the same tab: cloth colour (swatches + hex), foil (gold / silver / copper), corners (square / round), cover title and subtitle (`coverTitle`, `coverSubtitle`), material. *Not rendered in a mockup.* |
| pages shown: Auto / Single / Spread | `settings.layout` | |
| Cover page | `settings.cover` | helper line “page 1 is the cover, page 8 the back” |
| Thumbnails bar | `settings.thumbs` | |
| Contents button | `settings.toc` | disabled, with a hint, when the contents list is empty |
| Open on page 1 | `settings.startOpen` | |

**Page tab** (`ed-flip-page.png`): “page 3 of 8 · 2 clickable areas”; one row per area (*Link · address* or *Go to page 5 · What we do*) with **Edit**; **Draw a link area**. Drawing: drag a rectangle on the page in the hero, then choose *web address* or *go to page n*. The area shows as an accent rectangle with a label chip and a round resize handle; areas that jump to a page are dashed. A field “label (for screen readers)” and a toggle **Page is part of the book** (off = left out of the export; numbering updates).

**Contents tab:** draggable rows (grip, title, page chip `p.3`), one indent level for sub-entries (the viewer allows level 0 – 2; the editor offers 0 – 1 in Phase 1), **Add entry**, “from 5 pdf bookmarks”.

**Data shapes** (from the viewer, `flipbook.js` and `data.js`): `book = { title, subtitle, pages:[src | {src, thumb}], aspect?, toc?:[{title, page, level 0-2}], links?:{"<page>":[{x,y,w,h, url | to}]}, settings? }`. The coordinate system of `x,y,w,h` is the flipbook engine book's; the build bot must read it from `flipbook.js` and convert the drawn rectangle accordingly. *I did not verify whether the values are fractions or pixels.*

### 1.3 Re-import — `ed-flip-reimport.png`
Dialog 880 px. Header: file name, “10 pages · was 8”. Left, what changes (tick rows): **Pages replaced by position** (new pages added or removed at the end), **Keep contents and links** (an entry or area whose page still exists is kept; ones that moved are listed afterwards), **Keep my page order** (off = the PDF order wins). Right: *old → new* thumbnails for the first and last pages so the user sees what maps to what, and a warning that areas drawn on moved pages may now point at the wrong place. Footer: “the old PDF is kept until you save”, **Cancel**, **Re-import** (white). After the import the app opens the *Page* tab on the first page that has a moved link.

### 1.4 States
Empty (no PDF): the standard empty drop area, wording “Drop a PDF here · each page becomes an image”. Importing, ready, re-importing (progress as 1.1), failed (inline alert in the card with **Try again** and **Show details**).

---

## 2 · Social (Instagram look-alike) — `ed-social.png`, `ed-social-post.png`, `ed-social-hl.png`

Every field in `graphics.social` in `data.js` and everything `phone.js` renders is editable. The viewer shows the result in a clickable iPhone; the editor shows the **same phone live** on the right, in a card of its own (410 px column, phone at 78 %, a tag says what it is showing).

### 2.1 Layout (profile and grid) — `ed-social.png`
Columns: structure 300 · centre (two sub-columns) · **live preview 410**. Centre-left: **profile** and **highlights** cards. Centre-right: **posts** and a **selected post** summary.

**Profile card** → `profile`:
| Control | Field | Rules |
|---|---|---|
| avatar (disc with a small image button) | `avatar` | click = pick an image; round crop with drag to centre; shown with the ring like Instagram |
| name | `name` | shown bold under the counts |
| handle | `username` | shown at the top of the phone; no `@`, no spaces (stripped) |
| category | `category` | grey line under the name; optional |
| bio | `bio[]` | **one line per row** in the field = one entry in the array; blank lines dropped; shown up to 4 lines (more is allowed, with a note “long bios push the grid down”) |
| link | `link` | blue link line; plain text, not clickable in the viewer |
| Verified badge | `verified` | blue tick next to the handle |
| counts: posts / followers / following | `stats.posts`, `stats.followers`, `stats.following` | **posts is automatic** (= number of posts) until typed over; followers and following are free text so `128K`, `1.2M` and `4,200` all work |

**Highlights card** → `highlights[]`: circles with cover, title and “2 stories”; drag to reorder; the selected one has the accent ring; **New** (dashed) adds one. Click or double-click opens the highlight dialog (2.3). Order here is the order in the phone.

**Posts card** → `posts[]`: a 3-column square grid in the order shown on the profile (first = newest, top left). Each tile: thumbnail, number, and a *layers* badge with the image count for carousels. **Drag to reorder**: the tile lifts (rotate −4°, scale 1.04, shadow, white outline) and an accent bar marks the drop position; others glide. Select = accent ring and the summary card below shows likes, age and the first words of the caption, with **Edit post** and **Delete**. **Add post** accepts 1 – 10 images at once: one image = a single post, several images = one carousel (the dialog asks “one post or separate posts?”).

### 2.2 Post editor — `ed-social-post.png`
Opens in place of the centre columns (back arrow, “Post 1”, tag “carousel · 3 images”, **Delete**). Top card: the post's images as square thumbnails with a number, **drag to reorder**, first = grid thumbnail, selected = ring, **+** adds, hover shows a small remove × (an image can be swapped by dropping a file on it). Details card, 2 columns:
- **caption** (multi-line; hashtags and emoji are plain text) → `caption`
- **likes** → `likes` (text, so `4,218` or `12.4K`; the viewer adds 1 on a viewer's like when it is a plain number)
- **posted** → `time` (free text: “2 days ago”, “1 week ago”; shown upper-case in the phone)
- **location · optional** → `location`
- **comments** → `comments[]` `{user, text}`: one row each with the user in bold, the text, a remove ×; **Add**. The phone shows the first two and “View all n comments”.
The phone on the right switches to the **post view** scrolled to this post, so every field is seen in place. Carousel swipe and double-tap heart work in the preview exactly as in the viewer.

### 2.3 Highlight dialog — `ed-social-hl.png`
Glass dialog, 760 px: **cover** (round, drag to centre, **Change**), **title**, **stories** (portrait thumbnails 9 : 16, number badge, a small field under each for the age shown on it, `time`: “2h”, “1d”; drag to reorder; **+** adds). Footer: **Delete highlight** (error text colour, confirm), **Cancel**, **Done**.

### 2.4 Rules and limits
- Images are copied untouched and shown with `object-fit: cover`; posts are square in the viewer: the editor shows the crop and offers the crop dialog (1 : 1 preset) when an image is not square. Story images are 9 : 16.
- 1 – 10 images per post, up to 30 posts and 12 highlights as soft limits (warn, never block).
- Nothing here uses Instagram's name or assets; the viewer's look is generic. The phone is labelled “live preview” and never “Instagram”.

### 2.5 Build notes
Mount `BS.phone.create(socialData)` (the viewer's own phone module) in the right card and call it again on each change; do not re-implement it. The card scales the phone with `--ps` like `fit()` in `phone.js` (about .78 at 940 px height).

---

## 3 · Panoramas — `ed-pano.png`

Flat first: the viewer shows the **flat, unwrapped 2 : 1 image** and offers **View in 360°** as a button. The editor follows that.

- **Centre top, hero:** the whole flat image, 2 : 1, with degree marks 0° 90° 180° 270°, a dashed **horizon**, and a **start-view window** (white outline, centre cross, round accent grab handle). **Drag the window** anywhere: horizontal = yaw, vertical = pitch. The area outside the window is dimmed. Tag: “flat image · 2:1 · 8192 × 4096”. Tool pill: **Set start view** (on), **Crop**, **Hide**, **Delete**.
- **Centre bottom, panoramas:** wide cards (2.1 : 1 crop, 360° badge, title, label, “start yaw 40°”), selected = ring, dashed **Add panorama**. Drag to reorder.
- **Right, start view:** a small **360° preview** (what a visitor sees first). **Drag the picture** to look around (hint pill inside); the window in the hero follows. Numeric **yaw / pitch / zoom** (mono, accent for the two angles) and a **Zoom** slider = field of view (`hfov`, 60° – 120°, default 100°).
- **details:** title, label (Interior / Exterior / Custom…), caption (optional).
- **viewing:** **Offer “View in 360°”** (on = the editor prepares the extra file the viewer needs on `file://`, called `dataScript` in the data; off = no 360 button) and **Auto-rotate slowly** (stops when someone touches it).
- Grid crop (`focus`): the card crop in the grid is chosen by dragging a frame on a small thumbnail (2:1 → 2.1:1, mostly irrelevant, default `50% 55%`); put it behind a “Card crop” disclosure in the *details* card. *Not drawn.*

**Data:** `{ id, title, meta, image, dataScript?, thumb?, focus?, yaw, pitch, hfov }`. The editor writes `yaw` (−180 … 180), `pitch` (−90 … 90), `hfov`.

**Needs a viewer change (flag for the manager):** the viewer has **no caption and no auto-rotate field**. `meta` is currently what the lightbox shows as caption. Proposal: add `caption` (shown in the lightbox instead of `meta` when present) and `autoRotate` (boolean, default off; slow turn in the 360° view, stops on touch). Until then the editor shows label only and hides *Auto-rotate*.

**Import:** accepts JPG/PNG. Warn when the ratio is not 2 : 1 (“this is not a full panorama; it will be shown flat only”, and the 360° button is off) and when it is under 4096 px wide (“soft when viewed in 360°”).

---

## 4 · Links (Sales Engine style) — `ed-links.png`

Small variant of the media grid. Centre: cards with a 16 : 10 image, the title and a *link* icon; a corner chip **needs internet**; dashed **Add link**; a note: “each card opens its web address in a new window; the address is never shown to the viewer; these pages need internet where the presentation runs.” Right column, three cards:
- **link:** title, **web address** (mono) with **Test** (opens it in the browser and reports reachable / not; `https` chip), 
- **card image:** large preview, **Change**, a line “use a screenshot of the page; 16 : 10 works best”,
- toggles: **Show in presentation**; **Open inside the app window** (off = default browser). The second is *proposed*; the viewer today always uses a new window.

**Data:** `salesEngine: [{ title, image, url }]`. **Rules:** an address without `https://` is fixed on blur (`https://` added); `http://` is allowed with a warning chip; an empty address cannot be exported (error chip on the card).

---

## 5 · Laptop layout — `lap-1280x720.png`, `lap-1366x768.png`, `lap-fold-1280x720.png`

Answers Q5. Window minimum **1280 × 720**.

| Window width | Layout |
|---|---|
| ≥ 1500 | as in `SPEC-APP.md`: structure 300 · centre · right column 336 (the three-column bento) |
| 1280 – 1499 (**laptop**) | structure **232**, right column **300** and it becomes **one tabbed card**; media strip becomes a 104 px bar; top bar compacts |
| optional at any width | **Fold structure** (a chevron in the structure card header, remembered): the card narrows to a **76 px icon rail**: the section icons, the current one outlined white, and a round **+**. Names show as tooltips. |

**Tabbed right card** (the three cards of the desktop column merged, each tab = one of them): icon + word tabs, white active. Tabs follow the item type, always three: video **Trim · Item · Section**; image **Crop · Item · Section**; flipbook **Book · Page n · Contents**; social **Profile · Post · Highlights** (the phone preview moves under the centre card as a collapsible 280 px strip); panoramas **View · Details · Viewing**; links **Link · Image · Show**. The selected tab is remembered per item type. The first line of the card is the file name + a tag.

**Top bar** below 1500: crumb shortened (ellipsis at 140 px), centre shows only the section name, **“saved” becomes the green dot** next to the project name, Touch / Desktop stays a segment but **Touch becomes icon only**, the size pill **(1920×1080) moves into the Preview button's menu**, **Preview becomes icon only**, **Export keeps its word**. Nothing wraps; if the bar still does not fit, drop in this order: tag text, size pill, Touch label, Preview.

**Centre card:** the video hero shrinks by its own aspect (not cropped); the timeline strip height 34 px; ticks every 12 s. The media strip shows 7 thumbnails (96 × 60) with the drop tile first and scrolls sideways.

Not designed: heights below 700, 4K at 150 % (it is 1280-class, same layout), the touch-screen laptop case.

---

## 6 · Page-type buttons: sizing rule — `ed-types.png`

The reported clipping (1280 × 720, “Panoramas” cut at the card edge, see `screenshots/build/04-renders-imported-1280x720.png`) comes from a fixed two-column grid whose buttons keep their content width, so the **right column grows wider than its card**. Rule:

```css
.right            { grid-template-columns: minmax(0, 1fr); }   /* a column never grows with its content */
.right > *        { min-width: 0; }
.types            { display: grid; gap: 8px;
                    grid-template-columns: repeat(auto-fit, minmax(min(100%, 128px), 1fr)); }
.types > *        { min-width: 0; height: 44px; padding: 0 12px; gap: 9px;
                    display: flex; align-items: center; white-space: nowrap; }
.types .ic        { flex: none; }
```
- 128 px is the width of the longest label (“Panoramas”, 14 px, with its icon and padding). Fewer pixels than that and the grid drops a column, so the label is **never** cut and never gets an ellipsis.
- Result (rendered, `ed-types.png`): inner width 300 → 2 columns; 264 → 2 columns; 220 and below → 1 column; ≥ 400 → 3 columns.
- The same rule applies to every chip group (icon picker, aspect chips, fonts): `auto-fit` + a min that fits the longest label, `min-width: 0` on the parent.
- Test in the build: render the app at 1280 × 720 and 1366 × 768 and assert `scrollWidth <= clientWidth` on `.right` and every card.

---

## 7 · What is not designed or not viewed
Hard-cover options (cloth, foil, corners); flipbook link drawing as an interaction; the card-crop disclosure for panoramas; the social layout in the laptop tabs; the empty, error and importing states of Social, Panoramas and Links (use the standard ones from `SPEC-APP.md` §3.3); touch variants; every motion. `ed-flip-import.png` shows 8 pages only; a 100-page PDF needs the strip to wrap and scroll (it does in the CSS, not rendered).
