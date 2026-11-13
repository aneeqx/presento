"use strict";
const { contextBridge, ipcRenderer, webUtils } = require("electron");

const call = async (name, ...args) => {
  const r = await ipcRenderer.invoke(name, ...args);
  if (!r.ok) throw new Error(r.error);
  return r.v;
};
const on = (ch, fn) => { const h = (_e, d) => fn(d); ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h); };

contextBridge.exposeInMainWorld("api", {
  appReady: () => ipcRenderer.send("app:ready"),
  info: () => call("app:info"),
  listProjects: () => call("projects:list"),
  createProject: (o) => call("projects:create", o),
  duplicateProject: (d) => call("projects:duplicate", d),
  renameProject: (d, n) => call("projects:rename", d, n),
  deleteProject: (d) => call("projects:delete", d),
  setRoot: () => call("projects:setRoot"),
  openFolder: () => call("projects:openFolder"),
  load: (d) => call("project:load", d),
  save: (d, p) => call("project:save", d, p),
  reveal: (p) => call("shell:reveal", p),
  openPath: (p) => call("shell:open", p),
  pick: (o) => call("dialog:pick", o),
  pathOf: (file) => webUtils.getPathForFile(file),                       // drag-and-drop: real path of a dropped File
  importMedia: (o) => call("media:import", o),
  cancelImport: () => call("media:cancel"),
  removeMedia: (d, rels) => call("media:remove", d, rels),
  videoFrame: (o) => call("video:frame", o),
  probeVideo: (o) => call("video:probe", o),
  crop: (o) => call("image:crop", o),
  publishPreview: (o) => call("preview:publish", o),
  estimate: (o) => call("export:estimate", o),
  runExport: (o) => call("export:run", o),
  cancelExport: () => call("export:cancel"),
  importPdf: (o) => call("pdf:import", o),
  cancelPdf: () => call("pdf:cancel"),
  readFile: (p) => call("file:read", p),
  testUrl: (u) => call("url:test", u),
  onPdfProgress: (fn) => on("pdf:progress", fn),
  shareStart: (o) => call("share:start", o),
  shareStop: () => call("share:stop"),
  shareStatus: () => call("share:status"),
  shareQr: (t) => call("share:qr", t),
  onImportProgress: (fn) => on("media:progress", fn),
  onExportStep: (fn) => on("export:step", fn),
  onExportProgress: (fn) => on("export:progress", fn)
});
