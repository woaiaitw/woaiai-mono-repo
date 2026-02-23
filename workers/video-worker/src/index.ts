import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.d.ts";
import { streamRoutes } from "./routes/streams";
import { tokenRoutes } from "./routes/tokens";
import { recordingRoutes } from "./routes/recording";
import { sttRoutes } from "./routes/stt";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      return c.env.WEB_URL;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

app.route("/api/streams", streamRoutes);
app.route("/api/tokens", tokenRoutes);
app.route("/api/recording", recordingRoutes);
app.route("/api/stt", sttRoutes);

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

export default app;
