import {
  createRateLimiter,
  type RateLimiter,
  type RateLimitResult,
} from "@repo/shared/rate-limit";
import { headers } from "next/headers";

/**
 * Process-wide rate limiters (SPEC §7).
 *
 * Two axes:
 *  - `chatLimiter` — per-user cap on `POST /api/chat` streaming
 *    completions to blunt runaway model spend.
 *  - `adminLimiter` — per-IP cap on `/api/admin/*` to blunt brute-force
 *    probes at admin surface (SPEC calls out `admin` + `/api/chat`
 *    explicitly in Phase 4).
 *
 * In-memory only. The Redis backend is v0.2 (SPEC §1.2).
 */
export const chatLimiter: RateLimiter = createRateLimiter({
  // ~1 req/sec sustained, allow a small burst.
  limit: 20,
  windowMs: 60_000,
});

export const adminLimiter: RateLimiter = createRateLimiter({
  limit: 60,
  windowMs: 60_000,
});

/**
 * Extract a stable rate-limit key from headers. Prefer the left-most
 * `x-forwarded-for` entry when the app runs behind a proxy.
 */
export async function requestIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown"
  );
}

/**
 * Turn a limiter result into a `429` Response. Set `Retry-After` so
 * clients honour the backoff hint.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    {
      error: {
        code: "rate_limited",
        message: "Too many requests, slow down",
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter ?? 60),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
