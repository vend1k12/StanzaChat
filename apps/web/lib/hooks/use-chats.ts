"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, apiPost } from "@/lib/api";

/**
 * TanStack Query hooks for the chats collection (SPEC §6).
 *
 * The `GET /api/chats` response is `{ chats: ChatDto[] }` and
 * `POST /api/chats` returns `{ id: string }` (201). We keep the DTO
 * shape in sync with the `chats` Drizzle row surfaced by `listChats`.
 */

/** Chat row as returned by `GET /api/chats`. */
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

interface ChatsResponse {
  chats: ChatDto[];
}

interface CreateChatResponse {
  id: string;
}

/** List the current user's chats (newest-updated first, per `listChats`). */
export function useChats() {
  return useQuery({
    queryKey: ["chats"],
    queryFn: () => apiFetch<ChatsResponse>("/api/chats"),
    select: (data) => data.chats,
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
