# AXIS — Project Memory (Living Document)

> **Last updated:** 2026-07-07  
> **Source of truth:** `AXIS_BUILD_GUIDE.md` + web fact-checks in `AXIS_FACT_CHECK.md`  
> **Repo state:** Frontend (TanStack Start). Backend FastAPI complete.

---

## One-Line Pitch

**AXIS** — AI DeFi portfolio agent. **Set. Forget. Earn.**

Google sign-in → invisible wallet → AI manages yield across DeFi on Arbitrum → user sees plain-English weekly earnings. No MetaMask, no chain switching, no gas UX.

---

## Hackathon Target

| Item | Value |
|------|-------|
| Event | **UXmaxx Hackathon** — "Pushing Crypto Towards Its Current Potential" |
| Host | Encode Club / Particle Network (7702 Collective) |
| Primary track | **Universal Accounts Track** |
| Bonus tracks | Arbitrum Bounty, Magic Labs Bonus, ZeroDev Subtrack |
| Prize pool (official) | **$15,000+** total across sponsors |
| UA track prizes (verified) | 1st **$5,000**, 2nd $2,500, 3rd $1,500 |
| Arbitrum bounty (verified) | **$2,000** |
| Magic Labs bonus (verified) | **$500** |
| ZeroDev subtrack (verified) | **$500** |
| **Realistic max if all bonuses** | **$8,000** (UA 1st + all bonuses) — *not $5,500 as guide states* |
| Submission deadline (verified) | **June 14, 2026** — event ended before this memory doc date |

---

## Judging Criteria (UA Track — Primary)

| Criterion | Weight | AXIS angle |
|-----------|--------|------------|
| UX excellence | **40%** | Google login, no MetaMask, plain-English agent explanations |
| UA + EIP-7702 | **30%** | EOA upgraded in-place via Particle UA 7702 mode — same address |
| Adoption potential | **20%** | "Set and forget DeFi" for non-crypto users |
| Technical quality | **10%** | Multi-protocol DeFi execution via AI agent + tools |

---

## Tech Stack (Intended)

```
Frontend:  TanStack Start (React 19, Vite, Tailwind v4)
Backend:   FastAPI (Python) — NOT BUILT YET
AI:        Claude/Anthropic tool-use loop (guide) — see API key alternatives
Wallet:    Magic Labs embedded wallet (Google OAuth)
Accounts:  Particle Network Universal Accounts (EIP-7702 mode)
Gas/AA:    ZeroDev bundler + paymaster
Deposits:  ZeroDev Smart Routing Address (SRA)
Chain:     Arbitrum One (42161) — primary settlement
Payments:  x402 — autonomous micropayments for market data
DeFi:      Aave v3, GMX GLP, Uniswap v3 on Arbitrum
DB:        PostgreSQL
Hosting:   Azure (user has) or Railway/similar
```

---

## Current Repo State (2026-07-07)

### What EXISTS
- `src/routes/` — brand pages: `/`, `/manifesto`, `/agent`, `/vault`, `/merch`, `/dashboard`
- `src/lib/brandData.ts` — **mocked** portfolio/vault/agent data
- `src/routes/dashboard.tsx` — UI shell with fake SRA address, budget slider, mocked positions
- Brand system: lime accent `#D8FF3C`, Inter Tight

### What DOES NOT EXIST YET
- `backend/` directory (FastAPI)
- Magic / Particle / ZeroDev SDK integration
- Real on-chain execution
- Auth flow
- PostgreSQL
- API routes (`/api/agent/activate`, etc.)
- x402 real payments

---

## Architecture Flow (Target)

```
User → Google OAuth (Magic) → EOA created invisibly
     → Particle UA upgrades EOA via EIP-7702 (same address)
     → User sets budget + risk + goal in frontend
     → POST /api/agent/activate → FastAPI
     → AI agent loop:
         1. check_aave_yield / check_gmx_apy / check_uniswap_pool
         2. get_market_intelligence (x402 micropayment)
         3. execute_allocation (Particle UA + ZeroDev gasless)
     → Portfolio tracker logs positions
     → Weekly plain-English report
     
Deposits: User sends from ANY chain → ZeroDev SRA → routes to Arbitrum UA
```

---

## Official Reference Implementations

| Resource | URL | Use for |
|----------|-----|---------|
| Particle UA + Magic + 7702 demo | https://github.com/Particle-Network/ua-7702-magic-demo | **Start here** — proven integration path |
| Particle UA Web SDK docs | https://developers.particle.network/universal-accounts/ua-reference/web/overview | 7702 vs Smart Account modes |
| ZeroDev SRA docs | https://docs.zerodev.app/cross-chain/smart-routing-address | `createSmartRoutingAddress` SDK |
| Magic Google login | https://docs.magic.link/embedded-wallets/authentication/login/oauth/social-providers/google | OAuth + One Tap |
| x402 whitepaper | https://www.x402.org/x402-whitepaper.pdf | Payment protocol spec |
| PayAI x402 on Arbitrum | https://blog.payai.network/x402-on-arbitrum-payai-adds-support-for-arbitrum-one/ | Real Arbitrum facilitator |

---

## Frontend API Contract (from build guide)

Base URL: `http://localhost:8000/api` (production: Azure URL)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/agent/activate` | Activate AXIS with budget, risk, goal, ua_address |
| POST | `/agent/rebalance` | Plain-English rebalance instruction |
| GET | `/agent/report/{user_id}` | Weekly P&L report |
| GET | `/agent/status/{user_id}` | Active status, positions, yields |

---

## Demo Script (90 seconds — Arbitrum bounty)

1. **0:00** — Google login, no MetaMask
2. **0:20** — Set $500 budget, moderate risk, activate
3. **0:35** — Dashboard shows Aave + GMX positions with APY
4. **0:50** — Plain-English summary appears
5. **1:00** — User types "Move to safer positions" → rebalance
6. **1:15** — Show ZeroDev SRA cross-chain deposit
7. **1:30** — Mobile 390px view

---

## Submission Checklist (from guide)

- [ ] Magic Google login working
- [ ] Particle UA EIP-7702 integrated
- [ ] ZeroDev SRA configured
- [ ] AI agent tool loop running
- [ ] Real Aave/GMX/Uniswap yield data
- [ ] x402 payment (or documented fallback)
- [ ] End-to-end activation flow
- [ ] Plain-English rebalance
- [ ] Weekly report
- [x] Frontend wired to backend
- [ ] Mobile responsive (390px)
- [ ] Demo video recorded
- [ ] Public GitHub repo
- [ ] Submit to all 4 tracks

---

## Related Memory Docs

- `AXIS_API_KEYS.md` — full key inventory + what you have vs need
- `AXIS_FACT_CHECK.md` — errors/corrections in the build guide
- `AXIS_WIN_STRATEGY.md` — recommendations to maximize win probability
- `../AXIS_BUILD_GUIDE.md` — original build bible (verbatim copy)
