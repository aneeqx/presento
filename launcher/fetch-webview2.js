"use strict";
// Downloads the official Microsoft.Web.WebView2 NuGet package and unpacks the three files the launcher embeds into launcher/vendor/.
// Run automatically by launcher/build.js when they are missing. Windows only (uses PowerShell to unzip).
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

const VERSION = "1.0.2849.39";
const URL_ = "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/" + VERSION;
const OUT = path.join(__dirname, "vendor");
const WANT = [
  ["lib/net462/Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.Core.dll"],
  ["lib/net462/Microsoft.Web.WebView2.WinForms.dll", "Microsoft.Web.WebView2.WinForms.dll"],
  ["runtimes/win-x64/native/WebView2Loader.dll", "WebView2Loader.dll"],
  ["LICENSE.txt", "WEBVIEW2-LICENSE.txt"]
];

function have() { return WANT.every(w => fs.existsSync(path.join(OUT, w[1]))); }
function download(url, dest, hops) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (hops || 0) < 5) { res.resume(); return resolve(download(res.headers.location, dest, (hops || 0) + 1)); }
      if (res.statusCode !== 200) return reject(new Error("download failed: HTTP " + res.statusCode));
      const f = fs.createWriteStream(dest); res.pipe(f); f.on("finish", () => f.close(resolve)); f.on("error", reject);
    }).on("error", reject);
  });
}
async function fetchWebView2() {
  if (have()) return OUT;
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wv2_")), pkg = path.join(tmp, "wv2.zip"), ex = path.join(tmp, "x");
  console.log("fetching Microsoft.Web.WebView2 " + VERSION + " from nuget.org ...");
  await download(URL_, pkg);
  execFileSync("powershell", ["-NoProfile", "-Command", "Expand-Archive -LiteralPath '" + pkg + "' -DestinationPath '" + ex + "' -Force"], { stdio: "pipe" });
  WANT.forEach(w => fs.copyFileSync(path.join(ex, w[0]), path.join(OUT, w[1])));
  fs.rmSync(tmp, { recursive: true, force: true });
  return OUT;
}
module.exports = { fetchWebView2, have, OUT };
if (require.main === module) fetchWebView2().then(d => console.log("ready:", d), e => { console.error(e.message); process.exit(1); });
