import { expect, test } from "@playwright/test";

test.describe("Protected route: /admin", () => {
  test("redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login(\?|$|\/)/, { timeout: 15_000 });
  });
});
