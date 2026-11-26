const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require("electron");
const { execFile, spawn } = require("node:child_process");
const readline = require("node:readline");
const fs = require("node:fs");
const path = require("node:path");

let mainWindow;
let tray;
let voiceProcess;
let voiceEnabled = true;
let voiceRestartTimer;

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

function sendVoiceEvent(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
}

function voiceExecutablePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "sofia-listener", "sofia-listener.exe")
    : path.join(__dirname, "..", "voice", "dist", "sofia-listener", "sofia-listener.exe");
}

function stopVoiceListener() {
  voiceEnabled = false;
  if (voiceRestartTimer) clearTimeout(voiceRestartTimer);
  voiceRestartTimer = null;
  if (voiceProcess) {
    const child = voiceProcess;
    voiceProcess = null;
    child.kill();
  }
  sendVoiceEvent("sofia:voice-status", { active: false, message: "Мікрофон на паузі." });
}

function startVoiceListener() {
  voiceEnabled = true;
  if (voiceProcess || app.isQuitting) return { ok: true };
  const executable = voiceExecutablePath();
  if (!fs.existsSync(executable)) {
    const message = "Локальний голосовий модуль ще не зібраний. Потрібно встановити повну збірку SOFIA AI.";
    sendVoiceEvent("sofia:voice-error", { message });
    return { ok: false, error: message };
  }

  const child = spawn(executable, [], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  voiceProcess = child;
  const lines = readline.createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const event = JSON.parse(line);
      if (event.type === "transcript" && typeof event.text === "string") {
        sendVoiceEvent("sofia:voice-text", event.text);
      } else if (event.type === "status") {
        sendVoiceEvent("sofia:voice-status", { active: true, message: event.message });
      } else if (event.type === "error") {
        sendVoiceEvent("sofia:voice-error", { message: event.message });
      }
    } catch {
      console.warn("Ignoring invalid voice listener output.");
    }
  });
  child.stderr.on("data", (chunk) => console.warn("SOFIA voice:", String(chunk).trim()));
  child.on("error", (error) => {
    if (voiceProcess === child) voiceProcess = null;
    sendVoiceEvent("sofia:voice-error", { message: "Не вдалося запустити локальний голосовий модуль: " + error.message });
  });
  child.on("close", (code) => {
    if (voiceProcess === child) voiceProcess = null;
    if (voiceEnabled && !app.isQuitting && code !== 0) {
      sendVoiceEvent("sofia:voice-error", { message: "Голосовий модуль зупинився. Спробую запустити його знову." });
      voiceRestartTimer = setTimeout(startVoiceListener, 3000);
    }
  });
  return { ok: true };
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
  // A real, visible SVG icon avoids creating an empty native tray image on Windows.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c58bff"/><stop offset="1" stop-color="#7651c8"/></linearGradient></defs><circle cx="16" cy="16" r="15" fill="#211b3b" stroke="url(#g)" stroke-width="2"/><path d="M10 10h12v3h-4.5v10h-3V13H10z" fill="#fff"/></svg>';
  tray = new Tray(nativeImage.createFromDataURL("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)));
  tray.setToolTip("SOFIA AI — голосовий помічник");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Відкрити Софію", click: showWindow },
    { type: "separator" },
    { label: "Вийти з SOFIA AI", click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  tray.on("double-click", showWindow);
}

ipcMain.handle("sofia:open", async (_event, target) => {
  const fixed = {
    youtube: "https://www.youtube.com",
    music: "https://music.youtube.com",
    google: "https://www.google.com",
    browser: "https://www.google.com"
  };
  if (target === "calculator" || target === "notepad" || target === "explorer" || target === "settings") {
    const commands = {
      calculator: ["calc.exe", []],
      notepad: ["notepad.exe", []],
      explorer: ["explorer.exe", []],
      settings: ["explorer.exe", ["ms-settings:"]]
    };
    const [executable, args] = commands[target];
    return await new Promise((resolve) => {
      execFile(executable, args, (error) => {
        if (error) {
          console.error(`Failed to open ${target}:`, error.message);
          resolve({ ok: false, error: `Не вдалося відкрити ${target}.` });
          return;
        }
        resolve({ ok: true });
      });
    });
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
  return await new Promise((resolve) => {
    execFile("shutdown.exe", ["/s", "/t", "30"], (error) => {
      if (error) {
        console.error("Failed to schedule shutdown:", error.message);
        resolve({ ok: false, error: "Windows не змогла запланувати вимкнення." });
        return;
      }
      resolve({ ok: true });
    });
  });
});
ipcMain.handle("sofia:set-listening", async (_event, enabled) => {
  if (typeof enabled !== "boolean") return { ok: false, error: "Некоректний стан мікрофона." };
  if (enabled) return startVoiceListener();
  stopVoiceListener();
  return { ok: true };
});
ipcMain.handle("sofia:cancel-shutdown", async () => {
  if (process.platform !== "win32") return { ok: false, error: "Підтримується лише Windows." };
  return await new Promise((resolve) => {
    execFile("shutdown.exe", ["/a"], (error) => {
      if (error) {
        resolve({ ok: false, error: "Не вдалося скасувати вимкнення. Можливо, таймер не був запущений." });
        return;
      }
      resolve({ ok: true });
    });
  });
});
ipcMain.on("sofia:minimize", () => mainWindow?.minimize());
ipcMain.on("sofia:close", () => mainWindow?.hide());
ipcMain.on("sofia:hide-for-game", () => mainWindow?.hide());
ipcMain.on("sofia:show", () => showWindow());

app.whenReady().then(() => {
  // Allow microphone access only to this app's bundled local UI.
  const { session } = require("electron");
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const isLocalApp = webContents.getURL().startsWith("file://");
    callback(isLocalApp && permission === "media");
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const isLocalApp = webContents?.getURL().startsWith("file://");
    return Boolean(isLocalApp && permission === "media");
  });
  createWindow();
  mainWindow.webContents.once("did-finish-load", () => startVoiceListener());
  createTray();
  if (process.platform === "win32") app.setLoginItemSettings({ openAtLogin: true });
});
app.on("activate", showWindow);
app.on("before-quit", () => { app.isQuitting = true; stopVoiceListener(); });
app.on("window-all-closed", () => {
  // Intentionally keep the app alive in the tray on Windows.
});
