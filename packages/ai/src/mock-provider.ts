import type {
  LanguageModelV4,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";

/**
 * Offline mock LanguageModel for E2E and local development.
 *
 * Enabled at request time when `parseEnv().E2E_MOCK_PROVIDER === "1"`
 * (see `packages/shared/src/env.ts`). Never wired in production —
 * the env schema fails validation if the flag is truthy in
 * `NODE_ENV=production`.
 *
 * What it emits (SPEC §5.2 + §10 Phase 3 done-when):
 * 1. A short greeting so the message pane has visible chat text.
 * 2. A `<artifact identifier="welcome-card" type="text/html" ...>` block
 *    with an initial HTML card body — becomes `artifacts` row + version 1.
 * 3. A follow-up sentence in the message pane.
 * 4. A SECOND `<artifact>` block with the **same identifier** but new
 *    content — becomes version 2 of the same artifact. This lets the
 *    Playwright test navigate the versions tab without needing a
 *    second round-trip through the LLM.
 *
 * Chunks are split mid-tag on purpose so the artifact parser's
 * chunk-split handling (SPEC §5.2 requirement, `packages/ai/test/
 * artifact-parser.test.ts`) is exercised end-to-end.
 */

const CHAT_INTRO = "Hi! Here is a card I put together for you:\n\n";
const CHAT_MIDDLE =
  "\n\nI also refreshed the card with a slightly different note:\n\n";

const ARTIFACT_HEADER_OPEN =
  '<artifact identifier="welcome-card" type="text/html" title="Welcome Card">';
const ARTIFACT_HEADER_CLOSE = "</artifact>";

const ARTIFACT_BODY_V1 = `<div style="font-family: system-ui; padding: 24px; border: 1px solid #ddd; border-radius: 12px;">
  <h1 style="margin: 0 0 8px;">Welcome to StanzaChat</h1>
  <p style="margin: 0; color: #555;">This card was rendered inside a sandboxed iframe.</p>
</div>`;

const ARTIFACT_BODY_V2 = `<div style="font-family: system-ui; padding: 24px; border: 1px solid #ddd; border-radius: 12px; background: #fafafa;">
  <h1 style="margin: 0 0 8px;">Welcome, revisited</h1>
  <p style="margin: 0; color: #555;">Version 2 — the same identifier, refreshed content.</p>
</div>`;

/**
 * Deliberately split so `text-delta` chunks straddle:
 * - the opening `<artifact` prefix (chunk-split partial-tag path);
 * - the closing `</artifact>` (partial closing-tag path);
 * - a chunk boundary inside the artifact body.
 */
function buildChunks(): string[] {
  return [
    CHAT_INTRO,
    "<artif",
    'act identifier="welcome-card" ',
    'type="text/html" title="Welcome Card">',
    ARTIFACT_BODY_V1.slice(0, 80),
    ARTIFACT_BODY_V1.slice(80),
    "</artifa",
    "ct>",
    CHAT_MIDDLE,
    ARTIFACT_HEADER_OPEN,
    ARTIFACT_BODY_V2,
    ARTIFACT_HEADER_CLOSE,
  ];
}

const TEXT_ID = "mock-text-0";

function toStreamParts(chunks: string[]): LanguageModelV4StreamPart[] {
  const parts: LanguageModelV4StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: TEXT_ID },
  ];
  for (const chunk of chunks) {
    parts.push({ type: "text-delta", id: TEXT_ID, delta: chunk });
  }

  const totalTextLen = chunks.join("").length;
  parts.push({ type: "text-end", id: TEXT_ID });
  parts.push({
    type: "finish",
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: {
        total: 8,
        noCache: 8,
        cacheRead: 0,
        cacheWrite: 0,
      },
      outputTokens: {
        total: totalTextLen,
        text: totalTextLen,
        reasoning: undefined,
      },
    },
  });
  return parts;
}

/**
 * Build a fresh mock model. A new instance per request is fine — it holds
 * no state and construction is trivial.
 */
export function createMockModel(): LanguageModelV4 {
  return new MockLanguageModelV4({
    provider: "stanzachat-mock",
    modelId: "mock-artifact-e2e",
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: toStreamParts(buildChunks()),
        // Emit synchronously in tests — the artifact parser has its own
        // chunk-split coverage; we don't need timing jitter here.
        initialDelayInMs: null,
        chunkDelayInMs: null,
      }),
    }),
  });
}
