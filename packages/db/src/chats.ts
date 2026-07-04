import { and, eq } from "drizzle-orm";

import type { DbClient } from "./client.js";
import type { TenantScope } from "./schema.js";
import { chats, messages } from "./schema.js";
import { createUlid } from "./slug.js";

/**
 * Data-access functions for chats and messages (SPEC §5.1).
 *
 * Every function takes an explicit scope (guardrails #6): session →
 * org membership → workspace → chat owner. Cross-tenant access is P0.
 */

export async function createChat(
  db: DbClient,
  scope: TenantScope,
  input: {
    title?: string;
    systemPrompt?: string;
    modelConfigId?: string;
  },
): Promise<string> {
  const id = createUlid();
  await db.insert(chats).values({
    id,
    workspaceId: scope.workspaceId,
    userId: scope.userId,
    title: input.title ?? "Untitled",
    systemPrompt: input.systemPrompt ?? null,
    modelConfigId: input.modelConfigId ?? null,
  });
  return id;
}

export async function getChat(
  db: DbClient,
  scope: TenantScope,
  chatId: string,
) {
  const [chat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, scope.userId)));
  return chat;
}

export async function listChats(db: DbClient, scope: TenantScope) {
  return db
    .select()
    .from(chats)
    .where(eq(chats.userId, scope.userId))
    .orderBy(chats.updatedAt);
}

export async function updateChat(
  db: DbClient,
  scope: TenantScope,
  chatId: string,
  updates: {
    title?: string;
    systemPrompt?: string | null;
    modelConfigId?: string | null;
  },
): Promise<void> {
  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.title !== undefined) setValues.title = updates.title;
  if (updates.systemPrompt !== undefined)
    setValues.systemPrompt = updates.systemPrompt;
  if (updates.modelConfigId !== undefined)
    setValues.modelConfigId = updates.modelConfigId;

  await db
    .update(chats)
    .set(setValues)
    .where(and(eq(chats.id, chatId), eq(chats.userId, scope.userId)));
}

export async function deleteChat(
  db: DbClient,
  scope: TenantScope,
  chatId: string,
): Promise<void> {
  await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, scope.userId)));
}

export async function listMessages(
  db: DbClient,
  scope: TenantScope,
  chatId: string,
) {
  // Verify chat belongs to user first
  const chat = await getChat(db, scope, chatId);
  if (!chat) return undefined;

  return db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);
}

export async function saveMessage(
  db: DbClient,
  input: {
    chatId: string;
    role: "system" | "user" | "assistant";
    content: string;
    tokenUsage?: { prompt?: number; completion?: number; total?: number };
    modelId?: string;
  },
): Promise<string> {
  const id = createUlid();
  await db.insert(messages).values({
    id,
    chatId: input.chatId,
    role: input.role,
    content: input.content,
    tokenUsage: input.tokenUsage ?? null,
    modelId: input.modelId ?? null,
  });
  return id;
}
