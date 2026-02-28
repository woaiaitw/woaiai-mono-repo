import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { SELF } from "cloudflare:test";

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

/** Set a user's role directly in D1 */
async function setRole(userId: string, role: string) {
  const db = env.AUTH_DB;
  await db
    .prepare("UPDATE user SET role = ? WHERE id = ?")
    .bind(role, userId)
    .run();
}

describe("User roles", () => {
  let regularUserId: string;
  let adminUserId: string;
  let ownerUserId: string;
  let speakerUserId: string;

  beforeAll(async () => {
    regularUserId = await signUp("role-regular@test.com", "Regular");
    adminUserId = await signUp("role-admin@test.com", "Admin");
    ownerUserId = await signUp("role-owner@test.com", "Owner");
    speakerUserId = await signUp("role-speaker@test.com", "Speaker");

    await setRole(adminUserId, "admin");
    await setRole(ownerUserId, "owner");
    await setRole(speakerUserId, "speaker");
  });

  it("new users get the default 'user' role", async () => {
    const cookies = await signIn("role-regular@test.com");
    const sessionRes = await SELF.fetch(
      "http://localhost/api/auth/get-session",
      { headers: { cookie: cookies } }
    );
    const session = (await sessionRes.json()) as any;
    expect(session.user.role).toBe("user");
  });

  it("session includes the role field for admin users", async () => {
    const cookies = await signIn("role-admin@test.com");
    const sessionRes = await SELF.fetch(
      "http://localhost/api/auth/get-session",
      { headers: { cookie: cookies } }
    );
    const session = (await sessionRes.json()) as any;
    expect(session.user.role).toBe("admin");
  });

  it("session includes the role field for owner users", async () => {
    const cookies = await signIn("role-owner@test.com");
    const sessionRes = await SELF.fetch(
      "http://localhost/api/auth/get-session",
      { headers: { cookie: cookies } }
    );
    const session = (await sessionRes.json()) as any;
    expect(session.user.role).toBe("owner");
  });
});

describe("Admin API authorization", () => {
  let regularUserId: string;
  let adminUserId: string;
  let ownerUserId: string;
  let speakerUserId: string;

  beforeAll(async () => {
    regularUserId = await signUp("admin-api-regular@test.com", "Regular");
    adminUserId = await signUp("admin-api-admin@test.com", "Admin");
    ownerUserId = await signUp("admin-api-owner@test.com", "Owner");
    speakerUserId = await signUp("admin-api-speaker@test.com", "Speaker");

    await setRole(adminUserId, "admin");
    await setRole(ownerUserId, "owner");
    await setRole(speakerUserId, "speaker");
  });

  it("unauthenticated requests are rejected", async () => {
    const res = await SELF.fetch("http://localhost/api/admin/users");
    expect(res.status).toBe(401);
  });

  it("regular users cannot list users", async () => {
    const cookies = await signIn("admin-api-regular@test.com");
    const res = await SELF.fetch("http://localhost/api/admin/users", {
      headers: { cookie: cookies },
    });
    expect(res.status).toBe(403);
  });

  it("admin users can list users", async () => {
    const cookies = await signIn("admin-api-admin@test.com");
    const res = await SELF.fetch("http://localhost/api/admin/users", {
      headers: { cookie: cookies },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.users).toBeDefined();
    expect(Array.isArray(body.users)).toBe(true);
  });

  it("owner users can list users", async () => {
    const cookies = await signIn("admin-api-owner@test.com");
    const res = await SELF.fetch("http://localhost/api/admin/users", {
      headers: { cookie: cookies },
    });
    expect(res.status).toBe(200);
  });

  it("admin can change a regular user's role", async () => {
    const cookies = await signIn("admin-api-admin@test.com");
    const res = await SELF.fetch(
      `http://localhost/api/admin/users/${speakerUserId}/role`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ role: "user" }),
      }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user.role).toBe("user");
  });

  it("admin cannot assign owner role", async () => {
    const cookies = await signIn("admin-api-admin@test.com");
    const res = await SELF.fetch(
      `http://localhost/api/admin/users/${regularUserId}/role`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ role: "owner" }),
      }
    );
    expect(res.status).toBe(403);
  });

  it("admin cannot modify an owner's role", async () => {
    const cookies = await signIn("admin-api-admin@test.com");
    const res = await SELF.fetch(
      `http://localhost/api/admin/users/${ownerUserId}/role`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ role: "admin" }),
      }
    );
    expect(res.status).toBe(403);
  });

  it("cannot change your own role", async () => {
    const cookies = await signIn("admin-api-admin@test.com");
    const res = await SELF.fetch(
      `http://localhost/api/admin/users/${adminUserId}/role`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ role: "user" }),
      }
    );
    expect(res.status).toBe(400);
  });

  it("regular users cannot change roles", async () => {
    const cookies = await signIn("admin-api-regular@test.com");
    const res = await SELF.fetch(
      `http://localhost/api/admin/users/${speakerUserId}/role`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ role: "admin" }),
      }
    );
    expect(res.status).toBe(403);
  });

  it("rejects invalid role values", async () => {
    const cookies = await signIn("admin-api-owner@test.com");
    const res = await SELF.fetch(
      `http://localhost/api/admin/users/${regularUserId}/role`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ role: "superadmin" }),
      }
    );
    expect(res.status).toBe(400);
  });

  it("owner can assign the owner role", async () => {
    const cookies = await signIn("admin-api-owner@test.com");
    const res = await SELF.fetch(
      `http://localhost/api/admin/users/${regularUserId}/role`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ role: "owner" }),
      }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user.role).toBe("owner");
  });
});
