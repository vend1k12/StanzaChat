"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { ViewToggle } from "@/components/admin/view-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useAdminUsers, useUpdateAdminUser } from "@/lib/hooks/use-admin";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

/**
 * `/admin/users` — SPEC §5.5.
 *
 * Editorial user list with a two-mode viewer: `cards` (roomy, avatar-first)
 * for review + audit, `table` (compact, sortable, filterable) for
 * bulk-management work. The acting admin cannot demote or ban themselves
 * (server enforces it; the UI mirrors the guard by disabling the buttons
 * on their own row). Role changes evict the server-side scope cache
 * (see the route handler).
 */

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  banned: boolean;
  createdAt: string;
};

type SortKey = "name" | "role" | "createdAt";
type SortDir = "asc" | "desc";

export default function AdminUsersPage() {
  const { data: users, isLoading, error } = useAdminUsers();
  const { data: sessionData } = useSession();
  const update = useUpdateAdminUser();
  const selfId = sessionData?.user?.id ?? null;
  const viewMode = useUiStore((s) => s.adminViewMode.users);
  const setViewMode = useUiStore((s) => s.setAdminViewMode);

  const totalAdmins = users?.filter((u) => u.role === "admin").length ?? 0;
  const banned = users?.filter((u) => u.banned).length ?? 0;

  async function updateUser(
    id: string,
    updates: { role?: "admin" | "user"; banned?: boolean },
    successMessage: string,
  ) {
    try {
      await update.mutateAsync({ id, updates });
      toast.success(successMessage);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Instance · Users"
        title="Members and access"
        lede="Promote a teammate to instance admin, revoke access, or unban recovered users. Every mutation is audit-logged."
        actions={
          <ViewToggle
            value={viewMode}
            onChange={(mode) => setViewMode("users", mode)}
          />
        }
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
          viewMode === "cards" ? (
            <CardsView
              users={users}
              selfId={selfId}
              totalAdmins={totalAdmins}
              updatePending={update.isPending}
              onUpdate={updateUser}
            />
          ) : (
            <TableView
              users={users}
              selfId={selfId}
              totalAdmins={totalAdmins}
              updatePending={update.isPending}
              onUpdate={updateUser}
            />
          )
        ) : (
          <p className="text-sm text-muted-ink">No users.</p>
        )}
      </section>
    </div>
  );
}

// ── Cards view ──────────────────────────────────────────────────────

interface ViewProps {
  users: UserRow[];
  selfId: string | null;
  totalAdmins: number;
  updatePending: boolean;
  onUpdate: (
    id: string,
    updates: { role?: "admin" | "user"; banned?: boolean },
    successMessage: string,
  ) => void | Promise<void>;
}

function CardsView({
  users,
  selfId,
  totalAdmins,
  updatePending,
  onUpdate,
}: ViewProps) {
  return (
    <ul className="flex flex-col gap-3" data-testid="users-table">
      {users.map((u) => {
        const isSelf = u.id === selfId;
        const canDemote = !isSelf && !(u.role === "admin" && totalAdmins <= 1);
        const initials = deriveInitials(u.name, u.email);
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
                disabled={(u.role === "admin" && !canDemote) || updatePending}
                title={
                  isSelf
                    ? "You cannot change your own role"
                    : u.role === "admin" && !canDemote
                      ? "Cannot demote the last remaining admin"
                      : undefined
                }
                onClick={() =>
                  void onUpdate(
                    u.id,
                    { role: u.role === "admin" ? "user" : "admin" },
                    "Role updated",
                  )
                }
              >
                {u.role === "admin" ? "Demote" : "Promote"}
              </Button>
              <Button
                size="sm"
                variant={u.banned ? "default" : "destructive"}
                disabled={isSelf || updatePending}
                title={isSelf ? "You cannot ban yourself" : undefined}
                onClick={() =>
                  void onUpdate(
                    u.id,
                    { banned: !u.banned },
                    u.banned ? "User unbanned" : "User banned",
                  )
                }
              >
                {u.banned ? "Unban" : "Ban"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Table view ──────────────────────────────────────────────────────

function TableView({
  users,
  selfId,
  totalAdmins,
  updatePending,
  onUpdate,
}: ViewProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? users.filter(
          (u) =>
            u.email.toLowerCase().includes(q) ||
            u.name.toLowerCase().includes(q),
        )
      : users.slice();

    filtered.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name": {
          const av = (a.name || a.email).toLowerCase();
          const bv = (b.name || b.email).toLowerCase();
          return av.localeCompare(bv) * dir;
        }
        case "role":
          return a.role.localeCompare(b.role) * dir;
        case "createdAt":
        default:
          return (
            (new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()) *
            dir
          );
      }
    });
    return filtered;
  }, [users, search, sortKey, sortDir]);

  function onHeaderClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-hairline bg-canvas"
      data-testid="users-table"
    >
      <div className="flex items-center gap-3 border-b border-hairline bg-surface-card px-4 py-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name or email…"
          className="h-8 max-w-xs bg-canvas text-[13px]"
          aria-label="Filter users"
        />
        <span className="ml-auto font-mono text-[11px] tracking-widest text-muted-ink uppercase">
          {sorted.length} of {users.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-hairline bg-surface-soft text-[11px] tracking-widest text-muted-ink uppercase">
            <tr>
              <SortableTh
                label="Member"
                columnKey="name"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={onHeaderClick}
              />
              <SortableTh
                label="Role"
                columnKey="role"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={onHeaderClick}
              />
              <th className="px-4 py-2.5 font-medium">Status</th>
              <SortableTh
                label="Joined"
                columnKey="createdAt"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={onHeaderClick}
                align="right"
              />
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {sorted.map((u) => {
              const isSelf = u.id === selfId;
              const canDemote =
                !isSelf && !(u.role === "admin" && totalAdmins <= 1);
              return (
                <tr
                  key={u.id}
                  data-testid={`user-row-${u.id}`}
                  className={cn(
                    "text-[13px] transition hover:bg-surface-soft/60",
                    isSelf && "bg-coral/[0.04]",
                  )}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-ink">
                        {u.name || u.email.split("@")[0]}
                      </p>
                      {isSelf ? (
                        <span className="rounded-full bg-coral/15 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-coral uppercase">
                          you
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate font-mono text-[11px] text-muted-ink">
                      {u.email}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-2.5">
                    {u.banned ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-error uppercase">
                        <AlertTriangle className="size-2.5" />
                        banned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] tracking-wide text-muted-ink">
                        <span className="size-1.5 rounded-full bg-accent-teal" />
                        active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[11px] text-muted-ink">
                    {new Date(u.createdAt).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          (u.role === "admin" && !canDemote) || updatePending
                        }
                        title={
                          isSelf
                            ? "You cannot change your own role"
                            : u.role === "admin" && !canDemote
                              ? "Cannot demote the last remaining admin"
                              : undefined
                        }
                        onClick={() =>
                          void onUpdate(
                            u.id,
                            {
                              role: u.role === "admin" ? "user" : "admin",
                            },
                            "Role updated",
                          )
                        }
                      >
                        {u.role === "admin" ? "Demote" : "Promote"}
                      </Button>
                      <Button
                        size="sm"
                        variant={u.banned ? "default" : "destructive"}
                        disabled={isSelf || updatePending}
                        title={isSelf ? "You cannot ban yourself" : undefined}
                        onClick={() =>
                          void onUpdate(
                            u.id,
                            { banned: !u.banned },
                            u.banned ? "User unbanned" : "User banned",
                          )
                        }
                      >
                        {u.banned ? "Unban" : "Ban"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-[13px] text-muted-ink"
                >
                  No users match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SortableThProps {
  label: string;
  columnKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (key: SortKey) => void;
  align?: "left" | "right";
}

function SortableTh({
  label,
  columnKey,
  sortKey,
  sortDir,
  onClick,
  align = "left",
}: SortableThProps) {
  const active = sortKey === columnKey;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn(
        "px-4 py-2.5 font-medium",
        align === "right" && "text-right",
      )}
    >
      <button
        type="button"
        onClick={() => onClick(columnKey)}
        className={cn(
          "inline-flex items-center gap-1 transition hover:text-ink",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className={cn("size-3", active ? "text-ink" : "opacity-40")} />
      </button>
    </th>
  );
}

function deriveInitials(name: string, email: string): string {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ||
    email[0]?.toUpperCase() ||
    "?"
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
