/**
 * Client-side: build the one-time, policy-bounded session approval the user signs.
 *
 * The approval lets the AXIS agent session key act on the user's Kernel (EIP-7702)
 * account, but ONLY for a tight allowlist:
 *   - approve USDC to the Aave Pool
 *   - supply USDC to Aave on behalf of the user (onBehalfOf pinned to the owner)
 *   - withdraw USDC from Aave to the user (to pinned to the owner)
 * Funds can never leave the user's own account, even if the agent key is compromised.
 *
 * Serializing triggers exactly one signature from the Magic wallet (the owner
 * approving the session). After that, deposits and rebalances are prompt-free.
 */

import { ARBITRUM_ONE_CHAIN_ID } from "./chain";

// Arbitrum One (public addresses; mirror backend/chain_config.py)
export const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
export const AAVE_POOL_ARBITRUM = "0x794a61358D6845594F94dc1DB02A252b5b4814aD" as const;

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const AAVE_POOL_ABI = [
  {
    type: "function",
    name: "supply",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type MagicEip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/**
 * Build and serialize the owner-approved, policy-bounded session account.
 * Returns the serialized approval string to persist server-side.
 */
export async function buildSessionApproval(params: {
  magicProvider: MagicEip1193Provider;
  ownerAddress: string;
  sessionSignerAddress: string;
}): Promise<string> {
  const { magicProvider, ownerAddress, sessionSignerAddress } = params;

  const { createPublicClient, custom, http, getAddress } = await import("viem");
  const { arbitrum } = await import("viem/chains");
  const { constants, createKernelAccount } = await import("@zerodev/sdk");
  const { toPermissionValidator, serializePermissionAccount } = await import("@zerodev/permissions");
  const { toEmptyECDSASigner } = await import("@zerodev/permissions/signers");
  const { toCallPolicy, CallPolicyVersion, toRateLimitPolicy, ParamCondition } = await import(
    "@zerodev/permissions/policies"
  );

  const owner = getAddress(ownerAddress);
  const rpcUrl = import.meta.env.VITE_ARBITRUM_RPC_URL?.toString().trim();
  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: rpcUrl ? http(rpcUrl) : custom(magicProvider),
  });
  const entryPoint = constants.getEntryPoint("0.7");
  const KERNEL_V3_3 = constants.KERNEL_V3_3;

  const callPolicy = toCallPolicy({
    policyVersion: CallPolicyVersion.V0_0_4,
    permissions: [
      {
        target: USDC_ARBITRUM,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [{ condition: ParamCondition.EQUAL, value: AAVE_POOL_ARBITRUM }, null],
      },
      {
        target: AAVE_POOL_ARBITRUM,
        abi: AAVE_POOL_ABI,
        functionName: "supply",
        args: [
          { condition: ParamCondition.EQUAL, value: USDC_ARBITRUM },
          null,
          { condition: ParamCondition.EQUAL, value: owner },
          null,
        ],
      },
      {
        target: AAVE_POOL_ARBITRUM,
        abi: AAVE_POOL_ABI,
        functionName: "withdraw",
        args: [
          { condition: ParamCondition.EQUAL, value: USDC_ARBITRUM },
          null,
          { condition: ParamCondition.EQUAL, value: owner },
        ],
      },
    ],
  });

  // Cap how often the agent can act, as a belt-and-suspenders limit.
  const rateLimitPolicy = toRateLimitPolicy({ count: 100, interval: 60 * 60 * 24 });

  const emptySessionSigner = toEmptyECDSASigner(getAddress(sessionSignerAddress));

  const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_3,
    signer: emptySessionSigner,
    policies: [callPolicy, rateLimitPolicy],
  });

  const sessionAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_3,
    // 7702: the EOA itself is the account; owner (Magic) is the root signer.
    eip7702Account: magicProvider,
    address: owner,
    plugins: {
      regular: permissionPlugin,
    },
  });

  // Serializing prompts exactly one owner signature (the session approval).
  return serializePermissionAccount(sessionAccount);
}

export const SESSION_CHAIN_ID = ARBITRUM_ONE_CHAIN_ID;
