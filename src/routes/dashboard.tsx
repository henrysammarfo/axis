import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FixedFooter } from "../components/brand/FixedChrome";
import { Logo } from "../components/brand/Logo";
import {
  Wallet, Sparkles, TrendingUp, ArrowUpRight, Copy, Check,
  CircleDot, Zap, Shield, Menu,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Portfolio — AXIS" },
      { name: "description", content: "Your autonomous DeFi portfolio, running across every chain." },
      { property: "og:title", content: "Portfolio — AXIS" },
      { property: "og:description", content: "Your agent's live positions and yield." },
    ],
  }),
  component: Dashboard,
});

const CHAINS = [
  { name: "Arbitrum", alloc: 4820, apy: "12.4%", positions: 3 },
  { name: "Base", alloc: 3910, apy: "9.8%", positions: 2 },
  { name: "Optimism", alloc: 3753, apy: "14.1%", positions: 2 },
];

const FEED = [
  { t: "2m", msg: "Rebalanced Arbitrum position: +$41 realized" },
  { t: "18m", msg: "Detected higher basis on Base. Rotated 12% of stables." },
  { t: "1h", msg: "Received 320 USDC deposit via SRA from Ethereum mainnet." },
  { t: "3h", msg: "Weekly report queued. Est. +$23.14 net yield." },
  { t: "6h", msg: "Closed Vol Harvest tranche after IV spike. Booked $8.90." },
];

const TX = [
  { chain: "ARB", act: "Deposit stETH → Loop", amt: "+$500.00" },
  { chain: "BASE", act: "Swap USDC → USDbC", amt: "$1,200" },
  { chain: "OP", act: "Claim rewards", amt: "+$4.11" },
  { chain: "ARB", act: "Compound LP", amt: "+$12.44" },
];

const SRA = "0x7a3f9c4bE0Fa27a3Ba91cC48DdEf9c14e70b8dC91";

function Sparkline() {
  const pts = [8, 12, 10, 16, 18, 14, 22, 24, 20, 28, 32, 30, 36, 40];
  const max = Math.max(...pts);
  const w = 400, h = 100;
  const d = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      <path d={d} stroke="currentColor" strokeWidth="2" fill="none" />
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="currentColor" opacity="0.15" />
    </svg>
  );
}

function Dashboard() {
  const [copied, setCopied] = useState(false);
  const [budget, setBudget] = useState(500);

  const copy = () => {
    navigator.clipboard.writeText(SRA).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-black text-white font-tight">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between px-4 lg:px-8 h-16">
          <Link to="/" className="flex items-center gap-3">
            <Logo width={80} />
            <span className="text-[10px] uppercase tracking-widest text-white/40 hidden sm:inline">/ Portfolio v1</span>
          </Link>
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="hidden sm:flex items-center gap-2 border border-white/20 rounded-full px-3 py-1.5 text-xs uppercase tracking-widest">
              <Wallet size={14} strokeWidth={2} />
              0x7a3f…dC91
            </div>
            <button aria-label="Menu"><Menu size={22} strokeWidth={2} /></button>
          </div>
        </div>
      </div>

      <div className="pt-24 lg:pt-32 px-4 lg:px-8 pb-40 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        {/* Left rail */}
        <nav className="hidden lg:flex flex-col gap-1 sticky top-24 self-start">
          {[
            { k: "01", t: "Overview", active: true },
            { k: "02", t: "Positions" },
            { k: "03", t: "Activity" },
            { k: "04", t: "Agent Log" },
            { k: "05", t: "Settings" },
          ].map(({ k, t, active }) => (
            <div
              key={k}
              className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm uppercase tracking-widest cursor-pointer transition-colors ${
                active ? "bg-white text-black" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-[10px] opacity-60">{k}</span>
              {t}
            </div>
          ))}
        </nav>

        {/* Main */}
        <div className="space-y-6">
          {/* Hero stat */}
          <div className="border border-white/10 p-6 lg:p-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-white/50">Total balance</span>
              <span className="inline-flex items-center gap-1 text-[color:var(--color-lime)] text-sm">
                <TrendingUp size={16} strokeWidth={2} /> +$23.14 (7d)
              </span>
            </div>
            <div className="text-[64px] lg:text-[110px] leading-none tracking-[-0.05em]">$12,483.22</div>
            <div className="mt-6 h-24 text-[color:var(--color-lime)]">
              <Sparkline />
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CHAINS.map((c) => (
              <div key={c.name} className="border border-white/10 p-6 flex flex-col justify-between min-h-[180px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-white/50">{c.name}</span>
                  <CircleDot size={16} strokeWidth={2} className="text-[color:var(--color-lime)]" />
                </div>
                <div>
                  <div className="text-4xl tracking-[-0.04em]">${c.alloc.toLocaleString()}</div>
                  <div className="mt-2 flex justify-between text-xs uppercase text-white/50 tracking-widest">
                    <span>{c.positions} positions</span>
                    <span>APY {c.apy}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Agent feed */}
            <div className="border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-widest text-white/50 inline-flex items-center gap-2">
                  <Sparkles size={14} strokeWidth={2} /> Agent log
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-lime)]">Live</span>
              </div>
              <ul className="space-y-3">
                {FEED.map((f, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="text-white/40 w-10 shrink-0">{f.t}</span>
                    <span className="text-white/90">{f.msg}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* SRA */}
            <div className="border border-white/10 p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/50 mb-2 inline-flex items-center gap-2">
                  <Zap size={14} strokeWidth={2} /> Deposit address
                </div>
                <div className="text-xs text-white/60">
                  Send any token from any chain. AXIS receives cross-chain automatically.
                </div>
              </div>
              <div className="mt-6 bg-white/5 border border-white/10 rounded-md p-4 flex items-center justify-between gap-3">
                <code className="text-xs lg:text-sm break-all">{SRA}</code>
                <button
                  onClick={copy}
                  className="shrink-0 bg-white text-black rounded-full p-2"
                  aria-label="Copy"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div className="mt-4 flex gap-2 text-[10px] uppercase tracking-widest text-white/50">
                <span className="border border-white/20 px-2 py-1">Arbitrum</span>
                <span className="border border-white/20 px-2 py-1">Base</span>
                <span className="border border-white/20 px-2 py-1">Optimism</span>
                <span className="border border-white/20 px-2 py-1">Ethereum</span>
              </div>
            </div>
          </div>

          {/* Budget setter */}
          <div className="border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-white/50 inline-flex items-center gap-2">
                <Shield size={14} strokeWidth={2} /> Weekly budget
              </span>
              <span className="text-2xl tracking-[-0.04em]">${budget}</span>
            </div>
            <input
              type="range"
              min={100}
              max={5000}
              step={50}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-[color:var(--color-lime)]"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {["Preserve capital", "Steady yield", "Growth", "Aggressive"].map((g, i) => (
                <button
                  key={g}
                  className={`px-4 py-2 text-xs uppercase tracking-widest rounded-full border ${
                    i === 1 ? "bg-white text-black border-white" : "border-white/20 text-white/70"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Recent tx */}
          <div className="border border-white/10">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <span className="text-xs uppercase tracking-widest text-white/50">Recent activity</span>
              <Link to="/vault" className="text-xs uppercase tracking-widest inline-flex items-center gap-1">
                View all <ArrowUpRight size={14} strokeWidth={2} />
              </Link>
            </div>
            <ul>
              {TX.map((t, i) => (
                <li key={i} className="flex items-center justify-between px-6 py-4 border-b border-white/10 last:border-b-0">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] uppercase tracking-widest border border-white/20 px-2 py-1">{t.chain}</span>
                    <span className="text-sm">{t.act}</span>
                  </div>
                  <span className="text-sm tracking-[-0.02em]">{t.amt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <FixedFooter />
    </div>
  );
}
