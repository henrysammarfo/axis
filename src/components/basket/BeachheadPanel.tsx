import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Globe2, ListOrdered } from "lucide-react";
import { axisApi } from "../../lib/api";

export function BeachheadPanel({
  userId,
  email: initialEmail = "",
}: {
  userId?: string;
  email?: string;
}) {
  const [region, setRegion] = useState("prefer_not");
  const [email, setEmail] = useState(initialEmail);
  const [note, setNote] = useState<string | null>(null);

  const pack = useQuery({
    queryKey: ["axis", "beachhead", region],
    queryFn: () => axisApi.basket.beachhead(region),
  });

  const join = useMutation({
    mutationFn: () =>
      axisApi.basket.waitlist({
        email,
        region,
        user_id: userId,
        intent: "stock_path",
      }),
    onSuccess: (data) => {
      setNote(`${data.status} · ${data.geo.gtm_message}`);
    },
    onError: (err: Error) => setNote(err.message || "Waitlist failed"),
  });

  const data = pack.data;
  const geo = data?.geo;

  return (
    <div className="border border-white/10 p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Globe2 size={18} className="mt-0.5 text-[color:var(--color-lime)] shrink-0" />
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50">Layer 5 · Beachhead</div>
          <h3 className="text-lg tracking-[-0.03em]">EU / APAC · geo honesty · waitlist</h3>
          <p className="text-sm text-white/55 pt-1 leading-relaxed">
            {data?.wedge ??
              "Distribution UX for crypto-native EU/APAC — not issuance, not MetaMask."}
          </p>
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-[10px] uppercase tracking-widest text-white/40">
          Where are you building from? (self-attestation)
        </span>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full bg-white/5 border border-white/15 rounded-full px-4 py-3 text-sm outline-none"
        >
          {(data?.regions ?? [{ id: "prefer_not", label: "Prefer not to say" }]).map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      {geo && (
        <div className="space-y-2 text-sm text-white/60 leading-relaxed">
          <p>{geo.gtm_message}</p>
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">
            <span
              className={`border px-3 py-1.5 rounded-full ${
                geo.beachhead
                  ? "border-[color:var(--color-lime)] text-[color:var(--color-lime)]"
                  : "border-white/20 text-white/50"
              }`}
            >
              beachhead · {geo.beachhead ? "yes" : "no"}
            </span>
            <span className="border border-white/20 px-3 py-1.5 rounded-full text-white/50">
              RH testnet demo · on
            </span>
          </div>
          <p className="text-[11px] text-white/40">{geo.issuer_hints.honesty}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full bg-white/5 border border-white/15 rounded-full px-4 py-3 text-sm outline-none"
        />
        <button
          type="button"
          disabled={join.isPending || !email.trim()}
          onClick={() => join.mutate()}
          className="bg-white text-black rounded-full px-6 py-3 text-xs uppercase tracking-widest disabled:opacity-50"
        >
          {join.isPending ? "Joining…" : "Join stock waitlist"}
        </button>
      </div>
      {note && <p className="text-sm text-[color:var(--color-lime)] leading-relaxed">{note}</p>}

      {data?.demo_script && (
        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40">
            <ListOrdered size={12} />
            {data.demo_script.title} · ~{data.demo_script.duration_min}m
          </div>
          <ol className="space-y-2 text-xs text-white/55">
            {data.demo_script.steps.map((s) => (
              <li key={s.n} className="leading-relaxed">
                <span className="text-white/80">
                  {s.n}. {s.title}
                </span>{" "}
                — {s.say}
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-white/40">{data.geo_law}</p>
        </div>
      )}
    </div>
  );
}
