import { z } from "zod";

import {
  AUDIT_ACTIONS,
  INSTANCE_ROLES,
  LLM_PROVIDERS,
  REGISTRATION_MODES,
} from "./constants.js";

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
  /**
   * Optional per-turn override — the picker in the header can send the
   * currently-selected model id. Falls back to the chat's persisted
   * `modelConfigId`, then to the instance default provider.
   */
  modelId: z.string().min(1).nullable().optional(),
});
export type ChatStream = z.infer<typeof chatStreamSchema>;

// ── Admin providers ─────────────────────────────────────────────────

export const createProviderSchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  label: z.string().min(1).max(100),
  baseUrl: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().optional(),
  models: z.array(z.string().min(1)).default([]),
  isDefault: z.boolean().default(false),
});
export type CreateProvider = z.infer<typeof createProviderSchema>;

export const updateProviderSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().optional(),
  models: z.array(z.string().min(1)).optional(),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
});
export type UpdateProvider = z.infer<typeof updateProviderSchema>;

/**
 * Discover models against the provider's OpenAI-compatible endpoint.
 * Used both from the Add Provider dialog (`baseUrl`/`apiKey` supplied
 * inline, no `id` yet) and from the Edit dialog (`id` in the URL, key
 * looked up server-side).
 */
export const discoverModelsSchema = z
  .object({
    provider: z.enum(LLM_PROVIDERS),
    baseUrl: z.string().url().optional().or(z.literal("")),
    apiKey: z.string().optional(),
  })
  .refine(
    (v) =>
      v.provider === "openai" || v.provider === "ollama" || Boolean(v.baseUrl),
    { message: "Base URL is required for openai-compatible providers." },
  );
export type DiscoverModels = z.infer<typeof discoverModelsSchema>;

/**
 * Per-model settings update (SPEC §4.2 extension). `null` clears an
 * override; `undefined` (field absent) leaves it untouched.
 */
export const updateProviderModelSchema = z.object({
  displayName: z.string().max(200).nullable().optional(),
  enabled: z.boolean().optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  topP: z.number().min(0).max(1).nullable().optional(),
  maxOutputTokens: z
    .number()
    .int()
    .positive()
    .max(1_000_000)
    .nullable()
    .optional(),
  systemPrompt: z.string().max(20_000).nullable().optional(),
});
export type UpdateProviderModel = z.infer<typeof updateProviderModelSchema>;

// ── Admin users ─────────────────────────────────────────────────────

export const updateUserSchema = z
  .object({
    role: z.enum(INSTANCE_ROLES).optional(),
    banned: z.boolean().optional(),
    banReason: z.string().max(500).nullable().optional(),
  })
  .refine((v) => v.role !== undefined || v.banned !== undefined, {
    message: "at least one of `role` or `banned` must be provided",
  });
export type UpdateUser = z.infer<typeof updateUserSchema>;

// ── Admin settings ──────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  registrationMode: z.enum(REGISTRATION_MODES),
});
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

// ── Admin audit log query ───────────────────────────────────────────

/**
 * Query-string schema for `GET /api/admin/audit-logs`. Accepts strings
 * because they arrive from `URLSearchParams`; coerces / validates once.
 */
export const auditLogsQuerySchema = z.object({
  actorUserId: z.string().min(1).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
