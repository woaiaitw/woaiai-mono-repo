import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";

const origin = "http://localhost:3000";
const password = "Test1234!@#$";

/** Sign up a user and return their id */
async function signUp(email: string, name: string) {
  const res = await SELF.fetch("http://localhost/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password, name }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  return body.user.id as string;
}

/** Sign in and return cookie string */
async function signIn(email: string) {
  const res = await SELF.fetch("http://localhost/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  const setCookieHeader = res.headers.get("set-cookie") ?? "";
  return setCookieHeader
    .split(/,(?=\s*\w+=)/)
    .map((c: string) => c.trim().split(";")[0])
    .join("; ");
}

/** Parse cookies from set-cookie header */
function parseCookies(setCookieHeader: string) {
  return setCookieHeader
    .split(/,(?=\s*\w+=)/)
    .map((c: string) => c.trim().split(";")[0])
    .join("; ");
}

/** Set a user's role directly in D1 */
async function setRole(userId: string, role: string) {
  const db = env.AUTH_DB;
  await db
    .prepare("UPDATE user SET role = ? WHERE id = ?")
    .bind(role, userId)
    .run();
}

describe("Speaker invite magic link", () => {
  let adminUserId: string;

  beforeAll(async () => {
    adminUserId = await signUp("ml-admin@test.com", "Admin");
    await setRole(adminUserId, "admin");
  });

  it("non-admin users cannot generate speaker invites", async () => {
    const userId = await signUp("ml-regular@test.com", "Regular");
    const cookies = await signIn("ml-regular@test.com");

    const res = await SELF.fetch("http://localhost/api/speaker-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
        Origin: origin,
      },
      body: JSON.stringify({ email: "invited@test.com" }),
    });
    expect(res.status).toBe(403);
  });

  it("unauthenticated users cannot generate speaker invites", async () => {
    const res = await SELF.fetch("http://localhost/api/speaker-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ email: "invited@test.com" }),
    });
    expect(res.status).toBe(401);
  });

  it("admin can generate a speaker invite link", async () => {
    const cookies = await signIn("ml-admin@test.com");

    const res = await SELF.fetch("http://localhost/api/speaker-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
        Origin: origin,
      },
      body: JSON.stringify({ email: "speaker-invitee@test.com" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.url).toBeDefined();
    expect(body.url).toContain("/api/auth/magic-link/verify");
    expect(body.url).toContain("token=");
    expect(body.url).toContain("callbackURL=");
  });

  it("magic link creates session and activate sets speaker role", async () => {
    const adminCookies = await signIn("ml-admin@test.com");
    const inviteeEmail = "speaker-flow@test.com";

    // Step 1: Admin generates the speaker invite
    const inviteRes = await SELF.fetch("http://localhost/api/speaker-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookies,
        Origin: origin,
      },
      body: JSON.stringify({ email: inviteeEmail }),
    });
    expect(inviteRes.status).toBe(200);
    const { url } = (await inviteRes.json()) as any;

    // Step 2: Extract the magic link path (rewrite base to localhost for test)
    const magicUrl = new URL(url);
    const testUrl = `http://localhost${magicUrl.pathname}${magicUrl.search}`;

    // Step 3: User clicks the magic link — follow verification
    const verifyRes = await SELF.fetch(testUrl, {
      redirect: "manual",
      headers: { Origin: origin },
    });

    // Magic link verify should redirect (302) or return 200
    // Extract session cookie from the response
    const setCookieHeader = verifyRes.headers.get("set-cookie") ?? "";
    const inviteeCookies = parseCookies(setCookieHeader);
    expect(inviteeCookies).toContain("better-auth.session_token");

    // Step 4: Extract invite_token from the redirect callbackURL
    const callbackURL = magicUrl.searchParams.get("callbackURL") ?? "";
    const callbackParsed = new URL(callbackURL);
    const inviteToken = callbackParsed.searchParams.get("invite_token");
    expect(inviteToken).toBeTruthy();

    // Step 5: Verify session exists and user has default role before activation
    const sessionBefore = await SELF.fetch(
      "http://localhost/api/auth/get-session",
      { headers: { cookie: inviteeCookies } }
    );
    expect(sessionBefore.status).toBe(200);
    const beforeData = (await sessionBefore.json()) as any;
    expect(beforeData.user).toBeDefined();
    expect(beforeData.user.email).toBe(inviteeEmail);
    expect(beforeData.user.role).toBe("user"); // not yet speaker

    // Step 6: Activate the speaker role
    const activateRes = await SELF.fetch(
      "http://localhost/api/speaker-invite/activate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: inviteeCookies,
          Origin: origin,
        },
        body: JSON.stringify({ invite_token: inviteToken }),
      }
    );
    expect(activateRes.status).toBe(200);
    const activateBody = (await activateRes.json()) as any;
    expect(activateBody.success).toBe(true);
    expect(activateBody.role).toBe("speaker");

    // Step 7: Verify the user now has the speaker role
    const sessionAfter = await SELF.fetch(
      "http://localhost/api/auth/get-session",
      { headers: { cookie: inviteeCookies } }
    );
    expect(sessionAfter.status).toBe(200);
    const afterData = (await sessionAfter.json()) as any;
    expect(afterData.user.role).toBe("speaker");
  });

  it("invite token cannot be reused", async () => {
    const adminCookies = await signIn("ml-admin@test.com");
    const inviteeEmail = "speaker-reuse@test.com";

    // Generate invite
    const inviteRes = await SELF.fetch("http://localhost/api/speaker-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookies,
        Origin: origin,
      },
      body: JSON.stringify({ email: inviteeEmail }),
    });
    const { url } = (await inviteRes.json()) as any;

    // Click magic link
    const magicUrl = new URL(url);
    const testUrl = `http://localhost${magicUrl.pathname}${magicUrl.search}`;
    const verifyRes = await SELF.fetch(testUrl, {
      redirect: "manual",
      headers: { Origin: origin },
    });
    const inviteeCookies = parseCookies(
      verifyRes.headers.get("set-cookie") ?? ""
    );

    const callbackURL = magicUrl.searchParams.get("callbackURL") ?? "";
    const inviteToken = new URL(callbackURL).searchParams.get("invite_token");

    // Activate once — should succeed
    const firstActivate = await SELF.fetch(
      "http://localhost/api/speaker-invite/activate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: inviteeCookies,
          Origin: origin,
        },
        body: JSON.stringify({ invite_token: inviteToken }),
      }
    );
    expect(firstActivate.status).toBe(200);

    // Try to activate again — should fail
    const secondActivate = await SELF.fetch(
      "http://localhost/api/speaker-invite/activate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: inviteeCookies,
          Origin: origin,
        },
        body: JSON.stringify({ invite_token: inviteToken }),
      }
    );
    expect(secondActivate.status).toBe(400);
  });

  it("activate rejects invalid invite token", async () => {
    // Sign up a user and sign in
    await signUp("ml-invalid-token@test.com", "Invalid Token User");
    const cookies = await signIn("ml-invalid-token@test.com");

    const res = await SELF.fetch(
      "http://localhost/api/speaker-invite/activate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ invite_token: "nonexistent-token" }),
      }
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("Invalid invite token");
  });

  it("activate rejects when email does not match", async () => {
    const adminCookies = await signIn("ml-admin@test.com");

    // Generate invite for one email
    const inviteRes = await SELF.fetch("http://localhost/api/speaker-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookies,
        Origin: origin,
      },
      body: JSON.stringify({ email: "intended-speaker@test.com" }),
    });
    const { url } = (await inviteRes.json()) as any;
    const callbackURL =
      new URL(url).searchParams.get("callbackURL") ?? "";
    const inviteToken = new URL(callbackURL).searchParams.get("invite_token");

    // Sign in as a different user and try to activate
    await signUp("wrong-user@test.com", "Wrong User");
    const wrongCookies = await signIn("wrong-user@test.com");

    const activateRes = await SELF.fetch(
      "http://localhost/api/speaker-invite/activate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: wrongCookies,
          Origin: origin,
        },
        body: JSON.stringify({ invite_token: inviteToken }),
      }
    );
    expect(activateRes.status).toBe(403);
    const body = (await activateRes.json()) as any;
    expect(body.error).toBe("Invite does not match your email");
  });

  it("unauthenticated user cannot activate invite", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/speaker-invite/activate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
        },
        body: JSON.stringify({ invite_token: "some-token" }),
      }
    );
    expect(res.status).toBe(401);
  });
});
