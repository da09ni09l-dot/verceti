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
