// @ts-check
import { fileURLToPath } from "node:url";

/**
 * Base Vitest options shared by every workspace.
 * Use with `mergeConfig(corexVitest, defineConfig({ ... }))`.
 *
 * @param {{ environment?: "node" | "jsdom" }} [options]
 * @returns {import("vitest/config").ViteUserConfig}
 */
export function corexVitest({ environment = "node" } = {}) {
  return {
    // Resolve tsconfig "paths" such as "@/*" (Vite 8 native support).
    resolve: { tsconfigPaths: true },
    test: {
      environment,
      globals: true,
      include: ["**/*.test.{ts,tsx,mjs}"],
      exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**", "e2e/**"],
      setupFiles:
        environment === "jsdom" ? [fileURLToPath(new URL("./setup.mjs", import.meta.url))] : [],
      restoreMocks: true,
    },
  };
}
