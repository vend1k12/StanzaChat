import { listArtifactVersions } from "@repo/db";
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
    const versions = await listArtifactVersions(ctx.db, ctx.scope, id);
    if (versions === undefined) {
      throw new NotFoundError("Artifact", id);
    }
    return Response.json({ versions });
  });
}
