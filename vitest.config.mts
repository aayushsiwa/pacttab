import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    testTimeout: 35000,
    hookTimeout: 35000,
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
});
