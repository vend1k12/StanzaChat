"use client";

import { cn } from "@/lib/utils";

/**
 * Single chat message bubble (SPEC §5.1 message pane).
 *
 * User messages align right in a primary bubble; assistant messages align
 * left in a muted bubble. Pure presentational component — artifact chips
 * and streaming are handled by `message-list`.
 */
export interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";
  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div className="flex max-w-[85%] flex-col gap-1">
        <span
          className={cn(
            "font-mono text-[10px] tracking-widest uppercase",
            isUser ? "self-end text-muted-soft" : "self-start text-coral",
          )}
        >
          {isUser ? "you" : "assistant"}
        </span>
        <div
          data-slot="message-bubble"
          className={cn(
            "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap",
            isUser
              ? "rounded-br-sm bg-coral text-on-primary"
              : "rounded-bl-sm border border-hairline bg-surface-card text-body-strong",
          )}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
