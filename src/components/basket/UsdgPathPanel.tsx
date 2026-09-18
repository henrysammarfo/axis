import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Link2 } from "lucide-react";
import { axisApi } from "../../lib/api";

export function UsdgPathPanel() {
  const q = useQuery({
    queryKey: ["axis", "usdg-path"],
    queryFn: () => axisApi.basket.usdg(),
  });

  const data = q.data;

  return (
    <div className="border border-white/10 p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Link2 size={18} className="mt-0.5 text-[color:var(--color-lime)] shrink-0" />
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50">Layer 4 · USDG</div>
          <h3 className="text-lg tracking-[-0.03em]">
            {data?.title ?? "USDG · Arb ↔ RH labeled path"}
          </h3>
          <p className="text-sm text-white/55 pt-1 leading-relaxed">
            {data?.honesty ??
              "Paxos-verified USDG contracts. AXIS labels the path — does not auto-bridge."}
          </p>
        </div>
      </div>

      {q.isLoading && <p className="text-sm text-white/40">Loading USDG path…</p>}
      {q.isError && <p className="text-sm text-red-300">Could not load USDG path.</p>}

      {data && (
        <>
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">
            <span className="border border-white/20 px-3 py-1.5 rounded-full text-white/60">
              status · {data.status}
            </span>
            <span
              className={`border px-3 py-1.5 rounded-full ${
                data.axis_executes
                  ? "border-[color:var(--color-lime)] text-[color:var(--color-lime)]"
                  : "border-amber-400/40 text-amber-200/90"
              }`}
            >
              AXIS executes · {data.axis_executes ? "yes" : "no"}
            </span>
          </div>

          <ol className="space-y-2">
            {data.path_steps.map((s) => (
              <li
                key={s.step}
                className="flex gap-3 border border-white/10 rounded-2xl px-3 py-3 text-sm"
              >
                <span className="text-[color:var(--color-lime)] shrink-0">{s.step}</span>
                <div className="min-w-0">
                  <div className="tracking-[-0.02em]">
                    {s.title}
                    <span className="text-[10px] uppercase tracking-widest text-white/40 ml-2">
                      {s.executable_today ? "live today" : "labeled only"}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 pt-1 leading-relaxed">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <ul className="space-y-3">
            {data.legs
              .filter((leg) => leg.asset === "USDG" || leg.id === "usdg-lz-oft")
              .map((leg) => (
                <li key={leg.id} className="border border-white/10 rounded-2xl px-3 py-3 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm tracking-[-0.02em]">{leg.label}</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">
                      {leg.status}
                    </div>
                  </div>
                  {leg.address && (
                    <div className="text-[11px] text-white/45 break-all">{leg.address}</div>
                  )}
                  <p className="text-xs text-white/50 leading-relaxed">{leg.notes}</p>
                  {leg.explorer_url && (
                    <a
                      href={leg.explorer_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-white underline"
                    >
                      Explorer <ExternalLink size={11} />
                    </a>
                  )}
                </li>
              ))}
          </ul>

          <ul className="space-y-1 text-xs text-amber-200/80">
            {data.refuse.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>

          <a
            href={data.source}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-white/50 underline"
          >
            Paxos USDG docs <ExternalLink size={11} />
          </a>
          <p className="text-[11px] text-white/40 leading-relaxed">{data.hackquest_note}</p>
        </>
      )}
    </div>
  );
}
