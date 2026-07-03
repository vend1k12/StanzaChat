import {
  AesGcmKeyStore,
  type ArtifactEvent,
  createMockModel,
  getProviderById,
  parseComplete,
  resolveModel,
} from "@repo/ai";
import {
  createArtifactVersion,
  type Db,
  getChat,
  saveMessage,
  type TenantScope,
  upsertArtifact,
} from "@repo/db";
import { chatStreamSchema, type Env, parseEnv } from "@repo/shared";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { requireSessionScope } from "@/lib/session";

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
 * Persistence (guardrails: architecture.md "Streaming"):
 * - The *last* user message is written to `messages` before the LLM call.
 * - The assistant reply is persisted in `onEnd` alongside token usage.
 * - The same `onEnd` runs `parseComplete(text)` and upserts every
 *   `<artifact ...>...</artifact>` block into `artifacts` +
 *   `artifact_versions` (Phase 3 / SPEC §5.2).
 *
 * Model resolution:
 * - When `E2E_MOCK_PROVIDER=1` (only allowed outside `NODE_ENV=production`;
 *   see `packages/shared/src/env.ts` refine), the mock `LanguageModelV4`
 *   from `@repo/ai/mock-provider` is used so Playwright can round-trip
 *   this route offline (Phase 3 done-when).
 * - Otherwise the provider config is looked up, the API key is decrypted
 *   for the duration of the request only (SPEC §7, guardrails #3), and
 *   the Vercel AI SDK provider is instantiated via `resolveModel(...)`.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = chatStreamSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "validation_error", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const { chatId, messages } = parsed.data;
  const uiMessages = messages as UIMessage[];

  const ctx = await requireSessionScope();
  if (ctx instanceof Response) return ctx;

  const chat = await getChat(ctx.db, ctx.scope, chatId);
  if (!chat) {
    return Response.json(
      { error: { code: "not_found", message: "Chat not found" } },
      { status: 404 },
    );
  }

  // Persist the freshly-submitted user message before dispatching to the
  // LLM (SPEC §5.1). We identify it as the last user-role message in the
  // client-supplied array; useChat appends it before firing the request.
  const lastUser = [...uiMessages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return Response.json(
      {
        error: {
          code: "validation_error",
          message: "No user message to send",
        },
      },
      { status: 400 },
    );
  }
  await saveMessage(ctx.db, {
    chatId,
    role: "user",
    content: extractUiMessageText(lastUser),
  });

  const env = parseEnv();
  const modelOrError = await resolveModelInstance(
    ctx.db,
    chat.modelConfigId,
    env,
  );
  if (modelOrError instanceof Response) return modelOrError;

  const modelMessages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model: modelOrError,
    messages: modelMessages,
    instructions: chat.systemPrompt ?? undefined,
    onEnd: async ({ text, usage }) => {
      await persistAssistantTurn(ctx.db, ctx.scope, {
        chatId,
        text,
        usage,
        modelId: chat.modelConfigId ?? undefined,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Best-effort text extraction from a UIMessage. Older `useChat` shapes
 * expose `content: string`; v7 exposes `parts: Array<{ type: "text", text }>`.
 * We check both without assuming either.
 */
function extractUiMessageText(message: UIMessage): string {
  const parts = (message as { parts?: unknown }).parts;
  if (Array.isArray(parts)) {
    return parts
      .map((p) => {
        if (typeof p === "object" && p !== null && "type" in p) {
          const rec = p as { type: unknown; text?: unknown };
          if (rec.type === "text" && typeof rec.text === "string") {
            return rec.text;
          }
        }
        return "";
      })
      .join("");
  }
  const legacy = (message as { content?: unknown }).content;
  return typeof legacy === "string" ? legacy : "";
}

async function resolveModelInstance(
  db: Db,
  modelConfigId: string | null,
  env: Env,
): Promise<Parameters<typeof streamText>[0]["model"] | Response> {
  // E2E / offline path — bypasses the DB provider config entirely so the
  // mock also works for a brand-new chat that hasn't picked a model yet.
  if (env.E2E_MOCK_PROVIDER === "1") {
    return createMockModel();
  }

  if (!modelConfigId) {
    return Response.json(
      {
        error: {
          code: "validation_error",
          message: "No model configured for this chat",
        },
      },
      { status: 400 },
    );
  }

  const providerConfig = await getProviderById(db, modelConfigId);
  if (!providerConfig || !providerConfig.enabled) {
    return Response.json(
      {
        error: { code: "not_found", message: "Provider not found or disabled" },
      },
      { status: 404 },
    );
  }

  let apiKey = "";
  if (providerConfig.encryptedApiKey) {
    const keyStore = new AesGcmKeyStore(env.ENCRYPTION_MASTER_KEY);
    apiKey = await keyStore.decrypt({
      ciphertext: providerConfig.encryptedApiKey,
      iv: providerConfig.keyIv!,
      authTag: providerConfig.keyTag!,
    });
  }

  const { modelInstance } = resolveModel({
    provider: providerConfig.provider,
    baseUrl: providerConfig.baseUrl ?? undefined,
    apiKey,
    modelId: providerConfig.enabledModels[0] ?? "",
  });

  return modelInstance as Parameters<typeof streamText>[0]["model"];
}

/**
 * `onEnd` handler — persists the assistant message and every artifact
 * emitted inside it (SPEC §5.2, docs/agents/architecture.md).
 *
 * The AI SDK guarantees `onEnd` runs even if the client disconnects (a
 * SPEC §5.1 requirement), so this is the safe place to write both rows.
 */
async function persistAssistantTurn(
  db: Db,
  scope: TenantScope,
  input: {
    chatId: string;
    text: string;
    usage:
      | {
          inputTokens?: number;
          outputTokens?: number;
        }
      | undefined;
    modelId: string | undefined;
  },
): Promise<void> {
  const messageId = await saveMessage(db, {
    chatId: input.chatId,
    role: "assistant",
    content: input.text,
    tokenUsage: {
      prompt: input.usage?.inputTokens,
      completion: input.usage?.outputTokens,
      total: (input.usage?.inputTokens ?? 0) + (input.usage?.outputTokens ?? 0),
    },
    modelId: input.modelId,
  });

  const events = parseComplete(input.text);
  const artifactsInMessage = groupArtifactsByIdentifier(events);
  for (const artifact of artifactsInMessage) {
    const artifactId = await upsertArtifact(db, scope, {
      chatId: input.chatId,
      identifier: artifact.meta.identifier,
      type: artifact.meta.type,
      title: artifact.meta.title || null,
    });
    await createArtifactVersion(db, {
      artifactId,
      content: artifact.content,
      messageId,
      incomplete: artifact.incomplete,
    });
  }
}

/**
 * Walk the parser's linear event stream and collect one `{meta, content,
 * incomplete}` record per `<artifact>…</artifact>` block. The same
 * identifier can appear more than once — each occurrence becomes its
 * own version (SPEC §5.2 "re-emitting an existing `identifier` → new row").
 */
function groupArtifactsByIdentifier(events: ArtifactEvent[]): Array<{
  meta: Extract<ArtifactEvent, { type: "artifact-start" }>["meta"];
  content: string;
  incomplete: boolean;
}> {
  const collected: Array<{
    meta: Extract<ArtifactEvent, { type: "artifact-start" }>["meta"];
    content: string;
    incomplete: boolean;
  }> = [];
  let current: (typeof collected)[number] | null = null;
  for (const event of events) {
    switch (event.type) {
      case "artifact-start":
        current = { meta: event.meta, content: "", incomplete: false };
        break;
      case "artifact-delta":
        if (current) current.content += event.text;
        break;
      case "artifact-end":
        if (current) {
          current.incomplete = event.incomplete;
          collected.push(current);
          current = null;
        }
        break;
      default:
        // `text` events are non-artifact chat text; ignored here.
        break;
    }
  }
  return collected;
}
