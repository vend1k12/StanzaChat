import { persistAssistantTurn, resolveChatModel } from "@repo/ai";
import { getChat, saveMessage } from "@repo/db";
import {
  chatStreamSchema,
  NotFoundError,
  parseEnv,
  parseWithSchema,
  ValidationError,
} from "@repo/shared";
import type { UIMessage } from "ai";
import { convertToModelMessages, streamText } from "ai";

import { wrapRoute } from "@/lib/http";
import { chatLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requireSessionScopeOrThrow } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `POST /api/chat` — SPEC §5.1.
 *
 * Body shape (see `chatStreamSchema`): `{ chatId, messages: UIMessage[] }`.
 * The client is `@ai-sdk/react`'s `useChat`, which forwards its full
 * UI-messages array on every send; we hand it to
 * `convertToModelMessages(...)` before `streamText(...)`.
 *
 * The handler stays thin (architecture.md "A Route Handler longer than
 * ~40 lines is a smell"): validation → auth → chat lookup → resolve model
 * → stream. Persistence and model resolution live in `packages/ai`.
 *
 * Persistence: `persistAssistantTurn` runs in `streamText`'s `onEnd`,
 * which the AI SDK guarantees fires even on client disconnect (SPEC §5.1
 * requirement).
 *
 * Model resolution: in production, the provider config is looked up, the
 * API key is decrypted for the duration of the request only (SPEC §7,
 * guardrails #3), and the Vercel AI SDK provider is instantiated inside
 * `resolveChatModel`. When `E2E_MOCK_PROVIDER=1` (rejected in production
 * by the env schema), the offline mock model is returned instead so
 * Playwright can round-trip this route without provider keys.
 */
export async function POST(request: Request) {
  return wrapRoute(async () => {
    // Session first — the rate-limit key is the userId so the limit is
    // per-authenticated-user, not per-IP (SPEC §7).
    const ctx = await requireSessionScopeOrThrow();
    const gate = chatLimiter.consume(ctx.session.user.id);
    if (!gate.ok) return rateLimitResponse(gate);

    const { chatId, messages, modelId } = parseWithSchema(
      chatStreamSchema,
      await request.json(),
    );
    const uiMessages = messages as UIMessage[];

    const chat = await getChat(ctx.db, ctx.scope, chatId);
    if (!chat) {
      throw new NotFoundError("Chat", chatId);
    }

    const lastUser = findLastUserMessage(uiMessages);
    if (!lastUser) {
      throw new ValidationError("No user message to send");
    }
    await saveMessage(ctx.db, {
      chatId,
      role: "user",
      content: uiMessageText(lastUser),
    });

    const env = parseEnv();
    const resolution = await resolveChatModel({
      db: ctx.db,
      chatModelConfigId: chat.modelConfigId,
      modelId: modelId ?? null,
      env,
    });
    // `resolution.modelInstance` is already typed `LanguageModel` by
    // `resolveChatModel` — no cast needed here (see project rule
    // ts-no-inline-cast-access).
    const model = resolution.modelInstance;

    // Compose the effective system prompt: chat-level prompt wins over
    // the model default so a per-chat override always applies. Vercel AI
    // SDK's `instructions` prepends a system message to the stream.
    const instructions =
      chat.systemPrompt ?? resolution.settings.systemPrompt ?? undefined;

    const modelMessages = await convertToModelMessages(uiMessages);
    // Only pass per-model settings when they are configured — the AI
    // SDK examines options via `key in opts` in some places, and
    // shipping `temperature: undefined` observably diverges from
    // omitting the key on certain provider adapters.
    const { temperature, topP, maxOutputTokens } = resolution.settings;
    const result = streamText({
      model,
      messages: modelMessages,
      instructions,
      ...(temperature !== null ? { temperature } : {}),
      ...(topP !== null ? { topP } : {}),
      ...(maxOutputTokens !== null ? { maxOutputTokens } : {}),
      onEnd: async ({ text, usage }) =>
        persistAssistantTurn({
          db: ctx.db,
          scope: ctx.scope,
          chatId,
          text,
          usage,
          modelId: resolution.modelId || (chat.modelConfigId ?? undefined),
        }),
    });

    return result.toUIMessageStreamResponse();
  });
}

/**
 * Plain-text extraction from a UIMessage for user-message persistence.
 * The AI SDK's public `UIMessage` union is loose (parts is `Array<UIPart>`
 * where each part is a discriminated union), so we walk parts and pick
 * only the `text` variant — anything else (tool calls, images) is
 * ignored for the persisted `content` column.
 */
function uiMessageText(message: UIMessage): string {
  if (!("parts" in message) || !Array.isArray(message.parts)) return "";
  let text = "";
  for (const part of message.parts) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
    ) {
      text += part.text;
    }
  }
  return text;
}

/**
 * Reverse-scan for the most recent user-role message. Kept as a named
 * helper because `Array.findLast` requires an ES2023 lib target and the
 * plain reversed loop trips `eslint-plugin-security`'s
 * object-injection heuristic on numeric-index access.
 */
function findLastUserMessage(messages: UIMessage[]): UIMessage | undefined {
  for (const m of [...messages].reverse()) {
    if (m.role === "user") return m;
  }
  return undefined;
}
