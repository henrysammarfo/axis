# Arb ↔ Robinhood liquidity rails

> Open House honesty map · Aerodrome lesson: marketing ≠ liquidity.

## Law

- **Arbitrum One** yield stays live (UA / EIP-7702 / ZeroDev).
- **New stock work** is on Robinhood Chain **public testnet (46630)** until mainnet registry + depth are verifiable.
- **USDG** contracts are Paxos-verified and labeled; AXIS does **not** execute OFT bridges.
- Never invent bridges, fills, or explorer links.
- Plan notional $ ≠ on-chain hold.

## Rails

| Rail | Chain | Status | What judges see |
|------|-------|--------|-----------------|
| Arb One yield | 42161 | Live | `/proof` Type-4 + SRA · USDC |
| USDG Arb ↔ RH | 42161 / 4663 | Contracts verified | Explorers + `GET /api/basket/usdg` · no AXIS OFT |
| RH stock tokens | 46630 | Public testnet | Faucet + Activate hold txs / synced balances |
| RH mainnet stocks | 4663 | Awaiting registry depth | Do not hard-code fills |
| Cross-rail | — | Labeled separate | Same Google identity; networks split on `/proof` |

## USDG (verified 2026-09-18 · Paxos docs)

| Network | Address |
|---------|---------|
| Arbitrum One | `0x004B506865409877C9fA29bfb1ebA929984B9bbC` |
| Robinhood mainnet | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| RH OFT wrapper | `0x0d54755f5106BfdB43f7a35f5D49a23F940628d1` |

Source: https://docs.paxos.com/guides/stablecoin/usdg/mainnet

## API

`GET /api/basket/rails` — structured map for UI + submission.  
`GET /api/basket/usdg` — full USDG path spine (steps, refuse list, explorers).

## Demo path

1. Google login → Arb evidence (USDC yield)  
2. English → BasketPolicy  
3. Faucet agent and/or UA  
4. Activate hold (auto / fund / sync)  
5. Show USDG labeled path on Baskets + `/proof`  
6. Weekly English report includes stock legs + fragmentation  

## Lesson

A route that only exists as copy is not a rail. Ship labeled testnet holds + Arb depth + verified USDG explorers; promote executed OFT / mainnet stock rails only when inventory and transfers are real.
