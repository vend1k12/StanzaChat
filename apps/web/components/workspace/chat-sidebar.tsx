"use client";

import { LogOut, MessageSquare, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "@/lib/auth-client";
import { useChats, useCreateChat } from "@/lib/hooks/use-chats";
import { cn } from "@/lib/utils";

/**
 * Left column — chat list + user menu (SPEC §5.1 sidebar).
 *
 * - "New chat" calls the `createChat` mutation then navigates to the new
 *   chat's route.
 * - The chat list is fetched via `useChats()`; the selected chat
 *   (`selectedChatId`) is highlighted.
 * - The user menu (avatar) shows the current user from `useSession` and
 *   signs out via `authClient.signOut`, then redirects to the sign-in page.
 */
export interface ChatSidebarProps {
  selectedChatId: string | null;
}

export function ChatSidebar({ selectedChatId }: ChatSidebarProps) {
  const { data: chats, isLoading } = useChats();
  const createChat = useCreateChat();
  const { data: session } = useSession();
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
    await signOut();
    router.push("/auth/sign-in");
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
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="text-sm font-semibold">StanzaChat</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleNewChat}
          disabled={createChat.isPending}
          aria-label="New chat"
          data-testid="new-chat"
        >
          <Plus className="size-4" />
          New
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-2">
          {isLoading ? (
            <>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </>
          ) : chats && chats.length > 0 ? (
            chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => router.push(`/chats/${chat.id}`)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  chat.id === selectedChatId
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <MessageSquare className="size-4 shrink-0 opacity-70" />
                <span className="truncate">{chat.title}</span>
              </button>
            ))
          ) : (
            <p className="p-2 text-xs text-muted-foreground">
              No chats yet. Start a new one.
            </p>
          )}
        </nav>
      </ScrollArea>

      <div className="border-t p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors outline-none hover:bg-sidebar-accent/60"
              aria-label="User menu"
            >
              <Avatar className="size-7">
                {user?.image ? <AvatarImage src={user.image} /> : null}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate">
                {user?.name ?? user?.email ?? "Account"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="truncate">
              {user?.email ?? "Signed in"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
