import { createFileRoute, Link } from "@tanstack/react-router";
import { FixedLogo, FixedNav } from "../components/brand/FixedChrome";
import { brandHeadMeta } from "../lib/seo";

export const Route = createFileRoute("/terms")({
  head: () =>
    brandHeadMeta({
      title: "Terms & Conditions — AXIS",
      description: "Terms of use for AXIS — Set. Forget. Earn.",
      path: "/terms",
    }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white font-tight">
      <FixedLogo />
      <FixedNav />
      <article className="mx-auto max-w-2xl px-5 pb-24 pt-36 sm:px-8 sm:pt-44">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--color-lime)]">
          Legal
        </p>
        <h1 className="mt-4 text-4xl tracking-[-0.04em] sm:text-5xl">Terms &amp; Conditions</h1>
        <p className="mt-3 text-sm text-white/55">Last updated · 24 Sep 2026</p>

        <div className="mt-12 space-y-8 text-[15px] leading-relaxed text-white/70">
          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">Service</h2>
            <p>
              AXIS provides software that helps you interact with DeFi protocols on Arbitrum One and,
              separately, labeled Robinhood Chain public-testnet stock-token demos. AXIS is not a
              bank, broker-dealer, or custodian.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">Networks stay separate</h2>
            <p>
              <strong className="font-medium text-white">Live money</strong> means Arbitrum One
              (chain 42161) yield paths.{" "}
              <strong className="font-medium text-white">Practice stocks</strong> means Robinhood
              Chain public testnet (46630). Testnet tokens have no cash value. AXIS will not treat a
              testnet hold as a mainnet fill, and will not silently bridge or invent transfers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">Risks</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Smart-contract, oracle, and protocol risk on any chain you use.</li>
              <li>Tokenized stock instruments are not Nasdaq share certificates.</li>
              <li>Geo and issuer restrictions may block products; self-attestation is not KYC.</li>
              <li>Past yields are not guarantees. You can lose funds.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">Eligibility</h2>
            <p>
              You must be legally able to use the product where you live. US persons and other
              restricted users may be blocked from certain issuer products — AXIS labels this; it
              does not replace legal advice.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">No warranty</h2>
            <p>
              Software is provided “as is.” To the fullest extent allowed by law, AXIS disclaims
              warranties of merchantability, fitness, and non-infringement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">Contact</h2>
            <p>Questions: maintainers via the public AXIS GitHub repository.</p>
          </section>
        </div>

        <p className="mt-14 text-sm text-white/45">
          Also see{" "}
          <Link to="/privacy" className="text-white underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
