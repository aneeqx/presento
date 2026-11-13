"use strict";
// The "opens without errors" part of the post-export check: drives the finished export in a real browser (zip -> extracted, html -> file://, exe -> its own WebView2 over CDP).
// Needs `uv` + Playwright and Chrome/Edge; when they are missing the check is reported as skipped, never as passed.
const { spawn } = require("child_process");
const path = require("path");

function browserCheck(o) {
  return new Promise(resolve => {
    const script = path.join(__dirname, "..", "tests", "open_check.py");
    const args = ["run", "--with", "playwright", "python", script, o.kind, o.path, o.pin == null ? "-" : String(o.pin)];
    let out = "", err = "";
    let p;
    try { p = spawn("uv", args, { windowsHide: true }); } catch (e) { return resolve({ name: "opens without errors", ok: false, skipped: true, detail: "browser check could not start: " + e.message }); }
    p.stdout.on("data", d => { out += d; }); p.stderr.on("data", d => { err += d; });
    p.on("error", e => resolve({ name: "opens without errors", ok: false, skipped: true, detail: "browser check not available (" + e.message + ")" }));
    p.on("close", code => {
      const line = out.trim().split(/\r?\n/).filter(l => l.startsWith("{")).pop();
      if (!line) return resolve({ name: "opens without errors", ok: false, skipped: code === 2, detail: "browser check produced no result: " + (err || out).slice(-400) });
      const r = JSON.parse(line);
      resolve({ name: "opens without errors", ok: r.ok, detail: r.detail });
    });
  });
}

module.exports = { browserCheck };
