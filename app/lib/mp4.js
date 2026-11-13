"use strict";
// MP4 / MOV container helpers (no decoding, never touches the media data):
//   probeMp4(file)            -> {duration, width, height, codec, fastStart}
//   makeFastStart(src, dest)  -> moves the 'moov' atom in front of 'mdat' (and shifts the chunk offsets) so the video starts playing before it is fully loaded.
//                                The media data is copied byte-for-byte; the result is verified by hashing the mdat payload on both sides.
const fs = require("fs");
const crypto = require("crypto");

function readAt(fd, pos, len) { const b = Buffer.alloc(len); const n = fs.readSync(fd, b, 0, len, pos); return n < len ? b.subarray(0, n) : b; }

/** Top-level atoms: [{type, start, size, hdr}] */
function atoms(fd, size, from, to) {
  const out = []; let pos = from || 0; const end = to == null ? size : to;
  while (pos + 8 <= end) {
    const h = readAt(fd, pos, 16); if (h.length < 8) break;
    let sz = h.readUInt32BE(0), hdr = 8; const type = h.toString("latin1", 4, 8);
    if (sz === 1) { sz = Number(h.readBigUInt64BE(8)); hdr = 16; } else if (sz === 0) sz = end - pos;
    if (sz < hdr || pos + sz > end + 0) { if (pos + sz > end) sz = end - pos; if (sz < hdr) break; }
    out.push({ type, start: pos, size: sz, hdr }); pos += sz;
  }
  return out;
}

function probeMp4(file) {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const top = atoms(fd, size);
    const moov = top.find(a => a.type === "moov"), mdat = top.find(a => a.type === "mdat");
    if (!moov || !top.find(a => a.type === "ftyp")) return null;
    const r = { fastStart: !!(mdat && moov.start < mdat.start), duration: 0, width: 0, height: 0, codec: "" };
    if (moov.size > 64 << 20) return r;
    const buf = readAt(fd, moov.start, moov.size);
    const find = (b, from, to, type) => { const o = []; let p = from; while (p + 8 <= to) { let s = b.readUInt32BE(p); const t = b.toString("latin1", p + 4, p + 8); if (s < 8) break; o.push({ t, p, s, h: 8 }); p += s; } return o.filter(x => x.t === type); };
    const mvhd = find(buf, 8, buf.length, "mvhd")[0];
    if (mvhd) { const v = buf[mvhd.p + 8]; if (v === 1) r.duration = Number(buf.readBigUInt64BE(mvhd.p + 32)) / buf.readUInt32BE(mvhd.p + 28); else r.duration = buf.readUInt32BE(mvhd.p + 24) / buf.readUInt32BE(mvhd.p + 20); }
    for (const trak of find(buf, 8, buf.length, "trak")) {
      const tkhd = find(buf, trak.p + 8, trak.p + trak.s, "tkhd")[0];
      const mdia = find(buf, trak.p + 8, trak.p + trak.s, "mdia")[0]; if (!mdia) continue;
      const minf = find(buf, mdia.p + 8, mdia.p + mdia.s, "minf")[0]; if (!minf) continue;
      const stbl = find(buf, minf.p + 8, minf.p + minf.s, "stbl")[0]; if (!stbl) continue;
      const stsd = find(buf, stbl.p + 8, stbl.p + stbl.s, "stsd")[0]; if (!stsd) continue;
      const fourcc = buf.toString("latin1", stsd.p + 8 + 8 + 8, stsd.p + 8 + 8 + 12);          // header 8 + version/flags 4 + entry count 4, then entry size 4 + type 4
      const t2 = buf.toString("latin1", stsd.p + 8 + 4 + 4 + 4, stsd.p + 8 + 4 + 4 + 8);
      if (/^(avc1|avc3|hvc1|hev1|vp09|av01|mp4v|apch|apcn|apcs|ap4h|ap4x)$/.test(t2)) {
        r.codec = t2;
        if (tkhd) { const v = buf[tkhd.p + 8]; const o = tkhd.p + 8 + (v === 1 ? 4 + 8 + 8 + 4 + 4 + 8 : 4 + 4 + 4 + 4 + 4 + 4) + 8 + 8 + 36; r.width = buf.readUInt32BE(o) / 65536; r.height = buf.readUInt32BE(o + 4) / 65536; }
      }
    }
    return r;
  } finally { fs.closeSync(fd); }
}

function hashRange(fd, start, len) {
  const h = crypto.createHash("md5"), buf = Buffer.allocUnsafe(8 << 20);
  for (let p = 0; p < len;) { const n = fs.readSync(fd, buf, 0, Math.min(buf.length, len - p), start + p); if (!n) break; h.update(buf.subarray(0, n)); p += n; }
  return h.digest("hex");
}

/** Returns {fixed:boolean, reason?}. When fixed, dest holds the fast-start file; otherwise nothing is written. */
function makeFastStart(src, dest) {
  const fd = fs.openSync(src, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const top = atoms(fd, size);
    const ftyp = top.find(a => a.type === "ftyp"), moov = top.find(a => a.type === "moov"), mdat = top.find(a => a.type === "mdat");
    if (!ftyp || !moov || !mdat) return { fixed: false, reason: "not an mp4 container" };
    if (moov.start < mdat.start) return { fixed: false, reason: "already fast-start" };
    if (size > 0xFFFFFFFF - moov.size) return { fixed: false, reason: "file over 4 GB: left as is" };
    if (moov.size > 256 << 20) return { fixed: false, reason: "index too large" };
    const moovBuf = Buffer.from(readAt(fd, moov.start, moov.size));
    const shift = moov.size;
    let patched = 0, ok = true;
    (function walk(from, to) {
      let p = from;
      while (p + 8 <= to) {
        let s = moovBuf.readUInt32BE(p); const t = moovBuf.toString("latin1", p + 4, p + 8);
        if (s < 8 || p + s > to) break;
        if (t === "trak" || t === "mdia" || t === "minf" || t === "stbl") walk(p + 8, p + s);
        else if (t === "stco") { const n = moovBuf.readUInt32BE(p + 12); for (let i = 0; i < n; i++) { const o = p + 16 + i * 4, v = moovBuf.readUInt32BE(o) + shift; if (v > 0xFFFFFFFF) ok = false; else moovBuf.writeUInt32BE(v, o); } patched += n; }
        else if (t === "co64") { const n = moovBuf.readUInt32BE(p + 12); for (let i = 0; i < n; i++) { const o = p + 16 + i * 8; moovBuf.writeBigUInt64BE(moovBuf.readBigUInt64BE(o) + BigInt(shift), o); } patched += n; }
        p += s;
      }
    })(8, moovBuf.length);
    if (!ok || !patched) return { fixed: false, reason: "chunk offsets could not be shifted" };
    const out = fs.openSync(dest, "w");
    try {
      const copy = (start, len) => { const b = Buffer.allocUnsafe(8 << 20); for (let p = 0; p < len;) { const n = fs.readSync(fd, b, 0, Math.min(b.length, len - p), start + p); if (!n) throw new Error("short read"); fs.writeSync(out, b, 0, n); p += n; } };
      copy(0, ftyp.size);
      fs.writeSync(out, moovBuf);
      for (const a of top) { if (a === ftyp || a === moov) continue; copy(a.start, a.size); }
    } finally { fs.closeSync(out); }
    // proof: the media data is identical, only the index moved
    const dfd = fs.openSync(dest, "r");
    try {
      const dsize = fs.fstatSync(dfd).size;
      const dm = atoms(dfd, dsize).find(a => a.type === "mdat");
      const same = dsize === size && dm && dm.size === mdat.size && hashRange(fd, mdat.start, mdat.size) === hashRange(dfd, dm.start, dm.size);
      if (!same) { fs.unlinkSync(dest); return { fixed: false, reason: "verification failed, original kept" }; }
    } finally { fs.closeSync(dfd); }
    return { fixed: true };
  } finally { fs.closeSync(fd); }
}

module.exports = { probeMp4, makeFastStart };
