import { getArtifact, getLatestArtifactVersion } from "@repo/db";

import { requireSessionScope } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireSessionScope();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const artifact = await getArtifact(ctx.db, ctx.scope, id);
  if (!artifact) {
    return Response.json(
      { error: { code: "not_found", message: "Artifact not found" } },
      { status: 404 },
    );
  }

  const latestVersion = await getLatestArtifactVersion(ctx.db, ctx.scope, id);
  return Response.json({ artifact, latestVersion });
}
