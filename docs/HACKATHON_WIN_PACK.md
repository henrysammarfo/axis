# AXIS — Competition Win Pack

> **AXIS** — Set. Forget. Earn.  
> AI DeFi portfolio agent on **Arbitrum One**. Google login → deposit USDC → one tap → hands-off yield. **Zero transaction signing after login.**  
> Facts only. No invented TVL, users, or APY “wins.”

**Live:** https://axis-mainnet.vercel.app · **API:** https://axis-api-beta.vercel.app · **Proof:** `/proof` after Google · **Repo:** https://github.com/henrysammarfo/axis

**Tracks:** Universal Accounts (EIP-7702) · ZeroDev Subtrack · Arbitrum Bounty · Magic Labs Bonus

---

# 1. GitHub README (hackathon / investor 30-second convert)

*Paste this block at the top of README or use as the public-facing README intro. Keep the long technical sections below it.*

```markdown
# AXIS — Set. Forget. Earn.

**Google login. Deposit USDC. One tap. AXIS invests on Arbitrum One — no MetaMask, no gas UI, no transaction signing after login.**

Most “DeFi for everyone” apps still force MetaMask, gas, bridges, and approve-every-trade. AXIS removes that path: Magic embeds the wallet, Particle Universal Accounts upgrades the same EOA via **EIP-7702**, ZeroDev **SRA** takes deposits from any chain, and a **CallPolicy-bounded session key** executes Aave / Uniswap LP / GMX gaslessly — funds can only settle back to the owner.

| Proof (verified) | Detail |
|------------------|--------|
| Live mainnet | https://axis-mainnet.vercel.app · chain **42161** |
| Min deploy | **$10** USDC |
| Signing after Google | **0** wallet prompts for Begin / Apply |
| Venues | Aave v3 USDC · Uniswap V3 USDC/USDT LP · GMX V2 GM |
| Strategy | Deterministic risk×goal + best-yield router — **AI explains, never allocates** |
| Gas sponsorship | Live sponsored UserOp on Arbitrum One ([tx](https://arbiscan.io/tx/0x96c27132fd04085aaf0443521f105b921083fa8f1a35d06039cfe3ed86fcc3d4)) |
| Judge evidence | `/proof` — UA address · Type-4 hash · SRA |

## Why this exists

Idle USDC sits on exchanges because earning yield still means: install a wallet, buy gas, bridge, pick a protocol, sign every move. AXIS collapses that into a consumer flow judges can feel in under two minutes.

## How it works

```
Google → Magic embedded EOA
      → Particle UA (EIP-7702 Type-4, same address)
      → ZeroDev SRA (deposit from any chain → Arbitrum)
      → Kernel session key + CallPolicy (owner-pinned)
      → Aave / Uniswap LP / GMX (gasless UserOps)
      → Plain-English weekly note (Venice/OpenAI explain only)
```

## Outcomes (not feature laundry)

- **Set risk + goal + budget** → real allocation matrix, not chatbot guesswork
- **Begin / Apply best route** → gasless UserOps; unfundable legs skip gracefully
- **Balance-aware** → reads USDC/USDT/ETH; pre-skips GMX if keeper ETH is missing
- **Non-custodial safety** → leaked agent key still cannot drain to attacker addresses
- **Judge-ready stack** → Magic + Particle UA 7702 + ZeroDev SRA/session + Arbitrum settlement

## Stack (why each piece)

| Layer | Choice | Why |
|-------|--------|-----|
| Auth / wallet | Magic Google OAuth | Consumer login; no MetaMask |
| Account | Particle UA + EIP-7702 | Same EOA upgraded in place |
| Deposits | ZeroDev SRA | Cross-chain value without bridge UI |
| Execution | ZeroDev Kernel + CallPolicy + paymaster | Signing-free, gasless, policy-bounded |
| Settlement | Arbitrum One | Invisible backend for consumer UX |
| Engine | FastAPI + deterministic router | Feasible, auditable allocations |
| Explain | Venice + OpenAI | Clarity without letting AI move money |

## Quick start for judges

1. Open https://axis-mainnet.vercel.app/onboard → Continue with Google  
2. Open `/proof` (or Settings → Judge proof) → UA · Type-4 · SRA  
3. Fund ≥ $10 USDC (SRA from another chain scores ZeroDev/UA hardest)  
4. Tap **Begin** or **Apply best route** — watch for **no** wallet popup  
5. Open Arbiscan from Agent Log  

## Next

Demo script · pitch · paste-ready form: `docs/SUBMISSION.md` · `docs/DEMO_SCRIPT.md` · `docs/PITCH_DECK.md` · this win pack.
```

---

# 2. Structured Project Description

## Context / problem

DeFi yield is real on Arbitrum (Aave, Uniswap, GMX). Consumer adoption fails at the workflow layer: MetaMask, gas, bridges, protocol choice, and repeated transaction signing. AXIS targets that gap — not “better APY research,” but **execution without crypto UX**.

We do **not** claim unverified market-size figures. The urgency for this hackathon is demonstrated by the judging criteria themselves: **UX excellence 40%**, UA+7702 / SRA prominence **30%**, and Arbitrum’s demand that users never think about wallets, gas, or chains.

## Target users (personas)

| Persona | Current painful workflow | AXIS path |
|---------|--------------------------|-----------|
| **Exchange USDC holder** | Withdraw → MetaMask → bridge → Aave UI → sign approve + supply | Google → send USDC to SRA → Begin |
| **Busy set-and-forget** | Checks Twitter for “best yield,” never rebalances, leaves stables idle | Set Moderate + Maximize + budget → Apply best route → weekly plain-English note |
| **Power user** | Wants GMX/LP but hates signing every keeper/LP step | Aggressive + market-risk consent; toggle venues; still **0** signing after login |

## Solution architecture (precise, low jargon)

1. **Magic** creates a non-custodial EOA from Google OAuth.  
2. **Particle Universal Accounts** in EIP-7702 mode upgrades that EOA in place (Type-4 delegation) — same address, no migration.  
3. **ZeroDev SRA** is the deposit funnel: value from supported chains settles for use on Arbitrum One.  
4. **ZeroDev Kernel v3.3 session key** + **CallPolicy** allow AXIS’s agent signer to run only owner-pinned Aave / (optional) Uniswap LP / GMX calls; paymaster sponsors gas.  
5. **FastAPI** runs a **deterministic** risk×goal matrix and **best-yield router** (live APYs). **Venice/OpenAI** only narrate results.  
6. Frontend (**TanStack Start**) exposes Begin / Apply best route; Node `createServerFn` executor submits UserOps after Magic DID verification.

## Unique value proposition

| Alternative | AXIS |
|-------------|------|
| MetaMask + Aave | Google only; no extension |
| Yield dashboards | Actually deploys capital gaslessly |
| ChatGPT “what should I farm?” | Deterministic engine; AI cannot allocate |
| Custodial “earn” products | User owns the account; CallPolicy pins recipients |
| Single-protocol bots | Router across Aave + LP + GMX with graceful skip |

**Defensibility for this competition:** full **Magic + Particle UA EIP-7702 + ZeroDev SRA + Kernel session** path shipped on **mainnet**, with `/proof` evidence — not a slideware wallet.

## Technology choices (rationale)

- **EIP-7702 / UA** — satisfies Particle track; chain-abstracted UX without a new address.  
- **ZeroDev SRA + session keys** — satisfies ZeroDev subtrack; enables cross-chain deposits and autonomous execution.  
- **Arbitrum One** — settlement + venues; Arbitrum bounty “invisible infrastructure.”  
- **Magic** — Magic bonus; invisible wallet.  
- **Deterministic router over agentic trading** — AI judges punish hallucination; allocations stay auditable.

## Projected / demonstrated impact (quantified, honest)

| Metric | Status |
|--------|--------|
| Signing prompts after Google for invest flows | **0** (product law) |
| Minimum budget | **$10** USDC |
| Settlement chain | Arbitrum One **42161** |
| Investable venues (session-safe) | **3** (Aave, Uniswap LP, GMX) |
| Risk × goal cells | **3 × 3** deterministic matrix |
| Deployed demo | Live production URLs above |
| Gas sponsorship | Verified mainnet sponsored UserOp |
| Prize tracks addressed in one repo | **4** |

Post-hack goals (aspirational, labeled as such): beta cohort via network; performance fee on yield only after disclosure — see `docs/STARTUP_STRATEGY.md`.

---

# 3. Submission Form Fields (paste-ready)

## Problem statement

DeFi yield on Arbitrum requires MetaMask, gas, bridges, protocol picking, and signing every trade — so exchange USDC stays idle. AXIS removes that workflow: Google login, deposit, one tap, hands-off invest. Urgency matches this hackathon’s score weights — UX and chain abstraction beat another APY table.

## Target audience

(1) Coinbase/exchange USDC holders who want yield but refuse MetaMask; (2) busy users who set a budget once and check weekly; (3) power users who want Aave + optional LP/GMX with venue toggles but still zero signing. Reachable via Google OAuth and a single live URL — no extension install.

## Solution description

Magic embeds a wallet from Google. Particle Universal Accounts upgrades the same EOA via EIP-7702. ZeroDev SRA accepts cross-chain USDC onto Arbitrum. A CallPolicy-bounded Kernel session key executes gasless supplies/LP/GMX. A deterministic best-yield router picks the plan from live APYs and risk settings; AI only explains. User taps Begin or Apply best route — no wallet popups after login.

## Unique selling proposition

**Zero signing after Google** plus a **judge-complete stack** (Magic + Particle UA 7702 + ZeroDev SRA/session + Arbitrum) with **owner-pinned CallPolicy** and a **deterministic** allocator (AI never moves money). Competitors usually ship one of: a wallet demo, a chat agent, or a single-protocol bot — not all of the above on mainnet with `/proof`.

## Technical implementation

TanStack Start frontend; FastAPI + Postgres backend; Magic DID auth; Particle UA EIP-7702; ZeroDev Kernel session keys, paymaster, and SRA; Alchemy Arbitrum One RPC; venues Aave v3, Uniswap V3 stable LP, GMX V2 GM; Venice/OpenAI for narration; TinyFish/x402 for intelligence. Feasible today: live `fully_configured` API, sponsored UserOp mined, `/proof` for Type-4 + SRA.

## Impact metrics

- **0** post-login signing prompts for Begin / Apply  
- **$10** minimum deploy  
- **42161** mainnet live (axis-mainnet.vercel.app)  
- **3** session-safe venues · **3×3** strategy matrix  
- Gasless execution proven: Arbiscan `0x96c27132fd04085aaf0443521f105b921083fa8f1a35d06039cfe3ed86fcc3d4`  
- One codebase covers **UA + ZeroDev + Arbitrum + Magic** judging surfaces  

*[BRACKET if you add after filming: YOUR_BEGIN_TX_HASH · YOUR_SRA_DEPOSIT_PROOF]*

---

## Track keyword map (for AI + human scanners)

| Track | Keywords to keep visible |
|-------|---------------------------|
| Universal Accounts | EIP-7702, Type-4, same EOA, Particle UA, chain-abstracted |
| ZeroDev | SRA, Smart Routing Address, Kernel, CallPolicy, session key, gasless UserOp |
| Arbitrum | Arbitrum One, 42161, invisible settlement, no gas UI, no bridges |
| Magic | Google login, embedded wallet, no MetaMask |

**One-liner:** AXIS is the DeFi product where you sign in with Google, set a budget, and an agent earns yield for you — no wallet, no gas, no chains.
