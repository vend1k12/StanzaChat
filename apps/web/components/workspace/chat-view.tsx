"use client";

import { type UIMessage, useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { AlertTriangle, KeyRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ApiError } from "@/lib/api";
import {
  useChat as useChatQuery,
  useChatMessages,
  useUpdateChat,
} from "@/lib/hooks/use-chats";
import { cn } from "@/lib/utils";

import { ChatComposer } from "./chat-composer";
import { MessageList } from "./message-list";
import { ModelPicker, type ModelSelection } from "./model-picker";

/**
 * Center column — the active conversation (SPEC §5.1).
 *
 * Wires Vercel AI SDK v7 `useChat` to `POST /api/chat`. Persistence lives
 * in the route handler's `onEnd`, so the client's role is just:
 *   1. Hydrate `useChat` with any prior messages from the DB.
 *   2. Send new user messages with the picker's `modelId` attached.
 *   3. Show a "no provider" banner when the API surfaces `not_found`.
 *   4. Invalidate the artifact list on stream completion so chips resolve.
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
  return <ChatViewInner key={chatId} chatId={chatId} />;
}

function ChatViewInner({ chatId }: { chatId: string }) {
  const queryClient = useQueryClient();
  const { data: chat } = useChatQuery(chatId);
  const { data: history, isLoading: historyLoading } = useChatMessages(chatId);
  const updateChat = useUpdateChat();

  // Local picker state — seeded from the persisted chat.modelConfigId once
  // the chat row arrives. `modelId` is the specific model within that
  // provider (from `provider.enabledModels`).
  const [selection, setSelection] = useState<ModelSelection | null>(null);
  useEffect(() => {
    if (!chat) return;
    setSelection(
      (prev) =>
        prev ?? {
          providerId: chat.modelConfigId,
          modelId: null,
        },
    );
  }, [chat]);

  // Hydrate `useChat` with the persisted history. AI SDK v7's `useChat`
  // takes `messages` (initial) as the DB history mapped to UIMessages.
  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!history) return [];
    return history.map((m) => ({
      id: m.id,
      role: m.role === "system" ? "system" : m.role,
      parts: [{ type: "text", text: m.content }],
    })) as UIMessage[];
  }, [history]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/chat",
        // `body` is sent with every request — the server reads chatId +
        // modelId. modelId is optional; server falls back to
        // chat.modelConfigId or the instance default provider.
        body: () => ({
          chatId,
          modelId: selection?.modelId ?? undefined,
        }),
      }),
    [chatId, selection?.modelId],
  );

  const { messages, status, sendMessage, error, stop, setMessages } =
    useChat<UIMessage>({
      id: chatId,
      transport,
    });

  // One-shot hydration once history has loaded. We only seed when the
  // client-side messages array is still empty so we never clobber a live
  // stream in progress.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (historyLoading) return;
    if (!initialMessages.length) {
      hydratedRef.current = true;
      return;
    }
    if (messages.length > 0) return;
    setMessages(initialMessages);
    hydratedRef.current = true;
  }, [historyLoading, initialMessages, messages.length, setMessages]);

  // Surface a friendly "configure a provider" banner instead of the raw
  // API error toast when there's no provider set up yet.
  const providerMissing =
    error instanceof ApiError &&
    error.code === "not_found" &&
    /provider/i.test(error.message);

  // Refresh artifact chips (identifier → id) and re-fetch persisted
  // messages / chats list after each assistant turn completes.
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "streaming" && status === "ready") {
      void queryClient.invalidateQueries({
        queryKey: ["chats", chatId, "artifacts"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["chats", chatId, "messages"],
      });
      // Auto-title from the first user message if the chat is still
      // "Untitled". Fire-and-forget: failure is surfaced via toast but
      // does not block the stream UX.
      if (chat && chat.title === "Untitled") {
        const firstUser = messages.find((m) => m.role === "user");
        if (firstUser) {
          const text = uiMessageText(firstUser).trim().slice(0, 60);
          if (text) {
            updateChat.mutate({
              id: chatId,
              updates: { title: text },
            });
          }
        }
      }
    }
    prevStatus.current = status;
  }, [status, chatId, queryClient, chat, messages, updateChat]);

  const busy = status === "submitted" || status === "streaming";
  // Composer is always enabled — server handles the "no provider" case
  // by returning `not_found` which the ErrorBanner surfaces cleanly.
  const canSend = true;

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-canvas/80 px-5 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <p
            className="truncate font-display text-[16px] leading-none tracking-tight text-ink"
            title={chat?.title}
          >
            {chat?.title ?? "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ModelPicker
            selection={selection}
            onChange={(next) => {
              setSelection(next);
              if (next?.providerId && next.providerId !== chat?.modelConfigId) {
                updateChat.mutate({
                  id: chatId,
                  updates: { modelConfigId: next.providerId },
                });
              }
            }}
          />
          <StatusPill busy={busy} />
        </div>
      </header>

      {providerMissing ? (
        <NoProviderBanner />
      ) : error && !busy ? (
        <ErrorBanner message={error.message} />
      ) : null}

      <ScrollArea className="flex-1">
        <MessageList chatId={chatId} messages={messages} />
      </ScrollArea>

      <ChatComposer
        status={status}
        canSend={canSend}
        onStop={busy ? stop : undefined}
        onSend={(text) => void sendMessage({ text })}
      />
    </div>
  );
}

function StatusPill({ busy }: { busy: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[11px] tracking-widest uppercase",
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
  );
}

function NoProviderBanner() {
  return (
    <div className="border-b border-hairline bg-surface-card px-5 py-3">
      <div className="mx-auto flex max-w-3xl items-center gap-3 text-sm">
        <span className="flex size-8 items-center justify-center rounded-md bg-coral/15 text-coral">
          <KeyRound className="size-4" />
        </span>
        <div className="flex-1">
          <p className="font-medium text-ink">No provider configured</p>
          <p className="text-xs text-muted-ink">
            Add and enable a model provider before chatting.
          </p>
        </div>
        <Link
          href="/admin/providers"
          className="rounded-md bg-coral px-3 py-1.5 text-xs font-medium text-on-primary transition hover:bg-coral-active"
        >
          Configure
        </Link>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="border-b border-error/30 bg-error/5 px-5 py-2.5">
      <div className="mx-auto flex max-w-3xl items-center gap-2 text-sm text-error">
        <AlertTriangle className="size-4 shrink-0" />
        <p className="truncate">{message}</p>
      </div>
    </div>
  );
}

/** Concatenate text parts of a UIMessage — for auto-title extraction. */
function uiMessageText(message: UIMessage): string {
  if (!("parts" in message) || !Array.isArray(message.parts)) return "";
  let text = "";
  for (const part of message.parts) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
    ) {
      text += part.text;
    }
  }
  return text;
}
