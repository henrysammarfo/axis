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

### Done on branch `cursor/mainnet-ua-7702-sra-d710`
- Defaults / examples cut over to **42161** (frontend + backend)
- `wallet.ts`: real Particle UA + Magic `sign7702Authorization` / `send7702Transaction` Type-4 path (official Particle Magic demo flow); **fails hard** on mainnet if SRA or 7702 missing
- ZeroDev SRA create on mainnet (Base/OP/Arb/ETH USDC sources); no silent `console.warn` skip
- Persist `eip7702_tx_hash` + `eip7702_delegated` on user; `/proof` shows live UA / SRA / Type-4 evidence
- Agent-wallet Aave Sepolia path gated to `development`/`testing` + `421614` only
- Docs: KEYS_SETUP env examples point at Arbitrum One

### Still incomplete
- End-to-end judge smoke on **funded** mainnet wallet (needs ~ETH gas + USDC for deposit/withdraw)
- DeFi activate still requires client UA signature path for primary execution (not agent-wallet on mainnet)
- Postgres durable production DB → not default on Vercel API
- Rotate secrets previously pasted in chat

---

## Tech stack (target production)

```
Frontend:  TanStack Start
Backend:   FastAPI
AI:        Venice primary + OpenAI fallback + TinyFish
Wallet:    Magic Labs Google OAuth + @magic-ext/evm
Accounts:  Particle Universal Accounts + EIP-7702 (Arbitrum One)
Gas:       ZeroDev v3 bundler/paymaster (42161)
Deposits:  ZeroDev Smart Routing Address → Arbitrum One
DB:        PostgreSQL (mandatory production)
Hosting:   Vercel frontend + durable API host (App Service / GCP / equivalent)
```

---

## Next chat prompt

```
Continue mainnet AXIS: update local .env to 42161 + Alchemy/ZeroDev mainnet RPCs; Google login → confirm /proof shows Type-4 hash + SRA; fund Magic wallet ~$20 ETH/USDC for smoke deposit+withdraw. Do not hallucinate — follow docs/PRODUCTION_AUDIT.md.
```
