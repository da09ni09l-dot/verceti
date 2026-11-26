/* eslint-disable @typescript-eslint/no-require-imports -- Electron entrypoint is CommonJS. */
const { app, BrowserWindow, shell, session } = require("electron");

const WEBSITE_URL = "https://verceti.vercel.app/";
const WEBSITE_HOST = new URL(WEBSITE_URL).hostname;
const WINDOW_BACKGROUND = "#09070f";
let mainWindow;

function isAppUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && url.hostname === WEBSITE_HOST;
  } catch {
    return false;
  }
}

function openExternal(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "https:" || url.protocol === "mailto:") {
      shell.openExternal(url.href);
    }
  } catch {
    // Ignore malformed or unsupported external URLs.
  }
}

function installMediaPermissions(appSession) {
  const appOrigin = new URL(WEBSITE_URL).origin;

  appSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      let requestingOrigin = "";
      try {
        requestingOrigin = new URL(details.requestingUrl).origin;
      } catch {
        callback(false);
        return;
      }

      const isApp = requestingOrigin === appOrigin;
      const isMicrophone = permission === "media" &&
        Array.isArray(details.mediaTypes) &&
        details.mediaTypes.includes("audio") &&
        !details.mediaTypes.includes("video");

      callback(isApp && (isMicrophone || permission === "notifications"));
    }
  );

  appSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) => {
      let origin = "";
      try {
        origin = new URL(requestingOrigin).origin;
      } catch {
        return false;
      }
      return origin === appOrigin &&
        (permission === "media" || permission === "notifications");
    }
  );
}

function installKeyboardShortcuts(window) {
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    const key = input.key.toLowerCase();
    const command = input.control || input.meta;

    if (input.key === "F5" || (command && key === "r")) {
      event.preventDefault();
      if (command && input.shift) window.webContents.reloadIgnoringCache();
      else window.webContents.reload();
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

function showOfflineScreen() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const html = `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VERCETI — немає з'єднання</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09070f;color:#f5efff;font:16px Inter,Segoe UI,sans-serif}
main{max-width:520px;padding:44px;text-align:center;border:1px solid #30233f;border-radius:22px;background:#110d19}
h1{letter-spacing:.22em;color:#d8baff}p{color:#b9adc7;line-height:1.6}
button{margin-top:16px;padding:13px 24px;border:0;border-radius:10px;background:#a66bff;color:#fff;font-weight:700;cursor:pointer}
</style>
</head>
<body><main><h1>VERCETI</h1><h2>Немає з'єднання з інтернетом</h2>
<p>Для роботи лаунчера потрібне підключення до мережі. Перевір інтернет і спробуй ще раз.</p>
<button onclick="location.href='https://verceti.vercel.app/'">Повторити підключення</button></main></body></html>`;
  mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 650,
    show: false,
    backgroundColor: WINDOW_BACKGROUND,
    autoHideMenuBar: true,
    title: "VERCETI",
    webPreferences: {
      partition: "persist:verceti",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // The download CTA belongs on the website, not inside the desktop launcher.
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.insertCSS(
      ".verceti-download-footer { display: none !important; }"
    ).catch(() => {});
  });

  installKeyboardShortcuts(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("data:text/html")) return;
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  mainWindow.webContents.on("will-redirect", (event, url) => {
    if (url.startsWith("data:text/html")) return;
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, _description, validatedURL, isMainFrame) => {
    if (isMainFrame && errorCode !== -3 && validatedURL.startsWith(WEBSITE_URL)) {
      showOfflineScreen();
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  await mainWindow.loadURL(WEBSITE_URL);
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.verceti.desktop");
  const appSession = session.fromPartition("persist:verceti");
  installMediaPermissions(appSession);
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
