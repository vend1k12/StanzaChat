import { getArtifactVersion } from "@repo/db";

import { requireSessionScope } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const ctx = await requireSessionScope();
  if (ctx instanceof Response) return ctx;

  const { id, versionId } = await params;
  const version = await getArtifactVersion(ctx.db, ctx.scope, versionId);
  if (!version || version.artifactId !== id) {
    return Response.json(
      { error: { code: "not_found", message: "Artifact version not found" } },
      { status: 404 },
    );
  }
  return Response.json({ version });
}
