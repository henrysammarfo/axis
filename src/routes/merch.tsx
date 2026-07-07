import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FixedLogo, FixedNav, FixedFooter } from "../components/brand/FixedChrome";
import { Logo } from "../components/brand/Logo";
import { Mail, Check, Package, Timer } from "lucide-react";

const MERCH = [
  { id: "m1", name: "AXIS Wordmark Hoodie", drop: "Q1", status: "Coming Soon" },
  { id: "m2", name: "Set. Forget. Earn. Tee", drop: "Q1", status: "Waitlist" },
  { id: "m3", name: "Circled R Cap", drop: "Q2", status: "Coming Soon" },
  { id: "m4", name: "Archive Zip", drop: "Q2", status: "Preview" },
] as const;

export const Route = createFileRoute("/merch")({
  head: () => ({
    meta: [
      { title: "Merch — Coming Soon — AXIS" },
      { name: "description", content: "AXIS merch drops soon. Hoodies, tees, caps — join the waitlist." },
      { property: "og:title", content: "AXIS Merch — Coming Soon" },
      { property: "og:description", content: "Wear the agent. Waitlist open." },
    ],
  }),
  component: MerchPage,
});

function MerchPage() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white font-tight overflow-x-hidden">
      <FixedLogo />
      <FixedNav />

      <div className="pt-[160px] sm:pt-[200px] lg:pt-[240px] px-4 lg:px-12">
        <div className="flex items-center gap-3 text-white/50 text-[10px] sm:text-xs uppercase tracking-[0.2em] mb-6 sm:mb-8">
          <Package size={14} strokeWidth={1.75} />
          <span>Archive / 2026 Drop</span>
        </div>
        <h1 className="text-[44px] sm:text-[80px] lg:text-[160px] leading-[0.88] tracking-[-0.05em]">
          Merch.<br />
          <span className="text-[color:var(--color-lime)]">Coming soon.</span>
        </h1>
        <p className="mt-6 sm:mt-10 max-w-[560px] text-sm sm:text-base lg:text-lg text-white/70 leading-snug">
          Hoodies, tees, and caps built from the AXIS archive. First drop ships when
          the agent hits $10M in managed positions. Join the waitlist — earliest
          signups get the drop before it goes public.
        </p>

        {/* Waitlist */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) setJoined(true);
          }}
          className="mt-10 sm:mt-14 flex flex-col sm:flex-row gap-3 max-w-[560px]"
        >
          <div className="flex-1 flex items-center gap-3 border border-white/20 rounded-full px-5 py-4 bg-white/5">
            <Mail size={18} strokeWidth={1.75} className="shrink-0 text-white/50" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@axis.xyz"
              className="bg-transparent flex-1 min-w-0 outline-none text-sm sm:text-base placeholder:text-white/30"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 bg-white text-black rounded-full px-6 sm:px-8 py-4 text-xs sm:text-sm uppercase tracking-widest inline-flex items-center justify-center gap-2"
          >
            {joined ? (<><Check size={16} strokeWidth={2.25} /> On the list</>) : "Join waitlist"}
          </button>
        </form>
      </div>

      {/* Preview grid */}
      <div className="mt-24 sm:mt-40 px-4 lg:px-12 pb-[160px] sm:pb-[220px]">
        <div className="flex items-center justify-between mb-6 sm:mb-10">
          <div className="text-white/50 text-[10px] sm:text-xs uppercase tracking-[0.2em]">Preview / v1 pieces</div>
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-[color:var(--color-lime)] inline-flex items-center gap-2">
            <Timer size={14} strokeWidth={1.75} /> Not for sale yet
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10">
          {MERCH.map((item, i) => {
            const dark = i % 2 === 0;
            return (
              <div
                key={item.id}
                className={`${dark ? "bg-black text-white" : "bg-white text-black"} p-6 sm:p-8 min-h-[320px] sm:min-h-[380px] flex flex-col justify-between relative`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[10px] uppercase tracking-widest opacity-60">
                    {String(i + 1).padStart(2, "0")} / {item.drop}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest opacity-60">${item.price}</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-8">
                  <Logo className="w-[55%] max-w-[220px]" />
                </div>
                <div>
                  <div className="text-lg sm:text-xl uppercase tracking-[-0.03em] leading-tight">{item.name}</div>
                  <div className={`mt-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-widest border ${dark ? "border-white/30" : "border-black/30"} px-3 py-1 rounded-full opacity-80`}>
                    {item.status}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <FixedFooter />
    </div>
  );
}
