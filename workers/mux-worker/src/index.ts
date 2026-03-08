import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createLiveStream,
  getLiveStream,
  listLiveStreams,
  completeLiveStream,
  deleteLiveStream,
  resetStreamKey,
} from "./lib/mux-api";
import type { Env } from "./env.d.ts";

const app = new Hono<{ Bindings: Env }>();

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

// Create a new live stream
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

// List all live streams
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

// Get stream status (public — used by viewer page to check if stream is live)
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

// End a stream
app.put("/api/mux/streams/:id/complete", async (c) => {
  try {
    await completeLiveStream(c.env, c.req.param("id"));
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Delete a stream
app.delete("/api/mux/streams/:id", async (c) => {
  try {
    await deleteLiveStream(c.env, c.req.param("id"));
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Reset stream key
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

// Webhook receiver for Mux events
app.post("/api/mux/webhooks", async (c) => {
  try {
    const body = await c.req.json();
    const eventType = body.type as string;

    console.log(`[MUX-WEBHOOK] ${eventType}`, JSON.stringify(body.data?.id));

    // Handle key events — extend as needed
    switch (eventType) {
      case "video.live_stream.connected":
        console.log("[MUX] Stream connected:", body.data?.id);
        break;
      case "video.live_stream.recording":
        console.log("[MUX] Stream recording:", body.data?.id);
        break;
      case "video.live_stream.active":
        console.log("[MUX] Stream is live:", body.data?.id);
        break;
      case "video.live_stream.idle":
        console.log("[MUX] Stream went idle:", body.data?.id);
        break;
      case "video.asset.ready":
        console.log("[MUX] VOD asset ready:", body.data?.id);
        break;
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
