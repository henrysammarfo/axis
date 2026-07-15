# AXIS — Project Memory (Living Document)

> **Last updated:** 2026-07-15  
> **Production truth:** `docs/PRODUCTION_AUDIT.md`  
> **Corrections to old guide:** `docs/AXIS_FACT_CHECK.md`  
> **Do not** treat `AXIS_BUILD_GUIDE.md` as current.

---

## One-Line Pitch

**AXIS** — AI DeFi portfolio agent. **Set. Forget. Earn.**

Google sign-in → Magic embedded wallet → Particle UA (EIP-7702) → ZeroDev SRA deposits → AI manages yield on Arbitrum → plain-English results. No MetaMask, no chain switching, no gas UX.

---

## Production chain

| Item | Value |
|------|-------|
| Settlement | **Arbitrum One `42161`** (mandatory for full UA/SRA) |
| Demo-only | Arbitrum Sepolia `421614` (EOA fallback — incomplete) |

---

## Current repo state (2026-07-15) — factual

### Exists and working (Sepolia / local / Vercel demo path)
- Frontend TanStack Start + onboard Magic Google OAuth
- Backend FastAPI (`backend/`) — auth, agent, portfolio, health
- `magic-admin` DID verification
- Env validation (keys required to boot outside `ENVIRONMENT=testing`)
- Vercel projects `axis` + `axis-api` (ephemeral SQLite on serverless — not prod DB)
- Proof UI exists but currently checks **key presence**, not live 7702/SRA

### Incomplete vs product claims (blocked / skipped on Sepolia)
- Particle Universal Account provisioning → **returns Magic EOA**
- EIP-7702 Type-4 delegation → **not implemented**
- ZeroDev SRA create → **skipped** on Sepolia
- DeFi primary path still has Sepolia agent-wallet fallback
- Postgres durable production DB → not default on Vercel API

---

## Tech stack (target production)

```
Frontend:  TanStack Start
Backend:   FastAPI
AI:        Venice primary + OpenAI fallback + TinyFish
Wallet:    Magic Labs Google OAuth
Accounts:  Particle Universal Accounts v2 + EIP-7702 (Arbitrum One)
Gas:       ZeroDev v3 bundler/paymaster (42161)
Deposits:  ZeroDev Smart Routing Address → Arbitrum One
DB:        PostgreSQL (mandatory production)
Hosting:   Vercel frontend + durable API host (App Service / equivalent)
```

---

## Next chat prompt

```
Read docs/PRODUCTION_AUDIT.md. Execute mandatory mainnet cutover: 42161, real Particle UA+EIP-7702, real ZeroDev SRA, remove Sepolia production fallbacks, Postgres, rotate leaked keys. Nothing optional.
```
