import { createFileRoute, Link } from "@tanstack/react-router";
import { Route as AuthenticatedRoute } from "../_authenticated";
import { useAxisConfig } from "../../hooks/useAxis";
import { arbiscanBaseUrl, chainDisplayName } from "../../lib/chain";

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

  const liveUa = Boolean(session.uaAddress);
  const liveSra = Boolean(session.sraAddress);
  const live7702 = Boolean(session.eip7702Delegated || session.eip7702TxHash);

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
  ];

  return (
    <div className="min-h-screen bg-black text-white font-tight px-6 py-16 max-w-3xl mx-auto">
      <Link to="/" className="text-xs uppercase tracking-widest text-white/40 hover:text-white">
        ← AXIS
      </Link>
      <h1 className="mt-8 text-4xl tracking-[-0.04em]">Judge Proof Package</h1>
      <p className="mt-3 text-white/60 text-sm leading-relaxed">
        Live mainnet evidence — keys alone are not enough. Show UA address, EIP-7702 Type-4 hash,
        and ZeroDev SRA.
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
              <span className={c.ok ? "text-[color:var(--color-lime)] shrink-0" : "text-white/30 shrink-0"}>
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
            View positions at{" "}
            <Link to="/dashboard" className="underline">
              /dashboard
            </Link>
          </li>
          <li>Deposit USDC via SRA from Base / OP / ETH / Arbitrum</li>
        </ol>
      </section>
    </div>
  );
}
