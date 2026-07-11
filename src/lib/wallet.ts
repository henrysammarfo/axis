/**
 * Magic + Particle UA + ZeroDev SRA wallet integration.
 * Requires VITE_* env vars — see docs/KEYS_SETUP.md
 */

import { Magic } from "magic-sdk";
import { OAuthExtension } from "@magic-ext/oauth2";
import { axisApi } from "./api";
import { isFrontendFullyConfigured, missingFrontendEnv } from "./env";

export type WalletSession = {
  userId: string;
  email?: string;
  uaAddress: string;
  sraAddress?: string;
  didToken: string;
};

const SESSION_KEY = "axis_wallet_session";

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
      chainId: 42161,
    },
  });
}

export function getStoredSession(): WalletSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const session = raw ? (JSON.parse(raw) as WalletSession) : null;
    if (session && session.userId && session.uaAddress && session.didToken) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

export function storeSession(session: WalletSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isWalletConfigured(): boolean {
  return isFrontendFullyConfigured();
}

export function walletConfigErrors(): string[] {
  return missingFrontendEnv();
}

/** Start Google OAuth — redirects away from the app */
export async function loginWithGoogle(): Promise<never> {
  const magic = createMagic();
  const loggedIn = await magic.user.isLoggedIn();
  if (loggedIn) {
    await finalizeSession(magic);
    return undefined as never;
  }
  await magic.oauth2.loginWithRedirect({ provider: "google" });
  throw new Error("Redirecting to Google sign-in…");
}

/** Complete OAuth after redirect return */
export async function handleOAuthRedirect(): Promise<WalletSession | null> {
  if (!isFrontendFullyConfigured()) return null;

  const magic = createMagic();
  try {
    await magic.oauth2.getRedirectResult();
    if (!(await magic.user.isLoggedIn())) return null;
    return finalizeSession(magic);
  } catch {
    return null;
  }
}

/** Resume session if already logged in with Magic */
export async function resumeSession(): Promise<WalletSession | null> {
  if (!isFrontendFullyConfigured()) return null;
  const magic = createMagic();
  if (!(await magic.user.isLoggedIn())) return null;
  return finalizeSession(magic);
}

async function finalizeSession(magic: Magic): Promise<WalletSession> {
  const didToken = await magic.user.getIdToken();
  const info = await magic.user.getInfo();
  const metadata = await magic.user.getMetadata();

  let uaAddress = metadata.publicAddress ?? "";
  if (!uaAddress) {
    throw new Error("Wallet address unavailable. Complete Magic wallet setup.");
  }

  if (!requireEnv("VITE_PARTICLE_PROJECT_ID")) {
    throw new Error("Particle Network not configured. Add VITE_PARTICLE_* keys.");
  }

  const ua = await upgradeToUniversalAccount(magic);
  uaAddress = ua.address;
  const sraAddress = await createSmartRoutingAddress(uaAddress);

  requireEnv("VITE_ZERODEV_PROJECT_ID");
  requireEnv("VITE_ZERODEV_RPC_URL");
  if (!sraAddress) {
    throw new Error("Failed to create Smart Routing Address.");
  }

  const auth = await axisApi.register(didToken, uaAddress, sraAddress);

  const session: WalletSession = {
    userId: auth.user_id,
    email: auth.email ?? info.email,
    uaAddress: auth.ua_address ?? uaAddress,
    sraAddress: auth.sra_address ?? sraAddress,
    didToken,
  };
  storeSession(session);
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
    chainId: 42161,
  });

  const address = await ua.getAddress();
  return { address, ua };
}

async function createSmartRoutingAddress(owner: string): Promise<string | undefined> {
  const { createSmartRoutingAddress } = await import("@zerodev/smart-routing-address");
  const { arbitrum, optimism, base, mainnet } = await import("viem/chains");

  const { smartRoutingAddress } = await createSmartRoutingAddress({
    owner,
    destChain: arbitrum,
    srcTokens: [
      { tokenType: "USDC", chain: optimism },
      { tokenType: "USDC", chain: base },
      { tokenType: "USDC", chain: arbitrum },
      { tokenType: "NATIVE", chain: mainnet },
    ],
    actions: {
      USDC: { action: [], fallBack: [] },
      NATIVE: { action: [], fallBack: [] },
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
