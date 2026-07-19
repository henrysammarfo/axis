import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useEffect, useRef, useState } from "react";
import { FixedFooter } from "../../components/brand/FixedChrome";
import { MobileMenu } from "../../components/brand/MobileMenu";
import { Logo } from "../../components/brand/Logo";
import {
  Wallet,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  Copy,
  Check,
  CircleDot,
  Zap,
  Shield,
  Menu,
  Filter,
  Package,
  Bot,
  Layers,
  ChevronRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
  X,
  Pencil,
} from "lucide-react";
import { Route as AuthenticatedRoute } from "../_authenticated";
import {
  actionsToAgentFeed,
  actionsToOrders,
  chainAllocations,
  portfolioSummary,
  positionsToVaults,
} from "../../lib/portfolio";
import {
  useActivateAxis,
  useAxisHistory,
  useAxisReport,
  useAxisStatus,
  useDeployStrategy,
  useRebalanceAxis,
  useRebalanceViaSession,
  useSaveCustomStrategy,
  useEnableMarketRiskSession,
  useOpenLpViaSession,
  useCloseLpViaSession,
  useDepositGmx,
  useWithdrawGmx,
  useRoutePreview,
  useApplyRoute,
} from "../../hooks/useAxis";
import { toast } from "sonner";

import { truncateAddress } from "../../lib/api";
import { brandHeadMeta } from "../../lib/seo";
import { useProfile } from "../../hooks/useProfile";
import { resolveAvatarSrc } from "../../lib/profile";
import {
  GOALS,
  RISKS,
  type CustomStrategyLeg,
  type GoalLabel,
  type RiskLevel,
} from "../../lib/strategy";

const RISK_LABEL: Record<RiskLevel, string> = {
  conservative: "Safe",
  moderate: "Balanced",
  aggressive: "Bold",
};

const VENUE_LABEL: Record<string, string> = {
  aave_usdc: "Aave · USDC",
  aave_usdt: "Aave · USDT",
  uniswap_lp: "Uniswap · USDC/USDT",
  gmx_gm: "GMX · ETH/USD",
};
function venueLabel(venue: string): string {
  return VENUE_LABEL[venue] ?? venue;
}
function riskLabel(tier: string): string {
  if (tier === "stable") return "Stable";
  if (tier === "stable-lp") return "Stable LP";
  if (tier === "market") return "Market";
  return tier;
}
function riskChip(tier: string): string {
  if (tier === "market") return "border-white/25 text-white/60";
  if (tier === "stable-lp")
    return "border-[color:var(--color-lime)]/30 text-[color:var(--color-lime)]/80";
  return "border-[color:var(--color-lime)]/40 text-[color:var(--color-lime)]";
}

const tabSchema = z.enum(["overview", "vaults", "agent", "orders", "merch"]);
const chainSchema = z.enum(["All", "Arbitrum", "Base", "Optimism", "Ethereum"]);
const dashSearch = z.object({
  tab: fallback(tabSchema, "overview").default("overview"),
  chain: fallback(chainSchema, "All").default("All"),
  activate: z.string().optional(),
  budget: z.string().optional(),
  risk: z.string().optional(),
  goal: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: zodValidator(dashSearch),
  head: () =>
    brandHeadMeta({
      title: "Portfolio — AXIS",
      description: "Your agent's live positions and yield.",
      path: "/dashboard",
      noIndex: true,
    }),
  component: Dashboard,
});

const ICON = { size: 16, strokeWidth: 1.75 } as const;
type Chain = "Arbitrum" | "Base" | "Optimism" | "Ethereum";
const CHAINS: (Chain | "All")[] = ["All", "Arbitrum", "Base", "Optimism", "Ethereum"];

function EmptyState({ message }: { message: string }) {
  return <div className="p-10 text-center text-white/40 text-sm">{message}</div>;
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2 || points.every((p) => p === 0)) {
    return (
      <div className="h-full grid place-items-center text-xs text-white/30 uppercase tracking-widest">
        No yield history yet
      </div>
    );
  }
  const max = Math.max(...points, 0.01);
  const w = 400,
    h = 100;
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
      <path d={d} stroke="currentColor" strokeWidth="2" fill="none" />
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="currentColor" opacity="0.15" />
    </svg>
  );
}

type Tab = "overview" | "vaults" | "agent" | "orders" | "merch";

const TABS: { id: Tab; label: string; icon: typeof Layers }[] = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "vaults", label: "Vaults", icon: Shield },
  { id: "agent", label: "Agent Log", icon: Bot },
  { id: "orders", label: "Orders", icon: Activity },
  { id: "merch", label: "Merch", icon: Package },
];

function Dashboard() {
  const { session } = AuthenticatedRoute.useRouteContext();
  const { tab, chain, activate, budget: budgetParam, risk, goal } = Route.useSearch();
  const navigate = useNavigate({ from: "/dashboard" });
  const userId = session.userId;
  const profile = useProfile(userId);
  const { data: axisStatus, isLoading } = useAxisStatus(userId);
  const { data: axisReport } = useAxisReport(userId);
  const { data: historyData } = useAxisHistory(userId);
  const activateMutation = useActivateAxis();
  const deployMutation = useDeployStrategy();
  const rebalanceMutation = useRebalanceAxis();
  const sessionRebalance = useRebalanceViaSession();
  const saveCustom = useSaveCustomStrategy();
  const enableLp = useEnableMarketRiskSession();
  const openLp = useOpenLpViaSession();
  const closeLp = useCloseLpViaSession();
  const depositGmx = useDepositGmx();
  const withdrawGmx = useWithdrawGmx();
  const [excludeVenues, setExcludeVenues] = useState<string[]>([]);
  const route = useRoutePreview(userId, session.uaAddress, excludeVenues);
  const applyRoute = useApplyRoute();
  const [applyingRoute, setApplyingRoute] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const toggleVenue = (venue: string) =>
    setExcludeVenues((prev) =>
      prev.includes(venue) ? prev.filter((v) => v !== venue) : [...prev, venue],
    );
  const [routeSummary, setRouteSummary] = useState<{
    applied: Array<{ venue: string; asset: string; amount_usdc: number; tx_hash: string }>;
    skipped: Array<{ venue: string; amount_usdc: number; reason: string }>;
  } | null>(null);
  const activatedRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [budget, setBudget] = useState(500);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rebalanceText, setRebalanceText] = useState("");
  const [activating, setActivating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [savingStrategy, setSavingStrategy] = useState(false);
  // Optimistic selection so the pill highlights the instant you tap — we persist
  // in the background and clear these once the server status catches up.
  const [pendingRisk, setPendingRisk] = useState<RiskLevel | null>(null);
  const [pendingGoal, setPendingGoal] = useState<GoalLabel | null>(null);

  const handsOff = Boolean(axisStatus?.session_active);
  const [usdcWeight, setUsdcWeight] = useState(60);
  const [lpAmount, setLpAmount] = useState(0);
  const [gmxAmount, setGmxAmount] = useState(0);
  const marketRiskOn = Boolean(axisStatus?.market_risk_consent);
  const isAggressive = (axisStatus?.risk_level || "").toLowerCase() === "aggressive";

  const activeRisk = (pendingRisk ?? axisStatus?.risk_level ?? risk ?? "moderate") as RiskLevel;
  const activeGoal = (pendingGoal ?? axisStatus?.goal ?? goal ?? GOALS[0]) as GoalLabel;
  // Goal is stored as a free-form label; match case-insensitively so the pill
  // still lights up when the server hands back "maximize yield" vs "Maximize yield".
  const goalIsActive = (g: GoalLabel) => activeGoal.toLowerCase() === g.toLowerCase();

  const sra = axisStatus?.sra_address ?? session.sraAddress;
  const uaDisplay = axisStatus?.ua_address ?? session.uaAddress;

  useEffect(() => {
    if (activate === "1" && userId && session.uaAddress && !activatedRef.current) {
      activatedRef.current = true;
      setActivating(true);
      activateMutation
        .mutateAsync({
          user_id: userId,
          budget_usdc: Number(budgetParam ?? budget),
          risk_level: risk ?? "moderate",
          goal: goal ?? "Maximize yield",
          ua_address: session.uaAddress,
          sra_address: session.sraAddress,
        })
        .then((res) => {
          toast.success("AXIS is set up", {
            description: (res.message || res.explanation || "Your strategy is saved.").slice(
              0,
              160,
            ),
          });
          navigate({
            search: (p) => ({
              ...p,
              activate: undefined,
              budget: undefined,
              risk: undefined,
              goal: undefined,
            }),
            replace: true,
          });
        })
        .catch((e: Error) => {
          activatedRef.current = false;
          toast.error("Setup failed", { description: e.message });
        })
        .finally(() => setActivating(false));
    }
  }, [activate, userId, session, budgetParam, risk, goal, budget, activateMutation, navigate]);

  const onChangeStrategy = async (nextRisk: RiskLevel, nextGoal: GoalLabel) => {
    if (!userId || !session.uaAddress) return;
    if (nextRisk === activeRisk && goalIsActive(nextGoal)) return;
    // Reflect the choice immediately, then persist in the background.
    setPendingRisk(nextRisk);
    setPendingGoal(nextGoal);
    setSavingStrategy(true);
    try {
      await activateMutation.mutateAsync({
        user_id: userId,
        budget_usdc: axisStatus?.budget_usdc || Number(budgetParam ?? budget),
        risk_level: nextRisk,
        goal: nextGoal,
        ua_address: session.uaAddress,
        sra_address: session.sraAddress,
      });
      toast.success("Strategy updated", {
        description: `AXIS is now ${RISK_LABEL[nextRisk].toLowerCase()} · ${nextGoal.toLowerCase()}.`,
      });
    } catch (e) {
      // Roll back the optimistic pills so the UI matches the saved strategy.
      setPendingRisk(null);
      setPendingGoal(null);
      toast.error("Couldn't update", {
        description: e instanceof Error ? e.message : "Try again in a moment.",
      });
    } finally {
      setSavingStrategy(false);
    }
  };

  // Clear the optimistic selection once the refreshed status matches it.
  useEffect(() => {
    if (pendingRisk && axisStatus?.risk_level === pendingRisk) setPendingRisk(null);
    if (pendingGoal && (axisStatus?.goal ?? "").toLowerCase() === pendingGoal.toLowerCase())
      setPendingGoal(null);
  }, [axisStatus?.risk_level, axisStatus?.goal, pendingRisk, pendingGoal]);

  const onDeploy = async () => {
    if (!userId || !session.uaAddress) return;
    setDeploying(true);
    try {
      const res = await deployMutation.mutateAsync({
        user_id: userId,
        budget_usdc: axisStatus?.budget_usdc || Number(budgetParam ?? budget),
        risk_level: axisStatus?.risk_level || risk || "moderate",
        goal: axisStatus?.goal || goal || "Maximize yield",
        ua_address: session.uaAddress,
        sra_address: session.sraAddress,
      });
      toast.success("Funds deployed", {
        description: (res.explanation || "Your Aave positions are live.").slice(0, 160),
      });
    } catch (e) {
      toast.error("Nothing to put to work yet", {
        description: e instanceof Error ? e.message : "Add USDC on Arbitrum, then tap Begin.",
      });
    } finally {
      setDeploying(false);
    }
  };

  const onSaveBudget = async () => {
    if (!userId || !session.uaAddress) return;
    const n = Math.round(Number(budgetInput) * 100) / 100;
    if (!Number.isFinite(n) || n < 10) {
      toast.error("Minimum is $10", {
        description: "Choose how much AXIS should invest — $10 or more.",
      });
      return;
    }
    try {
      await activateMutation.mutateAsync({
        user_id: userId,
        budget_usdc: n,
        risk_level: axisStatus?.risk_level || risk || "moderate",
        goal: axisStatus?.goal || goal || "Maximize yield",
        ua_address: session.uaAddress,
        sra_address: session.sraAddress,
      });
      toast.success("Budget updated", {
        description: `AXIS will invest up to $${n.toFixed(2)} — the rest stays in your wallet.`,
      });
      setEditingBudget(false);
    } catch (e) {
      toast.error("Couldn't update budget", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    }
  };

  const setTab = (t: Tab) =>
    navigate({
      search: (p: { tab: Tab; chain: Chain | "All" }) => ({ ...p, tab: t }),
      replace: true,
    });
  const setChain = (c: Chain | "All") =>
    navigate({
      search: (p: { tab: Tab; chain: Chain | "All" }) => ({ ...p, chain: c }),
      replace: true,
    });

  const actions = historyData?.actions ?? [];
  const positions = axisStatus?.positions ?? [];
  const s = portfolioSummary(axisStatus);
  const vaultRows = positionsToVaults(positions);
  const agentFeed = actionsToAgentFeed(actions);
  const orders = actionsToOrders(actions);
  const chains = chainAllocations(positions);

  const filteredVaults = useMemo(
    () => (chain === "All" ? vaultRows : vaultRows.filter((v) => v.chain === chain)),
    [vaultRows, chain],
  );
  const filteredOrders = useMemo(
    () => (chain === "All" ? orders : orders.filter((o) => o.chain === chain)),
    [orders, chain],
  );
  // Only offer chains the user actually has activity on, so the filter never
  // shows a dead "Base / Optimism" tab that always resolves to an empty list.
  const chainOptions = useMemo<(Chain | "All")[]>(() => {
    const present = new Set<string>([
      ...vaultRows.map((v) => v.chain),
      ...orders.map((o) => o.chain),
    ]);
    return CHAINS.filter((c) => c === "All" || present.has(c));
  }, [vaultRows, orders]);

  const totalBalance = s.totalAllocated;
  const weeklyYield = s.weeklyYield;
  const currentBudget = Number(axisStatus?.budget_usdc ?? budgetParam ?? budget ?? 0) || 0;

  const copy = () => {
    if (!sra) return;
    navigator.clipboard.writeText(sra).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onRebalance = async () => {
    if (!rebalanceText.trim() || !userId || !session.uaAddress) return;
    try {
      // Hands-off mode: AXIS executes the move itself (no wallet popups).
      if (handsOff) {
        const res = await sessionRebalance.mutateAsync({
          user_id: userId,
          ua_address: session.uaAddress,
          instruction: rebalanceText,
        });
        toast.success("AXIS is on it", {
          description: (res.explanation || "Working on your request.").slice(0, 140),
        });
      } else {
        const res = await rebalanceMutation.mutateAsync({
          user_id: userId,
          ua_address: session.uaAddress,
          instruction: rebalanceText,
        });
        toast.success("AXIS heard you", { description: res.explanation.slice(0, 120) });
      }
      setRebalanceText("");
    } catch (e) {
      toast.error("Couldn't do that", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  const onSaveCustom = async () => {
    if (!userId || !session.uaAddress) return;
    const usdt = 100 - usdcWeight;
    const legs: CustomStrategyLeg[] = [];
    if (usdcWeight > 0) legs.push({ protocol: "aave", asset: "USDC", weight_pct: usdcWeight });
    if (usdt > 0) legs.push({ protocol: "aave", asset: "USDT", weight_pct: usdt });
    try {
      const res = await saveCustom.mutateAsync({
        user_id: userId,
        ua_address: session.uaAddress,
        legs,
      });
      toast.success("Custom strategy saved", {
        description: (res.message || "Deploy or ask AXIS to apply it.").slice(0, 140),
      });
    } catch (e) {
      toast.error("Couldn't save that mix", {
        description: e instanceof Error ? e.message : "Weights must add up to 100%.",
      });
    }
  };

  const onEnableLp = async () => {
    if (!userId || !session.uaAddress) return;
    try {
      await enableLp.mutateAsync({ user_id: userId, ua_address: session.uaAddress });
      toast.success("Stable LP unlocked", {
        description:
          "AXIS can now open a Uniswap USDC/USDT LP for you — funds stay in your wallet.",
      });
    } catch (e) {
      toast.error("Couldn't unlock the LP", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    }
  };

  const onOpenLp = async () => {
    if (!userId || !session.uaAddress) return;
    try {
      const res = await openLp.mutateAsync({
        user_id: userId,
        ua_address: session.uaAddress,
        usdc_amount: lpAmount > 0 ? lpAmount : undefined,
      });
      toast.success("AXIS opened your LP", {
        description: (res.explanation || "Your USDC/USDT stable LP is open.").slice(0, 140),
      });
    } catch (e) {
      toast.error("Couldn't open the LP", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    }
  };

  const onCloseLp = async () => {
    if (!userId || !session.uaAddress) return;
    try {
      const res = await closeLp.mutateAsync({
        user_id: userId,
        ua_address: session.uaAddress,
      });
      if (res.status === "no_action") {
        toast.info("No open LP", {
          description: res.explanation || "You don't have a stable LP open right now.",
        });
        return;
      }
      toast.success("AXIS closed your LP", {
        description: (res.explanation || "Your funds are back in your wallet.").slice(0, 140),
      });
    } catch (e) {
      toast.error("Couldn't close the LP", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    }
  };

  const onDepositGmx = async () => {
    if (!userId || !session.uaAddress) return;
    try {
      const res = await depositGmx.mutateAsync({
        user_id: userId,
        ua_address: session.uaAddress,
        usdc_amount: gmxAmount > 0 ? gmxAmount : undefined,
      });
      toast.success("GMX deposit submitted", {
        description: (res.explanation || "GM tokens settle in a few seconds.").slice(0, 160),
      });
    } catch (e) {
      toast.error("Couldn't add to GMX", {
        description:
          e instanceof Error
            ? e.message
            : "Make sure you hold a little ETH for the fee, then retry.",
      });
    }
  };

  const onWithdrawGmx = async () => {
    if (!userId || !session.uaAddress) return;
    try {
      const res = await withdrawGmx.mutateAsync({
        user_id: userId,
        ua_address: session.uaAddress,
      });
      if (res.status === "no_action") {
        toast.info("No GMX position", {
          description: res.explanation || "You don't have a GMX position open.",
        });
        return;
      }
      toast.success("GMX withdrawal submitted", {
        description: (res.explanation || "Funds settle back to you shortly.").slice(0, 160),
      });
    } catch (e) {
      toast.error("Couldn't close GMX", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    }
  };

  // One-tap: apply the ENTIRE best route (stable Aave core + market sleeve) via the
  // session key — no signing. The backend groups the calls per venue; each group
  // runs as its own gasless UserOp so one leg failing (e.g. no ETH for GMX's keeper
  // fee) skips gracefully and the rest still land. Then we show "what AXIS did".
  const onApplyRoute = async () => {
    if (!userId || !session.uaAddress) return;
    if (!handsOff) {
      toast.error("Turn on hands-off first", {
        description: "Deposit once to enable AXIS to act without prompts.",
      });
      return;
    }
    setApplyingRoute(true);
    setRouteSummary(null);
    try {
      const result = await applyRoute.mutateAsync({
        user_id: userId,
        ua_address: session.uaAddress,
        exclude_venues: excludeVenues,
      });
      setRouteSummary({ applied: result.applied, skipped: result.skipped });

      if (result.applied.length > 0) {
        toast.success("AXIS put your money to work", {
          description: `${result.applied.length} venue${
            result.applied.length > 1 ? "s" : ""
          } funded — no signing.${
            result.skipped.length ? ` ${result.skipped.length} skipped.` : ""
          }`,
        });
      } else {
        toast.info("Nothing was applied", {
          description: (result.explanation || "No eligible venues right now.").slice(0, 160),
        });
      }
      route.refetch();
    } catch (e) {
      toast.error("Couldn't apply route", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setApplyingRoute(false);
    }
  };

  const rebalancing = handsOff ? sessionRebalance.isPending : rebalanceMutation.isPending;

  const livePositions = positions;

  if (isLoading && !axisStatus) {
    return (
      <div className="min-h-screen bg-black text-white font-tight grid place-items-center">
        <p className="text-sm uppercase tracking-widest text-white/50">Loading portfolio…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-tight pb-20 lg:pb-0">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-black/85 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between px-4 lg:px-8 h-16">
          <Link to="/" className="flex items-center gap-3 min-w-0" aria-label="AXIS home">
            <Logo width={72} />
            <span className="text-[10px] uppercase tracking-widest text-white/40 hidden sm:inline shrink-0">
              / Portfolio v1
            </span>
          </Link>
          <div className="flex items-center gap-2 lg:gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-2 border border-white/20 rounded-full px-3 py-1.5 text-[10px] lg:text-xs uppercase tracking-widest">
              <Wallet {...ICON} />
              {truncateAddress(uaDisplay)}
            </div>
            <Link
              to="/profile"
              aria-label="Your profile"
              className="h-9 w-9 rounded-full overflow-hidden border border-white/20 hover:border-white/50 transition-colors shrink-0"
            >
              <img
                src={resolveAvatarSrc(profile.avatar)}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            </Link>
            <button
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="min-h-11 min-w-11 grid place-items-center"
            >
              <Menu size={20} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Mobile tab scroller */}
      <div className="fixed top-16 left-0 right-0 z-20 bg-black/85 backdrop-blur-md border-b border-white/10 lg:hidden">
        <div className="flex overflow-x-auto no-scrollbar px-4 gap-1 py-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-full text-[11px] uppercase tracking-widest border ${
                tab === id ? "bg-white text-black border-white" : "border-white/15 text-white/70"
              }`}
            >
              <Icon size={13} strokeWidth={1.75} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-[128px] lg:pt-24 px-4 lg:px-8 pb-40 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-8">
        {/* Left rail — desktop */}
        <nav className="hidden lg:flex flex-col gap-1 sticky top-24 self-start pt-4">
          {TABS.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm uppercase tracking-widest text-left transition-colors ${
                tab === id
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-[10px] opacity-60 w-4">{String(i + 1).padStart(2, "0")}</span>
              <Icon size={16} strokeWidth={1.75} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Main */}
        <div className="space-y-4 lg:space-y-6 min-w-0">
          {/* Summary strip (all tabs) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10">
            <StatCell
              label="Deployed"
              value={`$${s.totalAllocated.toLocaleString()}`}
              icon={Wallet}
            />
            <StatCell
              label="Weighted APY"
              value={`${s.weightedApy.toFixed(1)}%`}
              icon={TrendingUp}
              accent
            />
            <StatCell label="Active vaults" value={`${s.active}/${s.total}`} icon={Shield} />
            <StatCell label="Orders" value={`${s.filled} ✓ · ${s.pending} …`} icon={Activity} />
          </div>

          {tab === "overview" && (
            <>
              {/* Hero balance */}
              <div className="border border-white/10 p-6 lg:p-10">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 mb-4">
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50 truncate">
                    Total balance
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[color:var(--color-lime)] text-xs sm:text-sm">
                    <TrendingUp {...ICON} /> ~$
                    {weeklyYield.toFixed(2)} / week est.
                  </span>
                </div>
                <div className="text-[44px] sm:text-[64px] lg:text-[110px] leading-none tracking-[-0.05em]">
                  $
                  {totalBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>

                {/* Investment budget — you decide how much goes in, not your whole balance */}
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                  <span className="uppercase tracking-widest text-white/40">Investment budget</span>
                  {editingBudget ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-white/50">$</span>
                      <input
                        type="number"
                        min={10}
                        step={1}
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className="w-24 bg-transparent border-b border-white/20 focus:border-[color:var(--color-lime)] outline-none text-white py-1"
                        autoFocus
                      />
                      <button
                        onClick={onSaveBudget}
                        disabled={activateMutation.isPending}
                        className="text-black bg-[color:var(--color-lime)] rounded-full px-3 py-1 font-medium disabled:opacity-50 cursor-pointer"
                      >
                        {activateMutation.isPending ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingBudget(false)}
                        className="text-white/50 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-white text-sm">
                        $
                        {currentBudget.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <button
                        onClick={() => {
                          setBudgetInput(currentBudget ? String(currentBudget) : "");
                          setEditingBudget(true);
                        }}
                        className="inline-flex items-center gap-1 text-[color:var(--color-lime)] hover:brightness-110 cursor-pointer"
                      >
                        <Pencil size={12} strokeWidth={1.75} /> Edit
                      </button>
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-white/40 max-w-prose">
                  AXIS invests up to this amount — the rest of your balance stays in your wallet.
                  You choose, it&apos;s never your whole balance.
                </p>

                {activating && (
                  <p className="mt-4 text-sm text-[color:var(--color-lime)] uppercase tracking-widest">
                    Setting up your agent…
                  </p>
                )}
                {positions.length > 0 && axisReport?.report?.trim() && (
                  <div className="mt-5 border border-white/10 rounded-md p-4 max-w-prose">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                      Weekly note
                    </p>
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
                      {axisReport.report.trim()}
                    </p>
                  </div>
                )}
                <div className="mt-6 h-20 sm:h-24 text-[color:var(--color-lime)]">
                  <Sparkline
                    points={
                      positions.length ? positions.map((p) => Number(p.estimated_apy) || 0) : [0, 0]
                    }
                  />
                </div>

                {positions.length === 0 && (
                  <div className="mt-6 border border-[color:var(--color-lime)]/30 bg-[color:var(--color-lime)]/5 p-5 rounded-md">
                    <p className="text-sm text-white/80 leading-relaxed">
                      Your agent is ready{" "}
                      <span className="text-white/50">
                        ({axisStatus?.risk_level || "moderate"} · {axisStatus?.goal || "—"})
                      </span>
                      . Add some USDC to your address below, then tap Begin.{" "}
                      {handsOff
                        ? "Hands-off mode is on — AXIS invests with zero popups."
                        : "You'll okay AXIS once, then it invests and rebalances for you — no more wallet popups."}
                    </p>
                    <button
                      onClick={onDeploy}
                      disabled={deploying || !session.uaAddress}
                      className="mt-4 bg-[color:var(--color-lime)] text-black rounded-full px-6 py-3 text-xs uppercase tracking-widest font-medium disabled:opacity-50 cursor-pointer"
                    >
                      {deploying
                        ? "AXIS is getting to work…"
                        : `Begin — put $${currentBudget.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })} to work`}
                    </button>
                  </div>
                )}
              </div>

              {/* Chain allocation summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                {chains.map(({ chain: c, alloc, count, wapy }) => (
                  <div
                    key={c}
                    className="border border-white/10 p-5 sm:p-6 flex flex-col justify-between min-h-[160px]"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <span className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50 truncate">
                        {c}
                      </span>
                      <CircleDot
                        size={14}
                        strokeWidth={1.75}
                        className="text-[color:var(--color-lime)] shrink-0"
                      />
                    </div>
                    <div>
                      <div className="text-3xl sm:text-4xl tracking-[-0.04em]">
                        ${alloc.toLocaleString()}
                      </div>
                      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[10px] sm:text-xs uppercase text-white/50 tracking-widest">
                        <span className="truncate">{count} positions</span>
                        <span className="shrink-0">APY {wapy.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Agent + SRA */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                <div className="border border-white/10 p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50 inline-flex items-center gap-2">
                      <Sparkles size={13} strokeWidth={1.75} /> Agent log
                    </span>
                    <button
                      onClick={() => setTab("agent")}
                      className="text-[10px] uppercase tracking-widest inline-flex items-center gap-1 text-white/70"
                    >
                      All <ChevronRight size={12} strokeWidth={1.75} />
                    </button>
                  </div>
                  <ul className="space-y-3">
                    {agentFeed.length === 0 && (
                      <li className="text-sm text-white/40">No agent activity yet.</li>
                    )}
                    {agentFeed.slice(0, 5).map((f) => (
                      <li key={f.id} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 text-sm">
                        <span className="text-white/40 shrink-0">{f.time}</span>
                        <span className="text-white/90 truncate">{f.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border border-white/10 p-5 sm:p-6 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50 mb-2 inline-flex items-center gap-2">
                      <Zap size={13} strokeWidth={1.75} /> Your deposit address
                    </div>
                    <div className="text-xs text-white/60">
                      Send USDC from any chain or exchange. It lands here automatically — then hit
                      Begin.
                    </div>
                  </div>
                  <div className="mt-5 bg-white/5 border border-white/10 rounded-md p-3 sm:p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    {sra ? (
                      <>
                        <code className="text-[10px] sm:text-xs lg:text-sm break-all min-w-0">
                          {sra}
                        </code>
                        <button
                          onClick={copy}
                          className="shrink-0 bg-white text-black rounded-full p-2"
                          aria-label="Copy"
                        >
                          {copied ? (
                            <Check size={14} strokeWidth={2} />
                          ) : (
                            <Copy size={14} strokeWidth={1.75} />
                          )}
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-white/40">Deposit address loading…</span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50">
                    {(["Arbitrum", "Base", "Optimism", "Ethereum"] as Chain[]).map((c) => (
                      <span key={c} className="border border-white/20 px-2 py-1">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ask AXIS */}
              <div className="border border-white/10 p-5 sm:p-6">
                <div className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50 mb-3">
                  Ask AXIS anything
                </div>
                <div className="flex gap-2">
                  <input
                    value={rebalanceText}
                    onChange={(e) => setRebalanceText(e.target.value)}
                    placeholder="Play it safer for a while"
                    className="flex-1 bg-white/5 border border-white/10 rounded-md px-4 py-3 text-sm outline-none focus:border-white/30"
                    onKeyDown={(e) => e.key === "Enter" && onRebalance()}
                  />
                  <button
                    onClick={onRebalance}
                    disabled={rebalancing || !userId}
                    className="shrink-0 bg-white text-black rounded-full px-5 py-3 text-xs uppercase tracking-widest disabled:opacity-50"
                  >
                    {rebalancing ? "…" : "Ask"}
                  </button>
                </div>
              </div>

              {/* Smart route — best-yield router across every venue */}
              {route.data && (
                <div className="border border-white/10 p-5 sm:p-6 mb-6">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-2">
                    <span className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50 inline-flex items-center gap-2 truncate">
                      <Layers size={13} strokeWidth={1.75} /> Smart route · best yield now
                    </span>
                    <button
                      onClick={() => route.refetch()}
                      disabled={route.isFetching}
                      className="text-[10px] uppercase tracking-widest text-white/50 hover:text-white border border-white/15 rounded-full px-3 py-1 disabled:opacity-50 shrink-0"
                    >
                      {route.isFetching ? "Scanning…" : "Re-scan"}
                    </button>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">
                    AXIS scans Aave, the Uniswap stable LP and the GMX pool, then routes your money
                    to the best risk-adjusted mix — no signing.
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="border border-white/10 rounded-lg py-2">
                      <p className="text-[9px] uppercase tracking-widest text-white/40">
                        Blended APY
                      </p>
                      <p className="text-lg tracking-[-0.03em] text-[color:var(--color-lime)]">
                        {route.data.route.blended_apy.toFixed(2)}%
                      </p>
                    </div>
                    <div className="border border-white/10 rounded-lg py-2">
                      <p className="text-[9px] uppercase tracking-widest text-white/40">
                        {route.data.projected ? "Would deploy" : "Deploying"}
                      </p>
                      <p className="text-lg tracking-[-0.03em]">
                        ${route.data.route.deployed_usdc.toFixed(2)}
                      </p>
                    </div>
                    <div className="border border-white/10 rounded-lg py-2">
                      <p className="text-[9px] uppercase tracking-widest text-white/40">~ / week</p>
                      <p className="text-lg tracking-[-0.03em]">
                        ${route.data.route.estimated_weekly_yield_usdc.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* What AXIS sees in your wallet (balance-aware routing) */}
                  {route.data.balances && (
                    <p className="mt-3 text-[10px] uppercase tracking-widest text-white/40">
                      In your wallet · ${route.data.balances.usdc.toFixed(2)} USDC
                      {route.data.balances.usdt > 0.01 &&
                        ` · $${route.data.balances.usdt.toFixed(2)} USDT`}
                      {` · ${route.data.balances.eth.toFixed(4)} ETH`}
                    </p>
                  )}

                  {route.data.budget_usdc > 0 && (
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">
                      Budget · ${route.data.deployed_usdc.toFixed(2)} used of $
                      {route.data.budget_usdc.toFixed(2)} · $
                      {Math.max(0, route.data.budget_usdc - route.data.deployed_usdc).toFixed(2)}{" "}
                      left in budget
                    </p>
                  )}

                  {route.data.projected && (
                    <p className="mt-3 text-[10px] uppercase tracking-widest text-white/40">
                      Projection · add USDC to your wallet to route it live (idle: $
                      {route.data.idle_usdc.toFixed(2)})
                    </p>
                  )}

                  {/* Power-user venue toggles — only when market venues are unlocked */}
                  {route.data.market_risk_ok && (
                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                        Venues · tap to include / exclude
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { venue: "uniswap_lp", label: "Stable LP" },
                          { venue: "gmx_gm", label: "GMX" },
                        ].map(({ venue, label }) => {
                          const on = !excludeVenues.includes(venue);
                          return (
                            <button
                              key={venue}
                              onClick={() => toggleVenue(venue)}
                              className={`px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-full border transition-colors ${
                                on
                                  ? "bg-white text-black border-white"
                                  : "border-white/20 text-white/40"
                              }`}
                            >
                              {label} · {on ? "on" : "off"}
                            </button>
                          );
                        })}
                      </div>
                      {!route.data.gmx_fundable && !excludeVenues.includes("gmx_gm") && (
                        <p className="mt-2 text-[10px] text-white/40 leading-relaxed">
                          GMX needs ~{route.data.gmx_fee_eth.toFixed(4)} ETH for its keeper fee —
                          add a little ETH to include it, or AXIS will route around it
                          automatically.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Live venue ranking */}
                  <div className="mt-5">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                      Live yields
                    </p>
                    <div className="space-y-1.5">
                      {[...route.data.route.quotes]
                        .sort((a, b) => b.apy - a.apy)
                        .map((q) => (
                          <div
                            key={q.venue}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="text-white/70 truncate">{venueLabel(q.venue)}</span>
                            <span className="inline-flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[9px] uppercase tracking-widest rounded-full px-2 py-0.5 border ${riskChip(q.risk_tier)}`}
                              >
                                {riskLabel(q.risk_tier)}
                              </span>
                              {q.eligible ? (
                                <span className="text-white/80 tabular-nums w-14 text-right">
                                  {q.apy > 0 ? `${q.apy.toFixed(2)}%` : "—"}
                                </span>
                              ) : (
                                <span className="text-white/30 w-14 text-right">Locked</span>
                              )}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Recommended split */}
                  <div className="mt-5">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                      Recommended split
                    </p>
                    <div className="space-y-1.5">
                      {route.data.route.legs.map((leg) => (
                        <div
                          key={leg.venue}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-white/70 truncate">{venueLabel(leg.venue)}</span>
                          <span className="inline-flex items-center gap-3 shrink-0 tabular-nums">
                            <span className="text-white/40">
                              {Math.round(leg.share_of_deployed * 100)}%
                            </span>
                            <span className="text-white">${leg.amount_usdc.toFixed(2)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {route.data.route.legs.length > 0 && (
                    <>
                      <button
                        onClick={onApplyRoute}
                        disabled={applyingRoute || !handsOff || route.data.projected}
                        className="mt-5 w-full bg-white text-black rounded-full px-5 py-2.5 text-[10px] uppercase tracking-widest disabled:opacity-50"
                      >
                        {applyingRoute
                          ? "AXIS is putting it to work…"
                          : !handsOff
                            ? "Turn on hands-off to apply"
                            : route.data.projected
                              ? "Add USDC to apply"
                              : "Apply best route"}
                      </button>
                      <p className="mt-2 text-center text-[10px] text-white/30">
                        One tap · no signing · gas on us
                      </p>
                      {!route.data.market_risk_ok && isAggressive && (
                        <p className="mt-3 text-[10px] uppercase tracking-widest text-white/40">
                          Unlock higher-yield venues in the stable LP card below.
                        </p>
                      )}
                    </>
                  )}

                  {routeSummary &&
                    (routeSummary.applied.length > 0 || routeSummary.skipped.length > 0) && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                          What AXIS did
                        </p>
                        <div className="space-y-1.5">
                          {routeSummary.applied.map((a) => (
                            <div
                              key={a.tx_hash}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="inline-flex items-center gap-2 text-white/80 truncate">
                                <Check
                                  size={12}
                                  strokeWidth={2}
                                  className="text-[color:var(--color-lime)] shrink-0"
                                />
                                {venueLabel(a.venue)}
                              </span>
                              <span className="inline-flex items-center gap-3 shrink-0 tabular-nums">
                                <span className="text-white">${a.amount_usdc.toFixed(2)}</span>
                                <a
                                  href={`https://arbiscan.io/tx/${a.tx_hash}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-white/40 underline decoration-white/20 hover:text-white/70"
                                >
                                  tx
                                </a>
                              </span>
                            </div>
                          ))}
                          {routeSummary.skipped.map((s, i) => (
                            <div
                              key={`skip-${i}`}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="inline-flex items-center gap-2 text-white/40 truncate">
                                <X size={12} strokeWidth={2} className="shrink-0" />
                                {venueLabel(s.venue)}
                              </span>
                              <span className="text-white/30 shrink-0 tabular-nums">
                                ${s.amount_usdc.toFixed(2)} skipped
                              </span>
                            </div>
                          ))}
                        </div>
                        {routeSummary.skipped.length > 0 && (
                          <p className="mt-2 text-[10px] text-white/30 leading-relaxed">
                            Skipped legs usually just need a little ETH for GMX's keeper fee — the
                            rest still went through.
                          </p>
                        )}
                      </div>
                    )}
                </div>
              )}

              {/* Strategy — change any time */}
              <div className="border border-white/10 p-5 sm:p-6">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-2">
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50 inline-flex items-center gap-2 truncate">
                    <Shield size={13} strokeWidth={1.75} /> Your strategy
                    {handsOff && (
                      <span className="inline-flex items-center gap-1 border border-[color:var(--color-lime)]/40 text-[color:var(--color-lime)] rounded-full px-2 py-0.5 text-[9px]">
                        <Zap size={10} strokeWidth={2} /> Hands-off on
                      </span>
                    )}
                  </span>
                  <span className="text-xl sm:text-2xl tracking-[-0.04em] shrink-0">
                    ${axisStatus?.budget_usdc ?? budget}
                  </span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  Switch your vibe any time. AXIS adjusts how it invests — safer, balanced, or going
                  for max returns.
                </p>

                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Risk</p>
                  <div className="flex gap-2">
                    {RISKS.map((r) => (
                      <button
                        key={r}
                        onClick={() => onChangeStrategy(r, activeGoal)}
                        aria-pressed={activeRisk === r}
                        className={`flex-1 py-2 text-[10px] uppercase tracking-widest rounded-full border transition-colors ${
                          activeRisk === r
                            ? "bg-white text-black border-white"
                            : "border-white/20 text-white/70 hover:border-white/40 hover:text-white"
                        }`}
                      >
                        {RISK_LABEL[r]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Goal</p>
                  <div className="flex flex-wrap gap-2">
                    {GOALS.map((g) => (
                      <button
                        key={g}
                        onClick={() => onChangeStrategy(activeRisk, g)}
                        aria-pressed={goalIsActive(g)}
                        className={`px-4 py-2 text-[10px] uppercase tracking-widest rounded-full border transition-colors ${
                          goalIsActive(g)
                            ? "bg-white text-black border-white"
                            : "border-white/20 text-white/70 hover:border-white/40 hover:text-white"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                {savingStrategy && (
                  <p className="mt-3 text-[10px] uppercase tracking-widest text-[color:var(--color-lime)]">
                    Updating your agent…
                  </p>
                )}

                {/* Build your own mix (power users) */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-1">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 inline-flex items-center gap-2 truncate">
                      <Sparkles size={12} strokeWidth={1.75} /> Build your own mix
                    </p>
                    <span className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">
                      Aave · stablecoins
                    </span>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Split your deposit between USDC and USDT on Aave. AXIS stays inside the same
                    safety limits — it can only supply and withdraw to your own wallet.
                  </p>
                  <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-widest text-white/60">
                    <span>USDC {usdcWeight}%</span>
                    <span>USDT {100 - usdcWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={usdcWeight}
                    onChange={(e) => setUsdcWeight(Number(e.target.value))}
                    className="mt-2 w-full accent-[color:var(--color-lime)]"
                    aria-label="USDC / USDT split"
                  />
                  <button
                    onClick={onSaveCustom}
                    disabled={saveCustom.isPending || !session.uaAddress}
                    className="mt-4 border border-white/20 hover:bg-white/5 rounded-full px-5 py-2.5 text-[10px] uppercase tracking-widest disabled:opacity-50"
                  >
                    {saveCustom.isPending ? "Saving…" : "Save my mix"}
                  </button>
                </div>

                {/* Uniswap V3 USDC/USDT stable LP — Bold tier, market-risk (opt-in) */}
                {isAggressive && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-1">
                      <p className="text-[10px] uppercase tracking-widest text-white/40 inline-flex items-center gap-2 truncate">
                        <Zap size={12} strokeWidth={1.75} /> Stable LP · higher yield
                      </p>
                      <span className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">
                        Uniswap V3 · USDC/USDT
                      </span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Earn trading fees by providing USDC/USDT liquidity. Both sides are stablecoins
                      and the position is always minted to you. Unlike plain lending, this carries a
                      little market risk, so it needs your one-time OK.
                    </p>

                    {!marketRiskOn ? (
                      <button
                        onClick={onEnableLp}
                        disabled={enableLp.isPending || !session.uaAddress}
                        className="mt-4 border border-[color:var(--color-lime)]/40 text-[color:var(--color-lime)] hover:bg-[color:var(--color-lime)]/10 rounded-full px-5 py-2.5 text-[10px] uppercase tracking-widest disabled:opacity-50"
                      >
                        {enableLp.isPending
                          ? "Confirm in wallet…"
                          : "I understand — unlock stable LP"}
                      </button>
                    ) : (
                      <>
                        <div className="mt-4 flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-widest text-white/40">
                            USDC
                          </span>
                          <input
                            type="number"
                            min={2}
                            step={1}
                            value={lpAmount || ""}
                            placeholder="Auto"
                            onChange={(e) => setLpAmount(Number(e.target.value))}
                            className="w-28 bg-transparent border border-white/20 rounded-full px-4 py-2 text-sm outline-none focus:border-white/40"
                            aria-label="USDC amount for stable LP"
                          />
                          <span className="text-[10px] uppercase tracking-widest text-white/30">
                            leave blank = suggested
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            onClick={onOpenLp}
                            disabled={openLp.isPending || !handsOff}
                            className="bg-white text-black rounded-full px-5 py-2.5 text-[10px] uppercase tracking-widest disabled:opacity-50"
                          >
                            {openLp.isPending ? "AXIS is opening it…" : "Open stable LP"}
                          </button>
                          <button
                            onClick={onCloseLp}
                            disabled={closeLp.isPending || !handsOff}
                            className="border border-white/20 hover:bg-white/5 rounded-full px-5 py-2.5 text-[10px] uppercase tracking-widest disabled:opacity-50"
                          >
                            {closeLp.isPending ? "AXIS is closing it…" : "Close LP"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* GMX V2 GM pool — signing-free market-risk action (opt-in) */}
                {isAggressive && marketRiskOn && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-1">
                      <p className="text-[10px] uppercase tracking-widest text-white/40 inline-flex items-center gap-2 truncate">
                        <Zap size={12} strokeWidth={1.75} /> GMX pool · higher yield
                      </p>
                      <span className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">
                        GMX V2 · ETH/USD
                      </span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Provide liquidity to GMX's ETH/USD pool for a higher, variable yield. AXIS
                      does it for you — no signing. Gas is on us; GMX's small network keeper fee
                      comes from a little ETH in your wallet (excess refunded). It carries real
                      market risk — the value moves with the pool — and funds are always returned to
                      you.
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-white/40">
                        USDC
                      </span>
                      <input
                        type="number"
                        min={5}
                        step={1}
                        value={gmxAmount || ""}
                        placeholder="Auto"
                        onChange={(e) => setGmxAmount(Number(e.target.value))}
                        className="w-28 bg-transparent border border-white/20 rounded-full px-4 py-2 text-sm outline-none focus:border-white/40"
                        aria-label="USDC amount for GMX GM pool"
                      />
                      <span className="text-[10px] uppercase tracking-widest text-white/30">
                        leave blank = suggested
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        onClick={onDepositGmx}
                        disabled={depositGmx.isPending || !handsOff}
                        className="bg-white text-black rounded-full px-5 py-2.5 text-[10px] uppercase tracking-widest disabled:opacity-50"
                      >
                        {depositGmx.isPending ? "AXIS is adding it…" : "Add to GMX pool"}
                      </button>
                      <button
                        onClick={onWithdrawGmx}
                        disabled={withdrawGmx.isPending || !handsOff}
                        className="border border-white/20 hover:bg-white/5 rounded-full px-5 py-2.5 text-[10px] uppercase tracking-widest disabled:opacity-50"
                      >
                        {withdrawGmx.isPending ? "AXIS is closing it…" : "Close GMX"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "vaults" && (
            <div className="space-y-4">
              <FilterBar
                chain={chain}
                setChain={setChain}
                count={filteredVaults.length}
                label="vaults"
                options={chainOptions}
              />
              <div className="border border-white/10">
                {filteredVaults.map((v) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] gap-3 sm:gap-4 items-center px-4 sm:px-6 py-4 border-b border-white/10 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base uppercase tracking-[-0.03em] truncate">
                        {v.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[9px] sm:text-[10px] uppercase text-white/50 tracking-widest">
                        <span className="border border-white/20 px-2 py-0.5">{v.chain}</span>
                        <span className="border border-white/20 px-2 py-0.5">{v.protocol}</span>
                      </div>
                    </div>
                    <div className="hidden sm:block text-xs uppercase tracking-widest text-white/60">
                      Alloc ${v.allocated.toLocaleString()}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl sm:text-3xl tracking-[-0.04em] text-[color:var(--color-lime)]">
                        {v.apy.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
                {filteredVaults.length === 0 && (
                  <div className="p-10 text-center text-white/40 text-sm">
                    No vaults on this chain.
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "agent" && (
            <div className="border border-white/10">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 sm:px-6 py-4 border-b border-white/10">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50 inline-flex items-center gap-2 truncate">
                  <Bot size={13} strokeWidth={1.75} /> Full agent history
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-lime)] shrink-0">
                  Live
                </span>
              </div>
              <ul>
                {agentFeed.length === 0 && (
                  <li className="px-4 sm:px-6 py-10 text-center text-white/40 text-sm">
                    No agent history yet. Activate AXIS to get started.
                  </li>
                )}
                {agentFeed.map((f) => (
                  <li
                    key={f.id}
                    className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-3 px-4 sm:px-6 py-4 border-b border-white/10 last:border-b-0"
                  >
                    <span className="text-xs text-white/40">{f.time}</span>
                    <div className="min-w-0">
                      <div className="text-sm text-white/90 leading-snug">{f.message}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[9px] uppercase text-white/40 tracking-widest">
                        <span className="border border-white/15 px-2 py-0.5">{f.kind}</span>
                        {f.chain && (
                          <span className="border border-white/15 px-2 py-0.5">{f.chain}</span>
                        )}
                      </div>
                    </div>
                    {typeof f.amount === "number" && (
                      <span className="text-xs text-[color:var(--color-lime)] shrink-0 tracking-[-0.02em]">
                        +${f.amount.toFixed(2)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "orders" && (
            <div className="space-y-4">
              <FilterBar
                chain={chain}
                setChain={setChain}
                count={filteredOrders.length}
                label="orders"
                options={chainOptions}
              />
              <div className="border border-white/10">
                {filteredOrders.map((o) => {
                  const Ico =
                    o.status === "Filled"
                      ? CheckCircle2
                      : o.status === "Pending"
                        ? Activity
                        : AlertTriangle;
                  const color =
                    o.status === "Filled"
                      ? "text-[color:var(--color-lime)]"
                      : o.status === "Pending"
                        ? "text-white/70"
                        : "text-red-400";
                  return (
                    <div
                      key={o.id}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 border-b border-white/10 last:border-b-0"
                    >
                      <Ico size={16} strokeWidth={1.75} className={`${color} shrink-0`} />
                      <div className="min-w-0">
                        <div className="text-sm truncate">{o.action}</div>
                        <div className="mt-1 flex gap-2 text-[9px] uppercase text-white/40 tracking-widest">
                          <span className="border border-white/15 px-2 py-0.5">{o.chain}</span>
                          <span className="border border-white/15 px-2 py-0.5">{o.status}</span>
                        </div>
                      </div>
                      <span className="text-sm tracking-[-0.02em] shrink-0">
                        ${o.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <div className="p-10 text-center text-white/40 text-sm">
                    No orders on this chain.
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "merch" && (
            <div className="border border-white/10 p-6 sm:p-10">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[color:var(--color-lime)] mb-4">
                <Package size={14} strokeWidth={1.75} /> Coming soon
              </div>
              <div className="text-3xl sm:text-5xl tracking-[-0.04em] max-w-[26ch] leading-[0.95]">
                Merch unlocks when AXIS hits $10M under management.
              </div>
              <Link
                to="/merch"
                className="mt-8 inline-flex items-center gap-2 bg-white text-black rounded-full px-6 py-3 text-xs uppercase tracking-widest"
              >
                Join waitlist <ArrowUpRight size={14} strokeWidth={1.75} />
              </Link>
            </div>
          )}
        </div>
      </div>

      <FixedFooter />
    </div>
  );
}

function StatCell({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Layers;
  accent?: boolean;
}) {
  return (
    <div className="bg-black p-4 sm:p-5 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50">
        <Icon size={12} strokeWidth={1.75} />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={`text-lg sm:text-2xl tracking-[-0.04em] truncate ${accent ? "text-[color:var(--color-lime)]" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function FilterBar({
  chain,
  setChain,
  count,
  label,
  options = CHAINS,
}: {
  chain: Chain | "All";
  setChain: (c: Chain | "All") => void;
  count: number;
  label: string;
  options?: (Chain | "All")[];
}) {
  // With a single active chain the filter adds nothing — just show the count.
  const showChains = options.length > 2;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
      {showChains && (
        <>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50">
            <Filter size={13} strokeWidth={1.75} /> Chain
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar min-w-0">
            {options.map((c) => (
              <button
                key={c}
                onClick={() => setChain(c)}
                className={`shrink-0 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-full border ${
                  chain === c ? "bg-white text-black border-white" : "border-white/20 text-white/70"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="col-span-2 sm:ml-auto text-[10px] uppercase tracking-widest text-white/40">
        {count} {label}
      </div>
    </div>
  );
}
