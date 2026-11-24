const { app, BrowserWindow, shell } = require("electron");

const WEBSITE_URL = "https://verceti.vercel.app/";
const WEBSITE_HOST = new URL(WEBSITE_URL).hostname;
let mainWindow;

function isTrustedAppUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && (
      url.hostname === WEBSITE_HOST ||
      url.hostname.endsWith(".supabase.co") ||
      url.hostname.endsWith(".supabase.in")
    );
  } catch {
    return false;
  }
}

function installKeyboardShortcuts(window) {
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    const key = input.key.toLowerCase();
    const command = input.control || input.meta;

    if (input.key === "F5" || (command && key === "r")) {
      event.preventDefault();
      if (command && input.shift) {
        window.webContents.reloadIgnoringCache();
      } else {
        window.webContents.reload();
      }
      return;
    }

    if (command && key === "0") {
      event.preventDefault();
      window.webContents.setZoomLevel(0);
    } else if (command && (key === "+" || key === "=")) {
      event.preventDefault();
      window.webContents.setZoomLevel(window.webContents.getZoomLevel() + 0.5);
    } else if (command && key === "-") {
      event.preventDefault();
      window.webContents.setZoomLevel(window.webContents.getZoomLevel() - 0.5);
    } else if (input.alt && input.key === "ArrowLeft" && window.webContents.canGoBack()) {
      event.preventDefault();
      window.webContents.goBack();
    } else if (input.alt && input.key === "ArrowRight" && window.webContents.canGoForward()) {
      event.preventDefault();
      window.webContents.goForward();
    }
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 650,
    show: false,
    backgroundColor: "#09070f",
    autoHideMenuBar: true,
    title: "VERCETTI",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  installKeyboardShortcuts(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedAppUrl(url)) {
      event.preventDefault();
      if (url.startsWith("https://")) shell.openExternal(url);
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  await mainWindow.loadURL(WEBSITE_URL);
}

app.whenReady().then(createWindow);
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
