import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@silhouette/shared-types": new URL(
        "../shared-types/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
});
