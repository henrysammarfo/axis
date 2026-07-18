import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axisApi } from "../lib/api";
import { deployStrategy, rebalanceViaSession, getStoredSession } from "../lib/wallet";

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

export function useStrategyPreview(
  budget: number,
  risk: string,
  goal: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["axis", "strategy-preview", budget, risk, goal],
    queryFn: () =>
      axisApi.previewStrategy({ budget_usdc: budget, risk_level: risk, goal }),
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
