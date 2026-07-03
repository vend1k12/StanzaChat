"use client";

import type { ArtifactType } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

/**
 * TanStack Query hooks for artifacts and their versions (SPEC §5.2 / §6).
 *
 * Routes consumed:
 * - GET /api/chats/[id]/artifacts      → { artifacts: ArtifactDto[] }
 * - GET /api/artifacts/[id]/versions   → { versions: ArtifactVersionDto[] }
 * - GET /api/artifacts/[id]/versions/[versionId] → { version: ArtifactVersionDto }
 *
 * Queries are only enabled when the relevant id is truthy so navigating
 * away from a chat/artifact doesn't fire spurious 404s.
 */

/** Artifact row as returned by `GET /api/chats/[id]/artifacts`. */
export interface ArtifactDto {
  id: string;
  chatId: string;
  identifier: string;
  type: ArtifactType;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Artifact version row as returned by the versions routes. */
export interface ArtifactVersionDto {
  id: string;
  artifactId: string;
  versionNumber: number;
  content: string;
  messageId: string | null;
  incomplete: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ArtifactsResponse {
  artifacts: ArtifactDto[];
}

interface VersionsResponse {
  versions: ArtifactVersionDto[];
}

interface VersionResponse {
  version: ArtifactVersionDto;
}

/** `GET /api/artifacts/[id]` returns the artifact + its latest version. */
interface ArtifactResponse {
  artifact: ArtifactDto;
  latestVersion: ArtifactVersionDto | null;
}

/** Fetch a single artifact + its latest version. Enabled only when id truthy. */
export function useArtifact(artifactId: string | null) {
  return useQuery({
    queryKey: ["artifacts", artifactId],
    queryFn: () => apiFetch<ArtifactResponse>(`/api/artifacts/${artifactId}`),
    enabled: Boolean(artifactId),
  });
}

/** List artifacts for a chat. Enabled only when `chatId` is truthy. */
export function useArtifacts(chatId: string | null) {
  return useQuery({
    queryKey: ["chats", chatId, "artifacts"],
    queryFn: () =>
      apiFetch<ArtifactsResponse>(`/api/chats/${chatId}/artifacts`),
    enabled: Boolean(chatId),
    select: (data) => data.artifacts,
  });
}

/** List versions for an artifact (newest first). Enabled only when id truthy. */
export function useArtifactVersions(artifactId: string | null) {
  return useQuery({
    queryKey: ["artifacts", artifactId, "versions"],
    queryFn: () =>
      apiFetch<VersionsResponse>(`/api/artifacts/${artifactId}/versions`),
    enabled: Boolean(artifactId),
    select: (data) => data.versions,
  });
}

/**
 * Fetch a single version by id. The route
 * `GET /api/artifacts/[id]/versions/[versionId]` requires both the
 * artifact id (for the ownership cross-check) and the version id, so both
 * are required here. The panel normally picks the active version from the
 * `useArtifactVersions` list locally; this hook is for direct deep-linking.
 * Enabled only when both ids are truthy.
 */
export function useArtifactVersion(
  artifactId: string | null,
  versionId: string | null,
) {
  return useQuery({
    queryKey: ["artifacts", artifactId, "versions", versionId],
    queryFn: () =>
      apiFetch<VersionResponse>(
        `/api/artifacts/${artifactId}/versions/${versionId}`,
      ),
    enabled: Boolean(artifactId) && Boolean(versionId),
    select: (data) => data.version,
  });
}
