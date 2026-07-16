# AXIS — Win Strategy (Fact-Based)

> **Last updated:** 2026-07-07  
> Goal: maximize probability of winning UA 1st ($5,000) + Arbitrum ($2,000) + Magic ($500) + ZeroDev ($500) = **$8,000**

---

## What Judges Actually Score (UA Track)

```
40%  UX excellence        ← YOUR BIGGEST LEVER
30%  UA + EIP-7702       ← MUST show real 7702 delegation
20%  Adoption potential  ← "Would my mom use this?"
10%  Technical quality   ← Real txs beat mocks every time
```

**Insight:** 70% of UA score is UX + UA integration, not AI sophistication. Do not over-engineer the agent at the expense of a flawless 90-second demo.

---

## Top 10 Moves That Increase Win Probability

### 1. Clone the Official Particle Demo First (P0)
Start from https://github.com/Particle-Network/ua-7702-magic-demo — it already proves Magic + UA + EIP-7702 + cross-chain. Layer AXIS on top, do not reinvent wallet integration.

### 2. One Real On-Chain Transaction on Arbitrum (P0)
Judges will open Arbiscan. At least one real `supply` to Aave v3 or USDC transfer via UA must appear. Mock tx hashes are an instant credibility loss.

### 3. Nail the 90-Second Demo Video (P0)
Script is in the build guide. Record:
- Google login (no wallet popup anxiety)
- Budget slider → Activate
- Positions appear with real APY numbers
- Plain-English rebalance
- SRA deposit from another chain (even testnet)

### 4. Zero Jargon UI (P0 — 40% of score)
Never show: "blockchain", "gas", "smart contract", "Arbitrum", "EIP-7702" to users.
Do show: "Your $500 earned $23 this week", "AXIS moved funds to a safer pool"

### 5. Show EIP-7702 Explicitly in Judge Materials (P1)
Include a `/proof` page (like PayPort hackathon project) showing:
- Same EOA address before and after UA upgrade
- 7702 delegation transaction hash
- Cross-chain operation in one signature

### 6. Use YOUR Venice + TinyFish Keys Strategically (P1)
| Your key | Win angle |
|----------|-----------|
| Venice `enable_web_search` | Agent cites live market conditions in plain English — impressive in demo |
| Venice crypto RPC | Query Arbitrum USDC balance without extra Infura key |
| TinyFish Agent | Scrape live Aave APY when subgraph fails — "always real data" |
| OpenAI | Fallback if Venice rate-limited |

### 7. x402 — Even One Real Micropayment (P1)
Arbitrum track loves "AI pays autonomously." One real 0.001 USDC x402 payment on Arbitrum via PayAI facilitator beats a fake header. Show spend summary in agent log: "AXIS spent $0.003 on market research this week."

### 8. ZeroDev SRA Live Demo (P1)
Generate real SRA via SDK. In demo video: send USDC from Base Sepolia → arrives on Arbitrum. This alone can win the $500 ZeroDev subtrack.

### 9. Mobile 390px Polish (P2)
UA criteria mention consumer UX. Test on iPhone viewport. Floating "Tell AXIS" button.

### 10. Submit to ALL Four Tracks with Same Repo (P2)
One submission, four prize pools. README must explicitly call out:
- [x] Particle UA + EIP-7702
- [x] Arbitrum settlement
- [x] Magic Google login
- [x] ZeroDev SRA

---

## What NOT to Do (Loses Points)

| Anti-pattern | Why it loses |
|--------------|-------------|
| Mock tx hashes | Judges check explorers |
| Showing MetaMask anywhere | Contradicts entire pitch |
| Chain switcher UI | Violates "chains disappear" |
| Crypto jargon in UI | -40% UX category |
| Over-complex AI without working wallet | 10% technical won't save you |
| Claiming "unhackable" | Judges are engineers — damages credibility |
| Building backend without wallet integration | Demo breaks live |

---

## Recommended Build Order (Full Production)

```
Phase 1 — Wallet Foundation (Days 1-3)
├── Fork ua-7702-magic-demo into frontend
├── Magic Google login working
├── Particle UA 7702 delegation on Arbitrum
└── Display UA address in dashboard (replace mock)

Phase 2 — Backend Core (Days 4-6)
├── FastAPI scaffold on Azure
├── PostgreSQL models
├── Magic DID token verification (auth.py)
├── Real yield services (Aave, GMX, Uniswap)
└── Venice/OpenAI agent tool loop

Phase 3 — On-Chain Execution (Days 7-9)
├── ZeroDev bundler + paymaster
├── Real Aave supply via UA
├── ZeroDev SRA deposit flow
└── x402 micropayment (PayAI on Arbitrum)

Phase 4 — Polish (Days 10-12)
├── Wire dashboard to API
├── Weekly report endpoint
├── Rebalance flow
├── Mobile responsive pass
├── Stress test: 10 concurrent activations
└── Record demo video

Phase 5 — Submission
├── Public GitHub repo
├── README with architecture diagram
├── /proof page for judges
└── Submit all 4 tracks
```

---

## AI Provider Recommendation for YOUR Keys

```
Primary:   Venice API (zai-org-glm-5-1)
           - function calling for DeFi tools
           - enable_web_search for market intel
           - crypto RPC for balance checks

Fallback:  OpenAI (gpt-4.1)
           - if Venice unavailable

Scraping:  TinyFish Agent
           - live APY when APIs fail

Skip:      Anthropic (unless you get a key)
           - not required, same tool pattern works elsewhere
```

---

## Azure Production Architecture

```
                    ┌─────────────────┐
                    │  Frontend CDN   │
                    │  (Frontend)     │
                    └────────┬────────┘
                             │ HTTPS
                    ┌────────▼────────┐
                    │ Azure Front Door│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │                             │
     ┌────────▼────────┐          ┌────────▼────────┐
     │ App Service     │          │ Key Vault       │
     │ FastAPI backend │◄─────────│ (all secrets)   │
     └────────┬────────┘          └─────────────────┘
              │
     ┌────────▼────────┐
     │ PostgreSQL      │
     │ (portfolio)     │
     └─────────────────┘
```

---

## Competitor Differentiation

| Competitor builds | AXIS builds |
|-------------------|-------------|
| One chain, one tx | Cross-chain UA, invisible |
| MetaMask required | Google login only |
| User approves each tx | Agent executes, explains in English |
| Shows APY numbers | Shows "You earned $23 this week" |
| Bridge UI | ZeroDev SRA — just send to one address |

**Pitch in one sentence for judges:**
> "AXIS is the first DeFi product where you sign in with Google, set a budget, and an AI earns yield for you — no wallet, no gas, no chains."

---

## Smoke Test Checklist (0 Issues Gate)

```bash
# Backend
cd backend && python -m pytest tests/ -v
curl -X POST localhost:8000/api/agent/activate -d '{...}' # 200
curl localhost:8000/api/agent/status/{user_id}              # 200

# Frontend
bun run build    # 0 errors
bun run lint     # 0 errors

# Integration
# 1. Google login → UA address populated
# 2. Activate → real positions in DB
# 3. Arbiscan shows ≥1 tx
# 4. SRA deposit arrives on Arbitrum
# 5. Rebalance changes positions
# 6. Weekly report returns plain English
# 7. Mobile 390px — no layout break
```

---

## Honest Security Posture (for judges / README)

State these concretely instead of "unhackable":
- Magic DID token verified server-side on every execution request
- Agent spend capped at $0.10 USDC/day for x402
- Azure Key Vault for all secrets, zero keys in frontend
- Rate limiting on agent endpoints (10 req/min/user)
- CORS locked to production domain only
- Non-custodial: user controls UA via Magic, AXIS never holds user keys
- DeFi risk disclosure in collapsible "How It Works" section
