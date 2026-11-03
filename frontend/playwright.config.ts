import { defineConfig } from "@playwright/test";

const FRONTEND = 3100;
const BACKEND = 4100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${FRONTEND}`,
    // Uses the installed Chrome. Set E2E_BROWSER_CHANNEL= (empty) to use Playwright's own Chromium.
    channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npx tsx tests/e2e-server.ts",
      cwd: "../backend",
      url: `http://localhost:${BACKEND}/api/v1/health`,
      reuseExistingServer: process.env.E2E_REUSE === "true",
      timeout: 60_000,
      env: {
        NODE_ENV: "test",
        PORT: String(BACKEND),
        MONGODB_URI: process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/sas3d_e2e?replicaSet=rs0",
        BETTER_AUTH_SECRET: "e2e-only-secret-e2e-only-secret-e2e-only",
        BETTER_AUTH_URL: `http://localhost:${FRONTEND}`,
        FRONTEND_URL: `http://localhost:${FRONTEND}`,
        SEED_ADMIN_EMAIL: "owner@e2e.test",
        SEED_ADMIN_PASSWORD: "e2e-owner-password",
        SEED_ADMIN_NAME: "E2E Owner",
        JOBS_ENABLED: "false",
        UPLOAD_DIR: "./tmp-test-uploads",
      },
    },
    {
      command: `npx next build && npx next start -p ${FRONTEND}`,
      url: `http://localhost:${FRONTEND}/login`,
      reuseExistingServer: process.env.E2E_REUSE === "true",
      timeout: 300_000,
      env: { BACKEND_URL: `http://127.0.0.1:${BACKEND}` },
    },
  ],
});
