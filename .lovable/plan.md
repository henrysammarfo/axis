# AXIS Brand + prmpt-Style Multi-Page Build

Building a full brand experience for **AXIS** (AI DeFi Portfolio Agent) using the exact scroll-driven "prmpt" archive/fashion template aesthetic across every page. The visual system doubles as merch-ready branding (hoodies, tees, stickers).

## Brand System

**Name:** AXIS — "Set. Forget. Earn."
**Logo:** Custom wordmark `AXIS` with circled ® mark (SVG, mimicking prmpt's wordmark+glyph structure). Monospaced/geometric sans, heavy tracking-tight. Will be exported as SVG asset for merch reuse.
**Palette:** Pure black `#000`, pure white `#FFF`, one accent (electric lime `#D8FF3C`) for state/CTA — matches archive/streetwear feel and prints well on garments.
**Type:** Inter Tight 500 (loaded via `<link>` in `__root.tsx` head, per Tailwind v4 rules — no CSS @import of remote URLs).
**Iconography:** `lucide-react` (already premium, tree-shaken, consistent stroke) used at 1.5–2.5px stroke to match template's line weight. Icons: Wallet, Sparkles, TrendingUp, Shield, Zap, ArrowUpRight, CircleDot, Menu, ShoppingBag.
**Motion:** `mix-blend-mode: exclusion` overlays, RAF-driven scroll, GSAP ScrollTrigger, Framer Motion entrance stagger (logo 0s → nav .15s → caption .3s → product .45s).

## Routes (TanStack Start, file-based)

```
src/routes/
  __root.tsx              → shared shell: cursor, logo, nav, footer, Inter Tight font link
  index.tsx               → HERO + GALLERY scroll experience (full prmpt template, re-themed to AXIS)
  manifesto.tsx           → "ABOUT" — long-form scroll-jacked type essay on autonomous DeFi
  agent.tsx               → How the AI agent works (video BG + scattered grid of protocol logos)
  vault.tsx               → Product/collection page — 10 "strategy cards" in the scattered grid layout
  merch.tsx               → Hoodies/tees archive — same gallery pattern with garment renders
  dashboard.tsx           → Signed-in portfolio dashboard (see below)
  _authenticated.tsx      → layout gate (visual only for now; auth wired later)
```

Every route gets its own `head()` with unique title/description/og — no reused metadata.

## Landing (`/`) — Full Template Implementation

Implemented exactly per spec:
- Custom cursor (desktop only, 48px circle w/ AXIS glyph, mix-blend exclusion)
- Two-video hero with cursor-scrubbed playback, dead-zone, `!video.seeking` guard
- Mobile: auto-alternating video playback
- Overlaid UI: AXIS logo (top-left), ABOUT + menu + [CART] (top-right), caption block, product info (bottom-right circle symbol randomizer, "ARCHIVE COLLECTION / AXIS v1", price)
- Black panel slides up via GSAP ScrollTrigger, contains scattered 2/3/4-col grid of 10 images with per-frame scale enter/exit
- White outro overlay + "view" pill CTA + fixed footer "AXIS (R) 2026 / PRIVACY POLICY"
- Uses provided CloudFront videos + 10 image URLs as-is for template fidelity

## Dashboard (`/dashboard`) — Archive-Styled DeFi Cockpit

Same visual grammar (black bg, Inter Tight, exclusion blends, circle glyphs, oversized numerics) applied to a functional layout:

- **Top bar:** AXIS logo, "PORTFOLIO / v1", wallet chip (`Wallet` icon + truncated 0x…)
- **Hero stat:** oversized balance `$12,483.22` (110px Inter Tight) with delta chip
- **Left rail:** circle-numbered nav — 01 Overview, 02 Positions, 03 Activity, 04 Agent Log, 05 Settings
- **Grid (2/3/4 col scattered layout reused):** cards for
  - Active strategies per chain (Arbitrum, Base, Optimism) with chain glyph
  - Weekly yield sparkline (custom SVG, no chart lib bloat)
  - Agent thoughts feed (streamed messages, `Sparkles` icon)
  - Cross-chain deposit address (ZeroDev SRA) w/ copy
  - Budget/goal setter (slider + goal chips)
  - Recent tx list w/ chain badges
- **Footer:** same PRMPT-style fixed exclusion footer

All cards use the same `bp-card` scale-in/out on scroll for continuity with the landing gallery.

## Subpages Design Consistency

Every subpage follows the same rules:
- Fixed exclusion-blend nav + logo + footer from `__root.tsx`
- One "hero moment" (video, oversized type, or big glyph)
- Scattered grid section reusing the `buildLayout(count, cols)` algorithm
- White outro overlay + pill CTA leading to `/dashboard`

## Technical Details

- `src/routes/__root.tsx`: add Inter Tight `<link>` to head, keep `<Outlet />`, set real AXIS metadata (replace "Lovable App" defaults), fixed cursor + nav + footer components rendered here.
- `src/styles.css`: add `.bp-card { will-change: transform }` + reduced-motion rule, keep existing tokens, add `--accent: oklch(...)` for lime.
- New components:
  - `src/components/brand/Logo.tsx` — AXIS SVG wordmark (reusable, sized via prop)
  - `src/components/brand/CustomCursor.tsx`
  - `src/components/brand/FixedChrome.tsx` — logo+nav+footer wrapper
  - `src/components/scroll/HeroVideos.tsx` — dual-video cursor scrubber + RAF logic
  - `src/components/scroll/ScatteredGrid.tsx` — reusable gallery w/ `buildLayout` + per-frame scale
  - `src/components/scroll/OutroOverlay.tsx`
  - `src/components/dashboard/*` — stat, sparkline, agent-feed, sra-card, budget-setter
- Deps to add: `gsap`, `@gsap/react`, `motion` (Framer). `lucide-react` already present.
- No backend yet — dashboard uses static mocked data. Lovable Cloud can be enabled later when wiring real wallet/agent.

## Merch-Readiness

Logo SVG saved to `src/components/brand/Logo.tsx` uses only two paths (wordmark + circled ®), no gradients — prints clean on cotton at any size. Same file can be exported directly for hoodie/tee production. Accent lime chosen for high-visibility screen printing.

## What I'm NOT doing this pass

- No auth wiring (Magic/Particle/ZeroDev SDKs) — pure frontend brand shell first.
- No real on-chain data — mocked for dashboard.
- No CMS — content hard-coded in route files.

Ready to build once approved.
