import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { FixedLogo, FixedNav, FixedFooter } from "../components/brand/FixedChrome";
import { Filter, Shield, TrendingUp, Activity, Layers, ArrowUpRight } from "lucide-react";
import { VAULTS, type Chain, type Risk } from "../lib/brandData";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [
      { title: "Vault — AXIS Strategies" },
      { name: "description", content: "Ten strategies the AXIS agent executes across chains." },
      { property: "og:title", content: "Vault — AXIS" },
      { property: "og:description", content: "The strategy archive." },
    ],
  }),
  component: VaultPage,
});

const CHAINS: (Chain | "All")[] = ["All", "Arbitrum", "Base", "Optimism"];
const RISKS: (Risk | "All")[] = ["All", "Low", "Med", "High"];
const RISK_ICON = { Low: Shield, Med: Activity, High: TrendingUp };

function VaultPage() {
  const [chain, setChain] = useState<Chain | "All">("All");
  const [risk, setRisk] = useState<Risk | "All">("All");

  const items = useMemo(
    () =>
      VAULTS.filter(
        (v) => (chain === "All" || v.chain === chain) && (risk === "All" || v.risk === risk),
      ),
    [chain, risk],
  );

  const totalTVL = items.reduce((s, v) => s + v.tvl, 0);
  const avgApy = items.length ? items.reduce((s, v) => s + v.apy, 0) / items.length : 0;

  return (
    <div className="min-h-screen bg-black text-white font-tight overflow-x-hidden">
      <FixedLogo />
      <FixedNav />

      <div className="pt-[160px] sm:pt-[200px] lg:pt-[240px] px-4 lg:px-12">
        <div className="flex items-center gap-3 text-white/50 text-[10px] sm:text-xs uppercase tracking-[0.2em] mb-6 sm:mb-8">
          <Layers size={14} strokeWidth={1.75} /> Vault / Archive
        </div>
        <h1 className="text-[44px] sm:text-[80px] lg:text-[160px] leading-[0.88] tracking-[-0.05em]">
          Ten strategies.<br />One agent.
        </h1>
      </div>

      {/* Filters + summary */}
      <div className="mt-16 lg:mt-24 px-4 lg:px-12 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50">
            <Filter size={13} strokeWidth={1.75} /> Chain
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CHAINS.map((c) => (
              <button
                key={c}
                onClick={() => setChain(c)}
                className={`shrink-0 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-full border ${
                  chain === c ? "bg-white text-black border-white" : "border-white/20 text-white/70"
                }`}
              >{c}</button>
            ))}
          </div>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 sm:ml-6">
            <Shield size={13} strokeWidth={1.75} /> Risk
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {RISKS.map((r) => (
              <button
                key={r}
                onClick={() => setRisk(r)}
                className={`shrink-0 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-full border ${
                  risk === r ? "bg-white text-black border-white" : "border-white/20 text-white/70"
                }`}
              >{r}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px bg-white/10 border border-white/10">
          <SummaryCell label="Strategies" value={`${items.length}`} />
          <SummaryCell label="TVL" value={`$${(totalTVL / 1_000_000).toFixed(1)}M`} />
          <SummaryCell label="Avg APY" value={`${avgApy.toFixed(1)}%`} accent />
        </div>
      </div>

      {/* Grid */}
      <div className="mt-12 lg:mt-16 px-4 lg:px-12 pb-[160px] sm:pb-[220px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {items.map((s, i) => {
          const Ico = RISK_ICON[s.risk];
          return (
            <Link
              key={s.id}
              to="/dashboard"
              className="group bg-white/5 border border-white/10 p-5 sm:p-6 lg:p-8 flex flex-col justify-between min-h-[220px] sm:min-h-[260px] hover:bg-white/10 transition-colors"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <span className="text-[10px] uppercase text-white/50 tracking-widest truncate">
                  {String(i + 1).padStart(2, "0")} · {s.chain}
                </span>
                <Ico size={16} strokeWidth={1.75} className="text-[color:var(--color-lime)] shrink-0" />
              </div>
              <div className="mt-6">
                <div className="text-xl sm:text-2xl lg:text-3xl uppercase tracking-[-0.04em] truncate">{s.name}</div>
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                  <span className="text-4xl sm:text-5xl lg:text-6xl tracking-[-0.05em]">{s.apy}%</span>
                  <span className="text-[10px] uppercase text-white/60 tracking-widest shrink-0 pb-2">{s.risk}</span>
                </div>
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[10px] uppercase text-white/40 tracking-widest">
                  <span className="truncate">TVL ${(s.tvl / 1_000_000).toFixed(2)}M</span>
                  <span className="shrink-0 inline-flex items-center gap-1">
                    Open <ArrowUpRight size={12} strokeWidth={1.75} />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <FixedFooter />
    </div>
  );
}

function SummaryCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-black p-4 sm:p-5">
      <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className={`mt-1 text-lg sm:text-2xl tracking-[-0.04em] ${accent ? "text-[color:var(--color-lime)]" : ""}`}>{value}</div>
    </div>
  );
}
