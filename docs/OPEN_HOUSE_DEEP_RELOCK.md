# AXIS Open House — Deep Relock Research (2026-09-18)

> Hard research pass after Henry flagged thinness: usability / adoption / GTM / retention / multi-year revenue / fragmentation layers.  
> Sources: HackQuest OH SG brief · Arbitrum RH mainnet blog · Xangle tokenized-stock business models · DeGate playbook · KuCoin/RWA holder race · London winners (Agama) · AlphaEngine Singapore submissions · AXIS bible.

## Verdict

**Current AXIS OH work is continuity UX + labeled RH testnet basket dust.** That is real, but it is **one thin layer** of a multi-layer market. Judges score **PMF + attract/retain**; winners ship **instrument truth + utility or distribution wedge**, not “English → 4 tickers → faucet hold.”

**Bible unique job still holds** (continuity RH neobroker ≠ EqualIndex / Agama / escrow). The **depth under that job is underbuilt**.

---

## Market facts (verified / dated)

| Fact | Source |
|------|--------|
| Tokenized stocks ~$2.53B (Sep 1 2026) vs ~$152T global equities (~0.0017%) | Xangle / RWA.xyz |
| Holders surged; ~3.6M cited in race coverage; RWA.xyz ~2.25M addresses Aug 26 | KuCoin / DeGate |
| Concentration: Ondo ~$840M · xStocks ~$607M · bStocks ~$594M · Securitize · Figure · RH ~$47M | Xangle |
| Same ticker ≠ same instrument (TSLAx / TSLAon / TSLAb / RH) | DeGate / CryptoRank |
| RH Chain mainnet live Jul 1 2026; Classic Stock Tokens began on **Arb One** then migrate | Arbitrum blog |
| RH Classic Stock Tokens geo-restricted (e.g. US/CA/UK/CH called out in coverage) | KuCoin / Eco support |
| OH SG: smart contract · **PMF attract/retain** · innovation · real problem; ≥1 RH · ≥1 Arb; USDG bonus | HackQuest |
| London RH Innovation: **Agama** — yield on tokenized equities | Arb Foundation |
| NYC: EqualFi EqualIndex baskets on RH testnet | Arb Foundation |
| Singapore competitor depth: **AlphaEngine** encrypted strategy → Fhenix → Arb Sepolia → LZ → RH vault | HackQuest project page |

---

## Fragmentation stack (the “hard layers”)

1. **Legal claim** — direct register vs UCC-8 entitlement vs linked tracker vs derivative note  
2. **Issuer / custody** — who holds the share; mint/redeem path; corporate actions / dividends  
3. **Chain / venue** — Arb One Classic · RH Chain · Solana xStocks · BNB bStocks · Cronos · Ondo multi  
4. **Liquidity quality** — CEX book vs AMM vs RFQ; wash / weekend vs Nasdaq open  
5. **Eligibility** — KYC, geo, accredited; transfer restrictions  
6. **Utility** — hold-only vs collateral (Kamino/Morpho) vs structured yield (Agama) vs index (EqualFi)  
7. **Account gravity** — platforms compete for “where money lives” (stablecoin → stock without bank hop)  
8. **Migrate pattern** — validate on shared Arb One → dedicated RH Chain (Arb Platform blueprint)

---

## Value chain & revenue (startup, not trophy)

| Stage | Who wins | Revenue |
|-------|----------|---------|
| Issuance & admin | Securitize / Figure / Superstate | Implementation + transfer agency + fund admin (bps) |
| Linked-security issue | Ondo / Backed / Dinari | Mint/redeem fees; optional management; B2B API |
| Distribution | RH / Coinbase / Binance / Kraken | Spreads, FX, account retention, adjacent yield |
| Onchain use | Agama / Morpho / Kamino / EqualFi | Lending spread, vault fees, structured product |

**AXIS wedge (honest):** not issuance. **Distribution + account UX** for crypto-native EU/APAC users who already refuse MetaMask — then deepen into **instrument-honest baskets + retention loop + optional package market**.

Multi-year: AUM-linked advisory/subscription + package marketplace take-rate + eventual mint/redeem partner fee share — **not** gas or one-off faucet.

---

## What AXIS has vs what is thin

| Layer | Status | Gap |
|-------|--------|-----|
| Gasless Google / Arb yield continuity | Strong | Keep as door |
| English basket policy | Shipped | Toy weights; no instrument rights |
| RH hold | Dust / sync testnet | No mint/redeem truth; no mainnet inventory honesty beyond labels |
| Liquidity rails doc | Map only | No live Arb↔RH path, USDG, or depth quotes |
| Reports | English narrative + retention hooks | Push/email cron still open |
| GTM / acquisition | **Shipped (L5)** geo + waitlist + demo script | Partner channel / paid acquisition still open |
| Retention | **Shipped (L3)** schedule/policy + report hooks | Habit loop is in-app; no silent stock fills |
| Revenue | **Catalog-only (L6)** package preview | No checkout / AUM fee live |
| Fail-closed instrument truth | **Shipped (L1)** | Expand verified addresses beyond TSLA cross-issuer |
| Fragmentation desk | **Shipped (L2)** | Live depth quotes still map-only |
| USDG path | **Shipped (L4)** labeled | AXIS does not execute OFT |
| Competitor delta | Stated in bible | Depth layers shipped; video + HackQuest submit remain |

---

## Judge / competitor pressure

- **Agama:** idle stocks → productive yield (utility layer)  
- **EqualFi:** permissionless index baskets (composition primitive)  
- **AlphaEngine:** privacy + cross-chain execution spine (deep tech demo)  
- **AXIS must not** re-lead with Aave wrapper or “borrow against TSLA” (bible kill).  
- **AXIS must deepen** continuity into: **truthful stock-token neobroker** — rights, geo, rails, retention, packages.

---

## Relock build spine (depth, not another feature)

1. **Instrument Truth Layer** — ✅ shipped: `backend/services/instrument_truth.py` + `GET /api/basket/instruments` · `/truth/{symbol}` (verified: RH testnet set · TSLAon ETH · TSLAx Solana; other issuer legs fail-closed unverified)
2. **Fragmentation Desk** — ✅ shipped: `fragmentation.py` + `GET /api/basket/fragmentation/{symbol}` + Baskets UI desk
3. **Retention Agent** — ✅ shipped: schedule/policy prefs + report hooks (`retention_policy` column; report_only/suggest only)
4. **USDG + Arb One yield ↔ RH stock** — ✅ shipped labeled path: `usdg_path.py` + `GET /api/basket/usdg` (Paxos-verified Arb + RH mainnet + LZ OFT; AXIS does not execute)
5. **Beachhead GTM** — ✅ shipped: `beachhead.py` + geo self-attestation + waitlist API + demo script in Baskets UI
6. **Package Market** — ✅ catalog-only preview (`packages.py`); no checkout / no invented AUM
7. **Never fake** mainnet fills; RH mainnet only when registry + depth verifiable

---

## Open research

- Live RH mainnet stock registry dump vs testnet faucet set  
- Whether AXIS should integrate RH Wallet / Classic tokens for eligible geos  
- Ondo API eligibility for non-US mint path as secondary rail  
- Exact USDG integration path on Arb for OH bonus  

Identity: Henry Sam Marfo · AXIS · Open House SG submit ≤ Oct 4 2026
