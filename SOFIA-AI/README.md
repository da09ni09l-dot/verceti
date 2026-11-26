# SOFIA AI — Windows desktop assistant

SOFIA AI is an early Windows 11 desktop companion prototype with a Ukrainian voice interface.

## Included in the current Windows build

- Electron desktop window with a stylized animated CSS avatar.
- Local Ukrainian speech recognition using Vosk and the `vosk-model-small-uk-v3-nano` model. The microphone audio is processed on the PC; the wake-word listener does not stream audio to a cloud speech service.
- Background listener runs as a separate bundled process and can keep listening while the avatar window is hidden or while a game is in the foreground. Actual microphone availability still depends on Windows privacy settings and the selected input device.
- Wake phrase **«Софія»**, followed by a spoken command.
- Tray behavior: closing the window hides the assistant; the app can be restored from the tray.
- Launch at Windows sign-in.
- Ukrainian text-to-speech using an available Windows voice.
- Voice commands: open YouTube, YouTube Music, default browser, File Explorer, Windows Settings, Calculator, Notepad; web search; tell the time; hide/show the avatar for game mode.
- Shutdown requires one explicit on-screen click and schedules shutdown after 30 seconds. Cancellation reports whether Windows accepted the request.
- The microphone can be paused and resumed from the window.

## Important limitations

- This is not yet a full conversational AI assistant. Unknown spoken requests are acknowledged but not answered with an LLM.
- The supported Windows actions are a small allowlist; arbitrary file operations, Bluetooth/Wi-Fi controls, volume/brightness control, and unrestricted system control are not implemented.
- Game mode hides the avatar on voice command; automatic full-screen/game detection is not implemented.
- The avatar is a CSS illustration, not a production 3D character.
- Speech recognition is local. Web searches intentionally open Google in the default browser; those searches use the internet.
- The first Windows installer includes the Ukrainian Vosk model and is therefore larger than a basic Electron app.
- The microphone listener and audio device behavior still need real-world testing on Windows 11 hardware. Windows microphone privacy settings must allow desktop applications to access the microphone.

## Development

Requires Node.js 20+ and Python 3.11+ on Windows.

```powershell
cd SOFIA-AI
npm install
npm start
```

The local voice sidecar must first be built using the Windows workflow steps: install `voice/requirements.txt`, download and extract the Ukrainian Vosk model, then run PyInstaller as configured in `.github/workflows/build-sofia-windows.yml`.

## Build Windows installer

The GitHub Actions workflow **Build SOFIA AI for Windows** prepares the offline voice engine and model, then builds the NSIS installer. The resulting artifact is named `sofia-ai-windows-installer`.

```powershell
npm run dist
```

## Remaining milestones

1. Add a natural conversational AI layer with clear privacy controls.
2. Expand Windows actions safely through a strict allowlist and one-step visual confirmations for risky operations.
3. Add robust automatic full-screen/game detection and device selection.
4. Improve the avatar, voice options, installer polish, and test coverage.
