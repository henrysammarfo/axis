# AXIS handoff — continue after account switch

Last updated: 2026-07-15 (local Windows + Vercel live)  
Repo: https://github.com/henrysammarfo/axis  
Preferred branch: **`cursor/fix-google-login-d710`**

## Live Vercel URLs (test here)

| App | URL |
|-----|-----|
| **Frontend** | https://axis-teamtitanlink.vercel.app |
| **Onboard** | https://axis-teamtitanlink.vercel.app/onboard |
| **Alt frontend** | https://axis-three-phi.vercel.app |
| **API** | https://axis-api-teamtitanlink.vercel.app |
| **API health** | https://axis-api-teamtitanlink.vercel.app/health |

SSO Deployment Protection is **disabled** on both projects for public testing.

## Magic / Google allowlist (required for Vercel sign-in)

Add these redirect URIs in Magic + Google OAuth:

- `https://axis-teamtitanlink.vercel.app/onboard`
- `https://axis-three-phi.vercel.app/onboard`
- `http://localhost:5173/onboard` (local)

## Local clone setup (Windows)

Repo already at `C:\Users\RICHEY_SON\Desktop\axis` on this machine.

```powershell
cd C:\Users\RICHEY_SON\Desktop\axis
git checkout cursor/fix-google-login-d710
git pull
powershell -ExecutionPolicy Bypass -File scripts\setup-local.ps1
# Edit .env + backend\.env if needed (already created for this machine)
npm run dev:all
```

Or manually:

```powershell
npm install
cd backend; pip install -r requirements.txt; cd ..
npm run dev:all
```

## New-chat paste prompt

```
Continue AXIS from docs/HANDOFF.md on branch cursor/fix-google-login-d710.
Live: https://axis-teamtitanlink.vercel.app/onboard
API: https://axis-api-teamtitanlink.vercel.app/health
Test Google login on Vercel; Magic redirect must allow that /onboard URL.
Local: npm run dev:all. Do not force-push (Lovable repo). Keep using a cheap model.
```

## Notes

- API runs with `ENVIRONMENT=testing` on Vercel so cold starts do not require every AI key; Magic keys are set for auth.
- SQLite on Vercel is ephemeral (`/tmp/axis.db`) — fine for login demos, not durable storage.
- CORS allows `*.vercel.app` regex + listed origins.
- Vercel CLI projects linked: `axis` (frontend root), `axis-api` (backend/).

## Remaining

1. Confirm Magic dashboard has Vercel `/onboard` redirect.
2. E2E Google login on Vercel → step 2 → Activate.
3. Fill real Venice/OpenAI/TinyFish/agent wallet keys before production (replace testing mode).
4. Merge PR #5 when login is green.
