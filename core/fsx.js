"use strict";
// Small fs helpers shared by the core modules (no dependencies).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function walk(dir, base) {
  base = base || dir;
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else if (e.isFile()) out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

function md5File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("md5");
    fs.createReadStream(file).on("data", d => h.update(d)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });
}

function mkdirp(d) { fs.mkdirSync(d, { recursive: true }); }

/** Byte-identical copy (streamed, no re-encode). */
function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

const MIME = {
  html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", json: "application/json",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", webm: "video/webm", m4v: "video/mp4", mov: "video/quicktime", woff2: "font/woff2", woff: "font/woff", txt: "text/plain; charset=utf-8", ico: "image/x-icon"
};
function mime(p) { return MIME[(p.split(".").pop() || "").toLowerCase()] || "application/octet-stream"; }

module.exports = { walk, md5File, mkdirp, copyFile, mime, MIME };
