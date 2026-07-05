import { expect, test } from "@playwright/test";

import { truncateAll } from "./helpers/db";

/**
 * Phase 4 E2E — SPEC §10 done-when:
 *   admin adds a provider (key masked in UI after save),
 *   audit-log row appears in the viewer,
 *   non-admin gets 403 on /api/admin/providers.
 *
 * The suite owns its DB state: `beforeAll` truncates, then the first
 * sign-up is guaranteed admin (SPEC §5.4). Playwright is configured
 * with `workers: 1` so this doesn't race with `workspace.spec.ts`.
 */

const password = "Sup3rSecret!";

test.describe.configure({ mode: "serial" });

test.describe("admin panel", () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const adminEmail = `admin+${suffix}@example.com`;
  const userEmail = `user+${suffix}@example.com`;

  test.beforeAll(async () => {
    await truncateAll();
  });

  test("first sign-up becomes admin and can add a provider", async ({
    page,
  }) => {
    // ── Sign up admin (first user → instance admin) ─────────────────
    await page.goto("/auth/sign-up");
    await page.locator('input[name="name"]').fill("Admin User");
    await page.locator('input[name="email"]').fill(adminEmail);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/chats", { waitUntil: "load" });

    // ── Open admin panel and add a provider via the modal dialog ─────
    await page.goto("/admin/providers");
    // The page header should load in the editorial serif style.
    await expect(
      page.getByRole("heading", { name: "Bring your own model providers" }),
    ).toBeVisible({ timeout: 10_000 });

    // Open the dialog.
    await page.getByTestId("open-add-provider").click();

    // Fill the form inside the modal.
    await page.locator("#label").fill("Playwright Provider");
    await page.locator("#apiKey").fill("sk-secret-1234");
    await page.locator("#enabledModels").fill("mock");
    await page.getByTestId("provider-submit").click();

    // ── Provider appears in the table with a masked key ─────────────
    const row = page.locator('[data-testid^="provider-row-"]').first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    const keyCell = row.locator('[data-testid^="provider-key-"]');
    await expect(keyCell).toHaveText("••••••••");
    // The raw key must never be visible anywhere on the page.
    await expect(page.getByText("sk-secret-1234")).toHaveCount(0);

    // ── Audit log shows the provider.create row ─────────────────────
    await page.goto("/admin/audit");
    const auditRow = page.getByTestId("audit-row-provider.create").first();
    await expect(auditRow).toBeVisible({ timeout: 10_000 });
    await expect(auditRow).toContainText("provider.create");
    await expect(auditRow).toContainText(adminEmail);
  });

  test("non-admin gets 403 on admin API + is bounced from /admin UI", async ({
    browser,
  }) => {
    // ── Sign up second user in an isolated browser context so we don't
    // clobber the admin's session cookie for the previous test. ────
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/auth/sign-up");
    await page.locator('input[name="name"]').fill("Regular User");
    await page.locator('input[name="email"]').fill(userEmail);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/chats", { waitUntil: "load" });

    // ── /admin/* redirects a non-admin back to /chats ───────────────
    await page.goto("/admin/providers");
    await page.waitForURL("**/chats", { waitUntil: "load" });

    // ── /api/admin/providers returns 403 for a non-admin session ────
    const res = await page.request.get("/api/admin/providers");
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("forbidden");

    await context.close();
  });

  test("admin cannot demote or ban themselves (self-lockout guard)", async ({
    page,
  }) => {
    // Sign in as the admin created in the first test.
    await page.goto("/auth/sign-in");
    await page.locator('input[name="email"]').fill(adminEmail);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/chats", { waitUntil: "load" });

    // Resolve the admin's own user id from the users list.
    const usersRes = await page.request.get("/api/admin/users");
    expect(usersRes.ok()).toBeTruthy();
    const { users } = (await usersRes.json()) as {
      users: { id: string; email: string; role: string }[];
    };
    const self = users.find((u) => u.email === adminEmail);
    expect(self, "admin should appear in the users list").toBeTruthy();

    // Self-demote must be refused with 403.
    const demote = await page.request.patch(`/api/admin/users/${self!.id}`, {
      data: { role: "user" },
    });
    expect(demote.status()).toBe(403);

    // Self-ban must be refused with 403.
    const ban = await page.request.patch(`/api/admin/users/${self!.id}`, {
      data: { banned: true },
    });
    expect(ban.status()).toBe(403);

    // The admin is still an admin — the mutation never applied.
    const after = await page.request.get("/api/admin/users");
    const stillAdmin = (
      (await after.json()) as { users: { email: string; role: string }[] }
    ).users.find((u) => u.email === adminEmail);
    expect(stillAdmin?.role).toBe("admin");
  });
});
