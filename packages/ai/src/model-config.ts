import type { AuditContext, Db } from "@repo/db";
import { writeAuditLog } from "@repo/db/admin";
import { modelConfigurations, providerModels } from "@repo/db/schema";
import { createUlid } from "@repo/db/slug";
import type { LlmProvider } from "@repo/shared/constants";
import { and, asc, eq } from "drizzle-orm";

import type { EncryptedValue } from "./crypto/index.js";

/**
 * Data-access functions for `model_configurations` + `provider_models`
 * (SPEC §4.2, extended for v0.1 UX).
 *
 * Instance-level provider configurations. In v0.1 these are NOT per-org
 * (SPEC §1.2: "Per-organization provider keys (MVP is instance-level only)").
 *
 * `provider_models` holds per-model generation defaults (temperature,
 * top_p, max output tokens, system prompt, display name, enabled flag)
 * so admins can attach settings once and every chat using that model
 * inherits them without re-editing.
 */

// ── Provider input/output ───────────────────────────────────────────

export interface CreateProviderInput {
  provider: LlmProvider;
  label: string;
  baseUrl?: string;
  encryptedApiKey?: EncryptedValue;
  /** List of model ids to seed the `provider_models` table with. */
  models?: string[];
  isDefault?: boolean;
}

export interface ProviderRecord {
  id: string;
  provider: LlmProvider;
  label: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  /**
   * Legacy compatibility slice — list of `model_id` strings for models
   * with `enabled = true`. Prefer `models` for anything that needs the
   * full per-model settings (temperature, systemPrompt, …).
   */
  enabledModels: string[];
  models: ProviderModelRecord[];
  isDefault: boolean;
  enabled: boolean;
}

export interface ProviderModelRecord {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string | null;
  enabled: boolean;
  temperature: number | null;
  topP: number | null;
  maxOutputTokens: number | null;
  systemPrompt: string | null;
}

// ── Provider CRUD ───────────────────────────────────────────────────

export async function listProviders(db: Db): Promise<ProviderRecord[]> {
  const rows = await db.select().from(modelConfigurations);
  if (rows.length === 0) return [];

  const models = await db
    .select()
    .from(providerModels)
    .orderBy(asc(providerModels.createdAt));

  const modelsByProvider = new Map<string, ProviderModelRecord[]>();
  for (const m of models) {
    const list = modelsByProvider.get(m.providerId) ?? [];
    list.push(toProviderModelRecord(m));
    modelsByProvider.set(m.providerId, list);
  }

  return rows.map((row) =>
    toProviderRecord(row, modelsByProvider.get(row.id) ?? []),
  );
}

export async function getProvider(
  db: Db,
  id: string,
): Promise<ProviderRecord | undefined> {
  const [row] = await db
    .select()
    .from(modelConfigurations)
    .where(eq(modelConfigurations.id, id));
  if (!row) return undefined;
  const models = await db
    .select()
    .from(providerModels)
    .where(eq(providerModels.providerId, id))
    .orderBy(asc(providerModels.createdAt));
  return toProviderRecord(row, models.map(toProviderModelRecord));
}

/**
 * Create a new provider configuration + seed its `provider_models` rows.
 * If `isDefault` is true, all other providers are un-defaulted first.
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
  const seedModels = dedupe(input.models ?? []);

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
      isDefault: input.isDefault ?? false,
      enabled: true,
    });

    if (seedModels.length > 0) {
      await tx.insert(providerModels).values(
        seedModels.map((modelId) => ({
          id: createUlid(),
          providerId: id,
          modelId,
          enabled: true,
        })),
      );
    }

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
        seededModels: seedModels,
      },
      ip: audit.ip,
    });
  });

  return id;
}

/**
 * Update a provider configuration. Only provided fields are updated.
 * If `models` is provided, it replaces the current model list (preserving
 * per-model settings for retained model ids). Writes a `provider.update`
 * audit row in the same transaction.
 */
export async function updateProvider(
  db: Db,
  id: string,
  updates: {
    label?: string;
    baseUrl?: string;
    encryptedApiKey?: EncryptedValue;
    isDefault?: boolean;
    enabled?: boolean;
    /**
     * When set, becomes the complete list of models for this provider.
     * Retains settings for models whose `modelId` stays in the list;
     * deletes rows whose `modelId` is dropped; adds new rows with
     * defaults for newly-listed model ids.
     */
    models?: string[];
  },
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

    let modelDiff: {
      added: string[];
      removed: string[];
      kept: string[];
    } | null = null;

    if (updates.models !== undefined) {
      const wanted = dedupe(updates.models);
      const existing = await tx
        .select({ id: providerModels.id, modelId: providerModels.modelId })
        .from(providerModels)
        .where(eq(providerModels.providerId, id));
      const existingIds = new Set(existing.map((m) => m.modelId));
      const wantedIds = new Set(wanted);

      const toRemove = existing.filter((m) => !wantedIds.has(m.modelId));
      const toAdd = wanted.filter((m) => !existingIds.has(m));
      const kept = wanted.filter((m) => existingIds.has(m));

      for (const row of toRemove) {
        await tx.delete(providerModels).where(eq(providerModels.id, row.id));
      }
      if (toAdd.length > 0) {
        await tx.insert(providerModels).values(
          toAdd.map((modelId) => ({
            id: createUlid(),
            providerId: id,
            modelId,
            enabled: true,
          })),
        );
      }
      modelDiff = {
        added: toAdd,
        removed: toRemove.map((r) => r.modelId),
        kept,
      };
    }

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
          apiKeyRotated: Boolean(updates.encryptedApiKey),
          modelsDiff: modelDiff,
        },
      },
      ip: audit.ip,
    });
  });
}

/**
 * Delete a provider configuration and write the matching audit row.
 * `provider_models` rows are removed via `ON DELETE CASCADE`.
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

// ── Per-model settings ──────────────────────────────────────────────

export async function listProviderModels(
  db: Db,
  providerId: string,
): Promise<ProviderModelRecord[]> {
  const rows = await db
    .select()
    .from(providerModels)
    .where(eq(providerModels.providerId, providerId))
    .orderBy(asc(providerModels.createdAt));
  return rows.map(toProviderModelRecord);
}

export async function getProviderModel(
  db: Db,
  providerId: string,
  modelId: string,
): Promise<ProviderModelRecord | undefined> {
  const [row] = await db
    .select()
    .from(providerModels)
    .where(
      and(
        eq(providerModels.providerId, providerId),
        eq(providerModels.modelId, modelId),
      ),
    );
  return row ? toProviderModelRecord(row) : undefined;
}

export interface UpdateProviderModelInput {
  displayName?: string | null;
  enabled?: boolean;
  temperature?: number | null;
  topP?: number | null;
  maxOutputTokens?: number | null;
  systemPrompt?: string | null;
}

/**
 * Update the per-model settings row identified by `(providerId, modelId)`.
 * Writes a `model.update` audit row in the same transaction so the audit
 * viewer surfaces per-model tweaks alongside provider mutations.
 */
export async function updateProviderModel(
  db: Db,
  providerId: string,
  modelId: string,
  updates: UpdateProviderModelInput,
  audit: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.displayName !== undefined)
      setValues.displayName = updates.displayName;
    if (updates.enabled !== undefined) setValues.enabled = updates.enabled;
    if (updates.temperature !== undefined)
      setValues.temperature = numberOrNullToText(updates.temperature);
    if (updates.topP !== undefined)
      setValues.topP = numberOrNullToText(updates.topP);
    if (updates.maxOutputTokens !== undefined)
      setValues.maxOutputTokens = updates.maxOutputTokens;
    if (updates.systemPrompt !== undefined)
      setValues.systemPrompt = updates.systemPrompt;

    await tx
      .update(providerModels)
      .set(setValues)
      .where(
        and(
          eq(providerModels.providerId, providerId),
          eq(providerModels.modelId, modelId),
        ),
      );

    await writeAuditLog(tx, {
      actorUserId: audit.actorUserId,
      action: "model.update",
      targetType: "provider_model",
      targetId: `${providerId}/${modelId}`,
      metadata: { fields: updates },
      ip: audit.ip,
    });
  });
}

// ── Internal helpers used by chat streaming ─────────────────────────

/**
 * Get the default provider row (raw DB shape, with encrypted key).
 * Internal — only called server-side within a request.
 */
export async function getDefaultProvider(db: Db) {
  const [row] = await db
    .select()
    .from(modelConfigurations)
    .where(eq(modelConfigurations.isDefault, true));
  return row;
}

export async function getProviderById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(modelConfigurations)
    .where(eq(modelConfigurations.id, id));
  return row;
}

// ── Row → record mappers ────────────────────────────────────────────

/**
 * Convert a DB row + its per-model settings to a ProviderRecord.
 * The API never returns encrypted keys to the client (guardrails #3).
 */
function toProviderRecord(
  row: typeof modelConfigurations.$inferSelect,
  models: ProviderModelRecord[],
): ProviderRecord {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    baseUrl: row.baseUrl,
    hasApiKey: row.encryptedApiKey !== null,
    enabledModels: models.filter((m) => m.enabled).map((m) => m.modelId),
    models,
    isDefault: row.isDefault,
    enabled: row.enabled,
  };
}

function toProviderModelRecord(
  row: typeof providerModels.$inferSelect,
): ProviderModelRecord {
  return {
    id: row.id,
    providerId: row.providerId,
    modelId: row.modelId,
    displayName: row.displayName,
    enabled: row.enabled,
    temperature: textToNumberOrNull(row.temperature),
    topP: textToNumberOrNull(row.topP),
    maxOutputTokens: row.maxOutputTokens,
    systemPrompt: row.systemPrompt,
  };
}

function textToNumberOrNull(value: string | null): number | null {
  if (value === null || value === "") return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function numberOrNullToText(value: number | null): string | null {
  return value === null ? null : String(value);
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.filter((s) => s.length > 0))];
}
