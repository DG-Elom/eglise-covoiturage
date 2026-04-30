import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("displays ICC Metz branding", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Covoiturage ICC Metz/i);

    const logo = page.getByAltText(/ICC Metz/i);
    await expect(logo.first()).toBeVisible();
  });
});
