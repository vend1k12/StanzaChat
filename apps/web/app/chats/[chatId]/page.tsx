"use client";

import { useParams } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";

/**
 * `/chats/[chatId]` — the active conversation. Reads the dynamic
 * `chatId` segment on the client and hands it to the workspace shell.
 */
export default function ChatPage() {
  const params = useParams<{ chatId: string }>();
  const chatId = typeof params.chatId === "string" ? params.chatId : null;

  return <WorkspaceShell selectedChatId={chatId} />;
}
