"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { signOut } from "@/lib/auth-client";

/**
 * Compact user footer for the admin sidebar. Shows the actor's identity
 * and provides sign-out. The role field is instance-admin by construction
 * — the layout guard would have redirected otherwise.
 */
export interface AdminUserMenuProps {
  email: string;
  name: string | null;
}

export function AdminUserMenu({ email, name }: AdminUserMenuProps) {
  const router = useRouter();
  const initials =
    (name
      ? name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
      : email[0]) ?? "?";

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/auth/sign-in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign out failed");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral text-sm font-medium text-on-primary uppercase">
        {initials.toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-ink">
          {name ?? email.split("@")[0]}
        </span>
        <span className="truncate font-mono text-[11px] text-muted-ink">
          {email}
        </span>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        aria-label="Sign out"
        className="ml-auto rounded-md p-1.5 text-muted-ink transition hover:bg-surface-card hover:text-ink"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
