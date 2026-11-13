# Network share and installer

## Share on network (`app/lib/share.js`, rail Share button)
* A plain HTTP server on the chosen LAN adapter (menu lists every IPv4 adapter), random port, **Range support** (video seeks), serves the project compiled in Desktop or Touch with the optional **PIN gate** (same gate as the ZIP export: casual viewers only). It re-compiles when `project.json` changes, so reloading shows edits.
* Real QR code (bundled `qrcode-generator`), copyable link, "watching now" list (device label from the User-Agent, last seen; live = seen in the last 45 s), firewall chip (read from Windows Firewall without admin: allowed / off / "allow Presento in the Windows prompt"), Stop. Rail icon turns accent and the top bar shows "sharing · n watching". It stops when Presento closes.
* Not possible without admin: the app cannot add its own firewall rule; on first start Windows asks, and a standard user may need an admin to approve.

## Installer (`app/package.json` "build", `npm run dist` in `app/`)
* electron-builder NSIS, **per-user, no admin**: `%LOCALAPPDATA%\Programs\Presento`, Start menu + desktop shortcut, uninstaller, "Presento" in Apps & features. Output: `app/dist/Presento Setup 0.1.0.exe` (≈122 MB, unsigned, default Electron icon: no icon or code-signing certificate yet).
* The engine ships as `resources/core`, `exporters`, `runtime`, `launcher`, `tests/open_check.py` next to the app archive (same relative layout as the repo).
* Projects default to `Documents\Presento Projects` (home screen "Projects folder" changes it). They are never inside the install folder and the uninstaller never touches them or `Documents`.
* On a PC without `uv`/Playwright the export check "opens without errors" reports *skipped*, never passed.
