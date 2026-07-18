# AXIS — Architecture

> **Last updated:** 2026-07-18 · **Chain:** Arbitrum One (`42161`)
> Companion to the root [`README.md`](../README.md). This document is the system-design + security reference.

---

## 1. System context

```mermaid
graph TD
  subgraph Client
    B[Browser · TanStack Start SPA]
  end
  subgraph Vercel
    FE[axis-mainnet<br/>frontend + Node server fns]
    API[axis-api<br/>FastAPI]
  end
  subgraph External
    MAGIC[Magic Labs<br/>Google OAuth + EOA]
    ZD[ZeroDev<br/>bundler + paymaster]
    ALCHEMY[Alchemy<br/>Arbitrum One RPC]
    AAVE[(Aave v3 Pool)]
    UNI[(Uniswap V3)]
    AI[Venice / OpenAI]
    TF[TinyFish + x402]
  end

  B --> FE
  B -->|DID token| API
  FE -->|gasless UserOps| ZD
  FE -->|token verify + load approval| API
  B -->|login| MAGIC
  API --> MAGIC
  API --> ALCHEMY
  API --> AI
  API --> TF
  ZD --> AAVE
  FE -->|reads| ALCHEMY
  API -->|calldata for| AAVE
  API -->|USDC->USDT calldata| UNI
```

**Two deploy targets, one repo:**
- `axis-mainnet` — the TanStack Start app. Its **Node server functions** (`createServerFn`) host the ZeroDev session executor and are the only place the agent key lives at runtime.
- `axis-api` — the FastAPI backend: auth, strategy engine, persistence, calldata building, yield data.

## 2. Component view

```mermaid
graph LR
  subgraph Frontend [src/]
    WALLET[wallet.ts<br/>Magic + EIP-7702 delegation]
    SESS[kernel-session.ts<br/>CallPolicy approval builder]
    EXEC[agent-executor.ts<br/>gasless UserOp executor · server fn]
    APICLIENT[api.ts<br/>typed client]
    HOOKS[useAxis.ts]
    ROUTES[routes/*]
  end

  subgraph Backend [backend/]
    DEP[dependencies.py<br/>require_auth]
    GUARD[tenant_guard.py]
    AUTHS[auth_service.py<br/>Magic DID verify]
    AGENT[routes/agent.py]
    STRAT[strategy_engine.py<br/>deterministic matrix]
    AAVETX[aave_transactions.py<br/>calldata + tx verify]
    TRACK[portfolio_tracker.py]
    CFG[config.py + chain_config.py]
  end

  ROUTES --> HOOKS --> APICLIENT --> AGENT
  ROUTES --> WALLET
  WALLET --> SESS
  HOOKS --> EXEC
  EXEC -->|verify token + load approval| AGENT
  AGENT --> DEP --> AUTHS
  AGENT --> GUARD
  AGENT --> STRAT
  AGENT --> AAVETX
  AGENT --> TRACK
  STRAT --> CFG
  AAVETX --> CFG
```

## 3. Onboarding & delegation

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant FE as Frontend
  participant M as Magic
  participant API as FastAPI
  participant ZD as ZeroDev/Kernel

  U->>FE: Continue with Google
  FE->>M: OAuth login
  M-->>FE: DID token + EOA address
  FE->>API: POST /api/auth/register (DID token)
  API->>M: verify DID token (magic-admin)
  API-->>FE: user_id + bound wallet
  FE->>M: sign7702Authorization (Kernel delegate)
  FE->>API: POST /api/auth/sponsor-eip7702
  API->>ZD: broadcast Type-4 (AXIS pays gas)
  ZD-->>API: tx hash
  API-->>FE: eip7702_delegated = true
```

## 4. Deposit / activation (client-signed)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant FE as Frontend
  participant API as FastAPI
  participant CH as Arbitrum One

  U->>FE: pick risk + goal + budget
  FE->>API: POST /api/agent/strategy/preview
  API-->>FE: locked plan + live APYs
  U->>FE: Deposit USDC, tap Begin
  FE->>API: POST /api/agent/deploy/prepare
  API->>CH: check USDC funding
  API-->>FE: unsigned Aave approve+supply txs
  FE->>U: Magic signs (first deposit)
  FE->>CH: submit supply
  FE->>API: POST /api/agent/activate/confirm (tx hashes)
  API->>CH: verify receipt status == 1
  API-->>FE: activated + positions logged
```

## 5. Hands-off mode (gasless session key)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant FE as Frontend
  participant EX as Node executor (server fn)
  participant API as FastAPI
  participant ZD as ZeroDev paymaster/bundler
  participant CH as Arbitrum One

  Note over U,FE: One-time approval
  FE->>EX: getSessionSignerAddress
  EX-->>FE: agent session-signer address
  FE->>FE: buildSessionApproval (CallPolicy-bounded)
  U->>FE: ONE Magic signature (approve session)
  FE->>API: POST /api/agent/session/enable (approval blob)

  Note over API,CH: Later — hands-free action
  API->>API: build_rebalance_calls (USDC-only, owner-pinned)
  FE->>EX: executeSessionCalls (DID token + calls)
  EX->>API: verify token + GET own approval
  API-->>EX: serialized approval
  EX->>ZD: sendUserOperation (gasless)
  ZD->>CH: supply/withdraw (policy-checked on-chain)
  CH-->>EX: receipt
  EX-->>FE: tx hash
  FE->>API: POST /api/agent/rebalance/confirm
```

## 6. Session-key threat model

```mermaid
flowchart TD
  START{Agent key compromised?} -->|No| SAFE[Normal gasless operation]
  START -->|Yes| ATT[Attacker controls session signer]
  ATT --> TRY{Attempt malicious call}
  TRY -->|transfer / non-USDC / other recipient| REJECT[Rejected by on-chain CallPolicy]
  TRY -->|withdraw USDC| TO[to == owner enforced]
  TO --> OWNER[Funds go to the OWNER, not attacker]
  TRY -->|spam valid calls| RL[Rate-limit policy: 100/day]
  REJECT --> RESULT[No theft possible]
  OWNER --> RESULT
  RL --> GRIEF[Worst case: griefing / wasted sponsored gas]
```

**Guarantee:** the signed `CallPolicy` (`src/lib/kernel-session.ts`) pins `approve` spender = Aave Pool, `supply` asset = USDC & `onBehalfOf` = owner, `withdraw` asset = USDC & `to` = owner. A compromised key can, at worst, move a user's own USDC between their wallet and their own Aave position, or waste sponsored gas (bounded to 100 ops/day). **It can never redirect funds to a third party.**

### Defense-in-depth layers

```mermaid
graph TD
  L1[1 · Magic DID auth<br/>every mutating route] --> L2
  L2[2 · Tenant isolation<br/>assert_same_user + wallet ownership] --> L3
  L3[3 · Server-side approval load<br/>anti-replay in executor] --> L4
  L4[4 · On-chain CallPolicy<br/>+ rate limit] --> L5
  L5[5 · On-chain receipt verification<br/>status == 1] --> L6
  L6[6 · Rate limiting + CORS + encrypted secrets]
```

## 7. Data model (core)

```mermaid
erDiagram
  USER ||--o{ ACTION : logs
  USER ||--o{ POSITION : holds
  USER {
    string id PK "Magic issuer"
    string email
    string ua_address "bound wallet"
    string sra_address
    float budget_usdc
    string risk_level
    string goal
    string eip7702_tx_hash
    bool eip7702_delegated
    text session_key_approval "serialized CallPolicy acct"
    string session_key_signer
    bool session_active
    json custom_strategy "power-user legs"
  }
  ACTION {
    int id PK
    string user_id FK
    string action_type
    json params
    json result
    string message
  }
  POSITION {
    int id PK
    string user_id FK
    string protocol
    string asset
    float amount_usdc
  }
```

## 8. Deployment topology

```mermaid
graph TD
  subgraph GitHub
    REPO[henrysammarfo/axis · main]
  end
  subgraph Vercel · teamtitanlink
    FE[axis-mainnet<br/>Production env: VITE_* + server keys]
    API[axis-api<br/>Production env: full key set · root=backend/]
  end
  REPO --> FE
  REPO --> API
  FE -->|VITE_API_URL / API_URL| API
  API -->|Alchemy dedicated| RPC[Arbitrum One]
  FE -->|ZeroDev chain/42161| PM[Bundler + Paymaster]
```

| Concern | Current state | Production target |
|---|---|---|
| Database | SQLite on ephemeral `/tmp` | **Postgres (Neon/Supabase)** |
| Agent key storage | Vercel encrypted env | KMS/HSM; per-user signers |
| Paymaster limit | ZeroDev dashboard policy | Explicit project spend cap |
| CORS | `axis*.vercel.app` regex + explicit origins | Exact production origins only |
| Config status | RPC key **redacted** ✅ | — |

## 9. Design principles

1. **Non-custodial by construction** — keys derive from the user's Google login; AXIS never holds user funds.
2. **On-chain enforcement over trust** — the session `CallPolicy` is the security boundary, not backend code.
3. **Deterministic strategy, AI narration** — allocations come from a fixed matrix; AI only explains.
4. **Real transactions only** — every user-visible action maps to a verifiable Arbiscan tx; simulated hashes are rejected.
5. **Fail fast** — the backend refuses to boot without its full key set.
