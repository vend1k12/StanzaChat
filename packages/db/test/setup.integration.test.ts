import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";

import { createDb, type Db } from "../src/client.js";
import { member, organization, user, workspaces } from "../src/schema.js";
import {
  createPersonalOrgAndWorkspace,
  ensureInstanceSettings,
  getInstanceSettings,
  promoteFirstUserToAdmin,
} from "../src/setup.js";
import { createUlid } from "../src/slug.js";

/**
 * Integration tests for Phase 1 data/auth core (SPEC §10).
 *
 * Uses Testcontainers with the pgvector PostgreSQL 17 image so the same
 * base image is exercised from day one (SPEC §2: "pgvector image from
 * day one so v0.2 RAG needs no migration of the base image").
 *
 * These tests require Docker on the runner. They are picked up by the
 * CI `integration` job which looks for `*.integration.test.ts` files in
 * `packages/db` and `packages/auth`.
 */

const PG_IMAGE = "pgvector/pgvector:pg17";

/**
 * Push schema to the test database. In production, drizzle-kit generates
 * SQL migrations that are applied via `db:migrate`. In integration tests
 * we execute the DDL directly to avoid coupling to the migration CLI.
 */
async function pushSchema(db: Db): Promise<void> {
  await db.execute(`
    CREATE EXTENSION IF NOT EXISTS vector;

    DO $$ BEGIN CREATE TYPE instance_role AS ENUM ('admin', 'user');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE registration_mode AS ENUM ('open', 'invite_only', 'closed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE message_role AS ENUM ('system', 'user', 'assistant');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE artifact_type AS ENUM ('html', 'svg', 'markdown');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE llm_provider AS ENUM ('openai', 'anthropic', 'google', 'openai-compatible', 'ollama');
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

    CREATE TABLE IF NOT EXISTS "session" (
      "id" text PRIMARY KEY,
      "expires_at" timestamp NOT NULL,
      "token" text NOT NULL UNIQUE,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "ip_address" text,
      "user_agent" text,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "account" (
      "id" text PRIMARY KEY,
      "account_id" text NOT NULL,
      "provider_id" text NOT NULL,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "access_token" text,
      "refresh_token" text,
      "access_token_expires_at" timestamp,
      "refresh_token_expires_at" timestamp,
      "scope" text,
      "id_token" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "verification" (
      "id" text PRIMARY KEY,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expires_at" timestamp NOT NULL,
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

    CREATE TABLE IF NOT EXISTS "invitation" (
      "id" text PRIMARY KEY,
      "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
      "email" text NOT NULL,
      "role" org_role NOT NULL DEFAULT 'member',
      "status" text NOT NULL DEFAULT 'pending',
      "expires_at" timestamp NOT NULL,
      "inviter_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );

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

describe("setup integration", () => {
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

  it("instance_settings singleton has default registration mode", async () => {
    const settings = await getInstanceSettings(db);
    expect(settings).toBeDefined();
    expect(settings?.registrationMode).toBe("open");
    expect(settings?.setupCompleted).toBe(false);
  });

  it("promotes the first user to admin and flips registration to invite_only", async () => {
    const userId = createUlid();
    await db.insert(user).values({
      id: userId,
      name: "Ada Lovelace",
      email: "ada@example.com",
      emailVerified: false,
      role: "user",
    });

    const wasPromoted = await promoteFirstUserToAdmin(db, userId);
    expect(wasPromoted).toBe(true);

    const [promoted] = await db.select().from(user).where(eq(user.id, userId));
    expect(promoted).toBeDefined();
    expect(promoted!.role).toBe("admin");

    const settings = await getInstanceSettings(db);
    expect(settings?.setupCompleted).toBe(true);
    expect(settings?.registrationMode).toBe("invite_only");
  });

  it("does not promote the second user to admin", async () => {
    const secondUserId = createUlid();
    await db.insert(user).values({
      id: secondUserId,
      name: "Second User",
      email: "second@example.com",
      emailVerified: false,
      role: "user",
    });

    const wasPromoted = await promoteFirstUserToAdmin(db, secondUserId);
    expect(wasPromoted).toBe(false);

    const [second] = await db
      .select()
      .from(user)
      .where(eq(user.id, secondUserId));
    expect(second).toBeDefined();
    expect(second!.role).toBe("user");
  });

  it("creates a personal org and default workspace for a user", async () => {
    const userId = createUlid();
    await db.insert(user).values({
      id: userId,
      name: "Grace Hopper",
      email: "grace@example.com",
      emailVerified: false,
    });

    const result = await createPersonalOrgAndWorkspace(db, {
      userId,
      userName: "Grace Hopper",
      userEmail: "grace@example.com",
    });

    expect(result.organizationId).toBeDefined();
    expect(result.workspaceId).toBeDefined();

    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, result.organizationId));
    expect(org).toBeDefined();
    expect(org!.name).toBe("Grace Hopper Workspace");
    expect(org!.slug).toBeDefined();

    const [membership] = await db
      .select()
      .from(member)
      .where(eq(member.userId, userId));
    expect(membership).toBeDefined();
    expect(membership!.role).toBe("owner");

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, result.workspaceId));
    expect(workspace).toBeDefined();
    expect(workspace!.name).toBe("Default");
    expect(workspace!.slug).toBe("default");
  });

  it("derives org name from email prefix when userName is empty", async () => {
    const userId = createUlid();
    await db.insert(user).values({
      id: userId,
      name: "",
      email: "bob@example.com",
      emailVerified: false,
    });

    const result = await createPersonalOrgAndWorkspace(db, {
      userId,
      userName: "",
      userEmail: "bob@example.com",
    });

    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, result.organizationId));
    expect(org).toBeDefined();
    expect(org!.name).toBe("bob Workspace");
  });

  it("appends a suffix on slug collisions", async () => {
    const userId1 = createUlid();
    await db.insert(user).values({
      id: userId1,
      name: "Same Name",
      email: "same1@example.com",
      emailVerified: false,
    });
    await createPersonalOrgAndWorkspace(db, {
      userId: userId1,
      userName: "Same Name",
      userEmail: "same1@example.com",
    });

    const userId2 = createUlid();
    await db.insert(user).values({
      id: userId2,
      name: "Same Name",
      email: "same2@example.com",
      emailVerified: false,
    });
    const result2 = await createPersonalOrgAndWorkspace(db, {
      userId: userId2,
      userName: "Same Name",
      userEmail: "same2@example.com",
    });

    const [org2] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, result2.organizationId));
    expect(org2).toBeDefined();
    expect(org2!.slug).toMatch(/^same-name-workspace-2$/);
  });
});
