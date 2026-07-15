/**
 * Particle ships index.d.ts but omits it from package.json "exports",
 * so TypeScript fails to resolve types under moduleResolution bundler/node16.
 */
declare module "@particle-network/universal-account-sdk" {
  export const UNIVERSAL_ACCOUNT_VERSION: string;
  export const UNIVERSAL_ACCOUNT_VERSION_V2: string;

  export class UniversalAccount {
    constructor(config: {
      projectId: string;
      projectClientKey: string;
      projectAppUuid: string;
      smartAccountOptions?: {
        name?: string;
        version?: string;
        ownerAddress?: string;
        useEIP7702?: boolean;
      };
      tradeConfig?: Record<string, unknown>;
      rpcUrl?: string;
    });

    getSmartAccountOptions(): Promise<{
      smartAccountAddress?: string;
      solanaSmartAccountAddress?: string;
      ownerAddress?: string;
      useEIP7702?: boolean;
    }>;

    getEIP7702Deployments(): Promise<Array<{ chainId: number; isDelegated?: boolean }>>;

    getEIP7702Auth(chainIds: number[]): Promise<Array<{ address: string; nonce: number }>>;

    sendTransaction(
      transaction: unknown,
      signature: string,
      authorizations?: Array<{ userOpHash: string; signature: string }>,
    ): Promise<{ transactionId?: string }>;
  }
}
