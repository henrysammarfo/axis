import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FixedLogo, FixedNav, FixedFooter } from "../components/brand/FixedChrome";
import { Filter, Shield, TrendingUp, Activity, Layers, ArrowUpRight } from "lucide-react";
import { axisApi } from "../lib/api";
import { brandHeadMeta } from "../lib/seo";

export const Route = createFileRoute("/vault")({
  head: () =>
    brandHeadMeta({
      title: "Vault — AXIS Strategies",
      description: "Live DeFi yields AXIS monitors on Arbitrum.",
      path: "/vault",
    }),
  component: VaultPage,
});

type Chain = "Arbitrum" | "Base" | "Optimism";
type Risk = "Low" | "Med" | "High";

const CHAINS: (Chain | "All")[] = ["All", "Arbitrum", "Base", "Optimism"];
const RISKS: (Risk | "All")[] = ["All", "Low", "Med", "High"];
const RISK_ICON = { Low: Shield, Med: Activity, High: TrendingUp };

const STRATEGIES = [
  { id: "aave-usdc", name: "Aave USDC Supply", chain: "Arbitrum" as Chain, risk: "Low" as Risk, protocol: "aave", asset: "USDC" },
  { id: "aave-eth", name: "Aave ETH Supply", chain: "Arbitrum" as Chain, risk: "Low" as Risk, protocol: "aave", asset: "ETH" },
  { id: "gmx-glp", name: "GMX GM Pools", chain: "Arbitrum" as Chain, risk: "Med" as Risk, protocol: "gmx", asset: "GM" },
] as const;

function VaultPage() {
  const [chain, setChain] = useState<Chain | "All">("All");
  const [risk, setRisk] = useState<Risk | "All">("All");

  const { data: aaveUsdc } = useQuery({ queryKey: ["yield", "aave", "USDC"], queryFn: () => axisApi.yields.aave("USDC") });
  const { data: aaveEth } = useQuery({ queryKey: ["yield", "aave", "ETH"], queryFn: () => axisApi.yields.aave("ETH") });
  const { data: gmx } = useQuery({ queryKey: ["yield", "gmx"], queryFn: () => axisApi.yields.gmx });

  const apyMap: Record<string, number> = {
    "aave-usdc": Number(aaveUsdc?.supply_apy ?? 0),
    "aave-eth": Number(aaveEth?.supply_apy ?? 0),
    "gmx-glp": Number(gmx?.apy ?? 0),
  };

  const items = useMemo(
    () =>
      STRATEGIES.filter(
        (v) => (chain === "All" || v.chain === chain) && (risk === "All" || v.risk === risk),
      ).map((v) => ({ ...v, apy: apyMap[v.id] ?? 0 })),
    [chain, risk, aaveUsdc, aaveEth, gmx],
  );

  const avgApy = items.length ? items.reduce((s, v) => s + v.apy, 0) / items.length : 0;

  return (
    <div className="min-h-screen bg-black text-white font-tight overflow-x-hidden">
      <FixedLogo />
      <FixedNav />

      <div className="pt-[160px] sm:pt-[200px] lg:pt-[240px] px-4 lg:px-12 pb-32">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/50 mb-4">
          Live yields · Arbitrum
        </p>
        <h1 className="text-[48px] sm:text-[72px] lg:text-[96px] leading-[0.9] tracking-[-0.05em] max-w-[14ch]">
          Strategy vault
        </h1>
        <p className="mt-6 text-sm text-white/60 max-w-[52ch]">
          Real APY data from Aave v3 and GMX on Arbitrum. AXIS allocates your budget across these
          protocols automatically.
        </p>

        <div className="mt-10 flex flex-wrap gap-2">
          {CHAINS.map((c) => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-full border ${
                chain === c ? "bg-white text-black border-white" : "border-white/20 text-white/70"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-12 border border-white/10">
          <div className="px-4 sm:px-6 py-4 border-b border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[10px] uppercase tracking-widest text-white/50">
            <span>Avg APY {avgApy.toFixed(1)}%</span>
            <span>{items.length} strategies</span>
          </div>
          {items.map((v) => {
            const RiskIco = RISK_ICON[v.risk];
            return (
              <div
                key={v.id}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,2fr)_auto_auto] gap-4 items-center px-4 sm:px-6 py-5 border-b border-white/10 last:border-b-0"
              >
                <div>
                  <div className="text-lg uppercase tracking-[-0.03em]">{v.name}</div>
                  <div className="mt-2 flex gap-2 text-[9px] uppercase tracking-widest text-white/50">
                    <span className="border border-white/20 px-2 py-0.5">{v.chain}</span>
                    <span className="border border-white/20 px-2 py-0.5 inline-flex items-center gap-1">
                      <RiskIco size={10} /> {v.risk}
                    </span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-white/40 text-xs uppercase tracking-widest">
                  <Layers size={14} /> {v.protocol}
                </div>
                <div className="text-3xl tracking-[-0.04em] text-[color:var(--color-lime)]">
                  {v.apy > 0 ? `${v.apy.toFixed(1)}%` : "—"}
                </div>
              </div>
            );
          })}
        </div>

        <Link
          to="/onboard"
          className="mt-12 inline-flex items-center gap-2 bg-white text-black rounded-full px-6 py-3 text-xs uppercase tracking-widest"
        >
          Activate AXIS <ArrowUpRight size={14} strokeWidth={1.75} />
        </Link>
      </div>

      <FixedFooter />
    </div>
  );
}
