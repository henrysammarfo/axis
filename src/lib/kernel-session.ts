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

// Uniswap V3 USDC/USDT stable LP (market-risk strategy, consent-gated).
// Addresses + offsets MUST mirror backend/services/uniswap_lp.py (locked by
// backend/tests/test_uniswap_lp.py).
export const USDT_ARBITRUM = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as const;
export const UNISWAP_SWAP_ROUTER = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" as const;
export const UNISWAP_V3_NPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as const;
const LP_FEE = 100; // 0.01% stable pool
// Static-tuple field offsets (bytes, post-selector) of the pinned words.
const MINT_TOKEN0_OFFSET = 0;
const MINT_TOKEN1_OFFSET = 32;
const MINT_FEE_OFFSET = 64;
const MINT_RECIPIENT_OFFSET = 288; // field index 9
const SWAP_TOKENIN_OFFSET = 0;
const SWAP_TOKENOUT_OFFSET = 32;
const SWAP_FEE_OFFSET = 64;
const SWAP_RECIPIENT_OFFSET = 96; // field index 3
const COLLECT_RECIPIENT_OFFSET = 32; // field index 1
const UNISWAP_SIGNATURES = {
  swap: "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))",
  mint: "mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))",
  decrease: "decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))",
  collect: "collect((uint256,address,uint128,uint128))",
  burn: "burn(uint256)",
} as const;

// GMX V2 GM ETH/USD pool (signing-free market-risk strategy, consent-gated).
// Addresses + pinned offsets MUST mirror backend/services/gmx_gm.py (locked by
// backend/tests/test_gmx_gm.py). Deposits/withdrawals run as individual session
// calls (NOT GMX's multicall), so createDeposit/createWithdrawal are direct calls
// whose `receiver`/`market` we pin at fixed offsets — a leaked agent key can only
// ever route GM tokens/withdrawals back to the owner.
export const GMX_EXCHANGE_ROUTER = "0x69C527fC77291722b52649E45c838e41be8Bf5d5" as const;
export const GMX_ROUTER = "0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6" as const;
export const GMX_DEPOSIT_VAULT = "0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55" as const;
export const GMX_WITHDRAWAL_VAULT = "0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701c55" as const;
export const GMX_GM_ETH_USD_MARKET = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336" as const;
// sendWnt(address,uint256): receiver @0. sendTokens(address,address,uint256): token @0, receiver @32.
const GMX_SENDWNT_RECEIVER_OFFSET = 0;
const GMX_SENDTOKENS_TOKEN_OFFSET = 0;
const GMX_SENDTOKENS_RECEIVER_OFFSET = 32;
// create* structs (empty swap paths + dataList → deterministic layout).
const GMX_DEPOSIT_RECEIVER_OFFSET = 224;
const GMX_DEPOSIT_MARKET_OFFSET = 320;
const GMX_WITHDRAW_RECEIVER_OFFSET = 256;
const GMX_WITHDRAW_MARKET_OFFSET = 352;
// Max ETH the session may forward as the keeper execution fee (mirror gmx_gm.py).
const GMX_SEND_WNT_VALUE_CAP = 10_000_000_000_000_000n; // 0.01 ETH
const GMX_SIGNATURES = {
  sendWnt: "sendWnt(address,uint256)",
  sendTokens: "sendTokens(address,address,uint256)",
  createDeposit:
    "createDeposit(((address,address,address,address,address,address,address[],address[]),uint256,bool,uint256,uint256,bytes32[]))",
  createWithdrawal:
    "createWithdrawal(((address,address,address,address,address[],address[]),uint256,uint256,bool,uint256,uint256,bytes32[]))",
} as const;

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
  /**
   * When true, also authorize the market-risk paths — the Uniswap V3 USDC/USDT
   * stable LP (swap + mint + decrease/collect/burn) AND the GMX V2 GM ETH/USD
   * pool (approve + sendWnt + sendTokens + createDeposit/createWithdrawal).
   * Recipients/receivers are pinned to the owner, so funds can only ever return
   * to the user even if the agent key is compromised. Gate on explicit consent.
   */
  includeMarketRisk?: boolean;
}): Promise<string> {
  const { magicProvider, ownerAddress, sessionSignerAddress, includeMarketRisk } = params;

  const { createPublicClient, custom, http, getAddress, pad, toHex, toFunctionSelector } =
    await import("viem");
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

  // Aave USDC path (always on). ABI-based param pinning.
  const basePermissions = [
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
  ];

  // Market-risk path (Uniswap V3 USDC/USDT stable LP), consent-gated.
  // Uniswap's mint/swap/collect take a single static struct, so their fields
  // are inline — we pin token0/token1/fee and the owner recipient via manual
  // rules at fixed calldata offsets (see backend/services/uniswap_lp.py).
  const word = (value: string | number | bigint) =>
    pad(typeof value === "string" ? getAddress(value) : toHex(value), { size: 32 });
  const eq = (offset: number, value: string | number | bigint) => ({
    condition: ParamCondition.EQUAL,
    offset,
    params: [word(value)],
  });
  const marketRiskPermissions = includeMarketRisk
    ? [
        // approve USDC -> SwapRouter, USDC/USDT -> Position Manager
        {
          target: USDC_ARBITRUM,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [{ condition: ParamCondition.EQUAL, value: UNISWAP_SWAP_ROUTER }, null],
        },
        {
          target: USDC_ARBITRUM,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [{ condition: ParamCondition.EQUAL, value: UNISWAP_V3_NPM }, null],
        },
        {
          target: USDT_ARBITRUM,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [{ condition: ParamCondition.EQUAL, value: UNISWAP_V3_NPM }, null],
        },
        // swap: tokenIn=USDC, tokenOut=USDT, fee=100, recipient=owner
        {
          target: UNISWAP_SWAP_ROUTER,
          selector: toFunctionSelector(UNISWAP_SIGNATURES.swap),
          valueLimit: 0n,
          rules: [
            eq(SWAP_TOKENIN_OFFSET, USDC_ARBITRUM),
            eq(SWAP_TOKENOUT_OFFSET, USDT_ARBITRUM),
            eq(SWAP_FEE_OFFSET, LP_FEE),
            eq(SWAP_RECIPIENT_OFFSET, owner),
          ],
        },
        // mint: token0=USDC, token1=USDT, fee=100, recipient=owner
        {
          target: UNISWAP_V3_NPM,
          selector: toFunctionSelector(UNISWAP_SIGNATURES.mint),
          valueLimit: 0n,
          rules: [
            eq(MINT_TOKEN0_OFFSET, USDC_ARBITRUM),
            eq(MINT_TOKEN1_OFFSET, USDT_ARBITRUM),
            eq(MINT_FEE_OFFSET, LP_FEE),
            eq(MINT_RECIPIENT_OFFSET, owner),
          ],
        },
        // decreaseLiquidity: moves tokens into the position's owed balance only.
        {
          target: UNISWAP_V3_NPM,
          selector: toFunctionSelector(UNISWAP_SIGNATURES.decrease),
          valueLimit: 0n,
          rules: [],
        },
        // collect: recipient=owner (the only fund-exit; pinned to the user).
        {
          target: UNISWAP_V3_NPM,
          selector: toFunctionSelector(UNISWAP_SIGNATURES.collect),
          valueLimit: 0n,
          rules: [eq(COLLECT_RECIPIENT_OFFSET, owner)],
        },
        // burn: only burns an emptied position owned by the account.
        {
          target: UNISWAP_V3_NPM,
          selector: toFunctionSelector(UNISWAP_SIGNATURES.burn),
          valueLimit: 0n,
          rules: [],
        },

        // --- GMX V2 GM ETH/USD pool (signing-free; keeper fee from user ETH) ---
        // approve USDC / GM token -> GMX Router (the ERC20 approval target).
        {
          target: USDC_ARBITRUM,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [{ condition: ParamCondition.EQUAL, value: GMX_ROUTER }, null],
        },
        {
          target: GMX_GM_ETH_USD_MARKET,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [{ condition: ParamCondition.EQUAL, value: GMX_ROUTER }, null],
        },
        // sendWnt(vault, fee): the ONLY call allowed to carry ETH value (capped).
        // Pin the receiver to the Deposit/Withdrawal vault so the fee can't be
        // diverted; value is bounded by GMX_SEND_WNT_VALUE_CAP.
        {
          target: GMX_EXCHANGE_ROUTER,
          selector: toFunctionSelector(GMX_SIGNATURES.sendWnt),
          valueLimit: GMX_SEND_WNT_VALUE_CAP,
          rules: [eq(GMX_SENDWNT_RECEIVER_OFFSET, GMX_DEPOSIT_VAULT)],
        },
        {
          target: GMX_EXCHANGE_ROUTER,
          selector: toFunctionSelector(GMX_SIGNATURES.sendWnt),
          valueLimit: GMX_SEND_WNT_VALUE_CAP,
          rules: [eq(GMX_SENDWNT_RECEIVER_OFFSET, GMX_WITHDRAWAL_VAULT)],
        },
        // sendTokens(token, vault, amount): USDC -> DepositVault (fund a deposit).
        {
          target: GMX_EXCHANGE_ROUTER,
          selector: toFunctionSelector(GMX_SIGNATURES.sendTokens),
          valueLimit: 0n,
          rules: [
            eq(GMX_SENDTOKENS_TOKEN_OFFSET, USDC_ARBITRUM),
            eq(GMX_SENDTOKENS_RECEIVER_OFFSET, GMX_DEPOSIT_VAULT),
          ],
        },
        // sendTokens: GM token -> WithdrawalVault (fund a withdrawal).
        {
          target: GMX_EXCHANGE_ROUTER,
          selector: toFunctionSelector(GMX_SIGNATURES.sendTokens),
          valueLimit: 0n,
          rules: [
            eq(GMX_SENDTOKENS_TOKEN_OFFSET, GMX_GM_ETH_USD_MARKET),
            eq(GMX_SENDTOKENS_RECEIVER_OFFSET, GMX_WITHDRAWAL_VAULT),
          ],
        },
        // createDeposit: receiver=owner, market=GM ETH/USD (both pinned).
        {
          target: GMX_EXCHANGE_ROUTER,
          selector: toFunctionSelector(GMX_SIGNATURES.createDeposit),
          valueLimit: 0n,
          rules: [
            eq(GMX_DEPOSIT_RECEIVER_OFFSET, owner),
            eq(GMX_DEPOSIT_MARKET_OFFSET, GMX_GM_ETH_USD_MARKET),
          ],
        },
        // createWithdrawal: receiver=owner, market=GM ETH/USD (both pinned).
        {
          target: GMX_EXCHANGE_ROUTER,
          selector: toFunctionSelector(GMX_SIGNATURES.createWithdrawal),
          valueLimit: 0n,
          rules: [
            eq(GMX_WITHDRAW_RECEIVER_OFFSET, owner),
            eq(GMX_WITHDRAW_MARKET_OFFSET, GMX_GM_ETH_USD_MARKET),
          ],
        },
      ]
    : [];

  const callPolicy = toCallPolicy({
    policyVersion: CallPolicyVersion.V0_0_4,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    permissions: [...basePermissions, ...marketRiskPermissions] as any,
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
