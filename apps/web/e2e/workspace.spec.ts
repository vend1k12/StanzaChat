import { expect, test } from "@playwright/test";

import { truncateAll } from "./helpers/db";

/**
 * Phase 3 E2E — SPEC §10 done-when:
 *   register → chat (mocked provider) → artifact renders in sandbox →
 *   version history navigates.
 *
 * Runs against `E2E_MOCK_PROVIDER=1`, so `POST /api/chat` uses the
 * server-side mock LanguageModel that emits two `<artifact>` blocks
 * (identifier `welcome-card`, v1 + v2) in a single assistant turn — no
 * provider API key required.
 *
 * First successful sign-up becomes the instance admin and auto-creates a
 * personal org + default workspace (SPEC §5.4), so the test user can
 * immediately use chat and (optionally) register a provider config.
 *
 * `truncateAll` in `beforeAll` guarantees this spec owns the first
 * sign-up regardless of file ordering — otherwise `admin.spec.ts`
 * (which runs first alphabetically) would consume it and the workspace
 * user would come in as a regular user (403 on admin routes).
 */

test.describe("workspace artifact round-trip", () => {
  test.beforeAll(async () => {
    await truncateAll();
  });

  test("register, chat with mock provider, render artifact + versions", async ({
    page,
  }) => {
    // Unique credentials per run so retries / parallel shards don't collide.
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const email = `e2e+${suffix}@example.com`;
    const password = "Sup3rSecret!";

    // ── 1. Sign up (first user → admin + personal workspace) ───────────
    await page.goto("/auth/sign-up");
    await page.locator('input[name="name"]').fill("E2E User");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // Better-Auth issues a session cookie + the client redirects to /chats.
    await page.waitForURL("**/chats", { waitUntil: "load" });

    // ── 2. Register a mock provider config (advisory — the mock bypasses
    // it, but this populates the model picker and exercises the admin
    // route). The session cookie from sign-up is carried by page.request.
    const providerRes = await page.request.post("/api/admin/providers", {
      data: {
        provider: "openai",
        label: "Mock",
        models: ["mock"],
        isDefault: true,
      },
    });
    expect(providerRes.ok(), "admin provider POST should succeed").toBeTruthy();

    // ── 3. Enter draft mode via the sidebar's "New chat" ───────────────
    // In draft mode the URL stays on `/chats` — no server round-trip yet;
    // the chat row is created on the first submit and the URL then swaps
    // to `/chats/{id}` via `router.replace` without remounting.
    await page.getByTestId("new-chat").click();
    await page.waitForURL("**/chats", { waitUntil: "load" });

    // ── 4. Send a message → chat is created, URL swaps, mock streams
    //       two artifact versions.
    const composer = page.getByLabel("Message input");
    await composer.fill("Show me the welcome card");
    await composer.press("Enter");
    await page.waitForURL("**/chats/*", { waitUntil: "load" });

    // Wait for the assistant turn to finish (streaming → ready) and the
    // artifact chip to appear. The mock completes synchronously, but the
    // client + persistence round-trip needs a moment.
    const chip = page.getByTestId("artifact-chip").first();
    await expect(chip).toBeVisible({ timeout: 15_000 });

    // ── 5. Open the artifact panel ─────────────────────────────────────
    await chip.click();
    // Panel header shows the artifact title "Welcome Card".
    await expect(page.getByText("Welcome Card").first()).toBeVisible();

    // ── 6. Versions tab — assert two versions exist ────────────────────
    await page.getByRole("tab", { name: "Versions" }).click();

    const v1 = page.getByTestId("artifact-version-1");
    const v2 = page.getByTestId("artifact-version-2");
    await expect(v1).toBeVisible();
    await expect(v2).toBeVisible();

    // ── 7. Navigate to v1 → Code tab contains v1 content ───────────────
    await v1.click();
    await page.getByRole("tab", { name: "Code" }).click();
    const codePane = page.locator("pre").first();
    await expect(codePane).toContainText("Welcome to StanzaChat", {
      timeout: 10_000,
    });

    // ── 8. Navigate to v2 → Code tab contains v2 content ───────────────
    await page.getByRole("tab", { name: "Versions" }).click();
    await v2.click();
    await page.getByRole("tab", { name: "Code" }).click();
    await expect(codePane).toContainText("revisited", { timeout: 10_000 });

    // ── 9. Preview tab — sandbox round-trip sets data-rendered ─────────
    await page.getByRole("tab", { name: "Preview" }).click();
    const sandbox = page.getByTestId("artifact-sandbox");
    await expect(sandbox).toHaveAttribute("data-rendered", "true", {
      timeout: 10_000,
    });

    // NOTE: iframe -> host `postMessage` targetOrigin cannot be
    // observed by a same-page `window.postMessage` wrapper — the
    // sandbox has an opaque origin and its call goes through the
    // native Window prototype, not the host-page instance property
    // we could patch. Asserting the origin-scoped beacon would
    // require a CDP-level `Runtime.consoleAPICalled` interception
    // or an isolated-world hook. Tracked as a follow-up.
  });
});
