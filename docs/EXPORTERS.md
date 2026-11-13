# Exporters (step 2)

```
node exporters/cli.js <projectDir> <zip|html|exe> --out <file (exe: folder)> [--mode desktop|touch] [--pin 1234] [--include a,b/c] [--no-browser] [--zip]
```

Every exporter takes the same options: optional **4-digit PIN**, per-section **include** list (`sectionId` or `sectionId/childId`; default everything),
**mode** `desktop` (pointer) or `touch`. Each ends with an automatic **post-export check** (below). Exit code 3 = a check failed.

| format | what it is | PIN | size |
|---|---|---|---|
| `zip` | `<Name> - Desktop/` with `index.html`, `css/`, `js/`, `vendor/`, `content/` (same layout as the hand-built exports). ZIP64-capable, media stored (not recompressed) | gate screen only; files stay readable | ≈ media size |
| `html` | one `.html`: css/js inlined, every media file base64 in `<script type="application/x-b64">` blocks, decoded lazily to `blob:` URLs (video seeks) | gate screen only | ≈ 1.34 × media; **warn > 300 MB, refuse > 1 GB** (`estimateHtml()` gives the number before exporting) |
| `exe` | a folder `<Name>/` with `<Name>.exe` (0.8 MB WebView2 launcher, fullscreen kiosk, PIN screen in the presentation's style) + `<Name>.data` (AES-256-CTR encrypted media). `--zip` also writes `<Name>.zip` of the folder | real: key = PBKDF2-SHA256(PIN, 200 000 iterations) | 0.8 MB + media |

## Post-export check

1. archive/container structure valid;
2. every expected file present and **byte-identical** to its source (CRC for the zip, MD5 of the decrypted bytes for the exe and html);
3. **resolutions intact**: pixel size of every image read back out of the finished export and compared with the original;
4. **no forbidden word** (any case, ASCII and UTF-16) in names, text, media bytes, and for the exe also the launcher binary and its version info;
5. exe only: wrong PIN rejected, right PIN opens, exe properties (product/description = the presentation name, company/copyright empty) read back from the file;
6. **opens without errors**: the export is opened in a real browser (`tests/open_check.py`; exe through its own WebView2 over CDP), the PIN is typed into the gate, the landing page is reached and every section and sub-section is opened; page errors, failed requests and broken images fail the check. Needs `uv` + Playwright + Chrome; if missing it is reported as *skipped*, never as passed.

## PIN honesty

4 digits = 10 000 possibilities. zip/html: the gate stops casual viewers only. exe: media is genuinely encrypted, but 10 000 × 200 000-iteration PBKDF2 is still within reach of someone determined. No PIN: the exe still packs the payload, but with a fixed key, so it is obfuscation, not protection.

## Exe + data file: how it is built (`launcher/`)

Why two files: some endpoint-protection products block or delete an exe that has a large payload appended to it, while a small launcher next to a separate data file is left alone. Keep both files together; copy or zip the folder.

* `Launcher.cs` is C# 5 for **.NET Framework 4.x** (part of Windows 10/11), compiled by the `csc.exe` that ships with Windows (no SDK, nothing installed). The managed WebView2 libraries and the native loader (official `Microsoft.Web.WebView2` 1.0.2849.39 NuGet package, in `launcher/vendor/` with its licence) are embedded; only the 165 KB native loader is extracted to `%TEMP%`.
* `launcher/build.js` compiles it per export so **product name / title / description = the presentation's name** (company, copyright, trademark empty; file name `<Name>.exe`).
* **Finding the data:** `<exe name>.data` beside the exe; if the exe was renamed and exactly one `*.data` is beside it, that one. If none: a small styled window ("The presentation data is missing. Keep <Name>.data in the same folder as this app…") and exit code 2. (The window opens; I did not inspect its look visually.)
* Media is served at `https://content.local/` via WebView2 `WebResourceRequested` (no TCP port). **Range requests** get 206 + `Content-Range`; media ranges are capped at 8 MB per response so memory stays flat. Decryption is AES-CTR (random access); a 2 GB file is never loaded (launcher ≈ 65 MB).
* **Kiosk (normal launch, verified on this PC):** borderless, covers the whole screen (0,0 to 1920×1080), topmost, window title = name. The viewer's "Click to start" requests page fullscreen; a real **Esc** leaves page fullscreen and the app stays open; **Alt+F4** closes the app. There is no on-screen close button by design.
* Test aids: `--windowed` (normal 1280×720 window with DevTools), `--payload <file>` (explicit data file). WebView2 data goes to a temp folder deleted on exit.

### Data file layout

```
[header 108 B][gate page][ AES-256-CTR( index JSON | file 1 | file 2 | … ) ][footer 24 B]
header : "PKG1BLOB" u32 version, u32 flags(bit0 = PIN), u32 iterations, u32 0, salt[16], iv[16], u64 indexLen, u64 regionLen, HMAC-SHA256(indexJSON)[32], u32 gateLen
footer : u64 blobStart, u64 blobLen, "PKGEND01"      (the launcher finds the blob from the END: fileLength - 24 - blobLen)
keys   : PBKDF2-SHA256(pin, salt, iterations) -> 64 bytes = AES key | HMAC key ; CTR counter = iv + (byteOffset / 16), 128-bit big-endian
index  : {"name", "bg", "files":[{"p": path, "o": offset after the index, "l": length, "t": mime}]}
```
The PIN is checked by authenticating the decrypted index (HMAC). The gate page is the only unencrypted part (name, colours, logo).

## Known limits
* The WebView2 Runtime is required (built into Windows 11, installed with Edge on Windows 10).
* An unsigned exe shows "unknown publisher" in SmartScreen; endpoint protection may still flag the launcher. Signing the exe with a code-signing certificate is the fix.
* The data file is only obfuscation when no PIN is set (fixed key).
