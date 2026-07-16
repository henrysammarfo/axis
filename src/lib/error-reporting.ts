export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  console.error("[AXIS]", error, context);
}
