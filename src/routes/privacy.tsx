import { createFileRoute, Link } from "@tanstack/react-router";
import { FixedLogo, FixedNav } from "../components/brand/FixedChrome";
import { brandHeadMeta } from "../lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    brandHeadMeta({
      title: "Privacy Policy — AXIS",
      description: "How AXIS handles account data, cookies, and on-chain activity.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white font-tight">
      <FixedLogo />
      <FixedNav />
      <article className="mx-auto max-w-2xl px-5 pb-24 pt-36 sm:px-8 sm:pt-44">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--color-lime)]">
          Legal
        </p>
        <h1 className="mt-4 text-4xl tracking-[-0.04em] sm:text-5xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-white/55">Last updated · 24 Sep 2026</p>

        <div className="mt-12 space-y-8 text-[15px] leading-relaxed text-white/70">
          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">Who we are</h2>
            <p>
              AXIS (“we”) operates axis-mainnet.vercel.app. Contact: the project maintainers via the
              public GitHub repository linked from the site.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">What we collect</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Google account email and identifiers via Magic Labs sign-in.</li>
              <li>Wallet / Universal Account addresses you create or link.</li>
              <li>Portfolio preferences (budget, goal, stock-basket plans, waitlist email/region).</li>
              <li>Basic product analytics (page views) if you accept cookies.</li>
              <li>Technical logs needed to run the API (IP for rate limits, error traces).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">What we do not do</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>We do not custody your funds. You own the account keys Magic embeds.</li>
              <li>We do not sell personal data.</li>
              <li>
                We do not treat Robinhood Chain testnet activity as mainnet money transfers.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">Cookies</h2>
            <p>
              Essential cookies keep the session and UI preferences working. Optional analytics
              cookies load only after you accept the cookie banner. You can change your mind by
              clearing site data in the browser.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">On-chain data</h2>
            <p>
              Transactions you authorize appear on public explorers (Arbiscan, Robinhood Chain
              explorers). That data is public by design of the networks — not private AXIS storage.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg tracking-[-0.02em] text-white">Your choices</h2>
            <p>
              You may request deletion of waitlist/email records by contacting the maintainers with
              the email used. On-chain history cannot be erased.
            </p>
          </section>
        </div>

        <p className="mt-14 text-sm text-white/45">
          Also see{" "}
          <Link to="/terms" className="text-white underline underline-offset-4">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
