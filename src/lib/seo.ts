/** Shared site URL + SEO helpers for head meta. */

export const SITE_NAME = "AXIS";
export const SITE_TAGLINE = "Set. Forget. Earn.";
export const SITE_DESCRIPTION =
  "AXIS is an AI agent that manages your DeFi portfolio across every chain. Google sign-in, no MetaMask, no gas.";

/** Canonical production origin — override with VITE_SITE_URL if needed. */
export function siteUrl(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.toString().trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "https://axis-mainnet.vercel.app";
}

export function absoluteUrl(path = "/"): string {
  const base = siteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const DEFAULT_OG_IMAGE = absoluteUrl("/og.png");

export function brandHeadMeta(opts?: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}) {
  const title = opts?.title ?? `${SITE_NAME} — Autonomous DeFi Portfolio Agent`;
  const description = opts?.description ?? SITE_DESCRIPTION;
  const url = absoluteUrl(opts?.path ?? "/");
  const image = opts?.image ?? DEFAULT_OG_IMAGE;

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "author", content: SITE_NAME },
      { name: "theme-color", content: "#000000" },
      { name: "color-scheme", content: "dark" },
      {
        name: "robots",
        content: opts?.noIndex ? "noindex, nofollow" : "index, follow",
      },
      { name: "application-name", content: SITE_NAME },
      { name: "apple-mobile-web-app-title", content: SITE_NAME },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: `${SITE_NAME} — ${SITE_TAGLINE}` },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: `${SITE_NAME} — ${SITE_TAGLINE}` },
    ],
    links: [
      { rel: "canonical", href: url },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  };
}
