import type { AgentStatus } from "./api";

export type ActionEntry = {
  tool: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  message?: string | null;
  timestamp: string;
};

export type AgentFeedItem = {
  id: string;
  time: string;
  kind: string;
  message: string;
  chain?: string;
  amount?: number;
};

export type OrderItem = {
  id: string;
  chain: string;
  action: string;
  status: "Filled" | "Pending" | "Failed";
  amount: number;
  ts: number;
};

export type VaultRow = {
  id: string;
  name: string;
  chain: string;
  apy: number;
  allocated: number;
  protocol: string;
  asset: string;
};

const CHAIN_LABEL: Record<string, string> = {
  arbitrum: "Arbitrum",
  base: "Base",
  optimism: "Optimism",
  ethereum: "Ethereum",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function positionsToVaults(positions: AgentStatus["positions"]): VaultRow[] {
  return positions.map((p, i) => ({
    id: `pos-${i}`,
    name: `${p.protocol.toUpperCase()} ${p.asset}`,
    chain: CHAIN_LABEL[p.chain.toLowerCase()] ?? p.chain,
    apy: p.estimated_apy,
    allocated: p.amount_usdc,
    protocol: p.protocol,
    asset: p.asset,
  }));
}

export function actionsToAgentFeed(actions: ActionEntry[]): AgentFeedItem[] {
  return actions.map((a, i) => {
    const input = a.input ?? {};
    const result = a.result ?? {};
    const tool = a.tool;
    let message = a.message ?? "";
    if (!message) {
      if (tool === "execute_allocation") {
        message = `Allocated $${input.amount_usdc} to ${input.protocol} (${input.asset})`;
      } else if (tool === "get_market_intelligence") {
        message = `Market check: ${String(input.query ?? "").slice(0, 80)}`;
      } else {
        message = `${tool.replace(/_/g, " ")}`;
      }
    }
    return {
      id: `action-${i}`,
      time: relativeTime(a.timestamp),
      kind: tool.includes("execute")
        ? "rebalance"
        : tool.includes("intelligence")
          ? "signal"
          : "report",
      message,
      chain: CHAIN_LABEL[String(result.chain ?? "arbitrum").toLowerCase()],
      amount:
        typeof result.estimated_daily_yield_usdc === "number"
          ? result.estimated_daily_yield_usdc * 7
          : undefined,
    };
  });
}

export function actionsToOrders(actions: ActionEntry[]): OrderItem[] {
  return actions
    .filter((a) => a.tool === "execute_allocation")
    .map((a, i) => {
      const input = a.input ?? {};
      const result = a.result ?? {};
      const success = Boolean(result.success);
      return {
        id: `order-${i}`,
        chain: CHAIN_LABEL[String(result.chain ?? "arbitrum").toLowerCase()] ?? "Arbitrum",
        action: `${input.action} ${input.asset} → ${input.protocol}`,
        status: success ? "Filled" : "Failed",
        amount: Number(input.amount_usdc ?? 0),
        ts: Math.floor((Date.now() - new Date(a.timestamp).getTime()) / 60_000),
      };
    });
}

export function chainAllocations(positions: AgentStatus["positions"]) {
  const chains = ["Arbitrum", "Base", "Optimism"] as const;
  return chains.map((chain) => {
    const rows = positions.filter((p) => (CHAIN_LABEL[p.chain.toLowerCase()] ?? p.chain) === chain);
    const alloc = rows.reduce((a, p) => a + p.amount_usdc, 0);
    const wapy =
      alloc > 0 ? rows.reduce((a, p) => a + p.estimated_apy * p.amount_usdc, 0) / alloc : 0;
    return { chain, alloc, count: rows.length, wapy };
  });
}

export function portfolioSummary(status: AgentStatus | undefined) {
  const positions = status?.positions ?? [];
  const total = status?.total_invested_usdc ?? 0;
  const weekly = status?.estimated_weekly_yield_usdc ?? 0;
  const wapy =
    total > 0 ? positions.reduce((s, p) => s + p.estimated_apy * p.amount_usdc, 0) / total : 0;
  const filled = positions.filter((p) => p.status === "open").length;
  return {
    totalAllocated: total,
    weightedApy: wapy,
    active: filled,
    total: positions.length,
    weeklyYield: weekly,
    filled,
    pending: 0,
  };
}
