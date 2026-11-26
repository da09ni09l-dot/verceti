# SOFIA AI — Windows desktop assistant

SOFIA AI is an early Windows 11 desktop companion prototype. It is designed to sit quietly on the desktop, listen for the wake phrase **“Софія”**, and then accept a short spoken command.

## Current prototype scope
- Electron desktop shell with a compact, always-available avatar window.
- Ukrainian voice activation and speech output using the browser Speech Recognition / Speech Synthesis APIs.
- Starter command set: open YouTube, open YouTube Music, tell the time, and request Windows shutdown.
- Shutdown is never immediate: Sofia asks for an explicit on-screen confirmation first.
- The window can be hidden/minimized while a full-screen game is active; a later milestone will add reliable game detection and tray controls.

## Important limitations
- The first voice prototype uses the Web Speech API. Speech recognition may send audio to the browser/platform speech service and requires an internet connection; it is **not** offline/private wake-word detection.
- The wake phrase is detected by continuous speech recognition, so microphone permission must be granted while the app is running.
- Do not run the app with elevated privileges. Shutdown is an explicit, delayed OS command after confirmation.
- This is a starter implementation, not a finished installer or a full conversational AI. LLM chat, offline wake-word detection, a polished 3D avatar, game detection, and installer signing are planned milestones.

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

## Roadmap
1. Desktop shell + wake phrase + safe starter commands.
2. Reliable background/tray behavior and game-aware quiet mode.
3. Offline wake-word engine and configurable speech provider.
4. Conversational AI with explicit privacy/settings controls.
5. Animated character, expressions, voice selection, and installer polish.
