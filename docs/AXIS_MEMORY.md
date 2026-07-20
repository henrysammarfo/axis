# AXIS — Project Memory (Living Document)

> **Last updated:** 2026-07-20  
> **Production truth:** `docs/PRODUCTION_AUDIT.md`  
> **Corrections to old guide:** `docs/AXIS_FACT_CHECK.md`  
> **Do not** treat `AXIS_BUILD_GUIDE.md` as current.

---

## Hackathon submission (2026-07-20)

**Event:** UXmaxx / Particle Universal Accounts hackathon  
**Deadline:** Monday, July 20, 2026 — 11:59 AM Atlantic/Reykjavik  
**Team:** Henry Sam Marfo (Leader)

**Tracks entered:**
- Universal Accounts Track (Particle EIP-7702) — primary
- General Track → ZeroDev Subtrack 2
- Arbitrum “Road to Open House London” Bounty
- Magic Labs Bonus Challenge

**Paste-ready pack (do not rebuild product — showcase these):**
| Doc | Purpose |
|-----|---------|
| [`docs/HACKATHON_WIN_PACK.md`](HACKATHON_WIN_PACK.md) | **Win narrative** — README convert + project description + form fields |
| [`docs/SUBMISSION.md`](SUBMISSION.md) | Encode form paste blocks + Checkpoint 3 |
| [`docs/PITCH_DECK.md`](PITCH_DECK.md) | 12 slides → Canva / Google Slides |
| [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md) | 2:00 + 90s Arbitrum cut |
| [`docs/STARTUP_STRATEGY.md`](STARTUP_STRATEGY.md) | PMF · GTM · roadmap (win or not) |
| [`docs/RECORD_AND_SUBMIT.md`](RECORD_AND_SUBMIT.md) | Final checklist before deadline |

**Live URLs (production — ignore stale HANDOFF teamtitanlink URLs):**
- Frontend: **https://axis-mainnet.vercel.app**
- API: **https://axis-api-beta.vercel.app**
- Judge proof (after Google login): **https://axis-mainnet.vercel.app/proof**
- Repo: **https://github.com/henrysammarfo/axis**

**Pre-record smoke (agent-verified 2026-07-20):**
- Frontend `/` and `/onboard` → HTTP 200
- API `/health` → ok, `fully_configured: true`, `missing_keys: []`
- `/config/status` → Magic, Particle, ZeroDev, Google OAuth, chain_id **42161**, dedicated Alchemy RPC, Venice + TinyFish + x402 green
- Interactive path still needs you: Google login → `/proof` Type-4 + SRA → fund USDC → Begin/Apply → Arbiscan

**After you upload video + deck:** paste YouTube unlisted + Slides/Canva URLs into `docs/SUBMISSION.md` and this section.

---

## Profiles + AXIS avatars (BUILT — 2026-07-19)

- **Cross-device profile** persisted to Postgres `users` table: new nullable columns
  `display_name VARCHAR(64)` and `avatar TEXT` (id like `axis-03` or an uploaded
  data URL). Auto-migrated on startup via `_migrate_user_columns` (no Alembic).
- **Endpoint:** `POST /api/agent/profile` (auth: DID token + `assert_same_user` +
  `assert_wallet_belongs_to_user`), avatar payload capped at 300 KB. `display_name`
  + `avatar` are also returned in `GET /api/agent/status/{user_id}`.
- **Frontend:** `useProfile(userId)` reads local cache for instant paint, then
  hydrates from server status (server = source of truth). Profile page saves to
  local cache first, then `POST /profile` via `useUpdateProfile`.
- **Avatars = AXIS herself.** Six portrait variations of the "PROMPT" brand model
  (the landing/merch face), generated from the merch reference, stored as ~10 KB
  512px WebP in `public/avatars/axis-01..06.webp`. Labels: Studio, Neon, Profile,
  Hooded, Soft, Lime.
- **Settings/Logout:** `/settings` (account, addresses, log out) and `/profile`
  (name + avatar picker + upload) under `_authenticated`; account links gated to
  in-app routes in `MobileMenu`.

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

## 2026-07-18 — Every strategy is signing-free (product law)

**Core rule (non-negotiable):** after Google sign-in, the user NEVER signs a
transaction. They deposit, tap "Begin", and the AXIS session key executes
everything gaslessly. Signing prompts are for web3 devs, not consumers.

- The account is **not USDC-only**. It's a normal Kernel (7702) smart account —
  it can hold/receive/send native ETH, USDT, and any Arbitrum token; USDC is just
  the asset the *session policy* is scoped around for lending.
- **Gas** is paymaster-sponsored for all session actions. The only thing the
  paymaster can't pay is a *protocol's own* fee (e.g. GMX's native ETH keeper
  fee) — that comes from a little ETH the user keeps in their account. Still no
  signing; we just don't "sponsor GMX's fee".

### Signing-free strategy set (all via the session key, funds pinned to owner)
| Venue | Path | Risk gate | Notes |
|-------|------|-----------|-------|
| Aave V3 | approve → supply(onBehalfOf=owner) / withdraw(to=owner) | always on | USDC lending |
| Uniswap V3 | USDC/USDT full-range LP (swap+mint+decrease/collect/burn) | Aggressive + one-time market-risk consent | recipient pinned @ offsets |
| **GMX V2 GM** | approve+sendWnt+sendTokens+createDeposit/createWithdrawal as **individual** calls (NOT GMX multicall) in one UserOp | Aggressive + consent + hands-off | receiver/market pinned; keeper ETH fee from user's own ETH; sendWnt value capped 0.01 ETH |

**GMX correction (superseded "Pro, user-signed"):** GMX is now fully signing-free.
Because we execute the sub-calls individually (not via GMX's `multicall`),
`createDeposit`/`createWithdrawal` are direct calls, so the session `CallPolicy`
pins `receiver`=owner and `market`=GM ETH/USD at fixed offsets. Offsets locked in
`backend/services/gmx_gm.py` + `backend/tests/test_gmx_gm.py` and mirrored in
`src/lib/kernel-session.ts`:
- deposit: receiver @224, market @320
- withdraw: receiver @256, market @352
GMX deposits/withdrawals are keeper-settled (async), so we verify the create tx
and reconcile the GM balance from chain.

### Best-yield router + one-tap apply (BUILT — 2026-07-19)
- `backend/services/yield_router.py`: scans live APYs across Aave USDC/USDT,
  Uniswap V3 LP, GMX V2 GM concurrently and builds ONE risk-adjusted `RoutePlan`
  for the user's profile + idle funds. Respects the cash buffer, gates the market
  sleeve (LP+GMX) behind Aggressive+consent, caps GMX exposure, and **folds** any
  below-minimum sleeve back into the stable core (safe for $10 deposits).
- **Stable core is USDC-only** for execution: only Aave USDC is in the session
  policy (USDT supply isn't), so the gasless core stays in USDC. Aave USDT APY is
  still fetched and shown for comparison, never allocated. Tests in
  `backend/tests/test_yield_router.py` lock this (17 pass w/ gmx).
- Endpoints: `POST /agent/route/preview` (recommendation) and the one-tap
  `POST /agent/route/apply/prepare` (recompute route from idle USDC → session
  calls **grouped per venue**) + `POST /agent/route/apply/confirm` (verify each
  leg on-chain, log per-venue position). Aave supply-of-exact-amount added via
  `aave_transactions.build_supply_calls`.
- Frontend one-tap: `applyRouteViaSession` (`src/lib/wallet.ts`) runs each venue
  group as its own gasless UserOp in order (Aave core first, then LP, then GMX),
  **graceful-skips** any leg that can't land (e.g. no ETH for GMX keeper fee), and
  confirms only what executed. Dashboard "Smart route" card → single **"Apply best
  route"** button + a **"What AXIS did"** summary (applied legs w/ Arbiscan tx +
  skipped legs). Hook `useApplyRoute`.

### Balance-aware routing + power-user venue toggles (2026-07-19)
- **Balance-aware:** preview + `route/apply/prepare` now read the account's real
  holdings via `_read_wallet_balances` → `{usdc, usdt, eth}` (`get_native_balance_wei`
  added to `aave_transactions.py`; USDT/ETH are ERC20/native reads). GMX needs the
  user's OWN ETH for the keeper fee, so `_gmx_fundability(eth)` compares balance vs
  `estimate_execution_fee_wei()`. If ETH is short, apply **pre-skips GMX** (adds it
  to `exclude_venues`, folds its share into stable/LP) and returns `pre_skipped` so
  the tap never attempts an unfundable leg. Response carries `balances`,
  `gmx_fundable`, `gmx_fee_eth`. Dashboard shows "In your wallet · $X USDC · Y ETH".
- **USDT reality:** USDT balance is *surfaced* but not auto-deployed — session policy
  has no gasless USDT-supply path (Aave USDC only; LP swaps USDC→USDT internally).
- **Power-user toggles:** `exclude_venues: list[str]` on preview + apply flows through
  `route_best_yield`/`build_route(exclude_venues=...)`; excluded market venues are
  treated ineligible and fold back to the stable core (stable core can't be excluded).
  Dashboard renders "Stable LP · on/off" + "GMX · on/off" chips (visible once market
  risk is unlocked). New users just tap "Apply best route"; power users flip venues.
  Locked behind Aggressive + market-risk consent as before.
- **vault.tsx bug fixed:** GMX APY query called `axisApi.yields.gmx` (uncalled) →
  always "—". Now `axisApi.yields.gmx()` reading `top_market_apy`/`apy`.
- Router tests extended (19 pass) to lock exclude-venue folding.

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
- End-to-end judge smoke on **funded** mainnet wallet (needs USDC via SRA/direct; optional ETH for GMX) — run before demo video
- Rotate secrets previously pasted in chat
- ~~Postgres~~ — wired (Supabase); keep durable in prod
- ~~Client UA signature for every invest~~ — superseded: silent session grant at Google login; Begin/Apply are signing-free

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
DB:        PostgreSQL (Supabase)
Hosting:   Vercel axis-mainnet + axis-api
```

---

## Next chat prompt

```
Submission day: follow docs/RECORD_AND_SUBMIT.md — record demo (docs/DEMO_SCRIPT.md), export deck (docs/PITCH_DECK.md), paste links into Encode form from docs/SUBMISSION.md. Live = axis-mainnet.vercel.app. Do not hallucinate — follow docs/AXIS_MEMORY.md.
```
