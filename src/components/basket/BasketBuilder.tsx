import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Copy, ExternalLink, PieChart, Sparkles } from "lucide-react";
import { axisApi, type BasketPlan } from "../../lib/api";
import { CHAIN_LOGOS, stockLogo } from "../../lib/logos";

const PROMPTS = [
  "tech yes, oil no",
  "steady tech only",
  "bold growth tech",
  "AI and semiconductors",
];

const FAUCET = "https://faucet.testnet.chain.robinhood.com";

function statusLabel(status?: string) {
  switch (status) {
    case "held":
      return "Held (live)";
    case "partial":
      return "Partial hold";
    case "awaiting_faucet":
      return "Awaiting faucet";
    case "planned":
      return "Plan only";
    case "empty_plan":
      return "No plan";
    default:
      return status ?? "—";
  }
}

function CopyAddr({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="flex w-full items-start gap-2 text-left text-[11px] text-white/50 hover:text-white"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <span className="shrink-0 text-white/40">{label}</span>
      <span className="min-w-0 break-all flex-1">{value}</span>
      {copied ? (
        <Check size={12} className="shrink-0 text-[color:var(--color-lime)]" />
      ) : (
        <Copy size={12} className="shrink-0" />
      )}
    </button>
  );
}

export function BasketBuilder({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("tech yes, oil no");
  const [budget, setBudget] = useState(100);
  const [preview, setPreview] = useState<BasketPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [holdNote, setHoldNote] = useState<string | null>(null);

  const saved = useQuery({
    queryKey: ["axis", "basket", userId],
    queryFn: () => axisApi.basket.get(userId),
    enabled: Boolean(userId),
  });

  const network = useQuery({
    queryKey: ["axis", "basket-network"],
    queryFn: () => axisApi.basket.network(),
  });

  const rails = useQuery({
    queryKey: ["axis", "basket-rails"],
    queryFn: () => axisApi.basket.rails(),
  });

  const livePack = useQuery({
    queryKey: ["axis", "basket-holdings", userId],
    queryFn: () => axisApi.basket.holdings(userId),
    enabled: Boolean(userId),
    refetchInterval: 20_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["axis", "basket", userId] });
    qc.invalidateQueries({ queryKey: ["axis", "basket-holdings", userId] });
    qc.invalidateQueries({ queryKey: ["axis", "status", userId] });
    qc.invalidateQueries({ queryKey: ["axis", "report", userId] });
  };

  const previewMut = useMutation({
    mutationFn: () => axisApi.basket.preview(prompt, budget),
    onSuccess: (data) => {
      setPreview(data.plan);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const saveMut = useMutation({
    mutationFn: () => axisApi.basket.save(userId, prompt, budget),
    onSuccess: (data) => {
      setPreview(data.plan);
      setError(null);
      setHoldNote("Plan saved — not a fill. Activate hold for live RH evidence.");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const holdMut = useMutation({
    mutationFn: (mode: "auto" | "fund" | "sync") =>
      axisApi.basket.hold(userId, { mode }),
    onSuccess: (data) => {
      setError(null);
      const st = data.hold.status ?? "unknown";
      const n = data.hold.txs?.length ?? 0;
      const legs = data.hold.legs?.length ?? 0;
      if (st === "held" || st === "partial") {
        setHoldNote(
          `${statusLabel(st)} · ${n} tx · ${legs} synced legs. See /proof for explorer links.`,
        );
      } else {
        setHoldNote(
          `Fail-closed (${st}): claim faucet for agent and/or your UA, then try again.`,
        );
      }
      invalidate();
    },
    onError: (e: Error) => {
      setHoldNote(null);
      setError(e.message);
    },
  });

  const plan = preview ?? livePack.data?.plan ?? saved.data?.plan ?? null;
  const holds = livePack.data?.holds ?? saved.data?.holds ?? null;
  const live = livePack.data?.holdings;
  const readiness = livePack.data?.readiness;
  const agentAddr = readiness?.agent?.address ?? live?.agent_address;
  const ua = live?.address ?? saved.data?.ua_address;

  return (
    <div className="space-y-6">
      <div className="border border-[color:var(--color-lime)]/40 bg-[color:var(--color-lime)]/5 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[color:var(--color-lime)]">
          <PieChart size={14} strokeWidth={1.75} />
          Open House · Robinhood Chain
          {network.data?.testnet ? " · public testnet" : ""}
        </div>
        <h2 className="mt-3 text-2xl sm:text-3xl tracking-[-0.04em]">Stock basket</h2>
        <p className="mt-2 text-sm text-white/60 max-w-xl leading-relaxed">
          English → weights → live hold. Oil blocked. Plan is never sold as a fill — Activate hold
          only succeeds with real balances or broadcast txs.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-[10px] uppercase tracking-widest">
          <span className="border border-white/20 px-3 py-1.5 rounded-full text-white/70">
            Status · {statusLabel(holds?.status)}
          </span>
          {readiness?.can_fund && (
            <span className="border border-[color:var(--color-lime)]/40 px-3 py-1.5 rounded-full text-[color:var(--color-lime)]">
              Agent can fund dust
            </span>
          )}
          {readiness?.can_sync && (
            <span className="border border-[color:var(--color-lime)]/40 px-3 py-1.5 rounded-full text-[color:var(--color-lime)]">
              UA balances ready to sync
            </span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <label className="block text-[10px] uppercase tracking-widest text-white/40">
            Your vibe
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full bg-white/5 border border-white/15 rounded-2xl px-4 py-3 text-sm outline-none focus:border-white/40"
            placeholder='e.g. "tech yes, oil no"'
          />
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrompt(p)}
                className="text-[10px] uppercase tracking-widest border border-white/20 px-3 py-1.5 rounded-full hover:bg-white/5"
              >
                {p}
              </button>
            ))}
          </div>
          <label className="block text-[10px] uppercase tracking-widest text-white/40 pt-2">
            Notional (plan) $
          </label>
          <input
            type="number"
            min={10}
            max={100000}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value) || 0)}
            className="w-full bg-white/5 border border-white/15 rounded-full px-4 py-3 text-sm outline-none"
          />
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={previewMut.isPending || !prompt.trim()}
              onClick={() => previewMut.mutate()}
              className="bg-white text-black rounded-full px-6 py-3 text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {previewMut.isPending ? "Building…" : "Preview basket"}
            </button>
            <button
              type="button"
              disabled={saveMut.isPending || !prompt.trim()}
              onClick={() => saveMut.mutate()}
              className="border border-[color:var(--color-lime)] text-[color:var(--color-lime)] rounded-full px-6 py-3 text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {saveMut.isPending ? "Saving…" : "Save plan"}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={holdMut.isPending || !plan?.legs?.length}
              onClick={() => holdMut.mutate("auto")}
              className="bg-[color:var(--color-lime)] text-black rounded-full px-6 py-3 text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {holdMut.isPending ? "Activating…" : "Activate hold"}
            </button>
            <button
              type="button"
              disabled={holdMut.isPending || !plan?.legs?.length || !readiness?.can_sync}
              onClick={() => holdMut.mutate("sync")}
              className="border border-white/30 text-white rounded-full px-5 py-3 text-xs uppercase tracking-widest disabled:opacity-50"
              title="Record live UA balances as hold (no broadcast)"
            >
              Sync balances
            </button>
            <button
              type="button"
              disabled={holdMut.isPending || !plan?.legs?.length || !readiness?.can_fund}
              onClick={() => holdMut.mutate("fund")}
              className="border border-white/30 text-white rounded-full px-5 py-3 text-xs uppercase tracking-widest disabled:opacity-50"
              title="Agent sends dust tokens to your UA"
            >
              Fund dust
            </button>
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          {holdNote && <p className="text-sm text-[color:var(--color-lime)]">{holdNote}</p>}

          <div className="border border-white/10 p-4 space-y-3 text-sm text-white/60">
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              Faucet · fail-closed
            </div>
            <p className="leading-relaxed">
              Claims are browser-only. Copy addresses below, claim ETH + stock tokens, then Activate
              hold. AXIS never invents fills.
            </p>
            <a
              href={FAUCET}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-white underline"
            >
              Open RH testnet faucet <ExternalLink size={12} />
            </a>
            <div className="space-y-2 pt-1">
              {agentAddr && <CopyAddr label="Agent" value={agentAddr} />}
              {ua && <CopyAddr label="Your UA" value={ua} />}
            </div>
            <Link to="/proof" className="inline-flex items-center gap-1.5 text-white underline text-xs">
              Judge proof · RH txs <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        <div className="border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <img src={CHAIN_LOGOS.robinhood} alt="" className="w-7 h-7 rounded-full bg-white/10" />
            <div>
              <div className="text-xs uppercase tracking-widest text-white/50">Plan</div>
              <div className="text-sm">
                {plan?.testnet ? "Robinhood Chain testnet" : "Robinhood Chain"}
              </div>
            </div>
          </div>
          {!plan?.legs?.length ? (
            <div className="flex items-start gap-3 text-sm text-white/50 py-8">
              <Sparkles size={16} className="mt-0.5 shrink-0" />
              Preview a basket to see weights. Oil themes are blocked on purpose.
            </div>
          ) : (
            <>
              <p className="text-sm text-white/70 leading-relaxed">{plan.english_summary}</p>
              <ul className="space-y-3">
                {plan.legs.map((leg) => {
                  const bal = live?.tokens.find((t) => t.symbol === leg.symbol)?.balance ?? 0;
                  const covered = bal > 0;
                  return (
                    <li
                      key={leg.symbol}
                      className="flex items-center gap-3 border border-white/10 rounded-2xl px-3 py-3"
                    >
                      <img
                        src={stockLogo(leg.symbol) ?? CHAIN_LOGOS.robinhood}
                        alt=""
                        className="w-8 h-8 rounded-full bg-white/10 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm uppercase tracking-[-0.03em] flex items-center gap-2">
                          {leg.symbol} · {leg.name}
                          {covered && (
                            <CheckCircle2
                              size={14}
                              className="text-[color:var(--color-lime)] shrink-0"
                            />
                          )}
                        </div>
                        <a
                          href={leg.explorer_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-white/40 hover:text-white truncate block"
                        >
                          {leg.address.slice(0, 10)}…{covered ? ` · bal ${bal}` : ""}
                        </a>
                      </div>
                      <div className="text-[color:var(--color-lime)] text-sm">
                        {Math.round(leg.weight * 100)}%
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {holds?.txs && holds.txs.length > 0 && (
            <div className="pt-4 border-t border-white/10 space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-white/40">
                Broadcast hold txs
              </div>
              <ul className="space-y-1 text-xs">
                {holds.txs.map((tx) => (
                  <li key={tx.tx_hash}>
                    <a
                      href={tx.explorer_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-[color:var(--color-lime)]"
                    >
                      {tx.symbol} · {tx.tx_hash.slice(0, 10)}…
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rails.data && (
            <div className="pt-4 border-t border-white/10 space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-white/40">
                Liquidity rails
              </div>
              <p className="text-xs text-white/50 leading-relaxed">{rails.data.lesson}</p>
              <ul className="space-y-1 text-xs text-white/60">
                {rails.data.rails.map((r) => (
                  <li key={r.id}>
                    <span className="text-white/80">{r.label}</span> · {r.status}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
