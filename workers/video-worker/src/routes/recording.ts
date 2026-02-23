import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Env } from "../env.d.ts";
import { getDb } from "../lib/db";
import { stream, recording } from "../db/schema";
import { requireAuth } from "../lib/auth";
import {
  acquireRecordingResource,
  startRecording,
  stopRecording,
  queryRecording,
} from "../lib/agora-rest";
import { buildViewerToken, generateUid } from "../lib/agora-token";

export const recordingRoutes = new Hono<{ Bindings: Env }>();

// ─── Start Recording (called during go-live) ───────────────────

recordingRoutes.post("/start", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const body = await c.req.json<{ streamId: string }>();
  if (!body.streamId) {
    return c.json({ error: "streamId is required" }, 400);
  }

  const db = getDb(c.env.VIDEO_DB);
  const [streamRecord] = await db
    .select()
    .from(stream)
    .where(eq(stream.id, body.streamId));

  if (!streamRecord) {
    return c.json({ error: "Stream not found" }, 404);
  }

  const recordingUid = String(generateUid());
  const token = buildViewerToken(
    c.env.AGORA_APP_ID,
    c.env.AGORA_APP_CERTIFICATE,
    streamRecord.agoraChannelName,
    Number(recordingUid)
  );

  try {
    const { resourceId } = await acquireRecordingResource(
      c.env,
      streamRecord.agoraChannelName,
      recordingUid
    );

    const { sid } = await startRecording(c.env, resourceId, streamRecord.agoraChannelName, recordingUid, token, {
      accessKey: "YOUR_R2_ACCESS_KEY",
      secretKey: "YOUR_R2_SECRET_KEY",
      bucket: "stream-recordings",
      endpoint: "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com",
    });

    const [rec] = await db
      .insert(recording)
      .values({
        id: nanoid(),
        streamId: body.streamId,
        agoraResourceId: resourceId,
        agoraSid: sid,
        status: "recording",
        startedAt: new Date(),
      })
      .returning();

    return c.json(rec, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to start recording: ${message}` }, 500);
  }
});

// ─── Stop Recording (called during end-stream) ─────────────────

recordingRoutes.post("/stop", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const body = await c.req.json<{ streamId: string }>();
  if (!body.streamId) {
    return c.json({ error: "streamId is required" }, 400);
  }

  const db = getDb(c.env.VIDEO_DB);
  const [rec] = await db
    .select()
    .from(recording)
    .where(eq(recording.streamId, body.streamId));

  if (!rec || !rec.agoraResourceId || !rec.agoraSid) {
    return c.json({ error: "No active recording found" }, 404);
  }

  const [streamRecord] = await db
    .select()
    .from(stream)
    .where(eq(stream.id, body.streamId));

  if (!streamRecord) {
    return c.json({ error: "Stream not found" }, 404);
  }

  try {
    const recordingUid = String(generateUid());
    await stopRecording(
      c.env,
      rec.agoraResourceId,
      rec.agoraSid,
      streamRecord.agoraChannelName,
      recordingUid
    );

    const [updated] = await db
      .update(recording)
      .set({ status: "processing" as const, stoppedAt: new Date() })
      .where(eq(recording.id, rec.id))
      .returning();

    return c.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(recording)
      .set({ status: "failed" as const })
      .where(eq(recording.id, rec.id));
    return c.json({ error: `Failed to stop recording: ${message}` }, 500);
  }
});

// ─── Query Recording Status ─────────────────────────────────────

recordingRoutes.get("/status/:sid", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb(c.env.VIDEO_DB);
  const [rec] = await db
    .select()
    .from(recording)
    .where(eq(recording.agoraSid, c.req.param("sid")));

  if (!rec || !rec.agoraResourceId || !rec.agoraSid) {
    return c.json({ error: "Recording not found" }, 404);
  }

  try {
    const status = await queryRecording(c.env, rec.agoraResourceId, rec.agoraSid);
    return c.json({ recording: rec, agoraStatus: status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to query recording: ${message}` }, 500);
  }
});

// ─── Recording Access ───────────────────────────────────────────

recordingRoutes.get("/:streamId", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb(c.env.VIDEO_DB);
  const recordings = await db
    .select()
    .from(recording)
    .where(eq(recording.streamId, c.req.param("streamId")));

  return c.json(recordings);
});

recordingRoutes.get("/:streamId/url", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const db = getDb(c.env.VIDEO_DB);
  const [rec] = await db
    .select()
    .from(recording)
    .where(eq(recording.streamId, c.req.param("streamId")));

  if (!rec || !rec.r2Key) {
    return c.json({ error: "Recording not available" }, 404);
  }

  // Generate a signed URL for the recording from R2
  // R2 presigned URLs are not directly available in Workers — serve via the worker
  return c.json({
    downloadUrl: `/api/recording/${c.req.param("streamId")}/download`,
    recording: rec,
  });
});
