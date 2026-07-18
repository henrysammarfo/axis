import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "../components/brand/Logo";
import {
  loginWithGoogle,
  handleOAuthRedirect,
  resumeSession,
  getStoredSession,
  isWalletConfigured,
  isOAuthCallback,
  warmupWalletSdk,
  walletConfigErrors,
} from "../lib/wallet";
import { useAxisConfig, useStrategyPreview } from "../hooks/useAxis";
import { brandHeadMeta } from "../lib/seo";
import {
  GOALS,
  RISKS,
  MIN_BUDGET_USDC,
  MAX_BUDGET_USDC,
  type GoalLabel,
  type RiskLevel,
} from "../lib/strategy";

const RISK_LABEL: Record<RiskLevel, string> = {
  conservative: "Safe",
  moderate: "Balanced",
  aggressive: "Bold",
};

export const Route = createFileRoute("/onboard")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const session = getStoredSession();
    if (session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => brandHeadMeta({
    title: "Get Started — AXIS",
    description: "Sign in with Google and activate your autonomous DeFi agent.",
    path: "/onboard",
  }),
  component: Onboard,
});

function Onboard() {
  const navigate = useNavigate();
  const { data: config, isError: configError, error: configLoadError } = useAxisConfig();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Signing in…");
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState(100);
  const [risk, setRisk] = useState<RiskLevel>("moderate");
  const [goal, setGoal] = useState<GoalLabel>(GOALS[0]);
  const session = getStoredSession();

  const { data: preview } = useStrategyPreview(budget, risk, goal, step === 2);

  useEffect(() => {
    warmupWalletSdk();
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!isOAuthCallback()) return;

      setLoading(true);
      setLoadingLabel("Upgrading account (gasless)…");
      setError(null);
      try {
        const fromOAuth = await handleOAuthRedirect();
        if (!active) return;
        if (fromOAuth) {
          setStep(2);
          return;
        }

        const existing = await resumeSession();
        if (!active) return;
        if (existing) setStep(2);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Login failed");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const onLogin = async () => {
    if (!isWalletConfigured()) {
      setError(`Missing configuration: ${walletConfigErrors().join(", ")}`);
      return;
    }

    setLoading(true);
    setLoadingLabel("Signing in…");
    setError(null);
    try {
      const result = await loginWithGoogle();
      if (result.status === "session") {
        setLoadingLabel("Upgrading account (gasless)…");
        setStep(2);
        setLoading(false);
      }
      // status === "redirecting": page navigates to Google — keep loading state
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      setLoading(false);
    }
  };

  const onActivate = async () => {
    const s = getStoredSession() ?? (await resumeSession());
    if (!s) {
      setError("Session expired. Sign in again.");
      setStep(1);
      return;
    }
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
                  Sign in with Google. Your wallet is created and upgraded automatically —
                  no seed phrase, no MetaMask, no gas for you to fund.
                </p>
              </div>

              {!isWalletConfigured() && (
                <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-200/80">
                  Configure wallet keys before signing in. See{" "}
                  <code className="text-xs">docs/KEYS_SETUP.md</code>
                </div>
              )}

              {configError && (
                <div className="border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300/90">
                  Backend unreachable at {import.meta.env.VITE_API_URL ?? "http://localhost:8000"}.
                  {" "}
                  {configLoadError instanceof Error ? configLoadError.message : "Start the backend server."}
                </div>
              )}

              <button
                type="button"
                onClick={onLogin}
                disabled={loading || !isWalletConfigured()}
                className="w-full bg-white text-black rounded-full py-4 text-sm uppercase tracking-widest font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? loadingLabel : "Continue with Google"}
              </button>

              {error && (
                <div className="border border-red-500/30 bg-red-500/5 p-4 space-y-2">
                  <p className="text-red-300 text-sm leading-relaxed">{error}</p>
                  {/sponsor|refill|agent_wallet/i.test(error) && (
                    <p className="text-xs text-white/45 leading-relaxed">
                      Ops note: top up <code className="text-white/60">AGENT_WALLET</code> with ETH on
                      Arbitrum One. Users never fund their Magic wallet for EIP-7702.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h1 className="text-4xl tracking-[-0.04em]">Build your agent</h1>
                <p className="mt-3 text-white/60 text-sm">
                  Pick a vibe and a goal. AXIS handles the rest. No deposit needed yet — you can add
                  money and start whenever you like.
                </p>
                {session?.email && (
                  <p className="mt-2 text-xs text-white/40">Signed in as {session.email}</p>
                )}
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/50 uppercase tracking-widest text-xs">
                    Starting amount
                  </span>
                  <span className="text-2xl tracking-[-0.04em]">${budget}</span>
                </div>
                <input
                  type="range"
                  min={MIN_BUDGET_USDC}
                  max={MAX_BUDGET_USDC}
                  step={10}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full accent-[color:var(--color-lime)]"
                />
                <div className="flex justify-between text-[10px] text-white/40 mt-1">
                  <span>${MIN_BUDGET_USDC}</span>
                  <span>${MAX_BUDGET_USDC.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-white/50 mb-3">Your vibe</p>
                <div className="flex gap-2">
                  {RISKS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRisk(r)}
                      className={`flex-1 py-2 text-[10px] uppercase tracking-widest rounded-full border ${
                        risk === r
                          ? "bg-white text-black border-white"
                          : "border-white/20 text-white/70"
                      }`}
                    >
                      {RISK_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-white/50 mb-3">Your goal</p>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map((g) => (
                    <button
                      key={g}
                      type="button"
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

              {preview?.plan && (
                <div className="border border-white/10 bg-white/[0.03] p-4 space-y-2 text-sm">
                  <p className="text-[10px] uppercase tracking-widest text-white/45">
                    Here's the plan
                  </p>
                  <p className="text-white/80 leading-relaxed">
                    Put ${preview.plan.deployed_usdc.toFixed(0)} to work
                    {preview.plan.cash_buffer_usdc > 0
                      ? `, keep $${preview.plan.cash_buffer_usdc.toFixed(0)} in reserve`
                      : ""}{" "}
                    · earning about {preview.plan.blended_apy.toFixed(1)}% a year.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={onActivate}
                className="w-full bg-[color:var(--color-lime)] text-black rounded-full py-4 text-sm uppercase tracking-widest font-medium"
              >
                Create my agent
              </button>
              <p className="text-[10px] text-white/30 text-center uppercase tracking-widest">
                Free to set up — no deposit, no signing yet
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
