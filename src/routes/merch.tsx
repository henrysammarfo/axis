import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FixedLogo, FixedNav, FixedFooter } from "../components/brand/FixedChrome";
import { Mail, Check, Package, Timer } from "lucide-react";
import { brandHeadMeta } from "../lib/seo";

const MERCH = [
  {
    id: "m1",
    name: '"PROMPT" Wordmark Hoodie',
    drop: "Q1",
    status: "Coming Soon",
    image: "/merch/prompt-hoodie.png",
  },
  {
    id: "m2",
    name: '"PROMPT" Essential Tee',
    drop: "Q1",
    status: "Waitlist",
    image: "/merch/prompt-tee.png",
  },
  {
    id: "m3",
    name: '"PROMPT" Distressed Cap',
    drop: "Q2",
    status: "Coming Soon",
    image: "/merch/prompt-cap.png",
  },
  {
    id: "m4",
    name: '"PROMPT" Archive Zip',
    drop: "Q2",
    status: "Preview",
    image: "/merch/prompt-zip.png",
  },
] as const;

export const Route = createFileRoute("/merch")({
  head: () =>
    brandHeadMeta({
      title: "Merch — Coming Soon — AXIS",
      description: "Wear the agent. Waitlist open.",
      path: "/merch",
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
          {MERCH.map((item, i) => (
            <div
              key={item.id}
              className="group bg-black text-white flex flex-col relative overflow-hidden"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-[#f4f4f4]">
                <img
                  src={item.image}
                  alt={`${item.name} — PROMPT by AXIS`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-4 text-black">
                  <span className="text-[10px] uppercase tracking-widest bg-white/70 backdrop-blur px-2 py-1 rounded-full">
                    {String(i + 1).padStart(2, "0")} / {item.drop}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest bg-[color:var(--color-lime)] text-black px-2 py-1 rounded-full">
                    {item.status}
                  </span>
                </div>
              </div>
              <div className="p-5 sm:p-6 flex items-center justify-between gap-3">
                <div className="text-base sm:text-lg uppercase tracking-[-0.03em] leading-tight">
                  {item.name}
                </div>
                <Timer size={16} strokeWidth={1.75} className="shrink-0 text-white/40" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <FixedFooter />
    </div>
  );
}
