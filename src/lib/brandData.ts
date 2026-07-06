// Central mock "brand data" powering the AXIS dashboard.
// One source of truth for vaults, agent activity, orders, and merch waitlist.

export type Chain = "Arbitrum" | "Base" | "Optimism" | "Ethereum";
export type Risk = "Low" | "Med" | "High";
export type VaultStatus = "Live" | "Paused" | "Full";

export interface Vault {
  id: string;
  name: string;
  chain: Chain;
  apy: number;
  risk: Risk;
  tvl: number;
  allocated: number;
  status: VaultStatus;
}

export interface AgentEvent {
  id: string;
  time: string; // relative label
  ts: number; // sort key (min ago)
  kind: "rebalance" | "deposit" | "withdraw" | "signal" | "report";
  message: string;
  chain?: Chain;
  amount?: number;
}

export interface Order {
  id: string;
  chain: Chain;
  action: string;
  status: "Filled" | "Pending" | "Failed";
  amount: number;
  ts: number;
}

export interface MerchItem {
  id: string;
  name: string;
  price: number;
  status: "Coming Soon" | "Waitlist" | "Preview";
  drop: string;
}

export const VAULTS: Vault[] = [
  { id: "v1", name: "Stable Yield", chain: "Arbitrum", apy: 8.4, risk: "Low", tvl: 4_820_000, allocated: 2140, status: "Live" },
  { id: "v2", name: "Delta Neutral", chain: "Base", apy: 14.2, risk: "Med", tvl: 3_910_000, allocated: 1780, status: "Live" },
  { id: "v3", name: "LST Loop", chain: "Arbitrum", apy: 22.1, risk: "Med", tvl: 2_405_000, allocated: 1520, status: "Live" },
  { id: "v4", name: "Options Vault", chain: "Optimism", apy: 31.5, risk: "High", tvl: 890_000, allocated: 980, status: "Live" },
  { id: "v5", name: "Basis Trade", chain: "Base", apy: 18.7, risk: "Med", tvl: 1_240_000, allocated: 1130, status: "Paused" },
  { id: "v6", name: "Liquidity Snipe", chain: "Arbitrum", apy: 42.0, risk: "High", tvl: 620_000, allocated: 0, status: "Full" },
  { id: "v7", name: "T-Bill Wrap", chain: "Base", apy: 5.1, risk: "Low", tvl: 6_100_000, allocated: 1000, status: "Live" },
  { id: "v8", name: "Cross-DEX Arb", chain: "Optimism", apy: 26.8, risk: "Med", tvl: 780_000, allocated: 2773, status: "Live" },
  { id: "v9", name: "Recursive Lend", chain: "Arbitrum", apy: 12.3, risk: "Low", tvl: 3_450_000, allocated: 660, status: "Live" },
  { id: "v10", name: "Vol Harvest", chain: "Base", apy: 35.9, risk: "High", tvl: 410_000, allocated: 480, status: "Paused" },
];

export const AGENT_FEED: AgentEvent[] = [
  { id: "a1", time: "2m", ts: 2, kind: "rebalance", message: "Rebalanced LST Loop: booked +$41.20", chain: "Arbitrum", amount: 41.2 },
  { id: "a2", time: "18m", ts: 18, kind: "signal", message: "Basis widened on Base. Rotated 12% of stables.", chain: "Base" },
  { id: "a3", time: "1h", ts: 60, kind: "deposit", message: "Received 320 USDC via SRA from Ethereum mainnet.", chain: "Ethereum", amount: 320 },
  { id: "a4", time: "3h", ts: 180, kind: "report", message: "Weekly report queued. Est. +$23.14 net yield." },
  { id: "a5", time: "6h", ts: 360, kind: "rebalance", message: "Closed Vol Harvest tranche after IV spike. +$8.90", chain: "Base", amount: 8.9 },
  { id: "a6", time: "9h", ts: 540, kind: "signal", message: "Detected new pool on Optimism. Skipped: TVL below threshold.", chain: "Optimism" },
  { id: "a7", time: "1d", ts: 1440, kind: "withdraw", message: "Auto-swept dust to stables. $4.11 recovered.", amount: 4.11 },
];

export const ORDERS: Order[] = [
  { id: "o1", chain: "Arbitrum", action: "Deposit stETH → LST Loop", status: "Filled", amount: 500, ts: 5 },
  { id: "o2", chain: "Base", action: "Swap USDC → USDbC", status: "Filled", amount: 1200, ts: 22 },
  { id: "o3", chain: "Optimism", action: "Claim rewards", status: "Filled", amount: 4.11, ts: 60 },
  { id: "o4", chain: "Arbitrum", action: "Compound LP position", status: "Filled", amount: 12.44, ts: 140 },
  { id: "o5", chain: "Base", action: "Open Delta Neutral hedge", status: "Pending", amount: 800, ts: 3 },
  { id: "o6", chain: "Optimism", action: "Bridge to Base", status: "Failed", amount: 150, ts: 260 },
  { id: "o7", chain: "Arbitrum", action: "Withdraw to SRA", status: "Filled", amount: 300, ts: 720 },
];

export const MERCH: MerchItem[] = [
  { id: "m1", name: "AXIS Wordmark Hoodie", price: 110, status: "Coming Soon", drop: "Q1" },
  { id: "m2", name: "Set. Forget. Earn. Tee", price: 45, status: "Waitlist", drop: "Q1" },
  { id: "m3", name: "Circled R Cap", price: 40, status: "Coming Soon", drop: "Q2" },
  { id: "m4", name: "Archive Zip", price: 140, status: "Preview", drop: "Q2" },
  { id: "m5", name: "Yield Tee", price: 45, status: "Waitlist", drop: "Q1" },
  { id: "m6", name: "Agent Longsleeve", price: 70, status: "Coming Soon", drop: "Q2" },
];

export function summary() {
  const totalAllocated = VAULTS.reduce((s, v) => s + v.allocated, 0);
  const active = VAULTS.filter((v) => v.status === "Live").length;
  const weightedApy =
    totalAllocated > 0
      ? VAULTS.reduce((s, v) => s + v.apy * v.allocated, 0) / totalAllocated
      : 0;
  const filled = ORDERS.filter((o) => o.status === "Filled").length;
  const pending = ORDERS.filter((o) => o.status === "Pending").length;
  return { totalAllocated, active, weightedApy, filled, pending, total: VAULTS.length };
}
