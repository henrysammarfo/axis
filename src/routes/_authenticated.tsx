import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireSession } from "../lib/auth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    const session = requireSession();
    return { session };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return <Outlet />;
}
