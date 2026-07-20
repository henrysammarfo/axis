# AXIS — Hackathon Submission (paste-ready)

> **Deadline:** Monday, July 20, 2026 — 11:59 AM Atlantic/Reykjavik  
> **Team:** Henry Sam Marfo (Leader)  
> Fill the Encode / Particle form with the blocks below. Do not invent links — use these.

---

## Form fields

| Field | Value |
|-------|-------|
| **Project Name** | AXIS |
| **Team Members** | Henry Sam Marfo (Leader) |
| **Link to Code** | https://github.com/henrysammarfo/axis |
| **Live Demo Link** | https://axis-mainnet.vercel.app |
| **Judge proof (after Google login)** | https://axis-mainnet.vercel.app/proof |
| **Link to Presentation** | *(paste your Canva / Google Slides URL after exporting from `docs/PITCH_DECK.md`)* |
| **Link to Demo Video** | *(paste YouTube unlisted URL after recording from `docs/DEMO_SCRIPT.md`)* |
| **API health** | https://axis-api-beta.vercel.app/health |

### Challenges / tracks to select

- Universal Accounts Track (Particle Network — EIP-7702)
- General Track → Subtrack 2 — ZeroDev
- Arbitrum “Road to Open House London” Bounty
- Magic Labs Bonus Challenge
- Track Selection, Rules & Judging (as required by the form)

---

## Project Description (short — paste into form)

AXIS is an AI DeFi portfolio agent: sign in with Google, deposit USDC, tap once, and AXIS invests and rebalances on Arbitrum One for you — no MetaMask, no gas UI, no transaction signing after login. Built on Particle Universal Accounts (EIP-7702), Magic embedded wallets, and ZeroDev Smart Routing Addresses + session keys so normal people can earn yield without touching crypto plumbing.

---

## Checkpoint 3 — Detailed explanation (paste into “Describe your work…”)

AXIS turns “I want my money to earn” into a real, non-custodial on-chain portfolio. The product law is simple: after Google sign-in, the user never signs a transaction. They deposit, set risk and goal, tap Begin or Apply best route, and AXIS executes.

**Onboarding & accounts.** Magic Labs creates an embedded EOA from Google OAuth. Particle Universal Accounts upgrades that same EOA in place via EIP-7702 (Type-4 delegation) — no new address, no migration, no separate smart-account deploy. ZeroDev creates a Smart Routing Address (SRA) so the user can send USDC from any supported chain and have it settle for investment on Arbitrum One. Live evidence (UA address, Type-4 tx hash, SRA) is on `/proof` after login.

**Hands-off execution.** AXIS grants a ZeroDev Kernel v3.3 session key bounded by an on-chain CallPolicy. The agent can only approve/supply/withdraw (and, with market-risk consent, Uniswap V3 stable LP and GMX V2 GM) with recipients and markets pinned to the owner. Gas is sponsored via ZeroDev paymaster. Even if the agent key leaked, funds cannot leave the user’s account to an attacker address.

**Strategies that actually work.** Allocations come from a deterministic risk × goal matrix and a best-yield router that reads live APYs across Aave v3 USDC, Uniswap V3 USDC/USDT LP, and GMX V2 GM — not AI guesswork. AI (Venice + OpenAI) only explains what the engine did in plain English. One-tap “Apply best route” runs each venue as its own gasless UserOp, skips unfundable legs (e.g. missing ETH for GMX keeper fee), and shows a “What AXIS did” summary. Budget caps control how much AXIS can put to work ($10 minimum).

**Mainnet.** Production runs on Arbitrum One (42161): https://axis-mainnet.vercel.app — API https://axis-api-beta.vercel.app. Positions and actions link to Arbiscan. Paymaster sponsorship verified with a live gasless UserOp on mainnet.

**Why this fits each track**

- **Universal Accounts + EIP-7702:** Same EOA as UA; Type-4 delegation; chain-abstracted UX; cross-chain value via SRA.
- **ZeroDev:** SRA as the deposit funnel; Kernel session keys + CallPolicy as the autonomous execution core.
- **Arbitrum:** Settlement and all DeFi venues on Arbitrum; users never think about wallets, gas, or bridges.
- **Magic:** Google login → invisible embedded wallet; no MetaMask anywhere in the product path.

Repo: https://github.com/henrysammarfo/axis — architecture: `docs/ARCHITECTURE.md`.

---

## Track callout bullets (optional extra in README / deck)

- [x] Particle Universal Accounts SDK in EIP-7702 mode (EOA upgraded in place)
- [x] At least one cross-chain value path via UA + ZeroDev SRA (deposit from any chain → Arbitrum)
- [x] Functional deployed demo on Arbitrum One mainnet
- [x] ZeroDev SRA + Kernel session keys as core product infrastructure
- [x] Magic embedded wallet + Google social login as the only auth
- [x] Consumer UX: no MetaMask, no gas UI, no signing after login

---

## Project image

Use a clean screenshot of:

1. Landing hero (`/`), **or**
2. Dashboard after a real Begin / Apply (positions + Smart route card)

Preferred: dashboard with real APY numbers and “Hands-off on” — proves mainnet, not a mock.

---

## Pre-submit checklist

- [ ] Smoke: Google login → `/proof` green (UA + 7702 hash + SRA)
- [ ] Smoke: deposit USDC → Begin or Apply → Arbiscan tx
- [ ] Demo video uploaded (YouTube unlisted) — follow `docs/DEMO_SCRIPT.md`
- [ ] Pitch deck exported (Canva/Slides) — follow `docs/PITCH_DECK.md`
- [ ] All four challenges selected on the form
- [ ] Live demo URL opens without SSO protection
- [ ] Repo public: https://github.com/henrysammarfo/axis
