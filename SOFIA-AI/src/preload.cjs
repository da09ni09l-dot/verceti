const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sofia", {
  open: (target) => ipcRenderer.invoke("sofia:open", target),
  shutdown: () => ipcRenderer.invoke("sofia:shutdown"),
  cancelShutdown: () => ipcRenderer.send("sofia:cancel-shutdown"),
  minimize: () => ipcRenderer.send("sofia:minimize"),
  close: () => ipcRenderer.send("sofia:close")
});
