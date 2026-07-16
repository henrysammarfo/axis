/** Arbitrum network config — Arbitrum One is the production default. */

export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
export const ARBITRUM_ONE_CHAIN_ID = 42161;

export function arbitrumChainId(): number {
  const raw = import.meta.env.VITE_ARBITRUM_CHAIN_ID;
  const parsed = raw ? Number.parseInt(String(raw), 10) : ARBITRUM_ONE_CHAIN_ID;
  return Number.isFinite(parsed) ? parsed : ARBITRUM_ONE_CHAIN_ID;
}

export function isArbitrumSepolia(): boolean {
  return arbitrumChainId() === ARBITRUM_SEPOLIA_CHAIN_ID;
}

export function isArbitrumOne(): boolean {
  return arbitrumChainId() === ARBITRUM_ONE_CHAIN_ID;
}

export function chainDisplayName(): string {
  return isArbitrumSepolia() ? "Arbitrum Sepolia" : "Arbitrum One";
}

/** Arbiscan explorer base for the configured chain. */
export function arbiscanBaseUrl(): string {
  return isArbitrumSepolia()
    ? "https://sepolia.arbiscan.io"
    : "https://arbiscan.io";
}
