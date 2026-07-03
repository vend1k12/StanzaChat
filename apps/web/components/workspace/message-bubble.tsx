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
      <div
        data-slot="message-bubble"
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm break-words whitespace-pre-wrap shadow-sm",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        {content}
      </div>
    </div>
  );
}
