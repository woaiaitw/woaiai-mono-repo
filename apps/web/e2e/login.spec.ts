import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders heading and Google button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
  });

  test("has back link that returns to home", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL("/");
  });
});
