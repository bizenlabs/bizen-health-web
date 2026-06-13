import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirror the tsconfig `@/* -> ./*` path alias so tests can import modules the
// same way app code does. Without this, importing any module that (transitively)
// uses an `@/...` import fails to resolve under Vitest.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
