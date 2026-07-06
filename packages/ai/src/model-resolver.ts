import type { Db } from "@repo/db";
import { providerModels } from "@repo/db/schema";
import type { Env } from "@repo/shared";
import { NotFoundError } from "@repo/shared";
import type { LanguageModel } from "ai";
import { asc, eq } from "drizzle-orm";

import { AesGcmKeyStore } from "./crypto/index.js";
import { createMockModel } from "./mock-provider.js";
import { getDefaultProvider, getProviderById } from "./model-config.js";
import { resolveModel } from "./provider-registry.js";

/**
 * Resolve the concrete Vercel AI SDK `LanguageModel` for a chat turn,
 * plus any per-model generation defaults stored in `provider_models`.
 *
 * Decrypts the provider's API key server-side for the duration of the
 * request only (SPEC §7, guardrails #3): the plaintext key never leaves
 * this function's scope — it's fed straight into the provider factory.
 *
 * Precedence:
 * 1. `env.E2E_MOCK_PROVIDER === "1"` → the offline mock model (rejected
 *    in production by the env schema).
 * 2. `chatModelConfigId` set → that provider config.
 * 3. Otherwise → the instance default provider (SPEC §5.5 "default
 *    model"). This makes a freshly-created chat work the moment an admin
 *    has configured a default provider, without the user first picking a
 *    model.
 * 4. No provider at all → throw `NotFoundError` so the route surfaces a
 *    clean "configure a provider" message instead of a stream crash.
 *
 * `modelId` (optional) selects a specific enabled model; when omitted
 * the provider's first enabled model is used.
 */

export interface ChatModelResolution {
  /**
   * Vercel AI SDK language model ready for `streamText(...)`. Typed as
   * `LanguageModel` here so callers don't re-cast the widened `unknown`
   * that `resolveModel` returns for the provider union.
   */
  modelInstance: LanguageModel;
  modelId: string;
  /** Per-model streamText settings pulled from `provider_models`. */
  settings: {
    temperature: number | null;
    topP: number | null;
    maxOutputTokens: number | null;
    systemPrompt: string | null;
  };
}

export async function resolveChatModel(input: {
  db: Db;
  chatModelConfigId: string | null;
  modelId?: string | null;
  env: Env;
}): Promise<ChatModelResolution> {
  const { db, chatModelConfigId, modelId, env } = input;

  if (env.E2E_MOCK_PROVIDER === "1") {
    // Mock model is a Vercel AI SDK `LanguageModel` under the hood — the
    // widening is a single, named-const assertion (see `resolveModel`
    // below); it never escapes into an inline-cast read at any call site.
    const mockInstance: LanguageModel = createMockModel() as LanguageModel;
    return {
      modelInstance: mockInstance,
      modelId: "mock",
      settings: {
        temperature: null,
        topP: null,
        maxOutputTokens: null,
        systemPrompt: null,
      },
    };
  }

  const providerConfig = chatModelConfigId
    ? await getProviderById(db, chatModelConfigId)
    : await getDefaultProvider(db);

  if (!providerConfig || !providerConfig.enabled) {
    throw new NotFoundError(
      "Provider",
      chatModelConfigId ?? "default (configure one in /admin/providers)",
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

  // Load the enabled model list for this provider from `provider_models`.
  const models = await db
    .select()
    .from(providerModels)
    .where(eq(providerModels.providerId, providerConfig.id))
    .orderBy(asc(providerModels.createdAt));
  const enabled = models.filter((m) => m.enabled);

  const requested =
    modelId && enabled.some((m) => m.modelId === modelId)
      ? enabled.find((m) => m.modelId === modelId)
      : undefined;
  const chosen = requested ?? enabled[0];
  const chosenModelId = chosen?.modelId ?? "";

  // `resolveModel` returns `modelInstance: unknown` because the Vercel
  // AI SDK provider union is not exported as a single type. Assign to a
  // named const typed `LanguageModel` so every downstream caller reads
  // through a checked type — never an inline cast on property access
  // (see project rule ts-no-inline-cast-access).
  const resolved = resolveModel({
    provider: providerConfig.provider,
    baseUrl: providerConfig.baseUrl ?? undefined,
    apiKey,
    modelId: chosenModelId,
  });
  const modelInstance: LanguageModel = resolved.modelInstance as LanguageModel;

  return {
    modelInstance,
    modelId: chosenModelId,
    settings: {
      temperature: parseNumeric(chosen?.temperature),
      topP: parseNumeric(chosen?.topP),
      maxOutputTokens: chosen?.maxOutputTokens ?? null,
      systemPrompt: chosen?.systemPrompt ?? null,
    },
  };
}

function parseNumeric(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}
