/** Stock / chain logo paths for Open House UI + decks. */
export const STOCK_LOGOS: Record<string, string> = {
  AAPL: "/logos/stocks/aapl.png",
  MSFT: "/logos/stocks/msft.png",
  NVDA: "/logos/stocks/nvda.png",
  GOOGL: "/logos/stocks/googl.png",
  AMZN: "/logos/stocks/amzn.png",
  META: "/logos/stocks/meta.png",
  TSLA: "/logos/stocks/tsla.png",
  AMD: "/logos/stocks/amd.svg",
  NFLX: "/logos/stocks/nflx.svg",
  PLTR: "/logos/stocks/pltr.svg",
};

export const CHAIN_LOGOS = {
  arbitrum: "/logos/chains/arbitrum.png",
  robinhood: "/logos/chains/robinhood.png",
} as const;

export function stockLogo(symbol: string): string | undefined {
  return STOCK_LOGOS[symbol.toUpperCase()];
}
