import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LlmProvider } from "@repo/shared/constants";

/**
 * Provider registry over Vercel AI SDK (SPEC §5.1).
 *
 * Resolves a provider + model from a `model_configurations` row into a
 * Vercel AI SDK model instance that can be passed to `streamText`.
 * The decrypted API key is passed in — never stored or logged.
 */

export interface ResolvedModel {
  model: string;
  // Vercel AI SDK model instance — typed loosely since the union of
  // provider model types is complex and not exported as a single type.
  modelInstance: unknown;
}

export interface ProviderConfig {
  provider: LlmProvider;
  baseUrl?: string;
  apiKey: string;
  modelId: string;
}

/**
 * Create a Vercel AI SDK model instance from a provider config.
 *
 * For `openai-compatible` and `ollama`, uses the OpenAI provider with
 * a custom baseURL. For `ollama`, the API key is not required (empty string).
 */
export function resolveModel(config: ProviderConfig): ResolvedModel {
  switch (config.provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      return { model: config.modelId, modelInstance: openai(config.modelId) };
    }

    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      return {
        model: config.modelId,
        modelInstance: anthropic(config.modelId),
      };
    }

    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      return { model: config.modelId, modelInstance: google(config.modelId) };
    }

    case "openai-compatible":
    case "ollama": {
      const openai = createOpenAI({
        apiKey: config.apiKey || "ollama",
        baseURL:
          config.baseUrl ??
          (config.provider === "ollama"
            ? "http://localhost:11434/v1"
            : undefined),
      });
      return { model: config.modelId, modelInstance: openai(config.modelId) };
    }

    default: {
      const _exhaustive: never = config.provider;
      return _exhaustive;
    }
  }
}
