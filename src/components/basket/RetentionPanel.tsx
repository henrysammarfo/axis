import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, RefreshCw } from "lucide-react";
import { axisApi, type RetentionStatus } from "../../lib/api";

export function RetentionPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [cadence, setCadence] = useState<"weekly" | "biweekly">("weekly");
  const [mode, setMode] = useState<"report_only" | "suggest">("report_only");
  const [fragWarn, setFragWarn] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["axis", "retention", userId],
    queryFn: () => axisApi.basket.retention(userId),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    const p = q.data?.policy;
    if (!p) return;
    if (p.cadence === "weekly" || p.cadence === "biweekly") setCadence(p.cadence);
    if (p.rebalance_mode === "report_only" || p.rebalance_mode === "suggest") {
      setMode(p.rebalance_mode);
    }
    setFragWarn(Boolean(p.include_fragmentation_warnings));
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      axisApi.basket.saveRetention(userId, {
        cadence,
        rebalance_mode: mode,
        include_fragmentation_warnings: fragWarn,
        include_arb_yield: true,
        include_stock_legs: true,
      }),
    onSuccess: (data: RetentionStatus) => {
      setNote(`Saved · next due ${new Date(data.next_due).toUTCString()}`);
      qc.invalidateQueries({ queryKey: ["axis", "retention", userId] });
      qc.invalidateQueries({ queryKey: ["axis", "basket", userId] });
      qc.invalidateQueries({ queryKey: ["axis", "report", userId] });
    },
    onError: (err: Error) => setNote(err.message || "Save failed"),
  });

  const data = q.data;
  const loop = data?.loop;

  return (
    <div className="border border-white/10 p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <CalendarClock size={18} className="mt-0.5 text-[color:var(--color-lime)] shrink-0" />
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50">Retention agent</div>
          <h3 className="text-lg tracking-[-0.03em]">Attract once · retain weekly</h3>
          <p className="text-sm text-white/55 pt-1 leading-relaxed">
            English report + policy. Stock fills stay fail-closed — never silent RH execution.
          </p>
        </div>
      </div>

      {q.isLoading && <p className="text-sm text-white/40">Loading policy…</p>}

      {data && (
        <div className="grid gap-3 sm:grid-cols-3 text-xs text-white/55">
          <div className="border border-white/10 rounded-2xl px-3 py-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Next due</div>
            <div className="text-white pt-1">{new Date(data.next_due).toUTCString()}</div>
          </div>
          <div className="border border-white/10 rounded-2xl px-3 py-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Hold loop</div>
            <div className="text-white pt-1">{loop?.hold_status ?? "none"}</div>
          </div>
          <div className="border border-white/10 rounded-2xl px-3 py-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Retain ready</div>
            <div className="text-white pt-1">{loop?.retain_ready ? "yes" : "need basket + plan/hold"}</div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-[10px] uppercase tracking-widest text-white/40">Cadence</span>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as "weekly" | "biweekly")}
            className="w-full bg-white/5 border border-white/15 rounded-full px-4 py-3 text-sm outline-none"
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-[10px] uppercase tracking-widest text-white/40">
            Rebalance mode
          </span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "report_only" | "suggest")}
            className="w-full bg-white/5 border border-white/15 rounded-full px-4 py-3 text-sm outline-none"
          >
            <option value="report_only">Report only</option>
            <option value="suggest">Suggest (no auto-fill)</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-3 text-sm text-white/60">
        <input
          type="checkbox"
          checked={fragWarn}
          onChange={(e) => setFragWarn(e.target.checked)}
          className="rounded border-white/30"
        />
        Include fragmentation warnings in English reports
      </label>

      <button
        type="button"
        disabled={save.isPending}
        onClick={() => save.mutate()}
        className="inline-flex items-center gap-2 bg-white text-black rounded-full px-6 py-3 text-xs uppercase tracking-widest disabled:opacity-50"
      >
        <RefreshCw size={14} />
        {save.isPending ? "Saving…" : "Save retention policy"}
      </button>

      {note && <p className="text-sm text-[color:var(--color-lime)]">{note}</p>}

      {data?.actions_this_cycle && (
        <ul className="space-y-1 text-xs text-white/50">
          {data.actions_this_cycle.map((a) => (
            <li key={a}>· {a}</li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-white/40 leading-relaxed">
        {data?.honesty ??
          "Retention is English reporting + policy suggestions. Stock fills stay fail-closed."}
      </p>
    </div>
  );
}
