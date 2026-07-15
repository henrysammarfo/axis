# AXIS — Production Mainnet Audit & Mandatory Build Plan

> **Status:** Source of truth for production / enterprise / audit readiness  
> **Last verified:** 2026-07-15  
> **Primary settlement chain:** **Arbitrum One (`42161`)** — not Sepolia  
> **Rule:** Nothing in this document is optional. Every item is mandatory to ship.

This document fact-checks repo MDs + live code + public Particle/ZeroDev docs.  
Do **not** trust `AXIS_BUILD_GUIDE.md` as current — it retains known errors.

---

## 1. Verdict (fact, not aspiration)

| Claim in product/docs | Reality in code today (`421614` Sepolia) | Status |
|----------------------|------------------------------------------|--------|
| Particle Universal Accounts | **Skipped** — Magic EOA used as `ua_address` | ❌ Incomplete |
| EIP-7702 upgrade | **Not executed** — no `sign7702Authorization` / Type-4 path | ❌ Incomplete |
| ZeroDev Smart Routing Address | **Skipped** on Sepolia (API Invalid params) | ❌ Incomplete |
| Magic Google login | Implemented (`magic-admin` + oauth2) | ✅ Works |
| Cross-chain “one balance” | Not live without UA + routing | ❌ Incomplete |
| Real DeFi execution via UA | Agent-wallet Sepolia Aave fallback only | ❌ Incomplete |
| Aave GraphQL yields | Mainnet GraphQL; Sepolia uses on-chain | ⚠️ Split path |
| x402 | PayAI echo path targets Sepolia | ⚠️ Needs mainnet facilitator path |
| Docs claim “fully configured” keys | Env presence ≠ UA/SRA live | ⚠️ Misleading on `/proof` |

**Conclusion:** Current Sepolia build is a **demo scaffold**. It is **not** production Universal-Account / EIP-7702 / SRA complete. Mainnet is required for the architecture the pitch sells.

---

## 2. Official-doc constraints (verified sources)

### Particle Universal Accounts + EIP-7702
- Official: [EIP-7702 compatible wallets](https://developers.particle.network/universal-accounts/ua-reference/web/eip7702-wallets)
- Official: [Initialization / EIP-7702 mode](https://developers.particle.network/universal-accounts/ua-reference/web/initialization)
- Reference: [Particle-Network/universal-accounts-7702](https://github.com/Particle-Network/universal-accounts-7702)
- **7702-capable chains listed in Particle 7702 repo:** Ethereum, Arbitrum, Base, Optimism, Polygon, BNB Chain, Sonic, Berachain (mainnets — not Sepolia).
- Magic path requires `sign7702Authorization` / Type-4 handling — **AXIS does not call this yet**.
- Setting `useEIP7702: true` alone is **not** a completed delegation.

### ZeroDev SRA
- Official: [Smart Routing Address](https://docs.zerodev.app/cross-chain/smart-routing-address)
- SDK examples use **mainnet** `viem` chains (`arbitrum`, `base`, `optimism`).
- ZeroDev **AA/bundler** supports Arbitrum Sepolia ([chains FAQ](https://docs.zerodev.app/api-and-toolings/faqs/chains)), but **AXIS’s public SRA create** failed on Sepolia in practice (`JSON-RPC Invalid params`) — code skips SRA on `421614` for that reason.
- Production destination for AXIS must be **Arbitrum One** with mainnet `srcTokens`.

### Repo docs accuracy
| Doc | Accuracy | Action |
|-----|----------|--------|
| `AXIS_BUILD_GUIDE.md` | **Outdated / wrong** (RPC typo, prize math, mock execute, old Particle imports) | Superseded — do not follow |
| `docs/AXIS_FACT_CHECK.md` | Still largely correct vs build guide (2026-07-07) | Keep as historical correction |
| `docs/AXIS_MEMORY.md` | **Stale** (“backend NOT BUILT”, fake dashboard) | Must update |
| `docs/KEYS_SETUP.md` | Defaults Sepolia; some examples mix mainnet RPC + Sepolia chain ID | Must rewrite for mainnet production |
| `docs/AXIS_WIN_STRATEGY.md` | Hackathon-oriented; deadline noted as past | Strategy only — not production spec |
| `docs/HANDOFF.md` | Ops useful; still Sepolia/demo oriented | Keep ops; defer to this doc for product completeness |

---

## 3. Mandatory production architecture (all required)

```
Magic Google OAuth
  → Magic EOA
  → Particle UA v2 + EIP-7702 delegation on Arbitrum One (42161)
  → ZeroDev bundler/paymaster (v3 RPC chain/42161)
  → ZeroDev SRA (dest = Arbitrum One; src = Base/OP/ETH/Arbitrum mainnets)
  → Backend FastAPI executes strategies ONLY via UA-authorized paths
  → PostgreSQL durable state (+ backups)
  → Mainnet Alchemy/Infura dedicated RPC
  → x402 micropayments on Arbitrum One facilitator route
  → Rate limits, spend caps, audit logs, secrets in vault
```

No “skip on testnet”, no “fund EOA instead”, no agent-wallet as primary path in production.

---

## 4. Mandatory work packages (completion = done, not partial)

### P0 — Chain cutover
1. Set `ARBITRUM_CHAIN_ID=42161` and `VITE_ARBITRUM_CHAIN_ID=42161` everywhere.
2. Alchemy (or equivalent) **Arbitrum One** HTTPS RPC — no public RPC.
3. ZeroDev project: enable **Arbitrum One**; gas policy sponsor rules documented; `ZERODEV_RPC_URL=.../chain/42161`.
4. Particle dashboard: production app IDs for mainnet UA.
5. Magic: production origins + redirect URIs for every live domain.
6. Remove / disable Sepolia shortcut branches in `src/lib/wallet.ts` for production builds.

### P0 — Universal Account + EIP-7702 (real)
1. Follow Particle Magic 7702 flow (official demos): get auth → `magic.wallet.sign7702Authorization` → broadcast Type-4.
2. Persist delegation status per chain; prove same address before/after on `/proof`.
3. Store Arbiscan Type-4 tx hash for audits.
4. Fail hard if delegation missing — **do not** fall back to EOA-as-UA in production.

### P0 — ZeroDev SRA (real)
1. Create SRA with `@zerodev/smart-routing-address` dest=`arbitrum` (One).
2. Source tokens: USDC (and required natives) on Base, Optimism, Ethereum, Arbitrum — as product requires (all mandatory for the cross-chain deposit promise).
3. Persist `sra_address` in DB; show on dashboard/deposit UI.
4. E2E test: send USDC from a supported source chain → funds arrive on Arbitrum One owner/UA.

### P0 — Execution (no mocks)
1. Remove agent-wallet Sepolia “demo fallback” as a production code path.
2. All activate/rebalance txs go through UA (+ ZeroDev sponsor where applicable).
3. Every user-visible action stores real `tx_hash` verifiable on Arbiscan.
4. Reject simulated / random hashes in CI.

### P0 — Data & AI
1. Yield: live Aave / protocol sources on mainnet only (GraphQL + TinyFish failover) — zero hardcoded APYs.
2. AI: Venice primary + OpenAI failover retained; tool calls must bind to live inventory.
3. x402: mainnet facilitator/route with spend ledger + daily cap enforced.

### P0 — Platform & security (audit baseline)
1. PostgreSQL (not ephemeral SQLite) with migrations + backups.
2. Secrets: Azure Key Vault / Vercel encrypted env — never chat/commit.
3. Rotate all keys previously pasted in chat.
4. CORS allowlist exact production origins (regex alone insufficient for audit).
5. AuthZ: DID verify every protected route; tenant isolation tests.
6. Rate limits + x402 spend caps + structured audit logs.
7. Dependency pin + `npm audit` / `pip audit` gate in CI.
8. Staging environment that mirrors mainnet config (separate keys).

### P0 — Docs & truthfulness
1. `/proof` must verify **live capabilities** (delegation tx, SRA address, last real tx) — not “key present”.
2. Update KEYS_SETUP, MEMORY, HANDOFF to mainnet; mark BUILD_GUIDE superseded.
3. Never claim “unhackable”; document residual smart-contract / bridge / key risks.

---

## 5. Acceptance tests (must all pass)

| # | Test | Pass criteria |
|---|------|----------------|
| 1 | Google login production | Magic redirect allowlisted; session registers |
| 2 | EIP-7702 | Type-4 tx on Arbiscan; EOA == UA address |
| 3 | SRA deposit | Fund from Base/OP → arrives Arbitrum One |
| 4 | Activate | Real Aave (or declared protocol) supply tx |
| 5 | Rebalance | Second real tx + plain-English log |
| 6 | x402 | Real micropayment + spend row |
| 7 | Restart | Portfolio intact (Postgres) |
| 8 | Security | Unauthed API 401; CORS rejects unknown origin |
| 9 | Config | `/config/status` green on **mainnet** IDs |
| 10 | Docs | No MD contradicts live behavior |

---

## 6. Recommended build order (still all mandatory)

1. Docs cutover (this file + KEYS_SETUP mainnet)  
2. Infra keys/dashboard for **42161**  
3. UA + 7702 Magic path (copy official reference, then integrate)  
4. SRA create + deposit E2E  
5. DeFi execute via UA  
6. Postgres + Azure/Vercel production hosting  
7. x402 mainnet  
8. Proof page + audit checklist + key rotation  

---

## 7. Explicit non-goals (do not treat as “done”)

- Shipping Sepolia EOA-as-UA as Universal Accounts  
- Marketing EIP-7702 without a Type-4 hash  
- “Keys configured” as SRA/UA proof  
- Agent private key as primary user execution path  
- Ephemeral SQLite on serverless as production DB  

---

## 8. Immediate owner actions

1. Confirm production frontend domain (custom / Vercel) and Alchemy **Arbitrum One** app.  
2. Rotate all secrets exposed in chat; load into vault/Vercel only.  
3. Authorize mainnet builds: switch chain IDs to `42161` and remove Sepolia production fallbacks.  
4. Budget for mainnet gas/sponsor (ZeroDev policy) + small USDC for SRA/E2E tests.
