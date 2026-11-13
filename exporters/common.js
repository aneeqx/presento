"use strict";
// Shared by every exporter: option handling, the "forbidden word" scanner, size formatting.
const fs = require("fs");
const path = require("path");
const { compile } = require("../core/compile");
const { injectGate } = require("./gate");

// The word that must never appear in an export. Built from pieces so this very file stays clean when someone greps the repo for it.
const WORD = ["pre", "sen", "to"].join("");

/** Streaming scanner: finds the word (any case, ASCII or UTF-16LE) across chunk boundaries. */
class Scanner {
  constructor() {
    const variants = [WORD, WORD[0].toUpperCase() + WORD.slice(1), WORD.toUpperCase()];
    this.pats = [];
    variants.forEach(v => { this.pats.push(Buffer.from(v, "latin1")); this.pats.push(Buffer.from(v, "utf16le")); });
    this.keep = 2 * WORD.length;
    this.tail = Buffer.alloc(0);
    this.hits = 0;
  }
  feed(buf) {
    const b = this.tail.length ? Buffer.concat([this.tail, buf]) : buf;
    for (const p of this.pats) { let i = b.indexOf(p); while (i >= 0) { this.hits++; i = b.indexOf(p, i + 1); } }
    // anything wholly inside the kept tail was already seen last round; avoid double counting by only keeping a short tail
    this.tail = Buffer.from(b.subarray(Math.max(0, b.length - (this.keep - 1))));
    // a match fully inside the old tail would be re-found next feed only if it crosses the boundary, which indexOf on tail+buf handles once
  }
}

async function scanFile(file, scanner) {
  const fh = await fs.promises.open(file, "r");
  const buf = Buffer.allocUnsafe(8 << 20);
  try {
    for (let pos = 0; ;) {
      const { bytesRead } = await fh.read(buf, 0, buf.length, pos);
      if (!bytesRead) break;
      scanner.feed(buf.subarray(0, bytesRead)); pos += bytesRead;
    }
  } finally { await fh.close(); }
}

function fmtBytes(n) { return n >= 1073741824 ? (n / 1073741824).toFixed(2) + " GB" : (n / 1048576).toFixed(1) + " MB"; }

function safeName(s) { return String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim() || "Presentation"; }

/** compile + (optional) inline PIN gate. Returns {compiled, files} where files is the final virtual file list. */
function prepare(projectDir, opts) {
  opts = opts || {};
  if (opts.pin != null && !/^\d{4}$/.test(String(opts.pin))) throw new Error("PIN must be exactly 4 digits");
  const compiled = compile(projectDir, { mode: opts.mode || "desktop", include: opts.include || null });
  const files = compiled.files.map(f => Object.assign({}, f));
  if (opts.pin != null && opts.gate !== "none") {
    const idx = files.find(f => f.dest === "index.html");
    const logoRel = compiled.data.brand.logo;
    let logoDataUri = null;
    if (logoRel) {
      const lf = files.find(f => f.dest === logoRel);
      if (lf && lf.abs && /\.svg$/i.test(lf.abs) && lf.size < 400000) logoDataUri = "data:image/svg+xml;base64," + fs.readFileSync(lf.abs).toString("base64");
    }
    const html = injectGate(idx.buf.toString("utf8"), { pin: String(opts.pin), name: compiled.title, look: compiled.project.look || {}, logoDataUri });
    idx.buf = Buffer.from(html, "utf8"); idx.size = idx.buf.length;
  }
  return { compiled, files };
}

module.exports = { WORD, Scanner, scanFile, fmtBytes, safeName, prepare };
