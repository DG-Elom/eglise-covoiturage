import { expect, test } from "@playwright/test";

test.describe("Protected route: /dashboard", () => {
  test("redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login(\?|$|\/)/, { timeout: 15_000 });
  });
});
