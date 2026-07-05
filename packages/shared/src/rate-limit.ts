/**
 * In-memory fixed-window rate limiter (SPEC §7).
 *
 * Scope: a single Node process. When we move to a multi-instance
 * deploy (v0.2+ with Redis, per SPEC §1.2), this module is the drop-in
 * seam — the {@link RateLimiter} interface stays; only the backing
 * store changes.
 *
 * Fixed-window is intentional: it's cheap, honest about its behavior
 * (burst up to N per window), and matches the "simple in-memory/pg-
 * based limit on `/api/chat` per user in v0.1" wording in SPEC §7.
 */
export interface RateLimiter {
  /** Attempt to consume one token from `key`'s bucket. */
  consume(key: string): RateLimitResult;
}

export interface RateLimitResult {
  ok: boolean;
  /** Remaining requests before the window resets. */
  remaining: number;
  /** Epoch-ms at which the current window ends. */
  resetAt: number;
  /** Retry-After hint (seconds) when `ok` is false. */
  retryAfter?: number;
}

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Injectable clock — tests pass a stub. */
  now?: () => number;
}

/**
 * Create an in-memory fixed-window limiter. Not exported as a singleton
 * on purpose: routes/tests create their own limiter and hold on to it
 * for the process lifetime (see `apps/web/lib/rate-limit.ts`).
 */
export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;

  interface Bucket {
    count: number;
    windowStart: number;
  }
  const buckets = new Map<string, Bucket>();

  return {
    consume(key) {
      const t = now();
      const bucket = buckets.get(key);
      if (!bucket || t - bucket.windowStart >= windowMs) {
        // New window.
        buckets.set(key, { count: 1, windowStart: t });
        return { ok: true, remaining: limit - 1, resetAt: t + windowMs };
      }
      if (bucket.count >= limit) {
        const resetAt = bucket.windowStart + windowMs;
        return {
          ok: false,
          remaining: 0,
          resetAt,
          retryAfter: Math.max(1, Math.ceil((resetAt - t) / 1000)),
        };
      }
      bucket.count += 1;
      return {
        ok: true,
        remaining: limit - bucket.count,
        resetAt: bucket.windowStart + windowMs,
      };
    },
  };
}
