"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAdminUsers, useUpdateAdminUser } from "@/lib/hooks/use-admin";

/**
 * `/admin/users` — SPEC §5.5.
 *
 * List every user, toggle instance role, and ban/unban. Every mutation
 * is server-audited (see `updateUserAdminState`), and role changes also
 * evict the server-side scope cache (see the route handler).
 */
export default function AdminUsersPage() {
  const { data: users, isLoading, error } = useAdminUsers();
  const update = useUpdateAdminUser();

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-base font-semibold">Users</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load"}
          </p>
        ) : users && users.length > 0 ? (
          <table className="w-full text-sm" data-testid="users-table">
            <thead className="text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="pb-2">Email</th>
                <th className="pb-2">Name</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-t align-middle"
                  data-testid={`user-row-${u.id}`}
                >
                  <td className="py-2 font-mono text-xs">{u.email}</td>
                  <td className="py-2">{u.name}</td>
                  <td className="py-2">{u.role}</td>
                  <td className="py-2">
                    {u.banned ? (
                      <span className="text-destructive">banned</span>
                    ) : (
                      <span className="text-muted-foreground">active</span>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No users.</p>
        )}
      </section>
    </div>
  );
}
