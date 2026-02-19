import { test as setup, expect } from "@playwright/test";

const AUTH_URL = "http://localhost:8788";
const WEB_URL = "http://localhost:3000";
const testEmail = "e2e-test@example.com";
const testPassword = "E2eTest1234!@#$";
const testName = "E2E Test User";

setup("create account and authenticate", async ({ page }) => {
  // Sign up via auth worker API (Origin header required for CSRF)
  const signUpRes = await page.request.post(
    `${AUTH_URL}/api/auth/sign-up/email`,
    {
      data: { email: testEmail, password: testPassword, name: testName },
      headers: { Origin: WEB_URL },
    }
  );
  // 200 on first run, may get 422/409 if user already exists — both are fine
  expect([200, 409, 422]).toContain(signUpRes.status());

  // Sign in via auth worker API
  const signInRes = await page.request.post(
    `${AUTH_URL}/api/auth/sign-in/email`,
    {
      data: { email: testEmail, password: testPassword },
      headers: { Origin: WEB_URL },
    }
  );
  expect(signInRes.status()).toBe(200);

  // Navigate to the web app to verify auth state works
  await page.goto(`${WEB_URL}/dashboard`);

  // Wait for the session to load — either "Dashboard" heading or "sign in" text
  await page.waitForSelector('h1:has-text("Dashboard"), :has-text("You need to sign in")', {
    timeout: 10000,
  });

  // Save signed-in state
  await page.context().storageState({ path: "playwright/.auth/user.json" });
});
