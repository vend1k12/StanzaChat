"use client";

import { type UIMessage, useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { ScrollArea } from "@/components/ui/scroll-area";

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
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="max-w-sm space-y-1">
            <p className="font-medium text-foreground">No chat selected</p>
            <p className="text-sm text-muted-foreground">
              Pick a conversation from the sidebar, or start a new chat.
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

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <ModelPicker />
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
