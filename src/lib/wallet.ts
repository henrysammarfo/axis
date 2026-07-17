/**
 * Magic + Particle UA (EIP-7702) + ZeroDev SRA wallet integration.
 * Requires VITE_* env vars — see docs/KEYS_SETUP.md
 *
 * Production path (Arbitrum One 42161):
 *   Magic EOA → Particle UA useEIP7702 → Type-4 delegation → ZeroDev SRA
 * Sepolia shortcuts are demo-only and incomplete (see docs/PRODUCTION_AUDIT.md).
 *
 * Auth persistence: Magic SDK (per-device) + AXIS backend (cross-device profile).
 * Session state lives in memory only — restored via resumeSession() on each visit.
 *
 * EIP-7702 flow matches Particle official Magic demo:
 * https://github.com/Particle-Network/ua-7702-magic-demo
 */

import "./process-polyfill";
import { Magic } from "magic-sdk";
import { OAuthExtension } from "@magic-ext/oauth2";
import { EVMExtension } from "@magic-ext/evm";
import type { MagicUserMetadata } from "@magic-sdk/types";
import { axisApi } from "./api";
import {
  arbitrumChainId,
  ARBITRUM_ONE_CHAIN_ID,
  ARBITRUM_SEPOLIA_CHAIN_ID,
  isArbitrumOne,
} from "./chain";
import { isFrontendFullyConfigured, missingFrontendEnv } from "./env";

export type WalletSession = {
  userId: string;
  email?: string;
  uaAddress: string;
  sraAddress?: string;
  eip7702TxHash?: string;
  eip7702Delegated?: boolean;
  didToken: string;
};

type AxisMagic = Magic<[OAuthExtension, EVMExtension]>;

type ProvisionResult = {
  address: string;
  eip7702TxHash?: string;
  eip7702Delegated: boolean;
};

let memorySession: WalletSession | null = null;
let magicSingleton: AxisMagic | null = null;

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

function getMagic(): AxisMagic {
  if (!isBrowser()) {
    throw new Error("Magic SDK requires a browser.");
  }
  if (!magicSingleton) {
    const magicKey = requireEnv("VITE_MAGIC_PUBLISHABLE_KEY");
    const rpcUrl = requireEnv("VITE_ARBITRUM_RPC_URL");
    const chainId = arbitrumChainId();
    magicSingleton = new Magic(magicKey, {
      extensions: [
        new OAuthExtension(),
        new EVMExtension([{ rpcUrl, chainId, default: true }]),
      ],
    }) as AxisMagic;
  }
  return magicSingleton;
}

function magicEthereumAddress(info: MagicUserMetadata): string {
  return info.wallets?.ethereum?.publicAddress?.trim() ?? "";
}

function setMemorySession(session: WalletSession | null): void {
  memorySession = session;
}

function formatWalletError(error: unknown, fallback: string, _fundAddress?: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (
    lower.includes("sponsor wallet needs a refill") ||
    lower.includes("agent_wallet")
  ) {
    return new Error(message);
  }
  if (
    lower.includes("insufficient funds") ||
    lower.includes("insufficient balance") ||
    lower.includes("gas required exceeds")
  ) {
    return new Error(
      "Account upgrade is gasless — AXIS pays. If this persists, the sponsor wallet needs a refill of ETH on Arbitrum One.",
    );
  }
  return error instanceof Error ? error : new Error(message || fallback);
}

function normalize7702Authorization(
  raw: unknown,
  defaults: { chainId: number; contractAddress: string; nonce: number },
): Record<string, unknown> {
  const a = (raw ?? {}) as Record<string, unknown>;
  const address =
    (typeof a.address === "string" && a.address) ||
    (typeof a.contractAddress === "string" && a.contractAddress) ||
    defaults.contractAddress;
  const chainId =
    typeof a.chainId === "number"
      ? a.chainId
      : typeof a.chain_id === "number"
        ? a.chain_id
        : defaults.chainId;
  const nonce =
    typeof a.nonce === "number"
      ? a.nonce
      : typeof a.nonce === "string"
        ? Number(a.nonce)
        : defaults.nonce;
  const r = a.r ?? a.R;
  const s = a.s ?? a.S;
  const yParity = a.yParity ?? a.y_parity ?? a.v;
  if (r == null || s == null || yParity == null) {
    throw new Error("Magic authorization signature incomplete. Try signing in again.");
  }
  return {
    chainId,
    address,
    nonce,
    r: typeof r === "string" || typeof r === "number" ? r : String(r),
    s: typeof s === "string" || typeof s === "number" ? s : String(s),
    yParity: typeof yParity === "number" ? yParity : Number(yParity),
  };
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

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new Error(
            `${label} timed out. Disable wallet browser extensions and try again.`,
          ),
        ),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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

/** Initialize Magic SDK early so the first sign-in click is responsive. */
export function warmupWalletSdk(): void {
  if (!isBrowser() || !isFrontendFullyConfigured()) return;
  try {
    getMagic();
  } catch {
    /* ignore — login handler surfaces config errors */
  }
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

/** Start Google OAuth — redirects away from the app, or returns session if already signed in. */
export type GoogleLoginResult =
  | { status: "session"; session: WalletSession }
  | { status: "redirecting" };

export async function loginWithGoogle(): Promise<GoogleLoginResult> {
  if (!isBrowser()) {
    throw new Error("Google sign-in requires a browser.");
  }
  if (!isFrontendFullyConfigured()) {
    throw new Error(
      `Missing frontend configuration: ${missingFrontendEnv().join(", ")}. See docs/KEYS_SETUP.md`,
    );
  }

  const magic = getMagic();

  let loggedIn = false;
  try {
    loggedIn = await withTimeout(magic.user.isLoggedIn(), 4_000, "Magic sign-in check");
  } catch {
    // Wallet extensions often block Magic — proceed to OAuth redirect.
    loggedIn = false;
  }

  if (loggedIn) {
    const session = await finalizeSession(magic);
    return { status: "session", session };
  }

  try {
    await magic.oauth2.loginWithRedirect({
      provider: "google",
      redirectURI: magicOAuthRedirectURI(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("redirect") || message.includes("Redirect")) {
      throw new Error(
        `Google sign-in could not start. Add ${magicOAuthRedirectURI()} to your Magic dashboard redirect allowlist.`,
      );
    }
    throw error instanceof Error ? error : new Error(message);
  }

  return { status: "redirecting" };
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
    await withTimeout(magic.oauth2.getRedirectResult(), 20_000, "Google sign-in");
  } catch (error) {
    stripOAuthSearchParams();
    if (isBenignOAuthError(error)) return null;
    throw error;
  }

  stripOAuthSearchParams();

  const loggedIn = await withTimeout(magic.user.isLoggedIn(), 12_000, "Magic sign-in check");
  if (!loggedIn) return null;
  return finalizeSession(magic);
}

/** Restore session from Magic login + server profile (works across devices after sign-in). */
export async function resumeSession(): Promise<WalletSession | null> {
  if (!isBrowser() || !isFrontendFullyConfigured()) return null;

  const magic = getMagic();

  let loggedIn = false;
  try {
    loggedIn = await withTimeout(magic.user.isLoggedIn(), 12_000, "Magic sign-in check");
  } catch {
    clearSession();
    return null;
  }

  if (!loggedIn) {
    clearSession();
    return null;
  }

  // Reuse in-memory session when Magic is still logged in (avoids duplicate register calls).
  if (memorySession) {
    try {
      const didToken = await withTimeout(magic.user.getIdToken(), 12_000, "Magic session");
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

async function finalizeSession(magic: AxisMagic): Promise<WalletSession> {
  const didToken = await withTimeout(magic.user.getIdToken(), 12_000, "Magic session");
  const info = await withTimeout(magic.user.getInfo(), 12_000, "Magic profile");

  type AuthProfile = {
    user_id: string;
    email?: string;
    ua_address?: string;
    sra_address?: string;
    eip7702_tx_hash?: string;
    eip7702_delegated?: boolean;
  };

  let auth: AuthProfile;

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

  const ethAddress = magicEthereumAddress(info);
  if (!ethAddress) {
    throw new Error("Wallet address unavailable. Complete Magic wallet setup.");
  }

  const needsUa = !auth.ua_address;
  const needsSra = !auth.sra_address;
  const needs7702Evidence = isArbitrumOne() && !auth.eip7702_delegated && !auth.eip7702_tx_hash;

  if (needsUa || needsSra || needs7702Evidence) {
    const provisioned = needsUa
      ? await provisionUniversalAccount(magic, ethAddress, didToken)
      : await ensureEip7702Delegation(magic, ethAddress, auth.ua_address!, didToken);

    const uaAddress = provisioned.address;
    const sraAddress =
      auth.sra_address ??
      (await createSmartRoutingAddress(uaAddress));

    if (isArbitrumOne() && !sraAddress) {
      throw new Error("ZeroDev Smart Routing Address creation failed. Check ZeroDev project mainnet config.");
    }

    auth = await axisApi.register(
      didToken,
      uaAddress,
      sraAddress,
      info.email ?? undefined,
      {
        eip7702TxHash: provisioned.eip7702TxHash ?? auth.eip7702_tx_hash,
        eip7702Delegated: provisioned.eip7702Delegated,
      },
    );
  }

  if (!auth.ua_address) {
    throw new Error("Wallet setup incomplete. Try signing in again.");
  }

  if (isArbitrumOne() && !auth.sra_address) {
    throw new Error("SRA address missing. Sign out and complete onboarding again.");
  }

  if (isArbitrumOne() && !auth.eip7702_delegated && !auth.eip7702_tx_hash) {
    throw new Error(
      "Account upgrade incomplete. Sign in again — AXIS sponsors EIP-7702 gas for you.",
    );
  }

  const session: WalletSession = {
    userId: auth.user_id,
    email: auth.email ?? info.email ?? undefined,
    uaAddress: auth.ua_address,
    sraAddress: auth.sra_address,
    eip7702TxHash: auth.eip7702_tx_hash,
    eip7702Delegated: Boolean(auth.eip7702_delegated || auth.eip7702_tx_hash),
    didToken,
  };
  setMemorySession(session);
  return session;
}

async function provisionUniversalAccount(
  magic: AxisMagic,
  ownerAddress: string,
  didToken: string,
): Promise<ProvisionResult> {
  const chainId = arbitrumChainId();

  // Particle UA v2 EIP-7702 is mainnet-only. Sepolia remains an incomplete demo scaffold.
  if (chainId === ARBITRUM_SEPOLIA_CHAIN_ID) {
    return { address: ownerAddress, eip7702Delegated: false };
  }

  if (chainId !== ARBITRUM_ONE_CHAIN_ID) {
    throw new Error(
      `Unsupported chain ${chainId}. Set VITE_ARBITRUM_CHAIN_ID=42161 (Arbitrum One).`,
    );
  }

  requireEnv("VITE_PARTICLE_PROJECT_ID");
  requireEnv("VITE_PARTICLE_CLIENT_KEY");
  requireEnv("VITE_PARTICLE_APP_ID");

  const { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } = await import(
    "@particle-network/universal-account-sdk"
  );

  const ua = new UniversalAccount({
    projectId: requireEnv("VITE_PARTICLE_PROJECT_ID"),
    projectClientKey: requireEnv("VITE_PARTICLE_CLIENT_KEY"),
    projectAppUuid: requireEnv("VITE_PARTICLE_APP_ID"),
    smartAccountOptions: {
      name: "UNIVERSAL",
      version: UNIVERSAL_ACCOUNT_VERSION,
      ownerAddress,
      useEIP7702: true,
    },
  });

  const options = await ua.getSmartAccountOptions();
  // EIP-7702 mode: UA address is the EOA itself (no separate contract address).
  const address = options.smartAccountAddress ?? ownerAddress;
  if (address.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error(
      "Particle UA address does not match Magic EOA. EIP-7702 mode may be disabled for this Particle project.",
    );
  }

  const delegated = await ensureEip7702Delegation(magic, ownerAddress, address, didToken, ua);
  return delegated;
}

async function ensureEip7702Delegation(
  magic: AxisMagic,
  ownerAddress: string,
  uaAddress: string,
  didToken: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingUa?: any,
): Promise<ProvisionResult> {
  if (!isArbitrumOne()) {
    return { address: uaAddress, eip7702Delegated: false };
  }

  const chainId = ARBITRUM_ONE_CHAIN_ID;

  try {
    const { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } = await import(
      "@particle-network/universal-account-sdk"
    );

    const ua =
      existingUa ??
      new UniversalAccount({
        projectId: requireEnv("VITE_PARTICLE_PROJECT_ID"),
        projectClientKey: requireEnv("VITE_PARTICLE_CLIENT_KEY"),
        projectAppUuid: requireEnv("VITE_PARTICLE_APP_ID"),
        smartAccountOptions: {
          name: "UNIVERSAL",
          version: UNIVERSAL_ACCOUNT_VERSION,
          ownerAddress,
          useEIP7702: true,
        },
      });

    const deployments = await ua.getEIP7702Deployments();
    const arb = (deployments as Array<{ chainId: number; isDelegated?: boolean }>).find(
      (d) => d.chainId === chainId,
    );

    if (arb?.isDelegated) {
      return { address: uaAddress, eip7702Delegated: true };
    }

    await magic.evm.switchChain(chainId);

    const authList = await ua.getEIP7702Auth([chainId]);
    const auth = Array.isArray(authList) ? authList[0] : authList;
    if (!auth?.address) {
      throw new Error("Particle getEIP7702Auth did not return a contract address for Arbitrum One.");
    }

    // Sponsored Type-4: authority != tx sender, so use Particle nonce as-is (not +1).
    const authNonce = typeof auth.nonce === "number" ? auth.nonce : 0;
    const rawAuthorization = await magic.wallet.sign7702Authorization({
      contractAddress: auth.address,
      chainId,
      nonce: authNonce,
    });

    const authorization = normalize7702Authorization(rawAuthorization, {
      chainId,
      contractAddress: auth.address,
      nonce: authNonce,
    });

    let transactionHash: string | undefined;
    try {
      const sponsored = await axisApi.sponsorEip7702(didToken, ownerAddress, authorization);
      transactionHash = sponsored.tx_hash;
    } catch (sponsorError) {
      const sponsorMsg =
        sponsorError instanceof Error ? sponsorError.message : String(sponsorError);
      // Optional safety net: if sponsor is down and Magic EOA already has ETH, self-broadcast.
      try {
        const selfAuth = await magic.wallet.sign7702Authorization({
          contractAddress: auth.address,
          chainId,
          nonce: authNonce + 1,
        });
        const { transactionHash: selfHash } = await magic.wallet.send7702Transaction({
          to: ownerAddress,
          data: "0x",
          authorizationList: [selfAuth],
        });
        transactionHash = selfHash;
      } catch {
        throw new Error(
          sponsorMsg.includes("refill") || sponsorMsg.includes("sponsor")
            ? sponsorMsg
            : `Gasless account upgrade failed: ${sponsorMsg}`,
        );
      }
    }

    if (!transactionHash) {
      throw new Error("EIP-7702 Type-4 transaction did not return a hash.");
    }

    const after = await ua.getEIP7702Deployments();
    const arbAfter = (after as Array<{ chainId: number; isDelegated?: boolean }>).find(
      (d) => d.chainId === chainId,
    );

    return {
      address: uaAddress,
      eip7702TxHash: transactionHash,
      eip7702Delegated: Boolean(arbAfter?.isDelegated ?? true),
    };
  } catch (error) {
    throw formatWalletError(error, "EIP-7702 delegation failed");
  }
}

async function createSmartRoutingAddress(owner: string): Promise<string | undefined> {
  const { getAddress } = await import("viem");

  let checksummedOwner: `0x${string}`;
  try {
    checksummedOwner = getAddress(owner);
  } catch {
    throw new Error("Wallet address is invalid. Sign out and sign in again.");
  }

  // ZeroDev public SRA API is mainnet-oriented; Sepolia remains unfinished.
  if (arbitrumChainId() === ARBITRUM_SEPOLIA_CHAIN_ID) {
    return undefined;
  }

  if (!isArbitrumOne()) {
    throw new Error("SRA requires Arbitrum One (42161).");
  }

  try {
    const { createSmartRoutingAddress: createSra, createCall, FLEX } = await import(
      "@zerodev/smart-routing-address"
    );
    const { arbitrum, base, optimism, mainnet } = await import("viem/chains");
    const { erc20Abi } = await import("viem");

    // ZeroDev SRA API requires non-empty calls (empty action[] → "Invalid params").
    // Transfer-to-owner matches the official SRA example.
    const transferUsdc = createCall({
      target: FLEX.TOKEN_ADDRESS,
      value: 0n,
      abi: erc20Abi,
      functionName: "transfer",
      args: [checksummedOwner, FLEX.AMOUNT],
    });

    const { smartRoutingAddress } = await createSra({
      owner: checksummedOwner,
      destChain: arbitrum,
      srcTokens: [
        { tokenType: "USDC", chain: base },
        { tokenType: "USDC", chain: optimism },
        { tokenType: "USDC", chain: arbitrum },
        { tokenType: "USDC", chain: mainnet },
      ],
      actions: {
        USDC: {
          action: [transferUsdc],
          fallBack: [transferUsdc],
        },
      },
      slippage: 50,
      allowPartialRoutes: true,
    });

    if (!smartRoutingAddress) {
      throw new Error("ZeroDev returned an empty Smart Routing Address.");
    }
    return smartRoutingAddress;
  } catch (error) {
    const details =
      error &&
      typeof error === "object" &&
      "details" in error &&
      error.details &&
      typeof error.details === "object" &&
      "message" in error.details &&
      typeof (error.details as { message?: unknown }).message === "string"
        ? (error.details as { message: string }).message
        : undefined;
    if (details) {
      throw new Error(`ZeroDev Smart Routing Address setup failed: ${details}`);
    }
    throw formatWalletError(error, "ZeroDev Smart Routing Address setup failed");
  }
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
