# Arb ↔ Robinhood liquidity rails

> Open House honesty map · Aerodrome lesson: marketing ≠ liquidity.

## Law

- **Arbitrum One** yield stays live (UA / EIP-7702 / ZeroDev).
- **New stock work** is on Robinhood Chain **public testnet (46630)** until mainnet registry + depth are verifiable.
- Never invent bridges, fills, or explorer links.
- Plan notional $ ≠ on-chain hold.

## Rails

| Rail | Chain | Status | What judges see |
|------|-------|--------|-----------------|
| Arb One yield | 42161 | Live | `/proof` Type-4 + SRA |
| RH stock tokens | 46630 | Public testnet | Faucet + Activate hold txs / synced balances |
| RH mainnet stocks | 4663 | Awaiting registry depth | Do not hard-code fills |
| Cross-rail | — | Labeled separate | Same Google identity; two networks on `/proof` |

## API

`GET /api/basket/rails` — structured map for UI + submission.

## Demo path

1. Google login → Arb evidence  
2. English → BasketPolicy  
3. Faucet agent and/or UA  
4. Activate hold (auto / fund / sync)  
5. Weekly English report includes stock legs + hold status  

## Lesson

A route that only exists as copy is not a rail. Ship labeled testnet holds + Arb depth; promote mainnet stock rails only when inventory is real.
