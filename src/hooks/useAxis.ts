import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axisApi } from "../lib/api";
import {
  deployStrategy,
  rebalanceViaSession,
  enableMarketRiskSession,
  openLpViaSession,
  closeLpViaSession,
  depositGmxViaSession,
  withdrawGmxViaSession,
  applyRouteViaSession,
  getStoredSession,
} from "../lib/wallet";

export function useAxisConfig() {
  return useQuery({
    queryKey: ["axis", "config"],
    queryFn: () => axisApi.configStatus(),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAxisStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ["axis", "status", userId],
    queryFn: () => axisApi.status(userId!),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    retry: 1,
  });
}

/**
 * Best-yield route for the user's profile + available funds. A query so the
 * dashboard can show it live; refetch to re-scan yields on demand.
 */
export function useRoutePreview(
  userId: string | undefined,
  uaAddress: string | undefined,
  excludeVenues: string[] = [],
) {
  return useQuery({
    queryKey: ["axis", "route", userId, uaAddress, excludeVenues.slice().sort().join(",")],
    queryFn: () =>
      axisApi.previewRoute({
        user_id: userId!,
        ua_address: uaAddress!,
        exclude_venues: excludeVenues,
      }),
    enabled: Boolean(userId && uaAddress),
    staleTime: 120_000,
    retry: 1,
  });
}

export function useAxisReport(userId: string | undefined) {
  return useQuery({
    queryKey: ["axis", "report", userId],
    queryFn: () => axisApi.report(userId!),
    enabled: Boolean(userId),
    staleTime: 300_000,
  });
}

export function useAxisHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ["axis", "history", userId],
    queryFn: () => axisApi.history(userId!),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });
}

export function useStrategyPreview(budget: number, risk: string, goal: string, enabled: boolean) {
  return useQuery({
    queryKey: ["axis", "strategy-preview", budget, risk, goal],
    queryFn: () => axisApi.previewStrategy({ budget_usdc: budget, risk_level: risk, goal }),
    enabled,
    staleTime: 30_000,
  });
}

export function useSession() {
  return getStoredSession();
}

export function useActivateAxis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: axisApi.activate,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "report", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "history", vars.user_id] });
    },
  });
}

export function useDeployStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deployStrategy,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "report", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "history", vars.user_id] });
    },
  });
}

export function useRebalanceAxis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: axisApi.rebalance,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "report", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "history", vars.user_id] });
    },
  });
}

/** Autonomous, prompt-free rebalance via the session key. */
export function useRebalanceViaSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rebalanceViaSession,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "history", vars.user_id] });
    },
  });
}

export function useSaveCustomStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: axisApi.saveCustomStrategy,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: axisApi.updateProfile,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
    },
  });
}

/** One-time: consent + rebuild the session with the Uniswap LP permissions. */
export function useEnableMarketRiskSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { user_id: string; ua_address: string }) =>
      enableMarketRiskSession(vars.user_id, vars.ua_address),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
    },
  });
}

/** Open a Uniswap V3 USDC/USDT stable LP via the session key (prompt-free). */
export function useOpenLpViaSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: openLpViaSession,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "history", vars.user_id] });
    },
  });
}

/** Close the Uniswap V3 USDC/USDT stable LP via the session key (prompt-free). */
export function useCloseLpViaSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: closeLpViaSession,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "history", vars.user_id] });
    },
  });
}

/** Add USDC liquidity to the GMX ETH/USD GM pool via the session key (no signing). */
export function useDepositGmx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: depositGmxViaSession,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "history", vars.user_id] });
    },
  });
}

/** Redeem the GMX ETH/USD GM position back to the user via the session key (no signing). */
export function useWithdrawGmx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: withdrawGmxViaSession,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "history", vars.user_id] });
    },
  });
}

/** One-tap: apply the entire best-yield route via the session key (no signing). */
export function useApplyRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: applyRouteViaSession,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["axis", "status", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "history", vars.user_id] });
      qc.invalidateQueries({ queryKey: ["axis", "route", vars.user_id, vars.ua_address] });
    },
  });
}
