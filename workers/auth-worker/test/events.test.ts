import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { SELF } from "cloudflare:test";

const origin = "http://localhost:3000";
const password = "Test1234!@#$";

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

async function setRole(userId: string, role: string) {
  const db = env.AUTH_DB;
  await db
    .prepare("UPDATE user SET role = ? WHERE id = ?")
    .bind(role, userId)
    .run();
}

describe("Events API - authorization", () => {
  let adminUserId: string;

  beforeAll(async () => {
    await signUp("events-auth-regular@test.com", "Regular");
    adminUserId = await signUp("events-auth-admin@test.com", "Admin");

    await setRole(adminUserId, "admin");
  });

  it("unauthenticated users cannot create events", async () => {
    const res = await SELF.fetch("http://localhost/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        title: "Test Event",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    expect(res.status).toBe(401);
  });

  it("regular users cannot create events", async () => {
    const cookies = await signIn("events-auth-regular@test.com");
    const res = await SELF.fetch("http://localhost/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
        Origin: origin,
      },
      body: JSON.stringify({
        title: "Test Event",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects event creation with missing title", async () => {
    const cookies = await signIn("events-auth-admin@test.com");
    const res = await SELF.fetch("http://localhost/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
        Origin: origin,
      },
      body: JSON.stringify({
        title: "",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects event creation with missing scheduledAt", async () => {
    const cookies = await signIn("events-auth-admin@test.com");
    const res = await SELF.fetch("http://localhost/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
        Origin: origin,
      },
      body: JSON.stringify({
        title: "No Date Event",
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("Events API - create and list", () => {
  let adminUserId: string;
  let ownerUserId: string;
  let adminEventId: string;
  let ownerEventId: string;

  beforeAll(async () => {
    adminUserId = await signUp("events-crud-admin@test.com", "Admin");
    ownerUserId = await signUp("events-crud-owner@test.com", "Owner");

    await setRole(adminUserId, "admin");
    await setRole(ownerUserId, "owner");

    // Create events in beforeAll so they persist across tests
    const adminCookies = await signIn("events-crud-admin@test.com");
    const adminRes = await SELF.fetch("http://localhost/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookies,
        Origin: origin,
      },
      body: JSON.stringify({
        title: "Admin Event",
        description: "Created by admin",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    const adminBody = (await adminRes.json()) as any;
    adminEventId = adminBody.event.id;

    const ownerCookies = await signIn("events-crud-owner@test.com");
    const ownerRes = await SELF.fetch("http://localhost/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: ownerCookies,
        Origin: origin,
      },
      body: JSON.stringify({
        title: "Owner Event",
        scheduledAt: new Date(Date.now() + 172800000).toISOString(),
      }),
    });
    const ownerBody = (await ownerRes.json()) as any;
    ownerEventId = ownerBody.event.id;
  });

  it("admin event was created with correct data", () => {
    expect(adminEventId).toBeDefined();
    expect(typeof adminEventId).toBe("string");
  });

  it("owner event was created with correct data", () => {
    expect(ownerEventId).toBeDefined();
    expect(typeof ownerEventId).toBe("string");
  });

  it("GET /api/events returns created events", async () => {
    const res = await SELF.fetch("http://localhost/api/events");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.events.length).toBeGreaterThanOrEqual(2);
    const titles = body.events.map((e: any) => e.title);
    expect(titles).toContain("Admin Event");
    expect(titles).toContain("Owner Event");
  });

  it("events include expected fields", async () => {
    const res = await SELF.fetch("http://localhost/api/events");
    const body = (await res.json()) as any;
    const event = body.events.find((e: any) => e.id === adminEventId);
    expect(event).toBeDefined();
    expect(event.title).toBe("Admin Event");
    expect(event.description).toBe("Created by admin");
    expect(event.status).toBe("upcoming");
    expect(event.createdBy).toBe(adminUserId);
  });
});

describe("Events API - status updates", () => {
  let createdEventId: string;

  beforeAll(async () => {
    const adminUserId = await signUp(
      "events-status-admin@test.com",
      "Admin"
    );
    await signUp("events-status-regular@test.com", "Regular");

    await setRole(adminUserId, "admin");

    const cookies = await signIn("events-status-admin@test.com");
    const res = await SELF.fetch("http://localhost/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
        Origin: origin,
      },
      body: JSON.stringify({
        title: "Status Test Event",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    createdEventId = body.event.id;
  });

  it("admin can update event status", async () => {
    const cookies = await signIn("events-status-admin@test.com");
    const res = await SELF.fetch(
      `http://localhost/api/events/${createdEventId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ status: "live" }),
      }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.event.status).toBe("live");
  });

  it("regular users cannot update event status", async () => {
    const cookies = await signIn("events-status-regular@test.com");
    const res = await SELF.fetch(
      `http://localhost/api/events/${createdEventId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ status: "ended" }),
      }
    );
    expect(res.status).toBe(403);
  });

  it("rejects invalid event status", async () => {
    const cookies = await signIn("events-status-admin@test.com");
    const res = await SELF.fetch(
      `http://localhost/api/events/${createdEventId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ status: "invalid" }),
      }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent event", async () => {
    const cookies = await signIn("events-status-admin@test.com");
    const res = await SELF.fetch(
      "http://localhost/api/events/non-existent-id/status",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
          Origin: origin,
        },
        body: JSON.stringify({ status: "live" }),
      }
    );
    expect(res.status).toBe(404);
  });
});
