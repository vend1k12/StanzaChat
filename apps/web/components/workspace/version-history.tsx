"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useArtifactVersions } from "@/lib/hooks/use-artifacts";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

/**
 * Artifact version list (SPEC §5.2 — right panel "Versions" tab).
 *
 * Lists versions newest-first (the API returns them ordered by
 * `version_number` desc). Clicking a version sets it active in the
 * `useUiStore`, which the parent `ArtifactPanel` watches to switch the
 * Preview/Code content.
 *
 * Version entries are buttons with test-friendly text labels (`v1`, `v2`)
 * so the E2E suite can navigate to a specific version reliably.
 */
export interface VersionHistoryProps {
  artifactId: string;
}

export function VersionHistory({ artifactId }: VersionHistoryProps) {
  const { data: versions, isLoading } = useArtifactVersions(artifactId);
  const activeVersionId = useUiStore((s) => s.activeVersionId);
  const setActiveVersion = useUiStore((s) => s.setActiveVersion);

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No versions recorded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {versions.map((version) => {
        const isActive = version.id === activeVersionId;
        return (
          <button
            key={version.id}
            type="button"
            data-testid={`artifact-version-${version.versionNumber}`}
            aria-pressed={isActive ? "true" : "false"}
            onClick={() => setActiveVersion(version.id)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              isActive
                ? "border-primary bg-accent text-accent-foreground"
                : "hover:bg-accent/60",
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              v{version.versionNumber}
              {version.incomplete ? (
                <span className="rounded-xs bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive uppercase">
                  incomplete
                </span>
              ) : null}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(version.createdAt).toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
