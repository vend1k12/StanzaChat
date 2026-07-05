import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for StanzaChat.
 *
 * The `webServer` starts the production Next.js server (`next start`) in CI
 * and `next dev` locally. `PORT` (default 3000) drives both the Next.js
 * process and the URL Playwright waits on, so a local run can pick a free
 * port by exporting `PORT=<n>` — useful when 3000 is taken by another app.
 *
 * Note: `next.config.ts` sets `output: "standalone"` for Phase 5 Docker
 * builds. `next start` emits a warning about that combination but still
 * serves the app correctly; a Phase 5 follow-up will switch the E2E
 * server to the standalone entrypoint alongside proper asset copying.
 */
const port = process.env.PORT ?? "3000";
const baseURL = process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`;

export default defineConfig({
  globalSetup: "./e2e/global.setup.ts",
  testDir: "./e2e",
  // Every spec exercises the shared Postgres, and specs that depend on
  // first-run promotion (admin.spec.ts, workspace.spec.ts) require the
  // TRUNCATE from `global.setup.ts` to still be in effect when they
  // run. Serialising specs — even locally — keeps them from racing over
  // the "first sign-up" invariant. Tests inside a file remain parallel.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
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
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
