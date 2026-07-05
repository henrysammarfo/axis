import { createFileRoute, Link } from "@tanstack/react-router";
import { FixedLogo, FixedNav, FixedFooter } from "../components/brand/FixedChrome";
import { ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/manifesto")({
  head: () => ({
    meta: [
      { title: "Manifesto — AXIS" },
      { name: "description", content: "The AXIS manifesto: autonomous DeFi, invisible infrastructure, human-first UX." },
      { property: "og:title", content: "Manifesto — AXIS" },
      { property: "og:description", content: "Why we built an agent that thinks in chains and speaks in outcomes." },
    ],
  }),
  component: ManifestoPage,
});

const LINES = [
  "01 — Crypto lost the plot.",
  "02 — Twelve tabs. Three wallets. Two bridges. Zero yield.",
  "03 — We rebuilt the top of the stack.",
  "04 — Sign in with Google. AXIS becomes your account.",
  "05 — EIP-7702 upgrades your address in place. No migration.",
  "06 — The agent operates every chain as one balance.",
  "07 — You set a budget. You set a goal. AXIS executes.",
  "08 — Weekly report: this many dollars became this many more.",
  "09 — Set. Forget. Earn.",
];

function ManifestoPage() {
  return (
    <div className="min-h-screen bg-black text-white font-tight relative overflow-hidden">
      <FixedLogo />
      <FixedNav />

      <div className="px-4 lg:px-12 pt-[220px] lg:pt-[280px] pb-[200px] max-w-[1400px]">
        <div className="text-white/50 text-xs uppercase tracking-[0.2em] mb-16">Manifesto / 2026</div>
        <div className="space-y-10">
          {LINES.map((line, i) => (
            <p
              key={i}
              className="text-[36px] sm:text-[56px] lg:text-[84px] leading-[0.95] tracking-[-0.04em]"
            >
              {line}
            </p>
          ))}
        </div>
        <Link
          to="/dashboard"
          className="mt-24 inline-flex items-center gap-3 bg-white text-black px-8 py-5 rounded-full text-lg uppercase tracking-widest"
        >
          Open dashboard <ArrowUpRight size={20} strokeWidth={2} />
        </Link>
      </div>

      <FixedFooter />
    </div>
  );
}
