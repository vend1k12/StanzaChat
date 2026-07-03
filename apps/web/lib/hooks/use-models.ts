"use client";

import type { ProviderRecord } from "@repo/ai";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

/**
 * TanStack Query hook for `GET /api/models` (SPEC §6).
 *
 * Response shape: `{ providers: ProviderRecord[] }` — only enabled
 * providers are returned by the route.
 */

interface ModelsResponse {
  providers: ProviderRecord[];
}

export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: () => apiFetch<ModelsResponse>("/api/models"),
    select: (data) => data.providers,
  });
}
