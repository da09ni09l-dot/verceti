/* eslint-disable @typescript-eslint/no-require-imports -- Electron entrypoint is CommonJS. */
const { app, BrowserWindow, shell, desktopCapturer, dialog, session } = require("electron");

const WEBSITE_URL = "https://verceti.vercel.app/";
const WEBSITE_HOST = new URL(WEBSITE_URL).hostname;
const APP_PARTITION = "persist:verceti";
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

function installMediaPermissions(appSession) {
  appSession.setPermissionCheckHandler((webContents, permission, origin) => {
    if (!webContents || !isTrustedAppUrl(origin)) return false;
    return ["media", "display-capture", "notifications"].includes(permission);
  });

  appSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const allowedOrigin = webContents && isTrustedAppUrl(details.requestingUrl || webContents.getURL());
    const allowedPermission = ["media", "display-capture", "notifications"].includes(permission);
    callback(Boolean(allowedOrigin && allowedPermission));
  });

  // Electron needs an explicit display-media handler for getDisplayMedia().
  // Let the user choose a screen or application window before capture starts.
  appSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        fetchWindowIcons: true,
      });
      if (sources.length === 0) {
        callback({});
        return;
      }

      const labels = sources.map((source) => source.name.slice(0, 80));
      const choice = await dialog.showMessageBox(mainWindow, {
        type: "question",
        title: "VERCETI — демонстрація екрана",
        message: "Оберіть екран або вікно для демонстрації:",
        buttons: [...labels, "Скасувати"],
        cancelId: labels.length,
        defaultId: 0,
        noLink: true,
      });

      if (choice.response >= sources.length) {
        callback({});
        return;
      }

      callback({ video: sources[choice.response] });
    } catch (error) {
      console.error("VERCETI screen capture setup failed:", error);
      callback({});
    }
  });
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
    title: "VERCETI",
    webPreferences: {
      partition: APP_PARTITION,
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

app.whenReady().then(() => {
  installMediaPermissions(session.fromPartition(APP_PARTITION));
  return createWindow();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
