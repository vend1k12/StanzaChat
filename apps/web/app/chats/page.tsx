"use client";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";

/**
 * `/chats` — no chat selected. Renders the workspace with an empty center
 * column; the user picks or creates a chat from the sidebar.
 */
export default function ChatsPage() {
  return <WorkspaceShell selectedChatId={null} />;
}
