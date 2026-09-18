import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { axisApi } from "../../lib/api";

export function PackagesPanel() {
  const q = useQuery({
    queryKey: ["axis", "packages"],
    queryFn: () => axisApi.basket.packages(),
  });
  const data = q.data;

  return (
    <div className="border border-white/10 p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Package size={18} className="mt-0.5 text-[color:var(--color-lime)] shrink-0" />
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50">Layer 6 · Packages</div>
          <h3 className="text-lg tracking-[-0.03em]">
            {data?.title ?? "Package market (preview)"}
          </h3>
          <p className="text-sm text-white/55 pt-1 leading-relaxed">
            {data?.honesty ?? "Catalog only — no checkout today."}
          </p>
        </div>
      </div>

      {q.isLoading && <p className="text-sm text-white/40">Loading packages…</p>}

      {data && (
        <>
          <ul className="space-y-3">
            {data.packages.map((p) => (
              <li
                key={p.id}
                className="border border-white/10 rounded-2xl px-3 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm tracking-[-0.02em]">{p.name}</div>
                  <p className="text-xs text-white/50 pt-1 leading-relaxed">{p.summary}</p>
                </div>
                <div className="text-right shrink-0 text-[10px] uppercase tracking-widest text-white/40">
                  <div>
                    {p.price_usdc_mo === 0 ? "included" : `$${p.price_usdc_mo}/mo`}
                  </div>
                  <div className="pt-1">{p.status}</div>
                </div>
              </li>
            ))}
          </ul>
          <ul className="space-y-1 text-[11px] text-white/40">
            {data.revenue_thesis.map((t) => (
              <li key={t}>· {t}</li>
            ))}
          </ul>
          <p className="text-xs text-white/50">{data.cta}</p>
        </>
      )}
    </div>
  );
}
