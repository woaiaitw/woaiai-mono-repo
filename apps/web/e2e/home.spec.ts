import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("renders heading and description", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Web Template" })).toBeVisible();
    await expect(page.getByText("TanStack Start + Cloudflare Workers + Better Auth")).toBeVisible();
  });

  test("has Sign In link that navigates to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/login");
  });

  test("has Dashboard link that navigates to /dashboard", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL("/dashboard");
  });
});
