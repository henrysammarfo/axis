/**
 * Server-side ZeroDev session-key executor (TanStack Start server functions).
 *
 * The AXIS agent holds a single session signer (AGENT_WALLET_PRIVATE_KEY). Each
 * user grants that signer a *policy-bounded* approval (see src/lib/kernel-session.ts):
 * it can only approve/supply/withdraw USDC to Aave on the user's own behalf.
 * With that approval the agent submits gasless UserOps here — no user prompts.
 *
 * Heavy web3 deps are imported inside handlers so they never reach the client bundle.
 */

import { createServerFn } from "@tanstack/react-start";

const ARBITRUM_ONE_CHAIN_ID = 42161;

function serverEnv(name: string, ...fallbacks: string[]): string {
  const names = [name, ...fallbacks];
  for (const n of names) {
    const v = process.env[n]?.toString().trim();
    if (v) return v;
  }
  throw new Error(`Missing server env ${name}. Set it on the deployment.`);
}

function normalizePrivateKey(raw: string): `0x${string}` {
  const trimmed = raw.trim();
  const hex = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (hex.length !== 66) {
    throw new Error("AGENT_WALLET_PRIVATE_KEY must be a 32-byte hex private key.");
  }
  return hex as `0x${string}`;
}

/** Public address of the agent session signer — the browser needs it to scope the approval. */
export const getSessionSignerAddress = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ address: string }> => {
    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(normalizePrivateKey(serverEnv("AGENT_WALLET_PRIVATE_KEY")));
    return { address: account.address };
  },
);

type SessionCall = { to: string; data: string; value?: string };

export type SessionExecuteResult = {
  user_op_hash: string;
  tx_hash: string;
  success: boolean;
};

function apiBase(): string {
  return (
    process.env.API_URL?.toString().trim() ||
    process.env.VITE_API_URL?.toString().trim() ||
    "http://localhost:8000"
  );
}

/**
 * Verify the caller's Magic token with the backend and load THEIR stored session
 * approval. The client never supplies the approval blob — this prevents replaying a
 * leaked approval against the shared agent signer / paymaster.
 */
async function loadApprovalForToken(didToken: string): Promise<string> {
  const base = apiBase();
  const verifyRes = await fetch(`${base}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ did_token: didToken }),
  });
  if (!verifyRes.ok) throw new Error("Not authorized.");
  const verify = (await verifyRes.json()) as { valid?: boolean; user_id?: string };
  if (!verify.valid || !verify.user_id) throw new Error("Not authorized.");

  const approvalRes = await fetch(
    `${base}/api/agent/session/approval/${encodeURIComponent(verify.user_id)}`,
    { headers: { Authorization: `Bearer ${didToken}` } },
  );
  if (!approvalRes.ok) throw new Error("Hands-off session not found.");
  const body = (await approvalRes.json()) as { approval?: string };
  if (!body.approval) throw new Error("Hands-off session not found.");
  return body.approval;
}

/**
 * Execute a batch of calls through the authenticated user's approved session key.
 * Gasless via the ZeroDev paymaster. Only calls permitted by the on-chain policy
 * succeed — and the approval is loaded server-side for the authenticated caller only.
 */
export const executeSessionCalls = createServerFn({ method: "POST" })
  .validator((data: { didToken: string; calls: SessionCall[] }) => {
    if (!data?.didToken || !Array.isArray(data.calls) || data.calls.length === 0) {
      throw new Error("didToken and non-empty calls are required");
    }
    return data;
  })
  .handler(async ({ data }): Promise<SessionExecuteResult> => {
    const approval = await loadApprovalForToken(data.didToken);

    const { createPublicClient, http } = await import("viem");
    const { privateKeyToAccount } = await import("viem/accounts");
    const { arbitrum } = await import("viem/chains");
    const {
      constants,
      createKernelAccountClient,
      createZeroDevPaymasterClient,
      getUserOperationGasPrice,
    } = await import("@zerodev/sdk");
    const { deserializePermissionAccount } = await import("@zerodev/permissions");
    const { toECDSASigner } = await import("@zerodev/permissions/signers");

    const rpcUrl = serverEnv("ARBITRUM_RPC", "ARBITRUM_RPC_URL", "VITE_ARBITRUM_RPC_URL");
    const bundlerUrl = serverEnv("ZERODEV_BUNDLER_URL", "ZERODEV_RPC_URL");
    const paymasterUrl = serverEnv("ZERODEV_PAYMASTER_URL", "ZERODEV_RPC_URL");
    const agentKey = normalizePrivateKey(serverEnv("AGENT_WALLET_PRIVATE_KEY"));

    const entryPoint = constants.getEntryPoint("0.7");
    const publicClient = createPublicClient({ chain: arbitrum, transport: http(rpcUrl) });

    const sessionSigner = await toECDSASigner({ signer: privateKeyToAccount(agentKey) });
    const sessionAccount = await deserializePermissionAccount(
      publicClient,
      entryPoint,
      constants.KERNEL_V3_3,
      approval,
      sessionSigner,
    );

    const paymasterClient = createZeroDevPaymasterClient({
      chain: arbitrum,
      transport: http(paymasterUrl),
    });

    const kernelClient = createKernelAccountClient({
      account: sessionAccount,
      chain: arbitrum,
      bundlerTransport: http(bundlerUrl),
      client: publicClient,
      paymaster: paymasterClient,
      userOperation: {
        estimateFeesPerGas: async ({ bundlerClient }) => getUserOperationGasPrice(bundlerClient),
      },
    });

    const calls = data.calls.map((c) => ({
      to: c.to as `0x${string}`,
      data: (c.data ?? "0x") as `0x${string}`,
      value: BigInt(c.value ?? "0"),
    }));

    const userOpHash = await kernelClient.sendUserOperation({ calls });
    const receipt = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });

    return {
      user_op_hash: userOpHash,
      tx_hash: receipt.receipt.transactionHash,
      success: Boolean(receipt.success),
    };
  });

export const AGENT_EXECUTOR_CHAIN_ID = ARBITRUM_ONE_CHAIN_ID;
