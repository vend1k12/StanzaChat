"use client";

import { useParams } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";

/**
 * `/chats` (draft) and `/chats/{id}` (active) share a single route
 * segment via Next.js optional catch-all — so `router.replace(
 * '/chats/{id}')` on the first submit only updates the URL, without
 * unmounting `WorkspaceShell` / `ChatView`. Two separate `page.tsx`
 * files under `/chats` and `/chats/[chatId]` triggered a component
 * reconciliation break in prod builds and dropped the in-flight
 * `useChat` state mid-stream.
 *
 * `params.chatId` is `undefined` on `/chats` and a one-element array
 * on `/chats/{id}` (catch-all always yields an array). The workspace
 * shell renders the draft state when `selectedChatId` is `null`.
 */
export default function ChatsPage() {
  const params = useParams<{ chatId?: string[] }>();
  const chatId = params.chatId?.[0] ?? null;

  return <WorkspaceShell selectedChatId={chatId} />;
}
