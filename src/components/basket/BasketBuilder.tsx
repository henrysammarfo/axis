import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  PieChart,
  Sparkles,
} from "lucide-react";
import { axisApi, type BasketPlan } from "../../lib/api";
import { CHAIN_LOGOS, stockLogo } from "../../lib/logos";
import { BeachheadPanel } from "./BeachheadPanel";
import { FragmentationDesk } from "./FragmentationDesk";
import { PackagesPanel } from "./PackagesPanel";
import { RetentionPanel } from "./RetentionPanel";
import { UsdgPathPanel } from "./UsdgPathPanel";

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
      return "Practice hold live";
    case "partial":
      return "Partial practice hold";
    case "awaiting_faucet":
      return "Need faucet tokens";
    case "planned":
      return "Plan saved (not held)";
    case "empty_plan":
      return "No plan yet";
    default:
      return status ?? "—";
  }
}

function CopyAddr({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="flex w-full items-start gap-2 text-left text-[12px] text-white/60 hover:text-white"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <span className="shrink-0 text-white/50">{label}</span>
      <span className="min-w-0 break-all flex-1">{value}</span>
      {copied ? (
        <Check size={12} className="shrink-0 text-[color:var(--color-lime)]" />
      ) : (
        <Copy size={12} className="shrink-0" />
      )}
    </button>
  );
}

function AdvancedDrawer({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-white/10">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="text-[12px] uppercase tracking-widest text-white/55">{title}</span>
        <ChevronDown
          size={16}
          className="shrink-0 text-white/45 transition-transform duration-300"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows,opacity] duration-400"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="pb-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Newcomer-first baskets: one simple path. Complexity lives under Advanced. */
export function BasketBuilder({
  userId,
  initialPrompt,
}: {
  userId: string;
  initialPrompt?: string;
}) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState(initialPrompt?.trim() || "tech yes, oil no");
  const [budget, setBudget] = useState(100);
  const [preview, setPreview] = useState<BasketPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [holdNote, setHoldNote] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const autoPreviewed = useRef(false);

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
      setStep(2);
    },
    onError: (e: Error) => setError(e.message),
  });

  useEffect(() => {
    if (autoPreviewed.current) return;
    if (!initialPrompt?.trim()) return;
    if (saved.isLoading) return;
    if (saved.data?.plan?.legs?.length) {
      setStep(2);
      return;
    }
    autoPreviewed.current = true;
    previewMut.mutate();
  }, [initialPrompt, saved.isLoading, saved.data, previewMut]);

  const saveMut = useMutation({
    mutationFn: () => axisApi.basket.save(userId, prompt, budget),
    onSuccess: (data) => {
      setPreview(data.plan);
      setError(null);
      setHoldNote("Saved. This is a plan only — not real stock yet.");
      setStep(3);
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
          `${statusLabel(st)} · ${n} practice tx · ${legs} tokens. Still testnet — not mainnet money.`,
        );
      } else {
        setHoldNote(
          `Need faucet tokens first (${st}). Claim free practice tokens, then try again.`,
        );
      }
      setStep(3);
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
  const isTestnet = Boolean(network.data?.testnet ?? plan?.testnet ?? true);

  return (
    <div className="space-y-8">
      {/* Network seal — live money vs practice never mixed in the header */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/15 bg-white/[0.03] px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/55">
            <img src={CHAIN_LOGOS.arbitrum} alt="Arbitrum" className="size-5 rounded-full" />
            Live money
          </div>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            Arbitrum One yield stays on the Overview tab. Real USDC. Separate from stocks.
          </p>
          <Link
            to="/dashboard"
            search={{ tab: "overview" }}
            className="mt-3 inline-block text-[12px] text-[color:var(--color-lime)] underline underline-offset-2"
          >
            Go to Overview →
          </Link>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-lime)]/35 bg-[color:var(--color-lime)]/[0.06] px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[color:var(--color-lime)]">
            <img src={CHAIN_LOGOS.robinhood} alt="Robinhood Chain" className="size-5 rounded-full" />
            Practice stocks · testnet
          </div>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            Robinhood Chain <span className="text-white">public testnet (46630)</span>. Tokens have
            no cash value. Never mixed with your Arbitrum balance.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[color:var(--color-lime)]">
          <PieChart size={14} strokeWidth={1.75} />
          Stock basket · simple path
        </div>
        <h2 className="text-2xl sm:text-3xl tracking-[-0.04em]">
          Say what you want. AXIS builds the mix.
        </h2>
        <p className="max-w-xl text-[15px] leading-relaxed text-white/65">
          No ticker homework. Pick a vibe, preview weights, save the plan. Practice holds use free
          faucet tokens only.
        </p>

        {/* Step rail — ApprovalCard craft */}
        <div className="flex items-center gap-2 text-[12px] tabular-nums text-white/50">
          {[1, 2, 3].map((n) => (
            <span key={n} className="inline-flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-full text-[11px] font-medium ${
                  step >= n
                    ? "bg-[color:var(--color-lime)] text-black"
                    : "bg-white/10 text-white/50"
                }`}
              >
                {n}
              </span>
              <span className={step === n ? "text-white" : ""}>
                {n === 1 ? "Vibe" : n === 2 ? "Mix" : "Practice"}
              </span>
              {n < 3 && <span className="mx-1 text-white/25">·</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-[11px] uppercase tracking-widest text-white/55">Your vibe</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-[15px] text-white outline-none focus:border-white/40"
              placeholder='e.g. "tech yes, oil no"'
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPrompt(p);
                  setStep(1);
                }}
                className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-widest transition ${
                  prompt === p
                    ? "border-[color:var(--color-lime)] text-[color:var(--color-lime)]"
                    : "border-white/20 text-white/70 hover:bg-white/5"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <label className="block space-y-2">
            <span className="text-[11px] uppercase tracking-widest text-white/55">
              Plan size (notional $)
            </span>
            <input
              type="number"
              min={10}
              max={100000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value) || 0)}
              className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-3 text-[15px] outline-none"
            />
          </label>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              disabled={previewMut.isPending || !prompt.trim()}
              onClick={() => previewMut.mutate()}
              className="rounded-full bg-white px-6 py-3 text-[12px] uppercase tracking-widest text-black disabled:opacity-50"
            >
              {previewMut.isPending ? "Building…" : "1 · Preview mix"}
            </button>
            <button
              type="button"
              disabled={saveMut.isPending || !prompt.trim() || !plan?.legs?.length}
              onClick={() => saveMut.mutate()}
              className="rounded-full border border-[color:var(--color-lime)] px-6 py-3 text-[12px] uppercase tracking-widest text-[color:var(--color-lime)] disabled:opacity-50"
            >
              {saveMut.isPending ? "Saving…" : "2 · Save plan"}
            </button>
            <button
              type="button"
              disabled={holdMut.isPending || !plan?.legs?.length}
              onClick={() => holdMut.mutate("auto")}
              className="rounded-full bg-[color:var(--color-lime)] px-6 py-3 text-[12px] uppercase tracking-widest text-black disabled:opacity-50"
            >
              {holdMut.isPending ? "Activating…" : "3 · Practice hold"}
            </button>
          </div>

          {error && <p className="text-sm text-red-300">{error}</p>}
          {holdNote && (
            <p className="text-sm leading-relaxed text-[color:var(--color-lime)]">{holdNote}</p>
          )}

          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-widest text-amber-200/90">
              Free practice tokens · not real money
            </div>
            <p className="text-sm leading-relaxed text-white/70">
              Open the Robinhood <strong className="font-medium text-white">testnet</strong> faucet,
              claim tokens for the addresses below, then tap Practice hold. AXIS never invents a
              fill.
            </p>
            <a
              href={FAUCET}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-white underline underline-offset-2"
            >
              Open testnet faucet <ExternalLink size={12} />
            </a>
            <div className="space-y-2 pt-1">
              {agentAddr && <CopyAddr label="Agent" value={agentAddr} />}
              {ua && <CopyAddr label="Your account" value={ua} />}
            </div>
            <Link
              to="/proof"
              className="inline-flex items-center gap-1.5 text-[12px] text-white/70 underline underline-offset-2"
            >
              See proof (testnet labeled) <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={CHAIN_LOGOS.robinhood}
              alt="Robinhood Chain"
              className="size-8 rounded-full bg-white/10"
            />
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/50">Your mix</div>
              <div className="text-sm text-white">
                {isTestnet ? "Robinhood Chain · public testnet" : "Robinhood Chain"}
              </div>
            </div>
            <span className="ml-auto rounded-full border border-amber-400/40 px-2.5 py-1 text-[10px] uppercase tracking-widest text-amber-200/90">
              Practice
            </span>
          </div>

          {!plan?.legs?.length ? (
            <div className="flex items-start gap-3 py-10 text-sm text-white/55">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-[color:var(--color-lime)]" />
              Preview a vibe to see company weights. Oil themes are blocked on purpose.
            </div>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-white/75">{plan.english_summary}</p>
              <ul className="space-y-3">
                {plan.legs.map((leg) => {
                  const bal = live?.tokens.find((t) => t.symbol === leg.symbol)?.balance ?? 0;
                  const covered = bal > 0;
                  return (
                    <li
                      key={leg.symbol}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-3"
                    >
                      <img
                        src={stockLogo(leg.symbol) ?? CHAIN_LOGOS.robinhood}
                        alt={`${leg.symbol} logo`}
                        className="size-8 rounded-full bg-white/10 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm tracking-[-0.03em]">
                          {leg.symbol}
                          <span className="truncate text-white/45">{leg.name}</span>
                          {covered && (
                            <CheckCircle2
                              size={14}
                              className="shrink-0 text-[color:var(--color-lime)]"
                            />
                          )}
                        </div>
                        {covered && (
                          <div className="text-[11px] text-white/45">Practice bal · {bal}</div>
                        )}
                      </div>
                      <div className="text-sm text-[color:var(--color-lime)]">
                        {Math.round(leg.weight * 100)}%
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {holds?.txs && holds.txs.length > 0 && (
            <div className="space-y-2 border-t border-white/10 pt-4">
              <div className="text-[11px] uppercase tracking-widest text-white/50">
                Practice txs (testnet explorer)
              </div>
              <ul className="space-y-1 text-xs">
                {holds.txs.map((tx) => (
                  <li key={tx.tx_hash}>
                    <a
                      href={tx.explorer_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[color:var(--color-lime)] underline"
                    >
                      {tx.symbol} · {tx.tx_hash.slice(0, 10)}…
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Complexity behind the curtain — creamery Approval/Context craft */}
      <div className="rounded-2xl border border-white/10 bg-black/40 px-5 sm:px-6">
        <p className="pt-5 text-[12px] uppercase tracking-widest text-white/45">
          Advanced · for builders &amp; judges
        </p>
        <p className="mt-2 max-w-2xl text-sm text-white/55 leading-relaxed">
          Instrument truth, USDG rails, geo waitlist, retention, packages. Hidden so newcomers stay
          on the simple path above.
        </p>

        <AdvancedDrawer title="Weekly English report settings">
          <RetentionPanel userId={userId} />
        </AdvancedDrawer>

        <AdvancedDrawer title="Same company · different instruments (truth desk)">
          <FragmentationDesk symbols={plan?.legs?.map((l) => l.symbol)} />
        </AdvancedDrawer>

        <AdvancedDrawer title="USDG path · labeled only (AXIS does not bridge)">
          <UsdgPathPanel />
        </AdvancedDrawer>

        <AdvancedDrawer title="Where are you? · waitlist">
          <BeachheadPanel userId={userId} />
        </AdvancedDrawer>

        <AdvancedDrawer title="Liquidity rails map">
          {rails.data ? (
            <div className="space-y-2 text-sm text-white/60">
              <p className="leading-relaxed">{rails.data.lesson}</p>
              <ul className="space-y-1">
                {rails.data.rails.map((r) => (
                  <li key={r.id}>
                    <span className="text-white/80">{r.label}</span> · {r.status}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-white/45">Loading rails…</p>
          )}
        </AdvancedDrawer>

        <AdvancedDrawer title="Package catalog (no checkout)">
          <PackagesPanel />
        </AdvancedDrawer>

        <AdvancedDrawer title="Builder controls (sync / fund dust)">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={holdMut.isPending || !plan?.legs?.length || !readiness?.can_sync}
              onClick={() => holdMut.mutate("sync")}
              className="rounded-full border border-white/30 px-5 py-2.5 text-[11px] uppercase tracking-widest disabled:opacity-50"
            >
              Sync balances
            </button>
            <button
              type="button"
              disabled={holdMut.isPending || !plan?.legs?.length || !readiness?.can_fund}
              onClick={() => holdMut.mutate("fund")}
              className="rounded-full border border-white/30 px-5 py-2.5 text-[11px] uppercase tracking-widest disabled:opacity-50"
            >
              Fund dust
            </button>
          </div>
          <p className="mt-3 text-xs text-white/45 leading-relaxed">
            Status · {statusLabel(holds?.status)}
            {readiness?.can_fund ? " · agent can fund dust" : ""}
            {readiness?.can_sync ? " · UA ready to sync" : ""}
          </p>
        </AdvancedDrawer>
      </div>
    </div>
  );
}
