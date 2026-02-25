import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMeeting, addParticipant } from "./lib/realtimekit";
import type { Env } from "./env.d.ts";

export { CaptionRoom } from "./lib/caption-room";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "/api/rtc/*",
  cors({
    origin: (origin, c) => {
      return c.env.WEB_URL;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

/** Get or create meeting ID, persisted in Durable Object storage */
async function getOrCreateMeetingId(env: Env): Promise<string> {
  const doId = env.CAPTION_ROOM.idFromName("main-room");
  const room = env.CAPTION_ROOM.get(doId);

  const resp = await room.fetch(new Request("http://do/meeting-id"));
  const data = (await resp.json()) as { meetingId: string | null };

  if (data.meetingId) return data.meetingId;

  const meeting = await createMeeting(env);

  await room.fetch(
    new Request("http://do/meeting-id", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: meeting.id }),
    })
  );

  return meeting.id;
}

// Create or get existing meeting
app.post("/api/rtc/meeting", async (c) => {
  try {
    const meetingId = await getOrCreateMeetingId(c.env);
    return c.json({ meetingId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Join meeting as host or viewer
app.post("/api/rtc/join", async (c) => {
  try {
    const body = await c.req.json<{ role: string; name?: string; sessionId?: string }>();
    const role = body.role === "host" ? "host" : "viewer";
    const presetName =
      role === "host" ? "livestream_host" : "livestream_viewer";
    const name = body.name || (role === "host" ? "Host" : "Viewer");

    // Use client's persistent session ID so rejoining replaces the stale participant
    const customParticipantId = body.sessionId || crypto.randomUUID();

    const meetingId = await getOrCreateMeetingId(c.env);

    const result = await addParticipant(c.env, meetingId, {
      name,
      presetName,
      customParticipantId,
    });

    return c.json({
      authToken: result.authToken,
      participantId: result.participantId,
      meetingId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// WebSocket upgrade for caption broadcast (also proxies audio to Deepgram)
app.get("/api/rtc/ws", async (c) => {
  const id = c.env.CAPTION_ROOM.idFromName("main-room");
  const room = c.env.CAPTION_ROOM.get(id);
  return room.fetch(c.req.raw);
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

export default app;
