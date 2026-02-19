import { test, expect } from "@playwright/test";

// These tests run serially because sign-out invalidates the shared session
test.describe.configure({ mode: "serial" });

test.describe("Dashboard (authenticated)", () => {
  test("shows dashboard heading and session info", async ({ page }) => {
    await page.goto("/dashboard");

    // Wait for session to load (loading state resolves)
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Session Info")).toBeVisible();
    await expect(page.getByText("e2e-test@example.com")).toBeVisible();
  });

  test("sign out button works and redirects to home", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL("/");
  });
});
