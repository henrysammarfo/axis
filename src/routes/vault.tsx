import { createFileRoute, Link } from "@tanstack/react-router";
import { FixedLogo, FixedNav, FixedFooter } from "../components/brand/FixedChrome";
import { ScatteredGrid } from "../components/scroll/ScatteredGrid";

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

const STRATS = [
  { name: "Stable Yield", apy: "8.4%", risk: "Low", chain: "Arbitrum" },
  { name: "Delta Neutral", apy: "14.2%", risk: "Med", chain: "Base" },
  { name: "LST Loop", apy: "22.1%", risk: "Med", chain: "Arbitrum" },
  { name: "Options Vault", apy: "31.5%", risk: "High", chain: "Optimism" },
  { name: "Basis Trade", apy: "18.7%", risk: "Med", chain: "Base" },
  { name: "Liquidity Snipe", apy: "42.0%", risk: "High", chain: "Arbitrum" },
  { name: "T-Bill Wrap", apy: "5.1%", risk: "Low", chain: "Base" },
  { name: "Cross-DEX Arb", apy: "26.8%", risk: "Med", chain: "Optimism" },
  { name: "Recursive Lend", apy: "12.3%", risk: "Low", chain: "Arbitrum" },
  { name: "Vol Harvest", apy: "35.9%", risk: "High", chain: "Base" },
];

function VaultPage() {
  return (
    <div className="min-h-screen bg-black text-white font-tight">
      <FixedLogo />
      <FixedNav />
      <div className="pt-[200px] lg:pt-[240px] px-4 lg:px-12">
        <div className="text-white/50 text-xs uppercase tracking-[0.2em] mb-8">Vault / Archive</div>
        <h1 className="text-[56px] sm:text-[96px] lg:text-[160px] leading-[0.9] tracking-[-0.05em]">
          Ten strategies.<br />One agent.
        </h1>
      </div>

      <div className="mt-32 pb-[200px]">
        <ScatteredGrid
          items={STRATS.length}
          render={(i) => {
            const s = STRATS[i];
            return (
              <Link to="/dashboard" className="w-full h-full block bg-white/5 border border-white/10 p-6 lg:p-8 flex flex-col justify-between hover:bg-white/10 transition-colors">
                <div className="flex items-start justify-between">
                  <span className="text-xs uppercase text-white/50 tracking-widest">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-xs uppercase text-white/50 tracking-widest">{s.chain}</span>
                </div>
                <div>
                  <div className="text-2xl lg:text-3xl uppercase tracking-[-0.04em]">{s.name}</div>
                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-5xl lg:text-6xl tracking-[-0.05em]">{s.apy}</span>
                    <span className="text-xs uppercase text-white/60 tracking-widest">{s.risk}</span>
                  </div>
                </div>
              </Link>
            );
          }}
        />
      </div>

      <FixedFooter />
    </div>
  );
}
