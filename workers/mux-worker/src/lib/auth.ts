import type { Context, Next } from "hono";
import type { Env } from "../env.d.ts";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "speaker" | "user";
}

/** Validate session by forwarding cookies and/or Authorization header to auth-worker.
 *  Uses Cloudflare Service Binding (AUTH_SERVICE) when available, otherwise falls
 *  back to HTTP fetch. Service bindings are required on workers.dev because
 *  subrequests between workers on the same account are blocked (error 1042). */
async function getSessionUser(env: Env, headers: Headers): Promise<AuthUser | null> {
  const cookie = headers.get("cookie");
  const authorization = headers.get("authorization");
  if (!cookie && !authorization) return null;

  try {
    const fwdHeaders: Record<string, string> = {};
    if (cookie) fwdHeaders.cookie = cookie;
    if (authorization) fwdHeaders.authorization = authorization;

    const url = `${env.AUTH_WORKER_URL}/api/auth/get-session`;
    const res = env.AUTH_SERVICE
      ? await env.AUTH_SERVICE.fetch(url, { headers: fwdHeaders })
      : await fetch(url, { headers: fwdHeaders });
    if (!res.ok) return null;

    const data = (await res.json()) as { user?: AuthUser };
    return data.user ?? null;
  } catch {
    return null;
  }
}

/** Middleware: require authenticated user, attach to context */
export function requireAuth() {
  return async (c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>, next: Next) => {
    const user = await getSessionUser(c.env, c.req.raw.headers);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("user", user);
    await next();
  };
}

/** Middleware: require owner or admin role */
export function requireHost() {
  return async (c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>, next: Next) => {
    const user = await getSessionUser(c.env, c.req.raw.headers);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (user.role !== "owner" && user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }
    c.set("user", user);
    await next();
  };
}
