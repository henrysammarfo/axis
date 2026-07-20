# AXIS — Startup Strategy (PMF · GTM · Roadmap)

> For the pitch deck (slide 11), judges, and post-hackathon decisions.  
> Hackathon win is distribution + optional incubation — not the product’s only validation gate.

---

## Product-Market Fit (PMF)

### Who

Crypto-curious people who already hold USDC (Coinbase, exchanges, friends’ wallets) and want yield — but will not install MetaMask, manage gas, or pick protocols.

Secondary: power users who want an autonomous agent with venue toggles and custom splits, still inside a safety envelope.

### Pain

| Pain | Today’s “solution” |
|------|---------------------|
| Signing every tx | Wallet popups forever |
| Bridges & chains | Manual bridge UIs |
| Protocol choice paralysis | Twitter threads & dashboards |
| Fear of losing money | Avoid DeFi entirely |

### Wedge

**Robinhood-simple yield on Arbitrum:** Google login → set budget → one tap → AXIS invests. Zero signing after login. Funds stay in the user’s account (CallPolicy-bounded session key).

### Why now

EIP-7702 (in-place EOA upgrade) + Magic embedded wallets + ZeroDev gas sponsorship + SRA deposits finally remove the consumer blockers that killed earlier “DeFi for everyone” products.

### Proof signals (what we’d watch post-hack)

- Real mainnet positions opened from ≤$50 deposits  
- Time-to-first-earn under 5 minutes from Google login  
- Retention: users leave money deployed >7 days  
- Support load: almost no “how do I bridge?” tickets  

---

## Go-To-Market (GTM)

### Phase 0 — Hackathon (now)

- Submit UA + ZeroDev + Arbitrum + Magic with one repo and one demo  
- 90-sec / 2-min video → X / TikTok: “I earned yield without MetaMask”  
- Ask for Particle incubation; apply interest for Arbitrum Founder House-style programs  

### Phase 1 — Design partners (0–100 users)

- Personal network + crypto-curious friends with idle USDC  
- Closed beta invite link on axis-mainnet  
- “Prompt” lifestyle / merch brand as cultural hook (not the product itself)  

### Phase 2 — Distribution

| Channel | Play |
|---------|------|
| Content | Screen recordings of Begin → Arbiscan; plain-English “you earned $X” |
| Ecosystem | Arbitrum grants, Magic / ZeroDev co-marketing if track recognition |
| Partnerships | Neobanks / fintechs exploring onchain yield (white-label later) |
| Community | Small Discord / TG for beta feedback — not protocol governance theater |

### Monetization (post-hack, not required for judges)

1. **Performance fee** on yield earned (e.g. 0.5–1%) — aligns incentives  
2. **Premium** — custom strategies, higher venue access, priority support  
3. **B2B** — white-label agent for neobanks / wallets that want “set and forget” yield  

Start with fee-on-yield only after clear disclosure and a tiny user base trusts the product.

---

## Roadmap

| Phase | When | Milestones |
|-------|------|------------|
| **Hackathon** | Jul 2026 | Submit; demo video; pitch deck; live mainnet |
| **Stabilize** | Aug–Sep 2026 | Rotate secrets; durable Postgres everywhere; security pass; mobile PWA polish; fix any demo friction |
| **Growth** | Q4 2026 | Referral; more SRA source chains; power-user strategy marketplace (still CallPolicy-bounded) |
| **Scale** | 2027 | Neobank partnerships; multi-asset (ETH + stables); regulated wrapper exploration where needed |

### Technical priorities (post-hack)

1. Key rotation (anything ever pasted in chat)  
2. Durable session approvals / portfolio DB (no ephemeral `/tmp` SQLite)  
3. Mobile-first UX pass at 390px  
4. Observability: failed UserOps, paymaster balance alerts  
5. Optional: more venues only if session-policy safe and signing-free  

---

## If you win

- Use prize + incubation for ~3 months runway (living costs + infra + one contractor)  
- Double down on Arbitrum as settlement narrative; apply Founder House / ecosystem programs  
- Hire or contract 1 engineer for mobile + reliability — not more protocols  
- Keep the product law: **no signing after Google**  

## If you don’t win

Same product path. The hackathon was a distribution and deadline machine, not a product-market verdict.

- Ship to 100 beta users via network + X  
- Publish weekly “AXIS earned / moved” transparency notes  
- Re-apply to grants with mainnet traction metrics instead of “we built for a weekend”  

---

## Competitive frame (one slide worth)

| Others | AXIS |
|--------|------|
| One chain, MetaMask every step | Google in, chains disappear |
| User signs every invest | Session key + CallPolicy, gasless |
| Bridge UI | SRA deposit address |
| APY tables | “Put $X to work” + plain English |

**Pitch sentence:**  
AXIS is the first DeFi product where you sign in with Google, set a budget, and an AI earns yield for you — no wallet, no gas, no chains.
