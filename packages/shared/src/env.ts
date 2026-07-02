import { z } from "zod";

/**
 * Application environment schema (SPEC §8).
 *
 * Validated once at boot via `parseEnv()`. In production, missing or
 * default-looking secrets cause the app to refuse to start (guardrail #4).
 */

const DEFAULT_SECRET_VALUES = new Set([
  "",
  "changeme",
  "change-me",
  "secret",
  "super-secret",
  "changeme-changeme-changeme-changeme-!!",
]);

function isDefaultValue(value: string): boolean {
  return DEFAULT_SECRET_VALUES.has(value);
}

/**
 * Validates that a base64 string decodes to exactly 32 bytes (256 bits),
 * the key length required for AES-256-GCM. See SPEC §7.
 */
const base64Key32 = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      const decoded = Buffer.from(value, "base64");
      return decoded.length === 32;
    } catch {
      return false;
    }
  }, "ENCRYPTION_MASTER_KEY must be base64-encoded 32 bytes (256 bits)");

const authSecret = z
  .string()
  .min(32, "BETTER_AUTH_SECRET must be at least 32 characters");

export const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    BETTER_AUTH_SECRET: authSecret,
    BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
    ENCRYPTION_MASTER_KEY: base64Key32,
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") {
      return;
    }

    if (isDefaultValue(data.BETTER_AUTH_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BETTER_AUTH_SECRET"],
        message: "BETTER_AUTH_SECRET must not be a default value in production",
      });
    }

    if (isDefaultValue(data.ENCRYPTION_MASTER_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ENCRYPTION_MASTER_KEY"],
        message:
          "ENCRYPTION_MASTER_KEY must not be a default value in production",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate `process.env`. Throws a typed description of all
 * violations at once (not field-by-field) so boot failures are actionable.
 */
export function parseEnv(
  env: Record<string, string | undefined> = process.env,
): Env {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  • ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(
      `Environment validation failed:\n${issues.join("\n")}\n\nSee SPEC §8 for required variables.`,
    );
  }

  return result.data;
}

/**
 * Returns validated env without throwing — useful for tests where you
 * want to assert on the error rather than crash.
 */
export function safeParseEnv(
  env: Record<string, string | undefined> = process.env,
): { success: true; data: Env } | { success: false; error: z.ZodError } {
  const result = envSchema.safeParse(env);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error };
}
