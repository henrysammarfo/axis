# Open House Singapore — RH stock baskets

> **Bible:** scoutbot `docs/AXIS_BIBLE.md` (FINAL uniqueness relock **2026-09-12**)  
> **Branch:** `feat/open-house-sg` — merge to `main` only after QA  
> **Submit:** Sep 13 – **Oct 4** · HackQuest · https://openhouse.arbitrum.io/  
> **Door:** Top Open → Founder House Singapore  
> **Live (Arb yield):** https://axis-mainnet.vercel.app · https://github.com/henrysammarfo/axis

---

## Soft / 8-second

**Soft:** Set. Forget. Earn — on real US stock tokens, not only crypto pools.

**8s:** “Tech yes, oil no” → RH stock-token basket → weekly English report · Google login · no MetaMask.

## Unique job

**Continuity RH neobroker.** Already-shipping gasless Google Set.Forget.Earn + **new** RH stock-token baskets + English stock reports in the OH window.

≠ Kustodia escrow · Laytus prediction · EqualFi prime · Vela credit · Agama index clone without continuity.

**Winner delta:** They ship primitives. AXIS ships the **mom UX company** that already won Arb UX bounties, now under RH stocks.

## Contest

| Track | Prizes |
|-------|--------|
| Open | $40k / $20k / $10k · ≥1 RH · ≥1 Arb |
| Promising | $7k / $5k / $3k · ≥1 RH |
| Existing OK | Yes if **new work** in window |

## Network honesty

- Existing AXIS **Arbitrum One** yield stays live.  
- **New stock work** targets Robinhood Chain **public testnet** (46630) when mainnet stock inventory is thin — always **label testnet** in UI and `/proof`.  
- Beachhead: RH-eligible / EU/APAC crypto users — not Accra-ICP.

## Mandatory new work (window)

- [x] Docs + branch scaffold  
- [x] RH chain config + stock registry (testnet addresses)  
- [x] BasketPolicy (“tech yes, oil no”) + API  
- [x] Basket builder UI (dashboard)  
- [x] Weekly report includes stock legs (planned)  
- [x] `/proof` RH section (testnet-labeled)  
- [x] Real RH hold / faucet path (API + /proof; ops: fund AGENT_WALLET via faucet)  
- [x] Arb/RH liquidity-rail map (`docs/LIQUIDITY_RAILS.md` + `GET /api/basket/rails`)  
- [ ] HackQuest profile + demo video → pack in `docs/OPEN_HOUSE_HACKQUEST.md` + `docs/OPEN_HOUSE_DEMO.md`  

Keep: Magic · Particle UA · ZeroDev · deterministic strategy core.

## Kill list

HOLD escrow lead · Vela borrow lead · LIEN-on-Arb · silent “no new work” · lead with “another Aave wrapper.”

## Pitch order

1. Continuity / prior wins · 2. RH stock path · 3. Basket from English · 4. Gasless mom UX · 5. English reports · 6. Optional package market

## Demo beat

1. Google login · 2. English → basket · 3. Fund/Activate · RH/Arb txs · 4. Weekly English report · 5. Optional package

## Pitch (15s)

AXIS already lets anyone Set.Forget.Earn on Arbitrum without wallet pain. For Open House we put real US stock tokens under the same experience.

## Keys

Leave current Arb stack alone (fully_configured). Optional later: Alchemy RH RPC. Public testnet RPC is rate-limited: `https://rpc.testnet.chain.robinhood.com`.
