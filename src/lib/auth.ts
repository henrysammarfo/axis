import { redirect } from "@tanstack/react-router";
import { getStoredSession, type WalletSession } from "./wallet";

export function isAuthenticated(): boolean {
  const session = getStoredSession();
  return Boolean(session?.userId && session?.uaAddress && session?.didToken);
}

export function requireSession(): WalletSession {
  const session = getStoredSession();
  if (!session?.userId || !session?.uaAddress || !session?.didToken) {
    throw redirect({ to: "/onboard" });
  }
  return session;
}
