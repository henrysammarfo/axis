# AXIS — production hygiene (20)

> Status as of 24 Sep 2026. Fail-closed honesty.

| # | Task | Status | Where |
|---|------|--------|--------|
| 1 | Privacy policy | Done | `/privacy` · `src/routes/privacy.tsx` |
| 2 | Terms & conditions | Done | `/terms` · `src/routes/terms.tsx` |
| 3 | Remove frontend secrets | Done (publishable only) | `src/lib/env.ts` — only `VITE_*` publishables; Magic secret stays backend |
| 4 | Enforce HTTPS | Done | Root `vercel.json` HSTS + HTTP→HTTPS redirect |
| 5 | Cookie consent banner | Done | `CookieConsent` + analytics gated |
| 6 | Meta titles/descriptions | Done | `src/lib/seo.ts` + per-route `head` |
| 7 | Social preview image | Done | `public/og.png` via `brandHeadMeta` |
| 8 | Favicon | Done | `public/favicon.svg` + `.ico` |
| 9 | Sitemap and robots.txt | Done | `public/sitemap.xml`, `public/robots.txt` |
| 10 | Image alt text | Improved | Basket logos + chain marks labeled; decorative empties remain where intentional |
| 11 | Image compression | Partial | Landing uses CDN webp `q=85`; no local imagemin pipeline yet |
| 12 | Page load speed check | Done | `@vercel/speed-insights` after consent; router preload intent |
| 13 | Color contrast fixes | Improved | Baskets / legal use ≥ white/55 body; lime on black for CTAs |
| 14 | Mobile responsiveness | Done | Existing `MobileMenu` / bottom nav |
| 15 | Custom 404 page | Done | `__root.tsx` `NotFoundComponent` |
| 16 | Broken link fixes | Done | Footer Privacy + Terms are real links |
| 17 | Form validation | Improved | Waitlist email regex + honeypot |
| 18 | Spam protection | Improved | Waitlist `8/minute` + honeypot field |
| 19 | Analytics setup | Done | `@vercel/analytics` after cookie accept |
| 20 | Single clear CTA | Improved | Landing outro + onboard; baskets step 1–2–3 |

## Network seal

- **Live money** = Arbitrum One (42161) — Overview tab
- **Practice stocks** = RH public testnet (46630) — Baskets tab, always labeled
- No silent OFT / invent fills across the gap
