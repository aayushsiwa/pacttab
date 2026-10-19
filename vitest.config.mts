import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    testTimeout: 35000,
    hookTimeout: 35000,
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
});
