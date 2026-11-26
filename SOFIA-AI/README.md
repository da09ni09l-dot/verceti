# SOFIA AI — Windows desktop assistant

SOFIA AI is an early Windows 11 desktop companion prototype. It listens for the Ukrainian wake phrase **“Софія”** and accepts a small set of spoken commands.

## Implemented in this prototype
- Electron desktop window with a stylized avatar.
- Starts speech recognition automatically when the app window loads (the user must grant microphone permission on first use); there is no activation button.
- Hides to the background when the window is closed; the process stays running on Windows.
- Registers the app to launch at Windows sign-in.
- Basic tray menu actions to reopen the assistant or exit.
- Ukrainian speech output using the system's available Ukrainian voice.
- Commands: open YouTube, YouTube Music, default browser, File Explorer, Windows Settings, Calculator, Notepad; web search; tell the time.
- Shutdown requires one explicit on-screen click and then schedules shutdown after 30 seconds.

## Important limitations — read before use
- Wake-word detection currently relies on the browser **Web Speech API**. It is not an offline wake-word engine and recognition may send audio to a platform speech service. Do not treat it as a private/local-only microphone pipeline.
- Microphone permission and a working speech recognition service are required. Browser speech recognition may stop or behave differently across Windows systems; automatic restart is best-effort.
- This build does **not** yet implement full natural conversation, arbitrary PC control, file management, Bluetooth/Wi-Fi settings, reliable game/full-screen detection, or a production 3D avatar.
- Full-screen game hiding is not yet implemented. The app can be hidden manually and remains in the background.
- The tray icon and microphone behavior must be tested on a real Windows 11 PC before release. Hiding the window does not guarantee that the underlying Web Speech service remains continuously active.
- Do not run the app with elevated privileges. Potentially destructive OS actions must remain allowlisted and explicitly confirmed.

## Development
Requires Node.js 20+ and Windows 10/11 (Windows 11 recommended).

```powershell
cd SOFIA-AI
npm install
npm start
```

## Build Windows installer
```powershell
npm run dist
```

The installer output is written to `dist/`.

## Next milestones
1. Replace Web Speech API wake detection with an offline local wake-word engine.
2. Add robust tray icon, audio-device handling, and full-screen/game-aware quiet mode.
3. Add a conversational AI layer with clear privacy controls.
4. Expand Windows commands through a strict allowlist and one-step visual confirmations for risky actions.
5. Replace the stylized CSS avatar with an animated character and polish the installer.
