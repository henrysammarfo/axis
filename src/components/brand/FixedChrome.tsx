import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { Menu, ShoppingBag } from "lucide-react";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";

const EASE = [0.25, 0.1, 0.25, 1] as const;

export function FixedLogo() {
  return (
    <motion.div
      className="fixed pointer-events-auto z-20 text-white mix-exclusion"
      style={{ top: 16, left: 16 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <Link to="/" aria-label="AXIS home">
        <Logo className="w-[124px] sm:w-[266px] lg:w-[355px] sm:ml-4 lg:ml-4 sm:mt-4 lg:mt-4" />
      </Link>
    </motion.div>
  );
}

export function FixedNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.nav
        className="fixed pointer-events-auto z-20 text-white mix-exclusion flex items-center justify-between h-[30px]"
        style={{ top: 16, right: 16 }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
      >
        <div className="lg:mr-12 hidden sm:block font-tight text-[15px] uppercase">
          <Link to="/manifesto">ABOUT</Link>
        </div>
        <div className="flex items-center gap-5 lg:gap-[50px] lg:ml-8 lg:mr-8 lg:mt-4">
          <button
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="min-h-11 min-w-11 grid place-items-center -m-2"
          >
            <Menu size={30} strokeWidth={2.5} className="hidden lg:block" />
            <Menu size={24} strokeWidth={2.5} className="lg:hidden" />
          </button>
          <Link
            to="/merch"
            className="font-tight text-[13px] lg:text-[15px] uppercase inline-flex items-center gap-1"
          >
            <ShoppingBag size={16} strokeWidth={2} className="hidden lg:inline" /> [ MERCH ]
          </Link>
        </div>
      </motion.nav>
      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function FixedFooter({ id = "outro-footer" }: { id?: string }) {
  return (
    <div
      id={id}
      className="fixed pointer-events-auto z-20 text-white mix-exclusion font-tight uppercase flex flex-wrap gap-6 lg:gap-[48px] justify-between lg:justify-start w-[calc(100%-32px)] lg:w-auto"
      style={{ left: 16, bottom: 24 }}
    >
      <span className="text-[11px] lg:text-[13px] tracking-[-0.02em] pointer-events-none">
        AXIS (R) 2026
      </span>
      <Link
        to="/privacy"
        className="text-[11px] lg:text-[13px] tracking-[-0.02em] hover:opacity-80"
      >
        Privacy
      </Link>
      <Link
        to="/terms"
        className="text-[11px] lg:text-[13px] tracking-[-0.02em] hover:opacity-80"
      >
        Terms
      </Link>
    </div>
  );
}
