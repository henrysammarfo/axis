# AXIS — Hackathon Submission (paste-ready)

> **Deadline:** Monday, July 20, 2026 — 11:59 AM Atlantic/Reykjavik  
> **Team:** Henry Sam Marfo (Leader)  
> **Full win narrative:** [`docs/HACKATHON_WIN_PACK.md`](HACKATHON_WIN_PACK.md)  
> Fill the Encode / Particle form with the blocks below. Do not invent links or metrics.

---

## Form fields

| Field | Value |
|-------|-------|
| **Project Name** | AXIS |
| **Team Members** | Henry Sam Marfo (Leader) |
| **Tagline** | Set. Forget. Earn. — Google login → deposit USDC → one tap → hands-off yield on Arbitrum One |
| **Link to Code** | https://github.com/henrysammarfo/axis |
| **Live Demo Link** | https://axis-mainnet.vercel.app |
| **Judge proof (after Google login)** | https://axis-mainnet.vercel.app/proof |
| **Link to Presentation** | *(paste Canva / Google Slides URL from `docs/PITCH_DECK.md`)* |
| **Link to Demo Video** | *(paste YouTube unlisted URL from `docs/DEMO_SCRIPT.md`)* |
| **API health** | https://axis-api-beta.vercel.app/health |

### Challenges / tracks to select

- Universal Accounts Track (Particle Network — EIP-7702)
- General Track → Subtrack 2 — ZeroDev
- Arbitrum “Road to Open House London” Bounty
- Magic Labs Bonus Challenge
- Track Selection, Rules & Judging (as required by the form)

---

## Optimized form blocks (copy-paste)

### Problem statement

DeFi yield on Arbitrum still requires MetaMask, gas, bridges, protocol picking, and signing every trade — so exchange USDC stays idle. AXIS removes that workflow: Google login, deposit, one tap, hands-off invest. That matches this hackathon’s weights — UX and chain abstraction beat another APY table.

### Target audience

(1) Exchange USDC holders who want yield but refuse MetaMask; (2) busy users who set a budget once and check weekly; (3) power users who want Aave plus optional Uniswap LP / GMX with venue toggles but still zero signing. Reachable via Google OAuth and one live URL — no extension.

### Solution description

Magic embeds a wallet from Google. Particle Universal Accounts upgrades the same EOA via EIP-7702. ZeroDev SRA accepts cross-chain USDC onto Arbitrum. A CallPolicy-bounded Kernel session key executes gasless Aave / LP / GMX. A deterministic best-yield router builds the plan from live APYs and risk settings; AI only explains. User taps Begin or Apply best route — **no wallet popups after login**.

### Unique selling proposition

**Zero signing after Google**, a **judge-complete stack** (Magic + Particle UA EIP-7702 + ZeroDev SRA/session + Arbitrum), **owner-pinned CallPolicy**, and a **deterministic** allocator — AI never moves money. One mainnet demo with `/proof` (UA · Type-4 · SRA), not slideware.

### Technical implementation

TanStack Start · FastAPI + Postgres · Magic DID · Particle UA EIP-7702 · ZeroDev Kernel session keys, paymaster, SRA · Alchemy Arbitrum One · Aave v3, Uniswap V3 stable LP, GMX V2 GM · Venice/OpenAI narration. Live API `fully_configured`, sponsored UserOp mined on 42161, `/proof` for judges.

### Impact metrics

- **0** post-login signing prompts for Begin / Apply  
- **$10** minimum deploy  
- Live on Arbitrum One **42161** — https://axis-mainnet.vercel.app  
- **3** session-safe venues · **3×3** risk×goal matrix  
- Gasless proof: https://arbiscan.io/tx/0x96c27132fd04085aaf0443521f105b921083fa8f1a35d06039cfe3ed86fcc3d4  
- One repo covers **UA + ZeroDev + Arbitrum + Magic**

---

## Project Description (short — paste into form)

AXIS is an AI DeFi portfolio agent: sign in with Google, deposit USDC, tap once, and AXIS invests on Arbitrum One — no MetaMask, no gas UI, **no transaction signing after login**. Particle Universal Accounts (EIP-7702) + Magic embedded wallets + ZeroDev SRA and CallPolicy session keys turn “earn yield” into a consumer product, not a wallet checklist.

---

## Checkpoint 3 — Detailed explanation (paste into “Describe your work…”)

AXIS turns “I want my money to earn” into a real, non-custodial on-chain portfolio. Product law: after Google sign-in, the user never signs a transaction. They deposit, set risk and goal, tap Begin or Apply best route, and AXIS executes.

**Onboarding & accounts.** Magic Labs creates an embedded EOA from Google OAuth. Particle Universal Accounts upgrades that same EOA in place via EIP-7702 (Type-4 delegation) — no new address, no migration. ZeroDev Smart Routing Address (SRA) lets users send USDC from supported chains into Arbitrum One for investment. Live evidence (UA address, Type-4 tx hash, SRA) is on `/proof` after login.

**Hands-off execution.** AXIS enables a ZeroDev Kernel v3.3 session key bounded by an on-chain CallPolicy. The agent may only approve/supply/withdraw (and, with market-risk consent, Uniswap V3 stable LP and GMX V2 GM) with recipients and markets pinned to the owner. Gas is sponsored via ZeroDev paymaster. A leaked agent key cannot drain funds to an attacker address.

**Strategies that work.** Allocations come from a deterministic risk × goal matrix and a best-yield router reading live APYs across Aave v3 USDC, Uniswap V3 USDC/USDT LP, and GMX V2 GM — not AI guesswork. Venice/OpenAI only explain results. One-tap Apply runs each venue as its own gasless UserOp, skips unfundable legs, and shows “What AXIS did.” Budget cap from **$10** USDC.

**Mainnet.** https://axis-mainnet.vercel.app · API https://axis-api-beta.vercel.app · chain **42161**. Paymaster sponsorship verified with a live gasless UserOp on Arbiscan (`0x96c27132…fcc3d4`).

**Tracks:** UA + EIP-7702 · ZeroDev SRA + session keys · Arbitrum invisible settlement · Magic Google-only auth.

Repo: https://github.com/henrysammarfo/axis · Win pack: `docs/HACKATHON_WIN_PACK.md` · Architecture: `docs/ARCHITECTURE.md`.

---

## Track callout bullets

- [x] Particle Universal Accounts SDK in EIP-7702 mode (EOA upgraded in place)
- [x] Cross-chain value path via UA + ZeroDev SRA → Arbitrum
- [x] Functional deployed demo on Arbitrum One mainnet
- [x] ZeroDev SRA + Kernel session keys as core infrastructure
- [x] Magic embedded wallet + Google social login as the only auth
- [x] Consumer UX: no MetaMask, no gas UI, no signing after login

---

## Project image

Dashboard after real Begin / Apply (positions + Smart route + “Hands-off on”) — or landing hero if unfunded. Prefer Arbiscan-linked activity in frame.

---

## Pre-submit checklist

- [ ] Smoke: Google → `/proof` green (UA + 7702 + SRA)
- [ ] Smoke: deposit → Begin/Apply → Arbiscan
- [ ] Demo video (YouTube unlisted) — `docs/DEMO_SCRIPT.md`
- [ ] Pitch deck (Canva/Slides) — `docs/PITCH_DECK.md`
- [ ] All four challenges selected
- [ ] Live demo opens without SSO lock
- [ ] Repo public with MIT LICENSE
