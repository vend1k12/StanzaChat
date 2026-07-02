import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for StanzaChat.
 *
 * Phase 1 smoke test: auth pages render and forms are interactive.
 * The `webServer` starts the production Next.js server (`next start`)
 * after the build step has completed. Locally it starts `next dev`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI ? "bun run start" : "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
