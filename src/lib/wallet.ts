/**
 * Magic + Particle UA + ZeroDev SRA wallet integration.
 * Requires VITE_* env vars — see docs/KEYS_SETUP.md
 */

import { Magic } from "magic-sdk";
import { OAuthExtension } from "@magic-ext/oauth2";
import { axisApi } from "./api";

export type WalletSession = {
  userId: string;
  email?: string;
  uaAddress: string;
  sraAddress?: string;
  didToken?: string;
  devMode?: boolean;
};

const SESSION_KEY = "axis_wallet_session";

function createMagic(): Magic {
  const magicKey = import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY!;
  return new Magic(magicKey, {
    extensions: [new OAuthExtension()],
    network: { rpcUrl: "https://arb1.arbitrum.io/rpc", chainId: 42161 },
  });
}

export function getStoredSession(): WalletSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as WalletSession) : null;
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
  return Boolean(
    import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY &&
    import.meta.env.VITE_PARTICLE_PROJECT_ID &&
    import.meta.env.VITE_PARTICLE_CLIENT_KEY &&
    import.meta.env.VITE_PARTICLE_APP_ID,
  );
}

/**
 * Google login via Magic Labs.
 * Falls back to dev session when keys are not configured.
 */
export async function loginWithGoogle(): Promise<WalletSession> {
  const magicKey = import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY;

  if (!magicKey) {
    const devSession: WalletSession = {
      userId: `dev-${crypto.randomUUID().slice(0, 8)}`,
      email: "demo@axis.app",
      uaAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      sraAddress: "0x7a3f9c4bE0Fa27a3Ba91cC48DdEf9c14e70b8dC91",
      devMode: true,
    };
    storeSession(devSession);
    return devSession;
  }

  const magic = createMagic();
  await magic.oauth2.loginWithRedirect({ provider: "google" });

  const didToken = await magic.user.getIdToken();
  const info = await magic.user.getInfo();
  const metadata = await magic.user.getMetadata();

  let uaAddress = metadata.publicAddress ?? "";
  let sraAddress: string | undefined;

  if (import.meta.env.VITE_PARTICLE_PROJECT_ID) {
    try {
      const ua = await upgradeToUniversalAccount(magic);
      uaAddress = ua.address;
      sraAddress = await createSmartRoutingAddress(uaAddress);
    } catch (err) {
      console.warn("UA upgrade failed, using Magic EOA:", err);
    }
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

/** Handle Magic OAuth redirect callback */
export async function handleOAuthRedirect(): Promise<WalletSession | null> {
  const magicKey = import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY;
  if (!magicKey) return null;

  const magic = createMagic();
  try {
    const result = await magic.oauth2.getRedirectResult();
    if (!result) return null;
    return loginWithGoogle();
  } catch {
    return null;
  }
}

async function upgradeToUniversalAccount(magic: Magic) {
  const { UniversalAccount } = await import("@particle-network/universal-account-sdk");
  const { BrowserProvider } = await import("ethers");

  const magicProvider = await magic.wallet.getProvider();
  const ethersProvider = new BrowserProvider(magicProvider);
  const signer = await ethersProvider.getSigner();

  const ua = new UniversalAccount(signer, {
    projectId: import.meta.env.VITE_PARTICLE_PROJECT_ID!,
    clientKey: import.meta.env.VITE_PARTICLE_CLIENT_KEY!,
    appId: import.meta.env.VITE_PARTICLE_APP_ID!,
    eip7702: true,
    chainId: 42161,
  });

  const address = await ua.getAddress();
  return { address, ua };
}

async function createSmartRoutingAddress(owner: string): Promise<string | undefined> {
  if (!import.meta.env.VITE_ZERODEV_PROJECT_ID) return undefined;

  try {
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
  } catch (err) {
    console.warn("SRA creation failed:", err);
    return undefined;
  }
}

export async function logout(): Promise<void> {
  const magicKey = import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY;
  if (magicKey) {
    try {
      const magic = createMagic();
      await magic.user.logout();
    } catch {
      /* ignore */
    }
  }
  clearSession();
}
