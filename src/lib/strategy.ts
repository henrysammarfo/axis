/** Shared risk × goal enums — must match backend/services/strategy_engine.py */

export const RISKS = ["conservative", "moderate", "aggressive"] as const;
export type RiskLevel = (typeof RISKS)[number];

export const GOALS = ["Maximize yield", "Grow steadily", "Protect my money"] as const;
export type GoalLabel = (typeof GOALS)[number];

export const MIN_BUDGET_USDC = 10;
export const MAX_BUDGET_USDC = 10_000;

export type StrategyPlan = {
  risk_level: RiskLevel;
  goal: string;
  budget_usdc: number;
  cash_buffer_usdc: number;
  cash_buffer_pct: number;
  deployed_usdc: number;
  legs: Array<{
    protocol: string;
    asset: string;
    action: string;
    amount_usdc: number;
    weight_of_deployed: number;
    estimated_apy: number;
  }>;
  blended_apy: number;
  estimated_weekly_yield_usdc: number;
  notes: string[];
};

export type ActivationTransaction = {
  purpose: string;
  leg_asset?: string;
  amount_usdc?: number;
  estimated_apy?: number;
  to: string;
  data: string;
  value: string;
  chain_id: number;
};

/** A power-user custom strategy: allowlisted assets with weights that sum to 100. */
export const CUSTOM_ASSETS = ["USDC", "USDT"] as const;
export type CustomAsset = (typeof CUSTOM_ASSETS)[number];

export type CustomStrategyLeg = {
  protocol: "aave";
  asset: CustomAsset;
  weight_pct: number;
};

export type CustomStrategy = {
  legs: CustomStrategyLeg[];
};
