import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HeroVideos } from "../components/scroll/HeroVideos";
import { FixedLogo, FixedNav, FixedFooter } from "../components/brand/FixedChrome";
import { ScatteredGrid } from "../components/scroll/ScatteredGrid";
import { brandHeadMeta } from "../lib/seo";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const IMAGES = [
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_104530_521b2f85-c0f3-4d0e-9704-b578315b4cb9.png&w=1920&q=85",
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103711_76ccdb8b-5043-4f47-9c54-4379713393ea.png&w=1920&q=85",
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103728_394f6a1b-85e2-4386-a4f6-408472a0a5b7.png&w=1920&q=85",
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103739_86743e0e-16a7-4bee-bf38-dd67985344dc.png&w=1920&q=85",
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103748_b2215dc8-a3a7-470d-b19a-5b87fa7d0c37.png&w=1920&q=85",
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103758_e919ce72-5c9d-4b87-9be6-d7647b34825c.png&w=1920&q=85",
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103808_013583d0-3386-4547-9832-37c7d8edb3ac.png&w=1920&q=85",
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103937_a0c49d0a-33eb-4ead-aea6-c1baf241acbc.png&w=1920&q=85",
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_103956_d18ed8fd-7b6f-4b86-91f9-20010fe38670.png&w=1920&q=85",
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260629_104034_ba5a9963-87ff-4008-a545-6bd686c088b5.png&w=1920&q=85",
];

const SYMBOLS = ["8", "$", "^^", "%", "/"];
const EASE = [0.25, 0.1, 0.25, 1] as const;

export const Route = createFileRoute("/")({
  head: () =>
    brandHeadMeta({
      title: "AXIS — Autonomous DeFi Portfolio Agent",
      description:
        "Set a budget. Set a goal. AXIS executes DeFi strategy across every chain. No wallets. No gas.",
      path: "/",
    }),
  component: Index,
});

function Index() {
  const spacerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const buyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState("8");
  const lastSym = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const spacer = spacerRef.current;
    const panel = panelRef.current;
    const wrap = wrapRef.current;
    const overlay = overlayRef.current;
    const info = infoRef.current;
    const buy = buyRef.current;
    const footer = footerRef.current;
    if (!spacer || !panel || !wrap || !overlay || !info || !buy || !footer) return;

    const setSizes = () => {
      const vh = window.innerHeight;
      const maxScroll = Math.max(0, wrap.scrollHeight - vh);
      spacer.style.height = `${vh + maxScroll + 2 * vh}px`;
      return { vh, maxScroll };
    };
    let { vh, maxScroll } = setSizes();

    const onResize = () => {
      ({ vh, maxScroll } = setSizes());
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const canvas = canvasRef.current;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const outroOffset = isDesktop ? 166 : 132;

    const tick = () => {
      const y = window.scrollY;
      if (y <= vh) {
        // phase 1: panel slides up
        panel.style.transform = `translateY(${vh - y}px)`;
        wrap.style.transform = "translateY(0px)";
        overlay.style.opacity = "0";
        info.style.transform = "translateY(0px)";
        buy.style.transform = "scale(0)";
        footer.style.opacity = "0";
        if (canvas) canvas.style.visibility = "visible";
      } else if (y <= vh + maxScroll) {
        panel.style.transform = "translateY(0px)";
        wrap.style.transform = `translateY(${-(y - vh)}px)`;
        overlay.style.opacity = "0";
        info.style.transform = "translateY(0px)";
        buy.style.transform = "scale(0)";
        footer.style.opacity = "0";
        if (canvas) canvas.style.visibility = "hidden";
      } else {
        panel.style.transform = "translateY(0px)";
        wrap.style.transform = `translateY(${-maxScroll}px)`;
        const p = Math.min(1, (y - vh - maxScroll) / (vh - 100));
        overlay.style.opacity = `${p}`;
        info.style.transform = `translateY(${-outroOffset * p}px)`;
        buy.style.transform = `scale(${p})`;
        footer.style.opacity = `${p}`;
      }

      // symbol randomizer (throttled 80ms)
      const now = performance.now();
      if (now - lastSym.current > 80) {
        lastSym.current = now;
        if (y > 100 && Math.random() > 0.85) {
          setSymbol(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      id="scroll-spacer"
      ref={spacerRef}
      className="relative select-none bg-white"
      style={{ height: "500vh", cursor: "none" }}
    >
      <HeroVideos />

      <FixedLogo />
      <FixedNav />

      {/* Caption */}
      <motion.div
        className="fixed pointer-events-none z-20 text-white mix-exclusion font-tight"
        style={{
          left: 16,
          top: 118,
          fontSize: 12,
          lineHeight: "140%",
          maxWidth: "calc(100vw - 32px)",
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
      >
        <div className="lg:pl-4 lg:pt-[126px] lg:max-w-[692px]">
          AXIS is an autonomous portfolio agent — UXmaxx Arbitrum bounty winner. Sign in with
          Google, set a budget, name a goal. AXIS puts USDC to work on Arbitrum today; Robinhood
          Chain stock-token baskets are next. No seed phrases, no gas modals, no chain switching.
          After login you never sign a transaction again.
        </div>
      </motion.div>

      {/* Product info */}
      <motion.div
        ref={infoRef}
        id="outro-info"
        className="fixed pointer-events-none z-20 text-white mix-exclusion font-tight flex flex-col items-center"
        style={{ right: 16, bottom: 48, width: 252 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.45 }}
      >
        <div className="lg:w-[330px] lg:mr-4 lg:mb-8 mb-3 flex flex-col items-start w-full">
          <div className="relative w-5 h-5 lg:w-[30px] lg:h-[30px] mb-3 lg:mb-4">
            <svg viewBox="0 0 40 40" className="w-full h-full">
              <circle cx="20" cy="20" r="18.75" fill="none" stroke="#fff" strokeWidth="2.5" />
            </svg>
            <span
              id="circle-symbol"
              className="absolute inset-0 flex items-center justify-center uppercase"
              style={{ fontSize: "10px", letterSpacing: "-0.04em" }}
            >
              {symbol}
            </span>
          </div>
          <div className="text-[20px] lg:text-[30px] leading-none text-center uppercase w-full">
            ARCHIVE COLLECTION
            <br />
            &ldquo;AXIS v1&rdquo;
          </div>
        </div>
        <div className="text-[60px] lg:text-[80px] leading-none text-center w-full">$97,33</div>
      </motion.div>

      {/* View button */}
      <div
        ref={buyRef}
        id="outro-buy"
        className="fixed pointer-events-none z-20 mix-exclusion flex items-center justify-center"
        style={{
          right: 16,
          bottom: 60,
          left: 16,
          height: 100,
          background: "#fff",
          borderRadius: 1335,
          transformOrigin: "right bottom",
          transform: "scale(0)",
        }}
      >
        <Link
          to="/onboard"
          className="font-tight text-white pointer-events-auto"
          style={{ fontSize: 56, letterSpacing: "-0.04em", mixBlendMode: "exclusion" }}
          aria-label="Start with Google — onboard to AXIS"
        >
          Start
        </Link>
      </div>

      {/* Black panel */}
      <div
        ref={panelRef}
        className="fixed inset-0 bg-black z-10"
        style={{ transform: "translateY(100vh)" }}
      >
        <div ref={wrapRef} className="w-full" style={{ paddingTop: "min(400px, 40vh)" }}>
          <ScatteredGrid
            items={IMAGES.length}
            render={(i) => (
              <img
                src={IMAGES[i]}
                alt={`AXIS brand still ${i + 1}`}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            )}
          />
          <div className="h-[40vh]" />
        </div>
      </div>

      {/* White overlay */}
      <div
        ref={overlayRef}
        id="outro-overlay"
        className="fixed inset-0 pointer-events-none z-[12] bg-white"
        style={{ opacity: 0 }}
      />

      <div ref={footerRef} style={{ opacity: 0 }}>
        <FixedFooter />
      </div>
    </div>
  );
}
