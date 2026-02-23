// Simple in-memory rate limiter for viewer token endpoint
// Resets per-isolate (acceptable for MVP — production should use Durable Objects or KV)

const requests = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requests.get(ip);

  if (!entry || now >= entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return true;
  }

  return false;
}
