"use client";

import { X } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArtifactSandbox } from "@/components/workspace/artifact-sandbox";
import {
  type ArtifactVersionDto,
  useArtifact,
  useArtifactVersions,
} from "@/lib/hooks/use-artifacts";
import { useUiStore } from "@/store/ui-store";

import { VersionHistory } from "./version-history";

/**
 * Right column — artifact preview/code/versions (SPEC §5.3).
 *
 * Receives its `artifactId` from the `useUiStore` (set by clicking an
 * artifact chip in the message list). Fetches the artifact metadata +
 * latest version via `useArtifact`, and the full version list via
 * `useArtifactVersions`. The active version defaults to the latest and
 * is switched by `VersionHistory` through the store.
 *
 * The Preview tab renders untrusted model output inside the
 * origin-isolated `ArtifactSandbox` — never inline.
 */
export interface ArtifactPanelProps {
  artifactId: string | null;
}

export function ArtifactPanel({ artifactId }: ArtifactPanelProps) {
  const { data: artifactData, isLoading } = useArtifact(artifactId);
  const { data: versions } = useArtifactVersions(artifactId);
  const activeVersionId = useUiStore((s) => s.activeVersionId);
  const setActiveVersion = useUiStore((s) => s.setActiveVersion);
  const setPanelOpen = useUiStore((s) => s.setPanelOpen);

  const latestVersion = artifactData?.latestVersion ?? null;

  // Default the active version to the latest whenever the artifact or its
  // latest version changes (e.g. opening a new artifact chip).
  useEffect(() => {
    if (latestVersion && !activeVersionId) {
      setActiveVersion(latestVersion.id);
    }
  }, [latestVersion, activeVersionId, setActiveVersion]);

  // Reset the active version when the artifact itself changes.
  useEffect(() => {
    setActiveVersion(null);
  }, [artifactId, setActiveVersion]);

  const activeVersion: ArtifactVersionDto | undefined = useMemo(() => {
    if (!versions) return undefined;
    if (activeVersionId) {
      return versions.find((v) => v.id === activeVersionId);
    }
    return versions[0];
  }, [versions, activeVersionId]);

  const artifact = artifactData?.artifact;
  const content = activeVersion?.content ?? latestVersion?.content ?? "";
  const artifactType = artifact?.type ?? "html";

  if (!artifactId) return null;

  return (
    <aside
      className="flex h-full w-2xl max-w-[50vw] shrink-0 flex-col border-l border-hairline bg-canvas"
      data-testid="artifact-panel"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-hairline px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[10px] tracking-widest text-coral uppercase">
            artifact
          </span>
          <span className="truncate font-display text-[18px] leading-none tracking-tight text-ink">
            {artifact?.title || artifact?.identifier || "Artifact"}
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setPanelOpen(false)}
          aria-label="Close artifact panel"
          className="size-8"
        >
          <X className="size-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="size-full flex-1" />
        </div>
      ) : (
        <Tabs defaultValue="preview" className="flex flex-1 flex-col gap-2 p-3">
          <TabsList className="self-start">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="min-h-0 flex-1">
            <div className="size-full overflow-hidden rounded-lg border border-hairline">
              <ArtifactSandbox
                content={content}
                artifactType={artifactType}
                title={artifact?.title ?? "Artifact preview"}
              />
            </div>
          </TabsContent>

          <TabsContent value="code" className="min-h-0 flex-1">
            <ScrollArea className="size-full overflow-hidden rounded-lg border border-hairline bg-surface-dark">
              <pre className="p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-on-dark">
                {content || "(empty)"}
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="versions" className="min-h-0 flex-1">
            <ScrollArea className="size-full">
              <VersionHistory artifactId={artifactId} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}
    </aside>
  );
}
