import { DEFAULT_REGISTRATION_MODE } from "@repo/shared/constants";
import { eq } from "drizzle-orm";

import type { Db } from "./client.js";
import {
  instanceSettings,
  member,
  organization,
  user,
  workspaces,
} from "./schema.js";
import { createUlid, defaultWorkspaceSlug, slugify } from "./slug.js";

const INSTANCE_SETTINGS_ID = "instance";

// ── Instance settings singleton ────────────────────────────────────

/**
 * Ensure the singleton `instance_settings` row exists with defaults.
 * Called on app boot and in integration tests after migrations.
 */
export async function ensureInstanceSettings(db: Db): Promise<void> {
  await db
    .insert(instanceSettings)
    .values({
      id: INSTANCE_SETTINGS_ID,
      registrationMode: DEFAULT_REGISTRATION_MODE,
      setupCompleted: false,
    })
    .onConflictDoNothing({ target: instanceSettings.id });
}

export async function getInstanceSettings(db: Db) {
  const [row] = await db
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID));
  return row;
}

// ── First-run promotion ─────────────────────────────────────────────

/**
 * Atomically promote the first user to instance admin and flip
 * registration_mode to invite_only. SPEC §5.4: "the first successfully
 * registered user is promoted to instance admin".
 *
 * Must run in the same transaction as user creation. Uses a count check
 * to determine if this is the first user — if user count is 0 before
 * insert, this is the first user.
 *
 * Returns true if the user was promoted to admin.
 */
export async function promoteFirstUserToAdmin(
  db: Db,
  userId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const userCount = await tx.$count(user);
    const isFirst = userCount === 1;

    if (isFirst) {
      await tx.update(user).set({ role: "admin" }).where(eq(user.id, userId));

      await tx
        .update(instanceSettings)
        .set({
          setupCompleted: true,
          registrationMode: "invite_only",
          updatedAt: new Date(),
        })
        .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID));
    }

    return isFirst;
  });
}

// ── Personal organization + default workspace ──────────────────────

/**
 * Create a personal organization for a user and a default workspace
 * inside it. SPEC §5.4: "personal use = an auto-created personal org.
 * A default workspace is created with every org."
 *
 * Organization name is derived from the user's display name when
 * available, otherwise from the email prefix — suffixed with " Workspace"
 * (confirmed decision).
 */
export async function createPersonalOrgAndWorkspace(
  db: Db,
  params: { userId: string; userName: string; userEmail: string },
): Promise<{ organizationId: string; workspaceId: string }> {
  const { userId, userName, userEmail } = params;
  const emailPrefix = userEmail.split("@")[0]?.trim() || "user";
  const baseName = userName.trim().length > 0 ? userName.trim() : emailPrefix;
  const orgName = `${baseName} Workspace`;
  const orgSlug = await uniqueSlug(
    db,
    slugify(orgName, "personal-org"),
    "organization",
  );
  const orgId = createUlid();

  const workspaceName = "Default";
  const workspaceSlugValue = defaultWorkspaceSlug(workspaceName);
  const workspaceId = createUlid();

  await db.transaction(async (tx) => {
    await tx.insert(organization).values({
      id: orgId,
      name: orgName,
      slug: orgSlug,
      createdBy: userId,
    });

    await tx.insert(member).values({
      id: createUlid(),
      organizationId: orgId,
      userId,
      role: "owner",
    });

    await tx.insert(workspaces).values({
      id: workspaceId,
      organizationId: orgId,
      name: workspaceName,
      slug: workspaceSlugValue,
    });
  });

  return { organizationId: orgId, workspaceId };
}

/**
 * Find the default (first) workspace for a user's personal organization.
 * Used by auth flows that need to redirect after sign-in.
 */
export async function getDefaultWorkspaceForUser(
  db: Db,
  userId: string,
): Promise<{ workspaceId: string; organizationId: string } | undefined> {
  const [firstMember] = await db
    .select({
      organizationId: member.organizationId,
    })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);

  if (!firstMember) {
    return undefined;
  }

  const [firstWorkspace] = await db
    .select({
      id: workspaces.id,
      organizationId: workspaces.organizationId,
    })
    .from(workspaces)
    .where(eq(workspaces.organizationId, firstMember.organizationId))
    .limit(1);

  if (!firstWorkspace) {
    return undefined;
  }

  return {
    workspaceId: firstWorkspace.id,
    organizationId: firstWorkspace.organizationId,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Generate a slug that is unique within a table's slug column, appending
 * a short suffix if the base slug is already taken.
 */
async function uniqueSlug(
  db: Db,
  baseSlug: string,
  table: "organization" | "workspaces",
): Promise<string> {
  const tableRef = table === "organization" ? organization : workspaces;
  const slugCol = tableRef.slug;
  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    const [existing] = await db
      .select({ slug: slugCol })
      .from(tableRef)
      .where(eq(slugCol, candidate))
      .limit(1);

    if (!existing) {
      return candidate;
    }

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}
