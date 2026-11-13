#!/usr/bin/env node
"use strict";
// node exporters/cli.js <projectDir> <zip|html|exe> --out <file> [--mode desktop|touch] [--pin 1234] [--include a,b/c] [--no-browser]
const path = require("path");
const { safeName, fmtBytes } = require("./common");
const { loadProject } = require("../core/project");

function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-browser") o.browser = false;
    else if (a === "--zip") o.zip = true;
    else if (a.startsWith("--")) o[a.slice(2)] = argv[++i];
    else o._.push(a);
  }
  return o;
}

async function run(projectDir, format, o) {
  const opts = { mode: o.mode || "desktop", pin: o.pin != null ? o.pin : null, include: o.include ? o.include.split(",") : null, browser: o.browser, onProgress: o.onProgress, onStep: o.onStep, cancelled: o.cancelled, zipFolder: !!o.zip };
  const name = safeName(loadProject(projectDir).name);
  const suffix = opts.mode === "touch" ? "Touch" : "Desktop";
  const ext = { zip: ".zip", html: ".html", exe: "" }[format];   // exe: --out is the FOLDER (<Name>.exe + <Name>.data)
  if (ext == null) throw new Error("format must be zip, html or exe");
  const out = path.resolve(o.out || path.join(process.cwd(), format === "exe" ? name : name + " - " + suffix + ext));
  const mod = { zip: () => require("./zip-export").exportZip, html: () => require("./html-export").exportHtml, exe: () => require("./exe-export").exportExe }[format]();
  return await mod(projectDir, out, opts);
}

module.exports = { run };

if (require.main === module) {
  const o = parse(process.argv.slice(2));
  if (o._.length < 2) { console.error("usage: node exporters/cli.js <projectDir> <zip|html|exe> --out <file> [--mode desktop|touch] [--pin 1234] [--include a,b/c] [--no-browser]"); process.exit(1); }
  run(o._[0], o._[1], o).then(r => {
    if (r.zip) console.log("zipped " + r.zip);
    console.log("wrote " + r.file + "  (" + fmtBytes(r.bytes) + ")");
    (r.warnings || []).forEach(w => console.log("warning: " + w));
    r.check.checks.forEach(c => console.log((c.ok ? "  PASS " : c.skipped ? "  SKIP " : "  FAIL ") + c.name + " - " + c.detail));
    process.exit(r.check.ok ? 0 : 3);
  }).catch(e => { console.error(e.message); process.exit(1); });
}
