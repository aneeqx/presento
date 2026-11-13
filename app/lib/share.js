"use strict";
// Network share: serves the current project's compiled presentation on the LAN (Range support so video seeks), optional PIN gate,
// tracks who is watching, builds a QR code. Nothing is copied: files are streamed from the project folder. Stops when the app closes.
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { mime } = require("../../core/fsx");

let st = null;                                              // {server, port, ip, dir, mode, pin, files, mtime, devices, started}

function adapters() {
  const out = [], ifs = os.networkInterfaces();
  Object.keys(ifs).forEach(n => ifs[n].forEach(a => { if (a.family === "IPv4" && !a.internal) out.push({ name: n, ip: a.address }); }));
  return out;
}

function ua(s) {
  s = s || "";
  const dev = /iPad/.test(s) ? "iPad" : /iPhone/.test(s) ? "iPhone" : /Android/.test(s) ? (/Mobile/.test(s) ? "Android phone" : "Android tablet") : /Windows/.test(s) ? "Windows PC" : /Macintosh/.test(s) ? "Mac" : /Linux/.test(s) ? "Linux PC" : "Device";
  const br = /Edg\//.test(s) ? "Edge" : /Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : /Firefox\//.test(s) ? "Firefox" : "";
  return dev + (br ? " · " + br : "");
}

function build() {
  const { prepare } = require("../../exporters/common");
  const r = prepare(st.dir, { mode: st.mode, pin: st.pin || null });
  st.files = new Map(r.files.map(f => [f.dest, f]));
  st.mtime = fs.statSync(path.join(st.dir, "project.json")).mtimeMs;
  st.warnings = r.compiled.warnings;
}

function handler(req, res) {
  try {
    const raw = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    if (raw === "index.html") { try { if (fs.statSync(path.join(st.dir, "project.json")).mtimeMs !== st.mtime) build(); } catch (e) { /* keep the last good build */ } }
    const f = st.files.get(raw);
    const ip = (req.socket.remoteAddress || "").replace(/^::ffff:/, "");
    if (raw === "index.html" || raw.endsWith(".mp4") || raw.endsWith(".js") === false) {
      const d = st.devices.get(ip) || { ip, ua: "", first: Date.now(), hits: 0 };
      if (req.headers["user-agent"]) d.ua = req.headers["user-agent"];
      d.last = Date.now(); d.hits++; st.devices.set(ip, d);
    }
    if (!f) { res.writeHead(404); return res.end(); }
    const size = f.size, hdr = { "Content-Type": mime(raw), "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
    let a = 0, b = size - 1, code = 200;
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    if (m) { code = 206; if (m[1] === "" && m[2] !== "") a = Math.max(0, size - +m[2]); else { a = +m[1] || 0; if (m[2] !== "") b = Math.min(b, +m[2]); } if (a >= size) { res.writeHead(416, { "Content-Range": "bytes */" + size }); return res.end(); } hdr["Content-Range"] = "bytes " + a + "-" + b + "/" + size; }
    hdr["Content-Length"] = b - a + 1;
    res.writeHead(code, hdr);
    if (req.method === "HEAD") return res.end();
    if (f.buf) return res.end(f.buf.subarray(a, b + 1));
    fs.createReadStream(f.abs, { start: a, end: b }).on("error", () => res.destroy()).pipe(res);
  } catch (e) { res.writeHead(500); res.end(); }
}

function firewall() {                                       // best effort: is an inbound allow rule present for this app? (needs no admin to read)
  return new Promise(resolve => {
    const ps = "$p=Get-NetFirewallProfile | ? Enabled -eq True | % Name; if(-not $p){'off'}else{ $exe=(Get-Process -Id " + process.pid + ").Path; $r=Get-NetFirewallRule -Direction Inbound -Action Allow -Enabled True -ErrorAction SilentlyContinue | Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue | ? { $_.Program -eq $exe -or $_.Program -eq 'Any' }; if($r){'allowed'}else{'prompt'} }";
    execFile("powershell", ["-NoProfile", "-Command", ps], { windowsHide: true, timeout: 15000 }, (e, out) => resolve(e ? "unknown" : String(out).trim().split(/\r?\n/).pop()));
  });
}

async function start({ dir, mode, pin, ip }) {
  if (st) await stop();
  const ads = adapters(); const bindIp = ip || (ads[0] && ads[0].ip) || "127.0.0.1";
  st = { dir, mode: mode || "desktop", pin: pin || "", ip: bindIp, devices: new Map(), started: Date.now(), fw: "checking" };
  build();
  await new Promise((res, rej) => { st.server = http.createServer(handler); st.server.once("error", rej); st.server.listen(0, "0.0.0.0", res); });
  st.port = st.server.address().port;
  firewall().then(v => { if (st) st.fw = v; });
  return status();
}

function stop() {
  return new Promise(res => { if (!st) return res(); const s = st; st = null; s.server.close(() => res()); if (s.server.closeAllConnections) s.server.closeAllConnections(); setTimeout(res, 500); });
}

function status() {
  if (!st) return { on: false, adapters: adapters() };
  const now = Date.now();
  return {
    on: true, url: "http://" + st.ip + ":" + st.port + "/", ip: st.ip, port: st.port, mode: st.mode, pin: !!st.pin, adapters: adapters(), firewall: st.fw, dir: st.dir,
    devices: [...st.devices.values()].sort((a, b) => b.last - a.last).map(d => ({ ip: d.ip, label: ua(d.ua), last: d.last, ago: Math.round((now - d.last) / 1000), live: now - d.last < 45000 }))
  };
}

function qr(text) {
  const qrcode = require("qrcode-generator"), q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount(); let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += "M" + x + " " + y + "h1v1h-1z";
  return { n, path: d };
}

module.exports = { start, stop, status, qr, adapters };
