import type { Db } from "@repo/db";
import type { Env } from "@repo/shared";
import { NotFoundError } from "@repo/shared";

import { AesGcmKeyStore } from "./crypto/index.js";
import { createMockModel } from "./mock-provider.js";
import { getDefaultProvider, getProviderById } from "./model-config.js";
import { type ResolvedModel, resolveModel } from "./provider-registry.js";

/**
 * Resolve the concrete Vercel AI SDK `LanguageModel` for a chat turn.
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
 * `modelId` (optional) selects a specific enabled model; when omitted the
 * provider's first enabled model is used.
 */
export async function resolveChatModel(input: {
  db: Db;
  chatModelConfigId: string | null;
  modelId?: string | null;
  env: Env;
}): Promise<ResolvedModel["modelInstance"]> {
  const { db, chatModelConfigId, modelId, env } = input;

  if (env.E2E_MOCK_PROVIDER === "1") {
    return createMockModel();
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

  // Prefer the requested model when it is enabled for this provider,
  // otherwise fall back to the provider's first enabled model.
  const chosenModel =
    (modelId && providerConfig.enabledModels.includes(modelId)
      ? modelId
      : undefined) ??
    providerConfig.enabledModels[0] ??
    "";

  const { modelInstance } = resolveModel({
    provider: providerConfig.provider,
    baseUrl: providerConfig.baseUrl ?? undefined,
    apiKey,
    modelId: chosenModel,
  });

  return modelInstance;
}
