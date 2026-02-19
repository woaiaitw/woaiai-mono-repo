import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

describe("Health endpoint", () => {
  it("GET /health returns ok", async () => {
    const res = await SELF.fetch("http://localhost/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});
