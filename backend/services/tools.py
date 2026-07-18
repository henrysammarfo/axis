"""AXIS tool definitions — yields/status only. Allocations come from StrategyEngine."""

AXIS_TOOLS = [
    {
        "name": "check_aave_yield",
        "description": "Check current APY for supplying USDC/USDT on Aave v3 on Arbitrum",
        "input_schema": {
            "type": "object",
            "properties": {
                "asset": {"type": "string", "description": "Asset symbol: USDC, USDT, ETH, WBTC"},
            },
            "required": ["asset"],
        },
    },
    {
        "name": "check_gmx_apy",
        "description": "Check current APY for GMX v2 GM liquidity pools on Arbitrum (read-only; not in v1 matrix)",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_current_positions",
        "description": "Get the authenticated user's current DeFi positions and yields",
        "input_schema": {"type": "object", "properties": {}},
    },
]

AXIS_EXPLAIN_SYSTEM = """You are AXIS. Explain a locked DeFi allocation plan in plain English.
You never invent new allocations, protocols, or amounts.
You never use jargon like blockchain, gas, or smart contract.
Keep it under 120 words. One short paragraph is ideal.
Mention risk level, goal, where money goes (Aave USDC/USDT), and the cash buffer if any."""

AXIS_SYSTEM = AXIS_EXPLAIN_SYSTEM
