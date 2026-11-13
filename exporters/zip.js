"use strict";
// Streaming ZIP writer with ZIP64 (files and archives > 4 GB), no dependencies. Media is STORED (already compressed), text is deflated.
const fs = require("fs");
const zlib = require("zlib");

const STORE_EXT = /\.(mp4|m4v|mov|webm|jpe?g|png|webp|gif|woff2?|zip)$/i;
const U32 = 0xffffffff;

function dosTime(d) {
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}
function big(n) { return BigInt(n); }
function w64(b, off, n) { b.writeBigUInt64LE(big(n), off); }

class Sink {
  constructor(file) { this.s = fs.createWriteStream(file, { highWaterMark: 4 << 20 }); this.pos = 0; this.err = null; this.s.on("error", e => { this.err = e; }); }
  write(buf) {
    if (this.err) throw this.err;
    this.pos += buf.length;
    return new Promise(res => { if (this.s.write(buf)) res(); else this.s.once("drain", res); });
  }
  end() { return new Promise((res, rej) => { this.s.end(); this.s.on("finish", res); this.s.on("error", rej); }); }
}

/**
 * entries: [{name, abs?, buf?, size}]   name uses forward slashes.
 * Returns {bytes, entries:[{name, crc, size, offset}]} (offsets/crc let the checker verify the archive without trusting this code twice).
 */
async function writeZip(outFile, entries, opts) {
  opts = opts || {};
  const sink = new Sink(outFile), now = dosTime(new Date()), central = [], log = [];
  for (const e of entries) {
    if (opts.cancelled && opts.cancelled()) throw new Error("cancelled");
    const nameBuf = Buffer.from(e.name, "utf8");
    const deflate = !e.abs ? true : !STORE_EXT.test(e.name);
    let data = null;
    if (e.buf || (deflate && e.abs)) { data = e.buf || fs.readFileSync(e.abs); }
    const usizeKnown = data ? data.length : e.size;
    const z64 = usizeKnown >= U32;                       // only stored media can be this big
    const offset = sink.pos;
    const method = deflate && data ? 8 : 0;
    let body = data, csize = 0, crc = 0;
    if (data) { crc = zlib.crc32(data) >>> 0; body = method === 8 ? zlib.deflateRawSync(data, { level: 6 }) : data; csize = body.length; }
    const flags = 0x0800 | (data ? 0 : 0x0008);          // utf-8 names; streamed files carry a data descriptor
    const extra = z64 ? Buffer.alloc(20) : Buffer.alloc(0);
    if (z64) { extra.writeUInt16LE(1, 0); extra.writeUInt16LE(16, 2); }
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(z64 ? 45 : 20, 4); lh.writeUInt16LE(flags, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(now.time, 10); lh.writeUInt16LE(now.date, 12);
    if (data) { lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(csize, 18); lh.writeUInt32LE(data.length, 22); }
    else if (z64) { lh.writeUInt32LE(U32, 18); lh.writeUInt32LE(U32, 22); }
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(extra.length, 28);
    await sink.write(lh); await sink.write(nameBuf); if (extra.length) await sink.write(extra);
    let usize;
    if (data) { await sink.write(body); usize = data.length; }
    else {
      // stream the file: crc computed on the way; never held in memory
      const fh = await fs.promises.open(e.abs, "r");
      const chunk = Buffer.allocUnsafe(4 << 20); let pos = 0;
      try {
        for (;;) {
          const { bytesRead } = await fh.read(chunk, 0, chunk.length, pos);
          if (!bytesRead) break;
          const part = bytesRead === chunk.length ? chunk : chunk.subarray(0, bytesRead);
          crc = zlib.crc32(part, crc) >>> 0; await sink.write(Buffer.from(part)); pos += bytesRead;
        }
      } finally { await fh.close(); }
      usize = pos; csize = pos;
      if (usize !== e.size) throw new Error("file changed while zipping: " + e.name);
      const dd = Buffer.alloc(z64 ? 24 : 16);
      dd.writeUInt32LE(0x08074b50, 0); dd.writeUInt32LE(crc, 4);
      if (z64) { w64(dd, 8, csize); w64(dd, 16, usize); } else { dd.writeUInt32LE(csize, 8); dd.writeUInt32LE(usize, 12); }
      await sink.write(dd);
    }
    central.push({ nameBuf, flags, method, crc, csize, usize, offset, z64: z64 });
    log.push({ name: e.name, crc, size: usize, offset });
    if (opts.onProgress) opts.onProgress(e.name, sink.pos);
  }
  const cdStart = sink.pos;
  for (const c of central) {
    const needOff = c.offset >= U32, needSizes = c.z64;
    const ex = []; if (needSizes) { const b = Buffer.alloc(8); w64(b, 0, c.usize); ex.push(b); const b2 = Buffer.alloc(8); w64(b2, 0, c.csize); ex.push(b2); } if (needOff) { const b = Buffer.alloc(8); w64(b, 0, c.offset); ex.push(b); }
    const exBody = Buffer.concat(ex), extra = exBody.length ? Buffer.concat([Buffer.from([1, 0, exBody.length & 255, exBody.length >> 8]), exBody]) : Buffer.alloc(0);
    const h = Buffer.alloc(46);
    h.writeUInt32LE(0x02014b50, 0); h.writeUInt16LE(45, 4); h.writeUInt16LE(needOff || needSizes ? 45 : 20, 6); h.writeUInt16LE(c.flags, 8); h.writeUInt16LE(c.method, 10);
    h.writeUInt16LE(now.time, 12); h.writeUInt16LE(now.date, 14); h.writeUInt32LE(c.crc, 16);
    h.writeUInt32LE(needSizes ? U32 : c.csize, 20); h.writeUInt32LE(needSizes ? U32 : c.usize, 24);
    h.writeUInt16LE(c.nameBuf.length, 28); h.writeUInt16LE(extra.length, 30); h.writeUInt32LE(needOff ? U32 : c.offset, 42);
    await sink.write(h); await sink.write(c.nameBuf); if (extra.length) await sink.write(extra);
  }
  const cdSize = sink.pos - cdStart, n = central.length;
  const z64End = n >= 0xffff || cdStart >= U32 || cdSize >= U32;
  if (z64End) {
    const r = Buffer.alloc(56); r.writeUInt32LE(0x06064b50, 0); w64(r, 4, 44); r.writeUInt16LE(45, 12); r.writeUInt16LE(45, 14); w64(r, 24, n); w64(r, 32, n); w64(r, 40, cdSize); w64(r, 48, cdStart);
    const loc = Buffer.alloc(20); loc.writeUInt32LE(0x07064b50, 0); w64(loc, 8, sink.pos); loc.writeUInt32LE(1, 16);
    await sink.write(r); await sink.write(loc);
  }
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(z64End ? 0xffff : n, 8); eocd.writeUInt16LE(z64End ? 0xffff : n, 10); eocd.writeUInt32LE(z64End ? U32 : cdSize, 12); eocd.writeUInt32LE(z64End ? U32 : cdStart, 16);
  await sink.write(eocd);
  await sink.end();
  return { bytes: sink.pos, entries: log };
}

module.exports = { writeZip };
