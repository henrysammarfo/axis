# AXIS — API Keys & Credentials Inventory

> **Last updated:** 2026-07-07  
> **Rule:** Never commit real keys. Use Azure Key Vault or `.env` (gitignored).

---

## What YOU Already Have

| Service | Key env var | Role in AXIS | Verdict |
|---------|-------------|--------------|---------|
| **OpenAI** | `OPENAI_API_KEY` | AI agent brain (substitute for Anthropic) | ✅ **Usable** — tool calling supported |
| **Venice API** | `VENICE_API_KEY` | AI agent + web search + crypto RPC | ✅ **Highly recommended** — OpenAI-compatible, has `enable_web_search`, blockchain RPC, x402 wallet auth |
| **TinyFish AI** | `TINYFISH_API_KEY` | Live web scraping of DeFi yields | ✅ **Bonus power** — scrape Aave/GMX dashboards when APIs fail |
| **Microsoft Azure** | subscription + service principals | Host backend, PostgreSQL, Key Vault, App Service | ✅ **Production hosting** — not a replacement for crypto infra keys |

---

## What the Build Guide Requires (MUST GET)

These are **not optional** for a real hackathon submission. No substitute exists.

| Service | Env vars | Where to get | Required for |
|---------|----------|--------------|--------------|
| **Magic Labs** | `MAGIC_PUBLISHABLE_KEY`, `MAGIC_SECRET_KEY` | https://magic.link/dashboard | Google login, embedded EOA wallet |
| **Particle Network** | `PARTICLE_PROJECT_ID`, `PARTICLE_CLIENT_KEY`, `PARTICLE_APP_ID` | https://dashboard.particle.network | Universal Accounts + EIP-7702 |
| **ZeroDev** | `ZERODEV_PROJECT_ID`, `ZERODEV_BUNDLER_URL`, `ZERODEV_PAYMASTER_URL` | https://dashboard.zerodev.app | Gasless txs, Smart Routing Address |
| **Google OAuth** | `GOOGLE_CLIENT_ID` (+ secret for Magic config) | https://console.cloud.google.com | Magic Google social login |
| **Arbitrum RPC** | `ARBITRUM_RPC` | Alchemy, Infura, or public `https://arb1.arbitrum.io/rpc` | On-chain reads + settlement |
| **PostgreSQL** | `DATABASE_URL` | Azure Database for PostgreSQL or local | Portfolio persistence |

---

## AI Provider — Choose ONE Primary

The guide specifies **Anthropic Claude**. You do **not** have Anthropic listed, but you have strong alternatives:

### Option A: OpenAI (you have this) ✅
```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1  # or gpt-4o
```
- Use OpenAI function calling (same pattern as guide's tool loop)
- Pros: reliable tool use, well-documented
- Cons: not "Claude Agent SDK" as guide names it

### Option B: Venice API (you have this) ✅ RECOMMENDED HYBRID
```bash
VENICE_API_KEY=...
VENICE_BASE_URL=https://api.venice.ai/api/v1
VENICE_MODEL=zai-org-glm-5-1  # strong reasoning + function calling
```
- OpenAI-compatible — drop-in with `base_url` change
- **Built-in web search** (`venice_parameters.enable_web_search`) — replaces some x402 market intel
- **Crypto RPC** via Venice — can query Arbitrum on-chain data with same key
- **x402 wallet auth** supported on Venice Responses API
- Pros: one key for AI + web + chain reads
- Cons: less brand recognition than "Claude" in demo narrative

### Option C: Anthropic Claude (guide default) — NEED KEY IF YOU WANT EXACT MATCH
```bash
ANTHROPIC_API_KEY=sk-ant-...
```
- Get at: https://console.anthropic.com
- Guide uses `claude-sonnet-4-6` with native tool use
- **Not required** if you use OpenAI or Venice with same tool schema

### Recommended Stack for YOUR Keys
```
Primary AI:     Venice API (tool calling + web search)
Fallback AI:    OpenAI
Yield scraping: TinyFish Agent API (when subgraphs/APIs fail)
Hosting:        Azure App Service + Azure PostgreSQL + Key Vault
```

---

## TinyFish AI — How to Use in AXIS

```bash
TINYFISH_API_KEY=...   # from https://agent.tinyfish.ai/api-keys
```

| TinyFish API | Endpoint | AXIS use case |
|--------------|----------|---------------|
| Agent | `POST https://agent.tinyfish.ai/v1/automation/run` | Scrape live APY from app.aave.com, gmx.io |
| Search | `GET https://api.search.tinyfish.ai` | Find current DeFi rate articles |
| Fetch | `POST https://api.fetch.tinyfish.ai` | Extract clean markdown from protocol docs |

Example agent goal:
> "Go to Aave v3 Arbitrum markets page and extract USDC supply APY as a number"

**Note:** Search and Fetch are **free** (no credits). Agent/Browser use credits.

---

## x402 — Payment Keys

The guide's `X402_PROVIDER_URL=https://market-data.x402.io` is a **placeholder** (see FACT_CHECK).

For real x402 on Arbitrum:
```bash
# No API key needed for protocol itself — uses wallet USDC
X402_FACILITATOR=payai  # or coinbase facilitator
X402_CHAIN=eip155:42161  # Arbitrum One (CAIP-2 for v2)
AGENT_WALLET_PRIVATE_KEY=...  # agent's Arbitrum wallet with USDC — KEEP IN KEY VAULT
```

Venice also supports x402 wallet-funded requests on its Responses API.

---

## Complete `.env` Template (Production)

```bash
# ── AI (pick primary) ──
VENICE_API_KEY=
OPENAI_API_KEY=
# ANTHROPIC_API_KEY=          # optional if using Venice/OpenAI

# ── Web Intelligence ──
TINYFISH_API_KEY=

# ── Wallet / Accounts (REQUIRED — get from dashboards) ──
MAGIC_PUBLISHABLE_KEY=pk_live_...
MAGIC_SECRET_KEY=sk_live_...
PARTICLE_PROJECT_ID=
PARTICLE_CLIENT_KEY=
PARTICLE_APP_ID=
ZERODEV_PROJECT_ID=
ZERODEV_BUNDLER_URL=https://rpc.zerodev.app/api/v2/bundler/...
ZERODEV_PAYMASTER_URL=https://rpc.zerodev.app/api/v2/paymaster/...

# ── Google OAuth (for Magic) ──
GOOGLE_CLIENT_ID=

# ── Chain ──
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
ARBITRUM_CHAIN_ID=42161

# ── x402 ──
X402_FACILITATOR_URL=https://facilitator.payai.network  # verify current URL in PayAI docs

# ── Database ──
DATABASE_URL=postgresql://axis:password@localhost:5432/axis

# ── App ──
PORT=8000
FRONTEND_URL=https://axis.yourdomain.com
CORS_ORIGINS=https://axis.yourdomain.com
AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/

# ── Frontend (public — Vite) ──
NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_PARTICLE_PROJECT_ID=
NEXT_PUBLIC_PARTICLE_CLIENT_KEY=
NEXT_PUBLIC_PARTICLE_APP_ID=
NEXT_PUBLIC_ZERODEV_PROJECT_ID=
```

---

## Azure Deployment Map

| Azure Service | AXIS component |
|---------------|----------------|
| **Azure App Service** or **Container Apps** | FastAPI backend |
| **Azure Database for PostgreSQL** | `DATABASE_URL` |
| **Azure Key Vault** | All secrets above |
| **Azure Front Door / CDN** | Frontend static + API routing |
| **Application Insights** | Monitoring, agent action logs |

---

## Keys You Do NOT Need

| Service | Why not needed |
|---------|----------------|
| MetaMask / Infura (unless as RPC) | Magic replaces user wallet |
| Separate bridge API key | ZeroDev SRA + Particle UA handle cross-chain |
| Coinbase API (unless x402 facilitator) | x402 uses wallet signatures, not API keys |

---

## Security Rules (Enterprise Grade)

1. **Never** store private keys in frontend env vars
2. Agent execution wallet → Azure Key Vault only
3. Magic `SECRET_KEY` → backend only
4. Rotate all keys post-hackathon demo
5. Rate-limit `/api/agent/activate` — prevent agent spam spend
6. Validate Magic DID tokens server-side before any execution
7. Cap x402 spend per user per day (e.g. $0.10 USDC max)
