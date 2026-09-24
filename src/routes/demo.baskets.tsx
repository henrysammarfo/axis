import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { BeachheadPanel } from "../components/basket/BeachheadPanel";
import { FragmentationDesk } from "../components/basket/FragmentationDesk";
import { PackagesPanel } from "../components/basket/PackagesPanel";
import { UsdgPathPanel } from "../components/basket/UsdgPathPanel";
import { Logo } from "../components/brand/Logo";
import { CHAIN_LOGOS, STOCK_LOGOS } from "../lib/logos";
import { brandHeadMeta } from "../lib/seo";

export const Route = createFileRoute("/demo/baskets")({
  head: () =>
    brandHeadMeta({
      title: "Baskets depth — AXIS",
      description:
        "Open House depth: continuity Google UX, RH practice stock baskets, instrument truth — simple for newcomers.",
      path: "/demo/baskets",
    }),
  component: DemoBaskets,
});

const EASE = [0.23, 1, 0.32, 1] as const;

const CHAPTERS = [
  { id: "simple", n: "01", label: "Simple" },
  { id: "seal", n: "02", label: "Seal" },
  { id: "depth", n: "03", label: "Depth" },
] as const;

const HERO_TICKERS = ["TSLA", "AMZN", "AMD", "NFLX", "PLTR", "NVDA", "AAPL", "MSFT"] as const;

/** Public OH surface — newcomer-simple first; depth under Advanced. */
function DemoBaskets() {
  const [active, setActive] = useState<string>("simple");
  const [depthOpen, setDepthOpen] = useState(false);

  useEffect(() => {
    const nodes = CHAPTERS.map((c) => document.getElementById(c.id)).filter(
      Boolean,
    ) as HTMLElement[];
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { rootMargin: "-35% 0px -45% 0px", threshold: [0.15, 0.4, 0.7] },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white font-tight">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -10%, color-mix(in srgb, var(--color-lime) 14%, transparent), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 40%, rgba(255,255,255,0.04), transparent 50%)",
        }}
      />

      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3 text-white" aria-label="AXIS home">
            <Logo width={88} className="h-5 w-auto" />
          </Link>
          <nav aria-label="Chapters" className="hidden items-center gap-1 md:flex">
            {CHAPTERS.map((c) => {
              const on = active === c.id;
              return (
                <a
                  key={c.id}
                  href={`#${c.id}`}
                  className={`relative rounded-full px-2.5 py-1 text-[11px] uppercase tracking-widest transition-colors ${
                    on ? "text-[color:var(--color-lime)]" : "text-white/45 hover:text-white/75"
                  }`}
                >
                  {c.label}
                  {on && (
                    <motion.span
                      layoutId="demo-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-white/[0.06]"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  )}
                </a>
              );
            })}
          </nav>
          <Link
            to="/onboard"
            className="rounded-full bg-white px-3.5 py-1.5 text-[11px] uppercase tracking-widest text-black hover:bg-[color:var(--color-lime)]"
          >
            Start with Google
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section
        id="simple"
        className="relative flex min-h-[100svh] scroll-mt-20 flex-col justify-end px-5 pb-16 pt-28 sm:px-8 sm:pb-20"
      >
        <div className="mx-auto w-full max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="max-w-3xl"
          >
            <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--color-lime)]">
              Demo · no login · made simple
            </p>
            <h1 className="mt-5 text-[clamp(2.75rem,8vw,5.25rem)] leading-[0.92] tracking-[-0.055em]">
              Say a vibe.
              <br />
              <span className="text-white/50">Get a stock mix.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/60 sm:text-base">
              New to tokenized stocks? You don’t need to know tickers, bridges, or OFTs. Type
              something like “tech yes, oil no.” AXIS builds the basket. Practice holds use free
              testnet tokens — never your live Arbitrum money.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/onboard"
                className="rounded-full bg-[color:var(--color-lime)] px-5 py-2.5 text-[12px] uppercase tracking-widest text-black hover:brightness-110"
              >
                Try it after Google
              </Link>
              <a
                href="#seal"
                className="rounded-full border border-white/20 px-5 py-2.5 text-[12px] uppercase tracking-widest text-white/80 hover:border-white/40"
              >
                How we keep it safe
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.8 }}
            className="mt-14 flex flex-wrap items-center gap-3"
          >
            <img
              src={CHAIN_LOGOS.arbitrum}
              alt="Arbitrum"
              className="size-8 rounded-full bg-white/5 p-1 ring-1 ring-white/10"
            />
            <img
              src={CHAIN_LOGOS.robinhood}
              alt="Robinhood Chain"
              className="size-8 rounded-full bg-white/5 p-1 ring-1 ring-white/10"
            />
            <span className="mx-1 h-4 w-px bg-white/15" />
            {HERO_TICKERS.map((sym, i) => (
              <motion.img
                key={sym}
                src={STOCK_LOGOS[sym]}
                alt={`${sym} logo`}
                title={sym}
                className="size-7 rounded-full bg-white/5 object-contain p-0.5 ring-1 ring-white/10 sm:size-8"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.05, duration: 0.45, ease: EASE }}
              />
            ))}
          </motion.div>

          {/* Three-step storyboard — ApprovalCard craft */}
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              { n: "1", t: "Say a vibe", d: "English only. Oil themes blocked." },
              { n: "2", t: "See the mix", d: "Weights on real company names." },
              { n: "3", t: "Practice hold", d: "Free faucet tokens. Labeled testnet." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
                  <div className="flex size-7 items-center justify-center rounded-full bg-[color:var(--color-lime)] text-[12px] font-medium text-black">
                    {s.n}
                  </div>
                  <div className="mt-3 text-lg tracking-[-0.03em]">{s.t}</div>
                  <p className="mt-1 text-sm text-white/55 leading-relaxed">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Seal */}
      <section id="seal" className="scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="font-mono text-[13px] text-[color:var(--color-lime)]">02</p>
            <h2 className="mt-2 text-3xl tracking-[-0.04em] sm:text-4xl">
              Live money and practice stocks never mix
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
              Maintenance (Arbitrum yield) and DevNet/testnet stocks are sealed. No loophole that
              spends your mainnet USDC on a practice fill.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-white/[0.08] sm:grid-cols-2">
            <Reveal>
              <div className="bg-black px-6 py-8">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/55">
                  <img src={CHAIN_LOGOS.arbitrum} alt="" className="size-5 rounded-full" />
                  Live money
                </div>
                <div className="mt-3 text-2xl tracking-[-0.03em] text-[color:var(--color-lime)]">
                  Arbitrum One
                </div>
                <p className="mt-2 text-sm text-white/55 leading-relaxed">
                  Google → Set.Forget.Earn. Real USDC yield. Overview tab only.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="bg-black px-6 py-8">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-200/90">
                  <img src={CHAIN_LOGOS.robinhood} alt="" className="size-5 rounded-full" />
                  Practice · testnet
                </div>
                <div className="mt-3 text-2xl tracking-[-0.03em] text-white">RH Chain 46630</div>
                <p className="mt-2 text-sm text-white/55 leading-relaxed">
                  Stock tokens for demo. No cash value. Always labeled in UI and /proof.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Depth — collapsed by default */}
      <section id="depth" className="scroll-mt-20 px-5 pb-24 sm:px-8 sm:pb-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="font-mono text-[13px] text-[color:var(--color-lime)]">03</p>
            <h2 className="mt-2 text-3xl tracking-[-0.04em] sm:text-4xl">Depth for judges</h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
              Instrument truth, USDG rail, beachhead, packages — live and active under Advanced so
              newcomers aren’t hit with a card dump.
            </p>
          </Reveal>

          <button
            type="button"
            aria-expanded={depthOpen}
            onClick={() => setDepthOpen((v) => !v)}
            className="mt-8 rounded-full border border-white/20 px-5 py-2.5 text-[12px] uppercase tracking-widest text-white/80 hover:border-white/40"
          >
            {depthOpen ? "Hide depth panels" : "Show depth panels"}
          </button>

          <div
            className="mt-8 grid transition-[grid-template-rows,opacity] duration-500"
            style={{
              gridTemplateRows: depthOpen ? "1fr" : "0fr",
              opacity: depthOpen ? 1 : 0,
              transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          >
            <div className="overflow-hidden space-y-8">
              <LayerSurface>
                <FragmentationDesk symbols={["TSLA", "AMZN", "AMD", "NFLX", "PLTR"]} />
              </LayerSurface>
              <LayerSurface>
                <UsdgPathPanel />
              </LayerSurface>
              <LayerSurface>
                <BeachheadPanel />
              </LayerSurface>
              <LayerSurface>
                <PackagesPanel />
              </LayerSurface>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-14 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Logo width={140} className="h-8 w-auto text-white" />
            <p className="mt-4 max-w-md text-sm text-white/50">
              Set. Forget. Earn — live yield today, practice stock baskets under the same Google door.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/onboard"
              className="rounded-full bg-white px-5 py-2.5 text-[12px] uppercase tracking-widest text-black"
            >
              Start with Google
            </Link>
            <Link
              to="/privacy"
              className="rounded-full border border-white/20 px-5 py-2.5 text-[12px] uppercase tracking-widest text-white/70"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="rounded-full border border-white/20 px-5 py-2.5 text-[12px] uppercase tracking-widest text-white/70"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LayerSurface({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-white/[0.03] ring-1 ring-white/[0.09]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-lime)]/40 to-transparent"
      />
      <div className="p-1 sm:p-2 [&_>div]:border-0 [&_>div]:bg-transparent [&_>div]:p-5 sm:[&_>div]:p-7">
        {children}
      </div>
    </div>
  );
}

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 22 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
