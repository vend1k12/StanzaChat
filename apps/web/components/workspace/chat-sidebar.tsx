"use client";

import { LogOut, MessageSquare, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { useViewer } from "@/components/workspace/viewer-context";
import { signOut, useSession } from "@/lib/auth-client";
import { useChats, useCreateChat } from "@/lib/hooks/use-chats";
import { cn } from "@/lib/utils";

/**
 * Left column — chat list + user menu (SPEC §5.1).
 *
 * Warm-canvas editorial rail (see docs/agents/DESIGN.md): cream-soft
 * background, serif brand mark, ULTRAWIDE-tracking eyebrow above the
 * chat list, coral primary "New chat" button. The chat list is fetched
 * via `useChats()` and the selected chat is highlighted with a
 * surface-cream-strong pill.
 */
export interface ChatSidebarProps {
  selectedChatId: string | null;
}

export function ChatSidebar({ selectedChatId }: ChatSidebarProps) {
  const { data: chats, isLoading } = useChats();
  const createChat = useCreateChat();
  const { data: session } = useSession();
  const { isAdmin } = useViewer();
  const router = useRouter();

  function handleNewChat() {
    createChat.mutate(
      { title: "Untitled" },
      {
        onSuccess: ({ id }) => router.push(`/chats/${id}`),
        onError: (err) => {
          toast.error(err.message || "Failed to create chat");
        },
      },
    );
  }

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/auth/sign-in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign out failed");
    }
  }

  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user?.email
      ? user.email[0]?.toUpperCase()
      : "?";

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-hairline bg-surface-soft text-ink">
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <Link
          href="/chats"
          className="flex items-center gap-2 text-ink hover:opacity-80"
        >
          <span className="spike-mark" aria-hidden />
          <span className="font-display text-[19px] leading-none tracking-tight">
            StanzaChat
          </span>
        </Link>
        {isAdmin ? (
          <Link
            href="/admin"
            aria-label="Instance admin"
            title="Instance admin"
            className="inline-flex items-center gap-1 rounded-full border border-coral/40 bg-coral/10 px-2 py-1 font-mono text-[10px] tracking-widest text-coral uppercase transition hover:bg-coral/15"
          >
            <ShieldCheck className="size-3" />
            admin
          </Link>
        ) : null}
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={handleNewChat}
          disabled={createChat.isPending}
          data-testid="new-chat"
          className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-coral px-3 py-2.5 text-sm font-medium text-on-primary shadow-[0_10px_20px_-14px_rgba(204,120,92,0.9)] transition hover:bg-coral-active disabled:opacity-60"
        >
          <Plus className="size-4 transition group-hover:rotate-90" />
          New chat
        </button>
      </div>

      <p className="eyebrow px-6 pt-4 pb-2">Conversations</p>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <ul className="flex flex-col gap-1">
          {isLoading ? (
            <>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </>
          ) : chats && chats.length > 0 ? (
            chats.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/chats/${chat.id}`)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    chat.id === selectedChatId
                      ? "bg-surface-cream-strong text-ink"
                      : "text-body hover:bg-surface-card hover:text-ink",
                  )}
                >
                  <MessageSquare className="size-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{chat.title || "Untitled"}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="rounded-md border border-dashed border-hairline bg-canvas/50 px-3 py-6 text-center">
              <p className="text-sm text-muted-ink">
                No chats yet.
                <br />
                Start a new one.
              </p>
            </li>
          )}
        </ul>
      </nav>

      <div className="border-t border-hairline p-3">
        <div className="flex items-center gap-3 rounded-lg bg-canvas p-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral text-sm font-medium text-on-primary uppercase">
            {initials}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-ink">
              {user?.name || user?.email || "Account"}
            </span>
            <span className="truncate font-mono text-[11px] text-muted-ink">
              {user?.email}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="rounded-md p-1.5 text-muted-ink transition hover:bg-surface-card hover:text-ink"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
