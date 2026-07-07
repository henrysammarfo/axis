import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "../components/brand/Logo";
import {
  loginWithGoogle,
  handleOAuthRedirect,
  resumeSession,
  getStoredSession,
  isWalletConfigured,
} from "../lib/wallet";
import { useAxisConfig } from "../hooks/useAxis";
import { isAuthenticated } from "../lib/auth";

export const Route = createFileRoute("/onboard")({
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Get Started — AXIS" },
      {
        name: "description",
        content: "Sign in with Google and activate your autonomous DeFi agent.",
      },
    ],
  }),
  component: Onboard,
});

const GOALS = ["Maximize yield", "Grow steadily", "Protect my money"] as const;
const RISKS = ["conservative", "moderate", "aggressive"] as const;

function Onboard() {
  const navigate = useNavigate();
  const { data: config } = useAxisConfig();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState(500);
  const [risk, setRisk] = useState<(typeof RISKS)[number]>("moderate");
  const [goal, setGoal] = useState<string>(GOALS[0]);
  const session = getStoredSession();

  useEffect(() => {
    handleOAuthRedirect()
      .then((s) => {
        if (s) setStep(2);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Login failed"));

    resumeSession()
      .then((s) => {
        if (s) setStep(2);
      })
      .catch(() => {});
  }, []);

  const onLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const existing = await resumeSession();
      if (existing) {
        setStep(2);
        return;
      }
      await loginWithGoogle();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Login failed";
      if (!msg.includes("Redirecting")) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onActivate = () => {
    const s = getStoredSession();
    if (!s) return;
    navigate({
      to: "/dashboard",
      search: { tab: "overview", chain: "All", activate: "1", budget: String(budget), risk, goal },
    });
  };

  return (
    <div className="min-h-screen bg-black text-white font-tight flex flex-col">
      <header className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
        <Link to="/">
          <Logo width={72} />
        </Link>
        <span className="text-[10px] uppercase tracking-widest text-white/40">
          Step {step} of 2
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {step === 1 && (
            <>
              <div>
                <h1 className="text-4xl tracking-[-0.04em]">Welcome to AXIS</h1>
                <p className="mt-3 text-white/60 text-sm leading-relaxed">
                  Sign in with Google. Your secure account is created automatically — no seed
                  phrase, no wallet app.
                </p>
              </div>

              {!isWalletConfigured() && (
                <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-200/80">
                  Configure wallet keys before signing in. See{" "}
                  <code className="text-xs">docs/KEYS_SETUP.md</code>
                </div>
              )}

              <button
                onClick={onLogin}
                disabled={loading}
                className="w-full bg-white text-black rounded-full py-4 text-sm uppercase tracking-widest font-medium disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Continue with Google"}
              </button>

              {error && <p className="text-red-400 text-sm">{error}</p>}
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h1 className="text-4xl tracking-[-0.04em]">Set your budget</h1>
                <p className="mt-3 text-white/60 text-sm">
                  AXIS will find the best yields and manage your portfolio automatically.
                </p>
                {session?.email && (
                  <p className="mt-2 text-xs text-white/40">Signed in as {session.email}</p>
                )}
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/50 uppercase tracking-widest text-xs">Budget</span>
                  <span className="text-2xl tracking-[-0.04em]">${budget}</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={10000}
                  step={50}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full accent-[color:var(--color-lime)]"
                />
                <div className="flex justify-between text-[10px] text-white/40 mt-1">
                  <span>$50</span>
                  <span>$10,000</span>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-white/50 mb-3">Risk level</p>
                <div className="flex gap-2">
                  {RISKS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRisk(r)}
                      className={`flex-1 py-2 text-[10px] uppercase tracking-widest rounded-full border ${
                        risk === r
                          ? "bg-white text-black border-white"
                          : "border-white/20 text-white/70"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-white/50 mb-3">Goal</p>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGoal(g)}
                      className={`px-4 py-2 text-[10px] uppercase tracking-widest rounded-full border ${
                        goal === g
                          ? "bg-white text-black border-white"
                          : "border-white/20 text-white/70"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {config && (
                <p className="text-[10px] text-white/30 uppercase tracking-widest">
                  AI: {config.ai.active_provider} · Wallet:{" "}
                  {config.wallet.magic ? "ready" : "pending keys"}
                </p>
              )}

              <button
                onClick={onActivate}
                className="w-full bg-[color:var(--color-lime)] text-black rounded-full py-4 text-sm uppercase tracking-widest font-medium"
              >
                Activate AXIS
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
