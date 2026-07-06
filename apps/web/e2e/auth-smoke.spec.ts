import { expect, test } from "@playwright/test";

/**
 * Phase 1 E2E smoke test: auth pages render and accept input.
 *
 * This is a lightweight smoke test, not a full signup round-trip
 * (that requires a live Postgres + Better-Auth server, which the
 * CI E2E job provides via compose). Here we verify the pages load
 * and the forms are interactive.
 */

test.describe("auth pages smoke", () => {
  test("sign-up page renders form", async ({ page }) => {
    await page.goto("/auth/sign-up");

    await expect(page).toHaveTitle(/Sign up/);
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("sign-in page renders form", async ({ page }) => {
    await page.goto("/auth/sign-in");

    await expect(page).toHaveTitle(/Sign in/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("home redirects anonymous visitor to sign-in", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=(?:%2F|\/)chats$/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test("sign-up form accepts input", async ({ page }) => {
    await page.goto("/auth/sign-up");

    await page.locator('input[name="name"]').fill("Test User");
    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="password"]').fill("password123");

    await expect(page.locator('input[name="name"]')).toHaveValue("Test User");
    await expect(page.locator('input[name="email"]')).toHaveValue(
      "test@example.com",
    );
  });
});
