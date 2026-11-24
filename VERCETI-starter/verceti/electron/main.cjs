const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const PORT = "3210";
const APP_URL = `http://127.0.0.1:${PORT}`;
let serverProcess;
let mainWindow;

function loadRuntimeEnvironment() {
  const envPath = path.join(app.getPath("userData"), ".env");
  if (!fs.existsSync(envPath)) {
    dialog.showErrorBox(
      "VERCETTI setup required",
      `Create the file below and add your Supabase server credentials:\n\n${envPath}\n\nUse DESKTOP-LAUNCHER.md as the setup guide.`
    );
    app.quit();
    return false;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }

  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    dialog.showErrorBox("VERCETTI setup incomplete", `Add these values to ${envPath}:\n\n${missing.join("\n")}`);
    app.quit();
    return false;
  }
  return true;
}

function startWebServer() {
  const serverPath = path.join(process.resourcesPath, "app", "server.js");
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT,
      HOSTNAME: "127.0.0.1",
    },
    stdio: "ignore",
    windowsHide: true,
  });
  serverProcess.on("error", (error) => console.error("VERCETTI server:", error));
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (serverProcess && serverProcess.exitCode !== null) throw new Error("VERCETTI server stopped during startup.");
    try {
      const response = await fetch(APP_URL);
      if (response.ok || response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error("VERCETTI took too long to start.");
}

async function createWindow() {
  if (!loadRuntimeEnvironment()) return;
  startWebServer();
  await waitForServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 650,
    show: false,
    backgroundColor: "#09070f",
    autoHideMenuBar: true,
    title: "VERCETTI LAUNCHER",
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  await mainWindow.loadURL(APP_URL);
}

app.whenReady().then(createWindow).catch((error) => {
  dialog.showErrorBox("VERCETTI could not start", error.message || String(error));
  app.quit();
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
