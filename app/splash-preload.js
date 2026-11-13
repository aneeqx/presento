"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("splashApi", { skip: () => ipcRenderer.send("splash:skip") });
