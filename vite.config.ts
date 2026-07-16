import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => ({
  define: {
    // Static replaces for libs that read process.env.NODE_ENV at build time.
    // Particle also accesses process.env dynamically — see src/lib/process-polyfill.ts.
    "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      server: {
        entry: "server",
      },
    }),
    viteReact(),
    tailwindcss(),
    nitro(),
  ],
}));
