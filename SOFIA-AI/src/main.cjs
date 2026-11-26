const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, session } = require("electron");
const { execFile } = require("node:child_process");
const path = require("node:path");

let mainWindow;
let tray;
let quitting = false;

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#8e65d8"/><text x="16" y="22" font-size="19" text-anchor="middle" fill="white" font-family="Arial">S</text></svg>';
  tray = new Tray(nativeImage.createFromDataURL("data:image/svg+xml;base64," + Buffer.from(svg).toString("base64")));
  tray.setToolTip("SOFIA AI — голосовий помічник");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Показати Софію", click: showWindow },
    { label: "Запускати разом із Windows", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: "separator" },
    { label: "Вийти із SOFIA AI", click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on("click", showWindow);
}

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
  mainWindow.on("close", (event) => {
    if (!quitting && process.platform === "win32") {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
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
  execFile("shutdown.exe", ["/s", "/t", "30"], (error) => {
    if (error) console.error("Shutdown command failed:", error.message);
  });
  return { ok: true };
});

ipcMain.on("sofia:cancel-shutdown", () => {
  if (process.platform === "win32") execFile("shutdown.exe", ["/a"]);
});

ipcMain.on("sofia:minimize", () => mainWindow?.minimize());
ipcMain.on("sofia:close", () => mainWindow?.hide());
ipcMain.on("sofia:show", showWindow);

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });
  if (process.platform === "win32") app.setLoginItemSettings({ openAtLogin: true });
  createTray();
  createWindow();
});

app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => {
  if (process.platform !== "win32") app.quit();
});
