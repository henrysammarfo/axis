import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Home,
  Sparkles,
  Layers,
  ShoppingBag,
  LayoutGrid,
  FileText,
  User,
  Settings,
  LogOut,
} from "lucide-react";

const EASE = [0.25, 0.1, 0.25, 1] as const;

const LINKS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/manifesto", label: "Manifesto", icon: FileText },
  { to: "/agent", label: "The Agent", icon: Sparkles },
  { to: "/vault", label: "Vault", icon: Layers },
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/proof", label: "Proof", icon: FileText },
  { to: "/merch", label: "Merch — Soon", icon: ShoppingBag },
] as const;

// Account links only show inside the app (authenticated) area. We detect that
// by route prefix so this component — which also renders on marketing pages —
// never pulls the wallet/Magic bundle just to draw a menu.
const ACCOUNT_LINKS = [
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const APP_PREFIXES = ["/dashboard", "/profile", "/settings", "/proof"];

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inApp = APP_PREFIXES.some((p) => pathname.startsWith(p));
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      const { logout } = await import("../../lib/wallet");
      await logout();
    } catch {
      /* ignore — clearing local session below is the important part */
    } finally {
      onClose();
      navigate({ to: "/" });
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Main menu"
          className="fixed inset-0 z-[100] bg-black text-white font-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          <div className="flex items-center justify-between px-4 lg:px-8 h-16 border-b border-white/10">
            <span className="text-[10px] uppercase tracking-widest text-white/50">Menu / AXIS</span>
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="min-h-11 min-w-11 grid place-items-center rounded-full border border-white/20"
            >
              <X size={22} strokeWidth={1.75} />
            </button>
          </div>
          <nav className="px-4 lg:px-12 py-8 flex flex-col">
            {LINKS.map(({ to, label, icon: Icon }, i) => (
              <motion.div
                key={to}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05, duration: 0.4, ease: EASE }}
              >
                <Link
                  to={to}
                  onClick={onClose}
                  className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-5 border-b border-white/10 min-h-14"
                  activeProps={{ className: "text-[color:var(--color-lime)]" }}
                >
                  <Icon size={22} strokeWidth={1.75} className="shrink-0" />
                  <span className="text-3xl sm:text-5xl uppercase tracking-[-0.04em] truncate">
                    {label}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </Link>
              </motion.div>
            ))}

            {inApp && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Account</p>
                {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={onClose}
                    className="group flex items-center gap-4 py-4 border-b border-white/10 min-h-12"
                    activeProps={{ className: "text-[color:var(--color-lime)]" }}
                  >
                    <Icon size={20} strokeWidth={1.75} className="shrink-0" />
                    <span className="text-2xl tracking-[-0.02em]">{label}</span>
                  </Link>
                ))}
                <button
                  onClick={onLogout}
                  disabled={loggingOut}
                  className="group flex items-center gap-4 py-4 min-h-12 w-full text-left text-white/70 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  <LogOut size={20} strokeWidth={1.75} className="shrink-0" />
                  <span className="text-2xl tracking-[-0.02em]">
                    {loggingOut ? "Signing out…" : "Log out"}
                  </span>
                </button>
              </div>
            )}
          </nav>
          <div className="absolute bottom-6 left-4 right-4 flex justify-between text-[10px] uppercase tracking-widest text-white/40">
            <span>AXIS (R) 2026</span>
            <span>Set. Forget. Earn.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const BOTTOM = [
  { to: "/", label: "Home", icon: Home },
  { to: "/vault", label: "Vault", icon: Layers },
  { to: "/dashboard", label: "Portfolio", icon: LayoutGrid },
  { to: "/agent", label: "Agent", icon: Sparkles },
  { to: "/merch", label: "Merch", icon: ShoppingBag },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-5">
        {BOTTOM.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className={`min-h-14 flex flex-col items-center justify-center gap-1 py-2 text-[9px] uppercase tracking-widest ${
                  active ? "text-[color:var(--color-lime)]" : "text-white/60"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={20} strokeWidth={1.75} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
