import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { resumeSession, type WalletSession } from "../lib/wallet";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async (): Promise<{ session: WalletSession }> => {
    // This route is client-only (ssr: false), so children never render during
    // the SSR pass — but beforeLoad's return type still shapes the route context.
    // Return a consistent { session } shape so consumers get a non-optional
    // session type instead of a union.
    if (typeof window === "undefined") {
      return { session: undefined as unknown as WalletSession };
    }
    const session = await resumeSession();
    if (!session) {
      throw redirect({ to: "/onboard" });
    }
    return { session };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return <Outlet />;
}
