const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require("electron");
const { execFile } = require("node:child_process");
const path = require("node:path");

let mainWindow;
let tray;

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360, height: 540, minWidth: 320, minHeight: 420,
    frame: false, transparent: true, resizable: true,
    alwaysOnTop: false, show: true, backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  if (tray) return;
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip("SOFIA AI — голосовий помічник");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Відкрити Софію", click: showWindow },
    { label: "Вийти", click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  tray.on("double-click", showWindow);
}

ipcMain.handle("sofia:open", async (_event, target) => {
  const fixed = {
    youtube: "https://www.youtube.com",
    music: "https://music.youtube.com",
    google: "https://www.google.com",
    calculator: null,
    notepad: null
  };
  if (target === "calculator" || target === "notepad") {
    const executable = target === "calculator" ? "calc.exe" : "notepad.exe";
    execFile(executable, [], (error) => {});
    return { ok: true };
  }
  const url = fixed[target];
  if (!url) return { ok: false, error: "Цю дію не дозволено." };
  await shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle("sofia:search", async (_event, query) => {
  if (typeof query !== "string" || !query.trim() || query.length > 300) {
    return { ok: false, error: "Пошуковий запит некоректний." };
  }
  await shell.openExternal("https://www.google.com/search?q=" + encodeURIComponent(query.trim()));
  return { ok: true };
});

ipcMain.handle("sofia:shutdown", async () => {
  if (process.platform !== "win32") return { ok: false, error: "Підтримується лише Windows." };
  execFile("shutdown.exe", ["/s", "/t", "30"], (error) => {});
  return { ok: true };
});
ipcMain.on("sofia:cancel-shutdown", () => {
  if (process.platform === "win32") execFile("shutdown.exe", ["/a"], () => {});
});
ipcMain.on("sofia:minimize", () => mainWindow?.minimize());
ipcMain.on("sofia:close", () => mainWindow?.hide());

app.whenReady().then(() => {
  createWindow();
  createTray();
  if (process.platform === "win32") app.setLoginItemSettings({ openAtLogin: true });
});
app.on("activate", showWindow);
app.on("window-all-closed", () => {
  // Keep the assistant process and tray alive on Windows.
});
