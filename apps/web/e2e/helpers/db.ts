import { getDb } from "@repo/db/client";
import { parseEnv } from "@repo/shared/env";
import { sql } from "drizzle-orm";

/**
 * Truncate every StanzaChat table so an E2E spec starts from a
 * known-empty database.
 *
 * Playwright's `globalSetup` already runs this once per full suite
 * (see `e2e/global.setup.ts`), but a spec that must own the first-run
 * promotion path (SPEC §5.4) — such as `admin.spec.ts` — cannot share
 * DB state with a spec running in parallel. Call this from a
 * `test.beforeAll` when the spec depends on being the first sign-up.
 */
export async function truncateAll(): Promise<void> {
  const env = parseEnv();
  const db = getDb(env.DATABASE_URL);
  await db.execute(sql`
    TRUNCATE TABLE
      "artifact_versions",
      "artifacts",
      "messages",
      "chats",
      "workspaces",
      "audit_logs",
      "provider_models",
      "model_configurations",
      "instance_settings",
      "invitation",
      "member",
      "organization",
      "session",
      "account",
      "verification",
      "user"
    RESTART IDENTITY CASCADE
  `);
}
