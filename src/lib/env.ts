/** Frontend environment validation — all keys are required. */

const REQUIRED_FRONTEND_ENV = [
  "VITE_API_URL",
  "VITE_MAGIC_PUBLISHABLE_KEY",
  "VITE_PARTICLE_PROJECT_ID",
  "VITE_PARTICLE_CLIENT_KEY",
  "VITE_PARTICLE_APP_ID",
  "VITE_ZERODEV_PROJECT_ID",
  "VITE_ZERODEV_RPC_URL",
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_ARBITRUM_RPC_URL",
  "VITE_ARBITRUM_CHAIN_ID",
] as const;

export type FrontendEnvKey = (typeof REQUIRED_FRONTEND_ENV)[number];

export function missingFrontendEnv(): FrontendEnvKey[] {
  return REQUIRED_FRONTEND_ENV.filter((key) => !import.meta.env[key]?.toString().trim());
}

export function assertFrontendEnv(): void {
  const missing = missingFrontendEnv();
  if (missing.length === 0) return;

  throw new Error(
    `AXIS requires all frontend environment variables. Missing: ${missing.join(", ")}. See docs/KEYS_SETUP.md`,
  );
}

export function isFrontendFullyConfigured(): boolean {
  return missingFrontendEnv().length === 0;
}
