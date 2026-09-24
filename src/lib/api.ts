const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

import { getStoredSession } from "./wallet";
import type { ActionEntry } from "./portfolio";
import { userFacingError } from "./user-error";

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
  stock_basket?: BasketPlan | null;
  x402_spend?: { total_spent_usdc: number; queries_made: number };
};

export type BasketLeg = {
  symbol: string;
  name: string;
  address: string;
  weight: number;
  sector: string;
  explorer_url: string;
};

export type BasketPlan = {
  prompt: string;
  theme: string;
  oil_excluded: boolean;
  chain_id: number;
  network: string;
  testnet: boolean;
  budget_usdc: number;
  legs: BasketLeg[];
  english_summary: string;
};

export type RhTokenHolding = {
  symbol: string;
  name: string;
  address: string;
  raw: string;
  balance: number;
  decimals: number;
  explorer_url: string;
};

export type RhHoldings = {
  address: string;
  chain_id: number;
  network: string;
  testnet: boolean;
  explorer: string;
  faucet_url: string;
  eth_balance: number;
  tokens: RhTokenHolding[];
  agent_address?: string | null;
  honesty: string;
};

export type RhHoldTx = {
  symbol: string;
  amount: number;
  to: string;
  token: string;
  success: boolean;
  tx_hash: string;
  block?: number;
  explorer_url: string;
};

export type RhHolds = {
  status?: string;
  mode?: string | null;
  testnet?: boolean;
  chain_id?: number;
  faucet_url?: string;
  agent_address?: string | null;
  recipient?: string;
  txs?: RhHoldTx[];
  legs?: Array<{
    symbol: string;
    balance: number;
    token: string;
    explorer_url: string;
    source?: string;
  }>;
  skipped?: Array<{ symbol: string; reason: string }>;
  coverage?: {
    status: string;
    wanted: string[];
    present: string[];
    missing: string[];
    coverage: number;
  };
  recorded_at?: string;
  honesty?: string;
  holdings_snapshot?: RhHoldings;
  history?: Array<Record<string, unknown>>;
};

export type RhReadiness = {
  chain_id: number;
  network: string;
  testnet: boolean;
  faucet_url: string;
  wanted: string[];
  can_fund: boolean;
  can_sync: boolean;
  next_step: string;
  honesty: string;
  agent: {
    address?: string | null;
    eth_balance: number;
    can_fund_dust?: boolean;
    coverage?: RhHolds["coverage"];
  };
  user: {
    address?: string | null;
    can_sync?: boolean;
    coverage?: RhHolds["coverage"];
  };
};

export type LiquidityRails = {
  title: string;
  honesty: string;
  lesson: string;
  rails: Array<{
    id: string;
    label: string;
    chain_id: number | null;
    role: string;
    assets: string[];
    status: string;
    proof?: string;
    rpc?: string;
    explorer?: string;
    faucet?: string;
    notes: string;
  }>;
  demo_path: string[];
  usdg?: {
    axis_executes: boolean;
    status: string;
    source: string;
    legs: Array<{
      id: string;
      label: string;
      status: string;
      address?: string | null;
      explorer_url?: string | null;
    }>;
  };
};

export type UsdgPath = {
  title: string;
  status: string;
  axis_executes: boolean;
  honesty: string;
  hackquest_note: string;
  source: string;
  verified_at: string;
  legs: Array<{
    id: string;
    label: string;
    chain: string;
    chain_id: number | null;
    asset: string;
    role: string;
    status: string;
    address: string | null;
    address_verified: boolean;
    decimals?: number;
    explorer_url?: string | null;
    supply_control?: string;
    notes: string;
    layerzero?: Record<string, string | number>;
  }>;
  path_steps: Array<{
    step: number;
    title: string;
    detail: string;
    executable_today: boolean;
  }>;
  refuse: string[];
};

export type BeachheadGeo = {
  region: string;
  region_label: string;
  beachhead: boolean;
  beachhead_markets: string[];
  axis_demo: {
    arb_yield: boolean;
    rh_testnet_stocks: boolean;
    notes: string;
  };
  issuer_hints: {
    ondo_xstocks_us_persons: string;
    rh_classic_stock_tokens: string;
    honesty: string;
  };
  gtm_message: string;
  cta: string;
};

export type BeachheadPack = {
  title: string;
  wedge: string;
  primary_markets: Array<{ id: string; label: string; why: string }>;
  channels: Array<{ id: string; label: string; status: string }>;
  regions: Array<{ id: string; label: string }>;
  geo_law: string;
  demo_script: {
    title: string;
    duration_min: number;
    steps: Array<{ n: number; title: string; say: string; show: string; faucet?: string }>;
    partner_ops: string[];
  };
  geo: BeachheadGeo;
};

export type PackageCatalog = {
  title: string;
  status: string;
  axis_charges: boolean;
  honesty: string;
  revenue_thesis: string[];
  packages: Array<{
    id: string;
    name: string;
    price_usdc_mo: number;
    status: string;
    summary: string;
    legs_hint: string[];
  }>;
  cta: string;
};

export type InstrumentTruth = {
  instrument_id: string;
  underlying: string;
  display_symbol: string;
  name: string;
  issuer: string;
  program: string;
  claim_type: string;
  claim_summary: string;
  chain: string;
  chain_id: number | null;
  address: string | null;
  address_verified: boolean;
  explorer_url: string | null;
  docs_url?: string | null;
  mint_redeem: string;
  mint_redeem_notes: string;
  geo: {
    eligible_hint?: string;
    blocked_hint?: string;
    us_persons?: string;
  };
  weekend_trading?: boolean;
  is_share: boolean;
  testnet: boolean;
  axis_routeable: boolean;
  honesty: string;
  source?: string;
  verified_at?: string | null;
};

export type FragmentationCompare = {
  status: string;
  underlying: string;
  company?: Record<string, unknown>;
  instruments: InstrumentTruth[];
  verified_instruments?: InstrumentTruth[];
  axis_routeable?: InstrumentTruth[];
  diffs?: Array<{ field: string; values: Array<Record<string, unknown>> }>;
  fungible: boolean;
  axis_action: string;
  primary_route?: InstrumentTruth | null;
  warnings: string[];
  honesty: string;
};

export type RetentionStatus = {
  policy: {
    cadence: "weekly" | "biweekly" | string;
    weekday: string;
    timezone: string;
    include_arb_yield: boolean;
    include_stock_legs: boolean;
    include_fragmentation_warnings: boolean;
    rebalance_mode: "report_only" | "suggest" | string;
    honesty?: string;
  };
  next_due: string;
  last_report_at?: string | null;
  loop: {
    has_basket: boolean;
    hold_status: string;
    retain_ready: boolean;
  };
  actions_this_cycle: string[];
  honesty: string;
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
    throw new Error(userFacingError(message, `Couldn’t reach AXIS (${res.status}). Try again.`));
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
      active?: boolean;
      agent_ready?: boolean;
      risk_level?: string;
      goal?: string;
      budget_usdc?: number;
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

  sponsorEip7702: (didToken: string, authority: string, authorization: Record<string, unknown>) =>
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
    request<{
      report: string;
      user_id: string;
      stock_prices?: Array<{
        symbol: string;
        thursday_close: number | null;
        thursday_date: string | null;
        print_price: number | null;
        print_label: string;
        print_asof: string | null;
        source: string;
        honesty: string;
      }>;
      price_honesty?: string | null;
    }>(`/api/agent/report/${userId}`),

  history: (userId: string) =>
    request<{ actions: ActionEntry[] }>(`/api/portfolio/history/${userId}`),

  basket: {
    network: () =>
      request<{
        chain_id: number;
        label: string;
        rpc: string;
        explorer: string;
        testnet: boolean;
        stock_count: number;
        honesty: string;
      }>("/api/basket/network"),
    catalog: () =>
      request<{ stocks: Array<Record<string, unknown>>; network: Record<string, unknown> }>(
        "/api/basket/catalog",
      ),
    rails: () => request<LiquidityRails>("/api/basket/rails"),
    usdg: () => request<UsdgPath>("/api/basket/usdg"),
    beachhead: (region?: string) =>
      request<BeachheadPack>(
        region
          ? `/api/basket/beachhead?region=${encodeURIComponent(region)}`
          : "/api/basket/beachhead",
      ),
    geo: (region: string) =>
      request<BeachheadGeo>(`/api/basket/geo?region=${encodeURIComponent(region)}`),
    waitlist: (body: {
      email: string;
      region?: string;
      intent?: string;
      user_id?: string;
      note?: string;
      company_website?: string;
    }) =>
      request<{
        status: string;
        email: string;
        region: string;
        intent: string;
        geo: BeachheadGeo;
        honesty: string;
      }>("/api/basket/waitlist", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    packages: () => request<PackageCatalog>("/api/basket/packages"),
    faucet: () =>
      request<{
        faucet_url: string;
        agent_address?: string | null;
        chain_id: number;
        network?: string;
        testnet: boolean;
        tokens?: string[];
        honesty?: string;
        error?: string;
      }>("/api/basket/faucet"),
    preview: (prompt: string, budget_usdc = 100) =>
      request<{
        plan: BasketPlan;
        truth?: Record<string, unknown>;
        fragmentation?: Record<string, { instrument_count: number; verified_count: number; fungible: boolean }>;
      }>("/api/basket/preview", {
        method: "POST",
        body: JSON.stringify({ prompt, budget_usdc }),
      }),
    save: (userId: string, prompt: string, budget_usdc = 100) =>
      request<{ status: string; plan: BasketPlan; holds?: RhHolds }>("/api/basket/save", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, prompt, budget_usdc }),
      }),
    get: (userId: string) =>
      request<{
        plan: BasketPlan | null;
        holds: RhHolds | null;
        network: Record<string, unknown>;
        faucet_url: string;
        ua_address?: string | null;
        rails?: LiquidityRails;
        retention?: RetentionStatus;
      }>(`/api/basket/${encodeURIComponent(userId)}`),
    readiness: (userId: string) =>
      request<{
        readiness: RhReadiness;
        plan: BasketPlan | null;
        holds: RhHolds | null;
        network: Record<string, unknown>;
      }>(`/api/basket/${encodeURIComponent(userId)}/readiness`),
    holdings: (userId: string) =>
      request<{
        holdings: RhHoldings;
        holds: RhHolds | null;
        plan: BasketPlan | null;
        readiness: RhReadiness;
        network: Record<string, unknown>;
        rails: LiquidityRails;
      }>(`/api/basket/${encodeURIComponent(userId)}/holdings`),
    hold: (userId: string, opts?: { symbols?: string[]; dust?: number; mode?: "auto" | "fund" | "sync" }) =>
      request<{
        hold: RhHolds;
        holdings: RhHoldings | null;
        network: Record<string, unknown>;
        rails: LiquidityRails;
      }>("/api/basket/hold", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          symbols: opts?.symbols,
          dust: opts?.dust ?? 0.01,
          mode: opts?.mode ?? "auto",
        }),
      }),
    instruments: (underlying?: string) =>
      request<{
        instruments: InstrumentTruth[];
        count: number;
        underlying?: string;
        honesty: string;
      }>(
        underlying
          ? `/api/basket/instruments?underlying=${encodeURIComponent(underlying)}`
          : "/api/basket/instruments",
      ),
    truth: (symbol: string) =>
      request<{
        underlying: string;
        company: Record<string, unknown> | null;
        primary_route: InstrumentTruth | null;
        instrument_count: number;
        verified_count: number;
        honesty: string;
      }>(`/api/basket/truth/${encodeURIComponent(symbol)}`),
    fragmentationDesk: () =>
      request<{
        underlyings: Array<{
          symbol: string;
          name: string;
          instrument_count: number;
          verified_count: number;
        }>;
        honesty: string;
      }>("/api/basket/fragmentation"),
    fragmentation: (symbol: string) =>
      request<FragmentationCompare>(`/api/basket/fragmentation/${encodeURIComponent(symbol)}`),
    retention: (userId: string) =>
      request<RetentionStatus>(`/api/basket/retention/${encodeURIComponent(userId)}`),
    saveRetention: (
      userId: string,
      policy: Partial<RetentionStatus["policy"]> & {
        cadence?: string;
        rebalance_mode?: string;
      },
    ) =>
      request<RetentionStatus>("/api/basket/retention", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          cadence: policy.cadence ?? "weekly",
          weekday: policy.weekday ?? "monday",
          timezone: policy.timezone ?? "UTC",
          include_arb_yield: policy.include_arb_yield ?? true,
          include_stock_legs: policy.include_stock_legs ?? true,
          include_fragmentation_warnings: policy.include_fragmentation_warnings ?? true,
          rebalance_mode: policy.rebalance_mode ?? "report_only",
        }),
      }),
  },

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
