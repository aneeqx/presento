"use strict";
// Reads pixel dimensions from the file header only (PNG, JPEG, GIF, WebP). Never decodes or touches the pixels.
const fs = require("fs");

function imageSizeBuffer(buf) {
  if (buf.length >= 24 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length >= 10 && buf.slice(0, 3).toString("latin1") === "GIF") return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf.length >= 30 && buf.slice(0, 4).toString("latin1") === "RIFF" && buf.slice(8, 12).toString("latin1") === "WEBP") {
    const t = buf.slice(12, 16).toString("latin1");
    if (t === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (t === "VP8L") { const b = buf.readUInt32LE(21); return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) }; }
    if (t === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let pos = 2;
    while (pos + 9 < buf.length) {
      if (buf[pos] !== 0xff) { pos++; continue; }
      const m = buf[pos + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { pos += 2; continue; }
      const len = buf.readUInt16BE(pos + 2);
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(pos + 5), w: buf.readUInt16BE(pos + 7) };
      pos += 2 + len;
    }
  }
  return null;
}

/** Pixel size from the header only (first 8 MB at most). */
function imageSize(file) {
  const fd = fs.openSync(file, "r");
  try {
    const n = Math.min(fs.fstatSync(fd).size, 8 << 20), buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, 0);
    return imageSizeBuffer(buf);
  } finally { fs.closeSync(fd); }
}

module.exports = { imageSize, imageSizeBuffer };
