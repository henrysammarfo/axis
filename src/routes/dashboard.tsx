import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { FixedFooter } from "../components/brand/FixedChrome";
import { MobileMenu } from "../components/brand/MobileMenu";
import { Logo } from "../components/brand/Logo";
import {
  Wallet, Sparkles, TrendingUp, ArrowUpRight, Copy, Check,
  CircleDot, Zap, Shield, Menu, Filter, Package, Bot, Layers,
  ChevronRight, Activity, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { VAULTS, AGENT_FEED, ORDERS, MERCH, summary, type Chain } from "../lib/brandData";

const tabSchema = z.enum(["overview", "vaults", "agent", "orders", "merch"]);
const chainSchema = z.enum(["All", "Arbitrum", "Base", "Optimism", "Ethereum"]);
const dashSearch = z.object({
  tab: fallback(tabSchema, "overview").default("overview"),
  chain: fallback(chainSchema, "All").default("All"),
});

export const Route = createFileRoute("/dashboard")({
  validateSearch: zodValidator(dashSearch),
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

const SRA = "0x7a3f9c4bE0Fa27a3Ba91cC48DdEf9c14e70b8dC91";
const ICON = { size: 16, strokeWidth: 1.75 } as const;
const CHAINS: (Chain | "All")[] = ["All", "Arbitrum", "Base", "Optimism", "Ethereum"];

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
  const { tab, chain } = Route.useSearch();
  const navigate = useNavigate({ from: "/dashboard" });
  const [copied, setCopied] = useState(false);
  const [budget, setBudget] = useState(500);
  const [menuOpen, setMenuOpen] = useState(false);

  const setTab = (t: Tab) =>
    navigate({ search: (p: { tab: Tab; chain: Chain | "All" }) => ({ ...p, tab: t }), replace: true });
  const setChain = (c: Chain | "All") =>
    navigate({ search: (p: { tab: Tab; chain: Chain | "All" }) => ({ ...p, chain: c }), replace: true });

  const s = useMemo(() => summary(), []);
  const filteredVaults = useMemo(
    () => (chain === "All" ? VAULTS : VAULTS.filter((v) => v.chain === chain)),
    [chain],
  );
  const filteredOrders = useMemo(
    () => (chain === "All" ? ORDERS : ORDERS.filter((o) => o.chain === chain)),
    [chain],
  );

  const copy = () => {
    navigator.clipboard.writeText(SRA).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-black text-white font-tight pb-20 lg:pb-0">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-black/85 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between px-4 lg:px-8 h-16">
          <Link to="/" className="flex items-center gap-3 min-w-0" aria-label="AXIS home">
            <Logo width={72} />
            <span className="text-[10px] uppercase tracking-widest text-white/40 hidden sm:inline shrink-0">/ Portfolio v1</span>
          </Link>
          <div className="flex items-center gap-2 lg:gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-2 border border-white/20 rounded-full px-3 py-1.5 text-[10px] lg:text-xs uppercase tracking-widest">
              <Wallet {...ICON} />
              0x7a3f…dC91
            </div>
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
                tab === id ? "bg-white text-black" : "text-white/60 hover:text-white hover:bg-white/5"
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
            <StatCell label="Deployed" value={`$${s.totalAllocated.toLocaleString()}`} icon={Wallet} />
            <StatCell label="Weighted APY" value={`${s.weightedApy.toFixed(1)}%`} icon={TrendingUp} accent />
            <StatCell label="Active vaults" value={`${s.active}/${s.total}`} icon={Shield} />
            <StatCell label="Orders" value={`${s.filled} ✓ · ${s.pending} …`} icon={Activity} />
          </div>

          {tab === "overview" && (
            <>
              {/* Hero balance */}
              <div className="border border-white/10 p-6 lg:p-10">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 mb-4">
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50 truncate">Total balance</span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[color:var(--color-lime)] text-xs sm:text-sm">
                    <TrendingUp {...ICON} /> +$23.14 (7d)
                  </span>
                </div>
                <div className="text-[44px] sm:text-[64px] lg:text-[110px] leading-none tracking-[-0.05em]">$12,483.22</div>
                <div className="mt-6 h-20 sm:h-24 text-[color:var(--color-lime)]">
                  <Sparkline />
                </div>
              </div>

              {/* Chain allocation summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                {(["Arbitrum", "Base", "Optimism"] as Chain[]).map((c) => {
                  const rows = VAULTS.filter((v) => v.chain === c);
                  const alloc = rows.reduce((a, v) => a + v.allocated, 0);
                  const wapy = alloc > 0 ? rows.reduce((a, v) => a + v.apy * v.allocated, 0) / alloc : 0;
                  return (
                    <div key={c} className="border border-white/10 p-5 sm:p-6 flex flex-col justify-between min-h-[160px]">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <span className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50 truncate">{c}</span>
                        <CircleDot size={14} strokeWidth={1.75} className="text-[color:var(--color-lime)] shrink-0" />
                      </div>
                      <div>
                        <div className="text-3xl sm:text-4xl tracking-[-0.04em]">${alloc.toLocaleString()}</div>
                        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[10px] sm:text-xs uppercase text-white/50 tracking-widest">
                          <span className="truncate">{rows.length} positions</span>
                          <span className="shrink-0">APY {wapy.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                    {AGENT_FEED.slice(0, 5).map((f) => (
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
                      <Zap size={13} strokeWidth={1.75} /> Deposit address
                    </div>
                    <div className="text-xs text-white/60">
                      Send any token from any chain. AXIS receives cross-chain automatically.
                    </div>
                  </div>
                  <div className="mt-5 bg-white/5 border border-white/10 rounded-md p-3 sm:p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <code className="text-[10px] sm:text-xs lg:text-sm break-all min-w-0">{SRA}</code>
                    <button
                      onClick={copy}
                      className="shrink-0 bg-white text-black rounded-full p-2"
                      aria-label="Copy"
                    >
                      {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50">
                    {(["Arbitrum", "Base", "Optimism", "Ethereum"] as Chain[]).map((c) => (
                      <span key={c} className="border border-white/20 px-2 py-1">{c}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Budget setter */}
              <div className="border border-white/10 p-5 sm:p-6">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4">
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-white/50 inline-flex items-center gap-2 truncate">
                    <Shield size={13} strokeWidth={1.75} /> Weekly budget
                  </span>
                  <span className="text-xl sm:text-2xl tracking-[-0.04em] shrink-0">${budget}</span>
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
                      className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs uppercase tracking-widest rounded-full border ${
                        i === 1 ? "bg-white text-black border-white" : "border-white/20 text-white/70"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "vaults" && (
            <div className="space-y-4">
              <FilterBar chain={chain} setChain={setChain} count={filteredVaults.length} label="vaults" />
              <div className="border border-white/10">
                {filteredVaults.map((v) => (
                  <div key={v.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 sm:gap-4 items-center px-4 sm:px-6 py-4 border-b border-white/10 last:border-b-0">
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base uppercase tracking-[-0.03em] truncate">{v.name}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[9px] sm:text-[10px] uppercase text-white/50 tracking-widest">
                        <span className="border border-white/20 px-2 py-0.5">{v.chain}</span>
                        <span className="border border-white/20 px-2 py-0.5">{v.risk}</span>
                      </div>
                    </div>
                    <div className="hidden sm:block text-xs uppercase tracking-widest text-white/60">
                      TVL ${(v.tvl / 1_000_000).toFixed(2)}M
                    </div>
                    <div className="hidden sm:block text-xs uppercase tracking-widest text-white/60">
                      Alloc ${v.allocated.toLocaleString()}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl sm:text-3xl tracking-[-0.04em] text-[color:var(--color-lime)]">{v.apy}%</div>
                      <div className="text-[9px] uppercase tracking-widest text-white/50 mt-0.5">{v.status}</div>
                    </div>
                  </div>
                ))}
                {filteredVaults.length === 0 && (
                  <div className="p-10 text-center text-white/40 text-sm">No vaults on this chain.</div>
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
                <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-lime)] shrink-0">Live</span>
              </div>
              <ul>
                {AGENT_FEED.map((f) => (
                  <li key={f.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-3 px-4 sm:px-6 py-4 border-b border-white/10 last:border-b-0">
                    <span className="text-xs text-white/40">{f.time}</span>
                    <div className="min-w-0">
                      <div className="text-sm text-white/90 leading-snug">{f.message}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[9px] uppercase text-white/40 tracking-widest">
                        <span className="border border-white/15 px-2 py-0.5">{f.kind}</span>
                        {f.chain && <span className="border border-white/15 px-2 py-0.5">{f.chain}</span>}
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
              <FilterBar chain={chain} setChain={setChain} count={filteredOrders.length} label="orders" />
              <div className="border border-white/10">
                {filteredOrders.map((o) => {
                  const Ico =
                    o.status === "Filled" ? CheckCircle2 : o.status === "Pending" ? Activity : AlertTriangle;
                  const color =
                    o.status === "Filled"
                      ? "text-[color:var(--color-lime)]"
                      : o.status === "Pending"
                      ? "text-white/70"
                      : "text-red-400";
                  return (
                    <div key={o.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 border-b border-white/10 last:border-b-0">
                      <Ico size={16} strokeWidth={1.75} className={`${color} shrink-0`} />
                      <div className="min-w-0">
                        <div className="text-sm truncate">{o.action}</div>
                        <div className="mt-1 flex gap-2 text-[9px] uppercase text-white/40 tracking-widest">
                          <span className="border border-white/15 px-2 py-0.5">{o.chain}</span>
                          <span className="border border-white/15 px-2 py-0.5">{o.status}</span>
                        </div>
                      </div>
                      <span className="text-sm tracking-[-0.02em] shrink-0">${o.amount.toLocaleString()}</span>
                    </div>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <div className="p-10 text-center text-white/40 text-sm">No orders on this chain.</div>
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
              <div className="mt-4 text-sm text-white/60 max-w-[52ch]">
                Every deposit brings the first drop closer. Pieces will be reserved
                for holders and waitlist first — see the merch page to join.
              </div>
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {MERCH.slice(0, 6).map((m, i) => (
                  <div key={m.id} className="border border-white/10 p-4 min-h-[140px] flex flex-col justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-white/40">
                      {String(i + 1).padStart(2, "0")} / {m.drop}
                    </span>
                    <div>
                      <div className="text-sm uppercase tracking-[-0.03em] truncate">{m.name}</div>
                      <div className="text-[10px] uppercase tracking-widest text-white/50 mt-1">{m.status}</div>
                    </div>
                  </div>
                ))}
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
  label, value, icon: Icon, accent,
}: { label: string; value: string; icon: typeof Layers; accent?: boolean }) {
  return (
    <div className="bg-black p-4 sm:p-5 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50">
        <Icon size={12} strokeWidth={1.75} />
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-lg sm:text-2xl tracking-[-0.04em] truncate ${accent ? "text-[color:var(--color-lime)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function FilterBar({
  chain, setChain, count, label,
}: { chain: Chain | "All"; setChain: (c: Chain | "All") => void; count: number; label: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
      <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50">
        <Filter size={13} strokeWidth={1.75} /> Chain
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar min-w-0">
        {CHAINS.map((c) => (
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
      <div className="col-span-2 sm:ml-auto text-[10px] uppercase tracking-widest text-white/40">
        {count} {label}
      </div>
    </div>
  );
}
