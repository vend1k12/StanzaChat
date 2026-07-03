import { z } from "zod";

import { LLM_PROVIDERS } from "./constants.js";

/**
 * API DTO schemas (SPEC §6).
 *
 * Every API input parses through a zod schema from `packages/shared`.
 * Route Handlers never touch `req.json()` raw fields (semgrep guardrail).
 */

// ── Chat ────────────────────────────────────────────────────────────

export const createChatSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1).max(200).default("Untitled"),
  systemPrompt: z.string().optional(),
  modelConfigId: z.string().optional(),
});
export type CreateChat = z.infer<typeof createChatSchema>;

export const updateChatSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  systemPrompt: z.string().nullable().optional(),
  modelConfigId: z.string().nullable().optional(),
});
export type UpdateChat = z.infer<typeof updateChatSchema>;

export const chatMessageSchema = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * Body of `POST /api/chat` when the client uses Vercel AI SDK
 * `useChat` (SPEC §5.1 + docs/agents/architecture.md "Streaming").
 *
 * `messages` is passed through to `convertToModelMessages(...)` before
 * `streamText(...)`; the AI SDK owns UIMessage validation, so we only
 * verify the outer shape here.  `chatId` is our own ULID and must be
 * strictly a non-empty string — the route handler then re-checks
 * ownership via `getChat(scope, id)`.
 */
export const chatStreamSchema = z.object({
  chatId: z.string().min(1),
  messages: z.array(z.unknown()).min(1),
});
export type ChatStream = z.infer<typeof chatStreamSchema>;

// ── Admin providers ─────────────────────────────────────────────────

export const createProviderSchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  label: z.string().min(1).max(100),
  baseUrl: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().optional(),
  enabledModels: z.array(z.string()).default([]),
  isDefault: z.boolean().default(false),
});
export type CreateProvider = z.infer<typeof createProviderSchema>;

export const updateProviderSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().optional(),
  enabledModels: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
});
export type UpdateProvider = z.infer<typeof updateProviderSchema>;
