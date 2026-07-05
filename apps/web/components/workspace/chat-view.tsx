"use client";

import { type UIMessage, useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { ChatComposer } from "./chat-composer";
import { MessageList } from "./message-list";
import { ModelPicker } from "./model-picker";

/**
 * Center column — the active conversation (SPEC §5.1).
 *
 * Wires the Vercel AI SDK v7 `useChat` hook (from `@ai-sdk/react`) to the
 * streaming `POST /api/chat` route. The chat id is passed both as the
 * `useChat` `id` (so the hook keys its local message cache per chat) and
 * inside the transport `body` (the server resolves ownership + persistence
 * from it).
 *
 * `useChat` is only mounted when `chatId` is truthy — the outer `ChatView`
 * renders an empty state otherwise. The inner component always calls hooks
 * unconditionally.
 */
export interface ChatViewProps {
  chatId: string | null;
}

export function ChatView({ chatId }: ChatViewProps) {
  if (!chatId) {
    return (
      <div className="flex flex-1 flex-col bg-canvas">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-hairline bg-surface-card text-coral">
              <span className="spike-mark scale-125" aria-hidden />
            </div>
            <h2 className="mt-6 font-display text-[32px] leading-tight tracking-[-0.02em] text-ink">
              A blank page, on purpose
            </h2>
            <p className="mt-3 text-base leading-relaxed text-body">
              Pick a conversation from the left, or start a new chat. Your
              messages stream in on the left; anything the assistant builds
              opens as a live artifact on the right.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return <ChatViewInner chatId={chatId} />;
}

function ChatViewInner({ chatId }: { chatId: string }) {
  const queryClient = useQueryClient();
  // Recreate the transport when the chat id changes so the `body` payload
  // always carries the current chat. `body` is sent with every request.
  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/chat",
        body: { chatId },
      }),
    [chatId],
  );

  const { messages, status, sendMessage, error } = useChat<UIMessage>({
    id: chatId,
    transport,
  });

  useEffect(() => {
    if (error) toast.error(error.message || "Chat request failed");
  }, [error]);

  // The assistant turn persists artifacts server-side in `onEnd`. Once the
  // stream finishes (streaming → ready) invalidate the chat's artifact list
  // so the message-pane artifact chips can resolve `identifier → id` and
  // the Versions tab reflects the freshly-written rows.
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "streaming" && status === "ready") {
      void queryClient.invalidateQueries({
        queryKey: ["chats", chatId, "artifacts"],
      });
    }
    prevStatus.current = status;
  }, [status, chatId, queryClient]);

  const busy = status === "submitted" || status === "streaming";
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-hairline bg-canvas/80 px-5 backdrop-blur-md">
        <ModelPicker />
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-mono text-[11px] tracking-widest uppercase transition",
            busy ? "text-coral" : "text-muted-ink",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              busy ? "animate-pulse bg-coral" : "bg-accent-teal",
            )}
          />
          {busy ? "streaming" : "ready"}
        </span>
      </header>
      <ScrollArea className="flex-1">
        <MessageList chatId={chatId} messages={messages} />
      </ScrollArea>
      <ChatComposer
        status={status}
        onSend={(text) => void sendMessage({ text })}
      />
    </div>
  );
}
