import { getArtifactVersion } from "@repo/db";
import { NotFoundError } from "@repo/shared";

import { wrapRoute } from "@/lib/http";
import { requireSessionScopeOrThrow } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  return wrapRoute(async () => {
    const ctx = await requireSessionScopeOrThrow();
    const { id, versionId } = await params;
    const version = await getArtifactVersion(ctx.db, ctx.scope, versionId);
    if (!version || version.artifactId !== id) {
      throw new NotFoundError("Artifact version", versionId);
    }
    return Response.json({ version });
  });
}
