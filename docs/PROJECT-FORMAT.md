# Project format (`project.json`, version 1)

A project is a plain folder:

```
my-presentation/
  project.json        the whole structure, settings and look
  media/              every file the presentation uses (byte-identical originals)
    brand/…  renders/…  films/…        (any sub-folders; names are free)
```

Everything in `project.json` that points at a file is a **project-relative path starting with `media/`** (forward slashes).
Media is never re-encoded: thumbnails and posters are separate files used only for grids. `core/compile` copies files unchanged.

Section and item order is the array order. A section may also carry a numeric `order`; when present, sections sort by it (ties: array order).
`hidden: true` on a section, sub-section or item keeps it in the project but leaves it out of every build.

## Top level

| key | type | notes |
|---|---|---|
| `format` | `"presentation-project"` | required |
| `version` | `1` | bumped on breaking changes; `core/project.js → migrate()` upgrades older files |
| `id` | string | slug, informational |
| `name` | string | the presentation's name: window/tab title, logo wordmark fallback, exe product name |
| `settings` | object | see below |
| `look` | object | see below |
| `sections` | array | unlimited |

## `sections[]`

A section is **either a leaf** (it has `type` + `items`/`social`) **or a parent** (it has `children[]`, each child a leaf).
Two levels only; the number of sections and of children is unlimited.

| key | type | notes |
|---|---|---|
| `id` | string | `[a-z0-9][a-z0-9_-]*`, unique. Reserved: `home`, `contact`, `attract` |
| `title` | string | landing-panel name and page title |
| `eyebrow` | string | small label on the page; default `NN — <type label>` |
| `blurb` | string | page text under the title |
| `tileBlurb` | string | text on the landing panel (default: `blurb`) |
| `icon` | string | an icon id from the viewer's Line set (`BS.icon.names`, e.g. `secStills`, `secAnimations`, `secProptech`, `secGraphics`, `image`, `film`, `view360`, `phone`); unknown → `grid` |
| `hidden` | bool | |
| `order` | number | optional |
| `cover` | `{kind:"image"\|"video", file, poster?, start?}` | landing-panel media (video loops from `start`). Default: first item |
| `defaultSub` | string | child id opened first |
| `type` | page type | leaf only: `gallery` `films` `panoramas` `flipbook` `social` `links` |
| `items` | array | leaf only (all types except `social`) |
| `social` | object | leaf only, type `social` |
| `children` | array | parent only; each child has `id`, `title`, `blurb?`, `icon?`, `hidden?`, `type`, `items`/`social` |

With one leaf the page shows no chips; with several, each child becomes a chip.

### Items

Common keys: `title`, `caption` (alias for films: `desc`), `meta` (small grey line, e.g. `1:07 · 1080p`), `hidden`.

| page type | item keys |
|---|---|
| `gallery` | `file`, `thumb?` (grid-only JPG), `w`,`h` (pixels; read from the file header when omitted), `crop?`, `cropFile?` |
| `films` | `file`, `poster`, `start?`, `end?` (seconds, playback trim) |
| `panoramas` | `id?`, `file` (flat 2:1 image), `thumb?`, `view360?` (true = also offer the 360° view), `focus?` (`"50% 55%"`), `yaw?`, `pitch?`, `hfov?` |
| `flipbook` | `id`, `title`, `meta`, `subtitle`, `pages[]` (page images, first = cover), `aspect`, `toc?[{title,page,level?}]`, `links?`, `settings?` (passed to the optional flipbook engine add-on unchanged) |
| `links` | `title`, `file` (card image), `url` |
| `social` (leaf `social` object) | `profile{username,name,category,avatar,bio[],link,verified,stats{followers,following,posts?}}`, `highlights[{id,title,cover,stories[{src,time}]}]`, `posts[{id,images[],caption,likes,time,location?,comments[]}]` |

**Trim (`start`/`end`).** Seconds into the file. Playback starts at `start`, stops at `end`, the scrub bar and the time readout cover only that range, replay restarts at `start`, and the hover preview loops inside it. The file is never touched. `end` must be greater than `start`; both only apply to `films`.

**Crop.** `crop` is the editing record `{x,y,w,h}` as fractions 0–1 of the original. The viewer never crops at runtime: `cropFile` must point at a lossless PNG copy rendered from it (the Presento editor does this and keeps the original in `file`). A `crop` without `cropFile` is a validation error. When `cropFile` is set it is what the viewer shows; set `cropW`/`cropH` (its pixel size) so the grid lays out before it loads.

## `settings`

```jsonc
{
  "brand":   { "wordmark": ["Example","Studio"], "logo": "media/brand/logo.svg", "tagline": "…", "taglines": ["Innovative","Immersive","Creative"] },
  "intro":   { "enabled": true, "video": "media/brand/intro.mp4", "handoff": 2.7 },   // enabled:false = no intro; no video = CSS wordmark intro
  "background": { "videos": [{"file":"media/…/a.mp4"}], "start": 10, "look": {"gray":1,"dim":0.42} },   // landing/attract loop; none = no attract screen
  "transition": {"out":420,"in":1300,"stagger":55,"overlap":160},  // ms, optional
  "motion":  {"scale":1.6},                                         // optional
  "loader":  {"rate":1.8,"start":0.4,"end":2.0,"hold":120,"scale":0.66,"showAt":260},   // page-change logo loader, optional
  "startGate": true,                                                // "Click to start" screen (needed for fullscreen)
  "idleReturnMinutes": 0,                                           // 0 = off; after N idle minutes return to the landing page
  "panelsDemo": false,                                              // touch: idle focus-shift demo, or {idle:20, step:3.5}
  "contact": { "heading":"…", "subline":"…", "items":[{"label":"Phone","value":"+92 …","href":"tel:+92…"}] }
}
```

The logo file and intro video are only ever referenced, never edited or re-encoded.

## `look` (all optional; `null` = the viewer default)

| key | meaning | CSS it sets |
|---|---|---|
| `bg` | page background colour (`#rrggbb`) | `--page-bg` |
| `accent` | accent / highlight colour | `--mint` |
| `font` | font family name. `Urbanist` and `DM Sans` ship with the viewer; any other name falls back to system fonts unless installed on the viewing PC | `--font` |
| `logoSize` | multiplier (0.3–3), 1 = default | `--logo-fs`, `--logo-h` (desktop and touch bases) |
| `panelHeight` | landing panel height, % of the screen (20–100) | `--pn-h` |
| `panelGap` | gap between panels, px (0–80) | `--pn-gap` |
| `labelShadow` | shadow strength behind panel labels (0–3, 1 = default) | `--lbl-sh` |

The compiler writes only the non-null tokens to `css/look.css`. Known limit: a few glows still use the default accent colour as a literal (`rgba(47,237,151,…)`); changing `accent` recolours the main fills and highlights, not every glow.

## Landing layout for N sections

* 1–6 sections: one row of vertical panels; the hovered/pressed panel widens (the default look).
* 7+ sections: two rows of equal panels, hover lifts a panel without resizing the row. The design lead's spec replaces this later; it is one function in `runtime/js/sections/home.js` plus `.bento.wrap` in `pages.css`.

## Compiler output (`core/compile.js`)

`compile(projectDir, {mode, include})` returns a virtual file list: runtime files, a generated `index.html` (title = `name`), `css/look.css`, `content/data.js` (`window.STUDIO_DATA`, version 2) and every referenced media file at `content/media/<path under media/>`. For `view360` panoramas it also generates `content/media/_pano/<id>.js` (a data-URL script, needed because WebGL refuses `file://` images).

* `mode`: `desktop` (pointer), `touch`, or `auto` → `config.input`.
* `include`: `null` = everything, or a list of `"sectionId"` / `"sectionId/childId"` to keep.
* Errors (missing media, bad ids, bad trim/crop, bad colours) throw before anything is written; warnings (no cover, no image size) are returned.

`data.js` v2 shape: `{version:2, brand, config, contact, home:{tiles:[{id,title,blurb,icon,preview}]}, sections:[{id,title,eyebrow,blurb,defaultSub?,subs:[{id,title,blurb?,type,items|social}]}]}`.

## Additions (editors round)
* `look.ink` (hex): text/icon/hairline colour. A light ink makes the viewer a dark theme ("Night": `bg #0B1F22`, `ink #F6F3EC`): glass and solid surfaces turn faint white and the flipbook desk darkens. `look.buttons`: `pill` (default) / `round` (16 px) / `square` (4 px). `look.font` also accepts `Inter` and `Source Serif 4` (bundled, OFL, licences in `licenses/`; Latin only, other scripts use the system font).
* `settings.intro.allowSkip` (default on; `false` disables tap/key skip). `settings.brand.rotateSeconds` (3–20; absent/0 = all taglines shown together as before, otherwise one at a time with a 600 ms cross-fade).
* `panoramas` items: `caption` (shown in the lightbox instead of `meta`), `autoRotate: false` (default on, as before), `yaw`/`pitch`/`hfov` set the 360 start view.
* `flipbook` items: `thumbs[]` (grid/strip JPEGs parallel to `pages[]`), `pdf` (source PDF, kept untouched; not exported), `links` (`{"<page>":[{x,y,w,h,url|to}]}`, fractions of the page, top-left origin, pages 1-based), `toc`, `settings` (`binding soft|hard`, `layout auto|single|spread`, `cover`, `thumbs`, `toc`, `links`, `startOpen`, hard cover: `cloth`, `foil gold|silver|copper`, `corners`, `coverTitle`, `coverSubtitle`).
* The project file may carry a top-level `studio` object (`{wallpaper:"follow"}`) for the app itself; the compiler ignores it.
