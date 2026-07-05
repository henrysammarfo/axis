import { createFileRoute } from "@tanstack/react-router";
import { FixedLogo, FixedNav, FixedFooter } from "../components/brand/FixedChrome";
import { Logo } from "../components/brand/Logo";
import { ScatteredGrid } from "../components/scroll/ScatteredGrid";

export const Route = createFileRoute("/merch")({
  head: () => ({
    meta: [
      { title: "Merch — AXIS Archive" },
      { name: "description", content: "Hoodies, tees, and prints from the AXIS archive." },
      { property: "og:title", content: "Merch — AXIS Archive" },
      { property: "og:description", content: "Wear the agent." },
    ],
  }),
  component: MerchPage,
});

const ITEMS = [
  { name: "AXIS Wordmark Hoodie", price: "$110", color: "bg-black text-white", accent: "text-white" },
  { name: "AXIS Wordmark Hoodie", price: "$110", color: "bg-white text-black", accent: "text-black" },
  { name: "Set. Forget. Earn. Tee", price: "$45", color: "bg-black text-white", accent: "text-[color:var(--color-lime)]" },
  { name: "Circled R Cap", price: "$40", color: "bg-white text-black", accent: "text-black" },
  { name: "Archive Zip", price: "$140", color: "bg-black text-white", accent: "text-white" },
  { name: "Yield Tee", price: "$45", color: "bg-[color:var(--color-lime)] text-black", accent: "text-black" },
  { name: "Agent Longsleeve", price: "$70", color: "bg-black text-white", accent: "text-white" },
  { name: "Print — v1", price: "$25", color: "bg-white text-black", accent: "text-black" },
];

function MerchPage() {
  return (
    <div className="min-h-screen bg-black text-white font-tight">
      <FixedLogo />
      <FixedNav />
      <div className="pt-[200px] lg:pt-[240px] px-4 lg:px-12">
        <div className="text-white/50 text-xs uppercase tracking-[0.2em] mb-8">Merch / 2026</div>
        <h1 className="text-[56px] sm:text-[96px] lg:text-[160px] leading-[0.9] tracking-[-0.05em]">
          Wear<br />the agent.
        </h1>
      </div>

      <div className="mt-32 pb-[200px]">
        <ScatteredGrid
          items={ITEMS.length}
          render={(i) => {
            const item = ITEMS[i];
            return (
              <div className={`w-full h-full ${item.color} flex flex-col justify-between p-6 lg:p-8 relative overflow-hidden`}>
                <div className="flex items-start justify-between">
                  <span className="text-[10px] uppercase tracking-widest opacity-60">
                    {String(i + 1).padStart(2, "0")} / Archive
                  </span>
                  <span className="text-[10px] uppercase tracking-widest opacity-60">{item.price}</span>
                </div>
                <div className={`flex-1 flex items-center justify-center ${item.accent}`}>
                  <Logo className="w-[60%]" />
                </div>
                <div className="text-sm uppercase tracking-[-0.02em]">{item.name}</div>
              </div>
            );
          }}
        />
      </div>

      <FixedFooter />
    </div>
  );
}
