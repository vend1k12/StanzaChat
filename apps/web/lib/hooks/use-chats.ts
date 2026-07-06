"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, apiPost } from "@/lib/api";

/**
 * TanStack Query hooks for the chats collection (SPEC §5.1, §6).
 *
 * `GET /api/chats` → `{ chats: ChatDto[] }`
 * `POST /api/chats` → `{ id: string }`
 * `GET /api/chats/:id` → `{ chat: ChatDto }`
 * `PATCH /api/chats/:id` → `{ ok: true }` (title, system prompt, model)
 * `DELETE /api/chats/:id` → `{ ok: true }`
 * `GET /api/chats/:id/messages` → `{ messages: MessageDto[] }`
 */

export interface ChatDto {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  systemPrompt: string | null;
  modelConfigId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  chatId: string;
  role: "system" | "user" | "assistant";
  content: string;
  tokenUsage: {
    prompt?: number;
    completion?: number;
    total?: number;
  } | null;
  modelId: string | null;
  createdAt: string;
}

interface ChatsResponse {
  chats: ChatDto[];
}
interface ChatResponse {
  chat: ChatDto;
}
interface MessagesResponse {
  messages: MessageDto[];
}
interface CreateChatResponse {
  id: string;
}

/** List the current user's chats. */
export function useChats() {
  return useQuery({
    queryKey: ["chats"],
    queryFn: () => apiFetch<ChatsResponse>("/api/chats"),
    select: (data) => data.chats,
  });
}

/** Fetch a single chat (title, model, prompt). */
export function useChat(chatId: string | null) {
  return useQuery({
    queryKey: ["chats", chatId],
    enabled: Boolean(chatId),
    queryFn: () => apiFetch<ChatResponse>(`/api/chats/${chatId}`),
    select: (data) => data.chat,
  });
}

/** Fetch persisted chat history (used to hydrate `useChat` on mount). */
export function useChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: ["chats", chatId, "messages"],
    enabled: Boolean(chatId),
    queryFn: () => apiFetch<MessagesResponse>(`/api/chats/${chatId}/messages`),
    select: (data) => data.messages,
    // Keep the persisted history stable while the user drafts a reply —
    // `useChat` maintains the live view. We only invalidate on completion.
    staleTime: 60_000,
  });
}

/** Create a new chat; invalidates the chats list on success. */
export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title?: string;
      systemPrompt?: string;
      modelConfigId?: string;
    }) =>
      apiPost<CreateChatResponse>("/api/chats", {
        // `workspaceId` is advisory in v0.1 (server ignores it and uses the
        // caller's resolved default workspace), but the zod schema requires
        // a non-empty string, so send a placeholder the server will drop.
        workspaceId: "advisory",
        ...input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}

/** Rename / re-model / update system prompt on an existing chat. */
export function useUpdateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      updates: {
        title?: string;
        systemPrompt?: string | null;
        modelConfigId?: string | null;
      };
    }) =>
      apiFetch<{ ok: true }>(`/api/chats/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input.updates),
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.invalidateQueries({
        queryKey: ["chats", variables.id],
      });
    },
  });
}

/** Delete a chat. */
export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/chats/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}
