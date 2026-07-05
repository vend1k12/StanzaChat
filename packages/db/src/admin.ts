import type { AuditAction, RegistrationMode } from "@repo/shared/constants";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { DbClient } from "./client.js";
import { auditLogs, instanceSettings, user as userTable } from "./schema.js";
import { createUlid } from "./slug.js";

/**
 * Admin data-access helpers (SPEC §5.5 / §5.6).
 *
 * Every mutating admin action MUST write an `audit_logs` row in the
 * SAME transaction as its state change (SPEC §5.5: "in the same
 * transaction"; guardrails #9: audit is append-only). The functions
 * here therefore accept a `DbClient` so a caller can compose them
 * inside a `db.transaction(async (tx) => ...)` block.
 *
 * Route Handlers stay thin; they call `requireInstanceAdmin` and then
 * hand the tx to these helpers.
 */

const INSTANCE_SETTINGS_ID = "instance";

// ── Audit log writer ────────────────────────────────────────────────

/**
 * Payload accepted by every write-side admin helper. The route handler
 * gathers `actorUserId` from the session and `ip` from the request; the
 * helper attaches the correct `action`/`targetType`/`targetId` and calls
 * `writeAuditLog` inside its own transaction.
 */
export interface AuditContext {
  actorUserId: string;
  ip: string | null;
}

/**
 * Append-only insert into `audit_logs`. Never surface `AuditContext.ip`
 * outside the audit path — it is captured from the request headers by
 * the route helper and used only here.
 */
export async function writeAuditLog(
  db: DbClient,
  entry: {
    actorUserId: string | null;
    action: AuditAction;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown> | null;
    ip?: string | null;
  },
): Promise<string> {
  const id = createUlid();
  await db.insert(auditLogs).values({
    id,
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
    ip: entry.ip ?? null,
  });
  return id;
}

// ── Audit log reader ────────────────────────────────────────────────

export interface AuditLogRecord {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: Date;
}

export interface ListAuditLogsFilter {
  actorUserId?: string;
  action?: AuditAction;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Read audit rows newest-first with optional filters and pagination.
 * Joins `user` so the viewer can render the actor's email without a
 * second round-trip.
 */
export async function listAuditLogs(
  db: DbClient,
  filter: ListAuditLogsFilter = {},
): Promise<{ rows: AuditLogRecord[]; total: number }> {
  const clauses = [];
  if (filter.actorUserId)
    clauses.push(eq(auditLogs.actorUserId, filter.actorUserId));
  if (filter.action) clauses.push(eq(auditLogs.action, filter.action));
  if (filter.since) clauses.push(gte(auditLogs.createdAt, filter.since));
  if (filter.until) clauses.push(lte(auditLogs.createdAt, filter.until));
  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const rows = await db
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      actorEmail: userTable.email,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      metadata: auditLogs.metadata,
      ip: auditLogs.ip,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(userTable, eq(userTable.id, auditLogs.actorUserId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where);

  return { rows, total: countRow?.count ?? 0 };
}

// ── Users (admin view) ──────────────────────────────────────────────

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  banned: boolean;
  banReason: string | null;
  createdAt: Date;
}

export async function listUsers(db: DbClient): Promise<AdminUserRecord[]> {
  const rows = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      role: userTable.role,
      banned: userTable.banned,
      banReason: userTable.banReason,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .orderBy(desc(userTable.createdAt));
  return rows;
}

export async function getUserById(
  db: DbClient,
  id: string,
): Promise<AdminUserRecord | undefined> {
  const [row] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      role: userTable.role,
      banned: userTable.banned,
      banReason: userTable.banReason,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(eq(userTable.id, id));
  return row;
}

/**
 * Update a user's instance role and/or ban status, and write the
 * matching audit row in the same transaction (SPEC §5.5).
 *
 * The audit `action` is picked from the delta: `user.role_change` when
 * `role` changes, `user.ban`/`user.unban` when `banned` flips. If both
 * change, two audit rows are written.
 */
export async function updateUserAdminState(
  db: DbClient,
  targetUserId: string,
  updates: {
    role?: "admin" | "user";
    banned?: boolean;
    banReason?: string | null;
  },
  audit: AuditContext,
): Promise<{ roleChanged: boolean; banChanged: boolean }> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        role: userTable.role,
        banned: userTable.banned,
      })
      .from(userTable)
      .where(eq(userTable.id, targetUserId));

    if (!current) {
      throw new Error(`user not found: ${targetUserId}`);
    }

    // ── Preflight: last-admin guard (before touching state) ───────
    const willDemoteAdmin =
      updates.role !== undefined &&
      updates.role !== current.role &&
      current.role === "admin" &&
      updates.role === "user";
    if (willDemoteAdmin) {
      const [countRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(userTable)
        .where(eq(userTable.role, "admin"));
      if ((countRow?.count ?? 0) <= 1) {
        throw new Error("LAST_ADMIN");
      }
    }

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.role !== undefined) setValues.role = updates.role;
    if (updates.banned !== undefined) {
      setValues.banned = updates.banned;
      // Clear ban reason on unban; accept explicit reason on ban.
      setValues.banReason = updates.banned ? (updates.banReason ?? null) : null;
      setValues.banExpires = null;
    }

    await tx
      .update(userTable)
      .set(setValues)
      .where(eq(userTable.id, targetUserId));

    const roleChanged =
      updates.role !== undefined && updates.role !== current.role;
    if (roleChanged) {
      await writeAuditLog(tx, {
        actorUserId: audit.actorUserId,
        action: "user.role_change",
        targetType: "user",
        targetId: targetUserId,
        metadata: { from: current.role, to: updates.role },
        ip: audit.ip,
      });
    }

    const banChanged =
      updates.banned !== undefined && updates.banned !== current.banned;
    if (banChanged) {
      await writeAuditLog(tx, {
        actorUserId: audit.actorUserId,
        action: updates.banned ? "user.ban" : "user.unban",
        targetType: "user",
        targetId: targetUserId,
        metadata: updates.banned ? { reason: updates.banReason ?? null } : null,
        ip: audit.ip,
      });
    }

    return { roleChanged, banChanged };
  });
}

// ── Instance settings ───────────────────────────────────────────────

export async function updateInstanceSettings(
  db: DbClient,
  updates: { registrationMode?: RegistrationMode },
  audit: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(instanceSettings)
      .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID));

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.registrationMode !== undefined)
      setValues.registrationMode = updates.registrationMode;

    await tx
      .update(instanceSettings)
      .set(setValues)
      .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID));

    await writeAuditLog(tx, {
      actorUserId: audit.actorUserId,
      action: "settings.update",
      targetType: "instance_settings",
      targetId: INSTANCE_SETTINGS_ID,
      metadata: {
        before: current ? { registrationMode: current.registrationMode } : null,
        after: {
          registrationMode:
            updates.registrationMode ?? current?.registrationMode ?? null,
        },
      },
      ip: audit.ip,
    });
  });
}
