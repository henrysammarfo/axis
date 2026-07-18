# AXIS — AI DeFi Portfolio Agent

> **Set. Forget. Earn.** Sign in with Google, deposit USDC, tap once — AXIS invests and rebalances on **Arbitrum One** for you, hands-free, with no seed phrase, no gas, and no wallet pop-ups after the first approval.

AXIS turns "I want my money to earn safely" into a real, on-chain, non-custodial position. The user never sees a private key, never signs a raw transaction after setup, and never gives AXIS the ability to move funds anywhere except their own account.

- **Live app:** https://axis-mainnet.vercel.app
- **Live API:** https://axis-api-beta.vercel.app (`/health`, `/config/status`)
- **Chain:** Arbitrum One (`42161`)
- **Architecture deep-dive + diagrams:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Production truth / audit checklist:** [`docs/PRODUCTION_AUDIT.md`](docs/PRODUCTION_AUDIT.md)
- **Living project memory:** [`docs/AXIS_MEMORY.md`](docs/AXIS_MEMORY.md)

---

## Table of contents

1. [What AXIS does](#what-axis-does)
2. [Why it's safe (security model)](#why-its-safe-security-model)
3. [How it works end-to-end](#how-it-works-end-to-end)
4. [Tech stack](#tech-stack)
5. [Repository layout](#repository-layout)
6. [Strategy engine (no AI guesswork)](#strategy-engine-no-ai-guesswork)
7. [Hands-off mode (gasless session keys)](#hands-off-mode-gasless-session-keys)
8. [API reference](#api-reference)
9. [Local development](#local-development)
10. [Environment variables](#environment-variables)
11. [Deployment](#deployment)
12. [Testing](#testing)
13. [Production readiness & known gaps](#production-readiness--known-gaps)

---

## What AXIS does

- **Google sign-in → embedded wallet.** [Magic](https://magic.link) creates a non-custodial EOA from a Google login. No seed phrase, no extension.
- **Pick a risk level + goal.** Conservative / Moderate / Aggressive × Protect / Grow / Maximize. A deterministic 3×3 matrix produces a real allocation across Aave v3 stablecoin markets (USDC/USDT). Live APYs come from on-chain / Aave data, not hardcoded numbers.
- **Deposit USDC, tap "Begin".** AXIS supplies to Aave on Arbitrum. Every action is a real, verifiable Arbiscan transaction.
- **Hands-off from then on.** With one owner signature, the user grants AXIS a **policy-bounded session key**. AXIS can then supply/withdraw **only the user's own USDC to/from Aave, on the user's own behalf** — gaslessly, with zero further prompts.
- **Power users** can define a custom USDC/USDT split, still inside the same safety envelope.
- **Plain-English reporting.** An AI layer (Venice primary, OpenAI fallback) *explains* what the deterministic engine did — it never decides allocations.

## Why it's safe (security model)

The core guarantee: **even if AXIS's agent key is fully compromised, no attacker can steal user funds.**

This is enforced **on-chain**, not by trust. When a user turns on hands-off mode, they sign a ZeroDev [Kernel v3.3](https://docs.zerodev.app) **session key** bounded by a `CallPolicy` (`src/lib/kernel-session.ts`) that only permits three calls:

| Allowed call | Hard constraints baked into the signed policy |
|---|---|
| `USDC.approve(spender, amount)` | `spender` **must equal** the Aave Pool |
| `AavePool.supply(asset, amount, onBehalfOf, ref)` | `asset` **must equal** USDC · `onBehalfOf` **must equal** the owner |
| `AavePool.withdraw(asset, amount, to)` | `asset` **must equal** USDC · `to` **must equal** the owner |

Plus a **rate-limit policy** (max 100 ops/day). Any other call — a transfer, a different token, a different recipient — is rejected by the smart account itself. Withdrawals can *only* go back to the owner. Funds are structurally trapped inside the user's own account.

Additional layers:

- **Cryptographic auth on every mutating route** — Magic DID tokens are verified server-side with `magic-admin` (`backend/services/auth_service.py`). No token → `401`.
- **Tenant isolation** — `assert_same_user` (authenticated issuer must equal the target `user_id`) and `assert_wallet_belongs_to_user` (a wallet can't be operated by a different account) guard every route (`backend/services/tenant_guard.py`). Wallet addresses can't be claimed by two users.
- **Anti-replay server executor** — the Node executor (`src/lib/agent-executor.ts`) never trusts a client-supplied approval blob. It re-verifies the caller's Magic token and loads *their* stored approval server-side before submitting a UserOp.
- **On-chain verification** — activation/rebalance confirmations require a real transaction receipt with `status == 1` (`verify_tx_success`). Simulated/random hashes are rejected.
- **Rate limiting** (slowapi) per route; **CORS** scoped to AXIS origins; **secrets** live only in Vercel encrypted env, never in git.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full threat model and sequence diagrams.

## How it works end-to-end

```mermaid
flowchart LR
  U[User] -->|Google login| M[Magic embedded wallet]
  M -->|EIP-7702 delegate| K[ZeroDev Kernel v3.3 account]
  U -->|risk + goal + budget| FE[TanStack Start frontend]
  FE -->|/agent/strategy/preview| API[FastAPI backend]
  API -->|3x3 matrix + live APYs| PLAN[Locked allocation plan]
  U -->|Deposit USDC + Begin| K
  K -->|supply USDC| AAVE[(Aave v3 · Arbitrum One)]
  U -->|one signature| SK[Policy-bounded session key]
  SK -.gasless UserOps.-> PM[ZeroDev paymaster/bundler]
  PM --> AAVE
```

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | TanStack Start (React 19, Vite, Nitro SSR) + Tailwind + Radix UI |
| Server functions | TanStack `createServerFn` (Node) — hosts the ZeroDev session executor |
| Backend | FastAPI (Python 3.12) + SQLAlchemy (async) |
| Auth / wallet | Magic Labs (Google OAuth + embedded EOA) |
| Smart accounts | ZeroDev Kernel v3.3, EIP-7702, session keys + `CallPolicy` |
| Gas | ZeroDev v3 bundler + paymaster (sponsored / gasless) |
| DeFi | Aave v3 (USDC/USDT supply) on Arbitrum One; Uniswap V3 for USDC→USDT |
| AI | Venice (primary) + OpenAI (fallback) — explanation only |
| Web intelligence | TinyFish + x402 micropayments |
| Chain access | Alchemy dedicated Arbitrum One RPC |
| Hosting | Vercel (`axis-mainnet` frontend, `axis-api` backend) |

## Repository layout

```
axis/
├── src/                        # TanStack Start frontend
│   ├── lib/
│   │   ├── wallet.ts           # Magic + EIP-7702 Kernel delegation, deploy/rebalance
│   │   ├── kernel-session.ts   # Builds the policy-bounded session approval (owner signs once)
│   │   ├── agent-executor.ts   # Server fn: gasless UserOp executor (holds agent key)
│   │   ├── strategy.ts         # Custom-strategy types
│   │   ├── api.ts              # Typed backend client
│   │   └── chain.ts            # Arbitrum chain config helpers
│   ├── hooks/useAxis.ts        # React Query hooks
│   └── routes/                 # Pages (onboard, dashboard, merch, ...)
├── backend/                    # FastAPI backend
│   ├── main.py                 # App, CORS, rate limiting, startup validation
│   ├── config.py               # Env settings + required-key validation
│   ├── chain_config.py         # Per-chain addresses (USDC/USDT/Aave), APY math
│   ├── dependencies.py         # require_auth / require_own_user
│   ├── routes/                 # auth, agent, portfolio, health
│   └── services/
│       ├── auth_service.py     # Magic DID verification
│       ├── tenant_guard.py     # Per-user isolation
│       ├── strategy_engine.py  # Deterministic 3x3 matrix + custom validation
│       ├── aave_transactions.py# Aave/Uniswap calldata, funding + tx checks
│       ├── portfolio_tracker.py# Persistence
│       └── ...                 # ai_agent, x402_client, yield_fetcher, eip7702_sponsor
└── docs/                       # ARCHITECTURE, PRODUCTION_AUDIT, memory, keys
```

## Strategy engine (no AI guesswork)

Allocations are **deterministic**, defined in `backend/services/strategy_engine.py`. The AI layer only translates a finished plan into plain English — it can never invent an allocation.

`(risk, goal) → (cash buffer %, USDC weight, USDT weight)`:

| | Protect | Grow | Maximize |
|---|---|---|---|
| **Conservative** | 10% cash · 100% USDC | 5% cash · 85/15 | 0% cash · 70/30 |
| **Moderate** | 5% cash · 90/10 | 0% cash · 60/40 | 0% cash · 40/60 |
| **Aggressive** | 0% cash · 70/30 | 0% cash · 40/60 | 0% cash · 20/80 |

- Minimum budget **$10 USDC**; maximum **$100,000**.
- Aggressive × Maximize tilts toward the higher **live** Aave APY between USDC/USDT.
- Dust legs (< $0.50) fold into the largest leg so tiny deposits still produce one clean position.
- Custom strategies are validated (`validate_custom_legs`): only `aave`, only USDC/USDT, ≤ 4 legs, weights must sum to 100%.

## Hands-off mode (gasless session keys)

1. Frontend fetches the agent's session-signer address (`getSessionSignerAddress` server fn).
2. `buildSessionApproval` builds a `CallPolicy`-bounded Kernel account and asks the owner for **one** Magic signature.
3. The serialized approval is stored server-side via `POST /api/agent/session/enable`.
4. To act, the backend builds **policy-safe, USDC-only** calls (`build_rebalance_calls`); the Node executor loads the owner's approval (after re-verifying their token) and submits a **gasless** UserOp through the ZeroDev paymaster.
5. Result is verified on-chain and logged.

## API reference

Base URL: `https://axis-api-beta.vercel.app`. Mutating routes require `Authorization: Bearer <magic_did_token>`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | – | Service + config health |
| `GET` | `/config/status` | – | Public-safe config checklist (RPC key **redacted**) |
| `POST` | `/api/auth/verify` | – | Verify a Magic DID token |
| `POST` | `/api/auth/register` | token | Register/bind user + wallet |
| `POST` | `/api/auth/sponsor-eip7702` | token | Sponsor the Type-4 delegation tx |
| `POST` | `/api/agent/strategy/preview` | – | Preview matrix plan + live APYs |
| `POST` | `/api/agent/activate` | ✅ | Save risk/goal/budget (config only) |
| `POST` | `/api/agent/deploy/prepare` | ✅ | Check funding + build Aave txs to sign |
| `POST` | `/api/agent/activate/confirm` | ✅ | Verify on-chain txs + persist positions |
| `POST` | `/api/agent/session/enable` | ✅ | Store policy-bounded session approval |
| `GET` | `/api/agent/session/approval/{user_id}` | ✅ (self) | Server executor loads own approval |
| `POST` | `/api/agent/rebalance/prepare` | ✅ | Build USDC-only rebalance calls |
| `POST` | `/api/agent/rebalance/confirm` | ✅ | Verify + log session rebalance |
| `POST` | `/api/agent/strategy/custom` | ✅ | Validate + save custom strategy |
| `GET` | `/api/agent/status/{user_id}` | ✅ (self) | Agent status + x402 spend |
| `GET` | `/api/agent/report/{user_id}` | ✅ (self) | Weekly plain-English report |
| `GET` | `/api/portfolio/positions/{user_id}` | ✅ (self) | Positions |
| `GET` | `/api/portfolio/history/{user_id}` | ✅ (self) | Action history |
| `GET` | `/api/portfolio/yields/aave/{asset}` | – | Live Aave APY |

## Local development

**Prerequisites:** Node 20+, Python 3.12+, and the keys in [Environment variables](#environment-variables).

```bash
# 1. Install frontend deps
npm install

# 2. Backend deps + dev server (http://localhost:8000)
npm run dev:backend

# 3. Frontend dev server (http://localhost:5173) — in a second terminal
npm run dev
```

Create `backend/.env` and a root `.env` (both git-ignored) using the tables below. Set `VITE_API_URL=http://localhost:8000` for local.

## Environment variables

**Frontend (`.env`, build-time `VITE_*` + server-side for the executor):**

| Key | Example / purpose |
|---|---|
| `VITE_API_URL` | Backend base URL |
| `VITE_MAGIC_PUBLISHABLE_KEY` | Magic publishable key |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client |
| `VITE_ZERODEV_PROJECT_ID` / `VITE_ZERODEV_RPC_URL` | ZeroDev project + `.../chain/42161` |
| `VITE_ARBITRUM_RPC_URL` | Dedicated Arbitrum One RPC (client) |
| `VITE_ARBITRUM_CHAIN_ID` | `42161` |
| `AGENT_WALLET_PRIVATE_KEY` | **Server-only.** Session signer (holds no funds) |
| `ARBITRUM_RPC` | **Server-only.** Dedicated RPC for the executor |
| `ZERODEV_BUNDLER_URL` / `ZERODEV_PAYMASTER_URL` | **Server-only.** `.../chain/42161` |
| `API_URL` | **Server-only.** Backend base URL for token verification |

**Backend (`backend/.env`):** `VENICE_API_KEY`, `OPENAI_API_KEY`, `TINYFISH_API_KEY`, `MAGIC_SECRET_KEY`, `MAGIC_PUBLISHABLE_KEY`, `PARTICLE_*`, `GOOGLE_CLIENT_ID`, `ZERODEV_PROJECT_ID`/`ZERODEV_RPC_URL`, `ARBITRUM_RPC` (dedicated, not public), `ARBITRUM_CHAIN_ID=42161`, `AGENT_WALLET_PRIVATE_KEY`, `X402_FACILITATOR_URL`, `DATABASE_URL`, `ENVIRONMENT`, `CORS_ORIGINS`, `FRONTEND_URL`.

> The backend refuses to start in non-testing environments if any required key is missing (`validate_startup_config`). Full list + provider setup steps: [`docs/KEYS_SETUP.md`](docs/KEYS_SETUP.md).

## Deployment

Both projects deploy to Vercel under the `henrysammarfo` identity (see [`AGENTS.md`](AGENTS.md)).

```bash
# Backend (from ./backend, linked to the axis-api project)
vercel deploy --prod --yes

# Frontend (from repo root, linked to the axis-mainnet project)
vercel deploy --prod --yes
```

Env vars are stored in each project's Vercel **Production** environment. ZeroDev requires an **Arbitrum One gas-sponsorship policy** ("Sponsor all") to be enabled and funded, or gasless UserOps will not be sponsored.

## Testing

```bash
cd backend
ENVIRONMENT=testing python -m pytest --ignore=tests/live -q
```

`tests/` covers the strategy matrix, API routes, tenant isolation, and fuzz inputs. `tests/live/` exercises real chain/API paths and is expected to require funded wallets + keys.

## Production readiness & known gaps

**Verified working on mainnet:** config green (`chain_id 42161`, dedicated RPC), ZeroDev gas sponsorship live (real sponsored UserOp mined), deterministic strategies, policy-bounded session security, cryptographic auth + tenant isolation.

**Must address before calling it fully production-grade:**

1. **Durable database.** The backend currently uses SQLite on Vercel's ephemeral `/tmp` — session approvals and positions reset on cold start. **Move to Postgres** (Neon/Supabase) for real persistence. *(Highest-priority gap.)*
2. **Key rotation.** Rotate any keys shared during development. The agent key holds no funds (gasless signer only), but rotate regardless; ideally store it in a KMS/HSM and consider per-user session signers.
3. **CORS tightening.** The preview regex allows any `https://axis*.vercel.app`; pin exact production origins for audit.
4. **Paymaster spend cap.** Set a project-level ZeroDev cap so a bug can't drain the sponsor; the per-user rate-limit policy (100/day) already bounds abuse.

These are tracked in [`docs/PRODUCTION_AUDIT.md`](docs/PRODUCTION_AUDIT.md) and [`docs/AXIS_MEMORY.md`](docs/AXIS_MEMORY.md).
