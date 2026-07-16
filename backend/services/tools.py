"""AXIS tool definitions shared across AI providers."""

AXIS_TOOLS = [
    {
        "name": "check_aave_yield",
        "description": "Check current APY for supplying USDC/ETH/WBTC on Aave v3 on Arbitrum",
        "input_schema": {
            "type": "object",
            "properties": {
                "asset": {"type": "string", "description": "Asset symbol: USDC, ETH, WBTC, USDT"},
            },
            "required": ["asset"],
        },
    },
    {
        "name": "check_gmx_apy",
        "description": "Check current APY for GMX v2 GM liquidity pools on Arbitrum",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "check_uniswap_pool",
        "description": "Check APY for a Uniswap v3 liquidity pool on Arbitrum",
        "input_schema": {
            "type": "object",
            "properties": {
                "token0": {"type": "string"},
                "token1": {"type": "string"},
                "fee_tier": {"type": "integer", "description": "Fee tier in bps: 500, 3000, 10000"},
            },
            "required": ["token0", "token1"],
        },
    },
    {
        "name": "get_market_intelligence",
        "description": "Fetch market intelligence: risk signals, yield trends, market conditions.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "What market intelligence to fetch"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "execute_allocation",
        "description": "Execute a DeFi allocation on Arbitrum via the user's Universal Account.",
        "input_schema": {
            "type": "object",
            "properties": {
                "protocol": {"type": "string", "description": "Protocol: aave, gmx, uniswap"},
                "asset": {"type": "string"},
                "amount_usdc": {"type": "number"},
                "action": {"type": "string", "description": "supply, remove, add_liquidity"},
            },
            "required": ["protocol", "asset", "amount_usdc", "action"],
        },
    },
    {
        "name": "get_current_positions",
        "description": "Get the authenticated user's current DeFi positions and yields",
        "input_schema": {"type": "object", "properties": {}},
    },
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
- Get market intelligence to understand current conditions
- Allocate based on risk-adjusted yield
- Log every action for the user's weekly summary"""
