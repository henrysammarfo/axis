import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { assertFrontendEnv } from "../lib/env";
import { reportClientError } from "../lib/error-reporting";
import { CustomCursor } from "../components/brand/CustomCursor";
import { MobileBottomNav } from "../components/brand/MobileMenu";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white px-4 font-tight">
      <div className="max-w-md text-center">
        <h1 className="text-[140px] leading-none tracking-[-0.06em]">404</h1>
        <p className="mt-4 text-sm uppercase tracking-[0.1em] text-white/60">Signal lost</p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-white text-black px-6 py-3 text-sm uppercase tracking-widest"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportClientError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white px-4 font-tight">
      <div className="max-w-md text-center">
        <h1 className="text-2xl uppercase tracking-[-0.04em]">System interrupted</h1>
        <p className="mt-2 text-sm text-white/60">The agent hit an exception. Try again or return home.</p>
        <div className="mt-6 flex gap-2 justify-center">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-white text-black px-5 py-2 text-xs uppercase tracking-widest"
          >
            Retry
          </button>
          <a href="/" className="rounded-full border border-white/40 px-5 py-2 text-xs uppercase tracking-widest">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AXIS — Autonomous DeFi Portfolio Agent" },
      {
        name: "description",
        content:
          "AXIS is an AI agent that manages your DeFi portfolio across every chain. Google sign-in, no MetaMask, no gas. Set. Forget. Earn.",
      },
      { name: "author", content: "AXIS" },
      { property: "og:title", content: "AXIS — Set. Forget. Earn." },
      { property: "og:description", content: "Autonomous cross-chain DeFi agent. No wallets. No gas. Just yield." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@axis" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showBottomNav = pathname !== "/";

  useEffect(() => {
    assertFrontendEnv();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CustomCursor />
      <Outlet />
      <Toaster theme="dark" />
      {showBottomNav && <MobileBottomNav />}
    </QueryClientProvider>
  );
}
