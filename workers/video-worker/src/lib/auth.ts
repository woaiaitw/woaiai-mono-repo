import type { Context } from "hono";
import type { Env } from "../env.d.ts";

interface SessionResponse {
  session: { id: string; userId: string; expiresAt: string } | null;
  user: { id: string; name: string; email: string; image?: string } | null;
}

export async function getSessionFromAuth(
  c: Context<{ Bindings: Env }>
): Promise<SessionResponse | null> {
  // Test bypass: if TEST_AUTH_USER is set, use it directly
  if (c.env.TEST_AUTH_USER) {
    const user = JSON.parse(c.env.TEST_AUTH_USER);
    return {
      user,
      session: { id: "test-session", userId: user.id, expiresAt: new Date(Date.now() + 86400000).toISOString() },
    };
  }

  const cookie = c.req.header("cookie");
  if (!cookie) return null;

  try {
    const res = await fetch(`${c.env.AUTH_WORKER_URL}/api/auth/get-session`, {
      headers: { cookie },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function requireAuth(c: Context<{ Bindings: Env }>) {
  const session = await getSessionFromAuth(c);
  if (!session?.user) {
    return { error: true as const, response: c.json({ error: "Unauthorized" }, 401) };
  }
  return { error: false as const, user: session.user, session: session.session! };
}
