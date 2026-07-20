# AXIS — Pitch Deck (slide-by-slide)

> Copy each slide into **Canva** or **Google Slides**. Export PDF → upload → paste the share link into the submission form (`docs/SUBMISSION.md`).  
> Visual style: black background, white type, lime accent (`#C8FF00` / brand lime). Minimal — consumer fintech, not crypto dashboard chrome.

**One-liner (say on slide 1 and slide 12):**  
*AXIS is the first DeFi product where you sign in with Google, set a budget, and an AI earns yield for you — no wallet, no gas, no chains.*

---

## Slide 1 — Title

**AXIS**  
Set. Forget. Earn.

AI DeFi portfolio agent · Arbitrum One · Live demo

Henry Sam Marfo

**Speaker notes:** Open with the one-liner. Mention live mainnet URL: axis-mainnet.vercel.app.

---

## Slide 2 — Problem

DeFi yield is real. Normal people still can’t use it.

- MetaMask, seed phrases, and “approve in wallet”
- Gas fees, chain switching, bridges
- Choosing Aave vs Uniswap vs GMX alone
- Fear of losing money to a wrong click

**Speaker notes:** Judges score UX 40%. Frame the enemy as *signing and jargon*, not “crypto is bad.”

---

## Slide 3 — Solution

Google login → deposit USDC → one tap → AXIS invests.

- No MetaMask. No seed phrase.
- No gas UI. No chain switcher.
- **Zero transaction signing after login**
- Real positions on Arbitrum — you always own the account

**Speaker notes:** Emphasize product law: after Google, never a wallet popup for invest/rebalance.

---

## Slide 4 — Product demo

*[Insert screenshot: dashboard with positions + Smart route + “Hands-off on”]*

Live: https://axis-mainnet.vercel.app

**Speaker notes:** Capture this during your smoke test. Prefer a frame with Arbiscan-linked activity if possible.

---

## Slide 5 — How it works

```
Google → Magic embedded EOA
      → Particle Universal Account (EIP-7702 Type-4)
      → ZeroDev SRA (deposit from any chain)
      → Kernel session key (CallPolicy-bounded)
      → Aave / Uniswap LP / GMX on Arbitrum
      → Plain-English weekly note (AI explains, never decides)
```

**Speaker notes:** Walk the stack once. Stress that AI does *not* pick allocations — the deterministic router does.

---

## Slide 6 — Universal Accounts + EIP-7702

Same address. No migration. Chain-abstracted UX.

- EOA upgraded **in place** via EIP-7702 Type-4
- Particle UA SDK in 7702 mode
- Judge proof page: UA address + Type-4 tx hash  
  → `/proof` after login

**Speaker notes:** This is 30% of UA track. Open `/proof` in the live demo if presenting live.

---

## Slide 7 — ZeroDev SRA + session keys

One deposit address. Autonomous, policy-bounded agent.

- **SRA:** send USDC from Base / OP / ETH / Arbitrum → settles for AXIS on Arbitrum
- **Session keys:** gasless UserOps; CallPolicy pins `onBehalfOf` / `to` / `receiver` = owner
- Even a leaked agent key cannot drain funds to an attacker

**Speaker notes:** ZeroDev subtrack cares about prominent SRA use — say “deposit funnel” out loud.

---

## Slide 8 — Safety (honest)

Defense in depth — not “unhackable.”

| Layer | What it does |
|-------|----------------|
| CallPolicy | On-chain allowlist of calls + pinned recipients |
| Magic DID | Server verifies every mutating API call |
| Tenant guards | Wallet can’t be operated by another user |
| Rate limits | Caps session ops per day |
| Non-custodial | User owns the account; AXIS never holds user keys |

**Speaker notes:** Judges are engineers. Credibility > hype.

---

## Slide 9 — Best-yield router

One tap. Live APYs. Risk-aware.

- Scans Aave USDC, Uniswap V3 stable LP, GMX V2 GM
- Respects Conservative / Moderate / Aggressive × Protect / Grow / Maximize
- Balance-aware: skips GMX if ETH for keeper fee is missing
- Budget cap: you decide how much AXIS can put to work ($10 min)

**Speaker notes:** Show “Apply best route” + “What AXIS did” in the video.

---

## Slide 10 — Traction / demo proof

Shipped on mainnet — not a mock.

- Live app + API fully configured (Magic, Particle, ZeroDev, Alchemy 42161)
- Gas sponsorship verified with a real sponsored UserOp on Arbitrum One
- Positions and agent actions link to Arbiscan
- Works from small deposits (e.g. $10)

**Speaker notes:** Point to a real tx hash if you have one from the smoke test.

---

## Slide 11 — Market (PMF)

Who: USDC holders who want yield but refuse DeFi UI.

Why now: EIP-7702 + embedded wallets + gas sponsorship finally make consumer DeFi possible.

Wedge: Robinhood-simple yield on Arbitrum — Google in, tap once, earn.

See `docs/STARTUP_STRATEGY.md` for GTM and monetization.

**Speaker notes:** Keep to 20 seconds. Adoption potential is 20% of score.

---

## Slide 12 — Ask / tracks

Entered:

1. Universal Accounts Track (Particle EIP-7702)
2. General Track → ZeroDev Subtrack
3. Arbitrum Road to Open House London
4. Magic Labs Bonus

Open to Particle incubation · Arbitrum Founder House interest

**AXIS. Set it. Forget it. Earn.**

https://axis-mainnet.vercel.app · https://github.com/henrysammarfo/axis

**Speaker notes:** End on the one-liner. Offer to walk `/proof` live.
