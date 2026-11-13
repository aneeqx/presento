"use strict";
// Compiles Launcher.cs into a neutral exe (product name = the presentation's name) with the csc that ships with Windows (.NET Framework 4.x).
// No SDK needed. The WebView2 managed libraries and the native loader are embedded as resources, so the result is ONE file.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const CSC = process.env.CSC || "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";
const V = path.join(__dirname, "vendor");

const MANIFEST = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges><requestedExecutionLevel level="asInvoker" uiAccess="false"/></requestedPrivileges></security></trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1"><application><supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/></application></compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3"><windowsSettings>
    <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
    <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
  </windowsSettings></application>
</assembly>`;

function cs(s) { return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, " "); }

/** Returns the path of the built launcher exe. */
function buildLauncher(o) {
  const wv = require("./fetch-webview2");
  if (!wv.have()) { try { require("child_process").execFileSync(process.execPath, [path.join(__dirname, "fetch-webview2.js")], { stdio: "inherit" }); } catch (e) { throw new Error("The WebView2 libraries are missing and could not be downloaded (run: node launcher/fetch-webview2.js). " + e.message); } }
  if (!fs.existsSync(CSC)) throw new Error("csc.exe not found at " + CSC + " (.NET Framework 4.x is part of Windows)");
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "lb_"));
  const name = o.name;
  const info = path.join(work, "AssemblyInfo.cs");
  fs.writeFileSync(info, "\ufeff" + [
    "using System.Reflection;",
    `[assembly: AssemblyTitle("${cs(name)}")]`, `[assembly: AssemblyDescription("${cs(name)}")]`, `[assembly: AssemblyCompany("")]`,
    `[assembly: AssemblyProduct("${cs(name)}")]`, `[assembly: AssemblyCopyright("")]`, `[assembly: AssemblyTrademark("")]`,
    `[assembly: AssemblyVersion("1.0.0.0")]`, `[assembly: AssemblyFileVersion("1.0.0.0")]`
  ].join("\n"), "utf8");
  const man = path.join(work, "app.manifest"); fs.writeFileSync(man, MANIFEST, "utf8");
  const out = o.outFile || path.join(work, (String(name).replace(/[^\w .-]/g, "").trim() || "app") + ".exe");
  const refs = ["System.dll", "System.Core.dll", "System.Drawing.dll", "System.Windows.Forms.dll", "System.Web.Extensions.dll"];
  const args = ["/nologo", "/target:winexe", "/platform:x64", "/optimize+", "/debug-", "/warn:3", "/out:" + out, "/win32manifest:" + man]
    .concat(refs.map(r => "/r:" + r))
    .concat(["/r:" + path.join(V, "Microsoft.Web.WebView2.Core.dll"), "/r:" + path.join(V, "Microsoft.Web.WebView2.WinForms.dll")])
    .concat(["/resource:" + path.join(V, "Microsoft.Web.WebView2.Core.dll") + ",Microsoft.Web.WebView2.Core.dll", "/resource:" + path.join(V, "Microsoft.Web.WebView2.WinForms.dll") + ",Microsoft.Web.WebView2.WinForms.dll", "/resource:" + path.join(V, "WebView2Loader.dll") + ",WebView2Loader.dll"])
    .concat([info, path.join(__dirname, "Launcher.cs")]);
  try { execFileSync(CSC, args, { stdio: "pipe", windowsHide: true }); }
  catch (e) { throw new Error("launcher compile failed:\n" + (e.stdout || "").toString() + (e.stderr || "").toString()); }
  return out;
}

module.exports = { buildLauncher };
if (require.main === module) { const p = buildLauncher({ name: process.argv[2] || "Test", outFile: process.argv[3] }); console.log(p, fs.statSync(p).size); }
