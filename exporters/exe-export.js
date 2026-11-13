"use strict";
// Portable presentation: a folder with <Name>.exe (small WebView2 launcher, fullscreen kiosk) + <Name>.data (AES-256-CTR encrypted payload). See docs/EXPORTERS.md.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { prepare, safeName, Scanner, scanFile, fmtBytes } = require("./common");
const { hostPage } = require("./gate");
const { buildLauncher } = require("../launcher/build");
const { mime, md5File } = require("../core/fsx");
const { imageSizeBuffer } = require("../core/imgsize");

const MAGIC = Buffer.from("PKG1BLOB"), FOOT = Buffer.from("PKGEND01");
const ITERS_PIN = 200000, ITERS_NONE = 1000;

function deriveKeys(pin, salt, iters) {
  const k = crypto.pbkdf2Sync(String(pin), salt, iters, 64, "sha256");
  return { enc: k.subarray(0, 32), mac: k.subarray(32, 64) };
}

async function exportExe(projectDir, outTarget, opts) {
  opts = opts || {};
  const hasPin = opts.pin != null;
  const { compiled, files } = prepare(projectDir, Object.assign({}, opts, { gate: "none" }));      // the exe has its own gate, hosted by the launcher
  const name = compiled.title;
  if (opts.onStep) opts.onStep("collect", files.length + " files");
  const outDir = /\.exe$/i.test(outTarget) ? path.dirname(outTarget) : outTarget;
  fs.mkdirSync(outDir, { recursive: true });
  const base = safeName(name);
  const exePath = path.join(outDir, base + ".exe"), outFile = path.join(outDir, base + ".data");

  // 1. launcher with the presentation's name as product name
  if (opts.onStep) opts.onStep("build", "launcher");
  const exeTmp = buildLauncher({ name });
  const launcherBytes = fs.statSync(exeTmp).size;

  // 2. gate page (only when a PIN is set)
  let gate = Buffer.alloc(0);
  if (hasPin) {
    const lf = files.find(f => f.dest === compiled.data.brand.logo);
    const logoDataUri = lf && lf.abs && /\.svg$/i.test(lf.abs) && lf.size < 400000 ? "data:image/svg+xml;base64," + fs.readFileSync(lf.abs).toString("base64") : null;
    gate = Buffer.from(hostPage({ name, look: compiled.project.look || {}, logoDataUri }), "utf8");
  }

  // 3. index (names, sizes, offsets), then keys
  let off = 0;
  const idx = { name, bg: (compiled.project.look && compiled.project.look.bg) || "#F9F9F7", files: [] };
  for (const f of files) { idx.files.push({ p: f.dest, o: off, l: f.size, t: mime(f.dest).split(";")[0] }); off += f.size; }
  const idxBuf = Buffer.from(JSON.stringify(idx), "utf8");
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(16);
  const iters = hasPin ? ITERS_PIN : ITERS_NONE;
  const keys = deriveKeys(hasPin ? opts.pin : "", salt, iters);
  const check = crypto.createHmac("sha256", keys.mac).update(idxBuf).digest();
  const regionLen = idxBuf.length + off;

  // 4. write: launcher | header | gate | encrypted(index + files) | footer
  const out = fs.createWriteStream(outFile, { highWaterMark: 4 << 20 });
  let pos = 0, err = null; out.on("error", e => { err = e; });
  const put = (b) => { if (err) throw err; pos += b.length; return new Promise(r => { if (out.write(b)) r(); else out.once("drain", r); }); };
  const t0 = Date.now();
  fs.copyFileSync(exeTmp, exePath);
  const blobStart = pos;
  const h = Buffer.alloc(108);
  MAGIC.copy(h, 0); h.writeUInt32LE(1, 8); h.writeUInt32LE(hasPin ? 1 : 0, 12); h.writeUInt32LE(iters, 16);
  salt.copy(h, 24); iv.copy(h, 40); h.writeBigUInt64LE(BigInt(idxBuf.length), 56); h.writeBigUInt64LE(BigInt(regionLen), 64); check.copy(h, 72); h.writeUInt32LE(gate.length, 104);
  await put(h); if (gate.length) await put(gate);
  if (opts.onStep) opts.onStep("pack", "encrypting");
  const cipher = crypto.createCipheriv("aes-256-ctr", keys.enc, iv);
  await put(cipher.update(idxBuf));
  const srcCrc = [];
  for (const f of files) {
    if (opts.cancelled && opts.cancelled()) throw new Error("cancelled"); if (opts.onProgress) opts.onProgress(f.dest, pos);
    if (f.buf) { await put(cipher.update(f.buf)); continue; }
    const fd = await fs.promises.open(f.abs, "r"); const chunk = Buffer.allocUnsafe(4 << 20); let p = 0;
    try { for (;;) { const { bytesRead } = await fd.read(chunk, 0, chunk.length, p); if (!bytesRead) break; await put(cipher.update(chunk.subarray(0, bytesRead))); p += bytesRead; } } finally { await fd.close(); }
    if (p !== f.size) throw new Error("file changed while packing: " + f.dest);
  }
  const fin = cipher.final(); if (fin.length) await put(fin);
  const blobLen = pos - blobStart;
  const ft = Buffer.alloc(24); ft.writeBigUInt64LE(BigInt(blobStart), 0); ft.writeBigUInt64LE(BigInt(blobLen), 8); FOOT.copy(ft, 16);
  await put(ft);
  await new Promise((r, j) => { out.end(); out.on("finish", r); out.on("error", j); });
  fs.rmSync(path.dirname(exeTmp), { recursive: true, force: true });

  const res = { file: exePath, dataFile: outFile, dir: outDir, bytes: pos + launcherBytes, launcherBytes, seconds: (Date.now() - t0) / 1000, warnings: compiled.warnings };
  if (opts.zipFolder) {                                              // also zip the folder for sending (exe + data file, stored)
    const { writeZip } = require("./zip");
    const top = base;
    res.zip = outDir.replace(/[\/]+$/, "") + ".zip";
    await writeZip(res.zip, [exePath, outFile].map(f => ({ name: top + "/" + path.basename(f), abs: f, size: fs.statSync(f).size })));
  }
  if (opts.onStep) opts.onStep("check", "");
  res.check = await checkExe(outFile, files, { pin: hasPin ? String(opts.pin) : "", hasPin, launcherBytes, blobStart, name, exePath }, opts);
  return res;
}

/** Post-export check. Reads the finished exe back with an independent implementation of the container (Node), decrypts everything, compares with the sources. */
async function checkExe(file, files, info, opts) {
  const checks = [], add = (n, ok, d) => checks.push({ name: n, ok, detail: d });
  const fd = await fs.promises.open(file, "r");
  const st = await fd.stat();
  try {
    const foot = Buffer.alloc(24); await fd.read(foot, 0, 24, st.size - 24);
    const blobLen = Number(foot.readBigUInt64LE(8)), blobStart = st.size - 24 - blobLen;
    const h = Buffer.alloc(108); await fd.read(h, 0, 108, blobStart);
    const okHdr = foot.subarray(16).equals(FOOT) && h.subarray(0, 8).equals(MAGIC) && blobStart === info.blobStart;
    add("container header and footer valid", okHdr, "launcher " + fmtBytes(info.launcherBytes) + ", data file " + fmtBytes(st.size));
    if (!okHdr) return { ok: false, checks };
    const iters = h.readUInt32LE(16), salt = h.subarray(24, 40), iv = h.subarray(40, 56), idxLen = Number(h.readBigUInt64LE(56)), chk = h.subarray(72, 104), gl = h.readUInt32LE(104);
    const gate = Buffer.alloc(gl); if (gl) await fd.read(gate, 0, gl, blobStart + 108);
    const regionStart = blobStart + 108 + gl;
    const keys = deriveKeys(info.pin, salt, iters);
    const dec = () => crypto.createDecipheriv("aes-256-ctr", keys.enc, iv);
    // wrong PIN must be rejected
    if (info.hasPin) {
      const wrong = deriveKeys(info.pin === "0000" ? "1111" : "0000", salt, iters);
      const ib = Buffer.alloc(idxLen); await fd.read(ib, 0, idxLen, regionStart);
      const d = crypto.createDecipheriv("aes-256-ctr", wrong.enc, iv); const bad = Buffer.concat([d.update(ib), d.final()]);
      add("wrong PIN is rejected", !crypto.timingSafeEqual(crypto.createHmac("sha256", wrong.mac).update(bad).digest(), chk), "index does not authenticate with another PIN");
    }
    // index with the right PIN
    const ib = Buffer.alloc(idxLen); await fd.read(ib, 0, idxLen, regionStart);
    const d0 = dec(); const idxPlain = Buffer.concat([d0.update(ib), d0.final()]);
    const okKey = crypto.timingSafeEqual(crypto.createHmac("sha256", keys.mac).update(idxPlain).digest(), chk);
    add("PIN opens the package", okKey, info.hasPin ? "right PIN decrypts and authenticates the index" : "no PIN: opens directly");
    if (!okKey) return { ok: false, checks };
    const idx = JSON.parse(idxPlain.toString("utf8"));

    // every file decrypted from the exe and compared with its source (md5), image sizes read back, forbidden word scanned in the clear
    const sc = new Scanner();
    const bad = [], imgBad = []; let imgOk = 0;
    const bySrc = new Map(files.map(f => [f.dest, f]));
    if (idx.files.length !== files.length) bad.push("file count " + idx.files.length + " != " + files.length);
    for (const e of idx.files) {
      const f = bySrc.get(e.p);
      if (!f) { bad.push("unexpected " + e.p); continue; }
      const hash = crypto.createHash("md5"); let first = null;
      const dd = dec(); dd.update(Buffer.alloc(0));
      // CTR is random access: seek the keystream by decrypting from the start of this file's block
      const abs = idxLen + e.o, blockStart = abs - (abs % 16);
      const cnt = Buffer.from(iv); let n = BigInt("0x" + cnt.toString("hex")) + BigInt(Math.floor(abs / 16)); n &= (1n << 128n) - 1n;
      const ivAt = Buffer.from(n.toString(16).padStart(32, "0"), "hex");
      const dx = crypto.createDecipheriv("aes-256-ctr", keys.enc, ivAt);
      let skip = abs % 16, left = e.l; const buf = Buffer.allocUnsafe(4 << 20);
      let rpos = regionStart + blockStart;
      if (skip) { const hd = Buffer.alloc(skip); await fd.read(hd, 0, skip, rpos); dx.update(hd); rpos += skip; }
      while (left > 0) {
        const m = Math.min(buf.length, left); await fd.read(buf, 0, m, rpos);
        const plain = dx.update(buf.subarray(0, m)); hash.update(plain); sc.feed(plain);
        if (!first && /\.(jpe?g|png|webp|gif)$/i.test(e.p)) first = Buffer.from(plain.subarray(0, Math.min(plain.length, 8 << 20)));
        rpos += m; left -= m;
      }
      const want = f.buf ? crypto.createHash("md5").update(f.buf).digest("hex") : await md5File(f.abs);
      if (hash.digest("hex") !== want) bad.push(e.p);
      if (first && f.abs) { const a = imageSizeBuffer(first), b = imageSizeBuffer(fs.readFileSync(f.abs).subarray(0, 8 << 20)); if (a && b && a.w === b.w && a.h === b.h) imgOk++; else imgBad.push(e.p); }
    }
    add("all files present and byte-identical", bad.length === 0, bad.length ? bad.slice(0, 5).join("; ") : idx.files.length + " files decrypted from the exe and compared with their sources");
    add("image resolutions intact", imgBad.length === 0, imgBad.length ? imgBad.join("; ") : imgOk + " images, pixel sizes match the originals");

    // forbidden word: the launcher part (code, resources, version info, UTF-16 strings), the gate page, and every decrypted file
    sc.feed(gate);
    const lfd = await fs.promises.open(info.exePath, "r"); const lb = Buffer.allocUnsafe(4 << 20);
    try { for (let p = 0; p < info.launcherBytes;) { const m = Math.min(lb.length, info.launcherBytes - p); await lfd.read(lb, 0, m, p); sc.feed(lb.subarray(0, m)); p += m; } } finally { await lfd.close(); }
    add("no forbidden word anywhere", sc.hits === 0, sc.hits + " occurrences (launcher bytes + exe properties, gate page, every decrypted file)");
    try {
      const vi = JSON.parse(require("child_process").execFileSync("powershell", ["-NoProfile", "-Command", "(Get-Item -LiteralPath '" + info.exePath.replace(/'/g, "''") + "').VersionInfo | Select-Object ProductName,FileDescription,CompanyName,LegalCopyright,LegalTrademarks,OriginalFilename,InternalName,Comments | ConvertTo-Json"], { windowsHide: true }).toString());
      const empty = v => !v || !String(v).trim();
      const ok = vi.ProductName === info.name && vi.FileDescription === info.name && empty(vi.CompanyName) && empty(vi.LegalCopyright) && empty(vi.LegalTrademarks) && (empty(vi.Comments) || vi.Comments === info.name);
      add("exe properties neutral", ok, "read back from the file: product \"" + vi.ProductName + "\", description \"" + vi.FileDescription + "\", company \"" + (vi.CompanyName || "") + "\", copyright \"" + (vi.LegalCopyright || "") + "\", original name \"" + vi.OriginalFilename + "\"");
    } catch (e) { add("exe properties neutral", false, "could not read version info: " + e.message.slice(0, 120)); }
  } finally { await fd.close(); }
  if (opts && opts.browser !== false) checks.push(await require("./check").browserCheck({ kind: "exe", path: info.exePath, pin: info.hasPin ? info.pin : null }));
  return { ok: checks.every(c => c.ok || c.skipped), checks };
}

module.exports = { exportExe, checkExe };
