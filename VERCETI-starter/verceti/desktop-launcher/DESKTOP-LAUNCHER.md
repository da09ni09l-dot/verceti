# VERCETTI LAUNCHER 2026

The desktop launcher opens the existing VERCETTI website (https://verceti.vercel.app/) in a dedicated Windows application window. The website remains the source of truth for its interface, login, Supabase data, and updates.

## Build a Windows installer

Requires Windows and Node.js 22:

```powershell
npm install
npm run dist:win
```

The installer is written to `release/VERCETTI-LAUNCHER-2026-Setup-2026.1.0.exe`.

## Build through GitHub Actions

Open Actions → Build VERCETTI Windows Launcher → Run workflow. The workflow builds the Windows installer on a GitHub-hosted Windows runner and uploads it as an artifact. It does not invoke Vercel and requires no Supabase secrets.

## Supabase security

Authentication, database access, and application features continue to use the existing website and its server-side Supabase configuration. No Supabase service-role key is packaged in the desktop app. The launcher is a desktop window for the existing website; it does not make the website or database work offline.
