import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../env.d.ts";
import { getDb } from "../lib/db";
import { stream, participant } from "../db/schema";
import { requireAuth } from "../lib/auth";
import {
  buildViewerToken,
  buildPublisherToken,
  generateUid,
  screenShareUid,
} from "../lib/agora-token";
import { isRateLimited } from "../lib/rate-limit";
import { nanoid } from "nanoid";

export const tokenRoutes = new Hono<{ Bindings: Env }>();

// ─── Viewer Token (no auth, rate-limited) ───────────────────────

tokenRoutes.get("/viewer", async (c) => {
  const channel = c.req.query("channel");
  if (!channel) {
    return c.json({ error: "channel query parameter is required" }, 400);
  }

  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  if (isRateLimited(ip)) {
    return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
  }

  const uid = generateUid();
  const token = buildViewerToken(
    c.env.AGORA_APP_ID,
    c.env.AGORA_APP_CERTIFICATE,
    channel,
    uid
  );

  // Track viewer participant
  const db = getDb(c.env.VIDEO_DB);
  const [streamRecord] = await db
    .select()
    .from(stream)
    .where(eq(stream.agoraChannelName, channel));

  if (streamRecord) {
    await db.insert(participant).values({
      id: nanoid(),
      streamId: streamRecord.id,
      userId: null,
      agoraUid: uid,
      role: "viewer",
    });
  }

  return c.json({ token, uid, appId: c.env.AGORA_APP_ID, channel });
});

// ─── Host Token (auth required) ─────────────────────────────────

tokenRoutes.get("/host", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const streamId = c.req.query("stream");
  if (!streamId) {
    return c.json({ error: "stream query parameter is required" }, 400);
  }

  const db = getDb(c.env.VIDEO_DB);
  const [streamRecord] = await db
    .select()
    .from(stream)
    .where(eq(stream.id, streamId));

  if (!streamRecord) {
    return c.json({ error: "Stream not found" }, 404);
  }

  if (streamRecord.hostUserId !== auth.user.id) {
    return c.json({ error: "You are not the assigned host for this stream" }, 403);
  }

  const uid = generateUid();
  const token = buildPublisherToken(
    c.env.AGORA_APP_ID,
    c.env.AGORA_APP_CERTIFICATE,
    streamRecord.agoraChannelName,
    uid
  );

  // Track host participant
  await db.insert(participant).values({
    id: nanoid(),
    streamId: streamRecord.id,
    userId: auth.user.id,
    agoraUid: uid,
    role: "host",
  });

  return c.json({
    token,
    uid,
    appId: c.env.AGORA_APP_ID,
    channel: streamRecord.agoraChannelName,
  });
});

// ─── Speaker Token (auth required, must be promoted) ────────────

tokenRoutes.get("/speaker", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const streamId = c.req.query("stream");
  if (!streamId) {
    return c.json({ error: "stream query parameter is required" }, 400);
  }

  const db = getDb(c.env.VIDEO_DB);
  const [streamRecord] = await db
    .select()
    .from(stream)
    .where(eq(stream.id, streamId));

  if (!streamRecord) {
    return c.json({ error: "Stream not found" }, 404);
  }

  // Speaker token is issued when the host promotes someone.
  // The caller must be authenticated — the frontend requests this after receiving a promote_speaker message.
  const uid = generateUid();
  const token = buildPublisherToken(
    c.env.AGORA_APP_ID,
    c.env.AGORA_APP_CERTIFICATE,
    streamRecord.agoraChannelName,
    uid
  );

  await db.insert(participant).values({
    id: nanoid(),
    streamId: streamRecord.id,
    userId: auth.user.id,
    agoraUid: uid,
    role: "speaker",
  });

  return c.json({
    token,
    uid,
    appId: c.env.AGORA_APP_ID,
    channel: streamRecord.agoraChannelName,
  });
});

// ─── Screen Share Token (auth required, separate UID) ───────────

tokenRoutes.get("/screen", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const streamId = c.req.query("stream");
  const cameraUid = c.req.query("cameraUid");
  if (!streamId || !cameraUid) {
    return c.json({ error: "stream and cameraUid query parameters are required" }, 400);
  }

  const db = getDb(c.env.VIDEO_DB);
  const [streamRecord] = await db
    .select()
    .from(stream)
    .where(eq(stream.id, streamId));

  if (!streamRecord) {
    return c.json({ error: "Stream not found" }, 404);
  }

  const uid = screenShareUid(Number(cameraUid));
  const token = buildPublisherToken(
    c.env.AGORA_APP_ID,
    c.env.AGORA_APP_CERTIFICATE,
    streamRecord.agoraChannelName,
    uid
  );

  return c.json({
    token,
    uid,
    appId: c.env.AGORA_APP_ID,
    channel: streamRecord.agoraChannelName,
  });
});
