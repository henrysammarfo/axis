/**
 * Particle Universal Account SDK (and some wallet deps) read `process.env`
 * via dynamic property access, which Vite cannot statically replace.
 * Install a minimal browser polyfill before any wallet SDK loads.
 */
export function ensureProcessPolyfill(): void {
  // Cast through `unknown` so we don't intersect with Node's full `Process`
  // type (from @types/node) — we only need a minimal shape here.
  const g = globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  };
  const proc = (g.process ??= {});
  const env = (proc.env ??= {});
  if (!env.NODE_ENV) {
    env.NODE_ENV = import.meta.env.PROD ? "production" : "development";
  }
}

ensureProcessPolyfill();
