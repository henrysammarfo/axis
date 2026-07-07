# AXIS — API Keys Setup Guide

> **Give these keys to your agent when ready.** Never commit real values to git.

---

## Keys You Already Have

| Key | Env variable | Status |
|-----|--------------|--------|
| OpenAI | `OPENAI_API_KEY` | Ready to use |
| Venice API | `VENICE_API_KEY` | Ready to use (recommended primary AI) |
| TinyFish AI | `TINYFISH_API_KEY` | Ready to use |
| Microsoft Azure | subscription | Ready for hosting |

Paste into `backend/.env`:
```bash
VENICE_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
TINYFISH_API_KEY=your_key_here
```

---

## Keys You MUST Get (Required for Full Production)

### 1. Magic Labs — Embedded Wallet + Google Login

**Why:** Creates invisible EOA wallet on Google sign-in. Required for Magic Labs $500 bonus.

**Steps:**
1. Go to https://magic.link/dashboard
2. Click **Create App** (or use existing app)
3. Name it `AXIS`
4. Copy **Publishable API Key** → `MAGIC_PUBLISHABLE_KEY`
5. Copy **Secret Key** → `MAGIC_SECRET_KEY`
6. Enable **Google** under Social Logins
7. Add your Lovable app URL to allowed origins

**Frontend env (public):**
```bash
VITE_MAGIC_PUBLISHABLE_KEY=pk_live_...
```

**Backend env (secret):**
```bash
MAGIC_SECRET_KEY=sk_live_...
MAGIC_PUBLISHABLE_KEY=pk_live_...
```

**Docs:** https://docs.magic.link/embedded-wallets/authentication/login/oauth/social-providers/google

---

### 2. Google OAuth Client ID — For Magic Google Login

**Why:** Magic needs your Google OAuth client to verify Google sign-ins.

**Steps:**
1. Go to https://console.cloud.google.com
2. Create or select a project named `AXIS`
3. Navigate to **APIs & Services → OAuth consent screen**
4. Set user type to **External**, fill app name `AXIS`
5. Add authorized domain: your Lovable app domain + `magic.link`
6. Go to **Credentials → Create Credentials → OAuth client ID**
7. Application type: **Web application**
8. Authorized JavaScript origins: `https://your-app.lovable.app`, `http://localhost:5173`
9. Copy **Client ID** → `GOOGLE_CLIENT_ID`
10. Send Client ID to Magic dashboard under Google OAuth settings

**Docs:** https://docs.magic.link/embedded-wallets/authentication/login/oauth/social-providers/google

---

### 3. Particle Network — Universal Accounts + EIP-7702

**Why:** Core hackathon requirement (30% of UA track score). Upgrades EOA to cross-chain UA.

**Steps:**
1. Go to https://dashboard.particle.network
2. Create a new project named `AXIS`
3. Copy these three values:
   - **Project ID** → `PARTICLE_PROJECT_ID`
   - **Client Key** → `PARTICLE_CLIENT_KEY`
   - **App ID** → `PARTICLE_APP_ID`
4. Enable **Universal Accounts** in project settings
5. Set mode to **EIP-7702** (7702 mode)

**Frontend env (public):**
```bash
VITE_PARTICLE_PROJECT_ID=...
VITE_PARTICLE_CLIENT_KEY=...
VITE_PARTICLE_APP_ID=...
```

**Reference demo:** https://github.com/Particle-Network/ua-7702-magic-demo

**Docs:** https://developers.particle.network/universal-accounts/ua-reference/web/overview

---

### 4. ZeroDev — Gasless Transactions + Smart Routing Address

**Why:** Required for ZeroDev $500 subtrack. SRA receives cross-chain deposits.

**Steps:**
1. Go to https://dashboard.zerodev.app
2. Create a new project named `AXIS`
3. Select **Arbitrum One** as primary chain
4. Copy **Project ID** → `ZERODEV_PROJECT_ID`
5. Enable **Bundler** and **Paymaster** (gas sponsorship)
6. Copy bundler URL → `ZERODEV_BUNDLER_URL`
   - Format: `https://rpc.zerodev.app/api/v2/bundler/YOUR_PROJECT_ID`
7. Copy paymaster URL → `ZERODEV_PAYMASTER_URL`
   - Format: `https://rpc.zerodev.app/api/v2/paymaster/YOUR_PROJECT_ID`

**Frontend env (public):**
```bash
VITE_ZERODEV_PROJECT_ID=...
```

**Docs:** https://docs.zerodev.app/cross-chain/smart-routing-address

---

### 5. Arbitrum RPC (Optional but Recommended for Production)

**Why:** Public RPC works for dev; dedicated RPC is faster and more reliable.

**Free options:**
- Alchemy: https://www.alchemy.com → create app on Arbitrum One
- Infura: https://infura.io → create project, enable Arbitrum

```bash
ARBITRUM_RPC=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
```

**Default (works without key):**
```bash
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
```

---

### 6. x402 Agent Wallet (Optional — For Real Micropayments)

**Why:** Shows autonomous AI payments on Arbitrum. Impressive for judges.

**Steps:**
1. Create a new Arbitrum wallet (keep private key secure)
2. Fund with ~$5 USDC on Arbitrum One
3. Store private key in Azure Key Vault → `AGENT_WALLET_PRIVATE_KEY`

**Docs:** https://docs.payai.network/x402/supported-networks

---

## Complete `backend/.env` Template

Copy `backend/.env.example` to `backend/.env` and fill in:

```bash
# YOUR KEYS (you have these)
VENICE_API_KEY=
OPENAI_API_KEY=
TINYFISH_API_KEY=

# GET FROM DASHBOARDS (required for on-chain)
MAGIC_SECRET_KEY=
MAGIC_PUBLISHABLE_KEY=
PARTICLE_PROJECT_ID=
PARTICLE_CLIENT_KEY=
PARTICLE_APP_ID=
ZERODEV_PROJECT_ID=
ZERODEV_BUNDLER_URL=
ZERODEV_PAYMASTER_URL=
GOOGLE_CLIENT_ID=

# CHAIN
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc

# DATABASE (auto in Docker)
DATABASE_URL=sqlite+aiosqlite:///./axis.db
```

---

## Frontend `.env` (Lovable / Vite)

Create or add to Lovable environment variables:

```bash
VITE_API_URL=http://localhost:8000
VITE_MAGIC_PUBLISHABLE_KEY=pk_live_...
VITE_PARTICLE_PROJECT_ID=...
VITE_PARTICLE_CLIENT_KEY=...
VITE_PARTICLE_APP_ID=...
VITE_ZERODEV_PROJECT_ID=...
VITE_GOOGLE_CLIENT_ID=...
```

---

## Priority Order

| Priority | Keys | Unlocks |
|----------|------|---------|
| **P0 — Start now** | Venice + OpenAI + TinyFish | AI agent, yield data, reports |
| **P1 — Wallet** | Magic + Google OAuth | Google login, embedded wallet |
| **P1 — UA** | Particle Network | EIP-7702 Universal Account |
| **P1 — Gas** | ZeroDev | Gasless txs + SRA deposits |
| **P2 — Production** | Arbitrum RPC (Alchemy) + Azure | Reliable chain reads + hosting |
| **P3 — Demo wow** | x402 agent wallet | Autonomous micropayments |

---

## How to Send Keys Securely

When ready, paste each key in chat labeled by name:
```
VENICE_API_KEY=...
OPENAI_API_KEY=...
MAGIC_SECRET_KEY=...
```
Or add them directly in Lovable Cloud / Azure Key Vault and tell the agent they're configured.

**Never paste keys in GitHub issues or public repos.**
