import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      BETTER_AUTH_URL: "http://localhost:4000",
      FRONTEND_URL: "http://localhost:3000",
      JOBS_ENABLED: "false",
      UPLOAD_DIR: "./tmp-test-uploads",
    },
  },
});
