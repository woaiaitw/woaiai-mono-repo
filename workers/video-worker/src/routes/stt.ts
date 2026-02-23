import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../env.d.ts";
import { getDb } from "../lib/db";
import { stream } from "../db/schema";
import { requireAuth } from "../lib/auth";
import { startStt, stopStt } from "../lib/agora-rest";
import { buildViewerToken, generateUid } from "../lib/agora-token";

export const sttRoutes = new Hono<{ Bindings: Env }>();

// In-memory STT task tracking (per-isolate)
const sttTasks = new Map<string, { taskId: string; token: string }>();

// ─── Start STT (called during go-live) ──────────────────────────

sttRoutes.post("/start", async (c) => {
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

  const sttUid = String(generateUid());
  const token = buildViewerToken(
    c.env.AGORA_APP_ID,
    c.env.AGORA_APP_CERTIFICATE,
    streamRecord.agoraChannelName,
    Number(sttUid)
  );

  try {
    const { taskId } = await startStt(
      c.env,
      streamRecord.agoraChannelName,
      token,
      sttUid
    );

    sttTasks.set(body.streamId, { taskId, token });

    return c.json({ taskId, message: "STT started" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to start STT: ${message}` }, 500);
  }
});

// ─── Stop STT (called during end-stream) ────────────────────────

sttRoutes.post("/stop", async (c) => {
  const auth = await requireAuth(c);
  if (auth.error) return auth.response;

  const body = await c.req.json<{ streamId: string }>();
  if (!body.streamId) {
    return c.json({ error: "streamId is required" }, 400);
  }

  const task = sttTasks.get(body.streamId);
  if (!task) {
    return c.json({ error: "No active STT task found for this stream" }, 404);
  }

  try {
    await stopStt(c.env, task.taskId, task.token);
    sttTasks.delete(body.streamId);

    return c.json({ message: "STT stopped" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to stop STT: ${message}` }, 500);
  }
});
