import { test, expect } from "@playwright/test";

test.describe("Dashboard (unauthenticated)", () => {
  test("shows sign-in message", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("You need to sign in")).toBeVisible();
  });

  test("has Sign In link that navigates to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/login");
  });
});
