import { getDb } from "@repo/db/client";
import { parseEnv } from "@repo/shared/env";
import { sql } from "drizzle-orm";

/**
 * Playwright globalSetup — truncates every app + Better-Auth table so
 * each E2E run starts from a known-empty database.
 *
 * Rationale: the workspace round-trip test relies on first-user
 * promotion (SPEC §5.4) — the very first sign-up becomes the instance
 * admin and can hit `/api/admin/providers`. If a previous run left a
 * user behind, the fresh sign-up would come in as a regular user and
 * the admin POST would 403.
 *
 * CI is unaffected either way (its Postgres service starts empty per
 * job); this makes the local re-run story sane.
 */
export default async function globalSetup(): Promise<void> {
  const env = parseEnv();
  const db = getDb(env.DATABASE_URL);
  // `TRUNCATE ... CASCADE` walks FK graph in one shot; RESTART IDENTITY
  // clears any serial sequences (none in this schema, harmless).
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
