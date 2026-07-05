"use client";

import { AlertTriangle, ShieldCheck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useAdminUsers, useUpdateAdminUser } from "@/lib/hooks/use-admin";
import { cn } from "@/lib/utils";

/**
 * `/admin/users` — SPEC §5.5.
 *
 * Editorial user list. The acting admin cannot demote or ban themselves
 * (server enforces it; the UI mirrors the guard by disabling the buttons
 * on their own row). Role changes evict the server-side scope cache
 * (see the route handler).
 */
export default function AdminUsersPage() {
  const { data: users, isLoading, error } = useAdminUsers();
  const { data: sessionData } = useSession();
  const update = useUpdateAdminUser();
  const selfId = sessionData?.user?.id ?? null;

  const totalAdmins = users?.filter((u) => u.role === "admin").length ?? 0;
  const banned = users?.filter((u) => u.banned).length ?? 0;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Instance · Users"
        title="Members and access"
        lede="Promote a teammate to instance admin, revoke access, or unban recovered users. Every mutation is audit-logged."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat label="Total members" value={users?.length ?? 0} />
        <MiniStat label="Instance admins" value={totalAdmins} tone="coral" />
        <MiniStat label="Banned" value={banned} tone="danger" />
      </section>

      <section>
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <p className="text-sm text-error">
            {error instanceof Error ? error.message : "Failed to load"}
          </p>
        ) : users && users.length > 0 ? (
          <ul className="flex flex-col gap-3" data-testid="users-table">
            {users.map((u) => {
              const isSelf = u.id === selfId;
              const canDemote =
                !isSelf && !(u.role === "admin" && totalAdmins <= 1);
              const initials =
                u.name
                  .split(" ")
                  .map((p: string) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() ||
                u.email[0]?.toUpperCase() ||
                "?";
              return (
                <li
                  key={u.id}
                  className={cn(
                    "grid grid-cols-1 items-center gap-4 rounded-lg border border-hairline bg-canvas px-5 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]",
                    isSelf && "border-coral/40 bg-coral/5",
                  )}
                  data-testid={`user-row-${u.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium uppercase",
                        u.role === "admin"
                          ? "bg-coral text-on-primary"
                          : "bg-surface-cream-strong text-ink",
                      )}
                    >
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-ink">
                          {u.name || u.email.split("@")[0]}
                        </p>
                        {isSelf ? (
                          <span className="rounded-full bg-coral/15 px-2 py-0.5 font-mono text-[10px] tracking-widest text-coral uppercase">
                            you
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate font-mono text-[11px] text-muted-ink">
                        {u.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <RoleBadge role={u.role} />
                    {u.banned ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-error uppercase">
                        <AlertTriangle className="size-2.5" />
                        banned
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        (u.role === "admin" && !canDemote) || update.isPending
                      }
                      title={
                        isSelf
                          ? "You cannot change your own role"
                          : u.role === "admin" && !canDemote
                            ? "Cannot demote the last remaining admin"
                            : undefined
                      }
                      onClick={async () => {
                        try {
                          await update.mutateAsync({
                            id: u.id,
                            updates: {
                              role: u.role === "admin" ? "user" : "admin",
                            },
                          });
                          toast.success("Role updated");
                        } catch (err) {
                          toast.error(
                            err instanceof ApiError
                              ? err.message
                              : "Role update failed",
                          );
                        }
                      }}
                    >
                      {u.role === "admin" ? "Demote" : "Promote"}
                    </Button>
                    <Button
                      size="sm"
                      variant={u.banned ? "default" : "destructive"}
                      disabled={isSelf || update.isPending}
                      title={isSelf ? "You cannot ban yourself" : undefined}
                      onClick={async () => {
                        try {
                          await update.mutateAsync({
                            id: u.id,
                            updates: { banned: !u.banned },
                          });
                          toast.success(
                            u.banned ? "User unbanned" : "User banned",
                          );
                        } catch (err) {
                          toast.error(
                            err instanceof ApiError
                              ? err.message
                              : "Ban toggle failed",
                          );
                        }
                      }}
                    >
                      {u.banned ? "Unban" : "Ban"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-ink">No users.</p>
        )}
      </section>
    </div>
  );
}

function RoleBadge({ role }: { role: "admin" | "user" }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-coral px-2.5 py-1 font-mono text-[10px] tracking-widest text-on-primary uppercase">
        <ShieldCheck className="size-3" />
        admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-cream-strong px-2.5 py-1 font-mono text-[10px] tracking-widest text-muted-ink uppercase">
      <UserIcon className="size-3" />
      user
    </span>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "coral" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-hairline bg-surface-card px-5 py-4",
        tone === "coral" && "border-coral/30 bg-coral/10",
        tone === "danger" && "border-error/30 bg-error/5",
      )}
    >
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "mt-2 font-display text-[32px] leading-none tracking-tight text-ink",
          tone === "coral" && "text-coral",
          tone === "danger" && value > 0 && "text-error",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-lg border border-hairline bg-surface-card"
        />
      ))}
    </div>
  );
}
