import type { Db } from "@repo/db";
import type { Env } from "@repo/shared";
import { NotFoundError, ValidationError } from "@repo/shared";

import { AesGcmKeyStore } from "./crypto/index.js";
import { createMockModel } from "./mock-provider.js";
import { getProviderById } from "./model-config.js";
import { type ResolvedModel, resolveModel } from "./provider-registry.js";

/**
 * Resolve the concrete Vercel AI SDK `LanguageModel` for a chat turn.
 *
 * Decrypts the provider's API key server-side for the duration of the
 * request only (SPEC §7, guardrails #3): the plaintext key never leaves
 * this function's scope — it's fed straight into the provider factory.
 *
 * Precedence:
 * 1. `env.E2E_MOCK_PROVIDER === "1"` → the offline mock model. This is
 *    rejected in production by `packages/shared/src/env.ts` refine, so it
 *    is safe to check first without adding a NODE_ENV guard here.
 * 2. `chatModelConfigId` set → decrypt + provider registry.
 * 3. Neither → throw `ValidationError`.
 */
export async function resolveChatModel(input: {
  db: Db;
  chatModelConfigId: string | null;
  env: Env;
}): Promise<ResolvedModel["modelInstance"]> {
  const { db, chatModelConfigId, env } = input;

  if (env.E2E_MOCK_PROVIDER === "1") {
    return createMockModel();
  }

  if (!chatModelConfigId) {
    throw new ValidationError("No model configured for this chat");
  }

  const providerConfig = await getProviderById(db, chatModelConfigId);
  if (!providerConfig || !providerConfig.enabled) {
    throw new NotFoundError("Provider", chatModelConfigId);
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

  return modelInstance;
}
