/**
 * Magic + Particle UA + ZeroDev SRA wallet integration.
 * Requires VITE_* env vars — see docs/KEYS_SETUP.md
 *
 * Auth persistence: Magic SDK (per-device) + AXIS backend (cross-device profile).
 * Session state lives in memory only — restored via resumeSession() on each visit.
 */

import { Magic } from "magic-sdk";
import { OAuthExtension } from "@magic-ext/oauth2";
import type { MagicUserMetadata } from "@magic-sdk/types";
import { axisApi } from "./api";
import { arbitrumChainId, ARBITRUM_SEPOLIA_CHAIN_ID } from "./chain";
import { isFrontendFullyConfigured, missingFrontendEnv } from "./env";

export type WalletSession = {
  userId: string;
  email?: string;
  uaAddress: string;
  sraAddress?: string;
  didToken: string;
};

let memorySession: WalletSession | null = null;
let magicSingleton: Magic | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function requireEnv(name: string): string {
  const value = import.meta.env[name]?.toString().trim();
  if (!value) {
    throw new Error(`Missing ${name}. See docs/KEYS_SETUP.md`);
  }
  return value;
}

function getMagic(): Magic {
  if (!isBrowser()) {
    throw new Error("Magic SDK requires a browser.");
  }
  if (!magicSingleton) {
    const magicKey = requireEnv("VITE_MAGIC_PUBLISHABLE_KEY");
    magicSingleton = new Magic(magicKey, {
      extensions: [new OAuthExtension()],
      network: {
        rpcUrl: requireEnv("VITE_ARBITRUM_RPC_URL"),
        chainId: arbitrumChainId(),
      },
    });
  }
  return magicSingleton;
}

function magicEthereumAddress(info: MagicUserMetadata): string {
  return info.wallets?.ethereum?.publicAddress?.trim() ?? "";
}

function setMemorySession(session: WalletSession | null): void {
  memorySession = session;
}

/** True when Google redirected back with an OAuth authorization response. */
export function isOAuthCallback(): boolean {
  if (!isBrowser()) return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.has("code") ||
    params.has("state") ||
    params.has("error") ||
    params.has("error_description")
  );
}

function isBenignOAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("MISSING_PKCE_METADATA") ||
    message.includes("OAuth session metadata not found") ||
    message.includes("STATE_MISMATCH")
  );
}

export function getStoredSession(): WalletSession | null {
  return memorySession;
}

export function clearSession(): void {
  memorySession = null;
}

export function isWalletConfigured(): boolean {
  return isFrontendFullyConfigured();
}

export function walletConfigErrors(): string[] {
  return missingFrontendEnv();
}

/** OAuth callback URL — must match Magic dashboard redirect URI allowlist exactly. */
export function magicOAuthRedirectURI(): string {
  const override = import.meta.env.VITE_MAGIC_REDIRECT_URI?.toString().trim();
  if (override) return override;
  if (typeof window === "undefined") {
    throw new Error("OAuth redirect URI requires a browser context.");
  }
  return `${window.location.origin}/onboard`;
}

/** Start Google OAuth — redirects away from the app */
export async function loginWithGoogle(): Promise<never> {
  if (!isBrowser()) {
    throw new Error("Google sign-in requires a browser.");
  }
  const magic = getMagic();
  const loggedIn = await magic.user.isLoggedIn();
  if (loggedIn) {
    await finalizeSession(magic);
    return undefined as never;
  }
  await magic.oauth2.loginWithRedirect({
    provider: "google",
    redirectURI: magicOAuthRedirectURI(),
  });
  throw new Error("Redirecting to Google sign-in…");
}

function stripOAuthSearchParams(): void {
  if (!isBrowser() || !isOAuthCallback()) return;
  const url = new URL(window.location.href);
  for (const key of ["code", "state", "error", "error_description"]) {
    url.searchParams.delete(key);
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

/** Complete OAuth after redirect return — only runs on OAuth callback URLs. */
export async function handleOAuthRedirect(): Promise<WalletSession | null> {
  if (!isBrowser() || !isFrontendFullyConfigured() || !isOAuthCallback()) {
    return null;
  }

  const magic = getMagic();
  try {
    await magic.oauth2.getRedirectResult();
  } catch (error) {
    stripOAuthSearchParams();
    if (isBenignOAuthError(error)) return null;
    throw error;
  }

  stripOAuthSearchParams();

  if (!(await magic.user.isLoggedIn())) return null;
  return finalizeSession(magic);
}

/** Restore session from Magic login + server profile (works across devices after sign-in). */
export async function resumeSession(): Promise<WalletSession | null> {
  if (!isBrowser() || !isFrontendFullyConfigured()) return null;

  const magic = getMagic();

  if (!(await magic.user.isLoggedIn())) {
    clearSession();
    return null;
  }

  // Reuse in-memory session when Magic is still logged in (avoids duplicate register calls).
  if (memorySession) {
    try {
      const didToken = await magic.user.getIdToken();
      if (didToken) {
        memorySession = { ...memorySession, didToken };
        return memorySession;
      }
    } catch {
      clearSession();
      await magic.user.logout().catch(() => {});
      return null;
    }
  }

  try {
    return await finalizeSession(magic);
  } catch {
    clearSession();
    await magic.user.logout().catch(() => {});
    return null;
  }
}

async function finalizeSession(magic: Magic): Promise<WalletSession> {
  const didToken = await magic.user.getIdToken();
  const info = await magic.user.getInfo();

  let auth: {
    user_id: string;
    email?: string;
    ua_address?: string;
    sra_address?: string;
  };

  try {
    auth = await axisApi.register(didToken, undefined, undefined, info.email ?? undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    if (message.includes("MAGIC_SECRET_KEY") || message.includes("does not match")) {
      throw new Error(message);
    }
    if (message.includes("Magic API") || message.includes("Invalid or expired")) {
      throw new Error(
        "Sign-in verification failed. Restart the backend (pip install -r backend/requirements.txt), then confirm MAGIC_SECRET_KEY matches VITE_MAGIC_PUBLISHABLE_KEY from the same Magic app.",
      );
    }
    throw new Error(message);
  }

  if (!auth.ua_address) {
    const ethAddress = magicEthereumAddress(info);
    if (!ethAddress) {
      throw new Error("Wallet address unavailable. Complete Magic wallet setup.");
    }

    const ua = await provisionUniversalAccount(ethAddress);
    let sraAddress: string | undefined;

    requireEnv("VITE_ZERODEV_PROJECT_ID");
    requireEnv("VITE_ZERODEV_RPC_URL");
    sraAddress = await createSmartRoutingAddress(ua.address);
    if (!sraAddress) {
      throw new Error("Failed to create Smart Routing Address.");
    }

    auth = await axisApi.register(didToken, ua.address, sraAddress, info.email ?? undefined);
  } else if (!auth.sra_address) {
    requireEnv("VITE_ZERODEV_PROJECT_ID");
    requireEnv("VITE_ZERODEV_RPC_URL");
    const sraAddress = await createSmartRoutingAddress(auth.ua_address);
    if (sraAddress) {
      auth = await axisApi.register(didToken, auth.ua_address, sraAddress, info.email ?? undefined);
    }
  }

  if (!auth.ua_address) {
    throw new Error("Wallet setup incomplete. Try signing in again.");
  }

  const session: WalletSession = {
    userId: auth.user_id,
    email: auth.email ?? info.email ?? undefined,
    uaAddress: auth.ua_address,
    sraAddress: auth.sra_address,
    didToken,
  };
  setMemorySession(session);
  return session;
}

async function provisionUniversalAccount(ownerAddress: string): Promise<{ address: string }> {
  const chainId = arbitrumChainId();

  // Particle UA v2 only supports mainnet chains — on Sepolia use the Magic EOA directly.
  if (chainId === ARBITRUM_SEPOLIA_CHAIN_ID) {
    return { address: ownerAddress };
  }

  requireEnv("VITE_PARTICLE_PROJECT_ID");
  requireEnv("VITE_PARTICLE_CLIENT_KEY");
  requireEnv("VITE_PARTICLE_APP_ID");

  const { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION_V2 } = await import(
    "@particle-network/universal-account-sdk"
  );

  const ua = new UniversalAccount({
    projectId: requireEnv("VITE_PARTICLE_PROJECT_ID"),
    projectClientKey: requireEnv("VITE_PARTICLE_CLIENT_KEY"),
    projectAppUuid: requireEnv("VITE_PARTICLE_APP_ID"),
    smartAccountOptions: {
      name: "AXIS",
      version: UNIVERSAL_ACCOUNT_VERSION_V2,
      ownerAddress,
      useEIP7702: true,
    },
  });

  const options = await ua.getSmartAccountOptions();
  return { address: options.smartAccountAddress ?? ownerAddress };
}

async function createSmartRoutingAddress(owner: string): Promise<string | undefined> {
  const { createSmartRoutingAddress } = await import("@zerodev/smart-routing-address");
  const { arbitrum, arbitrumSepolia, base, baseSepolia, optimism, sepolia } = await import(
    "viem/chains"
  );

  const isTestnet = arbitrumChainId() === ARBITRUM_SEPOLIA_CHAIN_ID;

  // ZeroDev SRA only supports specific chains — optimismSepolia (11155420) is not one of them.
  const { smartRoutingAddress } = await createSmartRoutingAddress(
    isTestnet
      ? {
          owner,
          destChain: arbitrumSepolia,
          srcTokens: [
            { tokenType: "USDC", chain: baseSepolia },
            { tokenType: "USDC", chain: arbitrumSepolia },
            { tokenType: "USDC", chain: sepolia },
          ],
          actions: { USDC: { action: [], fallBack: [] } },
          slippage: 50,
        }
      : {
          owner,
          destChain: arbitrum,
          srcTokens: [
            { tokenType: "USDC", chain: base },
            { tokenType: "USDC", chain: arbitrum },
            { tokenType: "USDC", chain: optimism },
          ],
          actions: { USDC: { action: [], fallBack: [] } },
          slippage: 50,
        },
  );
  return smartRoutingAddress;
}

export async function logout(): Promise<void> {
  if (!isBrowser()) {
    clearSession();
    return;
  }
  if (isFrontendFullyConfigured()) {
    try {
      const magic = getMagic();
      await magic.user.logout();
    } catch {
      /* ignore */
    }
  }
  clearSession();
}
