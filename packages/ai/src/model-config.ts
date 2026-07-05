import type { AuditContext, Db } from "@repo/db";
import { writeAuditLog } from "@repo/db/admin";
import { modelConfigurations } from "@repo/db/schema";
import { createUlid } from "@repo/db/slug";
import type { LlmProvider } from "@repo/shared/constants";
import { eq } from "drizzle-orm";

import type { EncryptedValue } from "./crypto/index.js";

/**
 * Data-access functions for `model_configurations` (SPEC §4.2).
 *
 * Instance-level provider configurations. In v0.1 these are NOT per-org
 * (SPEC §1.2: "Per-organization provider keys (MVP is instance-level only)").
 *
 * The `scope` parameter is accepted per guardrails #6 but in v0.1 only
 * the instance admin can manage these, so the scope is used for audit
 * logging, not for query filtering.
 */

export interface CreateProviderInput {
  provider: LlmProvider;
  label: string;
  baseUrl?: string;
  encryptedApiKey?: EncryptedValue;
  enabledModels: string[];
  isDefault?: boolean;
}

export interface ProviderRecord {
  id: string;
  provider: LlmProvider;
  label: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  enabledModels: string[];
  isDefault: boolean;
  enabled: boolean;
}

/**
 * List all provider configurations. Instance admin only — the caller
 * is responsible for permission checks.
 */
export async function listProviders(db: Db): Promise<ProviderRecord[]> {
  const rows = await db.select().from(modelConfigurations);
  return rows.map(toProviderRecord);
}

/**
 * Get a single provider configuration by ID.
 */
export async function getProvider(
  db: Db,
  id: string,
): Promise<ProviderRecord | undefined> {
  const [row] = await db
    .select()
    .from(modelConfigurations)
    .where(eq(modelConfigurations.id, id));
  return row ? toProviderRecord(row) : undefined;
}

/**
 * Create a new provider configuration. If `isDefault` is true, all other
 * providers are un-defaulted first.
 *
 * SPEC §5.5 requires the matching `audit_logs` row to be written in the
 * same transaction; callers must pass an `AuditContext`. The API key is
 * never surfaced in the audit metadata — only its fingerprint presence.
 */
export async function createProvider(
  db: Db,
  input: CreateProviderInput,
  audit: AuditContext,
): Promise<string> {
  const id = createUlid();

  await db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx
        .update(modelConfigurations)
        .set({ isDefault: false })
        .where(eq(modelConfigurations.isDefault, true));
    }

    await tx.insert(modelConfigurations).values({
      id,
      provider: input.provider,
      label: input.label,
      baseUrl: input.baseUrl ?? null,
      encryptedApiKey: input.encryptedApiKey?.ciphertext ?? null,
      keyIv: input.encryptedApiKey?.iv ?? null,
      keyTag: input.encryptedApiKey?.authTag ?? null,
      enabledModels: input.enabledModels,
      isDefault: input.isDefault ?? false,
      enabled: true,
    });

    await writeAuditLog(tx, {
      actorUserId: audit.actorUserId,
      action: "provider.create",
      targetType: "model_configuration",
      targetId: id,
      metadata: {
        provider: input.provider,
        label: input.label,
        hasApiKey: Boolean(input.encryptedApiKey),
        isDefault: input.isDefault ?? false,
        enabledModels: input.enabledModels,
      },
      ip: audit.ip,
    });
  });

  return id;
}

/**
 * Update a provider configuration. Only provided fields are updated.
 * Writes a `provider.update` audit row in the same transaction.
 */
export async function updateProvider(
  db: Db,
  id: string,
  updates: Partial<CreateProviderInput> & { enabled?: boolean },
  audit: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    if (updates.isDefault) {
      await tx
        .update(modelConfigurations)
        .set({ isDefault: false })
        .where(eq(modelConfigurations.isDefault, true));
    }

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.label !== undefined) setValues.label = updates.label;
    if (updates.baseUrl !== undefined) setValues.baseUrl = updates.baseUrl;
    if (updates.enabledModels !== undefined)
      setValues.enabledModels = updates.enabledModels;
    if (updates.isDefault !== undefined)
      setValues.isDefault = updates.isDefault;
    if (updates.enabled !== undefined) setValues.enabled = updates.enabled;
    if (updates.encryptedApiKey) {
      setValues.encryptedApiKey = updates.encryptedApiKey.ciphertext;
      setValues.keyIv = updates.encryptedApiKey.iv;
      setValues.keyTag = updates.encryptedApiKey.authTag;
    }

    await tx
      .update(modelConfigurations)
      .set(setValues)
      .where(eq(modelConfigurations.id, id));

    await writeAuditLog(tx, {
      actorUserId: audit.actorUserId,
      action: "provider.update",
      targetType: "model_configuration",
      targetId: id,
      metadata: {
        fields: {
          label: updates.label,
          baseUrl: updates.baseUrl,
          isDefault: updates.isDefault,
          enabled: updates.enabled,
          enabledModels: updates.enabledModels,
          apiKeyRotated: Boolean(updates.encryptedApiKey),
        },
      },
      ip: audit.ip,
    });
  });
}

/**
 * Delete a provider configuration and write the matching audit row.
 */
export async function deleteProvider(
  db: Db,
  id: string,
  audit: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(modelConfigurations).where(eq(modelConfigurations.id, id));
    await writeAuditLog(tx, {
      actorUserId: audit.actorUserId,
      action: "provider.delete",
      targetType: "model_configuration",
      targetId: id,
      ip: audit.ip,
    });
  });
}

/**
 * Get the default provider configuration with decrypted key.
 * Internal — only called server-side within a request.
 */
export async function getDefaultProvider(db: Db) {
  const [row] = await db
    .select()
    .from(modelConfigurations)
    .where(eq(modelConfigurations.isDefault, true));
  return row;
}

/**
 * Get the provider for a specific chat's model config.
 */
export async function getProviderById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(modelConfigurations)
    .where(eq(modelConfigurations.id, id));
  return row;
}

/**
 * Convert a DB row to a ProviderRecord, omitting the encrypted key fields.
 * The API never returns encrypted keys to the client (guardrails #3).
 */
function toProviderRecord(
  row: typeof modelConfigurations.$inferSelect,
): ProviderRecord {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    baseUrl: row.baseUrl,
    hasApiKey: row.encryptedApiKey !== null,
    enabledModels: row.enabledModels,
    isDefault: row.isDefault,
    enabled: row.enabled,
  };
}
