"use strict";
// Writes a compiled project to a plain folder (index.html + css/js/vendor + content/). Used by the ZIP exporter, previews and tests.
const fs = require("fs");
const path = require("path");
const { compile } = require("./compile");
const { mkdirp, copyFile, md5File } = require("./fsx");

/** Returns {compiled, outDir}. Media is copied byte-for-byte; with opts.verify every copy is MD5-checked against its source. */
async function buildViewer(projectDir, outDir, opts) {
  opts = opts || {};
  const c = compile(projectDir, opts);
  mkdirp(outDir);
  for (const f of c.files) {
    const dest = path.join(outDir, f.dest);
    if (f.abs) {
      copyFile(f.abs, dest);
      if (opts.verify && f.media) {
        const [a, b] = await Promise.all([md5File(f.abs), md5File(dest)]);
        if (a !== b) throw new Error("MD5 mismatch after copy: " + f.dest);
      }
    } else { mkdirp(path.dirname(dest)); fs.writeFileSync(dest, f.buf); }
  }
  return { compiled: c, outDir };
}

module.exports = { buildViewer };
