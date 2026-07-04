"use client";

import { type ArtifactEvent, parseComplete } from "@repo/ai/artifact-parser";
import { Code } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { useArtifacts } from "@/lib/hooks/use-artifacts";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

import { MessageBubble } from "./message-bubble";

/**
 * Renders the streamed message list for the active chat (SPEC §5.1 / §5.2).
 *
 * For each assistant message we run `parseComplete` from `@repo/ai` to split
 * the raw text into:
 *   - `text` segments → rendered as `MessageBubble`s
 *   - `artifact-start` events → rendered as clickable "chips" that open the
 *     artifact panel (right column) via the `useUiStore`.
 *
 * The chip maps the artifact's `identifier` to its DB `id` through the
 * `useArtifacts(chatId)` list so the panel can fetch versions.
 *
 * Auto-scrolls to the bottom whenever the message count or the last
 * message's content grows.
 */

/** One assistant message parsed into renderable segments. */
type ParsedSegment =
  | { kind: "text"; text: string }
  | { kind: "artifact-chip"; identifier: string; title: string };

export interface MessageListProps {
  /** The active chat id (used to resolve artifact identifiers → ids). */
  chatId: string;
  /** AI SDK v2 UIMessage-like rows. */
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    parts: Array<{ type: string; text?: string }>;
  }>;
}

/** Extract the plain text of an AI SDK v2 UIMessage from its `parts`. */
function messageText(message: MessageListProps["messages"][number]): string {
  return message.parts
    .map((part) => (part.type === "text" && part.text) || "")
    .join("");
}

/** Turn a parsed event stream into renderable segments. */
function toSegments(events: ArtifactEvent[]): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  for (const event of events) {
    if (event.type === "text") {
      segments.push({ kind: "text", text: event.text });
    } else if (event.type === "artifact-start") {
      segments.push({
        kind: "artifact-chip",
        identifier: event.meta.identifier,
        title: event.meta.title || event.meta.identifier,
      });
    }
    // `artifact-delta` / `artifact-end` carry content shown in the panel,
    // not inline in the message pane — intentionally ignored here.
  }
  return segments;
}

export function MessageList({ chatId, messages }: MessageListProps) {
  const { data: artifacts } = useArtifacts(chatId);
  const setActiveArtifact = useUiStore((s) => s.setActiveArtifact);
  const setPanelOpen = useUiStore((s) => s.setPanelOpen);

  // identifier → artifact id, for chip clicks.
  const artifactIdByIdentifier = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of artifacts ?? []) map.set(a.identifier, a.id);
    return map;
  }, [artifacts]);

  // Parse each assistant message once per render. `parseComplete` is pure
  // and cheap; memoising on the message id + text keeps it stable across
  // re-renders while streaming appends new tail messages.
  const parsed = useMemo(() => {
    return messages.map((message) => {
      const text = messageText(message);
      if (message.role !== "assistant") {
        return { message, text, segments: null as ParsedSegment[] | null };
      }
      return { message, text, segments: toSegments(parseComplete(text)) };
    });
  }, [messages]);

  // Auto-scroll to the newest content.
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSignature = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last) return "";
    return `${last.id}:${messageText(last).length}`;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastSignature, messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Start the conversation — your assistant can reply with text and rendered
        artifacts.
      </div>
    );
  }

  function openArtifact(identifier: string) {
    const id = artifactIdByIdentifier.get(identifier);
    if (!id) return;
    setActiveArtifact(id);
    setPanelOpen(true);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {parsed.map(({ message, text, segments }) => {
        if (message.role !== "assistant" || !segments) {
          return (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={text}
            />
          );
        }
        return (
          <div key={message.id} className="flex flex-col gap-3">
            {segments.map((segment, index) => {
              if (segment.kind === "text") {
                if (segment.text.trim().length === 0) return null;
                return (
                  <MessageBubble
                    key={`${message.id}-${index}`}
                    role="assistant"
                    content={segment.text}
                  />
                );
              }
              return (
                <button
                  key={`${message.id}-${index}`}
                  type="button"
                  data-testid="artifact-chip"
                  onClick={() => openArtifact(segment.identifier)}
                  className={cn(
                    "inline-flex w-fit items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-xs transition-colors",
                    "outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  )}
                >
                  <Code className="size-4" />
                  <span className="font-medium">{segment.title}</span>
                  <span className="text-muted-foreground">· artifact</span>
                </button>
              );
            })}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
