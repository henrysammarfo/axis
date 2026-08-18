/** Short, human error copy. Never pass RPC dumps / UserOp hex to the UI. */

const DUMP =
  /request body|calldata|pm_getpaymaster|useroperation|rpc request failed|0xe9ae5c53|0x[0-9a-f]{48,}/i;

export function userFacingError(error: unknown, fallback: string): string {
  const raw = collectMessage(error);
  const mapped = mapKnown(raw);
  if (mapped) return mapped;
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact || DUMP.test(compact) || compact.length > 180) return fallback;
  return compact;
}

function collectMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error
        ? error.cause.message
        : typeof error.cause === "string"
          ? error.cause
          : "";
    return [error.message, cause].filter(Boolean).join(" ");
  }
  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
}

function mapKnown(raw: string): string | null {
  const t = raw.toLowerCase();
  if (
    t.includes("0x2c5211c6") ||
    t.includes("erc20insufficientbalance") ||
    t.includes("insufficient balance")
  ) {
    return "No USDC to move yet. Send at least $10 native USDC on Arbitrum to your AXIS address, then tap Begin.";
  }
  if (t.includes("add at least") && t.includes("usdc")) {
    return "Add at least $10 native USDC on Arbitrum to your AXIS address, then tap Begin.";
  }
  if (t.includes("nothing in aave") || t.includes("no usdc in the wallet")) {
    return "Nothing to withdraw yet. Fund the AXIS address, tap Begin, then send out from Settings.";
  }
  if (t.includes("rejected") || t.includes("denied") || t.includes("cancelled") || t.includes("canceled")) {
    return "Send cancelled.";
  }
  if (t.includes("paymaster") || t.includes("aa21") || t.includes("aa23") || t.includes("aa31")) {
    return "Gas sponsorship missed that one. Wait a few seconds and try again.";
  }
  return null;
}
