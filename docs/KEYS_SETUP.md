# AXIS — Complete API Keys Setup (Nothing Optional)

> **Last updated:** July 2026  
> **Default network:** Arbitrum Sepolia (`421614`) — matches x402 testnet + hackathon demos.
> AXIS will **not start** until every key below is configured. No mocks, no fallbacks, no public RPC.

Paste keys into:
1. `backend/.env` (copy from `backend/.env.example`)
2. Frontend `.env` at repo root (copy from `.env.example`)

Run `python3 scripts/validate-env.py` to verify backend keys before starting.

---

## Quick checklist — 14 backend + 9 frontend keys

| # | Service | Backend env | Frontend env | You have? |
|---|---------|-------------|--------------|-----------|
| 1 | Venice AI | `VENICE_API_KEY` | — | ✅ |
| 2 | OpenAI | `OPENAI_API_KEY` | — | ✅ |
| 3 | TinyFish | `TINYFISH_API_KEY` | — | ✅ |
| 4 | Magic Labs | `MAGIC_SECRET_KEY`, `MAGIC_PUBLISHABLE_KEY` | `VITE_MAGIC_PUBLISHABLE_KEY` | Get |
| 5 | Google OAuth | `GOOGLE_CLIENT_ID` | `VITE_GOOGLE_CLIENT_ID` | Get |
| 6 | Particle UA | `PARTICLE_PROJECT_ID`, `PARTICLE_CLIENT_KEY`, `PARTICLE_APP_ID` | same `VITE_*` | Get |
| 7 | ZeroDev | `ZERODEV_PROJECT_ID`, `ZERODEV_RPC_URL` | `VITE_ZERODEV_*` | Get |
| 8 | Alchemy RPC | `ARBITRUM_RPC` | `VITE_ARBITRUM_RPC_URL` | Get |
| 9 | x402 wallet | `AGENT_WALLET_PRIVATE_KEY` | — | Create |
| 10 | x402 facilitator | `X402_FACILITATOR_URL` | — | Default OK |
| 11 | API URL | — | `VITE_API_URL` | Set after deploy |

---

## Keys you already have — paste these first

### 1. Venice API (primary AI brain)

1. Go to https://venice.ai → sign in
2. Open **API Keys** in settings
3. Create key → copy to `VENICE_API_KEY`

```bash
VENICE_API_KEY=your_venice_key
```

Docs: https://docs.venice.ai

---

### 2. OpenAI (required fallback AI)

1. Go to https://platform.openai.com/api-keys
2. Click **Create new secret key**
3. Copy immediately (shown once)

```bash
OPENAI_API_KEY=sk-proj-...
```

---

### 3. TinyFish AI (required live yield scraping)

1. Go to https://agent.tinyfish.ai
2. Sign up / sign in
3. Navigate to **API Keys** → create key

```bash
TINYFISH_API_KEY=your_tinyfish_key
```

Docs: https://docs.tinyfish.ai

---

## Wallet stack — required for sign-in + on-chain execution

### 4. Magic Labs — embedded wallet + Google login

**Hackathon track:** Magic Labs ($500 bonus)

1. Go to https://dashboard.magic.link
2. Sign up (free developer account)
3. Click **Create App** → name it `AXIS`
4. From app home, copy:
   - **Publishable API Key** → `MAGIC_PUBLISHABLE_KEY` + `VITE_MAGIC_PUBLISHABLE_KEY`
   - **Secret Key** → `MAGIC_SECRET_KEY` (backend only, never frontend)
5. Go to **Settings → Allowed Origins & Redirects**
   - **Allowed Origins:** `http://localhost:5173` (and your production origin, e.g. `https://axis.yourdomain.com`)
   - **Redirect URI allowlist** (exact paths — required for Google OAuth):
     - `http://localhost:5173/onboard`
     - `https://axis.yourdomain.com/onboard` (production)
6. Sidebar → **Social Logins** → enable **Google**
   - You'll paste Google Client ID + Secret here in step 5 below

```bash
# backend/.env
MAGIC_PUBLISHABLE_KEY=pk_live_...
MAGIC_SECRET_KEY=sk_live_...

# Frontend (.env)
VITE_MAGIC_PUBLISHABLE_KEY=pk_live_...
# Optional — defaults to {origin}/onboard when unset
# VITE_MAGIC_REDIRECT_URI=http://localhost:5173/onboard
```

After pulling auth fixes, restart the backend so it loads `magic-admin`:

```bash
pip install -r backend/requirements.txt
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Docs: https://docs.magic.link/embedded-wallets/authentication/login/oauth/social-providers/google

---

### 5. Google OAuth — required for Magic Google sign-in

1. Go to https://console.cloud.google.com
2. Create project named `AXIS` (or select existing)
3. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `AXIS`
   - Support email: your email
   - Add scopes: `email`, `profile`, `openid`
   - Add test users (your Gmail) while in Testing mode
   - For production demo: set **Publishing status → In production**
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Type: **Web application**
   - Name: `AXIS Web`
   - **Authorized JavaScript origins** (must match how you open the app in the browser):
     - `http://localhost:5173`
     - `http://127.0.0.1:5173` (only if you browse via 127.0.0.1 instead of localhost)
     - `https://axis.yourdomain.com`
   - **Authorized redirect URIs** — for AXIS `loginWithRedirect`, use your **app callback URL**, not Magic's dashboard callback:
     - `http://localhost:5173/onboard`
     - `http://127.0.0.1:5173/onboard` (only if you browse via 127.0.0.1)
     - `https://axis.yourdomain.com/onboard`
     - Do **not** use Magic's "Magic Login Widget" redirect URI here — that is only for `connectWithUI`.
5. Copy **Client ID** → both env files
6. Copy **Client Secret** → paste into Magic dashboard (Social Logins → Google) — not stored in AXIS backend

**Troubleshooting `redirect_uri_mismatch`:** Google rejected the URI sent by the app. Open `/onboard` and copy the redirect URI shown in the OAuth setup box — add that exact string to Google **Authorized redirect URIs**. Also add the same URI to Magic **Redirect URI allowlist** and use the same Google Client ID in Magic + `.env`.

```bash
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

Docs: https://docs.magic.link/embedded-wallets/authentication/login/oauth/social-providers/google

---

### 6. Particle Network — Universal Accounts + EIP-7702

**Hackathon track:** Universal Accounts (30% of score)

1. Go to https://dashboard.particle.network
2. Sign up → **Create Project** named `AXIS`
3. From project overview, copy:
   - **Project ID** → `PARTICLE_PROJECT_ID` / `VITE_PARTICLE_PROJECT_ID`
   - **Client Key** → `PARTICLE_CLIENT_KEY` / `VITE_PARTICLE_CLIENT_KEY`
4. Go to **Applications** → **+ Add Web App** (select **Web** platform):
   - **App Name:** `AXIS`
   - **Domain:** required — use reverse-domain style, e.g. `com.axis.web` or `axis.local`
   - **Do not use** `http://localhost:5173` (no `http://`, no port)
   - Particle docs also accept placeholders like `demo.com` for hackathon dev
   - After save, copy the **App ID** (UUID) → `PARTICLE_APP_ID` / `VITE_PARTICLE_APP_ID`
5. In project settings, ensure **Universal Accounts** is enabled
6. Use **EIP-7702 mode** (default in UA SDK v2) — EOA upgrades in-place

```bash
PARTICLE_PROJECT_ID=...
PARTICLE_CLIENT_KEY=...
PARTICLE_APP_ID=...

VITE_PARTICLE_PROJECT_ID=...
VITE_PARTICLE_CLIENT_KEY=...
VITE_PARTICLE_APP_ID=...
```

Reference demo: https://github.com/Particle-Network/ua-7702-magic-demo  
Docs: https://developers.particle.network/universal-accounts/ua-reference/web/overview

---

### 7. ZeroDev — gasless txs + Smart Routing Address

**Hackathon track:** ZeroDev ($500 subtrack)

1. Go to https://dashboard.zerodev.app
2. Sign up → **Create Project** (e.g. `AXIS`)
3. Enable **Arbitrum Sepolia** (chain ID `421614`) on the project
4. Copy **Project ID** → `ZERODEV_PROJECT_ID` / `VITE_ZERODEV_PROJECT_ID`
5. Go to **Gas Policies** → select **Arbitrum Sepolia** → enable **Sponsor all transactions**
6. From project home, copy the **v3 RPC URL** for Arbitrum Sepolia:
   ```
   https://rpc.zerodev.app/api/v3/YOUR_PROJECT_ID/chain/421614
   ```
   This single URL is used for **both bundler and paymaster** (ZeroDev v3).
7. **Add Web App** (Wallets tab) — domain format matters:
   - **Local dev:** leave **Domain** **empty** (ZeroDev docs: passkeys work on `localhost` without registering a domain)
   - **Do not use** `http://localhost:5173` — no `http://`, no port → dashboard shows *"The format is wrong!"*
   - If you must enter something for localhost, use `localhost` only
   - **Production:** hostname only, e.g. `axis.vercel.app` (no `https://`)

```bash
ZERODEV_PROJECT_ID=...
ZERODEV_RPC_URL=https://rpc.zerodev.app/api/v3/YOUR_PROJECT_ID/chain/421614

VITE_ZERODEV_PROJECT_ID=...
VITE_ZERODEV_RPC_URL=https://rpc.zerodev.app/api/v3/YOUR_PROJECT_ID/chain/421614
```

**Passkey server URL** (only if you add ZeroDev passkeys later — AXIS uses Magic, not ZeroDev passkeys):
`https://passkeys.zerodev.app/api/v3/YOUR_PROJECT_ID`

Docs: https://docs.zerodev.app/get-started/sdks/setup-project  
SRA docs: https://docs.zerodev.app/cross-chain/smart-routing-address  
Passkeys / Web App domain: https://docs.zerodev.app/onboarding/passkeys/overview

---

### 8. Alchemy — dedicated Arbitrum RPC (required)

Public RPC (`arb1.arbitrum.io`) is **blocked** by AXIS. You need a dedicated key.

1. Go to https://dashboard.alchemy.com
2. Sign up → **Create App**
   - Chain: **Arbitrum**
   - Network: **Arbitrum Sepolia**
   - Name: `AXIS`
3. Open app → **API Key** → copy HTTPS URL

```bash
ARBITRUM_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
VITE_ARBITRUM_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

Alternative: Infura https://infura.io — create project, enable Arbitrum, use:
`https://arbitrum-mainnet.infura.io/v3/YOUR_PROJECT_ID`

---

### 9. x402 agent wallet — required for autonomous micropayments

**Hackathon wow factor:** AI pays for market intelligence on-chain

1. Create a **new** Ethereum wallet (MetaMask → Create Account → export private key)
   - Use a dedicated agent wallet, not your personal wallet
2. Fund on **Arbitrum Sepolia**:
   - ~$5 USDC (for x402 micropayments)
   - ~$2 ETH (small gas buffer if needed)
3. Store private key securely:

```bash
AGENT_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
X402_FACILITATOR_URL=https://facilitator.payai.network
```

**Never commit this key.** Use Azure Key Vault in production.

Docs: https://docs.payai.network/x402/supported-networks

---

## Frontend API URL

After backend is running locally or deployed:

```bash
# Local dev
VITE_API_URL=http://localhost:8000

# Production (Azure App Service URL)
VITE_API_URL=https://axis-api-YOUR.azurewebsites.net
```

---

## Azure hosting (you already have subscription)

Deploy backend with `azure/deploy.bicep`. Store all secrets in **Azure Key Vault**, not in git.

1. Azure Portal → **Key Vault** → create vault `axis-vault`
2. Add each secret from `backend/.env`
3. Azure **App Service** → Configuration → Key Vault references
4. Set `VITE_API_URL` in frontend `.env` to the deployed App Service URL

---

## Complete `backend/.env` template

```bash
VENICE_API_KEY=
OPENAI_API_KEY=
TINYFISH_API_KEY=

MAGIC_SECRET_KEY=
MAGIC_PUBLISHABLE_KEY=
PARTICLE_PROJECT_ID=
PARTICLE_CLIENT_KEY=
PARTICLE_APP_ID=
ZERODEV_PROJECT_ID=
ZERODEV_RPC_URL=https://rpc.zerodev.app/api/v3/YOUR_ID/chain/421614
GOOGLE_CLIENT_ID=

ARBITRUM_RPC=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_CHAIN_ID=421614

X402_FACILITATOR_URL=https://facilitator.payai.network
AGENT_WALLET_PRIVATE_KEY=0x...

DATABASE_URL=sqlite+aiosqlite:///./axis.db
PORT=8000
FRONTEND_URL=https://axis.yourdomain.com
CORS_ORIGINS=http://localhost:5173,https://axis.yourdomain.com
ENVIRONMENT=development
```

---

## Complete frontend `.env`

```bash
VITE_API_URL=http://localhost:8000
VITE_MAGIC_PUBLISHABLE_KEY=pk_live_...
VITE_PARTICLE_PROJECT_ID=...
VITE_PARTICLE_CLIENT_KEY=...
VITE_PARTICLE_APP_ID=...
VITE_ZERODEV_PROJECT_ID=...
VITE_ZERODEV_RPC_URL=https://rpc.zerodev.app/api/v3/YOUR_ID/chain/421614
VITE_GOOGLE_CLIENT_ID=....apps.googleusercontent.com
VITE_ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
```

---

## Setup order (do this sequence)

| Step | Action | Time |
|------|--------|------|
| 1 | Paste Venice + OpenAI + TinyFish into `backend/.env` | 2 min |
| 2 | Create Magic app + Google OAuth + link them | 15 min |
| 3 | Create Particle project (UA / 7702) | 5 min |
| 4 | Create ZeroDev project + gas policy + copy v3 RPC | 10 min |
| 5 | Create Alchemy app for Arbitrum RPC | 5 min |
| 6 | Create x402 agent wallet + fund with USDC on Arbitrum | 10 min |
| 7 | Paste all keys into frontend `.env` | 5 min |
| 8 | Run `./scripts/start-backend.sh` + `npm run dev` | 2 min |
| 9 | Open `/proof` — all checklist items must show ✓ Ready | 1 min |

---

## How to send keys to the agent

When ready, paste labeled blocks in chat (or add to `backend/.env` and frontend `.env` directly):

```
VENICE_API_KEY=...
OPENAI_API_KEY=...
TINYFISH_API_KEY=...
MAGIC_SECRET_KEY=...
MAGIC_PUBLISHABLE_KEY=...
PARTICLE_PROJECT_ID=...
PARTICLE_CLIENT_KEY=...
PARTICLE_APP_ID=...
ZERODEV_PROJECT_ID=...
ZERODEV_RPC_URL=...
GOOGLE_CLIENT_ID=...
ARBITRUM_RPC=...
AGENT_WALLET_PRIVATE_KEY=...
```

**Never paste keys in GitHub issues or public repos.**

---

## Verify everything works

```bash
# Backend key check
python3 scripts/validate-env.py

# Start backend (fails if any key missing)
./scripts/start-backend.sh

# Frontend
npm run dev

# Open in browser
# /proof  → all ✓ Ready
# /onboard → Google sign-in
# /dashboard → activate agent
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Missing VENICE_API_KEY` etc. | Fill `backend/.env`, run validate script |
| `Access blocked: magic.link has not completed Google verification` | Google Console → OAuth consent → set to **In production** |
| `Particle Network not configured` | Add all 3 `VITE_PARTICLE_*` in frontend `.env` |
| `ARBITRUM_RPC (dedicated required)` | Replace public RPC with Alchemy URL |
| `503 Live yield unavailable` | Check `TINYFISH_API_KEY`; TinyFish credits may be needed |
| Backend won't start | `python3 scripts/validate-env.py` lists every missing key |
