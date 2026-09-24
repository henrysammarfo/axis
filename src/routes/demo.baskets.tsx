import { createFileRoute, Link } from "@tanstack/react-router";
import { BeachheadPanel } from "../components/basket/BeachheadPanel";
import { FragmentationDesk } from "../components/basket/FragmentationDesk";
import { PackagesPanel } from "../components/basket/PackagesPanel";
import { UsdgPathPanel } from "../components/basket/UsdgPathPanel";
import { brandHeadMeta } from "../lib/seo";

export const Route = createFileRoute("/demo/baskets")({
  head: () =>
    brandHeadMeta({
      title: "Baskets demo — AXIS",
      description: "Open House depth layers: truth, fragmentation, USDG, beachhead, packages.",
      path: "/demo/baskets",
    }),
  component: DemoBaskets,
});

/** Public capture surface for OH screenshots / recording — no Google login. */
function DemoBaskets() {
  return (
    <div className="min-h-screen bg-black text-white font-tight px-6 py-12 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <Link to="/" className="text-xs uppercase tracking-widest text-white/40 hover:text-white">
          ← AXIS
        </Link>
        <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-lime)]">
          Demo · no login · Open House depth
        </div>
      </div>

      <h1 className="mt-8 text-4xl sm:text-5xl tracking-[-0.04em]">Baskets</h1>
      <p className="mt-3 text-white/55 text-sm max-w-2xl leading-relaxed">
        Instrument truth · fragmentation desk · retention · USDG path · EU/APAC beachhead ·
        package catalog. Fail-closed — plan ≠ fill.
      </p>

      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <FragmentationDesk symbols={["TSLA", "AMZN", "AMD", "NFLX", "PLTR"]} />
        <UsdgPathPanel />
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <BeachheadPanel />
        <PackagesPanel />
      </div>
    </div>
  );
}
