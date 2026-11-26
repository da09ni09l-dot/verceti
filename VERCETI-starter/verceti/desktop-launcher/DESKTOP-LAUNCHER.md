# VERCETI Windows desktop launcher

VERCETI runs in a dedicated Windows desktop window powered by Electron. The launcher opens the live application at https://verceti.vercel.app/ and therefore uses the same website interface, account, roles, Supabase-backed records, and server-side authorization as the web version.

## Included application areas

The launcher exposes the same sections and capabilities available to the signed-in account on the website, including profiles and roles, community home and activity ranking, rewards roulette and spin history, workshop bookings, vacation requests, applications/questionnaires, and staff tools. Access remains role- and RLS-controlled by the website/backend; the desktop app does not grant extra privileges.

The launcher is an online desktop client, not a separate offline implementation. Changes made in the launcher and website use the same backend and stay synchronized. Website releases are available in the launcher without rebuilding the installer.

## Windows installer

Requirements: Windows 10/11 and Node.js 22.

```powershell
npm install
npm run dist:win
```

The NSIS installer is written to `release/VERCETI-LAUNCHER-2026-Setup-2026.2.0.exe`.

## Build with GitHub Actions

Push changes under this directory to a branch named `launcher/*`, or manually run **Actions → Build VERCETI Windows Launcher → Run workflow**. The Windows workflow uploads the installer as the artifact `VERCETI-LAUNCHER-2026-Windows`.

## Security

- Node integration is disabled; context isolation, sandboxing, and web security are enabled.
- Only the VERCETI website and required Supabase HTTPS hosts can navigate inside the app.
- Other web links open in the system browser.
- No Supabase service-role key or server secret is bundled in the installer.
- Login, database access, role checks, and RLS remain on the existing website/backend.
