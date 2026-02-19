import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";

describe("Email/password auth flow", () => {
  const testEmail = "test@example.com";
  const testPassword = "Test1234!@#$";
  const testName = "Test User";
  const origin = "http://localhost:3000";

  // Sign up a user once before all tests in this suite.
  // With isolatedStorage, beforeAll seeds data that all tests can read.
  beforeAll(async () => {
    const res = await SELF.fetch("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });
    expect(res.status).toBe(200);
  });

  it("signs up a new user with correct data", async () => {
    const uniqueEmail = "signup-test@example.com";
    const res = await SELF.fetch("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        email: uniqueEmail,
        password: testPassword,
        name: "Signup Test",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(uniqueEmail);
    expect(body.user.name).toBe("Signup Test");
  });

  it("signs in and returns a session cookie", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("better-auth.session_token");
  });

  it("gets session with valid cookie", async () => {
    // Sign in to get a cookie
    const signInRes = await SELF.fetch(
      "http://localhost/api/auth/sign-in/email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      }
    );
    expect(signInRes.status).toBe(200);

    const setCookieHeader = signInRes.headers.get("set-cookie") ?? "";
    const cookies = setCookieHeader
      .split(/,(?=\s*\w+=)/)
      .map((c: string) => c.trim().split(";")[0])
      .join("; ");

    const sessionRes = await SELF.fetch(
      "http://localhost/api/auth/get-session",
      {
        headers: { cookie: cookies },
      }
    );

    expect(sessionRes.status).toBe(200);
    const session = (await sessionRes.json()) as any;
    expect(session.user).toBeDefined();
    expect(session.user.email).toBe(testEmail);
    expect(session.user.name).toBe(testName);
  });

  it("sign out invalidates the session", async () => {
    // Sign in
    const signInRes = await SELF.fetch(
      "http://localhost/api/auth/sign-in/email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      }
    );
    expect(signInRes.status).toBe(200);

    const setCookieHeader = signInRes.headers.get("set-cookie") ?? "";
    const cookies = setCookieHeader
      .split(/,(?=\s*\w+=)/)
      .map((c: string) => c.trim().split(";")[0])
      .join("; ");

    // Sign out — must include Origin header for CSRF validation
    const signOutRes = await SELF.fetch(
      "http://localhost/api/auth/sign-out",
      {
        method: "POST",
        headers: { cookie: cookies, Origin: origin },
      }
    );
    expect(signOutRes.status).toBe(200);

    // Verify session is gone
    const sessionRes = await SELF.fetch(
      "http://localhost/api/auth/get-session",
      {
        headers: { cookie: cookies },
      }
    );
    const session = (await sessionRes.json()) as any;
    // After sign-out, better-auth returns null or { session: null }
    expect(session?.session ?? null).toBeNull();
  });
});
