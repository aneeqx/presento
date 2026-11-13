"use strict";
// Neutral test material, generated: gradient PNGs (no external media). make(dir) writes a small project covering every page type.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { saveProject, emptyProject } = require("../core/project");

function crc32(b) { return zlib.crc32(b) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
function png(w, h, hue) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3, t = x / w, u = y / h; raw[o] = (40 + 180 * t * (hue % 3 === 0 ? 1 : .3)) | 0; raw[o + 1] = (40 + 180 * u * (hue % 3 === 1 ? 1 : .4)) | 0; raw[o + 2] = (60 + 150 * (1 - t) * (hue % 3 === 2 ? 1 : .5)) | 0; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function write(dir, rel, w, h, hue) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, png(w, h, hue)); return rel; }

function make(dir, name) {
  fs.rmSync(dir, { recursive: true, force: true });
  const p = emptyProject(name || "Test Studio");
  p.settings.contact = { heading: "Get in touch", subline: "We would love to hear from you.", items: [{ label: "Email", value: "hello@example.com", href: "mailto:hello@example.com" }] };
  const gal = [0, 1, 2, 3, 4, 5].map(i => ({ file: write(dir, "media/gallery/g" + i + ".png", 640, 360, i), title: "Image " + (i + 1) }));
  const pan = [0, 1].map(i => ({ id: "pano-" + i, file: write(dir, "media/pano/p" + i + ".png", 1024, 512, i + 1), title: "Panorama " + (i + 1), meta: "Interior", view360: true, yaw: 30 * i, pitch: 5 }));
  const book = { id: "book", title: "Sample book", pages: [0, 1, 2].map(i => write(dir, "media/book/page" + i + ".png", 420, 594, i)), aspect: 0.7071, toc: [{ title: "Start", page: 1, level: 0 }], links: {}, settings: { binding: "soft" } };
  const link = [{ title: "Example site", file: write(dir, "media/links/l0.png", 640, 400, 2), url: "https://example.com" }];
  const cover = f => ({ kind: "image", file: f });
  p.sections.push({ id: "gallery", title: "Gallery", blurb: "Images", icon: "secStills", type: "gallery", cover: cover(gal[0].file), items: gal });
  p.sections.push({ id: "panoramas", title: "Panoramas", blurb: "360 views", icon: "secProptech", type: "panoramas", cover: cover(pan[0].file), items: pan });
  p.sections.push({ id: "book", title: "Brochure", blurb: "A flipbook", icon: "bookClosed", type: "flipbook", cover: cover(book.pages[0]), items: [book] });
  p.sections.push({ id: "links", title: "Links", blurb: "Web pages", icon: "grid", type: "links", cover: cover(link[0].file), items: link });
  saveProject(dir, p); return p;
}
module.exports = { make, png };
if (require.main === module) { make(process.argv[2] || path.join(require("os").tmpdir(), "presento-fixture")); console.log("fixture written"); }
