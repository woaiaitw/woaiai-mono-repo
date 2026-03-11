import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createLiveStream,
  getLiveStream,
  listLiveStreams,
  completeLiveStream,
  deleteLiveStream,
  resetStreamKey,
  getAsset,
} from "./lib/mux-api";
import {
  createStream,
  getStream,
  getStreamByMuxId,
  listStreams,
  updateStreamMuxIds,
  updateStreamStatus,
  updateStreamAsset,
  updateStreamKey,
  deleteStream,
} from "./lib/streams-db";
import { requireHost, type AuthUser } from "./lib/auth";
import type { Env } from "./env.d.ts";

type AppEnv = { Bindings: Env; Variables: { user: AuthUser } };

const app = new Hono<AppEnv>();

// Global error handler — ensures uncaught exceptions return JSON with CORS headers
app.onError((err, c) => {
  console.error("[MUX-WORKER] Unhandled error:", err);
  return c.json({ error: err.message || "Internal server error" }, 500);
});

app.use(
  "/api/mux/*",
  cors({
    origin: (origin, c) => {
      return c.env.WEB_URL;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Stream Events — CRUD for scheduled/live/ended streams (D1-backed)
// ---------------------------------------------------------------------------

// Schedule a new stream (host only)
app.post("/api/mux/events", requireHost(), async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json<{ title: string; description?: string; scheduled_at: string }>();

    if (!body.title || !body.scheduled_at) {
      return c.json({ error: "title and scheduled_at are required" }, 400);
    }

    const id = crypto.randomUUID();
    const stream = await createStream(c.env.MUX_DB, {
      id,
      title: body.title,
      description: body.description,
      scheduled_at: body.scheduled_at,
      created_by: user.id,
    });

    return c.json(stream, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CREATE-EVENT]", message);
    return c.json({ error: message }, 500);
  }
});

// List streams — public (viewers see live/upcoming/past)
app.get("/api/mux/events", async (c) => {
  const statusParam = c.req.query("status");
  const statusFilter = statusParam ? statusParam.split(",") : undefined;
  const streams = await listStreams(c.env.MUX_DB, statusFilter);

  // Strip sensitive fields for public consumers
  const publicStreams = streams.map(({ mux_stream_key, ...rest }) => rest);
  return c.json({ streams: publicStreams });
});

// Get single stream — public
app.get("/api/mux/events/:id", async (c) => {
  let stream = await getStream(c.env.MUX_DB, c.req.param("id"));
  if (!stream) return c.json({ error: "Not found" }, 404);

  // Lazy backfill: if ended with asset ID but no playback ID, fetch from Mux
  if (stream.status === "ended" && stream.mux_asset_id && !stream.mux_asset_playback_id) {
    try {
      const asset = await getAsset(c.env, stream.mux_asset_id);
      const playbackId = asset.playback_ids?.[0]?.id;
      if (playbackId) {
        await updateStreamAsset(c.env.MUX_DB, stream.mux_stream_id!, stream.mux_asset_id, playbackId);
        stream = (await getStream(c.env.MUX_DB, stream.id))!;
      }
    } catch (e) {
      console.error("[BACKFILL] Failed to fetch asset playback ID:", e);
    }
  }

  const { mux_stream_key, ...publicStream } = stream;
  return c.json(publicStream);
});

// Get stream details for host (includes stream key + OBS info)
// Also auto-detects when OBS is streaming via Mux API polling
app.get("/api/mux/events/:id/host", requireHost(), async (c) => {
  let stream = await getStream(c.env.MUX_DB, c.req.param("id"));
  if (!stream) return c.json({ error: "Not found" }, 404);

  // Auto-detect OBS streaming: if DB says "scheduled" but Mux says "active", go live
  if (stream.status === "scheduled" && stream.mux_stream_id) {
    try {
      const muxStream = await getLiveStream(c.env, stream.mux_stream_id);
      if (muxStream.status === "active") {
        await updateStreamStatus(c.env.MUX_DB, stream.id, "live");
        stream = (await getStream(c.env.MUX_DB, stream.id))!;
        console.log(`[AUTO-DETECT] Stream ${stream.id} → live (OBS active)`);
      }
    } catch (e) {
      console.error("[AUTO-DETECT] Mux API check failed:", e);
    }
  }

  return c.json({
    ...stream,
    rtmpUrl: "rtmps://global-live.mux.com/app",
  });
});

// Provision Mux live stream (lazy — called when host opens dashboard)
app.put("/api/mux/events/:id/provision", requireHost(), async (c) => {
  const stream = await getStream(c.env.MUX_DB, c.req.param("id"));
  if (!stream) return c.json({ error: "Not found" }, 404);

  // Already provisioned
  if (stream.mux_stream_id) {
    return c.json({
      ...stream,
      rtmpUrl: "rtmps://global-live.mux.com/app",
    });
  }

  const muxStream = await createLiveStream(c.env);
  const playbackId = muxStream.playback_ids[0]?.id ?? "";

  await updateStreamMuxIds(c.env.MUX_DB, stream.id, muxStream.id, playbackId, muxStream.stream_key);

  const updated = await getStream(c.env.MUX_DB, stream.id);
  return c.json({
    ...updated,
    rtmpUrl: "rtmps://global-live.mux.com/app",
  });
});

// Go live — transition from preview to live
app.put("/api/mux/events/:id/go-live", requireHost(), async (c) => {
  const stream = await getStream(c.env.MUX_DB, c.req.param("id"));
  if (!stream) return c.json({ error: "Not found" }, 404);

  if (stream.status !== "preview" && stream.status !== "scheduled") {
    return c.json({ error: `Cannot go live from status: ${stream.status}` }, 400);
  }

  await updateStreamStatus(c.env.MUX_DB, stream.id, "live");
  return c.json({ success: true });
});

// End stream
app.put("/api/mux/events/:id/end", requireHost(), async (c) => {
  const stream = await getStream(c.env.MUX_DB, c.req.param("id"));
  if (!stream) return c.json({ error: "Not found" }, 404);

  if (stream.status !== "live" && stream.status !== "preview") {
    return c.json({ error: `Cannot end stream with status: ${stream.status}` }, 400);
  }

  // Complete the Mux live stream if provisioned
  if (stream.mux_stream_id) {
    try {
      await completeLiveStream(c.env, stream.mux_stream_id);
    } catch (e) {
      console.error("[END-STREAM] Mux complete failed:", e);
    }
  }

  await updateStreamStatus(c.env.MUX_DB, stream.id, "ended", new Date().toISOString());
  return c.json({ success: true });
});

// Delete a scheduled stream (host only, only if not live)
app.delete("/api/mux/events/:id", requireHost(), async (c) => {
  const stream = await getStream(c.env.MUX_DB, c.req.param("id"));
  if (!stream) return c.json({ error: "Not found" }, 404);

  if (stream.status === "live") {
    return c.json({ error: "Cannot delete a live stream — end it first" }, 400);
  }

  // Clean up Mux stream if provisioned
  if (stream.mux_stream_id) {
    try {
      await deleteLiveStream(c.env, stream.mux_stream_id);
    } catch (e) {
      console.error("[DELETE-STREAM] Mux delete failed:", e);
    }
  }

  await deleteStream(c.env.MUX_DB, stream.id);
  return c.json({ success: true });
});

// Reset stream key for a scheduled stream
app.post("/api/mux/events/:id/reset-key", requireHost(), async (c) => {
  const stream = await getStream(c.env.MUX_DB, c.req.param("id"));
  if (!stream) return c.json({ error: "Not found" }, 404);

  if (!stream.mux_stream_id) {
    return c.json({ error: "Stream not provisioned yet" }, 400);
  }

  const muxStream = await resetStreamKey(c.env, stream.mux_stream_id);
  await updateStreamKey(c.env.MUX_DB, stream.id, muxStream.stream_key);

  return c.json({ streamKey: muxStream.stream_key });
});

// ---------------------------------------------------------------------------
// Legacy Mux proxy routes (direct Mux API access — kept for backwards compat)
// ---------------------------------------------------------------------------

app.post("/api/mux/streams", async (c) => {
  try {
    const stream = await createLiveStream(c.env);
    return c.json({
      id: stream.id,
      streamKey: stream.stream_key,
      playbackId: stream.playback_ids[0]?.id,
      status: stream.status,
      rtmpUrl: "rtmps://global-live.mux.com/app",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

app.get("/api/mux/streams", async (c) => {
  try {
    const streams = await listLiveStreams(c.env);
    return c.json({
      streams: streams.map((s) => ({
        id: s.id,
        playbackId: s.playback_ids[0]?.id,
        status: s.status,
        createdAt: s.created_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

app.get("/api/mux/streams/:id", async (c) => {
  try {
    const stream = await getLiveStream(c.env, c.req.param("id"));
    return c.json({
      id: stream.id,
      playbackId: stream.playback_ids[0]?.id,
      status: stream.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

app.put("/api/mux/streams/:id/complete", async (c) => {
  try {
    await completeLiveStream(c.env, c.req.param("id"));
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

app.delete("/api/mux/streams/:id", async (c) => {
  try {
    await deleteLiveStream(c.env, c.req.param("id"));
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

app.post("/api/mux/streams/:id/reset-key", async (c) => {
  try {
    const stream = await resetStreamKey(c.env, c.req.param("id"));
    return c.json({
      streamKey: stream.stream_key,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Webhook receiver for Mux events
// ---------------------------------------------------------------------------

app.post("/api/mux/webhooks", async (c) => {
  try {
    const body = await c.req.json();
    const eventType = body.type as string;
    const muxStreamId = body.data?.id as string | undefined;

    console.log(`[MUX-WEBHOOK] ${eventType}`, JSON.stringify(muxStreamId));

    switch (eventType) {
      case "video.live_stream.connected":
        console.log("[MUX] Stream connected:", muxStreamId);
        break;

      case "video.live_stream.active": {
        // OBS is sending video — transition scheduled → preview
        if (muxStreamId) {
          const stream = await getStreamByMuxId(c.env.MUX_DB, muxStreamId);
          if (stream && stream.status === "scheduled") {
            await updateStreamStatus(c.env.MUX_DB, stream.id, "preview");
            console.log(`[MUX] Stream ${stream.id} → preview`);
          }
        }
        break;
      }

      case "video.live_stream.idle":
        console.log("[MUX] Stream went idle:", muxStreamId);
        break;

      case "video.live_stream.recording":
        console.log("[MUX] Stream recording:", muxStreamId);
        break;

      case "video.asset.ready": {
        // VOD asset is ready — store the asset ID and its playback ID for replay
        const assetId = body.data?.id as string | undefined;
        const liveStreamId = body.data?.live_stream_id as string | undefined;
        const assetPlaybackId = body.data?.playback_ids?.[0]?.id as string | undefined;
        if (assetId && liveStreamId) {
          await updateStreamAsset(c.env.MUX_DB, liveStreamId, assetId, assetPlaybackId);
          console.log(`[MUX] VOD asset ${assetId} (playback: ${assetPlaybackId}) stored for stream ${liveStreamId}`);
        }
        break;
      }

      default:
        console.log("[MUX] Unhandled event:", eventType);
    }

    return c.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});


export default app;
