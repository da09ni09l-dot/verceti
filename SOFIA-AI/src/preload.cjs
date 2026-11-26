const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sofia", {
  open: (target) => ipcRenderer.invoke("sofia:open", target),
  search: (query) => ipcRenderer.invoke("sofia:search", query),
  shutdown: () => ipcRenderer.invoke("sofia:shutdown"),
  setListening: (enabled) => ipcRenderer.invoke("sofia:set-listening", enabled),
  onVoiceText: (callback) => ipcRenderer.on("sofia:voice-text", (_event, text) => callback(text)),
  onVoiceStatus: (callback) => ipcRenderer.on("sofia:voice-status", (_event, status) => callback(status)),
  onVoiceError: (callback) => ipcRenderer.on("sofia:voice-error", (_event, error) => callback(error)),
  cancelShutdown: () => ipcRenderer.invoke("sofia:cancel-shutdown"),
  minimize: () => ipcRenderer.send("sofia:minimize"),
  close: () => ipcRenderer.send("sofia:close"),
  hideForGame: () => ipcRenderer.send("sofia:hide-for-game"),
  show: () => ipcRenderer.send("sofia:show")
});
