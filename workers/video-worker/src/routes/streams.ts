import { Hono } from "hono";
import { eq, inArray, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Env } from "../env.d.ts";
import { getDb } from "../lib/db";
import { stream } from "../db/schema";
import { requireAuth } from "../lib/auth";
import { generateSlug } from "../lib/slug";

export const streamRoutes = new Hono<{ Bindings: Env }>();

// In-memory hand-raise store (per-isolate, cleared on restart — acceptable for MVP)
const handRaises = new Map<string, { uid: number; name: string; userId: string; raisedAt: number }[]>();

// ─── Stream CRUD (Admin, authenticated) ──────────────────────────

streamRoutes.post("/", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const role = auth.user.role ?? "viewer";
  if (role !== "host" && role !== "admin") {
    return c.json({ error: "Only hosts and admins can create streams" }, 403);
  }

  const body = await c.req.json<{
    title: string;
    description?: string;
    scheduledAt: string;
    hostUserId: string;
    hostName?: string;
  }>();

  if (!body.title || !body.scheduledAt || !body.hostUserId) {
    return c.json({ error: "title, scheduledAt, and hostUserId are required" }, 400);
  }

  const db = getDb(c.env.VIDEO_DB);
  const id = nanoid();
  const slug = generateSlug(body.title);
  const channelName = `stream-${id}`;

  const [created] = await db
    .insert(stream)
    .values({
      id,
      slug,
      title: body.title,
      description: body.description ?? null,
      status: "draft",
      scheduledAt: new Date(body.scheduledAt),
      hostUserId: body.hostUserId,
      hostName: body.hostName ?? null,
      agoraChannelName: channelName,
      createdBy: auth.user.id,
    })
    .returning();

  return c.json(created, 201);
});

streamRoutes.get("/", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb(c.env.VIDEO_DB);
  const role = auth.user.role ?? "viewer";

  if (role === "admin") {
    const streams = await db.select().from(stream).orderBy(stream.scheduledAt);
    return c.json(streams);
  }

  // Hosts see only their own streams
  const streams = await db
    .select()
    .from(stream)
    .where(eq(stream.hostUserId, auth.user.id))
    .orderBy(stream.scheduledAt);
  return c.json(streams);
});

streamRoutes.get("/:id", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb(c.env.VIDEO_DB);
  const [found] = await db.select().from(stream).where(eq(stream.id, c.req.param("id")));
  if (!found) return c.json({ error: "Stream not found" }, 404);
  return c.json(found);
});

streamRoutes.patch("/:id", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const body = await c.req.json<{
    title?: string;
    description?: string;
    scheduledAt?: string;
    hostUserId?: string;
    hostName?: string;
  }>();

  const db = getDb(c.env.VIDEO_DB);
  const [existing] = await db.select().from(stream).where(eq(stream.id, c.req.param("id")));
  if (!existing) return c.json({ error: "Stream not found" }, 404);

  const role = auth.user.role ?? "viewer";
  if (role !== "admin" && existing.hostUserId !== auth.user.id) {
    return c.json({ error: "You can only edit your own streams" }, 403);
  }

  if (existing.status !== "draft" && existing.status !== "scheduled") {
    return c.json({ error: "Can only edit draft or scheduled streams" }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.scheduledAt !== undefined) updates.scheduledAt = new Date(body.scheduledAt);
  if (body.hostUserId !== undefined) updates.hostUserId = body.hostUserId;
  if (body.hostName !== undefined) updates.hostName = body.hostName;

  const [updated] = await db
    .update(stream)
    .set(updates)
    .where(eq(stream.id, c.req.param("id")))
    .returning();

  return c.json(updated);
});

streamRoutes.delete("/:id", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb(c.env.VIDEO_DB);
  const [existing] = await db.select().from(stream).where(eq(stream.id, c.req.param("id")));
  if (!existing) return c.json({ error: "Stream not found" }, 404);

  const role = auth.user.role ?? "viewer";
  if (role !== "admin" && existing.hostUserId !== auth.user.id) {
    return c.json({ error: "You can only cancel your own streams" }, 403);
  }

  if (existing.status === "live" || existing.status === "paused") {
    return c.json({ error: "Cannot delete a live or paused stream" }, 400);
  }

  const [updated] = await db
    .update(stream)
    .set({ status: "cancelled" as const })
    .where(eq(stream.id, c.req.param("id")))
    .returning();

  return c.json(updated);
});

// ─── State Transitions ──────────────────────────────────────────

streamRoutes.post("/:id/publish", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb(c.env.VIDEO_DB);
  const [existing] = await db.select().from(stream).where(eq(stream.id, c.req.param("id")));
  if (!existing) return c.json({ error: "Stream not found" }, 404);

  if (existing.status !== "draft") {
    return c.json({ error: "Can only publish draft streams" }, 400);
  }

  const [updated] = await db
    .update(stream)
    .set({ status: "scheduled" as const })
    .where(eq(stream.id, c.req.param("id")))
    .returning();

  return c.json(updated);
});

streamRoutes.post("/:id/go-live", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb(c.env.VIDEO_DB);
  const [existing] = await db.select().from(stream).where(eq(stream.id, c.req.param("id")));
  if (!existing) return c.json({ error: "Stream not found" }, 404);

  if (existing.status !== "pre_stream" && existing.status !== "scheduled") {
    return c.json({ error: "Can only go live from pre_stream or scheduled state" }, 400);
  }

  if (existing.hostUserId !== auth.user.id) {
    return c.json({ error: "Only the assigned host can go live" }, 403);
  }

  const [updated] = await db
    .update(stream)
    .set({ status: "live" as const, startedAt: new Date() })
    .where(eq(stream.id, c.req.param("id")))
    .returning();

  // Recording and STT are started by the caller (frontend triggers these separately)
  return c.json(updated);
});

streamRoutes.post("/:id/end", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb(c.env.VIDEO_DB);
  const [existing] = await db.select().from(stream).where(eq(stream.id, c.req.param("id")));
  if (!existing) return c.json({ error: "Stream not found" }, 404);

  if (existing.status !== "live" && existing.status !== "paused") {
    return c.json({ error: "Can only end a live or paused stream" }, 400);
  }

  const [updated] = await db
    .update(stream)
    .set({ status: "ending" as const, endedAt: new Date() })
    .where(eq(stream.id, c.req.param("id")))
    .returning();

  return c.json(updated);
});

streamRoutes.post("/:id/pause", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb(c.env.VIDEO_DB);
  const [existing] = await db.select().from(stream).where(eq(stream.id, c.req.param("id")));
  if (!existing) return c.json({ error: "Stream not found" }, 404);

  if (existing.status !== "live") {
    return c.json({ error: "Can only pause a live stream" }, 400);
  }

  const [updated] = await db
    .update(stream)
    .set({ status: "paused" as const })
    .where(eq(stream.id, c.req.param("id")))
    .returning();

  return c.json(updated);
});

streamRoutes.post("/:id/resume", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb(c.env.VIDEO_DB);
  const [existing] = await db.select().from(stream).where(eq(stream.id, c.req.param("id")));
  if (!existing) return c.json({ error: "Stream not found" }, 404);

  if (existing.status !== "paused") {
    return c.json({ error: "Can only resume a paused stream" }, 400);
  }

  const [updated] = await db
    .update(stream)
    .set({ status: "live" as const })
    .where(eq(stream.id, c.req.param("id")))
    .returning();

  return c.json(updated);
});

// ─── Public Access (no auth) ────────────────────────────────────

streamRoutes.get("/public", async (c) => {
  const db = getDb(c.env.VIDEO_DB);

  const publicStatuses = ["live", "paused", "scheduled", "pre_stream", "completed"] as const;
  const allStreams = await db
    .select()
    .from(stream)
    .where(inArray(stream.status, [...publicStatuses]))
    .orderBy(stream.scheduledAt);

  const live = allStreams.filter((s) => s.status === "live" || s.status === "paused");
  const upcoming = allStreams.filter((s) => s.status === "scheduled" || s.status === "pre_stream");
  const past = allStreams.filter((s) => s.status === "completed").slice(-20).reverse();

  return c.json({ live, upcoming, past });
});

streamRoutes.get("/by-slug/:slug", async (c) => {
  const db = getDb(c.env.VIDEO_DB);
  const [found] = await db.select().from(stream).where(eq(stream.slug, c.req.param("slug")));
  if (!found) return c.json({ error: "Stream not found" }, 404);
  return c.json(found);
});

// ─── Hand Raise (Admin relay for signaling) ─────────────────────

streamRoutes.post("/:id/hand-raise", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const body = await c.req.json<{ uid: number; name: string }>();
  const streamId = c.req.param("id");

  const raises = handRaises.get(streamId) ?? [];
  const existing = raises.find((r) => r.userId === auth.user.id);
  if (existing) {
    return c.json({ message: "Hand already raised" });
  }

  raises.push({ uid: body.uid, name: body.name, userId: auth.user.id, raisedAt: Date.now() });
  handRaises.set(streamId, raises);

  return c.json({ message: "Hand raised" });
});

streamRoutes.delete("/:id/hand-raise", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const streamId = c.req.param("id");
  const raises = handRaises.get(streamId) ?? [];
  handRaises.set(
    streamId,
    raises.filter((r) => r.userId !== auth.user.id)
  );

  return c.json({ message: "Hand lowered" });
});

streamRoutes.get("/:id/hand-raises", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const streamId = c.req.param("id");
  const raises = handRaises.get(streamId) ?? [];

  return c.json(raises);
});
