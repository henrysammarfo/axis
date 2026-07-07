import { createFileRoute, Link } from "@tanstack/react-router";
import { Route as AuthenticatedRoute } from "../_authenticated";
import { useAxisConfig } from "../../hooks/useAxis";

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
  const { session } = AuthenticatedRoute.useRouteContext();
  const { data: config } = useAxisConfig();

  const checks = [
    { label: "Magic embedded wallet", ok: config?.wallet.magic },
    { label: "Particle Universal Accounts", ok: config?.wallet.particle },
    { label: "ZeroDev gas abstraction + SRA", ok: config?.wallet.zerodev },
    { label: "Arbitrum settlement (chain 42161)", ok: config?.chain.chain_id === 42161 },
    { label: "AI agent (Venice/OpenAI/Anthropic)", ok: config?.ai.active_provider !== "rules" },
    { label: "TinyFish web intelligence", ok: config?.intelligence.tinyfish },
    { label: "x402 agent wallet", ok: config?.intelligence.x402_wallet },
    { label: "Google OAuth", ok: config?.wallet.google_oauth },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-tight px-6 py-16 max-w-3xl mx-auto">
      <Link to="/" className="text-xs uppercase tracking-widest text-white/40 hover:text-white">
        ← AXIS
      </Link>
      <h1 className="mt-8 text-4xl tracking-[-0.04em]">Judge Proof Package</h1>
      <p className="mt-3 text-white/60 text-sm leading-relaxed">
        UXmaxx Hackathon — Universal Accounts + Arbitrum + Magic Labs + ZeroDev
      </p>

      <section className="mt-10 border border-white/10 p-6">
        <h2 className="text-xs uppercase tracking-widest text-white/50 mb-4">
          Integration checklist
        </h2>
        <ul className="space-y-3">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center justify-between text-sm">
              <span>{c.label}</span>
              <span className={c.ok ? "text-[color:var(--color-lime)]" : "text-white/30"}>
                {c.ok ? "✓ Ready" : "○ Pending keys"}
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
          <span className="text-white/40">UA address:</span> {session.uaAddress}
        </p>
        {session.sraAddress && (
          <p>
            <span className="text-white/40">SRA address:</span> {session.sraAddress}
          </p>
        )}
      </section>

      <section className="mt-6 border border-white/10 p-6 text-sm text-white/70 leading-relaxed">
        <h2 className="text-xs uppercase tracking-widest text-white/50 mb-3">Demo flow</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            Google login at{" "}
            <Link to="/onboard" className="underline">
              /onboard
            </Link>
          </li>
          <li>Set budget → Activate AXIS</li>
          <li>
            View positions + weekly report at{" "}
            <Link to="/dashboard" className="underline">
              /dashboard
            </Link>
          </li>
          <li>Send plain-English rebalance instruction</li>
          <li>Deposit via SRA from any chain</li>
        </ol>
      </section>
    </div>
  );
}
