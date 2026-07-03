import {
  createArtifactVersion,
  type Db,
  saveMessage,
  type TenantScope,
  upsertArtifact,
} from "@repo/db";

import { type ArtifactEvent, parseComplete } from "./artifact-parser.js";

/**
 * Assistant-turn persistence (SPEC §5.1, §5.2).
 *
 * Called from `/api/chat`'s streamText `onEnd` callback — which the AI
 * SDK guarantees runs even if the client disconnects, so this is the
 * safe place to write both the assistant message and any artifacts it
 * emitted.
 *
 * Flow:
 * 1. Save assistant message (raw text incl. artifact tags — the client
 *    strips them at render time; the raw form is the audit trail).
 * 2. Run `parseComplete` on the full text to derive artifact events.
 * 3. Group events by identifier — each `<artifact>` block becomes a new
 *    row (or a new version for an existing identifier per SPEC §5.2).
 */
export async function persistAssistantTurn(input: {
  db: Db;
  scope: TenantScope;
  chatId: string;
  text: string;
  usage:
    | {
        inputTokens?: number;
        outputTokens?: number;
      }
    | undefined;
  modelId: string | undefined;
}): Promise<void> {
  const { db, scope, chatId, text, usage, modelId } = input;

  const messageId = await saveMessage(db, {
    chatId,
    role: "assistant",
    content: text,
    tokenUsage: {
      prompt: usage?.inputTokens,
      completion: usage?.outputTokens,
      total: (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
    },
    modelId,
  });

  const events = parseComplete(text);
  for (const artifact of groupArtifactsByIdentifier(events)) {
    const artifactId = await upsertArtifact(db, scope, {
      chatId,
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

interface CollectedArtifact {
  meta: Extract<ArtifactEvent, { type: "artifact-start" }>["meta"];
  content: string;
  incomplete: boolean;
}

/**
 * Walk the parser's linear event stream and collect one
 * `{meta, content, incomplete}` record per `<artifact>…</artifact>` block.
 *
 * The same identifier can appear more than once — each occurrence becomes
 * its own record (and, downstream, its own artifact version per SPEC §5.2
 * "re-emitting an existing `identifier` → new row").
 *
 * Exported for unit testing; consumers should call `persistAssistantTurn`.
 */
export function groupArtifactsByIdentifier(
  events: ArtifactEvent[],
): CollectedArtifact[] {
  const collected: CollectedArtifact[] = [];
  let current: CollectedArtifact | null = null;
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
