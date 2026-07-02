import { createDb, type Db } from "@repo/db/client";
import { member, organization, user, workspaces } from "@repo/db/schema";
import {
  createPersonalOrgAndWorkspace,
  ensureInstanceSettings,
  getInstanceSettings,
  promoteFirstUserToAdmin,
} from "@repo/db/setup";
import { createUlid } from "@repo/db/slug";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";

/**
 * Integration tests for Phase 1 auth first-run flow (SPEC §10).
 *
 * These tests exercise the same setup functions used by Better-Auth's
 * databaseHooks.user.create.after callback, proving:
 * - first user becomes admin
 * - org + default workspace auto-created
 * - registration mode enforced (flips to invite_only)
 *
 * We test at the setup-function level rather than through Better-Auth's
 * HTTP API because the hook behavior is the Phase 1 acceptance criteria.
 * Full HTTP-level signup tests run in the E2E suite against `next start`.
 */

const PG_IMAGE = "pgvector/pgvector:pg17";

async function pushSchema(db: Db): Promise<void> {
  await db.execute(`
    CREATE EXTENSION IF NOT EXISTS vector;

    DO $$ BEGIN CREATE TYPE instance_role AS ENUM ('admin', 'user');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE registration_mode AS ENUM ('open', 'invite_only', 'closed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "instance_settings" (
      "id" varchar(32) PRIMARY KEY,
      "registration_mode" registration_mode NOT NULL DEFAULT 'open',
      "setup_completed" boolean NOT NULL DEFAULT false,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "user" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "email" text NOT NULL UNIQUE,
      "email_verified" boolean NOT NULL DEFAULT false,
      "image" text,
      "role" instance_role NOT NULL DEFAULT 'user',
      "banned" boolean NOT NULL DEFAULT false,
      "ban_reason" text,
      "ban_expires" timestamp,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "organization" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "slug" text NOT NULL UNIQUE,
      "logo" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "created_by" text REFERENCES "user"("id") ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS "member" (
      "id" text PRIMARY KEY,
      "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "role" org_role NOT NULL DEFAULT 'member',
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "member_org_user_unique"
      ON "member"("organization_id", "user_id");

    CREATE TABLE IF NOT EXISTS "workspaces" (
      "id" text PRIMARY KEY,
      "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "workspace_org_slug_unique"
      ON "workspaces"("organization_id", "slug");
  `);
}

/**
 * Simulates the Better-Auth databaseHooks.user.create.after callback.
 * This is the exact sequence that runs when a user signs up.
 */
async function simulateUserCreateHook(
  db: Db,
  newUser: { id: string; name: string; email: string },
): Promise<void> {
  await ensureInstanceSettings(db);
  await promoteFirstUserToAdmin(db, newUser.id);
  await createPersonalOrgAndWorkspace(db, {
    userId: newUser.id,
    userName: newUser.name,
    userEmail: newUser.email,
  });
}

describe("auth first-run integration", () => {
  let container: StartedPostgreSqlContainer;
  let db: Db;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(PG_IMAGE).start();
    db = createDb(container.getConnectionUri());
    await pushSchema(db);
    await ensureInstanceSettings(db);
  }, 60_000);

  afterAll(async () => {
    if (container) {
      await container.stop();
    }
  });

  it("first user becomes admin, registration flips to invite_only, org + workspace created", async () => {
    const userId = createUlid();
    await db.insert(user).values({
      id: userId,
      name: "Ada Lovelace",
      email: "ada@example.com",
      emailVerified: false,
      role: "user",
    });

    await simulateUserCreateHook(db, {
      id: userId,
      name: "Ada Lovelace",
      email: "ada@example.com",
    });

    // First user is promoted to admin
    const [ada] = await db.select().from(user).where(eq(user.id, userId));
    expect(ada).toBeDefined();
    expect(ada!.role).toBe("admin");

    // Registration mode is invite_only, setup completed
    const settings = await getInstanceSettings(db);
    expect(settings?.setupCompleted).toBe(true);
    expect(settings?.registrationMode).toBe("invite_only");

    // Personal org created
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.createdBy, userId));
    expect(org).toBeDefined();
    expect(org!.name).toBe("Ada Lovelace Workspace");

    // Default workspace created
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.organizationId, org!.id));
    expect(workspace).toBeDefined();
    expect(workspace!.name).toBe("Default");
    expect(workspace!.slug).toBe("default");

    // User is owner of the org
    const [membership] = await db
      .select()
      .from(member)
      .where(eq(member.userId, userId));
    expect(membership).toBeDefined();
    expect(membership!.role).toBe("owner");
  });

  it("second user is not promoted to admin, but still gets org + workspace", async () => {
    const secondUserId = createUlid();
    await db.insert(user).values({
      id: secondUserId,
      name: "Charles Babbage",
      email: "charles@example.com",
      emailVerified: false,
      role: "user",
    });

    await simulateUserCreateHook(db, {
      id: secondUserId,
      name: "Charles Babbage",
      email: "charles@example.com",
    });

    // Second user is NOT admin
    const [charles] = await db
      .select()
      .from(user)
      .where(eq(user.id, secondUserId));
    expect(charles).toBeDefined();
    expect(charles!.role).toBe("user");

    // But still gets a personal org and default workspace
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.createdBy, secondUserId));
    expect(org).toBeDefined();
    expect(org!.name).toBe("Charles Babbage Workspace");

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.organizationId, org!.id));
    expect(workspace).toBeDefined();
    expect(workspace!.name).toBe("Default");
  });

  it("registration mode remains invite_only after second signup", async () => {
    const settings = await getInstanceSettings(db);
    expect(settings?.registrationMode).toBe("invite_only");
    expect(settings?.setupCompleted).toBe(true);
  });
});
