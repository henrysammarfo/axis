/**
 * Particle Universal Account SDK (and some wallet deps) read `process.env`
 * via dynamic property access, which Vite cannot statically replace.
 * Install a minimal browser polyfill before any wallet SDK loads.
 */
export function ensureProcessPolyfill(): void {
  const g = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  if (!g.process) {
    g.process = { env: {} };
  } else if (!g.process.env) {
    g.process.env = {};
  }
  const env = g.process.env;
  if (!env.NODE_ENV) {
    env.NODE_ENV = import.meta.env.PROD ? "production" : "development";
  }
}

ensureProcessPolyfill();
