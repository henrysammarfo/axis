# AXIS handoff — continue after account switch

Last updated: 2026-07-15  
Repo: https://github.com/henrysammarfo/axis  
Preferred branch to continue: **`cursor/fix-google-login-d710`** (includes Google login fix + local `npm run dev:all`)

## Goal (where we left off)

Sign in with Google → onboard step 2 → activate → dashboard works.

**Local servers** (this cloud pod had them running): frontend `http://localhost:5173`, backend `http://localhost:8000`.

**Vercel:** MCP connected on team `teamtitanlink` (`team_MTLuYEzh2ApTBllo36Wg83qg`). Frontend deploy was **started but not finished**. No permanent AXIS Vercel URL yet. Backend is FastAPI — does **not** live in `localhost` when testing from `*.vercel.app`.

## Checkout & run locally

```bash
git fetch origin
git checkout cursor/fix-google-login-d710
git pull origin cursor/fix-google-login-d710

# Env (do not commit):
#   .env              ← copy from .env.example
#   backend/.env      ← copy from backend/.env.example
# Keys guide: docs/KEYS_SETUP.md

npm install
npm run dev:all
# or:
#   ./scripts/dev.sh
```

Verify:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/config/status   # magic_auth.ready should be true
# open http://localhost:5173/onboard
```

## Open PRs / branches

| Branch | PR | Status |
|--------|-----|--------|
| `cursor/fix-google-login-d710` | [#5](https://github.com/henrysammarfo/axis/pull/5) | **Use this** — Google button fix |
| `cursor/local-dev-startup-d710` | [#4](https://github.com/henrysammarfo/axis/pull/4) | `dev:all` script (already in fix-google branch history) |
| `cursor/comprehensive-live-tests-d710` | [#3](https://github.com/henrysammarfo/axis/pull/3) | Earlier Magic/auth/Sepolia fixes |

Base branch for PRs: `main`.

## Fixes already in this branch

1. **Magic OAuth / PKCE** — `magic-admin` backend verify; only call `getRedirectResult` on OAuth callbacks.
2. **Onboard stuck “Signing in…”** — `loading` starts false; auto-resume only on OAuth callback URLs; Magic timeouts.
3. **Google button felt dead** — no `resumeSession()` before OAuth; returns `{status:"session"|"redirecting"}`; warm up Magic SDK on mount.
4. **Sepolia** — skip Particle UA mainnet paths; skip ZeroDev SRA (API rejects testnet); use Magic EOA as `ua_address`.
5. **CORS for Vercel** — `allow_origin_regex=r"https://.*\.vercel\.app"` in `backend/main.py`.
6. **Local start** — `npm run dev:all` / `scripts/dev.sh`.

## Remaining work (priority)

1. **Hard-refresh `/onboard` and test Google login**  
   - Magic redirect allowlist **must** include exactly: `http://localhost:5173/onboard`  
   - Disable wallet extensions on localhost (MetaMask/Rabby break Magic).  
   - Google OAuth client + Magic must use matching client IDs.

2. **Finish Vercel preview deploy** (MCP server `Vercel` already worked once):  
   - Deploy frontend project name suggestion: `axis`  
   - Set build-time `VITE_*` env (especially `VITE_API_URL` to a **public** backend).  
   - After URL exists: add `https://<deploy>/onboard` to Magic + Google redirect allowlists.  
   - Backend for Vercel testing: public FastAPI (Azure App Service per `docs/KEYS_SETUP.md` / `azure/deploy.bicep`), **or** temporary tunnel — localtunnel was used once (`loca.lt`) and is fragile.

3. **Dashboard activate** — fund UA/Magic EOA on Arbitrum Sepolia (`421614`), then Activate AXIS.

4. **Merge PRs** into `main` when login E2E is green. Rotate any secrets that were pasted in chat before production.

## Key files

| Area | Path |
|------|------|
| Google / Magic session | `src/lib/wallet.ts` |
| Onboard UI | `src/routes/onboard.tsx` |
| Auth gate | `src/routes/_authenticated.tsx` |
| API client | `src/lib/api.ts` |
| Magic admin verify | `backend/services/auth_service.py` |
| CORS | `backend/main.py` |
| Env validation | `scripts/validate-env.py`, `docs/KEYS_SETUP.md` |
| Dev script | `scripts/dev.sh`, `npm run dev:all` |

## Env checklist (must exist, never commit)

Frontend `.env`: `VITE_API_URL`, `VITE_MAGIC_PUBLISHABLE_KEY`, Particle, ZeroDev, `VITE_GOOGLE_CLIENT_ID`, Alchemy Sepolia RPC, `VITE_ARBITRUM_CHAIN_ID=421614`.

Backend `backend/.env`: matching Magic secret/publishable, AI keys, TinyFish, Particle, ZeroDev, Google client, Alchemy, agent wallet + x402, `CORS_ORIGINS` includes localhost; Vercel origins covered by regex.

Expect `/config/status` → `wallet.magic_auth.mode: "magic-admin"`, `chain_id: 421614`.

## Prompt to paste in the new Cursor account

```
Continue AXIS (github.com/henrysammarfo/axis).

Checkout cursor/fix-google-login-d710 and read docs/HANDOFF.md.

1. Start with npm run dev:all; verify /health and /onboard.
2. Fix/test Continue with Google → step 2 → Activate.
3. Finish Vercel frontend deploy via Vercel MCP (team teamtitanlink); point VITE_API_URL at a public backend; update Magic redirect URI.
4. Do not force-push or rewrite published history (Lovable-connected repo).
```

## Do not

- Force-push / rebase / amend already-pushed commits (Lovable sync).
- Commit `.env`, `backend/.env`, or `.axis-deploy-args.json` (contains baked secrets).
- Assume Vercel alone hosts the FastAPI backend.
