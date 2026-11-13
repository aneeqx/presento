"use strict";
// Node-only smoke test (no browser): fixture project -> compile -> ZIP and single-HTML export with their static post-export checks.
// The flipbook add-on is not installed in a fresh checkout, so the stub must be wired in. Run: node tests/smoke.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");
const { make } = require("./fixtures");
const { compile, flipbookAddonDir } = require("../core/compile");

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "presento-smoke-"));
  const proj = path.join(work, "project"); make(proj);
  const c = compile(proj, { mode: "desktop" });
  assert(c.data.sections.length === 4, "4 sections compiled");
  const addon = flipbookAddonDir();
  console.log("flipbook add-on:", addon ? "installed (" + addon + ")" : "not installed");
  assert(addon ? c.indexHtml.includes("addons/flipbook/flipbook.js") : c.indexHtml.includes("flipbook-stub.js"), "index.html wires the add-on or the stub");
  const zip = await require("../exporters/zip-export").exportZip(proj, path.join(work, "out.zip"), { mode: "desktop", pin: "1234", browser: false });
  assert(zip.check.ok, "zip checks: " + JSON.stringify(zip.check.checks.filter(x => !x.ok)));
  const html = await require("../exporters/html-export").exportHtml(proj, path.join(work, "out.html"), { mode: "touch", browser: false });
  assert(html.check.ok, "html checks: " + JSON.stringify(html.check.checks.filter(x => !x.ok)));
  console.log("zip", zip.check.checks.map(x => (x.ok ? "PASS " : "FAIL ") + x.name).join("; "));
  console.log("html", html.check.checks.map(x => (x.ok ? "PASS " : "FAIL ") + x.name).join("; "));
  fs.rmSync(work, { recursive: true, force: true });
  console.log("smoke test passed");
})().catch(e => { console.error(e.message); process.exit(1); });
