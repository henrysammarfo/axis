import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, ExternalLink, LogOut } from "lucide-react";
import { Route as AuthenticatedRoute } from "../_authenticated";
import { brandHeadMeta } from "../../lib/seo";
import { useProfile } from "../../hooks/useProfile";
import { AxisAvatar } from "../../components/brand/AxisAvatar";
import { useAxisStatus } from "../../hooks/useAxis";
import { getIdleUsdcBalance, logout, sendUsdcToAddress } from "../../lib/wallet";
import { userFacingError } from "../../lib/user-error";
import { arbiscanBaseUrl, chainDisplayName } from "../../lib/chain";
import { truncateAddress } from "../../lib/api";
import { nameFromEmail } from "../../lib/profile";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () =>
    brandHeadMeta({
      title: "Settings — AXIS",
      description: "Your account, wallet and session.",
      path: "/settings",
      noIndex: true,
    }),
  component: SettingsPage,
});

function WithdrawUsdc({
  uaAddress,
  investedUsdc,
}: {
  uaAddress: string;
  investedUsdc: number;
}) {
  const explorer = arbiscanBaseUrl();
  const [idle, setIdle] = useState<number | null>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    getIdleUsdcBalance(uaAddress)
      .then((n) => {
        if (active) setIdle(n);
      })
      .catch(() => {
        if (active) setIdle(0);
      });
    return () => {
      active = false;
    };
  }, [uaAddress]);

  const available = (idle ?? 0) + Math.max(0, investedUsdc);
  const onSend = async () => {
    const parsed = amount.trim() ? Number(amount) : undefined;
    if (parsed != null && !Number.isFinite(parsed)) {
      toast.error("Amount must be a number");
      return;
    }
    setSending(true);
    try {
      const res = await sendUsdcToAddress({ to, amountUsdc: parsed });
      toast.success(`Sent $${res.amount_usdc.toFixed(2)} USDC`, {
        description: "Check Arbiscan — this one send is signed by you.",
      });
      window.open(`${explorer}/tx/${res.tx_hash}`, "_blank", "noopener,noreferrer");
      setAmount("");
      const next = await getIdleUsdcBalance(uaAddress).catch(() => 0);
      setIdle(next);
    } catch (e) {
      toast.error("Couldn’t send USDC", {
        description: userFacingError(e, "Try again."),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg tracking-[-0.02em]">Withdraw USDC</h2>
      <p className="text-sm text-white/45 leading-relaxed">
        Send idle USDC to MetaMask or an exchange on Arbitrum One. If it’s still in Aave, AXIS pulls
        it out first (no popup). The send itself needs one Magic confirm — AXIS cannot move money to
        another address on its own.
      </p>
      <div className="card-calm p-5 space-y-4">
        <p className="text-sm text-white/70">
          Available · ${available.toFixed(2)}
          {investedUsdc > 0.01 ? ` · $${investedUsdc.toFixed(2)} still in Aave` : ""}
        </p>
        <label className="block space-y-1.5">
          <span className="text-xs text-white/40">Destination (Arbitrum)</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-sm outline-none focus:border-white/30 font-mono"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-white/40">Amount · leave blank to send all</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={available > 0 ? available.toFixed(2) : "10.00"}
            className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-sm outline-none focus:border-white/30"
          />
        </label>
        <button
          type="button"
          onClick={onSend}
          disabled={sending || !to.trim()}
          className="w-full bg-white text-black rounded-full px-5 py-3 text-sm disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send USDC"}
        </button>
      </div>
    </section>
  );
}

function CopyRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-white/[0.06] last:border-b-0">
      <span className="text-sm text-white/50 shrink-0">{label}</span>
      <span className="inline-flex items-center gap-2 min-w-0">
        <code className="text-sm text-white/85 truncate">{value}</code>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-white/40 hover:text-white transition-colors shrink-0"
            aria-label={`Open ${label} in explorer`}
          >
            <ExternalLink size={14} strokeWidth={1.75} />
          </a>
        )}
        <button
          onClick={copy}
          className="text-white/40 hover:text-white transition-colors shrink-0"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
        </button>
      </span>
    </div>
  );
}

function SettingsPage() {
  const { session } = AuthenticatedRoute.useRouteContext();
  const navigate = useNavigate();
  const userId = session.userId;
  const profile = useProfile(userId);
  const { data: status } = useAxisStatus(userId);
  const explorer = arbiscanBaseUrl();
  const chainName = chainDisplayName();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = profile.name?.trim() || nameFromEmail(session.email);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success("Signed out", { description: "You can sign back in any time." });
    } finally {
      navigate({ to: "/" });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-tight">
      <header className="border-b border-white/10">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Link
            to="/dashboard"
            search={{ tab: "overview", chain: "All" }}
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.75} /> Back
          </Link>
          <span className="text-sm text-white/40">Settings</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl sm:text-4xl tracking-[-0.03em]">Settings</h1>
          <p className="mt-2 text-white/55 text-[15px] leading-relaxed">
            Your account, wallet and session — all in one calm place.
          </p>
        </div>

        {/* Identity */}
        <section className="card-calm p-6">
          <div className="flex items-center gap-4">
            <AxisAvatar
              avatar={profile.avatar}
              alt="Your avatar"
              className="h-16 w-16 rounded-full object-cover border border-white/10 bg-white/5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-lg tracking-[-0.02em] truncate">{displayName}</p>
              <p className="text-sm text-white/45 truncate">
                {session.email ?? "Signed in with Google"}
              </p>
            </div>
            <Link
              to="/profile"
              className="text-sm text-[color:var(--color-lime)] hover:brightness-110 transition shrink-0"
            >
              Edit
            </Link>
          </div>
        </section>

        {/* Strategy snapshot */}
        {status && (status.risk_level || status.goal) && (
          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em]">Your strategy</h2>
            <div className="card-calm p-5 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-white/40">Vibe</p>
                <p className="mt-1 text-[15px] capitalize">{status.risk_level ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Goal</p>
                <p className="mt-1 text-[15px]">{status.goal ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Budget</p>
                <p className="mt-1 text-[15px]">${status.budget_usdc ?? 0}</p>
              </div>
            </div>
            <Link
              to="/dashboard"
              search={{ tab: "overview", chain: "All" }}
              className="inline-block text-sm text-white/50 hover:text-white transition-colors"
            >
              Change strategy on the dashboard →
            </Link>
          </section>
        )}

        {/* Wallet */}
        <section className="space-y-3">
          <h2 className="text-lg tracking-[-0.02em]">Wallet</h2>
          <p className="text-sm text-white/45">
            On {chainName}. Your account holds your funds; the deposit address routes money in from
            any chain.
          </p>
          <div className="card-calm px-5 py-1">
            <CopyRow
              label="Account"
              value={truncateAddress(session.uaAddress)}
              href={session.uaAddress ? `${explorer}/address/${session.uaAddress}` : undefined}
            />
            {session.sraAddress && (
              <CopyRow label="Deposit address" value={truncateAddress(session.sraAddress)} />
            )}
            <CopyRow label="User ID" value={session.userId} />
          </div>
        </section>

        <WithdrawUsdc
          uaAddress={session.uaAddress}
          investedUsdc={(status?.positions ?? [])
            .filter(
              (p) =>
                p.status !== "closed" && String(p.protocol || "").toLowerCase().includes("aave"),
            )
            .reduce((sum, p) => sum + Number(p.amount_usdc || 0), 0)}
        />

        {/* Session */}
        <section className="space-y-3">
          <h2 className="text-lg tracking-[-0.02em]">Session</h2>
          <div className="card-calm p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px]">Log out of AXIS</p>
              <p className="text-sm text-white/45">
                Signs you out on this device. Your funds and strategy stay safe.
              </p>
            </div>
            <button
              onClick={onLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 border border-white/15 hover:border-red-400/40 hover:text-red-300 rounded-full px-5 py-2.5 text-sm transition-colors disabled:opacity-50 shrink-0"
            >
              <LogOut size={15} strokeWidth={1.75} />
              {loggingOut ? "Signing out…" : "Log out"}
            </button>
          </div>
        </section>

        {/* Judge proof — easy to find for hackathon / demos */}
        <section className="space-y-3">
          <h2 className="text-lg tracking-[-0.02em]">Judge proof</h2>
          <Link
            to="/proof"
            className="card-calm p-5 flex items-center justify-between gap-4 hover:border-white/20 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-[15px] text-white">UA · EIP-7702 · SRA evidence</p>
              <p className="text-sm text-white/45">
                Live mainnet checklist for Particle, ZeroDev, Magic, and Arbitrum.
              </p>
            </div>
            <span className="text-sm text-[color:var(--color-lime)] shrink-0">Open →</span>
          </Link>
        </section>

        {/* About */}
        <section className="space-y-3">
          <h2 className="text-lg tracking-[-0.02em]">About</h2>
          <div className="card-calm p-5 text-sm text-white/60 space-y-2">
            <p>AXIS — set it, forget it, earn. Your autonomous DeFi agent.</p>
            <div className="flex flex-wrap gap-4 pt-1">
              <Link to="/manifesto" className="text-white/50 hover:text-white transition-colors">
                Manifesto
              </Link>
              <Link to="/proof" className="text-white/50 hover:text-white transition-colors">
                Judge proof
              </Link>
              <Link to="/vault" className="text-white/50 hover:text-white transition-colors">
                Vault
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
