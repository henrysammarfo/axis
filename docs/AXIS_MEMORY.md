# AXIS — Project Memory (Living Document)

> **Last updated:** 2026-07-18  
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

## 2026-07-18 — Mainnet cutover + hands-off session keys (factual, verified)

### Live deployments (Arbitrum One `42161`)
- Frontend: **https://axis-mainnet.vercel.app** (Vercel project `axis-mainnet`, prj_imebtiOC95yQ5Ve5lz3ev8Gd9zk5)
- Backend:  **https://axis-api-beta.vercel.app** (Vercel project `axis-api`, prj_wN5Pog4uTs6mTJO9DFvPIbJhaBF2, FastAPI, root dir `backend/`)
- Both deployed fresh from local via `vercel deploy --prod` under `henrysammarfo`.

### Env vars set on Vercel (Production) — mainnet
- `axis-mainnet` (17): client `VITE_*` (API URL, Magic pub, Particle, ZeroDev project/RPC `.../chain/42161`, Google, `VITE_ARBITRUM_RPC_URL`=Alchemy arb-mainnet, `VITE_ARBITRUM_CHAIN_ID=42161`, `VITE_SITE_URL`) + **server-side** for the TanStack hands-off executor (`AGENT_WALLET_PRIVATE_KEY`, `ARBITRUM_RPC`, `ZERODEV_BUNDLER_URL`, `ZERODEV_PAYMASTER_URL`, `ZERODEV_RPC_URL`, `API_URL`).
- `axis-api` (24): all AI + wallet keys, ZeroDev (project/rpc/bundler/paymaster/api at chain 42161), `ARBITRUM_RPC`=Alchemy arb-mainnet (dedicated), `ARBITRUM_CHAIN_ID=42161`, `DATABASE_URL=sqlite+aiosqlite:////tmp/axis.db` (Vercel's only writable path — **ephemeral**), `ENVIRONMENT=production`, CORS/frontend URL = axis-mainnet.

### Architecture change (supersedes Particle-UA-primary story below)
- Gasless autonomous execution now uses **ZeroDev Kernel v3.3 EIP-7702 + session keys**, not Particle UA as the primary path.
- `src/lib/kernel-session.ts`: owner signs ONE Magic wallet approval → policy-bounded (`CallPolicy` v0.0.4) session account. Policy pins **mainnet** USDC `0xaf88…5831` + Aave Pool `0x794a…14aD`: approve→pool, supply(onBehalfOf=owner), withdraw(to=owner) only, + rate limit.
- `src/lib/agent-executor.ts`: TanStack `createServerFn` Node executor holds `AGENT_WALLET_PRIVATE_KEY` (session signer), loads the user's approval server-side after verifying their Magic token (anti-replay), submits gasless UserOps via ZeroDev paymaster/bundler.
- Backend session endpoints in `backend/routes/agent.py`: `/agent/session/enable`, `/agent/session/approval/{user_id}`, `/agent/rebalance/prepare|confirm`, `/agent/strategy/custom`. Custom-strategy envelope (USDC/USDT) validated in `strategy_engine.py`.

### Verified 2026-07-18 (headless)
- Backend `GET /config/status` → `fully_configured:true`, `chain_id:42161`, `is_mainnet:true`, `dedicated_rpc:true`, all wallet/AI/intelligence green.
- ZeroDev v3 RPC `.../chain/42161` `eth_chainId` → `0xa4b1` (mainnet enabled on project).
- Alchemy arb-mainnet `eth_chainId` → `0xa4b1`; live mainnet USDC `totalSupply` read OK.
- Frontend `/` and `/onboard` → HTTP 200.
- **ZeroDev mainnet gas sponsorship = LIVE & FUNDED** — sent a real sponsored no-op UserOp on 42161 via the agent signer's own Kernel account. `success=true`, gasless. Agent EOA `0xB883e76A4f6841E72cAF1C28ba00f78df974f448`, Kernel acct `0x5595E33FF2eB7F2B8F5ABbd521489e84F8cB4221`, tx `0x96c27132fd04085aaf0443521f105b921083fa8f1a35d06039cfe3ed86fcc3d4` (arbiscan.io). The "Sponsor all" policy for Arbitrum One is confirmed active.

### Still NOT verified / open (needs interactive + funded)
- E2E user flow: Google login → session approval → real Aave USDC supply/withdraw tx on Arbiscan (audit tests #2–#5). Needs funded Magic wallet. (Paymaster sponsorship itself already proven above.)
- `/tmp` SQLite is ephemeral (session approvals reset on cold start) → move to Postgres for durable hands-off.
- Rotate all keys pasted in chat (agent key is a Sepolia testnet key reused as mainnet session signer — fine as gasless signer holding no funds, but rotate anyway).

---

## Current repo state (2026-07-15) — factual (pre-Kernel; see 2026-07-18 above)

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
