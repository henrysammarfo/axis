const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

import { getStoredSession } from "./wallet";
import type { ActionEntry } from "./portfolio";

export type AgentStatus = {
  active: boolean;
  deployed?: boolean;
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
  session_active?: boolean;
  session_approval?: string | null;
  custom_strategy?: import("./strategy").CustomStrategy | null;
  market_risk_consent?: boolean;
  display_name?: string | null;
  avatar?: string | null;
  x402_spend?: { total_spent_usdc: number; queries_made: number };
};

export type ConfigStatus = {
  fully_configured: boolean;
  missing_keys: string[];
  ai: { venice: boolean; openai: boolean; active_provider: string };
  wallet: { magic: boolean; particle: boolean; zerodev: boolean; google_oauth: boolean };
  chain: {
    rpc_provider: string;
    chain_id: number;
    dedicated_rpc: boolean;
    is_mainnet: boolean;
  };
  intelligence: { tinyfish: boolean; x402_wallet: boolean; x402_facilitator: boolean };
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
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail[0]?.msg
          : `API error ${res.status}`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export type RouteVenueQuote = {
  venue: string;
  protocol: string;
  asset: string;
  apy: number;
  risk_tier: string;
  eligible: boolean;
  source: string;
  reason: string;
};

export type RouteLeg = {
  venue: string;
  protocol: string;
  asset: string;
  action: string;
  amount_usdc: number;
  share_of_deployed: number;
  estimated_apy: number;
  risk_tier: string;
};

export type RoutePlan = {
  risk_level: string;
  goal: string;
  budget_usdc: number;
  cash_buffer_usdc: number;
  deployed_usdc: number;
  legs: RouteLeg[];
  quotes: RouteVenueQuote[];
  blended_apy: number;
  estimated_weekly_yield_usdc: number;
  market_risk_used: boolean;
  notes: string[];
};

export type WalletBalances = {
  usdc: number;
  usdt: number;
  eth: number;
};

export type RoutePreviewResponse = {
  status: string;
  route: RoutePlan;
  idle_usdc: number;
  projected: boolean;
  market_risk_ok: boolean;
  session_active: boolean;
  balances: WalletBalances;
  gmx_fundable: boolean;
  gmx_fee_eth: number;
  budget_usdc: number;
  deployed_usdc: number;
  budget_room_usdc: number;
};

export type RouteApplyGroup = {
  venue: string;
  protocol: string;
  asset: string;
  amount_usdc: number;
  estimated_apy: number;
  risk_tier: string;
  calls: Array<{ to: string; data: string; value?: string; purpose?: string }>;
};

export type RouteApplyPrepareResponse = {
  status: "pending_execution" | string;
  route: RoutePlan;
  groups: RouteApplyGroup[];
  idle_usdc: number;
  execution_fee_wei: string;
  balances: WalletBalances;
  pre_skipped: Array<{ venue: string; reason: string }>;
  explanation: string;
};

export type RouteApplyLeg = {
  venue: string;
  tx_hash: string;
  amount_usdc?: number;
  estimated_apy?: number;
};

export type RouteApplyConfirmResponse = {
  status: string;
  applied: Array<{
    venue: string;
    protocol: string;
    asset: string;
    amount_usdc: number;
    tx_hash: string;
  }>;
  count: number;
  explanation: string;
};

export const axisApi = {
  health: () => request<{ status: string; ai_provider: string }>("/health"),
  configStatus: () => request<ConfigStatus>("/config/status"),

  verifyAuth: (didToken: string) =>
    request<{ valid: boolean; user_id: string; email?: string; public_address?: string }>(
      "/api/auth/verify",
      { method: "POST", body: JSON.stringify({ did_token: didToken }) },
    ),

  register: (
    didToken: string,
    uaAddress?: string,
    sraAddress?: string,
    email?: string,
    evidence?: { eip7702TxHash?: string; eip7702Delegated?: boolean },
  ) =>
    request<{
      user_id: string;
      email?: string;
      ua_address?: string;
      sra_address?: string;
      eip7702_tx_hash?: string;
      eip7702_delegated?: boolean;
    }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        did_token: didToken,
        ua_address: uaAddress,
        sra_address: sraAddress,
        email,
        eip7702_tx_hash: evidence?.eip7702TxHash,
        eip7702_delegated: evidence?.eip7702Delegated,
      }),
    }),

  sponsorEip7702: (
    didToken: string,
    authority: string,
    authorization: Record<string, unknown>,
  ) =>
    request<{
      tx_hash: string;
      delegated: boolean;
      authority: string;
      sponsor: string;
      user_id: string;
      eip7702_tx_hash?: string;
      eip7702_delegated?: boolean;
    }>("/api/auth/sponsor-eip7702", {
      method: "POST",
      body: JSON.stringify({
        did_token: didToken,
        authority,
        authorization,
      }),
    }),

  previewStrategy: (body: { budget_usdc: number; risk_level: string; goal: string }) =>
    request<{
      plan: import("./strategy").StrategyPlan;
      live_apys: Record<string, number>;
    }>("/api/agent/strategy/preview", { method: "POST", body: JSON.stringify(body) }),

  activate: (body: {
    user_id: string;
    budget_usdc: number;
    risk_level: string;
    goal: string;
    ua_address: string;
    sra_address?: string;
  }) =>
    request<{
      status: "activated" | string;
      explanation: string;
      plan?: import("./strategy").StrategyPlan;
      provider?: string;
      message?: string;
    }>("/api/agent/activate", { method: "POST", body: JSON.stringify(body) }),

  prepareDeploy: (body: {
    user_id: string;
    budget_usdc: number;
    risk_level: string;
    goal: string;
    ua_address: string;
    sra_address?: string;
  }) =>
    request<{
      status: "pending_signatures" | string;
      plan: import("./strategy").StrategyPlan;
      transactions: import("./strategy").ActivationTransaction[];
      message?: string;
    }>("/api/agent/deploy/prepare", { method: "POST", body: JSON.stringify(body) }),

  confirmActivate: (body: {
    user_id: string;
    ua_address: string;
    sra_address?: string;
    budget_usdc: number;
    risk_level: string;
    goal: string;
    plan: import("./strategy").StrategyPlan;
    signed_txs: Array<{
      purpose: string;
      tx_hash: string;
      leg_asset?: string;
      amount_usdc?: number;
      estimated_apy?: number;
    }>;
  }) =>
    request<{
      status: string;
      explanation: string;
      actions_taken: number;
      message?: string;
    }>("/api/agent/activate/confirm", { method: "POST", body: JSON.stringify(body) }),

  rebalance: (body: { user_id: string; ua_address: string; instruction: string }) =>
    request<{ status: string; explanation: string; actions: unknown[]; plan?: unknown }>(
      "/api/agent/rebalance",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),

  enableSession: (body: {
    user_id: string;
    ua_address: string;
    approval: string;
    session_signer: string;
  }) =>
    request<{ status: string; session_active: boolean; message?: string }>(
      "/api/agent/session/enable",
      { method: "POST", body: JSON.stringify(body) },
    ),

  prepareRebalance: (body: { user_id: string; ua_address: string; instruction: string }) =>
    request<{
      status: "pending_execution" | "no_action" | string;
      explanation: string;
      calls: Array<{ to: string; data: string; value?: string; purpose?: string }>;
      actions: Array<Record<string, unknown>>;
    }>("/api/agent/rebalance/prepare", { method: "POST", body: JSON.stringify(body) }),

  confirmRebalance: (body: {
    user_id: string;
    ua_address: string;
    instruction: string;
    tx_hash: string;
    actions: Array<Record<string, unknown>>;
  }) =>
    request<{ status: string; explanation: string }>("/api/agent/rebalance/confirm", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  setMarketRiskConsent: (body: { user_id: string; ua_address: string; consent: boolean }) =>
    request<{ status: string; market_risk_consent: boolean }>("/api/agent/consent/market-risk", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateProfile: (body: {
    user_id: string;
    ua_address: string;
    display_name?: string | null;
    avatar?: string | null;
  }) =>
    request<{ status: string; display_name: string | null; avatar: string | null }>(
      "/api/agent/profile",
      { method: "POST", body: JSON.stringify(body) },
    ),

  prepareLp: (body: { user_id: string; ua_address: string; usdc_amount?: number }) =>
    request<{
      status: "pending_execution" | string;
      calls: Array<{ to: string; data: string; value?: string; purpose?: string }>;
      usdc_amount: number;
      explanation: string;
    }>("/api/agent/lp/prepare", { method: "POST", body: JSON.stringify(body) }),

  confirmLp: (body: {
    user_id: string;
    ua_address: string;
    usdc_amount: number;
    tx_hash: string;
    estimated_apy?: number;
  }) =>
    request<{ status: string; explanation: string }>("/api/agent/lp/confirm", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  prepareLpExit: (body: { user_id: string; ua_address: string }) =>
    request<{
      status: "pending_execution" | "no_action" | string;
      calls: Array<{ to: string; data: string; value?: string; purpose?: string }>;
      token_id?: number;
      explanation: string;
    }>("/api/agent/lp/exit/prepare", { method: "POST", body: JSON.stringify(body) }),

  confirmLpExit: (body: { user_id: string; ua_address: string; tx_hash: string }) =>
    request<{ status: string; explanation: string }>("/api/agent/lp/exit/confirm", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  prepareGmxDeposit: (body: { user_id: string; ua_address: string; usdc_amount?: number }) =>
    request<{
      status: "pending_execution" | string;
      calls: Array<{ to: string; data: string; value?: string; purpose?: string }>;
      usdc_amount: number;
      execution_fee_wei: string;
      execution_fee_eth: number;
      explanation: string;
    }>("/api/agent/gmx/deposit/prepare", { method: "POST", body: JSON.stringify(body) }),

  confirmGmxDeposit: (body: {
    user_id: string;
    ua_address: string;
    usdc_amount: number;
    tx_hash: string;
    estimated_apy?: number;
  }) =>
    request<{ status: string; explanation: string }>("/api/agent/gmx/deposit/confirm", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  prepareGmxWithdraw: (body: { user_id: string; ua_address: string }) =>
    request<{
      status: "pending_execution" | "no_action" | string;
      calls: Array<{ to: string; data: string; value?: string; purpose?: string }>;
      gm_amount_raw?: string;
      execution_fee_wei?: string;
      execution_fee_eth?: number;
      explanation: string;
    }>("/api/agent/gmx/withdraw/prepare", { method: "POST", body: JSON.stringify(body) }),

  confirmGmxWithdraw: (body: { user_id: string; ua_address: string; tx_hash: string }) =>
    request<{ status: string; explanation: string }>("/api/agent/gmx/withdraw/confirm", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  saveCustomStrategy: (body: {
    user_id: string;
    ua_address: string;
    legs: import("./strategy").CustomStrategyLeg[];
  }) =>
    request<{
      status: string;
      plan: import("./strategy").StrategyPlan;
      custom_strategy: import("./strategy").CustomStrategy;
      message?: string;
    }>("/api/agent/strategy/custom", { method: "POST", body: JSON.stringify(body) }),

  previewRoute: (body: {
    user_id: string;
    ua_address: string;
    budget_usdc?: number;
    exclude_venues?: string[];
  }) =>
    request<RoutePreviewResponse>("/api/agent/route/preview", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  prepareRouteApply: (body: { user_id: string; ua_address: string; exclude_venues?: string[] }) =>
    request<RouteApplyPrepareResponse>("/api/agent/route/apply/prepare", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  confirmRouteApply: (body: { user_id: string; ua_address: string; legs: RouteApplyLeg[] }) =>
    request<RouteApplyConfirmResponse>("/api/agent/route/apply/confirm", {
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
