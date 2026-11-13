"use strict";
// ZIP export: "<Name> - Desktop|Touch/" containing index.html + css/ js/ vendor/ content/ - the same layout as the hand-built exports.
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");
const { writeZip } = require("./zip");
const { prepare, safeName, Scanner, scanFile, fmtBytes } = require("./common");
const { imageSizeBuffer } = require("../core/imgsize");

function crcOfFile(file) {
  return new Promise((res, rej) => {
    let crc = 0; fs.createReadStream(file, { highWaterMark: 4 << 20 }).on("data", d => { crc = zlib.crc32(d, crc) >>> 0; }).on("end", () => res(crc)).on("error", rej);
  });
}

async function exportZip(projectDir, outFile, opts) {
  opts = opts || {};
  const { compiled, files } = prepare(projectDir, opts);
  if (opts.onStep) opts.onStep("collect", files.length + " files");
  const top = safeName(compiled.title) + " - " + (opts.mode === "touch" ? "Touch" : "Desktop");
  const entries = files.map(f => ({ name: top + "/" + f.dest, abs: f.abs, buf: f.buf, size: f.size, src: f }));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const t0 = Date.now();
  if (opts.onStep) opts.onStep("pack", "zipping");
  const w = await writeZip(outFile, entries, { onProgress: opts.onProgress, cancelled: opts.cancelled });
  if (opts.onStep) opts.onStep("check", "");
  const check = await checkZip(outFile, w, entries, opts);
  return { file: outFile, bytes: w.bytes, seconds: (Date.now() - t0) / 1000, entries: entries.length, warnings: compiled.warnings, check, topFolder: top };
}

/** Post-export check: every file present and byte-identical, image sizes intact, no forbidden word anywhere, central directory sane. */
async function checkZip(zipFile, written, entries, opts) {
  const checks = [], add = (name, ok, detail) => checks.push({ name, ok, detail });
  const fd = await fs.promises.open(zipFile, "r");
  const st = await fd.stat();
  try {
    // 1. end-of-central-directory sanity (zip64 aware)
    const tail = Buffer.alloc(Math.min(st.size, 70000)); await fd.read(tail, 0, tail.length, st.size - tail.length);
    const e = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    let count = e >= 0 ? tail.readUInt16LE(e + 10) : -1;
    if (count === 0xffff) { const r = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x06])); count = r >= 0 ? Number(tail.readBigUInt64LE(r + 32)) : -1; }
    add("archive directory readable", count === entries.length, count + " entries in directory, " + entries.length + " expected");

    // 2. each entry: header name matches, data identical to its source
    let bad = [], imgChecked = 0, imgBad = [];
    for (let i = 0; i < entries.length; i++) {
      const en = entries[i], rec = written.entries[i];
      const h = Buffer.alloc(30); await fd.read(h, 0, 30, rec.offset);
      if (h.readUInt32LE(0) !== 0x04034b50) { bad.push(en.name + " (no header)"); continue; }
      const nl = h.readUInt16LE(26), xl = h.readUInt16LE(28), method = h.readUInt16LE(8);
      const nm = Buffer.alloc(nl); await fd.read(nm, 0, nl, rec.offset + 30);
      if (nm.toString("utf8") !== en.name) { bad.push(en.name + " (name mismatch)"); continue; }
      const dataOff = rec.offset + 30 + nl + xl;
      if (en.abs && method === 0) {                                           // streamed media: compare CRC of the stored bytes with a fresh CRC of the source
        let crc = 0, pos = 0; const chunk = Buffer.allocUnsafe(4 << 20);
        while (pos < rec.size) { const n = Math.min(chunk.length, rec.size - pos); await fd.read(chunk, 0, n, dataOff + pos); crc = zlib.crc32(chunk.subarray(0, n), crc) >>> 0; pos += n; }
        const srcCrc = await crcOfFile(en.abs);
        if (crc !== srcCrc || rec.size !== fs.statSync(en.abs).size) bad.push(en.name + " (content differs from source)");
        if (/\.(jpe?g|png|webp|gif)$/i.test(en.name)) {
          const hd = Buffer.alloc(Math.min(rec.size, 8 << 20)); await fd.read(hd, 0, hd.length, dataOff);
          const a = imageSizeBuffer(hd), b = imageSizeBuffer(fs.readFileSync(en.abs).subarray(0, 8 << 20));
          imgChecked++; if (!a || !b || a.w !== b.w || a.h !== b.h) imgBad.push(en.name);
        }
      } else {                                                                // text / generated: inflate and compare
        const csz = method === 8 ? null : rec.size;
        // deflated entries have no data descriptor (sizes known), so the compressed size is in the local header
        const comp = h.readUInt32LE(18), body = Buffer.alloc(comp); await fd.read(body, 0, comp, dataOff);
        const out = method === 8 ? zlib.inflateRawSync(body) : body;
        const src = en.buf || fs.readFileSync(en.abs);
        if (!out.equals(src)) bad.push(en.name + " (content differs from source)");
      }
    }
    add("all files present and byte-identical", bad.length === 0, bad.length ? bad.slice(0, 5).join("; ") : entries.length + " files compared with their sources");
    add("image resolutions intact", imgBad.length === 0, imgBad.length ? imgBad.join("; ") : imgChecked + " images, pixel sizes read back from the archive match the originals");

    // 3. forbidden word: whole archive bytes (names, stored media, headers) + inflated text entries
    const sc = new Scanner();
    await scanFile(zipFile, sc);
    entries.forEach(en => { if (!en.abs || !/\.(mp4|m4v|mov|webm|jpe?g|png|webp|gif|woff2?)$/i.test(en.name)) sc.feed(en.buf || fs.readFileSync(en.abs)); });
    add("no forbidden word anywhere", sc.hits === 0, sc.hits + " occurrences (names, text and media bytes scanned)");
  } finally { await fd.close(); }
  if (opts && opts.browser !== false) checks.push(await require("./check").browserCheck({ kind: "zip", path: zipFile, pin: opts.pin }));
  return { ok: checks.every(c => c.ok || c.skipped), checks };
}

module.exports = { exportZip, checkZip };
