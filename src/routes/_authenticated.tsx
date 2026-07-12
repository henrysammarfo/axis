import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { resumeSession } from "../lib/wallet";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
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
