"use strict";
// Serves a compiled project (virtual file list, nothing copied) on 127.0.0.1 for the live preview. Range requests supported so video seeks.
const http = require("http");
const fs = require("fs");
const { mime } = require("../../core/fsx");

const sessions = new Map();
let server = null, port = 0;

function start() {
  if (server) return Promise.resolve(port);
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      try {
        const u = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
        const i = u.indexOf("/"); const tok = u.slice(0, i), rel = u.slice(i + 1) || "index.html";
        const sess = sessions.get(tok), f = sess && sess.get(rel);
        if (!f) { res.writeHead(404); return res.end(); }
        const size = f.size, type = mime(rel);
        const hdr = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
        let start = 0, end = size - 1, code = 200;
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
        if (m) { code = 206; if (m[1] === "" && m[2] !== "") { start = Math.max(0, size - +m[2]); } else { start = +m[1] || 0; if (m[2] !== "") end = Math.min(end, +m[2]); } if (start >= size) { res.writeHead(416, { "Content-Range": "bytes */" + size }); return res.end(); } hdr["Content-Range"] = "bytes " + start + "-" + end + "/" + size; }
        hdr["Content-Length"] = end - start + 1;
        res.writeHead(code, hdr);
        if (req.method === "HEAD") return res.end();
        if (f.buf) return res.end(f.buf.subarray(start, end + 1));
        fs.createReadStream(f.abs, { start, end }).on("error", () => res.destroy()).pipe(res);
      } catch (e) { res.writeHead(500); res.end(); }
    });
    server.listen(0, "127.0.0.1", () => { port = server.address().port; resolve(port); });
  });
}

/** compiled = result of core/compile. Returns the base URL for this session token. */
async function publish(token, compiled) {
  await start();
  sessions.set(token, new Map(compiled.files.map(f => [f.dest, f])));
  return "http://127.0.0.1:" + port + "/" + token + "/";
}

module.exports = { publish };
