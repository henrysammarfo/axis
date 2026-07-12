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
import { arbitrumChainId } from "./chain";
import { isFrontendFullyConfigured, missingFrontendEnv } from "./env";

export type WalletSession = {
  userId: string;
  email?: string;
  uaAddress: string;
  sraAddress?: string;
  didToken: string;
};

let memorySession: WalletSession | null = null;

function requireEnv(name: string): string {
  const value = import.meta.env[name]?.toString().trim();
  if (!value) {
    throw new Error(`Missing ${name}. See docs/KEYS_SETUP.md`);
  }
  return value;
}

function createMagic(): Magic {
  const magicKey = requireEnv("VITE_MAGIC_PUBLISHABLE_KEY");
  return new Magic(magicKey, {
    extensions: [new OAuthExtension()],
    network: {
      rpcUrl: requireEnv("VITE_ARBITRUM_RPC_URL"),
      chainId: arbitrumChainId(),
    },
  });
}

function magicEthereumAddress(info: MagicUserMetadata): string {
  return info.wallets?.ethereum?.publicAddress?.trim() ?? "";
}

function setMemorySession(session: WalletSession | null): void {
  memorySession = session;
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
  const magic = createMagic();
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

/** Complete OAuth after redirect return */
export async function handleOAuthRedirect(): Promise<WalletSession | null> {
  if (!isFrontendFullyConfigured()) return null;

  const magic = createMagic();
  await magic.oauth2.getRedirectResult();
  if (!(await magic.user.isLoggedIn())) return null;
  return finalizeSession(magic);
}

/** Restore session from Magic login + server profile (works across devices after sign-in). */
export async function resumeSession(): Promise<WalletSession | null> {
  if (!isFrontendFullyConfigured()) return null;
  const magic = createMagic();
  if (!(await magic.user.isLoggedIn())) {
    clearSession();
    return null;
  }
  return finalizeSession(magic);
}

async function finalizeSession(magic: Magic): Promise<WalletSession> {
  const didToken = await magic.user.getIdToken();
  const info = await magic.user.getInfo();

  // Load or create server profile first — returns saved wallet addresses on any device.
  let auth = await axisApi.register(didToken);

  if (!auth.ua_address) {
    if (!requireEnv("VITE_PARTICLE_PROJECT_ID")) {
      throw new Error("Particle Network not configured. Add VITE_PARTICLE_* keys.");
    }

    const ethAddress = magicEthereumAddress(info);
    if (!ethAddress) {
      throw new Error("Wallet address unavailable. Complete Magic wallet setup.");
    }

    const ua = await upgradeToUniversalAccount(magic);
    let sraAddress: string | undefined;

    requireEnv("VITE_ZERODEV_PROJECT_ID");
    requireEnv("VITE_ZERODEV_RPC_URL");
    sraAddress = await createSmartRoutingAddress(ua.address);
    if (!sraAddress) {
      throw new Error("Failed to create Smart Routing Address.");
    }

    auth = await axisApi.register(didToken, ua.address, sraAddress);
  } else if (!auth.sra_address) {
    requireEnv("VITE_ZERODEV_PROJECT_ID");
    requireEnv("VITE_ZERODEV_RPC_URL");
    const sraAddress = await createSmartRoutingAddress(auth.ua_address);
    if (sraAddress) {
      auth = await axisApi.register(didToken, auth.ua_address, sraAddress);
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

async function upgradeToUniversalAccount(magic: Magic) {
  const { UniversalAccount } = await import("@particle-network/universal-account-sdk");
  const { BrowserProvider } = await import("ethers");

  const magicProvider = await magic.wallet.getProvider();
  const ethersProvider = new BrowserProvider(magicProvider);
  const signer = await ethersProvider.getSigner();

  const ua = new UniversalAccount(signer, {
    projectId: requireEnv("VITE_PARTICLE_PROJECT_ID"),
    clientKey: requireEnv("VITE_PARTICLE_CLIENT_KEY"),
    appId: requireEnv("VITE_PARTICLE_APP_ID"),
    eip7702: true,
    chainId: arbitrumChainId(),
  });

  const address = await ua.getAddress();
  return { address, ua };
}

async function createSmartRoutingAddress(owner: string): Promise<string | undefined> {
  const { createSmartRoutingAddress } = await import("@zerodev/smart-routing-address");
  const { arbitrumSepolia, baseSepolia, optimismSepolia } = await import("viem/chains");

  const { smartRoutingAddress } = await createSmartRoutingAddress({
    owner,
    destChain: arbitrumSepolia,
    srcTokens: [
      { tokenType: "USDC", chain: baseSepolia },
      { tokenType: "USDC", chain: optimismSepolia },
      { tokenType: "USDC", chain: arbitrumSepolia },
    ],
    actions: {
      USDC: { action: [], fallBack: [] },
    },
    slippage: 50,
  });
  return smartRoutingAddress;
}

export async function logout(): Promise<void> {
  if (isFrontendFullyConfigured()) {
    try {
      const magic = createMagic();
      await magic.user.logout();
    } catch {
      /* ignore */
    }
  }
  clearSession();
}
