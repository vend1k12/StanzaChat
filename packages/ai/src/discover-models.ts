import type { LlmProvider } from "@repo/shared/constants";

/**
 * Discover the model catalogue for an OpenAI-compatible provider.
 *
 * Standard OpenAI-family shape (used by real OpenAI, Ollama's
 * `/v1/models`, LiteLLM, LocalAI, one-api, vLLM, etc.):
 *
 * ```
 * GET {baseUrl}/models          [Authorization: Bearer <apiKey>]
 * → { object: "list", data: [{ id: "gpt-4o-mini", … }, …] }
 * ```
 *
 * v0.1 only supports the OpenAI-compatible endpoint on providers
 * `openai`, `openai-compatible`, and `ollama`. Anthropic / Google have
 * different formats and stay as manual-entry in the UI.
 */

/**
 * Providers with a supported discovery endpoint. Exported so both the
 * server routes and the UI can consult the same table without
 * re-encoding the rule.
 */
export const DISCOVERABLE_PROVIDERS: Record<LlmProvider, boolean> = {
  openai: true,
  "openai-compatible": true,
  ollama: true,
  anthropic: false,
  google: false,
};

const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434/v1";

export interface DiscoverInput {
  provider: LlmProvider;
  baseUrl?: string | null;
  apiKey?: string | null;
  /** Fetch impl override for tests. */
  fetchImpl?: typeof fetch;
}

export class DiscoverError extends Error {
  readonly code:
    | "unsupported_provider"
    | "network_error"
    | "http_error"
    | "invalid_response";
  readonly status: number | null;

  constructor(
    code: DiscoverError["code"],
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = "DiscoverError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Fetch `{baseUrl}/models` and return the sorted list of unique model
 * ids. Never throws through the network layer — all failure modes are
 * captured by `DiscoverError` with a discriminating `code`.
 */
export async function discoverModels(input: DiscoverInput): Promise<string[]> {
  if (DISCOVERABLE_PROVIDERS[input.provider] !== true) {
    throw new DiscoverError(
      "unsupported_provider",
      `Discovery is not supported for provider "${input.provider}". Add models manually.`,
    );
  }

  // Resolve base URL — provider-specific fallbacks (OpenAI, Ollama) or
  // the user-supplied value. Trailing slashes are stripped so
  // `${base}/models` never doubles up.
  const fallback =
    input.provider === "ollama"
      ? OLLAMA_DEFAULT_BASE_URL
      : input.provider === "openai"
        ? OPENAI_DEFAULT_BASE_URL
        : null;
  const rawBase = (input.baseUrl && input.baseUrl.trim()) || fallback;
  if (!rawBase) {
    throw new DiscoverError(
      "invalid_response",
      "A base URL is required for openai-compatible providers.",
    );
  }
  // Strip trailing slashes with a bounded loop instead of `/\/+$/` — the
  // greedy regex is quadratic on pathological input (`/////…`) and
  // CodeQL flags it as a ReDoS surface even though the input is small.
  let end = rawBase.length;
  while (end > 0 && rawBase.charCodeAt(end - 1) === 47) end -= 1;
  const baseUrl = rawBase.slice(0, end);
  const url = `${baseUrl}/models`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`;

  const doFetch = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url, { method: "GET", headers });
  } catch (err) {
    throw new DiscoverError(
      "network_error",
      `Could not reach ${url}: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }

  if (!response.ok) {
    // Distinguish 401 (bad key) from 404 (wrong base URL / no /models
    // route) from 5xx (upstream) — the UI branches on this message.
    const status = response.status;
    let message: string;
    if (status === 401 || status === 403) {
      message =
        "Provider rejected the API key (401/403). Check the key and try again.";
    } else if (status === 404) {
      message = `No \`/models\` endpoint at ${url}. Double-check the base URL — it should end at \`/v1\`.`;
    } else if (status === 429) {
      message =
        "Provider rate-limited the request (429). Wait a moment and retry.";
    } else if (status >= 500) {
      message = `Provider returned ${status}. Try again later.`;
    } else {
      message = `Provider returned ${status}.`;
    }
    throw new DiscoverError("http_error", message, status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new DiscoverError(
      "invalid_response",
      "Provider responded with a non-JSON body.",
    );
  }

  // Narrow `unknown` in place — the response is external input we don't
  // control, so we validate every field we read (project rule
  // ts-no-inline-cast-access: no unchecked `as` on external JSON).
  if (
    body === null ||
    typeof body !== "object" ||
    !("data" in body) ||
    !Array.isArray(body.data)
  ) {
    throw new DiscoverError(
      "invalid_response",
      "Provider response did not match the OpenAI `/v1/models` shape (expected `{ data: [{ id: string }] }`).",
    );
  }

  const ids: string[] = [];
  for (const entry of body.data) {
    if (
      entry !== null &&
      typeof entry === "object" &&
      "id" in entry &&
      typeof entry.id === "string" &&
      entry.id.length > 0
    ) {
      ids.push(entry.id);
    }
  }
  if (ids.length === 0) {
    throw new DiscoverError(
      "invalid_response",
      "Provider returned an empty `data` array.",
    );
  }
  // Dedupe + stable alpha sort so the UI list is deterministic.
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}
