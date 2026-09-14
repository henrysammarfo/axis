import { createFileRoute, Link } from "@tanstack/react-router";
import { FixedLogo, FixedNav, FixedFooter } from "../components/brand/FixedChrome";
import { ArrowUpRight } from "lucide-react";
import { brandHeadMeta } from "../lib/seo";

export const Route = createFileRoute("/manifesto")({
  head: () =>
    brandHeadMeta({
      title: "Manifesto — AXIS",
      description: "Why we built an agent that thinks in chains and speaks in outcomes.",
      path: "/manifesto",
    }),
  component: ManifestoPage,
});

const LINES = [
  "01 — Crypto lost the plot.",
  "02 — Twelve tabs. Three wallets. Two bridges. Zero yield.",
  "03 — We rebuilt the top of the stack.",
  "04 — Sign in with Google. AXIS becomes your account.",
  "05 — EIP-7702 upgrades your address in place. No migration.",
  "06 — After login you never sign a transaction again.",
  "07 — You set a budget. You set a goal. AXIS executes on Arbitrum.",
  "08 — Next: real US stock tokens under the same experience.",
  "09 — Set. Forget. Earn.",
];

function ManifestoPage() {
  return (
    <div className="min-h-screen bg-black text-white font-tight relative overflow-x-hidden">
      <FixedLogo />
      <FixedNav />

      <div className="px-4 lg:px-12 pt-[160px] sm:pt-[220px] lg:pt-[280px] pb-[160px] sm:pb-[200px] max-w-[1400px]">
        <div className="flex items-center gap-3 text-white/50 text-[10px] sm:text-xs uppercase tracking-[0.2em] mb-10 sm:mb-16">
          <ArrowUpRight size={14} strokeWidth={1.75} /> Manifesto / 2026
        </div>
        <div className="space-y-6 sm:space-y-10">
          {LINES.map((line, i) => (
            <p
              key={i}
              className="text-[28px] sm:text-[52px] lg:text-[84px] leading-[0.95] tracking-[-0.04em]"
            >
              {line}
            </p>
          ))}
        </div>
        <Link
          to="/dashboard"
          className="mt-16 sm:mt-24 inline-flex items-center gap-3 bg-white text-black px-6 sm:px-8 py-4 sm:py-5 rounded-full text-sm sm:text-lg uppercase tracking-widest"
        >
          Open dashboard <ArrowUpRight size={18} strokeWidth={1.75} />
        </Link>
      </div>

      <FixedFooter />
    </div>
  );
}
