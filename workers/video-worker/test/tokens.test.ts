import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

describe("Token endpoints", () => {
  it("GET /api/tokens/viewer returns token for a channel", async () => {
    // First create a stream to have a valid channel
    const createRes = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Token Test Stream",
        scheduledAt: "2026-03-01T10:00:00Z",
        hostUserId: "test-user-1",
      }),
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const res = await SELF.fetch(
      `http://localhost/api/tokens/viewer?channel=${created.agoraChannelName}`
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.token).toBeTruthy();
    expect(body.uid).toBeTruthy();
    expect(body.appId).toBe("970ca35de60c44645bbae8a215061b33");
    expect(body.channel).toBe(created.agoraChannelName);
  });

  it("GET /api/tokens/viewer rejects missing channel param", async () => {
    const res = await SELF.fetch("http://localhost/api/tokens/viewer");
    expect(res.status).toBe(400);
  });

  it("GET /api/tokens/host returns publisher token for assigned host", async () => {
    const createRes = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Host Token Test",
        scheduledAt: "2026-03-01T10:00:00Z",
        hostUserId: "test-user-1",
      }),
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const res = await SELF.fetch(
      `http://localhost/api/tokens/host?stream=${created.id}`
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.token).toBeTruthy();
    expect(body.uid).toBeTruthy();
  });

  it("GET /api/tokens/host rejects non-host user", async () => {
    const createRes = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Non-Host Token Test",
        scheduledAt: "2026-03-01T10:00:00Z",
        hostUserId: "different-user",
      }),
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const res = await SELF.fetch(
      `http://localhost/api/tokens/host?stream=${created.id}`
    );

    expect(res.status).toBe(403);
  });

  it("GET /api/tokens/screen returns token with UID offset", async () => {
    const createRes = await SELF.fetch("http://localhost/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Screen Share Token Test",
        scheduledAt: "2026-03-01T10:00:00Z",
        hostUserId: "test-user-1",
      }),
    });
    const created = (await createRes.json()) as Record<string, unknown>;

    const res = await SELF.fetch(
      `http://localhost/api/tokens/screen?stream=${created.id}&cameraUid=12345`
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.uid).toBe(112345);
  });
});
