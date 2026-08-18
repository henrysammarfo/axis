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
import type { RouteApplyLeg } from "./api";
import {
  arbitrumChainId,
  ARBITRUM_ONE_CHAIN_ID,
  ARBITRUM_SEPOLIA_CHAIN_ID,
  isArbitrumOne,
} from "./chain";
import { isFrontendFullyConfigured, missingFrontendEnv } from "./env";
import { buildSessionApproval, USDC_ARBITRUM } from "./kernel-session";
import { getSessionSignerAddress, executeSessionCalls } from "./agent-executor";
import { userFacingError } from "./user-error";

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
      extensions: [new OAuthExtension(), new EVMExtension([{ rpcUrl, chainId, default: true }])],
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
  if (lower.includes("sponsor wallet needs a refill") || lower.includes("agent_wallet")) {
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
  return new Error(userFacingError(error, fallback));
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

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(new Error(`${label} timed out. Disable wallet browser extensions and try again.`)),
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
  { status: "session"; session: WalletSession } | { status: "redirecting" };

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

  const needsSra = !auth.sra_address;
  const needs7702Evidence = isArbitrumOne() && !auth.eip7702_delegated && !auth.eip7702_tx_hash;

  if (!auth.ua_address || needsSra || needs7702Evidence) {
    // EIP-7702: the account IS the Magic EOA, delegated to ZeroDev Kernel.
    const provisioned = await ensureKernelDelegation(magic, ethAddress, didToken);

    const uaAddress = provisioned.address;
    const sraAddress = auth.sra_address ?? (await createSmartRoutingAddress(uaAddress));

    if (isArbitrumOne() && !sraAddress) {
      throw new Error(
        "ZeroDev Smart Routing Address creation failed. Check ZeroDev project mainnet config.",
      );
    }

    auth = await axisApi.register(didToken, uaAddress, sraAddress, info.email ?? undefined, {
      eip7702TxHash: provisioned.eip7702TxHash ?? auth.eip7702_tx_hash,
      eip7702Delegated: provisioned.eip7702Delegated,
    });
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

  // Hands-off is part of account setup — not a later "sign to turn on" step.
  // Magic's signature UI is off by default, so this usually completes with no
  // popup; if it fails we retry silently from the dashboard.
  if (isArbitrumOne()) {
    await ensureSessionApproval(session.userId, session.uaAddress).catch(() => null);
  }

  return session;
}

/** Read the 7702 delegation target of an EOA (the address it points its code at), if any. */
async function read7702Delegate(address: string): Promise<string | null> {
  const rpcUrl = requireEnv("VITE_ARBITRUM_RPC_URL");
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getCode",
      params: [address, "latest"],
    }),
  });
  const json = (await res.json()) as { result?: string };
  const code = json.result ?? "0x";
  // EIP-7702 delegation designator: 0xef0100 || 20-byte address
  if (code.length >= 48 && code.slice(0, 8).toLowerCase() === "0xef0100") {
    return `0x${code.slice(8, 48)}`.toLowerCase();
  }
  return null;
}

async function eoaNonce(address: string): Promise<number> {
  const rpcUrl = requireEnv("VITE_ARBITRUM_RPC_URL");
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionCount",
      params: [address, "pending"],
    }),
  });
  const json = (await res.json()) as { result?: string };
  return json.result ? Number.parseInt(json.result, 16) : 0;
}

/**
 * Delegate the Magic EOA to ZeroDev Kernel via a sponsored EIP-7702 Type-4 tx.
 * The account address stays the EOA; AXIS pays gas. Session keys (see kernel-session.ts)
 * plug into this Kernel delegate for prompt-free autonomous execution.
 */
async function ensureKernelDelegation(
  magic: AxisMagic,
  ownerAddress: string,
  didToken: string,
): Promise<ProvisionResult> {
  const chainId = arbitrumChainId();

  if (chainId === ARBITRUM_SEPOLIA_CHAIN_ID) {
    return { address: ownerAddress, eip7702Delegated: false };
  }
  if (chainId !== ARBITRUM_ONE_CHAIN_ID) {
    throw new Error(
      `Unsupported chain ${chainId}. Set VITE_ARBITRUM_CHAIN_ID=42161 (Arbitrum One).`,
    );
  }

  try {
    const { constants } = await import("@zerodev/sdk");
    const kernelAddress = constants.KERNEL_7702_DELEGATION_ADDRESS as string;

    const current = await read7702Delegate(ownerAddress);
    if (current && current === kernelAddress.toLowerCase()) {
      return { address: ownerAddress, eip7702Delegated: true };
    }

    await magic.evm.switchChain(chainId);
    const nonce = await eoaNonce(ownerAddress);

    const rawAuthorization = await magic.wallet.sign7702Authorization({
      contractAddress: kernelAddress,
      chainId,
      nonce,
    });
    const authorization = normalize7702Authorization(rawAuthorization, {
      chainId,
      contractAddress: kernelAddress,
      nonce,
    });

    let transactionHash: string | undefined;
    try {
      const sponsored = await axisApi.sponsorEip7702(didToken, ownerAddress, authorization);
      transactionHash = sponsored.tx_hash;
    } catch (sponsorError) {
      const sponsorMsg =
        sponsorError instanceof Error ? sponsorError.message : String(sponsorError);
      // Safety net: if sponsor is down and the Magic EOA holds ETH, self-broadcast.
      try {
        const selfAuth = await magic.wallet.sign7702Authorization({
          contractAddress: kernelAddress,
          chainId,
          nonce: nonce + 1,
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

    const after = await read7702Delegate(ownerAddress);
    return {
      address: ownerAddress,
      eip7702TxHash: transactionHash,
      eip7702Delegated: after === kernelAddress.toLowerCase(),
    };
  } catch (error) {
    throw formatWalletError(error, "EIP-7702 Kernel delegation failed");
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
    const {
      createSmartRoutingAddress: createSra,
      createCall,
      FLEX,
    } = await import("@zerodev/smart-routing-address");
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

export type UnsignedActivationTx = {
  purpose: string;
  leg_asset?: string;
  amount_usdc?: number;
  estimated_apy?: number;
  to: string;
  data: string;
  value?: string;
  chain_id: number;
};

/** Sign+broadcast each Aave activation tx via Magic (user pays gas or ZeroDev if configured). */
export async function signActivationTransactions(transactions: UnsignedActivationTx[]): Promise<
  Array<{
    purpose: string;
    tx_hash: string;
    leg_asset?: string;
    amount_usdc?: number;
    estimated_apy?: number;
  }>
> {
  const magic = getMagic();
  const chainId = arbitrumChainId();
  await magic.evm.switchChain(chainId);

  const provider = magic.rpcProvider as {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };

  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  const from = accounts?.[0];
  if (!from) {
    throw new Error("Magic wallet not ready. Sign in again.");
  }

  const signed: Array<{
    purpose: string;
    tx_hash: string;
    leg_asset?: string;
    amount_usdc?: number;
    estimated_apy?: number;
  }> = [];

  for (const tx of transactions) {
    const hash = (await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to: tx.to,
          data: tx.data,
          value: tx.value ?? "0x0",
        },
      ],
    })) as string;

    if (!hash || !hash.startsWith("0x")) {
      throw new Error(`Wallet did not return a transaction hash for ${tx.purpose}`);
    }

    // Wait for inclusion via RPC
    const rpcUrl = requireEnv("VITE_ARBITRUM_RPC_URL");
    for (let i = 0; i < 60; i++) {
      const receiptRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionReceipt",
          params: [hash],
        }),
      });
      const receiptJson = (await receiptRes.json()) as {
        result?: { status?: string } | null;
      };
      if (receiptJson.result) {
        if (receiptJson.result.status === "0x0") {
          throw new Error(`On-chain transaction reverted (${tx.purpose}): ${hash}`);
        }
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    signed.push({
      purpose: tx.purpose,
      tx_hash: hash,
      leg_asset: tx.leg_asset,
      amount_usdc: tx.amount_usdc,
      estimated_apy: tx.estimated_apy,
    });
  }

  return signed;
}

/** Purposes the policy-bounded session key is allowed to execute (USDC Aave path). */
const SESSION_SUPPORTED_PURPOSES = new Set(["approve_usdc_aave", "supply_aave_usdc"]);

type SignedTx = {
  purpose: string;
  tx_hash: string;
  leg_asset?: string;
  amount_usdc?: number;
  estimated_apy?: number;
};

/**
 * Ensure the user has granted the AXIS agent a policy-bounded session key.
 * Prompts exactly one Magic signature the first time, then persists it server-side.
 * Returns the serialized approval, or null when sessions aren't available (e.g. testnet).
 */
export async function ensureSessionApproval(
  userId: string,
  uaAddress: string,
): Promise<string | null> {
  if (!isArbitrumOne()) return null;

  const status = await axisApi.status(userId).catch(() => null);
  if (status?.session_active && status.session_approval) {
    return status.session_approval;
  }

  const magic = getMagic();
  await magic.evm.switchChain(ARBITRUM_ONE_CHAIN_ID);
  const provider = magic.rpcProvider as {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };

  const { address: sessionSignerAddress } = await getSessionSignerAddress();
  const approval = await buildSessionApproval({
    magicProvider: provider,
    ownerAddress: uaAddress,
    sessionSignerAddress,
  });

  await axisApi.enableSession({
    user_id: userId,
    ua_address: uaAddress,
    approval,
    session_signer: sessionSignerAddress,
  });

  return approval;
}

/**
 * Ensure AXIS has a policy-bounded session key so Begin / Apply / LP / GMX
 * run with zero wallet popups. Called automatically at login and again from
 * the dashboard if needed — never framed as a user "signing" step.
 */
export async function enableHandsOff(userId: string, uaAddress: string): Promise<void> {
  if (!isArbitrumOne()) {
    throw new Error("AXIS invests on Arbitrum One. Switch network and try again.");
  }
  const approval = await ensureSessionApproval(userId, uaAddress);
  if (!approval) {
    throw new Error("Couldn't ready your agent. Refresh and try again.");
  }
}

/**
 * Deploy the locked plan. When a session key is active, USDC Aave legs execute
 * gaslessly through the agent (zero prompts). Any USDT swap legs fall back to a
 * single Magic signature. Never fakes success — throws on underfunding or revert.
 */
export async function deployStrategy(body: {
  user_id: string;
  budget_usdc: number;
  risk_level: string;
  goal: string;
  ua_address: string;
  sra_address?: string;
}): Promise<{ status: string; explanation: string; message?: string }> {
  const prepared = await axisApi.prepareDeploy(body);
  if (
    prepared.status !== "pending_signatures" ||
    !prepared.plan ||
    !prepared.transactions?.length
  ) {
    throw new Error(
      prepared.message || "Could not prepare deposits. Check your USDC balance on Arbitrum.",
    );
  }

  const approval = await ensureSessionApproval(body.user_id, body.ua_address).catch(() => null);

  const sessionTxs = prepared.transactions.filter((t) => SESSION_SUPPORTED_PURPOSES.has(t.purpose));
  const clientTxs = prepared.transactions.filter((t) => !SESSION_SUPPORTED_PURPOSES.has(t.purpose));

  const signed_txs: SignedTx[] = [];
  const didToken = getStoredSession()?.didToken;

  if (approval && didToken && sessionTxs.length > 0) {
    const result = await executeSessionCalls({
      data: {
        didToken,
        calls: sessionTxs.map((t) => ({ to: t.to, data: t.data, value: t.value ?? "0x0" })),
      },
    });
    if (!result.success || !result.tx_hash) {
      throw new Error("AXIS could not complete the deposit. Please try again.");
    }
    for (const t of sessionTxs) {
      signed_txs.push({
        purpose: t.purpose,
        tx_hash: result.tx_hash,
        leg_asset: t.leg_asset,
        amount_usdc: t.amount_usdc,
        estimated_apy: t.estimated_apy,
      });
    }
  } else {
    // No session (or unsupported): sign the USDC legs in-wallet too.
    clientTxs.unshift(...sessionTxs);
  }

  if (clientTxs.length > 0) {
    const signedClient = await signActivationTransactions(clientTxs);
    signed_txs.push(...signedClient);
  }

  return axisApi.confirmActivate({
    user_id: body.user_id,
    ua_address: body.ua_address,
    sra_address: body.sra_address,
    budget_usdc: body.budget_usdc,
    risk_level: body.risk_level,
    goal: body.goal,
    plan: prepared.plan,
    signed_txs,
  });
}

/** Backwards-compatible alias. */
export const deployStrategyWithSignatures = deployStrategy;

/**
 * Autonomous rebalance via the session key (no prompts). Backend returns the
 * withdraw/supply calls; the agent executes them gaslessly.
 */
export async function rebalanceViaSession(body: {
  user_id: string;
  ua_address: string;
  instruction: string;
}): Promise<{ status: string; explanation: string; tx_hash?: string }> {
  const prepared = await axisApi.prepareRebalance(body);
  if (prepared.status !== "pending_execution" || !prepared.calls?.length) {
    return { status: prepared.status, explanation: prepared.explanation };
  }

  const approval = await ensureSessionApproval(body.user_id, body.ua_address);
  if (!approval) {
    throw new Error("Your agent isn't ready yet. Refresh the page and try again.");
  }
  const didToken = getStoredSession()?.didToken;
  if (!didToken) {
    throw new Error("Session expired. Please sign in again.");
  }

  const result = await executeSessionCalls({
    data: {
      didToken,
      calls: prepared.calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? "0x0" })),
    },
  });
  if (!result.success || !result.tx_hash) {
    throw new Error("AXIS could not complete the rebalance. Please try again.");
  }

  const confirmed = await axisApi.confirmRebalance({
    user_id: body.user_id,
    ua_address: body.ua_address,
    instruction: body.instruction,
    tx_hash: result.tx_hash,
    actions: prepared.actions ?? [],
  });
  return { ...confirmed, tx_hash: result.tx_hash };
}

/**
 * Enable the market-risk (Uniswap V3 stable LP) path. Rebuilds the session
 * approval WITH the LP permissions baked in — one Magic signature — and records
 * the user's one-time consent. The LP recipient is pinned to the user on-chain.
 */
export async function enableMarketRiskSession(userId: string, uaAddress: string): Promise<void> {
  if (!isArbitrumOne()) {
    throw new Error("The stable LP is available on Arbitrum One only.");
  }
  const magic = getMagic();
  await magic.evm.switchChain(ARBITRUM_ONE_CHAIN_ID);
  const provider = magic.rpcProvider as {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };

  const { address: sessionSignerAddress } = await getSessionSignerAddress();
  const approval = await buildSessionApproval({
    magicProvider: provider,
    ownerAddress: uaAddress,
    sessionSignerAddress,
    includeMarketRisk: true,
  });

  await axisApi.enableSession({
    user_id: userId,
    ua_address: uaAddress,
    approval,
    session_signer: sessionSignerAddress,
  });
  await axisApi.setMarketRiskConsent({
    user_id: userId,
    ua_address: uaAddress,
    consent: true,
  });
}

/**
 * Open a Uniswap V3 USDC/USDT stable LP via the session key (no prompts).
 * Requires the market-risk session (see enableMarketRiskSession) to be active.
 */
export async function openLpViaSession(body: {
  user_id: string;
  ua_address: string;
  usdc_amount?: number;
}): Promise<{ status: string; explanation: string; tx_hash?: string }> {
  const prepared = await axisApi.prepareLp(body);
  if (prepared.status !== "pending_execution" || !prepared.calls?.length) {
    return { status: prepared.status, explanation: prepared.explanation };
  }

  const didToken = getStoredSession()?.didToken;
  if (!didToken) {
    throw new Error("Session expired. Please sign in again.");
  }

  const result = await executeSessionCalls({
    data: {
      didToken,
      calls: prepared.calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? "0x0" })),
    },
  });
  if (!result.success || !result.tx_hash) {
    throw new Error("AXIS could not open the LP. Please try again.");
  }

  const confirmed = await axisApi.confirmLp({
    user_id: body.user_id,
    ua_address: body.ua_address,
    usdc_amount: prepared.usdc_amount,
    tx_hash: result.tx_hash,
  });
  return { ...confirmed, tx_hash: result.tx_hash };
}

/**
 * Close the Uniswap V3 USDC/USDT stable LP via the session key (no prompts).
 * Backend reads the live position on-chain and returns decrease/collect/burn calls;
 * the agent executes them and funds return to the owner (recipient pinned on-chain).
 */
export async function closeLpViaSession(body: {
  user_id: string;
  ua_address: string;
}): Promise<{ status: string; explanation: string; tx_hash?: string }> {
  const prepared = await axisApi.prepareLpExit(body);
  if (prepared.status !== "pending_execution" || !prepared.calls?.length) {
    return { status: prepared.status, explanation: prepared.explanation };
  }

  const didToken = getStoredSession()?.didToken;
  if (!didToken) {
    throw new Error("Session expired. Please sign in again.");
  }

  const result = await executeSessionCalls({
    data: {
      didToken,
      calls: prepared.calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? "0x0" })),
    },
  });
  if (!result.success || !result.tx_hash) {
    throw new Error("AXIS could not close the LP. Please try again.");
  }

  const confirmed = await axisApi.confirmLpExit({
    user_id: body.user_id,
    ua_address: body.ua_address,
    tx_hash: result.tx_hash,
  });
  return { ...confirmed, tx_hash: result.tx_hash };
}

/**
 * Add USDC liquidity to the GMX ETH/USD GM pool via the session key — NO signing.
 * The agent executes approve + sendWnt + sendTokens + createDeposit in one gasless
 * UserOp (receiver pinned to the owner on-chain). Gas is sponsored; GMX's native
 * ETH keeper fee is drawn from the account's own ETH balance (excess refunded).
 * Requires the market-risk session (enableMarketRiskSession) to be active.
 */
export async function depositGmxViaSession(body: {
  user_id: string;
  ua_address: string;
  usdc_amount?: number;
}): Promise<{ status: string; explanation: string; tx_hash?: string }> {
  if (!isArbitrumOne()) {
    throw new Error("GMX is available on Arbitrum One only.");
  }
  const prepared = await axisApi.prepareGmxDeposit(body);
  if (prepared.status !== "pending_execution" || !prepared.calls?.length) {
    return { status: prepared.status, explanation: prepared.explanation };
  }

  const didToken = getStoredSession()?.didToken;
  if (!didToken) {
    throw new Error("Session expired. Please sign in again.");
  }

  const result = await executeSessionCalls({
    data: {
      didToken,
      calls: prepared.calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? "0x0" })),
    },
  });
  if (!result.success || !result.tx_hash) {
    throw new Error(
      "AXIS could not add to GMX. Make sure you have a little ETH for the keeper fee.",
    );
  }

  const confirmed = await axisApi.confirmGmxDeposit({
    user_id: body.user_id,
    ua_address: body.ua_address,
    usdc_amount: prepared.usdc_amount,
    tx_hash: result.tx_hash,
  });
  return { ...confirmed, tx_hash: result.tx_hash };
}

export type RouteApplyResult = {
  applied: Array<{
    venue: string;
    protocol: string;
    asset: string;
    amount_usdc: number;
    tx_hash: string;
  }>;
  skipped: Array<{ venue: string; amount_usdc: number; reason: string }>;
  explanation: string;
};

/**
 * One-tap: apply the entire best-yield route via the session key — NO signing.
 *
 * Runs each venue group as its own gasless UserOp, in order (the stable Aave USDC
 * core first, then the market sleeve). If a leg can't land (e.g. no ETH for the
 * GMX keeper fee), it's skipped gracefully and the rest still go through — then we
 * confirm only the legs that actually executed and return a "what AXIS did" summary.
 */
export async function applyRouteViaSession(body: {
  user_id: string;
  ua_address: string;
  exclude_venues?: string[];
}): Promise<RouteApplyResult> {
  const prepared = await axisApi.prepareRouteApply(body);

  // Venues the backend pre-skipped (e.g. GMX with no ETH for the keeper fee) so
  // the tap never attempts a leg that can't settle.
  const skipped: RouteApplyResult["skipped"] = (prepared.pre_skipped ?? []).map((s) => ({
    venue: s.venue,
    amount_usdc: 0,
    reason: s.reason,
  }));

  if (prepared.status !== "pending_execution" || !prepared.groups?.length) {
    return {
      applied: [],
      skipped,
      explanation: prepared.explanation ?? "Nothing to apply right now.",
    };
  }

  const didToken = getStoredSession()?.didToken;
  if (!didToken) {
    throw new Error("Session expired. Please sign in again.");
  }

  const executed: RouteApplyLeg[] = [];

  for (const group of prepared.groups) {
    try {
      const result = await executeSessionCalls({
        data: {
          didToken,
          calls: group.calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? "0x0" })),
        },
      });
      if (result.success && result.tx_hash) {
        executed.push({
          venue: group.venue,
          tx_hash: result.tx_hash,
          amount_usdc: group.amount_usdc,
          estimated_apy: group.estimated_apy,
        });
      } else {
        skipped.push({
          venue: group.venue,
          amount_usdc: group.amount_usdc,
          reason: "not confirmed",
        });
      }
    } catch (err) {
      skipped.push({
        venue: group.venue,
        amount_usdc: group.amount_usdc,
        reason: err instanceof Error ? err.message : "failed",
      });
    }
  }

  let applied: RouteApplyResult["applied"] = [];
  let explanation = prepared.explanation;
  if (executed.length) {
    const confirmed = await axisApi.confirmRouteApply({
      user_id: body.user_id,
      ua_address: body.ua_address,
      legs: executed,
    });
    applied = confirmed.applied;
    explanation = confirmed.explanation;
  }

  return { applied, skipped, explanation };
}

/**
 * Redeem the account's full GMX ETH/USD GM position back to the owner via the
 * session key — NO signing. Same gasless flow as the deposit; the WETH leg comes
 * back as native ETH and the USDC leg as USDC, both to the owner.
 */
export async function withdrawGmxViaSession(body: {
  user_id: string;
  ua_address: string;
}): Promise<{ status: string; explanation: string; tx_hash?: string }> {
  if (!isArbitrumOne()) {
    throw new Error("GMX is available on Arbitrum One only.");
  }
  const prepared = await axisApi.prepareGmxWithdraw(body);
  if (prepared.status !== "pending_execution" || !prepared.calls?.length) {
    return { status: prepared.status, explanation: prepared.explanation };
  }

  const didToken = getStoredSession()?.didToken;
  if (!didToken) {
    throw new Error("Session expired. Please sign in again.");
  }

  const result = await executeSessionCalls({
    data: {
      didToken,
      calls: prepared.calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? "0x0" })),
    },
  });
  if (!result.success || !result.tx_hash) {
    throw new Error(
      "AXIS could not close GMX. Make sure you have a little ETH for the keeper fee.",
    );
  }

  const confirmed = await axisApi.confirmGmxWithdraw({
    user_id: body.user_id,
    ua_address: body.ua_address,
    tx_hash: result.tx_hash,
  });
  return { ...confirmed, tx_hash: result.tx_hash };
}

const USDC_DECIMALS = 6;
const DUST_USDC = 0.01;

async function readUsdcRaw(owner: string): Promise<bigint> {
  const { createPublicClient, http, getAddress } = await import("viem");
  const { arbitrum } = await import("viem/chains");
  const { erc20Abi } = await import("viem");
  const rpcUrl = requireEnv("VITE_ARBITRUM_RPC_URL");
  const client = createPublicClient({ chain: arbitrum, transport: http(rpcUrl) });
  return client.readContract({
    address: USDC_ARBITRUM,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [getAddress(owner)],
  });
}

function rawToUsdc(raw: bigint): number {
  return Number(raw) / 10 ** USDC_DECIMALS;
}

function usdcToRaw(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

/** Idle native USDC on the Magic EOA (not Aave). */
export async function getIdleUsdcBalance(owner: string): Promise<number> {
  return rawToUsdc(await readUsdcRaw(owner));
}

/**
 * Send idle USDC from the Magic EOA to an external Arbitrum address.
 * If USDC is still in Aave, pulls it back first (gasless). The send itself is
 * owner-signed via Kernel + paymaster so the user does not need ETH.
 */
export async function sendUsdcToAddress(params: {
  to: string;
  amountUsdc?: number;
}): Promise<{ tx_hash: string; amount_usdc: number }> {
  const session = getStoredSession();
  if (!session?.uaAddress) {
    throw new Error("Sign in again, then withdraw.");
  }
  if (!isArbitrumOne()) {
    throw new Error("Withdraw is on Arbitrum One only.");
  }

  const { createPublicClient, http, getAddress, isAddress, encodeFunctionData } = await import("viem");
  const { arbitrum } = await import("viem/chains");
  const { erc20Abi } = await import("viem");

  const trimmed = params.to.trim();
  if (!isAddress(trimmed)) {
    throw new Error("That doesn’t look like an Arbitrum address.");
  }
  const dest = getAddress(trimmed);
  if (dest === getAddress(session.uaAddress)) {
    throw new Error(
      "That’s your AXIS address. Paste MetaMask or an exchange Arbitrum deposit address.",
    );
  }
  if (session.sraAddress && dest === getAddress(session.sraAddress)) {
    throw new Error("That’s the AXIS deposit address. Paste the wallet you want the USDC in.");
  }
  if (dest === getAddress(USDC_ARBITRUM)) {
    throw new Error("That’s the USDC contract, not a wallet.");
  }

  const status = await axisApi.status(session.userId).catch(() => null);
  const invested = (status?.positions ?? []).some(
    (p) =>
      p.status !== "closed" &&
      Number(p.amount_usdc) > DUST_USDC &&
      String(p.protocol || "").toLowerCase().includes("aave"),
  );
  if (invested) {
    await rebalanceViaSession({
      user_id: session.userId,
      ua_address: session.uaAddress,
      instruction: "withdraw",
    });
  }

  let raw = 0n;
  for (let i = 0; i < 12; i++) {
    raw = await readUsdcRaw(session.uaAddress);
    if (raw > 0n) break;
    if (!invested) break;
    await new Promise((r) => setTimeout(r, 1500));
  }

  const idle = rawToUsdc(raw);
  if (idle < DUST_USDC) {
    throw new Error(
      "No USDC in the wallet to send. If you used Bold / GMX / LP, close those on the dashboard first, then ask AXIS “withdraw”.",
    );
  }

  const amount =
    params.amountUsdc == null || Number.isNaN(params.amountUsdc) ? idle : params.amountUsdc;
  if (!(amount >= DUST_USDC)) {
    throw new Error("Minimum send is $0.01 USDC.");
  }
  if (amount > idle + 0.000001) {
    throw new Error(`You only have $${idle.toFixed(2)} USDC idle to send.`);
  }

  const amountRaw = usdcToRaw(Math.min(amount, idle));
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [dest, amountRaw],
  });

  const magic = getMagic();
  await magic.evm.switchChain(ARBITRUM_ONE_CHAIN_ID);
  const provider = magic.rpcProvider as {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };

  const zerodevRpc = import.meta.env.VITE_ZERODEV_RPC_URL?.toString().trim();
  if (zerodevRpc) {
    let submitted = false;
    try {
      const {
        constants,
        createKernelAccount,
        createKernelAccountClient,
        createZeroDevPaymasterClient,
        getUserOperationGasPrice,
      } = await import("@zerodev/sdk");
      const publicClient = createPublicClient({
        chain: arbitrum,
        transport: http(requireEnv("VITE_ARBITRUM_RPC_URL")),
      });
      const entryPoint = constants.getEntryPoint("0.7");
      const account = await createKernelAccount(publicClient, {
        entryPoint,
        kernelVersion: constants.KERNEL_V3_3,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eip7702Account: provider as any,
        address: getAddress(session.uaAddress),
      });
      const paymasterClient = createZeroDevPaymasterClient({
        chain: arbitrum,
        transport: http(zerodevRpc),
      });
      const kernelClient = createKernelAccountClient({
        account,
        chain: arbitrum,
        bundlerTransport: http(zerodevRpc),
        client: publicClient,
        paymaster: paymasterClient,
        userOperation: {
          estimateFeesPerGas: async ({ bundlerClient }) => getUserOperationGasPrice(bundlerClient),
        },
      });
      submitted = true;
      const userOpHash = await kernelClient.sendUserOperation({
        calls: [{ to: USDC_ARBITRUM, data, value: 0n }],
      });
      const receipt = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });
      const txHash = receipt.receipt.transactionHash;
      if (!receipt.success || !txHash) {
        throw new Error("Send did not confirm on-chain.");
      }
      return { tx_hash: txHash, amount_usdc: rawToUsdc(amountRaw) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (submitted) {
        throw error instanceof Error ? error : new Error(message);
      }
      // Kernel client did not start — try a direct Magic transfer (needs a little ETH).
    }
  }

  try {
    const hash = (await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: session.uaAddress,
          to: USDC_ARBITRUM,
          data,
          value: "0x0",
        },
      ],
    })) as string;
    if (!hash?.startsWith("0x")) {
      throw new Error("Wallet did not return a transaction hash.");
    }
    return { tx_hash: hash, amount_usdc: rawToUsdc(amountRaw) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/insufficient|gas required/i.test(message)) {
      throw new Error(
        "Send needs a Magic confirm. If it failed, the gasless path missed — try again, or keep a little ETH on Arbitrum in this account.",
      );
    }
    throw error instanceof Error ? error : new Error(message);
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
