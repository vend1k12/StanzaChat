"use client";

import { useUiStore } from "@/store/ui-store";

import { ArtifactPanel } from "./artifact-panel";
import { ChatSidebar } from "./chat-sidebar";
import { ChatView } from "./chat-view";

/**
 * Top-level three-column workspace layout (SPEC §5.3).
 *
 * - Left: chat sidebar (chat list + user menu).
 * - Center: active chat view. Renders a draft composer when
 *   `selectedChatId` is `null` — the first submit creates the chat via
 *   `POST /api/chats` and swaps the URL to `/chats/{id}` without
 *   remounting the stream (see `ChatView`).
 * - Right: artifact panel — only rendered when the panel is open AND an
 *   active artifact id is set in the `useUiStore`.
 *
 * The TanStack Query `QueryClientProvider` is mounted at the root layout
 * (`apps/web/components/providers.tsx`), so this component just consumes
 * the hooks. Panel open state lives in `useUiStore` so the message-list
 * (inside `ChatView`) can open the panel without prop-drilling.
 */
export interface WorkspaceShellProps {
  selectedChatId: string | null;
}

export function WorkspaceShell({ selectedChatId }: WorkspaceShellProps) {
  const panelOpen = useUiStore((s) => s.panelOpen);
  const activeArtifactId = useUiStore((s) => s.activeArtifactId);

  const showPanel = panelOpen && Boolean(activeArtifactId);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas">
      <ChatSidebar selectedChatId={selectedChatId} />
      <main className="flex min-w-0 flex-1 flex-col">
        <ChatView chatId={selectedChatId} />
      </main>
      {showPanel ? <ArtifactPanel artifactId={activeArtifactId} /> : null}
    </div>
  );
}
