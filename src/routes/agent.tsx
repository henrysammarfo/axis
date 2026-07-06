import { createFileRoute } from "@tanstack/react-router";
import { FixedLogo, FixedNav, FixedFooter } from "../components/brand/FixedChrome";
import { ScatteredGrid } from "../components/scroll/ScatteredGrid";
import { Sparkles, Zap, Shield, Wallet, TrendingUp, CircleDot } from "lucide-react";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "The Agent — AXIS" },
      { name: "description", content: "How the AXIS agent thinks, plans, and executes cross-chain DeFi." },
      { property: "og:title", content: "The Agent — AXIS" },
      { property: "og:description", content: "Claude Agent SDK + Universal Accounts + EIP-7702." },
    ],
  }),
  component: AgentPage,
});

const STEPS = [
  { icon: Wallet, k: "01", t: "Sign in", d: "Google auth. Magic mints a wallet. You never see a seed phrase." },
  { icon: Shield, k: "02", t: "Upgrade", d: "EIP-7702 upgrades your EOA. Same address, agent-capable." },
  { icon: Sparkles, k: "03", t: "Intent", d: "State a goal. AXIS translates it into a multi-chain execution plan." },
  { icon: Zap, k: "04", t: "Execute", d: "Universal Account settles across Arbitrum, Base, Optimism as one balance." },
  { icon: TrendingUp, k: "05", t: "Compound", d: "Positions rebalance weekly. Yield reports in plain English." },
  { icon: CircleDot, k: "06", t: "Withdraw", d: "One tap. Any chain. Any token. Off-ramp on demand." },
];

function AgentPage() {
  return (
    <div className="min-h-screen bg-black text-white font-tight overflow-x-hidden">
      <FixedLogo />
      <FixedNav />

      <div className="pt-[160px] sm:pt-[200px] lg:pt-[240px] px-4 lg:px-12">
        <div className="flex items-center gap-3 text-white/50 text-[10px] sm:text-xs uppercase tracking-[0.2em] mb-6 sm:mb-8">
          <Sparkles size={14} strokeWidth={1.75} /> Agent / v1
        </div>
        <h1 className="text-[44px] sm:text-[80px] lg:text-[160px] leading-[0.88] tracking-[-0.05em] max-w-[1200px]">
          One agent.<br />Every chain.<br />Zero friction.
        </h1>
      </div>

      <div className="px-4 lg:px-12 mt-20 sm:mt-32 lg:mt-40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10">
        {STEPS.map(({ icon: Icon, k, t, d }) => (
          <div key={k} className="bg-black p-6 sm:p-8 lg:p-12 min-h-[220px] sm:min-h-[280px] flex flex-col justify-between">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
              <Icon size={32} strokeWidth={1.5} />
              <span className="text-[10px] uppercase tracking-widest text-white/50 justify-self-end">{k}</span>
            </div>
            <div className="mt-8 sm:mt-0">
              <div className="text-2xl sm:text-3xl lg:text-4xl uppercase tracking-[-0.04em]">{t}</div>
              <p className="mt-3 text-sm text-white/60 leading-snug max-w-[26ch]">{d}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-24 sm:mt-32 lg:mt-40 pb-[160px] sm:pb-[220px]">
        <div className="px-4 lg:px-12 mb-10 sm:mb-16">
          <div className="text-white/50 text-[10px] sm:text-xs uppercase tracking-[0.2em] mb-3 sm:mb-4">Observed / Live capture</div>
          <div className="text-2xl sm:text-4xl lg:text-5xl tracking-[-0.03em]">The agent runs in the open.</div>
        </div>
        <ScatteredGrid
          items={6}
          render={(i) => (
            <div className="w-full h-full bg-white/5 border border-white/10 flex items-center justify-center">
              <div className="text-center px-4">
                <div className="text-[10px] uppercase text-white/40 tracking-widest">Signal</div>
                <div className="text-5xl sm:text-6xl lg:text-8xl mt-3 tracking-[-0.05em]">{String(i + 1).padStart(2, "0")}</div>
              </div>
            </div>
          )}
        />
      </div>

      <FixedFooter />
    </div>
  );
}
