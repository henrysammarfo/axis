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
import { useAxisConfig } from "../hooks/useAxis";
import { brandHeadMeta } from "../lib/seo";

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

const GOALS = ["Maximize yield", "Grow steadily", "Protect my money"] as const;
const RISKS = ["conservative", "moderate", "aggressive"] as const;

function Onboard() {
  const navigate = useNavigate();
  const { data: config, isError: configError, error: configLoadError } = useAxisConfig();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Signing in…");
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState(500);
  const [risk, setRisk] = useState<(typeof RISKS)[number]>("moderate");
  const [goal, setGoal] = useState<string>(GOALS[0]);
  const session = getStoredSession();

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
