import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      JWT_ACCESS_SECRET: "test-access-secret",
    },
  },
});
