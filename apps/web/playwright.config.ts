import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for StanzaChat.
 *
 * Phase 1 smoke test: sign-up page renders, sign-in page renders.
 * The E2E job in CI starts `next start` against a compose Postgres
 * with a mocked LLM provider. For Phase 1, we test auth page rendering
 * only; full chat/artifact E2E arrives in Phase 3.
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
  webServer: process.env.CI
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
