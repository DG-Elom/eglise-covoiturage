import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("displays branding and a working login link", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Covoiturage Église/i);

    const logo = page.getByAltText("Allez à l'église");
    await expect(logo.first()).toBeVisible();

    const loginLink = page.getByRole("link", { name: /Se connecter/i }).first();
    await expect(loginLink).toBeVisible();

    await loginLink.click();
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
