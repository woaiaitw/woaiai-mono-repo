import type { Context, Next } from "hono";
import type { Env } from "../env.d.ts";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "speaker" | "user";
}

/** Validate session by forwarding cookies or Authorization header to auth-worker.
 *  Uses Cloudflare Service Binding (AUTH_SERVICE) when available, otherwise falls
 *  back to HTTP fetch. Service bindings are required on workers.dev because
 *  subrequests between workers on the same account are blocked (error 1042).
 *
 *  NOTE: When both cookie and Authorization header are present, we forward ONLY
 *  the Authorization header. better-auth returns null when an invalid cookie is
 *  sent alongside a valid Bearer token (cookie takes precedence internally).
 *  Cross-origin requests (e.g. web on :3000 → mux-worker on :8790) may include
 *  stale/unrelated cookies, so the Bearer token is the reliable credential. */
async function getSessionUser(env: Env, headers: Headers): Promise<AuthUser | null> {
  const cookie = headers.get("cookie");
  const authorization = headers.get("authorization");
  if (!cookie && !authorization) return null;

  try {
    const fwdHeaders: Record<string, string> = {};
    // Prefer Bearer token over cookies to avoid conflicts in cross-origin scenarios
    if (authorization) {
      fwdHeaders.authorization = authorization;
    } else if (cookie) {
      fwdHeaders.cookie = cookie;
    }

    const url = `${env.AUTH_WORKER_URL}/api/auth/get-session`;
    const res = env.AUTH_SERVICE
      ? await env.AUTH_SERVICE.fetch(url, { headers: fwdHeaders })
      : await fetch(url, { headers: fwdHeaders });
    if (!res.ok) return null;

    const data = (await res.json()) as { user?: AuthUser } | null;
    return data?.user ?? null;
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
