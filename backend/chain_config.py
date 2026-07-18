"""Arbitrum network constants — Arbitrum One is the production default."""

ARBITRUM_SEPOLIA_CHAIN_ID = 421614
ARBITRUM_ONE_CHAIN_ID = 42161


PUBLIC_ARBITRUM_RPCS = {
    "https://arb1.arbitrum.io/rpc",
    "https://sepolia-rollup.arbitrum.io/rpc",
}

# CAIP-2 for x402 v2
X402_CAIP2_BY_CHAIN_ID = {
    ARBITRUM_ONE_CHAIN_ID: "eip155:42161",
    ARBITRUM_SEPOLIA_CHAIN_ID: "eip155:421614",
}

CHAIN_LABEL_BY_ID = {
    ARBITRUM_ONE_CHAIN_ID: "arbitrum",
    ARBITRUM_SEPOLIA_CHAIN_ID: "arbitrum-sepolia",
}

# Live yield sources (mainnet)
GMX_APY_URLS = (
    "https://arbitrum-api.gmxinfra.io/apy?period=30d",
    "https://arbitrum.gmxapi.io/v1/apy?period=30d",
)
DEFILLAMA_POOLS_URL = "https://yields.llama.fi/pools"
UNISWAP_FEE_POOL_META = {
    500: "0.05%",
    3000: "0.3%",
    10000: "1%",
}

# Aave v3 — GraphQL supports mainnet chains only; Sepolia uses on-chain reads
AAVE_GRAPHQL_URL = "https://api.v3.aave.com/graphql"
AAVE_SUPPORTED_SYMBOLS = frozenset({"USDC", "USDT", "ETH", "WBTC"})

AAVE_DATA_PROVIDER_BY_CHAIN: dict[int, str] = {
    ARBITRUM_SEPOLIA_CHAIN_ID: "0x12373B5085e3b42D42C1D4ABF3B3Cf4Df0E0Fa01",
    ARBITRUM_ONE_CHAIN_ID: "0x69FA688f1Dc47d4B5d8029D5a1FB1A8fA7d30007",
}

AAVE_POOL_BY_CHAIN: dict[int, str] = {
    ARBITRUM_ONE_CHAIN_ID: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    ARBITRUM_SEPOLIA_CHAIN_ID: "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff",
}

# Underlying token addresses per chain (ETH = WETH on Aave)
AAVE_UNDERLYING_BY_CHAIN: dict[int, dict[str, str]] = {
    ARBITRUM_SEPOLIA_CHAIN_ID: {
        "USDC": "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
        "ETH": "0x1dF462e2712496373A347f8ad10802a5E95f053D",
    },
    ARBITRUM_ONE_CHAIN_ID: {
        "USDC": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        "ETH": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        "WBTC": "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    },
}

RAY = 10**27
SECONDS_PER_YEAR = 31_536_000


def liquidity_rate_to_apy_percent(liquidity_rate: int) -> float:
    """Convert Aave RAY liquidity rate to supply APY percentage."""
    if liquidity_rate <= 0:
        return 0.0
    rate_per_second = liquidity_rate / RAY / SECONDS_PER_YEAR
    return round(((1 + rate_per_second) ** SECONDS_PER_YEAR - 1) * 100, 2)


def x402_chain_id(chain_id: int) -> str:
    return X402_CAIP2_BY_CHAIN_ID.get(chain_id, f"eip155:{chain_id}")


def chain_label(chain_id: int) -> str:
    return CHAIN_LABEL_BY_ID.get(chain_id, "arbitrum")
