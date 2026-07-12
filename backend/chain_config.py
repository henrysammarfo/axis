"""Arbitrum network constants — default testnet for hackathon demos."""

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


def x402_chain_id(chain_id: int) -> str:
    return X402_CAIP2_BY_CHAIN_ID.get(chain_id, f"eip155:{chain_id}")


def chain_label(chain_id: int) -> str:
    return CHAIN_LABEL_BY_ID.get(chain_id, "arbitrum")
