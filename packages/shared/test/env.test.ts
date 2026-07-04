import { describe, expect, it } from "bun:test";

import { parseEnv, safeParseEnv } from "../src/env.js";

const VALID_ENV = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/stanzachat",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  ENCRYPTION_MASTER_KEY: Buffer.alloc(32).fill(0xff).toString("base64"),
};

describe("env schema", () => {
  it("parses a valid environment", () => {
    const env = parseEnv(VALID_ENV);
    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
  });

  it("applies PORT default", () => {
    const env = parseEnv({ ...VALID_ENV, PORT: "4000" });
    expect(env.PORT).toBe(4000);
  });

  it("rejects missing DATABASE_URL", () => {
    const result = safeParseEnv({ ...VALID_ENV, DATABASE_URL: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects short BETTER_AUTH_SECRET", () => {
    const result = safeParseEnv({ ...VALID_ENV, BETTER_AUTH_SECRET: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid BETTER_AUTH_URL", () => {
    const result = safeParseEnv({ ...VALID_ENV, BETTER_AUTH_URL: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects ENCRYPTION_MASTER_KEY that is not 32 bytes", () => {
    const result = safeParseEnv({
      ...VALID_ENV,
      ENCRYPTION_MASTER_KEY: Buffer.alloc(16).fill(0xff).toString("base64"),
    });
    expect(result.success).toBe(false);
  });

  it("rejects default BETTER_AUTH_SECRET in production", () => {
    const result = safeParseEnv({
      ...VALID_ENV,
      BETTER_AUTH_SECRET: "changeme-changeme-changeme-changeme-!!",
      NODE_ENV: "production",
    });
    expect(result.success).toBe(false);
  });

  it("allows default BETTER_AUTH_SECRET in development", () => {
    const result = safeParseEnv({
      ...VALID_ENV,
      BETTER_AUTH_SECRET: "changeme-changeme-changeme-changeme-!!",
      NODE_ENV: "development",
    });
    expect(result.success).toBe(true);
  });

  it("parseEnv throws on invalid env", () => {
    expect(() => parseEnv({})).toThrow(/Environment validation failed/);
  });

  it("allows E2E_MOCK_PROVIDER=1 in development/test", () => {
    const dev = safeParseEnv({
      ...VALID_ENV,
      E2E_MOCK_PROVIDER: "1",
      NODE_ENV: "development",
    });
    expect(dev.success).toBe(true);

    const test = safeParseEnv({
      ...VALID_ENV,
      E2E_MOCK_PROVIDER: "1",
      NODE_ENV: "test",
    });
    expect(test.success).toBe(true);
  });

  it("rejects E2E_MOCK_PROVIDER=1 in production", () => {
    const result = safeParseEnv({
      ...VALID_ENV,
      E2E_MOCK_PROVIDER: "1",
      NODE_ENV: "production",
    });
    expect(result.success).toBe(false);
  });
});
