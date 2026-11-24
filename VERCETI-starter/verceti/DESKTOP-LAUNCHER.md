# VERCETTI LAUNCHER 2026

The Windows desktop package wraps the existing VERCETTI Next.js application in Electron. The Next.js standalone server runs locally on the user's PC; no Vercel deployment is needed.

## Build a Windows installer locally

Requires Windows and Node.js 22:

```powershell
npm install
npm run dist:win
```

The installer is written to `release/VERCETTI-LAUNCHER-2026-Setup-2026.1.0.exe`.

## Build with GitHub Actions

Add the following repository Actions secrets before running **Actions → Build VERCETTI Windows Launcher → Run workflow**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_LIVEKIT_URL` (optional if voice rooms are not configured)

The workflow builds on a GitHub-hosted Windows runner and uploads the EXE as an artifact. It does not use Vercel build minutes.

## First launch configuration

The desktop app asks for a local runtime environment file. Create:

`%APPDATA%\\vercetti-launcher\\.env`

Put the server-side values in that file (do not commit it or share it):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_LIVEKIT_URL=wss://YOUR_LIVEKIT_HOST
LIVEKIT_API_KEY=YOUR_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_API_SECRET
JAMENDO_CLIENT_ID=YOUR_JAMENDO_CLIENT_ID
```

Only include optional service values when configured. Treat the service-role and LiveKit secret as highly sensitive. The launcher runs the Next.js server locally, but the database and Auth remain in Supabase. Do not distribute a shared service-role key inside an installer.
