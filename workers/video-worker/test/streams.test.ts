import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

describe("Stream CRUD", () => {
  it("POST /api/streams creates a draft stream", async () => {
    const res = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Stream",
        description: "A test stream",
        scheduledAt: "2026-03-01T10:00:00Z",
        hostUserId: "test-user-1",
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Test Stream");
    expect(body.status).toBe("draft");
    expect(body.slug).toBeTruthy();
    expect(body.agoraChannelName).toBeTruthy();
  });

  it("GET /api/streams lists all streams", async () => {
    const res = await SELF.fetch("http://localhost/api/streams");
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it("POST /api/streams rejects missing required fields", async () => {
    const res = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Missing fields" }),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/streams/:id updates a stream", async () => {
    const createRes = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Original Title",
        scheduledAt: "2026-03-01T10:00:00Z",
        hostUserId: "test-user-1",
      }),
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const patchRes = await SELF.fetch(
      `http://localhost/api/streams/${created.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Title" }),
      }
    );

    expect(patchRes.status).toBe(200);
    const updated = (await patchRes.json()) as Record<string, unknown>;
    expect(updated.title).toBe("Updated Title");
  });

  it("DELETE /api/streams/:id cancels a stream", async () => {
    const createRes = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "To Cancel",
        scheduledAt: "2026-03-01T10:00:00Z",
        hostUserId: "test-user-1",
      }),
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const deleteRes = await SELF.fetch(
      `http://localhost/api/streams/${created.id}`,
      { method: "DELETE" }
    );

    expect(deleteRes.status).toBe(200);
    const deleted = (await deleteRes.json()) as Record<string, unknown>;
    expect(deleted.status).toBe("cancelled");
  });
});

describe("Stream state transitions", () => {
  it("POST /api/streams/:id/publish transitions draft to scheduled", async () => {
    const createRes = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Publish Test",
        scheduledAt: "2026-03-01T10:00:00Z",
        hostUserId: "test-user-1",
      }),
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const publishRes = await SELF.fetch(
      `http://localhost/api/streams/${created.id}/publish`,
      { method: "POST" }
    );

    expect(publishRes.status).toBe(200);
    const published = (await publishRes.json()) as Record<string, unknown>;
    expect(published.status).toBe("scheduled");
  });

  it("rejects invalid state transitions", async () => {
    const createRes = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Invalid Transition",
        scheduledAt: "2026-03-01T10:00:00Z",
        hostUserId: "test-user-1",
      }),
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    // Try to end a draft stream (should fail — not live/paused)
    const endRes = await SELF.fetch(
      `http://localhost/api/streams/${created.id}/end`,
      { method: "POST" }
    );
    expect(endRes.status).toBe(400);
  });
});

describe("Public stream access", () => {
  it("GET /api/streams/by-slug/:slug returns stream without auth", async () => {
    // Create a stream first
    const createRes = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Public Access Test",
        scheduledAt: "2026-03-01T10:00:00Z",
        hostUserId: "test-user-1",
      }),
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const slugRes = await SELF.fetch(
      `http://localhost/api/streams/by-slug/${created.slug}`
    );
    expect(slugRes.status).toBe(200);
    const found = (await slugRes.json()) as Record<string, unknown>;
    expect(found.title).toBe("Public Access Test");
  });

  it("returns 404 for non-existent slug", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/streams/by-slug/nonexistent-slug"
    );
    expect(res.status).toBe(404);
  });
});

describe("Hand raise relay", () => {
  it("POST and GET hand-raises work", async () => {
    const createRes = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hand Raise Test",
        scheduledAt: "2026-03-01T10:00:00Z",
        hostUserId: "test-user-1",
      }),
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    // Raise hand
    const raiseRes = await SELF.fetch(
      `http://localhost/api/streams/${created.id}/hand-raise`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: 12345, name: "Test User" }),
      }
    );
    expect(raiseRes.status).toBe(200);

    // Get hand raises
    const listRes = await SELF.fetch(
      `http://localhost/api/streams/${created.id}/hand-raises`
    );
    expect(listRes.status).toBe(200);
    const raises = (await listRes.json()) as unknown[];
    expect(raises.length).toBe(1);

    // Lower hand
    const lowerRes = await SELF.fetch(
      `http://localhost/api/streams/${created.id}/hand-raise`,
      { method: "DELETE" }
    );
    expect(lowerRes.status).toBe(200);
  });
});
