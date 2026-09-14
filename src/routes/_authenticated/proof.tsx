import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as AuthenticatedRoute } from "../_authenticated";
import { useAxisConfig } from "../../hooks/useAxis";
import { axisApi } from "../../lib/api";
import { arbiscanBaseUrl, chainDisplayName } from "../../lib/chain";
import { CHAIN_LOGOS, stockLogo } from "../../lib/logos";

export const Route = createFileRoute("/_authenticated/proof")({
  head: () => ({
    meta: [
      { title: "Judge Proof — AXIS" },
      {
        name: "description",
        content:
          "Hackathon submission evidence for Universal Accounts, Arbitrum, Magic, and ZeroDev tracks.",
      },
    ],
  }),
  component: Proof,
});

function Proof() {
  const ctx = AuthenticatedRoute.useRouteContext();
  if (!("session" in ctx) || !ctx.session) {
    throw new Error("Authenticated session missing");
  }
  const { session } = ctx;
  const { data: config } = useAxisConfig();
  const explorer = arbiscanBaseUrl();
  const chainName = chainDisplayName();

  const rh = useQuery({
    queryKey: ["axis", "proof-rh", session.userId],
    queryFn: () => axisApi.basket.holdings(session.userId),
    enabled: Boolean(session.userId),
    refetchInterval: 45_000,
  });

  const faucet = useQuery({
    queryKey: ["axis", "basket-faucet"],
    queryFn: () => axisApi.basket.faucet(),
  });

  const rails = useQuery({
    queryKey: ["axis", "basket-rails"],
    queryFn: () => axisApi.basket.rails(),
  });

  const liveUa = Boolean(session.uaAddress);
  const liveSra = Boolean(session.sraAddress);
  const live7702 = Boolean(session.eip7702Delegated || session.eip7702TxHash);

  const holds = rh.data?.holds;
  const holdings = rh.data?.holdings;
  const readiness = rh.data?.readiness;
  const holdTxs = holds?.txs ?? [];
  const historyTxs =
    holds?.history?.flatMap((h) => {
      const txs = (h as { txs?: typeof holdTxs }).txs;
      return Array.isArray(txs) ? txs : [];
    }) ?? [];
  const allTxs = [...holdTxs, ...historyTxs.filter((t) => !holdTxs.some((x) => x.tx_hash === t.tx_hash))];
  const holdLive = holds?.status === "held" || holds?.status === "partial";

  const checks = [
    { label: "All backend keys configured", ok: config?.fully_configured },
    { label: "Magic embedded wallet", ok: config?.wallet.magic },
    { label: "Particle project keys present", ok: config?.wallet.particle },
    { label: "ZeroDev project keys present", ok: config?.wallet.zerodev },
    {
      label: `Dedicated ${chainName} RPC`,
      ok: config?.chain.dedicated_rpc,
    },
    {
      label: "Arbitrum One (chain 42161)",
      ok: config?.chain.chain_id === 42161 || config?.chain.is_mainnet,
    },
    { label: "Live UA address (session)", ok: liveUa },
    { label: "Live EIP-7702 delegation evidence", ok: live7702 },
    { label: "Live ZeroDev SRA address", ok: liveSra },
    { label: "Venice AI (primary)", ok: config?.ai.venice },
    { label: "OpenAI AI (fallback)", ok: config?.ai.openai },
    { label: "TinyFish live yield scraping", ok: config?.intelligence.tinyfish },
    {
      label: "x402 agent wallet + facilitator",
      ok: config?.intelligence.x402_wallet && config?.intelligence.x402_facilitator,
    },
    { label: "Google OAuth", ok: config?.wallet.google_oauth },
    {
      label: "RH testnet stock holdings readable",
      ok: Boolean(holdings?.address),
    },
    {
      label: "RH hold live (held/partial — fail-closed)",
      ok: holdLive,
    },
    {
      label: "RH testnet hold tx recorded",
      ok: allTxs.length > 0 || Boolean(holds?.legs?.length),
    },
    {
      label: "Arb↔RH rails map published",
      ok: Boolean(rails.data?.rails?.length),
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-tight px-6 py-16 max-w-3xl mx-auto">
      <Link to="/" className="text-xs uppercase tracking-widest text-white/40 hover:text-white">
        ← AXIS
      </Link>
      <h1 className="mt-8 text-4xl tracking-[-0.04em]">Judge Proof Package</h1>
      <p className="mt-3 text-white/60 text-sm leading-relaxed">
        Live mainnet evidence — keys alone are not enough. Show UA address, EIP-7702 Type-4 hash,
        and ZeroDev SRA. RH stock work is labeled public testnet.
      </p>

      {config?.missing_keys && config.missing_keys.length > 0 && (
        <section className="mt-6 border border-red-500/30 bg-red-500/5 p-4 text-sm">
          <p className="text-red-300 font-medium">Missing backend keys:</p>
          <p className="mt-2 text-white/60">{config.missing_keys.join(", ")}</p>
          <p className="mt-2 text-white/40 text-xs">See docs/KEYS_SETUP.md</p>
        </section>
      )}

      <section className="mt-10 border border-white/10 p-6">
        <h2 className="text-xs uppercase tracking-widest text-white/50 mb-4">
          Integration checklist
        </h2>
        <ul className="space-y-3">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center justify-between text-sm gap-4">
              <span>{c.label}</span>
              <span
                className={
                  c.ok ? "text-[color:var(--color-lime)] shrink-0" : "text-white/30 shrink-0"
                }
              >
                {c.ok ? "✓ Ready" : "○ Missing"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 border border-white/10 p-6 text-sm space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-white/50 mb-3">Session evidence</h2>
        <p>
          <span className="text-white/40">User ID:</span> {session.userId}
        </p>
        <p>
          <span className="text-white/40">UA address (EOA = UA in 7702 mode):</span>{" "}
          <a
            className="underline break-all"
            href={`${explorer}/address/${session.uaAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            {session.uaAddress}
          </a>
        </p>
        {session.sraAddress ? (
          <p>
            <span className="text-white/40">SRA address:</span>{" "}
            <span className="break-all">{session.sraAddress}</span>
          </p>
        ) : (
          <p className="text-red-300/80">SRA address missing — mainnet SRA create required.</p>
        )}
        {session.eip7702TxHash ? (
          <p>
            <span className="text-white/40">EIP-7702 Type-4 tx:</span>{" "}
            <a
              className="underline break-all"
              href={`${explorer}/tx/${session.eip7702TxHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {session.eip7702TxHash}
            </a>
          </p>
        ) : (
          <p className="text-white/40">
            EIP-7702 tx hash:{" "}
            {session.eip7702Delegated
              ? "delegated (prior session — resign in if hash needed for judges)"
              : "not recorded yet"}
          </p>
        )}
        <p>
          <span className="text-white/40">EIP-7702 delegated:</span>{" "}
          {session.eip7702Delegated || session.eip7702TxHash ? "yes" : "no"}
        </p>
      </section>

      <section className="mt-6 border border-[color:var(--color-lime)]/30 bg-[color:var(--color-lime)]/5 p-6 text-sm space-y-4">
        <div className="flex items-center gap-3">
          <img src={CHAIN_LOGOS.robinhood} alt="" className="w-8 h-8 rounded-full bg-white/10" />
          <h2 className="text-xs uppercase tracking-widest text-[color:var(--color-lime)]">
            Open House · Robinhood Chain testnet
          </h2>
        </div>
        <p className="text-white/70 leading-relaxed">
          New stock work is on <strong className="text-white">Robinhood Chain public testnet
          (46630)</strong> — labeled, not mainnet fills. Arb One yield stays live. Hold status:{" "}
          <strong className="text-white">{holds?.status ?? "none"}</strong>
          {readiness ? ` · next: ${readiness.next_step}` : ""}.
        </p>
        <ul className="space-y-2 text-white/60">
          <li>RPC: https://rpc.testnet.chain.robinhood.com</li>
          <li>
            Explorer:{" "}
            <a
              href="https://explorer.testnet.chain.robinhood.com"
              target="_blank"
              rel="noreferrer"
              className="underline text-white"
            >
              explorer.testnet.chain.robinhood.com
            </a>
          </li>
          <li>
            Faucet:{" "}
            <a
              href={holdings?.faucet_url ?? faucet.data?.faucet_url ?? "https://faucet.testnet.chain.robinhood.com"}
              target="_blank"
              rel="noreferrer"
              className="underline text-white"
            >
              faucet.testnet.chain.robinhood.com
            </a>
          </li>
          <li>
            Basket builder:{" "}
            <Link
              to="/dashboard"
              search={{ tab: "baskets", chain: "All" }}
              className="underline text-white"
            >
              /dashboard?tab=baskets
            </Link>
          </li>
          {(faucet.data?.agent_address || holdings?.agent_address) && (
            <li className="break-all">
              Agent faucet target: {faucet.data?.agent_address ?? holdings?.agent_address}
            </li>
          )}
          {readiness && (
            <li>
              Readiness: fund={readiness.can_fund ? "yes" : "no"} · sync=
              {readiness.can_sync ? "yes" : "no"}
            </li>
          )}
        </ul>

        {rh.isError && (
          <p className="text-red-300/90 text-xs">
            RH holdings fetch failed — check UA + RPC. {(rh.error as Error)?.message}
          </p>
        )}

        {holdings && (
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              Live balances · {holdings.eth_balance} ETH
            </div>
            <p className="text-[11px] text-white/40 break-all">UA on RH: {holdings.address}</p>
            <ul className="space-y-2">
              {holdings.tokens.map((t) => (
                <li key={t.symbol} className="flex items-center gap-3">
                  <img
                    src={stockLogo(t.symbol) ?? CHAIN_LOGOS.robinhood}
                    alt=""
                    className="w-6 h-6 rounded-full bg-white/10 object-cover"
                  />
                  <span className="flex-1">{t.symbol}</span>
                  <a
                    href={t.explorer_url}
                    target="_blank"
                    rel="noreferrer"
                    className={t.balance > 0 ? "underline text-white" : "text-white/30"}
                  >
                    {t.balance}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-white/40 text-xs">{holdings.honesty}</p>
          </div>
        )}

        <div className="space-y-2 border-t border-white/10 pt-4">
          <div className="text-[10px] uppercase tracking-widest text-white/40">
            Hold txs (real, testnet-labeled)
          </div>
          {allTxs.length === 0 ? (
            <p className="text-white/50 text-xs leading-relaxed">
              No hold txs yet. Claim faucet tokens for the agent address, save a basket, then
              Activate hold on{" "}
              <Link to="/dashboard" search={{ tab: "baskets", chain: "All" }} className="underline">
                Baskets
              </Link>
              . Explorer links land here.
            </p>
          ) : (
            <ul className="space-y-2">
              {allTxs.map((tx) => (
                <li key={tx.tx_hash} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-[color:var(--color-lime)]">{tx.symbol}</span>
                  <span className="text-white/40 text-xs">{tx.amount}</span>
                  <a
                    href={tx.explorer_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline break-all text-xs"
                  >
                    {tx.tx_hash}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {holds?.skipped && holds.skipped.length > 0 && (
            <ul className="text-xs text-white/40 space-y-1 pt-2">
              {holds.skipped.map((s) => (
                <li key={`${s.symbol}-${s.reason}`}>
                  Skipped {s.symbol}: {s.reason}
                </li>
              ))}
            </ul>
          )}
          {holds?.honesty && <p className="text-white/40 text-xs pt-1">{holds.honesty}</p>}
        </div>

        {rails.data && (
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              {rails.data.title}
            </div>
            <p className="text-xs text-white/60 leading-relaxed">{rails.data.honesty}</p>
            <p className="text-xs text-white/40 leading-relaxed">{rails.data.lesson}</p>
            <ul className="space-y-2 text-xs text-white/70">
              {rails.data.rails.map((r) => (
                <li key={r.id}>
                  <span className="text-white">{r.label}</span> · {r.status}
                  {r.chain_id != null ? ` · chain ${r.chain_id}` : ""}
                  <div className="text-white/40 mt-0.5">{r.notes}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-6 border border-white/10 p-6 text-sm text-white/70 leading-relaxed">
        <h2 className="text-xs uppercase tracking-widest text-white/50 mb-3">Demo flow</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            Google login at{" "}
            <Link to="/onboard" className="underline">
              /onboard
            </Link>{" "}
            (triggers UA + EIP-7702 + SRA on Arbitrum One)
          </li>
          <li>Confirm Type-4 hash + SRA on this page</li>
          <li>Set budget → Activate AXIS</li>
          <li>
            Build “tech yes, oil no” basket → Save → Activate hold at{" "}
            <Link to="/dashboard" search={{ tab: "baskets", chain: "All" }} className="underline">
              /dashboard?tab=baskets
            </Link>
          </li>
          <li>Return here for live RH balances + explorer tx links</li>
          <li>Deposit USDC via SRA · weekly report includes stock legs</li>
        </ol>
      </section>
    </div>
  );
}
