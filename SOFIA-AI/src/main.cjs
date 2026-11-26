const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { execFile } = require("node:child_process");
const path = require("node:path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 520,
    minWidth: 320,
    minHeight: 420,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: false,
    show: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("sofia:open", async (_event, target) => {
  const allowed = {
    youtube: "https://www.youtube.com",
    music: "https://music.youtube.com",
    search: "https://www.google.com"
  };
  const url = allowed[target];
  if (!url) return { ok: false, error: "Команда не дозволена" };
  await shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle("sofia:shutdown", async () => {
  if (process.platform !== "win32") return { ok: false, error: "Підтримується лише Windows" };
  execFile("shutdown.exe", ["/s", "/t", "30"]);
  return { ok: true };
});

ipcMain.on("sofia:cancel-shutdown", () => {
  if (process.platform === "win32") execFile("shutdown.exe", ["/a"]);
});

ipcMain.on("sofia:minimize", () => mainWindow?.minimize());
ipcMain.on("sofia:close", () => mainWindow?.hide());

app.whenReady().then(createWindow);
app.on("window-all-closed", (event) => {
  // Keep the assistant alive in the background on Windows.
  if (process.platform !== "win32") app.quit();
});
