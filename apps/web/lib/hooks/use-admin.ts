"use client";

import type { ProviderRecord } from "@repo/ai";
import type { AdminUserRecord, AuditLogRecord } from "@repo/db";
import type {
  CreateProvider,
  RegistrationMode,
  UpdateProvider,
  UpdateUser,
} from "@repo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

/**
 * TanStack Query hooks for the admin surface (SPEC §5.5, §6).
 *
 * Every mutation invalidates its list + the audit-log list so the UI
 * reflects the newly-written audit row without an explicit refetch.
 */

// ── Providers ───────────────────────────────────────────────────────

interface ProvidersResponse {
  providers: ProviderRecord[];
}

export function useProviders() {
  return useQuery({
    queryKey: ["admin", "providers"],
    queryFn: () => apiFetch<ProvidersResponse>("/api/admin/providers"),
    select: (data) => data.providers,
  });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProvider) =>
      apiFetch<{ id: string }>("/api/admin/providers", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "providers"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateProvider }) =>
      apiFetch<{ ok: true }>(`/api/admin/providers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "providers"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });
}

export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/admin/providers/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "providers"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });
}

// ── Users ───────────────────────────────────────────────────────────

/** Wire-format shim: server ISO strings, hook renders `Date` where it matters. */
interface AdminUserDto extends Omit<AdminUserRecord, "createdAt"> {
  createdAt: string;
}
interface UsersResponse {
  users: AdminUserDto[];
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<UsersResponse>("/api/admin/users"),
    select: (data) => data.users,
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateUser }) =>
      apiFetch<{ ok: true }>(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });
}

// ── Settings ────────────────────────────────────────────────────────

interface SettingsDto {
  id: string;
  registrationMode: RegistrationMode;
  setupCompleted: boolean;
}
interface SettingsResponse {
  settings: SettingsDto;
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => apiFetch<SettingsResponse>("/api/admin/settings"),
    select: (data) => data.settings,
  });
}

export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: { registrationMode: RegistrationMode }) =>
      apiFetch<{ ok: true }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });
}

// ── Audit logs ──────────────────────────────────────────────────────

export interface AuditLogFilter {
  actorUserId?: string;
  action?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

interface AuditLogsResponse {
  logs: (Omit<AuditLogRecord, "createdAt"> & { createdAt: string })[];
  total: number;
  limit: number;
  offset: number;
}

export function useAuditLogs(filter: AuditLogFilter) {
  const params = new URLSearchParams();
  if (filter.actorUserId) params.set("actorUserId", filter.actorUserId);
  if (filter.action) params.set("action", filter.action);
  if (filter.since) params.set("since", filter.since);
  if (filter.until) params.set("until", filter.until);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  const qs = params.toString();
  return useQuery({
    queryKey: ["admin", "audit", filter],
    queryFn: () =>
      apiFetch<AuditLogsResponse>(`/api/admin/audit-logs${qs ? `?${qs}` : ""}`),
  });
}
