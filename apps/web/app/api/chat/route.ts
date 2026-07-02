import { AesGcmKeyStore, getProviderById, resolveModel } from "@repo/ai";
import { getChat, getDb, saveMessage } from "@repo/db";
import { chatMessageSchema, parseEnv } from "@repo/shared";
import { streamText } from "ai";
import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = chatMessageSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: { code: "validation_error", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const { chatId, message } = parsed.data;
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const env = parseEnv();
  const db = getDb(env.DATABASE_URL);

  // Verify chat ownership (guardrails #6: scope chain)
  const chat = await getChat(
    db,
    {
      userId: session.user.id,
      organizationId: "",
      workspaceId: "",
    },
    chatId,
  );

  if (!chat) {
    return Response.json(
      { error: { code: "not_found", message: "Chat not found" } },
      { status: 404 },
    );
  }

  // Save user message before the call (SPEC §5.1)
  await saveMessage(db, { chatId, role: "user", content: message });

  // Resolve model configuration
  const configId = chat.modelConfigId;
  if (!configId) {
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

  const providerConfig = await getProviderById(db, configId);
  if (!providerConfig || !providerConfig.enabled) {
    return Response.json(
      {
        error: { code: "not_found", message: "Provider not found or disabled" },
      },
      { status: 404 },
    );
  }

  // Decrypt API key (SPEC §7: decrypted only server-side within a request)
  let apiKey = "";
  if (providerConfig.encryptedApiKey) {
    const keyStore = new AesGcmKeyStore(env.ENCRYPTION_MASTER_KEY);
    apiKey = await keyStore.decrypt({
      ciphertext: providerConfig.encryptedApiKey,
      iv: providerConfig.keyIv!,
      authTag: providerConfig.keyTag!,
    });
  }

  // Resolve model via Vercel AI SDK
  const { modelInstance } = resolveModel({
    provider: providerConfig.provider,
    baseUrl: providerConfig.baseUrl ?? undefined,
    apiKey,
    modelId: providerConfig.enabledModels[0] ?? "",
  });

  // Stream via Vercel AI SDK (SPEC §5.1)
  const result = streamText({
    model: modelInstance as Parameters<typeof streamText>[0]["model"],
    prompt: message,
    instructions: chat.systemPrompt ?? undefined,
    onEnd: async ({ text, usage }) => {
      // Save assistant message with token usage (SPEC §5.1)
      await saveMessage(db, {
        chatId,
        role: "assistant",
        content: text,
        tokenUsage: {
          prompt: usage?.inputTokens,
          completion: usage?.outputTokens,
          total: (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
        },
        modelId: providerConfig.enabledModels[0] ?? undefined,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
