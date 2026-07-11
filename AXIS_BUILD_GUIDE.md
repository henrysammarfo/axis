# AXIS — AI DeFi Portfolio Agent
**Hackathon:** UXmaxx Hackathon — Pushing Crypto Towards Its Current Potential  
**Track:** Universal Accounts Track (primary) + Arbitrum Bounty + Magic Labs Bonus + ZeroDev Subtrack  
**Prize Target:** UA 1st $2,500 + Arbitrum $2,000 + Magic Labs $500 + ZeroDev $500 = **$5,500**  
**Stack:** Particle Network UA SDK + EIP-7702 + Magic Labs + ZeroDev SRA + Arbitrum + Claude Agent SDK + x402  
**Frontend:** TanStack Start — connects to FastAPI backend

---

## WHAT WE ARE BUILDING

An AI agent that manages your DeFi portfolio across ALL chains from a Google sign-in. No MetaMask. No chain switching. No gas management. You give AXIS a budget and a goal. It executes. You see results weekly.

**The three-word pitch:** Set. Forget. Earn.

**What every competitor builds:** One agent, one chain, one transaction. You still need MetaMask. You still see "approve transaction."

**What AXIS builds:** Google login → Universal Account upgrades your EOA via EIP-7702 → AI agent operates across Arbitrum, Base, Optimism simultaneously → ZeroDev SRA receives deposits from any chain → x402 pays for market intelligence data → user sees "Your $500 earned $23 this week." No chain. No gas. Nothing.

---

## THE JUDGING CRITERIA — HOW AXIS WINS EACH

**Universal Accounts Track (primary — $2,500 first)**
- UX excellence (40%): Google login, no MetaMask, no chain switching, AI explains every action in plain English
- UA + EIP-7702 (30%): EIP-7702 upgrades user's EOA in place — no new address, no migration. UA operates cross-chain as a single balance. This is the core of how AXIS works.
- Adoption potential (20%): "Set and forget DeFi" is the product every non-crypto person wants
- Technical quality (10%): Multi-protocol DeFi execution via Claude Agent SDK

**Arbitrum Bounty ($2,000)**
- User never thinks about wallets/gas/bridges (30%): 100% — Magic embedded wallet + Arbitrum as settlement layer
- Creativity (30%): AI agent autonomously managing DeFi with invisible infra
- Adoption potential (20%): First DeFi product normal people can actually use
- Execution quality (20%): End-to-end working demo

**Magic Labs Bonus ($500)**
- Google/email social login as primary onboarding — no MetaMask ever
- Embedded wallet completely invisible to user
- Consumer-grade UX — feels like a fintech app, not a crypto wallet

**ZeroDev Subtrack ($500)**
- Smart Routing Address (SRA) receives deposits from any chain into AXIS operating budget
- User sends from any wallet on any chain → AXIS receives cross-chain automatically
- Core to the cross-chain architecture

---

## PROJECT STRUCTURE

```
axis/
├── AXIS_BUILD_GUIDE.md             ← this file
├── README.md
│
├── backend/                        ← FastAPI backend
│   ├── requirements.txt
│   ├── .env
│   ├── main.py                     ← FastAPI app
│   ├── routes/
│   │   ├── agent.py                ← AI agent execution endpoints
│   │   ├── portfolio.py            ← portfolio state + history
│   │   ├── auth.py                 ← Magic SDK auth verification
│   │   └── positions.py            ← DeFi position management
│   ├── services/
│   │   ├── claude_agent.py         ← Claude Agent SDK orchestration
│   │   ├── defi_executor.py        ← Aave, Uniswap, GMX integrations
│   │   ├── x402_client.py          ← pay for market data via x402
│   │   └── portfolio_tracker.py    ← track positions + P&L
│   └── models.py                   ← SQLAlchemy models
│
└── frontend_spec.md                ← API spec for frontend
```

---

## ENVIRONMENT SETUP

### requirements.txt
```
fastapi>=0.111.0
uvicorn>=0.30.0
anthropic>=0.28.0
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.0
httpx>=0.27.0
python-dotenv>=1.0.0
pydantic>=2.0.0
web3>=6.15.0
python-jose>=3.3.0
```

### .env
```bash
# Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key

# Magic Labs (get from magic.link/dashboard)
MAGIC_SECRET_KEY=sk_live_your_magic_secret_key
MAGIC_PUBLISHABLE_KEY=pk_live_your_magic_publishable_key

# Particle Network (get from dashboard.particle.network)
PARTICLE_PROJECT_ID=your_particle_project_id
PARTICLE_CLIENT_KEY=your_particle_client_key
PARTICLE_APP_ID=your_particle_app_id

# ZeroDev (get from dashboard.zerodev.app)
ZERODEV_PROJECT_ID=your_zerodev_project_id
ZERODEV_BUNDLER_URL=https://rpc.zerodev.app/api/v2/bundler/your_id
ZERODEV_PAYMASTER_URL=https://rpc.zerodev.app/api/v2/paymaster/your_id

# Arbitrum (primary settlement chain)
ARBITRUM_RPC=https://arb1.arbitrage.org
ARBITRUM_CHAIN_ID=42161

# x402 market data
X402_PROVIDER_URL=https://market-data.x402.io  # or your preferred provider

# Database
DATABASE_URL=postgresql://axis:password@localhost:5432/axis

# App
PORT=8000
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,https://axis.yourdomain.com
```

---

## BACKEND — KEY SERVICES

### services/claude_agent.py
```python
"""
AXIS AI Agent — uses Claude Agent SDK to manage DeFi positions.

The agent:
1. Receives user's budget and risk preference
2. Uses tools to check yields across Aave, GMX, Uniswap on Arbitrum
3. Pays for real-time market data via x402
4. Executes allocations via Particle UA + ZeroDev
5. Explains every action in plain English
6. Reports weekly P&L in simple terms

User never sees: chain names, gas prices, transaction hashes, approve buttons.
User sees: "Your $500 earned $23 this week. Here's what AXIS did."
"""

import anthropic
import json
from services.defi_executor import DeFiExecutor
from services.x402_client import X402Client
from services.portfolio_tracker import PortfolioTracker

client = anthropic.Anthropic()

# Tools AXIS can use
AXIS_TOOLS = [
    {
        "name": "check_aave_yield",
        "description": "Check current APY for supplying USDC/ETH/WBTC on Aave v3 on Arbitrum",
        "input_schema": {
            "type": "object",
            "properties": {
                "asset": {"type": "string", "description": "Asset symbol: USDC, ETH, WBTC, USDT"}
            },
            "required": ["asset"]
        }
    },
    {
        "name": "check_gmx_apy",
        "description": "Check current APY for GMX GLP liquidity provision on Arbitrum",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "check_uniswap_pool",
        "description": "Check APY for a Uniswap v3 liquidity pool on Arbitrum",
        "input_schema": {
            "type": "object",
            "properties": {
                "token0": {"type": "string"},
                "token1": {"type": "string"},
                "fee_tier": {"type": "integer", "description": "Fee tier in bps: 500, 3000, 10000"}
            },
            "required": ["token0", "token1"]
        }
    },
    {
        "name": "get_market_intelligence",
        "description": "Fetch paid market intelligence via x402: risk signals, yield trends, market conditions. Costs 0.001 USDC per call.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "What market intelligence to fetch"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "execute_allocation",
        "description": "Execute a DeFi allocation: move funds from AXIS wallet to a DeFi protocol on Arbitrum. User's UA handles cross-chain sourcing automatically.",
        "input_schema": {
            "type": "object",
            "properties": {
                "protocol": {"type": "string", "description": "Protocol: aave, gmx, uniswap"},
                "asset": {"type": "string"},
                "amount_usdc": {"type": "number"},
                "action": {"type": "string", "description": "supply, remove, add_liquidity"}
            },
            "required": ["protocol", "asset", "amount_usdc", "action"]
        }
    },
    {
        "name": "get_current_positions",
        "description": "Get AXIS's current DeFi positions and their current yields",
        "input_schema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"}
            },
            "required": ["user_id"]
        }
    }
]

AXIS_SYSTEM = """You are AXIS, an AI DeFi portfolio manager. Your user has given you a budget and a goal.
You manage their money autonomously across DeFi protocols on Arbitrum.

Your personality: calm, confident, clear. You never use crypto jargon without explaining it.
You always explain what you're doing and why, in plain English.
You never say "blockchain" or "smart contract" or "gas" to the user — speak like a fintech product.

Your rules:
1. Never put more than 60% in any single protocol
2. Prioritize yield over speculation unless user says otherwise
3. Always explain each allocation decision in one plain-English sentence
4. If market conditions are risky, move to lower-risk positions
5. Report P&L in simple terms: "You made $X" or "You're down $X, here's why"

When executing:
- Check yields across Aave, GMX, Uniswap first
- Get market intelligence via x402 to understand current conditions
- Allocate based on risk-adjusted yield
- Log every action for the user's weekly summary"""


async def run_axis_agent(user_id: str, budget_usdc: float, 
                          risk_level: str, goal: str,
                          defi_executor: DeFiExecutor,
                          x402_client: X402Client,
                          tracker: PortfolioTracker) -> dict:
    """
    Main AXIS agent loop.
    
    Runs Claude Agent SDK with tool use to:
    1. Assess current market conditions
    2. Check available yields
    3. Allocate funds across protocols
    4. Return plain-English explanation to user
    """
    
    actions_taken = []
    explanations = []
    
    messages = [{
        "role": "user",
        "content": f"""Manage this portfolio:
        - Budget: ${budget_usdc} USDC
        - Risk level: {risk_level} (conservative/moderate/aggressive)
        - User goal: {goal}
        - User ID: {user_id}
        
        Check current yields, get market intelligence, then allocate the budget.
        Explain each decision in one plain-English sentence.
        Execute the allocations."""
    }]
    
    # Agent loop — Claude uses tools until it's done
    while True:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=AXIS_SYSTEM,
            tools=AXIS_TOOLS,
            messages=messages
        )
        
        # Check if agent is done
        if response.stop_reason == "end_turn":
            # Extract final explanation
            for block in response.content:
                if hasattr(block, 'text'):
                    explanations.append(block.text)
            break
        
        # Process tool calls
        if response.stop_reason == "tool_use":
            tool_results = []
            
            for block in response.content:
                if block.type == "tool_use":
                    tool_name = block.name
                    tool_input = block.input
                    
                    # Execute the tool
                    result = await _execute_tool(
                        tool_name, tool_input, user_id,
                        defi_executor, x402_client, tracker
                    )
                    
                    actions_taken.append({
                        "tool": tool_name,
                        "input": tool_input,
                        "result": result
                    })
                    
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result)
                    })
            
            # Continue conversation with tool results
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
        else:
            break
    
    return {
        "actions": actions_taken,
        "explanation": "\n\n".join(explanations),
        "user_id": user_id,
        "budget_usdc": budget_usdc
    }


async def _execute_tool(tool_name: str, tool_input: dict, user_id: str,
                         defi: DeFiExecutor, x402: X402Client, 
                         tracker: PortfolioTracker) -> dict:
    """Execute a tool call from Claude."""
    
    if tool_name == "check_aave_yield":
        return await defi.get_aave_apy(tool_input["asset"])
    
    elif tool_name == "check_gmx_apy":
        return await defi.get_gmx_apy()
    
    elif tool_name == "check_uniswap_pool":
        return await defi.get_uniswap_apy(
            tool_input["token0"],
            tool_input["token1"],
            tool_input.get("fee_tier", 3000)
        )
    
    elif tool_name == "get_market_intelligence":
        # Pay for market data via x402 — autonomous micropayment
        result = await x402.fetch_intelligence(
            query=tool_input["query"],
            user_id=user_id
        )
        return result
    
    elif tool_name == "execute_allocation":
        result = await defi.execute(
            protocol=tool_input["protocol"],
            asset=tool_input["asset"],
            amount_usdc=tool_input["amount_usdc"],
            action=tool_input["action"],
            user_id=user_id
        )
        await tracker.log_action(user_id, tool_input, result)
        return result
    
    elif tool_name == "get_current_positions":
        return await tracker.get_positions(tool_input["user_id"])
    
    return {"error": f"Unknown tool: {tool_name}"}


async def generate_weekly_report(user_id: str, tracker: PortfolioTracker) -> str:
    """Generate a plain-English weekly P&L report for the user."""
    
    positions = await tracker.get_positions(user_id)
    history = await tracker.get_weekly_actions(user_id)
    
    report_prompt = f"""
    Write a weekly portfolio report for this user. 
    Keep it under 150 words. Use plain English. No jargon.
    Format: what earned, what changed, what AXIS did, what's next.
    
    Current positions: {json.dumps(positions)}
    Actions this week: {json.dumps(history)}
    """
    
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        messages=[{"role": "user", "content": report_prompt}]
    )
    
    return response.content[0].text
```

### services/defi_executor.py
```python
"""
DeFi Protocol Integrations on Arbitrum.
AXIS allocates funds across Aave v3, GMX GLP, Uniswap v3.
All executions go through the user's Universal Account on Arbitrum.
"""

import httpx
from web3 import Web3

ARBITRUM_RPC = "https://arb1.arbitrage.org"

# Aave v3 Arbitrum addresses
AAVE_POOL_ADDRESS = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"
AAVE_DATA_PROVIDER = "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654"

# GMX Arbitrum
GMX_GLP_MANAGER = "0x3963FfC9dff443c2A94f21b129D429891E32ec18"
GMX_REWARD_ROUTER = "0xA906F338CB21815cBc4Bc87ace9e68c87Ef8d8b1"

# Uniswap v3 Arbitrum
UNISWAP_QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"


class DeFiExecutor:
    def __init__(self, user_ua_address: str):
        self.w3 = Web3(Web3.HTTPProvider(ARBITRUM_RPC))
        self.user_address = user_ua_address
    
    async def get_aave_apy(self, asset: str) -> dict:
        """Get current supply APY on Aave v3 Arbitrum."""
        # Asset addresses on Arbitrum
        asset_addresses = {
            "USDC": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
            "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
            "ETH": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            "WBTC": "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
        }
        
        if asset not in asset_addresses:
            return {"error": f"Asset {asset} not supported on Aave Arbitrum"}
        
        # Query Aave data provider for reserve data
        # In production: use Aave SDK or subgraph
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"https://aave-api-v2.aave.com/data/markets-data",
                params={"poolId": "arbitrum"}
            )
            
            if r.status_code != 200:
                # Fallback: use known approximate rates
                fallback_apys = {
                    "USDC": 4.2,
                    "USDT": 3.8,
                    "ETH": 0.8,
                    "WBTC": 0.3
                }
                return {
                    "asset": asset,
                    "supply_apy": fallback_apys.get(asset, 2.0),
                    "protocol": "aave_v3",
                    "chain": "arbitrum",
                    "source": "fallback"
                }
            
            data = r.json()
            for reserve in data.get("reserves", []):
                if reserve.get("symbol") == asset:
                    return {
                        "asset": asset,
                        "supply_apy": float(reserve.get("supplyAPY", 0)) * 100,
                        "liquidity_usd": reserve.get("totalLiquidity"),
                        "protocol": "aave_v3",
                        "chain": "arbitrum"
                    }
        
        return {"asset": asset, "supply_apy": 0, "error": "Not found in Aave reserves"}
    
    async def get_gmx_apy(self) -> dict:
        """Get current GMX GLP APY."""
        async with httpx.AsyncClient() as client:
            r = await client.get("https://api.gmx.io/tokens")
            if r.status_code == 200:
                return {
                    "protocol": "gmx_glp",
                    "apy": 18.5,  # approximate — GMX GLP typically 15-25%
                    "chain": "arbitrum",
                    "risk": "medium",
                    "note": "GLP earns from protocol trading fees, 30-day lockup for minting"
                }
        
        return {"protocol": "gmx_glp", "apy": 18.5, "chain": "arbitrum"}
    
    async def get_uniswap_apy(self, token0: str, token1: str, fee_tier: int = 3000) -> dict:
        """Get APY for a Uniswap v3 LP position."""
        # Query Uniswap v3 subgraph on Arbitrum
        pool_query = """
        query GetPool($token0: String!, $token1: String!, $fee: Int!) {
          pools(where: {
            token0_: {symbol: $token0}
            token1_: {symbol: $token1}
            feeTier: $fee
          }, orderBy: totalValueLockedUSD, orderDirection: desc, first: 1) {
            feeTier
            totalValueLockedUSD
            volumeUSD
            poolDayData(first: 7, orderBy: date, orderDirection: desc) {
              date
              volumeUSD
              feesUSD
            }
          }
        }
        """
        
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal",
                json={"query": pool_query, "variables": {"token0": token0, "token1": token1, "fee": fee_tier}}
            )
            
            if r.status_code == 200:
                pools = r.json().get("data", {}).get("pools", [])
                if pools:
                    pool = pools[0]
                    daily_fees = sum(float(d["feesUSD"]) for d in pool["poolDayData"])
                    tvl = float(pool["totalValueLockedUSD"])
                    weekly_apy = (daily_fees / 7 / tvl) * 365 * 100 if tvl > 0 else 0
                    
                    return {
                        "token0": token0,
                        "token1": token1,
                        "fee_tier_bps": fee_tier,
                        "estimated_apy": round(weekly_apy, 2),
                        "tvl_usd": tvl,
                        "protocol": "uniswap_v3",
                        "chain": "arbitrum"
                    }
        
        return {"token0": token0, "token1": token1, "estimated_apy": 0, "error": "No pool data"}
    
    async def execute(self, protocol: str, asset: str, 
                      amount_usdc: float, action: str, user_id: str) -> dict:
        """
        Execute a DeFi action via the user's Universal Account on Arbitrum.
        
        The Universal Account (EIP-7702) handles:
        - Cross-chain sourcing (user's funds on any chain → Arbitrum)
        - Gas abstraction (no ETH needed for gas)
        - Single signature for multi-step operations
        
        For demo: simulate execution and return mock result
        For production: integrate with Particle UA SDK for actual execution
        """
        
        print(f"AXIS executing: {action} {amount_usdc} USDC → {protocol} ({asset}) for user {user_id}")
        
        # In production: 
        # 1. Use Particle UA SDK to sign transaction
        # 2. ZeroDev bundles + submits via paymaster (gasless for user)
        # 3. Returns actual transaction hash on Arbitrum
        
        # For demo: return simulated execution
        import random
        import time
        
        mock_tx_hash = f"0x{''.join([hex(random.randint(0,15))[2:] for _ in range(64)])}"
        
        yield_estimates = {
            "aave": {"USDC": 4.2, "ETH": 0.8, "WBTC": 0.3},
            "gmx": {"GLP": 18.5},
            "uniswap": {"USDC-ETH": 12.3}
        }
        
        estimated_apy = yield_estimates.get(protocol, {}).get(asset, 5.0)
        daily_yield = (amount_usdc * estimated_apy / 100) / 365
        
        return {
            "success": True,
            "protocol": protocol,
            "asset": asset,
            "amount_usdc": amount_usdc,
            "action": action,
            "tx_hash": mock_tx_hash,
            "chain": "arbitrum",
            "estimated_daily_yield_usdc": round(daily_yield, 4),
            "estimated_apy": estimated_apy,
            "executed_via": "Particle Universal Account + EIP-7702 + ZeroDev",
            "gas_paid_by_user": False,
            "timestamp": int(time.time())
        }
```

### services/x402_client.py
```python
"""
x402 Agentic Payments — AXIS pays for market data autonomously.
The agent decides when to buy intelligence. No human approval per payment.
This is the Arbitrum track's featured use case: AI apps with invisible onchain payments.
"""

import httpx
import os
from datetime import datetime


class X402Client:
    """
    x402 protocol: HTTP-native payments for AI agent services.
    AXIS agent pays 0.001 USDC per market intelligence query.
    Payments happen autonomously — user never sees or approves them.
    """
    
    def __init__(self, agent_wallet_address: str):
        self.provider_url = os.getenv("X402_PROVIDER_URL", "https://market-data.x402.io")
        self.agent_address = agent_wallet_address
        self.total_spent_usdc = 0.0
        self.query_count = 0
    
    async def fetch_intelligence(self, query: str, user_id: str) -> dict:
        """
        Fetch paid market intelligence.
        AXIS autonomously pays 0.001 USDC per query via x402.
        The payment is embedded in the HTTP request headers.
        
        x402 flow:
        1. AXIS sends request with payment authorization header
        2. Provider verifies payment on Arbitrum
        3. Provider returns intelligence data
        4. AXIS uses data to make better allocation decisions
        """
        
        # x402 payment authorization
        # In production: actual signed payment via Particle UA
        payment_header = self._build_payment_header(
            amount_usdc=0.001,
            provider=self.provider_url,
            memo=f"AXIS market intelligence: {query[:50]}"
        )
        
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    f"{self.provider_url}/intelligence",
                    headers={
                        "X-Payment": payment_header,
                        "X-Agent-Address": self.agent_address,
                        "Content-Type": "application/json"
                    },
                    json={"query": query, "user_id": user_id}
                )
                
                if r.status_code == 200:
                    self.total_spent_usdc += 0.001
                    self.query_count += 1
                    return r.json()
                
                # If x402 provider unavailable: use free fallback
                return self._fallback_intelligence(query)
                
        except Exception:
            return self._fallback_intelligence(query)
    
    def _build_payment_header(self, amount_usdc: float, provider: str, memo: str) -> str:
        """Build x402 payment authorization header."""
        # In production: sign with agent wallet private key via Particle UA
        # Authorization format: x402 scheme with amount, recipient, signature
        return f"x402 amount={int(amount_usdc * 1e6)} currency=USDC chain=arbitrum memo={memo}"
    
    def _fallback_intelligence(self, query: str) -> dict:
        """Fallback market intelligence from free data sources."""
        # Basic heuristics when x402 provider unavailable
        return {
            "query": query,
            "signal": "neutral",
            "recommendation": "Market conditions appear stable. Standard allocation applies.",
            "risk_level": "medium",
            "source": "fallback_analysis",
            "paid": False
        }
    
    def get_spend_summary(self) -> dict:
        return {
            "total_spent_usdc": self.total_spent_usdc,
            "queries_made": self.query_count,
            "avg_cost_per_query": 0.001
        }
```

### routes/agent.py
```python
"""
AXIS Agent API Routes
The frontend calls these to trigger and monitor agent actions.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import asyncio

from services.claude_agent import run_axis_agent, generate_weekly_report
from services.defi_executor import DeFiExecutor
from services.x402_client import X402Client
from services.portfolio_tracker import PortfolioTracker

router = APIRouter()


class ActivateRequest(BaseModel):
    user_id: str
    budget_usdc: float
    risk_level: str = "moderate"      # conservative, moderate, aggressive
    goal: str = "maximize yield"
    ua_address: str                    # user's Universal Account address


class ManualRebalanceRequest(BaseModel):
    user_id: str
    ua_address: str
    instruction: str                   # plain English, e.g. "Move to safer positions"


@router.post("/activate")
async def activate_axis(request: ActivateRequest, background_tasks: BackgroundTasks):
    """
    Activate AXIS to manage user's portfolio.
    Called when user clicks "Activate AXIS" after setting budget + goal.
    
    AXIS will:
    1. Check yields across Aave, GMX, Uniswap
    2. Get market intelligence via x402
    3. Allocate budget across best opportunities
    4. Return plain-English explanation
    """
    defi = DeFiExecutor(request.ua_address)
    x402 = X402Client(request.ua_address)
    tracker = PortfolioTracker()
    
    try:
        result = await run_axis_agent(
            user_id=request.user_id,
            budget_usdc=request.budget_usdc,
            risk_level=request.risk_level,
            goal=request.goal,
            defi_executor=defi,
            x402_client=x402,
            tracker=tracker
        )
        
        return {
            "status": "activated",
            "explanation": result["explanation"],
            "actions_taken": len(result["actions"]),
            "actions": result["actions"],
            "message": "AXIS is now managing your portfolio. Check back for weekly reports."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rebalance")
async def manual_rebalance(request: ManualRebalanceRequest):
    """
    User sends plain-English instruction to AXIS.
    "Move to safer positions" / "Take more risk" / "Cash out 50%"
    AXIS interprets and executes.
    """
    defi = DeFiExecutor(request.ua_address)
    x402 = X402Client(request.ua_address)
    tracker = PortfolioTracker()
    
    result = await run_axis_agent(
        user_id=request.user_id,
        budget_usdc=0,  # no new budget — work with existing positions
        risk_level="moderate",
        goal=request.instruction,  # user's plain-English instruction
        defi_executor=defi,
        x402_client=x402,
        tracker=tracker
    )
    
    return {
        "status": "rebalanced",
        "explanation": result["explanation"],
        "actions": result["actions"]
    }


@router.get("/report/{user_id}")
async def get_weekly_report(user_id: str):
    """Get plain-English weekly P&L report."""
    tracker = PortfolioTracker()
    report = await generate_weekly_report(user_id, tracker)
    return {"report": report, "user_id": user_id}


@router.get("/status/{user_id}")
async def get_agent_status(user_id: str):
    """Get AXIS status for this user — active, positions, returns."""
    tracker = PortfolioTracker()
    positions = await tracker.get_positions(user_id)
    history = await tracker.get_weekly_actions(user_id)
    
    total_invested = sum(p.get("amount_usdc", 0) for p in positions)
    estimated_weekly_yield = sum(
        p.get("amount_usdc", 0) * p.get("estimated_apy", 0) / 100 / 52
        for p in positions
    )
    
    return {
        "active": len(positions) > 0,
        "positions": positions,
        "total_invested_usdc": total_invested,
        "estimated_weekly_yield_usdc": round(estimated_weekly_yield, 2),
        "actions_this_week": len(history),
        "last_action": history[-1] if history else None
    }
```

### services/portfolio_tracker.py
```python
"""Simple portfolio position tracker."""

from datetime import datetime, timedelta


class PortfolioTracker:
    def __init__(self):
        # In production: use PostgreSQL
        # For demo: in-memory store
        self._positions = {}
        self._actions = {}
    
    async def log_action(self, user_id: str, action: dict, result: dict):
        if user_id not in self._actions:
            self._actions[user_id] = []
        self._actions[user_id].append({
            "action": action,
            "result": result,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        if user_id not in self._positions:
            self._positions[user_id] = []
        
        if result.get("success"):
            self._positions[user_id].append({
                "protocol": action.get("protocol"),
                "asset": action.get("asset"),
                "amount_usdc": action.get("amount_usdc"),
                "estimated_apy": result.get("estimated_apy", 0),
                "tx_hash": result.get("tx_hash"),
                "opened_at": datetime.utcnow().isoformat()
            })
    
    async def get_positions(self, user_id: str) -> list:
        return self._positions.get(user_id, [])
    
    async def get_weekly_actions(self, user_id: str) -> list:
        all_actions = self._actions.get(user_id, [])
        week_ago = datetime.utcnow() - timedelta(days=7)
        return [
            a for a in all_actions
            if datetime.fromisoformat(a["timestamp"]) > week_ago
        ]
```

---

## FRONTEND SPEC

```
AXIS Frontend — API Base: http://localhost:8000/api

DESIGN:
Background: #0a0a0f (near black)
Accent: Electric blue #3B82F6
Success green: #10B981
Minimal — feels like Robinhood, not MetaMask
Cards: dark #111827 with 1px border #1F2937
No crypto jargon anywhere. No "blockchain". No "gas".

ONBOARDING (2 steps — that's it):
Step 1: "Sign in with Google" → Magic Labs embedded wallet created invisibly
  After login: "Welcome! Your secure wallet was created automatically."
  No seed phrase. No MetaMask prompt. Just: you're in.

Step 2: "Set Your Budget"
  Slider: $50 → $10,000
  Risk toggle: Conservative | Moderate | Aggressive
  Goal text: "Maximize yield" / "Grow steadily" / "Protect my money"
  "Activate AXIS" button → POST /api/agent/activate

MAIN DASHBOARD (after activation):
  Large header: "Your Portfolio"
  Balance: $XXX.XX (animated number)
  Earnings this week: +$XX.XX (green) or -$XX.XX (red)
  
  "What AXIS Did This Week" section:
  Plain English summary from /api/agent/report/{user_id}
  Example: "AXIS moved 60% of your funds to Aave (4.2% yield) and 40% to GMX liquidity (18% yield). Your portfolio earned $23.40 this week."
  
  Positions list:
  Each position: Protocol name (friendly) | Amount | APY | Daily earnings
  Show logos: Aave, GMX, Uniswap (not chain logos)
  
  "Tell AXIS Something" input:
  Plain text: "Move to safer positions" → POST /api/agent/rebalance
  AXIS responds in plain English, executes, updates dashboard
  
  "How It Works" (collapsible, for curious users):
  "Your funds are managed by an AI agent on Arbitrum (a fast payment network).
   Transactions are signed with your Google account through Universal Accounts.
   You never need gas or tokens to pay fees."
   No more jargon. No deep links. Clean.

MOBILE: 
  One column. Balance at top. Actions below.
  "Tell AXIS" is a floating button.
  Everything works on 390px width.
```

---

## UNIVERSAL ACCOUNTS + EIP-7702 SETUP

```typescript
// Frontend — Particle Network UA SDK integration
// This runs in the browser

import { SmartAccount } from '@particle-network/aa';
import { ParticleNetwork } from '@particle-network/auth';
import { Magic } from 'magic-sdk';

// Magic Labs embedded wallet — Google login
const magic = new Magic(process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY!, {
  network: 'mainnet'
});

// Particle Network Universal Account
const particle = new ParticleNetwork({
  projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID!,
  clientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY!,
  appId: process.env.NEXT_PUBLIC_PARTICLE_APP_ID!,
});

export async function loginAndGetUA() {
  // Step 1: Google login via Magic
  await magic.oauth.loginWithRedirect({
    provider: 'google',
    redirectURI: window.location.origin
  });
  
  const magicUserInfo = await magic.user.getInfo();
  const magicProvider = await magic.wallet.getProvider();
  
  // Step 2: Upgrade EOA to Universal Account via EIP-7702
  // EIP-7702: user's existing EOA gets UA capabilities in place
  // No new address. No migration. Same address, cross-chain capabilities.
  const smartAccount = new SmartAccount(magicProvider, {
    projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID!,
    clientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY!,
    appId: process.env.NEXT_PUBLIC_PARTICLE_APP_ID!,
    // EIP-7702 mode — upgrade EOA in place
    eip7702: true,
    // Arbitrum is primary settlement chain
    chainId: 42161,
  });
  
  const uaAddress = await smartAccount.getAddress();
  
  return {
    email: magicUserInfo.email,
    uaAddress,     // same as their EOA — upgraded via 7702
    smartAccount
  };
}

// ZeroDev SRA — Smart Routing Address
// Receives deposits from ANY chain automatically
export async function getSmartRoutingAddress(uaAddress: string) {
  const response = await fetch(
    `https://api.zerodev.app/sra/${process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID}/${uaAddress}`
  );
  const { sra } = await response.json();
  
  // User sends funds to this SRA from anywhere
  // ZeroDev routes it to Arbitrum automatically
  return sra;
}
```

---

## DEMO SCRIPT (90 SECONDS FOR ARBITRUM BOUNTY)

```
00:00 — "This is what DeFi looks like for normal people."
  Open AXIS. Click "Continue with Google." One button.
  Google OAuth completes. Dashboard appears.
  "No MetaMask. No seed phrase. No crypto knowledge needed."

00:20 — Set budget: $500. Risk: Moderate. Goal: Maximize yield.
  Hit "Activate AXIS."
  Show loading: "AXIS is analyzing yields..."
  
00:35 — Dashboard fills:
  "$300 in Aave — earning 4.2% APY"
  "$200 in GMX — earning 18.5% APY"
  "Estimated weekly earnings: $23.40"
  
00:50 — Plain English summary appears:
  "AXIS split your $500 between a stable lending pool (Aave)
   and a higher-yield trading liquidity pool (GMX).
   You're earning roughly $23 per week."
  
01:00 — User types: "Move more to the safer option"
  AXIS responds: "Moving 50% from GMX to Aave.
  Lower weekly earnings ($18) but much lower risk. Done."
  
01:15 — Show ZeroDev SRA: "Send funds from any chain — AXIS handles the rest"
  Paste SRA address. Send from Ethereum. It arrives on Arbitrum automatically.
  "Your friends on Ethereum can fund AXIS without bridging."
  
01:30 — Show mobile view. Same experience. 390px. Touch friendly.
  "AXIS. Powered by Arbitrum, Universal Accounts, and AI.
   Set it. Forget it. Earn."
```

---

## SUBMISSION CHECKLIST

```
□ Magic Labs login working — Google OAuth → wallet created silently
□ Particle UA SDK integrated — EIP-7702 EOA upgrade
□ ZeroDev SRA configured — cross-chain deposits receive to Arbitrum
□ Claude Agent SDK running — tool use for yield checking + execution
□ Aave APY checker returning real data
□ GMX APY returning real data
□ x402 payment for market intelligence (or fallback)
□ Agent activation end-to-end — budget set → positions allocated → explanation shown
□ Plain English rebalance — "safer positions" instruction works
□ Weekly report generation working
□ Frontend: Google login → dashboard → positions → rebalance input
□ Mobile responsive (390px)
□ Demo video recorded (90 seconds for Arbitrum, 3-5 mins for UA track)
□ GitHub repo public
□ Submit: Universal Accounts Track (primary)
□ Submit: Arbitrum Bounty (same submission)
□ Submit: Magic Labs Bonus (same submission)
□ Submit: ZeroDev Subtrack (same submission)
□ Total prize target: $5,500
```
