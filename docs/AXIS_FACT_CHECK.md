# AXIS Build Guide — Fact Check & Corrections

> **Last updated:** 2026-07-07  
> Every item below was verified against official docs, GitHub repos, or sponsor announcements.  
> **Do not trust the build guide blindly** — several items are wrong or outdated.

---

## ❌ ERRORS IN THE BUILD GUIDE

### 1. Prize Math Is Wrong

| Guide says | Verified truth | Source |
|------------|----------------|--------|
| UA 1st = **$2,500** | UA 1st = **$5,000** | CompeteHub, Particle blog |
| Total max = **$5,500** | Realistic max = **$8,000** ($5k + $2k + $500 + $500) | Luma, CompeteHub |
| — | Total pool = **$15,000+** | Particle blog, Luma |

### 2. Arbitrum RPC URL Is Wrong

```bash
# GUIDE (WRONG):
ARBITRUM_RPC=https://arb1.arbitrage.org

# CORRECT:
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
# Or use Alchemy/Infura/QuickNode for production
```

`arb1.arbitrage.org` is not the official Arbitrum RPC endpoint. This will break all `web3.py` calls.

### 3. x402 Provider URL Is a Placeholder

```bash
# GUIDE (LIKELY FICTIONAL):
X402_PROVIDER_URL=https://market-data.x402.io
```

No verified public market-data service at this domain. For real x402:
- Use **PayAI facilitator** on Arbitrum: https://docs.payai.network
- Use **Coinbase x402 SDK**: https://www.x402.org
- Chain ID for v2: `eip155:42161` (Arbitrum One)

The guide's `_build_payment_header` returning a plain string is **not** a real x402 implementation.

### 4. ZeroDev SRA REST API Is Wrong

```typescript
// GUIDE (WRONG PATTERN):
const response = await fetch(
  `https://api.zerodev.app/sra/${PROJECT_ID}/${uaAddress}`
);
```

**Verified correct approach:** Use the npm SDK `@zerodev/smart-routing-address`:

```typescript
import { createSmartRoutingAddress } from '@zerodev/smart-routing-address';

const { smartRoutingAddress } = await createSmartRoutingAddress({
  owner: uaAddress,
  destChain: arbitrum,
  srcTokens: [{ tokenType: 'USDC', chain: optimism }, ...],
  actions: { USDC: { action: [], fallBack: [] } },
  slippage: 50,
});
```

Docs: https://docs.zerodev.app/cross-chain/smart-routing-address

### 5. Particle SDK Imports Are Outdated

```typescript
// GUIDE USES:
import { SmartAccount } from '@particle-network/aa';
import { ParticleNetwork } from '@particle-network/auth';

// VERIFIED CURRENT (ua-7702-magic-demo):
import { UniversalAccount } from '@particle-network/universal-account-sdk';
// + magic-sdk + @magic-ext/evm + ethers
```

Reference repo: https://github.com/Particle-Network/ua-7702-magic-demo

### 6. "Claude Agent SDK" Naming

The guide title says "Claude Agent SDK" but the code uses:
```python
import anthropic
client = anthropic.Anthropic()
client.messages.create(..., tools=AXIS_TOOLS)
```

This is the **Anthropic Messages API with tool use** — not a separate "Claude Agent SDK" product. You can replicate this exactly with OpenAI or Venice function calling.

### 7. DeFi Execution Is Explicitly Mocked

```python
# GUIDE ADMITS:
# For demo: simulate execution and return mock result
# For production: integrate with Particle UA SDK for actual execution
```

The `execute()` function generates **random tx hashes**. Judges will check Arbitrum explorers. **Mock execution will lose on Technical Quality (10%) and Execution Quality (20%).**

### 8. Portfolio Tracker Is In-Memory Only

```python
# GUIDE:
# In production: use PostgreSQL
# For demo: in-memory store
```

Data is lost on server restart. Not production-grade.

### 9. Aave API Endpoint May Be Stale

```python
r = await client.get("https://aave-api-v2.aave.com/data/markets-data", ...)
```

Aave v3 on Arbitrum may need:
- Aave subgraph: `https://api.v3.aave.com/` or Goldsky subgraph
- On-chain `AaveProtocolDataProvider` contract reads
- TinyFish scrape as fallback

### 10. Uniswap Subgraph Endpoint May Be Deprecated

```python
"https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal"
```

The Graph hosted service has deprecated many endpoints. Verify or use:
- Uniswap v3 subgraph on Goldsky/Alchemy
- On-chain pool reads via Quoter contract

### 11. GMX APY Is Hardcoded

```python
return {"apy": 18.5}  # approximate — NOT real data
```

Always labeled as approximate in guide but presented as real in demo script. Must fetch real GLP APR from GMX subgraph or API.

### 12. Particle UA V2 Migration Warning

Official Particle docs (verified 2026):
> "Universal Accounts are upgrading to V2. Users must withdraw all funds from old accounts."

Check current UA SDK version before building. Do not use deprecated account system.

---

## ⚠️ UNVERIFIED / NEEDS CONFIRMATION

| Item | Status |
|------|--------|
| Hackathon still accepting submissions | Event ended **June 14, 2026** per hackathons.space — verify with Encode Club Discord if extension exists |
| Exact Magic Labs bonus judging criteria | $500 confirmed on Luma; specific criteria not published separately |
| ZeroDev subtrack exact submission requirements | SRA integration confirmed as qualifying use case |
| `claude-sonnet-4-6` model ID | Verify exact model string in Anthropic docs at build time |

---

## ✅ VERIFIED CORRECT IN GUIDE

| Item | Verification |
|------|-------------|
| EIP-7702 upgrades EOA in-place (same address) | Particle docs + EIPs.ethereum.org |
| Magic Google OAuth as primary onboarding | Magic docs confirmed |
| ZeroDev SRA for cross-chain deposits | ZeroDev docs confirmed |
| x402 as HTTP 402 micropayment protocol | x402.org whitepaper, Coinbase, PayAI Arbitrum support |
| Arbitrum as settlement layer | Arbitrum bounty confirmed $2,000 |
| Aave v3 pool address on Arbitrum `0x794a61358D6845594F94dc1DB02A252b5b4814aD` | On-chain verified |
| UX judging weight 40% on UA track | Consistent across Particle blog + CompeteHub |
| Frontend design spec (no crypto jargon) | Aligns with hackathon "make chains disappear" theme |
| 90-second demo script structure | Sound for Arbitrum bounty judging |

---

## Security Reality Check

The user asked for "North Korea hackers can't hack" level security. Honest assessment:

| Claim | Reality |
|-------|---------|
| Unhackable | **Impossible** — no system is |
| Enterprise-grade achievable | **Yes**, with: Key Vault, DID token verification, rate limits, spend caps, audit logs, input validation, CORS lockdown |
| Smart contract risk | DeFi protocols (Aave, GMX, Uniswap) carry inherent smart contract risk — disclose to users |
| Agent wallet risk | Agent wallet with USDC for x402 is an attack surface — cap balances, monitor |

Do not claim "unhackable" to judges. Claim "defense in depth" with specific controls.

---

## Fix Priority Before Submission

1. **P0** — Fix Arbitrum RPC URL
2. **P0** — Replace mock `execute()` with real Particle UA + ZeroDev transactions (at least 1 real tx on Arbitrum Sepolia or mainnet)
3. **P0** — Integrate Magic + Particle using official `ua-7702-magic-demo`
4. **P1** — Replace ZeroDev REST with `@zerodev/smart-routing-address` SDK
5. **P1** — PostgreSQL portfolio tracker
6. **P1** — Real yield data (Aave subgraph + GMX API + Uniswap)
7. **P2** — Real x402 via PayAI facilitator on Arbitrum
8. **P2** — Wire frontend to FastAPI backend
