import { describe, expect, test } from "bun:test";

import { createRateLimiter } from "../src/rate-limit.js";

describe("createRateLimiter", () => {
  test("allows up to `limit` consumes within a window", () => {
    const now = 0;
    const limiter = createRateLimiter({
      limit: 3,
      windowMs: 1000,
      now: () => now,
    });

    expect(limiter.consume("k").ok).toBe(true);
    expect(limiter.consume("k").ok).toBe(true);
    const third = limiter.consume("k");
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
  });

  test("rejects the (limit + 1)-th call and returns retry hints", () => {
    const now = 0;
    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 1000,
      now: () => now,
    });
    limiter.consume("k");
    limiter.consume("k");
    const rejected = limiter.consume("k");
    expect(rejected.ok).toBe(false);
    expect(rejected.remaining).toBe(0);
    expect(rejected.retryAfter).toBeGreaterThan(0);
    expect(rejected.resetAt).toBe(1000);
  });

  test("resets after the window elapses", () => {
    let now = 0;
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: () => now,
    });
    expect(limiter.consume("k").ok).toBe(true);
    expect(limiter.consume("k").ok).toBe(false);
    now = 1000;
    expect(limiter.consume("k").ok).toBe(true);
  });

  test("buckets are isolated per key", () => {
    const now = 0;
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: () => now,
    });
    expect(limiter.consume("a").ok).toBe(true);
    expect(limiter.consume("b").ok).toBe(true);
    expect(limiter.consume("a").ok).toBe(false);
    expect(limiter.consume("b").ok).toBe(false);
  });
});
