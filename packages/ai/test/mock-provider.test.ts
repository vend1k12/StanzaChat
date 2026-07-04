import { streamText } from "ai";
import { describe, expect, it } from "bun:test";

import { parseComplete } from "../src/artifact-parser.js";
import { createMockModel } from "../src/mock-provider.js";

/**
 * Unit tests for the offline mock LanguageModel.
 *
 * The model's job is to give the E2E flow (SPEC §10 Phase 3 done-when) a
 * deterministic assistant message that yields **two** artifact versions
 * of the same identifier, so version-history navigation is exercised
 * without needing multiple LLM round-trips.
 */
describe("createMockModel", () => {
  it("emits two artifacts sharing the same identifier so v1+v2 land in one message", async () => {
    const model = createMockModel();
    const result = streamText({ model, prompt: "hi" });

    // Consume the full stream — SDK exposes the accumulated text on `text`
    // once the finish part arrives.
    const text = await result.text;

    // Run the accumulated text through the same parser the /api/chat
    // `onEnd` callback uses to persist artifacts.
    const events = parseComplete(text);

    const starts = events.filter((e) => e.type === "artifact-start");
    const ends = events.filter((e) => e.type === "artifact-end");

    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);

    // Both artifacts must share the SPEC-mandated identifier so the
    // artifact DAO records them as versions of the same row.
    for (const start of starts) {
      if (start.type !== "artifact-start") throw new Error("unreachable");
      expect(start.meta.identifier).toBe("welcome-card");
      expect(start.meta.type).toBe("html");
    }
    // Neither version is incomplete — both closing tags arrive.
    for (const end of ends) {
      if (end.type !== "artifact-end") throw new Error("unreachable");
      expect(end.incomplete).toBe(false);
    }
  });

  it("interleaves chat text with the artifacts (message pane vs. artifact pane split)", async () => {
    const model = createMockModel();
    const result = streamText({ model, prompt: "hi" });
    const text = await result.text;
    const events = parseComplete(text);

    const textEvents = events.filter((e) => e.type === "text");
    // At minimum: intro before the first artifact, and a middle sentence
    // between the two artifacts.
    expect(textEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("reports usage totals that stream through streamText", async () => {
    const model = createMockModel();
    const result = streamText({ model, prompt: "hi" });
    const usage = await result.usage;

    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
  });
});
