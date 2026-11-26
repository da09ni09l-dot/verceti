const { app, BrowserWindow, Menu, shell } = require("electron");

const WEBSITE_URL = "https://verceti.vercel.app/";
const WEBSITE_HOST = new URL(WEBSITE_URL).hostname;
const TRUSTED_AUTH_HOSTS = [".supabase.co", ".supabase.in"];
let mainWindow;

function isTrustedAppUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && (
      url.hostname === WEBSITE_HOST ||
      TRUSTED_AUTH_HOSTS.some((suffix) => url.hostname.endsWith(suffix))
    );
  } catch {
    return false;
  }
}

function openExternal(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:") {
      void shell.openExternal(rawUrl);
    }
  } catch {
    // Ignore malformed or unsupported URLs.
  }
}

function showConnectionError(window) {
  const html = `<!doctype html>
  <html lang="uk"><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VERCETI — немає з'єднання</title>
  <style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09070f;color:#f7f3ff;font:16px Inter,Segoe UI,sans-serif;padding:24px}
  main{max-width:480px;text-align:center;background:#151020;border:1px solid #302442;border-radius:24px;padding:40px 32px;box-shadow:0 24px 90px #0008}
  .mark{width:64px;height:64px;margin:0 auto 20px;border-radius:20px;display:grid;place-items:center;background:#241638;color:#c7a2ff;font-size:38px;font-weight:900}
  h1{letter-spacing:5px;margin:0 0 12px}p{color:#b5a9c8;line-height:1.6}
  button{margin-top:18px;border:0;border-radius:12px;padding:14px 24px;background:#7c3aed;color:white;font-weight:800;cursor:pointer}
  </style></head><body><main><div class="mark">V</div><h1>VERCETI</h1>
  <p>Не вдалося підключитися до VERCETI. Перевір інтернет-з'єднання та спробуй ще раз.</p>
  <button onclick="location.href='https://verceti.vercel.app/'">Спробувати ще раз</button></main></body></html>`;
  void window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

function installApplicationMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "VERCETI", submenu: [
      { label: "Головна", click: () => mainWindow?.loadURL(WEBSITE_URL) },
      { type: "separator" },
      { label: "Перезавантажити", accelerator: "CmdOrCtrl+R", click: () => mainWindow?.webContents.reload() },
      { label: "Перезавантажити без кешу", accelerator: "CmdOrCtrl+Shift+R", click: () => mainWindow?.webContents.reloadIgnoringCache() },
      { type: "separator" }, { role: "quit", label: "Вийти" }
    ]},
    { label: "Вигляд", submenu: [
      { role: "togglefullscreen", label: "На весь екран" }, { type: "separator" },
      { label: "Збільшити", accelerator: "CmdOrCtrl+Plus", click: () => mainWindow?.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel()+0.5) },
      { label: "Зменшити", accelerator: "CmdOrCtrl+-", click: () => mainWindow?.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel()-0.5) },
      { label: "Звичайний масштаб", accelerator: "CmdOrCtrl+0", click: () => mainWindow?.webContents.setZoomLevel(0) }
    ]},
    { label: "Навігація", submenu: [
      { label: "Назад", accelerator: "Alt+Left", click: () => { if (mainWindow?.webContents.canGoBack()) mainWindow.webContents.goBack(); } },
      { label: "Вперед", accelerator: "Alt+Right", click: () => { if (mainWindow?.webContents.canGoForward()) mainWindow.webContents.goForward(); } }
    ]}
  ]));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 960, minHeight: 640,
    show: false, backgroundColor: "#09070f", autoHideMenuBar: false, title: "VERCETI",
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedAppUrl(url)) openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedAppUrl(url)) { event.preventDefault(); openExternal(url); }
  });
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, _description, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3 && mainWindow && !mainWindow.isDestroyed()) showConnectionError(mainWindow);
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
  void mainWindow.loadURL(WEBSITE_URL).catch(() => {
    if (mainWindow && !mainWindow.isDestroyed()) showConnectionError(mainWindow);
  });
}

app.setAppUserModelId("com.vercetti.launcher");
app.whenReady().then(() => {
  installApplicationMenu();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
