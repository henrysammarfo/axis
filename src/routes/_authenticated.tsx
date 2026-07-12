import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { resumeSession } from "../lib/wallet";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
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
