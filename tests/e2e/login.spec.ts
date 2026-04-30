import { expect, test } from "@playwright/test";

test.describe("Login page", () => {
  test("renders providers and toggles magic-link button on email", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: /Covoiturage ICC Metz/i }).first(),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Continuer avec Google/i }),
    ).toBeVisible();

    const emailInput = page
      .getByRole("textbox", { name: /e-?mail|exemple/i })
      .first();
    await expect(emailInput).toBeVisible();

    const magicLinkButton = page
      .getByRole("button", { name: /lien magique|magic link|recevoir/i })
      .first();
    await expect(magicLinkButton).toBeVisible();
  });
});
