const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

import { getStoredSession } from "./wallet";
import type { ActionEntry } from "./portfolio";

export type AgentStatus = {
  active: boolean;
  positions: Array<{
    protocol: string;
    asset: string;
    amount_usdc: number;
    estimated_apy: number;
    tx_hash: string | null;
    chain: string;
    status: string;
    opened_at: string;
  }>;
  total_invested_usdc: number;
  estimated_weekly_yield_usdc: number;
  actions_this_week: number;
  last_action: Record<string, unknown> | null;
  ua_address: string | null;
  sra_address: string | null;
  budget_usdc: number;
  risk_level: string;
  goal: string;
  x402_spend?: { total_spent_usdc: number; queries_made: number };
};

export type ConfigStatus = {
  ai: { venice: boolean; openai: boolean; anthropic: boolean; active_provider: string };
  wallet: { magic: boolean; particle: boolean; zerodev: boolean; google_oauth: boolean };
  chain: { arbitrum_rpc: string; chain_id: number };
  intelligence: { tinyfish: boolean; x402_wallet: boolean };
};

function authHeaders(): Record<string, string> {
  const session = getStoredSession();
  if (!session?.didToken) return {};
  return { Authorization: `Bearer ${session.didToken}` };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail[0]?.msg
          : `API error ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

export const axisApi = {
  health: () => request<{ status: string; ai_provider: string }>("/health"),
  configStatus: () => request<ConfigStatus>("/config/status"),

  verifyAuth: (didToken: string) =>
    request<{ valid: boolean; user_id: string; email?: string; public_address?: string }>(
      "/api/auth/verify",
      { method: "POST", body: JSON.stringify({ did_token: didToken }) },
    ),

  register: (didToken: string, uaAddress?: string, sraAddress?: string) =>
    request<{ user_id: string; email?: string; ua_address?: string; sra_address?: string }>(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          did_token: didToken,
          ua_address: uaAddress,
          sra_address: sraAddress,
        }),
      },
    ),

  activate: (body: {
    user_id: string;
    budget_usdc: number;
    risk_level: string;
    goal: string;
    ua_address: string;
    sra_address?: string;
  }) =>
    request<{
      status: string;
      explanation: string;
      actions_taken: number;
      actions: unknown[];
      provider: string;
    }>("/api/agent/activate", { method: "POST", body: JSON.stringify(body) }),

  rebalance: (body: { user_id: string; ua_address: string; instruction: string }) =>
    request<{ status: string; explanation: string; actions: unknown[] }>("/api/agent/rebalance", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  status: (userId: string) => request<AgentStatus>(`/api/agent/status/${userId}`),

  report: (userId: string) =>
    request<{ report: string; user_id: string }>(`/api/agent/report/${userId}`),

  history: (userId: string) =>
    request<{ actions: ActionEntry[] }>(`/api/portfolio/history/${userId}`),

  yields: {
    aave: (asset: string) =>
      request<Record<string, unknown>>(`/api/portfolio/yields/aave/${asset}`),
    gmx: () => request<Record<string, unknown>>("/api/portfolio/yields/gmx"),
  },
};

export function truncateAddress(addr: string, left = 6, right = 4): string {
  if (!addr || addr.length < left + right + 3) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}
