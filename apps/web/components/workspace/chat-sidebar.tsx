"use client";

import { LogOut, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/components/confirm-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { useViewer } from "@/components/workspace/viewer-context";
import { signOut, useSession } from "@/lib/auth-client";
import {
  type ChatDto,
  useChats,
  useCreateChat,
  useDeleteChat,
} from "@/lib/hooks/use-chats";
import { cn } from "@/lib/utils";

/**
 * Left column — chat list + user menu (SPEC §5.1).
 *
 * Warm-canvas editorial rail (see docs/agents/DESIGN.md): cream-soft
 * background, serif brand mark, ULTRAWIDE-tracking eyebrow above the
 * chat list, coral primary "New chat" button. Chats are grouped by
 * recency (`Today`, `Yesterday`, `Previous 7 days`, `Older`) so long
 * lists stay scannable; the selected chat is highlighted with a
 * surface-cream-strong pill.
 */
export interface ChatSidebarProps {
  selectedChatId: string | null;
}

interface ChatGroup {
  key: string;
  label: string;
  chats: ChatDto[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function groupChatsByRecency(chats: ChatDto[]): ChatGroup[] {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - DAY_MS;
  const startOfWeek = startOfToday - 7 * DAY_MS;

  const today: ChatDto[] = [];
  const yesterday: ChatDto[] = [];
  const week: ChatDto[] = [];
  const older: ChatDto[] = [];

  for (const chat of chats) {
    const ts = new Date(chat.updatedAt).getTime();
    if (ts >= startOfToday) today.push(chat);
    else if (ts >= startOfYesterday) yesterday.push(chat);
    else if (ts >= startOfWeek) week.push(chat);
    else older.push(chat);
  }

  return [
    { key: "today", label: "Today", chats: today },
    { key: "yesterday", label: "Yesterday", chats: yesterday },
    { key: "week", label: "Previous 7 days", chats: week },
    { key: "older", label: "Older", chats: older },
  ].filter((g) => g.chats.length > 0);
}

export function ChatSidebar({ selectedChatId }: ChatSidebarProps) {
  const { data: chats, isLoading } = useChats();
  const createChat = useCreateChat();
  const deleteChat = useDeleteChat();
  const { data: session } = useSession();
  const { isAdmin } = useViewer();
  const router = useRouter();
  const confirm = useConfirm();

  const groups = useMemo(() => {
    if (!chats) return [];
    // Newest first — the API returns ascending, so sort by updatedAt desc.
    const sorted = [...chats].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return groupChatsByRecency(sorted);
  }, [chats]);

  function handleNewChat() {
    // Draft-mode: no server round-trip. The chat row is created on the
    // first user submit inside `ChatView`, which then swaps the URL to
    // `/chats/{id}` in place.
    router.push("/chats");
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/auth/sign-in");
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
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-hairline bg-surface-soft text-ink">
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <Link
          href="/chats"
          className="flex items-center gap-2 text-ink hover:opacity-80"
        >
          <span className="spike-mark" aria-hidden />
          <span className="font-display text-[18px] leading-none tracking-tight">
            StanzaChat
          </span>
        </Link>
        {isAdmin ? (
          <Link
            href="/admin"
            aria-label="Instance admin"
            title="Instance admin"
            className="inline-flex items-center gap-1 rounded-full border border-coral/40 bg-coral/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-coral uppercase transition hover:bg-coral/15"
          >
            <ShieldCheck className="size-3" />
            admin
          </Link>
        ) : null}
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={handleNewChat}
          disabled={createChat.isPending}
          data-testid="new-chat"
          className="group inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-coral px-3 py-2 text-[13px] font-medium text-on-primary shadow-[0_10px_20px_-14px_rgba(204,120,92,0.9)] transition hover:bg-coral-active disabled:opacity-60"
        >
          <Plus className="size-3.5 transition group-hover:rotate-90" />
          New chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <div className="flex flex-col gap-1 px-1">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </div>
        ) : groups.length > 0 ? (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.key} className="flex flex-col">
                <p className="eyebrow px-3 pt-2 pb-1.5 text-[10px]">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.chats.map((chat) => {
                    const active = chat.id === selectedChatId;
                    return (
                      <li key={chat.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => router.push(`/chats/${chat.id}`)}
                          className={cn(
                            "flex w-full items-center rounded-md px-3 py-1.5 pr-7 text-left text-[13px] leading-tight transition-colors",
                            active
                              ? "bg-surface-cream-strong text-ink"
                              : "text-body hover:bg-surface-card hover:text-ink",
                          )}
                        >
                          <span className="truncate">
                            {chat.title || "Untitled"}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${chat.title || "chat"}`}
                          onClick={async (event) => {
                            event.stopPropagation();
                            const ok = await confirm({
                              title: "Delete this chat?",
                              description: `"${chat.title || "Untitled"}" and every message + artifact it produced will be permanently removed.`,
                              confirmLabel: "Delete chat",
                              tone: "destructive",
                            });
                            if (!ok) return;
                            deleteChat.mutate(chat.id, {
                              onSuccess: () => {
                                if (active) router.push("/chats");
                              },
                              onError: (err) =>
                                toast.error(err.message || "Failed to delete"),
                            });
                          }}
                          className="absolute top-1/2 right-1 hidden -translate-y-1/2 rounded p-0.5 text-muted-ink transition group-hover:inline-flex hover:bg-error/10 hover:text-error"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="mx-1 mt-4 rounded-md border border-dashed border-hairline bg-canvas/50 px-3 py-6 text-center">
            <p className="text-[13px] text-muted-ink">
              No chats yet.
              <br />
              Start a new one.
            </p>
          </div>
        )}
      </nav>

      <div className="border-t border-hairline p-2.5">
        <div className="flex items-center gap-2.5 rounded-lg bg-canvas p-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-coral text-[12px] font-medium text-on-primary uppercase">
            {initials}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium text-ink">
              {user?.name || user?.email || "Account"}
            </span>
            <span className="truncate font-mono text-[10px] text-muted-ink">
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
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
