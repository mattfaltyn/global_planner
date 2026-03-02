import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/*.real.spec.ts"],
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3101",
    port: 3101,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-real",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-angle=swiftshader",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
          ],
        },
      },
    },
  ],
});
