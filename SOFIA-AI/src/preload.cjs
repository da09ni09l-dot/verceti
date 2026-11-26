const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sofia", {
  open: (target) => ipcRenderer.invoke("sofia:open", target),
  search: (query) => ipcRenderer.invoke("sofia:search", query),
  shutdown: () => ipcRenderer.invoke("sofia:shutdown"),
  cancelShutdown: () => ipcRenderer.invoke("sofia:cancel-shutdown"),
  minimize: () => ipcRenderer.send("sofia:minimize"),
  close: () => ipcRenderer.send("sofia:close"),
  hideForGame: () => ipcRenderer.send("sofia:hide-for-game"),
  show: () => ipcRenderer.send("sofia:show")
});
