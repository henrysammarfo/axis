import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "axis_cookie_consent";

type Consent = "accepted" | "rejected" | null;

function readConsent(): Consent {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  if (v === "accepted" || v === "rejected") return v;
  return null;
}

/** Essential UI works without this. Analytics only loads after accept. */
export function CookieConsent() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
  }, []);

  if (!ready || consent) return null;

  const choose = (next: "accepted" | "rejected") => {
    window.localStorage.setItem(KEY, next);
    setConsent(next);
    window.dispatchEvent(new CustomEvent("axis-cookie-consent", { detail: next }));
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-black/95 p-4 backdrop-blur-xl sm:p-5"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-[13px] leading-relaxed text-white/70">
          We use essential cookies to run AXIS. Optional analytics help us see what breaks — only if
          you accept.{" "}
          <Link to="/privacy" className="text-white underline underline-offset-2">
            Privacy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="rounded-full border border-white/25 px-4 py-2 text-[11px] uppercase tracking-widest text-white/80 hover:border-white/50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="rounded-full bg-white px-4 py-2 text-[11px] uppercase tracking-widest text-black"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export function useAnalyticsAllowed(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const sync = () => setOk(readConsent() === "accepted");
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) sync();
    };
    const onCustom = () => sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener("axis-cookie-consent", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("axis-cookie-consent", onCustom);
    };
  }, []);
  return ok;
}
