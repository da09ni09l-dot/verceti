# VERCETI Windows launcher

This Electron application opens the live VERCETI website in a standalone Windows desktop window. It uses the same account, backend, and role permissions as the website.

Build on Windows with Node.js 22:

```powershell
npm install
npm run dist:win
```

The installer is created in `release/`. For an automated Windows build, push changes on a `launcher/*` branch or manually run the repository's **Build VERCETI Windows Launcher** GitHub Actions workflow.
