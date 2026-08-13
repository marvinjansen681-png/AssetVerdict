import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Minimal, additive config: resolves the `@/*` alias (already declared in
 * tsconfig.json) so tests can import files that use it directly — notably
 * API route handlers (app/api/**\/route.ts), which use `@/...` imports like
 * every other route in this codebase. Existing tests all use relative
 * imports and are unaffected; this only adds a capability, it doesn't change
 * how anything currently resolves.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
