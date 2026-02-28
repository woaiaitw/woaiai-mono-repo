import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { getAuth } from "./lib/auth";
import { users } from "./db/schema";
import type { Env } from "./env.d.ts";

const VALID_ROLES = ["owner", "admin", "speaker", "user"] as const;

const app = new Hono<{ Bindings: Env }>();

app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      return c.env.WEB_URL;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "PATCH", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/**", (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

// Helper: get the authenticated user from the session cookie
async function getSessionUser(c: { env: Env; req: { raw: Request } }) {
  const auth = getAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  return session?.user ?? null;
}

// GET /api/admin/users — list all users (requires owner or admin)
app.get("/api/admin/users", async (c) => {
  const currentUser = await getSessionUser(c);
  if (!currentUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (currentUser.role !== "owner" && currentUser.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const db = drizzle(c.env.AUTH_DB);
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      image: users.image,
      createdAt: users.createdAt,
    })
    .from(users);

  return c.json({ users: allUsers });
});

// PATCH /api/admin/users/:id/role — update a user's role
app.patch("/api/admin/users/:id/role", async (c) => {
  const currentUser = await getSessionUser(c);
  if (!currentUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (currentUser.role !== "owner" && currentUser.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const targetUserId = c.req.param("id");
  const body = await c.req.json<{ role: string }>();
  const newRole = body.role;

  if (!VALID_ROLES.includes(newRole as (typeof VALID_ROLES)[number])) {
    return c.json({ error: "Invalid role" }, 400);
  }

  // Admins cannot assign the owner role
  if (currentUser.role === "admin" && newRole === "owner") {
    return c.json({ error: "Admins cannot assign the owner role" }, 403);
  }

  // Prevent changing your own role
  if (currentUser.id === targetUserId) {
    return c.json({ error: "Cannot change your own role" }, 400);
  }

  // Admins cannot modify owners
  if (currentUser.role === "admin") {
    const db = drizzle(c.env.AUTH_DB);
    const [targetUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, targetUserId));
    if (targetUser?.role === "owner") {
      return c.json({ error: "Admins cannot modify owners" }, 403);
    }
  }

  const db = drizzle(c.env.AUTH_DB);
  const result = await db
    .update(users)
    .set({ role: newRole })
    .where(eq(users.id, targetUserId))
    .returning({ id: users.id, role: users.role });

  if (result.length === 0) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user: result[0] });
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

export default app;
