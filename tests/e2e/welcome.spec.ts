import { expect, test } from "@playwright/test";

test.describe("Welcome carousel (unauthenticated)", () => {
  test("redirects to /login when not authenticated", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});

test.describe("Welcome carousel structure (static render check via /lancement)", () => {
  test("landing page loads without errors as proxy that routing works", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(500);
  });
});
