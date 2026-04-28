import { expect, test } from "@playwright/test";

test.describe("i18n and theme", () => {
  test("html lang is fr and homepage contains French copy", async ({
    page,
  }) => {
    await page.goto("/");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "fr");

    await expect(page.getByText("Allez à l'église").first()).toBeVisible();
  });

  test("dark theme persists from localStorage on reload", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.setItem("theme", "dark");
    });

    await page.reload();

    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/, { timeout: 5_000 });
  });
});
