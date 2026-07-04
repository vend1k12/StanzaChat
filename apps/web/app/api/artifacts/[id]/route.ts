import { getArtifact, getLatestArtifactVersion } from "@repo/db";
import { NotFoundError } from "@repo/shared";

import { wrapRoute } from "@/lib/http";
import { requireSessionScopeOrThrow } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return wrapRoute(async () => {
    const ctx = await requireSessionScopeOrThrow();
    const { id } = await params;
    const artifact = await getArtifact(ctx.db, ctx.scope, id);
    if (!artifact) {
      throw new NotFoundError("Artifact", id);
    }
    const latestVersion = await getLatestArtifactVersion(ctx.db, ctx.scope, id);
    return Response.json({ artifact, latestVersion });
  });
}
